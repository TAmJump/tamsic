# TAMSIC 引き継ぎ書 v3

**最終更新**: 2026-05-09 (Phase G 完了、レター送信本番稼働開始)
**前版**: HANDOFF_v2.md (2026-05-08、Phase D/E/F/G 未着手時点)

---

## このドキュメントの目的

新セッションの Claude (将来の自分) が、TAMSIC の現状を**5分で全把握**できるようにする。これと `TAMSIC_設計書_v4.html` (本番 repo の `docs/`) を読めば、即座に作業継続可能。

---

## 1. TAMSIC とは

**3アーティスト構成のオリジナル楽曲レーベルの会員制 Web サイト**。

- **アーティスト**: no-no / kiki / gEN (3名)
- **トラック数**: 12曲 (no-no:5 / kiki:6 / gEN:1、2026-05-09 時点)
- **本番 URL**: https://tamsic.tamjump.com
- **GitHub repo**: https://github.com/TAmJump/tamsic
- **ホスティング**: Cloudflare Pages (main ブランチを自動デプロイ)
- **認証**: AWS Cognito (User Pool ID: `ap-northeast-1_vozRgCY5k`、App client ID: `62e35ra0h4s2dr657euorlm5bu`)
- **メール送信**: Resend (ドメイン `tamjump.com` Verified、送信元 `letter@tamjump.com`)
- **Worker**: Cloudflare Workers (URL: `https://tamsic-send-letter.animalb001.workers.dev`)

### サービスの性質
- **ユーザー**: 一般公開する Web サイト、会員登録 (無料) で先行視聴可能
- **コイン**: 会員はコインを購入してフル試聴アンロック (1曲 30コイン目安)、初回 100コイン特典
- **会員先行**: 一般公開日の 14日前から会員はフル試聴可能
- **レター**: フル試聴アンロック後、便箋風の歌詞表示 + 登録メアドへの便箋メール送信機能 (1曲1回まで)
- **最終目標**: ネイティブアプリ化 (現状は Web)

### サービスの所有者と運用者
- 運用者は **TAmJump** (GitHub Organization)。以下「ユーザー」と呼ぶ
- ユーザーは AWS / Cloudflare / Resend / GitHub / Square のアカウントを所有
- **Claude (このドキュメントの読者)** はコード作業と AWS/Cloudflare/Resend 設定の手順案内を担当
- **AWS / Cloudflare / Resend のアカウント操作** はユーザー自身が実施 (Claude は認証情報を持たない)

---

## 2. 現在の状態 (2026-05-09 時点)

### ✅ 完成・本番稼働中

| 機能 | 状態 |
|---|---|
| ログイン (Cognito OAuth) | 完成、refresh_token 自動更新あり (60分問題解決済) |
| コイン購入 (Square) | 完成、`addCoinsToCognito` 経由 |
| サンプル試聴 (15-30秒) | 完成、coin 不要 |
| フル試聴アンロック (coin 消費) | 完成 |
| **歌詞便箋 (Web フォント直描画)** | **v4.2.1 完成**、18枠ランダム抽選、closing 26+通り抽選、誕生日/周年/レア枠あり |
| **歌詞付きレターメール** | **v4.2.1 完成、本番稼働中** (Phase G 完了 2026-05-09) |
| ニックネーム / 誕生日設定 | 完成、mypage の「プロフィール」セクション |
| 会員先行 14日前公開 | 完成、`release-control.js` で日付計算 |
| ナビゲーション統一 | no-no / kiki / gEN / mypage 相互リンク完成 |
| アーティスト別フォント | Zen Kurenaido (no-no) / Hachi Maru Pop (kiki) / Yuji Syuku (gEN) |

### ⏳ 進行中・未完了

| 項目 | 状態 |
|---|---|
| 各曲の `creatorNote` (制作秘話) と `closings` (曲別 3 通り) | nono-004 のみ確定済み、残り 11 曲 placeholder |
| MP3 配置方針 (Vault repo + Actions による自動配置) | 検討中、`docs/TAMSIC_TODO.md` 参照 |
| Square Webhook 自動コイン付与 | 未実装、現状は手動 (`addCoinsToCognito`) |
| 音源保護 (R2 signed URL 等) | 未実装、設計書 §22 |
| アプリ化 | 未着手、長期目標 |

