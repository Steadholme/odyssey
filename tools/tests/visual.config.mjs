import { defineConfig } from '../browser-runtime/node_modules/playwright/test.mjs';
if (process.argv.some(arg => arg.startsWith('--update-snapshots')) && process.env.ODYSSEY_ACCEPT_VISUAL !== '1') {
  throw new Error('Inspect the actual/diff images first; approved baseline updates require ODYSSEY_ACCEPT_VISUAL=1.');
}
export default defineConfig({
  testDir: '.', testMatch: 'visual-regression.spec.mjs', workers: 1, retries: 0,
  outputDir: process.env.ODYSSEY_VISUAL_OUTPUT || '/tmp/odyssey-visual-results',
  snapshotPathTemplate: '{testDir}/visual-baselines/{platform}/{arg}{ext}',
  reporter: 'list',
  use: { browserName: 'chromium', headless: true, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' },
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', threshold: 0.2, maxDiffPixels: 0 } },
});
