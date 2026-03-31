window.TAMSICRelease=(function(){
const config={earlyDays:7,tracks:{
"ぎりぎりだよ。":{sample:"2026-04-01",release:"2026-04-15"},
"RE+":{sample:"2026-05-01",release:"2026-05-15"},
"to Walk":{sample:"2026-06-01",release:"2026-06-15"},
"シグナル●":{sample:"2026-07-01",release:"2026-07-15"},
"BREATHLESS":{sample:"2026-08-01",release:"2026-08-15"},
"Critical point":{sample:"2026-09-01",release:"2026-09-15"},
"Burn bright":{sample:"2026-10-01",release:"2026-10-15"},
"No Stop":{sample:"2026-11-01",release:"2026-11-15"},
"エンジン":{sample:"2026-12-01",release:"2026-12-15"},
"KIKI rising":{sample:"2027-01-01",release:"2027-01-15"}
}};
function parseDate(str){const [y,m,d]=String(str).split("-").map(Number);return new Date(y,(m||1)-1,d||1,0,0,0,0);}
function isLoggedIn(){try{if(window.TAMSICAuth&&typeof window.TAMSICAuth.isLoggedIn==="function")return !!window.TAMSICAuth.isLoggedIn();return !!localStorage.getItem("tamsic_current_user");}catch(e){return false;}}
function formatJP(str){const [y,m,d]=String(str).split("-");return `${y}.${m}.${d}`;}
function getState(title){
 const t=config.tracks[title]; if(!t)return"full";
 const now=new Date(), sample=parseDate(t.sample), release=parseDate(t.release), early=new Date(release); early.setDate(early.getDate()-config.earlyDays);
 if(now<sample)return"locked";
 if(now>=release)return"full";
 if(isLoggedIn()&&now>=sample)return"member";
 return"preview";
}
function getMeta(title){
 const t=config.tracks[title]; if(!t)return{label:"NOW AVAILABLE",note:"",showMask:false,canSample:true,canFull:true,icon:false};
 const st=getState(title);
 if(st==="locked") return {state:st,label:"COMING SOON",note:`${formatJP(t.sample)} sample / ${formatJP(t.release)} release`,showMask:true,canSample:false,canFull:false,icon:true};
 if(st==="preview") return {state:st,label:"MEMBER EARLY ACCESS",note:`会員は一般公開の7日前から先行視聴できます。 / ${formatJP(t.release)} public release`,showMask:true,canSample:false,canFull:false,icon:true};
 if(st==="member") return {state:st,label:"MEMBER EARLY ACCESS",note:`会員は一般公開の7日前から先行視聴できます。 / ${formatJP(t.release)} public release`,showMask:false,canSample:true,canFull:true,icon:false};
 return {state:st,label:"NOW AVAILABLE",note:"公開中",showMask:false,canSample:true,canFull:true,icon:false};
}
return{config,getState,getMeta};
})();