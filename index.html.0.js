
async function initHome(){
  const allTracks = await TAMSICDB.getAllTracks();
  const news = await TAMSICDB.getNews();
  const photos = { nono: getArtistPhotos('nono')[0], kiki: getArtistPhotos('kiki')[0] };

  if (photos.nono) {
    document.getElementById('artist-photo-nono').src = photos.nono;
    document.getElementById('artist-photo-nono').style.display = 'block';
    document.getElementById('artist-photo-nono-ph').style.display = 'none';
  }
  if (photos.kiki) {
    document.getElementById('artist-photo-kiki').src = photos.kiki;
    document.getElementById('artist-photo-kiki').style.display = 'block';
    document.getElementById('artist-photo-kiki-ph').style.display = 'none';
  }

  const nonoCount = allTracks.filter(t => t.artist === 'nono').length;
  const kikiCount = allTracks.filter(t => t.artist === 'kiki').length;
  document.getElementById('artist-meta-nono').textContent = `AI Idol · ${nonoCount} Tracks`;
  document.getElementById('artist-meta-kiki').textContent = `AI Idol · ${kikiCount} Tracks`;

  const latest = [...allTracks].sort((a,b)=> String(b.id).localeCompare(String(a.id))).slice(0,4);
  if (latest.length) {
    const art = getTrackCoverSrc(latest[0]);
    const artWrap = document.getElementById('latest-artwork');
    if (art) artWrap.innerHTML = `<img src="${art}" alt="${escapeHtml(latest[0].title)}" style="width:100%;height:100%;object-fit:cover;">`;
    document.getElementById('latest-tracks').innerHTML = latest.map((t,idx)=>`
      <div class="latest-track" onclick="window.location='${t.artist}.html#track-${t.id}'" style="cursor:pointer">
        <span class="lt-num">${String(idx+1).padStart(2,'0')}</span>
        <span class="lt-name">${escapeHtml(t.title)}</span>
        <span class="lt-artist">${t.artist === 'nono' ? 'no-no' : 'kiki'} · sample無料 / フル ${t.price||30}コイン</span>
      </div>
    `).join('');
  }

  document.getElementById('home-news-list').innerHTML = news.slice(0,3).map(n=>`
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
