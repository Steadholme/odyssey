import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { test, describe, before, after } from 'node:test';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || new URL('../browser-runtime/node_modules/playwright/index.mjs', import.meta.url).href);
const source = await readFile(new URL('../../dist/odyssey.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../dist/odyssey.css', import.meta.url), 'utf8');
const line = await readFile(new URL('../../css/line.css', import.meta.url), 'utf8');
const dataGuide = await readFile(new URL('../../site/data-display.html', import.meta.url), 'utf8');
const { default: AxeBuilder } = await import(process.env.AXE_PLAYWRIGHT_MODULE || new URL('../browser-runtime/node_modules/@axe-core/playwright/dist/index.mjs', import.meta.url).href);
const tree = `<ul class="ody-tree" aria-label="Project files" id="tree">
<li class="ody-tree__item is-open"><div class="ody-tree__row" id="src"><span class="ody-tree__label">src</span></div><ul class="ody-tree__children">
<li class="ody-tree__item is-leaf"><div class="ody-tree__row is-active" id="index"><span class="ody-tree__label">index.ts</span></div></li>
<li class="ody-tree__item"><div class="ody-tree__row" id="components"><span class="ody-tree__label">components</span></div><ul class="ody-tree__children">
<li class="ody-tree__item is-leaf"><div class="ody-tree__row" id="button"><span class="ody-tree__label">Button.tsx</span></div></li></ul></li></ul></li>
<li class="ody-tree__item is-leaf"><div class="ody-tree__row" id="readme"><span class="ody-tree__label">README</span></div></li></ul>`;
for (const engine of (process.env.BROWSERS || 'chromium').split(',')) describe(`core P2 / ${engine}`, () => {
  let browser;
  before(async () => { browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) }); });
  after(async () => { await browser?.close(); });
  async function fixture(t, markup, lang = 'en') {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
    await page.setContent(`<!doctype html><html lang="${lang}" data-ody-design="line"><head><title>Core P2</title><style>body{margin:16px;font-family:var(--ody-font);color:var(--ody-ink);background:var(--ody-bg)}</style></head><body><main tabindex="-1" id="fallback">${markup}</main></body></html>`);
    await page.addStyleTag({ content: css }); await page.addStyleTag({content:line}); await page.addScriptTag({ content: source });
    return page;
  }
  const active = page => page.evaluate(() => document.activeElement.id);
  test('ACT-10: update replaces one SVG, conclusion and exact label-value table without deleting host content', async t => {
    const page = await fixture(t, '<div id="chart" class="ody-chart" data-ody-chart="bar" data-values="3,7" data-labels="A,B" aria-label="Requests" data-summary="B is highest"><a id="host" href="#more">Host link</a></div>');
    assert.equal(await page.locator('#chart svg').count(), 1);
    assert.equal(await page.locator('#chart svg').getAttribute('aria-label'), 'Requests');
    assert.equal(await page.locator('#chart .ody-chart__summary').textContent(), 'B is highest');
    await page.evaluate(() => { Odyssey.updateChart('#chart', { values: [8, 2], labels: ['East, urban', '<West>'], name: 'Traffic <live>', summary: 'East leads.' }); Odyssey.renderChart(document.querySelector('#chart')); });
    assert.equal(await page.locator('#host').count(), 1);
    assert.equal(await page.locator('#chart svg').count(), 1);
    assert.equal(await page.locator('#chart details').count(), 1);
    await page.locator('#chart summary').click();
    assert.deepEqual(await page.locator('#chart tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(c => c.textContent))), [['East, urban', '8'], ['<West>', '2']]);
    assert.equal(await page.locator('#chart caption').textContent(), 'Traffic <live> — data');
    assert.equal(await page.locator('#chart svg').getAttribute('aria-label'),'Traffic <live>');
    assert.equal(await page.locator('#chart svg').getAttribute('aria-describedby'), await page.locator('#chart .ody-chart__summary').getAttribute('id'));
    await page.locator('#chart summary').focus();
    await page.evaluate(() => { const node=document.querySelector('#chart');node.setAttribute('data-values','-2,0,6');node.setAttribute('data-labels','X,Y,Z');Odyssey.renderChart(node); });
    assert.equal(await page.locator('#chart details').evaluate(node=>node.open),true);
    assert.equal(await page.locator('#chart summary').evaluate(node=>node===document.activeElement),true);
    assert.equal(await page.locator('#chart svg').count(), 1); assert.equal(await page.locator('#chart tbody tr').count(), 3);
  });
  test('ACT-10: shared adapter descriptions preserve SVG, multi-series columns, null values and explicit decorative sparks', async t => {
    const page = await fixture(t, '<div id="adapter"><svg id="custom" viewBox="0 0 20 20"><path d="M0 0L20 20"/></svg></div><span id="spark" class="ody-chart ody-chart--spark" data-ody-chart="spark" data-values="1,3,2"></span>');
    await page.evaluate(() => { const node=document.querySelector('#adapter');Odyssey.describeChart(node,{name:'Release health',summary:'Stable',columns:['Week','Success','Failure'],rows:[['W1',12,null],['W2',15,0]]});Odyssey.describeChart(node,{name:'Release health',summary:'Improving',columns:['Week','Success','Failure'],rows:[['W3',17,0]]}); });
    assert.equal(await page.locator('#custom').count(), 1); assert.equal(await page.locator('#adapter details').count(), 1);
    assert.deepEqual(await page.locator('#adapter thead th').allTextContents(), ['Week', 'Success', 'Failure']);
    assert.deepEqual(await page.locator('#adapter tbody tr').allTextContents(), ['W3170']);
    assert.equal(await page.locator('#spark').evaluate(node=>node.offsetHeight),28,'legacy unnamed spark keeps its compact contract');
    assert.equal(await page.locator('#spark svg').getAttribute('aria-hidden'), 'true');assert.equal(await page.locator('#spark table').count(), 0);
    await page.evaluate(() => Odyssey.updateChart('#spark',{values:[],decorative:false,name:'No samples'}));
    assert.equal(await page.locator('#spark svg').count(), 0);assert.equal(await page.locator('#spark .ody-chart__summary').textContent(), 'No data available.');
  });
  test('ACT-10 guide: the published example updates actual values and its conclusion', async t => {
    const start=dataGuide.indexOf('<h2 id="charts">'),end=dataGuide.indexOf('<h2 id="stepper">',start);
    const page=await fixture(t,dataGuide.slice(start,end),'zh-Hans');
    await page.getByRole('button',{name:'加载下周样例'}).click();
    assert.equal(await page.locator('#activity-chart svg').count(),1);
    assert.equal(await page.locator('#activity-chart .ody-chart__summary').textContent(),'下周样例：周四最高，为94；周一最低，为48。');
    await page.locator('#activity-chart summary').click();
    assert.deepEqual(await page.locator('#activity-chart tbody tr').nth(3).locator('th,td').allTextContents(),['Thu','94']);
    if(process.env.ODYSSEY_SCREENSHOTS){await mkdir(process.env.ODYSSEY_SCREENSHOTS,{recursive:true});await page.locator('.doc-demo').screenshot({path:`${process.env.ODYSSEY_SCREENSHOTS}/${engine}-chart-guide.png`});}
  });
  test('ACT-14: one tab stop, complete levels and visible keyboard traversal without changing native details', async t => {
    const page = await fixture(t, `${tree}<details id="native"><summary>Native disclosure</summary><p>Content</p></details>`);
    assert.equal(await page.locator('#tree [tabindex="0"]').count(), 1);
    assert.equal(await page.locator('#button').getAttribute('aria-level'), '3');assert.equal(await page.locator('#components').getAttribute('aria-posinset'), '2');assert.equal(await page.locator('#components').getAttribute('aria-setsize'), '2');
    await page.locator('#index').focus();await page.keyboard.press('ArrowUp');assert.equal(await active(page), 'src');
    await page.keyboard.press('ArrowRight');assert.equal(await active(page), 'index');
    await page.keyboard.press('ArrowDown');assert.equal(await active(page), 'components');
    await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#components').getAttribute('aria-expanded'), 'true');assert.equal(await active(page), 'components');
    await page.keyboard.press('ArrowRight');assert.equal(await active(page), 'button');
    await page.keyboard.press('ArrowLeft');assert.equal(await active(page), 'components');
    await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#components').getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('End');assert.equal(await active(page), 'readme');
    await page.keyboard.press('Home');assert.equal(await active(page), 'src');
    await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowDown');assert.equal(await active(page), 'readme');
    assert.equal(await page.locator('#index').getAttribute('aria-selected'), 'true', 'navigation does not change selection');
    await page.keyboard.press('Space');assert.equal(await page.locator('#readme').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#tree [aria-selected="true"]').count(), 1);
    await page.locator('#native summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#native').getAttribute('open'), '');assert.equal(await page.locator('#native').getAttribute('role'), null);
    const axe=await new AxeBuilder({page}).include('#tree').withRules(['aria-required-children','aria-required-parent','aria-allowed-attr','aria-allowed-role']).analyze();assert.deepEqual(axe.violations, []);
  });
  test('ACT-14: dynamic subtree reinit remains single-tab and typeahead finds named items', async t => {
    const page=await fixture(t,tree);await page.locator('#src').focus();await page.keyboard.press('r');assert.equal(await active(page),'readme');
    await page.evaluate(()=>{Odyssey.init(document.querySelector('#components'));Odyssey.init(document.querySelector('#tree'));});
    assert.equal(await page.locator('#tree [tabindex="0"]').count(),1);assert.equal(await active(page),'readme');
    const ax=await page.locator('#tree').ariaSnapshot();assert.match(ax,/tree "Project files"/);assert.match(ax,/treeitem "src"/);assert.match(ax,/treeitem "README"/);
  });
  test('A11Y-07: danger initially focuses Cancel, uniquely names and describes, resolves true and returns focus', async t => {
    const page=await fixture(t,'<button id="trigger">Remove project</button>');await page.locator('#trigger').focus();
    await page.evaluate(()=>{window.answer=undefined;Odyssey.confirm({tone:'danger',title:'Delete project?',message:'This cannot be undone.'}).then(value=>window.answer=value);});
    const dialog=page.getByRole('alertdialog',{name:'Delete project?'});assert.equal(await dialog.count(),1);assert.equal(await page.locator(':focus').textContent(),'Cancel');
    assert.equal(await dialog.getAttribute('aria-describedby'),await dialog.locator('.ody-confirm__msg').getAttribute('id'));
    const firstId=await dialog.getAttribute('aria-labelledby');await dialog.getByRole('button',{name:'Confirm',exact:true}).click();assert.equal(await page.evaluate(()=>window.answer),true);assert.equal(await active(page),'trigger');
    await page.evaluate(()=>{Odyssey.confirm({title:'Again'}).then(value=>window.answer=value);});assert.notEqual(await page.getByRole('alertdialog').getAttribute('aria-labelledby'),firstId);
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.answer),false);assert.equal(await page.locator('.ody-confirm').count(),0);assert.equal(await active(page),'trigger');
  });
  test('A11Y-07: removed trigger falls back to visible main on backdrop dismissal', async t => {
    const page=await fixture(t,'<button id="trigger">Open</button>');await page.locator('#trigger').focus();
    await page.evaluate(()=>{Odyssey.confirm({tone:'danger',title:'Delete'}).then(value=>window.answer=value);document.querySelector('#trigger').remove();});
    await page.locator('.ody-confirm__backdrop').click({position:{x:5,y:5}});assert.equal(await page.evaluate(()=>window.answer),false);assert.equal(await active(page),'fallback');
  });
  test('A11Y-08: existing descriptions survive; bubble stays while hovered and Escape removes only its own reference', async t => {
    const page=await fixture(t,'<p id="external">Existing help</p><p id="later">Later help</p><button style="margin:100px" id="tip" aria-describedby="external" data-ody-tooltip="A long supplemental description that remains available while you move into the bubble.">Details</button>');
    await page.locator('#tip').hover();const tooltip=page.getByRole('tooltip');await tooltip.waitFor();const id=await tooltip.getAttribute('id');assert.equal(await page.locator('#tip').getAttribute('aria-describedby'),`external ${id}`);
    await tooltip.hover();assert.equal(await tooltip.count(),1);assert.equal(await tooltip.evaluate(node=>getComputedStyle(node).pointerEvents),'auto');
    await page.locator('#tip').evaluate(node=>node.setAttribute('aria-describedby',`${node.getAttribute('aria-describedby')} later`));await page.keyboard.press('Escape');
    assert.equal(await tooltip.count(),0);assert.equal(await page.locator('#tip').getAttribute('aria-describedby'),'external later');
    await page.mouse.move(0,0);await page.locator('#tip').focus();assert.equal(await tooltip.count(),1);await page.keyboard.press('Tab');await page.waitForFunction(()=>!document.querySelector('[role="tooltip"]'));
  });
  test('A11Y-08: Escape dismisses tooltip before its parent modal', async t => {
    const page=await fixture(t,'<button id="open">Open</button><div class="ody-modal" id="modal" hidden><div class="ody-modal__panel"><h2>Project</h2><button id="inside" data-ody-tooltip="More detail">Help</button></div></div>');
    await page.locator('#open').focus();await page.evaluate(()=>Odyssey.openModal(document.querySelector('#modal')));
    assert.equal(await page.getByRole('tooltip').count(),1);await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);assert.equal(await page.locator('#modal').evaluate(node=>node.hidden),false);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').evaluate(node=>node.hidden),true);assert.equal(await active(page),'open');
  });
  for(const [lang,digit,remove,previous] of [['en','Digit 1','Remove Rust','Previous month'],['zh-CN','第1位','移除Rust','上个月'],['ja-JP','1桁目','Rustを削除','前の月']])test(`LIB-07: ${lang} catalog reaches generated fields, dates and user content remains exact`,async t=>{
    const page=await fixture(t,`<section lang="${lang}"><div class="ody-taginput" data-ody-taginput id="tags"><input class="ody-taginput__field"></div><div class="ody-otp" data-ody-otp data-len="4" id="otp"></div><div class="ody-datepicker" data-ody-datepicker id="date"><input class="ody-datepicker__input" readonly value="2026-10-18"><div class="ody-datepicker__panel"></div></div><button id="confirm">Open</button></section>`,'en');
    assert.equal(await page.locator('#otp input').first().getAttribute('aria-label'),digit);
    assert.match(await page.locator('#otp [data-ody-code-help]').textContent(),/4/);
    await page.locator('#tags input').fill('Rust');await page.keyboard.press('Enter');assert.equal(await page.locator('#tags button').getAttribute('aria-label'),remove);assert.match(await page.locator('#tags').textContent(),/Rust/);
    await page.locator('#date input').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#date [data-ody-dp-nav="-1"]').getAttribute('aria-label'),previous);
    await page.keyboard.press('Escape');await page.locator('#confirm').focus();await page.evaluate(()=>{Odyssey.confirm({title:'User copy <exact>'});});assert.equal(await page.locator('.ody-confirm__title').textContent(),'User copy <exact>');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>{Odyssey.i18n.register('ja',{'host.example':'{name}の準備完了'});return Odyssey.i18n.t('host.example',{name:'Odyssey'},document.querySelector('[lang="ja-JP"]'));}),lang==='ja-JP'?'Odysseyの準備完了':'host.example');
  });
  test('Line core is usable at 320px and tooltips wrap long text in reduced motion',async t=>{
    const page=await fixture(t,`<button id="tip" data-ody-tooltip="${'long-label-'.repeat(30)}">Help</button><div class="ody-chart" id="chart" data-ody-chart="bar" data-values="3,6" data-label="Requests" data-labels="A,B"></div>${tree}`);
    await page.setViewportSize({width:320,height:844});await page.locator('#tip').focus();const tip=page.getByRole('tooltip');const box=await tip.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=320);
    assert.equal(await tip.evaluate(node=>getComputedStyle(node).overflowWrap),'anywhere');
    assert.ok(await tip.evaluate(node=>getComputedStyle(node).transitionDuration.split(',').every(value=>parseFloat(value)<0.001)), 'reduced motion keeps feedback immediate');
    await page.keyboard.press('Escape');await page.locator('#chart summary').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=320));
    if(process.env.ODYSSEY_SCREENSHOTS){await mkdir(process.env.ODYSSEY_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.ODYSSEY_SCREENSHOTS}/${engine}-core-p2-320.png`,fullPage:true});}
  });
});
