# TAMSIC 運用マニュアル

**目的**: 日常運用で発生する管理タスク (会員へのコイン直接付与、属性確認、トラブル対応など) の手順を集約。
**対象**: 運営者 (TAmJump) および新規セッションの Claude。
**前提**: 設計書 (`TAMSIC_設計書_v4.html`) は技術仕様書、本書は**運用ノウハウ**を扱う。両者は分離して管理する。

最終更新: 2026-05-12 (セッション⑨ 終了時点、v4.2.2.12 反映)

---

## 1. Cognito 直接操作

### 1.1 ユーザー属性の参照と編集

#### AWS Console URL
- ユーザープール (TAMSIC):
  `https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ap-northeast-1_vozRgCY5k/users?region=ap-northeast-1`

#### User Pool 概要
- User Pool ID: `ap-northeast-1_vozRgCY5k`
- ARN: `arn:aws:cognito-idp:ap-northeast-1:310133718901:userpool/ap-northeast-1_vozRgCY5k`
- Region: ap-northeast-1 (東京)

### 1.2 TAMSIC が管理する 6 つの custom 属性

| 属性名 | 型 | 役割 | 例 |
|---|---|---|---|
| `custom:coins` | String (数値) | 現在のコイン残高 | `"10000"` |
| `custom:nickname` | String | 便箋の宛先 (Dear) や挨拶 | `"JIN.O"` |
| `custom:birthday` | String (YYYY-MM-DD) | 誕生日 (frame-O 発動条件) | `"1982-01-03"` |
| `custom:registeredAt` | String (YYYY-MM-DD) | 登録日 (frame-P 周年バナー発動条件) | `"2026-04-01"` |
| `custom:purchases` | JSON 文字列 | 購入履歴 配列 | `[{"at":"2026-05-09T01:34:01.125Z","coins":9560,"package":"..."}]` |
| `custom:letterHistory` | JSON 文字列 | レター送信履歴 配列 (FIFO 10件、上限 2048 字) | `[{"trackId":"nono-004","frameId":"B","closingIdx":0,...}]` |

**重要な注意**:
- 数値も Cognito 上は String で保存される (Cognito の仕様)
- App Client で read/write 許可が設定済 (Phase D 完了済)
- 未設定の属性は Console 上で行ごと表示されない (例: 誕生日未設定なら `custom:birthday` 行が出ない)

### 1.3 会員へのコイン直接付与手順 (運営者特権)

**用途**: 大事な会員にプレゼント、不具合補填、運用テストなど。本人のパスワードを知らずに付与可能。

#### 手順

1. AWS Console を開く: https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ap-northeast-1_vozRgCY5k/users?region=ap-northeast-1
2. ユーザー一覧で対象ユーザー (email でフィルタ可) のリンクを押す
3. 「ユーザー属性」セクション右上の「**編集**」ボタン
4. `custom:coins` の値を書き換え
   - **加算**: 現在値 + 付与数 を計算して入力 (例: 100 → 10100 で +10,000 加算)
   - **セット**: 強制値で上書き (例: `10000`)
   - 半角数字のみ、カンマ・スペース・小数点 NG
5. 画面下「**変更を保存**」ボタン
6. 「属性が正常に更新されました」緑バナーを確認

**反映タイミング**: 対象ユーザーが次にログイン or トークン更新したとき (60 分以内に自動同期される)。即座に反映させたい場合は本人にハードリロードしてもらう。

**履歴管理**:
- `custom:purchases` には記録されない (Console での直接編集は購入扱いではないため)
- 必要なら手で `custom:purchases` の JSON 配列に `{"at":"<ISO日時>","coins":<付与数>,"note":"運営付与"}` を追記しても良い (任意、運用記録目的)
- 設計書外の手順なので、付与記録は別途運営側で台帳管理推奨 (Notion / Spreadsheet など)

#### よくある間違い

- ❌ `custom:coinBalance` は存在しない属性。正しくは `custom:coins`
- ❌ `10,100` のようにカンマを入れると保存できない (型エラー)
- ❌ `"10000"` のようにダブルクオートを含めるとリテラル文字列が保存される

### 1.4 ユーザーの存在確認

ユーザー一覧画面 (https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ap-northeast-1_vozRgCY5k/users?region=ap-northeast-1) で:

