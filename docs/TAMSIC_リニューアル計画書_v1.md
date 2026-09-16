# TAMSIC リニューアル計画書 v1

**作成日**: 2026-09-16 (セッション⑩ 初日)
**ステータス**: 方針決定済、実装は次セッション以降で段階的着手
**関連文書**: `HANDOFF_v4.md` / `docs/TAMSIC_TODO_v4.md` / `docs/TAMSIC_設計書_v4.html`

---

## 1. リニューアルに至る背景

### 事業環境の変化
- **YouTube チャンネルの成長が鈍化**: サンプル動画のみの発信では伸びに限界
- **海外からの応援が増加**: YouTube のグローバル配信で海外リスナーの反応が顕著に
- **有料コイン経済の限界**: 会員 4 名 (うち実質 3 名は TAmJump の知人)、有料 = 参入障壁が高すぎて広まらない
- **YouTube 経由の問い合わせ発生** (2026-05 頃): 「フルで聴くにはどうすればいい?」= サイトの有料フル試聴モデルが正しく届いていない

### 方針転換の核心
「音楽レーベルとしての収益化」から「**音楽を通じた社会貢献プラットフォーム**」へ軸を移す。
音楽は無料でフル公開、収益は将来のグッズ販売とファンクラブから、その利益の一部を医療の届きにくい地域への支援に回す。

---

## 2. リニューアル方針 (5 本柱)

### 2-1. YouTube でフル尺公開
これまでサンプル (30 秒〜1 分) のみだった楽曲を、今後は**フルバージョンで YouTube 公開**する。一人でも多くのリスナーに no-no / kiki / gEN の音楽を届ける。

### 2-2. サイトの有料化を廃止
- コイン経済 (`coins.js`, `spendCoinsOnCognito`, `custom:coins`, `custom:purchases`) を撤廃
- Square 決済連携を停止 (楽曲販売用途では不要に)
- フル試聴アンロック (`unlockFullTrack`) 廃止
- 「30 coin でフル試聴」ボタン廃止
- サイトでの試聴は YouTube 埋込に完全一本化

### 2-3. サイトはアーティストプラットフォームへ
現状の「no-no / kiki / gEN 固定 3 名」構造から、**可変数のアーティストを募集・掲載できるプラットフォーム**へ再構築する。
- アーティスト応募フォーム (Google Form or サイト内フォーム)
- TAmJump が個別に審査 → 掲載
- 掲載アーティストは YouTube リンクを軸にした自己紹介ページを持つ
- 将来はアーティスト側の管理画面 (自分の曲を追加できるダッシュボード) も検討

### 2-4. 将来のファンクラブ + グッズ販売
- 「売れ始めたら」の判断でファンクラブを開設 (判断基準は Phase R5 で検討)
- ファンクラブ会員限定でグッズが買える仕組み
- **既存のコイン残高は「1 coin = ¥X」のレートで永続的にグッズ購入クレジットに転用可能** (レート数字は次セッションで確定)

### 2-5. 利益の一部を医療支援へ
ファンクラブ / グッズ販売で得た利益の一部を、**へき地や海外の過疎地の医療支援**に回す。
これが TAMSIC のブランドアイデンティティの核となる。
- 寄付先の具体的な決定は今後
- 寄付率は今後決定 (10% / 30% / etc.)
- サイト上での寄付額可視化 / 支援先の活動報告掲載を将来的に検討

### 2-6. TAMJ vision-map を軸に据える
TAMSIC は「音楽レーベル」単体ではなく、**タムジ株式会社 (TAMJ) が描く「未来予想図」の裏側で動く活動**として位置づける。音楽が地域とつながり、地域が医療とつながり、医療が社会とつながる。ひとつの循環の中の、静かで確かな一部。
- **リンク先**: `https://tamjump.com/vision-map.html`
- **反映箇所**: `renewal.html` の callout セクション、および将来的に about.html にも同様の表現を追加検討
- **ブランドメッセージ**: 「まさに裏の世界の活動が TAMSIC」というトーンで、vision-map への導線を主要な世界観の説明として据える

