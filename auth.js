/**
 * auth.js — TAMSIC Cognito認証ライブラリ（PKCE + SDK カスタム属性コイン管理）
 * CDN: amazon-cognito-identity-js
 */

const AUTH_CONFIG = {
  region:       'ap-northeast-1',
  userPoolId:   'ap-northeast-1_vozRgCY5k',
  clientId:     '62e35ra0h4s2dr657euorlm5bu',
  domain:       'ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com',
  redirectUri:  'https://tamsic.tamjump.com/callback.html',
  logoutUri:    'https://tamsic.tamjump.com/',
  scopes:       'openid email profile',
};

/* ─── PKCE helpers ─── */
function _generateRandom(length = 64) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function _sha256(plain) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}
async function _generateCodeChallenge(verifier) {
  const h = await _sha256(verifier);
  return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

/* ─── Token storage ─── */
const STORAGE_KEYS = {
  accessToken:  'tamsic_access_token',
  idToken:      'tamsic_id_token',
  refreshToken: 'tamsic_refresh_token',
  expiry:       'tamsic_token_expiry',
  verifier:     'tamsic_pkce_verifier',
  state:        'tamsic_oauth_state',
};

function _saveTokens(t) {
  localStorage.setItem(STORAGE_KEYS.accessToken,  t.access_token  || '');
  localStorage.setItem(STORAGE_KEYS.idToken,      t.id_token      || '');
  localStorage.setItem(STORAGE_KEYS.refreshToken, t.refresh_token || '');
  localStorage.setItem(STORAGE_KEYS.expiry, String(Date.now() + (t.expires_in||3600)*1000));
}
function _clearTokens() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('tamsic_wallet_cache');
}

/* ─── 認証状態 ─── */
function isLoggedIn() {
  const token  = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiry = Number(localStorage.getItem(STORAGE_KEYS.expiry) || 0);
  return !!(token && Date.now() < expiry);
}
function getTokens() {
  return {
    accessToken:  localStorage.getItem(STORAGE_KEYS.accessToken),
    idToken:      localStorage.getItem(STORAGE_KEYS.idToken),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refreshToken),
  };
}
function getUserInfo() {
  const t = localStorage.getItem(STORAGE_KEYS.idToken);
  if (!t) return null;
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch { return null; }
}

/* ─── Cognito SDK: カスタム属性更新 ─── */
function _getCognitoUser() {
  if (!window.AmazonCognitoIdentity) return null;
  const poolData = { UserPoolId: AUTH_CONFIG.userPoolId, ClientId: AUTH_CONFIG.clientId };
  const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
  const idToken     = localStorage.getItem(STORAGE_KEYS.idToken);
  const refreshToken= localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!accessToken) return null;
  // ユーザー情報からemailを取得
  const info = getUserInfo();
  if (!info || !info.email) return null;
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: info.email,
    Pool: userPool
  });
  // 既存のセッションをセット
  const session = new AmazonCognitoIdentity.CognitoUserSession({
    IdToken:      new AmazonCognitoIdentity.CognitoIdToken({ IdToken: idToken }),
    AccessToken:  new AmazonCognitoIdentity.CognitoAccessToken({ AccessToken: accessToken }),
    RefreshToken: new AmazonCognitoIdentity.CognitoRefreshToken({ RefreshToken: refreshToken }),
  });
  cognitoUser.setSignInUserSession(session);
  return cognitoUser;
}

async function _updateUserAttributes(attrs) {
  return new Promise((resolve) => {
    const cognitoUser = _getCognitoUser();
    if (!cognitoUser) { resolve(false); return; }
    const attributeList = Object.entries(attrs).map(([Name, Value]) =>
      new AmazonCognitoIdentity.CognitoUserAttribute({ Name, Value })
    );
    cognitoUser.updateAttributes(attributeList, (err, result) => {
      if (err) { console.error('updateAttributes error:', err); resolve(false); }
      else { resolve(true); }
    });
  });
}

async function _fetchUserAttributesFromSDK() {
  return new Promise((resolve) => {
    const cognitoUser = _getCognitoUser();
    if (!cognitoUser) { resolve(null); return; }
    cognitoUser.getUserAttributes((err, attrs) => {
      if (err || !attrs) { resolve(null); return; }
      const obj = {};
      attrs.forEach(a => { obj[a.getName()] = a.getValue(); });
      resolve(obj);
    });
  });
}

/* ─── ウォレット管理 ─── */
async function _syncWalletFromCognito() {
  const attrs = await _fetchUserAttributesFromSDK();
  if (!attrs) return;
  let balance = 0, purchases = [];
  try { balance = parseInt(attrs['custom:coins'] || '0', 10); } catch {}
  try { purchases = JSON.parse(attrs['custom:purchases'] || '[]'); } catch {}
  const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
  local.balance = balance;
  local.purchases = purchases;
  localStorage.setItem('tamsic_wallet', JSON.stringify(local));
  localStorage.setItem('tamsic_wallet_cache', JSON.stringify({ balance, purchases, listens: local.listens||[] }));
  window.dispatchEvent(new CustomEvent('tamsic:coins-updated', {}));
}

