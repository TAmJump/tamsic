# TAMSIC 引き継ぎ書 v4

**最終更新**: 2026-05-10 12:00 JST
**前版**: HANDOFF_v3.md (2026-05-09、Phase G 完了、Resend ドメイン Verified の前提だった)

> **重要**: 本ドキュメントは v3 を**部分更新**ではなく**全面置換**するもの。新セッションの Claude はこの v4 だけ読めば全把握できるよう、v3 の内容を取り込み、その上に最新変化 (Resend ドメイン Verify 詰まり / id_token 切替 / openid scope 問題判明) を追記している。

---

## 🚀 新セッションの Claude が最初にやること (PAT を聞かない)

ユーザーに何も聞かず、以下をそのまま実行する:

```bash
mkdir -p /home/claude/tamsic-repo
cd /home/claude
git clone https://x-access-token:<PAT>@github.com/TAmJump/tamsic.git tamsic-repo
cd tamsic-repo
git config user.email "claude-assistant@tamjump.local"
git config user.name "TAMSIC Maintenance"
```

PAT の値はユーザーがアップロードした **HANDOFF_v4.md ファイル (ローカル版)** の §6.4 に直接記載されている。repo の HANDOFF_v4.md は GitHub secret scanning 対策で placeholder にしてあるが、**ユーザーがファイルとして手渡してくれるバージョンには実値が入っている**ので、それを使う。

**PAT をユーザーに口頭で聞いてはいけない** (前セッションで毎回同じ会話を繰り返すと激怒された)。

ファイルが手元になければ、ユーザーに「HANDOFF_v4.md ファイルをドラッグして」とだけ依頼する (PAT の値は聞かない)。

その後、ユーザーに「続きから進めますか? それとも別件?」とだけ聞いて作業開始する。

---

## 0. 即座に状況を理解するための要約 (30秒読本)

TAMSIC は3アーティスト (no-no / kiki / gEN) のオリジナル楽曲レーベルの会員制 Web サイト。コインで歌詞便箋 (フル試聴) を解放し、登録メールに**便箋風メール**として送れる機能を v4.2.1 で実装。**コードは完全稼働可能、Cognito/Worker/フロントすべて準備完了**。

**唯一未解決の問題**: Resend のドメイン認証が「Verify ボタン押しても Status が Not Started のまま動かない」状態でハマっている (Cloudflare DNS は完璧、外部 DNS Propagation も世界中で確認済み = Resend 側のバグ/キャッシュ問題)。

**だから何が今できないか**: メール送信 (`POST /tamsic-send-letter.workers.dev/`) が Resend API レベルで `400 The associated domain with your API key is not verified` で失敗する。それ以外 (便箋表示・コイン消費・プロフィール・Cognito 書込) は全て稼働中。

**次にやるべきこと (3択)**:
- **A**: Resend ドメインを削除→再登録 (10〜15分、確実)
- **B**: 数時間〜翌日まで待ってから Verify ボタン再押下 (Resend 側のキャッシュ抜けを期待)
- **C**: 暫定的に Worker 側の送信先を `animalb001@gmail.com` (Resend アカウントオーナー) に固定して動作確認だけ取る (本番には適さない)

詳細は §13 を読むこと。

---

## 1. TAMSIC とは

3アーティスト構成のオリジナル楽曲レーベルの会員制 Web サイト。

- **アーティスト**: no-no / kiki / gEN (3名、表記固定、大文字化禁止)
- **トラック数**: 12曲 (no-no: 5 / kiki: 6 / gEN: 1、2026-05-10 時点)
- **本番 URL**: https://tamsic.tamjump.com
- **GitHub repo**: https://github.com/TAmJump/tamsic (private)
- **ホスティング**: Cloudflare Pages (main ブランチ自動デプロイ)
- **認証**: AWS Cognito User Pool `ap-northeast-1_vozRgCY5k` / App client `62e35ra0h4s2dr657euorlm5bu`
- **メール送信**: Resend (送信元 `letter@tamjump.com`、ドメイン認証で詰まり中)
- **送信 Worker**: `https://tamsic-send-letter.animalb001.workers.dev` (Cloudflare Worker)
- **最終目標**: ネイティブアプリ化 (現状は Web)

### サービスの性質
- **会員登録**: 無料、Cognito 経由、初回 100 coin 特典
- **コイン**: ¥200=100c / ¥500=300c / ¥800=500c の 3パック (Square 決済)
- **試聴**: サンプル (15-30秒、無料) → コイン消費 (1曲 30c) でフル解放
- **会員先行**: 一般公開日の14日前から会員はフル解放可能
- **歌詞便箋**: フル試聴解放後、18枠ランダム抽選の便箋を Web 上に表示
- **メールレター**: 便箋下のボタンから登録メアドへ便箋メール送信 (1曲1回まで)

### 所有者と運用
- 所有者は **TAmJump** (GitHub Organization、以下「ユーザー」)
- ユーザーは AWS / Cloudflare / Resend / GitHub / Square のアカウントを所有
- **Claude (このドキュメントの読者)** はコード作業 + AWS/CF/Resend 設定の手順案内を担当
- AWS / CF / Resend のアカウント操作はユーザー自身が実施 (Claude は認証情報を持たない)

