
const TAMSIC_AUTH_USERS_KEY = 'TAMSIC_AUTH_USERS_V1';
const TAMSIC_AUTH_SESSION_KEY = 'TAMSIC_AUTH_SESSION_V1';
const TAMSIC_RESET_TOKENS_KEY = 'TAMSIC_AUTH_RESET_TOKENS_V1';
const TAMSIC_PURCHASE_INTENTS_KEY = 'TAMSIC_PURCHASE_INTENTS_V1';
const TAMSIC_COIN_WALLETS_KEY = 'TAMSIC_COIN_WALLETS_V2';
const TAMSIC_LEGACY_COIN_STATE_KEY = 'TAMSIC_COIN_STATE_V1';

function authNowIso(){ return new Date().toISOString(); }
function authUid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function authRead(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch(e){
    return fallback;
  }
}
function authWrite(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
function getAuthUsers(){ return authRead(TAMSIC_AUTH_USERS_KEY, []); }
function saveAuthUsers(users){ return authWrite(TAMSIC_AUTH_USERS_KEY, users); }
function getAuthSession(){ return authRead(TAMSIC_AUTH_SESSION_KEY, null); }
function setAuthSession(session){ return authWrite(TAMSIC_AUTH_SESSION_KEY, session); }
function clearAuthSession(){ localStorage.removeItem(TAMSIC_AUTH_SESSION_KEY); }
function getPurchaseIntents(){ return authRead(TAMSIC_PURCHASE_INTENTS_KEY, []); }
function savePurchaseIntents(items){ return authWrite(TAMSIC_PURCHASE_INTENTS_KEY, items); }
function getResetTokens(){ return authRead(TAMSIC_RESET_TOKENS_KEY, []); }
function saveResetTokens(items){ return authWrite(TAMSIC_RESET_TOKENS_KEY, items); }
function defaultWalletState(){
  return { balance: 100, firstVisitAwarded: true, awardedAt: authNowIso(), purchases: [], listens: [] };
}
function getWalletStore(){ return authRead(TAMSIC_COIN_WALLETS_KEY, {}); }
function saveWalletStore(store){ return authWrite(TAMSIC_COIN_WALLETS_KEY, store); }
function getCoinState(){
  const fallback = defaultWalletState();
  const user = getCurrentAuthUser();
  if (!user) return { balance: 0, firstVisitAwarded: false, awardedAt: null, purchases: [], listens: [] };
  const store = getWalletStore();
  if (!store[user.id]) {
    const legacy = authRead(TAMSIC_LEGACY_COIN_STATE_KEY, null);
    if (legacy && typeof legacy.balance === 'number' && Object.keys(store).length === 0) {
      store[user.id] = legacy;
      localStorage.removeItem(TAMSIC_LEGACY_COIN_STATE_KEY);
    } else {
      store[user.id] = fallback;
    }
    saveWalletStore(store);
  }
  const wallet = store[user.id];
  return {
    balance: Number(wallet.balance || 0),
    firstVisitAwarded: !!wallet.firstVisitAwarded,
    awardedAt: wallet.awardedAt || null,
    purchases: Array.isArray(wallet.purchases) ? wallet.purchases : [],
    listens: Array.isArray(wallet.listens) ? wallet.listens : []
  };
}
function setCoinState(state){
  const user = getCurrentAuthUser();
  if (!user) return state;
  const store = getWalletStore();
  store[user.id] = state;
  return saveWalletStore(store);
}
function normalizeEmail(v){ return String(v||'').trim().toLowerCase(); }
function fakeHash(v){ return btoa(unescape(encodeURIComponent(`tamsic::${String(v||'')}`))); }
function findUserByEmail(email){ return getAuthUsers().find(u => u.email === normalizeEmail(email)); }

function registerAuthUser(email, password){
  const users = getAuthUsers();
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return { ok:false, message:'メールアドレスとパスワードを入力してください。' };
  if (users.some(u => u.email === normalized)) return { ok:false, message:'このメールアドレスはすでに登録されています。' };
  const user = { id: authUid('user'), email: normalized, passwordHash: fakeHash(password), createdAt: authNowIso() };
  users.push(user);
  saveAuthUsers(users);
  setAuthSession({ userId: user.id, email: user.email, loggedInAt: authNowIso() });
  ensureWallet();
  return { ok:true, user };
}

function loginAuthUser(email, password){
  const normalized = normalizeEmail(email);
  const user = findUserByEmail(normalized);
  if (!user) return { ok:false, message:'登録済みのメールアドレスが見つかりません。' };
  if (user.passwordHash !== fakeHash(password)) return { ok:false, message:'パスワードが違います。' };
  setAuthSession({ userId: user.id, email: user.email, loggedInAt: authNowIso() });
  ensureWallet();
  return { ok:true, user };
}

function logoutAuthUser(){ clearAuthSession(); }
function getCurrentAuthUser(){
  const session = getAuthSession();
  if (!session || !session.userId) return null;
  return getAuthUsers().find(u => u.id === session.userId) || null;
}
function requireAuthPage(){
  const user = getCurrentAuthUser();
  if (!user) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash);
    location.href = `login.html?next=${next}`;
    return null;
  }
  return user;
}
function getQueryParam(name){ return new URLSearchParams(location.search).get(name); }
function getPostLoginTarget(){ return getQueryParam('next') || 'mypage.html'; }
function goAfterAuth(){ location.href = getPostLoginTarget(); }
function ensureWallet(){
  const user = getCurrentAuthUser();
  if (!user) return;
  const store = getWalletStore();
  if (!store[user.id]) {
    store[user.id] = defaultWalletState();
    saveWalletStore(store);
  }
}
function createResetFlow(email){
  const user = findUserByEmail(email);
  if (!user) return { ok:false, message:'登録済みのメールアドレスが見つかりません。' };
  const items = getResetTokens().filter(x => x.userId !== user.id);
  const token = authUid('reset');
  items.push({ token, userId: user.id, email: user.email, createdAt: authNowIso(), used:false });
  saveResetTokens(items);
  return { ok:true, token, link:`reset-password.html?token=${encodeURIComponent(token)}` };
}
function resetPasswordWithToken(token, password){
  const items = getResetTokens();
  const row = items.find(x => x.token === token && !x.used);
  if (!row) return { ok:false, message:'この再設定リンクは無効です。' };
  const users = getAuthUsers();
  const user = users.find(u => u.id === row.userId);
  if (!user) return { ok:false, message:'ユーザーが見つかりません。' };
  user.passwordHash = fakeHash(password);
  user.updatedAt = authNowIso();
  row.used = true;
  row.usedAt = authNowIso();
  saveAuthUsers(users);
  saveResetTokens(items);
  return { ok:true };
}
function createPurchaseIntent(pack){
  const user = getCurrentAuthUser();
  if (!user) return null;
  const items = getPurchaseIntents();
  const intent = {
    id: authUid('intent'),
    userId: user.id,
    email: user.email,
    packId: pack.id,
    title: pack.title,
    coins: Number(pack.coins || 0),
    priceYen: Number(pack.priceYen || 0),
    squareUrl: pack.url,
    status: 'pending',
    createdAt: authNowIso()
  };
  items.unshift(intent);
  savePurchaseIntents(items);
  return intent;
}
function getCurrentUserPurchaseIntents(){
  const user = getCurrentAuthUser();
  if (!user) return [];
  return getPurchaseIntents().filter(x => x.userId === user.id);
}
function markIntentNoted(intentId){
  const items = getPurchaseIntents();
  const row = items.find(x => x.id === intentId);
  if (row && row.status === 'pending') {
    row.notedAt = authNowIso();
    savePurchaseIntents(items);
  }
}
function formatYen(v){ return `¥${Number(v||0).toLocaleString('ja-JP')}`; }
function formatDate(v){
  try { return new Date(v).toLocaleString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch(e){ return v || ''; }
}
window.TAMSICAuth = {
  getUsers:getAuthUsers,
  getSession:getAuthSession,
  getCurrentUser:getCurrentAuthUser,
  isLoggedIn:() => !!getCurrentAuthUser(),
  register:registerAuthUser,
  login:loginAuthUser,
  logout:logoutAuthUser,
  requireAuth:requireAuthPage,
  getPostLoginTarget,
  goAfterAuth,
  createResetFlow,
  resetPasswordWithToken,
  createPurchaseIntent,
  getPurchaseIntents:getCurrentUserPurchaseIntents,
  markIntentNoted,
  getCoinState,
  setCoinState,
  formatYen,
  formatDate
};