- **email でフィルタ**: 「属性でユーザーを検索」入力欄で email を入力
- **確認ステータス**: 「確認済み」緑バナー = メール検証済み (= ログイン可能)、「確認待ち」= メール未検証
- **ステータス**: 「有効」= 通常、「無効」= 管理者によりブロック

---

## 2. 認証情報・トークンまわり

### 2.1 ログインができないユーザーへの対処

- **Pwd 忘れ**: `https://tamsic.tamjump.com/forgot-password.html` を案内
- **メール検証が完了していない**: Cognito Console でユーザー詳細 → 「ユーザーを検証 (Confirm)」ボタンを管理者が押して強制的に confirmed にできる (招待運用などで使用)
- **アカウント無効化されてる**: Cognito Console → ユーザーアクション → 「ユーザーを有効化」

### 2.2 60 分問題 (refresh_token)

`auth.js` の `refresh_token` 自動更新で解決済 (commit `609d792`)。発生しなくなっているはず。再発した場合は `auth.js` の `_refreshSession()` 周辺を確認。

---

## 3. レター送信機能 (Resend / Worker)

### 3.1 メールが届かないという問い合わせ

確認順:

1. **対象会員のスパムフォルダ確認**: Resend の `letter@tamjump.com` から送信、SPF / DKIM / DMARC 通過済だが Gmail のフィルタで稀にスパム振り分け
2. **Worker のログ確認** (PC で実行):
   ```cmd
   cd %USERPROFILE%\Desktop\tamsic\workers
   wrangler tail
   ```
   送信時にエラーが出てるか確認
3. **Resend ダッシュボード確認**: `https://resend.com/emails` で当該会員の email 宛て送信の Status (Delivered / Bounced / Failed) を確認
4. **letterHistory 確認**: Cognito Console で当該ユーザーの `custom:letterHistory` に該当 trackId の記録があるか (= Worker 処理は成功している)
   - 記録あり → Worker は成功、Resend or Gmail 配信問題
   - 記録なし → Worker 処理が失敗 (auth エラー / 残高不足 / token 期限切れなど)

### 3.2 Resend ドメイン認証が再び詰まった場合

`HANDOFF_v4.md §13.3` に削除→再登録の Step 1〜8 詳細手順あり (セッション⑨で実証済、所要 15 分)。要点:

1. `https://resend.com/api-keys` で `tamsic-letter-prod` Delete
2. `https://resend.com/domains` でドメイン Delete → 同画面で Add (Tokyo region 必須)
3. Auto configure で Cloudflare 連携 → Verify
4. 新 API キー作成 (Sending access、Domain: `tamjump.com` 明示)
5. ローカル PC で `wrangler secret put RESEND_API_KEY` で更新

### 3.3 Worker 再デプロイ

`workers/send-letter.js` を変更したときのみ必要 (フロントは Cloudflare Pages 自動デプロイ):

```cmd
cd %USERPROFILE%\Desktop\tamsic
git pull
cd workers
wrangler deploy
```

成功表示: `✨ Deployed tamsic-send-letter triggers ...`

---

## 4. コンテンツ追加・更新

`docs/TAMSIC_コンテンツ追加マニュアル.md` を参照 (旧版あり、必要に応じて更新)。

### 4.1 楽曲追加の流れ (v4.2.2.12 以降の運用)

**前提変更**: v4.2.2.12 で会員先行視聴は廃止。YouTube 公開日 = サイト表示日。「サイトで聴く」内蔵プレイヤーも廃止。

1. **アセット配置** (Claude が repo に push):
   - 画像 PNG → `assets/images/<artist>/<artist>_<title>.png`
   - 音声 MP3 → `assets/audio/<artist>/<artist>_<title>.mp3`
   - ※ MP4 サンプル動画は YouTube 素材として除外 (Cloudflare Pages 容量節約)
2. **`tamsic-content.js` に track エントリー追加**:
   - 必須フィールド: `id`, `artist`, `order`, `title`, `price`, `isNew`, `youtubeUrl`, `coverPath`, `audioPath`, `lyrics`, `lyricsPreview`, `durationSec`, `titleEn`, `creatorNote`, `closings`
   - 不要になったフィールド: `sampleStart`, `sampleEnd` (内蔵プレイヤー廃止のため)
