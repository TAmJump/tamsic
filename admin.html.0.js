
// ─── Auth ───────────────────────────────────────────────
const ADMIN_PW = 'TAMSIC2025';
function login() {
  const pw = document.getElementById('pw-input').value;
  if (pw === ADMIN_PW) {
    sessionStorage.setItem('tamsic_admin','1');
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('admin-main').style.display='block';
    loadAll();
  } else {
    document.getElementById('auth-err').style.display='block';
  }
}
window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('tamsic_admin')==='1') {
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('admin-main').style.display='block';
    loadAll();
  }
});

// ─── Tab ────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.snav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  event.currentTarget.classList.add('active');
  if (name==='nono') renderTracks('nono');
  if (name==='kiki') renderTracks('kiki');
  if (name==='news') renderNews();
}

// ─── Load All ───────────────────────────────────────────
async function loadAll() {
  await renderTracks('nono');
  await renderTracks('kiki');
  await renderNews();
}

// ─── Render Tracks ──────────────────────────────────────
async function renderTracks(artist) {
  const list = document.getElementById(artist+'-list');
  list.innerHTML = '<p style="color:var(--mid);font-size:12px;padding:20px">読み込み中...</p>';
  const tracks = await TAMSICDB.getTracks(artist);
  if (!tracks.length) {
    list.innerHTML = '<div class="no-tracks-msg">まだ曲が追加されていません。「+ 曲を追加」から追加してください。</div>';
    return;
  }
  list.innerHTML = tracks.map(t => {
    const coverHtml = t.coverDataUrl
      ? `<img src="${t.coverDataUrl}" alt="cover">`
      : `<div class="tac-cover-ph">No Cover</div>`;
    return `<div class="track-admin-card">
      <div class="tac-cover">${coverHtml}</div>
      <div class="tac-info">
        <div class="tac-num">${artist.toUpperCase()} — Track ${String(t.order).padStart(2,'0')}</div>
        <div class="tac-title">${t.title||'(タイトル未設定)'}${t.isNew?'<span class="badge-new">New</span>':''}</div>
        <div class="tac-meta">
          <span class="tac-tag">${t.sampleStart||'0:00'} ～ ${t.sampleEnd||'0:30'}</span>
          <span class="tac-tag">¥${t.price||30}</span>
          ${t.youtubeUrl?`<span class="tac-tag">YouTube ✓</span>`:''}
          ${t.hasAudio?`<span class="tac-tag">音声 ✓</span>`:''}
        </div>
      </div>
      <div class="tac-actions">
        <button class="act-btn" onclick="editTrack('${t.id}','${artist}')">編集</button>
        <button class="act-btn del" onclick="deleteTrack('${t.id}','${artist}')">削除</button>
      </div>
    </div>`;
  }).join('');
}

// ─── Render News ────────────────────────────────────────
async function renderNews() {
  const list = document.getElementById('news-list');
  const items = await TAMSICDB.getNews();
  if (!items.length) {
    list.innerHTML = '<div class="no-tracks-msg">まだニュースがありません。</div>';
    return;
  }
  list.innerHTML = items.map(n => `
    <div class="news-admin-card">
      <span class="nac-date">${n.date||'—'}</span>
      <div>
        <div class="nac-title">${n.title}</div>
        ${n.titleEn?`<div style="font-size:11px;color:var(--mid);margin-top:2px">${n.titleEn}</div>`:''}
      </div>
      <span class="nac-tag">${n.tag||'Info'}</span>
      <div class="tac-actions">
        <button class="act-btn" onclick="editNews('${n.id}')">編集</button>
        <button class="act-btn del" onclick="deleteNews('${n.id}')">削除</button>
      </div>
    </div>`).join('');
}

// ─── Track Modal ─────────────────────────────────────────
let _tempCoverDataUrl = null;
let _tempAudioData    = null;
let _tempAudioType    = null;

function openTrackModal(artist, track=null) {
  _tempCoverDataUrl = null;
  _tempAudioData    = null;
  _tempAudioType    = null;

  document.getElementById('modal-title').textContent = track ? '曲を編集' : '曲を追加';
  document.getElementById('edit-track-id').value     = track?.id || '';
  document.getElementById('edit-track-artist').value = track?.artist || artist;
  document.getElementById('f-title').value   = track?.title || '';
  document.getElementById('f-youtube').value = track?.youtubeUrl || '';
  document.getElementById('f-start').value   = track?.sampleStart || '0:00';
  document.getElementById('f-end').value     = track?.sampleEnd || '0:30';
  document.getElementById('f-price').value   = track?.price || 30;
  document.getElementById('f-order').value   = track?.order || 1;
  document.getElementById('f-isnew').checked = track?.isNew || false;
  document.getElementById('f-cover').value   = '';
  document.getElementById('f-audio').value   = '';
  document.getElementById('audio-status').textContent = track?.hasAudio ? '✓ 音声保存済み' : '';

  const coverPrev = document.getElementById('cover-preview');
  if (track?.coverDataUrl) {
    coverPrev.src = track.coverDataUrl;
    coverPrev.style.display = 'block';
    _tempCoverDataUrl = track.coverDataUrl;
  } else {
    coverPrev.style.display = 'none';
    coverPrev.src = '';
  }
  document.getElementById('audio-preview').style.display = 'none';
  document.getElementById('audio-preview').src = '';

  document.getElementById('track-modal').classList.add('open');
}

