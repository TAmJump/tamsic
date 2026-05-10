/**
 * letter-send.js — TAMSIC レター送信フロントAPI
 *
 * 設計書 §10.9 (v4.2.1) 準拠
 *
 * 責務:
 *   1. ユーザーから送信トリガを受ける (nickname/email 確認モーダル経由)
 *   2. Cognito access_token を Authorization に詰めて Worker を呼ぶ
 *   3. 成功時: letterHistory に記録 (Cognito custom 属性)
 *   4. UI 更新を発火 (受信済みボタンに切替)
 *
 * Public API:
 *   window.TAMSICSendLetter = {
 *     ENDPOINT,
 *     send(track, opts) → Promise<{ok, frame, closingText, ...}>
 *     showConfirmModal(track, user, onConfirm)
 *     requestLetter(track, user)  ← 受信ボタンから呼ぶ高レベル API
 *   };
 */
(function(){

  // 本番デプロイ済み Worker URL
  // (wrangler deploy 時に Cloudflare が払い出した値)
  // 万一カスタムドメインに切り替える場合は、各HTMLで letter-send.js 読込前に
  // <script>window.TAMSIC_LETTER_ENDPOINT = 'https://...';</script> を書けば上書き可能。
  const ENDPOINT = (window.TAMSIC_LETTER_ENDPOINT || 'https://tamsic-send-letter.animalb001.workers.dev/');

  // ─────────────────────────────────────────
  // Worker 呼び出し
  // ─────────────────────────────────────────
  async function send(track, opts) {
    opts = opts || {};
    // v4.2.1.5: id_token を Bearer で送る (access_token は openid scope 必須で
    // login.html の SDK 直叩きフローで scope が含まれないため)
    const idToken = localStorage.getItem('tamsic_id_token');
    const accessToken = localStorage.getItem('tamsic_access_token');
    const bearer = idToken || accessToken;
    if (!bearer) {
      return { ok: false, error: 'not-logged-in' };
    }

    const profile = (typeof window.TAMSICAuth !== 'undefined' && window.TAMSICAuth.fetchUserProfile)
      ? await window.TAMSICAuth.fetchUserProfile() : null;

    const nickname = opts.nickname || (profile && profile.nickname) || 'listener';
    const userBirthday     = (profile && profile.birthday) || '';
    const userRegisteredAt = (profile && profile.registeredAt) || '';

    // Track の coverPath を絶対 URL にする (メーラー側で表示するため)
    let coverAbs = track.coverPath || '';
    if (coverAbs && !/^https?:/i.test(coverAbs)) {
      coverAbs = (window.location.origin || 'https://tamsic.tamjump.com') + '/' + coverAbs.replace(/^\/+/, '');
    }

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method:  'POST',
        headers: {
          'Authorization': 'Bearer ' + bearer,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          trackId:           track.id,
          trackTitle:        track.title,
          trackArtist:       track.artist,
          lyrics:            track.lyrics || '',
          creatorNote:       track.creatorNote || '',
          coverPath:         coverAbs,
          trackClosings:     Array.isArray(track.closings) ? track.closings : [],
          nickname:          nickname,
          userBirthday:      userBirthday,
          userRegisteredAt:  userRegisteredAt
        })
      });
    } catch (e) {
      return { ok: false, error: 'network', detail: String(e) };
    }

    let data = null;
    try { data = await res.json(); } catch (e) {}

    if (!res.ok || !data || !data.ok) {
      return { ok: false, error: (data && data.error) || ('status-' + res.status), detail: data };
    }

    // 4. letterHistory に記録 (Cognito 属性)
    if (typeof window.TAMSICAuth !== 'undefined' && window.TAMSICAuth.appendLetterHistory) {
      try {
        await window.TAMSICAuth.appendLetterHistory({
          trackId:       track.id,
          frameId:       data.frame,
          closingIdx:    data.closingIdx,
          closingPool:   data.closingPool,
          sentDate:      data.sentDate,
          recipientHash: data.recipientHash
        });
      } catch (e) {
        console.warn('[letter-send] appendLetterHistory failed:', e);
      }
    }

    // UI 更新イベント
    window.dispatchEvent(new CustomEvent('tamsic:letter-sent', {
      detail: { trackId: track.id, frame: data.frame, sentDate: data.sentDate }
    }));

    return data;
  }

  // ─────────────────────────────────────────
  // 確認モーダル (nickname 入力 + 送信先メアド表示)
  // ─────────────────────────────────────────
  function showConfirmModal(track, user, onConfirm) {
    // 既存があれば除去
    const old = document.getElementById('tamsic-letter-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tamsic-letter-modal';
    Object.assign(overlay.style, {
      position:     'fixed',
      inset:        '0',
      background:   'rgba(0,0,0,0.55)',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      zIndex:       '10000',
      fontFamily:   'system-ui, sans-serif'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background:   '#FCFAF5',
      maxWidth:     '440px',
      width:        '90%',
      padding:      '32px 28px',
      borderRadius: '6px',
      boxShadow:    '0 24px 60px rgba(0,0,0,0.25)',
      color:        '#1F1F1F'
    });

    const currentNick = (user && user.nickname) || '';
    const email       = (user && user.email)    || '';
    const trackTitle  = (track && track.title)  || '';

    card.innerHTML = `
      <div style="font-size:11px;letter-spacing:.3em;color:#888;text-transform:uppercase;margin-bottom:8px;">Letter Receive</div>
      <h2 style="font-size:18px;font-weight:600;margin:0 0 14px;">この手紙をメールで受け取りますか？</h2>
      <p style="font-size:13px;line-height:1.7;color:#555;margin:0 0 20px;">
        登録メールアドレス宛に <strong>${esc(trackTitle)}</strong> の歌詞便箋をお届けします。<br>
        便箋の枠と結びの一文は、毎回ランダムに選ばれます。
      </p>

      <label style="display:block;font-size:11px;letter-spacing:.2em;color:#888;text-transform:uppercase;margin-bottom:6px;">Dear ●● の名前</label>
      <input id="tamsic-modal-nick" type="text" maxlength="40" value="${esc(currentNick)}" placeholder="JIN" style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1px solid #D6CFC0;background:#fff;margin-bottom:18px;font-family:system-ui,sans-serif;">

      <div style="font-size:11px;letter-spacing:.2em;color:#888;text-transform:uppercase;margin-bottom:4px;">送信先</div>
      <div style="font-size:14px;color:#333;margin-bottom:24px;word-break:break-all;">${esc(email)}</div>

      <div id="tamsic-modal-status" style="font-size:12px;color:#C8252C;min-height:18px;margin-bottom:10px;"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="tamsic-modal-cancel" type="button" style="padding:10px 18px;font-size:13px;background:#fff;border:1px solid #D6CFC0;color:#666;cursor:pointer;border-radius:3px;">キャンセル</button>
        <button id="tamsic-modal-send"   type="button" style="padding:10px 22px;font-size:13px;background:#1F1F1F;color:#fff;border:none;cursor:pointer;border-radius:3px;letter-spacing:.05em;">送信する</button>
      </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const nickInput = card.querySelector('#tamsic-modal-nick');
    const status    = card.querySelector('#tamsic-modal-status');
    const sendBtn   = card.querySelector('#tamsic-modal-send');
    const cancelBtn = card.querySelector('#tamsic-modal-cancel');

    function close() { overlay.remove(); }
    cancelBtn.onclick = close;
    overlay.onclick = function(e) { if (e.target === overlay) close(); };

    sendBtn.onclick = async function() {
      const nick = (nickInput.value || '').trim();
      if (!nick) {
        status.textContent = 'お名前を入力してください。';
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = '送信中…';
      status.textContent = '';
      try {
        // nickname を Cognito にも保存 (次回以降の自動入力用)
        if (typeof window.TAMSICAuth !== 'undefined' && window.TAMSICAuth.setUserNickname && nick !== currentNick) {
          await window.TAMSICAuth.setUserNickname(nick);
        }
        const result = await onConfirm(nick);
        if (result && result.ok) {
          card.innerHTML = `
            <div style="text-align:center;padding:24px 0;">
              
              <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">送信しました</h2>
              <p style="font-size:13px;line-height:1.7;color:#555;margin:0 0 24px;">
                ${esc(email)} 宛に<br>
                <strong>${esc(trackTitle)}</strong> のレターをお届けしました。<br>
                数分以内に届きます。受信箱をご確認ください。
              </p>
              <button id="tamsic-modal-close" type="button" style="padding:10px 22px;font-size:13px;background:#1F1F1F;color:#fff;border:none;cursor:pointer;border-radius:3px;">閉じる</button>
            </div>
          `;
          card.querySelector('#tamsic-modal-close').onclick = close;
        } else {
          sendBtn.disabled = false;
          sendBtn.textContent = '送信する';
          status.textContent = '送信に失敗しました: ' + ((result && result.error) || 'unknown');
        }
      } catch (e) {
        sendBtn.disabled = false;
        sendBtn.textContent = '送信する';
        status.textContent = 'エラー: ' + String(e);
      }
    };

    setTimeout(() => nickInput.focus(), 50);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  // ─────────────────────────────────────────
  // 受信ボタンから呼ぶ高レベル API
  // ─────────────────────────────────────────
  async function requestLetter(track, user) {
    if (!track || !track.id) return;
    user = user || {};

    // v4.2.2.1: 同じ曲でも何度でも受信可能に。
    // 便箋の枠と closing は毎回ランダム抽選 (Worker 側) なので、
    // 受け取るたび違う便箋が届く = コレクション欲を刺激するプレミア体験。
    // フル試聴解放 (30 coin) を伴うため乱発リスクは限定的。
    // 旧 v4.2.1 の hasReceivedLetter チェックは削除済み。

    // 確認モーダル → OK なら送信
    showConfirmModal(track, user, async function(nickname) {
      return await send(track, { nickname });
    });
  }

  window.TAMSICSendLetter = {
    ENDPOINT:         ENDPOINT,
    send:             send,
    showConfirmModal: showConfirmModal,
    requestLetter:    requestLetter
  };

})();
