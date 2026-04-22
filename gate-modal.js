/**
 * gate-modal.js — TAMSIC 会員ゲートモーダル
 *
 * 非会員がロック済みコンテンツに触れたとき、alert() の代わりに
 * TAMSICブランドに沿ったモーダルを表示する。
 *
 * 使い方:
 *   TAMSICGate.show({
 *     title:   'ここから先は会員限定です',
 *     message: 'この曲は会員先行公開中です。',
 *     primary:   { label:'ログイン',   href:'login.html' },
 *     secondary: { label:'新規登録',  href:'signup.html' },
 *     redirect:  'nono.html#track-nono-003'  // ログイン後に戻したいURL
 *   });
 *
 *   TAMSICGate.showCoinShortage({
 *     trackTitle: 'ぎりぎりだよ。',
 *     needed:     50,
 *     balance:    30
 *   });
 *
 * 他ファイルからは <script src="gate-modal.js"></script> だけ追加すれば利用可能。
 */

(function (global) {
  'use strict';

  const STYLE_ID = 'tamsic-gate-modal-style';
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tamsic-gate-backdrop {
        position: fixed; inset: 0;
        background: rgba(14, 14, 14, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        opacity: 0;
        transition: opacity .22s ease;
        font-family: 'Jost', 'DM Sans', 'Noto Sans JP', sans-serif;
      }
      .tamsic-gate-backdrop.is-open { opacity: 1; }

      .tamsic-gate-card {
        background: #FAFAF7;
        max-width: 440px;
        width: 100%;
        padding: 2.4rem 2rem 1.8rem;
        border-radius: 4px;
        box-shadow: 0 28px 80px rgba(0,0,0,.24);
        transform: translateY(12px);
        transition: transform .25s ease;
        position: relative;
      }
      .tamsic-gate-backdrop.is-open .tamsic-gate-card { transform: translateY(0); }

      .tamsic-gate-kicker {
        font-size: .7rem;
        letter-spacing: .22em;
        text-transform: uppercase;
        color: #C4960E;
        margin-bottom: .8rem;
      }
      .tamsic-gate-title {
        font-family: 'Playfair Display', 'Bodoni Moda', 'Noto Sans JP', serif;
        font-size: 1.4rem;
        font-weight: 400;
        letter-spacing: .04em;
        line-height: 1.35;
        color: #0E0E0E;
        margin-bottom: .8rem;
      }
      .tamsic-gate-msg {
        font-size: .88rem;
        color: #555;
        line-height: 1.75;
        margin-bottom: 1.8rem;
      }
      .tamsic-gate-actions {
        display: flex;
        flex-direction: column;
        gap: .7rem;
      }
      .tamsic-gate-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: .95rem 1rem;
        font-family: inherit;
        font-size: .82rem;
        font-weight: 500;
        letter-spacing: .15em;
        text-transform: uppercase;
        text-decoration: none;
        border: none;
        cursor: pointer;
        border-radius: 2px;
        transition: background .18s ease, transform .1s ease, border-color .2s ease;
      }
      .tamsic-gate-btn-primary {
        background: #0E0E0E;
        color: #fff;
      }
      .tamsic-gate-btn-primary:hover { background: #222; }
      .tamsic-gate-btn-primary:active { transform: scale(.985); }
      .tamsic-gate-btn-secondary {
        background: transparent;
        color: #0E0E0E;
        border: 1px solid #E6E6E0;
      }
      .tamsic-gate-btn-secondary:hover { border-color: #C4960E; color: #C4960E; }
      .tamsic-gate-btn-tertiary {
        background: transparent;
        color: #7A7A72;
        padding: .6rem;
        font-size: .75rem;
        letter-spacing: .12em;
      }
      .tamsic-gate-btn-tertiary:hover { color: #C4960E; }

      .tamsic-gate-close {
        position: absolute;
        top: 12px;
        right: 12px;
        background: transparent;
        border: none;
        color: #7A7A72;
        font-size: 1.4rem;
        line-height: 1;
        cursor: pointer;
        padding: 8px 12px;
        transition: color .15s;
      }
      .tamsic-gate-close:hover { color: #0E0E0E; }

      .tamsic-gate-stat {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 1rem 1.1rem;
        background: #fff;
        border: 1px solid #E6E6E0;
        margin-bottom: 1.4rem;
        border-radius: 2px;
      }
      .tamsic-gate-stat-label {
        font-size: .7rem;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: #7A7A72;
      }
      .tamsic-gate-stat-value {
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 1rem;
        color: #0E0E0E;
        font-weight: 600;
      }
      .tamsic-gate-stat-value.is-short { color: #B8463A; }

      @media (max-width: 480px) {
        .tamsic-gate-card { padding: 2rem 1.4rem 1.4rem; }
        .tamsic-gate-title { font-size: 1.2rem; }
      }
    `;
    document.head.appendChild(style);
  }

  let currentBackdrop = null;

  function close() {
    if (!currentBackdrop) return;
    const b = currentBackdrop;
    currentBackdrop = null;
    b.classList.remove('is-open');
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 250);
    document.documentElement.style.overflow = '';
  }

  function buildUrl(href, redirect) {
    if (!href) return '#';
    if (!redirect) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}redirect=${encodeURIComponent(redirect)}`;
  }

  function show(opts) {
    opts = opts || {};
    injectCss();
    close();

    const backdrop = document.createElement('div');
    backdrop.className = 'tamsic-gate-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'tamsic-gate-card';

    // 閉じるボタン
    if (opts.closable !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tamsic-gate-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', close);
      card.appendChild(closeBtn);
    }

    // Kicker
    if (opts.kicker) {
      const kicker = document.createElement('div');
      kicker.className = 'tamsic-gate-kicker';
      kicker.textContent = opts.kicker;
      card.appendChild(kicker);
    }

    // Title
    if (opts.title) {
      const title = document.createElement('h3');
      title.className = 'tamsic-gate-title';
      title.textContent = opts.title;
      card.appendChild(title);
    }

    // Message
    if (opts.message) {
      const msg = document.createElement('p');
      msg.className = 'tamsic-gate-msg';
      msg.textContent = opts.message;
      card.appendChild(msg);
    }

    // Stats rows (optional)
    if (Array.isArray(opts.stats)) {
      opts.stats.forEach(s => {
        const row = document.createElement('div');
        row.className = 'tamsic-gate-stat';
        const lbl = document.createElement('span');
        lbl.className = 'tamsic-gate-stat-label';
        lbl.textContent = s.label || '';
        const val = document.createElement('span');
        val.className = 'tamsic-gate-stat-value' + (s.short ? ' is-short' : '');
        val.textContent = s.value || '';
        row.appendChild(lbl);
        row.appendChild(val);
        card.appendChild(row);
      });
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'tamsic-gate-actions';

    if (opts.primary) {
      const btn = document.createElement('a');
      btn.className = 'tamsic-gate-btn tamsic-gate-btn-primary';
      btn.href = buildUrl(opts.primary.href, opts.redirect);
      btn.textContent = opts.primary.label || 'OK';
      if (opts.primary.onClick) {
        btn.addEventListener('click', (e) => { opts.primary.onClick(e); if (opts.primary.preventDefault) e.preventDefault(); });
      }
      actions.appendChild(btn);
    }

    if (opts.secondary) {
      const btn = document.createElement('a');
      btn.className = 'tamsic-gate-btn tamsic-gate-btn-secondary';
      btn.href = buildUrl(opts.secondary.href, opts.redirect);
      btn.textContent = opts.secondary.label || '';
      if (opts.secondary.onClick) {
        btn.addEventListener('click', (e) => { opts.secondary.onClick(e); if (opts.secondary.preventDefault) e.preventDefault(); });
      }
      actions.appendChild(btn);
    }

    if (opts.tertiary) {
      const btn = document.createElement('a');
      btn.className = 'tamsic-gate-btn tamsic-gate-btn-tertiary';
      btn.href = opts.tertiary.href || '#';
      btn.textContent = opts.tertiary.label || '';
      btn.addEventListener('click', (e) => {
        if (!opts.tertiary.href || opts.tertiary.href === '#') { e.preventDefault(); close(); }
      });
      actions.appendChild(btn);
    }

    card.appendChild(actions);
    backdrop.appendChild(card);

    // クリックで閉じる（カード外クリック）
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && opts.closable !== false) close();
    });
    // Esc キーで閉じる
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(backdrop);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => backdrop.classList.add('is-open'));

    currentBackdrop = backdrop;
    return backdrop;
  }

  function escHandler(e) {
    if (e.key === 'Escape' && currentBackdrop) {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  }

  // ─── ヘルパー: よく使うシーンの省略形 ───

  /**
   * 非会員が未公開/先行曲を触った時
   */
  function showMemberGate(opts) {
    opts = opts || {};
    const lang = (window.TAMSICLang && window.TAMSICLang.get && window.TAMSICLang.get()) || 'ja';
    const JA = {
      kicker: 'MEMBERS ONLY',
      title:  opts.title  || 'ここから先は会員限定です',
      msg:    opts.message|| '会員は一般公開の14日前から先行視聴できます。',
      login:  'ログイン',
      signup: '新規登録',
      later:  'あとで'
    };
    const EN = {
      kicker: 'MEMBERS ONLY',
      title:  opts.title  || 'Members only beyond this point',
      msg:    opts.message|| 'Members listen 14 days before public release.',
      login:  'Log in',
      signup: 'Create account',
      later:  'Later'
    };
    const t = lang === 'en' ? EN : JA;
    return show({
      kicker:    t.kicker,
      title:     t.title,
      message:   t.msg,
      redirect:  opts.redirect || (location.pathname.split('/').pop() || 'index.html'),
      primary:   { label: t.login,  href: 'login.html' },
      secondary: { label: t.signup, href: 'signup.html' },
      tertiary:  { label: t.later }
    });
  }

  /**
   * 公開前曲（COMING SOON）を触った時
   */
  function showComingSoon(opts) {
    opts = opts || {};
    const lang = (window.TAMSICLang && window.TAMSICLang.get && window.TAMSICLang.get()) || 'ja';
    const JA = {
      kicker: 'COMING SOON',
      title:  opts.title || 'この曲はまだ公開前です',
      msg:    opts.message || '会員は一般公開の14日前から先行視聴できます。',
      login:  'ログイン',
      signup: '新規登録',
      later:  '閉じる'
    };
    const EN = {
      kicker: 'COMING SOON',
      title:  opts.title || "This track isn't out yet",
      msg:    opts.message || 'Members listen 14 days before public release.',
      login:  'Log in',
      signup: 'Create account',
      later:  'Close'
    };
    const t = lang === 'en' ? EN : JA;
    return show({
      kicker: t.kicker, title: t.title, message: t.msg,
      redirect: opts.redirect || (location.pathname.split('/').pop() || 'index.html'),
      primary:   { label: t.login,  href: 'login.html' },
      secondary: { label: t.signup, href: 'signup.html' },
      tertiary:  { label: t.later }
    });
  }

  /**
   * コイン残高不足時
   */
  function showCoinShortage(opts) {
    opts = opts || {};
    const lang = (window.TAMSICLang && window.TAMSICLang.get && window.TAMSICLang.get()) || 'ja';
    const JA = {
      kicker:  'COIN SHORTAGE',
      title:   '残高が不足しています',
      msg:     `「${opts.trackTitle || ''}」のフル試聴には ${opts.needed} coin 必要です。`,
      need:    '必要コイン',
      have:    '現在の残高',
      short:   '不足',
      buy:     'コインを追加する',
      cancel:  'キャンセル'
    };
    const EN = {
      kicker:  'COIN SHORTAGE',
      title:   'Not enough coins',
      msg:     `"${opts.trackTitle || ''}" requires ${opts.needed} coin for full listening.`,
      need:    'Required',
      have:    'Balance',
      short:   'Short by',
      buy:     'Add coins',
      cancel:  'Cancel'
    };
    const t = lang === 'en' ? EN : JA;
    const shortBy = Math.max(0, (opts.needed || 0) - (opts.balance || 0));
    return show({
      kicker:  t.kicker,
      title:   t.title,
      message: t.msg,
      stats: [
        { label: t.need,  value: `${opts.needed} coin` },
        { label: t.have,  value: `${opts.balance} coin` },
        { label: t.short, value: `${shortBy} coin`, short: true }
      ],
      primary:  { label: t.buy,    href: 'mypage.html#purchase-grid' },
      tertiary: { label: t.cancel }
    });
  }

  // ─── 公開 API ───
  global.TAMSICGate = {
    show: show,
    close: close,
    showMemberGate: showMemberGate,
    showComingSoon: showComingSoon,
    showCoinShortage: showCoinShortage
  };

})(typeof window !== 'undefined' ? window : this);
