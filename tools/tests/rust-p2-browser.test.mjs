import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const engines = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',');
assert.ok(engines.every(name => ['chromium', 'firefox', 'webkit'].includes(name)));
const html = execFileSync('cargo', ['run', '--quiet', '--example', 'csp'], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const policy = "default-src 'none'; script-src 'nonce-odyssey-csp-example'; style-src 'nonce-odyssey-csp-example'; style-src-attr 'none'; font-src data:; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";
const hits = [];
const postBodies = [];
const server = createServer((request, response) => {
  hits.push(`${request.method} ${request.url}`);
  if (request.method === 'POST') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => postBodies.push({ path: request.url, body }));
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': policy });
  response.end(request.url === '/next' ? '<section id="wire-content"><p id="wire-state">Loaded through Wire</p></section>' : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const evidence = process.env.ODYSSEY_SCREENSHOTS;
if (evidence) await mkdir(evidence, { recursive: true });
try {
  for (const name of engines) {
    const browser = await playwright[name].launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => {
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI} @ ${event.sourceFile}:${event.lineNumber} ${event.sample}`));
      });
      const response = await page.goto(base);
      assert.equal(response.headers()['content-security-policy'], policy);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('html').getAttribute('data-expression'), 'line');
      assert.equal(await page.locator('[style]').count(), 0, 'shell and sample markup need no style attributes');
      assert.equal(await page.evaluate(() => document.fonts.check('16px Archivo')), true, JSON.stringify({ errors, violations: await page.evaluate(() => window.cspViolations), fonts: await page.evaluate(() => [...document.fonts].map(font => ({ family: font.family, status: font.status }))) }));
      // Firefox preserves CSS quotes in FontFace.family; compare the family name, not its serialization.
      assert.equal(await page.evaluate(() => [...document.fonts].some(font => font.family.replace(/^(['"])(.*)\1$/, '$2') === 'Archivo' && font.status === 'loaded')), true, 'Archivo must already be loaded by the rendered heading');
      assert.equal(await page.locator('.app-tile').evaluate(element => getComputedStyle(element).getPropertyValue('--app')), '#0062ff');
      assert.equal(await page.locator('.btn-primary').first().evaluate(element => getComputedStyle(element).borderRadius !== '0px'), true);
      assert.equal(await page.evaluate(() => typeof window.OdysseySpark?.init), 'function');
      assert.equal(await page.evaluate(() => typeof window.OdysseyWire?.post), 'function');
      assert.equal(await page.evaluate(() => typeof window.OdysseyExtensions?.init), 'function');
      assert.equal(await page.evaluate(() => typeof window.OdysseyMotion?.swap), 'function');
      assert.equal(await page.evaluate(async () => {
        const transition = window.OdysseyMotion.swap(() => { document.querySelector('#wire-state').dataset.motion = 'updated'; });
        await transition.finished;
        return document.querySelector('#wire-state').dataset.motion;
      }), 'updated', 'the Motion update completes under the same policy');
      await page.getByLabel('Digit 1 of 6', { exact: true }).fill('7');
      assert.equal(await page.getByLabel('Digit 2 of 6', { exact: true }).evaluate(element => element === document.activeElement), true, 'extension interaction runs under strict CSP');
      const range = page.locator('#jobs');
      await range.focus();
      await range.press('ArrowRight');
      assert.equal(await range.inputValue(), '4');
      assert.equal(await page.locator('output[for="jobs"]').textContent(), '4');
      await page.evaluate(() => { window.OdysseySpark.init(document); window.OdysseySpark.init(document); });
      await range.press('End');
      assert.equal(await range.inputValue(), '8');
      assert.equal(await page.locator('output[for="jobs"]').textContent(), '8');
      await page.locator('#share').fill('0.3');
      assert.equal(await page.locator('#share').evaluate(element => element.validity.stepMismatch), true);
      await page.locator('#share').fill('0.5');
      assert.equal(await page.locator('#share').evaluate(element => element.checkValidity()), true);
      assert.deepEqual(await page.locator('#settings').evaluate(form => [...new FormData(form)]), [['share', '0.5'], ['parallelism', '8']]);
      const disabledButton = page.locator('#disabled-button');
      assert.equal(await disabledButton.isDisabled(), true);
      await disabledButton.evaluate(element => element.addEventListener('click', () => element.dataset.activated = 'true'));
      const disabledBox = await disabledButton.boundingBox();
      await page.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
      await disabledButton.focus();
      assert.equal(await disabledButton.evaluate(element => element === document.activeElement), false);
      assert.equal(await disabledButton.getAttribute('data-activated'), null);
      for (const id of ['disabled-link', 'busy-link']) {
        const link = page.locator(`#${id}`);
        assert.equal(await link.getAttribute('href'), null);
        assert.equal(await link.getAttribute('role'), 'link');
        assert.equal(await link.getAttribute('aria-disabled'), 'true');
        await link.focus();
        await link.press('Enter');
        const box = await link.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.equal(page.url(), `${base}/`);
      }
      assert.ok(!hits.some(hit => hit.includes('must-not-navigate')));
      await page.locator('#settings').evaluate(form => form.reset());
      await page.waitForFunction(() => document.querySelector('output[for="jobs"]').value === '3');
      assert.equal(await range.inputValue(), '3');
      await page.locator('#enabled-link').click();
      assert.equal(new URL(page.url()).hash, '#recovery');
      assert.equal(await page.getByRole('link', { name: 'Create workspace', exact: true }).getAttribute('href'), '/workspaces/new');
      assert.equal(await page.getByRole('link', { name: 'Clear search', exact: true }).getAttribute('href'), '/workspaces');
      assert.equal(await page.getByRole('button', { name: 'Try again', exact: true }).getAttribute('type'), 'submit');
      await page.locator('#wire-link').click();
      await page.locator('#wire-state').filter({ hasText: 'Loaded through Wire' }).waitFor();
      assert.ok(hits.includes('GET /next'));
      assert.deepEqual(await page.evaluate(() => window.cspViolations), [], 'application CSP before screenshots');
      await page.evaluate(() => window.scrollTo(0, 0));
      // WebKit's Playwright screenshot helper injects its own unnonced style.
      // Capture evidence in Chromium; all engines still exercise and assert the application CSP.
      if (evidence && name === 'chromium') await page.screenshot({ path: `${evidence}/${name}-rust-csp-desktop.png`, fullPage: true, caret: 'initial' });
      await page.setViewportSize({ width: 320, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
      assert.deepEqual(errors, []);
      if (evidence && name === 'chromium') await page.screenshot({ path: `${evidence}/${name}-rust-csp-320.png`, fullPage: true, caret: 'initial' });
      await page.getByRole('link', { name: 'Create workspace', exact: true }).click();
      await page.waitForURL(`${base}/workspaces/new`);
      assert.ok(hits.includes('GET /workspaces/new'));
      await page.getByRole('link', { name: 'Clear search', exact: true }).click();
      await page.waitForURL(`${base}/workspaces`);
      assert.ok(hits.includes('GET /workspaces'));
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.waitForURL(`${base}/workspaces/retry`);
      assert.ok(postBodies.some(request => request.path === '/workspaces/retry' && new URLSearchParams(request.body).get('csrf_token') === 'example-csrf'));
      assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
      assert.deepEqual(errors, []);
      console.log(`${name}: strict CSP styles/fonts/Wire/Spark/extensions/motion; disabled pointer+keyboard; decimal FormData; live Range; 3 recovery states; 320px PASS`);
      await context.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
