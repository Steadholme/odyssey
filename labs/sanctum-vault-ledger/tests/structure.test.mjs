// Zero-dependency structure gate for the synthetic Sanctum Vault Ledger lab.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const LAB = fileURLToPath(new URL("..", import.meta.url));
const read = (relPath) => readFileSync(join(LAB, relPath), "utf8");

const PAGES = ["index.html", "secret.html"];
const STYLES = ["assets/lab-dna.css", "assets/lab-vault.css"];
const FIXTURES = [
  "fixtures/vault.json",
  "fixtures/policies.json",
  "fixtures/lineage.json",
  "fixtures/schema.json",
];
const DOCS = ["README.md", "SPEC.md"];
const ROOT_SELECTOR = '[data-lab="sanctum-vault-ledger"]';

const vault = JSON.parse(read("fixtures/vault.json"));
const policies = JSON.parse(read("fixtures/policies.json"));
const lineage = JSON.parse(read("fixtures/lineage.json"));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function parseCssRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const stack = [];
  let segmentStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") {
      const prelude = text.slice(segmentStart, index).trim();
      if (prelude.startsWith("@")) stack.push({ type: "at", prelude });
      else stack.push({ type: "rule", selector: prelude, bodyStart: index + 1 });
      segmentStart = index + 1;
    } else if (text[index] === "}") {
      const current = stack.pop();
      assert.ok(current, "unbalanced CSS closing brace");
      if (current.type === "rule") {
        rules.push({
          selector: current.selector,
          body: text.slice(current.bodyStart, index),
          at: stack.filter((entry) => entry.type === "at").map((entry) => entry.prelude),
        });
      }
      segmentStart = index + 1;
    }
  }
  assert.equal(stack.length, 0, "unbalanced CSS block");
  assert.equal(text.slice(segmentStart).trim(), "", "trailing CSS outside a rule");
  return rules;
}

const selectorParts = (selector) => selector.split(",").map((part) => part.trim()).filter(Boolean);

function firstFocusableTag(html) {
  return html.match(/<(a|button|summary|input|select|textarea)\b[^>]*>/i)?.[0] ?? "";
}