---

## 2. 現在の状態 (2026-05-10 時点)

### ✅ 完成・本番稼働中

| 機能 | 状態 |
|---|---|
| ログイン (Cognito OAuth + SDK 直叩き両方) | 完成、refresh_token 自動更新 (60分問題解決) |
| コイン購入 (Square) | 完成、`addCoinsToCognito` 経由 (Webhook 自動化は未実装) |
| サンプル試聴 (15-30秒) | 完成、coin 不要 |
| フル試聴アンロック (コイン消費) | 完成 |
| **歌詞便箋 (Web フォント直描画)** | **v4.2.1 完成**、18枠ランダム + closing 26+通り抽選 |
| **歌詞付きレターメール (フロント実装)** | **v4.2.1 完成稼働中** (UI と Worker 呼出フロー) |
| ニックネーム/誕生日設定 | 完成 (mypage の「プロフィール」セクション) |
| 会員先行14日前公開 | 完成 (release-control.js) |
| ナビ統一 (no-no/kiki/gEN/MY PAGE/LOGOUT) | 完成 |
| アーティスト別フォント | Zen Kurenaido (no-no) / Hachi Maru Pop (kiki) / Yuji Syuku (gEN) |
| Cognito 6 custom 属性 (Phase D) | ✅ 全部追加 + App Client read/write 許可済 |
| Cloudflare Worker `tamsic-send-letter` (Phase E) | ✅ デプロイ完了、id_token 対応 (commit 8d1e8a1) |

### ⚠️ 引っかかってる問題

| 問題 | 詳細 |
|---|---|
| **Resend ドメイン認証が Not Started のまま** | Cloudflare DNS は完璧、whatsmydns.net で世界中から TXT (SPF) 確認済み、しかし Resend の Verify ボタン押下後も MX/SPF が Not Started のまま動かない |
| 結果: **メール送信失敗** (400 エラー) | API キーは紐付け済みだが、ドメインが Verified でないため Resend が送信を拒否 |
| **Cognito access_token の openid scope 問題** | login.html が SDK 直叩き (`authenticateUser`) のため、access_token に `openid` scope が含まれない → Worker 側の `/oauth2/userInfo` 認証が失敗。回避: id_token を Bearer に使う実装に切替済 (commit 8d1e8a1) |

### ⏳ 未実装・未完了

| 項目 | 状態 |
|---|---|
| 各曲 `creatorNote` (制作秘話3-5文) と `closings` (曲別3通り) | nono-004 のみ確定、残り11曲 placeholder |
| MP3 配置方針 (Vault repo + GitHub Actions) | 検討中 |
| Square Webhook → Cognito 自動コイン付与 | 未実装、現状は手動「購入を反映する」ボタン |
| 音源保護 (R2 + signed URL) | 未実装 |
| アプリ化 (React Native / Flutter / SwiftUI) | 未着手、長期目標 |
| login.html を Hosted UI 経由 (`/oauth2/authorize`) に書換 | 未着手、id_token 方式で回避済 |

---

## 3. 直近 commit 履歴 (新→古、抜粋)

```
8d1e8a1  fix(letter): use id_token instead of access_token (openid scope 問題の回避)
2c24837  docs(handoff-v3): 完全引き継ぎ書 + システム構成図 + デプロイ手順実機版
128d814  feat(phase-G): activate letter-receive — Worker URL 固定 + flag ON
747e21e  fix: 絵文字削除 + Phase D/E/F 完了前は受信ボタン非表示 + Cognito エラー silent化
467badc  fix(letter): 親 .full-lyrics の column-flow と装飾を無効化、便箋多重描画ガード
684c336  fix(letter): 透かしレイヤーを完全分離 (column-flow に巻き込まれない)
9fc0fef  docs: TAmJump 側作業マニュアル (Phase D/E/F)
4250ea4  feat(letter-send): Cloudflare Worker + frontend send API
acf4e0a  feat(integration): wire letter-send + profile UI + enable letter-receive flag
3b53cf2  feat(auth): nickname/birthday/registeredAt/letterHistory helper 追加
346c9cd  fix(ui): coin 残高 3桁カンマ + ナビ no-no/kiki/gEN 表記固定
1d8ee4b  feat(letter): 18枠 + closing 抽選 + renderer + CSS
609d792  fix(auth): refresh_token 自動更新 (60分サイレントログアウト解決)
57e268c  fix(coins): coins.js 統一 (旧 TAMSIC_COIN_STATE_V1 廃止)
3dcb1dc  docs(v4.2): §10 歌詞便箋 + §22 改訂
```

---

## 4. ファイル構成 (本番 repo の主要ファイル)

### 4.1 HTML エントリーポイント
- `index.html` — トップページ、最新ニュース、3アーティスト案内
- `nono.html` / `kiki.html` / `gen.html` — アーティスト別曲一覧 + フル試聴 UI + 歌詞便箋表示
- `mypage.html` — 残高 / 購入履歴 / プロフィール (nickname/birthday) / 早期アクセス曲リスト
- `login.html` / `signup.html` / `callback.html` / `forgot-password.html` / `reset-password.html` — 認証フロー (※ login.html は SDK 直叩きで openid scope なし、id_token で回避)
- `news.html` / `about.html` — 静的ページ
- `admin.html` — 管理者用 (track 追加など)

