import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const base = (process.env.ODYSSEY_BASE_URL || 'http://127.0.0.1:18300').replace(/\/$/, '');
const release = (process.env.ODYSSEY_RELEASE || '/1.4.0').replace(/\/$/, '');
const engines = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map(value => value.trim());
assert.ok(engines.length && engines.every(name => ['chromium', 'firefox', 'webkit'].includes(name)), 'BROWSERS must contain chromium, firefox and/or webkit');
const evidence = process.env.ODYSSEY_SCREENSHOTS;
if (evidence) await mkdir(evidence, { recursive: true });

function fixture(entry) {
  const styles = entry === 'complete' ? ['odyssey-complete.css'] : [
    'odyssey-font.css', 'odyssey.css', 'odyssey-line-font.css', 'odyssey-line.css',
    'odyssey-expressions.css', 'odyssey-extensions.css',
  ];
  const scripts = entry === 'complete' ? ['odyssey-complete.js'] : ['odyssey.js', 'odyssey-extensions.js'];
  return `<!doctype html>
<html lang="en" data-ody-design="line" data-theme="light"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Odyssey ${entry} compatibility fixture</title>
${styles.map(file => `<link rel="stylesheet" href="${release}/${file}">`).join('\n')}
${scripts.map(file => `<script defer src="${release}/${file}"></script>`).join('\n')}
<style>main{max-width:44rem;margin:auto;padding:16px}section{margin-block:24px}h1{font-size:24px}label{display:block}main>section{min-width:0}.fixture-actions{display:flex;flex-wrap:wrap;gap:8px}</style>
</head><body class="ody-scope"><main><h1>Odyssey compatibility</h1>
<section aria-label="Appearance"><label>Expression<select class="ody-select" data-ody-expression-select><option value="line">Line</option><option value="soft">Soft</option><option value="studio">Studio</option><option value="signal">Signal</option></select></label><button class="ody-btn ody-btn--secondary" data-ody-theme-toggle>Toggle theme</button></section>
<section data-ody-tabs><div class="ody-tabs" role="tablist" aria-label="Documentation"><button class="ody-tab is-active" id="tab-overview" role="tab" data-ody-panel="#panel-overview">Overview</button><button class="ody-tab" id="tab-api" role="tab" data-ody-panel="#panel-api">API</button></div><div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">Native HTML, pinned assets.</div><div id="panel-api" role="tabpanel" aria-labelledby="tab-api" hidden>Public API.</div></section>
<section aria-label="Inputs"><label>Email<input class="ody-input" id="email" type="email" required></label><label>Plan<select class="ody-select" id="plan"><option value="team">Team</option><option value="personal">Personal</option></select></label><label class="ody-checkbox"><input id="updates" type="checkbox">Product updates</label><button class="ody-btn" disabled>Unavailable</button></section>
<section class="fixture-actions" aria-label="Layers"><button class="ody-btn ody-btn--primary" id="modal-open" data-ody-open="#modal">Open modal</button><button class="ody-btn ody-btn--secondary" id="popover-open" popovertarget="popover">Environment</button></section>
<div class="ody-modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden><div class="ody-modal__backdrop" data-ody-dismiss></div><section class="ody-modal__panel"><header class="ody-modal__head"><h2 id="modal-title">Confirm change</h2></header><div class="ody-modal__body"><label>Reason<input class="ody-input" id="reason"></label></div><footer class="ody-modal__foot"><button class="ody-btn ody-btn--secondary" data-ody-dismiss>Cancel</button><button class="ody-btn ody-btn--primary" data-ody-dismiss>Confirm</button></footer></section></div>
<div class="ody-ext-popover" id="popover" popover="auto" data-ody-native-popover><strong>Production</strong><p>Native popover, Escape to close.</p><button class="ody-btn ody-btn--secondary" popovertarget="popover" popovertargetaction="hide">Done</button></div>
<section><fieldset class="ody-ext-code" data-ody-code-input><legend>Verification code</legend><div>${Array.from({ length: 6 }, (_, index) => `<input inputmode="numeric" pattern="[0-9]*" aria-label="Digit ${index + 1}">`).join('')}</div><small data-ody-code-help>Enter six digits.</small></fieldset></section>
<section><details class="ody-ext-disclosure" id="disclosure"><summary>Native disclosure</summary><p>Content stays available without size interpolation.</p></details></section>
</main></body></html>`;
}

async function fitsViewport(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport && dimensions.body <= dimensions.viewport, JSON.stringify(dimensions));
}