function openingTagForRecord(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<li\\b[^>]*data-vault-id="${escaped}"[^>]*>`, "i"))?.[0] ?? "";
}

const daysFrom = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000));

test("lab contains exactly the frozen 13 files", () => {
  const actual = walk(LAB).map((full) => relative(LAB, full).split(sep).join("/")).sort();
  const expected = [
    "README.md",
    "SPEC.md",
    "assets/lab-dna.css",
    "assets/lab-vault.css",
    "fixtures/lineage.json",
    "fixtures/policies.json",
    "fixtures/schema.json",
    "fixtures/vault.json",
    "index.html",
    "secret.html",
    "tests/browser.test.mjs",
    "tests/fixtures.test.mjs",
    "tests/structure.test.mjs",
  ];
  assert.deepEqual(actual, expected);
  assert.ok(actual.every((file) => !file.endsWith(".rs") && file !== "Cargo.toml"));
});

test("served and data surfaces are synthetic, local, and authority-free", () => {
  const forbidden = [
    "w33d.xyz", "build_dev_state", "DEV_MASTER_KEY", "GATEWAY_HMAC_KEY",
    "SANCTUM_STORE", "InMemoryStore", "Sluice", "Keystone", "Ed25519",
    "X-Gateway-Zone", "X-Auth-", "/api/v1/", "/transit/", "/s/",
    "odyssey/distribution.toml", "Cargo.toml", "sanctum/src/", "sanctum/templates/",
  ];
  for (const file of [...PAGES, ...STYLES, ...FIXTURES]) {
    const text = read(file);
    for (const word of forbidden) {
      assert.ok(!text.includes(word), `${file}: forbidden authority reference ${word}`);
    }
    assert.ok(!/https?:\/\//i.test(text), `${file}: external URL is forbidden`);
  }
  for (const file of DOCS) {
    assert.ok(!/https?:\/\//i.test(read(file)), `${file}: docs must stay self-contained`);
  }
});

test("pages contain no script, form, mutation affordance, inline behavior, or external fetch", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.ok(!/<script\b/i.test(html), `${page}: script is forbidden`);
    assert.ok(!/<form\b/i.test(html), `${page}: form is forbidden`);
    assert.ok(!/<button\b/i.test(html), `${page}: button is forbidden`);
    assert.ok(!/<input\b/i.test(html), `${page}: input is forbidden`);
    assert.ok(!/\son[a-z]+\s*=/i.test(html), `${page}: inline handler is forbidden`);
    assert.ok(!/\sstyle\s*=/i.test(html), `${page}: inline style is forbidden`);
    assert.ok(!/\b(src|srcset)\s*=/i.test(html), `${page}: external-capable source attribute is forbidden`);
    assert.ok(!/\bdata-(?:value|plaintext|ciphertext|token|key-material)\s*=/i.test(html), `${page}: secret-material-shaped data attribute`);
    for (const match of html.matchAll(/\b(href|action)\s*=\s*"([^"]*)"/gi)) {
      assert.ok(
        match[2].startsWith("./") || match[2].startsWith("#"),
        `${page}: ${match[1]}="${match[2]}" must stay local`,
      );
    }
  }
});

test("root and archetype stamps are exact and Odyssey runtime stays absent", () => {
  const expected = { "index.html": "register", "secret.html": "dossier" };
  for (const page of PAGES) {
    const html = read(page);
    assert.equal((html.match(/data-lab="sanctum-vault-ledger"/g) ?? []).length, 1, `${page}: data-lab stamp`);
    assert.deepEqual(
      [...html.matchAll(/data-ody-archetype="([^"]+)"/g)].map((match) => match[1]),
      [expected[page]],
    );
    assert.ok(!/data-ody-(profile|shell|identity)/.test(html), `${page}: forbidden Odyssey runtime stamp`);
  }
  for (const file of [...PAGES, ...STYLES]) {
    const text = read(file);
    assert.ok(!/[\s{;]--(?:ody|c)-[a-z0-9-]*\s*:/.test(text), `${file}: defines shared Odyssey token`);
    assert.ok(!/var\(\s*--(?:ody|c)-/.test(text), `${file}: consumes shared Odyssey token`);
    assert.ok(!/[\s{;]--app\s*:/.test(text), `${file}: defines --app`);
  }
});

test("every CSS selector is specimen-scoped and includes accessibility modes", () => {
  const combined = STYLES.map(read).join("\n");
  for (const file of STYLES) {
    const rules = parseCssRules(read(file));
    assert.ok(rules.length > 5, `${file}: suspiciously few rules`);
    for (const rule of rules) {
      for (const part of selectorParts(rule.selector)) {
        assert.ok(
          part.startsWith(ROOT_SELECTOR) || part.startsWith(".vault-"),
          `${file}: unscoped selector ${part}`,
        );
      }
    }
  }
  assert.match(combined, /prefers-reduced-motion\s*:\s*reduce/i);
  assert.match(combined, /forced-colors\s*:\s*active/i);
  assert.match(combined, /:focus-visible/);
  assert.ok(!/@import\b/i.test(combined), "CSS imports are forbidden");
});

test("landmarks, skip links, headings, register, due window, and custody chain are semantic", () => {
  const indexHtml = read("index.html");
  const secretHtml = read("secret.html");
  for (const [name, html] of [["index", indexHtml], ["secret", secretHtml]]) {
    assert.match(html, /<header\b/i, `${name}: header landmark`);
    assert.match(html, /<nav\b[^>]*aria-label=/i, `${name}: labeled navigation`);
    assert.match(html, /<main\b[^>]*id="main"/i, `${name}: main target`);
    assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${name}: exactly one h1`);
    assert.match(firstFocusableTag(html), /^<a\b[^>]*href="#main"/i, `${name}: skip link must be first focusable`);
  }
  assert.match(indexHtml, /<ul\b[^>]*class="[^"]*vault-register/i);
  assert.ok(
    /<(table|ul)\b[^>]*class="[^"]*vault-due-window/i.test(indexHtml),
    "index: due window must be a semantic table or list",
  );
  assert.match(secretHtml, /<ol\b[^>]*class="[^"]*vault-chain/i);
  assert.match(secretHtml, /<details\b[^>]*class="[^"]*vault-seal/i);
  assert.match(secretHtml, /<summary\b/i);
  assert.ok(!/<details\b[^>]*\bopen(?:\s|=|>)/i.test(secretHtml), "seal details must be closed by default");
});

