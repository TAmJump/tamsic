// ─── TAMSIC Auth — Amazon Cognito (ap-northeast-1) ───────────────────────────
// User Pool ID : ap-northeast-1_vozRgCY5k
// Client ID    : 62e35ra0h4s2dr657euorlm5bu
// ─────────────────────────────────────────────────────────────────────────────

const COGNITO = {
  region:      'ap-northeast-1',
  userPoolId:  'ap-northeast-1_vozRgCY5k',
  clientId:    '62e35ra0h4s2dr657euorlm5bu',
  domain:      'ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com',
  redirectUri: 'https://tamsic.tamjump.com/callback.html',
  logoutUri:   'https://tamsic.tamjump.com/',
};

// ─── PKCE ヘルパー ────────────────────────────────────────────────────────────
function _base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function _generatePKCE() {
  const verifier = _base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: _base64url(digest) };
}

// ─── ログイン（Cognito Hosted UI へリダイレクト） ─────────────────────────────
async function cognitoLogin() {
  const { verifier, challenge } = await _generatePKCE();
  const state = _base64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('pkce_state',    state);

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             COGNITO.clientId,
    redirect_uri:          COGNITO.redirectUri,
    scope:                 'openid email profile',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://${COGNITO.domain}/oauth2/authorize?${params}`;
}

// ─── サインアップ（Hosted UI のサインアップ画面へ） ──────────────────────────
async function cognitoSignup() {
  const { verifier, challenge } = await _generatePKCE();
  const state = _base64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('pkce_state',    state);

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             COGNITO.clientId,
    redirect_uri:          COGNITO.redirectUri,
    scope:                 'openid email profile',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://${COGNITO.domain}/signup?${params}`;
}

// ─── コールバック処理（callback.html から呼ぶ） ───────────────────────────────
async function cognitoHandleCallback() {
  const params   = new URLSearchParams(window.location.search);
  const code     = params.get('code');
  const state    = params.get('state');
  const verifier = sessionStorage.getItem('pkce_verifier');
  const savedState = sessionStorage.getItem('pkce_state');

  if (!code || state !== savedState) {
    console.error('Auth error: invalid state or missing code');
    window.location.href = '/';
    return;
  }

  const res = await fetch(`https://${COGNITO.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     COGNITO.clientId,
      redirect_uri:  COGNITO.redirectUri,
      code,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    console.error('Token exchange failed');
    window.location.href = '/';
    return;
  }

  const tokens = await res.json();
  sessionStorage.setItem('id_token',      tokens.id_token);
  sessionStorage.setItem('access_token',  tokens.access_token);
  sessionStorage.setItem('refresh_token', tokens.refresh_token);
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');

  // ユーザー情報を取得して保存
  const user = _parseJwt(tokens.id_token);
  sessionStorage.setItem('tamsic_user', JSON.stringify({
    email: user.email,
    sub:   user.sub,
  }));

  window.location.href = '/';
}

// ─── ログアウト ───────────────────────────────────────────────────────────────
function cognitoLogout() {
  sessionStorage.clear();
  const params = new URLSearchParams({
    client_id:  COGNITO.clientId,
    logout_uri: COGNITO.logoutUri,
  });
  window.location.href = `https://${COGNITO.domain}/logout?${params}`;
}

// ─── ログイン状態チェック ─────────────────────────────────────────────────────
function isLoggedIn() {
  const token = sessionStorage.getItem('id_token');
  if (!token) return false;
  try {
    const payload = _parseJwt(token);
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// ─── 現在のユーザー情報取得 ──────────────────────────────────────────────────
function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('tamsic_user') || 'null');
  } catch {
    return null;
  }
}

// ─── JWT デコード（ローカル、署名検証なし） ──────────────────────────────────
function _parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

// ─── コイン管理（DynamoDB 連携 — 後フェーズで実装） ─────────────────────────
// ※ 現在は localStorage から移行期間のため sessionStorage を暫定使用
function getCoins() {
  return parseInt(sessionStorage.getItem('tamsic_coins') || '0', 10);
}
function setCoins(n) {
  sessionStorage.setItem('tamsic_coins', String(n));
}
function addCoins(n) {
  setCoins(getCoins() + n);
}
function useCoins(n) {
  const current = getCoins();
  if (current < n) return false;
  setCoins(current - n);
  return true;
}

// ─── 既存コードとの互換ラッパー ──────────────────────────────────────────────
// 既存の auth.js が使っていた関数名に合わせてエイリアスを作成
const Auth = {
  login:       cognitoLogin,
  signup:      cognitoSignup,
  logout:      cognitoLogout,
  isLoggedIn,
  getCurrentUser,
  getCoins,
  addCoins,
  useCoins,
};