---

## 3. 直近の主要変更履歴 (新しい順、抜粋)

```
128d814  feat(phase-G): activate letter-receive — Worker URL 固定 + flag ON
747e21e  fix: 絵文字削除 + Phase D/E/F 完了前は受信ボタン非表示 + Cognito エラー silent化
467badc  fix(letter): 親 .full-lyrics の column-flow と装飾を無効化、便箋多重描画ガード
684c336  fix(letter): 透かしレイヤーを完全分離 (column-flow に巻き込まれない)
9fc0fef  docs: TAmJump 側作業マニュアル (Phase D/E/F)
4250ea4  feat(letter-send): Cloudflare Worker + frontend send API
3b53cf2  feat(auth): nickname/birthday/registeredAt/letterHistory helper 追加
346c9cd  fix(ui): coin 残高 3桁カンマ + ナビ no-no/kiki/gEN 表記
1d8ee4b  feat(letter): 18枠 + closing 抽選 + renderer + CSS
609d792  fix(auth): refresh_token 自動更新 (60分サイレントログアウト解決)
57e268c  fix(coins): coins.js 統一 (旧 TAMSIC_COIN_STATE_V1 廃止)
3dcb1dc  docs(v4.2): §10 歌詞便箋 + §22 改訂
```

完全な履歴は repo で `git log --oneline` で見られる。

---

## 4. ファイル構成 (本番 repo の主要ファイル)

### 4.1 HTML エントリーポイント
- `index.html` — トップページ、最新ニュース表示、3アーティスト案内
- `nono.html` / `kiki.html` / `gen.html` — アーティスト別曲一覧 + フル試聴 UI + 歌詞便箋表示
- `mypage.html` — 残高 / 購入履歴 / プロフィール (nickname/birthday) / 早期アクセス曲リスト
- `login.html` / `signup.html` / `callback.html` / `forgot-password.html` / `reset-password.html` — 認証フロー
- `news.html` / `about.html` — 静的ページ
- `admin.html` — 管理者用 (track 追加など)

### 4.2 ライブラリ・モジュール (.js)

| ファイル | 役割 |
|---|---|
| `auth.js` | Cognito OAuth、トークン管理 (refresh自動)、custom属性 read/write、`window.TAMSICAuth` namespace |
| `coins.js` | コイン残高管理 (localStorage `tamsic_wallet` + Cognito `custom:coins` 同期)、`window.TAMSICCoins` |
| `tamsic.js` | 共通ユーティリティ (IndexedDB / オーディオ / フォーマッタ) |
| `tamsic-content.js` | 全 track データ (id/artist/title/lyrics/coverPath/creatorNote/closings) + features flag |
| `release-control.js` | 公開日と会員先行の日付計算、`getReleaseMeta()` |
| `purchase-config.js` | コインパック定義 (¥200/100c, ¥500/300c, ¥800/500c) |
| `gate-modal.js` | ログイン/コイン不足モーダル |
| `lyrics-guard.js` | 歌詞5層保護 + `protectLetter()` (v4.2.1 追加) |
| **`letter-frames.js`** | 18枠定義 + `pickFrame()` 抽選 |
| **`letter-content.js`** | closing プール 26+通り + `pickClosing()` |
| **`letter-renderer.js`** | 便箋 DOM 構築 (`window.TAMSICLetter.render()`) |
| **`letter-send.js`** | Worker 呼び出し + 確認モーダル + letterHistory 追加 |
| `lang.js` | 日本語/英語切替 |
| `mypage.js` | mypage 専用ロジック (購入履歴 / 早期アクセス) |

### 4.3 CSS
- `auth.css` — 共通ナビ/フッタ
- `letter.css` — 便箋 18枠スタイル + アーティスト別カラー上書き

### 4.4 Cloudflare Worker
- `workers/send-letter.js` — レター送信 Worker (Resend 経由)
- `workers/wrangler.toml` — デプロイ設定

