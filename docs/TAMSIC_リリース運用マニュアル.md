# TAMSIC リリース運用マニュアル（新曲公開時の MP3 配置手順）

## 背景

TAMSIC は GitHub Pages（静的配信）のため、repo にコミット済みの MP3 は
URL を知っている人なら誰でもアクセスできてしまいます。
v3 のセキュリティ監査で「**未公開曲の MP3 は、会員先行公開日の前日まで
repo にコミットしない**」運用を採用しました。

このファイルは、新曲のリリース（会員先行公開）を行う際の手順書です。

---

## 原則

**MP3 を repo にコミットするタイミング = その曲の「会員先行公開日」の当日または前日**

| 状態 | 条件 | MP3 を repo に入れるか |
|------|------|----------------------|
| COMING SOON | 会員先行公開日より前 | ❌ **入れない** |
| MEMBER EARLY ACCESS | 会員先行公開日〜一般公開日 | ✅ 入れる |
| NOW AVAILABLE | 一般公開日以降 | ✅ 入れる |

---

## 公開スケジュール一覧（2026-04-22 時点）

| アーティスト | 曲名 | 会員先行公開日 | 一般公開日 | MP3 配置タイミング |
|---|---|---|---|---|
| no-no | ぎりぎりだよ。 | 2026-04-01 | 2026-04-15 | ✅ 配置済 |
| no-no | RE+ | **2026-05-01** | 2026-05-15 | **4/30 までに配置** |
| no-no | to Walk | 2026-06-01 | 2026-06-15 | 5/31 までに配置 |
| no-no | シグナル● | 2026-07-01 | 2026-07-15 | 6/30 までに配置 |
| no-no | Breathless | 2026-08-01 | 2026-08-15 | 7/31 までに配置 |
| kiki | Critical point | 2026-09-01 | 2026-09-15 | 8/31 までに配置 |
| kiki | Burn bright | 2026-10-01 | 2026-10-15 | 9/30 までに配置 |
| kiki | No Stop | 2026-11-01 | 2026-11-15 | 10/31 までに配置 |
| kiki | エンジン | 2026-12-01 | 2026-12-15 | 11/30 までに配置 |
| kiki | KIKI rising | 2027-01-01 | 2027-01-15 | 12/31 までに配置 |

---

## 新曲を公開する手順（リリース当日）

### 手順 1: MP3 ファイルをローカルに用意

ローカル E ドライブの保存場所から、該当の MP3 をローカル clone ディレクトリに配置:

```cmd
REM 例: re-plus.mp3 を配置する場合
copy "E:\TAMSIC_音源\re-plus.mp3" "E:\TAMSIC_site_completed\assets\audio\nono\re-plus.mp3"
```

**ファイル名は `tamsic-content.js` に書かれている `audioPath` と完全一致させること:**

- no-no: `assets/audio/nono/{曲ID}.mp3`
- kiki:  `assets/audio/kiki/{曲ID}.mp3`

### 手順 2: Git でコミット & push

```cmd
cd E:\TAMSIC_site_completed
git add assets/audio/nono/re-plus.mp3
git commit -m "release: nono「RE+」の MP3 を配置（会員先行公開）"
git push
```

### 手順 3: 2〜3 分待って動作確認

1. https://tamsic.tamjump.com/nono.html を開く
2. 該当曲が「MEMBER EARLY ACCESS」表示に自動切り替わっているか確認（日付制御は `release-control.js` が自動）
3. ログイン済み状態でサンプル再生が成功するか確認
4. ログアウト状態でモーダルが出るか確認

---

## よくある質問

### Q1. ファイル名を間違えたらどうなる？

サイト側の `tamsic-content.js` に書かれているパスと MP3 のファイル名が一致して
いないと、`404 Not Found` が返ります。ユーザーには「音声ファイルが見つかりません」
的なエラーが出ます。すぐ git push でファイル名を修正してください。

### Q2. 会員先行公開日より前にうっかりコミットしてしまった

慌てず、すぐに `git rm` して push で削除すれば、URL アクセスは 404 になります。
ただし **git history には残る**ので、本気の人は commit hash 指定で取得可能です。

絶対に漏らしたくない場合は `git filter-branch` や BFG Repo Cleaner で history を
書き換えて force push する必要があります（要注意：全コラボレーターの clone が
壊れます）。

### Q3. 既に削除した MP3 を再度配置するにはどうすればいい？

1. ローカルに MP3 ファイルを再配置
2. `git add` → `git commit` → `git push`
3. 以上

過去のコミット（削除前）から復元することも可能:
```cmd
git checkout <削除前のcommit-hash> -- assets/audio/nono/re-plus.mp3
```

### Q4. 会員先行公開日より前にメンバーが URL を試してきたら？

`assets/audio/nono/re-plus.mp3` が repo にないため、404 が返ります。
カジュアルな探索は完全に防げます。

### Q5. 一般公開後も MP3 は repo に置いたままで問題ない？

はい。一般公開後は誰でも聴けて良い状態なので、repo にあっても問題なし。
むしろ置いておかないとサイトで再生できません。

---

## 自動化の余地（将来）

GitHub Actions を使えば、このフローを自動化できます:

1. GitHub Release（Assets 機能）に非公開 MP3 をアップロード
2. cron スケジュールの Actions が、会員先行公開日に Release Asset から
   対象 MP3 を取得して `assets/audio/` に配置し、自動 commit & push

詳細は将来の v4 設計書で扱います。現時点は手動運用で十分です。

---

## 本格対策（方式 B）への移行時

もし将来 Cloudflare R2 + Workers の方式 B に移行する場合:

1. MP3 を全て R2 のプライベートバケットにアップロード
2. Cloudflare Worker で `/api/audio/{trackId}` エンドポイントを作成
3. Worker が「Cognito JWT 検証」+「`release-control.js` 相当の日付判定」+
   「会員判定」を実施し、問題なければ R2 の signed URL (有効期限 5 分) を
   302 で返す
4. `tamsic.js` の `getTrackAudioSrc()` を Worker エンドポイント経由に変更
5. repo の `assets/audio/` 配下の MP3 は全削除

詳細は `TAMSIC_v3_セキュリティ監査レポート.md` 参照。