async function editTrack(id, artist) {
  const tracks = await TAMSICDB.getTracks(artist);
  const t = tracks.find(x=>x.id===id);
  if (t) {
    // Load audio blob URL for preview
    if (t.audioData) {
      const blob = new Blob([t.audioData], { type: t.audioType||'audio/mpeg' });
      const url  = URL.createObjectURL(blob);
      const ap   = document.getElementById('audio-preview');
      ap.src = url;
      ap.style.display = 'block';
      _tempAudioData = t.audioData;
      _tempAudioType = t.audioType;
    }
    openTrackModal(artist, t);
  }
}

function onCoverChange(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _tempCoverDataUrl = e.target.result;
    const prev = document.getElementById('cover-preview');
    prev.src = _tempCoverDataUrl;
    prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function onAudioChange(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('audio-status').textContent = '読み込み中...';
  const reader = new FileReader();
  reader.onload = e => {
    _tempAudioData = e.target.result; // ArrayBuffer
    _tempAudioType = file.type;
    const blob = new Blob([_tempAudioData], { type: _tempAudioType });
    const url  = URL.createObjectURL(blob);
    const ap   = document.getElementById('audio-preview');
    ap.src = url;
    ap.style.display = 'block';
    const mb = (file.size/1024/1024).toFixed(1);
    document.getElementById('audio-status').textContent = `✓ ${file.name} (${mb} MB)`;
  };
  reader.readAsArrayBuffer(file);
}

async function saveTrack() {
  const id     = document.getElementById('edit-track-id').value;
  const artist = document.getElementById('edit-track-artist').value;
  const title  = document.getElementById('f-title').value.trim();
  if (!title) { alert('タイトルを入力してください'); return; }

  const track = {
    id:         id || `${artist}-${Date.now()}`,
    artist,
    order:      parseInt(document.getElementById('f-order').value)||1,
    title,
    coverDataUrl: _tempCoverDataUrl,
    audioData:  _tempAudioData,
    audioType:  _tempAudioType,
    hasAudio:   !!_tempAudioData,
    youtubeUrl: document.getElementById('f-youtube').value.trim(),
    sampleStart:document.getElementById('f-start').value.trim()||'0:00',
    sampleEnd:  document.getElementById('f-end').value.trim()||'0:30',
    price:      parseInt(document.getElementById('f-price').value)||30,
    isNew:      document.getElementById('f-isnew').checked,
    addedAt:    id ? undefined : new Date().toISOString(),
  };
  if (id) {
    // Preserve existing audio/cover if not changed
    const existing = (await TAMSICDB.getTracks(artist)).find(x=>x.id===id);
    if (existing) {
      if (!_tempAudioData && existing.audioData) { track.audioData=existing.audioData; track.audioType=existing.audioType; track.hasAudio=true; }
      if (!_tempCoverDataUrl && existing.coverDataUrl) track.coverDataUrl=existing.coverDataUrl;
      track.addedAt = existing.addedAt;
    }
  }

  await TAMSICDB.saveTrack(track);
  closeModal('track-modal');
  renderTracks(artist);
}

async function deleteTrack(id, artist) {
  if (!confirm('この曲を削除しますか？')) return;
  await TAMSICDB.deleteTrack(id);
  renderTracks(artist);
}

// ─── News Modal ──────────────────────────────────────────
function openNewsModal(item=null) {
  document.getElementById('edit-news-id').value = item?.id||'';
  document.getElementById('n-title').value    = item?.title||'';
  document.getElementById('n-title-en').value = item?.titleEn||'';
  document.getElementById('n-date').value     = item?.date||new Date().toISOString().split('T')[0];
  document.getElementById('n-tag').value      = item?.tag||'Info';
  document.getElementById('news-modal').classList.add('open');
}

async function editNews(id) {
  const items = await TAMSICDB.getNews();
  const n = items.find(x=>x.id===id);
  if (n) openNewsModal(n);
}

async function saveNews() {
  const title = document.getElementById('n-title').value.trim();
  if (!title) { alert('タイトルを入力してください'); return; }
  const id = document.getElementById('edit-news-id').value;
  const item = {
    id: id||`news-${Date.now()}`,
    title,
    titleEn:  document.getElementById('n-title-en').value.trim(),
    date:     document.getElementById('n-date').value,
    tag:      document.getElementById('n-tag').value,
    addedAt:  id ? (await TAMSICDB.getNews()).find(x=>x.id===id)?.addedAt||new Date().toISOString() : new Date().toISOString(),
  };
  await TAMSICDB.saveNews(item);
  closeModal('news-modal');
  renderNews();
}

async function deleteNews(id) {
  if (!confirm('このニュースを削除しますか？')) return;
  await TAMSICDB.deleteNews(id);
  renderNews();
}

// ─── Modal Close ─────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); });
});
