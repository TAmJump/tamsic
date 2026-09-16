/**
 * lang.js — TAMSIC 日英切り替えライブラリ (v4.2.3 リニューアル英語プライマリ版)
 * 使い方:
 *   <span data-ja="日本語テキスト" data-en="English text">日本語テキスト</span>
 *   HTMLのlang属性も自動更新。localStorageで言語を保持。
 *
 * v4.2.3 (2026-09-16): TAMSIC リニューアルに伴い、デフォルト言語を 'ja' から 'en' に変更。
 *   海外リスナー拡大に合わせて英語プライマリに転換。
 *   既存訪問者で localStorage に 'ja' が保存されている人はそのまま JP 表示継続。
 *   初訪問者はブラウザ言語が 'ja' でない限り EN 表示。
 */
(function() {
  const STORAGE_KEY = 'tamsic_lang';
  const SUPPORTED   = ['ja', 'en'];
  const DEFAULT_LANG = 'en';  // v4.2.3: リニューアルで英語プライマリ化

  function detect() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    // ブラウザ言語判定: 明示的に日本語ブラウザなら JP、それ以外はデフォルト (EN)
    const browser = (navigator.language || DEFAULT_LANG).slice(0, 2);
    if (browser === 'ja') return 'ja';
    return DEFAULT_LANG;
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
