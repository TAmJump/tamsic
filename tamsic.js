
const TAMSIC_DEFAULTS = window.TAMSIC_CONTENT || { tracks: [], news: [], photos: {} };

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function getDefaultTracks() {
  return deepClone(TAMSIC_DEFAULTS.tracks || []);
}
function getDefaultNews() {
  const now = new Date();
  const all = deepClone(TAMSIC_DEFAULTS.news || []);
  // showAfterが設定されている場合は公開日以降のみ表示
  return all.filter(n => {
    if (!n.showAfter) return true;
    return new Date(n.showAfter) <= now;
  }).sort((a, b) => new Date(b.addedAt||0) - new Date(a.addedAt||0));
}
function getArtistPhotos(artist) {
  return deepClone((TAMSIC_DEFAULTS.photos && TAMSIC_DEFAULTS.photos[artist]) || []);
}
function getTrackCoverSrc(track) {
  return track.coverDataUrl || track.coverPath || '';
}
function getTrackAudioSrc(track) {
  // v3: 公開状態の二重チェック（release-control.js が読み込まれている場合）
  // これは静的サイト上の「防御的ゲート」。true のセキュリティは assets/ に
  // MP3 を置かないこと、または signed URL CDN が必要。コメント欄参照。
  try {
    if (window.TAMSICRelease && typeof window.TAMSICRelease.getState === 'function' && track && track.title) {
      const st = window.TAMSICRelease.getState(track.title);
      // locked = 全員不可, preview = 非会員不可
      if (st === 'locked') return '';
      if (st === 'preview') return ''; // preview は非会員状態での先行期間中
    }
  } catch (e) { /* noop */ }

  if (track.audioData) {
    if (!TAMSICPlayer.blobUrls[track.id]) {
      const blob = new Blob([track.audioData], { type: track.audioType || 'audio/mpeg' });
      TAMSICPlayer.blobUrls[track.id] = URL.createObjectURL(blob);
    }
    return TAMSICPlayer.blobUrls[track.id];
  }
  return track.audioPath || '';
}
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}


function getCoinPacks() {
  return deepClone(TAMSIC_DEFAULTS.coinPacks || [
    { id: 'starter', coins: 100, priceYen: 200, label: 'お試し' },
    { id: 'standard', coins: 300, priceYen: 500, label: 'おすすめ' },
    { id: 'premium', coins: 500, priceYen: 800, label: '一番お得' }
  ]);
}
function getCoinBonus() {
  return Number((TAMSIC_DEFAULTS.coinBonus && TAMSIC_DEFAULTS.coinBonus.firstVisitCoins) || 100);
}

window.TAMSICCoins = (() => {
  const STORAGE_KEY = 'TAMSIC_COIN_STATE_V1';
  const EVENT_NAME = 'tamsic:coins-updated';

  function nowIso() {
    return new Date().toISOString();
  }
  function guestState() {
    return { balance: 0, firstVisitAwarded: false, awardedAt: null, purchases: [], listens: [], guest: true };
  }
  function hasAuth() {
    return !!(window.TAMSICAuth && typeof window.TAMSICAuth.getCurrentUser === 'function');
  }
  function isLoggedIn() {
    return !!(hasAuth() && window.TAMSICAuth.getCurrentUser());
  }
  function readLegacyState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.balance === 'number') return parsed;
      }
    } catch (e) {}
    return null;
  }
  function writeLegacyState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
  function readState() {
    if (hasAuth()) return window.TAMSICAuth.getCoinState();
    const legacy = readLegacyState();
    if (legacy) return legacy;
    return guestState();
  }
  function writeState(state) {
    if (hasAuth() && isLoggedIn()) {
      window.TAMSICAuth.setCoinState(state);
    } else {
      writeLegacyState(state);
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: deepClone(state) }));
    return state;
  }
  function getState() {
    return deepClone(readState());
  }
  function getBalance() {
    return Number(readState().balance || 0);
  }
  function addCoins(packId) {
    if (!isLoggedIn()) return { ok: false, loginRequired: true, message: 'ログインしてください。' };
    const pack = getCoinPacks().find(x => x.id === packId);
    if (!pack) return { ok: false, message: 'コインパックが見つかりません。' };
    const state = readState();
    state.balance += Number(pack.coins || 0);
    state.purchases.unshift({
      id: `purchase-${Date.now()}`,
      packId: pack.id,
      coins: Number(pack.coins || 0),
      priceYen: Number(pack.priceYen || 0),
      at: nowIso()
    });
    writeState(state);
    return { ok: true, balance: state.balance, pack };
  }
  function spendCoins(trackId, coins) {
    if (!isLoggedIn()) return { ok: false, loginRequired: true, balance: 0 };
    const cost = Number(coins || 0);
    const state = readState();
    if (state.balance < cost) {
      return { ok: false, balance: state.balance, shortage: cost - state.balance };
    }
    state.balance -= cost;
    state.listens.unshift({
      id: `listen-${Date.now()}`,
      trackId,
      coins: cost,
      at: nowIso()
    });
    writeState(state);
    return { ok: true, balance: state.balance, spent: cost };
  }
  function onChange(cb) {
    if (typeof cb !== 'function') return () => {};
    const handler = e => cb(deepClone(e.detail || readState()));
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }
  return { getState, getBalance, addCoins, spendCoins, onChange, getPacks: getCoinPacks, getBonus: getCoinBonus, isLoggedIn };
})();;


