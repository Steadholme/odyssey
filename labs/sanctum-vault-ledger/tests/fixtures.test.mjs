// Zero-dependency data gate for the synthetic Sanctum Vault Ledger specimen.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const LAB = fileURLToPath(new URL("..", import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(join(LAB, "fixtures", name), "utf8"));

const vault = readJson("vault.json");
const policies = readJson("policies.json");
const lineage = readJson("lineage.json");
const schema = readJson("schema.json");

const DAY_MS = 24 * 60 * 60 * 1000;
const STATES = ["active", "expiring", "expired", "revoked"];
const PERSONA = /^persona-(ash|briar|cinder|dune|flint)$/;

function exactKeys(object, expected, label) {
  assert.deepEqual(Object.keys(object).sort(), [...expected].sort(), `${label}: keys drifted`);
}

function timestamp(value, label) {
  const parsed = Date.parse(value);
  assert.ok(Number.isFinite(parsed), `${label}: invalid ISO timestamp ${value}`);
  return parsed;
}

function visitKeys(value, path = "$", out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitKeys(item, `${path}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.push({ key, path: `${path}.${key}` });
      visitKeys(child, `${path}.${key}`, out);
    }
  }
  return out;
}

test("fixture bundle is explicitly synthetic and schema-shaped", () => {
  assert.equal(vault.synthetic, true);
  assert.equal(policies.synthetic, true);
  assert.equal(lineage.synthetic, true);

  exactKeys(vault, ["synthetic", "as_of", "secrets"], "vault");
  exactKeys(policies, ["synthetic", "scopes"], "policies");
  exactKeys(lineage, ["synthetic", "entries_by_secret"], "lineage");

  assert.deepEqual(
    schema.oneOf.map((entry) => entry.$ref),
    ["#/$defs/vaultDocument", "#/$defs/policiesDocument", "#/$defs/lineageDocument"],
  );
  assert.deepEqual(
    Object.keys(schema.$defs).sort(),
    ["lineageDocument", "lineageEntry", "policiesDocument", "policyRecord", "secretRecord", "vaultDocument"],
  );
  for (const name of ["vaultDocument", "secretRecord", "policiesDocument", "policyRecord", "lineageDocument", "lineageEntry"]) {
    assert.equal(schema.$defs[name].additionalProperties, false, `${name}: schema must fail closed`);
  }
  assert.deepEqual(schema.$defs.secretRecord.properties.state.enum, STATES);
  assert.deepEqual(
    schema.$defs.secretRecord.required,
    ["id", "label", "scope", "sealed", "version", "state", "created_at", "rotates_at"],
  );
});

test("canonical seed has eight records and the frozen state distribution", () => {
  assert.equal(vault.as_of, "2026-07-20T00:00:00Z");
  const asOf = timestamp(vault.as_of, "as_of");
  assert.equal(vault.secrets.length, 8);

  const ids = vault.secrets.map((record) => record.id);
  assert.equal(new Set(ids).size, 8, "record ids must be unique");
  const counts = Object.fromEntries(STATES.map((state) => [state, 0]));

  for (const record of vault.secrets) {
    exactKeys(
      record,
      ["id", "label", "scope", "sealed", "version", "state", "created_at", "rotates_at"],
      record.id,
    );
    assert.match(record.id, /^seal-[a-z]+-[0-9]{2}$/);
    assert.ok(record.label.length > 0);
    assert.equal(record.sealed, true, `${record.id}: all specimen records stay sealed`);
    assert.ok(Number.isInteger(record.version) && record.version >= 1);
    assert.ok(STATES.includes(record.state), `${record.id}: unknown state ${record.state}`);
    assert.ok(timestamp(record.created_at, `${record.id}.created_at`) <= asOf);
    timestamp(record.rotates_at, `${record.id}.rotates_at`);
    counts[record.state] += 1;
  }

  assert.deepEqual(counts, { active: 5, expiring: 1, expired: 1, revoked: 1 });
  const expiring = vault.secrets.find((record) => record.state === "expiring");
  const dueDays = Math.round((timestamp(expiring.rotates_at, "expiring.rotates_at") - asOf) / DAY_MS);
  assert.ok(dueDays >= 1 && dueDays <= 14, `expiring record must fall inside the 14-day window, got ${dueDays}`);
  assert.equal(expiring.id, "seal-briar-02", "the human-pilot seed needs one deterministic expiring record");

  const expired = vault.secrets.find((record) => record.state === "expired");
  assert.ok(timestamp(expired.rotates_at, "expired.rotates_at") < asOf);
});

test("three policies cover every record without dangling scopes", () => {
  assert.equal(policies.scopes.length, 3);
  const scopeIds = policies.scopes.map((policy) => policy.scope);
  assert.equal(new Set(scopeIds).size, 3);
  for (const policy of policies.scopes) {
    exactKeys(policy, ["scope", "label", "description"], policy.scope);
    assert.ok(policy.scope.length > 0 && policy.label.length > 0 && policy.description.length > 0);
  }
  for (const record of vault.secrets) {
    assert.ok(scopeIds.includes(record.scope), `${record.id}: unresolved policy scope ${record.scope}`);
  }
  assert.deepEqual(
    [...new Set(vault.secrets.map((record) => record.scope))].sort(),
    [...scopeIds].sort(),
    "every declared policy must be represented by the seed",
  );
});

test("lineage is closed, monotonic, synthetic, and reaches each current version", () => {
  const asOf = timestamp(vault.as_of, "as_of");
  const records = new Map(vault.secrets.map((record) => [record.id, record]));
  assert.deepEqual(Object.keys(lineage.entries_by_secret).sort(), [...records.keys()].sort());

  let longest = 0;
  for (const [id, entries] of Object.entries(lineage.entries_by_secret)) {
    assert.ok(records.has(id), `dangling lineage id ${id}`);
    assert.ok(entries.length >= 1, `${id}: lineage cannot be empty`);
    longest = Math.max(longest, entries.length);
    const versions = [];
    let priorAt = -Infinity;
    for (const entry of entries) {
      exactKeys(entry, ["version", "at", "actor"], `${id}.lineage`);
      assert.ok(Number.isInteger(entry.version) && entry.version >= 1);
      assert.match(entry.actor, PERSONA, `${id}: actor must be a synthetic persona`);
      const at = timestamp(entry.at, `${id}.lineage.at`);
      assert.ok(at >= priorAt, `${id}: lineage timestamps must be monotonic`);
      assert.ok(at <= asOf, `${id}: lineage cannot be future-dated`);
      priorAt = at;
      versions.push(entry.version);
    }
    assert.deepEqual(versions, Array.from({ length: entries.length }, (_, index) => index + 1), `${id}: versions must be contiguous`);
    assert.equal(versions.at(-1), records.get(id).version, `${id}: terminal lineage version drifted`);
  }
  assert.ok(longest >= 4, "at least one record must expose a four-entry custody chain");
  assert.equal(lineage.entries_by_secret["seal-briar-02"].length, 4);
});

test("fixtures contain no secret-material-shaped keys or real authority identifiers", () => {
  const forbiddenKey = /^(value|plaintext|ciphertext|token|key_material)$/i;
  for (const [name, document] of Object.entries({ vault, policies, lineage })) {
    for (const item of visitKeys(document)) {
      assert.ok(!forbiddenKey.test(item.key), `${name}: forbidden key at ${item.path}`);
    }
  }

  const text = JSON.stringify({ vault, policies, lineage });
  const forbiddenText = [
    "w33d.xyz", "build_dev_state", "DEV_MASTER_KEY", "GATEWAY_HMAC_KEY",
    "SANCTUM_STORE", "InMemoryStore", "X-Gateway-Zone", "X-Auth-",
    "Sluice", "Keystone", "Ed25519", "/api/v1/", "/transit/", "/s/",
  ];
  for (const word of forbiddenText) {
    assert.ok(!text.includes(word), `fixture bundle contains forbidden authority identifier: ${word}`);
  }
  assert.ok(!/@/.test(text), "fixture bundle must not contain an email-shaped identity");

  for (const match of text.matchAll(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi)) {
    const candidate = match[0];
    if (/^\d{4}-\d{2}-\d{2}T/.test(candidate)) continue;
    assert.ok(candidate.endsWith(".example.invalid"), `non-reserved domain-like string: ${candidate}`);
  }
});
