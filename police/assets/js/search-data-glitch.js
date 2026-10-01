// The HTML work note has been retired in favor of the OP-314 text attachment.
// Remove its entry even when an older shared search index is still cached.
window.SEARCH_DATA = window.SEARCH_DATA.filter(function(record) {
  return record.path !== "records/gr-work-note/";
});

window.SEARCH_DATA.push({
  title:"DT-421 押収端末・記録媒体 詳細票",
  path:"records/dt-421/",
  kind:"押収品記録",
  visibility:"hidden",
  triggers:["DT-421"],
  aliases:[],
  summary:"CASE-250421CGで押収された端末3台と外部記録媒体2点の構成・外観をまとめた詳細票。",
  compoundPairs:[],
  searchText:"DT-421 CASE-250421CG 押収端末 記録媒体 詳細票 DA-024"
});