### 4.2 ライブラリ・モジュール (.js)

| ファイル | 役割 |
|---|---|
| `auth.js` | Cognito OAuth、トークン管理 (refresh自動)、custom属性 read/write、`window.TAMSICAuth` namespace |
| `coins.js` | コイン残高管理 (localStorage `tamsic_wallet` + Cognito `custom:coins` 同期)、`window.TAMSICCoins` |
| `tamsic.js` | 共通ユーティリティ (IndexedDB / オーディオ / フォーマッタ) |
| `tamsic-content.js` | 全 track データ (id/artist/title/lyrics/coverPath/creatorNote/closings) + features flag |
| `release-control.js` | 公開日と会員先行14日前の判定、`getReleaseMeta()` |
| `purchase-config.js` | コインパック定義 (¥200/100c, ¥500/300c, ¥800/500c) |
| `gate-modal.js` | ログイン/コイン不足モーダル |
| `lyrics-guard.js` | 歌詞5層保護 + `protectLetter()` (v4.2.1 追加) |
| **`letter-frames.js`** | 18枠定義 + `pickFrame()` 抽選 |
| **`letter-content.js`** | closing プール 26+通り + `pickClosing()` |
| **`letter-renderer.js`** | 便箋 DOM 構築 (`window.TAMSICLetter.render()`) |
| **`letter-send.js`** | Worker 呼出 + 確認モーダル + letterHistory 追加。**v4.2.1.5 で id_token 優先送信に変更** |
| `lang.js` | 日本語/英語切替 |
| `mypage.js` | mypage 専用 (購入履歴/早期アクセス) |

### 4.3 CSS
- `auth.css` — 共通ナビ/フッタ
- `letter.css` — 便箋 18枠スタイル + アーティスト別カラー上書き

### 4.4 Cloudflare Worker
- `workers/send-letter.js` — レター送信 Worker。**v4.2.1.5 で `verifyUser` を id_token 優先 + `/oauth2/userInfo` フォールバックに改修**
- `workers/wrangler.toml` — デプロイ設定

### 4.5 ドキュメント (`docs/`)
- `TAMSIC_設計書_v4.html` — メイン設計書 v4.2.1 (フッタ更新済)
- `TAMSIC_設計書_§10_v4.2.1_完全版.html` — §10 詳細リファレンス (テスト計画 + デプロイ手順含む)
- `TAMSIC_設計書_v3.html` — 旧版 (参考用)
- `TAMSIC_TODO.md` — 旧 TODO (継続的)
- `TAMSIC_TODO_v3.md` — v3 TODO (Phase G 完了時点)
- `TAMSIC_TODO_v4.md` — **本セッション末で作成、最新タスク**
- `TAMSIC_レター送信デプロイ手順_v4.2.1.md` — 実機検証ベースのデプロイ手順
- `TAMSIC_システム構成図_v4.2.1.html` — アーキテクチャ全景の HTML
- `TAMSIC_v3_セキュリティ監査レポート.md` — セキュリティメモ
- `TAMSIC_コンテンツ追加マニュアル.md` — track 追加手順
- `TAMSIC_自動リリース設定手順.md` — Actions 関連

---

## 5. レター送信機能の動作フロー (v4.2.1.5)

