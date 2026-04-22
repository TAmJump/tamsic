/**
 * lyrics-guard.js — TAMSIC 歌詞保護モジュール
 *
 * 【重要な前提】
 *   Web 上で「絶対に複製不可」は技術的に不可能です。
 *   OS レベルのスクリーンショット、外部カメラ撮影、ブラウザ開発者ツールは完全には防げません。
 *   このモジュールの目的は:
 *     (1) 容易には持ち出せない水準までハードルを上げる
 *     (2) 流出時に追跡できる透かしを埋め込む
 *     (3) 検索・アクセシビリティを壊しすぎない
 *
 * 【使い方】
 *   TAMSICLyrics.protect(containerEl, rawLyricsText, {
 *     watermark: 'user@example.com',   // 透かしに使う文字列（省略可）
 *     obfuscate: true,                  // 1文字1spanに分割（既定 true）
 *     onPrintScreen: 'blur',            // 'blur' | 'hide' | null
 *   });
 *
 * 【保護の5層】
 *   1. CSS      : user-select, -webkit-touch-callout, -webkit-user-drag
 *   2. イベント: contextmenu / copy / cut / selectstart / dragstart を preventDefault
 *   3. キー    : Ctrl/⌘+C, Ctrl+A, Ctrl+S, Ctrl+P, PrintScreen を抑止（歌詞フォーカス時）
 *   4. 透かし  : メールアドレスの SHA-256 ハッシュを 5% 不透明で背面に繰り返し配置
 *   5. 難読化  : 1文字1spanで、DOM上に連続した歌詞文字列が存在しないようにする
 */

