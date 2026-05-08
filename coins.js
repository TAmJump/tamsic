/**
 * coins.js — TAMSIC コイン管理ライブラリ (統一版)
 *
 * 単一の真実: localStorage["tamsic_wallet"]
 * Cognito との同期は auth.js の _syncWalletFromCognito / addCoinsToCognito / spendCoinsOnCognito が担当。
 *
 * v4.2 統一: 旧 tamsic.js 内 TAMSICCoins (TAMSIC_COIN_STATE_V1 ベース) と
 *           旧 coins.js (boolean 返す版) の二重実装を解消。
 *           全ページで window.TAMSICCoins は同一 API。
 *
 * API:
 *   getBalance()                       → number
 *   getPurchases()                     → Array<{at, coins, packId, title, priceYen}>
 *   getListens()                       → Array<{at, trackId, coins}>
 *   spendCoins(trackId, cost)          → {ok, balance, loginRequired?, shortage?, spent?}
 *   addCoins(coins, meta)              → number (新残高)
 *   onChange(cb)                       → unsubscribe function
 *   formatDate(iso) / formatYen(n)     → string
 */
(function() {

  const WALLET_KEY = 'tamsic_wallet';
  const EVENT_NAME = 'tamsic:coins-updated';

  // ─────────────────────────────────────────
  // 認証状態 (auth.js の isLoggedIn() を参照)
  // ─────────────────────────────────────────
  function _isAuthed() {
    try {
      if (typeof isLoggedIn === 'function' && isLoggedIn !== _isAuthed) {
        return !!isLoggedIn();
      }
    } catch (e) {}
    return false;
  }

  // ─────────────────────────────────────────
  // Storage I/O (NaN/不正値からの保護を含む)
  // ─────────────────────────────────────────
  function _load() {
    try {
      const raw = localStorage.getItem(WALLET_KEY);
      if (!raw) return { balance: 0, purchases: [], listens: [] };
      const parsed = JSON.parse(raw) || {};
      return {
        balance: Number.isFinite(parsed.balance) ? parsed.balance : 0,
        purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
        listens:   Array.isArray(parsed.listens)   ? parsed.listens   : []
      };
    } catch (e) {
      return { balance: 0, purchases: [], listens: [] };
    }
  }

  function _save(wallet) {
    if (!Number.isFinite(wallet.balance)) wallet.balance = 0;
    if (wallet.balance < 0) wallet.balance = 0;
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    try {
      localStorage.setItem('tamsic_wallet_cache', JSON.stringify({
        balance: wallet.balance,
        purchases: wallet.purchases,
        listens: wallet.listens
      }));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: wallet }));
  }

  // ─────────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────────
  function getBalance() {
    return _load().balance || 0;
  }

  function getPurchases() {
    return _load().purchases || [];
  }

  function getListens() {
    return _load().listens || [];
  }

  /**
   * コイン消費 (フル試聴解放時)
   * @param {string} trackId
   * @param {number} cost
   * @returns {{ok:boolean, balance:number, loginRequired?:boolean, shortage?:number, spent?:number}}
   */
  function spendCoins(trackId, cost) {
    if (!_isAuthed()) {
      return { ok: false, loginRequired: true, balance: 0 };
    }
    const c = Number(cost || 0);
    if (!Number.isFinite(c) || c < 0) {
      return { ok: false, balance: getBalance(), message: 'invalid cost' };
    }
    const wallet = _load();
    if (wallet.balance < c) {
      return { ok: false, balance: wallet.balance, shortage: c - wallet.balance };
    }
    wallet.balance -= c;
    wallet.listens.unshift({
      at:      new Date().toISOString(),
      trackId: trackId || '',
      coins:   c
    });
    _save(wallet);
    if (typeof spendCoinsOnCognito === 'function') {
      try { spendCoinsOnCognito(c, { trackId: trackId || '', trackTitle: '' }); } catch (e) {}
    }
    return { ok: true, balance: wallet.balance, spent: c };
  }

  /**
   * コイン加算 (購入確定時)
   */
  function addCoins(coins, meta) {
    const c = Number(coins || 0);
    if (!Number.isFinite(c) || c <= 0) return getBalance();
    const wallet = _load();
    wallet.balance += c;
    wallet.purchases.unshift({
      at:       new Date().toISOString(),
      coins:    c,
      packId:   (meta && meta.packId)   || '',
      title:    (meta && meta.title)    || '',
      priceYen: (meta && meta.priceYen) || 0
    });
    _save(wallet);
    return wallet.balance;
  }

  /**
   * 残高変動の購読
   */
  function onChange(cb) {
    if (typeof cb !== 'function') return function() {};
    const customHandler = function(e) {
      try { cb(e.detail || _load()); } catch (err) {}
    };
    const storageHandler = function(e) {
      if (e.key === WALLET_KEY) {
        try { cb(_load()); } catch (err) {}
      }
    };
    window.addEventListener(EVENT_NAME, customHandler);
    window.addEventListener('storage', storageHandler);
    return function() {
      window.removeEventListener(EVENT_NAME, customHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }

  // ─────────────────────────────────────────
  // フォーマッタ (mypage.js が利用)
  // ─────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const pad = function(n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '/' + pad(d.getMonth()+1) + '/' + pad(d.getDate())
           + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return '—'; }
  }

  function formatYen(n) {
    return '¥' + Number(n||0).toLocaleString('ja-JP');
  }

  // ─────────────────────────────────────────
  // 旧キー (TAMSIC_COIN_STATE_V1) からの一回限りの救済
  // ─────────────────────────────────────────
  (function _migrateLegacyOnce() {
    try {
      const legacyRaw = localStorage.getItem('TAMSIC_COIN_STATE_V1');
      if (!legacyRaw) return;
      const legacy = JSON.parse(legacyRaw);
      if (!legacy || typeof legacy.balance !== 'number') return;
      const current = _load();
      if (legacy.balance > current.balance) {
        current.balance = legacy.balance;
        if (Array.isArray(legacy.purchases)) current.purchases = current.purchases.concat(legacy.purchases);
        if (Array.isArray(legacy.listens))   current.listens   = current.listens.concat(legacy.listens);
        _save(current);
        console.info('[TAMSIC] migrated legacy coin state V1 → tamsic_wallet');
      }
      localStorage.removeItem('TAMSIC_COIN_STATE_V1');
    } catch (e) {}
  })();

  window.TAMSICCoins = {
    getBalance:   getBalance,
    getPurchases: getPurchases,
    getListens:   getListens,
    spendCoins:   spendCoins,
    addCoins:     addCoins,
    onChange:     onChange,
    formatDate:   formatDate,
    formatYen:    formatYen
  };

})();
