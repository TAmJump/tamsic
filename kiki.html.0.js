let _tracks=[];


function injectCommerceStyles(){
  if(document.getElementById('tamsic-commerce-style')) return;
  const s=document.createElement('style');
  s.id='tamsic-commerce-style';
  s.textContent=`
  .coin-panel{margin:0 0 28px;padding:22px 24px;border:1px solid rgba(196,150,14,.22);background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(247,245,237,.96));border-radius:22px;box-shadow:0 16px 36px rgba(0,0,0,.04);}
  .coin-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
  .coin-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a07800;margin-bottom:8px;}
  .coin-title{font-size:26px;font-weight:600;line-height:1.15;color:#111;}
  .coin-copy{margin-top:8px;font-size:13px;line-height:1.8;color:#6d6d66;max-width:660px;}
  .coin-balance{min-width:210px;padding:16px 18px;border-radius:18px;background:#111;color:#fff;}
  .coin-balance-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.62);margin-bottom:8px;}
  .coin-balance-value{font-size:32px;font-weight:700;line-height:1;}
  .coin-balance-sub{margin-top:8px;font-size:12px;color:rgba(255,255,255,.72);}
  .coin-pack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
  .coin-pack{padding:16px;border-radius:18px;border:1px solid rgba(17,17,17,.08);background:#fff;display:flex;flex-direction:column;gap:8px;}
  .coin-pack.recommended{border-color:#c4960e;box-shadow:0 14px 28px rgba(196,150,14,.12);}
  .coin-pack-top{display:flex;justify-content:space-between;align-items:center;gap:10px;}
  .coin-pack-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9a7400;}
  .coin-pack-badge{padding:4px 8px;border-radius:999px;background:rgba(196,150,14,.12);font-size:10px;color:#8a6500;}
  .coin-pack-coins{font-size:28px;font-weight:700;color:#111;}
  .coin-pack-price{font-size:15px;color:#444;}
  .coin-pack-note{font-size:12px;color:#7a7a72;line-height:1.6;min-height:38px;}
  .coin-pack-btn{margin-top:auto;border:none;border-radius:999px;background:#111;color:#fff;padding:12px 16px;font-size:13px;cursor:pointer;transition:transform .18s ease,opacity .18s ease;}
  .coin-pack-btn:hover{transform:translateY(-1px);opacity:.92;}
  .coin-pack-btn.is-rec{background:#c4960e;color:#111;}
  .full-desc strong{color:#111;}
  .full-price{display:flex;align-items:baseline;gap:8px;}
  .full-price .coin-num{font-size:28px;font-weight:700;color:#a07800;}
  .full-price .coin-unit{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#7a7a72;}
  .full-wallet-line{margin:10px 0 0;font-size:12px;color:#7a7a72;}
  .full-wallet-line strong{color:#111;}
  .full-buy.disabled{opacity:.55;cursor:not-allowed;}
  .full-player-mount{margin-top:14px;}
  .full-ended-msg{padding:14px 16px;border-radius:14px;background:rgba(17,17,17,.05);font-size:12px;color:#666;}
  .full-lyrics{margin-top:14px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.8);border:1px solid rgba(17,17,17,.08);font-size:13px;line-height:1.9;color:#333;}
  @media (max-width: 900px){.coin-pack-grid{grid-template-columns:1fr;}.coin-balance{width:100%;}.coin-title{font-size:22px;}}
  `;
  document.head.appendChild(s);
}

function renderCoinPanel(){
  const state=TAMSICCoins.getState();
  const packs=TAMSICCoins.getPacks();
  return `<div class="coin-panel">
    <div class="coin-panel-head">
      <div>
        <div class="coin-kicker">TAMSIC Coin</div>
        <div class="coin-title">1回試聴のためのコイン残高</div>
        <div class="coin-copy">初回特典で <strong>${TAMSICCoins.getBonus()}コイン</strong> を付与。sample は無料、フル試聴だけコインを消費します。現在は Square 接続前のため、このZIP版ではローカル加算で動作確認できます。</div>
      </div>
      <div class="coin-balance">
        <div class="coin-balance-label">Balance</div>
        <div class="coin-balance-value"><span data-coin-balance>${state.balance}</span> coin</div>
        <div class="coin-balance-sub">初回特典込み / ダウンロード不可 / 1回試聴</div>
      </div>
    </div>
    <div class="coin-pack-grid">${packs.map((pack,idx)=>`<div class="coin-pack ${idx===1?'recommended':''}">
      <div class="coin-pack-top">
        <div class="coin-pack-label">${pack.label||''}</div>
        ${idx===1?'<span class="coin-pack-badge">おすすめ</span>':''}
      </div>
      <div class="coin-pack-coins">${pack.coins} coin</div>
      <div class="coin-pack-price">¥${pack.priceYen}</div>
      <div class="coin-pack-note">まとめて買うほど、1コインあたりの単価が下がる設計です。</div>
      <button class="coin-pack-btn ${idx===1?'is-rec':''}" onclick="chargeCoins('${pack.id}')">この内容で追加する</button>
    </div>`).join('')}</div>
  </div>`;
}