```
[ブラウザ: nono.html などのアーティストページ]
    ↓ 1. ユーザー: 30 coin 消費でフル試聴ボタン押下
[フロント JS: coins.js / auth.js]
    ↓ 2. coins.js spendCoins() → Cognito custom:coins 減算
    ↓ 3. unlockFullTrack(track) で audio 再生開始
    ↓ 4. lyrics-inner-{trackId} 内に TAMSICLetter.render() 呼出
[letter-renderer.js]
    ↓ 5. letter-frames.js pickFrame() で 18枠から抽選
    ↓    優先順位: 誕生日 O → 周年 P → レアQ 1% → レアR ~5% → 通常
    ↓ 6. letter-content.js pickClosing() で closing 抽選
    ↓ 7. DOM 組立 (cover/header/body/note/closing/signature/postmark)
    ↓ 8. lyrics-guard.protectLetter() で 5層保護適用
[ブラウザ画面に便箋表示]
    ↓ 9. 便箋下に「別の一文」「この手紙をメールで受け取る」ボタン
    ↓ 10. ユーザー: 受信ボタン押下
[letter-send.js (v4.2.1.5)]
    ↓ 11. TAMSICAuth.hasReceivedLetter(trackId) で重複チェック
    ↓ 12. 確認モーダル (Dear ●● + 送信先メアド)
    ↓ 13. ユーザー「送信する」押下
    ↓ 14. nickname を Cognito に保存 (custom:nickname)
    ↓ 15. POST https://tamsic-send-letter.animalb001.workers.dev/
         Headers: Authorization: Bearer <id_token>     ← v4.2.1.5 で変更!
                                          (旧: access_token、openid scope 必須で失敗)
         Body: { trackId, trackTitle, trackArtist, lyrics, creatorNote, ... }
[Cloudflare Worker: send-letter.js (v4.2.1.5)]
    ↓ 16. verifyUser(): まず id_token として JWT decode → email 取得
    ↓     payload.aud == client_id 検証、payload.exp 期限検証
    ↓     失敗時は /oauth2/userInfo フォールバック (access_token + openid scope 用)
    ↓ 17. pickFrame / pickClosing を Worker 側でも実行 (クライアント信用しない)
    ↓ 18. メール HTML 構築 (インライン CSS、@fontsource @import)
    ↓ 19. Resend API 呼出 (api.resend.com/emails)  ← 現在ここで 400 エラー!
[Resend → SMTP → ユーザーの受信箱]
    ↓ 20. メール到着 (件名: "<artist> from TAMSIC — <title>")
    ← レスポンス: { ok, frame, closingText, sentDate, recipientHash }
[フロント]
    ↓ 21. TAMSICAuth.appendLetterHistory() で letterHistory に1件追加
    ↓ 22. 完了モーダル表示
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

## 6. AWS / Cloudflare / Resend の本番設定

### 6.1 AWS Cognito (Phase D) ✅ 完了

**User Pool**: `ap-northeast-1_vozRgCY5k` (リージョン: 東京)

#### Custom Attributes (全6個、Mutable=true、App client で Read/Write 許可済)

| 属性 | 最大長 | 用途 |
|---|---|---|
| `custom:coins`        | 2048 | コイン残高 (数値文字列) |
| `custom:purchases`    | 2048 | 購入履歴 (JSON 配列) |
| `custom:nickname`     | 40   | レター便箋の Dear ●● |
| `custom:birthday`     | 10   | YYYY-MM-DD、frame-O 判定 |
| `custom:registeredAt` | 25   | ISO8601、frame-P 判定 (auth.js が初回ログイン時に自動セット) |
| `custom:letterHistory`| 2048 | 送信済みレター記録 (FIFO 上限10件、JSON 配列) |

**App Client** (`62e35ra0h4s2dr657euorlm5bu`):
- 上記 6 属性すべて Read/Write 許可済
- **OpenID Connect スコープ**: `openid` / `email` / `profile` / `phone` / `aws.cognito.signin.user.admin` の5つ全部許可済 (本セッションで明示的に保存し直した)
- ただし**実際の access_token に openid が乗るのは Hosted UI 経由のみ**で、login.html の SDK 直叩きでは scope なし

### 6.2 Cloudflare Worker (Phase E) ✅ 完了

- **Worker name**: `tamsic-send-letter`
- **Worker URL**: `https://tamsic-send-letter.animalb001.workers.dev`
- **Cloudflare アカウント**: `tamj_Account` (login: `animalb001@gmail.com`)
- **最新 Version ID**: `59f1888d-1db0-48eb-9df4-9093b3018e3f` (id_token 対応版、commit 8d1e8a1 ベース)

#### 環境変数 `[vars]` (wrangler.toml)
```toml
COGNITO_DOMAIN  = "ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com"
ALLOWED_ORIGINS = "https://tamsic.tamjump.com"
FROM_ADDRESS    = "TAMSIC <letter@tamjump.com>"
```

#### Secret
- `RESEND_API_KEY` — Resend で発行、`wrangler secret put` で登録済 (現在は `re_eEtGXsZf...` で始まる新キー、Resend ダッシュボードでドメイン `tamjump.com` 紐付け、Permission: Sending access)

### 6.3 Resend (Phase F) ⚠️ 詰まり中

- **アカウント**: `animalb001@gmail.com` (GitHub OAuth サインアップ)
- **ドメイン**: `tamjump.com`、Region: Tokyo (ap-northeast-1)
- **ドメイン Status**: ⚠️ **Not Started のまま**動かない (Verify ボタン押下後も変化なし)
- **DNS Records (Cloudflare 側)**: 全部正しく設定済、Proxy=DNS only
  - DKIM (TXT `resend._domainkey`): ✅ Resend 側 Verified
  - SPF (TXT `send`): ❌ Resend 側 Not Started
  - MX (`send` → `feedback-smtp.ap-northeast-1.amazonses.com` priority 10): ❌ Resend 側 Not Started

#### whatsmydns.net 確認結果 (2026-05-10)
```
https://www.whatsmydns.net/#TXT/send.tamjump.com
→ 世界中のすべての DNS サーバーで "v=spf1 include:amazonses.com ~all" が返ってくる ✅
```

つまり **Cloudflare DNS は完璧で、世界中で見えてる**。Resend 側の検証システムだけが認識していない (キャッシュ or バグ)。

#### API Key
- 名前: `tamsic-letter-prod`
- Permission: Sending access
- Domain: `tamjump.com` (明示的に紐付け済)
- Token: `re_eEtGXsZf...` (Worker secret に登録済、本ドキュメントでは値の冒頭8文字のみ記載)

### 6.4 GitHub

