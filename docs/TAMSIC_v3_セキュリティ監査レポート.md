# TAMSIC セキュリティ監査レポート（v3 時点）

対象: https://github.com/TAmJump/tamsic / https://tamsic.tamjump.com
監査日: 2026-04-22
監査範囲: 公開制御・課金ゲート・歌詞保護・認証

---

## エグゼクティブサマリ

TAMSIC は GitHub Pages 上の**完全静的サイト**のため、サーバー側アクセス制御が
存在しません。本監査で発見された最も重要な事項は、**`release-control.js` に
よる公開制御は UI 表示のみを制御しており、実ファイルへの直接アクセスは
防げない**という構造的な問題です。

| 項目 | 重大度 | v3 実装後の状態 |
|------|--------|-----------------|
| 音声ファイル直接アクセス | 🟥 高 | **未解決**（構造的制約） |
| 歌詞のコピー・スクショ | 🟨 中 | 抑止レベルまで実装済み |
| 認証情報（JWT）管理 | 🟩 低 | OK（Cognito管理） |
| 非会員の UI 侵入 | 🟩 低 | OK（gate-modal） |
| CSRF / XSS | 🟩 低 | OK（静的サイト＋Cognito SRP） |

---

## 🟥 重大度・高: 音声ファイルの直接アクセス

### 現状

現在、repo にコミット済みの MP3 は以下の 10 曲:

**no-no（/assets/audio/nono/）**
- girigiri-dayo.mp3（公開日: 2026-04-15）
- re-plus.mp3（公開日: 2026-05-15）
- to-walk.mp3（公開日: 2026-06-15）
- signal.mp3（公開日: 2026-07-15）
- breathless.mp3（公開日: 2026-08-15）

**kiki（/assets/audio/kiki/）**
- critical-point.mp3（公開日: 2026-09-15）
- burn-bright.mp3（公開日: 2026-10-15）
- no-stop.mp3（公開日: 2026-11-15）
- engine.mp3（公開日: 2026-12-15）
- kiki-rising.mp3（公開日: 2027-01-15）

### 問題

これらはすべて**現時点で公開アクセス可能**です。例:
- `https://tamsic.tamjump.com/assets/audio/kiki/kiki-rising.mp3`
  → 2027年1月まで非公開のはずなのに、今すでにダウンロードできる

URL は `tamsic-content.js` に平文で記載されているため、JavaScript を読めば全パスが判明します。

### v3 で追加した弱い防御

`getTrackAudioSrc()` に公開状態チェックを追加しました。これにより:
- サイト内の再生ボタン押下時は `locked` / `preview` 曲で空文字が返る
- → プレイヤーは起動せず、ボタンからは再生できない

しかし:
- 誰かが直接 URL を叩けば依然として MP3 は返る
- `tamsic-content.js` を開けば URL 一覧が見える
- **これは根本解決ではありません。**

### 根本的な解決策（推奨・強い順）

#### A. MP3 を公開日までコミットしない（最も簡単・確実）
現状の構造を維持したまま、以下の運用ルールに変える:
1. 新曲 MP3 は「会員先行公開日」の前に repo に入れない
2. 会員先行公開日にローカルに配置 → `git add` → `git push`
3. `tamsic-content.js` の `audioPath` は当初から書いておき、公開日までファイルだけ欠けている状態にする（または audioPath も空で出し、公開日に追記）

**欠点**: 毎リリースで手動作業が発生。自動化するなら GitHub Actions + schedule trigger。

#### B. Cloudflare R2 + Workers（正式解決・中コスト）
1. MP3 を R2 にアップロード（公開バケットではなくプライベート）
2. Cloudflare Worker で「曲ID + JWT」を検証して signed URL を発行
3. サイト側は `/api/audio/{trackId}` を叩き、Worker が会員性・公開日を確認してから 302 で R2 signed URL にリダイレクト

**利点**: サーバー側で確実にゲートできる。会員の Cognito JWT を Worker 側で検証すれば会員判定も正確。
**欠点**: Worker コード・CORS 設定・R2 バケット・キャッシュ制御の初期セットアップが必要（数時間〜半日）。

#### C. S3 Signed URL + AWS Lambda（A方式の AWS版）
TAMSIC は既に Cognito を AWS で使っているので、同じエコシステムで完結できる。ただし B 案より若干複雑。

### 推奨

**短期（今週中）**: 方式 A。リリーススケジュールを見て、すぐに公開されない MP3 は repo から削除し、該当 `audioPath` も空にする。