### 4.5 ドキュメント (`docs/`)
- `TAMSIC_設計書_v4.html` — メイン設計書 v4.2 (§10 歌詞便箋 + §22 将来拡張など)
- `TAMSIC_設計書_§10_v4.2.1_完全版.html` — §10 詳細リファレンス (テスト計画 + デプロイ手順含む)
- `TAMSIC_設計書_v3.html` — 旧版 (参考用)
- `TAMSIC_TODO.md` — 運用 TODO
- `TAMSIC_レター送信デプロイ手順_v4.2.1.md` — Phase D/E/F のセットアップマニュアル
- `TAMSIC_v3_セキュリティ監査レポート.md` — セキュリティ観点のメモ
- `TAMSIC_コンテンツ追加マニュアル.md` — track 追加手順
- `TAMSIC_自動リリース設定手順.md` — Actions 関連

---

## 5. レター送信機能の動作フロー (v4.2.1)

これが本セッションの中心的な実装内容。

```
[ブラウザ: nono.html などのアーティストページ]
    ↓ 1. ユーザー: 30 coin 消費でフル試聴ボタン押下
[フロント JS]
    ↓ 2. coins.js spendCoins() → Cognito custom:coins から減算
    ↓ 3. unlockFullTrack(track) で audio 再生開始
    ↓ 4. lyrics-inner-{trackId} 内に TAMSICLetter.render() 呼出
[letter-renderer.js]
    ↓ 5. letter-frames.js pickFrame() で 18枠から抽選
    ↓    (誕生日 → O / 周年 → P / レア Q 1% / レア R 5% / 通常)
    ↓ 6. letter-content.js pickClosing() で closing 抽選
    ↓ 7. DOM 組立 (cover/header/body/note/closing/signature/postmark)
    ↓ 8. lyrics-guard.protectLetter() で 5層保護適用
[ブラウザ画面に便箋表示]
    ↓ 9. 便箋下に「別の一文」「この手紙をメールで受け取る」ボタン表示
    ↓ 10. ユーザー: 受信ボタン押下
[letter-send.js]
    ↓ 11. TAMSICAuth.hasReceivedLetter(trackId) で重複チェック
    ↓ 12. 確認モーダル表示 (Dear ●● 入力 + 送信先メアド表示)
    ↓ 13. ユーザー: 送信ボタン押下
    ↓ 14. nickname を Cognito に保存 (custom:nickname)
    ↓ 15. POST https://tamsic-send-letter.animalb001.workers.dev/
         Headers: Authorization: Bearer <access_token>
         Body: { trackId, trackTitle, trackArtist, lyrics, creatorNote, ... }
[Cloudflare Worker: send-letter.js]
    ↓ 16. /oauth2/userInfo で access_token 検証 → email 取得
    ↓ 17. pickFrame / pickClosing を Worker 側でも実行 (クライアント信用しない)
    ↓ 18. メール HTML 構築 (インライン CSS、SVG data URL 不要、@fontsource @import)
    ↓ 19. Resend API 呼出 (api.resend.com/emails)
[Resend → SMTP → ユーザーの受信箱]
    ↓ 20. メール到着 (件名: "<artist> from TAMSIC — <title>")
    ← レスポンス: { ok, frame, closingText, sentDate, recipientHash }
[フロント]
    ↓ 21. TAMSICAuth.appendLetterHistory() で letterHistory に1件追加
    ↓ 22. 完了モーダル表示
[2回目以降]
    → hasReceivedLetter で「既に送信済み」のアラート
```

### 18枠の構成
| 枠 | 種類 | 発動条件 |
|---|---|---|
| A〜J | 基本 (10種) | アーティスト別プールで抽選 (no-no:6 / kiki:6 / gEN:5) |
| K (桜) | 季節 | 3/1〜4/30 |
| L (雪) | 季節 | 12/1〜1/31 |
| M (海) | 季節 | 7/1〜8/31 |
| N (紅葉) | 季節 | 10/1〜11/30 |
| O (誕生日) | 強制 | `custom:birthday` の月日が今日と一致 |
| P (周年) | 強制 | `custom:registeredAt` の月日が今日と一致 |
| Q (Gold) | レア 1% | 確率独立 |
| R (Silver) | レア ~4.95% | Q 落選後に 5% 抽選 |

