
(function(){const form=document.getElementById('search-form'),inp=document.getElementById('search-input'),out=document.getElementById('search-results'),status=document.getElementById('search-status');
const norm=s=>(s||'').toLowerCase().replace(/[\s　]/g,'').replace(/[‐‑‒–—―ー]/g,'-');
function base(){const u=new URL(location.href),i=u.pathname.indexOf('/police/');return u.pathname.slice(0,i+8)}
function url(path){return base()+path}
function publicMatch(d,terms){const hay=norm(d.searchText);return terms.every(t=>hay.includes(norm(t)))}
function exactTrigger(d,q){if(d.strictTrigger)return (d.triggers||[]).some(t=>String(t).trim()===String(q).trim());const nq=norm(q);return (d.triggers||[]).some(t=>norm(t)===nq)}
function compoundHit(d,a,b){const x=norm(a),y=norm(b);return (d.compoundPairs||[]).some(p=>{const p1=norm(p[0]),p2=norm(p[1]);return (x===p1&&y===p2)||(x===p2&&y===p1)})}
function render(){const q=inp.value.trim();const sp=new URLSearchParams(location.search);if(q)sp.set('q',q);else sp.delete('q');history.replaceState(null,'',location.pathname+(sp.toString()?'?'+sp:''));out.innerHTML='';if(!q){status.textContent='検索ワードを入力してください。';return}
const parts=q.split(/[、,]/).map(x=>x.trim()).filter(Boolean);if(parts.length>2){status.textContent='3語以上の複合検索はできません。';return}if((q.includes('、')||q.includes(','))&&parts.length!==2){status.textContent='複合検索は2つの検索ワードを「、」または「,」で区切ってください。';return}
let hits=[];if(parts.length===2){for(const d of SEARCH_DATA){if(d.visibility==='public'&&publicMatch(d,parts))hits.push({...d,hidden:false});else if(d.visibility==='compound'&&compoundHit(d,parts[0],parts[1]))hits.push({...d,hidden:true})}}else{for(const d of SEARCH_DATA){if(d.visibility==='public'&&publicMatch(d,[q]))hits.push({...d,hidden:false});else if((d.visibility==='hidden'||d.visibility==='compound')&&exactTrigger(d,q))hits.push({...d,hidden:true})}}
hits.sort((a,b)=>(a.hidden===b.hidden?0:a.hidden?1:-1));status.textContent=hits.length?hits.length+'件の情報が見つかりました。':'検索条件に一致する情報は見つかりませんでした。';for(const h of hits){const a=document.createElement('a');a.className='result';a.href=url(h.path);a.innerHTML='<span class="kind">'+h.kind+'</span><h3>'+h.title+'</h3>';out.appendChild(a)}}
form.onsubmit=e=>{e.preventDefault();render()};const q=new URLSearchParams(location.search).get('q');if(q){inp.value=q;render()}else status.textContent='検索ワードを入力してください。';})();
