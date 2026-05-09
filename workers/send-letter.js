/**
 * workers/send-letter.js — TAMSIC レター送信 Cloudflare Worker
 *
 * 設計書 §10.9 / §10.10 / §10.14 (v4.2.1) 準拠
 *
 * 役割:
 *   1. Cognito のアクセストークンを Authorization ヘッダで受け取る
 *   2. /oauth2/userInfo で本人確認 + email/sub を取得
 *   3. 抽選結果 (frame, closing) を Worker 内でも検証 (Web 側を信用しない)
 *   4. メール HTML を組み立てて Resend 経由で送信
 *   5. 成否を返却
 *
 * 重要なセキュリティ原則:
 *   - 抽選はクライアント表示用と独立に Worker 側で行う (Web 側のレア当選を強制移送)
 *   - letterHistory への記録は Web 側で行う (Cognito 属性更新には refresh_token が必要)
 *   - 送信回数上限 (1曲1回) は Web 側 + Cognito letterHistory + Worker 側 listenHistory の三重チェック
 *
 * 環境変数 (Cloudflare Worker secret):
 *   RESEND_API_KEY        - Resend API key (re_xxxxx...)
 *   FROM_ADDRESS          - 送信元 (例: 'TAMSIC <letter@tamjump.com>')
 *   ALLOWED_ORIGINS       - カンマ区切りの許可 Origin (例: 'https://tamsic.tamjump.com')
 *   COGNITO_DOMAIN        - 'ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com'
 *
 * デプロイ:
 *   wrangler deploy
 *
 * 呼び出し:
 *   POST https://send-letter.<your>.workers.dev/
 *   Headers:
 *     Authorization: Bearer <cognito_access_token>
 *     Content-Type: application/json
 *   Body:
 *     {
 *       "trackId":     "nono-004",
 *       "trackTitle":  "ぎりぎりだよ。",
 *       "trackArtist": "nono",
 *       "lyrics":      "上手に笑うことだけ\n...",
 *       "creatorNote": "強くならなきゃって、何度も自分に言い聞かせた...",
 *       "trackClosings": ["●●さん、ぎりぎりでも...", ...],   // 曲別 closing 候補
 *       "coverPath":   "https://tamsic.tamjump.com/assets/images/...",
 *       "nickname":    "JIN",
 *       "userBirthday":     "1990-05-08",                  // (省略可) 記念日判定用
 *       "userRegisteredAt": "2025-05-08"                   // (省略可)
 *     }
 *   Response 200:
 *     {
 *       "ok": true,
 *       "frame": "K",
 *       "closingText": "JINさん、ありがとう。",
 *       "closingIdx": 3,
 *       "closingPool": "common",
 *       "messageId": "<resend message id>",
 *       "sentDate":  "2026-05-08T14:23:00Z",
 *       "recipientHash": "abc123..."
 *     }
 */

// ─────────────────────────────────────────
// CORS
// ─────────────────────────────────────────
function corsHeaders(origin, allowed) {
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin':  ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age':       '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      extraHeaders || {}
    )
  });
}

// ─────────────────────────────────────────
// 抽選 (letter-frames.js / letter-content.js とロジック共有)
// ─────────────────────────────────────────
const FRAMES = {
  K: { season: { startMD: '03-01', endMD: '04-30' } },
  L: { season: { startMD: '12-01', endMD: '01-31' } },
  M: { season: { startMD: '07-01', endMD: '08-31' } },
  N: { season: { startMD: '10-01', endMD: '11-30' } }
};

const ARTIST_FRAMES = {
  nono: ['A','B','C','F','G','J'],
  kiki: ['A','B','C','F','I','J'],
  gen:  ['A','C','D','E','H']
};

const COMMON_CLOSINGS = [
  '●●さん、ありがとう。',
  '●●さんに届いたなら、それでいい。',
  'また、●●さんに聴いて欲しいな。',
  '●●さんがいてくれてよかった。',
  '●●さんの今日が、少しでも軽くなりますように。',
  '●●さん、聴いてくれて嬉しい。',
  '今日も●●さん、お疲れさま。',
  '●●さん、また会えますように。',
  '●●さんへ、心からありがとう。',
  '●●さんと、また同じ夜を。',
  '●●さんの隣で、もう一度歌わせて。',
  '●●さん、聴いてくれてうれしかった。',
  '●●さん、ちゃんと伝わったかな。',
  '●●さん、声にしてよかったって思えた。',
  '●●さん、ここまで読んでくれてありがとう。'
];

