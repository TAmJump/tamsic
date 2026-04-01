// 言語ヘルパー
function _L(ja, en){ return (window.TAMSICLang && window.TAMSICLang.get()==='en') ? en : ja; }

/**
 * mypage.js — TAMSIC マイページ制御
 * coins.js（localStorage）+ auth.js（Cognito）対応版
 */

/* ─── 認証チェック ─── */
document.addEventListener('DOMContentLoaded', function() {
  if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  renderMypage();
});

window.addEventListener('tamsic:coins-updated', renderMypage);

/* ─── メイン描画 ─── */
function renderMypage() {
  // ユーザー情報
  if (typeof getUserInfo === 'function') {
    const info = getUserInfo();
    if (info) {
      document.querySelectorAll('[data-user-email]').forEach(el => {
        el.textContent = info.email || info.sub || 'member';
      });
    }
  }

  // コイン残高
  const balance = typeof TAMSICCoins !== 'undefined' ? TAMSICCoins.getBalance() : 0;
  document.querySelectorAll('[data-wallet-balance]').forEach(el => {
    el.textContent = balance.toLocaleString('ja-JP');
  });

  // 購入履歴
  renderPurchaseHistory();

  // 再生履歴
  renderListenHistory();

  // 購入パック
  renderPurchaseGrid();

  // Pending（購入処理中）の表示
  renderPending();

  // 動的生成されたdata-ja/en要素に翻訳を再適用
  if(window.TAMSICLang) window.TAMSICLang.apply(window.TAMSICLang.get());
}

