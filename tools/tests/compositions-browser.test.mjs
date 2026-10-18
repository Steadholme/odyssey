import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fromRoot = path => new URL('../../' + path, import.meta.url);
let server;
let base = process.env.ODYSSEY_BASE_URL;
if (!base) {
  const lineFonts = await readFile(fromRoot('css/line-font.css'), 'utf8');
  const lineTokens = await readFile(fromRoot('css/line.css'), 'utf8');
  const line = lineFonts + lineTokens;
  const extensions = await readFile(fromRoot('css/expressions.css'), 'utf8') + await readFile(fromRoot('css/extensions.css'), 'utf8');
  const files = new Map([
    ['/examples/compositions/workspace-settings.html', ['text/html', await readFile(fromRoot('examples/compositions/workspace-settings.html'))]],
    ['/1.5.0/odyssey-font.css', ['text/css', await readFile(fromRoot('dist/odyssey-font.css'))]],
    ['/1.5.0/odyssey-line-font.css', ['text/css', lineFonts]],
    ['/1.5.0/odyssey-line.css', ['text/css', lineTokens]],
    ['/1.5.0/odyssey-expressions.css', ['text/css', await readFile(fromRoot('css/expressions.css'))]],
    ['/1.5.0/odyssey-extensions.css', ['text/css', await readFile(fromRoot('css/extensions.css'))]],
    ['/1.5.0/compositions.css', ['text/css', await readFile(fromRoot('css/compositions.css'))]],
    ['/1.5.0/compositions.js', ['application/javascript', await readFile(fromRoot('js/compositions.js'))]],
    ['/patterns.html', ['text/html', await readFile(fromRoot('site/patterns.html'))]],
    ['/assets/patterns-20261018-p1.js', ['application/javascript', await readFile(fromRoot('site/assets/patterns-20261018.js'))]],
    ['/assets/patterns-20261018.css', ['text/css', await readFile(fromRoot('site/assets/patterns-20261018.css'))]],
    ['/assets/line.css', ['text/css', line]],
    ['/assets/extensions.css', ['text/css', extensions]],
    ['/dist/odyssey-font.css', ['text/css', await readFile(fromRoot('dist/odyssey-font.css'))]]
  ]);
  server = createServer((request, response) => {
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    const entry = files.get(new URL(request.url, 'http://localhost').pathname);
    if (!entry) { response.writeHead(404); response.end('not found'); return; }
    response.writeHead(200, {'content-type':entry[0] + '; charset=utf-8'}); response.end(entry[1]);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
}
base = base.replace(/\/$/, '');
const evidence = process.env.ODYSSEY_SCREENSHOTS;
if (evidence) await mkdir(evidence, {recursive:true});
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE});
const errors = [];
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
async function settled(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function state(page) { return page.evaluate(() => OdysseyCompositions.mountWorkspace(document.querySelector('form[data-ody-composition]')).getState()); }
async function candidateKey(page, target, flags = {}) {
  return page.locator(target).evaluate((node, flags) => {
    const event = new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true, ...flags});
    node.dispatchEvent(event); return event.defaultPrevented;
  }, flags);
}
try {
  const context = await browser.newContext({viewport:{width:1200,height:900}});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' ' + response.status()); });
  await page.goto(base + '/examples/compositions/workspace-settings.html');
  await page.evaluate(() => document.fonts.ready);
  check(await page.locator('#main,.app-shell,.topbar,#workspace-form').count() === 0, 'fixture has no private Patterns shell or IDs');
  check(await page.evaluate(() => typeof OdysseyCompositions.mountWorkspace === 'function'), 'declared assets initialize the blank-page form');
  check(await page.locator('[data-ody-workspace-save]').isDisabled(), 'clean form starts disabled');
  check(await page.evaluate(() => { const form=document.querySelector('form'); return OdysseyCompositions.init(form)[0] === OdysseyCompositions.init(document)[0]; }), 'root/subtree initialization is idempotent');
  await page.evaluate(() => { window.savedEvents=[]; document.querySelector('form').addEventListener('ody:workspace-save', e=>savedEvents.push(e.detail)); });
  await page.locator('[data-ody-workspace-name]').fill('A');
  await page.locator('[data-ody-workspace-slug]').fill('Admin!');
  await page.locator('[data-ody-workspace-save]').click();
  check(await page.locator('[data-ody-workspace-name]').evaluate(n=>document.activeElement===n), 'first invalid input receives focus');
  const described = await page.locator('[data-ody-workspace-name]').getAttribute('aria-describedby');
  check(described.includes('name-help') && described.split(/\s+/).length === 2, 'existing help and generated error IDs are both described');
  check(await page.locator('[data-ody-workspace-error="name"]').isVisible(), 'field error is visible');
  await page.locator('[data-ody-workspace-name]').fill('North Labs');
  await page.locator('[data-ody-workspace-slug]').fill('admin');
  check((await page.locator('[data-ody-workspace-error="slug"]').innerText()).includes('reserved'), 'reserved slug is explained');
  await page.locator('[data-ody-workspace-slug]').fill('north-labs');
  await page.locator('[data-ody-workspace-save]').click();
  check((await state(page)).value.name === 'North Labs' && !(await state(page)).dirty, 'local save commits the edited value');
  check((await page.locator('[data-ody-workspace-status]').innerText()).includes('locally'), 'no-adapter result is explicitly local');
  check(await page.evaluate(()=>savedEvents.length===1&&savedEvents[0].mode==='local'), 'reinitialization did not duplicate save handlers');
  await page.evaluate(() => { const controller=OdysseyCompositions.mountWorkspace(document.querySelector('form')); const snapshot=controller.getState(); snapshot.value.name='External mutation'; controller.setDraft({name:'Unsaved draft',slug:'unsaved-draft'}); });
  check((await state(page)).value.name === 'North Labs', 'getState returns detached data');
  await page.locator('[data-ody-workspace-discard]').click();
  check(await page.locator('[data-ody-workspace-name]').inputValue() === 'North Labs', 'discard restores confirmed value');
  await page.evaluate(() => {
    const form=document.querySelector('form');
    window.controller=OdysseyCompositions.mountWorkspace(form,{value:{name:'Hosted workspace',slug:'hosted-workspace'},onSave:(value)=>new Promise((resolve,reject)=>{window.hostResult={resolve,reject,value};})});
  });
  await page.locator('[data-ody-workspace-name]').fill('Confirmed by host');
  await page.locator('[data-ody-workspace-save]').click();
  check((await state(page)).status === 'saving', 'host adapter attached after automatic initialization still waits for confirmation');
  check(await page.locator('[data-ody-workspace-name]').evaluate(n=>n.readOnly), 'pending form cannot overwrite its submitted draft');
  check(await page.locator('[data-ody-workspace-discard]').isDisabled(), 'pending operation is not silently discarded');
  await page.evaluate(() => hostResult.reject(new Error('Save denied by host.')));
  await page.waitForFunction(() => controller.getState().status === 'error');
  check((await state(page)).value.name === 'Hosted workspace' && (await state(page)).draft.name === 'Confirmed by host', 'rejected save retains draft and previous confirmed value');
  check(await page.locator('[data-ody-workspace-error="save"]').evaluate(n=>document.activeElement===n), 'save failure receives focus');
  check(!await page.locator('[data-ody-workspace-name]').evaluate(n=>n.readOnly), 'failure restores editing');
  await page.locator('[data-ody-workspace-save]').click();
  await page.evaluate(() => hostResult.resolve({...hostResult.value,name:'Canonical host name'}));
  await page.waitForFunction(() => controller.getState().status === 'saved');
  check((await state(page)).value.name === 'Canonical host name', 'only the host-confirmed canonical value commits');
  check(await page.evaluate(() => savedEvents.at(-1).mode === 'host-confirmed'), 'confirmed event distinguishes host acknowledgement');
  await page.evaluate(() => {
    const original=document.querySelector('form'), second=original.cloneNode(true);
    second.querySelectorAll('[id]').forEach(node=>node.id='second-'+node.id);
    second.querySelectorAll('label[for]').forEach(node=>node.htmlFor='second-'+node.htmlFor);
    second.querySelectorAll('[aria-describedby]').forEach(node=>node.setAttribute('aria-describedby',node.getAttribute('aria-describedby').split(/\s+/).map(id=>'second-'+id).join(' ')));
    second.dataset.fixture='second'; document.body.append(second);
    window.secondController=OdysseyCompositions.mountWorkspace(second,{value:{name:'Second workspace',slug:'second-workspace'}});
    OdysseyCompositions.init(document); OdysseyCompositions.init(second);
  });
  await page.locator('[data-fixture=second] [data-ody-workspace-name]').fill('Second edited');
  check((await state(page)).value.name === 'Canonical host name', 'second root does not alter first root');
  check(await page.evaluate(()=>secondController.getState().dirty), 'second root owns its own draft');
  await page.locator('[data-fixture=second] [data-ody-workspace-name]').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'zhong'})));
  check(await candidateKey(page,'[data-fixture=second] [data-ody-workspace-name]'), 'tracked candidate Enter is cancelled before native form submit');
  await page.locator('[data-fixture=second] [data-ody-workspace-name]').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'})));
  check(await candidateKey(page,'[data-fixture=second] [data-ody-workspace-name]',{isComposing:true}), 'isComposing candidate Enter is cancelled');
  check(await candidateKey(page,'[data-fixture=second] [data-ody-workspace-name]',{keyCode:229}), 'legacy 229 candidate Enter is cancelled');
  await page.locator('[data-fixture=second] [data-ody-workspace-name]').press('Enter');
  check(await page.evaluate(()=>secondController.getState().value.name==='Second edited'), 'normal Enter works after compositionend');
  await page.setViewportSize({width:320,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'standalone composition fits 320px');
  check(parseFloat(await page.locator('[data-ody-workspace-name]').first().evaluate(n=>getComputedStyle(n).fontSize))>=16, 'phone input keeps 16px type');
  if (evidence) await page.screenshot({path:evidence+'/composition-standalone-320.png',fullPage:true});
  await page.goto(base + '/patterns.html?view=settings');
  await page.evaluate(() => document.fonts.ready);
  check(await page.evaluate(()=>OdysseyCompositions.mountWorkspace(document.querySelector('#workspace-form')).getState().value.name==='Acme Studio'), 'Patterns consumes the same public workspace controller');
  await page.locator('#workspace-name').fill('A');
  await page.locator('#workspace-slug').fill('Admin!');
  await page.locator('#save-workspace').click();
  check(await page.locator('#name-error').isVisible()&&await page.locator('#slug-error').isVisible(), 'Patterns exposes the shared validator errors');
  check(await page.evaluate(()=>document.activeElement.id)==='workspace-name', 'Patterns invalid submission still focuses its first error');
  await page.locator('#workspace-name').fill('Acme Composed');
  await page.locator('#workspace-slug').fill('acme-composed');
  await page.locator('#save-workspace').click();
  check((await page.locator('[data-workspace-name]').innerText())==='Acme Composed', 'Patterns host adapter persists and updates its shell');
  await page.locator('#workspace-name').fill('Keep this draft');
  await page.locator('[data-nav=inbox]').click();
  check(await page.locator('#leave-dialog').evaluate(n=>n.open), 'shared composition dirty state still guards host navigation');
  await page.locator('#leave-keep').click();await settled(page);
  check(await page.locator('#workspace-name').inputValue()==='Keep this draft'&&await page.evaluate(()=>document.activeElement.id)==='workspace-name', 'cancelled navigation keeps draft and field focus');
  await page.locator('#expression-control').selectOption('soft');
  check(await page.locator('#workspace-name').inputValue()==='Keep this draft', 'appearance change preserves composition draft');
  await page.locator('[data-nav=inbox]').click();await page.locator('#leave-discard').click();await settled(page);
  check((await page.locator('#page-title').innerText()).includes('important things'), 'discard and leave still reaches the host destination');
  await page.locator('[data-nav=settings]').click();
  check(await page.locator('#workspace-name').inputValue()==='Acme Composed', 'remount restores host-confirmed workspace');
  await page.locator('#workspace-name').fill('Discard this');await page.locator('#discard-workspace').click();
  check(await page.locator('#workspace-name').inputValue()==='Acme Composed', 'shared discard retains host notification and restores data');
  await page.locator('#expression-control').selectOption('line');
  await page.locator('#command-open').click();
  await page.locator('#command-search').fill('inbox');
  await page.locator('#command-search').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'zhong'})));
  await page.locator('#command-search').press('Enter');
  check(await page.locator('#command-dialog').evaluate(n=>n.open), 'tracked command-menu candidate Enter does not execute');
  await page.locator('#command-search').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'})));
  await candidateKey(page,'#command-search',{isComposing:true});
  check(await page.locator('#command-dialog').evaluate(n=>n.open), 'isComposing command-menu candidate does not execute');
  await candidateKey(page,'#command-search',{keyCode:229});
  check(await page.locator('#command-dialog').evaluate(n=>n.open), '229 command-menu candidate does not execute');
  await page.locator('#command-search').press('Enter'); await settled(page);
  check((await page.locator('#page-title').innerText()).includes('important things'), 'command executes normally after compositionend');
  check(await page.evaluate(()=>document.activeElement.id)==='page-title', 'command still hands focus to its destination');
  await page.locator('#inbox-search').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'に'})));
  await page.locator('#inbox-search').press('Control+k');
  check(!await page.locator('#command-dialog').evaluate(n=>n.open), 'tracked IME shortcut does not open command menu');
  await page.locator('#inbox-search').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'日'})));
  for(const flags of [{isComposing:true},{keyCode:229}]){
    await page.locator('#inbox-search').evaluate((node,flags)=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true,...flags})),flags);
    check(!await page.locator('#command-dialog').evaluate(n=>n.open), 'flagged IME shortcut does not open command menu');
  }
  await page.locator('#inbox-search').press('Control+k');
  check(await page.locator('#command-dialog').evaluate(n=>n.open), 'ordinary shortcut remains available');
  await page.keyboard.press('Escape');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Patterns remains usable at 320px');
  if (evidence) await page.screenshot({path:evidence+'/patterns-composition-320.png',fullPage:true});
  check(errors.length===0, 'no page or asset errors: '+errors.join('; '));
  console.log(`PASS ${checks} composition/Patterns assertions: independent declared assets, host success/rejection, isolated roots, descriptions, idempotence, 320px, and synthetic IME protocol.`);
  await context.close();
} finally {
  await browser.close();
  if (server) await new Promise(resolve=>server.close(resolve));
}
