// Actual Odyssey candidate pages. Helper self-tests and other products are separate evidence.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { assertSurface, assertKeyboardReachable, assertFeedback, assertFieldAssociation,
  assertActiveDescendant, assertValidFocus, applyTextAdaptation, assertTextFits,
  dispatchComposingKey } from '../pattern-assertions.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const { default: AxeBuilder } = await import(process.env.AXE_PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/@axe-core/playwright/dist/index.mjs');
const base = (process.env.ODYSSEY_BASE_URL || 'http://127.0.0.1:18770').replace(/\/$/, '');
let browser;
before(async () => {
  const response = await fetch(base + '/');
  assert.ok(response.ok, 'start the actual Odyssey candidate before ENG-09 browser acceptance');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
});
after(async () => { await browser?.close(); });

async function candidate(t, path, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  t.after(async () => { await context.close(); assert.deepEqual(errors, [], 'actual candidate resources and runtime must load'); });
  const response = await page.goto(base + path);
  assert.equal(response.status(), 200, path);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

for (const path of ['/', '/forms.html', '/feedback.html', '/data-display.html', '/patterns.html?view=settings']) {
  for (const theme of ['light', 'dark']) {
    test(`ENG-09: full-page WCAG 2.2 AA Axe on actual ${path} ${theme}`, async t => {
      const page = await candidate(t, path);
      if (theme === 'dark') {
        if (await page.locator('#theme-control').count()) await page.locator('#theme-control').selectOption('dark');
        else await page.locator('[data-ody-theme-toggle]').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      }
      const result = await assertSurface(page, { AxeBuilder, label: `${path} ${theme}` });
      assert.equal(result.accessibility, 'passed');
    });
  }
}

test('ENG-09/ACT-16: real Tab reaches the legacy guide combobox; browser AX and active option stay synchronized', async t => {
  const page = await candidate(t, '/forms.html');
  const input = page.locator('.ody-combobox__input').first();
  await assertKeyboardReachable(page, input, { maxTabs: 180 });
  await assertFieldAssociation(input, { name: '框架' });
  assert.equal(await page.getByRole('combobox', { name: '框架', exact: true }).count(), 1);
  await input.fill('Vue');
  await page.keyboard.press('ArrowDown');
  await assertActiveDescendant(input);
  await page.keyboard.press('Enter');
  assert.equal(await input.inputValue(), 'Vue');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await input.getAttribute('aria-activedescendant'), null);
  await input.fill('no such framework');
  await assertFeedback(page.locator('.ody-combobox__empty').first(), { text: 'No matches' });
  await page.keyboard.press('Escape');
  await assertValidFocus(page, { within: '[data-ody-combobox]' });
});

test('ENG-09/ACT-09: legacy guide custom date is named, keyboard-operable and returns focus', async t => {
  const page = await candidate(t, '/forms.html');
  const input = page.locator('.ody-datepicker__input').first();
  await assertKeyboardReachable(page, input, { maxTabs: 220 });
  await assertFieldAssociation(input);
  const before = await input.inputValue();
  await page.keyboard.press('Enter');
  await assertValidFocus(page, { within: '[data-ody-datepicker]' });
  const selected = page.locator('.ody-datepicker__day[aria-selected="true"]');
  assert.equal(await selected.count(), 1);
  assert.match(await selected.getAttribute('aria-label'), /2026/);
  assert.match(await selected.ariaSnapshot(), /2026/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.notEqual(await input.inputValue(), before);
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  await assertValidFocus(page, { within: '[data-ody-datepicker]' });
  assert.equal(await input.evaluate(el => el === document.activeElement), true);
});

test('ENG-09: legacy tree exposes hierarchy, expand state and real keyboard focus', async t => {
  const page = await candidate(t, '/data-display.html');
  const row = page.locator('.ody-tree__row').first();
  await assertKeyboardReachable(page, row, { maxTabs: 200 });
  assert.equal(await row.getAttribute('role'), 'treeitem');
  assert.match(await row.ariaSnapshot(), /src/);
  assert.equal(await page.getByRole('tree').count(), 1);
  const expanded = await row.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  assert.equal(await row.getAttribute('aria-expanded'), String(expanded !== 'true'));
  await page.keyboard.press('Space');
  assert.equal(await row.getAttribute('aria-expanded'), expanded);
  await assertValidFocus(page, { within: '.ody-tree' });
});

test('ENG-09/A11Y-05: legacy guide and registry have one named modal, real Tab containment and opener return', async t => {
  for (const [path, selector, id] of [['/feedback.html', '[data-ody-open="#demoModal"]', '#demoModal'], ['/', '#station-MDL [data-ody-open]', '#station-modal']]) {
    const page = await candidate(t, path);
    const opener = page.locator(selector).first();
    await assertKeyboardReachable(page, opener, { maxTabs: 220 });
    await page.keyboard.press('Enter');
    const modal = page.locator(id);
    const semantic = page.getByRole('dialog');
    assert.equal(await semantic.count(), 1, 'one semantic node per modal');
    assert.match((await semantic.ariaSnapshot()).split('\n')[0], /dialog ".+"/);
    await assertValidFocus(page, { within: id });
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Tab');
      await assertValidFocus(page, { within: id });
    }
    await page.keyboard.press('Escape');
    await assertValidFocus(page);
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);
  }
});

