# TAMSIC レター送信機能 デプロイ手順 (v4.2.1) — 実機検証済み完全版

**最終更新**: 2026-05-09 (Phase D/E/F/G 全て実機完了済み)

このドキュメントは、レター送信機能を稼働させるために TAmJump 側で実施した **AWS / Cloudflare / Resend の実作業手順を、実機検証ベースで全部記録**したもの。再構築や移行時のリファレンスとして使う。

> **本番状態 (2026-05-09)**: 全 Phase 完了、機能稼働中。新規セットアップは不要。

---

## 全体像

```
[Browser]
   │ POST { trackId, lyrics, ... } + Bearer access_token
   ▼
[Cloudflare Worker: tamsic-send-letter]
   │ 1) /oauth2/userInfo で access_token 検証
   │ 2) 抽選 (frame, closing) を Worker 側で再実行
   │ 3) HTML メール組み立て (インライン CSS)
   │ 4) Resend API で送信
   ▼
[Resend] → ユーザーのメールボックス
   │ 成功 → response { ok, frame, closingText, sentDate, ... }
   ▼
[Browser]
   │ Cognito custom:letterHistory に1件追加
   ▼
[mypage で受信履歴表示 (将来拡張)]
```

---

## Phase D: AWS Cognito User Pool に custom 属性を追加 ✅ 完了

### 確定した属性 (2026-05-09 追加完了)

User Pool: `ap-northeast-1_vozRgCY5k` (リージョン: 東京)

#### 既存属性 (元から存在)
- `custom:coins` (String, max 2048, mutable=true) — コイン残高
- `custom:purchases` (String, max 2048, mutable=true) — 購入履歴

#### 新規追加属性 (Phase D で追加)
- `custom:nickname` (String, max 40, mutable=true) — レター便箋の Dear ●●
- `custom:birthday` (String, max 10, mutable=true) — YYYY-MM-DD、誕生日枠 frame-O 判定
- `custom:registeredAt` (String, max 25, mutable=true) — ISO8601 or YYYY-MM-DD、周年枠 frame-P 判定 (auth.js が初回ログイン時に自動セット)
- `custom:letterHistory` (String, max 2048, mutable=true) — 送信済みレター記録 (FIFO 上限10件、JSON 配列)

### App client の権限設定

App client `62e35ra0h4s2dr657euorlm5bu` で、上記 6 属性すべて **Read / Write 許可済み**。

### 実機操作手順 (再現用)