function refreshCoinUI(){
  const balance=TAMSICCoins.getBalance();
  document.querySelectorAll('[data-coin-balance]').forEach(el=>el.textContent=balance);
  document.querySelectorAll('[data-track-cost]').forEach(el=>{
    const cost=Number(el.getAttribute('data-track-cost')||0);
    const btn=el.closest('.full-panel')?.querySelector('.full-buy');
    if(btn){
      const ok=balance>=cost;
      btn.classList.toggle('disabled',!ok);
      btn.textContent = ok ? `${cost}コインで1回フル試聴` : `残高不足（あと${cost-balance}コイン）`;
    }
  });
  document.querySelectorAll('[data-track-balance]').forEach(el=>el.textContent=balance);
}

function chargeCoins(packId){
  const pack=TAMSICCoins.getPacks().find(x=>x.id===packId);
  if(!pack) return;
  const ok=confirm(`${pack.coins}コイン（¥${pack.priceYen}）を追加します。\n\nこのZIP版では Square 接続前のため、ローカル残高に即時反映します。`);
  if(!ok) return;
  const result=TAMSICCoins.addCoins(packId);
  if(result.ok){
    refreshCoinUI();
    alert(`${pack.coins}コインを追加しました。\n現在の残高：${result.balance}コイン`);
  }
}