3. **`release-control.js` の `config.tracks` に追加**:
   - `"曲タイトル":{release:"YYYY-MM-DD"}` の 1 行
   - この日付以降が公開状態 (`full`)、未満は `locked` (COMING SOON)
4. **`tamsic-content.js` の `news` 配列にリリースニュース追加**:
   - `id: news-<trackid>-release` の形式、`tag: Release`
5. **全 HTML のキャッシュバスター bump** (`?v=4.2.X.Y`)
6. push → Cloudflare Pages 自動デプロイ

### 4.2 公開日制御の運用 (v4.2.2.12 以降)

- `release-control.js` の `config.tracks` で曲ごとに `release` 日を指定
- 公開日前: `COMING SOON / YYYY.MM.DD 公開予定` 表示、モザイク有り、フル試聴ボタン無効
- 公開日以降: `NOW AVAILABLE / YYYY.MM.DD 公開` 表示、モザイク無し、フル試聴可
- v4.2.2.14 で ADMIN 特権を撤廃: TAmJump (運営者) も一般ユーザーと同じ挙動。
  動作確認したい場合は別アカウント (例: 専用テストアカウント) を作成し、
  そこにコイン付与して実機ログインする運用に変更。

---

## 5. キャッシュバスター運用

`HANDOFF_v4.md §8` の絶対指示:

- フロント変更を push する前に必ず `?v=4.2.X.Y` を bump
- 対象: `index.html` / `nono.html` / `kiki.html` / `gen.html` / `mypage.html` / `news.html` / `about.html` / `login.html` / `signup.html` / `callback.html` / `forgot-password.html` / `reset-password.html` / `admin.html` (全 13 HTML)
- 命名規則: `4.2.<MAJOR>.<MINOR>` 形式
- セッション⑨ 終了時点: **`4.2.2.12`**

---

## 6. push 前チェックリスト (HANDOFF §7.4 より)

```bash
# 1. JS 構文チェック
node --check workers/send-letter.js
node --check letter-renderer.js  # 変更時のみ
node --check release-control.js  # 変更時のみ
node --check mobile-nav.js       # 変更時のみ

# 2. CSS 中括弧バランス
python3 -c "with open('letter.css') as f: c=f.read(); print(c.count('{'),c.count('}'))"
python3 -c "with open('mobile.css') as f: c=f.read(); print(c.count('{'),c.count('}'))"

# 3. シークレット平文混入チェック
grep -rn "ghp_\|re_e\|re_E" . --include="*.js" --include="*.css" --include="*.html" 2>/dev/null

# 4. キャッシュバスター bump 確認
grep "v=4.2" nono.html | head -5

# 5. (v4.2.2.12 以降) サイトで聴く / panel-site 残骸チェック
grep "サイトで聴く\|panel-site\|setMode.*'site'" *.html
```

すべて通ったら commit & push。

---

## 7. 緊急時の連絡先・参考リンク

| サービス | URL | 用途 |
|---|---|---|
| Cloudflare ダッシュボード | https://dash.cloudflare.com | Pages デプロイ状況、DNS、Worker |
| AWS Cognito Console | https://ap-northeast-1.console.aws.amazon.com/cognito/v2/idp/user-pools/ap-northeast-1_vozRgCY5k | ユーザー管理 |
| Resend ダッシュボード | https://resend.com/emails | 送信ログ、ドメイン認証、API キー |
| GitHub repo | https://github.com/TAmJump/tamsic | ソースコード |
| 本番サイト | https://tamsic.tamjump.com | エンドユーザー画面 |

---

## 8. 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05-10 | 初版作成 (セッション⑨)。コイン直接付与手順、Cognito 6 属性一覧、Resend / Worker トラブル対応を集約。 |
| 2026-05-12 | v4.2.2.12 反映。§4 楽曲追加手順を会員先行廃止後の仕様に書き換え、`release-control.js` 公開日制御運用を §4.2 として追加。§5 のキャッシュバスター現行値を 4.2.2.12 に更新、対象 HTML を 13 ファイル明記。§6 チェックリストに mobile-nav.js / mobile.css / 内蔵プレイヤー残骸チェックを追加。 |
