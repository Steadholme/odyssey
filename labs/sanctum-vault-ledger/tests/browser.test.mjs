// Browser gate for the synthetic Sanctum Vault Ledger lab. Zero network, file:// only.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LAB = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = path.resolve(LAB, "..", "..", "..");
const SITEFLOW_PACKAGE = path.join(REPO_ROOT, "siteflow", "package.json");
const CHROMIUM_PATH = "/usr/bin/chromium";
const SCREENSHOTS = path.join(REPO_ROOT, ".workflow", ".scratchpad", "sanctum-vault-ledger");

const skipReasons = [];
let chromium = null;
if (!existsSync(SITEFLOW_PACKAGE)) {
  skipReasons.push(`repository playwright host package missing at ${SITEFLOW_PACKAGE}`);
} else {
  try {
    ({ chromium } = createRequire(SITEFLOW_PACKAGE)("playwright"));
  } catch (error) {
    skipReasons.push(`playwright not loadable from ${SITEFLOW_PACKAGE}: ${error.message}`);
  }
}
if (!existsSync(CHROMIUM_PATH)) skipReasons.push(`chromium executable missing at ${CHROMIUM_PATH}`);
const SKIP = skipReasons.length > 0 ? skipReasons.join("; ") : false;

const WIDTHS = [320, 390, 768, 1440];
const pageUrl = (name) => pathToFileURL(path.join(LAB, name)).href;
const viewportFor = (width) => ({ width, height: width >= 1000 ? 900 : 844 });

test("sanctum-vault-ledger browser gate", { skip: SKIP }, async (t) => {
  mkdirSync(SCREENSHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());

  const openPage = async (name, width, options = {}) => {
    const context = await browser.newContext({ viewport: viewportFor(width), ...options });
    const page = await context.newPage();
    const errors = { console: 0, page: 0 };
    page.on("console", (message) => { if (message.type() === "error") errors.console += 1; });
    page.on("pageerror", () => { errors.page += 1; });
    await page.goto(pageUrl(name), { waitUntil: "domcontentloaded" });
    return { context, page, errors };
  };

  const overflow = (page) => page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  await t.test("register reflows at every frozen width without hiding the due column", async () => {
    for (const width of WIDTHS) {
      const { context, page, errors } = await openPage("index.html", width, { javaScriptEnabled: false });
      const measured = await overflow(page);
      assert.ok(
        measured.root <= measured.client && measured.body <= measured.client,
        `register page overflows at ${width}px: ${JSON.stringify(measured)}`,
      );
      assert.equal(await page.locator(".vault-line[data-vault-id]").count(), 8);
      assert.equal(await page.locator('.vault-line[data-state="expiring"]').count(), 1);
      assert.ok(await page.locator('.vault-line[data-state="expiring"] .vault-due').isVisible(), `due hidden at ${width}px`);
      assert.ok(await page.locator('.vault-line[data-state="expiring"] .vault-seal').isVisible(), `seal hidden at ${width}px`);
      assert.ok(await page.locator("nav[aria-label]").isVisible());
      assert.equal(await page.locator("h1").count(), 1);
      assert.deepEqual(errors, { console: 0, page: 0 });
      await page.screenshot({ path: path.join(SCREENSHOTS, `register-${width}.png`), fullPage: true });
      await context.close();
    }
  });

  await t.test("dossier stays closed by default and native reveal works without JavaScript", async () => {
    for (const width of WIDTHS) {
      const { context, page, errors } = await openPage("secret.html", width, { javaScriptEnabled: false });
      const measured = await overflow(page);
      assert.ok(
        measured.root <= measured.client && measured.body <= measured.client,
        `dossier page overflows at ${width}px: ${JSON.stringify(measured)}`,
      );
      const details = page.locator("details.vault-seal");
      assert.equal(await details.count(), 1);
      assert.equal(await details.getAttribute("open"), null, "seal must never auto-reveal");
      const summary = details.locator("summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.ok(await details.evaluate((node) => node.open), `native reveal failed at ${width}px`);
      assert.equal(await page.locator(".vault-chain > li").count(), 4);
      assert.deepEqual(errors, { console: 0, page: 0 });
      await page.screenshot({ path: path.join(SCREENSHOTS, `dossier-${width}.png`), fullPage: true });
      await context.close();
    }
  });

  await t.test("skip link is first focusable and visibly enters the page", async () => {
    for (const name of ["index.html", "secret.html"]) {
      const { context, page } = await openPage(name, 390, { javaScriptEnabled: false });
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        href: document.activeElement?.getAttribute("href"),
        rect: document.activeElement?.getBoundingClientRect().toJSON(),
        outline: getComputedStyle(document.activeElement).outlineStyle,
        width: getComputedStyle(document.activeElement).outlineWidth,
      }));
      assert.equal(focused.tag, "A");
      assert.equal(focused.href, "#main");
      assert.ok(focused.rect && focused.rect.width > 0 && focused.rect.height > 0 && focused.rect.bottom > 0);
      assert.equal(focused.outline, "solid");
      assert.ok(parseFloat(focused.width) >= 2);
      await context.close();
    }
  });

  await t.test("forced colors preserves structural rules, state words, and seal shapes", async () => {
    for (const name of ["index.html", "secret.html"]) {
      const { context, page } = await openPage(name, 390, { javaScriptEnabled: false });
      await page.emulateMedia({ forcedColors: "active" });
      const state = await page.locator("[data-state]").first();
      const seal = state.locator(".vault-seal").first();
      assert.ok(await state.isVisible());
      assert.ok(await seal.isVisible());
      const sealStyle = await seal.evaluate((node) => {
        const style = getComputedStyle(node);
        return { borderStyle: style.borderStyle, borderWidth: style.borderWidth };
      });
      assert.notEqual(sealStyle.borderStyle, "none");
      assert.ok(parseFloat(sealStyle.borderWidth) >= 1);
      const text = (await state.innerText()).toUpperCase();
      assert.match(text, /SEALED|EXPIRING|EXPIRED|REVOKED/);
      await page.screenshot({ path: path.join(SCREENSHOTS, `${path.basename(name, ".html")}-forced-colors.png`), fullPage: true });
      await context.close();
    }
  });

  await t.test("reduced motion removes every transition and animation", async () => {
    const { context, page } = await openPage("secret.html", 390, { javaScriptEnabled: false });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const offenders = await page.locator("*").evaluateAll((nodes) => nodes.flatMap((node) => {
      const style = getComputedStyle(node);
      const durations = (value) => value.split(",").map((part) => part.trim());
      const moving = [...durations(style.transitionDuration), ...durations(style.animationDuration)]
        .some((duration) => duration !== "0s" && duration !== "0ms");
      return moving ? [{ tag: node.tagName, className: node.className, transition: style.transitionDuration, animation: style.animationDuration }] : [];
    }));
    assert.deepEqual(offenders, []);
    await context.close();
  });

  await t.test("200 percent zoom keeps both documents inside the effective viewport", async () => {
    for (const name of ["index.html", "secret.html"]) {
      const { context, page } = await openPage(name, 1280, { javaScriptEnabled: false });
      await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
      const measured = await overflow(page);
      assert.ok(
        measured.root <= measured.client && measured.body <= measured.client,
        `${name} overflows at 200% zoom: ${JSON.stringify(measured)}`,
      );
      await context.close();
    }
  });
});
