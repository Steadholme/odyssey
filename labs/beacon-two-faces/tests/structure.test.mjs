// Structure gate for the Beacon Two Faces lab. Zero dependencies (node:test only).
// Mechanically enforces the falsification contract in SPEC.md §7.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const LAB = fileURLToPath(new URL("..", import.meta.url));
const read = (relPath) => readFileSync(join(LAB, relPath), "utf8");

const PAGES = ["index.html", "public.html", "operator.html"];
const STYLES = ["assets/lab-dna.css", "assets/lab-public.css", "assets/lab-operator.css"];
const FIXTURES = ["fixtures/public-status.fixture.json", "fixtures/operator-checks.fixture.json"];
const DOCS = ["README.md", "SPEC.md"];
const ROOT_SELECTOR = '[data-lab="beacon-two-faces"]';

const publicHtml = read("public.html");
const operatorHtml = read("operator.html");
const publicFixture = JSON.parse(read("fixtures/public-status.fixture.json"));
const operatorFixture = JSON.parse(read("fixtures/operator-checks.fixture.json"));

// ---------- helpers ----------

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Minimal CSS rule extractor: strips comments, walks braces, keeps at-rule context.
function parseCssRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const stack = [];
  let segStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") {
      const prelude = text.slice(segStart, index).trim();
      if (prelude.startsWith("@")) stack.push({ type: "at", prelude });
      else stack.push({ type: "rule", selector: prelude, bodyStart: index + 1 });
      segStart = index + 1;
    } else if (char === "}") {
      const top = stack.pop();
      assert.ok(top, "unbalanced CSS: closing brace without opener");
      if (top.type === "rule") {
        rules.push({
          selector: top.selector,
          body: text.slice(top.bodyStart, index),
          at: stack.filter((entry) => entry.type === "at").map((entry) => entry.prelude),
        });
      }
      segStart = index + 1;
    }
  }
  assert.equal(stack.length, 0, "unbalanced CSS: unclosed block");
  assert.equal(text.slice(segStart).trim(), "", "trailing CSS outside any rule");
  return rules;
}

function selectorParts(selector) {
  return selector.split(",").map((part) => part.trim()).filter(Boolean);
}

// ---------- 1 · file inventory ----------

test("lab contains exactly the 12 allowed files", () => {
  const actual = walk(LAB).map((full) => relative(LAB, full).split(sep).join("/")).sort();
  const expected = [
    "README.md", "SPEC.md",
    "assets/lab-dna.css", "assets/lab-operator.css", "assets/lab-public.css",
    "fixtures/operator-checks.fixture.json", "fixtures/public-status.fixture.json",
    "index.html", "operator.html", "public.html",
    "tests/browser.test.mjs", "tests/structure.test.mjs",
  ];
  assert.deepEqual(actual, expected);
});

// ---------- 2 · isolation: no production references ----------

test("code files carry no production path references", () => {
  const forbidden = [
    "beacon/", "odyssey/css", "odyssey/js", "odyssey/dist", "odyssey/releases",
    "odyssey/server", "odyssey/site", "odyssey/examples", "odyssey/tools",
    "page_shell", "APP_CSS", "distribution.toml", "Cargo.toml", "odyssey.js",
    "wire_page_shell",
  ];
  for (const file of [...PAGES, ...STYLES, ...FIXTURES]) {
    const text = read(file);
    for (const token of forbidden) {
      assert.ok(!text.includes(token), `${file} references forbidden token: ${token}`);
    }
  }
});

test("docs carry no production path references", () => {
  const forbiddenPaths = [
    "beacon/", "odyssey/css/", "odyssey/js/", "odyssey/dist/", "odyssey/releases/",
    "odyssey/server/", "odyssey/site/", "odyssey/examples/", "odyssey/tools/",
    "http://", "https://",
  ];
  for (const file of DOCS) {
    const text = read(file);
    for (const token of forbiddenPaths) {
      assert.ok(!text.includes(token), `${file} references forbidden path: ${token}`);
    }
  }
});

// ---------- 3 · pages: no scripts, no external URLs, local links only ----------

test("pages contain no script, no inline handlers, no inline styles, no external URL", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.ok(!/<script\b/i.test(html), `${page} contains a script tag`);
    assert.ok(!/\son[a-z]+\s*=/i.test(html), `${page} contains an inline event handler`);
    assert.ok(!/\sstyle\s*=/i.test(html), `${page} contains an inline style`);
    assert.ok(!/https?:\/\//i.test(html), `${page} contains an absolute URL`);
    assert.ok(!/src\s*=/i.test(html), `${page} contains a src attribute`);
    for (const match of html.matchAll(/\b(href|action)\s*=\s*"([^"]*)"/gi)) {
      const value = match[2];
      assert.ok(
        value.startsWith("./") || value.startsWith("#"),
        `${page}: ${match[1]}="${value}" must stay local`,
      );
    }
  }
});

