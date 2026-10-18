import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, before, after } from 'node:test';
import { assertSurface } from '../pattern-assertions.mjs';
const { default: AxeBuilder } = await import(process.env.AXE_PLAYWRIGHT_MODULE || new URL('../browser-runtime/node_modules/@axe-core/playwright/dist/index.mjs',import.meta.url).href);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = await readFile(new URL('../../dist/odyssey.js', import.meta.url), 'utf8');
const extensions = await readFile(new URL('../../js/extensions.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../dist/odyssey.css', import.meta.url), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE }); });
after(async () => { await browser?.close(); });

async function fixture(t, markup = '', useExtensions = false) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'no uncaught browser errors'); });
  await page.setContent(`<!doctype html><html lang="en"><head></head><body><main tabindex="-1" id="fallback">${markup}</main></body></html>`);
  await page.addStyleTag({ content: css });
  if (useExtensions === 'before') await page.addScriptTag({ content: extensions });
  await page.addScriptTag({ content: source });
  if (useExtensions && useExtensions !== 'before') await page.addScriptTag({ content: extensions });
  return page;
}
async function events(page, selector, name) {
  await page.locator(selector).evaluate((node, name) => {
    node._events = [];
    node.addEventListener(name, event => node._events.push(event.detail));
  }, name);
}
async function recorded(page, selector) { return page.locator(selector).evaluate(node => node._events); }
async function activeId(page) { return page.evaluate(() => document.activeElement.id); }
async function validFocus(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    return node !== document.body && node?.isConnected && !node.closest('[hidden]') && node.getClientRects().length > 0;
  });
}
async function composingKey(page, selector, key, state = true) {
  return page.locator(selector).evaluate((node, { key, state }) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, isComposing: state });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  }, { key, state });
}
const code = id => `<div id="${id}" data-ody-code-input>${Array.from({ length: 4 }, () => '<input inputmode="numeric" aria-label="Digit">').join('')}<span data-ody-code-help></span></div>`;
const multiselect = `<div id="ms" class="ody-multiselect" data-ody-multiselect aria-label="Languages">
  <div class="ody-multiselect__control" tabindex="0" role="button" aria-haspopup="listbox"><div class="ody-multiselect__values"></div></div>
  <div class="ody-multiselect__menu" role="listbox" aria-multiselectable="true">
    <div class="ody-multiselect__opt" role="option" data-value="ts">TypeScript</div>
    <div class="ody-multiselect__opt" role="option" data-value="rust">Rust</div>
    <div class="ody-multiselect__opt" role="option" data-value="go">Go</div>
  </div><button type="button" data-ody-ms-clear>Clear choices</button></div>`;

test('ACT-01: root, descendants, Wire targets and repeated init use the same extension lifecycle', async t => {
  const page = await fixture(t, '<div id="mount"></div><div id="wire"></div>', true);
  await page.locator('#mount').evaluate((mount, markup) => { mount.innerHTML = markup; }, code('direct'));
  await page.evaluate(() => { Odyssey.init(document.querySelector('#direct')); Odyssey.init(document.querySelector('#direct')); });
  await events(page, '#direct', 'ody:code-change');
  await page.locator('#direct input').first().fill('4829');
  assert.deepEqual(await page.locator('#direct input').evaluateAll(nodes => nodes.map(node => node.value)), ['4', '8', '2', '9']);
  assert.equal((await recorded(page, '#direct')).length, 1, 're-init must not duplicate listeners');
  await page.locator('#wire').evaluate((mount, markup) => { mount.innerHTML = `<section>${markup}</section>`; }, code('wired'));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('wire:after', { detail: { targets: ['#wire'] } })));
  await events(page, '#wired', 'ody:code-change');
  await page.locator('#wired input').first().fill('1234');
  assert.deepEqual(await page.locator('#wired input').evaluateAll(nodes => nodes.map(node => node.value)), ['1', '2', '3', '4']);
  assert.equal((await recorded(page, '#wired')).length, 1);
  await page.locator('#mount').evaluate((mount, markup) => { mount.innerHTML = `<section>${markup}</section>`; }, code('descendant'));
  await page.evaluate(() => { Odyssey.init(document.querySelector('#mount')); Odyssey.init(document.querySelector('#mount')); });
  await events(page, '#descendant', 'ody:code-change');
  await page.locator('#descendant input').first().fill('5678');
  assert.equal((await recorded(page, '#descendant')).length, 1);
  assert.deepEqual(await page.locator('#descendant input').evaluateAll(nodes => nodes.map(node => node.value)), ['5', '6', '7', '8']);
});

