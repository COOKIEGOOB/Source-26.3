#!/usr/bin/env node
/**
 * prepare-game.mjs
 *
 * Fetches the 26.3-JM single-file game build from GitHub Releases, verifies its
 * SHA-256, injects the "ultra high performance" preamble and writes the result to
 * dist/index.html, which Tauri embeds into the native application.
 *
 * The 86 MB game asset is intentionally NOT committed to this repository.
 *
 * Env overrides:
 *   GAME_URL        full URL to the game HTML (default: pinned release asset)
 *   GAME_SHA256     expected sha256 of the downloaded HTML (default: game.lock.json)
 *   GAME_LOCAL      path to an already-downloaded HTML (skips the network)
 *   SKIP_SHA_CHECK  "1" to download without verifying (not recommended)
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(ROOT, '.game-cache');
const OUT_DIR = resolve(ROOT, 'dist');
const OUT_FILE = resolve(OUT_DIR, 'index.html');

const lock = JSON.parse(readFileSync(resolve(ROOT, 'game.lock.json'), 'utf8'));

const GAME_URL = process.env.GAME_URL || lock.url;
const EXPECTED_SHA = (process.env.GAME_SHA256 || lock.sha256 || '').trim().toLowerCase();
const CACHE_FILE = resolve(CACHE_DIR, lock.filename);

const log = (...a) => console.log('[prepare-game]', ...a);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

async function download(url) {
  log('downloading', url);
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'source-26-3-desktop/1.0 (+tauri build)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);

  const total = Number(res.headers.get('content-length') || 0);
  const chunks = [];
  let got = 0;
  let nextTick = 0;
  for await (const chunk of res.body) {
    chunks.push(chunk);
    got += chunk.length;
    if (got >= nextTick) {
      log(`  ${mb(got)}${total ? ' / ' + mb(total) : ''}`);
      nextTick = got + 16 * 1048576;
    }
  }
  return Buffer.concat(chunks);
}

async function getGameHtml() {
  if (process.env.GAME_LOCAL) {
    const p = resolve(process.env.GAME_LOCAL);
    log('using local game file', p);
    return readFileSync(p);
  }

  if (existsSync(CACHE_FILE)) {
    const cached = readFileSync(CACHE_FILE);
    const h = sha256(cached);
    if (!EXPECTED_SHA || h === EXPECTED_SHA || process.env.SKIP_SHA_CHECK === '1') {
      log(`cache hit ${CACHE_FILE} (${mb(cached.length)})`);
      return cached;
    }
    log('cache checksum mismatch, re-downloading');
  }

  const buf = await download(GAME_URL);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, buf);
  return buf;
}

function verify(buf) {
  const actual = sha256(buf);
  log('sha256', actual, `(${mb(buf.length)})`);
  if (process.env.SKIP_SHA_CHECK === '1') {
    log('WARNING: checksum verification skipped (SKIP_SHA_CHECK=1)');
    return;
  }
  if (!EXPECTED_SHA) {
    log('WARNING: no expected sha256 pinned in game.lock.json — skipping verification.');
    log('         Pin this value to make builds reproducible:', actual);
    return;
  }
  if (actual !== EXPECTED_SHA) {
    throw new Error(
      `Checksum mismatch for the game asset.\n  expected ${EXPECTED_SHA}\n  actual   ${actual}\n` +
        'Refusing to bundle an unexpected payload. Update game.lock.json if this is intentional.'
    );
  }
  log('checksum OK');
}

const PERF_PREAMBLE = readFileSync(resolve(ROOT, 'scripts/perf-preamble.js'), 'utf8');

function inject(html) {
  // Guard against the preamble accidentally closing its own <script> element.
  const safeJs = PERF_PREAMBLE.replace(/<\/script/gi, '<\\/script');
  const tag = `<script id="jm263-perf-preamble">\n${safeJs}\n</script>\n`;

  // Insert as early as possible so the patches are installed before the game boots.
  const headOpen = html.search(/<head\b[^>]*>/i);
  if (headOpen !== -1) {
    const end = html.indexOf('>', headOpen) + 1;
    return html.slice(0, end) + '\n' + tag + html.slice(end);
  }
  const htmlOpen = html.search(/<html\b[^>]*>/i);
  if (htmlOpen !== -1) {
    const end = html.indexOf('>', htmlOpen) + 1;
    return html.slice(0, end) + '\n' + tag + html.slice(end);
  }
  return tag + html;
}

async function main() {
  const raw = await getGameHtml();
  verify(raw);

  let html = raw.toString('utf8');
  if (html.includes('id="jm263-perf-preamble"')) {
    log('preamble already present, not injecting twice');
  } else {
    html = inject(html);
    log('injected ultra-high-performance preamble');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html, 'utf8');
  log('wrote', OUT_FILE, `(${mb(statSync(OUT_FILE).size)})`);
}

main().catch((err) => {
  console.error('[prepare-game] FAILED:', err.message);
  process.exit(1);
});