const ARTIST_CLOSINGS = {
  nono: [
    '●●さんが大丈夫って思える日になりますように。',
    '●●さんの今日に、そっと寄り添えたら。',
    '●●さんの夜が、少しだけ静かでありますように。',
    '●●さん、ぎりぎりでも、ここにいてくれてありがとう。',
    '●●さんへ。声にできなかった分、歌いました。'
  ],
  kiki: [
    '●●、聴いてくれて燃えた。',
    '●●、また一緒に叫ぼう。',
    '●●に届いた、それだけでいい。',
    '●●、止まれない夜にこの曲を。',
    '●●、ぶつけきれなかった分、歌で。'
  ],
  gen: [
    '●●、また会おう。',
    '●●、覚えておけ。',
    '●●、その先へ。',
    '●●、声は枯れない。',
    '●●、燃え尽きるまで。'
  ]
};

const BIRTHDAY_CLOSINGS = [
  '●●さん、誕生日おめでとう。',
  '●●さん、産まれてきてくれてありがとう。',
  '●●さんの一年が、優しい音楽で満たされますように。',
  '●●さん、Happy Birthday。今年もよろしくね。',
  '●●さんの新しい一年に、この歌を。'
];

const ANNIVERSARY_CLOSINGS = [
  '●●さん、出会って●年。ありがとう。',
  '●●さんと過ごせた一年に、感謝を。',
  '●●さん、これからも隣でうたわせてね。'
];

const BIRTHMONTH_CLOSINGS = [
  '●●さん、誕生月おめでとう。',
  '●●さんの誕生月、素敵な一ヶ月になりますように。',
  '●●さん、特別な一ヶ月に、この一曲。'
];

function _mdString(d) {
  return String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
}
function _isMDInRange(md, startMD, endMD) {
  if (startMD <= endMD) return md >= startMD && md <= endMD;
  return md >= startMD || md <= endMD;
}
function _activeSeasonal(today) {
  const md = _mdString(today);
  return Object.keys(FRAMES).filter(id => _isMDInRange(md, FRAMES[id].season.startMD, FRAMES[id].season.endMD));
}
function _parseUserDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}
function _isBirthday(birthday, today) {
  const b = _parseUserDate(birthday);
  if (!b) return false;
  return today.getUTCMonth()+1 === b.month && today.getUTCDate() === b.day;
}
function _isAnniversary(registeredAt, today) {
  const r = _parseUserDate(registeredAt);
  if (!r) return false;
  if (today.getUTCFullYear() === r.year) return false;
  return today.getUTCMonth()+1 === r.month && today.getUTCDate() === r.day;
}
function _isBirthMonth(birthday, today) {
  const b = _parseUserDate(birthday);
  if (!b) return false;
  return today.getUTCMonth()+1 === b.month;
}
function _anniversaryYears(registeredAt, today) {
  const r = _parseUserDate(registeredAt);
  if (!r) return 0;
  return Math.max(0, today.getUTCFullYear() - r.year);
}

function pickFrame(track, user, today) {
  if (_isBirthday(user.birthday, today))           return 'O';
  if (_isAnniversary(user.registeredAt, today))    return 'P';
  if (Math.random() < 0.01) return 'Q';
  if (Math.random() < 0.05) return 'R';
  let pool = (ARTIST_FRAMES[track.artist] || ARTIST_FRAMES.nono).slice();
  pool = pool.concat(_activeSeasonal(today));
  if (!pool.length) return 'A';
  return pool[Math.floor(Math.random() * pool.length)];
}