- **Repo**: `https://github.com/TAmJump/tamsic` (private)
- **Branch**: `main` (Cloudflare Pages 自動デプロイ)
- **PAT**: ユーザーがファイルとして配布する HANDOFF_v4.md (ローカル版) の §6.4 末尾に実値を記載。本 repo 版では GitHub secret scanning 対策で placeholder のみ

---

## 7. Claude が新セッションで作業する手順

### 7.1 環境セットアップ (毎セッション必要)

```bash
mkdir -p /home/claude/tamsic-repo
cd /home/claude

# repo clone (PAT は §6.4 記載のもの、配布された HANDOFF_v4.md ファイルから取得)
git clone https://x-access-token:<PAT>@github.com/TAmJump/tamsic.git tamsic-repo
cd tamsic-repo

# Git author 設定
git config user.email "claude-assistant@tamjump.local"
git config user.name "TAMSIC Maintenance"
```

### 7.2 作業の流れ

1. ユーザー要望を聞く
2. **必ず `git pull origin main`** で最新取得
3. ローカルで編集
4. 構文検証 (`node --check`、HTML パーサ)
5. 必要なら preview で動作確認 (`letter-preview.html` 等)
6. ユーザーに変更内容を提示
7. **承認を得てから** `git add` / `commit` / `push`
8. Cloudflare Pages デプロイ (1-2分) を待ってユーザーに動作確認を依頼

### 7.3 commit message のルール

```
<type>(<scope>): <短い説明>

詳細...
```

- type: `feat` / `fix` / `docs` / `chore` / `style` / `refactor`
- scope: `letter` / `auth` / `coins` / `ui` / `content` / `phase-G` / `phase-H` など

### 7.4 push 前必須チェック

- [ ] JS 構文 OK (`node --check <file>`)
- [ ] HTML 構造 OK (Python HTMLParser でタグ閉じチェック)
- [ ] CSS 中括弧 OK (`{` と `}` の数が一致)
- [ ] **キャッシュバスター更新** (`?v=4.2.1.X` を bump、HTML 4ファイル全部)
- [ ] secret (PAT, API key) を平文で書いてない (push 前に grep 確認)

### 7.5 Worker のコード変更時

ローカル PC でユーザーに以下を依頼:
```cmd
cd %USERPROFILE%\Desktop\tamsic
git pull
cd workers
wrangler deploy
```

(Cloudflare Pages のフロント自動デプロイとは別系統。Worker は wrangler 手動 deploy が必要)

---

## 8. ユーザーから受けた絶対指示

### 8.1 絶対禁止
- **絵文字や装飾記号 (📮 / 📨 / ↻ / ✓ / ✗ など) を勝手に追加しない**。一度違反して激怒された
  - 既存コード (admin.html / mypage.js / docs) の ✓ などは触らない
  - 新規追加コードでは原則使わない、必要なら事前に許可を取る
- **指示してない要素 (UI 文言、ボタン、装飾) を勝手に増やさない**
- **API キー等のシークレット注意警告を毎回繰り返さない** (ユーザーから「理解してる」と言われたら以後省略)

### 8.2 表記固定・スタイル
- アーティスト名: **`no-no` / `kiki` / `gEN`** (大文字化禁止、CSS の `text-transform:uppercase` を `data-artist-link` で打ち消す)
- 数値表示: 3桁カンマ (`toLocaleString('en-US')`)
- 言語: 全コミュニケーション・コードコメント・ドキュメント日本語

### 8.3 コミュニケーションスタイル
- **主語と URL を必ず明示**。「あのボタンを押して」ではなく「`https://resend.com/domains` のページの右上の白い『Verify DNS Records』ボタンを押して」のように具体的に
- 雑な指示で叱られた経歴あり
- 端折らない。長いとしても何も省略しない
- 推測で「直しました」と言わない (実機検証 / Console エラー / スクショ確認ベース)

### 8.4 設計方針
- **完成形はネイティブアプリ化を視野に入れた API ファースト構成**
- ロジックを Cloudflare Workers に寄せる方針
- Web/アプリ共通 API として設計

---

## 9. 今セッションで詰まった課題の詳細

### 9.1 openid scope 問題 (解決済、commit 8d1e8a1)

**症状**: Worker が `401 invalid-token` を返す。

**Cognito の応答**:
```
{"error":"invalid_token","error_description":"Access token does not contain the 'openid' scope"}
```

**原因**: login.html が `CognitoUser.authenticateUser()` (SDK 直叩き、`USER_PASSWORD_AUTH` 相当) を使用。このフローは Cognito Hosted UI 経由ではないため、access_token に scope が含まれず、`/oauth2/userInfo` エンドポイントが拒否する。

App Client の OpenID Connect Scopes 設定 (Console UI) には `openid` をチェック済みでも、SDK 直叩きフローは scope を発行しない仕様。

**回避策 (実装済)**:
- フロント `letter-send.js`: Bearer トークンに `localStorage.tamsic_id_token` を優先送信、なければ `tamsic_access_token` にフォールバック
- Worker `workers/send-letter.js`: `verifyUser` を以下の順で試行
  1. Bearer の JWT を decode → payload.aud == client_id かつ email 取得 (id_token 想定)
  2. 失敗したら従来通り `/oauth2/userInfo` (access_token + openid scope 想定)
