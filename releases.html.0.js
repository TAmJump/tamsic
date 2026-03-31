
async function loadReleases() {
  const container = document.getElementById('releases-container');
  const nonos = await TAMSICDB.getTracks('nono');
  const kikis = await TAMSICDB.getTracks('kiki');

  if (!nonos.length && !kikis.length) {
    container.innerHTML = '<div class="no-releases"><p>まだリリースがありません。</p></div>';
    return;
  }

  function renderGrid(tracks, artist) {
    if (!tracks.length) return '<div class="no-releases"><p>Coming Soon</p></div>';
    return `<div class="releases-grid">${tracks.map(t=>`
      <div class="release-card" onclick="window.location='${artist}.html#track-${t.id}'">
        <div class="rc-cover">
          ${getTrackCoverSrc(t)?`<img src="${getTrackCoverSrc(t)}" alt="${t.title}">`:'<span class="rc-cover-ph">Cover</span>'}
          ${t.isNew?'<span class="rc-badge">New</span>':''}
        </div>
        <div class="rc-info">
          <div class="rc-num">${artist.toUpperCase()} · Track ${String(t.order).padStart(2,'0')}</div>
          <div class="rc-title">${t.title||'TRACK TITLE'}</div>
          <div class="rc-price">sample無料 / フル ${t.price||30}コイン</div>
        </div>
      </div>`).join('')}
    </div>`;
  }

  let html = '';
  if (nonos.length) html += `
    <div class="artist-block">
      <div class="ab-header">
        <h2 class="ab-artist">no-no</h2>
        <a href="nono.html" class="ab-link">Official Page →</a>
      </div>
      ${renderGrid(nonos,'nono')}
    </div>`;
  if (kikis.length) html += `
    <div class="artist-block">
      <div class="ab-header">
        <h2 class="ab-artist">kiki</h2>
        <a href="kiki.html" class="ab-link">Official Page →</a>
      </div>
      ${renderGrid(kikis,'kiki')}
    </div>`;

  container.innerHTML = html;
}

loadReleases();
