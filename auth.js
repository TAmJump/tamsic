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
  // refresh_token は refresh API のレスポンスに含まれない場合がある → 既存値を保持
  if (t.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, t.refresh_token);
  }
  localStorage.setItem(STORAGE_KEYS.expiry, String(Date.now() + (t.expires_in||3600)*1000));
}
function _clearTokens() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('tamsic_wallet_cache');
}

/* ─── トークン自動更新 (v4.2) ─── */
let _refreshInFlight = null;

async function _refreshTokens() {
  if (_refreshInFlight) return _refreshInFlight;

  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return false;

  _refreshInFlight = (async () => {
    try {
      const body = new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     AUTH_CONFIG.clientId,
        refresh_token: refreshToken
      });
      const res = await fetch(`https://${AUTH_CONFIG.domain}/oauth2/token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString()
      });
      if (!res.ok) {
        console.warn('[auth] refresh failed:', res.status);
        // refresh_token が失効 (revoked/expired) → 完全クリアしてログイン画面誘導の準備
        if (res.status === 400 || res.status === 401) _clearTokens();
        return false;
      }
      const data = await res.json();
      _saveTokens(data);
      window.dispatchEvent(new CustomEvent('tamsic:token-refreshed'));
      _scheduleNextRefresh();
      return true;
    } catch (e) {
      console.warn('[auth] refresh network error:', e);
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

// 期限の 5 分前に自動リフレッシュをスケジュール (長時間タブを開きっぱなし対応)
let _refreshTimer = null;
function _scheduleNextRefresh() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  const expiry = Number(localStorage.getItem(STORAGE_KEYS.expiry) || 0);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken || !expiry) return;
  const msUntil = expiry - Date.now() - 5*60*1000;
  if (msUntil <= 0) return; // 今すぐリフレッシュは ensureFresh が拾う
  _refreshTimer = setTimeout(_refreshTokens, msUntil);
}

// ページロード時: 期限切れまたは間近 (1分以内) なら同期的に更新を試みる
async function _ensureFreshTokenOnLoad() {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiry = Number(localStorage.getItem(STORAGE_KEYS.expiry) || 0);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return;                         // 未ログイン (or 完全失効後)
  if (token && Date.now() < expiry - 60*1000) {      // まだ十分新鮮 → スケジューリング + 残高同期
    _scheduleNextRefresh();
    // v4.2.2.4: トークン新鮮時でも Cognito から残高を取り直す。
    // 別端末で TAmJump 等が直接付与した coin / purchases を反映するため。
    // これがないとログイン後の wallet が localStorage 初期値 0 のまま表示される (iPhone Safari/Chrome で再現)。
    if (typeof _syncWalletFromCognito === 'function') {
      setTimeout(() => _syncWalletFromCognito(), 300);
    }
    return;
  }
  // 期限切れ / 間近 → 即更新
  const ok = await _refreshTokens();
  if (ok && typeof _syncWalletFromCognito === 'function') {
    setTimeout(() => _syncWalletFromCognito(), 300);
  }
}

// auto-trigger
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _ensureFreshTokenOnLoad);
  } else {
    _ensureFreshTokenOnLoad();
  }
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
      if (err) {
        // Phase D 未完了時は schema に custom 属性が無いので InvalidParameterException が出る。
        // これは期待される失敗 (User Pool 側を整備すれば自然に解消) なので silent に false 返却。
        const msg = String(err && (err.message || err.code) || err);
        const isSchemaErr = /Attribute does not exist|InvalidParameterException/i.test(msg);
        if (!isSchemaErr) console.warn('[auth] updateAttributes:', msg);
        resolve(false);
      } else {
        resolve(true);
      }
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
    // SDKロード後に同期 + 初回ログイン時の registeredAt セット
    setTimeout(() => {
      _syncWalletFromCognito();
      _ensureRegisteredAt();
    }, 1000);
    return true;
  } catch { return false; }
}

/* ─── レター関連: nickname / birthday / registeredAt / letterHistory (v4.2.1) ─── */

/**
 * Cognito custom属性をまとめて取得 (キャッシュなし、最新値)
 * 返り値: { nickname, birthday, registeredAt, letterHistory: [...] }
 */
async function fetchUserProfile() {
  const attrs = await _fetchUserAttributesFromSDK();
  if (!attrs) return null;
  let history = [];
  try { history = JSON.parse(attrs['custom:letterHistory'] || '[]'); }
  catch { history = []; }
  return {
    sub:           attrs.sub || '',
    email:         attrs.email || '',
    nickname:      attrs['custom:nickname']     || '',
    birthday:      attrs['custom:birthday']     || '',
    registeredAt:  attrs['custom:registeredAt'] || '',
    letterHistory: history
  };
}

async function setUserNickname(nickname) {
  const v = String(nickname || '').slice(0, 40);
  return _updateUserAttributes({ 'custom:nickname': v });
}

async function setUserBirthday(yyyymmdd) {
  // YYYY-MM-DD
  if (yyyymmdd && !/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) return false;
  return _updateUserAttributes({ 'custom:birthday': String(yyyymmdd || '') });
}

/** 初回ログイン時に registeredAt が空ならセット */
async function _ensureRegisteredAt() {
  try {
    const attrs = await _fetchUserAttributesFromSDK();
    if (!attrs) return;
    if (!attrs['custom:registeredAt']) {
      const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
      await _updateUserAttributes({ 'custom:registeredAt': today });
    }
  } catch (e) {}
}

/**
 * letterHistory に1件追加 (FIFO 上限 10件)
 * Cognito custom属性は 2048文字上限のため 10件超えたら古い順に削除
 */
async function appendLetterHistory(entry) {
  const profile = await fetchUserProfile();
  if (!profile) return false;
  const history = Array.isArray(profile.letterHistory) ? profile.letterHistory : [];
  const newEntry = {
    trackId:       String(entry.trackId || ''),
    frameId:       String(entry.frameId || ''),
    closingIdx:    Number(entry.closingIdx) || 0,
    closingPool:   String(entry.closingPool || ''),
    sentDate:      entry.sentDate || new Date().toISOString(),
    recipientHash: String(entry.recipientHash || '')
  };
  history.unshift(newEntry);
  // 上限10件 (FIFO) — 古い順に削除
  const capped = history.slice(0, 10);
  return _updateUserAttributes({
    'custom:letterHistory': JSON.stringify(capped)
  });
}

/** その曲のレターをすでに受け取っているか */
async function hasReceivedLetter(trackId) {
  if (!trackId) return false;
  const profile = await fetchUserProfile();
  if (!profile || !Array.isArray(profile.letterHistory)) return false;
  return profile.letterHistory.some(h => h.trackId === trackId);
}

// 公開
window.TAMSICAuth = window.TAMSICAuth || {};
window.TAMSICAuth.fetchUserProfile    = fetchUserProfile;
window.TAMSICAuth.setUserNickname     = setUserNickname;
window.TAMSICAuth.setUserBirthday     = setUserBirthday;
window.TAMSICAuth.appendLetterHistory = appendLetterHistory;
window.TAMSICAuth.hasReceivedLetter   = hasReceivedLetter;