function _placeholder(t, nick, years) {
  let s = String(t || '').replace(/●●/g, nick || 'listener');
  if (years != null) s = s.replace(/●年/g, years + '年');
  return s;
}
function _random(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function pickClosing(track, user, today, frame) {
  const nick = user.nickname || 'listener';
  if (frame === 'O') {
    const t = _random(BIRTHDAY_CLOSINGS);
    return { text: _placeholder(t, nick), idx: BIRTHDAY_CLOSINGS.indexOf(t), pool: 'birthday' };
  }
  if (frame === 'P') {
    const t = _random(ANNIVERSARY_CLOSINGS);
    const yrs = _anniversaryYears(user.registeredAt, today) || 1;
    return { text: _placeholder(t, nick, yrs), idx: ANNIVERSARY_CLOSINGS.indexOf(t), pool: 'anniversary' };
  }
  if (_isBirthMonth(user.birthday, today) && Math.random() < 0.5) {
    const t = _random(BIRTHMONTH_CLOSINGS);
    return { text: _placeholder(t, nick), idx: BIRTHMONTH_CLOSINGS.indexOf(t), pool: 'birthmonth' };
  }
  const artistPool = ARTIST_CLOSINGS[track.artist] || [];
  const trackPool = Array.isArray(track.closings) ? track.closings : [];
  const pool = COMMON_CLOSINGS.concat(artistPool).concat(trackPool);
  const t = _random(pool);
  return { text: _placeholder(t, nick), idx: pool.indexOf(t), pool: 'common' };
}

// ─────────────────────────────────────────
// メール HTML テンプレート (インライン CSS)
// 設計書 §10.10 準拠
// ─────────────────────────────────────────
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));
}

const FRAME_INLINE_STYLES = {
  // メーラー対応のため最低限の枠スタイルだけインライン化。
  // 細かいパターンは CSS の background-image (data URL) を使う。
  A: 'border:2px solid {color};',
  B: 'border-top:6px solid {color};border-bottom:1px solid {color};',
  C: 'border:14px solid;border-image:repeating-linear-gradient(45deg,{color} 0 12px,#FCFAF5 12px 24px,#1F1F1F 24px 36px,#FCFAF5 36px 48px) 14;',
  D: 'border-top:1px solid {color};border-bottom:1px solid {color};padding:5px 0;',
  E: 'background:#E8DFC9;border:1px solid #B8A988;',
  F: 'border:3px dotted {color};padding:4px;',
  G: 'border:2px solid {color};',
  H: 'border:1px solid {color};',
  I: 'border:2px solid {color};',
  J: 'border:1px solid {color};',
  K: 'border:1px solid #ED93B1;background:linear-gradient(135deg,#FCFAF5 0%,#FCFAF5 70%,rgba(244,192,209,0.3) 100%);',
  L: 'border:1px solid #85B7EB;background:linear-gradient(135deg,#FCFAF5 0%,#FCFAF5 70%,rgba(181,212,244,0.3) 100%);',
  M: 'border:1px solid #378ADD;',
  N: 'border:1px solid #D85A30;background:linear-gradient(180deg,#FCFAF5 0%,rgba(245,196,179,0.15) 100%);',
  O: 'border:3px solid #E24B4A;background:linear-gradient(135deg,#FFFCF5 0%,#FCFAF5 50%,#FFF5F5 100%);',
  P: 'border:2px solid #993556;background:linear-gradient(135deg,#FFF8F8 0%,#FCFAF5 50%,#FFF8FB 100%);',
  Q: 'border:8px solid;border-image:repeating-linear-gradient(45deg,#C9A03A 0 4px,#F4D26A 4px 8px,#C9A03A 8px 12px,#8A6F1F 12px 16px) 8;background:linear-gradient(135deg,#FCFAF5 0%,#FFF8E1 50%,#FCFAF5 100%);',
  R: 'border:6px solid;border-image:repeating-linear-gradient(45deg,#B5B7BC 0 4px,#E8E9EC 4px 8px,#B5B7BC 8px 12px,#6E707A 12px 16px) 6;background:linear-gradient(135deg,#FCFAF5 0%,#F5F6F8 50%,#FCFAF5 100%);'
};

const ARTIST_DISPLAY = { nono: 'no-no', kiki: 'kiki', gen: 'gEN' };
const ARTIST_COLORS  = { nono: '#0099CC', kiki: '#C85A72', gen: '#4A4540' };
const ARTIST_FONTS   = {
  nono: "'Zen Kurenaido', serif",
  kiki: "'Hachi Maru Pop', sans-serif",
  gen:  "'Yuji Syuku', serif"
};

function lyricsToParagraphs(text) {
  if (!text) return '';
  return String(text).split(/\n\s*\n/).map(p => {
    const lines = p.split('\n').map(l => escHtml(l.trim())).filter(Boolean);
    if (!lines.length) return '';
    return '<p style="margin:0 0 1.2em;">' + lines.join('<br>') + '</p>';
  }).join('');
}