1. AWS Console (https://console.aws.amazon.com/) → リージョン: アジアパシフィック (東京)
2. 上部検索バーで `Cognito` → User Pool `kzohfe` (= `ap-northeast-1_vozRgCY5k`) をクリック
3. 左サイドバー > 認証 > **サインアップ** をクリック
4. 中段「カスタム属性」セクションの右上 **「カスタム属性を追加」** ボタン
5. ダイアログで4個まとめて入力 (Type=String、上限値、変更可能=チェックON)
6. 「変更を保存」
7. 左サイドバー > アプリケーション > **アプリケーションクライアント**
8. クライアント `tamsic` (ID: `62e35ra0h4s2dr657euorlm5bu`) を開く
9. 「属性の読み取りおよび書き込み許可」セクションの右上 **「編集」**
10. 新規 4 属性すべてに Read/Write チェックを入れる
11. 「変更を保存」

### 検証方法

ブラウザで mypage.html → 「プロフィール」セクションで nickname と誕生日を保存 → 「保存しました」緑表示が出れば OK。

---

## Phase E: Cloudflare Worker をデプロイ ✅ 完了

### Worker 概要

- **名前**: `tamsic-send-letter`
- **公開 URL**: `https://tamsic-send-letter.animalb001.workers.dev/`
- **Cloudflare アカウント**: `tamj_Account` (login: `animalb001@gmail.com`)
- **ソース**: repo の `workers/send-letter.js` (約 350 行)
- **設定ファイル**: `workers/wrangler.toml`

### 環境変数 (`[vars]` セクション、wrangler.toml に定義済み)

```toml
COGNITO_DOMAIN  = "ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com"
ALLOWED_ORIGINS = "https://tamsic.tamjump.com"
FROM_ADDRESS    = "TAMSIC <letter@tamjump.com>"
```

### Secret (wrangler secret put で登録)

- `RESEND_API_KEY` — Resend で発行した API キー (`re_xxx`)

### デプロイ手順 (再現用)

ローカル PC (Node.js v18+ 必要、本番は v24.14.0 で実施):

```cmd
:: ① wrangler CLI セットアップ
npm install -g wrangler
wrangler --version
:: => wrangler 4.90.0 等

:: ② Cloudflare 認証
::    OAuth ブラウザ往復は Windows + 非デフォルトブラウザでタイムアウトすることあり
::    その場合は API Token 方式が確実
::
::    Cloudflare Dashboard > My Profile > API Tokens
::    → Create Token → "Edit Cloudflare Workers" テンプレート
::    → Account Resources を tamj_Account のみに絞る
::    → Continue → Create Token → トークン文字列をコピー
set CLOUDFLARE_API_TOKEN=<コピーしたトークン>

:: ③ 動作確認
wrangler whoami
:: => tamj_Account とアカウント ID が表示されれば OK

:: ④ repo を clone (PAT は HANDOFF v3 に記載のものを使用)
cd %USERPROFILE%\Desktop
git clone https://x-access-token:<PAT>@github.com/TAmJump/tamsic.git

:: ⑤ Worker をデプロイ
cd tamsic\workers
wrangler deploy
:: => Uploaded tamsic-send-letter (1.79 sec)
:: => Deployed tamsic-send-letter triggers (1.04 sec)
:: =>   https://tamsic-send-letter.animalb001.workers.dev

:: ⑥ Resend API キーを secret として登録
wrangler secret put RESEND_API_KEY
:: => Enter a secret value: re_xxxxxxxxxxxxxxxxxxxxxxxxxx
:: => Success! Uploaded secret RESEND_API_KEY
```

### 検証方法

ブラウザで `https://tamsic-send-letter.animalb001.workers.dev/` を開く → JSON で `{"ok":false,"error":"method-not-allowed"}` が返れば OK (GET は仕様上 405)。

### ロールバック

`wrangler rollback` で前バージョンへ戻す、または `wrangler delete tamsic-send-letter` で完全停止。

---

## Phase F: Resend ドメイン認証 ✅ 完了

### Resend アカウント

- **ログイン**: `animalb001@gmail.com` (GitHub OAuth サインアップ)
- **Team name**: TAmJump

### ドメイン設定

- **ドメイン**: `tamjump.com`
- **Status**: Verified (2026-05-09)
- **Region**: Tokyo (ap-northeast-1)
- **Enable Sending**: ON
- **Enable Receiving**: OFF (送信専用、バウンスは MX レコードで受ける)

### DNS レコード (Cloudflare DNS に Auto Configure で追加)

3 レコードすべて **Proxy status = DNS only** (グレー雲アイコン)。

| Type | Name | Content | TTL | 用途 |
|------|------|---------|-----|------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCa...` (DKIM 公開鍵、長い) | Auto | DKIM 署名検証 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Auto | SPF |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` (priority 10) | Auto | バウンス受信 |

### API Key

- **名前**: `tamsic-letter-prod`
- **Permission**: Sending access
- **Domain scope**: `tamjump.com`
- **値**: `re_xxxxxxxx...` (Worker secret に登録済み、画面では一度しか表示されない)

### 実機操作手順 (再現用)

1. https://resend.com → Sign Up → GitHub OAuth (`Continue with GitHub`)
2. 認可画面で **Authorize Resend** (Personal user data > Email read のみ)
3. オンボーディング (Team name, 用途選択) を進めてダッシュボード到達
4. 左サイドバー **Domains** → 右上 **Add Domain** → `tamjump.com` 入力 + Region: Tokyo 選択 → Add
5. **Auto configure** ボタン (Cloudflare ロゴ) を押す
6. Cloudflare の認可画面 → 内容確認 → **Authorize** で 3 レコードが Cloudflare DNS に自動追加される
7. Resend のドメインページに戻る → ステータスが **Pending** (検証中)
8. 数分待つ (DNS 反映、通常 5-30 分)
9. ドメイン詳細を開いて、右上 **Verify DNS Records** ボタンを押す
10. 数秒〜数十秒で **Verified** (緑) に変わる
11. 左サイドバー **API keys** → **Create API Key**
12. Name: `tamsic-letter-prod`、Permission: `Sending access`、Domain: `tamjump.com` → Add
13. 表示された `re_xxx` をコピー → Worker secret として `wrangler secret put RESEND_API_KEY` で登録

### 検証方法

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_xxxxx..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": "TAMSIC <letter@tamjump.com>",
    "to": ["your-test@gmail.com"],
    "subject": "Resend test",
    "html": "<p>Hello from Resend</p>"
  }'
