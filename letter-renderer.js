/**
 * letter-renderer.js — TAMSIC 歌詞便箋 DOM レンダラ (v4.2.2)
 *
 * v4.2.2 変更:
 *   Web 便箋を「歌詞ビューア」にミニマル化。
 *   creator's note / closing / signature / footer (Air Mail + 日付スタンプ)
 *   は Web からは出さず、メール限定要素にする (= プレミア感)。
 *   reroll() は廃止 (closing が Web に出ないため)。
 *
 * 設計書 §10.1 / §10.6 準拠
 *
 * 役割: track + user + frame から便箋 DOM (歌詞のみ) を構築。
 * frame 抽選は letter-frames.js が担当。
 * closing 抽選はメール送信時に Worker 側でのみ実施 (letter-content.js は
 * letter-send.js から候補プールを Worker へ渡すために使われる)。
 *
 * Public API:
 *   window.TAMSICLetter = {
 *     render(targetEl, opts) → letterEl
 *   };
 *
 * opts:
 *   track    - 曲オブジェクト ({id, artist, title, lyrics, coverPath, ...})
 *   user     - {id, email, nickname, birthday, registeredAt}
 *   today    - Date (省略時 new Date())
 *   features - feature flags (任意)
 *   frame    - 強制で枠を指定 (デバッグ用、省略可)
 */
(function(){

  const ARTIST_DISPLAY_NAME = {
    nono: 'no-no',
    kiki: 'kiki',
    gen:  'gEN'
  };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  // 歌詞テキストを段落 ↓ <br> に整形
  function _lyricsToParagraphs(lyricsText) {
    if (!lyricsText) return '';
    // 空行で段落分け
    const paragraphs = String(lyricsText).split(/\n\s*\n/);
    return paragraphs.map(function(p){
      const lines = p.split('\n').map(function(l){ return _esc(l.trim()); }).filter(Boolean);
      if (!lines.length) return '';
      return '<p>' + lines.join('<br>') + '</p>';
    }).join('');
  }

  function _selectFrame(opts, track, user, today) {
    if (opts.frame) return opts.frame;
    if (window.TAMSICLetterFrames) {
      return window.TAMSICLetterFrames.pickFrame(track, user, today, opts.history, opts.features);
    }
    return 'A';
  }

  function _buildBanner(frame, user, today) {
    if (frame === 'O') {
      const nick = (user && user.nickname) || 'listener';
      return '<div class="bday-banner">★ HAPPY BIRTHDAY, ' + _esc(nick) + ' ★</div>';
    }
    if (frame === 'P') {
      let years = 1;
      if (window.TAMSICLetterFrames && window.TAMSICLetterFrames.anniversaryYears) {
        years = window.TAMSICLetterFrames.anniversaryYears(user, today) || 1;
      }
      return '<div class="anniv-banner">— THANK YOU FOR ' + years + ' YEAR' + (years === 1 ? '' : 'S') + ' —</div>';
    }
    return '';
  }

  function render(target, opts) {
    if (!target) return null;
    opts = opts || {};
    const track  = opts.track || {};
    const user   = opts.user || { nickname: 'listener' };
    const today  = opts.today || new Date();
    const features = opts.features || {};

    const artistKey = track.artist || 'nono';
    const artistDisp = ARTIST_DISPLAY_NAME[artistKey] || artistKey;

    const frame = _selectFrame(opts, track, user, today);
    const frameDef = (window.TAMSICLetterFrames && window.TAMSICLetterFrames.FRAMES[frame]) || { cssClass: 'frame-a', name: 'simple' };

    const banner = _buildBanner(frame, user, today);
    const nickname = (user && user.nickname) || 'listener';

    const coverHtml = track.coverPath
      ? '<img src="' + _esc(track.coverPath) + '" alt="' + _esc(track.title || '') + ' cover">'
      : '';

    // v4.2.2: Web 便箋は歌詞ビューア化 (creator-note / closing / signature / footer はメール限定)
    const html =
      '<div class="tamsic-letter tlb ' + _esc(frameDef.cssClass) + ' artist-' + _esc(artistKey) + '"' +
        ' data-frame="' + _esc(frame) + '" data-track-id="' + _esc(track.id || '') + '">' +
        '<div class="inner">' +
          banner +
          '<div class="cover-strip" aria-hidden="' + (coverHtml ? 'false' : 'true') + '">' + coverHtml + '</div>' +
          '<div class="header">' +
            '<div><div class="label">From</div><div class="v-from">' + _esc(artistDisp) + '</div></div>' +
            '<div><div class="label">Track</div><div class="v-jp">' + _esc(track.title || '') + '</div></div>' +
            '<div><div class="label">Dear</div><div class="v-dear">' + _esc(nickname) + '</div></div>' +
          '</div>' +
          '<div class="body">' + _lyricsToParagraphs(track.lyrics) + '</div>' +
        '</div>' +
      '</div>';

    target.innerHTML = html;
    const letterEl = target.querySelector('.tamsic-letter');

    // 保護を適用 (lyrics-guard.js v4.2.1 の protectLetter)
    if (letterEl && window.TAMSICLyrics && typeof window.TAMSICLyrics.protectLetter === 'function') {
      try {
        window.TAMSICLyrics.protectLetter(letterEl, user, {
          watermark:     (user && user.email) || (user && user.id) || 'guest',
          onPrintScreen: 'blur'
        });
      } catch (e) {
        console.warn('[TAMSICLetter] protectLetter failed:', e);
      }
    } else if (letterEl && window.TAMSICLyrics && typeof window.TAMSICLyrics.protect === 'function') {
      // フォールバック: 旧 protect を歌詞ブロックだけに
      const bodyEl = letterEl.querySelector('.body');
      if (bodyEl) {
        try {
          window.TAMSICLyrics.protect(bodyEl, track.lyrics || '', {
            watermark:    (user && user.email) || 'guest',
            obfuscate:    false,
            onPrintScreen:'blur'
          });
        } catch (e) {}
      }
    }

    return letterEl;
  }

  // v4.2.2: reroll() は廃止 (closing が Web に出なくなったため)
  // 旧 v4.2.1 まで存在した window.TAMSICLetter.reroll は呼ばないこと

  window.TAMSICLetter = {
    render: render,
    ARTIST_DISPLAY_NAME: ARTIST_DISPLAY_NAME
  };

})();
