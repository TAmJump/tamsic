/**
 * letter-content.js — TAMSIC 歌詞便箋 closing プール + 抽選
 *
 * 設計書 §10.5 / §10.4.2 準拠 (v4.2.1)
 *
 * プール構成 (合計 31通り + 曲別3通り×N曲):
 *   COMMON_CLOSINGS         15通り (誰にでも使える)
 *   ARTIST_CLOSINGS.nono     5通り (弱め・優しめ)
 *   ARTIST_CLOSINGS.kiki     5通り (強め・勢い)
 *   ARTIST_CLOSINGS.gen      5通り (クール・短い)
 *   TRACK_CLOSINGS[trackId]  各曲3通り (tamsic-content.js の closings から取得)
 *   BIRTHDAY_CLOSINGS        5通り (枠O 強制発動時)
 *   ANNIVERSARY_CLOSINGS     3通り (枠P 強制発動時)
 *   BIRTHMONTH_CLOSINGS      3通り (誕生月で50%混入)
 *
 * Public API:
 *   window.TAMSICLetterContent = {
 *     COMMON_CLOSINGS, ARTIST_CLOSINGS, BIRTHDAY_CLOSINGS,
 *     ANNIVERSARY_CLOSINGS, BIRTHMONTH_CLOSINGS,
 *     pickClosing(track, user, today, frame, features)
 *   };
 */
(function(){

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

  // ─────────────────────────────────────────
  // ユーティリティ
  // ─────────────────────────────────────────
  function _random(arr) {
    if (!arr || !arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function _placeholder(template, user, years) {
    let s = String(template || '');
    const nick = (user && user.nickname) || 'listener';
    s = s.replace(/●●/g, nick);
    if (years != null) s = s.replace(/●年/g, years + '年');
    return s;
  }

  function _trackClosings(track) {
    if (track && Array.isArray(track.closings)) return track.closings;
    return [];
  }

  // ─────────────────────────────────────────
  // 抽選本体
  // ─────────────────────────────────────────
  /**
   * @param {object} track    - 曲オブジェクト (closings配列を持っていればプールに加算)
   * @param {object} user     - {nickname, birthday, registeredAt}
   * @param {Date}   today    - 抽選基準日
   * @param {string} frame    - pickFrame の結果 ('A'..'R')
   * @param {object} features - feature flags
   * @returns {{text:string, idx:number, pool:string}} 選ばれた一文 + メタ
   */
  function pickClosing(track, user, today, frame, features) {
    today = today || new Date();
    features = features || {};
    const F = window.TAMSICLetterFrames;

    // Priority 1: 誕生日枠 → 専用プール
    if (frame === 'O') {
      const t = _random(BIRTHDAY_CLOSINGS);
      return { text: _placeholder(t, user), idx: BIRTHDAY_CLOSINGS.indexOf(t), pool: 'birthday' };
    }

    // Priority 2: 周年枠 → 専用プール (●年 を実年数に置換)
    if (frame === 'P') {
      const t = _random(ANNIVERSARY_CLOSINGS);
      const years = (F && F.anniversaryYears) ? F.anniversaryYears(user, today) : 1;
      return { text: _placeholder(t, user, years), idx: ANNIVERSARY_CLOSINGS.indexOf(t), pool: 'anniversary' };
    }

    // Priority 3: 誕生月で 50% 混入 (枠が記念日でなくても)
    const inBirthMonth = F && F.isUserBirthMonth && F.isUserBirthMonth(user, today);
    if (inBirthMonth && Math.random() < 0.5) {
      const t = _random(BIRTHMONTH_CLOSINGS);
      return { text: _placeholder(t, user), idx: BIRTHMONTH_CLOSINGS.indexOf(t), pool: 'birthmonth' };
    }

    // Priority 4: 通常抽選 (共通 + アーティスト別 + 曲別)
    const artistKey = (track && track.artist) || 'nono';
    const artistPool = ARTIST_CLOSINGS[artistKey] || [];
    const trackPool = _trackClosings(track);
    const pool = COMMON_CLOSINGS.concat(artistPool).concat(trackPool);
    const t = _random(pool);
    return { text: _placeholder(t, user), idx: pool.indexOf(t), pool: 'common' };
  }

  window.TAMSICLetterContent = {
    COMMON_CLOSINGS:      COMMON_CLOSINGS,
    ARTIST_CLOSINGS:      ARTIST_CLOSINGS,
    BIRTHDAY_CLOSINGS:    BIRTHDAY_CLOSINGS,
    ANNIVERSARY_CLOSINGS: ANNIVERSARY_CLOSINGS,
    BIRTHMONTH_CLOSINGS:  BIRTHMONTH_CLOSINGS,
    pickClosing:          pickClosing
  };

})();