test('ACT-01: extensions loaded before core still participate in later init and Wire targets', async t => {
  const page=await fixture(t,'<div id="later"></div>','before');
  await page.locator('#later').evaluate((host,markup)=>{host.innerHTML=markup;},code('early-extension'));
  await page.evaluate(()=>{Odyssey.init(document.querySelector('#early-extension'));Odyssey.init(document.querySelector('#early-extension'));});
  await events(page,'#early-extension','ody:code-change');await page.locator('#early-extension input').first().fill('9876');
  assert.equal((await recorded(page,'#early-extension')).length,1);
  await page.locator('#later').evaluate((host,markup)=>{host.innerHTML=markup;},code('early-wire'));
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('wire:after',{detail:{targets:['#later']}})));
  await events(page,'#early-wire','ody:code-change');await page.locator('#early-wire input').first().fill('1234');
  assert.equal((await recorded(page,'#early-wire')).length,1);
});

test('ACT-02: file browse and drop carry the displayed file in native FormData exactly once', async t => {
  const page = await fixture(t, `<form id="files"><div id="file" class="ody-ext-file" data-ody-file-dropzone>
    <input type="file" name="attachment" accept=".zip" data-ody-file-input>
    <button type="button" data-ody-file-browse>Browse</button><span data-ody-file-title>Choose a file</span>
    <span data-ody-file-status>No file selected</span><span data-ody-file-error hidden role="alert"></span>
  </div></form>`, true);
  await page.evaluate(() => { Odyssey.init(document.querySelector('#file')); Odyssey.init(document.querySelector('#file')); });
  await events(page, '#file', 'ody:file-selected');
  const file = { name: 'release.zip', mimeType: 'application/zip', buffer: Buffer.from('native-form-data') };
  await page.locator('[data-ody-file-input]').setInputFiles(file);
  const submitted = () => page.locator('#files').evaluate(form => {
    const file = new FormData(form).get('attachment');
    return { name: file.name, size: file.size, type: file.type };
  });
  const browsed = await submitted();
  assert.equal(browsed.name, file.name);
  assert.equal(browsed.size, file.buffer.length);
  assert.equal((await recorded(page, '#file')).length, 1);
  await page.locator('[data-ody-file-input]').setInputFiles([]);
  await page.locator('#file').evaluate(zone => {
    zone._events = [];
    const transfer = new DataTransfer();
    transfer.items.add(new File(['native-form-data'], 'release.zip', { type: 'application/zip' }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  assert.deepEqual(await submitted(), browsed, 'drop and browse submit the same file');
  assert.equal(await page.locator('[data-ody-file-input]').evaluate(input => input.files.length), 1);
  assert.equal((await recorded(page, '#file')).length, 1);
  assert.equal(await page.locator('[data-ody-file-title]').textContent(), file.name);
});

test('ACT-03: Multi-select keyboard selection, named chip removal and clear emit one values event', async t => {
  const page = await fixture(t, multiselect);
  await events(page, '#ms', 'ody:change');
  const control = page.locator('.ody-multiselect__control');
  await control.focus(); await page.keyboard.press('Enter');
  assert.equal(await control.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
  assert.equal((await recorded(page, '#ms')).length, 1);
  assert.equal((await recorded(page, '#ms'))[0].value.length, 1);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  assert.equal((await recorded(page, '#ms')).length, 2);
  assert.equal((await recorded(page, '#ms'))[1].value.length, 2);
  await page.keyboard.press('Escape');
  assert.equal(await control.getAttribute('aria-expanded'), 'false');
  const remove = page.locator('[data-ody-ms-remove]').first();
  const chipText = await remove.locator('..').textContent();
  assert.ok((await remove.getAttribute('aria-label')).includes(chipText.trim()), 'remove accessible name contains choice name');
  await remove.click();
  assert.equal((await recorded(page, '#ms')).length, 3);
  assert.equal((await recorded(page, '#ms'))[2].value.length, 1);
  assert.equal(await validFocus(page), true, 'removing focused chip leaves valid focus');
  await page.locator('[data-ody-ms-clear]').click();
  assert.equal((await recorded(page, '#ms')).length, 4);
  assert.deepEqual((await recorded(page, '#ms'))[3].value, []);
  await control.focus(); await page.keyboard.press('Space');
  assert.equal(await control.getAttribute('aria-expanded'), 'true', 'Space also opens');
  await page.keyboard.press('Escape');
});

test('ACT-16: custom Combobox synchronizes labels, stable IDs, active and selected AX state', async t => {
  const page = await fixture(t, `<label id="framework-label" for="framework">Framework</label><div class="ody-combobox" data-ody-combobox>
    <input id="framework" class="ody-combobox__input" autocomplete="off">
    <div class="ody-combobox__list" role="listbox"><div class="ody-combobox__opt" role="option">React</div><div class="ody-combobox__opt" role="option">Vue</div></div>
  </div>`);
  const input = page.locator('#framework');
  assert.equal(await page.getByRole('combobox', { name: 'Framework', exact: true }).count(), 1);
  const ids = await page.locator('.ody-combobox__list, .ody-combobox__opt').evaluateAll(nodes => nodes.map(node => node.id));
  assert.ok(ids.every(Boolean)); assert.equal(new Set(ids).size, ids.length);
  assert.equal(await input.getAttribute('aria-controls'), ids[0]);
  await page.evaluate(() => Odyssey.init(document.querySelector('[data-ody-combobox]')));
  assert.deepEqual(await page.locator('.ody-combobox__list, .ody-combobox__opt').evaluateAll(nodes => nodes.map(node => node.id)), ids);
  await input.fill('Vue'); await page.keyboard.press('ArrowDown');
  const active = await input.getAttribute('aria-activedescendant');
  assert.ok(active); assert.equal(await page.locator(`[id="${active}"]`).textContent(), 'Vue');
  await page.keyboard.press('Enter');
  assert.equal(await input.inputValue(), 'Vue');
  assert.equal(await page.getByRole('option', { name: 'Vue', includeHidden: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  await input.fill('no matches');
  assert.equal(await page.locator('.ody-combobox__empty').isVisible(), true);
  assert.equal(await input.getAttribute('aria-activedescendant'), null);
  await page.keyboard.press('Escape');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await activeId(page), 'framework');
});

const datepicker = (value = '2024-02-29') => `<label for="date">Date</label><div id="date-picker" class="ody-datepicker" data-ody-datepicker>
  <input id="date" class="ody-datepicker__input" readonly value="${value}" min="2024-02-10" max="2024-03-10">
  <div class="ody-datepicker__panel"></div></div>`;
async function focusedDay(page) { return page.evaluate(() => document.activeElement.getAttribute('data-ody-dp-day')); }

test('ACT-09: custom date picker handles leap day, constraints, complete names and keyboard selection', async t => {
  const page = await fixture(t, datepicker());
  await page.locator('#date').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#date-picker').evaluate(node => node.classList.contains('is-open')), true);
  assert.equal(await focusedDay(page), '29');
  const day = page.locator('[data-ody-dp-day="29"]');
  assert.match(await day.getAttribute('aria-label'), /2024/);
  assert.match(await day.getAttribute('aria-label'), /29/);
  assert.equal(await day.getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('[data-ody-dp-day="9"]').isDisabled(), true);
  await page.keyboard.press('ArrowLeft'); assert.equal(await focusedDay(page), '28');
  await page.keyboard.press('Home'); assert.equal(await focusedDay(page), '26');
  await page.keyboard.press('End'); assert.equal(await focusedDay(page), '3');
  await page.keyboard.press('ArrowUp'); assert.equal(await focusedDay(page), '25');
  await page.keyboard.press('ArrowDown'); assert.equal(await focusedDay(page), '3');
  await page.keyboard.press('PageUp'); assert.match(await page.locator('.ody-datepicker__title').textContent(), /February 2024/);
  await page.keyboard.press('PageDown'); assert.match(await page.locator('.ody-datepicker__title').textContent(), /March 2024/);
  await page.keyboard.press('Escape');
  assert.equal(await activeId(page), 'date');
  await page.locator('#date').press('Space');
  await page.locator('[data-ody-dp-day="29"]').press('Enter');
  assert.equal(await page.locator('#date').inputValue(), '2024-02-29');
  await page.locator('#date').press('Enter');
  await page.locator('[data-ody-dp-nav="1"]').click();
  assert.equal(await page.locator('[data-ody-dp-day="11"]').isDisabled(), true);
  await page.locator('[data-ody-dp-day="10"]').click();
  assert.equal(await page.locator('#date').inputValue(), '2024-03-10');
});

test('ACT-09: invalid initial dates do not silently become a different selected date', async t => {
  const page = await fixture(t, datepicker('2023-02-29'));
  await page.locator('#date').press('Enter');
  assert.equal(await page.locator('.ody-datepicker__day.is-selected').count(), 0);
  await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'date');
});

test('ACT-09: custom time picker opens, changes both columns and restores focus with keyboard', async t => {
  const page = await fixture(t, `<label for="time">Time</label><div id="time-picker" class="ody-timepicker" data-ody-timepicker data-minute-step="5">
    <input id="time" class="ody-timepicker__input" readonly value="09:30"><div class="ody-timepicker__panel"></div></div>`);
  await page.locator('#time').press('Enter');
  assert.equal(await page.locator('#time-picker').evaluate(node => node.classList.contains('is-open')), true);
  assert.equal(await page.evaluate(() => document.querySelector('#time-picker').contains(document.activeElement)), true);
  await page.locator('[data-ody-tp-h="9"]').focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  assert.match(await page.locator('#time').inputValue(), /^10:/);
  await page.locator('[data-ody-tp-m="30"]').focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
  assert.equal(await page.locator('#time').inputValue(), '10:35');
  await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'time');
});

const rows = [['relay', 'us-east', 1240], ['cortex', 'eu-west', 860], ['forge', 'us-east', 2075], ['atlas', 'us-east', 600], ['beacon', 'eu-west', 200]];
const table = `<div id="table" class="ody-table-wrap" data-ody-table data-ody-sort data-ody-select data-page-size="2"><table class="ody-table"><thead><tr>
  <th class="ody-th--check"><input type="checkbox" aria-label="Select visible"></th><th class="ody-th--sort">Service</th><th class="ody-th--sort">Region</th><th class="ody-th--sort" data-sort-type="num">QPS</th></tr>
  <tr class="ody-table__filter"><th></th><th><input class="ody-table__filter-field" aria-label="Filter service"></th><th><input class="ody-table__filter-field" aria-label="Filter region"></th><th></th></tr></thead>
  <tbody>${rows.map(([name, region, qps]) => `<tr data-row="${name}"><td class="ody-td--check"><input type="checkbox" value="${name}" aria-label="Select ${name}"></td><td>${name}</td><td>${region}</td><td>${qps}</td></tr>`).join('')}</tbody></table>
  <span data-ody-table-summary></span><span data-ody-table-selected></span><button data-ody-table-clear>Clear filters</button>
  <nav><button data-ody-page="prev">Previous</button><button data-ody-page="1">1</button><button data-ody-page="2">2</button><button data-ody-page="3">3</button><button data-ody-page="next">Next</button></nav></div>`;
async function visibleRows(page) { return page.locator('#table tbody tr[data-row]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.row)); }

test('ACT-13: filter, numeric keyboard sort, page and selection keep data and events synchronized', async t => {
  const page = await fixture(t, table);
  await events(page, '#table', 'ody:table-change');
  assert.equal((await visibleRows(page)).length, 2);
  await page.getByRole('textbox', { name: 'Filter region', exact: true }).fill('us-east');
  assert.equal((await visibleRows(page)).length, 2);
  const qps = page.locator('th.ody-th--sort').last();
  await qps.focus(); await page.keyboard.press('Enter');
  assert.equal(await qps.getAttribute('aria-sort'), 'ascending');
  assert.deepEqual(await visibleRows(page), ['atlas', 'relay']);
  await page.getByRole('checkbox', { name: 'Select atlas', exact: true }).check();
  assert.match(await page.locator('[data-ody-table-selected]').textContent(), /1/);
  await page.locator('[data-ody-page="next"]').click();
  assert.deepEqual(await visibleRows(page), ['forge']);
  let state = (await recorded(page, '#table')).at(-1);
  assert.equal(state.page, 2); assert.equal(state.total, 3);
  assert.equal(Array.isArray(state.selected) ? state.selected.length : state.selected, 1);
  assert.match(await page.locator('[data-ody-table-summary]').textContent(), /3/);
  await page.getByRole('textbox', { name: 'Filter service', exact: true }).fill('nothing');
  assert.deepEqual(await visibleRows(page), []);
  state = (await recorded(page, '#table')).at(-1); assert.equal(state.total, 0); assert.equal(state.page, 1);
  await page.locator('[data-ody-table-clear]').click();
  assert.equal(await page.getByRole('textbox', { name: 'Filter region', exact: true }).inputValue(), '');
  assert.equal((await visibleRows(page)).length, 2);
  state = (await recorded(page, '#table')).at(-1); assert.equal(state.total, 5);
  await page.locator('[data-ody-page="2"]').click();
  state = (await recorded(page, '#table')).at(-1); assert.equal(state.page, 2);
  await page.locator('[data-ody-page="prev"]').click();
  state = (await recorded(page, '#table')).at(-1); assert.equal(state.page, 1);
});

test('ACT-15: Kanban has keyboard and click alternatives with counts, events and status', async t => {
  const page = await fixture(t, `<div id="board" class="ody-kanban">${[['Todo', ['A', 'B']], ['Done', ['C']]].map(([column, cards]) => `<div class="ody-kanban__col"><div class="ody-kanban__head">${column}<span class="ody-kanban__count">${cards.length}</span></div><div class="ody-kanban__list">${cards.map(name => `<div id="card-${name}" class="ody-kanban__card"><div class="ody-kanban__card-title">Task ${name}</div></div>`).join('')}</div></div>`).join('')}</div>`);
  await page.evaluate(() => { Odyssey.init(document.querySelector('#board')); Odyssey.init(document.querySelector('#board')); });
  await events(page, '#board', 'ody:kanban-change');
  assert.equal(await page.locator('[data-ody-kanban-move]').count(), 3);
  assert.equal(await page.locator('[data-ody-kanban-up]').count(), 3);
  assert.equal(await page.locator('[data-ody-kanban-down]').count(), 3);
  await page.locator('#card-B [data-ody-kanban-up]').focus(); await page.keyboard.press('Enter');
  assert.deepEqual(await page.locator('.ody-kanban__list').first().locator('.ody-kanban__card').evaluateAll(nodes => nodes.map(node => node.id)), ['card-B', 'card-A']);
  await page.locator('#card-B [data-ody-kanban-down]').click();
  assert.deepEqual(await page.locator('.ody-kanban__list').first().locator('.ody-kanban__card').evaluateAll(nodes => nodes.map(node => node.id)), ['card-A', 'card-B']);
  const move = page.locator('#card-B [data-ody-kanban-move]');
  const done = await move.locator('option').last().getAttribute('value');
  await move.selectOption(done);
  assert.equal(await page.locator('.ody-kanban__list').last().locator('#card-B').count(), 1);
  assert.deepEqual(await page.locator('.ody-kanban__count').allTextContents(), ['1', '2']);
  assert.equal((await recorded(page, '#board')).length, 3);
  assert.ok((await page.locator('#board [role="status"], #board [aria-live="polite"]').allTextContents()).join(' ').trim(), 'move result announced');
});

const overlays = `<button id="launch" data-ody-open="#modal">Open modal</button><button id="safe">Safe target</button>
  <div id="modal" class="ody-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden><div class="ody-modal__panel"><h2 id="modal-title">Review</h2><button id="drawer-open" data-ody-open="#drawer">Open drawer</button><button data-ody-dismiss>Close modal</button></div></div>
  <div id="drawer" class="ody-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden><div class="ody-drawer__panel"><h2 id="drawer-title">Details</h2><button id="drawer-action">Action</button><button data-ody-dismiss>Close drawer</button></div></div>`;

test('A11Y-05: each overlay has one named dialog and nested close restores its own trigger', async t => {
  const page = await fixture(t, overlays);
  await page.locator('#launch').click();
  assert.equal(await page.getByRole('dialog', { name: 'Review', exact: true }).count(), 1);
  assert.equal(await page.locator('#modal [role="dialog"]').count(), 0, 'no unnamed nested dialog');
  await page.locator('#drawer-open').click();
  assert.equal(await page.getByRole('dialog', { name: 'Details', exact: true }).count(), 1);
  assert.equal(await page.locator('#drawer [role="dialog"]').count(), 0);
  await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'drawer-open');
  await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'launch');
  await page.locator('#launch').click();
  await page.locator('#launch').evaluate(node => node.remove());
  await page.keyboard.press('Escape'); assert.equal(await validFocus(page), true, 'removed trigger falls back to a visible target');
  await page.locator('#safe').focus();
  await page.evaluate(() => Odyssey.openDrawer(document.querySelector('#drawer'), document.querySelector('#safe')));
  await page.locator('#drawer-action').focus();
  await page.evaluate(() => Odyssey.openModal(document.querySelector('#modal'), document.querySelector('#drawer-action')));
  assert.equal(await page.evaluate(()=>+getComputedStyle(document.querySelector('#modal')).zIndex > +getComputedStyle(document.querySelector('#drawer')).zIndex),true);
  await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'drawer-action', 'reverse opening order closes the actual top layer');
  await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'safe');
});

test('A11Y-06: menu action/Escape restore trigger, Tab leaves, and overlay opening owns destination focus', async t => {
  const page = await fixture(t, `${overlays}<div class="ody-dropdown"><button id="menu-open" data-ody-toggle>Menu</button><div class="ody-menu" role="menu"><button id="duplicate" class="ody-menu__item" role="menuitem">Duplicate</button><button id="menu-dialog" class="ody-menu__item" role="menuitem" data-ody-open="#modal">Review</button></div></div><button id="after-menu">After menu</button>`);
  await page.locator('#menu-open').click(); await page.locator('#duplicate').click();
  assert.equal(await page.locator('#menu-open').getAttribute('aria-expanded'), 'false');
  assert.equal(await activeId(page), 'menu-open');
  await page.locator('#menu-open').click(); await page.keyboard.press('Escape'); assert.equal(await activeId(page), 'menu-open');
  await page.locator('#menu-open').click(); await page.locator('#menu-dialog').click();
  assert.equal(await page.locator('#modal').evaluate(node => node.contains(document.activeElement)), true, 'menu cleanup must not steal overlay focus');
  await page.keyboard.press('Escape'); assert.equal(await validFocus(page), true);
  await page.locator('#menu-open').click(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#menu-open').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('.ody-menu').evaluate(node => node.contains(document.activeElement)), false, 'Tab does not leave focus in a closed menu');
});

test('A11Y-04: IME composition protects tags, inline editing and both command runtimes', async t => {
  const page = await fixture(t, `<div id="tags" class="ody-taginput" data-ody-taginput><input class="ody-taginput__field" aria-label="Tags"></div>
    <div id="editable" class="ody-editable" data-ody-editable>Original</div>
    <button id="command-open" data-ody-command-open="command">Commands</button><dialog id="command" class="ody-ext-command" data-ody-command-menu aria-label="Commands"><input data-ody-command-input aria-label="Command query"><button data-ody-command-action="#destination">Run</button><span data-ody-command-empty hidden>No matches</span></dialog><h2 id="destination">Destination</h2>
    <button id="legacy-open" data-ody-cmdk-open="#legacy-command">Legacy commands</button><div id="legacy-command" class="ody-cmdk" hidden><div class="ody-cmdk__panel" role="dialog" aria-label="Legacy commands"><input class="ody-cmdk__input" aria-label="Legacy query"><button id="legacy-action" class="ody-cmdk__item">Run</button><span class="ody-cmdk__empty" hidden>No matches</span></div></div>`, true);
  const tag = page.locator('.ody-taginput__field'); await tag.fill('zhong');
  await tag.dispatchEvent('compositionstart');
  await composingKey(page, '.ody-taginput__field', 'Enter'); await composingKey(page, '.ody-taginput__field', ',');
  assert.equal(await page.locator('.ody-taginput__chip').count(), 0);
  await tag.fill('中文'); await tag.dispatchEvent('compositionend'); await tag.press('Enter');
  assert.equal(await page.locator('.ody-taginput__chip').getAttribute('data-value'), '中文');
  await page.locator('#editable').click();
  await page.locator('.ody-editable__input').fill('编辑'); await page.locator('.ody-editable__input').dispatchEvent('compositionstart');
  await composingKey(page, '.ody-editable__input', 'Enter'); await composingKey(page, '.ody-editable__input', 'Escape');
  assert.equal(await page.locator('.ody-editable__input').count(), 1, 'composition does not commit or cancel inline edit');
  await page.locator('.ody-editable__input').dispatchEvent('compositionend'); await page.locator('.ody-editable__input').press('Enter');
  assert.equal(await page.locator('.ody-editable__text').textContent(), '编辑');
  await events(page, '#command', 'ody:command'); await page.locator('#command-open').click();
  await page.locator('[data-ody-command-input]').dispatchEvent('compositionstart');
  await composingKey(page, '[data-ody-command-input]', 'Enter'); await composingKey(page, '[data-ody-command-input]', 'Escape');
  assert.equal(await page.locator('#command').evaluate(node => node.open), true);
  assert.equal((await recorded(page, '#command')).length, 0);
  await page.locator('[data-ody-command-input]').dispatchEvent('compositionend'); await page.locator('[data-ody-command-input]').press('Enter');
  assert.equal((await recorded(page, '#command')).length, 1);
  await page.locator('#legacy-action').evaluate(node => { window.legacyRuns = 0; node.addEventListener('click', () => window.legacyRuns++); });
  await page.locator('#legacy-open').click(); await page.locator('.ody-cmdk__input').focus();
  await page.locator('.ody-cmdk__input').dispatchEvent('compositionstart');
  await composingKey(page, '.ody-cmdk__input', 'Enter'); await composingKey(page, '.ody-cmdk__input', 'Escape');
  assert.equal(await page.evaluate(() => window.legacyRuns), 0);
  assert.equal(await page.locator('#legacy-command').evaluate(node => node.classList.contains('is-open')), true);
  await page.locator('.ody-cmdk__input').dispatchEvent('compositionend'); await page.locator('.ody-cmdk__input').press('Enter');
  assert.equal(await page.evaluate(() => window.legacyRuns), 1);
});

test('ACT-09: bounded time choices remain reachable when the current minute is outside the new hour', async t => {
  const page = await fixture(t, `<div class="ody-timepicker"><input id="bounded-time" class="ody-timepicker__input" readonly value="09:30" min="09:30" max="10:15"><div class="ody-timepicker__panel"></div></div>`);
  await page.locator('#bounded-time').press('Enter');
  await page.locator('[data-ody-tp-h="10"]').click();
  assert.equal(await page.locator('#bounded-time').inputValue(), '10:00');
  assert.equal(await page.locator('[data-ody-tp-m="15"]').isEnabled(), true);
  await page.locator('[data-ody-tp-m="15"]').click();
  assert.equal(await page.locator('#bounded-time').inputValue(), '10:15');
});

test('ACT-13: Wire replacement refreshes the current table inventory rather than detached cached rows', async t => {
  const page = await fixture(t, table);
  await page.locator('#table').evaluate(host => { host.innerHTML = `<table><tbody>${['One','Two','Three'].map(name=>`<tr data-row="${name}"><td>${name}</td></tr>`).join('')}</tbody></table><span data-ody-table-summary></span><span data-ody-table-selected></span><nav class="ody-pager"></nav>`; });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('wire:after', {detail:{targets:['#table']}})));
  assert.equal(await page.locator('#table').evaluate(host => host.__odyTable.table.isConnected), true);
  assert.match(await page.locator('[data-ody-table-summary]').textContent(), /^3 results/);
  assert.deepEqual(await visibleRows(page), ['One','Two']);
  await page.locator('[data-ody-page="next"]').click();
  assert.deepEqual(await visibleRows(page), ['Three']);
});

test('ACT-15: Kanban delegation leaves ordinary document drag behavior intact', async t => {
  const page = await fixture(t, '<a id="outside-drag" href="/target" draggable="true">Link</a>');
  assert.equal(await page.locator('#outside-drag').evaluate(node => node.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true}))), true);
});

