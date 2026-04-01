/**
 * coins.js — TAMSIC コイン管理ライブラリ（localStorage永続）
 * auth.jsのsessionStorage版を置き換える。ブラウザを閉じても残高が消えない。
 */
(function() {

  const WALLET_KEY = 'tamsic_wallet';

  function _load() {
    try {
      const raw = localStorage.getItem(WALLET_KEY);
      if (!raw) return { balance: 0, purchases: [], listens: [] };
      return JSON.parse(raw);
    } catch(e) {
      return { balance: 0, purchases: [], listens: [] };
    }
  }

  function _save(wallet) {
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    // 他のタブ・ページにも通知
    window.dispatchEvent(new CustomEvent('tamsic:coins-updated', { detail: wallet }));
  }

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
   * コイン加算（購入確定時に呼ぶ）
   * @param {number} coins
   * @param {object} meta - { packId, title, priceYen }
   */
  function addCoins(coins, meta) {
    const wallet = _load();
    wallet.balance = (wallet.balance || 0) + coins;
    wallet.purchases = wallet.purchases || [];
    wallet.purchases.unshift({
      at:       new Date().toISOString(),
      coins:    coins,
      packId:   meta.packId   || '',
      title:    meta.title    || '',
      priceYen: meta.priceYen || 0,
    });
    _save(wallet);
    return wallet.balance;
  }

  /**
   * コイン消費（楽曲再生時に呼ぶ）
   * @param {number} cost
   * @param {object} meta - { trackId, trackTitle }
   * @returns {boolean} 成功/失敗
   */
  function spendCoins(cost, meta) {
    const wallet = _load();
    if ((wallet.balance || 0) < cost) return false;
    wallet.balance -= cost;
    wallet.listens = wallet.listens || [];
    wallet.listens.unshift({
      at:         new Date().toISOString(),
      trackId:    meta.trackId    || '',
      trackTitle: meta.trackTitle || '',
      coins:      cost,
    });
    _save(wallet);
    return true;
  }

  /**
   * 日時フォーマット
   */
  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch(e) { return '—'; }
  }

  /**
   * 金額フォーマット
   */
  function formatYen(n) {
    return `¥${Number(n||0).toLocaleString('ja-JP')}`;
  }

  window.TAMSICCoins = { getBalance, getPurchases, getListens, addCoins, spendCoins, formatDate, formatYen };

})();