// ---------- 4 · archetype stamps ----------

test("archetype stamps are exactly the two allowed values, on the right bodies", () => {
  const stamped = {
    "index.html": [],
    "public.html": ["publication"],
    "operator.html": ["control-room"],
  };
  for (const page of PAGES) {
    const html = read(page);
    const values = [...html.matchAll(/data-ody-archetype="([^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(values, stamped[page], `${page} archetype mismatch`);
    for (const value of values) {
      assert.ok(["publication", "control-room"].includes(value), `${page}: illegal archetype ${value}`);
    }
    assert.equal((html.match(/data-lab="beacon-two-faces"/g) ?? []).length, 1, `${page} must stamp data-lab once`);
  }
});

test("no odyssey runtime attributes or odyssey/app custom properties anywhere", () => {
  for (const file of [...PAGES, ...STYLES]) {
    const text = read(file);
    assert.ok(!/data-ody-(profile|shell|identity)/.test(text), `${file} carries a forbidden data-ody-* attribute`);
    assert.ok(!/[\s{;]--(?:ody|c)-[a-z0-9-]*\s*:/.test(text), `${file} defines an --ody-*/--c-* property`);
    assert.ok(!/var\(\s*--(?:ody|c)-/.test(text), `${file} consumes an --ody-*/--c-* property`);
    assert.ok(!/[\s{;]--app\s*:/.test(text), `${file} defines --app`);
    assert.ok(!/var\(\s*--app[\s)]/.test(text), `${file} consumes --app`);
  }
});

// ---------- 5 · CSS scoping + status-token confinement ----------

test("every css selector is lab-scoped", () => {
  for (const file of STYLES) {
    const rules = parseCssRules(read(file));
    assert.ok(rules.length > 5, `${file}: suspiciously few rules parsed`);
    for (const rule of rules) {
      for (const part of selectorParts(rule.selector)) {
        assert.ok(
          part.startsWith(ROOT_SELECTOR) || part.startsWith(".lab-"),
          `${file}: unscoped selector "${part}"`,
        );
      }
    }
  }
});

test("status and evidence tokens stay inside status semantics", () => {
  const DEFINITION = /(^|;)\s*--lab-(?:st|ev)-[a-z]/;
  const ALLOWED_CONSUMER = /\.lab-(?:chip|status|ev__cell|event)(?:--|\b)/;
  for (const file of STYLES) {
    for (const rule of parseCssRules(read(file))) {
      if (DEFINITION.test(rule.body)) {
        assert.equal(rule.selector, ROOT_SELECTOR, `${file}: status token defined outside the lab root: ${rule.selector}`);
      }
      if (rule.body.includes("var(--lab-st-") || rule.body.includes("var(--lab-ev-")) {
        for (const part of selectorParts(rule.selector)) {
          assert.ok(
            part === ROOT_SELECTOR || ALLOWED_CONSUMER.test(part) || part.includes("[data-lab-status"),
            `${file}: status token used outside status semantics: "${part}"`,
          );
        }
      }
    }
  }
});

// ---------- 6 · fixtures are explicitly synthetic ----------

test("fixtures are explicitly synthetic", () => {
  for (const fixture of [publicFixture, operatorFixture]) {
    assert.equal(fixture.meta.synthetic, true);
    assert.equal(fixture.meta.specimen, "beacon-two-faces");
    assert.match(fixture.meta.note, /synthetic/i);
    assert.match(fixture.meta.note, /fictional/i);
  }
});

// ---------- 7 · public surface: 24 catalog components ----------

test("public fixture holds exactly the 24 required catalog components", () => {
  const required = [
    "Gateway", "Identity", "Mail", "Drive", "Forum", "Git", "Relay", "Search",
    "Blog", "Feeds", "Inbox", "Chat", "Social", "Notify", "Wiki", "Registry",
    "Canvas", "Clips", "Comments", "Pastefire", "Relation", "Calendar", "Multica", "Odyssey UI",
  ];
  assert.deepEqual(publicFixture.components.map((component) => component.name), required);
  for (const component of publicFixture.components) {
    assert.match(component.status, /^(operational|degraded|outage|maintenance)$/);
    assert.match(component.evidence, /^[oudmn]{30}$/);
    assert.equal(typeof component.up_30d, "number");
    const counts = { operational: 0, degraded: 0, outage: 0, maintenance: 0, no_data: 0 };
    const letter = { o: "operational", d: "degraded", u: "outage", m: "maintenance", n: "no_data" };
    for (const char of component.evidence) counts[letter[char]] += 1;
    assert.deepEqual(component.evidence_counts, counts, `${component.key}: evidence_counts drift`);
  }
  assert.equal(publicFixture.meta.overall_status, "degraded");
  assert.equal(publicFixture.incident.state, "active");
  assert.equal(publicFixture.maintenance.state, "scheduled");
});

test("public html renders the same 24 components with evidence and labels", () => {
  const keys = [...publicHtml.matchAll(/data-lab-component="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(keys.length, 24);
  assert.deepEqual([...keys].sort(), publicFixture.components.map((component) => component.key).sort());
  for (const component of publicFixture.components) {
    assert.ok(publicHtml.includes(`>${component.name}<`), `component name missing in html: ${component.name}`);
  }
  assert.equal((publicHtml.match(/role="img" aria-label="30-day evidence:/g) ?? []).length, 24, "every ledger row needs an aria-labeled evidence strip");
  assert.equal((publicHtml.match(/data-lab-incident/g) ?? []).length, 1);
  assert.equal((publicHtml.match(/data-lab-maintenance/g) ?? []).length, 1);
  const states = [...publicHtml.matchAll(/data-lab-state="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(states, ["operational", "outage", "maintenance", "empty", "no-data"]);
  const headline = publicHtml.slice(publicHtml.indexOf('<section class="lab-headline"'), publicHtml.indexOf("</section>"));
  assert.equal((headline.match(/lab-chip--/g) ?? []).length, 1, "headline zone must carry exactly one semantic status chip");
  assert.ok(/SYNTHETIC SPECIMEN — NOT LIVE/.test(publicHtml));
});

// ---------- 8 · operator surface: 51 checks, 7 anomalies ----------

test("operator fixture holds 51 unique synthetic checks with exactly 7 anomalies", () => {
  const checks = operatorFixture.checks;
  assert.equal(checks.length, 51);
  const ids = checks.map((check) => check.id);
  assert.equal(new Set(ids).size, 51, "check ids must be unique");
  const allowedKeys = new Set([
    "id", "group", "probe", "status", "latest_ms", "up_24h", "up_7d", "up_30d",
    "evidence", "evidence_counts", "last_checked", "audit", "note",
  ]);
  const forbiddenKeys = /^(target|url|host|hostname|secret|token|password|credential|api[_-]?key|address)$/i;
  for (const check of checks) {
    assert.match(check.id, /^syn-(basalt|flint|granite|marble|ochre|slate)-\d{2}$/);
    assert.match(check.status, /^(pass|warn|fail)$/);
    assert.match(check.evidence, /^[pwf]{30}$/);
    assert.match(check.audit, /^syn-a-\d{4}$/);
    assert.match(check.last_checked, /^2026-07-20T05:5\d:\d{2}Z$/);
    for (const key of Object.keys(check)) {
      assert.ok(allowedKeys.has(key), `unexpected fixture key: ${key}`);
      assert.ok(!forbiddenKeys.test(key), `forbidden fixture key: ${key}`);
    }
    const counts = { pass: 0, warn: 0, fail: 0 };
    for (const char of check.evidence) counts[{ p: "pass", w: "warn", f: "fail" }[char]] += 1;
    assert.deepEqual(check.evidence_counts, counts, `${check.id}: evidence_counts drift`);
    if (/[^p]/.test(check.evidence)) {
      assert.notEqual(check.status, "pass", `${check.id}: non-pass evidence on a passing check`);
    }
  }
  const anomalies = checks.filter((check) => check.status !== "pass");
  assert.equal(anomalies.length, 7);
  assert.equal(anomalies.filter((check) => check.status === "fail").length, 2);
  assert.equal(anomalies.filter((check) => check.status === "warn").length, 5);
  for (const anomaly of anomalies) assert.ok(anomaly.note, `${anomaly.id}: anomaly needs a synthetic note`);
});

test("operator fixture names nothing real", () => {
  const scrubbed = JSON.stringify(operatorFixture).replaceAll("beacon-two-faces", "");
  const forbiddenNames = [
    "sluice", "keystone", "cairn", "corvid", "loom", "forge", "relay", "beacon",
    "portal", "scriptoria", "aperture", "inkwell", "agora", "census", "verge",
    "crier", "magpie", "familiar", "cortex", "multica", "siteflow", "cistern",
    "mellohi", "atlas", "odyssey", "w33d", "holdfast", "steadholme", "docker",
    "kubernetes", "http://", "https://",
  ];
  const lowered = scrubbed.toLowerCase();
  for (const name of forbiddenNames) {
    assert.ok(!lowered.includes(name), `operator fixture mentions real name: ${name}`);
  }
});

test("operator html renders the same 51 checks and anomaly-first ordering", () => {
  const rowIds = [...operatorHtml.matchAll(/<tr id="row-(syn-[^"]+)" data-lab-check/g)].map((match) => match[1]);
  assert.equal(rowIds.length, 51);
  assert.deepEqual([...rowIds].sort(), operatorFixture.checks.map((check) => check.id).sort());
  const anomalousRows = [...operatorHtml.matchAll(/<tr id="row-[^"]+" data-lab-check data-lab-status="(warn|fail)"/g)];
  assert.equal(anomalousRows.length, 7, "table must mark exactly 7 anomalous rows");
  assert.equal((operatorHtml.match(/data-lab-anomaly/g) ?? []).length, 7);
  assert.equal((operatorHtml.match(/role="img" aria-label="30-day evidence:/g) ?? []).length, 51);
  assert.equal((operatorHtml.match(/<th scope="row"/g) ?? []).length, 51);

  const block = operatorHtml.slice(operatorHtml.indexOf('<ol class="lab-anomalies">'), operatorHtml.indexOf("</ol>"));
  const actualOrder = [...block.matchAll(/href="#row-(syn-[^"]+)"/g)].map((match) => match[1]);
  const rank = { fail: 0, warn: 1 };
  const expectedOrder = operatorFixture.checks
    .filter((check) => check.status !== "pass")
    .sort((a, b) => (rank[a.status] - rank[b.status]) || a.id.localeCompare(b.id))
    .map((check) => check.id);
  assert.deepEqual(actualOrder, expectedOrder, "anomaly block must list failures first, then warnings by id");
  assert.ok(/SYNTHETIC SPECIMEN — NOT LIVE/.test(operatorHtml));
});

// ---------- 9 · table semantics ----------

test("operator table is a real table: caption, scoped headers", () => {
  const caption = operatorHtml.match(/<caption>([\s\S]*?)<\/caption>/);
  assert.ok(caption, "table caption missing");
  assert.ok(caption[1].trim().length > 80, "table caption must explain the data");
  assert.equal((operatorHtml.match(/<th scope="col">/g) ?? []).length, 9);
  const thead = operatorHtml.slice(operatorHtml.indexOf("<thead>"), operatorHtml.indexOf("</thead>"));
  for (const column of ["Check", "Status", "Latest", "24 h", "7 d", "30 d", "Evidence · 30 d", "Last checked", "Audit"]) {
    assert.ok(thead.includes(`>${column}<`), `missing column header: ${column}`);
  }
});

// ---------- 10 · landmarks, headings, labels ----------

test("every page has landmarks, one h1, ordered headings, skip link, en lang", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta charset="utf-8">/);
    assert.match(html, /<meta name="viewport"/);
    assert.ok((html.match(/<header\b/g) ?? []).length >= 1, `${page}: header landmark missing`);
    assert.ok((html.match(/<nav\b/g) ?? []).length >= 1, `${page}: nav landmark missing`);
    assert.equal((html.match(/<main\b/g) ?? []).length, 1, `${page}: exactly one main landmark`);
    assert.ok((html.match(/<footer\b/g) ?? []).length >= 1, `${page}: footer landmark missing`);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${page}: exactly one h1`);
    assert.match(html, /<a class="lab-skip" href="#main">/, `${page}: skip link missing`);
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
    assert.equal(levels[0], 1, `${page}: first heading must be h1`);
    for (let index = 1; index < levels.length; index += 1) {
      assert.ok(levels[index] <= levels[index - 1] + 1, `${page}: heading order jumps h${levels[index - 1]} -> h${levels[index]}`);
    }
    assert.match(html, /SYNTHETIC SPECIMEN — NOT LIVE/, `${page}: synthetic stamp missing`);
    assert.match(html, /synthetic/i, `${page}: synthetic labeling missing`);
  }
});

// ---------- 11 · control room is read-only ----------

test("operator page ships no form or mutation control", () => {
  assert.ok(!/<(form|button|input|select|textarea)\b/i.test(operatorHtml), "operator page carries a form control");
  assert.ok(!/\b(acknowledge|ack|silence|mute|resolve|retry)\s*<\/button>/i.test(operatorHtml), "operator page carries a mutation action");
  for (const match of operatorHtml.matchAll(/href="([^"]*)"/g)) {
    assert.ok(match[1].startsWith("./") || match[1].startsWith("#"), `operator link must stay local: ${match[1]}`);
  }
});
