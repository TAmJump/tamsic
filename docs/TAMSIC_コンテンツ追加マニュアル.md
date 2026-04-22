# TAMSIC コンテンツ追加 クイックマニュアル

新曲・新アーティストを素早く・安全に追加するためのスクリプト集。

## TL;DR（1分で読む）

```bash
# 新曲追加
node scripts/add-track.js --artist nono --id nono-007 \
  --title "新曲" --title-en "New Song" --price 100 \
  --sample-start "0:30" --sample-end "1:00" \
  --sample-date 2027-03-01 --release-date 2027-03-15 \
  --cover-file nono-newsong.png --audio-file nono-newsong.mp3

# 新アーティスト追加
node scripts/add-artist.js --id ichi --display-name "ichi" \
  --accent-color "#6B4E71"

# push前の検証（必須）
node scripts/preflight.js

# 問題なければpush
git add . && git commit -m "add: 新曲" && git push
```

---

## scripts/add-track.js（新曲追加）

### 最小限の呼び出し
```bash
node scripts/add-track.js \
  --artist nono \
  --id nono-007 \
  --title "新曲タイトル" \
  --title-en "New Track" \
  --price 100 \
  --sample-start "0:30" \
  --sample-end "1:00" \
  --sample-date 2027-03-01 \
  --release-date 2027-03-15 \
  --cover-file nono-newtrack.png \
  --audio-file nono-newtrack.mp3
```

### 全オプション

| 引数 | 必須 | 内容 | 例 |
|---|---|---|---|
| `--artist` | ✅ | アーティストID | `nono` / `kiki` |
| `--id` | ✅ | 曲ID（一意） | `nono-007` |
| `--title` | ✅ | 曲名（日本語） | `"ぎりぎりだよ。"` |
| `--title-en` | ✅ | 曲名（英語） | `"On the Edge"` |
| `--price` | ✅ | フル試聴コイン数 | `100` |
| `--sample-start` | ✅ | サンプル開始 mm:ss | `"0:30"` |
| `--sample-end` | ✅ | サンプル終了 mm:ss | `"1:00"` |
| `--sample-date` | ✅ | 会員先行公開日 | `2027-03-01` |
| `--release-date` | ✅ | 一般公開日 | `2027-03-15` |
| `--cover-file` | ✅ | カバー画像のファイル名 | `nono-newsong.png` |
| `--audio-file` | ✅ | MP3のファイル名 | `nono-newsong.mp3` |
| `--youtube` |  | YouTubeの完全URL | `"https://youtu.be/XXX"` |
| `--lyrics-file` |  | 歌詞txtファイルのパス | `"./lyrics.txt"` |
| `--lyrics-preview` |  | 歌詞プレビュー3-4行 | 自動生成も可 |
| `--is-new` |  | "NEW"バッジ表示 | フラグのみ |
| `--dry-run` |  | 書き込まず確認のみ | フラグのみ |

### やること・やらないこと

**スクリプトが自動でやること:**
- `tamsic-content.js` の tracks 配列に追加
- `tamsic-content.js` の news 配列に sample/release 2件追加
- `release-control.js` に日付スケジュール追加
- `.bak` ファイル作成（ロールバック可能）

**あなたが手動でやること:**
- カバー画像を `assets/images/{artist}/` に配置
- MP3 を Vault repo（`tamsic-audio-vault`）に配置
- preflight で検証後、git push

---

## scripts/add-artist.js（新アーティスト追加）

### 最小限の呼び出し
```bash
node scripts/add-artist.js \
  --id ichi \
  --display-name "ichi" \
  --accent-color "#6B4E71"
```

### 全オプション

| 引数 | 必須 | 内容 | 例 |
|---|---|---|---|
| `--id` | ✅ | アーティストID（英数字） | `ichi` |
| `--display-name` | ✅ | 表示名 | `"ichi"` / `"no-no"` |
| `--accent-color` | ✅ | アクセントカラー #RRGGBB | `"#6B4E71"` |
| `--heading-font` |  | 見出しフォント | `"Cormorant Garamond"`（省略時`Syncopate`） |
| `--body-font` |  | 本文フォント | `"Inter"`（省略時`DM Sans`） |
| `--base` |  | テンプレ元 | `nono` / `kiki`（省略時`nono`） |
| `--force` |  | 既存ファイル上書き | フラグのみ |
| `--dry-run` |  | 書き込まず確認のみ | フラグのみ |

### カラー自動生成

`--accent-color` を指定すると、以下が自動計算されます:
- `--bg` (ページ背景): アクセントを93%白と混色
- `--text`: アクセントを82%黒と混色
- `--light` (ボーダー): アクセントを78%白と混色
- `--mid` (サブテキスト): アクセントを45%黒と混色

手動で細かく調整したい場合は、生成後の `{id}.html` の `:root` を編集。

### やること・やらないこと