test('A11Y-05: an unrelated modeless dialog does not disable legacy modal keyboard handling', async t => {
  const page = await fixture(t, `${overlays}<dialog open id="modeless">A modeless note</dialog>`);
  await page.evaluate(() => Odyssey.openModal(document.querySelector('#modal'), document.querySelector('#launch')));
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#modal').evaluate(node=>node.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modal').isHidden(), true);
  assert.equal(await activeId(page), 'launch');
});

test('ACT-09: directional date navigation skips a disabled day without jumping back to month start', async t => {
  const page = await fixture(t, datepicker('2024-02-27').replace('data-ody-datepicker>', 'data-ody-datepicker data-disabled-dates="2024-02-28">'));
  await page.locator('#date').press('Enter');
  await page.keyboard.press('ArrowRight');
  assert.equal(await focusedDay(page), '29');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#date').inputValue(), '2024-02-29');
});

async function guidePage(t){
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://odyssey.test/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let content,type;
    const releaseFiles={'odyssey.css':'dist/odyssey.css','odyssey.js':'dist/odyssey.js','odyssey-font.css':'dist/odyssey-font.css','odyssey-line.css':'css/line.css','odyssey-line-font.css':'css/line-font.css','odyssey-expressions.css':'css/expressions.css','odyssey-extensions.css':'css/extensions.css','odyssey-extensions.js':'js/extensions.js','odyssey-compositions.css':'css/compositions.css','odyssey-compositions.js':'js/compositions.js'};
    if(pathname.startsWith('/1.5.0/')&&releaseFiles[pathname.split('/').pop()]){const relative=releaseFiles[pathname.split('/').pop()];content=await readFile(new URL('../../'+relative,import.meta.url),'utf8');type=relative.endsWith('.css')?'text/css':'application/javascript';}
    else if(pathname==='/assets/line.css'){content=(await readFile(new URL('../../css/line-font.css',import.meta.url),'utf8'))+await readFile(new URL('../../css/line.css',import.meta.url),'utf8');type='text/css';}
    else if(pathname==='/assets/extensions.css'){content=(await readFile(new URL('../../css/expressions.css',import.meta.url),'utf8'))+await readFile(new URL('../../css/extensions.css',import.meta.url),'utf8');type='text/css';}
    else if(pathname==='/assets/extensions.js'){content=extensions;type='application/javascript';}
    else if(['/assets/line-site-20261018.css','/assets/line-site-20261018-p1.css'].includes(pathname)){content=await readFile(new URL('../../site/assets/line-site.css',import.meta.url),'utf8');type='text/css';}
    else if(pathname==='/favicon.ico'){await route.fulfill({status:204});return;}
    else {const relative=pathname.startsWith('/dist/')?pathname.slice(1):'site'+pathname;content=await readFile(new URL('../../'+relative,import.meta.url),'utf8');type=pathname.endsWith('.css')?'text/css':pathname.endsWith('.js')?'application/javascript':'text/html';}
    await route.fulfill({status:200,contentType:type,body:content});
  });
  return page;
}

