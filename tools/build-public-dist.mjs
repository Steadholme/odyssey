#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASE = '1.4.0';
export const SOURCE_FILES = {
  'odyssey.css': 'dist/odyssey.css',
  'odyssey.js': 'dist/odyssey.js',
  'odyssey-font.css': 'dist/odyssey-font.css',
  'odyssey-line.css': 'css/line.css',
  'odyssey-line-font.css': 'css/line-font.css',
  'odyssey-expressions.css': 'css/expressions.css',
  'odyssey-extensions.css': 'css/extensions.css',
  'odyssey-extensions.js': 'js/extensions.js',
  'compositions.css': 'css/compositions.css',
  'compositions.js': 'js/compositions.js',
  'capabilities.json': 'library/capabilities.json',
  'capabilities.schema.json': 'library/capabilities.schema.json',
  'contracts.json': 'library/contracts.json',
  'tokens.json': 'design/tokens.json',
  'design-map.json': 'design/design-map.json',
  'Archivo-OFL.txt': 'css/fonts/Archivo-OFL.txt',
  'AzeretMono-OFL.txt': 'css/fonts/AzeretMono-OFL.txt',
};

function identity(text, file) {
  if (file === 'odyssey.css') {
    if (!/Version : v[^\r\n]+/.test(text)) throw new Error('public CSS release identity missing');
    return text.replace(/Version : v[^\r\n]+/, `Version : v${RELEASE}`);
  }
  if (file === 'odyssey.js') {
    if (!/var VERSION = '[^']+';/.test(text)) throw new Error('public JS release identity missing');
    return text.replace(/Odyssey UI JS · v[^\r\n]+/, `Odyssey UI JS · v${RELEASE}`)
      .replace(/var VERSION = '[^']+';/, `var VERSION = '${RELEASE}';`)
      .replace(/var RELEASE = '[^']+';/, `var RELEASE = '${RELEASE}';`);
  }
  return text;
}

export async function buildAssets(root = ROOT) {
  const assets = new Map();
  for (const [file, source] of Object.entries(SOURCE_FILES)) assets.set(file, identity(await readFile(path.join(root, source), 'utf8'), file));
  const combine = files => files.map(file => `/* === ${file} === */\n${assets.get(file)}`).join('\n');
  assets.set('odyssey-complete.css', combine(['odyssey.css', 'odyssey-font.css', 'odyssey-line-font.css', 'odyssey-line.css', 'odyssey-expressions.css', 'odyssey-extensions.css', 'compositions.css']));
  assets.set('odyssey-complete.js', combine(['odyssey.js', 'odyssey-extensions.js', 'compositions.js']));
  const cargo = await readFile(path.join(root, 'Cargo.toml'), 'utf8');
  const distribution = await readFile(path.join(root, 'distribution.toml'), 'utf8');
  assets.set('release.json', JSON.stringify({
    schema: 'odyssey.public-release.v1', release: RELEASE, baseUrl: `/${RELEASE}/`,
    identities: { cargo: cargo.match(/^version\s*=\s*"([^"]+)"/m)[1], internalRust: distribution.match(/^release\s*=\s*"([^"]+)"/m)[1], publicAssets: RELEASE, design: 'line', shellContract: '1.3' },
    runtimeBoundary: { public: 'network-free', internalOnly: ['Wire', 'Spark', 'Motion'], compositions: 'host-owned state, persistence and transport' },
    promotion: { approval: 'manual after this candidate passes tools/verify.sh', inheritsCanaryEvidence: false },
    files: [...assets].map(([file, body]) => ({ path: file, url: `/${RELEASE}/${file}`, bytes: Buffer.byteLength(body), source: SOURCE_FILES[file] || 'generated composition' })),
  }, null, 2) + '\n');
  return assets;
}

export async function checkRelease(directory, assets) {
  const actual = (await readdir(directory)).sort();
  const expected = [...assets.keys()].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('release file inventory differs from canonical sources');
  for (const [file, body] of assets) if (await readFile(path.join(directory, file), 'utf8') !== body) throw new Error(`immutable release differs: ${file}; publish a new version instead of overwriting`);
}

async function writeAssets(directory, assets) {
  await mkdir(directory, { recursive: true });
  for (const [file, body] of assets) await writeFile(path.join(directory, file), body, { flag: 'wx' });
}

export async function freezeRelease(snapshot, assets) {
  try { await checkRelease(snapshot, assets); return false; }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { await readdir(snapshot); throw new Error('existing release is incomplete; refusing replacement'); }
    catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
    const stage = await mkdtemp(path.join(path.dirname(snapshot), `.${path.basename(snapshot)}-`));
    try { await writeAssets(stage, assets); await rename(stage, snapshot); }
    finally { await rm(stage, { recursive: true, force: true }); }
    return true;
  }
}

async function main() {
  const args = process.argv.slice(2), assets = await buildAssets(), snapshot = path.join(ROOT, 'releases', RELEASE);
  if (args.length === 0 || (args.length === 1 && args[0] === '--check')) {
    const target = process.env.ODYSSEY_PUBLIC_RELEASE_DIR || snapshot;
    await checkRelease(target, assets);
    console.log(`PASS: ${RELEASE} ${process.env.ODYSSEY_PUBLIC_RELEASE_DIR ? 'candidate' : 'immutable release'} matches ${assets.size} canonical assets`);
  } else if (args.length === 2 && args[0] === '--output') {
    await writeAssets(path.resolve(args[1]), assets);
    console.log(`Prepared ${RELEASE} candidate at ${path.resolve(args[1])}; not frozen or promoted`);
  } else if (args.length === 1 && args[0] === '--freeze') {
    const created = await freezeRelease(snapshot, assets);
    console.log(created ? `Frozen ${RELEASE}: ${assets.size} files. Promotion still requires this candidate's verification.` : `${RELEASE} already frozen and unchanged`);
  } else throw new Error('usage: tools/build-public-dist.sh [--check | --output <empty-directory> | --freeze]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