function unlockFullTrack(trackId){
  const track=_tracks.find(x=>x.id===trackId);
  if(!track) return;
  const cost=Number(track.price||0);
  const spend=TAMSICCoins.spendCoins(track.id,cost);
  if(!spend.ok){
    alert(`コインが不足しています。\n「${track.title}」には ${cost}コイン必要です。\nあと ${spend.shortage}コイン追加してください。`);
    const panel=document.querySelector('.coin-panel');
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  refreshCoinUI();
  const mount=document.getElementById(`full-player-${track.id}`);
  const lyrics=document.getElementById(`lyrics-${track.id}`);
  if(lyrics) lyrics.style.display='block';
  const url=getTrackAudioSrc(track);
  if(!url){
    alert('音声ファイルが設定されていません。');
    return;
  }
  TAMSICPlayer.playFull(track.id,url,mount);
}


async function init(){
  injectCommerceStyles();
  _tracks=await TAMSICDB.getTracks('kiki');
  const n=_tracks.length||'—';
  document.getElementById('track-count').textContent=n;
  
  if(_tracks.length&&getTrackCoverSrc(_tracks[0])){
    const f=document.getElementById('hero-photo');
    f.innerHTML=`<img src="${getTrackCoverSrc(_tracks[0])}" alt="kiki" style="width:100%;height:100%;object-fit:cover;">`;
  }
  renderTracks();
  refreshCoinUI();
  TAMSICCoins.onChange(()=>refreshCoinUI());
}

function renderTracks(){
  const c=document.getElementById('tracks-container');
  if(!_tracks.length){c.innerHTML='<div class="empty-msg">Coming Soon — 楽曲を準備中です。</div>';return;}
  c.innerHTML=renderCoinPanel()+_tracks.map((t,i)=>{
    const num=String(i+1).padStart(2,'0');
    const coverSrc=getTrackCoverSrc(t); const coverHtml=coverSrc?`<img src="${coverSrc}" alt="${t.title||''}">`:'<span class="cover-ph-txt">Cover</span>';
    const dur=formatTime(parseTime(t.sampleEnd)-parseTime(t.sampleStart));
    return`<div class="track-block" id="track-${t.id}">
      <div class="tb-cover">
        <div class="cover-wrap">${coverHtml}</div>
        <span class="tb-num">${num}</span>
      </div>
      <div class="tb-body">
        <div class="tb-meta">${t.isNew?'<span class="badge-new">New</span>':''}<span class="tb-type">Single</span></div>
        <div class="tb-title">${t.title||'TRACK TITLE'}</div>
        <div class="tb-sub">kiki</div>
        <div class="player-modes">
          <button class="mode-btn active" onclick="setMode('${t.id}','site',this)">▶ サイトで聴く</button>
          <button class="mode-btn" onclick="setMode('${t.id}','yt',this)">YouTube</button>
          <button class="mode-btn premium" onclick="setMode('${t.id}','full',this)">フル試聴 ${t.price===0?"FREE":(t.price||30)+"コイン"}</button>
        </div>
        <div id="panel-site-${t.id}">
          <div class="site-player">
            <div class="sp-bar-wrap" data-bar-id="${t.id}" onclick="scrub(event,this,'${t.id}')">
              <div class="sp-bar-bg"></div><div class="sp-bar-fill" style="width:0%"></div><div class="sp-dot" style="left:0%"></div>
            </div>
            <div class="sp-controls">
              <button class="sp-btn" onclick="prevT(${i})" title="5秒戻す">&#9664;&#9664;</button>
              <button class="sp-play" data-play-id="${t.id}" onclick="playT('${t.id}')">&#9654;</button>
              <button class="sp-btn" onclick="nextT(${i})" title="5秒進む">&#9654;&#9654;</button>
              <span class="sp-time" data-time-id="${t.id}">0:00 / ${dur}</span>
            </div>
          </div>
        </div>
        <div class="yt-panel" id="panel-yt-${t.id}" style="display:none">
          ${t.youtubeUrl?ytEmbed(t.youtubeUrl):ytPh()}
        </div>
        <div class="full-panel" id="panel-full-${t.id}" style="display:none">
          <div class="full-box">
            <div class="full-desc">sample は無料です。<strong>フルは1回試聴のみ</strong>で、試聴ごとにコインを消費します。</div>
            <div class="full-price"><span class="coin-num" data-track-cost="${t.price==null?30:t.price}">${t.price===0?"FREE":(t.price||30)}</span>${t.price===0?"":'<span class="coin-unit">coin / one listen</span>'}</div>
            <div class="full-wallet-line">現在の残高：<strong><span data-track-balance>${TAMSICCoins.getBalance()}</span>コイン</strong></div>
            <div class="lyrics-preview">${(t.lyricsPreview||'歌詞はフル試聴時に表示されます。').replace(/\n/g,'<br>')}</div>
            <div class="full-note">ダウンロード不可 / ブラウザ内再生のみ / 再度再生する場合は再度コインを消費</div>
            <button class="full-buy" onclick="unlockFullTrack('${t.id}')">${t.price===0?"FREEで1回フル試聴":(t.price||30)+"コインで1回フル試聴"}</button>
            <div class="full-player-mount" id="full-player-${t.id}"></div>
            <div class="full-lyrics" id="lyrics-${t.id}" style="display:none">${(t.lyrics||'').replace(/\n/g,'<br>')}</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}
function renderGallery(){
  const g=document.getElementById('gallery-grid');
  const photos=getArtistPhotos('kiki');
  g.innerHTML=photos.map(src=>`<div class="g-item"><img src="${src}" alt="kiki" style="width:100%;height:100%;object-fit:cover;"></div>`).join('');
}

function ytEmbed(url){
  let id='';
  try{const u=new URL(url);id=u.searchParams.get('v')||u.pathname.split('/').pop();}catch(e){return ytPh();}
  return`<iframe class="yt-embed" src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>`;
}
function ytPh(){return`<div class="yt-placeholder"><div class="yt-icon">▶</div><span>YouTube 動画を埋め込み予定<br><small>管理パネルでURLを設定してください</small></span></div>`;}

function setMode(id,mode,btn){
  ['site','yt','full'].forEach(m=>{const el=document.getElementById(`panel-${m}-${id}`);if(el)el.style.display=m===mode?'block':'none';});
  btn.closest('.player-modes').querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(mode!=='site')TAMSICPlayer.stop(true);
}
function playT(id){
  const t=_tracks.find(x=>x.id===id);if(!t)return;
  const url=getTrackAudioSrc(t);
  if(!url){alert('音声ファイルが設定されていません。');return;}
  TAMSICPlayer.play(id,url,t.sampleStart,t.sampleEnd);
}
function scrub(e,wrap,id){
  const rect=wrap.getBoundingClientRect();
  const pct=Math.max(0,Math.min(100,((e.clientX-rect.left)/rect.width)*100));
  const fill=wrap.querySelector('.sp-bar-fill');
  const dot=wrap.querySelector('.sp-dot');
  if(fill) fill.style.width=pct+'%';
  if(dot) dot.style.left=pct+'%';
  if(window.TAMSICPlayer) TAMSICPlayer.setSamplePosition(id,pct);
}
function prevT(i){
  const t=_tracks[i];
  if(!t) return;
  if(window.TAMSICPlayer && TAMSICPlayer.seekSampleBy(t.id,-5)) return;
  const el=document.getElementById('track-'+t.id);
  if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
}
function nextT(i){
  const t=_tracks[i];
  if(!t) return;
  if(window.TAMSICPlayer && TAMSICPlayer.seekSampleBy(t.id,5)) return;
  const el=document.getElementById('track-'+t.id);
  if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
}

init();
renderGallery();