test('P1 consumer guide: actual Forms and Data display pages use the repaired library contracts', async t => {
  const page=await guidePage(t);
  await page.goto('http://odyssey.test/forms.html');
  const combo=page.locator('.ody-combobox__input').first();
  assert.equal(await page.getByRole('combobox',{name:'框架',exact:true}).count(),1);
  await combo.fill('Svelte');await combo.press('ArrowDown');await combo.press('Enter');assert.equal(await combo.inputValue(),'Svelte');
  const multi=page.locator('.ody-multiselect__control').first();await multi.focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('Space');await page.keyboard.press('Escape');
  assert.equal(await multi.getAttribute('aria-expanded'),'false');
  await page.locator('.ody-datepicker__input').press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.match(await page.locator('.ody-datepicker__input').inputValue(),/^\d{4}-\d{2}-\d{2}$/);
  await assertSurface(page,{AxeBuilder,label:'Forms guide'});
  await page.goto('http://odyssey.test/data-display.html');
  await page.locator('[data-ody-table]').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-ody-table] tbody tr:visible').count(),2);
  await page.locator('[data-ody-table] [data-ody-page="next"]').click();assert.equal(await page.locator('[data-ody-table] tbody tr:visible').count(),1);
  await page.locator('[data-ody-table] input[aria-label="筛选服务"]').fill('no-match');assert.equal(await page.locator('[data-ody-table-empty]').isVisible(),true);await page.locator('[data-ody-table-clear]').click();
  const kanban=page.locator('.ody-kanban');await kanban.scrollIntoViewIfNeeded();
  await kanban.locator('[data-ody-kanban-move]').first().selectOption('1');assert.equal(await kanban.locator('.ody-kanban__col').nth(1).locator('.ody-kanban__card').count(),2);
  const snippet=await page.locator('[data-ody-table]').evaluate(node=>node.closest('.doc-example').querySelector('.doc-code code').textContent);
  const copied=await fixture(t,snippet);assert.equal(await copied.locator('[data-ody-table] tbody tr:visible').count(),2);await copied.locator('[data-ody-page=next]').click();assert.equal(await copied.locator('[data-ody-table] tbody tr:visible').count(),1);
  if(process.env.ODYSSEY_RUNTIME_SCREENSHOTS){const {mkdir}=await import('node:fs/promises');await mkdir(process.env.ODYSSEY_RUNTIME_SCREENSHOTS,{recursive:true});await kanban.screenshot({path:process.env.ODYSSEY_RUNTIME_SCREENSHOTS+'/runtime-kanban.png'});await page.locator('[data-ody-table]').screenshot({path:process.env.ODYSSEY_RUNTIME_SCREENSHOTS+'/runtime-table.png'});await page.goto('http://odyssey.test/forms.html');await page.locator('.ody-datepicker__input').press('Enter');await page.locator('.ody-datepicker__panel').screenshot({path:process.env.ODYSSEY_RUNTIME_SCREENSHOTS+'/runtime-datepicker.png'});}
});