### closing プール
- COMMON 15通り + ARTIST_CLOSINGS (各5通り×3アーティスト) + TRACK_CLOSINGS (各曲3通り)
- BIRTHDAY 5 / ANNIVERSARY 3 / BIRTHMONTH 3 (条件発動 or 50% 混入)
- `●●` を user.nickname に置換、`●年` を周年年数に置換

---

## 6. AWS / Cloudflare / Resend の設定状況

### 6.1 AWS Cognito (Phase D 完了)

**User Pool**: `ap-northeast-1_vozRgCY5k` (リージョン: 東京)

#### Custom Attributes (全6個、全て `Mutable=true`、App client で Read/Write 許可済)

| 属性 | 最大長 | 用途 |
|---|---|---|
| `custom:coins`        | 2048 | コイン残高 (JSON or 数値) |
| `custom:purchases`    | 2048 | 購入履歴 (JSON 配列) |
| `custom:nickname`     | 40   | レター便箋の Dear ●● |
| `custom:birthday`     | 10   | YYYY-MM-DD、frame-O 判定 |
| `custom:registeredAt` | 25   | ISO8601 or YYYY-MM-DD、frame-P 判定 (初回ログイン時に auth.js が自動セット) |
| `custom:letterHistory`| 2048 | 送信済みレター記録 (FIFO 上限10件、JSON 配列) |

**App Client** (`62e35ra0h4s2dr657euorlm5bu`): 上記 6 属性すべて Read/Write 許可済み。

### 6.2 Cloudflare Worker (Phase E 完了)

- **Worker name**: `tamsic-send-letter`
- **Worker URL**: `https://tamsic-send-letter.animalb001.workers.dev`
- **Cloudflare アカウント**: `tamj_Account` (login email: `animalb001@gmail.com`)
- **環境変数 `[vars]`** (wrangler.toml に定義済み):
  - `COGNITO_DOMAIN`: `ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com`
  - `ALLOWED_ORIGINS`: `https://tamsic.tamjump.com`
  - `FROM_ADDRESS`: `TAMSIC <letter@tamjump.com>`
- **Secret**: `RESEND_API_KEY` (Resend 発行のキーを `wrangler secret put` で登録済み)

### 6.3 Resend (Phase F 完了)

- **アカウント**: `animalb001@gmail.com` (GitHub OAuth でサインアップ)
- **ドメイン**: `tamjump.com` Verified、Region: Tokyo (ap-northeast-1)
- **DNS レコード** (Cloudflare DNS に Auto configure で追加済):
  - DKIM: `resend._domainkey` TXT
  - SPF: `send` TXT (`v=spf1 include:amazonses.com ~all`)
  - MX: `send` MX (`feedback-smtp.ap-northeast-1.amazonses.com`、priority 10)
- **API Key**: `tamsic-letter-prod` (Sending access、`re_xxx`)、Worker secret に登録済み
- **送信元アドレス**: `letter@tamjump.com` (FROM_ADDRESS で設定)

### 6.4 GitHub

- **Repo**: `https://github.com/TAmJump/tamsic` (private)
- **ブランチ**: `main` (Cloudflare Pages 自動デプロイ)
- **PAT**: 過去のセッションで使っていた classic PAT は repo の HANDOFF_v2.md (履歴) に記載あり。**このドキュメントには直接書かない** (GitHub secret scanning に引っかかるため)。次セッションで Claude が clone する際は、ユーザーから直接渡される PAT を使う

---

## 7. Claude が新セッションで作業する際の手順

### 7.1 環境セットアップ (初回のみ、毎セッション必要)

```bash
# 作業ディレクトリ
mkdir -p /home/claude/tamsic-repo
cd /home/claude

# Repo clone (PAT は HANDOFF v3 から)
git clone https://x-access-token:<PAT_HERE>@github.com/TAmJump/tamsic.git tamsic-repo
cd tamsic-repo

# Git author 設定 (commit 時に必要)
git config user.email "claude-assistant@tamjump.local"
git config user.name "TAMSIC Maintenance"
```

