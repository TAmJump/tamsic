# TAMSIC TODO v3

**最終更新**: 2026-05-09 (Phase G 完了後)

運用上の保留タスク。対応したら該当項目をチェック済み or 削除する。

---

## ✅ 完了済み (前 TODO から移動)

- ✅ **歌詞便箋システム実装** (v4.2.1) — 18枠 + closing 抽選 + フル稼働
- ✅ **レター送信機能本実装** — Cloudflare Worker + Resend ドメイン認証 + Cognito letterHistory
- ✅ **Cognito custom 属性 4個追加** (nickname/birthday/registeredAt/letterHistory)
- ✅ **コイン残高 3桁カンマ** (`toLocaleString`)
- ✅ **ナビ no-no/kiki/gEN 表記** (大文字化抑止)
- ✅ **アクセストークン60分自動更新** (refresh_token rotation)
- ✅ **コイン保管統一** (旧 TAMSIC_COIN_STATE_V1 廃止 → coins.js / tamsic_wallet)

---

## 🎵 楽曲コンテンツ系

### 各曲の `creatorNote` と `closings` 執筆 (高優先)

`tamsic-content.js` 内、各 track に以下を投入する:
- `creatorNote`: 3-5文の制作秘話 (アーティスト本人視点)
- `closings`: 曲ごとの3通り、便箋末尾の一文として使う (`●●` を含めると nickname に置換される)

**進捗 (12曲中 1曲)**:
- ✅ `nono-004` 「ぎりぎりだよ。」: 確定済み
- ⬜ `nono-001` 「ぎりぎりだよ。 (旧)」: placeholder
- ⬜ `nono-002` 「シグナル●」: placeholder
- ⬜ `nono-003` 「Breathless」: placeholder
- ⬜ `nono-005` 「to Walk」: placeholder
- ⬜ `nono-006` 「RE+」: placeholder (※ release 5/15)
- ⬜ `kiki-001` 「Burn bright」: placeholder
- ⬜ `kiki-002` 「Critical point」: placeholder
- ⬜ `kiki-003` 「No Stop」: placeholder
- ⬜ `kiki-004` 「エンジン」: placeholder
- ⬜ `kiki-005` 「KIKI rising」: placeholder
- ⬜ `kiki-006` 「unセカイ」: placeholder (※ release 5/15)
- ⬜ `gen-001` 「unセカイ」: placeholder

**作業手順** (ユーザーから本人視点テキストを受け取り次第):
1. ユーザーから1曲分のテキストを受領
2. `tamsic-content.js` の該当 track に流し込み
3. push (キャッシュバスター更新)
4. 該当アーティストページで実機確認

---

### gen-001 / kiki-006「unセカイ」MP3 配置方針 (継続案件)

- **公開日**: 2026-05-15 (gen は 5/1 公開済み)
- **現状**: gen MP3 は本番 repo に配置済み、kiki は MP3 待ち
- **方針候補**:
  - A: Vault repo (`tamsic-audio-vault`) + GitHub Actions による自動配置 (旧設計書 §22 案)
  - B: 本番 repo に置く (URL 推測アクセスのリスクあり)
  - C: Cloudflare R2 + signed URL (最終形だが実装重め)

→ 当面 B で運用、C への移行は将来課題。

---

## 💌 レター機能の拡張 (任意)

### レターコレクション機能 (mypage 拡張)

mypage に「受け取ったレター履歴」セクションを追加:
- `custom:letterHistory` を読み取り、送信した曲・日付・frame をリスト表示
- frame アイコン (frame-K=桜、frame-O=誕生日 等) で視覚化
- レア (Q/R) を獲得した記念演出
- 「同じ曲を別アドレスで受け取りたい」要望が出たら multi-recipient 検討

### 季節枠の追加

現在 K(桜)/L(雪)/M(海)/N(紅葉) の4枠。追加候補:
- 中秋の月 (9月限定)
- ハロウィン (10/15-10/31、紅葉と共存)
- クリスマス (12月限定で雪結晶と置換 or 重複可)
- 桜とは別に 鯉のぼり (5月) など

実装は `letter-frames.js` の FRAMES 定義 + `letter.css` の `.frame-X` スタイル + (お好みで `letter-content.js` の SEASON_CLOSINGS) 追加するだけ。

