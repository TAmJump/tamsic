window.TAMSICRelease = (function(){
  const tracks = {
    "ぎりぎりだよ。": { sampleDate: "2026-04-01", releaseDate: "2026-04-15" },
    "RE+": { sampleDate: "2026-05-01", releaseDate: "2026-05-15" },
    "to Walk": { sampleDate: "2026-06-01", releaseDate: "2026-06-15" },
    "シグナル●": { sampleDate: "2026-07-01", releaseDate: "2026-07-15" },
    "Breathless": { sampleDate: "2026-08-01", releaseDate: "2026-08-15" },
    "Critical point": { sampleDate: "2026-09-01", releaseDate: "2026-09-15" },
    "Burn bright": { sampleDate: "2026-10-01", releaseDate: "2026-10-15" },
    "No Stop": { sampleDate: "2026-11-01", releaseDate: "2026-11-15" },
    "エンジン": { sampleDate: "2026-12-01", releaseDate: "2026-12-15" },
    "KIKI rising": { sampleDate: "2027-01-01", releaseDate: "2027-01-15" }
  };
  const earlyDays = 7;
  function parseDate(str){
    const [y,m,d]=String(str).split('-').map(Number);
    return new Date(y, (m||1)-1, d||1, 0,0,0,0);
  }
  function formatDate(str){ return String(str||'').replace(/-/g,'.'); }
  function isLoggedIn(){
    try{
      return !!(window.TAMSICAuth && typeof TAMSICAuth.isLoggedIn==='function' && TAMSICAuth.isLoggedIn());
    }catch(e){ return false; }
  }
  function getMeta(title){
    const cfg = tracks[title];
    if(!cfg){
      return {status:'full', label:'NOW AVAILABLE', note:'Now available', sampleDate:'', releaseDate:'', earlyDate:''};
    }
    const now = new Date();
    const sampleDate = parseDate(cfg.sampleDate);
    const releaseDate = parseDate(cfg.releaseDate);
    const earlyDate = new Date(releaseDate);
    earlyDate.setDate(earlyDate.getDate() - earlyDays);
    let status='locked', label='COMING SOON', note=`sample ${formatDate(cfg.sampleDate)} / release ${formatDate(cfg.releaseDate)}`;
    if(now >= releaseDate){
      status='full'; label='NOW AVAILABLE'; note=`public release ${formatDate(cfg.releaseDate)}`;
    }else if(now >= earlyDate){
      if(isLoggedIn()){
        status='member'; label='MEMBER EARLY ACCESS'; note=`member early access / public ${formatDate(cfg.releaseDate)}`;
      }else if(now >= sampleDate){
        status='preview'; label='PREVIEW ONLY'; note=`sample ${formatDate(cfg.sampleDate)} / public ${formatDate(cfg.releaseDate)}`;
      }else{
        status='locked'; label='COMING SOON'; note=`members from ${formatDate(cfg.releaseDate)} - 7 days`;
      }
    }else if(now >= sampleDate){
      status='preview'; label='PREVIEW ONLY'; note=`sample ${formatDate(cfg.sampleDate)} / release ${formatDate(cfg.releaseDate)}`;
    }
    return {status,label,note,sampleDate:cfg.sampleDate,releaseDate:cfg.releaseDate,earlyDate:formatDate(cfg.releaseDate)+' - 7 days'};
  }
  function canPlaySample(title){
    const s = getMeta(title).status;
    return s === 'preview' || s === 'member' || s === 'full';
  }
  function canPlayFull(title){
    const s = getMeta(title).status;
    return s === 'member' || s === 'full';
  }
  function lockSvg(stroke='#111'){
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M20 28v-9c0-6.6 5.4-12 12-12s12 5.4 12 12v9" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/><rect x="16" y="28" width="32" height="28" fill="none" stroke="${stroke}" stroke-width="4"/><path d="M32 39v8" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="37" r="2" fill="${stroke}"/></svg>`;
  }
  return {tracks, earlyDays, isLoggedIn, getMeta, canPlaySample, canPlayFull, formatDate, lockSvg};
})();