/* ─── 購入履歴テーブル ─── */
function renderPurchaseHistory() {
  const tbody = document.getElementById('purchase-history-body');
  if (!tbody) return;
  const purchases = typeof TAMSICCoins !== 'undefined' ? TAMSICCoins.getPurchases() : [];
  if (!purchases.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="inline-empty">${_L("購入履歴はまだありません。","No purchase history yet.")}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = purchases.map(item => `<tr>
    <td>${TAMSICCoins.formatDate(item.at)}</td>
    <td>${item.title || item.packId} / ${item.coins} coin</td>
    <td>${TAMSICCoins.formatYen(item.priceYen)}</td>
    <td><span class="badge ok">${_L("反映済み","Reflected")}</span></td>
  </tr>`).join('');
}

/* ─── 再生履歴テーブル ─── */
function renderListenHistory() {
  const tbody = document.getElementById('listen-history-body');
  if (!tbody) return;
  const listens = typeof TAMSICCoins !== 'undefined' ? TAMSICCoins.getListens() : [];
  if (!listens.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="inline-empty">${_L("再生履歴はまだありません。","No play history yet.")}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = listens.map(item => `<tr>
    <td>${TAMSICCoins.formatDate(item.at)}</td>
    <td>${item.trackTitle || item.trackId}</td>
    <td>${item.coins} coin</td>
  </tr>`).join('');
}

/* ─── 購入パックグリッド ─── */
function renderPurchaseGrid() {
  const grid = document.getElementById('purchase-grid');
  if (!grid || typeof window.TAMSIC_PAYMENT_LINKS === 'undefined') return;
  const packs = Object.values(window.TAMSIC_PAYMENT_LINKS);
  grid.innerHTML = packs.map((pack, i) => `
    <div class="purchase-card ${i === 1 ? 'featured' : ''}">
      <div class="purchase-label" data-ja="${pack.label}" data-en="${pack.labelEn||pack.label}">${pack.label}</div>
      <div class="purchase-coins">${pack.coins}<span style="font-size:18px;font-family:'Jost',sans-serif;font-weight:400;"> coin</span></div>
      <div class="purchase-price">${TAMSICCoins.formatYen(pack.priceYen)}</div>
      <div class="purchase-note" data-ja="Squareで決済後、購入を反映するボタンで残高に加算されます。" data-en="After Square checkout, click Confirm purchase to add coins.">Squareで決済後、購入を反映するボタンで残高に加算されます。</div>
      <button class="btn-primary" type="button" onclick="startPurchase('${pack.id}')" data-ja="Squareで購入" data-en="Buy on Square">Squareで購入</button>
    </div>
  `).join('');
}

/* ─── Pending表示（購入処理中） ─── */
function renderPending() {
  const wrap = document.getElementById('pending-intents');
  if (!wrap) return;
  const pending = JSON.parse(localStorage.getItem('tamsic_pending_purchase') || 'null');
  if (!pending) {
    wrap.innerHTML = `<div class="inline-empty">${_L("現在、反映待ちの購入はありません。","No purchases awaiting confirmation.")}</div>`;
    return;
  }
  wrap.innerHTML = `
    <div style="padding:20px;border:1px solid var(--accent, #C4960E);border-radius:8px;background:rgba(196,150,14,0.05);">
      <p style="font-size:13px;margin-bottom:12px;">
        <strong>${pending.title} / ${pending.coins} coin / ${TAMSICCoins.formatYen(pending.priceYen)}</strong><br>
        <span style="font-size:11px;color:#7A7A72;">Square決済を完了しましたか？完了したら下のボタンで残高に反映してください。</span>
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-primary" onclick="confirmPurchase()" style="background:#C4960E;">
          ${_L("✓ 購入を反映する","✓ Confirm purchase")}
        </button>
        <button onclick="cancelPurchase()" style="background:none;border:1px solid #ccc;padding:8px 16px;cursor:pointer;font-size:12px;border-radius:4px;color:#7A7A72;">
          ${_L("キャンセル","Cancel")}
        </button>
      </div>
    </div>
  `;
}

/* ─── 購入開始（Square新タブ → 反映待ちを記録） ─── */
function startPurchase(packId) {
  const pack = window.TAMSIC_PAYMENT_LINKS && window.TAMSIC_PAYMENT_LINKS[packId];
  if (!pack) return;

  // 反映待ちをlocalStorageに記録
  localStorage.setItem('tamsic_pending_purchase', JSON.stringify({
    packId:   pack.id,
    title:    pack.title,
    coins:    pack.coins,
    priceYen: pack.priceYen,
    startedAt: new Date().toISOString(),
  }));

  // Squareを新タブで開く
  window.open(pack.url, '_blank', 'noopener');

  // pending セクションを開いて表示
  const pendingAccordion = document.querySelector('[data-accordion="pending"]');
  if (pendingAccordion && !pendingAccordion.classList.contains('is-open')) {
    pendingAccordion.classList.add('is-open');
  }

  const note = document.getElementById('purchase-note');
  if (note) {
    note.innerHTML = `${_L("<strong>Squareの決済ページを新しいタブで開きました。</strong><br>決済完了後、\u300cPending purchase intent\u300dの\u300c購入を反映する\u300dボタンを押してください。","<strong>Square checkout opened in a new tab.</strong><br>After payment, click \"Confirm purchase\" in Pending.")}`;
    note.style.display = 'block';
  }

  renderPending();
}

/* ─── 購入確定（コイン加算 + 履歴保存） ─── */
function confirmPurchase() {
  const pending = JSON.parse(localStorage.getItem('tamsic_pending_purchase') || 'null');
  if (!pending) return;

  // コイン加算
  const newBalance = TAMSICCoins.addCoins(pending.coins, {
    packId:   pending.packId,
    title:    pending.title,
    priceYen: pending.priceYen,
  });

  // pending削除
  localStorage.removeItem('tamsic_pending_purchase');

  // 購入履歴アコーディオンを開く
  const purchaseAccordion = document.querySelector('[data-accordion="purchase"]');
  if (purchaseAccordion && !purchaseAccordion.classList.contains('is-open')) {
    purchaseAccordion.classList.add('is-open');
  }

  const note = document.getElementById('purchase-note');
  if (note) {
    note.innerHTML = `<strong style="color:#2a8a2a;">${_L("✓ "+pending.coins+" coin を残高に反映しました！","✓ "+pending.coins+" coins added to your balance!")}</strong> ${_L("現在の残高:","Balance:")} ${newBalance.toLocaleString("ja-JP")} coin`;
    note.style.display = 'block';
  }

  renderMypage();
}

/* ─── 購入キャンセル ─── */
function cancelPurchase() {
  if (confirm(_L('購入リクエストをキャンセルしますか？（決済済みの場合は反映されません）','Cancel this purchase request?'))) {
    localStorage.removeItem('tamsic_pending_purchase');
    renderPending();
  }
}

/* ─── ログアウト ─── */
function handleLogout() {
  if (typeof cognitoLogout === 'function') {
    cognitoLogout();
  } else {
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
}

/* ─── アコーディオン ─── */
function toggleAccordion(name) {
  const el = document.querySelector(`[data-accordion="${name}"]`);
  if (el) el.classList.toggle('is-open');
}