### レアの希少度調整

現在 Q=1.00% / R=4.95%。要望次第で:
- ブロンズ枠追加 (15% 程度)
- プラチナ枠追加 (0.1% 程度、超レア)
- 七色枠 (1日1回限定の超超レア)

### Adobe Fonts (TA恋心) への切替

現在 SIL OFL 3フォント (Zen Kurenaido / Hachi Maru Pop / Yuji Syuku)。Adobe CC 月¥680〜のフォント TA恋心 で書体グレードアップ可能。
切替コストはほぼゼロ (CSS フォールバック済み):
```css
font-family: 'TA Koigokoro', 'Zen Kurenaido', serif;
```
→ Adobe CC 7日間無料体験で実機検証して判断。

---

## 🛡 セキュリティ / 認証

### Square Webhook によるコイン自動付与

現状: 購入後にユーザーが mypage の「購入を反映する」ボタンを押す → クライアント JS から `addCoinsToCognito` を呼ぶ
課題:
- 不正クライアント JS で任意付与できる (脆弱性)
- ユーザーが反映ボタンを押し忘れると残高がズレる

対策: Cloudflare Worker で Square Webhook を受け、Cognito Admin API で属性更新。

実装ステップ:
1. Square Developer Dashboard で Webhook URL 登録
2. 新規 Worker `tamsic-square-webhook` を作成 (`workers/square-webhook.js`)
3. AWS IAM で Cognito Admin API 用の Access Key 発行 → wrangler secret に登録
4. Worker で署名検証 + `cognito-idp:AdminUpdateUserAttributes` を呼ぶ
5. mypage の「購入を反映する」ボタンを撤去 (Webhook で自動)

### 音源保護 (R2 + signed URL)

現状: `assets/audio/*.mp3` が public、URL 推測で誰でもダウンロード可能
対策: Cloudflare R2 に音源を移動 → Worker で 1分有効の signed URL 発行 → audio タグに渡す

→ 設計書 §22 で言及済み、未着手。

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
- **SwiftUI + Jetpack Compose** (各プラットフォームネイティブ実装、最高品質だが工数2倍)

### 必要な前準備

- API 化: 全状態管理を Worker 経由に (現状はフロント JS + Cognito 直叩きが多い)
- 歌詞5層保護: ブラウザ依存実装 (PrintScreen検知/DevTools検知) はネイティブで別実装
- メールレター: Worker そのまま使える (アプリから叩くだけ)
- IAP (App Store/Google Play 課金): Square と並立 or 切替

→ アプリ化は現 Web 完成後の話。設計書 §22 の長期項目。

---

## 🐛 既知のバグ / 改善余地

### add-artist.js のバグ修正 (旧 TODO から継続)

- 既存アーティストへの上書き挙動が不安定
- admin.html で再現可能
- 詳細: 旧 `docs/TAMSIC_TODO.md` 参照
- 対処予定: 中優先 (admin tooling は緊急性低)

### Outlook メール互換性テスト未実施

- 設計書ではインライン CSS + data URL で対応済みのはず
- 受信側からの不具合報告ベースで微調整予定

### Cognito letterHistory 2048 文字上限

- FIFO 10件運用、問題発生時は DynamoDB に移行検討
- 現状は1曲送信あたり ~120 byte 想定なので 10件で安全マージン

### スマホ表示の確認

- letter.css のレスポンシブは ≤600px で 1カラム化、Banner マージン調整
- 実機 iPhone/Android テスト未実施 (DevTools のレスポンシブビューでは OK)

---

## 🎨 デザイン微調整候補

- 便箋 frame の細部調整 (フィードバックベース)
- ナビゲーションのモバイル対応 (現状 max-width:768px でハンバーガー化、未テスト)
- アーティストページの「アーティスト紹介」セクション拡充 (現状 placeholder)
- レター preview ページのデザイン改良 (`letter-preview.html`、開発者向けツール扱い)

---

## 📊 計測 / 分析

- アクセス解析 (Google Analytics 4) 導入検討
- どの曲が一番レターを送信されてるか (Resend Dashboard で件数見える)
- 18枠のうち実際の出現率分布 (theory vs actual)

---

**END OF TODO v3**
