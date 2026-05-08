/**
 * letter-frames.js — TAMSIC 歌詞便箋 枠定義 + 抽選アルゴリズム
 *
 * 設計書 §10.2 / §10.3 / §10.4.1 準拠 (v4.2.1)
 *
 * 枠 18種:
 *   基本 10  : A,B,C,D,E,F,G,H,I,J  (アーティスト別プールで選択)
 *   季節  4  : K(桜) L(雪) M(海) N(紅葉)  (期間中は全アーティスト共通プール追加)
 *   記念日2  : O(誕生日) P(周年)  (条件発動、強制)
 *   レア  2  : Q(Gold 1%) R(Silver 5%)  (独立抽選)
 *
 * Public API:
 *   window.TAMSICLetterFrames = {
 *     FRAMES, ARTIST_FRAMES,
 *     pickFrame(track, user, today, history, features),
 *     activeSeasonalFrames(today, features),
 *     isUserBirthday(user, today),
 *     isUserAnniversary(user, today),
 *     isUserBirthMonth(user, today),
 *     anniversaryYears(user, today)
 *   };
 */
(function(){

  // 枠定義
  const FRAMES = {
    A: { name: 'シンプル1色枠',          type: 'common',      cssClass: 'frame-a' },
    B: { name: 'ノート横罫線',           type: 'common',      cssClass: 'frame-b' },
    C: { name: 'エアメール',             type: 'common',      cssClass: 'frame-c' },
    D: { name: '和風二重罫',             type: 'common',      cssClass: 'frame-d' },
    E: { name: 'クラフト紙アンティーク', type: 'common',      cssClass: 'frame-e' },
    F: { name: 'ドット枠',               type: 'common',      cssClass: 'frame-f' },
    G: { name: '手書き波線枠',           type: 'common',      cssClass: 'frame-g' },
    H: { name: '五線譜薄柄',             type: 'common',      cssClass: 'frame-h' },
    I: { name: 'レコード溝模様',         type: 'common',      cssClass: 'frame-i' },
    J: { name: 'リボン端飾り',           type: 'common',      cssClass: 'frame-j' },

    // 季節限定 (期間中アクティブ)
    K: { name: '桃 (桜)',  type: 'seasonal',    cssClass: 'frame-k', season: { startMD: '03-01', endMD: '04-30' } },
    L: { name: '雪結晶',   type: 'seasonal',    cssClass: 'frame-l', season: { startMD: '12-01', endMD: '01-31' } },
    M: { name: '海・波',   type: 'seasonal',    cssClass: 'frame-m', season: { startMD: '07-01', endMD: '08-31' } },
    N: { name: '紅葉',     type: 'seasonal',    cssClass: 'frame-n', season: { startMD: '10-01', endMD: '11-30' } },

    // 記念日 (強制発動)
    O: { name: '誕生日',   type: 'anniversary', cssClass: 'frame-o', trigger: 'birthday' },
    P: { name: '周年',     type: 'anniversary', cssClass: 'frame-p', trigger: 'register-anniversary' },

    // レア
    Q: { name: 'ゴールド', type: 'rare',        cssClass: 'frame-q', rarity: 0.01 },
    R: { name: 'シルバー', type: 'rare',        cssClass: 'frame-r', rarity: 0.05 }
  };

  // アーティスト別 基本枠プール
  const ARTIST_FRAMES = {
    nono: ['A','B','C','F','G','J'],
    kiki: ['A','B','C','F','I','J'],
    gen:  ['A','C','D','E','H']
  };

  // ─────────────────────────────────────────
  // 日付判定ユーティリティ
  // ─────────────────────────────────────────
  function _mdString(d) {
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return m + '-' + day;
  }

  function _isMDInRange(md, startMD, endMD) {
    // 通常範囲 (startMD <= endMD): 03-01 〜 04-30
    // 越年範囲 (startMD > endMD):  12-01 〜 01-31 (年をまたぐ)
    if (startMD <= endMD) {
      return md >= startMD && md <= endMD;
    }
    return md >= startMD || md <= endMD;
  }

  function _parseUserDate(s) {
    // YYYY-MM-DD
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return null;
    return { year: +m[1], month: +m[2], day: +m[3] };
  }

  function isUserBirthday(user, today) {
    const b = _parseUserDate(user && user.birthday);
    if (!b) return false;
    return today.getMonth()+1 === b.month && today.getDate() === b.day;
  }

  function isUserBirthMonth(user, today) {
    const b = _parseUserDate(user && user.birthday);
    if (!b) return false;
    return today.getMonth()+1 === b.month;
  }

  function anniversaryYears(user, today) {
    // registeredAt が ISO8601 や YYYY-MM-DD の場合に対応
    const r = _parseUserDate(user && user.registeredAt);
    if (!r) return 0;
    const years = today.getFullYear() - r.year;
    return years > 0 ? years : 0;
  }

  function isUserAnniversary(user, today) {
    const r = _parseUserDate(user && user.registeredAt);
    if (!r) return false;
    if (today.getFullYear() === r.year) return false;  // 登録初年度は対象外
    return today.getMonth()+1 === r.month && today.getDate() === r.day;
  }

  // ─────────────────────────────────────────
  // 季節枠アクティブ判定
  // ─────────────────────────────────────────
  function activeSeasonalFrames(today, features) {
    if (features && features['letter-seasonal-frames'] === false) return [];
    const md = _mdString(today);
    const out = [];
    ['K','L','M','N'].forEach(function(id){
      const f = FRAMES[id];
      if (f && f.season && _isMDInRange(md, f.season.startMD, f.season.endMD)) {
        out.push(id);
      }
    });
    return out;
  }

  // ─────────────────────────────────────────
  // 抽選本体
  // ─────────────────────────────────────────
  function pickFrame(track, user, today, history, features) {
    today = today || new Date();
    history = history || { lastFrameOf: function(){ return null; } };
    features = features || {};

    // Priority 1: 記念日 (強制発動、feature flag があれば確認)
    const annivOn = features['letter-anniversary-frames'] !== false;
    if (annivOn && isUserBirthday(user, today))    return 'O';
    if (annivOn && isUserAnniversary(user, today)) return 'P';

    // Priority 2: レア独立抽選 (Q→R 独立、結果分布 Q=1.00% R=4.95%)
    const rareOn = features['letter-rare-frames'] !== false;
    if (rareOn) {
      if (Math.random() < FRAMES.Q.rarity) return 'Q';
      if (Math.random() < FRAMES.R.rarity) return 'R';
    }

    // Priority 3: 通常抽選プール (アーティスト + 季節)
    let pool = (ARTIST_FRAMES[track && track.artist] || ARTIST_FRAMES.nono).slice();
    pool = pool.concat(activeSeasonalFrames(today, features));

    // Priority 4: 直前と違う枠優先 (曲ごとの履歴)
    try {
      const prev = history.lastFrameOf(user, track);
      if (prev && pool.indexOf(prev) >= 0 && pool.length > 1) {
        pool = pool.filter(function(f){ return f !== prev; });
      }
    } catch (e) {}

    // ガード: 万一 pool が空ならシンプル枠 A をフォールバック
    if (!pool.length) return 'A';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  window.TAMSICLetterFrames = {
    FRAMES:                FRAMES,
    ARTIST_FRAMES:         ARTIST_FRAMES,
    pickFrame:             pickFrame,
    activeSeasonalFrames:  activeSeasonalFrames,
    isUserBirthday:        isUserBirthday,
    isUserBirthMonth:      isUserBirthMonth,
    isUserAnniversary:     isUserAnniversary,
    anniversaryYears:      anniversaryYears
  };

})();