### 2-7. ONE HEART Kickstarter との切り分け (2026-09-16 確定)
**方針**: **Kickstarter プロジェクト (WE ARE ALL ONE HEART) は TAMSIC サイト内で告知しない**。
- TAmJump 個人 / TAmJump 社の別プロジェクトとして扱う
- TAMSIC は音楽レーベル、Kickstarter は TAMJ の別事業、という明確な切り分け
- 将来的に「Kickstarter バナーを TAMSIC に追加してほしい」等の依頼があっても、この方針は変更しないこと
- 関連告知が必要な場合は TAMJ 側 (tamjump.com or vision-map.html) で扱う

---

## 3. 英語プライマリ化

海外リスナーの応援が増えたため、**サイトのプライマリ言語を英語に転換**する。

### 方針: (β) 英語プライマリ + JP 切替トグル
- **EN がデフォルト**表示、右上に「JP」トグル (既存の `data-lang-toggle` を流用)
- 日本語ユーザーはトグル or ブラウザ翻訳で対応
- YouTube 説明欄、アーティスト募集要項、医療支援メッセージすべて英語基準
- 楽曲タイトルは併記案 (プライマリ英題、サブに日本題) を推奨するが、次セッションで最終決定

### 影響範囲 (実装時に触るもの)
- 全 13 HTML の `data-ja` / `data-en` 属性 (現状 JP プライマリなので EN プライマリに反転)
- `TAMSICLang` モジュールのデフォルト言語設定
- ニュース (`tamsic-content.js` の news 配列) の `title` / `titleEn` の主従関係
- メール便箋テンプレート (`workers/send-letter.js`) の生成順序

---

## 4. 既存資産の扱い

### 4-1. 廃止する機能
| 対象 | ファイル | 廃止方針 |
|---|---|---|
| コイン経済 | `coins.js`, `custom:coins`, `custom:purchases` | 撤廃、ただし既存残高はクレジット転用のためデータ保持 |
| Square 決済 | Square SDK 埋込コード | 撤廃 |
| フル試聴アンロック | `unlockFullTrack()` 関数 | 撤廃 |
| 30 coin ボタン | 各 HTML の `mode-btn full` | 撤廃 |
| release-control.js の locked/full | `release-control.js` | 廃止 (全曲 YouTube 公開日 = サイト表示日、有料判定不要) |
| 手紙メール送信 (現行仕様) | `letter-send.js`, `workers/send-letter.js` | 保留 (将来のファンクラブ特典で活かす候補、Phase R5 で判断) |

### 4-2. 残す・活かす機能
| 対象 | 活かし方 |
|---|---|
| Cognito 認証基盤 | アーティスト応募者アカウント / 将来のファンクラブ会員用途 |
| 3 アーティスト構成 (no-no/kiki/gEN) | プラットフォームの創立アーティストとして継続 |
| サイト骨格 (デザイン・ナビ・ハンバーガー) | v4.2.2.14 の資産を継承 |
| YouTube 埋込表示 | 主役に格上げ |
| 便箋メール技術 | 将来のファンクラブ特典 (誕生日メッセージ等) で復活候補 |
| Cloudflare Pages + Workers インフラ | 継続 |
| Resend メール送信基盤 | 継続 (告知メール等で活用) |

### 4-3. 既存コイン残高の転用 (次セッションで確定)
- **現在の会員**: 4 名 (うち TAmJump 本人以外は全員 TAmJump の知り合い = 一般公募会員ではない)
  - tiger@tamjump.com (TAmJump 本人): 8,860 coin
  - liberty.2wink7@gmail.com: 10,000 coin
  - inochitsun... (知人): coin 残高未確認
  - 8lightfull... (知人): coin 残高未確認
- **転用レート案**: 1 coin = ¥100 / ¥10 / ¥2 (未確定)
- **転用方法**: `custom:coins` はそのまま保持、グッズ購入時に「1 coin = ¥X で使えます」と表示して支払い時に消費
- **有効期限**: 既存残高は永久 (会員少数のため会計負担ゼロ)

