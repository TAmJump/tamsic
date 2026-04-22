# TAMSIC 自動リリース設定手順書

毎月の手動MP3配置を完全自動化するための初期セットアップ手順です。
**この作業は1回だけ**。セットアップ後は放置でOKになります。

---

## 全体像

```
┌──────────────────────────┐
│ tamsic-audio-vault       │ ← 非公開の姉妹repo（今から作る）
│  / nono/                  │   全9曲のMP3を置いておく場所
│    re-plus.mp3           │
│    to-walk.mp3           │
│    ...                    │
│  / kiki/                  │
│    critical-point.mp3    │
│    ...                    │
└──────────────────────────┘
          ↑
          │ SSHでclone（読み取り専用）
          │
┌──────────────────────────┐
│ tamsic（本番repo）        │
│  .github/workflows/       │
│    auto-release-audio.yml│ ← 毎日JST 00:10に実行
│  .github/scripts/         │
│    check-releases.js     │ ← 今日リリースすべき曲を判定
│  assets/audio/           │ ← 公開日が来たMP3だけがここに入る
└──────────────────────────┘
```

セットアップのために、あなたがやることは **4ステップ** だけです。
所要時間: 約 15〜20 分。

---

## ステップ 1: 非公開の姉妹repoを作る

1. https://github.com/new を開く
2. 以下のように入力:
   - **Repository name**: `tamsic-audio-vault`
   - **Description**: `TAMSIC unreleased audio vault — private`
   - **Public / Private**: ✅ **Private を選択**
   - **Add README**: ✅ チェック入れる（後でこの README に MP3 を一緒に commit すれば空 repo にならない）
   - `.gitignore`・ライセンスは **None**
3. **Create repository** をクリック

---

## ステップ 2: MP3 を vault に配置

vault repo に以下の構造で MP3 を置きます。

### 方法A: Web UI でアップロード（簡単・推奨）

1. 作った `tamsic-audio-vault` リポジトリを開く
2. **Add file → Upload files**
3. nono フォルダ構造を作るため、ファイル名の先頭に `nono/` を付ける方法:
   - アップロード後、1 件ずつ Rename して `nono/re-plus.mp3` のようにする
   - または、事前にローカルで以下の構造のフォルダを作り、フォルダごと drag&drop:
     ```
     アップロード予定/
       nono/
         re-plus.mp3
         to-walk.mp3
         signal.mp3
         breathless.mp3
       kiki/
         critical-point.mp3
         burn-bright.mp3
         no-stop.mp3
         engine.mp3
         kiki-rising.mp3
     ```
4. Commit message: `upload: all 9 unreleased tracks`
5. **Commit changes**

### 方法B: ローカルからコマンドで（cmd）

```cmd
cd E:\
git clone https://github.com/TAmJump/tamsic-audio-vault.git
cd tamsic-audio-vault
mkdir nono
mkdir kiki
copy "E:\TAMSIC_音源\re-plus.mp3"        "nono\re-plus.mp3"
copy "E:\TAMSIC_音源\to-walk.mp3"        "nono\to-walk.mp3"
copy "E:\TAMSIC_音源\signal.mp3"         "nono\signal.mp3"
copy "E:\TAMSIC_音源\breathless.mp3"     "nono\breathless.mp3"
copy "E:\TAMSIC_音源\critical-point.mp3" "kiki\critical-point.mp3"
copy "E:\TAMSIC_音源\burn-bright.mp3"    "kiki\burn-bright.mp3"
copy "E:\TAMSIC_音源\no-stop.mp3"        "kiki\no-stop.mp3"
copy "E:\TAMSIC_音源\engine.mp3"         "kiki\engine.mp3"
copy "E:\TAMSIC_音源\kiki-rising.mp3"    "kiki\kiki-rising.mp3"

git add .
git commit -m "upload: all 9 unreleased tracks"
git push
```

### 重要：ファイル名の完全一致

vault の中のファイル名は、**本番repoの `tamsic-content.js` で定義されている audioPath と完全一致**させてください:

| vault のパス | tamsic-content.js の audioPath |
|---|---|
| `nono/re-plus.mp3` | `assets/audio/nono/re-plus.mp3` |
| `nono/to-walk.mp3` | `assets/audio/nono/to-walk.mp3` |
| `nono/signal.mp3` | `assets/audio/nono/signal.mp3` |
| `nono/breathless.mp3` | `assets/audio/nono/breathless.mp3` |
| `kiki/critical-point.mp3` | `assets/audio/kiki/critical-point.mp3` |
| `kiki/burn-bright.mp3` | `assets/audio/kiki/burn-bright.mp3` |
| `kiki/no-stop.mp3` | `assets/audio/kiki/no-stop.mp3` |
| `kiki/engine.mp3` | `assets/audio/kiki/engine.mp3` |
| `kiki/kiki-rising.mp3` | `assets/audio/kiki/kiki-rising.mp3` |

---

## ステップ 3: Deploy Key（SSHキー）を設定

vault を「読み取り専用」で本番repoから参照するための SSH キーペアを作ります。

### 3-A. ローカルでキーペアを生成

Windows cmd または PowerShell で:

```cmd
cd %USERPROFILE%\Desktop
ssh-keygen -t ed25519 -f tamsic_audio_vault_key -C "tamsic-audio-vault-deploy-key" -N ""
```

