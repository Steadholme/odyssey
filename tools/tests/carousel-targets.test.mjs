import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { test, before, after } from 'node:test';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const css = (await Promise.all(['dist/odyssey.css', 'css/line.css'].map(read))).join('\n');
const runtime = await read('dist/odyssey.js'), guide = await read('site/feedback.html');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE }); });
after(async () => { await browser?.close(); });
for (const theme of ['light', 'dark']) for (const touch of [false, true]) {
  test(`Carousel target boxes preserve small marks: ${theme}, ${touch ? 'coarse' : 'fine'}`, async t => {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    t.after(() => page.close()); page.setDefaultTimeout(3000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const markup = await page.evaluate(html => new DOMParser().parseFromString(html, 'text/html').querySelector('[data-ody-carousel]').outerHTML, guide);
    await page.setContent(`<!doctype html><html lang="en" data-ody-design="line" data-theme="${theme}"><body><main>${markup}</main></body></html>`);
    await page.addStyleTag({ content: css }); await page.addScriptTag({ content: runtime }); assert.deepEqual(errors, []);
    const dots = page.locator('.ody-carousel__dot'); await dots.first().waitFor(); assert.equal(await dots.count(), 3);
    const boxes = await dots.evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect(), mark = getComputedStyle(node, '::before');
      return { x: box.x, y: box.y, right: box.right, width: box.width, height: box.height, markWidth: mark.width, markHeight: mark.height, background: getComputedStyle(node).backgroundColor };
    }));
    boxes.forEach((box, i) => {
      assert.equal(box.width, touch ? 44 : 24); assert.equal(box.height, touch ? 44 : 24);
      assert.equal(box.markWidth, i === 0 ? '22px' : '8px'); assert.equal(box.markHeight, '8px');
      assert.equal(box.background, 'rgba(0, 0, 0, 0)'); if (i) assert.ok(boxes[i - 1].right <= box.x, 'separate, non-overlapping targets');
    });
    // A click in transparent padding, outside the visible mark, still selects that slide.
    await dots.nth(2).click({ position: { x: 2, y: 2 } }); assert.equal(await dots.nth(2).getAttribute('aria-current'), 'true');
    assert.equal(await dots.nth(2).evaluate(node => getComputedStyle(node, '::before').width), '22px');
    await dots.nth(1).focus(); await page.keyboard.press('Enter'); assert.equal(await dots.nth(1).getAttribute('aria-current'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.ODYSSEY_SCREENSHOTS && !touch) {
      await mkdir(process.env.ODYSSEY_SCREENSHOTS, { recursive: true });
      await page.locator('.ody-carousel__dots').screenshot({ path: process.env.ODYSSEY_SCREENSHOTS + `/carousel-dots-${theme}.png` });
    }
    await page.emulateMedia({ forcedColors: 'active' });
    const forced = await dots.evaluateAll(nodes => nodes.map(node => ({ fill: getComputedStyle(node, '::before').backgroundColor, adjustment: getComputedStyle(node, '::before').forcedColorAdjust })));
    forced.forEach(mark => assert.equal(mark.adjustment, 'none')); assert.notEqual(forced[0].fill, forced[1].fill);
    assert.deepEqual(errors, []);
  });
}
