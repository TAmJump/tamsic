/**
 * mobile-nav.js — TAMSIC 共通ハンバーガーメニュー (v4.2.2.5)
 *
 * 役割: スマホ表示時 (max-width:768px) に既存の <ul class="nav-links"> を非表示にし、
 *        右上にハンバーガーアイコン (☰) を表示。タップで右からスライドインのドロワーを開く。
 *        ドロワー内に既存のナビ項目をすべて複製表示、ログイン状態に応じて「ログイン/ログアウト」を切替。
 *
 * 設計判断:
 *   - 既存 HTML の nav-links を CSS で隠す (display:none) のはそのまま、
 *     JS で同階層にハンバーガーボタン + ドロワーを生成。
 *   - ドロワー内項目は nav-links の <a> をテキストで読んで自前生成 (DOM コピーじゃない=スタイル衝突回避)。
 *   - 「ログイン中なら Logout、未ログインなら Login」は auth.js の isLoggedIn() で判定。
 *   - 言語切替ボタン (data-lang-toggle) は別途独自ロジックがあるので、ドロワー内にも置いて click を流す。
 *
 * 読み込み: 各 HTML の </body> 直前 (auth.js より後) で <script src="mobile-nav.js?v=4.2.2.5"></script>
 */

(function() {
  'use strict';

  // 既に初期化済みなら何もしない (誤って 2 度読込された場合の保険)
  if (window.__tamsicMobileNavInit) return;
  window.__tamsicMobileNavInit = true;

  // CSS 注入 (各ページに style 追加せずに済む)
  function injectStyles() {
    if (document.getElementById('tamsic-mobile-nav-styles')) return;
    const style = document.createElement('style');
    style.id = 'tamsic-mobile-nav-styles';
    style.textContent = `
      .tm-hamburger {
        display: none;
        position: fixed;
        top: 14px;
        right: 16px;
        z-index: 1001;
        width: 44px;
        height: 44px;
        background: rgba(255,255,255,0.92);
        border: 1px solid rgba(17,17,17,0.08);
        border-radius: 6px;
        cursor: pointer;
        padding: 0;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 4px;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .tm-hamburger span {
        display: block;
        width: 20px;
        height: 1.5px;
        background: #111;
        transition: transform 0.25s, opacity 0.25s;
      }
      .tm-hamburger[aria-expanded="true"] span:nth-child(1) {
        transform: translateY(5.5px) rotate(45deg);
      }
      .tm-hamburger[aria-expanded="true"] span:nth-child(2) {
        opacity: 0;
      }
      .tm-hamburger[aria-expanded="true"] span:nth-child(3) {
        transform: translateY(-5.5px) rotate(-45deg);
      }
      .tm-drawer-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      .tm-drawer-backdrop.is-open {
        display: block;
        opacity: 1;
      }
      .tm-drawer {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        height: 100dvh;
        width: min(82vw, 320px);
        background: #fff;
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
        box-shadow: -4px 0 24px rgba(0,0,0,0.12);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: 72px 28px 32px;
        -webkit-overflow-scrolling: touch;
      }
      .tm-drawer.is-open {
        transform: translateX(0);
      }
      .tm-drawer-brand {
        font-family: 'Playfair Display', serif;
        font-weight: 600;
        font-size: 20px;
        letter-spacing: 0.18em;
        color: #111;
        margin-bottom: 28px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(17,17,17,0.08);
      }
      .tm-drawer a,
      .tm-drawer button.tm-drawer-item {
        display: block;
        padding: 14px 0;
        font-family: 'Jost', sans-serif;
        font-size: 15px;
        letter-spacing: 0.04em;
        color: #1f1f1f;
        text-decoration: none;
        border-bottom: 1px solid rgba(17,17,17,0.05);
        text-align: left;
        background: none;
        border-left: none;
        border-right: none;
        border-top: none;
        width: 100%;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .tm-drawer a:active,
      .tm-drawer button.tm-drawer-item:active {
        opacity: 0.55;
      }
      .tm-drawer a.tm-drawer-cta {
        margin-top: 18px;
        text-align: center;
        background: #111;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 14px;
        font-weight: 500;
      }
      .tm-drawer .tm-drawer-section-label {
        font-size: 9px;
        letter-spacing: 0.3em;
        color: #999;
        text-transform: uppercase;
        margin: 20px 0 6px;
        font-family: 'Jost', sans-serif;
      }
      @media (max-width: 768px) {
        .tm-hamburger { display: flex; }
        body.tm-drawer-open { overflow: hidden; }
      }
    `;
    document.head.appendChild(style);
  }

  function isLoggedIn() {
    try {
      if (typeof window.isLoggedIn === 'function') return !!window.isLoggedIn();
      if (window.TAMSICAuth && typeof window.TAMSICAuth.isLoggedIn === 'function') return !!window.TAMSICAuth.isLoggedIn();
      return !!localStorage.getItem('tamsic_refresh_token');
    } catch { return false; }
  }

  function buildDrawerItems() {
    // ナビ項目を統一的に用意 (各ページの nav-links から動的取得すると差分が出るので固定リスト)
    const loggedIn = isLoggedIn();
    const items = [
      { section: 'Artists' },
      { href: 'nono.html', label: 'no-no' },
      { href: 'kiki.html', label: 'kiki' },
      { href: 'gen.html', label: 'gEN' },
      { section: 'Label' },
      { href: 'news.html', label: 'ニュース' },
      { href: 'about.html', label: 'レーベル紹介' },
      { section: 'Account' }
    ];
    if (loggedIn) {
      items.push({ href: 'mypage.html', label: 'マイページ' });
      items.push({ action: 'logout', label: 'ログアウト' });
    } else {
      items.push({ href: 'login.html', label: 'ログイン', cta: false });
      items.push({ href: 'signup.html', label: '新規登録', cta: true });
    }
    items.push({ section: 'Language' });
    items.push({ action: 'lang-toggle', label: 'EN / JP' });
    return items;
  }

  function handleLogout() {
    try {
      if (typeof window.handleLogout === 'function' && window.handleLogout !== _myLogout) {
        return window.handleLogout();
      }
    } catch {}
    // フォールバック: localStorage を消してリロード
    [
      'tamsic_access_token','tamsic_id_token','tamsic_refresh_token','tamsic_token_expiry',
      'tamsic_wallet','tamsic_wallet_cache'
    ].forEach(k => localStorage.removeItem(k));
    location.href = 'index.html';
  }
  function _myLogout() { handleLogout(); }

  function handleLangToggle() {
    // 各ページの data-lang-toggle ボタンを探して click を流す
    const btn = document.querySelector('[data-lang-toggle]');
    if (btn) btn.click();
  }

  function buildAndAttach() {
    injectStyles();

    // ハンバーガーボタン
    const btn = document.createElement('button');
    btn.className = 'tm-hamburger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'メニューを開く');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';

    // バックドロップ
    const backdrop = document.createElement('div');
    backdrop.className = 'tm-drawer-backdrop';

    // ドロワー本体
    const drawer = document.createElement('div');
    drawer.className = 'tm-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-hidden', 'true');

    const brand = document.createElement('div');
    brand.className = 'tm-drawer-brand';
    brand.textContent = 'TAMSIC';
    drawer.appendChild(brand);

    function renderItems() {
      // 既存項目を一旦消す (brand は残す)
      drawer.querySelectorAll('a, button.tm-drawer-item, .tm-drawer-section-label').forEach(el => el.remove());
      const items = buildDrawerItems();
      items.forEach(it => {
        if (it.section) {
          const lab = document.createElement('div');
          lab.className = 'tm-drawer-section-label';
          lab.textContent = it.section;
          drawer.appendChild(lab);
          return;
        }
        let el;
        if (it.href) {
          el = document.createElement('a');
          el.href = it.href;
          el.textContent = it.label;
          if (it.cta) el.className = 'tm-drawer-cta';
        } else {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'tm-drawer-item';
          el.textContent = it.label;
          el.addEventListener('click', () => {
            if (it.action === 'logout') {
              closeDrawer();
              setTimeout(handleLogout, 100);
            } else if (it.action === 'lang-toggle') {
              handleLangToggle();
              closeDrawer();
            }
          });
        }
        drawer.appendChild(el);
      });
    }

    function openDrawer() {
      renderItems();  // ログイン状態が変わってる可能性あるので毎回再描画
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'メニューを閉じる');
      drawer.setAttribute('aria-hidden', 'false');
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      document.body.classList.add('tm-drawer-open');
    }
    function closeDrawer() {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'メニューを開く');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.classList.remove('tm-drawer-open');
    }

    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-expanded') === 'true') {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
    backdrop.addEventListener('click', closeDrawer);

    document.body.appendChild(btn);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // ESC キーで閉じる (PC のデバッグ用)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') closeDrawer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildAndAttach);
  } else {
    buildAndAttach();
  }
})();
