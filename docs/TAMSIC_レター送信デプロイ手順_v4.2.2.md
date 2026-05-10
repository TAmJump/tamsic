# TAMSIC レター送信機能 デプロイ手順 v4.2.2 — 実機検証済み・トラブルシューティング込み

**最終更新**: 2026-05-10 (Resend ドメイン詰まり + openid scope 問題反映)
**前版**: TAMSIC_レター送信デプロイ手順_v4.2.1.md (2026-05-09、Phase G 完了想定だった)

このドキュメントは、レター送信機能を稼働させるために TAmJump 側で実施した **AWS / Cloudflare / Resend の実作業手順 + 詰まったポイント + 回避策**を、実機検証ベースで全部記録したもの。再構築や移行時のリファレンスとして使う。

---

## 全体像

```
[Browser]
   │ POST { trackId, lyrics, ... } + Bearer id_token  ← v4.2.1.5 で id_token に変更
   ▼
[Cloudflare Worker: tamsic-send-letter]
   │ 1) verifyUser(): id_token を decode → email 取得
   │    (フォールバック: /oauth2/userInfo @ access_token)
   │ 2) 抽選 (frame, closing) を Worker 側で再実行
   │ 3) HTML メール組立 (インライン CSS)
   │ 4) Resend API で送信  ← 現在ここで失敗中 (ドメイン Verified ではない)
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

App client `62e35ra0h4s2dr657euorlm5bu` で:
- 上記 6 属性すべて **Read / Write 許可済み**
- **OpenID Connect スコープ**: `openid` / `email` / `profile` / `phone` / `aws.cognito.signin.user.admin` の5つ全部許可済み

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
12. **OpenID Connect スコープも確認**: 「ログインページ」タブ → マネージドログインページの設定 → 編集
13. OIDC スコープに `OpenID` `Eメール` `プロファイル` `aws.cognito.signin.user.admin` をすべて追加 → 変更を保存

### 検証方法

ブラウザで mypage.html → 「プロフィール」セクションで nickname と誕生日を保存 → 「保存しました」緑表示が出れば OK。

### ⚠️ 注意: openid scope と access_token の関係

login.html は SDK 直叩き (`CognitoUser.authenticateUser()`) を使っているため、**access_token に scope (openid 含む) が含まれない**。

これは Cognito の仕様で、Hosted UI フロー (`/oauth2/authorize?scope=...`) でないと scope は乗らない。

→ **回避策として v4.2.1.5 で id_token を Bearer に使う実装に変更済み** (Phase G 後の追加対応、commit 8d1e8a1)。

---

## Phase E: Cloudflare Worker をデプロイ ✅ 完了

### Worker 概要

- **名前**: `tamsic-send-letter`
- **公開 URL**: `https://tamsic-send-letter.animalb001.workers.dev/`
- **Cloudflare アカウント**: `tamj_Account` (login: `animalb001@gmail.com`)
- **ソース**: repo の `workers/send-letter.js`
- **設定ファイル**: `workers/wrangler.toml`
- **最新 Version ID**: `59f1888d-1db0-48eb-9df4-9093b3018e3f` (id_token 対応版、commit 8d1e8a1 ベース)

### 環境変数 (`[vars]`、wrangler.toml に定義済み)

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

:: ④ repo を clone (PAT はユーザーから受け取る)
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

### コード更新後の再デプロイ

`send-letter.js` を変更したら必ず再デプロイ:
```cmd
cd %USERPROFILE%\Desktop\tamsic
git pull
cd workers
wrangler deploy
```

(secret の更新だけなら再 deploy 不要)

### ロールバック

`wrangler rollback` で前バージョンへ戻す、または `wrangler delete tamsic-send-letter` で完全停止。

### Worker のログ確認

#### 方法 A: ターミナル (確実)
```cmd
cd %USERPROFILE%\Desktop\tamsic\workers
wrangler tail
```
リアルタイムログ。Ctrl+C で停止。

#### 方法 B: Cloudflare Dashboard
```
https://dash.cloudflare.com → Workers & Pages → tamsic-send-letter → Observability
```

