# TAMSIC

3アーティスト (no-no / kiki / gEN) のオリジナル楽曲レーベルの会員制 Web サイト。

- **本番 URL**: https://tamsic.tamjump.com
- **ホスティング**: Cloudflare Pages (main 自動デプロイ)
- **認証**: AWS Cognito
- **メール送信**: Cloudflare Worker + Resend

---

## ⭐ Claude / 開発者が新セッションで最初に読むファイル

### 第一読 (必読)
**`HANDOFF_v4.md`** — 最新の引き継ぎ書 (本ファイルと同じディレクトリ)

これだけ読めば、現在の状態 (Phase D/E/F/G の進捗、Resend ドメイン詰まり問題、openid scope 回避策、Cognito/Worker/Resend の本番設定値、ユーザーの絶対指示) がすべて把握できる。

### 第二読 (タスクを把握)
**`docs/TAMSIC_TODO_v4.md`** — 残タスク一覧 (最優先・進行中・将来)

### 第三読 (アーキテクチャ把握)
**`docs/TAMSIC_システム構成図_v4.2.2.html`** — ブラウザで開く。レイヤー責務、データモデル、フロー図。

### 第四読 (詳細仕様 / 設計書)
**`docs/TAMSIC_設計書_v4.html`** — メイン設計書 v4.2.2

### 必要に応じて
- `docs/TAMSIC_レター送信デプロイ手順_v4.2.2.md` — Phase D/E/F/G の実機ベース手順 + トラブルシューティング
- `docs/TAMSIC_設計書_§10_v4.2.1_完全版.html` — §10 (歌詞便箋) 詳細リファレンス
- `docs/TAMSIC_コンテンツ追加マニュアル.md` — track 追加手順
- `docs/TAMSIC_自動リリース設定手順.md` — Actions 関連 (現状未稼働)

### 旧版 (歴史的参考、最新ではない)
- `HANDOFF_v3.md` (2026-05-09 時点)
- `docs/TAMSIC_TODO.md` / `docs/TAMSIC_TODO_v3.md`
- `docs/TAMSIC_システム構成図_v4.2.1.html`
- `docs/TAMSIC_レター送信デプロイ手順_v4.2.1.md`
- `docs/TAMSIC_設計書_v3.html`

---

## 現在の状態 (2026-05-10)

| 機能 | 状態 |
|---|---|
| 認証・コイン・フル試聴・便箋表示 | ✅ 稼働中 |
| Cognito custom 属性 (Phase D) | ✅ 完了 |
| Cloudflare Worker (Phase E) | ✅ デプロイ済、id_token 対応版 |
| Resend ドメイン認証 (Phase F) | ⚠️ Not Started のまま動かない (詰まり中) |
| フロント flag ON (Phase G) | ✅ 完了 |
| メール送信 | ❌ Resend 詰まりで 400 エラー |

**次にやること**: HANDOFF_v4.md §13.3 の Resend 削除→再登録手順を実施。

---

## 構成

- `index.html` / `nono.html` / `kiki.html` / `gen.html` / `mypage.html` などのアーティスト別ページ
- `*.js` (auth, coins, letter-*, etc.)
- `*.css`
- `workers/` — Cloudflare Worker (`send-letter.js`)
- `docs/` — 設計書 + 引き継ぎドキュメント
- `assets/` — 画像、音源、フォント

---

## ライセンス

Confidential - All rights reserved by TAmJump.
