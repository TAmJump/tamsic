/**
 * auth.js — TAMSIC Cognito認証ライブラリ（PKCE対応）
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

/* ─── PKCE helpers ─── */
function _generateRandom(length = 64) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

async function _generateCodeChallenge(verifier) {
  const hashed = await _sha256(verifier);
  return btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/* ─── Token storage ─── */
const STORAGE_KEYS = {
  accessToken:  'tamsic_access_token',
  idToken:      'tamsic_id_token',
  refreshToken: 'tamsic_refresh_token',
  expiry:       'tamsic_token_expiry',
  coins:        'tamsic_coins',
  verifier:     'tamsic_pkce_verifier',
  state:        'tamsic_oauth_state',
};

function _saveTokens(tokenResponse) {
  localStorage.setItem(STORAGE_KEYS.accessToken,  tokenResponse.access_token  || '');
  localStorage.setItem(STORAGE_KEYS.idToken,      tokenResponse.id_token      || '');
  localStorage.setItem(STORAGE_KEYS.refreshToken, tokenResponse.refresh_token || '');
  const expiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
  localStorage.setItem(STORAGE_KEYS.expiry, String(expiry));
  // コイン初期値（DynamoDB未実装時の暫定）
  if (!localStorage.getItem(STORAGE_KEYS.coins)) {
    localStorage.setItem(STORAGE_KEYS.coins, '0');
  }
}

function _clearTokens() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
}

/* ─── 公開API ─── */

/**
 * ログイン中かどうか（トークン有効期限チェック付き）
 */
function isLoggedIn() {
  const token  = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiry = Number(localStorage.getItem(STORAGE_KEYS.expiry) || 0);
  return !!(token && Date.now() < expiry);
}

/**
 * 保存済みトークンを返す
 */
function getTokens() {
  return {
    accessToken:  localStorage.getItem(STORAGE_KEYS.accessToken),
    idToken:      localStorage.getItem(STORAGE_KEYS.idToken),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refreshToken),
  };
}

/**
 * IDトークンからユーザー情報を取得
 */
function getUserInfo() {
  const idToken = localStorage.getItem(STORAGE_KEYS.idToken);
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * コイン残高取得（暫定: sessionStorage）
 */
function getCoins() {
  return parseInt(localStorage.getItem(STORAGE_KEYS.coins) || '0', 10);
}

/**
 * コイン消費（暫定: sessionStorage）
 */
function spendCoins(amount) {
  const current = getCoins();
  if (current < amount) return false;
  localStorage.setItem(STORAGE_KEYS.coins, String(current - amount));
  return true;
}

/**
 * Cognito Hosted UI へリダイレクト（ログイン）
 */
async function cognitoLogin() {
  const verifier   = _generateRandom(64);
  const state      = _generateRandom(16);
  const challenge  = await _generateCodeChallenge(verifier);

  localStorage.setItem(STORAGE_KEYS.verifier, verifier);
  localStorage.setItem(STORAGE_KEYS.state,    state);

  const _lang = localStorage.getItem('tamsic_lang') || 'ja';
  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             AUTH_CONFIG.clientId,
    redirect_uri:          AUTH_CONFIG.redirectUri,
    scope:                 AUTH_CONFIG.scopes,
    state:                 state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    ui_locales:            _lang,
  });

  window.location.href =
    `https://${AUTH_CONFIG.domain}/oauth2/authorize?${params}`;
}

/**
 * Cognito Hosted UI へリダイレクト（新規登録）
 */
async function cognitoSignup() {
  const verifier   = _generateRandom(64);
  const state      = _generateRandom(16);
  const challenge  = await _generateCodeChallenge(verifier);

  localStorage.setItem(STORAGE_KEYS.verifier, verifier);
  localStorage.setItem(STORAGE_KEYS.state,    state);

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             AUTH_CONFIG.clientId,
    redirect_uri:          AUTH_CONFIG.redirectUri,
    scope:                 AUTH_CONFIG.scopes,
    state:                 state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  window.location.href =
    `https://${AUTH_CONFIG.domain}/signup?${params}&ui_locales=${localStorage.getItem('tamsic_lang')||'ja'}`;
}

/**
 * ログアウト
 */
function cognitoLogout() {
  _clearTokens();
  const params = new URLSearchParams({
    client_id:  AUTH_CONFIG.clientId,
    logout_uri: AUTH_CONFIG.logoutUri,
  });
  window.location.href =
    `https://${AUTH_CONFIG.domain}/logout?${params}`;
}

/**
 * callback.html から呼ぶ: 認証コードをトークンに交換
 * @returns {Promise<boolean>} 成功/失敗
 */
async function handleCallback() {
  const params   = new URLSearchParams(window.location.search);
  const code     = params.get('code');
  const state    = params.get('state');
  const error    = params.get('error');

  if (error) {
    console.error('Cognito error:', error, params.get('error_description'));
    return false;
  }

  const savedState    = localStorage.getItem(STORAGE_KEYS.state);
  const codeVerifier  = localStorage.getItem(STORAGE_KEYS.verifier);

  if (!code || !codeVerifier) return false;
  if (state !== savedState)   return false;

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     AUTH_CONFIG.clientId,
    code:          code,
    redirect_uri:  AUTH_CONFIG.redirectUri,
    code_verifier: codeVerifier,
  });

  try {
    const res = await fetch(
      `https://${AUTH_CONFIG.domain}/oauth2/token`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Token exchange failed:', err);
      return false;
    }

    const tokenResponse = await res.json();
    _saveTokens(tokenResponse);

    // 使い捨て値をクリア
    localStorage.removeItem(STORAGE_KEYS.verifier);
    localStorage.removeItem(STORAGE_KEYS.state);

    return true;
  } catch (e) {
    console.error('Token exchange error:', e);
    return false;
  }
}