test('Adjacent legacy semantics: split value metadata tracks keyboard/drag and carousel dots stay exposed', async t => {
  const page=await fixture(t, `<div class="ody-split-pane" data-ody-min="80" style="width:500px;height:200px"><div class="ody-split-pane__panel" style="flex:0 0 200px">Explorer</div><div class="ody-split-pane__gutter" aria-label="Explorer width"></div><div class="ody-split-pane__panel">Details</div></div><div class="ody-carousel" data-ody-carousel><div class="ody-carousel__track"><div class="ody-carousel__slide">First</div><div class="ody-carousel__slide">Second</div></div><div class="ody-carousel__dots" aria-hidden="true"></div></div>`);
  const gutter=page.locator('.ody-split-pane__gutter');
  assert.equal(await gutter.getAttribute('aria-valuenow'),'200');assert.equal(await gutter.getAttribute('aria-orientation'),'vertical');
  await gutter.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await gutter.getAttribute('aria-valuenow'),String(await page.locator('.ody-split-pane__panel').first().evaluate(node=>Math.round(node.getBoundingClientRect().width))));
  assert.equal(await gutter.getAttribute('aria-valuenow'),'216');
  const box=await gutter.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+50,box.y+box.height/2);await page.mouse.up();
  assert.equal(await gutter.getAttribute('aria-valuenow'),String(await page.locator('.ody-split-pane__panel').first().evaluate(node=>Math.round(node.getBoundingClientRect().width))));
  assert.equal(await page.locator('.ody-carousel__dots').getAttribute('aria-hidden'),null);await page.getByRole('button',{name:'Go to slide 2'}).click();assert.equal(await page.getByRole('button',{name:'Go to slide 2'}).getAttribute('aria-current'),'true');
  await page.locator('main').evaluate(main=>main.insertAdjacentHTML('beforeend','<div id="vertical-split" class="ody-split-pane ody-split-pane--vert" data-ody-min="80" style="width:400px;height:500px"><div class="ody-split-pane__panel" style="flex:0 0 200px">Top</div><div class="ody-split-pane__gutter" aria-label="Top height"></div><div class="ody-split-pane__panel">Bottom</div></div>'));
  await page.evaluate(()=>Odyssey.init(document.querySelector('#vertical-split')));
  const vertical=page.locator('#vertical-split .ody-split-pane__gutter');await vertical.focus();await page.keyboard.press('ArrowDown');
  const actual=await vertical.evaluate(node=>({size:node.previousElementSibling.offsetHeight,max:node.parentElement.clientHeight-80-node.offsetHeight}));
  assert.equal(await vertical.getAttribute('aria-orientation'),'horizontal');assert.equal(await vertical.getAttribute('aria-valuenow'),String(actual.size));assert.equal(await vertical.getAttribute('aria-valuemax'),String(actual.max));
});


test('Adjacent guide semantics: actual Data display page has valid tree hierarchy, graphics names and scroll access',async t=>{
  const page=await guidePage(t);await page.goto('http://odyssey.test/data-display.html');
  await assertSurface(page,{AxeBuilder,label:'Data display guide'});
  assert.equal(await page.locator('.ody-tree').getAttribute('role'),'tree');
  assert.equal(await page.locator('.ody-tree__row:not([role="treeitem"])').count(),0);
  assert.equal(await page.locator('[data-ody-chart] svg[role="img"]:not([aria-label])').count(),0);
  const branch=page.locator('.ody-tree__row[aria-expanded]').first(),initial=await branch.getAttribute('aria-expanded');
  await branch.press('Enter');assert.equal(await branch.getAttribute('aria-expanded'),String(initial!=='true'));assert.equal(await branch.getAttribute('aria-selected'),'true');
  await branch.press('Space');assert.equal(await branch.getAttribute('aria-expanded'),initial);
});