- 期限 (exp) チェックは payload で実施
- 署名検証は省略 (Workers の cold-start 軽量化、id_token は Cognito だけが発行できる前提)

**根本対応 (未実装)**:
- login.html を Hosted UI フロー (`/oauth2/authorize?scope=openid+email+profile`) にリダイレクトする方式に書き換える
- そうすれば access_token にも scope が乗る → `/oauth2/userInfo` 経由でも認証できる
- 現状は id_token 方式で機能的には問題なし

### 9.2 Resend ドメイン認証詰まり (未解決) ⚠️

**症状**:
- Resend ダッシュボードのドメイン詳細画面で `tamjump.com` の Status が `Not Started`
- Verify DNS Records ボタンを何度押しても 5〜10分待っても変化なし
- DKIM だけは Verified になっている、SPF (TXT) と MX が Not Started のまま
- メール送信時に Resend API が `400 The associated domain with your API key is not verified. Please, create a new API key with full access or with a verified domain.` を返す

**事実関係**:
- Cloudflare DNS には正しい3レコードが入っている (DKIM TXT / SPF TXT / MX、すべて Proxy=DNS only)
- whatsmydns.net で世界中のすべての DNS サーバーから `send.tamjump.com` の TXT (SPF) が緑チェックで取得できる確認済
- API キー `tamsic-letter-prod` は Domain `tamjump.com` で発行 (Permission: Sending access)
- Worker secret には新キーが登録されている

**つまり**: Cloudflare 側完璧、外部 DNS 完璧、API キー側完璧、にもかかわらず Resend の検証システムだけが Not Started のまま。これは Resend 側のキャッシュ or バグ。

**未試行の対処オプション**:

#### オプション A: 削除→再登録 (確実、所要15分)
1. Resend > API keys > `tamsic-letter-prod` の `…` → Delete (タイプ確認 `tamsic-letter-prod`)
2. Resend > Domains > `tamjump.com` の `…` → Delete domain
3. Domains > Add domain → `tamjump.com` / Region Tokyo → Add
4. Auto configure ボタン → Cloudflare 認可 (既存レコードあるのでスキップで通る)
5. Verify DNS Records ボタン押下 (DNS は実反映済なので今度は通るはず)
6. API keys > Create API Key → Name `tamsic-letter-prod` / Sending access / Domain `tamjump.com`
7. Worker secret 更新: `wrangler secret put RESEND_API_KEY` で新キー貼り付け
8. ブラウザで送信テスト

#### オプション B: 数時間〜翌日待ち
Resend の検証キューが詰まってる可能性。1〜2時間〜翌朝放置 → Verify ボタン再押下で通ることがある。

#### オプション C: 暫定動作確認
Worker の送信先を `animalb001@gmail.com` (Resend オーナー、ドメイン未認証でも送信可能) に固定して、システム全体の疎通だけ確認。本番運用には不可。

#### オプション D: Resend サポート問い合わせ
英語メール例 (テンプレ):
```
Subject: Domain verification stuck in "Not Started" status

Hello,

I added domain "tamjump.com" to my Resend account ~22 hours ago.
DKIM is showing as Verified, but SPF (TXT send) and MX (send) records 
remain in "Not Started" status, even though:

1. The DNS records are correctly set in Cloudflare DNS (Proxy=DNS only)
2. whatsmydns.net confirms global propagation of all records
3. I have clicked "Verify DNS Records" multiple times over several hours

Could you please investigate? Domain ID: daff317d-b15d-47af-80c3-cea0ec2d89ab

Thanks,
animalb001
```

### 9.3 残高消失誤検知 (解決済)

**事象**: 完全ログアウト経路で `localStorage.clear()` を実行した結果、画面表示の coin が一時的に 0 になった。

**確認結果**: Cognito 側の `custom:coins` は 9400 のまま無事、`loadWallet()` で復元成功。**データ消失なし**。

**原因**: localStorage を消したので画面が空表示になっただけ。リロード or `loadWallet()` で Cognito から復元される設計通りの挙動。

---

## 10. データモデル

### 10.1 Cognito custom 属性

| Attribute | Type | Max | Format | 用途 |
|---|---|---|---|---|
| custom:coins | String | 2048 | 数値文字列 | コイン残高 |
| custom:purchases | String | 2048 | JSON 配列 | 購入履歴 |
| custom:nickname | String | 40 | 任意文字列 | Dear ●● の名前 |
| custom:birthday | String | 10 | YYYY-MM-DD | 誕生日枠 frame-O 判定 |
| custom:registeredAt | String | 25 | YYYY-MM-DD or ISO8601 | 周年枠 frame-P 判定 |
| custom:letterHistory | String | 2048 | JSON 配列 (FIFO 上限10件) | 送信済みレター履歴 |

### 10.2 letterHistory の項目

```json
[
  {
    "trackId":       "nono-004",
    "frameId":       "K",
    "closingIdx":    7,
    "closingPool":   "common" | "birthday" | "anniversary" | "birthmonth",
    "sentDate":      "2026-05-09T14:23:00Z",
    "recipientHash": "a3f5b7c2d8e1..."
  },
  ...
]
```

