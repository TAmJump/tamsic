function renderMypage(){
  const user = TAMSICAuth.requireAuth();
  if (!user) return;
  const wallet = TAMSICAuth.getCoinState();
  const intents = TAMSICAuth.getPurchaseIntents();
  document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = user.email);
  document.querySelectorAll('[data-wallet-balance]').forEach(el => el.textContent = (wallet.balance || 0).toLocaleString('ja-JP'));
  document.querySelectorAll('[data-wallet-bonus]').forEach(el => el.textContent = wallet.firstVisitAwarded ? '付与済み' : '未付与');

  const purchaseTable = document.getElementById('purchase-history-body');
  const purchases = wallet.purchases || [];
  if (!purchases.length) {
    purchaseTable.innerHTML = `<tr><td colspan="4"><div class="inline-empty">購入履歴はまだありません。購入後にこのページへ戻ると、反映履歴をここで確認できます。</div></td></tr>`;
  } else {
    purchaseTable.innerHTML = purchases.map(item => `<tr>
      <td>${TAMSICAuth.formatDate(item.at)}</td>
      <td>${item.coins} coin</td>
      <td>${TAMSICAuth.formatYen(item.priceYen)}</td>
      <td><span class="badge ok">reflected</span></td>
    </tr>`).join('');
  }

  const listenTable = document.getElementById('listen-history-body');
  const listens = wallet.listens || [];
  if (!listens.length) {
    listenTable.innerHTML = `<tr><td colspan="3"><div class="inline-empty">再生履歴はまだありません。</div></td></tr>`;
  } else {
    listenTable.innerHTML = listens.map(item => `<tr>
      <td>${TAMSICAuth.formatDate(item.at)}</td>
      <td>${item.trackId}</td>
      <td>${item.coins} coin</td>
    </tr>`).join('');
  }

  const pendingWrap = document.getElementById('pending-intents');
  const pending = intents.filter(x => x.status === 'pending');
  if (!pending.length) {
    pendingWrap.innerHTML = `<div class="inline-empty">購入後にこのページへ戻ると、反映待ちの購入リクエストをここで確認できます。</div>`;
  } else {
    pendingWrap.innerHTML = `<div class="table-wrap flush"><table class="table"><thead><tr><th>作成日時</th><th>内容</th><th>状態</th></tr></thead><tbody>${pending.map(item => `<tr>
      <td>${TAMSICAuth.formatDate(item.createdAt)}</td>
      <td>${item.title} / ${item.coins} coin / ${TAMSICAuth.formatYen(item.priceYen)}</td>
      <td><span class="badge pending">pending</span></td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  const packs = Object.values(window.TAMSIC_PAYMENT_LINKS || {});
  const purchaseGrid = document.getElementById('purchase-grid');
  purchaseGrid.innerHTML = packs.map((pack, index) => `<div class="purchase-card ${index===1?'featured':''}">
    <div class="purchase-label">${pack.label}</div>
    <div class="purchase-coins">${pack.coins}<span style="font-size:18px;font-family:'Jost',sans-serif;font-weight:400;"> coin</span></div>
    <div class="purchase-price">${TAMSICAuth.formatYen(pack.priceYen)}</div>
    <div class="purchase-note">Square決済ページへ遷移します。購入後は My Page に戻って残高と履歴を確認できます。</div>
    <button class="btn-primary" type="button" onclick="startPurchase('${pack.id}')">Squareで購入</button>
  </div>`).join('');
}

function startPurchase(packId){
  const pack = (window.TAMSIC_PAYMENT_LINKS && window.TAMSIC_PAYMENT_LINKS[packId]) || null;
  const user = TAMSICAuth.getCurrentUser();
  if (!pack || !user) return;
  TAMSICAuth.createPurchaseIntent({
    userId: user.id,
    email: user.email,
    packId: pack.id,
    title: pack.title,
    coins: pack.coins,
    priceYen: pack.priceYen,
    link: pack.url
  });
  const note = document.getElementById('purchase-note');
  if (note) {
    note.innerHTML = `<strong>Square決済ページを新しいタブで開きました。</strong> 決済完了後はこのマイページに戻り、残高・購入履歴・反映待ち一覧を確認してください。`;
  }
  window.open(pack.url, '_blank', 'noopener');
  renderMypage();
}

function handleLogout(){
  TAMSICAuth.logout();
  location.href = 'login.html';
}

function toggleAccordion(name){
  const el = document.querySelector(`[data-accordion="${name}"]`);
  if (!el) return;
  el.classList.toggle('is-open');
}

document.addEventListener('DOMContentLoaded', renderMypage);
window.addEventListener('storage', renderMypage);
window.addEventListener('tamsic:coins-updated', renderMypage);