function buildMailHtml(opts) {
  const { track, frame, closingText, nickname, sentDate } = opts;
  const artistDisp = ARTIST_DISPLAY[track.artist] || track.artist;
  const color = ARTIST_COLORS[track.artist] || '#0099CC';
  const font = ARTIST_FONTS[track.artist] || "'Zen Kurenaido', serif";
  const frameStyle = (FRAME_INLINE_STYLES[frame] || '').replace(/\{color\}/g, color);

  const banner = (frame === 'O')
    ? `<div style="background:linear-gradient(90deg,#E24B4A 0%,#F0997B 50%,#E24B4A 100%);color:#fff;text-align:center;padding:14px;font-family:'Playfair Display',serif;font-style:italic;font-size:18px;letter-spacing:.2em;margin:24px -44px 18px;">★ HAPPY BIRTHDAY, ${escHtml(nickname)} ★</div>`
    : (frame === 'P')
    ? `<div style="background:#993556;color:#FBEAF0;text-align:center;padding:14px;font-family:'Playfair Display',serif;font-style:italic;font-size:18px;letter-spacing:.2em;margin:24px -44px 18px;">— THANK YOU FOR ${opts.anniversaryYears||1} YEAR${(opts.anniversaryYears===1)?'':'S'} —</div>`
    : '';

  const cover = track.coverPath
    ? `<div style="margin:0 -44px 22px;"><img src="${escHtml(track.coverPath)}" alt="${escHtml(track.title)} cover" style="display:block;width:100%;max-width:680px;aspect-ratio:5/2;object-fit:cover;"></div>`
    : '';

  const noteHtml = track.creatorNote
    ? `<p style="margin:24px 0 0;font-family:${font};font-size:14.5px;line-height:1.95;color:#3A3A3A;"><span style="font-size:9px;letter-spacing:.3em;color:#888;text-transform:uppercase;font-family:system-ui,sans-serif;">Creator's note  ·  </span>${escHtml(track.creatorNote)}</p>`
    : '';

  const yyyy = String(sentDate.getUTCFullYear());
  const mmdd = String(sentDate.getUTCMonth()+1).padStart(2,'0') + '.' + String(sentDate.getUTCDate()).padStart(2,'0');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(artistDisp)} — ${escHtml(track.title)}</title>