```

200 が返れば成功。受信箱を確認してメールが届いているか見る。

---

## Phase G: フロント flag ON → 本番稼働 ✅ 完了

### 変更内容 (commit `128d814`)

- `letter-send.js`: ENDPOINT を `https://tamsic-send-letter.animalb001.workers.dev/` に固定 (環境変数 `window.TAMSIC_LETTER_ENDPOINT` で上書き可能)
- `tamsic-content.js`: `features['letter-receive']` を `true` に
- 各 HTML のキャッシュバスター: `?v=4.2.1.4`

### 検証シナリオ (本番動作確認)

```
[1] https://tamsic.tamjump.com/nono.html を開く
[2] F12 → リロードボタン右クリック → 「キャッシュの消去とハード再読み込み」
[3] ログインしている状態で「ぎりぎりだよ。」のフル試聴ボタン押下 → 30 coin 消費
[4] アンロック後、便箋表示
    - 18枠のいずれか (frame-A 〜 frame-R)
    - Dear ●● = mypage で保存した nickname
    - 透かしが歌詞に混入していない (column-flow 修正済み)
    - postmark に当日日付
[5] 便箋下に「別の一文」「この手紙をメールで受け取る」ボタン表示
[6] 「この手紙をメールで受け取る」押下
[7] 確認モーダル: Dear ●● = nickname、送信先 = 登録メアド
[8] 「送信する」押下
[9] 数秒で「送信しました」モーダル
[10] 登録メアドの受信箱に件名「<artist> from TAMSIC — <title>」のメール到着
[11] 同じ曲で再度押下 → 「既に送信済み」アラート
[12] mypage で letterHistory が記録されている (DevTools の console で確認可能):
    > await TAMSICAuth.fetchUserProfile()
    => letterHistory: [{ trackId, frameId, sentDate, ... }]
```

---

## ロールバック手順

| 段階 | 影響 | ロールバック |
|---|---|---|
| Phase G (機能停止) | 受信ボタン非表示 | `tamsic-content.js` の `features['letter-receive']` を `false` → push (5秒) |
| Phase F (Resend 障害) | メール送信失敗 | Resend Dashboard で API キー無効化、または Worker secret を空に → 受信ボタン押下時にエラー表示 |
| Phase E (Worker 不調) | 送信機能停止 | `wrangler rollback` で前バージョン、または `wrangler delete` |
| Phase D (Cognito 障害) | プロフィール保存失敗 | (基本起こらないが) AWS Console で属性削除すれば schema エラーで silent 失敗 |

各 Phase は独立しているため、他の機能 (フル試聴、コイン購入、便箋表示) には影響しない。

---

## 既知の制約 (§22 行き)

1. **Cognito letterHistory 2048 文字上限** — FIFO 10件運用、超過時は自動で古い順に削除。長期は DynamoDB 移行検討。
2. **Resend 月3,000通の無料枠** — 超過時は有料プラン (月 $20〜) or AWS SES 移行。
3. **Outlook メール互換** — 未テスト、受信側報告ベースで微調整。
4. **アクセストークン60分問題** — `auth.js` の `_refreshTokens` で自動更新済み (Phase 完了前の課題、今は解決)。
5. **アプリ化対応** — Worker はそのままモバイルからも叩ける。ネイティブ歌詞保護はアプリ実装で別途必要。

---

## 緊急時の確認場所

- **Worker のログ**: Cloudflare Dashboard > Workers > tamsic-send-letter > **Logs** (リアルタイム表示)
- **Resend の送信履歴**: Resend Dashboard > **Emails** (失敗ログも見える)
- **Cognito の障害**: AWS Console > Cognito > User Pool > **Monitoring**
- **Cloudflare Pages デプロイ**: Cloudflare Dashboard > Pages > tamsic > **Deployments**

---

**END OF DEPLOY MANUAL v4.2.1 (実機検証済み)**