async function loadWallet() {
  const cached = localStorage.getItem('tamsic_wallet_cache');
  if (cached) { try { return JSON.parse(cached); } catch {} }
  // SDKが使えない場合はlocalStorageから
  const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
  return { balance: local.balance||0, purchases: local.purchases||[], listens: local.listens||[] };
}

async function addCoinsToCognito(coins, meta) {
  const wallet = await loadWallet();
  wallet.balance = (wallet.balance||0) + coins;
  wallet.purchases = wallet.purchases || [];
  wallet.purchases.unshift({
    at: new Date().toISOString(), coins,
    packId: meta.packId||'', title: meta.title||'', priceYen: meta.priceYen||0
  });
  const ok = await _updateUserAttributes({
    'custom:coins':     String(wallet.balance),
    'custom:purchases': JSON.stringify(wallet.purchases),
  });
  localStorage.setItem('tamsic_wallet_cache', JSON.stringify(wallet));
  const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
  local.balance = wallet.balance; local.purchases = wallet.purchases;
  localStorage.setItem('tamsic_wallet', JSON.stringify(local));
  window.dispatchEvent(new CustomEvent('tamsic:coins-updated', { detail: wallet }));
  return ok ? wallet.balance : wallet.balance; // 失敗してもlocalには保存
}

async function spendCoinsOnCognito(cost, meta) {
  const wallet = await loadWallet();
  if ((wallet.balance||0) < cost) return false;
  wallet.balance -= cost;
  wallet.listens = wallet.listens || [];
  wallet.listens.unshift({
    at: new Date().toISOString(),
    trackId: meta.trackId||'', trackTitle: meta.trackTitle||'', coins: cost
  });
  await _updateUserAttributes({ 'custom:coins': String(wallet.balance) });
  localStorage.setItem('tamsic_wallet_cache', JSON.stringify(wallet));
  const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
  local.balance = wallet.balance; local.listens = wallet.listens;
  localStorage.setItem('tamsic_wallet', JSON.stringify(local));
  window.dispatchEvent(new CustomEvent('tamsic:coins-updated', { detail: wallet }));
  return true;
}

/* ─── Cognito ナビゲーション ─── */
async function cognitoLogin() {
  const verifier = _generateRandom(64), state = _generateRandom(16);
  const challenge = await _generateCodeChallenge(verifier);
  localStorage.setItem(STORAGE_KEYS.verifier, verifier);
  localStorage.setItem(STORAGE_KEYS.state, state);
  const _lang = localStorage.getItem('tamsic_lang') || 'ja';
  const params = new URLSearchParams({
    response_type:'code', client_id: AUTH_CONFIG.clientId,
    redirect_uri: AUTH_CONFIG.redirectUri, scope: AUTH_CONFIG.scopes,
    state, code_challenge: challenge, code_challenge_method:'S256', ui_locales: _lang
  });
  window.location.href = `https://${AUTH_CONFIG.domain}/oauth2/authorize?${params}`;
}
async function cognitoSignup() {
  const verifier = _generateRandom(64), state = _generateRandom(16);
  const challenge = await _generateCodeChallenge(verifier);
  localStorage.setItem(STORAGE_KEYS.verifier, verifier);
  localStorage.setItem(STORAGE_KEYS.state, state);
  const _lang = localStorage.getItem('tamsic_lang') || 'ja';
  const params = new URLSearchParams({
    response_type:'code', client_id: AUTH_CONFIG.clientId,
    redirect_uri: AUTH_CONFIG.redirectUri, scope: AUTH_CONFIG.scopes,
    state, code_challenge: challenge, code_challenge_method:'S256'
  });
  window.location.href = `https://${AUTH_CONFIG.domain}/signup?${params}&ui_locales=${_lang}`;
}
function cognitoLogout() {
  _clearTokens();
  const params = new URLSearchParams({ client_id: AUTH_CONFIG.clientId, logout_uri: AUTH_CONFIG.logoutUri });
  window.location.href = `https://${AUTH_CONFIG.domain}/logout?${params}`;
}
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code'), state = params.get('state'), error = params.get('error');
  if (error) return false;
  const savedState = localStorage.getItem(STORAGE_KEYS.state);
  const codeVerifier = localStorage.getItem(STORAGE_KEYS.verifier);
  if (!code || !codeVerifier || state !== savedState) return false;
  const body = new URLSearchParams({
    grant_type:'authorization_code', client_id: AUTH_CONFIG.clientId,
    code, redirect_uri: AUTH_CONFIG.redirectUri, code_verifier: codeVerifier
  });
  try {
    const res = await fetch(`https://${AUTH_CONFIG.domain}/oauth2/token`, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString()
    });
    if (!res.ok) return false;
    _saveTokens(await res.json());
    localStorage.removeItem(STORAGE_KEYS.verifier);
    localStorage.removeItem(STORAGE_KEYS.state);
    // SDKロード後に同期
    setTimeout(() => _syncWalletFromCognito(), 1000);
    return true;
  } catch { return false; }
}
