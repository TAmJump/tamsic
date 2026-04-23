#!/usr/bin/env node
/**
 * scripts/add-track.js
 *
 * TAMSIC に新曲を追加するスクリプト。手動編集を避けて構文エラーを防ぐ。
 *
 * 使い方:
 *   node scripts/add-track.js \
 *     --artist nono \
 *     --id nono-007 \
 *     --title "新曲タイトル" \
 *     --title-en "New Track Title" \
 *     --price 100 \
 *     --sample-start "0:45" \
 *     --sample-end "1:15" \
 *     --sample-date 2026-09-01 \
 *     --release-date 2026-09-15 \
 *     --cover-file nono-newtrack.png \
 *     --audio-file nono-newtrack.mp3 \
 *     --youtube "https://youtu.be/XXX"  [省略可]
 *     --lyrics-file "./newtrack.txt"    [省略可・txtから読み込み]
 *     --lyrics-preview "..."            [省略可・lyricsの先頭が使われる]
 *     --is-new                          [省略可・"NEW"バッジ]
 *     --dry-run                         [省略可・ファイルに書き込まず差分表示のみ]
 *
 * やること:
 *   1. tamsic-content.js の tracks 配列に追加
 *   2. tamsic-content.js の news 配列に sample/release 2件のニュースを追加
 *   3. release-control.js の config.tracks に { sample, release } を追加
 *
 * やらないこと:
 *   - MP3 ファイルの Vault への配置 (手動で vault repo に)
 *   - カバー画像の配置 (手動で assets/images/{artist}/ に)
 *   - git add/commit/push (手動)
 */

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────
// 引数パース
// ──────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true; // flag
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function die(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

const args = parseArgs(process.argv);

// ──────────────────────────────────────────
// 引数バリデーション
// ──────────────────────────────────────────
const required = ['artist', 'id', 'title', 'title-en', 'price',
                  'sample-start', 'sample-end', 'sample-date', 'release-date',
                  'cover-file', 'audio-file'];
for (const k of required) {
  if (!args[k]) die(`--${k} は必須です`);
}

const artist = args.artist;
if (!['nono', 'kiki'].includes(artist) && args['allow-new-artist'] !== true) {
  die(`--artist は nono か kiki。新アーティストなら先に add-artist.js で登録してから --allow-new-artist を付けて実行。`);
}

const id = args.id;
if (!/^[a-z0-9-]+$/.test(id)) die(`--id は英数字とハイフンのみ: 受信値="${id}"`);

const price = parseInt(args.price, 10);
if (!Number.isFinite(price) || price <= 0) die(`--price は正の整数: 受信値="${args.price}"`);

function checkDate(key, val) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) die(`--${key} は YYYY-MM-DD 形式: 受信値="${val}"`);
  const d = new Date(val + 'T00:00:00Z');
  if (isNaN(d.getTime())) die(`--${key} が無効な日付: "${val}"`);
  return val;
}
const sampleDate = checkDate('sample-date', args['sample-date']);
const releaseDate = checkDate('release-date', args['release-date']);
if (new Date(releaseDate) < new Date(sampleDate)) {
  die(`--release-date (${releaseDate}) は --sample-date (${sampleDate}) 以降にしてください`);
}

function checkTime(key, val) {
  if (!/^\d+:\d{2}$/.test(val)) die(`--${key} は mm:ss 形式: 受信値="${val}"`);
  return val;
}
const sampleStart = checkTime('sample-start', args['sample-start']);
const sampleEnd   = checkTime('sample-end',   args['sample-end']);

// 歌詞
let lyrics = '';
let lyricsPreview = args['lyrics-preview'] || '';
if (args['lyrics-file']) {
  const lp = path.resolve(args['lyrics-file']);
  if (!fs.existsSync(lp)) die(`--lyrics-file が見つからない: ${lp}`);
  lyrics = fs.readFileSync(lp, 'utf8').trim();
  if (!lyricsPreview) {
    // 先頭4行をpreviewに
    lyricsPreview = lyrics.split('\n').slice(0, 4).join('\n');
  }
}

// ──────────────────────────────────────────
// tamsic-content.js を読み込み・編集・書き戻し
// ──────────────────────────────────────────
const ROOT = process.cwd();
const contentPath = path.join(ROOT, 'tamsic-content.js');
const releasePath = path.join(ROOT, 'release-control.js');

if (!fs.existsSync(contentPath)) die(`tamsic-content.js が見つからない: ${contentPath}`);
if (!fs.existsSync(releasePath)) die(`release-control.js が見つからない: ${releasePath}`);

