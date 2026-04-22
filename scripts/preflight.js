#!/usr/bin/env node
/**
 * scripts/preflight.js
 *
 * push 前の自動検証スクリプト。
 * 全てのチェックを実行し、1 つでも失敗すれば非ゼロで終了する。
 *
 * 使い方:
 *   node scripts/preflight.js                # 全チェック
 *   node scripts/preflight.js --quiet        # エラーのみ表示
 *   node scripts/preflight.js --strict       # 警告も失敗扱い
 *
 * pre-commit hook としての使い方:
 *   .git/hooks/pre-commit に以下を書く:
 *     #!/bin/sh
 *     node scripts/preflight.js || exit 1
 *
 * チェック項目:
 *   1. tamsic-content.js が JSON としてパース可能か
 *   2. release-control.js が実行可能で config.tracks を公開してるか
 *   3. 曲タイトルが content と release で一致してるか
 *   4. trackの coverPath が実在するファイルか
 *   5. trackの audioPath が実在 or Vault 想定(未公開)か（日付と照合）
 *   6. 重複 id がないか
 *   7. ニュースの showAfter が YYYY-MM-DD 形式か
 *   8. 音源ディレクトリ構造が正しいか
 *   9. Cognito 関連の設定が auth.js 等で一貫してるか
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const QUIET  = args.includes('--quiet');
const STRICT = args.includes('--strict');

const ROOT = process.cwd();

// ──────────────────────────────────────────
// 結果収集
// ──────────────────────────────────────────
const results = { pass:0, warn:0, fail:0, messages:[] };

function ok(msg)   { results.pass++; if (!QUIET) console.log(`✅ ${msg}`); }
function warn(msg) { results.warn++; console.log(`⚠️  ${msg}`); results.messages.push(['WARN', msg]); }
function fail(msg) { results.fail++; console.log(`❌ ${msg}`); results.messages.push(['FAIL', msg]); }

// ──────────────────────────────────────────
// JS ファイルを sandbox で評価してエクスポート収集
// ──────────────────────────────────────────
function evalJsSandbox(filepath) {
  const code = fs.readFileSync(filepath, 'utf8');
  const ctx = {
    window: {},
    document: { addEventListener: () => {}, getElementById: () => null },
    console: { log: () => {}, warn: () => {}, error: () => {} }
  };
  ctx.window.document = ctx.document;
  ctx.window.TAMSICLang = { get: () => 'ja' };
  vm.createContext(ctx);
  try {
    vm.runInContext(code, ctx, { filename: filepath });
    return { ok: true, window: ctx.window };
  } catch (e) {
    return { ok: false, error: e };
  }
}

// ──────────────────────────────────────────
// Check 1: tamsic-content.js の JSON 構文
// ──────────────────────────────────────────
console.log('━━━ Preflight Check ━━━');
console.log('');

let contentData = null;
const contentPath = path.join(ROOT, 'tamsic-content.js');
if (!fs.existsSync(contentPath)) {
  fail('tamsic-content.js が見つからない');
} else {
  const raw = fs.readFileSync(contentPath, 'utf8');
  const match = raw.match(/^([\s\S]*?window\.TAMSIC_CONTENT\s*=\s*)({[\s\S]*})(\s*;\s*)$/);
  if (!match) {
    fail('tamsic-content.js の形式異常 (window.TAMSIC_CONTENT = {...}; パターンが見つからない)');
  } else {
    try {
      contentData = JSON.parse(match[2]);
      ok(`tamsic-content.js: JSON 構文正常 (tracks=${contentData.tracks?.length}, news=${contentData.news?.length})`);
    } catch (e) {
      fail(`tamsic-content.js: JSON パースエラー: ${e.message}`);
    }
  }
}

// ──────────────────────────────────────────
// Check 2: release-control.js が有効か
// ──────────────────────────────────────────
let releaseConfig = null;
const releasePath = path.join(ROOT, 'release-control.js');
if (!fs.existsSync(releasePath)) {
  fail('release-control.js が見つからない');
} else {
  const r = evalJsSandbox(releasePath);
  if (!r.ok) {
    fail(`release-control.js: 実行エラー: ${r.error.message}`);
  } else {
    releaseConfig = r.window.TAMSICRelease && r.window.TAMSICRelease.config;
    if (!releaseConfig || !releaseConfig.tracks) {
      fail('release-control.js: TAMSICRelease.config.tracks が公開されていない');
    } else {
      ok(`release-control.js: 実行OK (${Object.keys(releaseConfig.tracks).length} 曲分のスケジュール)`);
    }
  }
}

// ──────────────────────────────────────────
// Check 3: content と release で曲タイトル一致
// ──────────────────────────────────────────
if (contentData && releaseConfig) {
  const contentTitles = new Set((contentData.tracks||[]).map(t => t.title));
  const releaseTitles = new Set(Object.keys(releaseConfig.tracks));

  const inContentOnly = [...contentTitles].filter(t => !releaseTitles.has(t));
  const inReleaseOnly = [...releaseTitles].filter(t => !contentTitles.has(t));

  if (inContentOnly.length) {
    warn(`release-control.js にスケジュール未定義の曲: ${inContentOnly.join(', ')}`);
  }
  if (inReleaseOnly.length) {
    warn(`tamsic-content.js に存在しないスケジュール: ${inReleaseOnly.join(', ')}`);
  }
  if (!inContentOnly.length && !inReleaseOnly.length) {
    ok('content と release の曲タイトルが完全一致');
  }
}

// ──────────────────────────────────────────
// Check 4: 重複 id
// ──────────────────────────────────────────
if (contentData) {
  const ids = (contentData.tracks||[]).map(t => t.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) fail(`tracks の id 重複: ${[...new Set(dup)].join(', ')}`);
  else ok('tracks の id 重複なし');

  const newsIds = (contentData.news||[]).map(n => n.id);
  const newsDup = newsIds.filter((x, i) => newsIds.indexOf(x) !== i);
  if (newsDup.length) fail(`news の id 重複: ${[...new Set(newsDup)].join(', ')}`);
  else ok('news の id 重複なし');
}

// ──────────────────────────────────────────
// Check 5: coverPath が実在
// ──────────────────────────────────────────
if (contentData) {
  const missing = [];
  (contentData.tracks||[]).forEach(t => {
    if (t.coverPath && !fs.existsSync(path.join(ROOT, t.coverPath))) {
      missing.push(`${t.id}: ${t.coverPath}`);
    }
  });
  if (missing.length) {
    fail(`coverPath が実在しない: ${missing.length} 件`);
    missing.forEach(m => console.log(`   - ${m}`));
  } else {
    ok('全トラックの coverPath が実在');
  }
}

// ──────────────────────────────────────────
// Check 6: audioPath と公開日の整合
// 現在の日付 >= sample 日なら MP3 は本番repoに必要
// 現在の日付 <  sample 日なら MP3 は本番repoに 無い のが正常 (Vault待機)
// ──────────────────────────────────────────
if (contentData && releaseConfig) {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstNow = new Date(Date.now() + jstOffsetMs);
  const todayStr = jstNow.toISOString().slice(0, 10);
  const today = new Date(todayStr + 'T00:00:00Z');

  const shouldHave = [];
  const shouldNotHave = [];

  (contentData.tracks||[]).forEach(t => {
    const sched = releaseConfig.tracks[t.title];
    if (!sched || !sched.sample || !t.audioPath) return;
    const sampleDate = new Date(sched.sample + 'T00:00:00Z');
    const exists = fs.existsSync(path.join(ROOT, t.audioPath));
    if (sampleDate <= today) {
      // 公開期間中 → 本番repoに必要
      if (!exists) shouldHave.push(`${t.id} (${t.title}) : ${t.audioPath} sample日=${sched.sample}`);
    } else {
      // 未公開 → 本番repoに無いのが正常 (Vault で待機)
      if (exists) shouldNotHave.push(`${t.id} (${t.title}) : ${t.audioPath} sample日=${sched.sample}`);
    }
  });

  if (shouldHave.length) {
    fail(`公開日が来ているのに MP3 が無い: ${shouldHave.length} 件 (GitHub Actions の自動配置失敗の可能性)`);
    shouldHave.forEach(m => console.log(`   - ${m}`));
  }
  if (shouldNotHave.length) {
    warn(`未公開なのに MP3 が本番 repo に存在: ${shouldNotHave.length} 件 (事前漏洩リスク)`);
    shouldNotHave.forEach(m => console.log(`   - ${m}`));
  }
  if (!shouldHave.length && !shouldNotHave.length) {
    ok('全曲の公開日と MP3 配置状態が一致');
  }
}

// ──────────────────────────────────────────
// Check 7: ニュースの showAfter 形式
// ──────────────────────────────────────────
if (contentData) {
  const bad = [];
  (contentData.news||[]).forEach(n => {
    if (n.showAfter && !/^\d{4}-\d{2}-\d{2}$/.test(n.showAfter)) {
      bad.push(`${n.id}: "${n.showAfter}"`);
    }
  });
  if (bad.length) fail(`news.showAfter が YYYY-MM-DD 形式でない: ${bad.join(', ')}`);
  else ok('全ニュースの showAfter 形式正常');
}

// ──────────────────────────────────────────
// Check 8: 音源ディレクトリ構造
// ──────────────────────────────────────────
const audioBase = path.join(ROOT, 'assets', 'audio');
if (fs.existsSync(audioBase)) {
  const artists = fs.readdirSync(audioBase).filter(f =>
    fs.statSync(path.join(audioBase, f)).isDirectory()
  );
  ok(`assets/audio/ 配下のアーティスト: ${artists.join(', ')}`);

  // contentData の artist 値との突合
  if (contentData) {
    const contentArtists = new Set((contentData.tracks||[]).map(t => t.artist));
    const missingDirs = [...contentArtists].filter(a => !artists.includes(a));
    if (missingDirs.length) {
      warn(`assets/audio/ に対応ディレクトリがないアーティスト: ${missingDirs.join(', ')}`);
    }
  }
}

// ──────────────────────────────────────────
// Check 9: Cognito 設定値の一貫性
// ──────────────────────────────────────────
const authPath = path.join(ROOT, 'auth.js');
const loginPath = path.join(ROOT, 'login.html');
if (fs.existsSync(authPath) && fs.existsSync(loginPath)) {
  const authRaw = fs.readFileSync(authPath, 'utf8');
  const loginRaw = fs.readFileSync(loginPath, 'utf8');
  const authPoolMatch = authRaw.match(/userPoolId:\s*['"]([^'"]+)/);
  const loginPoolMatch = loginRaw.match(/UserPoolId:\s*['"]([^'"]+)/);
  if (authPoolMatch && loginPoolMatch) {
    if (authPoolMatch[1] === loginPoolMatch[1]) {
      ok(`Cognito UserPoolId 一貫: ${authPoolMatch[1]}`);
    } else {
      fail(`Cognito UserPoolId 不一致: auth.js=${authPoolMatch[1]} / login.html=${loginPoolMatch[1]}`);
    }
  }
}

// ──────────────────────────────────────────
// Check 10: GitHub Actions workflow の存在確認
// ──────────────────────────────────────────
const wfPath = path.join(ROOT, '.github', 'workflows', 'auto-release-audio.yml');
const scriptPath = path.join(ROOT, '.github', 'scripts', 'check-releases.js');
if (fs.existsSync(wfPath) && fs.existsSync(scriptPath)) {
  ok('GitHub Actions (auto-release-audio.yml + check-releases.js) 存在');
} else {
  warn('GitHub Actions のファイルが見つからない。未 push の可能性 (TAMSIC_自動リリース設定手順.md 参照)');
}

// ──────────────────────────────────────────
// サマリ
// ──────────────────────────────────────────
console.log('');
console.log('━━━ Summary ━━━');
console.log(`✅ Pass: ${results.pass}`);
console.log(`⚠️  Warn: ${results.warn}`);
console.log(`❌ Fail: ${results.fail}`);

if (results.fail > 0) {
  console.log('');
  console.log('❌ Preflight FAILED. push しないでください。');
  process.exit(1);
} else if (STRICT && results.warn > 0) {
  console.log('');
  console.log('⚠️  Preflight WARNED in --strict mode.');
  process.exit(2);
} else {
  console.log('');
  console.log('✅ Preflight passed. push OK。');
  process.exit(0);
}