<style>
@import url('https://cdn.jsdelivr.net/npm/@fontsource/zen-kurenaido@5/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/hachi-maru-pop@5/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/yuji-syuku@5/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css');
</style>
</head>
<body style="margin:0;background:#EEE9DF;padding:30px 12px;font-family:system-ui,sans-serif;">
<div style="max-width:680px;margin:0 auto;background:#FCFAF5;${frameStyle}">
  <div style="padding:0 44px 28px;position:relative;">
    ${banner}
    ${cover}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #D6CFC0;padding-bottom:14px;margin-bottom:20px;">
      <tr>
        <td style="width:33%;">
          <div style="font-size:10px;letter-spacing:.25em;color:#888;text-transform:uppercase;margin-bottom:6px;">From</div>
          <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:24px;color:#1F1F1F;">${escHtml(artistDisp)}</div>
        </td>
        <td style="width:40%;">
          <div style="font-size:10px;letter-spacing:.25em;color:#888;text-transform:uppercase;margin-bottom:6px;">Track</div>
          <div style="font-family:${font};font-size:20px;color:#1F1F1F;">${escHtml(track.title)}</div>
        </td>
        <td style="width:27%;">
          <div style="font-size:10px;letter-spacing:.25em;color:#888;text-transform:uppercase;margin-bottom:6px;">Dear</div>
          <div style="font-family:${font};font-size:20px;color:#1F1F1F;">${escHtml(nickname)}</div>
        </td>
      </tr>
    </table>
    <div style="font-family:${font};font-size:17px;line-height:2.0;color:#1F1F1F;">${lyricsToParagraphs(track.lyrics)}</div>
    ${noteHtml}
    <p style="margin:22px 0 4px;font-family:${font};font-size:18px;color:#1F1F1F;text-align:right;">${escHtml(closingText)}</p>
    <p style="margin:4px 0 0;font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:#1F1F1F;text-align:right;">— ${escHtml(artistDisp)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px dashed #D6CFC0;padding-top:14px;">
      <tr>
        <td style="font-family:system-ui,sans-serif;font-size:10px;letter-spacing:.3em;color:#999;text-transform:uppercase;">Air Mail · TAMSIC</td>
        <td style="text-align:right;">
          <div style="display:inline-block;width:62px;height:62px;border-radius:50%;border:2.5px solid #C8252C;text-align:center;padding-top:14px;box-sizing:border-box;font-family:'Playfair Display',serif;font-style:italic;font-size:11px;line-height:1.15;color:#C8252C;opacity:.92;transform:rotate(-12deg);">
            ${yyyy}<br>${mmdd}
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>
<div style="max-width:680px;margin:18px auto 0;text-align:center;font-family:system-ui,sans-serif;font-size:11px;color:#999;line-height:1.6;">
  TAMSIC — このメールは ${escHtml(opts.email)} 宛に、フル試聴アンロックの記念レターとして送信されました。<br>
  Web版で開く: <a href="https://tamsic.tamjump.com/" style="color:#999;">tamsic.tamjump.com</a> · 無断転載禁止
</div>
</body></html>`;
}

// ─────────────────────────────────────────
// SHA-256
// ─────────────────────────────────────────
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─────────────────────────────────────────
// Cognito 経由のユーザー検証
// ─────────────────────────────────────────
async function verifyUser(accessToken, env) {
  const res = await fetch(`https://${env.COGNITO_DOMAIN}/oauth2/userInfo`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

// ─────────────────────────────────────────
// メイン handler
// ─────────────────────────────────────────
export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://tamsic.tamjump.com').split(',').map(s => s.trim());
    const origin  = request.headers.get('Origin') || '';
    const cors    = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST')    return jsonResponse({ ok:false, error:'method-not-allowed' }, 405, cors);

    // 1. 認証
    const auth = request.headers.get('Authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonResponse({ ok:false, error:'unauthorized' }, 401, cors);
    const accessToken = m[1];
    const userInfo = await verifyUser(accessToken, env);
    if (!userInfo || !userInfo.email) return jsonResponse({ ok:false, error:'invalid-token' }, 401, cors);

    // 2. 入力受け取り
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok:false, error:'bad-json' }, 400, cors); }

    if (!body.trackId || !body.trackTitle || !body.trackArtist || !body.lyrics) {
      return jsonResponse({ ok:false, error:'missing-fields' }, 400, cors);
    }

    // 3. 抽選
    const today = new Date();
    const user  = {
      email:        userInfo.email,
      nickname:     String(body.nickname || '').slice(0, 40) || 'listener',
      birthday:     body.userBirthday || '',
      registeredAt: body.userRegisteredAt || ''
    };
    const track = {
      id:        body.trackId,
      artist:    body.trackArtist,
      title:     body.trackTitle,
      lyrics:    body.lyrics,
      creatorNote: body.creatorNote || '',
      coverPath: body.coverPath || '',
      closings:  Array.isArray(body.trackClosings) ? body.trackClosings : []
    };
    const frame = pickFrame(track, user, today);
    const closingResult = pickClosing(track, user, today, frame);
    const annivYears = _anniversaryYears(user.registeredAt, today);

    // 4. メール HTML 構築
    const sentDate = today;
    const html = buildMailHtml({
      track, frame,
      closingText:      closingResult.text,
      nickname:         user.nickname,
      sentDate,
      anniversaryYears: annivYears,
      email:            user.email
    });

    // 5. Resend 送信
    const subject = `${ARTIST_DISPLAY[track.artist] || track.artist} from TAMSIC — ${track.title}`;
    let messageId = '';
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from:    env.FROM_ADDRESS || 'TAMSIC <letter@tamjump.com>',
          to:      [user.email],
          subject,
          html,
          headers: { 'X-Entity-Ref': `tamsic-letter-${track.id}` }
        })
      });
      const data = await r.json();
      if (!r.ok) {
        console.error('Resend error:', data);
        return jsonResponse({ ok:false, error:'resend-failed', detail: data }, 502, cors);
      }
      messageId = data.id || '';
    } catch (e) {
      return jsonResponse({ ok:false, error:'resend-exception', detail: String(e) }, 502, cors);
    }

    // 6. 履歴用ハッシュ
    const recipientHash = (await sha256Hex(user.email)).slice(0, 16);

    return jsonResponse({
      ok:            true,
      frame,
      closingText:   closingResult.text,
      closingIdx:    closingResult.idx,
      closingPool:   closingResult.pool,
      messageId,
      sentDate:      sentDate.toISOString(),
      recipientHash
    }, 200, cors);
  }
};