### 7.2 作業の流れ

1. ユーザー要望を聞く
2. **必ず `git pull origin main` で最新取得**
3. ローカルで編集
4. 構文検証 (`node --check`、HTML パーサ)
5. 必要なら **モックや preview で動作確認** (`letter-preview.html` 等)
6. ユーザーに変更内容を提示
7. **承認を得てから** `git add` / `git commit` / `git push`
8. Cloudflare Pages デプロイ (1-2分) を待ってユーザーに動作確認を依頼

### 7.3 commit message のルール

Conventional Commits 形式:
```
feat(<scope>): <短い説明>

詳細...
```

scope: `letter` / `auth` / `coins` / `ui` / `content` / `phase-G` などその修正のメイン領域。

### 7.4 push 前必須チェック

- [ ] JS 構文 OK (`node --check <file>`)
- [ ] HTML 構造 OK (Python HTMLParser でタグ閉じチェック)
- [ ] CSS 中括弧 OK (`{` と `}` の数が一致)
- [ ] **キャッシュバスター更新** (`?v=4.2.1.X` を bump、HTML 4ファイル全部)
- [ ] 大きい変更なら `letter-preview.html` 等で実機ブラウザ確認

---

## 8. ユーザーから受けた重要な指示・好み

### 8.1 絶対禁止事項
- **絵文字や装飾記号 (📮 / 📨 / ↻ / ✓ / ✗ など) を勝手に追加しない**
  - 既存コード (admin.html / mypage.js / docs) の ✓ などは触らない
  - 新規追加コードでは原則使わない、必要なら事前に許可を取る
- **指示されてない要素 (UI 文言、ボタン、装飾) を勝手に増やさない**
- **シークレット (API キー、PAT、トークン) をチャット画面・スクショ・コードに**
  - ユーザーがスクショに API トークンを映してしまった場合でも、毎回注意するのではなく "理解してる" と言われたら言わない (ユーザーから明示的に伝えられた)

### 8.2 推奨事項
- 端的な説明、テスト指示、確認分岐の明示
- 実機検証ベースで進める (推測で「直しました」と言わない、Console エラー / スクショで確認)
- アーティスト名の表記は **`no-no` / `kiki` / `gEN`** (大文字化禁止、CSS の `text-transform:uppercase` を `data-artist-link` で打ち消す)
- 数値表示は3桁カンマ (`toLocaleString('en-US')`)
- **完成イメージは「ネイティブアプリ化を視野に入れた API ファースト構成」** — Cloudflare Workers にロジック寄せる方針推奨

### 8.3 言語
- 全コミュニケーション日本語
- コードコメント・ドキュメントも日本語
- 設計書のフッタ言語表示は維持 (英日両用がデフォルト)

---

## 9. 既知の制約 / 改善余地 (§22 行き)

| 項目 | 詳細 |
|---|---|
| Cognito letterHistory 2048字上限 | FIFO 10件で運用、超過時は古いものから削除。長期は DynamoDB 化検討 |
| Resend 月3,000通の無料枠 | 超過時は有料プラン or AWS SES 移行 |
| メール HTML の Outlook 互換 | 未テスト、受信側報告ベースで微調整予定 |
| 音源保護 | `assets/audio/` が public、URL 推測でアクセス可能。R2 + signed URL 化が課題 |
| Square Webhook | 未実装、コイン付与は手動 |
| アプリ化 | Web ロジックを Worker に寄せる方針、将来 React Native or Flutter 想定 |
| MP3 配置 | 公開前曲を別 repo (Vault) → Actions で本番配置の自動化が未完 |
| 各曲の creatorNote / closings | nono-004 のみ確定、残り11曲 placeholder |

---

## 10. テスト要点 (本番動作確認用シナリオ)

### 10.1 基本動作

