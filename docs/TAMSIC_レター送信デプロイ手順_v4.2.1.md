# TAMSIC レター送信機能 デプロイ手順 (v4.2.1)

設計書 §10.14 (Phase A〜G) に対応する**実作業マニュアル**。

このドキュメントは、コード側の実装は完了している前提で、**TAmJump 側で必要な AWS / Cloudflare / Resend の設定**を漏れなく実施するためのチェックリスト。

---

## 全体像

```
[Browser]
   │ POST { trackId, lyrics, ... } + Bearer access_token
   ▼
[Cloudflare Worker: tamsic-send-letter]
   │ 1) /oauth2/userInfo で access_token 検証
   │ 2) 抽選 (frame, closing) を Worker 側で再実行
   │ 3) HTML メール組み立て
   │ 4) Resend API で送信
   ▼
[Resend] → ユーザーのメールボックス
   │ 成功 → response { ok, frame, closingText, ... }
   ▼
[Browser]
   │ Cognito custom:letterHistory に1件追加
   ▼
[mypage で受信履歴表示]
```

---

## Phase D: Cognito User Pool に custom 属性を追加

### 必要な属性 (4つ)

AWS Console > Cognito > User Pool `ap-northeast-1_vozRgCY5k` > **Sign-up experience** > **Custom attributes** で追加:

| 属性名 (※プレフィックス `custom:` は自動付与) | Type   | Min | Max  | Mutable |
|---|---|---|---|---|
| `nickname`     | String | 0   | 40   | ✅ Yes |
| `birthday`     | String | 0   | 10   | ✅ Yes |
| `registeredAt` | String | 0   | 25   | ✅ Yes |
| `letterHistory`| String | 0   | 2048 | ✅ Yes |

**注意**: 既存ユーザーには空文字で追加されます。`registeredAt` は `auth.js` の `_ensureRegisteredAt()` が初回ログイン時に自動セットします。

### App client 側の権限設定

同 User Pool > **App integration** > 該当 App client `62e35ra0h4s2dr657euorlm5bu` > **Edit attribute read and write permissions**:

すべての custom 属性に **Read** と **Write** チェックを入れる。これがないと `updateAttributes` が失敗します。

---

## Phase E: Cloudflare Worker をデプロイ

### 前提
- Cloudflare アカウント (Pages を使ってる前提)
- ローカルに `wrangler` CLI: `npm install -g wrangler`
- `wrangler login` 済み

### 1. Worker をデプロイ

```bash
cd workers
wrangler deploy
```

成功すると `https://tamsic-send-letter.<your-account>.workers.dev` が払い出される。

### 2. Secret を登録

```bash
# Resend API キー (Phase F で取得した値)
wrangler secret put RESEND_API_KEY
# → プロンプトで re_xxxxx... を貼り付け
```

`RESEND_API_KEY` 以外の環境変数 (`COGNITO_DOMAIN`, `ALLOWED_ORIGINS`, `FROM_ADDRESS`) は `wrangler.toml` の `[vars]` で管理しているので追加作業不要。値変更時は `wrangler.toml` を編集して再 deploy。

### 3. (任意) カスタムドメイン

CF Dashboard > Workers & Pages > tamsic-send-letter > **Triggers** > **Custom Domains** で例えば `letter-api.tamjump.com` を割当可能。割当後、フロント側 `letter-send.js` の ENDPOINT 定数を書き換えて再デプロイ。

または `index.html` 等で `window.TAMSIC_LETTER_ENDPOINT = 'https://letter-api.tamjump.com/'` を `letter-send.js` 読込前に設定すればコード変更なしで切替可能。

---

## Phase F: Resend ドメイン認証 + API キー発行

### 1. Resend アカウント作成

https://resend.com にサインアップ (Google / GitHub OAuth 可)。

### 2. ドメイン追加

Dashboard > **Domains** > **Add Domain** > `tamjump.com` を追加。

### 3. DNS レコードを Cloudflare に追加

Resend が表示する SPF / DKIM / DMARC レコードを、CF Dashboard > tamjump.com > DNS > Records で追加:

| Type | Name        | Content (Resend が指定する値) |
|---|---|---|
| TXT  | `tamjump.com` (or `@`) | `v=spf1 include:amazonses.com include:_spf.resend.com ~all` |
| CNAME | `resend._domainkey` | (Resend が指定する DKIM の CNAME) |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@tamjump.com` (推奨) |

CF 側で **Proxy はオフ** (グレー雲) — メール認証レコードはプロキシ不可。

### 4. Verify ボタンを押して "Verified" になるのを確認

通常 5-30 分で完了。

### 5. API キー発行

Dashboard > **API Keys** > **Create API Key** > 名前 `tamsic-letter-prod` > Permissions: `Sending access to tamjump.com` > 値をコピー (`re_xxxxx...`)。

→ この値を **Phase E の手順 2** で `wrangler secret put RESEND_API_KEY` に投入。

### 6. テスト送信

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

200 が返れば成功。

---

## Phase G: 本格稼働

### 1. feature flag を確認

`tamsic-content.js` の `features['letter-receive']` が `true` になっていること:

```js
"features": {
  "letter-receive": true,
  ...
}
```

(本セッションで既に true に設定済み)

### 2. ENDPOINT が正しいか確認

`letter-send.js` の `ENDPOINT` 定数が Phase E でデプロイした Worker URL を指しているか:

```js
const ENDPOINT = (window.TAMSIC_LETTER_ENDPOINT || 'https://tamsic-send-letter.tamjump.workers.dev/');
```

Cloudflare アカウント名が異なる場合は書き換える。

### 3. 動作確認シナリオ

ログイン状態で:

1. mypage を開いて **「お名前」** に "JIN" を入れて保存
2. nono.html で「ぎりぎりだよ。」のフル試聴をアンロック
3. 便箋下の **📮 この手紙をメールで受け取る** ボタンを押下
4. 確認モーダルで「Dear ●● = JIN」「送信先 = (登録メアド)」が表示される
5. 送信ボタンを押下
6. 数分以内にメール到着、便箋HTMLが表示される
7. 同じ曲で再度ボタンを押すと「既に送信済み」になる
8. mypage の Cognito letterHistory にレコードが追加されている (DevTools の `await TAMSICAuth.fetchUserProfile()` で確認)

---

## ロールバック

| 段階 | ロールバック方法 |
|---|---|
| Phase E (Worker 不調) | `wrangler rollback` で前バージョンに戻す or `wrangler delete` で停止 |
| Phase F (Resend 障害) | `tamsic-content.js` の `features['letter-receive']` を `false` に切替 → push (受信ボタン非表示化) |
| Phase G (機能全停止) | 同上 |

データは Cognito 属性に残るので、復旧後は何もしなくても継続利用可能。

---

## 既知の制約 / 改善余地 (§22 行き)

1. **Cognito letterHistory の 2048 文字上限** — 現状 FIFO 10件で運用、超過時は自動的に古いものから削除。長期的には DynamoDB への移行を検討。
2. **Resend の月間無料枠 (3,000 通/月)** — 上限超過時は同社の有料プランへ。または AWS SES へ移行 (送信元ドメイン認証は同じく必要)。
3. **メール HTML の Outlook 互換** — テスト未実施。受信側報告ベースで微調整。
4. **アクセストークン 60分問題** — `auth.js` の `_refreshTokens` で自動更新済 (前回 push)。
5. **アプリ化対応** — Worker はそのままモバイルからも叩ける。ネイティブ歌詞保護はアプリ実装で別途。