---

## Phase F: Resend ドメイン認証 ⚠️ 詰まり中

### Resend アカウント

- **ログイン**: `animalb001@gmail.com` (GitHub OAuth サインアップ)
- **Team name**: TAmJump

### ドメイン設定 (現状)

- **ドメイン**: `tamjump.com`
- **Status**: ⚠️ **Not Started のまま動かない**
- **Region**: Tokyo (ap-northeast-1)
- **Enable Sending**: ON
- **Enable Receiving**: OFF

### DNS レコード (Cloudflare DNS、Auto Configure 済)

3 レコードすべて **Proxy status = DNS only** (グレー雲アイコン)。

| Type | Name | Content | TTL | 用途 | Resend Status |
|------|------|---------|-----|------|---------------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCa...` | Auto | DKIM | ✅ Verified |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Auto | SPF | ❌ Not Started |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` (priority 10) | Auto | バウンス | ❌ Not Started |

### 外部 DNS Propagation (whatsmydns.net で確認)

`https://www.whatsmydns.net/#TXT/send.tamjump.com` で世界中のすべての DNS サーバーから `v=spf1 include:amazonses.com ~all` が緑チェックで返ってくる。

つまり **Cloudflare DNS は完璧、世界中で見えてる**。Resend 側だけが認識してない。

### API Key (現状)

- **名前**: `tamsic-letter-prod`
- **Permission**: Sending access
- **Domain scope**: `tamjump.com`
- **Token**: `re_eEtGXsZf...` (本ドキュメントには冒頭8文字のみ記載、Worker secret に登録済)

### エラー詳細 (Worker Observability で確認)

```json
{
  "level": "error",
  "statusCode": 400,
  "message": "The associated domain with your API key is not verified. Please, create a new API key with full access or with a verified domain.",
  "$workers": {
    "scriptName": "tamsic-send-letter",
    "scriptVersion": { "id": "59f1888d-1db0-48eb-9df4-9093b3018e3f" }
  }
}
```

### 実機操作手順 (Resend 初回セットアップ、再現用)

1. https://resend.com → Sign Up → GitHub OAuth (`Continue with GitHub`)
2. 認可画面で **Authorize Resend** (Personal user data > Email read のみ)
3. オンボーディング (Team name, 用途選択) を進めてダッシュボード到達
4. 左サイドバー **Domains** → 右上 **Add Domain** → `tamjump.com` 入力 + Region: Tokyo 選択 → Add
5. **Auto configure** ボタン (Cloudflare ロゴ) を押す
6. Cloudflare の認可画面 → 内容確認 → **Authorize** で 3 レコードが Cloudflare DNS に自動追加される
7. Resend のドメインページに戻る → ステータスが **Not Started** または **Pending** に
8. 数分待つ (DNS 反映、通常 5-30 分)
9. ドメイン詳細を開いて、右上 **Verify DNS Records** ボタンを押す
10. 成功時: **Verified** (緑) に変わる
11. **失敗時 (本セッションで遭遇)**: Status が **Not Started のまま動かない**

### Resend ドメイン詰まり時の対処 (本セッションで判明)

#### オプション A: 削除→再登録 (確実、所要15分)

##### Step 1: 旧 API キー削除
- URL: `https://resend.com/api-keys`
- `tamsic-letter-prod` の右の `…` メニュー → Delete API Key
- 確認画面で `tamsic-letter-prod` をタイプ → Delete API Key ボタン押下

##### Step 2: ドメイン削除
- URL: `https://resend.com/domains`
- `tamjump.com` 行をクリックして詳細ページへ
- 右上の `…` メニュー → Delete domain
- 確認画面で `tamjump.com` をタイプ → Delete domain ボタン押下

##### Step 3: ドメイン再登録
- 同じ `https://resend.com/domains` 画面で右上 `+ Add domain`
- Domain: `tamjump.com`
- Region: Tokyo (ap-northeast-1)
- Add ボタン押下

