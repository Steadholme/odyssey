#!/usr/bin/env node

import { createRequire } from "node:module";
import { chmodSync, closeSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FORBIDDEN_PORTAL_HOSTS = [
  "authz.w33d.xyz",
  "people.w33d.xyz",
  "vault.w33d.xyz",
  "audit.w33d.xyz",
  "vitals.w33d.xyz",
  "logs.w33d.xyz",
  "traces.w33d.xyz",
  "dns.w33d.xyz",
  "backup.w33d.xyz",
  "ci.w33d.xyz",
  "deploy.w33d.xyz",
  "siteflow.w33d.xyz",
  "egress.w33d.xyz",
  "mesh.w33d.xyz",
  "edge.w33d.xyz",
  "spiffe.w33d.xyz",
  "risk.w33d.xyz",
  "events.w33d.xyz",
  "jobs.w33d.xyz",
  "intel.w33d.xyz",
  "guard.w33d.xyz",
  "purple.w33d.xyz",
  "atlas.w33d.xyz",
  "rca.w33d.xyz",
  "detonate.w33d.xyz",
  "canary.w33d.xyz",
  "vpn.w33d.xyz",
];

const ABSOLUTE_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) {
      throw new Error("invalid_argument");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("missing_argument_value");
    }
    values.set(flag, value);
    index += 1;
  }
  const required = (flag) => {
    const value = values.get(flag);
    if (!value) {
      throw new Error("missing_required_argument");
    }
    return value;
  };
  return {
    statusUrl: required("--status-url"),
    portalUrl: values.get("--portal-url"),
    portalUrlFile: values.get("--portal-url-file"),
    siteflowRoot: required("--siteflow-root"),
    chromiumPath: values.get("--chromium-path") ?? "/usr/bin/chromium",
    outputPath: values.get("--output"),
  };
}

function portalUrlFromOptions(options) {
  if (options.portalUrl) {
    return options.portalUrl;
  }
  if (!options.portalUrlFile) {
    throw new Error("missing_portal_url");
  }
  const parsed = JSON.parse(readFileSync(options.portalUrlFile, "utf8"));
  if (!parsed || typeof parsed.portalUrl !== "string") {
    throw new Error("invalid_portal_url_file");
  }
  return parsed.portalUrl;
}

function atomicWriteJson(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  const descriptor = openSync(temporary, "wx", 0o640);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, filePath);
  chmodSync(filePath, 0o640);
}

