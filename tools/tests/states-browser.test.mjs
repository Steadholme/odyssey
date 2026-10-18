import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const manifest = JSON.parse(await read('library/capabilities.json'));
const matrix = JSON.parse(await read('design/state-matrix.json'));
const mapping = JSON.parse(await read('design/design-map.json'));
const html = await read('site/states.html');
const states = Object.keys(matrix.states);
assert.equal(matrix.release, manifest.release);
assert.equal(matrix.pencil.expandedMatrixNode, mapping.stateMatrix.expandedNodeId);
assert.equal((html.match(/data-state-component=/g) || []).length, manifest.components.length);
for (const component of manifest.components) {
  assert.ok(component.states.every(state => states.includes(state)), component.id);
  assert.ok(html.includes(component.id), component.id + ': state atlas inventory');
}
assert.deepEqual(matrix.geometry.space, [4, 8, 12, 16, 24, 32, 48, 64]);
assert.match(html, /href="\/examples\/compositions\/workspace-settings\.html"/);
assert.doesNotMatch(html, /href="\/examples\/compositions\/README\.md"/);
assert.match(await read('site/actions.html'), /48px/);
assert.doesNotMatch(await read('site/actions.html'), /放大到 46px/);
assert.match(await read('site/layout.html'), /5=24 6=32 7=48 8=64/);
console.log('PASS state inventory: applicable states, exact guide links, shared geometry and design source.');
if (process.env.ODYSSEY_BASE_URL) {
  const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
  const {AxeBuilder} = await import('../browser-runtime/node_modules/@axe-core/playwright/dist/index.mjs');
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ODYSSEY_BASE_URL + '/states.html');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('[data-state-component]').count(), manifest.components.length, 'the running page must use the current inventory');
    for (const expression of matrix.themes.expression) for (const mode of matrix.themes.mode) {
      await page.locator('[data-ody-expression-select]').selectOption(expression);
      if (await page.locator('html').getAttribute('data-theme') !== mode) await page.locator('[data-ody-theme-toggle]').click();
      await page.locator('#states-density').selectOption('comfortable');
      const sizes = await page.locator('#state-small,#state-default,#state-large').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      assert.deepEqual(sizes, [32, {line:40,soft:44,studio:44,signal:34}[expression], 48], expression + '/' + mode);
      await page.locator('#states-density').selectOption('compact');
      assert.equal(await page.locator('#state-default').evaluate(node => node.getBoundingClientRect().height), 32);
      // Theme colors transition; audit the settled state, not an intermediate blend.
      await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished)));
      const axe = await new AxeBuilder({page}).analyze();
      assert.deepEqual(axe.violations.map(v => ({id:v.id,nodes:v.nodes.map(n => n.target)})), [], expression + '/' + mode);
    }
    await page.locator('[data-ody-expression-select]').selectOption('line');
    await page.locator('#states-density').selectOption('comfortable');
    if (await page.locator('html').getAttribute('data-theme') !== 'light') await page.locator('[data-ody-theme-toggle]').click();
    await page.locator('#states-density').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'states-action');
    assert.deepEqual(await page.locator('#states-action').evaluate(node => {const c=getComputedStyle(node);return [c.outlineWidth,c.outlineOffset];}), ['2px','0px']);
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#states-feedback').innerText(), /Changes applied/);
    await page.locator('#state-empty').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'state-readonly');
    assert.equal(await page.locator('#state-readonly').evaluate(node => node.readOnly), true);
    await page.locator('[data-ody-open="#states-modal"]').click();
    assert.equal(await page.locator('#states-modal').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#states-modal').isVisible(), false);
    assert.equal(await page.locator('[data-ody-open="#states-modal"]').evaluate(node => node === document.activeElement), true);
    await page.locator('#states-search').fill('readonly');
    assert.equal(await page.locator('#states-inventory').evaluate(node => node.open), true);
    const shown = await page.locator('[data-state-component]:visible').count();
    assert.ok(shown > 0 && shown < manifest.components.length);
    await page.locator('#states-search').fill('no-such-state-odyssey');
    assert.equal(await page.locator('[data-state-component]:visible').count(), 0);
    await page.locator('#states-search').fill('');
    if (process.env.ODYSSEY_SCREENSHOTS) {
      await mkdir(process.env.ODYSSEY_SCREENSHOTS, {recursive:true});
      await page.locator('#states-inventory').evaluate(node => {node.open=false;});
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path:process.env.ODYSSEY_SCREENSHOTS+'/states-line-desktop.png',fullPage:true});
    }
    await page.setViewportSize({width:320,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#states-inventory').evaluate(node => {node.open=true;});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.ODYSSEY_SCREENSHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path:process.env.ODYSSEY_SCREENSHOTS+'/states-line-320.png'});
      await page.locator('#inputs-title').scrollIntoViewIfNeeded();
      await page.screenshot({path:process.env.ODYSSEY_SCREENSHOTS+'/states-inputs-320.png'});
    }
    assert.deepEqual(errors, []);
    console.log('PASS state atlas: 8 themes, density geometry, real Tab/readonly, modal focus return, live search, Axe and 320px.');
  } finally { await browser.close(); }
}