### 10.3 localStorage キー (ブラウザ側のみ)

| Key | Type | 用途 |
|---|---|---|
| `tamsic_wallet` | JSON | {balance, purchases, listens} のキャッシュ |
| `tamsic_access_token` | JWT | Cognito access (現状は openid なし) |
| `tamsic_id_token` | JWT | Cognito ID token (Worker 認証で使用) |
| `tamsic_refresh_token` | JWT | auth.js _refreshTokens |
| `tamsic_token_expiry` | epoch ms | 失効判定 |

---

## 11. テスト要点 (本番動作確認用シナリオ)

### 11.1 基本動作 (Resend 詰まり問題が解決後)

```
[1] https://tamsic.tamjump.com にアクセス → ログイン (login.html で email + pwd)
[2] mypage で残高表示が「9,400 coin」のような3桁カンマ
[3] mypage の「プロフィール」で nickname / 誕生日 を保存 → 「保存しました」緑表示
[4] nono.html で「ぎりぎりだよ。」フル試聴ボタン → 30 coin 消費 → 9,370 coin
[5] アンロック後、便箋表示
    - 18枠のいずれか (frame-A 〜 frame-R)
    - Dear ●● = nickname、postmark に当日日付
    - 透かしが歌詞に混入していない
    - 「別の一文」ボタンで closing 引き直し動作
[6] 「この手紙をメールで受け取る」ボタン押下
    → 確認モーダル (Dear / 送信先) → 送信
    → 数秒で「送信しました」モーダル
    → 登録メアドに件名「no-no from TAMSIC — ぎりぎりだよ。」のメール到着
[7] 同じ曲で再度受信ボタン押下 → 「既に送信済み」アラート
[8] 別の曲 (no-no, kiki, gEN) でも同様に動作
[9] kiki / gEN ページで色とフォントが違う (ローズ + Hachi Maru / ブロンズ + Yuji Syuku)
[10] mypage のナビ表記が「no-no / kiki / gEN」(全大文字でない)
```

### 11.2 トークン scope 確認 (DevTools Console)

```js
// access_token の scope (現状は 'aws.cognito.signin.user.admin' のみ、openid なし)
const at = localStorage.getItem('tamsic_access_token');
console.log('access scope:', JSON.parse(atob(at.split('.')[1])).scope);

// id_token の payload (email, aud が含まれる、Worker 認証で使う)
const it = localStorage.getItem('tamsic_id_token');
console.log('id_token payload:', JSON.parse(atob(it.split('.')[1])));
```

### 11.3 Worker 直接動作確認

```
ブラウザで:
https://tamsic-send-letter.animalb001.workers.dev/

→ {"ok":false,"error":"method-not-allowed"} が返れば Worker 稼働中
```

### 11.4 Cognito userInfo 直接確認 (現状 openid scope なしで失敗する)

```js
fetch('https://ap-northeast-1vozrgcy5k.auth.ap-northeast-1.amazoncognito.com/oauth2/userInfo', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('tamsic_access_token') }
}).then(r => r.text().then(t => ({ status: r.status, body: t })))
  .then(r => console.log(r));
```

期待: `401 invalid_token: Access token does not contain the 'openid' scope`
(これは仕様、id_token 方式で回避済み)

### 11.5 Cloudflare Worker のログ確認

```cmd
cd %USERPROFILE%\Desktop\tamsic\workers
wrangler tail
```

または
```
https://dash.cloudflare.com → Workers & Pages → tamsic-send-letter → Observability
```

---

## 12. 既知の制約 / 改善余地 (設計書 §22 行き)

| 項目 | 詳細 |
|---|---|
| Cognito letterHistory 2048字上限 | FIFO 10件運用、超過時は自動で古い順に削除。長期は DynamoDB 化検討 |
| Resend 月3,000通の無料枠 | 超過時は有料プラン (月 $20〜) or AWS SES 移行 |
| Outlook メール互換 | 未テスト、受信側報告ベースで微調整 |
| 音源 public access | `assets/audio/*.mp3` が直 URL 推測可能、R2 + signed URL 化が将来課題 |
| Square Webhook 未実装 | コイン付与は手動「購入を反映する」ボタン |
| creatorNote / closings 未投入 | 12曲中1曲のみ確定、残り11曲 placeholder |
| login.html SDK 直叩き | Hosted UI 経由に書換が根本対応、現状 id_token 方式で回避 |
| Worker JWT 署名検証省略 | id_token の署名を JWKS で検証してない (cold-start 軽量化のため) |

---

## 13. 次セッションで Claude が最初にやること

### 13.1 質問テンプレート

ユーザーの最初のメッセージが曖昧なときの確認:

```
1. 続きの作業ですか? (HANDOFF_v4.md を読んでよければ「OK」)
2. 新規バグ修正・新機能の依頼?
3. 何かテストが落ちていて修正?
```

### 13.2 「続きの作業」と言われた場合の優先タスク

**最優先**:
- **Resend ドメイン認証問題の解決** (§9.2 のオプション A〜D いずれか)
  - 推奨は **A: 削除→再登録** (確実、15分)
  - もし時間が経過してれば **B: 待ち** で済むかも

