/**
 * yt-slot.js — 公開予定パネル / YouTube 埋め込みの出し分け (v4.2.3.14)
 *
 * 使い方:
 *   HTML 側に <div class="yt-slot" data-yt-id="VIDEOID" data-release="2026-09-25T20:00:00+09:00"></div>
 *   を出力し、描画後に TAMSICYTSlot.refresh() を呼ぶ。
 *
 *   data-release が未来 → 公開予定日時のパネルを表示（日時は JST 固定表示）
 *   data-release が過去 / 未指定 → YouTube 埋め込みに切り替え
 *
 * 30 秒ごとに再判定するので、公開時刻をまたいでもページを開いたまま切り替わる。
 * lang.js の tamsic:langchange を購読して日英を追従。
 */
(function () {
  'use strict';

  var TXT = {
    ja: { label: '公開予定', note: 'この日時に YouTube で公開',
          live: 'YouTube で聴く', liveNote: 'クリックすると YouTube が開きます' },
    en: { label: 'Premiere', note: 'Available on YouTube at this time',
          live: 'Listen on YouTube', liveNote: 'Opens YouTube in a new tab' }
  };

  function injectStyles() {
    if (document.getElementById('tamsic-yt-slot-style')) return;
    var s = document.createElement('style');
    s.id = 'tamsic-yt-slot-style';
    s.textContent = [
      '.yt-slot{width:100%;}',
      '.yt-slot iframe{width:100%;aspect-ratio:16/9;border:none;display:block;}',
      '.yts-soon{width:100%;aspect-ratio:16/9;background:#fff;border:1px solid rgba(11,29,53,.14);',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:18px;}',
      '.yts-label{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#C4960E;}',
      '.yts-rule{width:44px;height:2px;background:#C4960E;}',
      '.yts-date{font-family:"Playfair Display",serif;font-style:italic;font-weight:700;',
      'font-size:clamp(22px,2.4vw,34px);color:#0B1D35;line-height:1.1;}',
      '.yts-time{font-size:12px;letter-spacing:.22em;color:#5B7FA0;}',
      '.yts-note{font-size:11px;color:#5B7FA0;letter-spacing:.06em;line-height:1.7;}',
      '.yts-link{width:100%;aspect-ratio:16/9;background:#fff;border:1px solid rgba(11,29,53,.14);',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;',
      'text-align:center;padding:18px;text-decoration:none;transition:border-color .2s,background .2s;}',
      '.yts-link:hover{border-color:#C4960E;background:#FDFCF8;}',
      '.ytl-icon{width:52px;height:52px;border-radius:50%;background:#C4960E;color:#fff;',
      'display:flex;align-items:center;justify-content:center;font-size:17px;padding-left:3px;}',
      '.ytl-label{font-size:12px;letter-spacing:.22em;color:#0B1D35;text-transform:uppercase;}',
      '.ytl-note{font-size:11px;color:#5B7FA0;letter-spacing:.06em;}'
    ].join('');
    document.head.appendChild(s);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function lang() {
    try {
      return (window.TAMSICLang && window.TAMSICLang.get()) === 'ja' ? 'ja' : 'en';
    } catch (e) { return 'ja'; }
  }

  // 閲覧者のタイムゾーンに関わらず日本時間で表示する
  function jstParts(d) {
    var j = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
    return {
      date: j.getFullYear() + '.' + pad(j.getMonth() + 1) + '.' + pad(j.getDate()),
      time: pad(j.getHours()) + ':' + pad(j.getMinutes())
    };
  }

  var timer = null;

  function fill(el) {
    var vid = el.getAttribute('data-yt-id');
    var rel = el.getAttribute('data-release');
    if (!vid) return false;
    var t = rel ? new Date(rel) : null;

    if (!t || isNaN(t.getTime()) || Date.now() >= t.getTime()) {
      if (el.getAttribute('data-state') !== 'live') {
        el.setAttribute('data-state', 'live');
        var G = TXT[lang()];
        el.innerHTML =
          '<a class="yts-link" href="https://youtu.be/' + vid +
            '" target="_blank" rel="noopener">' +
            '<span class="ytl-icon" aria-hidden="true">&#9654;</span>' +
            '<span class="ytl-label">' + G.live + '</span>' +
            '<span class="ytl-note">' + G.liveNote + '</span>' +
          '</a>';
      }
      return false;
    }

    var p = jstParts(t), L = TXT[lang()];
    el.setAttribute('data-state', 'soon');
    el.innerHTML =
      '<div class="yts-soon">' +
        '<div class="yts-label">' + L.label + '</div>' +
        '<div class="yts-rule"></div>' +
        '<div class="yts-date">' + p.date + '</div>' +
        '<div class="yts-time">' + p.time + ' JST</div>' +
        '<div class="yts-note">' + L.note + '</div>' +
      '</div>';
    return true;
  }

  function refresh() {
    injectStyles();
    var pending = false;
    document.querySelectorAll('.yt-slot[data-yt-id]').forEach(function (el) {
      if (fill(el)) pending = true;
    });
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending) timer = setTimeout(refresh, 30000);
  }

  document.addEventListener('tamsic:langchange', function () {
    document.querySelectorAll('.yt-slot[data-state]').forEach(function (el) {
      el.removeAttribute('data-state');
      fill(el);
    });
  });

  window.TAMSICYTSlot = { refresh: refresh };
})();