test("register HTML agrees with all eight canonical fixture records", () => {
  const html = read("index.html");
  assert.equal((html.match(/data-vault-id="seal-[a-z]+-[0-9]{2}"/g) ?? []).length, 8);
  assert.equal((html.match(/data-as-of="2026-07-20T00:00:00Z"/g) ?? []).length, 1);

  const stateWord = { active: "SEALED", expiring: "EXPIRING", expired: "EXPIRED", revoked: "REVOKED" };
  for (const record of vault.secrets) {
    const tag = openingTagForRecord(html, record.id);
    assert.ok(tag, `index: missing record ${record.id}`);
    assert.ok(tag.includes(`data-state="${record.state}"`), `${record.id}: state drift`);
    assert.ok(tag.includes(`data-sealed="${record.sealed}"`), `${record.id}: sealed drift`);
    assert.ok(tag.includes(`data-version="${record.version}"`), `${record.id}: version drift`);
    assert.ok(tag.includes(`data-scope="${record.scope}"`), `${record.id}: scope drift`);
    const due = daysFrom(vault.as_of, record.rotates_at);
    assert.ok(tag.includes(`data-due-days="${due}"`), `${record.id}: due-day drift, expected ${due}`);

    const start = html.indexOf(tag);
    const end = html.indexOf("</li>", start);
    assert.ok(end > start, `${record.id}: record must be an li`);
    const row = html.slice(start, end);
    assert.ok(row.includes(record.label), `${record.id}: label missing`);
    assert.ok(row.includes(stateWord[record.state]), `${record.id}: state word missing`);
    assert.match(row, /class="[^"]*vault-seal/, `${record.id}: seal shape missing`);
    assert.match(row, /class="[^"]*vault-due/, `${record.id}: due text missing`);
  }
  assert.equal((html.match(/data-state="expiring"/g) ?? []).length, 1);
  assert.match(html, /data-vault-id="seal-briar-02"[\s\S]*?href="\.\/secret\.html"/i);
});

test("dossier agrees with the deterministic expiring record and its four-step lineage", () => {
  const html = read("secret.html");
  const record = vault.secrets.find((item) => item.id === "seal-briar-02");
  const entries = lineage.entries_by_secret[record.id];
  assert.ok(html.includes(`data-vault-id="${record.id}"`));
  assert.ok(html.includes(`data-state="${record.state}"`));
  assert.ok(html.includes(`data-version="${record.version}"`));
  assert.ok(html.includes(`data-scope="${record.scope}"`));
  assert.ok(html.includes(record.label));
  assert.equal((html.match(/<ol\b[^>]*class="[^"]*vault-chain/i) ?? []).length, 1);
  for (const entry of entries) {
    assert.ok(html.includes(`data-version="${entry.version}"`), `dossier: lineage v${entry.version} missing`);
    assert.ok(html.includes(entry.at), `dossier: lineage timestamp missing`);
    assert.ok(html.includes(entry.actor), `dossier: lineage actor missing`);
  }
  assert.match(html, /DEED OF DESTRUCTION/);
  assert.match(html, /inspection will be recorded/i);
});

test("all policy labels are visible and no task-critical due text is CSS-hidden", () => {
  const pages = PAGES.map(read).join("\n");
  for (const policy of policies.scopes) {
    assert.ok(pages.includes(policy.label), `policy label missing: ${policy.label}`);
  }
  for (const file of STYLES) {
    for (const rule of parseCssRules(read(file))) {
      if (/\.vault-(?:due|seal|scope)|\[data-(?:state|sealed|due-days)/.test(rule.selector)) {
        assert.ok(!/display\s*:\s*none\b/i.test(rule.body), `${file}: task-critical selector hidden: ${rule.selector}`);
        assert.ok(!/visibility\s*:\s*hidden\b/i.test(rule.body), `${file}: task-critical selector invisible: ${rule.selector}`);
      }
    }
  }
});