const contentRaw = fs.readFileSync(contentPath, 'utf8');

// 先頭コメント + "window.TAMSIC_CONTENT = " を保持し、JSON部分だけ操作する
const match = contentRaw.match(/^([\s\S]*?window\.TAMSIC_CONTENT\s*=\s*)({[\s\S]*})(\s*;\s*)$/);
if (!match) die('tamsic-content.js の形式が予想と違う（window.TAMSIC_CONTENT = {...}; で終わっていない）');
const [, prefix, jsonBody, suffix] = match;

let data;
try {
  data = JSON.parse(jsonBody);
} catch (e) {
  die('tamsic-content.js の JSON パース失敗: ' + e.message);
}

// 既存の id / title の重複チェック
const existingIds = (data.tracks || []).map(t => t.id);
if (existingIds.includes(id)) die(`id "${id}" はすでに存在します: ${existingIds.join(', ')}`);

const existingTitles = (data.tracks || []).map(t => t.title);
if (existingTitles.includes(args.title) && !args['allow-duplicate-title']) {
  const sameTitle = (data.tracks || []).filter(t => t.title === args.title);
  const artists = sameTitle.map(t => `${t.id}(${t.artist})`).join(', ');
  die(`title "${args.title}" はすでに存在します: ${artists}\n別アーティストで同名曲を追加する場合は --allow-duplicate-title を付けてください。`);
}
// 同一アーティストでの title 重複は --allow-duplicate-title があっても禁止
if (args['allow-duplicate-title']) {
  const sameArtistSameTitle = (data.tracks || []).filter(t => t.title === args.title && t.artist === artist);
  if (sameArtistSameTitle.length > 0) {
    die(`同じアーティスト (${artist}) 内で title "${args.title}" がすでに存在します: ${sameArtistSameTitle.map(t=>t.id).join(', ')}`);
  }
}

// artist が photos にない場合は作る（通常 nono/kiki のみだが念のため）
if (data.photos && !data.photos[artist]) {
  data.photos[artist] = [];
  console.log(`ℹ️  photos.${artist} は空配列で追加しました（必要なら後で画像パスを追加）`);
}

// ── 新しいトラックオブジェクトを作成
const newTrack = {
  id,
  artist,
  order: (data.tracks.filter(t => t.artist === artist).length) + 1,
  title: args.title,
  price,
  isNew: !!args['is-new'],
  sampleStart,
  sampleEnd,
  youtubeUrl: args.youtube || '',
  coverPath: `assets/images/${artist}/${args['cover-file']}`,
  audioPath: `assets/audio/${artist}/${args['audio-file']}`,
  lyrics: lyrics,
  lyricsPreview: lyricsPreview,
  durationSec: 0  // 後で手動更新 or 省略可
};

// titleEn の方針: トラックデータ内に titleEn キーがあれば入れる
// 既存データにtitleEn キーがあるか確認
if (data.tracks.length && 'titleEn' in data.tracks[0]) {
  newTrack.titleEn = args['title-en'];
}

data.tracks.push(newTrack);

// ── ニュース2件を追加
const todayIso = new Date().toISOString();
const sampleDateDisplay = sampleDate.replace(/-/g, '.');
const releaseDateDisplay = releaseDate.replace(/-/g, '.');

data.news = data.news || [];
data.news.push({
  id: `news-${id}-sample`,
  date: sampleDateDisplay,
  title: `${artist}「${args.title}」会員先行視聴スタート`,
  titleEn: `${artist} "${args['title-en']}" — Member Early Access Now Live`,
  tag: 'Release',
  showAfter: sampleDate,
  addedAt: `${sampleDate}T00:00:00+09:00`
});
data.news.push({
  id: `news-${id}-release`,
  date: releaseDateDisplay,
  title: `${artist}「${args.title}」一般公開`,
  titleEn: `${artist} "${args['title-en']}" — Now Available to Everyone`,
  tag: 'Release',
  showAfter: releaseDate,
  addedAt: `${releaseDate}T00:00:00+09:00`
});

// ──────────────────────────────────────────
// release-control.js を更新
// ──────────────────────────────────────────
const releaseRaw = fs.readFileSync(releasePath, 'utf8');

// config.tracks の各エントリは:  "曲名":{sample:"YYYY-MM-DD",release:"YYYY-MM-DD"},
// 既存の行末（}}; の直前）に新行を追加する方針
const newReleaseLine = `"${args.title}":{sample:"${sampleDate}",release:"${releaseDate}"}`;