##### Step 4: Cloudflare DNS 自動同期 (再)
- 詳細ページで Auto configure ボタン押下
- Cloudflare の認可画面 → Authorize
- 既存の3レコードはそのまま使われる (新規追加なし)

##### Step 5: Verify DNS Records (再)
- Resend のドメイン詳細画面に戻る
- 右上 Verify DNS Records ボタン押下
- 数秒〜数分待つ → Status が Verified (緑) になる確認

##### Step 6: API キー新規発行
- URL: `https://resend.com/api-keys`
- Create API Key ボタン
- Name: `tamsic-letter-prod`
- Permission: **Sending access** (Full access ではなく)
- Domain: **`tamjump.com`** を明示選択 (All Domains ではない)
- Add ボタン押下
- 表示された `re_xxx...` をコピー

##### Step 7: Worker secret 更新
ターミナルで:
```cmd
cd %USERPROFILE%\Desktop\tamsic\workers
wrangler secret put RESEND_API_KEY
```
プロンプトに新キーを貼り付け → Enter

(secret 更新は即時反映、Worker 再 deploy 不要)

##### Step 8: 送信テスト
ブラウザで `https://tamsic.tamjump.com/nono.html` → ハードリロード → フル試聴解放されていれば便箋下「この手紙をメールで受け取る」ボタン → 送信する → 受信箱確認

#### オプション B: 数時間〜翌日待ち
Resend の検証キューが詰まってる可能性。1〜2時間〜翌朝放置してから Verify DNS Records ボタンを押すと通る場合がある。

#### オプション C: 暫定動作確認 (本番不可)
Worker の `to` を `animalb001@gmail.com` (Resend オーナー、ドメイン未認証でも送信可能) に固定して動作確認だけする。本番には適さない。

#### オプション D: Resend サポート問い合わせ
英語メールテンプレート (詳細は HANDOFF_v4.md §9.2)。

### 動作確認

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

## Phase G: フロント flag ON → 本番稼働 ✅ 完了 (Resend 詰まりで送信失敗中)

### 変更内容 (commit `128d814` + `8d1e8a1`)

#### `128d814` (初回稼働化):
- `letter-send.js`: ENDPOINT を `https://tamsic-send-letter.animalb001.workers.dev/` に固定
- `tamsic-content.js`: `features['letter-receive']` を `true` に
- `?v=4.2.1.4` バンプ

#### `8d1e8a1` (openid scope 回避):
- `letter-send.js`: Bearer に id_token を優先送信、なければ access_token フォールバック
- `workers/send-letter.js`: `verifyUser` を改修 (id_token decode → email、失敗時 userInfo フォールバック)
- `?v=4.2.1.5` バンプ

### 検証シナリオ (Resend 詰まり解消後)

