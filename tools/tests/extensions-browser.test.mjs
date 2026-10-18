import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ODYSSEY_BASE_URL || 'http://127.0.0.1:18302';
const evidence = process.env.ODYSSEY_SCREENSHOTS;
if (evidence) await mkdir(evidence, { recursive:true });
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE});
const errors = [];
try {
  const context = await browser.newContext({viewport:{width:1440,height:1100},colorScheme:'light'});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' ' + response.status()); });
  await page.goto(base); await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(await page.locator('[data-family]').evaluateAll(nodes=>nodes.map(n=>n.querySelectorAll('[data-station]').length)),[10,11,10,9,8,6]);
  assert.deepEqual(await page.locator('[id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)}),[]);
  await page.locator('[data-ody-command-open]').click();
  assert.equal(await page.locator('[data-ody-command-input]').evaluate(n=>n===document.activeElement),true);
  assert.equal(await page.locator('#registry-command').evaluate(n=>n.getAnimations().length),0);
  await page.locator('[data-ody-command-input]').fill('no results'); assert.equal(await page.locator('[data-ody-command-empty]').isVisible(),true);
  await page.locator('[data-ody-command-input]').fill('input'); await page.keyboard.press('Enter'); assert.equal(await page.locator('#registry-command').evaluate(n=>n.open),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'line-3');
  await page.locator('#station-OTP input').first().fill('482931'); assert.match(await page.locator('#station-OTP [data-ody-code-help]').textContent(),/complete/);
  await page.locator('#station-UPL input[type=file]').setInputFiles({name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('test')}); assert.equal(await page.locator('#station-UPL [role=alert]').isVisible(),true);
  await page.locator('#station-UPL input[type=file]').setInputFiles({name:'release.zip',mimeType:'application/zip',buffer:Buffer.from('example')}); assert.match(await page.locator('#station-UPL [data-ody-file-status]').textContent(),/not uploaded/);
  await page.locator('[data-selection-clear]').click(); assert.equal(await page.locator('[data-selection-bar]').isVisible(),false);
  await page.locator('[data-registry-selection] input').first().check();assert.match(await page.locator('[data-selection-count]').textContent(),/1 selected/);
  await page.locator('#station-TRE button').nth(1).click();assert.equal(await page.locator('#station-TRE button').nth(1).getAttribute('aria-current'),'page');
  await page.locator('#station-SPL [role=separator]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#station-SPL [role=separator]').getAttribute('aria-valuenow'),'108');
  await page.locator('#station-POV [popovertarget]').first().click(); assert.equal(await page.locator('#registry-popover').evaluate(n=>n.matches(':popover-open')),true);await page.keyboard.press('Escape');
  await page.locator('#station-ACD .line-specimen summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#station-ACD .ody-ext-disclosure').getAttribute('open'),null);
  for (const expression of ['line','soft','studio','signal']) {
    await page.locator('[data-ody-expression-select]').selectOption(expression);
    for (const mode of ['light','dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== mode) await page.locator('[data-ody-theme-toggle]').click();
      assert.equal(await page.locator('html').getAttribute('data-expression'),expression);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('#station-OTP input').first().inputValue(),'4');
    }
    if (evidence) await page.locator('#line-3').screenshot({path:evidence+'/registry-'+expression+'-dark.png'});
  }
  await page.locator('[data-ody-expression-select]').selectOption('soft');
  await page.locator('.line-top a[href*="getting-started"]').click();assert.equal(await page.locator('html').getAttribute('data-expression'),'soft');
  for(const route of ['actions','forms','data-display','feedback','navigation','typography','layout','overlays','tokens']) {
    await page.goto(base+'/'+route+'.html?expression=studio');assert.equal(await page.locator('[data-ody-expression-select]').inputValue(),'studio');
  }
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});await page.goto(base+'/navigation.html?expression=soft');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('[data-doc-nav-toggle]').isVisible(),true);
    assert.equal(await page.locator('[data-ody-theme-toggle]').isVisible(),true);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(base+'/studio.html'); await page.evaluate(()=>document.fonts.ready);
  await page.locator('#project-name').fill('odyssey-54');
  for (const expression of ['line','soft','studio','signal']) {
    await page.locator('.expression-picker [data-expression='+expression+']').click();
    for (const mode of ['light','dark']) {
      if (await page.locator('html').getAttribute('data-theme')!==mode) await page.locator('#theme').click();
      assert.equal(await page.locator('#project-name').inputValue(),'odyssey-54');
      assert.equal(await page.locator('#expression-name').textContent(),expression.toUpperCase());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    if(evidence) await page.locator('.workbench').screenshot({path:evidence+'/studio-'+expression+'-dark.png'});
  }
  await page.locator('#command-trigger').click();await page.locator('#command-search').fill('save');await page.keyboard.press('Enter');assert.equal(await page.locator('#confirm').evaluate(n=>n.open),true);await page.keyboard.press('Escape');
  await page.locator('#review-trigger').click();await page.waitForTimeout(260);assert.equal(await page.locator('#review-project').textContent(),'odyssey-54');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'review-trigger');
  await page.locator('.code-cells input').first().fill('123456');assert.match(await page.locator('#code-help').textContent(),/complete/);
  await page.locator('#file-input').setInputFiles({name:'release.zip',mimeType:'application/zip',buffer:Buffer.from('preview')});assert.match(await page.locator('#upload-detail').textContent(),/not uploaded/);
  await page.locator('#splitter').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#splitter').getAttribute('aria-valuenow'),'198');
  await page.locator('input[name=asset]').first().check();await page.locator('#archive').click();assert.equal(await page.locator('.asset-list label:visible').count(),2);await page.locator('#undo').click();assert.equal(await page.locator('.asset-list label:visible').count(),3);await page.locator('#toast-close').click();
  await page.locator('#environment-trigger').click();await page.locator('[data-environment=Preview]').click();await page.locator('#review-trigger').click();assert.equal(await page.locator('#review-environment').textContent(),'Preview');await page.keyboard.press('Escape');
  await page.locator('#tab-overview').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#activity').isVisible(),true);assert.equal(await page.locator('#tab-indicator').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
  await page.locator('#tab-drafts').click();assert.equal(await page.locator('.empty-state').isVisible(),true);await page.locator('#create-draft').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'project-name');
  await page.locator('[data-demo=toast]').click();await page.locator('[data-demo=toast]').click();assert.match(await page.locator('#toast-title').textContent(),/2/);assert.equal(await page.locator('.toast').count(),1);await page.locator('#toast-close').click();
  await page.evaluate(()=>{const d=document.querySelector('#review');d.showModal();d.close();d.showModal();d.close();d.showModal()});await page.waitForTimeout(260);assert.equal(await page.locator('#review').evaluate(n=>n.open),true);await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#review-trigger').click();assert.equal(await page.locator('#review').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');assert.equal(await page.locator('#review').evaluate(n=>getComputedStyle(n).transform),'none');await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#reduce').check();assert.equal(await page.locator('#tab-indicator').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');await page.locator('#reduce').uncheck();
  for(const width of [768,390,320]) {
    await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(evidence&&width===390)await page.screenshot({path:evidence+'/studio-mobile.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('PASS: 12 new registry stations, 4 expressions × 2 modes on library/studio, sources/unique IDs, guides, CMD/OTP/upload/tree/split/popover/selection, native layers/focus/Escape, repeat/reversal, keyboard and reduced motion, 1440/768/390/320.');
} finally { await browser.close(); }