// 既に同じタイトルがあるか確認
const releaseExistsRe = new RegExp(`"${args.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\s*:\s*\\{\\s*sample\\s*:\\s*"([^"]+)"\\s*,\\s*release\\s*:\\s*"([^"]+)"\\s*\\}`);
const releaseExistsMatch = releaseRaw.match(releaseExistsRe);
let skipReleaseAdd = false;
if (releaseExistsMatch) {
  if (args['allow-duplicate-title']) {
    // 別アーティストで同名曲を追加するケース
    // 日程が一致するなら既存エントリを共有 (release-control は title 単位で state を返すので問題なし)
    const [_full, existingSample, existingRelease] = releaseExistsMatch;
    if (existingSample === sampleDate && existingRelease === releaseDate) {
      console.log(`ℹ️  release-control.js の "${args.title}" エントリは既存 (sample:${existingSample} / release:${existingRelease}) と一致。スキップ。`);
      skipReleaseAdd = true;
    } else {
      die(`release-control.js に "${args.title}" が既にあり (sample:${existingSample} / release:${existingRelease}) ですが、今回指定 (sample:${sampleDate} / release:${releaseDate}) と一致しません。別タイトルにしてください。`);
    }
  } else {
    die(`release-control.js に既に "${args.title}" が存在します`);
  }
}

// config={tracks:{ ... }}; の } を見つけて、その直前に挿入
// tracks オブジェクトの閉じ括弧 }};\n の位置を特定
let newReleaseRaw = releaseRaw;
if (!skipReleaseAdd) {
  const releaseMatch = releaseRaw.match(/(const\s+config\s*=\s*\{\s*tracks\s*:\s*\{)([\s\S]*?)(\}\s*\}\s*;)/);
  if (!releaseMatch) {
    die('release-control.js の config={tracks:{...}}; パターンが見つからない');
  }
  const [whole, head, body, tail] = releaseMatch;

  // body の末尾に改行＋新行を追加（既存の最終エントリの末尾にカンマがあるか確認）
  const trimmedBody = body.replace(/\s*$/, '');
  const needsComma = !trimmedBody.endsWith(',') && trimmedBody.length > 0;
  const newBody = (needsComma ? trimmedBody + ',' : trimmedBody) + '\n' + newReleaseLine + '\n';
  newReleaseRaw = releaseRaw.replace(whole, head + newBody + tail);
}

// ──────────────────────────────────────────
// 書き込み (dry-run なら stdout のみ)
// ──────────────────────────────────────────
function writeContentJs(dataObj) {
  // JSON.stringify は 2 スペース indent で既存フォーマットに近い
  const newJson = JSON.stringify(dataObj, null, 2);
  return prefix + newJson + suffix;
}

const newContentRaw = writeContentJs(data);

// 書き戻す前に JSON 再パース検証
try {
  JSON.parse(JSON.stringify(data));
} catch (e) {
  die('内部エラー: 構築したデータが JSON として不正: ' + e.message);
}

if (args['dry-run']) {
  console.log('━━━ DRY RUN ━━━');
  console.log(`tracks 追加: ${id} (${artist} / ${args.title})`);
  console.log(`news 追加: news-${id}-sample, news-${id}-release`);
  console.log(`release-control.js 追加: "${args.title}" → sample:${sampleDate} / release:${releaseDate}`);
  console.log('ファイルには書き込みません。--dry-run を外して再実行してください。');
  process.exit(0);
}

// バックアップ
fs.writeFileSync(contentPath + '.bak', contentRaw, 'utf8');
fs.writeFileSync(releasePath + '.bak', releaseRaw, 'utf8');

fs.writeFileSync(contentPath, newContentRaw, 'utf8');
fs.writeFileSync(releasePath, newReleaseRaw, 'utf8');

console.log('✅ 更新完了');
console.log(`  - tamsic-content.js  (+ トラック / + ニュース2件)`);
console.log(`  - release-control.js (+ スケジュール)`);
console.log(`  バックアップ: tamsic-content.js.bak, release-control.js.bak`);
console.log('');
console.log('次にやること:');
console.log(`  1. カバー画像を配置: assets/images/${artist}/${args['cover-file']}`);
console.log(`  2. MP3 を Vault repo に配置: ${artist}/${args['audio-file']}`);
console.log(`     → Vault repo: https://github.com/TAmJump/tamsic-audio-vault`);
console.log(`  3. node scripts/preflight.js で検証`);
console.log(`  4. git add tamsic-content.js release-control.js assets/images/`);
console.log(`  5. git commit -m "add: ${artist}「${args.title}」追加"`);
console.log(`  6. git push`);
