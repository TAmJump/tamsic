# TAMSIC TODO v4

**最終更新**: 2026-09-16 (セッション⑩ 終了時点、v4.2.3.4)
**前版**: TAMSIC_TODO_v3.md (Phase G 完了直後)

---

## 🔴 最優先・セッション⑩ で決定した新方針

### Phase R: TAMSIC リニューアル (5 本柱)

**大きな方針転換**: サイト有料化廃止 + YouTube フル尺公開 + 英語プライマリ + アーティスト募集プラットフォーム化 + 将来のグッズ販売 + 医療支援。詳細方針は `docs/TAMSIC_リニューアル計画書_v1.md` を必ず先に読むこと。

**セッション⑩ 内で Phase R1 の告知系 + Phase R3 の骨組み + TAMSIC 名義アーティストページを実装完了 (v4.2.3.4)**。以下の各サブフェーズにチェックボックスで完了/未完了を明示。

#### Phase R1: 準備・告知 (セッション⑩ で告知系実装済、残タスクは順次)
- ✅ リニューアル告知バナー実装 (index.html 最上部、ヒーロー占領型、深いネイビー #0B1D35 + Gold)
- ✅ renewal.html 詳細ストーリーページ (4 章構成 + Thanks、EN プライマリ + JP)
- ✅ news 記事 news-renewal-2026 追加、news.html レンダリング改修 (href リンク化)
- ✅ Kickstarter バナー削除 (方針: TAMSIC で告知しない、docs/TAMSIC_リニューアル計画書_v1.md §2-7)
- ✅ TAMJ vision-map 導線 (renewal.html §03 の callout をネイビー統一で強調)
- ⬜ リニューアル告知文の英語版・日本語版の最終文言確定 (現状は Claude 素案、TAmJump 仕上げ待ち)
- ⬜ 転用レート最終決定 (候補: 1 coin = ¥100 / ¥10 / ¥2、次セッションで確定)
- ⬜ 既存 4 名の coin 残高確認 (2 名 inochitsun.../8lightfull... の残高未確認、TAmJump が AWS Console で確認)
- ⬜ 告知メール送付 (Resend 経由、既存 4 名 + SNS フォロワー)
- ⬜ リリース日の決定 (Kickstarter ONE HEART 10/8 終了後の可能性)
- ⬜ 既存 3 名 (知人) への告知方法 (LINE / メール / 直接口頭)

#### Phase R2: 有料化廃止 + YouTube フル尺化 (次セッション最優先)
- ⬜ **TAmJump から YouTube フル版 URL 提供待ち** (全曲、no-no/kiki/gEN/TAMSIC 名義)
- ⬜ tamsic-content.js の各曲 `youtubeUrl` を Sample → Full に一括差し替え
- ⬜ tamsic.html の T+ Series 3 曲の準備中枠を YouTube iframe に置換
- ⬜ KING MAKER / EARTH の MP3 到着後、tamsic.html に MP3 プレイヤー追加
- ⬜ 全 HTML から「フル試聴 30 coin」ボタン削除
- ⬜ `release-control.js` の locked/full 判定廃止 (全曲即公開)
- ⬜ 便箋メール送信ボタン一旦非表示 (Phase R5 で復活検討)
- ⬜ `unlockFullTrack()` / `spendCoins()` の呼び出し箇所コメントアウト (コードは残す、既存 coin 残高保護のため)

#### Phase R3: 英語プライマリ化 (骨組みセッション⑩ で完了、細部は順次)
- ✅ `TAMSICLang` のデフォルト言語を EN に変更 (lang.js DEFAULT_LANG='en')
- ✅ 全 15 HTML の `<html lang>` 属性を 'ja' → 'en' に
- ✅ lang.js 未読込ページ (index/go/reset-password) に追加
- ✅ index.html ナビに JA 切替ボタン追加、他 8 ページの data-lang-toggle 挙動確認
- ✅ ハンバーガーメニュー (mobile-nav.js) の言語切替 UI 動作継続
- ⬜ ニュース記事 (`tamsic-content.js` news 配列) の titleEn 品質向上 (現状は既存翻訳のまま)
- ⬜ 楽曲タイトルの英題/日本題併記実装 (例: "On the Edge (ぎりぎりだよ。)")
- ⬜ data-en 属性が未定義の要素の追加 (現状 EN 未定義箇所は JP がそのまま表示)

#### Phase R4: アーティストプラットフォーム化 (セッション⑩ で TAMSIC 名義追加は完了、可変数対応は次)
- ✅ TAMSIC 名義アーティストページ tamsic.html 新規作成 (5 曲、2 セクション: T+ Series と Named Tracks)
- ✅ 全アーティストページ + mypage のナビに TAMSIC タブ追加
- ✅ index.html Artists グリッドに TAMSIC カード追加 (先頭、Artist 000)
- ⬜ 現状の 4 アーティスト固定構造 (nono/kiki/gen/tamsic) を可変数対応に (テンプレート化)
- ⬜ アーティスト応募フォーム (Google Form or サイト内 form + Cloudflare Worker)
- ⬜ 応募内容の TAmJump への通知 (Resend 経由)
- ⬜ 新規アーティスト追加手順のマニュアル化 (`docs/TAMSIC_運用マニュアル.md` §4 に追記)

#### Phase R5: ファンクラブ + グッズ + 医療支援
- ⬜ ファンクラブ会員機能 (Cognito 属性 `custom:fanclub` 等で判定)
- ⬜ 月額課金 or 都度払い (Stripe / Square Subscriptions 検討)
- ⬜ グッズ販売連携 (Shopify / BASE / Square 検討)
- ⬜ 既存 coin → グッズ購入クレジット転用の実装
- ⬜ 医療支援先の選定 + 寄付フロー確立 (寄付率も要決定)
- ⬜ サイト上での寄付額可視化
- ⬜ 便箋メール技術をファンクラブ特典として復活検討 (Phase H1 の closing プールが活きる場)

---

### Phase I: 運営者向け 会員数ダッシュボード (Phase R1〜R2 と並行が現実的)

**背景**: TAmJump が Instagram / YouTube で継続宣伝、YouTube 経由の問い合わせも発生。AWS Console にログインしないと登録数が見えない現状は外出中の運営者に不便。リニューアル後は「アーティスト応募数」「ファンクラブ会員数」「グッズ購入者数」「寄付累計額」も表示予定。

**採用方針 (推奨案で合意): A + B の組合せ**
- **A. admin.html にリアルタイム会員数表示**: 新規 Cloudflare Worker `tamsic-stats` (仮称) が Cognito API `ListUsers` を叩いて件数を集計 → JSON で返す。admin.html から fetch → 5 分自動更新 or 手動リロード。アクセス制限は Cognito ID token + `custom:role=admin` or email allowlist。
- **B. 日次メール通知**: Cloudflare Worker Cron Triggers (毎朝 8:00 JST = UTC 23:00) で tamsic-stats を呼び、既存の Resend + `letter@tamjump.com` 流用して `info@tamjump.com` (or `tiger@tamjump.com`) に送信。

**表示項目 (詳細版)**:
- 総登録数 / メール検証済み数 / 今週の新規登録数 / 有効な購入者数 / アクティブユーザー数
- **リニューアル後追加候補**: アーティスト応募数 / ファンクラブ会員数 / グッズ購入者数 / 寄付累計額

**実装ステップ (推定 2 時間)**:
1. Worker `tamsic-stats` 作成 (Cognito `ListUsers` API + Pagination で全件取得、集計、JSON レスポンス)
2. IAM 権限設定 (`cognito-idp:ListUsers` 許可の IAM ユーザー作成、access key を Worker secret に)
3. Cron Trigger 設定 (`wrangler.toml` の `[triggers] crons = ["0 23 * * *"]`)
4. admin.html に UI 追加 (fetch → 表示、5 分 setInterval で更新)
5. 日次メール送信ロジック (Resend API を Cron 内で叩く)
6. 動作確認: PC で admin.html 表示、翌朝 info メール受信確認

**注意点**:
- Cognito `ListUsers` はページネーション上限 60 件 / call、`PaginationToken` で繰り返し取得
- ユーザー数が数万人規模になったら DynamoDB カウンター管理に移行
- IAM 認証情報を Cloudflare Worker secret に置く時は絶対に repo にコミットしない
- Cron の JST/UTC ズレに注意 (Cloudflare は UTC 基準)

---

## 🟡 リニューアル方針との整合性を再確認する旧タスク

### Phase H1: closing 大量生成 (現 ~25 通り → 500 通り)

**リニューアル影響**: Phase R2 で便箋メール一旦非表示、Phase R5 でファンクラブ特典として復活検討時に再着手予定。当面 pause。以下は旧計画として保持。

**背景**: ユーザー要望「便箋の一文は 500 通りくらい欲しい」「同じ曲を聴くたび違う便箋が届く価値」。
現状は曲別 closing が nono-004 の 3 通りのみ、他 11 曲は placeholder。
v4.2.2.1 で「同曲の複数回受信」を解禁したため、closing バリエーションがそのまま体験価値に直結する。

**500 通りの分配 (合意済み)**:

| プール | 数 | 用途 |
|---|---|---|
| 共通 (COMMON) | 100 | 全曲・全アーティスト共通の汎用 |
| アーティスト別 | 各 50 (no-no/kiki/gEN) = 150 | アーティストのトーン専用 |
| 曲別 (TRACK_CLOSINGS) | 各 20 × 12 曲 = 240 | 曲の世界観に沿った最も濃い closing |
| 誕生日 (BIRTHDAY) | 30 | 誕生日当日のみ (frame-O) |
| 誕生月 (BIRTHMONTH) | 20 | 誕生月に約 50% で混入 |
| 周年 (ANNIVERSARY) | 15 | 登録周年のみ (frame-P) |
| **合計** | **555 ≒ 500** | |

**通常時の体験空間**: 1 曲あたり 共通 100 + アーティスト 50 + 曲別 20 = **170 closing × 18 frame = 3,060 通り**。全 12 曲で **約 36,720 体験**。

**生成方針**: AI 生成 + アーティスト本人 (TAmJump) 視点でリライト。
- 各アーティストのトーン定義 (語尾、距離感、世界観) を先に確定
- それを system prompt に渡して AI で 50 通りずつ生成 → 人力リライトで「らしさ」付与
- 12 曲 × 20 通りは曲ごとの歌詞・creator's note を踏まえる必要あり、最も時間がかかる

**作業手順**:
1. 各アーティストのトーン定義をユーザーから受領 or 仮案 → 確定
2. アーティスト別 50 通り × 3 = 150 を生成
3. 共通 100 を生成 (アーティスト依存しない汎用)
4. 曲別 20 × 12 曲 = 240 を曲ごとに生成 (歌詞 / creator's note 込みのプロンプト)
5. 誕生日 / 誕生月 / 周年プールを生成
6. `letter-content.js` の COMMON_CLOSINGS / ARTIST_CLOSINGS / 各曲の TRACK_CLOSINGS / BIRTHDAY / BIRTHMONTH / ANNIVERSARY プールに投入
7. `tamsic-content.js` の各 track の `closings` フィールドに 20 通りずつ投入 (Worker 側がここから抽選)
8. push → Cloudflare Pages 自動デプロイ

**併せて執筆が必要**: 各曲の `creatorNote` (3-5 文の制作秘話)。これも 11 曲分 placeholder。

**進捗**:
- ✅ `nono-004`「ぎりぎりだよ。」 (closings 3 通り、creatorNote 完備、ただし closing は 20 通りに増やす必要あり)
- ⬜ `nono-001`〜`006` の残り 4 曲 + RE+
- ⬜ `kiki-001`〜`006`
- ⬜ `gen-001`

---

## ⏳ 将来タスク

### Phase H2: closing の多言語化 (案 D 採用、保留)

**ユーザー要望**: 会員の言語 (国) でメール内の closing が母語化されると嬉しい。

**採用する設計 (案 D)**:
- デフォルト言語は **日本語** (歌詞・banner・signature・postmark は常に日本語固定)
- 英訳対象は **closing と Creator's note のみ** (= アーティストの肉声部分)
- mypage に「Letter language: 🇯🇵日本語 / 🇺🇸English」セレクタを追加
- 海外会員にも「日本のレーベルから日本語の歌詞が届く」アイデンティティ感を保つ

**理由**: 完全英訳すると「機械翻訳された日本のサービス」感が出る。closing と creator's note だけ訳せば「アーティストが英語で結びを書いた」感が出て本人らしさを保てる。

**実装規模**:
- Cognito に `custom:letterLang` 追加 (Phase D と同じ手順、5 分)
- mypage に選択 UI 追加 (1 時間)
- `letter-content.js` を `{ ja: [...], en: [...] }` 構造に変更 (1 時間)
- Worker `pickClosing` で `user.letterLang` に応じてプール選択 (30 分)
- closing 英訳プール 500 通り作成 (DeepL or AI 生成 + レビュー、半日〜1 日)

**前提**: Phase H1 (日本語 closing 500 通り) が完成してから着手。

**追加言語の余地**: 中国語繁体 / 韓国語 / スペイン語など、需要が見えてからプール追加。

---

## ✅ セッション⑨ (2026-05-10〜12) で完了

### 前半 (5/10)
- ✅ **Resend ドメイン認証詰まり問題、解決** (commit `e141fcd` 直前)
  - オプション A 実施 (削除→再登録 + API キー再発行)
  - 再登録後 1 分で Verified に (キュー詰まり仮説的中)
  - 新 API キーを Worker secret に投入、メール送信成功確認 (Gmail 受信箱で実機確認)
- ✅ **Web 便箋ミニマル化 (v4.2.2)** (commit `e141fcd`)
  - creator's note / closing / signature / footer (Air Mail + 日付スタンプ) を Web から削除
  - 「別の一文」(reroll) ボタン廃止、`TAMSICLetter.reroll()` も削除
  - メール = プレミア体験 / Web = 歌詞ビューア の役割分担成立
- ✅ **メール歌詞 2 列レイアウト** (commit `e141fcd`)
  - Gmail/Outlook が `column-count` 非対応のため `<table>` で 2 セル化
  - 段落単位で行数バランス最大化アルゴリズム (段落途中で切らない)
  - nono-004 (16 段落 / 61 行) で実機検証: 左 32 行 / 右 29 行に分割成功
- ✅ **同曲レターの複数回受信を解禁 (v4.2.2.1)** (commit `ac7d9b3`)
  - `letter-send.js` の `hasReceivedLetter` チェック削除
  - 確認モーダル文言を「便箋の枠と結びの一文は、毎回ランダムに選ばれます」に
  - フル試聴 (30 coin) 課金縛りはあるので乱発リスク限定的
- ✅ Worker `tamsic-send-letter` 再デプロイ (Version `f3e57143-4927-432b-a5db-acc51aa2a6ab`)

### 後半 (5/10〜12)
- ✅ **フル試聴 1 回 / レター 1 通 の整合性確保 (v4.2.2.2)** (commit `9b5f725`)
  - 送信成功時に `<span class="sent-mark">送信済み — フル試聴を再解放すると…</span>` に置換
  - 多重描画ガード撤廃、フル試聴のたびに便箋とボタンを再生成 = コイン消費に対応
- ✅ **nono-004 説教調 closing 削除 (v4.2.2.3)** (commit `48bd058`)
  - 「●●さん、約束はまだ守れる。」を削除 (曲の世界観と矛盾、Phase H1 の前哨)
- ✅ **運用マニュアル新規作成** (commit `3b33127`)
  - `docs/TAMSIC_運用マニュアル.md`、liberty さんへの 10,000 coin 直接付与の手順含む
  - Cognito 6 属性一覧 (coins / nickname / birthday / registeredAt / purchases / letterHistory) を正式記載
- ✅ **スマホ残高 0 表示バグ修正 (v4.2.2.4)** (commit `aab1850`)
  - `_ensureFreshTokenOnLoad` でトークン新鮮時も Cognito 同期を実行
  - iPhone Safari / Chrome で 0 coin 表示問題解消
- ✅ **共通ハンバーガーメニュー + スマホ最適化基盤 (v4.2.2.5)** (commit `2597d68`)
  - `mobile-nav.js` 新規 (右上 ☰ + 右スライドドロワー)
  - `mobile.css` 新規 (横スクロール抑止、キャンペーン CTA / 便箋 / フォーム調整)
  - 全 13 HTML に sed で一括注入
- ✅ **index.html ヒーローのスマホ配置調整 (v4.2.2.6〜10)** (commit `e913096`, `19d790c`, `6721839`, `6bc104b`, `ecc1a90`)
  - 試行錯誤フェーズ (5 commit)、最終的に「PC のカプセル装飾を完全継承、配置のみ調整」で着地
  - 印鑑ロゴ / キャッチコピー / SCROLL ラベル / カプセル 3 つ の重なり解消
- ✅ **News セクションのスマホ縦並びレイアウト (v4.2.2.11)** (commit `df97ff5`)
  - `.news-item` を flex 横並びから縦並びに、日本語見出しの短冊化解消
  - `.news-tag` (RELEASE バッジ) は右上に絶対配置
- ✅ **会員先行視聴 廃止 + gEN 新曲 2 曲追加 (v4.2.2.12)** (commit `7e9f5b4`)
  - `release-control.js` を `locked / full` 2 値に簡素化
  - 全 HTML から「サイトで聴く」ボタン削除、サンプル試聴は YouTube 埋込に統一
  - `gen-002 Dear Future You` (release 2026-05-23) 追加
  - `gen-003 Echo from the Future` (release 2026-05-30) 追加
  - 画像 + MP3 を `assets/images/gen/` `assets/audio/gen/` に配置 (MP4 は YouTube 素材として除外)
  - 公開日制御に新曲 2 件追加、news エントリ 2 件追加

### 運用作業
- ✅ liberty.2wink7@gmail.com に 10,000 coin 付与 (AWS Console から `custom:coins` を直接書換、5/10)
- ✅ AWS Console URL `https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ap-northeast-1_vozRgCY5k/users` を運用マニュアルに正式記載

### キャッシュバスター推移
4.2.1.5 → 4.2.2 → 4.2.2.1 → 4.2.2.2 → 4.2.2.3 → 4.2.2.4 → 4.2.2.5 → 4.2.2.6 → 4.2.2.7 → 4.2.2.8 → 4.2.2.9 → 4.2.2.10 → 4.2.2.11 → **4.2.2.12** (最終)

### 新規追加ファイル
- `mobile-nav.js` (共通ハンバーガーメニュー)
- `mobile.css` (共通スマホ最適化)
- `docs/TAMSIC_運用マニュアル.md`
- `assets/images/gen/gen_dearfutureyou.png` / `gen_echofromthefuture.png`
- `assets/audio/gen/gen_dearfutureyou.mp3` / `gen_echofromthefuture.mp3`

---

## ✅ セッション⑧ までで完了 (前版から継続)

- ✅ HANDOFF_v3.md 作成 (Phase G 完了時点の総合引き継ぎ書)
- ✅ TAMSIC_TODO_v3.md 作成
- ✅ TAMSIC_システム構成図_v4.2.1.html / v4.2.2.html 作成 (アーキテクチャ全景)
- ✅ TAMSIC_レター送信デプロイ手順_v4.2.1.md / v4.2.2.md 作成 (実機ベース)
- ✅ TAMSIC_設計書_v4.html フッタ v4.2.1 更新
- ✅ openid scope 問題の特定と回避 (id_token 方式に切替、commit 8d1e8a1)
- ✅ Worker `verifyUser` を id_token 優先 + userInfo フォールバック構成に改修
- ✅ HANDOFF_v4.md 作成

---

## 🎵 楽曲コンテンツ系

### 各曲の `creatorNote` 執筆 (Phase H1 と並行)

**closings 執筆は上記 Phase H1 に統合済み** (各曲 20 通り目標、合計 240 通り)。

`tamsic-content.js` 内、各 track の `creatorNote` (3-5 文の制作秘話、アーティスト本人視点) を投入する。

**進捗** (14 曲中 1 曲のみ確定):
- ✅ `nono-004` 「ぎりぎりだよ。」 creatorNote 完備
- ⬜ `nono-001` 「Breathless」
- ⬜ `nono-002` 「RE+」 (release 2026-05-15)
- ⬜ `nono-003` 「to Walk」
- ⬜ `nono-005` 「シグナル●」
- ⬜ `nono-006` (未定)
- ⬜ `kiki-001` 「Burn bright」 (release 2026-05-20)
- ⬜ `kiki-002` 「Critical point」 (release 2026-06-28)
- ⬜ `kiki-003` 「No Stop」 (release 2026-07-11)
- ⬜ `kiki-004` 「エンジン」 (release 2026-08-23)
- ⬜ `kiki-005` 「KIKI rising」 (release 2026-09-20)
- ⬜ `kiki-006` 「unセカイ」 (release 2026-05-15)
- ⬜ `gen-001` 「unセカイ」 (release 2026-05-15)
- ⬜ `gen-002` 「Dear Future You」 (release 2026-05-23) ← セッション⑨ 追加
- ⬜ `gen-003` 「Echo from the Future」 (release 2026-05-30) ← セッション⑨ 追加

**作業手順**: ユーザーから本人視点テキスト受領 → `tamsic-content.js` の該当 track に投入 → push (キャッシュバスター更新)。Phase H1 の closings 生成と同じ曲で同時にやると効率的。

### gen-001 / kiki-006「unセカイ」MP3 配置方針 (継続案件)

- **公開日**: 2026-05-15
- **現状**: gen MP3 は本番 repo に配置済、kiki は MP3 待ち
- **方針候補**:
  - A: Vault repo (`tamsic-audio-vault`) + GitHub Actions による自動配置
  - B: 本番 repo に置く (URL 推測アクセスのリスク)
  - C: Cloudflare R2 + signed URL (最終形、実装重い)
- **当面**: B で運用、C への移行は将来課題

---

## 💌 レター機能の拡張

### login.html を Hosted UI 経由に書換 (根本対応)

- 現状: SDK 直叩き (`authenticateUser`) で access_token に scope なし → id_token 方式で回避
- 根本対応: `https://<COGNITO_DOMAIN>/oauth2/authorize?scope=openid+email+profile` にリダイレクトさせる
- それで access_token にも scope が乗り、`/oauth2/userInfo` 経由でも認証可能になる
- 優先度: 中 (id_token 方式で機能的には問題なし、UX 改善のみ)

### レターコレクション機能 (mypage 拡張)

- mypage に「受け取ったレター履歴」セクション追加
- `custom:letterHistory` を読取り、送信曲・日付・frame をリスト表示
- frame アイコン (frame-K=桜、frame-O=誕生日) で視覚化
- レア (Q/R) を獲得した記念演出
- **v4.2.2.1 で同曲複数回受信を解禁**したため、`letterHistory` は同じ trackId が複数件入る可能性あり。表示は時系列で全件 / 曲ごとにグループ化など要検討
- **letterHistory 上限 2048 文字 / FIFO 10 件** が現状制約。同曲を何度も受け取るとすぐ FIFO で押し出される → 本機能を本格運用するなら DynamoDB 移行 or 上限緩和を要検討
- 「同じ曲を別アドレスで受け取りたい」要望が出たら multi-recipient 検討

### 季節枠の追加

現在 K(桜)/L(雪)/M(海)/N(紅葉) の4枠。追加候補:
- 中秋の月 (9月限定)
- ハロウィン (10/15-10/31、紅葉と共存)
- クリスマス (12月限定で雪結晶と置換 or 重複可)
- 鯉のぼり (5月)

実装は `letter-frames.js` の FRAMES 定義 + `letter.css` の `.frame-X` スタイル + (お好みで `letter-content.js` の SEASON_CLOSINGS) 追加。

### レアの希少度調整

現在 Q=1.00% / R=4.95%。要望次第:
- ブロンズ枠追加 (15% 程度)
- プラチナ枠追加 (0.1% 程度、超レア)
- 七色枠 (1日1回限定の超超レア)

### Adobe Fonts (TA恋心) への切替

現在 SIL OFL 3フォント (Zen Kurenaido / Hachi Maru Pop / Yuji Syuku)。Adobe CC 月¥680〜の TA恋心 で書体グレードアップ可能。
切替コストはほぼゼロ:
```css
font-family: 'TA Koigokoro', 'Zen Kurenaido', serif;
```
→ Adobe CC 7日間無料体験で実機検証して判断。

---

## 🛡 セキュリティ / 認証

### Square Webhook によるコイン自動付与

**現状**: 購入後にユーザーが mypage の「購入を反映する」ボタンを押す → クライアント JS から `addCoinsToCognito` を呼ぶ。

**課題**:
- 不正クライアント JS で任意付与できる脆弱性
- ユーザーが反映ボタンを押し忘れると残高がズレる

**対策**: Cloudflare Worker で Square Webhook を受け、Cognito Admin API で属性更新。

**実装ステップ**:
1. Square Developer Dashboard で Webhook URL 登録
2. 新規 Worker `tamsic-square-webhook` を作成 (`workers/square-webhook.js`)
3. AWS IAM で Cognito Admin API 用の Access Key 発行 → wrangler secret 登録
4. Worker で署名検証 + `cognito-idp:AdminUpdateUserAttributes` を呼ぶ
5. mypage の「購入を反映する」ボタンを撤去

### 音源保護 (R2 + signed URL)

**現状**: `assets/audio/*.mp3` が public、URL 推測で誰でもダウンロード可能。

**対策**: Cloudflare R2 に音源を移動 → Worker で 1分有効の signed URL 発行 → audio タグに渡す。

→ 設計書 §22 で言及済、未着手。

### MP3 配置の自動化

公開前の曲 (会員先行期間中) は Vault repo に置き、公開日に Actions で本番 repo へ自動コピー。
→ `docs/TAMSIC_自動リリース設定手順.md` に旧仕様あり、現状未稼働。

---

## 📱 アプリ化 (長期)

### 方針

最終形はネイティブアプリ。Web ロジックを **Cloudflare Workers に寄せる**ことで Web/アプリ共通の API 化。

候補:
- **React Native** (iOS/Android 両対応、Web と知見共有しやすい)
- **Flutter** (UI 美しい、デザイン追求向き)
- **SwiftUI + Jetpack Compose** (各プラットフォームネイティブ実装、最高品質、工数2倍)

### 必要な前準備

- API 化: 全状態管理を Worker 経由に (現状はフロント JS + Cognito 直叩きが多い)
- 歌詞5層保護: ブラウザ依存実装 (PrintScreen検知/DevTools検知) はネイティブで別実装
- メールレター: Worker そのまま使える (アプリから叩くだけ)
- IAP (App Store / Google Play 課金): Square と並立 or 切替

→ アプリ化は現 Web 完成後の話。設計書 §22 の長期項目。

---

## 🐛 既知のバグ / 改善余地

### add-artist.js のバグ修正 (旧 TODO から継続)

- 既存アーティストへの上書き挙動が不安定
- admin.html で再現可能
- 詳細: 旧 `docs/TAMSIC_TODO.md` 参照
- 優先度: 中 (admin tooling は緊急性低)

### Outlook メール互換性テスト未実施

- 設計書ではインライン CSS + data URL で対応済みのはず
- 受信側からの不具合報告ベースで微調整予定

### Cognito letterHistory 2048 文字上限

- FIFO 10件運用、問題発生時は DynamoDB に移行検討
- 1曲送信あたり ~120 byte 想定なので 10件で安全マージン

### スマホ表示の確認

- letter.css のレスポンシブは ≤600px で 1カラム化、Banner マージン調整
- 実機 iPhone/Android テスト未実施 (DevTools のレスポンシブビューでは OK)

### Worker JWT 署名検証の追加 (低優先)

- 現状: id_token を decode して payload.aud と email を取得、署名検証は省略
- 改善: JWKS (Cognito の公開鍵) を Workers KV にキャッシュして署名検証
- リスク: Worker の cold-start で +50ms 程度、運用上は気にならない範囲

---

## 🎨 デザイン微調整候補

- 便箋 frame の細部調整 (フィードバックベース)
- ナビゲーションのモバイル対応 (max-width:768px でハンバーガー化、未テスト)
- アーティストページの「アーティスト紹介」セクション拡充 (現状 placeholder)
- レター preview ページのデザイン改良 (`letter-preview.html`、開発者向けツール扱い)

---

## 📊 計測 / 分析

- アクセス解析 (Google Analytics 4) 導入検討
- Resend Dashboard で曲別の送信件数を見られる
- 18枠の実出現率分布 (theory vs actual) のログ取り → 抽選バランス調整

---

**END OF TODO v4**