function validateUrl(value, protocols) {
  const parsed = new URL(value);
  if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("invalid_url");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function browserErrors(page) {
  const counters = { console: 0, page: 0, csp: 0 };
  page.on("console", (message) => {
    if (message.type() === "error") {
      counters.console += 1;
      if (/content security policy|csp/i.test(message.text())) {
        counters.csp += 1;
      }
    }
  });
  page.on("pageerror", () => {
    counters.page += 1;
  });
  return counters;
}

function noBrowserErrors(counters) {
  return counters.console === 0 && counters.page === 0 && counters.csp === 0;
}

async function viewportWidths(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
}

function fitsViewport(widths) {
  return widths.scrollWidth <= widths.clientWidth && widths.bodyWidth <= widths.clientWidth;
}

function exactWireResponse(response, expectedUrl) {
  return response.url() === expectedUrl
    && response.request().method() === "GET"
    && response.request().headers()["x-wire"] === "1";
}

function containsForbiddenPortalData(value) {
  const normalized = value.toLowerCase();
  const inspected = normalized.replaceAll("http://www.w3.org/2000/svg", "");
  if (FORBIDDEN_PORTAL_HOSTS.some((host) => inspected.includes(host))) {
    return true;
  }
  for (const match of inspected.matchAll(ABSOLUTE_URL_PATTERN)) {
    try {
      const candidate = new URL(match[0]);
      if (candidate.protocol !== "https:"
        || candidate.username || candidate.password
        || !(candidate.hostname === "w33d.xyz" || candidate.hostname.endsWith(".w33d.xyz"))
        || FORBIDDEN_PORTAL_HOSTS.includes(candidate.hostname)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

async function activityTargetsAreHidden(page) {
  return page.locator(".feed__meta").evaluateAll((nodes) => nodes.every((node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll("[data-spark-reltime]").forEach((relativeTime) => relativeTime.remove());
    return !copy.textContent?.trim() && copy.querySelectorAll("*").length === 0;
  }));
}

async function portalUrlAttributesAreSafe(page) {
  return page.locator("[href], [src], [action], [data-target], [data-url]").evaluateAll((nodes, forbiddenHosts) => {
    const attributes = ["href", "src", "action", "data-target", "data-url"];
    return nodes.every((node) => attributes.every((name) => {
      if (!node.hasAttribute(name)) return true;
      const value = node.getAttribute(name)?.trim() ?? "";
      if (value === "") return true;
      if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
      if (value.startsWith("#")) return true;
      if ((name === "src" || name === "href") && value.startsWith("data:image/svg+xml,")) return true;
      try {
        const candidate = new URL(value);
        return candidate.protocol === "https:"
          && !candidate.username
          && !candidate.password
          && (candidate.hostname === "w33d.xyz" || candidate.hostname.endsWith(".w33d.xyz"))
          && !forbiddenHosts.includes(candidate.hostname.toLowerCase());
      } catch {
        return false;
      }
    }));
  }, FORBIDDEN_PORTAL_HOSTS);
}

async function runStatusRefresh(browser, statusUrl, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = browserErrors(page);
  try {
    const navigation = await page.goto(`${statusUrl}/status`, { waitUntil: "networkidle" });
    if (!navigation || navigation.status() !== 200) {
      return false;
    }
    const before = page.url();
    const live = page.locator("#status-live");
    const oldLive = await live.elementHandle();
    const expectedWireUrl = new URL("/status", statusUrl).href;
    const responsePromise = page.waitForResponse(
      (response) => exactWireResponse(response, expectedWireUrl),
    );
    await page.locator('[data-wire-target="#status-live"]').click();
    const response = await responsePromise;
    const fragment = await response.text();
    await page.waitForTimeout(200);
    const widths = await viewportWidths(page);
    const oldDisconnected = oldLive
      ? await oldLive.evaluate((element) => !element.isConnected)
      : false;
    return response.status() === 200
      && response.headers()["cache-control"] === "no-store"
      && page.url() === before
      && await live.count() === 1
      && oldDisconnected
      && fragment.trimStart().startsWith('<div id="status-live"')
      && (fragment.match(/id="status-live"/g) ?? []).length === 1
      && !/<!doctype|<script|csrf|method\s*=\s*["']post/i.test(fragment)
      && fitsViewport(widths)
      && noBrowserErrors(errors);
  } finally {
    await page.close();
  }
}

async function runPortalRefresh(browser, portalUrl, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = browserErrors(page);
  try {
    const navigation = await page.goto(`${portalUrl}/`, { waitUntil: "networkidle" });
    if (!navigation || navigation.status() !== 200) {
      return false;
    }
    const fullHtml = await page.content();
    const visibleText = await page.locator("body").innerText();
    const before = page.url();
    const appsBefore = await page.locator("#appsections").count();
    const live = page.locator("#estate-live");
    const oldLive = await live.elementHandle();
    const expectedWireUrl = new URL("/?refresh=1", portalUrl).href;
    const responsePromise = page.waitForResponse(
      (response) => exactWireResponse(response, expectedWireUrl),
    );
    await page.locator('[data-wire-target="#estate-live"]').click();
    const response = await responsePromise;
    const fragment = await response.text();
    await page.waitForTimeout(200);
    const liveHtml = await live.innerHTML();
    const widths = await viewportWidths(page);
    const oldDisconnected = oldLive
      ? await oldLive.evaluate((element) => !element.isConnected)
      : false;
    return response.status() === 200
      && response.headers()["cache-control"] === "private, no-store"
      && page.url() === before
      && appsBefore === 1
      && await page.locator("#appsections").count() === 1
      && await live.count() === 1
      && oldDisconnected
      && fragment.trimStart().startsWith('<section class="estate-live" id="estate-live"')
      && (fragment.match(/id="estate-live"/g) ?? []).length === 1
      && !containsForbiddenPortalData(fullHtml)
      && !containsForbiddenPortalData(fragment)
      && !containsForbiddenPortalData(liveHtml)
      && !containsForbiddenPortalData(visibleText)
      && await activityTargetsAreHidden(page)
      && await portalUrlAttributesAreSafe(page)
      && fitsViewport(widths)
      && noBrowserErrors(errors);
  } finally {
    await page.close();
  }
}

async function runNoJavaScriptFloor(browser, statusUrl, portalUrl) {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const statusPage = await context.newPage();
  const portalPage = await context.newPage();
  try {
    const statusResponse = await statusPage.goto(`${statusUrl}/status`, { waitUntil: "domcontentloaded" });
    const portalResponse = await portalPage.goto(`${portalUrl}/`, { waitUntil: "domcontentloaded" });
    const statusLink = statusPage.locator('[data-wire-target="#status-live"]');
    const portalLink = portalPage.locator('[data-wire-target="#estate-live"]');
    if (statusResponse?.status() !== 200
      || portalResponse?.status() !== 200
      || await statusLink.getAttribute("href") !== "/status"
      || await portalLink.getAttribute("href") !== "/?refresh=1#estate-live") {
      return false;
    }
    const statusNavigation = statusPage.waitForResponse(
      (response) => response.request().isNavigationRequest()
        && response.request().method() === "GET"
        && response.url() === new URL("/status", statusUrl).href,
    );
    await statusLink.click();
    const refreshedStatus = await statusNavigation;
    const portalNavigation = portalPage.waitForResponse(
      (response) => response.request().isNavigationRequest()
        && response.request().method() === "GET"
        && response.url() === new URL("/?refresh=1", portalUrl).href,
    );
    await portalLink.click();
    const refreshedPortal = await portalNavigation;
    return refreshedStatus.status() === 200
      && refreshedPortal.status() === 200
      && new URL(portalPage.url()).searchParams.get("refresh") === "1"
      && portalResponse?.status() === 200
      && await statusPage.locator("#status-live").count() === 1
      && await portalPage.locator("#estate-live").count() === 1;
  } finally {
    await context.close();
  }
}

export async function runBrowserSmoke(options) {
  const statusUrl = validateUrl(options.statusUrl, ["https:"]);
  const portalUrl = validateUrl(portalUrlFromOptions(options), ["http:"]);
  const requireFromSiteflow = createRequire(path.join(options.siteflowRoot, "package.json"));
  const { chromium } = requireFromSiteflow("playwright");
  const browser = await chromium.launch({
    headless: true,
    executablePath: options.chromiumPath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const checks = [];
  const check = async (name, operation) => {
    let passed = false;
    try {
      passed = await operation();
    } catch {
      passed = false;
    }
    checks.push({ name, status: passed ? "pass" : "fail" });
  };
  try {
    await check("status_desktop_refresh", () => runStatusRefresh(browser, statusUrl, { width: 1440, height: 1100 }));
    await check("status_mobile_refresh", () => runStatusRefresh(browser, statusUrl, { width: 390, height: 844 }));
    await check("portal_desktop_refresh", () => runPortalRefresh(browser, portalUrl, { width: 1440, height: 1100 }));
    await check("portal_mobile_refresh", () => runPortalRefresh(browser, portalUrl, { width: 390, height: 844 }));
    await check("no_javascript_floor", () => runNoJavaScriptFloor(browser, statusUrl, portalUrl));
  } finally {
    await browser.close();
  }
  return {
    schemaVersion: "odyssey.browserSmoke.v1",
    status: checks.every((entry) => entry.status === "pass") ? "pass" : "fail",
    checkedAt: new Date().toISOString(),
    checks,
    sanitized: true,
  };
}

async function main() {
  let options;
  let result;
  try {
    options = parseArgs(process.argv.slice(2));
    result = await runBrowserSmoke(options);
  } catch {
    result = {
      schemaVersion: "odyssey.browserSmoke.v1",
      status: "fail",
      checkedAt: new Date().toISOString(),
      checks: [{ name: "browser_runner", status: "fail" }],
      sanitized: true,
    };
  }
  if (options?.outputPath) {
    atomicWriteJson(options.outputPath, result);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "pass" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
