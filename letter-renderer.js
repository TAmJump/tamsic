/**
 * letter-renderer.js — TAMSIC 歌詞便箋 DOM レンダラ
 *
 * 設計書 §10.1 / §10.6 準拠 (v4.2.1)
 *
 * 役割: track + user + frame + closing から便箋 DOM を構築。
 * 抽選自体は letter-frames.js / letter-content.js が担当。
 *
 * Public API:
 *   window.TAMSICLetter = {
 *     render(targetEl, opts) → letterEl
 *     reroll(letterEl, opts) → 同じ便箋の closing だけ別抽選で差し替え
 *   };
 *
 * opts:
 *   track    - 曲オブジェクト ({id, artist, title, lyrics, coverPath, creatorNote, closings})
 *   user     - {id, email, nickname, birthday, registeredAt}
 *   today    - Date (省略時 new Date())
 *   features - feature flags (任意)
 *   frame    - 強制で枠を指定 (デバッグ用、省略可)
 *   forceClosingPool - 強制プール指定 (デバッグ用、省略可)
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

  function _formatPostmarkDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return { year: String(y), monthDay: m + '.' + day };
  }

  function _selectFrame(opts, track, user, today) {
    if (opts.frame) return opts.frame;
    if (window.TAMSICLetterFrames) {
      return window.TAMSICLetterFrames.pickFrame(track, user, today, opts.history, opts.features);
    }
    return 'A';
  }

  function _selectClosing(track, user, today, frame, features) {
    if (window.TAMSICLetterContent) {
      return window.TAMSICLetterContent.pickClosing(track, user, today, frame, features);
    }
    return { text: 'ありがとう。', idx: 0, pool: 'fallback' };
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
    const closingResult = _selectClosing(track, user, today, frame, features);

    const pm = _formatPostmarkDate(today);
    const banner = _buildBanner(frame, user, today);
    const nickname = (user && user.nickname) || 'listener';

    const coverHtml = track.coverPath
      ? '<img src="' + _esc(track.coverPath) + '" alt="' + _esc(track.title || '') + ' cover">'
      : '';

    const creatorNoteText = track.creatorNote || '';
    const creatorNoteHtml = creatorNoteText
      ? '<p class="creator-note"><span class="creator-label">Creator\'s note  ·  </span>' + _esc(creatorNoteText) + '</p>'
      : '';

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
          creatorNoteHtml +
          '<p class="closing" data-closing-idx="' + closingResult.idx + '" data-closing-pool="' + _esc(closingResult.pool) + '">' + _esc(closingResult.text) + '</p>' +
          '<p class="signature">— ' + _esc(artistDisp) + '</p>' +
          '<div class="footer">' +
            '<div class="airmail">Air Mail · TAMSIC</div>' +
            '<div class="postmark" aria-label="送信日 ' + _esc(pm.year) + '年' + _esc(pm.monthDay) + '">' +
              '<span>' + _esc(pm.year) + '</span><span>' + _esc(pm.monthDay) + '</span>' +
            '</div>' +
          '</div>' +
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

  /**
   * 同じ便箋の closing 一文だけを別抽選で差し替え (UI からの「↻ 別の一文」)
   */
  function reroll(letterEl, opts) {
    if (!letterEl) return;
    opts = opts || {};
    const track = opts.track || {};
    const user  = opts.user  || {};
    const today = opts.today || new Date();
    const frame = letterEl.getAttribute('data-frame') || 'A';
    const features = opts.features || {};
    const result = _selectClosing(track, user, today, frame, features);
    const closingEl = letterEl.querySelector('.closing');
    if (closingEl) {
      closingEl.textContent = result.text;
      closingEl.setAttribute('data-closing-idx', result.idx);
      closingEl.setAttribute('data-closing-pool', result.pool);
    }
    return result;
  }

  window.TAMSICLetter = {
    render: render,
    reroll: reroll,
    ARTIST_DISPLAY_NAME: ARTIST_DISPLAY_NAME
  };

})();
