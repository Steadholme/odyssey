import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ODYSSEY_BASE_URL || 'http://127.0.0.1:18300';
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE});
const evidence = process.env.ODYSSEY_SCREENSHOTS;
if (evidence) await mkdir(evidence, { recursive: true });
const errors = [];
async function surface(page) {
  const widths = await page.evaluate(() => ({ viewport:innerWidth, content:document.documentElement.scrollWidth }));
  assert.ok(widths.content <= widths.viewport + 1, JSON.stringify(widths));
}
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}, colorScheme:'light', permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' ' + response.status()); });
  await page.goto(base); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('[data-station]').count(),54);
  await surface(page);
  for (const station of await page.locator('[data-station]').all()) {
    assert.equal(await station.locator('.line-specimen').evaluate(el=>Array.from(el.children).some(child=>getComputedStyle(child).display!=='none' && child.getBoundingClientRect().width>2)),true,await station.getAttribute('data-station'));
  }
  if (evidence) { await page.screenshot({path:evidence+'/desktop.png'}); await page.locator('#line-2').screenshot({path:evidence+'/controls.png'}); }
  const search = page.locator('#station-search');
  await search.fill('BTN'); assert.equal(await page.locator('[data-station]:visible').count(),1);
  await search.fill('no-station-exists'); assert.equal(await page.locator('#station-empty').isVisible(),true);
  await search.fill('');
  const source = page.locator('#station-BTN details'); await source.locator('summary').click(); await source.locator('[data-line-copy]').click();
  assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('ody-btn--primary'));
  assert.ok(!(await source.locator('code').textContent()).includes('data-line-toast'));
  await source.locator('summary').click();
  const tab = page.locator('#demo-tab-0'); await tab.focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#demo-tab-1').getAttribute('aria-selected'),'true');
  await page.keyboard.press('End'); assert.equal(await page.locator('#demo-tab-2').getAttribute('aria-selected'),'true');
  await page.locator('#station-MDL .line-specimen button').click(); assert.equal(await page.locator('#station-modal').isVisible(),true);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#station-modal').isVisible(),false);
  assert.equal(await page.locator('#station-MDL .line-specimen button').evaluate(el=>el===document.activeElement),true);
  await page.locator('#station-DRW .line-specimen button').click(); assert.equal(await page.locator('#station-drawer').isVisible(),true);
  await page.keyboard.press('Escape');
  await page.locator('#station-TST .line-specimen button').click(); assert.equal(await page.locator('.ody-toast-region .ody-toast').count(),1);
  await page.locator('#station-TST .line-specimen button').click(); assert.equal(await page.locator('.ody-toast-region .ody-toast').count(),1);
  await page.locator('.ody-toast__close').click();
  await page.locator('#line-validation button').click(); assert.equal(await page.locator('#line-validation input').getAttribute('aria-invalid'),'true');
  await page.locator('#line-validation input').fill('ellis@studio.co'); await page.locator('#line-validation button').click();
  assert.equal(await page.locator('#validation-status').textContent(),'Field validated.');
  await page.locator('[data-ody-theme-toggle]').click(); assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await page.locator('.line-site').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 27, 23)');
  await page.locator('#line-2').scrollIntoViewIfNeeded();
  if (evidence) await page.locator('#line-2').screenshot({path:evidence+'/dark-controls.png', animations:'disabled'});
  // Scope regression: loading the additive layer must not restyle an unopted-in control.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base+'/actions.html');
  await page.locator('html').evaluate(el=>{el.removeAttribute('data-ody-design'); void el.offsetWidth; document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish());});
  const before = await page.locator('.ody-btn--primary').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius}));
  await page.locator('link[href="assets/line.css"]').evaluate(el=>el.remove());
  const after = await page.locator('.ody-btn--primary').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius}));
  assert.deepEqual(before,after);
  await context.close();
  for (const width of [768,390,320]) {
    const mobile = await browser.newContext({ viewport:{width,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce', colorScheme:'light' });
    const p = await mobile.newPage(); await p.goto(base); await p.evaluate(()=>document.fonts.ready); await surface(p);
    const tap = await p.locator('#station-BTN .ody-btn').first().boundingBox(); assert.ok(tap.height>=44);
    await p.locator('#station-BTN .ody-btn').first().focus();
    assert.equal(await p.locator('#station-BTN .ody-btn').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    if (evidence && width===390) { await p.evaluate(()=>scrollTo(0,0)); await p.screenshot({path:evidence+'/mobile.png'}); await p.locator('#line-2').screenshot({path:evidence+'/mobile-controls.png'}); }
    await mobile.close();
  }
  const nojs=await browser.newContext({javaScriptEnabled:false}); const p=await nojs.newPage(); await p.goto(base);
  assert.equal(await p.locator('[data-station]').count(),54); assert.equal(await p.locator('#cover-title').isVisible(),true); await nojs.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: 54 stations, six lines, search/empty, tabs keyboard, overlays/focus return, toast replacement, validation, theme, opt-in scope, 1440/768/390/320, touch, reduced motion, no-JS.');
} finally { await browser.close(); }