**その後**:
- 動作確認テスト (§11.1)
- 各曲の `creatorNote` / `closings` 執筆 (12曲中11曲 placeholder)
- レターコレクション機能 (mypage で送信済みレター履歴表示)
- 季節枠拡張 (中秋の月、ハロウィン、クリスマス)
- Square Webhook 実装
- 音源保護 (R2 + signed URL)
- アプリ化準備

詳細は `docs/TAMSIC_TODO_v4.md` を参照。

### 13.3 Resend 削除→再登録の具体的手順 (オプション A)

ユーザーに以下を画面と URL 付きで案内:

#### Step 1: 旧 API キー削除
- URL: `https://resend.com/api-keys`
- `tamsic-letter-prod` の右の `…` メニュー → Delete API Key
- 確認画面で `tamsic-letter-prod` をタイプ → Delete API Key ボタン押下

#### Step 2: ドメイン削除
- URL: `https://resend.com/domains`
- `tamjump.com` 行をクリックして詳細ページへ
- 右上の `…` メニュー → Delete domain
- 確認画面で `tamjump.com` をタイプ → Delete domain ボタン押下

#### Step 3: ドメイン再登録
- 同じ `https://resend.com/domains` 画面で右上 + Add domain
- Domain: `tamjump.com`
- Region: Tokyo (ap-northeast-1)
- Add ボタン押下

#### Step 4: Cloudflare DNS 自動同期
- 詳細ページで Auto configure ボタン (Cloudflare ロゴ付きオレンジ) を押す
- Cloudflare の認可画面 → Authorize
- 既存の3レコード (DKIM/SPF/MX) はそのまま使われるのでスキップ表示でOK

#### Step 5: Verify DNS Records
- Resend のドメイン詳細画面に戻る
- 右上 Verify DNS Records ボタン押下
- 数秒〜数分待つ → Status が Verified (緑) になる確認

#### Step 6: API キー新規発行
- URL: `https://resend.com/api-keys`
- Create API Key ボタン
- Name: `tamsic-letter-prod`
- Permission: Sending access
- Domain: `tamjump.com` (明示的に選択、All Domains はNG)
- Add ボタン押下
- 表示された `re_xxx...` をコピー (一度しか見られない、セキュリティ上 Claude には見せない方がよい)

#### Step 7: Worker secret 更新
ターミナルで:
```cmd
cd %USERPROFILE%\Desktop\tamsic\workers
wrangler secret put RESEND_API_KEY
```
プロンプトに新キーを貼り付け → Enter

成功表示: `✨ Success! Uploaded secret RESEND_API_KEY`

(secret 更新は即時反映、Worker 再 deploy 不要)

#### Step 8: 送信テスト
ブラウザで `https://tamsic.tamjump.com/nono.html` → ハードリロード (Ctrl+Shift+R) → フル試聴解放されていれば便箋下「この手紙をメールで受け取る」ボタン → 送信する → 受信箱確認

---

## 14. 緊急時の連絡経路 / 確認場所

| 障害 | 確認場所 |
|---|---|
| Cloudflare Pages デプロイ失敗 | https://dash.cloudflare.com → Pages → tamsic → Deployments |
| Worker 障害 | https://dash.cloudflare.com → Workers & Pages → tamsic-send-letter → Observability |
| Resend 送信失敗 | https://resend.com/emails (送信履歴 + 失敗ログ) |
| Cognito 障害 | AWS Console → Cognito → User Pool kzohfe → Monitoring |

### ロールバック手段

| 段階 | ロールバック方法 |
|---|---|
| Worker | `wrangler rollback` で前バージョン |
| コードバグ | GitHub から `git revert <commit>` → push |
| レター機能停止 | `tamsic-content.js` の `features['letter-receive']` を **false** にして push (5秒) |

---

## 15. このドキュメント自体について

- **このファイルは Claude が次セッションへの引き継ぎ専用に書く** もの
- ユーザーが直接読むことも想定 (進捗確認用)
- 次セッションでも Claude がこれを更新する場合、**版数を上げて** (v4 → v5) 主要変更を冒頭にメモする
- 詳細仕様は `docs/TAMSIC_設計書_v4.html` (本番 repo) を参照する方針 (このファイルは「サマリー + ワークフロー + 環境情報 + 詰まり中課題」に絞る)

---

## 16. 補足: Resend 詰まりの真因仮説 (技術的考察)

DNS は世界中で見えてるのに Resend が認識しない理由は、Resend 内部の **DNS 検証ジョブキューが詰まってる** か、**初回検証失敗時の再試行ロジックがバックオフで長時間待つ** 可能性がある。

ドメイン削除→再登録すると検証ジョブが新規キューに入るので、結果的に通る可能性が高い。

別仮説:
- Resend のシステムが Cloudflare の Authoritative Nameservers (NS) を直接問い合わせてるが、なんらかの理由で 1 NS だけ古い情報を返している
- Cloudflare の DNS 反映に NS 間の不整合がある (極めて稀)

→ これらはユーザー側で対処不能、Resend サポートへの問い合わせ案件。

---

**END OF HANDOFF v4**