すると、デスクトップに2つのファイルができます:
- `tamsic_audio_vault_key` (秘密鍵)
- `tamsic_audio_vault_key.pub` (公開鍵)

### 3-B. 公開鍵を vault repo に登録

1. https://github.com/TAmJump/tamsic-audio-vault/settings/keys を開く
2. **Add deploy key** をクリック
3. 以下を入力:
   - **Title**: `tamsic main repo read access`
   - **Key**: `tamsic_audio_vault_key.pub` の **中身をそのまま貼り付け**
     - ファイルをメモ帳で開いてコピー
     - `ssh-ed25519 AAAA... tamsic-audio-vault-deploy-key` という1行
   - **Allow write access**: ❌ **チェックしない**（読み取り専用にする）
4. **Add key**

### 3-C. 秘密鍵を tamsic repo の Secrets に登録

1. https://github.com/TAmJump/tamsic/settings/secrets/actions を開く
2. **New repository secret** をクリック
3. 2つのsecretを登録:

**Secret 1: AUDIO_VAULT_DEPLOY_KEY**
- Name: `AUDIO_VAULT_DEPLOY_KEY`
- Secret: `tamsic_audio_vault_key`（秘密鍵の**中身**、メモ帳で開いて全コピー）
  - `-----BEGIN OPENSSH PRIVATE KEY-----` の行も含めて、`-----END OPENSSH PRIVATE KEY-----` の行までそのまま全部
- **Add secret**

**Secret 2: AUDIO_VAULT_REPO**
- Name: `AUDIO_VAULT_REPO`
- Secret: `TAmJump/tamsic-audio-vault`
- **Add secret**

### 3-D. 秘密鍵ファイルを安全な場所に保管 or 削除

デスクトップの `tamsic_audio_vault_key` と `.pub` は:
- **Bitwarden 等のパスワードマネージャにバックアップ**推奨
- その後、デスクトップからは削除してOK（GitHub Secret に入っているので）

---

## ステップ 4: 手動実行でテスト

今日時点（2026-04-22）では対象曲が無いので、workflow が空で通ることを確認します。

1. https://github.com/TAmJump/tamsic/actions を開く
2. 左サイドバーから **Auto-release audio** を選ぶ
3. 右上の **Run workflow** → **Run workflow**（緑ボタン）
4. 実行ログを開いて、以下が出ていればOK:
   ```
   Tracks to release today:
     (none)
   ℹ️ No tracks scheduled for release today (JST).
   ```

### 5/1 以降の確認

**2026-05-01 JST 00:10** になると自動で RE+ のMP3が配置されるはず。
翌朝 https://github.com/TAmJump/tamsic/commits/main を確認し、
`release: auto-release 1 track(s)` というコミットが TAMSIC Release Bot から
入っていれば成功です。

サイト側も https://tamsic.tamjump.com/nono.html でRE+が会員先行視聴できる
状態になります。

---

## 新しい曲を追加する場合（将来）

運用中に新曲を追加するケース。

1. `tamsic-audio-vault`（vault）に MP3 を追加
   - ファイル名・配置は既存と同じ規則で
2. `tamsic` 本番repo 側で既存の手順通り更新:
   - `tamsic-content.js` に曲データ追加
   - `release-control.js` にスケジュール追加
   - `git push`
3. 以上。MP3 の配置は会員先行公開日の JST 00:10 に自動で起きる。

---

## トラブルシューティング

### Q. workflow が失敗する（red ❌）

Actions のログを開いて、どのステップでエラーになったか確認:

| エラー箇所 | 原因 | 対処 |
|---|---|---|
| Clone vault | Deploy key が無効 | ステップ 3-B の公開鍵を確認 |
| Clone vault | vault repo 名が間違い | Secret `AUDIO_VAULT_REPO` を確認 |
| Copy MP3s | vault にファイルが無い | vault に必要な MP3 が配置されてるか確認 |
| Commit | push権限がない | repo の Settings → Actions → General → Workflow permissions を **Read and write** に |

### Q. 予定日になっても MP3 が配置されない

1. Actions の履歴を見て、その日の実行があるか確認
2. なければ手動で **Run workflow** を実行
3. それでも空で通るなら、`release-control.js` のsample日付が正しく
   今日以前の日付になっているか確認

### Q. 古い vault を delete したい

vault の`Settings → Danger zone → Delete this repository`。
main repo 側で自動実行は失敗するようになるが、既に配置済みの MP3 には
影響しない。削除後は workflow が毎日失敗通知を出すので、
`.github/workflows/auto-release-audio.yml` 自体も削除または `on: schedule` を
コメントアウトしておくこと。

---

## 補足: なぜこの構造？

- **vault を Private repo にすることで** 、MP3 は世界に対して非公開になる
- **Deploy key を read-only にすることで**、main repo が vault に書き込んで事故る
  ことはない（万一 main repo が乗っ取られても vault は被害を受けない）
- **GitHub Actions が JST 00:10 に自動実行** のため、人間が深夜に作業不要
- **release-control.js（サイト側の日付制御）と完全に同期** するので、
  サイトの「会員先行公開」表示と MP3 の実体配置が同時にリリースされる

---

## セットアップが済んだら

以下は **触らないでOK**:
- `.github/workflows/auto-release-audio.yml`
- `.github/scripts/check-releases.js`
- `AUDIO_VAULT_DEPLOY_KEY` / `AUDIO_VAULT_REPO` secrets

以降、毎月 1 日に自動で新曲が公開されます。