---

## 5. リニューアル告知文

### 骨子 (日本語版素案、TAmJump が最終仕上げ予定)

```
━━━━━━━━━━━━━━━━━━━
みなさんの応援により、
TAMSIC が生まれ変わります。
━━━━━━━━━━━━━━━━━━━

いつも TAMSIC の音楽を聴いてくださって、
本当にありがとうございます。

TAMSIC は次のステージへ進みます。

■ すべての楽曲を、YouTube でフル尺公開
これまでサンプルとして公開していた楽曲を、
今後はフルバージョンで届けます。
一人でも多くの人に、no-no / kiki / gEN の音楽が
届きますように。

■ サイトはアーティストの発信の場へ
コインによるフル試聴システムは終了します。
サイトはこれから、より多くのアーティストが
自分の音楽を世に出せる場所として
リニューアルします。

■ 将来: ファンクラブ + グッズ販売
サイトが育ってきたら、
ファンクラブに入ってくださった方限定で
グッズをお届けする仕組みを作ります。

■ 利益の一部を、へき地・海外の医療支援へ
将来ファンクラブやグッズ販売がはじまったら、
その利益の一部を、医療の届きにくい地域への
支援に回します。
音楽を聴くことが、遠くの誰かの明日につながる。
そんな循環を作っていきたいと思っています。

■ これまでご購入いただいたコインについて
これまで応援してくださった証として、
ご購入いただいたコインは無駄にしません。
将来のグッズ購入クレジットとして
1 coin = ¥[レート] でご利用いただけます。
有効期限はありません。ゆっくりお待ちください。

これからも TAMSIC を、
どうぞよろしくお願いいたします。

TAMSIC
```

### 英語版
次セッションで作成。「みなさんの応援により生まれ変わる」のニュアンスを保ちつつ、英語プライマリの新方針に沿った文体で。

### 発表チャンネル
- **(1) サイト Top ページに大々的掲載** (index.html にお知らせセクション追加)
- **(2) Instagram + YouTube コミュニティ投稿** (TAmJump が実施)
- **(3) 既存会員 4 名には別途メール** (Resend 経由、個別対応で十分)
- **リリース日**: 未定 (次セッションで決定、Kickstarter ONE HEART プロジェクト 10/8 終了後の可能性?)

---

## 6. 実装フェーズ (Phase R1〜R5)

### Phase R1: 準備・告知
- リニューアル告知文の英語版作成
- サイト Top に「サイトリニューアル準備中」バナー掲載
- 既存 3 名 + TAmJump 本人 (計 4 名) の coin 残高確認
- 転用レート (1 coin = ¥X) 最終確定
- 告知メール送付 (Resend 経由)

### Phase R2: 有料化廃止 + YouTube フル尺化
- 全 HTML から「フル試聴 30 coin」ボタン削除
- `release-control.js` の locked/full 判定廃止 (全曲即公開)
- `tamsic-content.js` の各曲 `youtubeUrl` をフル尺動画 URL に差し替え
- 便箋メール送信ボタン一旦非表示 (Phase R5 で復活検討)
- `unlockFullTrack()` / `spendCoins()` の呼び出し箇所コメントアウト (コードは残す、既存 coin 残高保護のため)

### Phase R3: 英語プライマリ化
- `TAMSICLang` のデフォルト言語を EN に変更
- 全 13 HTML の `data-ja` / `data-en` 属性の主従関係反転
- ニュース記事の titleEn を主にした表示ロジック
- ハンバーガーメニュー (`mobile-nav.js`) の言語切替 UI を目立たせる
- 楽曲タイトルの英題/日本題併記実装

### Phase R4: アーティストプラットフォーム化
- 現状の 3 アーティスト固定構造 (nono.html / kiki.html / gen.html) を可変数対応に
- アーティスト応募フォーム作成 (Google Form or サイト内 form + Cloudflare Worker)
- 応募内容の TAmJump への通知 (Resend 経由)
- 新規アーティスト追加手順のマニュアル化