**中期（1〜2ヶ月）**: 方式 B。Touchvoo で Cloudflare Workers を運用している経験があるので親和性が高い。

---

## 🟨 重大度・中: 歌詞のコピー・スクリーンショット

### 現状（v3 実装後）

`lyrics-guard.js` により以下を実装:
- CSS: `user-select: none` 等で選択抑止
- イベント: contextmenu / copy / cut / selectstart / dragstart を preventDefault
- キー: Ctrl/⌘+C, A, S, P, PrintScreen を抑止（歌詞フォーカス時のみ）
- 難読化: 1文字1span で DOM 上に連続した歌詞テキストが存在しない
- 透かし: ログイン中ユーザーのメールアドレスの SHA-256 ハッシュを
  歌詞背面に 5% 不透明で敷き詰め（流出時の追跡用）
- DevTools 検知: ウィンドウサイズ差から DevTools 開を検知し歌詞をぼかす
- PrintScreen 検知: 3秒間ぼかし

### 防げないもの（技術的に不可能）

- **OS ネイティブのスクリーンショット**（Windows Snipping Tool, macOS Cmd+Shift+4, iPhone 電源+音量同時押し）
- **外部カメラでの物理撮影**
- **ブラウザ拡張機能による DOM 操作**（完全には防げない）

これらは Web の構造上、完全防御が不可能です。現在の実装は「**カジュアルな
持ち出しを防ぐ + 流出時に追跡可能にする**」水準まで到達しており、これ以上の
強化（Canvas レンダリング、DRM）は検索性・アクセシビリティとのトレードオフが
大きすぎるため、v3 では意図的に採用していません。

### 運用上の推奨

1. 歌詞流出が判明したら、流出元の歌詞テキスト背景にある透かしハッシュを
   読み取り（画像解析ツール使用）、内部のユーザーマッピングテーブルで
   逆引きして会員を特定
2. 特定できたら Cognito でそのユーザーを `AdminDisableUser`
3. 利用規約に「歌詞カードの複製・転載禁止」と「違反時のアカウント停止」を
   明記（法的根拠の確立）

---

## 🟩 重大度・低: 認証情報管理

### 現状

v3 で Cognito SRP 認証に切り替え済み。評価:
- パスワードは TAMSIC 側のコードを通らない（SRP は zero-knowledge proof）
- JWT は localStorage 保存（XSS 対策として httpOnly cookie が理想だが、静的サイト + クロスドメインの制約で現実的でない）
- リフレッシュトークンは 5日間（v2 設計書 § 04）
- アクセストークンは 60分

### 弱点

- **60分でログアウトされる**: refresh_token を使った自動更新を実装すれば
  解消（v2 § 12 の将来課題に記載済み）。v3 でも未対応。
- **localStorage の XSS 耐性**: TAMSIC 本体コードには XSS 注入点がないが、
  外部 CDN（jsdelivr, Google Fonts）を 100% 信頼している前提

### 推奨

短期的には問題なし。v4 以降で:
- `refresh_token` による自動更新実装
- CSP (Content Security Policy) ヘッダーを Cloudflare で設定

---

## 🟩 重大度・低: CSRF / XSS

### 現状

- 静的サイトのため CSRF 攻撃の対象となる API エンドポイントが TAMSIC 側には存在しない
- Cognito へのリクエストは SDK が CSRF 対策を内蔵
- ユーザー入力の HTML 埋め込みはないため XSS リスクは低い
- `tamsic.js` に `escapeHtml()` ユーティリティが定義済み

### 確認事項

`escapeHtml()` が使われていない箇所がないか定期監査。特に:
- 歌詞表示（v3 で `lyrics-guard.js` が textContent 経由で安全に描画）
- ニュース記事（showAfter で未来の日付を持つレコードがあれば注意）

---

## 全体総括

v3 実装後の TAMSIC は、**静的サイトの範囲でできる対策はほぼ網羅**している状態です。残る重大リスクは「音声ファイル直接アクセス」のみで、これは構造的な
制約から来るものであり、**方式 A（リリース前は repo にコミットしない）を
運用ルールとして採用すれば、今すぐ解決できます。**

### 引き継ぎ担当者への注意

- 新曲をリリースする際、**公開日の前日まで MP3 を repo に入れない**運用を守ること
- 歌詞保護モジュールは「完全防御」ではなく「抑止＋追跡」と理解すること
- ユーザーから「PW を確認したい」と問い合わせが来ても、**確認は不可能**であり、
  reset フローに案内すること（Cognito が正しく設計されている証拠でもある）
