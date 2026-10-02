(function(){
  const M=document.getElementById('messages');
  const A=document.getElementById('chat-actions');
  const F=document.getElementById('chat-form');
  const I=document.getElementById('chat-input');
  const APP=document.getElementById('chat-app');
  const INTRO=document.getElementById('secure-intro');
  const CONNECT=document.getElementById('connect-button');
  const STATUS=document.getElementById('connect-status');
  const STATUS_TEXT=document.getElementById('connect-status-text');
  const PROGRESS=document.getElementById('connect-progress-bar');

  const STATE_KEY='phantomPoliceMainChatV11State';
  const DECLINE_KEY='phantomPoliceMainChatV11Declines';
  const LOG_KEY='phantomPoliceMainChatV11Log';
  const SEQUENCE_KEY='phantomPoliceMainChatV11Sequence';
  const INTRO_KEY='phantomSecureChatIntroSeenV1';

  let state=localStorage.getItem(STATE_KEY)||'start';
  let declineCount=parseInt(localStorage.getItem(DECLINE_KEY)||'0',10)||0;
  let log=[];
  let busy=false;

  // 相沢の連続メッセージは「前の文を読む時間 + 2秒」で次を表示。
  // 読書速度は約600文字/分（10文字/秒）を基準にしています。
  // 本番用基本ディレイ: 10文字/秒 + 2秒 / 最低3秒 / 最大14秒 / URL送信2秒
  const DEBUG_NO_DELAY=false;
  const READING_CHARS_PER_SEC=10;
  const EXTRA_PAUSE_MS=2000;
  const MIN_CHAT_DELAY_MS=3000;
  const MAX_CHAT_DELAY_MS=14000;
  let lastReadableChars=0;
  let lastRole=null;

  const qs=new URLSearchParams(location.search);

  try{log=JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch(e){log=[]}

  function saveState(s){
    state=s;
    localStorage.setItem(STATE_KEY,s);
  }

  function saveLog(){
    localStorage.setItem(LOG_KEY,JSON.stringify(log));
  }

  function now(){
    return new Date().toLocaleTimeString('ja-JP',{
      hour:'2-digit',
      minute:'2-digit'
    });
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g,c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function scrollBottom(){
    requestAnimationFrame(()=>{
      M.scrollTop=M.scrollHeight;
    });
  }

  function renderItem(item,save=false){
    if(item.role==='system'){
      const row=document.createElement('div');
      row.className='message-row system';
      row.innerHTML='<div class="system-pill">'+item.html+'</div>';
      M.appendChild(row);
    }else{
      const row=document.createElement('div');
      row.className='message-row '+(
        item.role==='user'
          ?'mine'
          :item.role==='unknown'
            ?'unknown'
            :item.role==='ojisan'
              ?'ojisan'
              :'aizawa'
      );

      if(item.role!=='user'){
        const avatar=document.createElement('div');
        avatar.className='chat-avatar';
        avatar.textContent=(item.role==='ojisan'||item.role==='unknown')?'？':'相';
        row.appendChild(avatar);
      }

      const stack=document.createElement('div');
      stack.className='message-stack';

      if(item.role!=='user'){
        const name=document.createElement('div');
        name.className='sender-name';
        name.textContent=item.role==='unknown'
          ?'UNKNOWN USER'
          :item.role==='ojisan'
            ?'未登録ユーザー'
            :'相沢 直人';
        stack.appendChild(name);
      }

      const bubble=document.createElement('div');
      bubble.className='bubble';
      bubble.innerHTML=item.html;
      stack.appendChild(bubble);

      const meta=document.createElement('div');
      meta.className='message-meta';
      meta.textContent=item.time||'';
      stack.appendChild(meta);

      row.appendChild(stack);
      M.appendChild(row);
    }

    if(save){
      log.push(item);
      saveLog();
    }

    scrollBottom();
  }

  function addMessage(html,role='aizawa'){
    renderItem({role,html,time:now()},true);

    trackReading(html,role);
  }

  function trackReading(html,role){

    const plain=String(html)
      .replace(/<[^>]+>/g,'')
      .replace(/&nbsp;/g,' ')
      .replace(/&amp;/g,'&')
      .replace(/&lt;/g,'<')
      .replace(/&gt;/g,'>')
      .trim();

    if(role==='aizawa' || role==='ojisan' || role==='unknown'){
      lastReadableChars=plain.length;
      lastRole=role;
    }else{
      lastReadableChars=0;
      lastRole=role;
    }
  }

  function addUser(text){
    addMessage(escapeHTML(text),'user');
  }

  function addSystem(text){
    addMessage(escapeHTML(text),'system');
  }

  function clearTyping(){
    const existing=M.querySelector('.typing-row');
    if(existing)existing.remove();
  }

  function showTyping(role='aizawa'){
    clearTyping();

    const name=role==='unknown'
      ?'UNKNOWN USER'
      :role==='ojisan'
        ?'未登録ユーザー'
        :'相沢 直人';
    const av=(role==='ojisan'||role==='unknown')?'？':'相';

    const row=document.createElement('div');
    row.className='typing-row '+role;
    row.innerHTML=
      '<div class="chat-avatar">'+av+'</div>'+
      '<div class="typing-stack">'+
        '<div class="typing-name">'+name+'</div>'+
        '<div class="typing-bubble"><i></i><i></i><i></i></div>'+
      '</div>';

    M.appendChild(row);
    scrollBottom();
  }

  function wait(ms){
    return new Promise(r=>setTimeout(r,DEBUG_NO_DELAY?0:ms));
  }

  function fxWait(ms){
    return new Promise(r=>setTimeout(r,ms));
  }

  function readingDelay(){
    // 連続する相沢／おじさんの発言では、
    // 直前の吹き出しを読む時間に2秒を足す。
    if(lastRole==='aizawa' || lastRole==='ojisan' || lastRole==='unknown'){
      const readingMs=(lastReadableChars/READING_CHARS_PER_SEC)*1000;
      return Math.max(
        MIN_CHAT_DELAY_MS,
        Math.min(MAX_CHAT_DELAY_MS,Math.round(readingMs+EXTRA_PAUSE_MS))
      );
    }

    // ユーザーが送信した直後などは、最低3秒は「入力中」を見せる。
    return MIN_CHAT_DELAY_MS;
  }

  async function later(html,delay=null,role='aizawa'){
    showTyping(role);

    // 個別指定のdelayも最低3秒を下回らないようにし、
    // 通常は「前の文を読む時間 + 2秒」を使用する。
    const waitMs=delay===null
      ? readingDelay()
      : Math.max(MIN_CHAT_DELAY_MS,delay);

    await wait(waitMs);

    clearTyping();
    addMessage(html,role);
  }

  // 連続会話の進行位置を保存し、更新後は未表示の発言から再開する。
  // 保存済み履歴も照合することで、旧版で止まった会話や、発言の保存直後の更新にも対応する。
  async function playConversation(name,steps){
    let next=0;
    try{
      const saved=JSON.parse(localStorage.getItem(SEQUENCE_KEY)||'null');
      if(saved && saved.name===name && Number.isInteger(saved.next) &&
        saved.next>=0 && saved.next<=steps.length){
        next=saved.next;
      }
    }catch(e){}

    let logIndex=0;
    for(let i=0;i<steps.length;i++){
      const step=steps[i];
      if(step.run)continue;

      const role=step.role||'aizawa';
      const found=log.findIndex((item,index)=>
        index>=logIndex && item.role===role && item.html===step.html
      );
      if(found<0)break;
      logIndex=found+1;
      next=Math.max(next,i+1);
    }

    const checkpoint=index=>{
      localStorage.setItem(SEQUENCE_KEY,JSON.stringify({name,next:index}));
    };
    checkpoint(next);

    for(let i=next;i<steps.length;i++){
      const step=steps[i];
      if(step.run){
        await step.run();
      }else if(step.link){
        showTyping(step.role||'aizawa');
        await wait(2000);
        clearTyping();
        addMessage(step.html,step.role||'aizawa');
      }else{
        await later(step.html,step.delay===undefined?null:step.delay,step.role||'aizawa');
      }
      checkpoint(i+1);
    }
  }

  function finishConversation(){
    localStorage.removeItem(SEQUENCE_KEY);
  }

  function clearActions(){
    A.innerHTML='';
  }

  function recommendations(items){
    A.innerHTML='<div class="ai-recommend-label">会話支援AIの返信候補</div>';

    items.forEach(([label,fn,primary])=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='recommend-chip'+(primary?' primary':'');
      b.textContent=label;

      b.onclick=()=>{
        if(busy)return;
        addUser(label);
        clearActions();
        fn();
      };

      A.appendChild(b);
    });

    scrollBottom();
  }

  function repoRoot(){
    const marker='/police/';
    const i=location.pathname.indexOf(marker);

    if(i>=0){
      return location.origin+location.pathname.slice(0,i+1);
    }

    return new URL('../../',location.href).href;
  }

  function policeRoot(){
    return repoRoot()+'police/';
  }

  function investigationURL(){
    return repoRoot()+'investigation/';
  }

  function phase2URL(){
    return repoRoot()+'investigation/phase2/';
  }

  function namedLink(url,label){
    const safeURL=escapeHTML(url);
    const safeLabel=escapeHTML(label);
    return '<a href="'+safeURL+'" target="_blank" rel="noopener noreferrer">'+safeLabel+'</a>';
  }

  function takeoverOverlay(){
    let overlay=document.getElementById('takeover-overlay');
    if(overlay)return overlay;

    overlay=document.createElement('div');
    overlay.id='takeover-overlay';
    overlay.className='takeover-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<div class="takeover-static"></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  async function takeoverEffect(){
    const overlay=takeoverOverlay();

    overlay.className='takeover-overlay active blackout';
    await fxWait(600);

    overlay.className='takeover-overlay active static';
    await fxWait(2400);

    overlay.className='takeover-overlay active blackout';
    await fxWait(400);

    overlay.className='takeover-overlay';
    await fxWait(200);
  }

  async function restoreEffect(){
    const overlay=takeoverOverlay();

    overlay.className='takeover-overlay active static';
    await fxWait(1600);

    overlay.className='takeover-overlay active blackout';
    await fxWait(350);

    overlay.className='takeover-overlay';
    await fxWait(200);
  }

  function normalize(v){
    return String(v)
      .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
      .replace(/[／]/g,'/')
      .replace(/[－―ー]/g,'-')
      .replace(/\s|　/g,'');
  }

  function isCorrectDate(v){
    const n=normalize(v);

    return (
      /2022(?:年|[\/.\-])?10(?:月|[\/.\-])?0?2(?:日)?/.test(n) ||
      /^10(?:月|[\/.\-])0?2(?:日)?$/.test(n)
    );
  }

  function isBirthday(v){
    const n=normalize(v);

    return (
      /2022(?:年|[\/.\-])?10(?:月|[\/.\-])?0?3(?:日)?/.test(n) ||
      /^10(?:月|[\/.\-])0?3(?:日)?$/.test(n)
    );
  }

  function isCorrectPlace(v){
    const n=String(v).replace(/\s|　/g,'');
    return /愛媛|松山|道後/.test(n);
  }

  // 自由入力は「現在の会話フェーズ」で意味を判定する。
  // AIレコメンドの文言と完全一致しなくても、同じ意味なら進行させる。
  function intentText(v){
    return String(v)
      .normalize('NFKC')
      .replace(/\s|　/g,'')
      .replace(/[。、,.!?！？「」『』"'’]/g,'')
      .toLowerCase();
  }

  function isDeclineText(v){
    const t=intentText(v);
    return /協力しない|協力できない|協力しません|やりません|やらない|無理|いや|嫌|断る|断ります|やめとく/.test(t);
  }

  function isCooperateText(v){
    const t=intentText(v);
    if(isDeclineText(v))return false;
    return /協力します|協力する|協力したい|手伝います|手伝う|やります|やる|はい|いいよ|了解|お願いします/.test(t);
  }

  function isGlitchText(v){
    return String(v).trim()==='GLITCH';
  }

  function isSquirrelQrFoundText(v){
    const t=intentText(v);
    const found=/見つけ|発見|あった|ありました|出てき|置いてあった|置いてありました/.test(t);
    const qr=/qr|二次元コード/.test(t);
    const squirrelUnder=/(リス.*下|下.*リス)/.test(t);
    return found&&(qr||squirrelUnder);
  }

  function isSquirrelHomeText(v){
    const t=intentText(v);
    return /自宅|自分の家|家です|家に|うち|ウチ/.test(t);
  }

  function isSquirrelExistingText(v){
    const t=intentText(v);
    return /^(はい|うん|そうです|そう)$/i.test(t) ||
      /前から|以前から|もともと|元々|今回の件より前|昔から/.test(t);
  }

  function isTakeoverReportText(v){
    const t=intentText(v);
    return /怪しい.*(人|人物)|人物.*(話|会話)|誰か.*(話|会話)|unknown|知らない.*(人|相手)|怪盗.*(話|会話|出)|メッセージ.*(来|届|表示)|乗っ取/.test(t);
  }

  function isUnknownMissingText(v){
    const t=intentText(v);
    return /わから|分から|分かりません|不明|心当たり.*ない|今のところ.*ない|まだ.*分から|確認できない/.test(t);
  }

  function isNoHomeAbnormalityText(v){
    const t=intentText(v);
    return /特に.*(?:ない|ありません)|何も.*ない|異常.*ない|変わった.*ない|問題.*ない|大丈夫/.test(t);
  }

  function isContinuePhase2Text(v){
    const t=intentText(v);
    return /分かりました|わかりました|分かった|わかった|了解|確認します|確認してみます|見てみます|調べます|やってみます|続けます|^はい$/.test(t);
  }

  function isPuzzleSolvedText(v){
    const t=intentText(v);
    return /謎.*全部.*解け|全部.*謎.*解け|全部.*解け|謎.*解けました|解き終わ|クリアしました|クリアした|終わりました/.test(t);
  }

  function isNothingStolenText(v){
    const t=intentText(v);
    return /特に.*ない|何も.*ない|ありませんでした|なかった|盗まれて.*ない|盗られて.*ない|取られて.*ない/.test(t);
  }

  async function introConversation(){
    if(state!=='start'||busy)return;

    busy=true;

    await playConversation('intro',[
      {html:'こんにちは。<br>怪盗関連事件特別捜査本部の相沢です。'},
      {html:'こちらから突然ご連絡する形になってしまい、すみません。急に手紙が届いて驚きましたよね。'},
      {html:'現在、過去に怪盗による被害に遭われた方へ、順次ご連絡しています。'},
      {html:'今回、ある事件について捜査へのご協力をお願いしたく、ご連絡しました。'},
      {html:'ただ、その前に。<br>念のため、簡単な本人確認をさせてください。'},
      {html:'以前、怪盗による被害に遭われた日付を覚えていますか？<br><br>本人確認のため、教えていただけますか？'}
    ]);

    saveState('verifyDate');
    finishConversation();
    busy=false;
    I.focus();
  }

  async function dateVerified(){
    saveState('verifyPlace');
    busy=true;

    await later('はい、確認できました。',800);
    await later('もう一点だけお願いします。');
    await later('その事件があった場所は、どちらでしたか？');

    busy=false;
    I.focus();
  }

  async function verified(){
    saveState('offerPending');
    busy=true;

    await playConversation('offer',[
      {html:'ありがとうございます。',delay:700},
      {html:'本人確認が取れました。'},
      {html:'2022年10月2日、愛媛県松山市の道後温泉で発生した事件ですね。'},
      {html:'少し長くなってしまうんですが、今回ご連絡した理由を説明します。'},
      {html:'実はつい最近、怪盗関連事件特別捜査本部宛てに、送信元の分からないURLが届きました。'},
      {html:'技術的に危険なページではないことは確認できているんですが……'},
      {html:'そのページに、少し気になる言葉がありまして。'},
      {html:'「かつて怪盗事件に巻き込まれた者ならば、この五つの痕跡も読み解けるはずだ」と書かれているんです。'},
      {html:'こちらでも調べていますが、まだ解読には至っていません。'},
      {html:'そこで、過去に怪盗による被害に遭われた方々へ、ご連絡しています。'},
      {html:'以前、怪盗による被害に遭われたあなたなら、こちらでは気づけていない手掛かりを見つけられるかもしれないと思いまして。'},
      {html:'もちろん、危険なことをお願いするつもりはありません。'},
      {html:'こちらからお渡しする資料を確認して、何か気づいたことがあれば教えていただきたい、というお願いです。'},
      {html:'突然こんなお願いをしてしまってすみません。'},
      {html:'もしよければ、今回の捜査に協力していただけませんか？'}
    ]);

    saveState('offer');
    finishConversation();

    recommendations([
      ['捜査に協力する',cooperate,true],
      ['捜査に協力しない',decline,false]
    ]);

    busy=false;
  }

  async function decline(){
    busy=true;
    clearActions();

    declineCount++;
    localStorage.setItem(DECLINE_KEY,String(declineCount));

    if(declineCount===1){
      await later('え、協力しない……？',650);
      await later('冗談……ですよね？',900);
      await later('あ、もしかしてAIのレコメンド機能で、間違えて押しちゃいました？（笑）');
      await later('僕もたまにやっちゃうんですよ（笑）');
      await later('じゃあ、改めて聞きますね。');
    }else if(declineCount===2){
      await later('……またですか？（笑）',650);
      await later('AI、今日はずいぶん調子が悪いみたいですね。');
      await later('では、改めてもう一度。');
    }else{
      await later('……なるほど（笑）',650);
      await later('たぶん、また押し間違いですよね。');
      await later('それでは改めて。');
    }

    await later('今回の捜査に協力していただけますか？');

    recommendations([
      ['捜査に協力する',cooperate,true],
      ['捜査に協力しない',decline,false]
    ]);

    busy=false;
  }

  async function cooperate(){
    busy=true;
    clearActions();
    saveState('mission');

    await later('はい、ありがとうございます。',700);
    await later('助かります。');

    await later('それでは、今回発見された不審なページを共有します。');
    showTyping();
    await wait(2000);
    clearTyping();
    addMessage(namedLink(investigationURL(),'UNKNOWN PAGE'));

    await later('現時点では、危険なプログラムなどは確認されていませんので、そのまま開いていただいて大丈夫です。');

    await later('あわせて、参考資料として怪盗関連事件特別捜査本部のホームページもお送りします。');
    await later('過去の事件や怪盗に関する情報は、サイト内の「事件・怪盗DB」から確認できます。こちらも必要に応じて確認してみてください。');
    showTyping();
    await wait(2000);
    clearTyping();
    addMessage(namedLink(policeRoot(),'怪盗関連事件特別捜査本部 HP'));

    await later('何か分からない点や、気になることがあれば、このチャットでお気軽に聞いてください！');

    await later('あ、最後に1点だけ注意点です。');
    await later('このチャットは、セキュリティの関係で初回に接続した端末情報と紐づいています。');
    await later('なので、このチャットだけは今お使いの端末から開くようにしてください。');
    await later('先ほどお送りしたページや本部ホームページについては、パソコンなど別の端末で確認していただいて大丈夫です。');
    await later('それでは、お願いいたします！');

    busy=false;
  }

  async function receiveGlitch(){
    busy=true;
    clearActions();

    await later('「GLITCH」……ですか？');
    await later('怪盗グリッチのことでしょうか。');
    await later('あ、すみません。別件の内線が入ってしまい、ちょっと待ってくださいね。');

    await later('今、確認が取れたのですが、今回ご協力をお願いしている別の方から、先ほどページの解読が完了したとの報告がありました。');
    await later('ただ、その方の画面に「"リスの置物"を探せ。その下を調べろ。」と表示されたそうなんですが……。');
    await later('何のことなのか分からない、ということでして。');
    await later('どこのリスの置物なんでしょう……。');

    saveState('askSquirrelQR');
    recommendations([
      ['リスの置物の下から、QRコードを見つけました',reportSquirrelQR,true]
    ]);

    busy=false;
  }

  async function reportSquirrelQR(){
    busy=true;
    clearActions();

    await later('え、リスの置物の下からQRコードを見つけたんですか！？');
    await later('といいますか、あなたも謎が解けていたのですね。');
    await later('それで、そのリスの置物は、どこにあったんですか！');

    saveState('askSquirrelWhere');
    recommendations([
      ['私の家です',reportSquirrelHome,true]
    ]);

    busy=false;
  }

  async function reportSquirrelHome(){
    busy=true;
    clearActions();

    await later('……え？');
    await later('あなたの家ですか？');

    await later('すみません、少し確認させてください。');
    await later('そのリスの置物は、今回の件が始まる前から、ご自宅にあったものですか？');

    saveState('askSquirrelExisting');
    recommendations([
      ['はい',confirmSquirrelExisting,true]
    ]);

    busy=false;
  }

  async function confirmSquirrelExisting(){
    busy=true;
    clearActions();

    await later('……そうですか。');
    await later('だとすると、少し話が変わってきます。');

    await later('他の方にも同じ「"リスの置物"を探せ。その下を調べろ。」という表示が出ている。');
    await later('でも、その指示に実際に該当するものが見つかったのは、今のところあなただけです。');
    await later('もしかすると、今回の件そのものが、あなた個人に向けて用意された予告状なのかもしれません。');

    await later('それと、もう一点気になります。');
    await later('相手は、あなたのご自宅に「リスの置物」があることを知っていた。');
    await later('そして、その下にQRコードが置かれていた。');
    await later('もし、そのQRコードが最近置かれたものだとすれば……');
    await later('誰かがご自宅の中に入った可能性も考えなくてはいけません。');

    await later('念のため、玄関や窓などに——');

    saveState('takeover');
    await takeoverSequence();

    busy=false;
  }

  async function takeoverSequence(){
    clearActions();
    clearTyping();

    await playConversation('takeover',[
      {run:async()=>{
        // 直前のセリフを読める時間を確保してから画面を切り替える。
        await wait(readingDelay());
        await takeoverEffect();
      }},
      {html:'よく分かったな。',role:'unknown'},
      {html:'これは、お前に向けた予告状だ。',role:'unknown'},
      {html:'最近、引っ越したらしいな。',role:'unknown'},
      {html:'新しい城は、なかなか立派じゃないか。',role:'unknown'},
      {html:'お前の大切なものを、一つ預かった。',role:'unknown'},
      {html:'返してほしければ、残りの謎も解いてみろ。',role:'unknown'},
      {html:'次はここだ。',role:'unknown'},
      {html:namedLink(phase2URL(),'NEXT PUZZLE'),role:'unknown',link:true},
      {html:'せいぜい、楽しませてくれ。',role:'unknown'},
      {run:async()=>{
        await wait(readingDelay());
        await restoreEffect();
      }},
      {html:'……すみません。'},
      {html:'今、一瞬こちらから操作できなくなっていました。'},
      {html:'通信に何者かが割り込んだようです。'},
      {html:'その間、何かありましたか？'}
    ]);

    saveState('afterTakeover');
    finishConversation();
    recommendations([
      ['怪しい人物と会話しました',reportPossibleIntrusion,true]
    ]);
  }

  async function reportPossibleIntrusion(){
    busy=true;
    clearActions();

    await later('怪しい人物、ですか……。');
    await later('すぐにこちらでも通信記録を確認します。');
    await later('少しだけお待ちください。');

    // デバッグ中は通常ディレイ0秒だが、
    // 「確認している間」だけ演出として少し間を残す。
    await fxWait(1800);

    await later('お待たせしました。');
    await later('確認できました。');
    await later('……また、新しい謎を渡されているんですね。');
    await later('相手の発言も確認しました。');

    await later('先ほどのリスの件と合わせると、やはり相手はあなたのご自宅について、かなり具体的に把握している可能性があります。');
    await later('さらに、何かを持ち出したことを示唆している以上、実際にご自宅へ入り、何かを持ち出した可能性も考えなくてはいけません。');

    await later('それと……もう一点。');
    await later('「GLITCH」という言葉と、今回の不正アクセス……。');
    await later('どうしても怪盗グリッチを連想してしまいます。');
    await later('ただ、怪盗グリッチはすでに身柄を確保しているはずなんです。');
    await later('……この点も、こちらで確認します。');

    await later('今の時点で、ご自宅から何か無くなっているものに心当たりはありますか？');

    saveState('askStolenItem');
    recommendations([
      ['今のところ分かりません',reportNoKnownMissing,true]
    ]);

    busy=false;
  }

  async function reportNoKnownMissing(){
    busy=true;
    clearActions();

    await later('分かりました。');
    await later('まず、今ご自宅の中で何か普段と違うことはありませんか？');
    await later('物音がするとか、玄関や窓が開いているとか……。');

    saveState('askHomeAbnormality');
    recommendations([
      ['今のところ特にありません',reportNoHomeAbnormality,true]
    ]);

    busy=false;
  }

  async function reportNoHomeAbnormality(){
    busy=true;
    clearActions();

    await later('分かりました。');
    await later('でしたら、念のため戸締まりだけ確認しておいてください。');
    await later('こちらでも、先ほどの不正アクセスと、ご自宅への侵入の可能性について確認を進めます。');

    await later('それと、もう一つお伝えしておきます。');
    await later('先ほどのページであなた方が発見した内容についても、現在こちらで事実確認を始めています。');
    await later('正直なところ、こちらでも想定していなかった内容がいくつか含まれていました。');
    await later('過去の事件記録や内部資料との食い違いがないか、本部内で確認しています。');

    await later('なので、こちらは本部で引き続き確認を進めます。');
    await later('そのうえで、先ほど相手から送られてきた新しいページなんですが……。');
    await later('今のところ、あの人物につながる直接的な手掛かりは、あのページしかありません。');
    await later('本来であれば、これ以上ご協力をお願いするような状況ではないんですが……。');
    await later('相手があなたにだけ続きを送っている以上、ここで接点を切ると手掛かりを失ってしまう可能性があります。');
    await later('もし今のところご自宅に異常がなく、危険を感じていないようであれば、無理のない範囲で内容を確認していただけませんか？');

    saveState('askContinuePhase2');
    recommendations([
      ['分かりました。確認してみます',confirmContinuePhase2,true]
    ]);

    busy=false;
  }

  async function confirmContinuePhase2(){
    busy=true;
    clearActions();

    await later('ありがとうございます。');
    await later('ただ、少しでもおかしいと思ったら、すぐに中断してください。');
    await later('謎を解くことより、ご自身の安全を優先してください。');
    await later('こちらでも並行して調べます。');

    saveState('askPhase2Acknowledgement');
    recommendations([
      ['はい',acknowledgePhase2,true]
    ]);
    busy=false;
  }

  async function acknowledgePhase2(){
    if(busy)return;

    busy=true;
    clearActions();
    saveState('phase2Starting');

    await playConversation('phase2-start',[
      {html:namedLink(phase2URL(),'NEXT PUZZLE'),link:true},
      {html:'ありがとうございます。よろしくお願いいたします。'}
    ]);

    saveState('phase2');
    finishConversation();
    busy=false;
  }


  async function reportPuzzleSolved(){
    busy=true;
    clearActions();

    await later('え、全部解けたんですか！？');
    await later('ちょっと待ってください、本当に全部ですか？');
    await later('すみません、少し確認させてください。');

    // DEBUGでもここだけ「確認している間」を見せる
    await fxWait(1800);

    await later('……本当だ。');
    await later('すごいですね。');
    await later('正直、こちらもまだ整理しきれていないところがあるのに……。');
    await later('ログと通信記録も確認しました。');
    await later('怪盗ヘンタイおじさんの仕業だったんですね。');
    await later('……毎回、人騒がせな怪盗ですね（笑）');
    await later('それで、結局何か盗まれたものはありましたか？');

    saveState('finalAskStolen');
    recommendations([
      ['特にありませんでした',finalNothingStolen,true]
    ]);

    busy=false;
  }

  async function finalNothingStolen(){
    busy=true;
    clearActions();

    await later('よかったです。');
    await later('それを聞いて安心しました。');
    await later('では、今回の一連の件については、ひとまずケースクローズとさせてください。');
    await later('本当に、最初から最後までご協力いただいてありがとうございました。');

    await later('……もっとも、こちらはまだ全然終わってないんですけどね（笑）');
    await later('誤認逮捕の可能性がある案件だったり、記録の食い違いだったり、不自然なアクセス履歴だったり……。');
    await later('あなた方が見つけてくださったものが多すぎて、今、本部は事実確認で大忙しです。');
    await later('まあ、何とかします（笑）');

    await later('あ、小日向さんから呼ばれてる……。');
    await later('すみません、僕もそろそろ行かないといけません。');
    await later('改めて、本当にありがとうございました。');

    saveState('closing');
    await closeSecureChat();

    busy=false;
  }

  async function closeSecureChat(){
    clearActions();
    clearTyping();

    await fxWait(1200);
    addSystem('相沢 直人が通信を終了しました');

    await fxWait(1200);

    const app=document.getElementById('app');
    const closed=document.getElementById('session-closed');

    if(app)app.classList.add('closing-session');
    if(closed)closed.hidden=false;

    const status=document.getElementById('close-status');
    const lines=[
      '通信経路を切断しています…',
      '暗号化セッションを終了しています…',
      '通信記録を保護しています…'
    ];

    for(const line of lines){
      if(status)status.textContent=line;
      await fxWait(700);
    }

    if(status)status.textContent='SESSION CLOSED';
    await fxWait(600);

    if(app)app.classList.remove('closing-session');
    document.body.classList.add('session-is-closed');

    const composer=document.querySelector('.composer');
    if(composer)composer.style.display='none';

    const finalText=document.getElementById('closed-final-text');
    if(finalText){
      finalText.textContent='怪盗関連事件特別捜査本部との通信は終了しました。';
    }

    saveState('complete');
  }

  async function generic(){
    if(state==='mission'){
      return later(
        'ありがとうございます。まずは先ほどお送りしたページや資料を確認してみてください。何か気になることがあれば教えてください。',
        760
      );
    }

    if(state==='askSquirrelQR'){
      return later('……？すみません。言っている意味が分からず。あ、そんなことより、どこのリスの置物なんでしょうね。');
    }

    if(state==='askSquirrelWhere'){
      return later('今はふざけてる場合じゃないです。そのリスの置物がどこにあったものなのか、教えてください。');
    }

    if(state==='askSquirrelExisting'){
      return later('もう一度聞きます。そのリスの置物は、今回の件より前からご自宅にあったものですか？');
    }

    if(state==='afterTakeover'){
      return later('大丈夫ですか。混乱してるんでしょうね。落ち着いてからでいいです。先ほど何かありましたか？');
    }

    if(state==='askStolenItem'){
      return later('落ち着いてください。今の時点で、ご自宅から何か無くなっているものに心当たりはありますか？');
    }

    if(state==='askHomeAbnormality'){
      return later('大丈夫です。落ち着いて回答してください。今ご自宅の中で、何か普段と違うことはありませんか？');
    }

    if(state==='askContinuePhase2'){
      return later('大丈夫ですか。まだ混乱してるのですかね。改めて聞かせてください。危険を感じていないようであれば、無理のない範囲で新しいページを確認していただけますか？');
    }

    if(state==='phase2' || state==='askPhase2Acknowledgement'){
      return later('こちらでも並行して確認を進めています。何か異常を感じた場合は、すぐに中断してください。');
    }

    if(state==='finalAskStolen'){
      return later('えーと、なんのことでしょうか？そんなことより、結局、何か盗まれたものはありましたか？');
    }

    if(state==='closing' || state==='complete'){
      return;
    }

    return later('ありがとうございます。確認します。',700);
  }

  F.addEventListener('submit',async e=>{
    e.preventDefault();

    if(busy)return;

    const v=I.value.trim();
    if(!v)return;

    addUser(v);
    I.value='';

    // AIレコメンドは、正しい意図が入力されて次フェーズへ進むまで残す。
    // 関係ない自由入力では消さない。
    if(state==='verifyDate'){
      busy=true;

      if(isCorrectDate(v)){
        busy=false;
        return dateVerified();
      }

      if(isBirthday(v)){
        await later(
          '惜しいです。10月3日ではなく、その前日に起きた事件です。怪盗による被害が確認された日を思い出してみてください。',
          820
        );

        busy=false;
        return;
      }

      await later(
        'すみません。こちらの記録とは一致しないようです。もう一度思い出してみてもらえますか？',
        820
      );

      busy=false;
      return;
    }

    if(state==='verifyPlace'){
      busy=true;

      if(isCorrectPlace(v)){
        busy=false;
        return verified();
      }

      await later(
        'すみません。こちらの記録とは一致しないようです。当時の旅行先を思い出してみてもらえますか？',
        820
      );

      busy=false;
      return;
    }

    if(state==='offer'){
      // 「協力しない」に「協力」が含まれるため、拒否を先に判定する。
      if(isDeclineText(v)){
        return decline();
      }

      if(isCooperateText(v)){
        return cooperate();
      }

      await later(
        '……？すみません。言っている意味が分からず。改めて確認させてください。今回の捜査に協力していただけますか？',
        700
      );

      recommendations([
        ['捜査に協力する',cooperate,true],
        ['捜査に協力しない',decline,false]
      ]);

      return;
    }

    if(state==='mission' && isGlitchText(v)){
      return receiveGlitch();
    }

    if(state==='askSquirrelQR' && isSquirrelQrFoundText(v)){
      return reportSquirrelQR();
    }

    if(state==='askSquirrelWhere' && isSquirrelHomeText(v)){
      return reportSquirrelHome();
    }

    if(state==='askSquirrelExisting' && isSquirrelExistingText(v)){
      return confirmSquirrelExisting();
    }

    if(state==='afterTakeover' && isTakeoverReportText(v)){
      return reportPossibleIntrusion();
    }

    if(state==='askStolenItem' && isUnknownMissingText(v)){
      return reportNoKnownMissing();
    }

    if(state==='askHomeAbnormality' && isNoHomeAbnormalityText(v)){
      return reportNoHomeAbnormality();
    }

    if(state==='askContinuePhase2' && isContinuePhase2Text(v)){
      return confirmContinuePhase2();
    }

    if(state==='askPhase2Acknowledgement' && isContinuePhase2Text(v)){
      return acknowledgePhase2();
    }

    if((state==='phase2' || state==='askPhase2Acknowledgement') && isPuzzleSolvedText(v)){
      return reportPuzzleSolved();
    }

    if(state==='finalAskStolen' && isNothingStolenText(v)){
      return finalNothingStolen();
    }

    if(state==='closing' || state==='complete'){
      return;
    }

    return generic();
  });

  async function restoreLog(paced=false){
    M.innerHTML='';
    lastReadableChars=0;
    lastRole=null;

    for(const item of log){
      if(paced && ['aizawa','ojisan','unknown'].includes(item.role)){
        showTyping(item.role);
        await wait(readingDelay());
        clearTyping();
      }
      renderItem(item,false);
      trackReading(item.html,item.role);
    }

    scrollBottom();
  }

  async function resumeConversation(){
    if(state==='start'){
      await introConversation();
      return;
    }

    if(state==='offerPending'){
      await verified();
      return;
    }

    if(state==='takeover'){
      busy=true;
      await takeoverSequence();
      busy=false;
      return;
    }

    if(state==='phase2Starting'){
      await acknowledgePhase2();
      return;
    }

    finishConversation();
    restoreActions();
  }

  function restoreActions(){
    // 更新前の版でこの発言まで読んだ場合にも返信候補を表示する。
    const lastItem=log[log.length-1];
    if(state==='phase2' && lastItem && lastItem.role==='aizawa' &&
      lastItem.html==='こちらでも並行して調べます。'){
      saveState('askPhase2Acknowledgement');
    }

    if(state==='askPhase2Acknowledgement'){
      recommendations([
        ['はい',acknowledgePhase2,true]
      ]);
      return;
    }

    if(state==='offer'){
      recommendations([
        ['捜査に協力する',cooperate,true],
        ['捜査に協力しない',decline,false]
      ]);
      return;
    }

    if(state==='askSquirrelQR'){
      recommendations([
        ['リスの置物の下から、QRコードを見つけました',reportSquirrelQR,true]
      ]);
      return;
    }

    if(state==='askSquirrelWhere'){
      recommendations([
        ['私の家です',reportSquirrelHome,true]
      ]);
      return;
    }

    if(state==='askSquirrelExisting'){
      recommendations([
        ['はい',confirmSquirrelExisting,true]
      ]);
      return;
    }

    if(state==='afterTakeover'){
      recommendations([
        ['怪しい人物と会話しました',reportPossibleIntrusion,true]
      ]);
      return;
    }

    if(state==='askStolenItem'){
      recommendations([
        ['今のところ分かりません',reportNoKnownMissing,true]
      ]);
      return;
    }

    if(state==='askHomeAbnormality'){
      recommendations([
        ['今のところ特にありません',reportNoHomeAbnormality,true]
      ]);
      return;
    }

    if(state==='askContinuePhase2'){
      recommendations([
        ['分かりました。確認してみます',confirmContinuePhase2,true]
      ]);
      return;
    }

    if(state==='finalAskStolen'){
      recommendations([
        ['特にありませんでした',finalNothingStolen,true]
      ]);
      return;
    }

    if(state==='closing' || state==='complete'){
      showClosedSession();
      return;
    }
  }


  function showClosedSession(){
    clearActions();
    clearTyping();

    const composer=document.querySelector('.composer');
    if(composer)composer.style.display='none';

    document.body.classList.add('session-is-closed');

    const closed=document.getElementById('session-closed');
    if(closed){
      closed.hidden=false;
      closed.classList.add('restored');
    }

    const status=document.getElementById('close-status');
    if(status)status.textContent='SESSION CLOSED';

    const finalText=document.getElementById('closed-final-text');
    if(finalText){
      finalText.textContent='怪盗関連事件特別捜査本部との通信は終了しました。';
    }
  }

  function resetAll(){
    [STATE_KEY,DECLINE_KEY,LOG_KEY,SEQUENCE_KEY,INTRO_KEY].forEach(k=>{
      localStorage.removeItem(k);
    });

    localStorage.removeItem('phantomPolicePuzzleComplete');
    localStorage.removeItem('phantomPolicePuzzle');

    state='start';
    declineCount=0;
    log=[];

    M.innerHTML='';
    clearTyping();
    clearActions();

    try{
      history.replaceState({},'',location.pathname);
    }catch(e){}
  }

  async function runConnectionIntro(){
    INTRO.hidden=false;
    APP.hidden=true;

    CONNECT.disabled=true;
    STATUS.classList.add('connecting');

    const steps=[
      ['認証情報を確認しています…',24,650],
      ['通信経路を暗号化しています…',52,800],
      ['怪盗関連事件特別捜査本部へ接続しています…',78,900],
      ['担当捜査員との接続を確立しています…',94,800],
      ['接続完了',100,550]
    ];

    for(const [label,pct,ms] of steps){
      STATUS_TEXT.textContent=label;
      PROGRESS.style.width=pct+'%';
      await wait(ms);
    }

    STATUS.classList.remove('connecting');
    STATUS.classList.add('done');
    localStorage.setItem(INTRO_KEY,'1');

    await wait(500);

    INTRO.animate(
      [{opacity:1},{opacity:0}],
      {duration:350,easing:'ease',fill:'forwards'}
    );

    await wait(330);

    INTRO.hidden=true;
    APP.hidden=false;

    // 接続画面から本人確認の冒頭へ戻る場合も、保存済み会話を一括表示しない。
    busy=true;
    await restoreLog(state==='verifyDate');
    busy=false;
    await resumeConversation();
  }

  async function showApp(){
    INTRO.hidden=true;
    APP.hidden=false;

    busy=true;
    await restoreLog(state==='verifyDate');
    busy=false;
    await resumeConversation();
  }

  if(qs.get('reset')==='1'){
    resetAll();
    INTRO.hidden=false;
    APP.hidden=true;
    CONNECT.addEventListener('click',runConnectionIntro,{once:true});
    return;
  }


  const forceIntro=qs.get('intro')==='1';
  const introSeen=localStorage.getItem(INTRO_KEY)==='1';

  if(!introSeen || forceIntro){
    INTRO.hidden=false;
    APP.hidden=true;
    CONNECT.addEventListener('click',runConnectionIntro,{once:true});
  }else{
    showApp();
  }
})();
