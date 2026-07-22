// Browser gate for the Beacon Two Faces lab.
// Reuses the repository Playwright install (siteflow/node_modules) and the system
// Chromium at /usr/bin/chromium, following the loading pattern of
// tools/odyssey-gate-browser.mjs. Skips with a precise reason only when a
// dependency or the executable is genuinely absent. Zero network: file:// only.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LAB = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = path.resolve(LAB, "..", "..", "..");
const SITEFLOW_PACKAGE = path.join(REPO_ROOT, "siteflow", "package.json");
const CHROMIUM_PATH = "/usr/bin/chromium";
const SCREENSHOTS = path.join(REPO_ROOT, ".workflow", ".scratchpad", "beacon-two-faces");

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
if (!existsSync(CHROMIUM_PATH)) {
  skipReasons.push(`chromium executable missing at ${CHROMIUM_PATH}`);
}
const SKIP = skipReasons.length > 0 ? skipReasons.join("; ") : false;

const pageUrl = (name) => pathToFileURL(path.join(LAB, name)).href;
const WIDTHS = [320, 390, 1440];
const viewportFor = (width) => ({ width, height: width >= 1000 ? 900 : 844 });

const operatorFixture = JSON.parse(readFileSync(path.join(LAB, "fixtures", "operator-checks.fixture.json"), "utf8"));

