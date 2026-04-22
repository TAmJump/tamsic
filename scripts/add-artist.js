#!/usr/bin/env node
/**
 * scripts/add-artist.js
 *
 * TAMSIC に新アーティストを追加するスクリプト。
 * 既存の nono.html をテンプレとして複製し、色・フォント・ID を一括置換する。
 *
 * 使い方:
 *   node scripts/add-artist.js \
 *     --id ichi \
 *     --display-name "ichi" \
 *     --accent-color "#6B4E71" \
 *     --heading-font "Cormorant Garamond" \
 *     --body-font "Inter" \
 *     --base nono  [省略可・nono/kikiどちらをテンプレにするか・既定nono]
 *     --dry-run
 *
 * やること:
 *   1. {base}.html を {id}.html にコピー
 *   2. CSS 変数（--accent / --bg / --light / --mid）を新カラーで上書き
 *   3. Google Fonts URL を新フォントに差し替え
 *   4. ARTIST_ID を置換
 *   5. <title> / ナビ表示 / data-ja 等のアーティスト名を置換
 *   6. tamsic-content.js の photos に新アーティストキーを追加
 *   7. assets/images/{id}/ assets/audio/{id}/ ディレクトリ作成（.gitkeep 配置）
 *   8. index.html のアーティスト一覧に追加（artist-card 構造がある場合）
 *
 * やらないこと:
 *   - 曲データの追加（add-track.js で --allow-new-artist 付きで実行）
 *   - ナビリンクの他ページへの追加（index/about/news 等で手動）
 *   - 画像・音源ファイルの配置（手動）
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    }
  }
  return args;
}
function die(msg) { console.error('❌ ' + msg); process.exit(1); }

const args = parseArgs(process.argv);
const required = ['id', 'display-name', 'accent-color'];
for (const k of required) if (!args[k]) die(`--${k} は必須です`);

const id = args.id;
if (!/^[a-z0-9-]+$/.test(id)) die(`--id は英数字とハイフンのみ: "${id}"`);
if (['nono', 'kiki'].includes(id)) die(`--id "${id}" はすでに存在するアーティストです`);

const displayName = args['display-name'];
const accentColor = args['accent-color'];
if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) die(`--accent-color は #RRGGBB 形式: "${accentColor}"`);

const base = args.base || 'nono';
if (!['nono', 'kiki'].includes(base)) die(`--base は nono か kiki: "${base}"`);

const headingFont = args['heading-font'] || (base === 'kiki' ? 'Bodoni Moda' : 'Syncopate');
const bodyFont    = args['body-font']    || (base === 'kiki' ? 'Nunito'      : 'DM Sans');

const ROOT = process.cwd();
const baseHtmlPath = path.join(ROOT, `${base}.html`);
const destHtmlPath = path.join(ROOT, `${id}.html`);
const contentPath  = path.join(ROOT, 'tamsic-content.js');
const indexPath    = path.join(ROOT, 'index.html');

if (!fs.existsSync(baseHtmlPath)) die(`${base}.html が見つからない: ${baseHtmlPath}`);
if (fs.existsSync(destHtmlPath) && !args['force']) die(`${id}.html は既に存在します（上書きするなら --force）`);

// ──────────────────────────────────────────
// カラー計算: accent から薄い版/濃い版を生成
// ──────────────────────────────────────────
function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return { r: parseInt(v.slice(0,2),16), g: parseInt(v.slice(2,4),16), b: parseInt(v.slice(4,6),16) };
}
function rgbToHex({r,g,b}) {
  const h = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function mix(c1, c2, t) {
  return { r: c1.r*(1-t)+c2.r*t, g: c1.g*(1-t)+c2.g*t, b: c1.b*(1-t)+c2.b*t };
}
const accentRgb = hexToRgb(accentColor);
const whiteRgb = { r:255, g:255, b:255 };
const blackRgb = { r:0, g:0, b:0 };

// base.html の CSS 変数パターン
// nono: --bg:#EEF3F9;--text:#0B1D35;--accent:#0099CC;--light:#D4E2F0;--mid:#5B7FA0;--white:#FFFFFF;
// kiki: --bg:#FDF8F4;--text:#221418;--accent:#C85A72;--accent2:#E8A0B0;--light:#EEE0D8;--mid:#9A7068;--white:#FFFFFF;--soft:#F7EEE8;
const generatedBg    = rgbToHex(mix(accentRgb, whiteRgb, 0.93));
const generatedText  = rgbToHex(mix(accentRgb, blackRgb, 0.82));
const generatedLight = rgbToHex(mix(accentRgb, whiteRgb, 0.78));
const generatedMid   = rgbToHex(mix(accentRgb, blackRgb, 0.45));

// ──────────────────────────────────────────
// base HTML 読み込み + 置換
// ──────────────────────────────────────────
let html = fs.readFileSync(baseHtmlPath, 'utf8');

// カラー変数ブロックを丸ごと置換（:root{...}の最初の出現のみ、accent定義を含むもの）
function replaceRootVars(html) {
  const pattern = /:root\s*\{[^}]*--accent:[^}]*\}/;
  const newBlock = `:root{--bg:${generatedBg};--text:${generatedText};--accent:${accentColor};--light:${generatedLight};--mid:${generatedMid};--white:#FFFFFF;}`;
  if (!pattern.test(html)) {
    console.warn('⚠️  :root の CSS 変数ブロックが見つからず、置換をスキップ');
    return html;
  }
  return html.replace(pattern, newBlock);
}
html = replaceRootVars(html);

// Google Fonts URL の書き換え
// 例: family=Syncopate:wght@400;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300
function replaceFontsUrl(html) {
  return html.replace(
    /https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g,
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont).replace(/%20/g, '+')}:wght@400;700&family=${encodeURIComponent(bodyFont).replace(/%20/g, '+')}:wght@300;400;500&display=swap`
  );
}
html = replaceFontsUrl(html);

// フォントファミリの参照（body や .tb-title, .nav-back など）
// nono.html 想定: body{font-family:'DM Sans',sans-serif;...}
//                 .tb-title{font-family:'Syncopate',sans-serif;...}
html = html.replace(/font-family:\s*'(DM Sans|Nunito)'/g, `font-family:'${bodyFont}'`);
html = html.replace(/font-family:\s*'(Syncopate|Bodoni Moda)'/g, `font-family:'${headingFont}'`);

// ARTIST_ID 的な変数
html = html.replace(/const\s+ARTIST_ID\s*=\s*['"]\w+['"]/g, `const ARTIST_ID = '${id}'`);

// tracks フィルタ: "t => t.artist === 'nono'" や 'kiki' を id に
const baseArtistRegex = new RegExp(`t\\.artist\\s*===\\s*['"]${base}['"]`, 'g');
html = html.replace(baseArtistRegex, `t.artist === '${id}'`);

// ヒーロー画像・ギャラリー参照
// assets/images/nono/ → assets/images/{id}/
const basePathRegex = new RegExp(`assets/images/${base}/`, 'g');
html = html.replace(basePathRegex, `assets/images/${id}/`);
const baseAudioRegex = new RegExp(`assets/audio/${base}/`, 'g');
html = html.replace(baseAudioRegex, `assets/audio/${id}/`);

// <title> とナビのアーティスト名
// nono の場合 title は "no-no | TAMSIC"
html = html.replace(/<title>[^<]*<\/title>/, `<title>${displayName} | TAMSIC</title>`);

// リダイレクト先のファイル名 "nono.html" を "{id}.html" に
const baseFileRegex = new RegExp(`\\b${base}\\.html\\b`, 'g');
html = html.replace(baseFileRegex, `${id}.html`);

// href/リンクに含まれる base アーティスト名は base ページへのリンクとして残したい
// ただし "href=\"nono.html\"" はナビリンクなので新アーティスト自身では自分自身にならない

// 表示文字列の置換 (no-no → displayName / kiki → displayName)
// やりすぎると事故るので、限定的にタイトル直下の artist label のみ
// <div class="...artist">no-no</div> 的な文字列を displayName に
const displayRegex = new RegExp(`>${base === 'nono' ? 'no-no' : 'kiki'}<`, 'g');
html = html.replace(displayRegex, `>${displayName}<`);

// ──────────────────────────────────────────
// 書き込み
// ──────────────────────────────────────────
if (args['dry-run']) {
  console.log('━━━ DRY RUN ━━━');
  console.log(`- ${id}.html を ${base}.html から生成`);
  console.log(`- アクセントカラー: ${accentColor}`);
  console.log(`  - bg:   ${generatedBg}`);
  console.log(`  - text: ${generatedText}`);
  console.log(`  - light:${generatedLight}`);
  console.log(`  - mid:  ${generatedMid}`);
  console.log(`- フォント見出し: ${headingFont}`);
  console.log(`- フォント本文:   ${bodyFont}`);
  console.log(`- ARTIST_ID: ${id}`);
  console.log(`- 表示名: ${displayName}`);
  console.log('');
  console.log('ファイル長(変換前/後):', fs.readFileSync(baseHtmlPath,'utf8').length, '/', html.length);
  process.exit(0);
}

fs.writeFileSync(destHtmlPath, html, 'utf8');

// assets ディレクトリ作成
const imgDir = path.join(ROOT, 'assets', 'images', id);
const audioDir = path.join(ROOT, 'assets', 'audio', id);
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });
fs.writeFileSync(path.join(imgDir, '.gitkeep'), '');
fs.writeFileSync(path.join(audioDir, '.gitkeep'), '');

// tamsic-content.js の photos に追加
if (fs.existsSync(contentPath)) {
  const contentRaw = fs.readFileSync(contentPath, 'utf8');
  const match = contentRaw.match(/^([\s\S]*?window\.TAMSIC_CONTENT\s*=\s*)({[\s\S]*})(\s*;\s*)$/);
  if (match) {
    try {
      const data = JSON.parse(match[2]);
      if (data.photos && !data.photos[id]) {
        data.photos[id] = [];
        fs.writeFileSync(contentPath + '.bak', contentRaw, 'utf8');
        fs.writeFileSync(contentPath, match[1] + JSON.stringify(data, null, 2) + match[3], 'utf8');
        console.log(`✅ tamsic-content.js: photos.${id} を追加`);
      }
    } catch (e) {
      console.warn(`⚠️  tamsic-content.js の photos 更新失敗: ${e.message}`);
    }
  }
}

// index.html にアーティストカード追加（artist-card 構造がある場合）
if (fs.existsSync(indexPath)) {
  const indexRaw = fs.readFileSync(indexPath, 'utf8');
  if (indexRaw.includes('artist-card') && !indexRaw.includes(`href="${id}.html"`)) {
    console.log(`ℹ️  index.html にアーティストカードが存在するパターンを検出。`);
    console.log(`   手動で追加することを推奨: <a href="${id}.html">${displayName}</a>`);
  }
}

console.log('');
console.log('✅ 生成完了');
console.log(`  ${id}.html`);
console.log(`  assets/images/${id}/  (.gitkeep)`);
console.log(`  assets/audio/${id}/   (.gitkeep)`);
console.log('');
console.log('次にやること:');
console.log(`  1. ${id}.html をブラウザで開いてデザインを確認`);
console.log(`  2. カバー画像・ギャラリー画像を assets/images/${id}/ に配置`);
console.log(`     (特にヒーロー画像 ${id}_official_top.png は必須)`);
console.log(`  3. index.html / about.html / news.html のナビに ${id}.html リンクを追加`);
console.log(`  4. 曲を追加: node scripts/add-track.js --artist ${id} --allow-new-artist ...`);
console.log(`  5. node scripts/preflight.js で検証`);
console.log(`  6. git add . && git commit && git push`);
