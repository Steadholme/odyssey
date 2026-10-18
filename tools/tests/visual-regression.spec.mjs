import { test, expect } from '../browser-runtime/node_modules/playwright/test.mjs';
const origin = (process.env.ODYSSEY_BASE_URL || 'http://127.0.0.1:18771').replace(/\/$/, '');
const release = process.env.ODYSSEY_RELEASE || '/1.5.0';
const cases = [
  { name: 'line-light-desktop', expression: 'line', theme: 'light', width: 960 },
  { name: 'line-dark-mobile', expression: 'line', theme: 'dark', width: 320 },
  { name: 'soft-light-desktop', expression: 'soft', theme: 'light', width: 960 },
  { name: 'signal-dark-layer', expression: 'signal', theme: 'dark', width: 640, layer: true },
];
function fixture({ expression, theme, layer }) {
  return `<!doctype html><html lang="en" data-ody-design="line" data-expression="${expression}" data-theme="${theme}" data-motion="reduced"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${['odyssey-font.css','odyssey.css','odyssey-line-font.css','odyssey-line.css','odyssey-expressions.css','odyssey-extensions.css'].map(file=>`<link rel="stylesheet" href="${release}/${file}">`).join('')}
<script defer src="${release}/odyssey.js"></script><script defer src="${release}/odyssey-extensions.js"></script>
<style>body{margin:0;background:var(--ody-bg);color:var(--ody-ink);font-family:var(--ody-font)}main{padding:24px;max-width:900px;margin:auto}h1{font-family:var(--ody-font-display);font-size:28px;margin:0 0 12px}p{line-height:1.5}section{margin-top:24px}.actions{display:flex;gap:8px;flex-wrap:wrap}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}label:not(.ody-switch){display:grid;gap:8px}.ody-table-wrap{margin-top:16px}*{animation:none!important;transition:none!important}</style></head><body class="ody-scope"><main>
<p>ODYSSEY / LINE SYSTEM</p><h1>A considered release</h1><p>Production components, predictable states.</p>
<div class="actions"><button class="ody-btn ody-btn--primary">Publish release</button><button class="ody-btn ody-btn--secondary">Review changes</button><button class="ody-btn" disabled>Unavailable</button></div>
<section class="fields"><label>Workspace<input class="ody-input" value="Odyssey Studio"></label><label>Environment<select class="ody-select"><option>Production</option></select></label><label class="ody-switch"><span class="ody-switch__control"><input type="checkbox" checked><span class="ody-switch__track"></span></span><span>Notify workspace members</span></label></section>
<section><div class="ody-alert ody-alert--ok" role="status">All checks passed. Ready for review.</div><div class="ody-table-wrap" tabindex="0"><table class="ody-table"><thead><tr><th>Component</th><th>State</th><th>Version</th></tr></thead><tbody><tr><td>Input controls</td><td><span class="ody-pill ody-pill--ok">Ready</span></td><td>1.5.0</td></tr><tr><td>Workflow recovery</td><td>Review</td><td>1.5.0</td></tr></tbody></table></div></section>
<div class="ody-modal" id="review" role="dialog" aria-modal="true" aria-labelledby="review-title" hidden><div class="ody-modal__backdrop"></div><section class="ody-modal__panel"><header class="ody-modal__head"><h2 id="review-title">Publish Odyssey?</h2></header><div class="ody-modal__body"><p>This release keeps Line as its primary expression.</p></div><footer class="ody-modal__foot"><button class="ody-btn ody-btn--secondary">Cancel</button><button class="ody-btn ody-btn--primary">Publish</button></footer></section></div>
</main></body></html>`;
}
for (const item of cases) test(item.name, async ({ page }) => {
  await page.setViewportSize({ width: item.width, height: 760 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ' ' + response.status()); });
  await page.route(origin + '/__odyssey-visual', route => route.fulfill({ contentType: 'text/html', body: fixture(item) }));
  await page.goto(origin + '/__odyssey-visual');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('data-expression', item.expression);
  if (item.layer) await page.locator('#review').evaluate(node => window.Odyssey.openModal(node));
  if (process.env.ODYSSEY_VISUAL_PROBE === '1') await page.locator('h1').evaluate(node => node.style.color = '#ff00ff');
  await expect(page).toHaveScreenshot(item.name + '.png');
  expect(errors).toEqual([]);
});