### Phase R5: ファンクラブ + グッズ + 医療支援
- ファンクラブ会員機能 (Cognito 属性 `custom:fanclub` 等で判定)
- 月額課金 or 都度払い (Stripe / Square Subscriptions 検討)
- グッズ販売連携 (Shopify / BASE / Square 検討)
- 既存 coin → グッズ購入クレジット転用の実装
- 医療支援先の選定 + 寄付フロー確立
- サイト上での寄付額可視化
- 便箋メール技術をファンクラブ特典として復活検討

---

## 7. 次セッションで最初に確認すべきこと

1. リニューアル告知文の日本語版・英語版の最終文言
2. 転用レート (1 coin = ¥100 / ¥10 / ¥2)
3. リリース日
4. Phase R1〜R5 のうちどこから着手するか (段階的に進める前提)
5. ONE HEART Kickstarter プロジェクトとの連動有無 (前回セッションでは「別プロジェクト」扱い、状況変化があれば再確認)
6. 既存 3 名 (知人) への告知方法 (LINE / メール / 直接口頭)

---

## 8. 参考: Phase I (会員数ダッシュボード) との統合

前セッションで計画された **Phase I: 運営者向け 会員数ダッシュボード** (admin.html リアルタイム表示 + 日次メール) は、リニューアル後も引き続き有用。
- リニューアル後は「アーティスト応募数」「ファンクラブ会員数」「グッズ購入者数」「寄付累計額」などの表示項目を追加検討
- 実装タイミングは Phase R1〜R2 と並行が現実的

---

## 9. セッション⑩ 実装レポート (2026-09-16)

計画書を書きながら並行して実装した内容の記録。commit `c898d00` から `2505a72` まで、v4.2.2.14 → v4.2.3.4 に進んだ。

### 9-1. 完了した実装

**Phase R1 告知系 (v4.2.3.1 → v4.2.3.3)**
- `index.html` 最上部にリニューアル告知バナー配置。ヒーロー占領型 (padding 120px 24px 56px)、深いネイビー #0B1D35 背景 + Gold #C4960E アクセント + Playfair Display italic の大見出し「TAMSIC is being renewed. / — Thanks to your support.」+ 日本語補足 + READ MORE ボタン + 装飾ドット 6 個。
- `renewal.html` 新規作成。EN プライマリ + JP data-ja/data-en 切替対応。4 章構成 (01 YouTube フル尺 / 02 プラットフォーム化 / 03 ファンクラブ+医療支援循環 / 04 コイン転用) + Thanks。§03 の下に TAMJ vision-map への callout (ネイビー統一)。冒頭 lede に「海外 thousands」の控えめ言及。
- `tamsic-content.js` news 配列先頭に `news-renewal-2026` 追加 (Announcement タグ、href フィールド新設)。
- `news.html` レンダリング改修: href フィールドがあれば title をリンク化 (Gold 下線、ホバー効果)。
- Kickstarter 関連削除: index.html の Kickstarter バナー / セクション / カード全撤去。方針として「TAMSIC で Kickstarter は告知しない」を §2-7 に明記、次セッションの Claude が同じ誤解しないよう警告。
- ナビ背景を rgba 半透明 → 完全不透明 #FAFAF7 に (バナー上部への白い霞対策)。
- renewal.html callout の文言を「まさに裏の世界の活動が TAMSIC」トーンに書き換え、色もネイビー統一。

**Phase R3 英語プライマリ化の骨組み (v4.2.3)**
- `lang.js` DEFAULT_LANG='en'、detect() 改修 (localStorage 保存済は継続、ブラウザ 'ja' は JP、それ以外 EN)
- 全 15 HTML の `<html lang>` を 'ja' → 'en'
- フォールバック `|| 'ja'` を `|| 'en'` に (auth.js, gate-modal.js, forgot-password.html, signup.html, login.html)
- lang.js 未読込ページ 3 つ (index.html, go.html, reset-password.html) に読込追加
- index.html ナビに JA 切替ボタン追加 (他 8 ページの data-lang-toggle と同スタイル)