test('ENG-09/A11Y-04: real guide chips and registry commands do not execute synthetic IME confirmations', async t => {
  const forms = await candidate(t, '/forms.html');
  const input = forms.locator('.ody-taginput__field').first();
  await assertKeyboardReachable(forms, input, { maxTabs: 220 });
  const count = await forms.locator('.ody-taginput__chip').count();
  await input.fill('zhong');
  await input.dispatchEvent('compositionstart');
  await dispatchComposingKey(input, 'Enter');
  await dispatchComposingKey(input, ',');
  assert.equal(await forms.locator('.ody-taginput__chip').count(), count);
  assert.equal(await input.inputValue(), 'zhong');
  await input.dispatchEvent('compositionend');
  await dispatchComposingKey(input, 'Enter', { legacy: true });
  assert.equal(await forms.locator('.ody-taginput__chip').count(), count, 'keyCode 229 is not a submit');
  await input.fill('中文');
  await forms.keyboard.press('Enter');
  assert.equal(await forms.locator('.ody-taginput__chip').count(), count + 1);
  assert.equal(await forms.locator('.ody-taginput__chip').last().getAttribute('data-value'), '中文');

  const registry = await candidate(t, '/');
  const opener = registry.locator('[data-ody-command-open="registry-command"]');
  await assertKeyboardReachable(registry, opener, { maxTabs: 180 });
  await registry.keyboard.press('Enter');
  const command = registry.locator('#registry-command');
  const query = command.locator('[data-ody-command-input]');
  await assertFieldAssociation(query, { name: 'Find an action' });
  await query.dispatchEvent('compositionstart');
  await dispatchComposingKey(query, 'Enter');
  await dispatchComposingKey(query, 'Escape');
  assert.equal(await command.evaluate(el => el.open), true);
  assert.equal(new URL(registry.url()).hash, '');
  await query.dispatchEvent('compositionend');
  await registry.keyboard.press('Escape');
  assert.equal(await command.evaluate(el => el.open), false);
  assert.equal(await opener.evaluate(el => el === document.activeElement), true);
});

test('ENG-09/A11Y-02: actual guide switches retain checked/unchecked/disabled tracks and keyboard focus in forced colors', async t => {
  const page = await candidate(t, '/forms.html', { forcedColors: 'active' });
  const controls = page.locator('.ody-switch__control').filter({ has: page.locator('input') });
  assert.ok(await controls.count() >= 3);
  const states = [];
  for (const control of (await controls.all()).slice(0, 3)) {
    const result = await control.evaluate(el => {
      const input = el.querySelector('input'), track = el.querySelector('.ody-switch__track');
      const style = getComputedStyle(track), thumb = getComputedStyle(track, '::before');
      return { checked: input.checked, disabled: input.disabled, border: parseFloat(style.borderTopWidth), borderStyle: style.borderTopStyle, track: style.backgroundColor, thumb: thumb.backgroundColor };
    });
    assert.ok(result.border > 0 && result.borderStyle !== 'none', 'system-color track boundary is visible');
    assert.notEqual(result.track, result.thumb, 'track and thumb remain distinguishable');
    states.push(result);
  }
  assert.ok(states.some(state => state.checked) && states.some(state => !state.checked) && states.some(state => state.disabled));
  const enabled = controls.filter({ has: page.locator('input:not(:disabled)') }).first();
  await assertKeyboardReachable(page, enabled.locator('input'), { maxTabs: 180, focusIndicator: enabled.locator('.ody-switch__track') });
  await page.keyboard.press('Space');
  assert.equal(await enabled.locator('input').evaluate(el => el === document.activeElement), true, 'native visually-hidden input retains keyboard ownership');
});

for (const path of ['/', '/forms.html', '/patterns.html?view=settings']) {
  for (const profile of [{ width: 1440, scale: 2, spacing: false }, { width: 390, scale: 1, spacing: true }, { width: 320, scale: 1, spacing: false }]) {
    test(`ENG-09: text adaptation ${path} ${JSON.stringify(profile)}`, async t => {
      const page = await candidate(t, path, { viewport: { width: profile.width, height: 1000 } });
      if (profile.scale !== 1 || profile.spacing) await applyTextAdaptation(page, profile);
      await assertSurface(page, { label: `${path} / ${JSON.stringify(profile)}` });
      await assertTextFits(page.locator('h1,h2,h3,label,button,.line-top,.ody-appbar,.form-actions'));
    });
  }
}

test('ENG-09: true no-JS registry retains native input names and real Tab operation', async t => {
  const page = await candidate(t, '/', { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  assert.equal((await assertSurface(page)).accessibility, 'not_run');
  const input = page.locator('#station-TXT input');
  await assertKeyboardReachable(page, input, { maxTabs: 220 });
  assert.equal(await page.getByRole('textbox', { name: 'Station name', exact: true }).count(), 1);
  await input.pressSequentially('Native field');
  assert.equal(await input.inputValue(), 'Native field');
});
