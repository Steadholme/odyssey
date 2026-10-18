import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { test } from 'node:test';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const extensions = await read('js/extensions.js'), core = await read('dist/odyssey.js');
const styles = (await Promise.all(['dist/odyssey.css', 'css/line.css', 'css/extensions.css'].map(read))).join('\n');
const engines = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',');
const screenshotDir = process.env.ODYSSEY_SCREENSHOTS;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const code = (length, extra = '') => `<fieldset class="ody-ext-code" id="code" data-ody-code-input data-ody-code-name="verification_code" ${extra}><legend>Verification code</legend><div>${Array.from({length}, () => '<input inputmode="numeric">').join('')}</div><small data-ody-code-help></small><small data-ody-code-error hidden></small></fieldset>`;
const files = `<form id="form"><div id="files" class="ody-ext-file" data-ody-file-dropzone data-ody-file-max-bytes="10" data-ody-file-max-count="2"><b data-ody-file-title>Choose an attachment</b><small data-ody-file-status></small><input data-ody-file-input type="file" name="attachment" accept=".zip,image/*" multiple><button type="button" data-ody-file-browse>Browse</button><button type="button" data-ody-file-clear hidden>Clear files</button><p data-ody-file-error role="alert" hidden></p></div><button type="reset" id="reset">Reset</button></form>`;
const file = (name = 'release.zip', size = 4, mimeType = 'application/zip') => ({ name, mimeType, buffer:Buffer.alloc(size, 65) });
async function fixture(t, browser, markup, mode = 'after', lang = 'en') {
  const page = await browser.newPage({viewport:{width:1000,height:760}, reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'no uncaught browser errors'); });
  await page.setContent(`<!doctype html><html lang="${lang}" data-ody-design="line" data-theme="light"><head><style>${styles}</style><style>body{margin:20px}main{max-width:600px}button{min-height:28px}</style></head><body><main>${markup}</main></body></html>`);
  if (mode === 'before' || mode === 'alone') await page.addScriptTag({content:extensions});
  if (mode !== 'alone') await page.addScriptTag({content:core});
  if (mode === 'after') await page.addScriptTag({content:extensions});
  return page;
}
async function capture(page, selector, name) {
  await page.locator(selector).evaluate((node, name) => { node._changes=[];node.addEventListener(name,event=>node._changes.push(event.detail)); }, name);
}
const changes = (page, selector) => page.locator(selector).evaluate(node => node._changes);
const payload = page => page.locator('#form').evaluate(form => new FormData(form).get('verification_code'));
async function paste(page, selector, value) {
  await page.locator(selector).first().evaluate((node,value)=>{const transfer=new DataTransfer();transfer.setData('text',value);node.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));},value);
}
for (const engine of engines) {
  await test(`${engine}: extensions P2 contracts`, async t => {
    assert.ok(playwright[engine], `supported browser: ${engine}`);
    const browser = await playwright[engine].launch({headless:true, ...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    t.after(() => browser.close());
    await t.test('ACT-04: checked defaults, single/all/Clear/reset share one host selection event', async t => {
      const page=await fixture(t,browser,`<form id="form"><div id="selection" data-registry-selection><label><input type="checkbox" data-selection-all>All artifacts</label><label><input type="checkbox" name="asset" value="api" checked>API bundle</label><label><input type="checkbox" name="asset" value="web">Web assets</label><div data-selection-bar><b role="status" data-selection-count></b><button type="button" data-selection-clear>Clear</button></div></div><button type="reset" id="reset">Reset</button></form>`);
      assert.equal(await page.locator('[data-selection-count]').textContent(),'1 selected');
      assert.equal(await page.locator('[data-selection-all]').evaluate(node=>node.indeterminate),true);
      await capture(page,'#selection','ody:selection-change');
      await page.locator('[value="web"]').check();
      await page.locator('[data-selection-all]').uncheck();
      await page.locator('[data-selection-all]').check();
      await page.locator('[data-selection-clear]').click();
      assert.equal(await page.locator('[data-selection-bar]').isVisible(),false);
      assert.equal(await page.locator('[value="api"]').evaluate(node=>node===document.activeElement),true);
      assert.deepEqual((await changes(page,'#selection')).map(event=>event.value),[['api','web'],[],['api','web'],[]]);
      await page.locator('#reset').click();
      await page.waitForFunction(()=>document.querySelector('[data-selection-count]').textContent==='1 selected');
      assert.equal(await page.locator('[data-selection-count]').textContent(),'1 selected');
      await page.locator('[value="web"]').evaluate(node=>node.checked=true);
      await page.evaluate(()=>{OdysseyExtensions.init(document.querySelector('#selection'));OdysseyExtensions.init(document.querySelector('#selection'));});
      assert.equal(await page.locator('[data-selection-count]').textContent(),'2 selected');
      assert.equal((await changes(page,'#selection')).length,5,'re-init refreshes without synthetic host changes');
    });
    for (const length of [4,6]) for (const mode of ['alone','before','after']) {
      await t.test(`ACT-05: ${length} cells, ${mode} load: FormData/autofill/paste/error retry/reset`,async t=>{
        const page=await fixture(t,browser,`<form id="form">${code(length,'data-ody-code-required')}<button type="reset" id="reset">Reset</button></form>`,mode);
        const full='482931'.slice(0,length);
        await capture(page,'#code','ody:change');
        await page.locator('#code input:not([type="hidden"])').first().fill(full);
        assert.equal(await payload(page),full);
        assert.equal((await changes(page,'#code')).length,1);
        assert.equal(await page.locator('#form').evaluate(form=>form.checkValidity()),true);
        await page.locator('#code').evaluate(node=>{node.setAttribute('aria-invalid','true');const error=node.querySelector('[data-ody-code-error]');error.textContent='Expired code';error.hidden=false;});
        await paste(page,'#code input:not([type="hidden"])','987654'.slice(0,length));
        assert.equal(await payload(page),'987654'.slice(0,length));
        assert.equal(await page.locator('[data-ody-code-error]').isVisible(),false);
        assert.equal(await page.locator('#code').getAttribute('aria-invalid'),null);
        await page.locator('#reset').click();
        await page.waitForFunction(()=>document.querySelector('[data-ody-code-value]').value==='');
        assert.equal(await payload(page),'');
        assert.equal(await page.locator('#code input:not([type="hidden"])').evaluateAll(nodes=>nodes.every(node=>node.value==='')),true);
        assert.match(await page.locator('[data-ody-code-help]').textContent(),new RegExp(`${length} digits`));
        assert.equal(await page.locator('#form').evaluate(form=>form.checkValidity()),false);
        await page.locator('#code input:not([type="hidden"])').first().fill('1');
        await page.locator('#code input:not([type="hidden"])').nth(1).press('Backspace');
        assert.equal(await payload(page),'');
        assert.equal(await page.locator('#form').evaluate(form=>new FormData(form).getAll('verification_code').length),1);
      });
    }
    await t.test('ACT-05: preset and text code reset to defaults, custom field names remain native',async t=>{
      const page=await fixture(t,browser,`<form id="form">${code(4,'data-value="AB12" data-mode="text"')}<button type="reset" id="reset">Reset</button></form>`);
      assert.equal(await payload(page),'AB12');
      await page.locator('#code input:not([type="hidden"])').first().fill('XY34');
      assert.equal(await payload(page),'XY34');
      await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('[data-ody-code-value]').value==='AB12');assert.equal(await payload(page),'AB12');
    });
    for (const length of [4,6]) for (const mode of ['numeric','text']) {
      await t.test(`ACT-05 canonical: ${length} ${mode} OTP native value/reset/autofill/error recovery`,async t=>{
        const initial=mode==='text'?'AB12'.slice(0,length):'1234'.slice(0,length);
        const page=await fixture(t,browser,`<form id="form"><div id="legacy" class="ody-otp" data-ody-otp data-len="${length}" data-mode="${mode}" data-name="verification_code" data-value="${initial}" aria-label="Verification code"></div><button type="reset" id="reset">Reset</button></form>`);
        assert.equal(await payload(page),initial);
        await capture(page,'#legacy','ody:change');
        const full=(mode==='text'?'AB12CD':'482931').slice(0,length);
        await page.locator('.ody-otp__cell').first().fill(full);
        assert.equal(await payload(page),full);
        assert.equal((await changes(page,'#legacy')).length,1);
        assert.equal((await changes(page,'#legacy'))[0].complete,true);
        await page.locator('#legacy').evaluate(node=>node.setAttribute('aria-invalid','true'));
        await paste(page,'.ody-otp__cell',mode==='text'?'ZY98XW'.slice(0,length):'987654'.slice(0,length));
        assert.equal(await page.locator('#legacy').getAttribute('aria-invalid'),null);
        await page.locator('#reset').click();await page.waitForFunction(value=>document.querySelector('[data-ody-otp-value]').value===value,initial);
        assert.equal(await payload(page),initial);
        assert.equal(await page.locator('#form').evaluate(form=>new FormData(form).getAll('verification_code').length),1);
        assert.ok(await page.locator('.ody-otp__cell').first().getAttribute('aria-describedby'));
        await page.locator('.ody-otp__cell').last().fill('');await page.locator('.ody-otp__cell').last().press('Backspace');
        assert.equal(await payload(page),(initial.slice(0,length-2)));
      });
    }
    await t.test('ACT-06: configurable accept/size/count, valid→invalid→same file→clear and native drop',async t=>{
      const page=await fixture(t,browser,files);
      await capture(page,'#files','ody:file-change');
      const input=page.locator('[data-ody-file-input]');
      await input.setInputFiles([file(),file('photo.png',3,'image/png')]);
      assert.equal(await page.locator('[data-ody-file-title]').textContent(),'2 files selected');
      assert.equal(await page.locator('#form').evaluate(form=>new FormData(form).getAll('attachment').length),2);
      await input.setInputFiles(file('bad.txt',4,'text/plain'));
      assert.equal(await input.evaluate(node=>node.files.length),0);
      assert.equal((await changes(page,'#files')).at(-1).valid,false);
      assert.match(await page.locator('[data-ody-file-error]').textContent(),/matching/);
      await input.setInputFiles(file('big.zip',11));
      assert.equal(await input.evaluate(node=>node.files.length),0);
      await input.setInputFiles([file('a.zip'),file('b.zip'),file('c.zip')]);
      assert.match(await page.locator('[data-ody-file-error]').textContent(),/at most 2/);
      await input.setInputFiles(file());await page.locator('[data-ody-file-clear]').click();
      assert.equal(await input.evaluate(node=>node.files.length),0);
      assert.equal(await page.locator('[data-ody-file-browse]').evaluate(node=>node===document.activeElement),true);
      await input.setInputFiles(file());
      assert.equal(await page.locator('[data-ody-file-title]').textContent(),'release.zip');
      await page.locator('#reset').click();
      await page.waitForFunction(()=>document.querySelector('[data-ody-file-title]').textContent==='Choose an attachment');
      assert.equal(await page.locator('[data-ody-file-title]').textContent(),'Choose an attachment');
      await page.locator('#files').evaluate(node=>{const transfer=new DataTransfer();transfer.items.add(new File(['DATA'],'drop.zip',{type:'application/zip'}));node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});
      assert.deepEqual(await page.locator('#form').evaluate(async form=>{const file=new FormData(form).get('attachment');return[file.name,file.size,file.type,await file.text()];}),['drop.zip',4,'application/zip','DATA']);
      assert.equal(await page.locator('[data-ody-file-status]').getAttribute('role'),'status');
      await input.evaluate(node=>node.multiple=false);
      await page.locator('#files').evaluate(node=>{const transfer=new DataTransfer();transfer.items.add(new File(['A'],'a.zip'));transfer.items.add(new File(['B'],'b.zip'));node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});
      assert.equal(await input.evaluate(node=>node.files.length),0);assert.match(await page.locator('[data-ody-file-error]').textContent(),/one file/);
    });
    await t.test('ACT-06: absent accept keeps the existing ZIP contract; explicit empty accept permits all types',async t=>{
      const page=await fixture(t,browser,files.replace('accept=".zip,image/*"',''));
      await page.locator('[data-ody-file-input]').setInputFiles(file('note.txt',4,'text/plain'));
      assert.equal(await page.locator('[data-ody-file-input]').evaluate(node=>node.files.length),0);
      await page.locator('[data-ody-file-input]').evaluate(node=>node.setAttribute('accept',''));
      await page.locator('[data-ody-file-input]').setInputFiles(file('note.txt',4,'text/plain'));
      assert.equal(await page.locator('[data-ody-file-input]').evaluate(node=>node.files.length),1);
    });
    for (const orientation of ['vertical','horizontal']) {
      await t.test(`ACT-07: ${orientation} constraints, keyboard, presets, numeric input and ResizeObserver`,async t=>{
        const page=await fixture(t,browser,`<div id="split" class="ody-ext-split" data-ody-splitpane data-ody-orientation="${orientation}" data-ody-min="80" data-ody-max="300" data-ody-second-min="100" style="width:500px"><div>Explorer<button type="button" data-ody-split-preset="250">Wide</button><label>Size<input type="number" data-ody-split-value></label></div><div data-ody-splitter role="separator" tabindex="0" aria-label="Explorer size" aria-orientation="${orientation}" aria-valuenow="120"></div><div>Document</div></div>`);
        const separator=page.locator('[data-ody-splitter]');
        await capture(page,'#split','ody:resize');
        await separator.focus();await separator.press(orientation==='horizontal'?'ArrowDown':'ArrowRight');
        assert.equal(await separator.getAttribute('aria-valuenow'),'130');
        await page.locator('[data-ody-split-preset]').click();
        assert.equal(await separator.getAttribute('aria-valuenow'),orientation==='horizontal'?'244':'250');
        await page.locator('[data-ody-split-value]').fill('999');await page.locator('[data-ody-split-value]').press('Tab');
        assert.equal(await separator.getAttribute('aria-valuenow'),await separator.getAttribute('aria-valuemax'));
        await page.locator('#split').evaluate((node,orientation)=>{node.style[orientation==='horizontal'?'height':'width']='190px';},orientation);
        await page.waitForFunction(()=>document.querySelector('[data-ody-splitter]').getAttribute('aria-valuenow')==='74');
        assert.equal(await separator.getAttribute('aria-valuemin'),'74');
        assert.equal(await page.locator('#split').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
        assert.ok((await changes(page,'#split')).some(event=>event.source==='container'));
        await separator.press('Home');await separator.press('End');
        assert.equal(await separator.getAttribute('aria-valuenow'),'74');
      });
    }
    await t.test('ACT-08: actual panel dimensions, edge flip, scroll/resize/content changes and origin',async t=>{
      const page=await fixture(t,browser,`<button id="first" popovertarget="popover" style="position:absolute;left:20px;top:580px">First trigger</button><button id="second" popovertarget="popover" style="position:absolute;right:20px;top:580px">Second trigger</button><div id="popover" class="ody-ext-popover" data-ody-native-popover popover="auto"><strong>Environment</strong><p>${'Long readable content. '.repeat(12)}</p></div>`);
      await page.evaluate(()=>document.body.style.height='1800px');
      const panel=page.locator('#popover');
      await page.locator('#second').click();
      const fits=()=>panel.evaluate(node=>{const b=node.getBoundingClientRect();return b.left>=11&&b.top>=11&&b.right<=innerWidth-11&&b.bottom<=innerHeight-11;});
      await page.waitForFunction(()=>document.querySelector('#popover').dataset.odyPlacement==='top');assert.equal(await fits(),true);
      const origin=await panel.evaluate(node=>getComputedStyle(node).transformOrigin);assert.ok(parseFloat(origin)>0);
      const before=await panel.evaluate(node=>parseFloat(node.style.top));
      await page.evaluate(()=>scrollTo(0,100));
      await page.waitForFunction(old=>parseFloat(document.querySelector('#popover').style.top)!==old,before);assert.equal(await fits(),true);
      await page.setViewportSize({width:320,height:640});
      await page.waitForFunction(()=>{const b=document.querySelector('#popover').getBoundingClientRect();return b.right<=innerWidth-11;});assert.equal(await fits(),true);
      await panel.evaluate(node=>node.appendChild(Object.assign(document.createElement('p'),{textContent:'Extra content. '.repeat(90)})));
      await page.waitForFunction(()=>{const b=document.querySelector('#popover').getBoundingClientRect();return b.bottom<=innerHeight-11;});assert.equal(await fits(),true);
      await page.keyboard.press('Escape');await page.locator('#first').click();
      await page.waitForFunction(()=>parseFloat(document.querySelector('#popover').style.left)<30);
      await page.evaluate(()=>scrollTo(0,1200));
      await page.waitForFunction(()=>!document.querySelector('#popover').matches(':popover-open'));
      await page.evaluate(()=>scrollTo(0,100));await page.locator('#first').click();
      await page.waitForFunction(()=>document.querySelector('#popover').matches(':popover-open'));
      if(screenshotDir)await page.screenshot({path:`${screenshotDir}/${engine}-extensions-popover-320.png`});
    });
    for (const lang of ['en','zh-CN','ja-JP']) {
      await t.test(`LIB-07/A11Y-10: ${lang} runtime copy/font order, Command status keeps input focus`,async t=>{
        const page=await fixture(t,browser,`${code(4)}${files}<button data-ody-command-open="commands">Commands</button><dialog id="commands" data-ody-command-menu><input data-ody-command-input aria-label="Find action"><button data-ody-command-action="#target">User content remains English</button><p data-ody-command-empty hidden></p></dialog><h2 id="target">Destination</h2>`, 'after',lang);
        const expected=lang.startsWith('zh')?'输入或粘贴':lang.startsWith('ja')?'桁のコード':'Enter or paste';
        assert.ok((await page.locator('[data-ody-code-help]').textContent()).includes(expected));
        await page.locator('[data-ody-command-open]').click();await page.locator('[data-ody-command-input]').fill('nothing matches');
        assert.equal(await page.locator('[data-ody-command-input]').evaluate(node=>node===document.activeElement),true);
        assert.equal(await page.locator('[data-ody-command-empty]').getAttribute('role'),'status');
        assert.equal(await page.locator('[data-ody-command-input]').getAttribute('aria-activedescendant'),null);
        assert.ok(await page.locator('[data-ody-command-input]').getAttribute('aria-describedby'));
        assert.equal(await page.locator('[data-ody-command-action]').textContent(),'User content remains English');
        await page.locator('[data-ody-command-input]').fill('User');
        assert.equal(await page.locator('[data-ody-command-empty]').isVisible(),false);
        await page.keyboard.press('Escape');
        const font=await page.locator('#code input').first().evaluate(node=>getComputedStyle(node).getPropertyValue('--ody-font'));
        if(lang.startsWith('ja'))assert.ok(font.indexOf('Hiragino')<font.indexOf('PingFang'));
        if(lang.startsWith('zh'))assert.ok(font.indexOf('PingFang')<font.indexOf('Hiragino'));
        await page.locator('html').evaluate(node=>node.lang='ja');await page.evaluate(()=>Odyssey.init(document));
        assert.match(await page.locator('[data-ody-code-help]').textContent(),/桁のコード/);
      });
    }
  });
}