**TAMSIC 名義アーティストページ (v4.2.3.4)**
- `tamsic.html` 新規作成 (5 曲、2 セクション: T+ Series 3 曲 + Named Tracks 2 曲)
  - Hero: `TAMSIC` + 「音として自己を表現する」紹介文
  - Profile カード: TAMSIC 印鑑ロゴをネイビー額装 + About セクション (正体 / 役割 / 居場所 = TAMJ vision-map の裏側)
  - Discography: T+111 / T+101 / T+110 は MP3 プレイヤー + YouTube 準備中枠、KING MAKER / EARTH は Coming soon 表示のみ
  - MP3 プレイヤー独立実装 (排他制御、シーク対応)
- `assets/images/tamsic/` に 6 画像配置 (プロフィール用ロゴ + 5 曲カバー)
- `assets/audio/tamsic/` に MP3 3 曲を repo 直下から整理移動
- index.html hero 3 曲カプセルの src を新パスに更新
- 全アーティストページ (nono/kiki/gen) + mypage のナビに TAMSIC タブ追加
- index.html Artists グリッドに TAMSIC カード追加 (先頭、TAMSIC Artist 000)
- renewal.html §01 本文の「no-no / kiki / gEN」を「no-no / kiki / gEN / TAMSIC」に更新

### 9-2. セッション⑩ 内の commit ハッシュ

| # | commit | 版 | 概要 |
|---|--------|----|------|
| 1 | `c898d00` | -    | リニューアル方針決定 + Phase I 追加 (docs のみ) |
| 2 | `fe2c647` | v4.2.3 | 英語プライマリ化 (Phase R3 骨組み) |
| 3 | `8f7ad43` | v4.2.3.1 | リニューアル告知バナー実装 (旧・薄クリーム) |
| 4 | `8095e88` | v4.2.3.2 | バナーをヒーロー占領型に変更 |
| 5 | `bb2151b` | v4.2.3.3 | Kickstarter 削除 + バナー位置修正 + vision-map 強調 |
| 6 | `bb42534` | -    | docs: vision-map 軸 + Kickstarter 切り分け明記 |
| 7 | `2505a72` | v4.2.3.4 | TAMSIC 名義アーティストページ新規追加 |

### 9-3. 次セッションで着手すべきタスク (優先順)

1. **YouTube フル版 URL の受領と一括差し替え** (TAmJump からの提供待ち)
   - 全曲 (no-no 5 曲 / kiki 6 曲 / gEN 3 曲 / TAMSIC 5 曲、計 19 曲)
   - `tamsic-content.js` の各曲 `youtubeUrl` を Sample → Full に差し替え
   - tamsic.html の T+ Series 3 曲の準備中枠を iframe に置換
2. **KING MAKER / EARTH の MP3 受領後**: tamsic.html に MP3 プレイヤー追加
3. **転用レート最終決定** (1 coin = ¥100 / ¥10 / ¥2 の 3 択)
4. **既存 4 名の coin 残高確認** (inochitsun.../8lightfull... の 2 名は未確認)
5. **Phase R2 有料化廃止の実コード撤去** (30 coin ボタン削除、release-control 廃止、便箋メール非表示)
6. **告知メール送付** (既存 4 名 + SNS フォロワーへ、Resend 経由)
7. **リリース日決定** (Coming soon 表記が現実的、Kickstarter ONE HEART 10/8 終了後の可能性)

### 9-4. 未対応の細部

- 期間限定 100 coin バナー (`signup-campaign-section` / `signup-campaign-mini`): 現状 `display:none` で見えない、Phase R2 で完全削除予定、放置中
- `data-en` 属性未定義の要素: 英語ページで JP がそのまま表示される箇所が残存
- 楽曲タイトルの英題併記: 未着手 (TAmJump に英題を用意してもらう必要)
- ニュース記事の英訳品質: `titleEn` の翻訳確認は未実施
- `tamsic-content.js` への TAMSIC 名義 5 曲データ登録: 現状 tamsic.html が静的なので不要、動的一覧が必要になったら対応

