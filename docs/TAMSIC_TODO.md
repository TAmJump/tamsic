# TAMSIC TODO

運用上の保留タスク。対応したら該当項目を削除 or チェック済みにする。

---

## 🎵 MP3 配置方針（未決定）

### gen-001「unセカイ」

- **公開日**: 2026-05-01（sample/full 同日解放 ← kiki/nono パターンと違い、2段階公開なし）
- **現状 (2026-04-23)**: `assets/audio/gen/gen_unsekai.mp3` が本番 repo に配置されている
- **Preflight 警告**: 「未公開なのに MP3 が本番 repo に存在 (事前漏洩リスク)」
- **決定すべきこと**: 5/1 までの 8日間の扱い
  - A: MP3 を Vault repo (`tamsic-audio-vault`) に移動し、設計書通りの自動リリース Actions で 5/1 に配置
  - B: 本番 repo に置いたまま push（UI はロックだが、直接 URL 推測でアクセスされるリスク）
  - C: 他の方法（Cloudflare Workers + R2 signed URL など、設計書 §22 将来対応）
- **関連 commit**: （未 push）

### kiki-006「unセカイ」（データ待ち）

- kiki にも同名曲「unセカイ」追加予定。公開日 2026-05-01
- sample は YouTube (`https://youtube.com/shorts/XhnWCVeDKe0`)
- full は coin
- 素材（MP3 / カバー / 歌詞）は別途送付予定

---

## 🔧 add-artist.js のバグ修正（既知、未対応）

新アーティスト追加で `no-no` テンプレの以下の残留を踏まないように:

- [ ] `.hero-visual-bg` のハードコード青グラデを置換しない
- [ ] nav 背景の `rgba(238,243,249,.9)` を置換しない
- [ ] `rgba(0,153,204,*)` / `#007aaa` など nono 固有 cyan を置換しない
- [ ] hero 画像ファイル名パターン `{base}_official_top.png` → `{id}_official_top.png` の置換が不完全
- [ ] `alt="no-no"` / `getArtistPhotos('nono')` など base アーティスト名参照の置換不完全
- [ ] `"ARTIST 001"` ハードコードを動的に 002/003 に置換しない
- [ ] タイトル系フォント (Syncopate) は大文字オンリー書体なので、表示名に小文字が含まれるアーティストは Playfair Display などセリフ体に自動切替すべき
- [ ] kiki スタイルの中央寄せ hero + 2カラム feature 構造をテンプレ出力すべき (現行は nono の 2カラム hero)

---

## 📸 素材関連

- [ ] gEN の About セクション写真: 現状 hero と同じ `gen_official_top.png` を流用。別素材があれば差し替え
- [ ] `tamsic-content.js` の `photos.nono` / `photos.kiki` が壊れている（参照先ファイル不在）。Gallery セクション自体が HTML に無いので表示には影響なし。放置可

---

## 🚀 運用

- [ ] PAT の revoke 運用（使い捨て推奨）
- [ ] GitHub Actions (`auto-release-audio.yml`) の設定と動作確認
