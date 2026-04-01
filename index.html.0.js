
async function initHome(){
  const allTracks = await TAMSICDB.getAllTracks();
  const news = await TAMSICDB.getNews();
  const photos = { nono: getArtistPhotos('nono')[0], kiki: getArtistPhotos('kiki')[0] };

  // アーティスト写真（要素がなければスキップ）
  const nonoImg = document.getElementById('artist-photo-nono');
  const nonoImgPh = document.getElementById('artist-photo-nono-ph');
  if (photos.nono && nonoImg) {
    nonoImg.src = photos.nono;
    nonoImg.style.display = 'block';
    if (nonoImgPh) nonoImgPh.style.display = 'none';
  }
  const kikiImg = document.getElementById('artist-photo-kiki');
  const kikiImgPh = document.getElementById('artist-photo-kiki-ph');
  if (photos.kiki && kikiImg) {
    kikiImg.src = photos.kiki;
    kikiImg.style.display = 'block';
    if (kikiImgPh) kikiImgPh.style.display = 'none';
  }

  // アーティストメタ
  const nonoCount = allTracks.filter(t => t.artist === 'nono').length;
  const kikiCount = allTracks.filter(t => t.artist === 'kiki').length;
  const metaNono = document.getElementById('artist-meta-nono');
  const metaKiki = document.getElementById('artist-meta-kiki');
  if (metaNono) metaNono.textContent = `AI Idol · ${nonoCount} Tracks`;
  if (metaKiki) metaKiki.textContent = `AI Idol · ${kikiCount} Tracks`;

  // 最新楽曲
  const latest = [...allTracks].sort((a,b)=> String(b.id).localeCompare(String(a.id))).slice(0,4);
  if (latest.length) {
    const art = getTrackCoverSrc(latest[0]);
    const artWrap = document.getElementById('latest-artwork');
    if (art && artWrap) artWrap.innerHTML = `<img src="${art}" alt="${escapeHtml(latest[0].title)}" style="width:100%;height:100%;object-fit:cover;">`;
    const latestTracks = document.getElementById('latest-tracks');
    if (latestTracks) latestTracks.innerHTML = latest.map((t,idx)=>`
      <div class="latest-track" onclick="window.location='${t.artist}.html#track-${t.id}'" style="cursor:pointer">
        <span class="lt-num">${String(idx+1).padStart(2,'0')}</span>
        <span class="lt-name">${escapeHtml(t.title)}</span>
        <span class="lt-artist">${t.artist === 'nono' ? 'no-no' : 'kiki'} · sample無料 / フル ${t.price||30}コイン</span>
      </div>
    `).join('');
  }

  // ニュース
  const newsList = document.getElementById('home-news-list');
  if (newsList) newsList.innerHTML = news.slice(0,3).map(n=>`
    <div class="news-item">
      <span class="news-date">${escapeHtml(n.date || '—')}</span>
      <div class="news-body">
        <p class="news-headline">${escapeHtml(n.title || '')}</p>
        <p class="news-sub">${escapeHtml(n.titleEn || '')}</p>
      </div>
      <span class="news-tag">${escapeHtml(n.tag || 'Info')}</span>
    </div>
  `).join('');
}
initHome();
