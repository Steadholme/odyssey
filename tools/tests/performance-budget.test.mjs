import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { ROOT, RELEASE } from '../build-public-dist.mjs';
const budgets = JSON.parse(await readFile(new URL('./performance-budgets.json', import.meta.url), 'utf8'));
assert.equal(budgets.release, RELEASE);
const directory = process.env.ODYSSEY_PUBLIC_RELEASE_DIR || path.join(ROOT, 'releases', RELEASE);
const measurements = {};
for (const [name, group] of Object.entries(budgets.groups)) {
  const bodies = await Promise.all(group.files.map(file => readFile(path.join(directory, file))));
  const raw = bodies.reduce((sum, body) => sum + body.length, 0);
  const gzip = bodies.reduce((sum, body) => sum + gzipSync(body).length, 0);
  assert.ok(raw <= group.raw, `${name} raw ${raw} exceeds ${group.raw}`);
  assert.ok(gzip <= group.gzip, `${name} gzip ${gzip} exceeds ${group.gzip}`);
  measurements[name] = { raw, gzip, headroomRaw: group.raw - raw };
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  await page.goto(process.env.ODYSSEY_BASE_URL || 'http://127.0.0.1:18771');
  const timings = await page.evaluate(({ controls, samples }) => {
    const first = [], repeat = [];
    for (let sample = 0; sample < samples; sample++) {
      const root = document.createElement('section');
      root.innerHTML = Array.from({ length: controls / 4 }, (_, index) => `<div data-ody-tabs><div role="tablist" aria-label="Sample ${sample}-${index}"><button class="ody-tab" role="tab" data-ody-panel="#budget-${sample}-${index}-a">Overview</button><button class="ody-tab" role="tab" data-ody-panel="#budget-${sample}-${index}-b">Details</button></div><div id="budget-${sample}-${index}-a" role="tabpanel">Overview</div><div id="budget-${sample}-${index}-b" role="tabpanel" hidden>Details</div><input class="ody-input" aria-label="Name ${index}"><input type="checkbox" aria-label="Select ${index}"></div>`).join('');
      document.body.append(root);
      let start = performance.now(); window.Odyssey.init(root); first.push(performance.now() - start);
      start = performance.now(); window.Odyssey.init(root); repeat.push(performance.now() - start);
      root.remove();
    }
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return { firstMedianMs: median(first), repeatMedianMs: median(repeat), first, repeat, controls };
  }, budgets.initialization);
  assert.ok(timings.firstMedianMs <= budgets.initialization.firstMedianMs, JSON.stringify(timings));
  assert.ok(timings.repeatMedianMs <= budgets.initialization.repeatMedianMs, JSON.stringify(timings));
  console.log('PASS real release bytes (gzip per HTTP asset):', JSON.stringify(measurements));
  console.log('PASS actual 100-control dynamic init/re-init:', JSON.stringify(timings));
} finally { await browser.close(); }