(function (global) {
  'use strict';

  // ──────────────────────────────────────────
  // CSS を一度だけ挿入
  // ──────────────────────────────────────────
  const STYLE_ID = 'tamsic-lyrics-guard-style';
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tamsic-lyrics-guard {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-user-drag: none !important;
        position: relative;
        transition: filter .18s ease, opacity .18s ease;
      }
      .tamsic-lyrics-guard * {
        user-select: none !important;
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      .tamsic-lyrics-guard.is-psblur { filter: blur(8px) saturate(.6); }
      .tamsic-lyrics-guard.is-pshide { opacity: 0; pointer-events: none; }
      .tamsic-lyrics-guard .tlg-char { display: inline; white-space: pre-wrap; }
      .tamsic-lyrics-guard .tlg-wm {
        position: absolute; inset: 0;
        pointer-events: none;
        opacity: .06;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 11px;
        line-height: 1.5;
        letter-spacing: .04em;
        color: #000;
        overflow: hidden;
        user-select: none !important;
        -webkit-user-select: none !important;
        z-index: 2;
        mix-blend-mode: multiply;
        word-break: break-all;
      }
      /* ::selection も無効化（念のため） */
      .tamsic-lyrics-guard ::selection,
      .tamsic-lyrics-guard::selection { background: transparent; color: inherit; }
    `;
    document.head.appendChild(style);
  }

  // ──────────────────────────────────────────
  // 透かし用ハッシュ生成
  // ──────────────────────────────────────────
  async function sha256Hex(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // フォールバック: 決定的だが暗号学的ではない簡易ハッシュ
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return 'x' + (h >>> 0).toString(16).padStart(8, '0');
    }
  }

  // ──────────────────────────────────────────
  // 歌詞テキストを 1 文字 1 span に分割してレンダリング
  // ──────────────────────────────────────────
  function renderObfuscated(container, text) {
    const frag = document.createDocumentFragment();
    // 段落（空行で区切り）
    const stanzas = String(text).split(/\n\s*\n/);
    stanzas.forEach((stanza, si) => {
      const p = document.createElement('p');
      p.className = 'lyrics-stanza';
      p.style.cssText = 'break-inside:avoid;page-break-inside:avoid;margin:0 0 1.35em;';
      const lines = stanza.split('\n');
      lines.forEach((line, li) => {
        // 1 文字 1 span（DOM 上で連続文字列にしない）
        for (const ch of line) {
          const s = document.createElement('span');
          s.className = 'tlg-char';
          // data-c に ZWJ などを混ぜても DOM テキストは span の内容なので、
          // ここでは文字そのものを入れる。難読化は span 分割で実現。
          s.textContent = ch;
          p.appendChild(s);
        }
        if (li < lines.length - 1) p.appendChild(document.createElement('br'));
      });
      frag.appendChild(p);
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }

  function renderPlain(container, text) {
    container.innerHTML = '';
    String(text).split(/\n\s*\n/).forEach(stanza => {
      const p = document.createElement('p');
      p.className = 'lyrics-stanza';
      p.style.cssText = 'break-inside:avoid;page-break-inside:avoid;margin:0 0 1.35em;';
      stanza.split('\n').forEach((line, i, arr) => {
        p.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) p.appendChild(document.createElement('br'));
      });
      container.appendChild(p);
    });
  }

  // ──────────────────────────────────────────
  // 透かしレイヤを追加
  // ──────────────────────────────────────────
  function addWatermark(container, hash) {
    if (!hash) return;
    const wm = document.createElement('div');
    wm.className = 'tlg-wm';
    wm.setAttribute('aria-hidden', 'true');
    // ハッシュを繰り返して埋める（テキストで OK）
    const short = hash.slice(0, 12).toUpperCase();
    wm.textContent = (`TAMSIC · ${short} · `).repeat(400);
    container.appendChild(wm);
  }

  // ──────────────────────────────────────────
  // イベント抑止
  // ──────────────────────────────────────────
  function bindEvents(container, options) {
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); return false; };

    ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart', 'beforecopy'].forEach(name => {
      container.addEventListener(name, prevent, true);
    });

    // フォーカス領域にいる間のみキー抑止
    let focused = false;
    container.addEventListener('mouseenter', () => { focused = true; });
    container.addEventListener('mouseleave', () => { focused = false; });
    container.addEventListener('touchstart', () => { focused = true; }, { passive: true });

    // キーボード抑止（歌詞エリアにホバーしている時のみ）
    function onKey(e) {
      if (!focused) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || '').toLowerCase();
      const isCopy  = mod && (k === 'c' || k === 'x');
      const isAll   = mod && k === 'a';
      const isSave  = mod && k === 's';
      const isPrint = mod && k === 'p';
      if (isCopy || isAll || isSave || isPrint) {
        prevent(e);
      }
    }
    document.addEventListener('keydown', onKey, true);

    // PrintScreen 検知（Windows で発火する）
    function onPS(e) {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        applyPrintScreenResponse(container, options);
        // クリップボードをクリア試行（全環境で成功するわけではない）
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('').catch(() => {});
          }
        } catch {}
      }
    }
    document.addEventListener('keyup', onPS, true);

    // 開発者ツール検知（完璧ではないが、ブランド的にも抑止になる）
    startDevToolsGuard(container);
  }

  // ──────────────────────────────────────────
  // PrintScreen レスポンス
  // ──────────────────────────────────────────
  function applyPrintScreenResponse(container, options) {
    const mode = options.onPrintScreen || 'blur';
    if (mode === 'hide') {
      container.classList.add('is-pshide');
      setTimeout(() => container.classList.remove('is-pshide'), 3000);
    } else if (mode === 'blur') {
      container.classList.add('is-psblur');
      setTimeout(() => container.classList.remove('is-psblur'), 3000);
    }
  }

  // ──────────────────────────────────────────
  // DevTools 検知（簡易版）
  // ──────────────────────────────────────────
  let devToolsTimer = null;
  function startDevToolsGuard(container) {
    if (devToolsTimer) return;
    const THRESHOLD = 160;
    devToolsTimer = setInterval(() => {
      const widthGap  = window.outerWidth  - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const open = (widthGap > THRESHOLD || heightGap > THRESHOLD);
      document.querySelectorAll('.tamsic-lyrics-guard').forEach(el => {
        if (open) el.classList.add('is-psblur');
        else      el.classList.remove('is-psblur');
      });
    }, 1000);
  }

  // ──────────────────────────────────────────
  // 公開 API
  // ──────────────────────────────────────────
  async function protect(container, rawText, options) {
    if (!container) return;
    options = options || {};
    injectCss();

    container.classList.add('tamsic-lyrics-guard');
    // CSS インラインでも user-select: none を保証
    container.style.userSelect = 'none';
    container.style.webkitUserSelect = 'none';
    container.setAttribute('oncontextmenu', 'return false;');
    container.setAttribute('oncopy', 'return false;');
    container.setAttribute('onselectstart', 'return false;');
    container.setAttribute('ondragstart', 'return false;');

    // 本文レンダリング
    if (options.obfuscate !== false) {
      renderObfuscated(container, rawText || '');
    } else {
      renderPlain(container, rawText || '');
    }

    // 透かし
    const wmSource = options.watermark;
    if (wmSource) {
      const hash = await sha256Hex(wmSource + '|' + new Date().toISOString().slice(0, 10));
      addWatermark(container, hash);
    }

    // イベント抑止
    bindEvents(container, options);
  }

  // 名前空間
  global.TAMSICLyrics = {
    protect: protect,
    // 開発者ガードの手動起動（必要に応じて）
    _startDevToolsGuard: startDevToolsGuard
  };

})(typeof window !== 'undefined' ? window : this);
