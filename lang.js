/**
 * lang.js — TAMSIC 日英切り替えライブラリ
 * 使い方:
 *   <span data-ja="日本語テキスト" data-en="English text">日本語テキスト</span>
 *   HTMLのlang属性も自動更新。localStorageで言語を保持。
 */
(function() {
  const STORAGE_KEY = 'tamsic_lang';
  const SUPPORTED   = ['ja', 'en'];

  function detect() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const browser = (navigator.language || 'ja').slice(0, 2);
    return SUPPORTED.includes(browser) ? browser : 'ja';
  }

  function apply(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    // data-ja / data-en 属性を持つ全要素を切り替え
    document.querySelectorAll('[data-ja], [data-en]').forEach(el => {
      const text = el.getAttribute('data-' + lang);
      if (text !== null) {
        // input/textarea はvalue、それ以外はinnerHTML
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = text;
        } else {
          el.innerHTML = text;
        }
      }
    });

    // lang切り替えボタンのラベルを更新
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
      btn.textContent = lang === 'ja' ? 'EN' : 'JA';
      btn.setAttribute('aria-label', lang === 'ja' ? 'Switch to English' : '日本語に切り替え');
    });

    // カスタムイベントを発火（各ページで追加処理があれば使える）
    document.dispatchEvent(new CustomEvent('tamsic:langchange', { detail: { lang } }));
  }

  function toggle() {
    const current = localStorage.getItem(STORAGE_KEY) || detect();
    apply(current === 'ja' ? 'en' : 'ja');
  }

  function get() {
    return localStorage.getItem(STORAGE_KEY) || detect();
  }

  // 初期化（DOMContentLoaded 前でも動くよう即時実行）
  function init() {
    apply(detect());
    // data-lang-toggle ボタンにクリックを自動バインド
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
  }

  // DOMが準備できていれば即実行、なければ待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // グローバルAPIとして公開
  window.TAMSICLang = { get, apply, toggle };
})();
