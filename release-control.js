function _RL(ja,en){return(window.TAMSICLang&&window.TAMSICLang.get()==='en')?en:ja;}
window.TAMSICRelease=(function(){
// ─────────────────────────────────────────
// v4.2.2.12: 会員先行視聴を廃止、YouTube 公開日 = サイト表示日に統一。
//   - release 日より前 → COMING SOON (全員ロック、coin 消費不可)
//   - release 日以降 → 全員フル試聴可 (30 coin)
// 旧 sample / member / preview state は撤去。
//
// Admin override: 指定メールでログインしたユーザーは常時 full 扱い (動作確認用)。
// ─────────────────────────────────────────
const ADMIN_EMAILS=["animalb001@gmail.com","tiger@tamjump.com"];

function _isAdmin(){
  try{
    if(typeof getUserInfo==="function"){
      const u=getUserInfo();
      if(u&&u.email&&ADMIN_EMAILS.map(e=>e.toLowerCase()).includes(u.email.toLowerCase())) return true;
    }
  }catch(e){}
  return false;
}

// release 日 (YouTube サンプル公開日と同期) を曲タイトルで指定。
// この日付以降 = 公開、未満 = COMING SOON。
// 仕様: YouTube サンプル公開と同時に、サイト内でもフル試聴 (30 coin) を解放。
const config={tracks:{
"ぎりぎりだよ。":{release:"2026-04-24"},
"RE+":{release:"2026-05-01"},
"to Walk":{release:"2026-06-01"},
"シグナル●":{release:"2026-07-01"},
"Breathless":{release:"2026-08-01"},
"unセカイ":{release:"2026-05-01"},
"Burn bright":{release:"2026-05-10"},
"Critical point":{release:"2026-06-20"},
"No Stop":{release:"2026-07-11"},
"エンジン":{release:"2026-08-15"},
"KIKI rising":{release:"2026-09-12"},
"Dear Future You":{release:"2026-05-23"},
"Echo from the Future":{release:"2026-05-30"}
}};

function parseDate(str){const [y,m,d]=String(str).split("-").map(Number);return new Date(y,(m||1)-1,d||1,0,0,0,0);}

function formatJP(str){const [y,m,d]=String(str).split("-");return `${y}.${m}.${d}`;}

function getState(title){
  const t=config.tracks[title]; if(!t)return"full";
  if(_isAdmin()) return"full";
  const now=new Date(), release=parseDate(t.release);
  if(now<release) return"locked";
  return"full";
}

function getMeta(title){
  const t=config.tracks[title]; if(!t)return{label:"NOW AVAILABLE",note:"",showMask:false,canSample:true,canFull:true,icon:false};
  const st=getState(title);
  if(st==="locked") return {state:st,label:_RL("COMING SOON","COMING SOON"),note:`${formatJP(t.release)} ${_RL("公開予定","release")}`,showMask:true,canSample:false,canFull:false,icon:true};
  return {state:st,label:_RL("公開中","NOW AVAILABLE"),note:_RL("公開中","Now available"),showMask:false,canSample:true,canFull:true,icon:false};
}

return{config,getState,getMeta};
})();
