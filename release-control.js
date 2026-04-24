function _RL(ja,en){return(window.TAMSICLang&&window.TAMSICLang.get()==='en')?en:ja;}
window.TAMSICRelease=(function(){
// ─────────────────────────────────────────
// Admin unlock: これらのメールでログインしたユーザーは、
// 全ての曲を「full (公開済)」状態で見られる。
// 注: 未公開曲の MP3 は本番 repo にまだ配置されていないため、
// ロック解除されても再生は 404 になる（UI のみの解放）。
// ─────────────────────────────────────────
const ADMIN_EMAILS=["animalb001@gmail.com"]; // ← 自分の TAMSIC ログインメールに書き換え

function _isAdmin(){
  try{
    if(typeof getUserInfo==="function"){
      const u=getUserInfo();
      if(u&&u.email&&ADMIN_EMAILS.map(e=>e.toLowerCase()).includes(u.email.toLowerCase())) return true;
    }
  }catch(e){}
  return false;
}

const config={tracks:{
"ぎりぎりだよ。":{sample:"2026-04-01",release:"2026-04-15"},
"RE+":{sample:"2026-05-01",release:"2026-05-15"},
"to Walk":{sample:"2026-06-01",release:"2026-06-15"},
"シグナル●":{sample:"2026-07-01",release:"2026-07-15"},
"Breathless":{sample:"2026-08-01",release:"2026-08-15"},
"unセカイ":{sample:"2026-05-01",release:"2026-05-15"},
"Burn bright":{sample:"2026-05-10",release:"2026-05-20"},
"Critical point":{sample:"2026-06-20",release:"2026-06-28"},
"No Stop":{sample:"2026-07-11",release:"2026-07-11"},
"エンジン":{sample:"2026-08-15",release:"2026-08-23"},
"KIKI rising":{sample:"2026-09-12",release:"2026-09-20"}
}};

function parseDate(str){const [y,m,d]=String(str).split("-").map(Number);return new Date(y,(m||1)-1,d||1,0,0,0,0);}

// auth.js(Cognito版)のisLoggedIn()を優先、なければlocalStorage(旧)にフォールバック
function _checkMemberLogin(){
  try{
    // auth.js(Cognito)のグローバルisLoggedIn()を直接呼ぶ
    try{ if(typeof isLoggedIn!=="undefined" && isLoggedIn !== _checkMemberLogin) return !!isLoggedIn(); }catch(e){}
    if(window.TAMSICAuth&&typeof window.TAMSICAuth.isLoggedIn==="function") return !!window.TAMSICAuth.isLoggedIn();
    return !!localStorage.getItem("tamsic_current_user");
  }catch(e){return false;}
}

function formatJP(str){const [y,m,d]=String(str).split("-");return `${y}.${m}.${d}`;}

function getState(title){
  const t=config.tracks[title]; if(!t)return"full";
  // Admin override: 指定メールのログインユーザーは全曲 full 扱い
  if(_isAdmin()) return"full";
  const now=new Date(), sample=parseDate(t.sample), release=parseDate(t.release);
  // sample日より前 → 全員ロック
  if(now<sample) return"locked";
  // release日以降 → 全員公開
  if(now>=release) return"full";
  // sample日〜release前: 会員ならsample可、非会員はpreview(ロック)
  if(_checkMemberLogin()) return"member";
  return"preview";
}

function getMeta(title){
  const t=config.tracks[title]; if(!t)return{label:"NOW AVAILABLE",note:"",showMask:false,canSample:true,canFull:true,icon:false};
  const st=getState(title);
  if(st==="locked") return {state:st,label:_RL("COMING SOON","COMING SOON"),note:`${formatJP(t.sample)} ${_RL("sample公開","sample")} / ${formatJP(t.release)} ${_RL("一般公開","release")}`,showMask:true,canSample:false,canFull:false,icon:true};
  if(st==="preview") return {state:st,label:_RL("会員先行アクセス","MEMBER EARLY ACCESS"),note:_RL(`会員は一般公開前から先行視聴できます。 / ${formatJP(t.release)} 公開`,`Members can listen early. / ${formatJP(t.release)} public release`),showMask:true,canSample:false,canFull:false,icon:true};
  if(st==="member") return {state:st,label:_RL("会員先行アクセス","MEMBER EARLY ACCESS"),note:_RL(`会員先行視聴中。 / ${formatJP(t.release)} 公開`,`Early access active. / ${formatJP(t.release)} public release`),showMask:false,canSample:true,canFull:true,icon:false};
  return {state:st,label:_RL("公開中","NOW AVAILABLE"),note:_RL("公開中","Now available"),showMask:false,canSample:true,canFull:true,icon:false};
}

return{config,getState,getMeta};
})();
