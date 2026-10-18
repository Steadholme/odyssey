import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildAssets, checkRelease, freezeRelease, SOURCE_FILES, RELEASE } from '../build-public-dist.mjs';

test('public release composes the complete source inventory and locks its identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'odyssey-release-'));
  try {
    for (const [file, source] of Object.entries(SOURCE_FILES)) {
      await mkdir(path.dirname(path.join(root, source)), { recursive: true });
      let body = `/* fixture: ${file} */\n`;
      if (file === 'odyssey.css') body += 'Version : v1.3.0-canary.1\n';
      if (file === 'odyssey.js') body += "Odyssey UI JS · v1.3.0-canary.1\nvar VERSION = '1.3.0-canary.1';\nvar RELEASE = '1.3.0-canary.1';\n";
      await writeFile(path.join(root, source), body);
    }
    await writeFile(path.join(root, 'Cargo.toml'), '[package]\nversion = "0.1.0"\n');
    await writeFile(path.join(root, 'distribution.toml'), 'release = "1.4.0-canary.1"\n');
    const assets = await buildAssets(root);
    assert.match(assets.get('odyssey.css'), /Version : v1\.4\.0/);
    assert.match(assets.get('odyssey.js'), /var VERSION = '1\.4\.0';/);
    assert.match(assets.get('odyssey.js'), /var RELEASE = '1\.4\.0';/);
    for (const file of ['odyssey-line.css', 'odyssey-line-font.css', 'odyssey-expressions.css', 'odyssey-extensions.css', 'compositions.css']) assert.ok(assets.get('odyssey-complete.css').includes(assets.get(file)));
    for (const file of ['odyssey.js', 'odyssey-extensions.js', 'compositions.js']) assert.ok(assets.get('odyssey-complete.js').includes(assets.get(file)));
    const manifest = JSON.parse(assets.get('release.json'));
    assert.deepEqual(manifest.identities, { cargo: '0.1.0', internalRust: '1.4.0-canary.1', publicAssets: RELEASE, design: 'line', shellContract: '1.3' });
    assert.equal(manifest.files.length, assets.size - 1);
    assert.equal(manifest.promotion.inheritsCanaryEvidence, false);
    const release = path.join(root, 'candidate');
    await mkdir(release);
    for (const [file, body] of assets) await writeFile(path.join(release, file), body);
    await checkRelease(release, assets);
    const frozen = path.join(root, 'frozen');
    assert.equal(await freezeRelease(frozen, assets), true);
    assert.equal(await freezeRelease(frozen, assets), false);
    await writeFile(path.join(frozen, 'odyssey.js'), 'immutable content drift');
    await assert.rejects(freezeRelease(frozen, assets), /immutable release differs/);
    assert.equal(await readFile(path.join(frozen, 'odyssey.js'), 'utf8'), 'immutable content drift');
    const incomplete = path.join(root, 'incomplete');
    await mkdir(incomplete);
    await writeFile(path.join(incomplete, 'odyssey.js'), 'incomplete release');
    await assert.rejects(freezeRelease(incomplete, assets), /inventory differs/);
    await writeFile(path.join(release, 'odyssey-line.css'), 'unexpected drift');
    await assert.rejects(checkRelease(release, assets), /immutable release differs: odyssey-line.css/);
    assert.equal(await readFile(path.join(root, 'dist/odyssey.js'), 'utf8'), "/* fixture: odyssey.js */\nOdyssey UI JS · v1.3.0-canary.1\nvar VERSION = '1.3.0-canary.1';\nvar RELEASE = '1.3.0-canary.1';\n");
    await writeFile(path.join(root, 'dist/odyssey.js'), 'missing runtime identity');
    await assert.rejects(buildAssets(root), /JS release identity missing/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