/* ═══════════════════════════════════════════════════════
   TAMSIC.js — 共有ユーティリティ
   IndexedDB・オーディオプレイヤー・共通関数
═══════════════════════════════════════════════════════ */

// ── IndexedDB ──────────────────────────────────────────
const TAMSICDB = (() => {
  const NAME = 'TAMSIC_DB', VER = 2;
  let _db = null;

  function open() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks'))
          db.createObjectStore('tracks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('news'))
          db.createObjectStore('news', { keyPath: 'id' });
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror = e => rej(e.target.error);
    });
  }

  async function getAll(store) {
    const db = await open();
    return new Promise((res, rej) => {
      const req = db.transaction(store,'readonly').objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function putItem(store, item) {
    const db = await open();
    return new Promise((res, rej) => {
      const req = db.transaction(store,'readwrite').objectStore(store).put(item);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }
  async function removeItem(store, id) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store,'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }

  async function getTracks(artist) {
    const all = await getAll('tracks');
    const base = all.length ? all : getDefaultTracks();
    return base.filter(t => t.artist === artist).sort((a,b) => (a.order||999) - (b.order||999));
  }
  async function getAllTracks() {
    const all = await getAll('tracks');
    const base = all.length ? all : getDefaultTracks();
    return base.sort((a,b) => a.artist.localeCompare(b.artist) || ((a.order||999) - (b.order||999)));
  }
  async function saveTrack(t)   { return putItem('tracks', t); }
  async function deleteTrack(id){ return removeItem('tracks', id); }

  async function getNews() {
    const all = await getAll('news');
    const base = all.length ? all : getDefaultNews();
    return base.sort((a,b) => String(b.addedAt).localeCompare(String(a.addedAt)));
  }
  async function saveNews(n)   { return putItem('news', n); }
  async function deleteNews(id){ return removeItem('news', id); }

  return { getTracks, getAllTracks, saveTrack, deleteTrack, getNews, saveNews, deleteNews };
})();

// ── 時間パーサ ─────────────────────────────────────────
function parseTime(str) {
  if (!str) return 0;
  const parts = String(str).split(':');
  if (parts.length === 2) return parseInt(parts[0]||0)*60 + parseFloat(parts[1]||0);
  return parseFloat(str)||0;
}
function formatTime(sec) {
  sec = Math.max(0, sec||0);
  return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
}

// ── フェード ───────────────────────────────────────────
function fadeVol(audio, from, to, ms, done) {
  const steps = 50, stepVol = (to-from)/steps;
  let i = 0;
  audio.volume = Math.max(0,Math.min(1,from));
  const t = setInterval(() => {
    i++;
    audio.volume = Math.max(0,Math.min(1,from + stepVol*i));
    if (i >= steps) { clearInterval(t); done && done(); }
  }, ms/steps);
  return t;
}

// ── サンプルプレイヤー ─────────────────────────────────
// グローバル状態
window.TAMSICPlayer = {
  audio: null,
  trackId: null,
  timers: [],
  blobUrls: {},
  sampleRange: null,
  dragState: null,
  _dragBound: false,

  stop(resetUI) {
    const prevTrackId = this.trackId;
    const prevRange = this.sampleRange;
    this.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    this.timers = [];
    if (this.audio) {
      try { this.audio.pause(); } catch (e) {}
      this.audio = null;
    }
    if (resetUI && prevTrackId) {
      const btn = document.querySelector(`[data-play-id="${prevTrackId}"]`);
      const fill = document.querySelector(`[data-bar-id="${prevTrackId}"] .sp-bar-fill`);
      const dot = document.querySelector(`[data-bar-id="${prevTrackId}"] .sp-dot`);
      const timeEl = document.querySelector(`[data-time-id="${prevTrackId}"]`);
      if (btn) { btn.innerHTML = '&#9654;'; btn.dataset.playing = '0'; }
      if (fill) fill.style.width = '0%';
      if (dot) dot.style.left = '0%';
      if (timeEl && prevRange) timeEl.textContent = formatTime(0) + ' / ' + formatTime(prevRange.duration);
    }
    this.trackId = null;
    this.sampleRange = null;
    this.dragState = null;
  },

  updateSampleUI(trackId, elapsed, pct) {
    const barWrap = document.querySelector(`[data-bar-id="${trackId}"]`);
    const fill = barWrap ? barWrap.querySelector('.sp-bar-fill') : null;
    const dot = barWrap ? barWrap.querySelector('.sp-dot') : null;
    const timeEl = document.querySelector(`[data-time-id="${trackId}"]`);
    const duration = this.sampleRange ? this.sampleRange.duration : 0;
    const safePct = Math.max(0, Math.min(100, Number(pct || 0)));
    const safeElapsed = Math.max(0, Math.min(duration || 0, Number(elapsed || 0)));
    if (fill) fill.style.width = safePct + '%';
    if (dot) dot.style.left = safePct + '%';
    if (timeEl && duration) timeEl.textContent = formatTime(safeElapsed) + ' / ' + formatTime(duration);
  },

  syncSampleUI() {
    if (!this.audio || !this.trackId || !this.sampleRange) return;
    const { startSec, endSec, duration, fadeMs } = this.sampleRange;
    const elapsed = Math.max(0, Math.min(duration, this.audio.currentTime - startSec));
    const pct = duration ? (elapsed / duration) * 100 : 0;
    if (!this.dragState || this.dragState.trackId !== this.trackId) {
      this.updateSampleUI(this.trackId, elapsed, pct);
    }
    if (!this.sampleRange.fadeStarted && this.audio.currentTime >= Math.max(startSec, endSec - fadeMs / 1000)) {
      this.sampleRange.fadeStarted = true;
      this.timers.push(fadeVol(this.audio, Math.max(0, Math.min(1, this.audio.volume || 1)), 0, fadeMs));
    }
    if (this.audio.currentTime >= endSec || this.audio.ended) {
      this.stop(true);
    }
  },

  setSamplePosition(trackId, pct) {
    if (!this.audio || this.trackId !== trackId || !this.sampleRange) return false;
    const { startSec, endSec, duration, fadeMs } = this.sampleRange;
    const clampedPct = Math.max(0, Math.min(100, Number(pct || 0)));
    const nextTime = Math.max(startSec, Math.min(endSec - 0.05, startSec + (duration * clampedPct / 100)));
    try { this.audio.currentTime = nextTime; } catch (e) { return false; }
    const elapsed = Math.max(0, Math.min(duration, nextTime - startSec));
    this.sampleRange.fadeStarted = nextTime >= Math.max(startSec, endSec - fadeMs / 1000);
    if (this.sampleRange.fadeStarted) {
      this.audio.volume = Math.min(this.audio.volume || 1, 0.35);
    } else if (!this.audio.paused) {
      this.audio.volume = 1;
    }
    this.updateSampleUI(trackId, elapsed, clampedPct);
    return true;
  },

  seekSampleBy(trackId, deltaSec) {
    if (!this.audio || this.trackId !== trackId || !this.sampleRange) return false;
    const { startSec, endSec, duration } = this.sampleRange;
    const nextTime = Math.max(startSec, Math.min(endSec - 0.05, this.audio.currentTime + Number(deltaSec || 0)));
    const pct = duration ? ((nextTime - startSec) / duration) * 100 : 0;
    return this.setSamplePosition(trackId, pct);
  },

  bindSampleBarDrag() {
    if (this._dragBound) return;
    this._dragBound = true;

    const getWrap = target => target && target.closest ? target.closest('.sp-bar-wrap') : null;
    const getPct = (event, wrap) => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width) return 0;
      return Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    };

    document.addEventListener('pointerdown', (event) => {
      const wrap = getWrap(event.target);
      if (!wrap) return;
      const trackId = wrap.getAttribute('data-bar-id');
      if (!trackId || !this.audio || this.trackId !== trackId || !this.sampleRange) return;
      wrap.style.touchAction = 'none';
      this.dragState = { trackId, wrap, pointerId: event.pointerId };
      try { wrap.setPointerCapture(event.pointerId); } catch (e) {}
      this.setSamplePosition(trackId, getPct(event, wrap));
      event.preventDefault();
    });

    document.addEventListener('pointermove', (event) => {
      if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
      const { wrap, trackId } = this.dragState;
      this.setSamplePosition(trackId, getPct(event, wrap));
      event.preventDefault();
    });

    const endDrag = (event) => {
      if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
      const { wrap, trackId } = this.dragState;
      this.setSamplePosition(trackId, getPct(event, wrap));
      try { wrap.releasePointerCapture(event.pointerId); } catch (e) {}
      this.dragState = null;
      event.preventDefault();
    };

    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  },

  play(trackId, audioUrl, sampleStart, sampleEnd) {
    if (this.trackId === trackId) { this.stop(true); return; }
    this.stop(true);
    this.bindSampleBarDrag();

    const startSec = parseTime(sampleStart);
    const endSec = parseTime(sampleEnd) || startSec + 30;
    const duration = Math.max(1, endSec - startSec);
    const fadeMs = 1500;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioUrl;
    audio.volume = 0;
    this.audio = audio;
    this.trackId = trackId;
    this.sampleRange = { startSec, endSec, duration, fadeMs, fadeStarted: false };

    const btn = document.querySelector(`[data-play-id="${trackId}"]`);
    const timeEl = document.querySelector(`[data-time-id="${trackId}"]`);
    if (btn) { btn.innerHTML = '&#9646;&#9646;'; btn.dataset.playing = '1'; }
    if (timeEl) timeEl.textContent = formatTime(0) + ' / ' + formatTime(duration);
    this.updateSampleUI(trackId, 0, 0);

    let started = false;
    const startPlayback = () => {
      if (started || this.trackId !== trackId || !this.audio) return;
      started = true;
      try { audio.currentTime = startSec; } catch (e) {}
      audio.play().then(() => {
        this.timers.push(fadeVol(audio, 0, 1, fadeMs));
        const prog = setInterval(() => this.syncSampleUI(), 50);
        this.timers.push(prog);
      }).catch(() => {
        this.stop(true);
        alert('再生を開始できませんでした。ブラウザの設定または音声ファイルを確認してください。');
      });
    };

    audio.addEventListener('loadedmetadata', startPlayback, { once: true });
    audio.addEventListener('canplay', startPlayback, { once: true });
    audio.addEventListener('error', () => {
      this.stop(true);
      alert('音声ファイルを読み込めませんでした。\nURLまたはファイルパスを確認してください。');
    }, { once: true });
    audio.load();
  },

  playFull(trackId, audioUrl, mountSelector) {
    this.stop(true);
    const mount = typeof mountSelector === 'string' ? document.querySelector(mountSelector) : mountSelector;
    if (!mount) {
      alert('再生エリアを表示できませんでした。');
      return;
    }
    mount.innerHTML = '';
    const audio = document.createElement('audio');
    audio.src = audioUrl;
    audio.controls = true;
    audio.autoplay = true;
    audio.preload = 'auto';
    audio.style.width = '100%';
    audio.setAttribute('controlsList', 'nodownload noplaybackrate');
    audio.setAttribute('oncontextmenu', 'return false;');
    const note = document.createElement('div');
    note.style.marginTop = '10px';
    note.style.fontSize = '12px';
    note.style.color = '#7a7a72';
    note.textContent = '1回試聴です。再度再生する場合は、もう一度コインが必要です。';
    mount.appendChild(audio);
    mount.appendChild(note);
    this.audio = audio;
    this.trackId = trackId;
    audio.addEventListener('ended', () => {
      note.textContent = '試聴が終了しました。もう一度再生する場合は、再度コインが必要です。';
      setTimeout(() => {
        if (this.audio === audio) this.audio = null;
        if (this.trackId === trackId) this.trackId = null;
        mount.innerHTML = '<div class="full-ended-msg">この1回の試聴は終了しました。</div>';
      }, 400);
    }, { once: true });
    audio.addEventListener('error', () => {
      if (this.audio === audio) this.audio = null;
      if (this.trackId === trackId) this.trackId = null;
      mount.innerHTML = '<div class="full-ended-msg">音声ファイルを読み込めませんでした。</div>';
    }, { once: true });
  }
};