```
[1] https://tamsic.tamjump.com/nono.html を開く
[2] F12 → リロードボタン右クリック → 「キャッシュの消去とハード再読み込み」
[3] ログイン状態のまま、フル試聴ボタン押下 → 30 coin 消費
[4] アンロック後、便箋表示
    - 18枠のいずれか (frame-A 〜 frame-R)
    - Dear ●● = mypage で保存した nickname
    - 透かしが歌詞に混入していない
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

## トラブルシューティング (本セッションで遭遇したケース)

### ケース 1: 401 Unauthorized (invalid-token)

**原因**: access_token に openid scope なし → `/oauth2/userInfo` が拒否

**対処** (実装済):
- letter-send.js が id_token を Bearer に使う
- Worker の verifyUser が id_token decode 経由

**確認方法** (DevTools Console):
```js
const it = localStorage.getItem('tamsic_id_token');
console.log(JSON.parse(atob(it.split('.')[1])));
// => { aud: '62e35ra0h4s2dr657euorlm5bu', email: 'tiger@tamjump.com', ... }
```

### ケース 2: 502 Bad Gateway / resend-failed

**原因**: Resend ドメインが Verified ではない

**確認方法** (Worker Observability):
```
"message": "The associated domain with your API key is not verified..."
```

**対処**: Phase F の「Resend ドメイン詰まり時の対処」を参照

### ケース 3: 残高 0 表示

**原因**: `localStorage.clear()` 実行後、Cognito からの sync 待ち

**対処**:
```js
// DevTools Console
loadWallet().then(w => console.log('synced:', w));
```

または mypage を F5 リロード (auth.js が自動で sync する)。

### ケース 4: wrangler login タイムアウト (Windows + 非デフォルトブラウザ)

**症状**: `wrangler login` 実行後ブラウザ認可成功、しかしターミナルに `ERROR Timed out waiting for authorization code, please try again.`

**対処**: API Token 方式に切替
```cmd
:: Cloudflare Dashboard > My Profile > API Tokens
:: → Create Token → "Edit Cloudflare Workers" テンプレート
:: → Account Resources を tamj_Account のみに絞る
:: → Create → トークン文字列をコピー
set CLOUDFLARE_API_TOKEN=<コピーしたトークン>
wrangler whoami  ::確認
```

### ケース 5: Resend Auto configure 失敗

**症状**: Auto configure ボタンを押しても Cloudflare の認可画面が出ない or DNS レコードが追加されない

**対処**: Manual setup タブに切替 → 表示される 3レコードを Cloudflare DNS で手動追加 (Proxy=DNS only 必須)

### ケース 6: 完全ログアウト ((Cognito session 切らないと scope 反映されない))

**手順**:
```js
// DevTools Console
localStorage.clear();
sessionStorage.clear();
window.location.href = 'https://ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com/logout?client_id=62e35ra0h4s2dr657euorlm5bu&logout_uri=' + encodeURIComponent('https://tamsic.tamjump.com/');
```

これで Cognito 側の cookie もクリア → 再ログインで完全に新しい OAuth フローが走る。

---

## ロールバック手順

| 段階 | 影響 | ロールバック |
|---|---|---|
| Phase G (機能停止) | 受信ボタン非表示 | `tamsic-content.js` の `features['letter-receive']` を `false` → push (5秒) |
| Phase F (Resend 障害) | メール送信失敗 | Resend Dashboard で API キー無効化、または Worker secret を空に |
| Phase E (Worker 不調) | 送信機能停止 | `wrangler rollback` で前バージョン、または `wrangler delete` |
| Phase D (Cognito 障害) | プロフィール保存失敗 | (基本起こらない) AWS Console で属性削除すれば schema エラーで silent 失敗 |

各 Phase は独立しているため、他の機能 (フル試聴、コイン購入、便箋表示) には影響しない。

---

## 既知の制約 (§22 行き)

1. **Cognito letterHistory 2048 文字上限** — FIFO 10件運用、超過時は自動で古い順に削除。長期は DynamoDB 移行検討
2. **Resend 月3,000通の無料枠** — 超過時は有料プラン (月 $20〜) or AWS SES 移行
3. **Outlook メール互換** — 未テスト、受信側報告ベースで微調整
4. **アクセストークン60分問題** — `auth.js` の `_refreshTokens` で自動更新済み (解決済)
5. **アプリ化対応** — Worker はそのままモバイルからも叩ける。ネイティブ歌詞保護はアプリ実装で別途必要
6. **login.html SDK 直叩き → access_token に scope なし** — id_token 方式で回避済 (根本対応は Hosted UI 経由への書換)
7. **Worker JWT 署名検証省略** — id_token の署名を JWKS で検証してない (cold-start 軽量化のため)

---

## 緊急時の確認場所

- **Worker のログ**: ターミナルで `wrangler tail` または Cloudflare Dashboard > Workers > tamsic-send-letter > **Observability**
- **Resend の送信履歴**: Resend Dashboard > **Emails** (失敗ログも見える)
- **Cognito の障害**: AWS Console > Cognito > User Pool > **Monitoring**
- **Cloudflare Pages デプロイ**: Cloudflare Dashboard > Pages > tamsic > **Deployments**

---

**END OF DEPLOY MANUAL v4.2.2 (実機検証済み + トラブルシューティング込み)**
