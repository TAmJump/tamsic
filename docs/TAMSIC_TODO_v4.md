# TAMSIC TODO v4

**最終更新**: 2026-05-10 12:00 JST
**前版**: TAMSIC_TODO_v3.md (Phase G 完了直後)

---

## 🔴 最優先・進行中

### Resend ドメイン認証詰まり問題の解決

**現状**: ドメイン `tamjump.com` の Status が `Not Started` で動かない
- Cloudflare DNS は完璧 (whatsmydns.net で世界中から確認済)
- DKIM だけ Verified、SPF (TXT) と MX が Not Started
- Verify DNS Records ボタンを何度押しても変化なし
- メール送信時に Resend API が 400 エラーで拒否

**対処オプション** (HANDOFF_v4.md §13.3 に詳細手順):
- **A**: Resend ドメインを削除→再登録 + API キー再発行 (確実、15分)
- **B**: 数時間〜翌日まで待機 → Verify ボタン再押下
- **C**: 暫定で Worker の送信先を `animalb001@gmail.com` に固定 (動作確認のみ)
- **D**: Resend サポートに英語メール (HANDOFF_v4.md §9.2 にテンプレ)

**推奨**: A (確実)。

---

## ✅ 本セッションで完了した項目

- ✅ HANDOFF_v3.md 作成 (Phase G 完了時点の総合引き継ぎ書)
- ✅ TAMSIC_TODO_v3.md 作成
- ✅ TAMSIC_システム構成図_v4.2.1.html 作成 (アーキテクチャ全景)
- ✅ TAMSIC_レター送信デプロイ手順_v4.2.1.md 作成 (実機ベース)
- ✅ TAMSIC_設計書_v4.html フッタ v4.2.1 更新
- ✅ openid scope 問題の特定と回避 (id_token 方式に切替、commit 8d1e8a1)
- ✅ Worker `verifyUser` を id_token 優先 + userInfo フォールバック構成に改修
- ✅ Cloudflare Worker 再デプロイ (Version ID: 59f1888d-1db0-48eb-9df4-9093b3018e3f)
- ✅ Resend API キー再発行 (Domain: tamjump.com 明示)
- ✅ Worker secret RESEND_API_KEY 更新
- ✅ HANDOFF_v4.md 作成 (本セッション最終時点の引き継ぎ書)
- ✅ TAMSIC_TODO_v4.md 作成 (本ファイル)

---

## 🎵 楽曲コンテンツ系

### 各曲の `creatorNote` と `closings` 執筆 (高優先)

`tamsic-content.js` 内、各 track に以下を投入する:
- `creatorNote`: 3-5文の制作秘話 (アーティスト本人視点)
- `closings`: 曲ごとの3通り、便箋末尾の一文 (`●●` を含めると nickname に置換)

**進捗** (12曲中 1曲のみ確定):
- ✅ `nono-004` 「ぎりぎりだよ。」
- ⬜ `nono-001` 「ぎりぎりだよ。 (旧)」
- ⬜ `nono-002` 「シグナル●」
- ⬜ `nono-003` 「Breathless」
- ⬜ `nono-005` 「to Walk」
- ⬜ `nono-006` 「RE+」 (release 2026-05-15)
- ⬜ `kiki-001` 「Burn bright」
- ⬜ `kiki-002` 「Critical point」
- ⬜ `kiki-003` 「No Stop」
- ⬜ `kiki-004` 「エンジン」
- ⬜ `kiki-005` 「KIKI rising」
- ⬜ `kiki-006` 「unセカイ」 (release 2026-05-15)
- ⬜ `gen-001` 「unセカイ」

**作業手順**: ユーザーから本人視点テキスト受領 → `tamsic-content.js` の該当 track に投入 → push (キャッシュバスター更新)。

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
