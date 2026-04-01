/**
 * auth.js — TAMSIC Cognito認証ライブラリ（PKCE + カスタム属性コイン管理）
 * User Pool ID : ap-northeast-1_vozRgCY5k
 * Client ID    : 62e35ra0h4s2dr657euorlm5bu
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

/* ─── Cognito UserInfo / UpdateUserAttributes ─── */
async function _fetchUserAttributes() {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (!token) return null;
  try {
    const res = await fetch(`https://${AUTH_CONFIG.domain}/oauth2/userInfo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function _updateUserAttributes(attrs) {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (!token) return false;
  try {
    const res = await fetch(
      `https://cognito-idp.${AUTH_CONFIG.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AmazonCognitoIdentityProvider.UpdateUserAttributes',
        },
        body: JSON.stringify({
          AccessToken: token,
          UserAttributes: Object.entries(attrs).map(([Name, Value]) => ({ Name, Value })),
        }),
      }
    );
    return res.ok;
  } catch { return false; }
}

/* ─── ウォレット同期 ─── */
async function _syncWalletFromCognito() {
  const attrs = await _fetchUserAttributes();
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
  const attrs = await _fetchUserAttributes();
  if (!attrs) {
    const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
    return { balance: local.balance||0, purchases: local.purchases||[], listens: local.listens||[] };
  }
  let balance = 0, purchases = [];
  try { balance = parseInt(attrs['custom:coins'] || '0', 10); } catch {}
  try { purchases = JSON.parse(attrs['custom:purchases'] || '[]'); } catch {}
  const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
  const wallet = { balance, purchases, listens: local.listens||[] };
  localStorage.setItem('tamsic_wallet_cache', JSON.stringify(wallet));
  return wallet;
}

async function addCoinsToCognito(coins, meta) {
  const wallet = await loadWallet();
  wallet.balance = (wallet.balance||0) + coins;
  wallet.purchases = wallet.purchases || [];
  wallet.purchases.unshift({ at: new Date().toISOString(), coins, packId: meta.packId||'', title: meta.title||'', priceYen: meta.priceYen||0 });
  const ok = await _updateUserAttributes({
    'custom:coins':     String(wallet.balance),
    'custom:purchases': JSON.stringify(wallet.purchases),
  });
  localStorage.setItem('tamsic_wallet_cache', JSON.stringify(wallet));
  const local = JSON.parse(localStorage.getItem('tamsic_wallet') || '{}');
  local.balance = wallet.balance; local.purchases = wallet.purchases;
  localStorage.setItem('tamsic_wallet', JSON.stringify(local));
  window.dispatchEvent(new CustomEvent('tamsic:coins-updated', { detail: wallet }));
  return ok ? wallet.balance : null;
}

async function spendCoinsOnCognito(cost, meta) {
  const wallet = await loadWallet();
  if ((wallet.balance||0) < cost) return false;
  wallet.balance -= cost;
  wallet.listens = wallet.listens || [];
  wallet.listens.unshift({ at: new Date().toISOString(), trackId: meta.trackId||'', trackTitle: meta.trackTitle||'', coins: cost });
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
  const params = new URLSearchParams({ response_type:'code', client_id: AUTH_CONFIG.clientId, redirect_uri: AUTH_CONFIG.redirectUri, scope: AUTH_CONFIG.scopes, state, code_challenge: challenge, code_challenge_method:'S256', ui_locales: _lang });
  window.location.href = `https://${AUTH_CONFIG.domain}/oauth2/authorize?${params}`;
}
async function cognitoSignup() {
  const verifier = _generateRandom(64), state = _generateRandom(16);
  const challenge = await _generateCodeChallenge(verifier);
  localStorage.setItem(STORAGE_KEYS.verifier, verifier);
  localStorage.setItem(STORAGE_KEYS.state, state);
  const _lang = localStorage.getItem('tamsic_lang') || 'ja';
  const params = new URLSearchParams({ response_type:'code', client_id: AUTH_CONFIG.clientId, redirect_uri: AUTH_CONFIG.redirectUri, scope: AUTH_CONFIG.scopes, state, code_challenge: challenge, code_challenge_method:'S256' });
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
  const body = new URLSearchParams({ grant_type:'authorization_code', client_id: AUTH_CONFIG.clientId, code, redirect_uri: AUTH_CONFIG.redirectUri, code_verifier: codeVerifier });
  try {
    const res = await fetch(`https://${AUTH_CONFIG.domain}/oauth2/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
    if (!res.ok) return false;
    _saveTokens(await res.json());
    localStorage.removeItem(STORAGE_KEYS.verifier);
    localStorage.removeItem(STORAGE_KEYS.state);
    await _syncWalletFromCognito();
    return true;
  } catch { return false; }
}