test("beacon-two-faces browser gate", { skip: SKIP }, async (t) => {
  mkdirSync(SCREENSHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());

  const openPage = async (name, width, contextOptions = {}) => {
    const context = await browser.newContext({ viewport: viewportFor(width), ...contextOptions });
    const page = await context.newPage();
    const errors = { console: 0, page: 0 };
    page.on("console", (message) => { if (message.type() === "error") errors.console += 1; });
    page.on("pageerror", () => { errors.page += 1; });
    await page.goto(pageUrl(name), { waitUntil: "domcontentloaded" });
    return { context, page, errors };
  };

  const widths = (page) => page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  await t.test("publication surface: 24 rows, no overflow, nav visible, headline above fold", async () => {
    for (const width of WIDTHS) {
      const { context, page, errors } = await openPage("public.html", width);
      const measured = await widths(page);
      assert.ok(
        measured.scroll <= measured.client && measured.body <= measured.client,
        `public page overflows at ${width}px: ${JSON.stringify(measured)}`,
      );
      assert.ok(await page.locator(".lab-nav").isVisible(), `navigation hidden at ${width}px`);
      assert.ok(await page.locator('.lab-nav__link[aria-current="page"]').isVisible(), `active navigation hidden at ${width}px`);
      assert.equal(await page.locator("[data-lab-component]").count(), 24, `24 component rows at ${width}px`);
      assert.equal(await page.locator(".lab-ledger .lab-ev").count(), 24, `24 evidence strips at ${width}px`);
      const headline = await page.locator("h1").boundingBox();
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      assert.ok(
        headline && headline.y >= 0 && headline.y + headline.height <= viewportHeight,
        `publication headline not fully above the fold at ${width}px`,
      );
      assert.equal(await page.locator("h1").count(), 1);
      assert.deepEqual(errors, { console: 0, page: 0 }, `console/page errors at ${width}px`);
      await page.screenshot({ path: path.join(SCREENSHOTS, `public-${width}.png`), fullPage: true });
      await context.close();
    }
  });

  await t.test("control-room surface: 51 rows, 7 anomalies, no overflow, status visible", async () => {
    for (const width of WIDTHS) {
      const { context, page, errors } = await openPage("operator.html", width);
      const measured = await widths(page);
      assert.ok(
        measured.scroll <= measured.client && measured.body <= measured.client,
        `operator page overflows at ${width}px: ${JSON.stringify(measured)}`,
      );
      assert.ok(await page.locator(".lab-nav").isVisible(), `navigation hidden at ${width}px`);
      assert.equal(await page.locator("[data-lab-check]").count(), 51, `51 check rows at ${width}px`);
      assert.equal(await page.locator("[data-lab-anomaly]").count(), 7, `7 anomaly entries at ${width}px`);
      assert.equal(
        await page.locator('tr[data-lab-check][data-lab-status="warn"], tr[data-lab-check][data-lab-status="fail"]').count(),
        7,
        `7 anomalous table rows at ${width}px`,
      );
      assert.equal(await page.locator(".lab-table .lab-ev").count(), 51, `51 evidence strips at ${width}px`);
      const firstStatus = page.locator(".lab-table tbody tr").first().locator(".lab-status");
      assert.ok(await firstStatus.isVisible(), `status word hidden at ${width}px`);
      assert.match((await firstStatus.innerText()).trim(), /^(PASS|WARN|FAIL)$/);
      const lastRowStatus = page.locator(".lab-table tbody tr").last().locator(".lab-status");
      assert.ok(await lastRowStatus.isVisible(), `last row status hidden at ${width}px`);
      assert.deepEqual(errors, { console: 0, page: 0 }, `console/page errors at ${width}px`);
      await page.screenshot({ path: path.join(SCREENSHOTS, `operator-${width}.png`), fullPage: true });
      await context.close();
    }
  });

  await t.test("core content renders with JavaScript disabled", async () => {
    const { context, page } = await openPage("public.html", 390, { javaScriptEnabled: false });
    assert.equal(await page.locator("[data-lab-component]").count(), 24);
    assert.ok(await page.locator("h1").isVisible());
    assert.ok(await page.locator(".lab-nav").isVisible());
    assert.equal(await page.locator(".lab-ledger .lab-ev").count(), 24);
    await page.goto(pageUrl("operator.html"), { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("[data-lab-check]").count(), 51);
    assert.equal(await page.locator("[data-lab-anomaly]").count(), 7);
    assert.equal(await page.locator(".lab-table .lab-ev").count(), 51);
    assert.ok(await page.locator("h1").isVisible());
    await context.close();
  });

  await t.test("anomaly-first ordering matches the fixture contract in the DOM", async () => {
    const { context, page } = await openPage("operator.html", 390);
    const actual = await page.locator(".lab-anomalies .lab-anomaly__link").evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute("href")),
    );
    const rank = { fail: 0, warn: 1 };
    const expected = operatorFixture.checks
      .filter((check) => check.status !== "pass")
      .sort((a, b) => (rank[a.status] - rank[b.status]) || a.id.localeCompare(b.id))
      .map((check) => `#row-${check.id}`);
    assert.deepEqual(actual, expected);
    const firstEntry = await page.locator(".lab-anomalies .lab-anomaly").first().innerText();
    assert.match(firstEntry, /FAIL/, "first anomaly entry must be a failure");
    await context.close();
  });

  await t.test("one shared computed identity across two distinct archetypes", async () => {
    const context = await browser.newContext({ viewport: viewportFor(1440) });
    const publication = await context.newPage();
    const controlRoom = await context.newPage();
    await publication.goto(pageUrl("public.html"), { waitUntil: "domcontentloaded" });
    await controlRoom.goto(pageUrl("operator.html"), { waitUntil: "domcontentloaded" });
    assert.equal(await publication.evaluate(() => document.body.dataset.odyArchetype), "publication");
    assert.equal(await controlRoom.evaluate(() => document.body.dataset.odyArchetype), "control-room");
    const probe = (page) => page.evaluate(() => ({
      brand: getComputedStyle(document.querySelector(".lab-brand__mark rect")).fill,
      link: getComputedStyle(document.querySelector(".lab-nav__link")).color,
      activeLink: getComputedStyle(document.querySelector('.lab-nav__link[aria-current="page"]')).color,
      mastheadRule: `${getComputedStyle(document.querySelector(".lab-masthead")).borderBottomWidth} ${getComputedStyle(document.querySelector(".lab-masthead")).borderBottomStyle}`,
      paper: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
      chipFont: getComputedStyle(document.querySelector(".lab-chip")).fontFamily,
    }));
    const pubProbe = await probe(publication);
    const opsProbe = await probe(controlRoom);
    assert.deepEqual(opsProbe, pubProbe, "the two faces must compute one shared identity");
    assert.equal(pubProbe.brand, "rgb(154, 74, 21)", "oxide brand mark");
    assert.equal(pubProbe.activeLink, "rgb(154, 74, 21)", "accent active navigation");
    assert.equal(pubProbe.mastheadRule, "2px solid", "heavy masthead rule");
    const pubMain = await publication.locator("main").boundingBox();
    const opsMain = await controlRoom.locator("main").boundingBox();
    assert.ok(pubMain.width < opsMain.width, "publication stack must read narrower than the control-room spread");
    await context.close();
  });

  await t.test("keyboard focus is visible and lands on the skip link first", async () => {
    const { context, page } = await openPage("public.html", 390);
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        className: typeof element.className === "string" ? element.className : "",
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });
    assert.equal(focus.tag, "A");
    assert.equal(focus.className, "lab-skip");
    assert.equal(focus.outlineWidth, "2px");
    assert.equal(focus.outlineStyle, "solid");
    assert.ok(focus.visible, `focused skip link must be on screen: ${JSON.stringify(focus)}`);
    await page.keyboard.press("Tab");
    const second = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return { tag: element.tagName, outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle };
    });
    assert.equal(second.tag, "A");
    assert.equal(second.outlineWidth, "2px");
    assert.equal(second.outlineStyle, "solid");
    await context.close();
  });

  await t.test("reduced motion removes transitions", async () => {
    const reduced = await openPage("public.html", 390, { reducedMotion: "reduce" });
    const reducedDuration = await reduced.page.evaluate(
      () => getComputedStyle(document.querySelector(".lab-nav__link")).transitionDuration,
    );
    assert.equal(reducedDuration, "0s");
    await reduced.context.close();
    const normal = await openPage("public.html", 390, { reducedMotion: "no-preference" });
    const normalDuration = await normal.page.evaluate(
      () => getComputedStyle(document.querySelector(".lab-nav__link")).transitionDuration,
    );
    // The shared anchor transition lists color and background-color, so the
    // computed value is a comma-separated duration per property ("0.12s, 0.12s").
    const normalDurations = normalDuration.split(",").map((value) => value.trim());
    assert.ok(normalDurations.length > 0, "normal motion must keep at least one transition duration");
    assert.ok(
      normalDurations.every((value) => value === "0.12s"),
      `every normal-motion duration must be 0.12s: ${normalDuration}`,
    );
    await normal.context.close();
  });

  await t.test("forced colors keep structure, focus, and status words", async (t2) => {
    let session;
    try {
      session = await openPage("operator.html", 390, { forcedColors: "active" });
    } catch (error) {
      t2.skip(`forced-colors emulation unsupported in this chromium: ${error.message}`);
      return;
    }
    const { context, page } = session;
    const probeResult = await page.evaluate(() => {
      const masthead = getComputedStyle(document.querySelector(".lab-masthead"));
      const status = document.querySelector(".lab-table tbody .lab-status");
      const rect = status.getBoundingClientRect();
      const zone = getComputedStyle(document.querySelector(".lab-zone"));
      return {
        mastheadRule: masthead.borderBottomWidth,
        zoneRule: zone.borderTopWidth,
        statusVisible: rect.width > 0 && rect.height > 0,
        statusText: status.textContent.trim(),
      };
    });
    assert.equal(probeResult.mastheadRule, "2px");
    assert.equal(probeResult.zoneRule, "2px");
    assert.ok(probeResult.statusVisible, "status word must stay visible in forced colors");
    assert.match(probeResult.statusText, /^(PASS|WARN|FAIL)$/);
    const measured = await widths(page);
    assert.ok(measured.scroll <= measured.client, `forced-colors overflow: ${JSON.stringify(measured)}`);
    await page.keyboard.press("Tab");
    const focusOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
    assert.equal(focusOutline, "2px", "focus outline must survive forced colors");
    await page.screenshot({ path: path.join(SCREENSHOTS, "operator-390-forced-colors.png"), fullPage: false });
    await context.close();
  });
});