async function verifyEntry(browser, name, entry) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, colorScheme: 'light' });
  const errors = [];
  const requests = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on('request', request => {
    if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(base).origin) requests.push(`${request.method()} ${request.url()}`);
  });
  // Only the host document is a fixture: every stylesheet, script and font is
  // fetched from the candidate release through each browser's network stack.
  await page.route(`${base}/__odyssey-compatibility`, route => route.fulfill({ contentType: 'text/html', body: fixture(entry) }));
  try {
    await page.goto(`${base}/__odyssey-compatibility`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => typeof window.Odyssey?.init), 'function');
    assert.equal(await page.evaluate(() => window.Odyssey.version), '1.4.0', 'the browser must consume this public release, not a cached core');
    assert.equal(await page.evaluate(() => typeof window.OdysseyExtensions?.init), 'function');
    assert.equal(await page.locator('html').getAttribute('data-expression'), 'line');
    await fitsViewport(page);

    await page.locator('#tab-overview').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-api').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#panel-api').isVisible(), true);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
    await page.locator('#email').fill('ellis@studio.co');
    assert.equal(await page.locator('#email').evaluate(node => node.checkValidity()), true);
    await page.locator('#plan').selectOption('personal');
    await page.locator('#updates').check();
    assert.equal(await page.locator('#updates').isChecked(), true);

    await page.locator('#modal-open').click();
    assert.equal(await page.locator('#modal').isVisible(), true);
    assert.equal(await page.locator('#modal').evaluate(node => node.contains(document.activeElement)), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#modal').evaluate(node => node.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    await page.locator('#modal').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#modal-open').evaluate(node => node === document.activeElement), true);

    assert.equal(await page.evaluate(() => 'showPopover' in HTMLElement.prototype), true, `${name}: native popover support is required`);
    await page.locator('#popover-open').click();
    assert.equal(await page.locator('#popover').evaluate(node => node.matches(':popover-open')), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#popover').evaluate(node => node.matches(':popover-open')), false);

    await page.locator('[data-ody-code-input] input').first().fill('482931');
    assert.deepEqual(await page.locator('[data-ody-code-input] input').evaluateAll(nodes => nodes.map(node => node.value)), ['4', '8', '2', '9', '3', '1']);
    assert.match(await page.locator('[data-ody-code-help]').textContent(), /complete/i);
    await page.locator('#disclosure summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#disclosure').evaluate(node => node.open), true);
    assert.equal(await page.locator('#disclosure p').isVisible(), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#disclosure').evaluate(node => node.open), false);

    for (const expression of ['line', 'soft', 'studio', 'signal']) {
      await page.locator('[data-ody-expression-select]').selectOption(expression);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => window.Odyssey.setTheme(value), theme);
        assert.equal(await page.locator('html').getAttribute('data-expression'), expression);
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.locator('#email').inputValue(), 'ellis@studio.co');
        assert.equal(await page.locator('#plan').inputValue(), 'personal');
        await fitsViewport(page);
      }
    }

    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-ody-expression-select]').selectOption('line');
    await page.evaluate(() => window.Odyssey.setTheme('light'));
    await fitsViewport(page);
    await page.locator('#popover-open').click();
    const popover = await page.locator('#popover').evaluate(node => {
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
      return { open: node.matches(':popover-open'), duration: style.transitionDuration, transform: style.transform, identityTransform: style.transform === 'none' || new DOMMatrix(style.transform).isIdentity, left: bounds.left, right: bounds.right, viewport: innerWidth };
    });
    assert.equal(popover.open, true);
    assert.ok(popover.duration.split(',').every(value => parseFloat(value) === 0), JSON.stringify(popover));
    assert.equal(popover.identityTransform, true, JSON.stringify(popover));
    assert.ok(popover.left >= 0 && popover.right <= popover.viewport, JSON.stringify(popover));
    await page.keyboard.press('Escape');
    await page.locator('#disclosure summary').click();
    assert.equal(await page.locator('#disclosure p').isVisible(), true);
    if (evidence) await page.screenshot({ path: `${evidence}/${name}-${entry}-320.png`, fullPage: true, animations: 'disabled' });
    const enhancements = await page.evaluate(() => ({
      detailsContent: CSS.supports('selector(::details-content)'),
      interpolateSize: CSS.supports('interpolate-size', 'allow-keywords'),
      discreteTransitions: CSS.supports('transition-behavior', 'allow-discrete'),
    }));
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], 'public release must not make cross-origin or write requests');
    console.log(`PASS ${name} ${entry}: tabs, modal/focus/Escape, native inputs, popover, OTP, disclosure, 4 expressions × 2 themes, reduced motion, 320px; enhancements=${JSON.stringify(enhancements)}`);
  } finally {
    await context.close();
  }
}

const failures = [];
for (const name of engines) {
  let browser;
  try {
    browser = await playwright[name].launch({ headless: true });
    console.log(`ENGINE ${name} ${browser.version()}`);
    for (const entry of ['modular', 'complete']) {
      try {
        await verifyEntry(browser, name, entry);
      } catch (error) {
        failures.push(new Error(`${name}/${entry}: ${error.message}`, { cause: error }));
        console.error(`FAIL ${name}/${entry}: ${error.stack}`);
      }
    }
  } catch (error) {
    failures.push(new Error(`${name}: ${error.message}`, { cause: error }));
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally {
    if (browser) await browser.close();
  }
}
if (failures.length) throw new AggregateError(failures, 'Browser compatibility failed');
console.log(`PASS ${engines.join(',')} against ${base}${release}; modular and complete entry points.`);