```
[1] https://tamsic.tamjump.com にアクセス → ログイン
[2] mypage で 残高表示が「10,000 coin」のような3桁カンマ
[3] mypage の「プロフィール」で nickname / 誕生日 を設定 → 「保存しました」緑表示
[4] nono.html で「ぎりぎりだよ。」フル試聴ボタン → 30 coin 消費 → 9,970 coin
[5] アンロック後、便箋表示
    - 18枠のいずれか (透かしが歌詞に混入していない)
    - 歌詞2カラム、Dear ●● = nickname、postmark に当日日付
    - 「別の一文」ボタンで closing 引き直し動作
[6] 「この手紙をメールで受け取る」ボタン押下
    → 確認モーダル (Dear / 送信先) → 送信
    → 数秒で「送信しました」モーダル
    → 登録メアドに便箋メール到着 (件名: "no-no from TAMSIC — ぎりぎりだよ。")
[7] 同じ曲で再度受信ボタン押下 → 「既に送信済みです」
[8] 別の曲 (no-no, kiki, gEN) でも同様に動作
[9] kiki / gEN ページで色とフォントが違う (ローズ + Hachi Maru / ブロンズ + Yuji Syuku)
[10] mypage のナビ表記が「no-no / kiki / gEN」(全大文字でない)
```

### 10.2 エッジケース

- 60分以上タブ放置 → 操作再開 → トークン自動更新で問題なく動作
- 誕生日にフル試聴 → 強制 frame-O (誕生日枠 + 紙吹雪 + バナー)
- 登録1周年 → 強制 frame-P (周年バナー + 星)
- レア発動 (Q=1%, R=4.95%) → ★ RARE ★ / ☆ UNCOMMON ☆ バッジ表示

---

## 11. 次セッションで考えうる作業

### 11.1 短期 (即実施可能)

- 各曲の `creatorNote` (3-5文の制作秘話) と `closings` (3通り) 執筆 (アーティスト本人視点)
  - nono-004「ぎりぎりだよ。」: 完了済み
  - 残り 11 曲: placeholder のみ
  - ユーザーから本人視点のテキストを受け取って `tamsic-content.js` に流し込む
- レターコレクション機能 (mypage で送信済みレター一覧、frame アイコン表示)
- 季節枠の追加 (中秋の月、ハロウィン、クリスマスなど)

### 11.2 中期

- Square Webhook + Cloudflare Worker でのコイン自動付与
- 音源保護 (R2 + signed URL)
- メール HTML の Outlook 互換テスト

### 11.3 長期

- アプリ化 (React Native / Flutter / SwiftUI)
- 多言語対応の本格化 (lang.js は基礎のみ)

---

## 12. 緊急時の連絡経路

- **Cloudflare Pages デプロイ失敗**: GitHub Actions ログ or CF Dashboard > Pages > Deployments
- **Worker 障害**: CF Dashboard > Workers > tamsic-send-letter > Logs (リアルタイム閲覧可)
- **Resend 障害**: Resend Dashboard > Emails > 送信失敗ログ
- **Cognito 障害**: AWS Console > Cognito > User Pool > Monitoring

ロールバック手段:
- **Worker**: `wrangler rollback` で前バージョン復帰
- **コードバグ**: GitHub から `git revert <commit>` → push
- **レター機能停止**: `tamsic-content.js` の `features['letter-receive']` を **false** に → push (5秒)

---

## 13. 質問テンプレート (新セッションで Claude が最初に聞くと良いこと)

ユーザーの最初のメッセージが曖昧なときの質問:

```
1. 続きの作業ですか? (HANDOFF_v3 を読んでよければ「OK」)
2. 新規バグ修正・新機能の依頼?
3. 何かテストが落ちていて修正?
```

「続きの作業」と言われた場合:
- 直近の git log を確認
- 未完の作業 (TODO の placeholder 曲の creatorNote 等) を提案

---

## 14. このドキュメント自体について

- このファイルは **Claude が次セッションへの引き継ぎ専用に書く** もの。
- ユーザーが直接読むことは想定していないが、隠す必要もない。
- 次セッションでも Claude がこれを更新する場合、**版数を上げて** (v3 → v4) 主要変更を冒頭にメモする。
- 詳細仕様は `docs/TAMSIC_設計書_v4.html` (本番 repo) を参照する方針 (このファイルは「サマリー + ワークフロー + 環境情報」に絞る)。

---

**END OF HANDOFF v3**