**スクリプトが自動でやること:**
- `{id}.html` を `nono.html`（または `kiki.html`）から複製
- CSS 変数・Google Fonts URL・ARTIST_ID・フィルタを新値で一括置換
- `assets/images/{id}/` と `assets/audio/{id}/` ディレクトリ作成
- `tamsic-content.js` の photos に `{id}: []` を追加

**あなたが手動でやること:**
- ヒーロー画像（`{id}_official_top.png`）など主要画像を配置
- `index.html` / `about.html` / `news.html` のナビに新ページへのリンクを追加
- ギャラリー写真を `tamsic-content.js` の photos.{id} 配列に追記
- 新アーティスト向けの曲を `add-track.js --artist {id} --allow-new-artist` で追加

---

## scripts/preflight.js（push前検証）

### 実行
```bash
node scripts/preflight.js              # 通常チェック
node scripts/preflight.js --quiet      # エラーと警告のみ
node scripts/preflight.js --strict     # 警告も失敗扱い
```

### チェック項目（全11項目）

1. `tamsic-content.js` の JSON 構文
2. `release-control.js` の実行可能性
3. contentとreleaseで曲タイトル一致
4. tracks / news の id 重複なし
5. 全トラックの `coverPath` 実在
6. 公開日と MP3 配置状態の整合（🔴重要）
7. ニュースの `showAfter` 形式
8. `assets/audio/` ディレクトリ構造
9. Cognito UserPoolId の一貫性
10. GitHub Actions ファイル存在
11. （summary）

### pre-commit hook として自動化

毎回手動で走らせなくて済むように:

```bash
# .git/hooks/pre-commit を作成
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/sh
node scripts/preflight.js || exit 1
EOF
chmod +x .git/hooks/pre-commit
```

これで `git commit` 時に自動で検証が走り、fail があれば commit が止まります。

---

## よくあるシナリオ

### シナリオ1: 既存アーティストに新曲を追加

```bash
# 1. Vault repo に MP3 を追加してpush（別repo）
cd E:\tamsic-audio-vault
cp "E:\TAMSIC_音源\newsong.mp3" nono/newsong.mp3
git add nono/newsong.mp3 && git commit -m "add: newsong" && git push

# 2. 本番 repo でスクリプト実行
cd E:\TAMSIC_site_completed
node scripts/add-track.js --artist nono --id nono-008 \
  --title "新曲" --title-en "New" --price 100 \
  --sample-start "0:30" --sample-end "1:00" \
  --sample-date 2027-04-01 --release-date 2027-04-15 \
  --cover-file newsong.png --audio-file newsong.mp3

# 3. カバー画像を配置
copy "E:\art\newsong.png" assets\images\nono\newsong.png

# 4. 検証
node scripts/preflight.js

# 5. コミット&push
git add .
git commit -m "add: no-no 新曲「新曲」"
git push
```

### シナリオ2: 新アーティスト ichi を追加して初曲も入れる

```bash
cd E:\TAMSIC_site_completed

# 1. アーティスト追加
node scripts/add-artist.js --id ichi --display-name "ichi" --accent-color "#6B4E71"

# 2. ヒーロー画像を配置
copy "E:\art\ichi_top.png" assets\images\ichi\ichi_official_top.png

# 3. 初曲を追加
node scripts/add-track.js --artist ichi --allow-new-artist \
  --id ichi-001 --title "初曲" --title-en "First" \
  --price 100 --sample-start 0:30 --sample-end 1:00 \
  --sample-date 2027-05-01 --release-date 2027-05-15 \
  --cover-file ichi-first.png --audio-file ichi-first.mp3

# 4. index.html / news.html / about.html のナビに ichi.html リンクを追加（手動）

# 5. Vault に MP3 追加（別repo、別ディレクトリ作成）
# ...

# 6. 検証
node scripts/preflight.js

# 7. コミット&push
git add .
git commit -m "add: 新アーティスト ichi と初曲"
git push
```

### シナリオ3: うっかり間違えた → ロールバック

```bash
# add-track.js / add-artist.js を実行すると .bak ファイルができる
mv tamsic-content.js.bak tamsic-content.js
mv release-control.js.bak release-control.js
# 必要なら {id}.html も削除 or git checkout
```

---

## トラブルシューティング

### `preflight.js` で「公開日が来ているのに MP3 が無い」

→ GitHub Actions 自動配置が失敗している可能性。
→ Actions タブでログ確認、手動 Run workflow でリトライ。

### `preflight.js` で「未公開なのに MP3 が本番repoに存在」

→ 誰かがうっかり MP3 を repo に push した。
→ `git rm assets/audio/{artist}/{file}.mp3` して push しなおし。

### `add-artist.js` の色が気に入らない

→ 生成後の `{id}.html` の `:root{...}` を手動編集。 `--dry-run` で事前に確認可能。

### `add-track.js` で「id がすでに存在」

→ 別のIDを付ける。IDは `{artist}-{3桁連番}` の規則推奨。
