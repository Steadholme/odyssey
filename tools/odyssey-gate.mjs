#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const SAMPLE_SCHEMA = "odyssey.canarySample.v1";
const WINDOW_SCHEMA = "odyssey.canaryWindow.v1";
const DECISION_SCHEMA = "odyssey.canaryDecision.v1";
const APPROVAL_SCHEMA = "odyssey.promotionApproval.v1";
const BROWSER_SCHEMA = "odyssey.browserSmoke.v1";
const TIP_SCHEMA = "odyssey.canaryTip.v1";
const REQUIRED_COHORT = ["beacon", "portal"];
const REQUIRED_NEXT_COHORT = ["sanctum"];
const REQUIRED_BROWSER_CHECKS = [
  "status_desktop_refresh",
  "status_mobile_refresh",
  "portal_desktop_refresh",
  "portal_mobile_refresh",
  "no_javascript_floor",
];
const REQUIRED_EVIDENCE_GROUPS = ["canonical", "runtime", "routes", "public", "browser"];
const JSON_LIMIT_BYTES = 5 * 1024 * 1024;

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(ordered(value));
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash("sha256").update(bytes).digest("hex");
}

function withoutKey(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

const SECRET_VALUE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i,
  /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /(?:https?|postgres(?:ql)?):\/\/[^\s/:@]+:[^\s/@]+@/i,
  /[?&](?:access_token|api_key|password|secret|token)=[^&\s]+/i,
  /\b(?:set-cookie|cookie):\s*[^\s;=]+=[^\s;]+/i,
];
const SECRET_KEY = /^(?:authorization|cookie|set-cookie|password|passphrase|private[_-]?key|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|raw[_-]?(?:secret|token))$/i;

export function scanForSecrets(value) {
  const findings = [];
  const visit = (entry, at, key = "") => {
    if (typeof entry === "string") {
      if (SECRET_KEY.test(key)) findings.push({ at, kind: "sensitive_key" });
      for (let index = 0; index < SECRET_VALUE_PATTERNS.length; index += 1) {
        if (SECRET_VALUE_PATTERNS[index].test(entry)) findings.push({ at, kind: `pattern_${index + 1}` });
      }
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, `${at}[${index}]`));
      return;
    }
    if (entry && typeof entry === "object") {
      for (const [childKey, child] of Object.entries(entry)) visit(child, `${at}.${childKey}`, childKey);
    }
  };
  visit(value, "$");
  return findings;
}

export function assertNoSecrets(value) {
  if (scanForSecrets(value).length > 0) throw new Error("secret_material_refused");
}

export async function atomicWriteJson(filePath, value, options = {}) {
  assertNoSecrets(value);
  const directory = path.dirname(filePath);
  if (options.createDirectory !== false) {
    await fs.mkdir(directory, { recursive: true, mode: options.directoryMode ?? 0o700 });
  }
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  let handle;
  try {
    handle = await fs.open(temporary, "wx", options.mode ?? 0o600);
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, filePath);
    await fs.chmod(filePath, options.mode ?? 0o600);
    try {
      const directoryHandle = await fs.open(directory, "r");
      await directoryHandle.sync();
      await directoryHandle.close();
    } catch {
      // Some filesystems do not support fsync on directories.
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function atomicCreateJson(filePath, value, options = {}) {
  assertNoSecrets(value);
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true, mode: options.directoryMode ?? 0o700 });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  let handle;
  try {
    handle = await fs.open(temporary, "wx", options.mode ?? 0o600);
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.link(temporary, filePath);
    await fs.rm(temporary, { force: true });
    await fs.chmod(filePath, options.mode ?? 0o600);
    try {
      const directoryHandle = await fs.open(directory, "r");
      await directoryHandle.sync();
      await directoryHandle.close();
    } catch {
      // Some filesystems do not support fsync on directories.
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
    if (error?.code === "EEXIST") throw new Error("sample_already_exists");
    throw error;
  }
}

async function readJson(filePath) {
  const bytes = await fs.readFile(filePath);
  if (bytes.length > JSON_LIMIT_BYTES) throw new Error("json_too_large");
  return JSON.parse(bytes.toString("utf8"));
}

async function listVendorFiles(directory, relative = "", files = []) {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name === "target" || entry.name === ".git" || (relative === "" && entry.name === "Cargo.lock")) continue;
    const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) await listVendorFiles(directory, child, files);
    else if (entry.isFile()) files.push(child);
    else throw new Error("unsupported_vendor_tree_entry");
  }
  return files;
}

async function listDirectoryFiles(directory, relative = "", files = []) {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) await listDirectoryFiles(directory, child, files);
    else if (entry.isFile()) files.push(child);
    else throw new Error("unsupported_directory_tree_entry");
  }
  return files;
}

async function hashDirectoryFiles(directory, files) {
  const digest = createHash("sha256");
  for (const relative of files) {
    const bytes = await fs.readFile(path.join(directory, relative));
    digest.update(relative, "utf8");
    digest.update(Buffer.from([0]));
    digest.update(bytes);
    digest.update(Buffer.from([0xff]));
  }
  return digest.digest("hex");
}

export async function directoryTreeSha256(directory) {
  return hashDirectoryFiles(directory, await listDirectoryFiles(directory));
}

export async function vendorTreeSha256(directory) {
  return hashDirectoryFiles(directory, await listVendorFiles(directory));
}

function exactMembers(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`invalid_policy_${name}`);
}

function requirePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`invalid_policy_${name}`);
}

function validatePublicUrl(value, name, protocols = ["https:"]) {
  requireString(value, name);
  const parsed = new URL(value);
  if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`invalid_policy_${name}`);
  }
}

export function validatePolicy(policy, stateDir) {
  if (!policy || typeof policy !== "object" || policy.schemaVersion !== "odyssey.canaryPolicy.v1") {
    throw new Error("invalid_policy_schema");
  }
  for (const field of ["release", "fingerprint", "stableRelease", "stableFingerprint", "odysseyRoot", "deployRoot", "odysseyctlPath"]) {
    requireString(policy[field], field);
  }
  if (!/^[a-f0-9]{40}$/i.test(policy.canonicalCommit ?? "")) throw new Error("invalid_policy_canonical_commit");
  if (!/^[a-f0-9]{64}$/i.test(policy.stableVendorTreeSha256 ?? "")) throw new Error("invalid_policy_stable_vendor_tree_sha256");
  for (const field of ["windowSeconds", "sampleIntervalSeconds", "maxGapSeconds", "minSamples", "maxEvidenceAgeSeconds", "browserMaxAgeSeconds", "maxP95Ms"]) {
    requirePositiveInteger(policy[field], field);
  }
  if (!exactMembers(policy.cohort, REQUIRED_COHORT)) throw new Error("invalid_policy_cohort");
  if (!exactMembers(policy.nextCohort, REQUIRED_NEXT_COHORT)) throw new Error("invalid_policy_next_cohort");
  if (!Array.isArray(policy.containers) || policy.containers.length < 3) throw new Error("invalid_policy_containers");
  const names = new Set();
  for (const container of policy.containers) {
    for (const field of ["name", "image", "rollbackTag"]) requireString(container?.[field], `container_${field}`);
    if (!/^sha256:[a-f0-9]{64}$/i.test(container?.currentImageId ?? "")) throw new Error("invalid_policy_container_current_image_id");
    if (!/^sha256:[a-f0-9]{64}$/i.test(container?.rollbackImageId ?? "")) throw new Error("invalid_policy_container_rollback_image_id");
    if (container.currentImageId === container.rollbackImageId) throw new Error("invalid_policy_container_rollback_matches_current");
    if (names.has(container.name)) throw new Error("invalid_policy_duplicate_container");
    names.add(container.name);
  }
  if (!policy.public || typeof policy.public !== "object") throw new Error("invalid_policy_public");
  validatePublicUrl(policy.public.statusBaseUrl, "status_url");
  validatePublicUrl(policy.public.portalUrl, "portal_url");
  validatePublicUrl(policy.public.odysseyUrl, "odyssey_url");
  if (policy.public.portalSsoOrigin) validatePublicUrl(policy.public.portalSsoOrigin, "portal_sso_origin");
  const assets = policy.public.assetSha256;
  if (!assets || typeof assets !== "object" || Array.isArray(assets) || Object.keys(assets).length === 0) throw new Error("invalid_policy_assets");
  let stableAsset = false;
  let canaryAsset = false;
  for (const [assetPath, digest] of Object.entries(assets)) {
    if (!assetPath.startsWith("/") || !/^[a-f0-9]{64}$/i.test(String(digest).replace(/^sha256:/, ""))) throw new Error("invalid_policy_asset_hash");
    stableAsset ||= assetPath.includes("/1.1/");
    canaryAsset ||= assetPath.includes("/1.2/");
  }
  if (!stableAsset || !canaryAsset) throw new Error("invalid_policy_asset_generations");
  if (!policy.browser || typeof policy.browser !== "object") throw new Error("invalid_policy_browser");
  requireString(policy.browser.evidencePath, "browser_evidence_path");
  requireString(policy.browser.endpointPath, "browser_endpoint_path");
  if (!policy.implementation || typeof policy.implementation !== "object") throw new Error("invalid_policy_implementation");
  for (const field of ["collectorPath", "browserRunnerPath", "browserRuntimePath"]) {
    requireString(policy.implementation[field], `implementation_${field}`);
  }
  for (const field of ["collectorSha256", "browserRunnerSha256", "browserRuntimeSha256"]) {
    if (!/^[a-f0-9]{64}$/i.test(policy.implementation[field] ?? "")) throw new Error(`invalid_policy_implementation_${field}`);
  }
  if (!policy.approval || typeof policy.approval !== "object") throw new Error("invalid_policy_approval");
  requireString(policy.approval.keyId, "approval_key_id");
  requireString(policy.approval.publicKeyPath, "approval_public_key_path");
  requirePositiveInteger(policy.approval.maxAgeSeconds, "approval_max_age_seconds");
  if (policy.approval.publicKeySpkiSha256 !== null
    && !/^[a-f0-9]{64}$/i.test(policy.approval.publicKeySpkiSha256 ?? "")) {
    throw new Error("invalid_policy_approval_public_key_spki_sha256");
  }
  if (stateDir && path.basename(path.resolve(stateDir)) !== policy.release) throw new Error("state_dir_must_be_release_specific");
  return policy;
}

export function policyDigest(policy) {
  return sha256(canonicalJson(policy));
}

function iso(now) {
  const date = now instanceof Date ? now : new Date(now ?? Date.now());
  if (!Number.isFinite(date.getTime())) throw new Error("invalid_time");
  return date.toISOString();
}

function epoch(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NaN;
}

function windowIdentityMatches(policy, window) {
  return window?.schemaVersion === WINDOW_SCHEMA
    && window.release === policy.release
    && window.fingerprint === policy.fingerprint
    && window.stableRelease === policy.stableRelease
    && window.stableFingerprint === policy.stableFingerprint
    && exactMembers(window.cohort, policy.cohort)
    && exactMembers(window.nextCohort, policy.nextCohort)
    && window.policySha256 === policyDigest(policy);
}

export async function startWindow(policy, stateDir, options = {}) {
  validatePolicy(policy, stateDir);
  await fs.mkdir(path.join(stateDir, "samples"), { recursive: true, mode: 0o700 });
  const statePath = path.join(stateDir, "state.json");
  try {
    const existing = await readJson(statePath);
    if (!windowIdentityMatches(policy, existing)) throw new Error("existing_window_identity_mismatch");
    await ensureWindowTip(stateDir, existing);
    return existing;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const window = {
    schemaVersion: WINDOW_SCHEMA,
    windowId: randomUUID(),
    release: policy.release,
    fingerprint: policy.fingerprint,
    stableRelease: policy.stableRelease,
    stableFingerprint: policy.stableFingerprint,
    cohort: [...policy.cohort],
    nextCohort: [...policy.nextCohort],
    policySha256: policyDigest(policy),
    startedAt: iso(options.now),
    windowSeconds: policy.windowSeconds,
  };
  await atomicWriteJson(statePath, window);
  await ensureWindowTip(stateDir, window);
  return window;
}

export function sealSample(sample) {
  const sealed = structuredClone(sample);
  delete sealed.sha256;
  sealed.sha256 = sha256(canonicalJson(sealed));
  return sealed;
}

export function verifySampleChain(samples) {
  let previous = null;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const expectedDigest = sha256(canonicalJson(withoutKey(sample, "sha256")));
    if (sample.schemaVersion !== SAMPLE_SCHEMA
      || sample.sequence !== index + 1
      || sample.previousSha256 !== previous
      || sample.sha256 !== expectedDigest) return false;
    previous = sample.sha256;
  }
  return true;
}

function expectedTip(window, samples) {
  return {
    schemaVersion: TIP_SCHEMA,
    windowId: window.windowId,
    sequence: samples.length,
    sampleSha256: samples.at(-1)?.sha256 ?? null,
  };
}

function tipMatches(window, samples, tip) {
  return canonicalJson(tip) === canonicalJson(expectedTip(window, samples));
}

async function ensureWindowTip(stateDir, window) {
  const tipPath = path.join(stateDir, "tip.json");
  try {
    const tip = await readJson(tipPath);
    if (tip?.schemaVersion !== TIP_SCHEMA || tip.windowId !== window.windowId) throw new Error("existing_tip_identity_mismatch");
    return tip;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const samples = await loadSamples(stateDir);
  if (samples.length !== 0) throw new Error("missing_tip_for_existing_samples");
  const tip = expectedTip(window, []);
  await atomicCreateJson(tipPath, tip);
  return tip;
}

async function readTip(stateDir) {
  return readJson(path.join(stateDir, "tip.json"));
}

async function loadSamples(stateDir) {
  const sampleDirectory = path.join(stateDir, "samples");
  let names;
  try {
    names = (await fs.readdir(sampleDirectory)).filter((name) => /^\d{6}\.json$/.test(name)).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const samples = [];
  for (const name of names) samples.push(await readJson(path.join(sampleDirectory, name)));
  return samples;
}

async function appendSample(stateDir, window, sample) {
  const samples = await loadSamples(stateDir);
  const tip = await readTip(stateDir);
  if (!verifySampleChain(samples) || !tipMatches(window, samples, tip)) throw new Error("persisted_sample_tip_mismatch");
  const sequence = samples.length + 1;
  if (sample.sequence !== sequence || sample.previousSha256 !== (samples.at(-1)?.sha256 ?? null)) throw new Error("sample_chain_append_conflict");
  const filePath = path.join(stateDir, "samples", `${String(sequence).padStart(6, "0")}.json`);
  await atomicCreateJson(filePath, sample);
  const nextTip = expectedTip(window, [...samples, sample]);
  await atomicWriteJson(path.join(stateDir, "tip.json"), nextTip);
  await atomicWriteJson(path.join(stateDir, "latest.json"), sample);
  return { sample, tip: nextTip };
}

function sampleIdentityMatches(policy, window, sample) {
  const identity = sample?.identity;
  return sample.windowId === window.windowId
    && identity?.release === policy.release
    && identity?.fingerprint === policy.fingerprint
    && identity?.stableRelease === policy.stableRelease
    && identity?.stableFingerprint === policy.stableFingerprint
    && identity?.policySha256 === window.policySha256
    && exactMembers(identity?.cohort, policy.cohort)
    && exactMembers(identity?.nextCohort, policy.nextCohort);
}

function runtimeIdentitySnapshot(policy, sample) {
  const containers = sample?.runtime?.containers;
  if (!Array.isArray(containers) || containers.length !== policy.containers.length) return null;
  const snapshot = [];
  for (const [index, container] of containers.entries()) {
    const expected = policy.containers[index];
    if (typeof container?.id !== "string" || container.id === ""
      || container.imageId !== expected.currentImageId
      || container.tagImageId !== expected.currentImageId
      || container.rollbackImageId !== expected.rollbackImageId
      || container.rollbackImageId === container.imageId
      || !Number.isSafeInteger(container.restartCount) || container.restartCount < 0) return null;
    snapshot.push({
      id: container.id,
      imageId: container.imageId,
      tagImageId: container.tagImageId,
      rollbackImageId: container.rollbackImageId,
      restartCount: container.restartCount,
    });
  }
  snapshot.sort((left, right) => left.id.localeCompare(right.id));
  return snapshot;
}

function runtimeIdentityStable(policy, samples) {
  if (samples.length === 0) return true;
  const baseline = runtimeIdentitySnapshot(policy, samples[0]);
  if (!baseline) return false;
  const expected = canonicalJson(baseline);
  return samples.every((sample) => {
    const snapshot = runtimeIdentitySnapshot(policy, sample);
    return snapshot !== null && canonicalJson(snapshot) === expected;
  });
}

function successfulEvidenceDetailsValid(policy, sample) {
  const canonical = sample.canonical;
  const canonicalValid = !canonical.complete || !canonical.passed || (
    canonical.manifestMatches === true
    && canonical.cohortCheckPassed === true
    && canonical.cohortVendorMatches === true
    && canonical.stableFencePassed === true
    && canonical.stableTreePassed === true
    && canonical.implementationMatches === true
    && canonical.collectorSha256 === policy.implementation.collectorSha256
    && canonical.browserRunnerSha256 === policy.implementation.browserRunnerSha256
    && canonical.browserRuntimeSha256 === policy.implementation.browserRuntimeSha256
    && canonical.canonicalCommitValid === true
    && canonical.consumerCount === 27
    && canonical.stableCount === 25
    && canonical.stableVendorTreeSha256 === policy.stableVendorTreeSha256
    && /^[a-f0-9]{64}$/.test(canonical.canonicalCommitSha256 ?? "")
    && /^[a-f0-9]{64}$/.test(canonical.consumersSha256 ?? "")
  );
  const runtime = sample.runtime;
  const runtimeValid = !runtime.complete || !runtime.passed || (
    runtime.endpointWritten === true
    && Array.isArray(runtime.containers)
    && runtime.containers.length === policy.containers.length
    && runtime.containers.every((container) => container.inspectAvailable === true
      && container.running === true
      && container.healthy === true
      && container.expectedImage === true
      && container.rollbackAvailable === true
      && Number.isSafeInteger(container.restartCount) && container.restartCount >= 0
      && Number.isSafeInteger(container.fatalCount) && container.fatalCount === 0
      && Number.isSafeInteger(container.cspCount) && container.cspCount === 0
      && Number.isSafeInteger(container.secretLikeCount) && container.secretLikeCount === 0)
  );
  const routes = sample.routes;
  const routesValid = !routes.complete || !routes.passed || (
    routes.queryPassed === true && routes.rowCount === 2
    && routes.statusPublic === true && routes.portalSso === true
  );
  const publicEvidence = sample.public;
  const status = publicEvidence.status;
  const expectedAssetHashes = Object.values(policy.public.assetSha256)
    .map((digest) => String(digest).replace(/^sha256:/, "").toLowerCase()).sort();
  const observedAssetHashes = Array.isArray(publicEvidence.assets)
    ? publicEvidence.assets.map((asset) => asset?.expectedSha256).sort() : [];
  const publicValid = !publicEvidence.complete || !publicEvidence.passed || (
    Number.isFinite(publicEvidence.p95Ms) && publicEvidence.p95Ms <= policy.maxP95Ms
    && status?.rootStatus === 200 && status?.pageStatus === 200 && status?.apiStatus === 200
    && status?.adminStatus === 401 && status?.wireStatus === 200 && status?.wireAdminStatus === 401
    && status?.noStore === true && status?.variesOnWire === true && status?.apiJson === true
    && status?.parity === true && status?.wireSafe === true && status?.boundaryHeaders === true
    && status?.excludesForbiddenHosts === true
    && Number.isSafeInteger(status?.parityAttempts) && status.parityAttempts >= 1 && status.parityAttempts <= 3
    && /^[a-f0-9]{64}$/.test(status?.fullFragmentSha256 ?? "")
    && /^[a-f0-9]{64}$/.test(status?.wireFragmentSha256 ?? "")
    && /^[a-f0-9]{64}$/.test(status?.normalizedFullFragmentSha256 ?? "")
    && status.normalizedFullFragmentSha256 === status.normalizedWireFragmentSha256
    && [302, 303, 307, 308].includes(publicEvidence.portal?.status)
    && publicEvidence.portal?.ssoRedirect === true
    && publicEvidence.odyssey?.status === 200 && publicEvidence.odyssey?.canaryAdvertised === true
    && Array.isArray(publicEvidence.assets)
    && publicEvidence.assets.length === expectedAssetHashes.length
    && publicEvidence.assets.every((asset) => asset?.immutable === true && asset?.matched === true
      && /^[a-f0-9]{64}$/.test(asset?.observedSha256 ?? "")
      && asset.observedSha256 === asset.expectedSha256)
    && canonicalJson(observedAssetHashes) === canonicalJson(expectedAssetHashes)
  );
  const browser = sample.browser;
  const browserValid = !browser.complete || !browser.passed || (
    browser.available === true && browser.fresh === true
    && Number.isFinite(epoch(browser.checkedAt))
    && browser.checkCount === REQUIRED_BROWSER_CHECKS.length
    && browser.failedCheckCount === 0
    && /^[a-f0-9]{64}$/.test(browser.evidenceSha256 ?? "")
  );
  return canonicalValid && runtimeValid && routesValid && publicValid && browserValid;
}

function deriveSampleSummary(policy, sample) {
  const groups = REQUIRED_EVIDENCE_GROUPS.map((name) => sample?.[name]);
  const shapeValid = groups.every((group) => group && typeof group === "object"
    && typeof group.complete === "boolean"
    && typeof group.passed === "boolean"
    && typeof group.observedFailure === "boolean");
  const relationshipValid = shapeValid && groups.every((group) => (
    !(group.observedFailure && group.passed)
    && !(group.complete && !group.passed && !group.observedFailure)
  ));
  const collectionComplete = shapeValid && groups.every((group) => group.complete === true);
  const hardFailure = groups.some((group) => group?.observedFailure === true) || sample?.hardFailure === true;
  const flagsValid = typeof sample?.collectionComplete === "boolean"
    && typeof sample?.hardFailure === "boolean"
    && sample.collectionComplete === collectionComplete
    && sample.hardFailure === groups.some((group) => group?.observedFailure === true);
  const detailsValid = shapeValid && successfulEvidenceDetailsValid(policy, sample);
  return { shapeValid: shapeValid && relationshipValid && detailsValid, flagsValid, collectionComplete, hardFailure };
}

function decision(policy, window, samples, status, now, checks, tip) {
  const result = {
    schemaVersion: DECISION_SCHEMA,
    status,
    evaluatedAt: iso(now),
    release: policy.release,
    fingerprint: policy.fingerprint,
    windowId: window?.windowId ?? null,
    sampleCount: samples.length,
    tipSequence: tip?.sequence ?? null,
    tipSampleSha256: tip?.sampleSha256 ?? null,
    evidenceSha256: sha256(canonicalJson({
      window: window ? sha256(canonicalJson(window)) : null,
      samples: samples.map((sample) => sample.sha256 ?? null),
      tip: tip ? sha256(canonicalJson(tip)) : null,
    })),
    checks,
    promotionPlan: {
      currentCohort: [...policy.cohort],
      nextCohort: [...REQUIRED_NEXT_COHORT],
      autoExecute: false,
      commands: [],
    },
  };
  assertNoSecrets(result);
  return result;
}

export function evaluateEvidence({ policy, window, samples, tip, now = new Date() }) {
  validatePolicy(policy);
  const nowMs = new Date(now).getTime();
  const checks = [];
  const add = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  const windowIdentity = windowIdentityMatches(policy, window);
  add("window_identity", windowIdentity);
  if (!windowIdentity || !Number.isFinite(nowMs)) return decision(policy, window, samples, "hold", now, checks, tip);
  const chainValid = verifySampleChain(samples);
  add("sample_chain", chainValid);
  if (!chainValid) return decision(policy, window, samples, "hold", now, checks, tip);
  const sampleTipValid = tipMatches(window, samples, tip);
  add("sample_tip", sampleTipValid);
  if (!sampleTipValid) return decision(policy, window, samples, "hold", now, checks, tip);
  const identitiesValid = samples.every((sample) => sampleIdentityMatches(policy, window, sample));
  add("sample_identity", identitiesValid);
  if (!identitiesValid) return decision(policy, window, samples, "hold", now, checks, tip);
  const summaries = samples.map((sample) => deriveSampleSummary(policy, sample));
  const evidenceShapeValid = summaries.every((summary) => summary.shapeValid);
  const summaryFlagsValid = summaries.every((summary) => summary.flagsValid);
  add("sample_evidence_shape", evidenceShapeValid);
  add("sample_summary_flags", summaryFlagsValid);
  const hardFailure = summaries.some((summary) => summary.hardFailure);
  add("hard_gates", !hardFailure);
  if (hardFailure) return decision(policy, window, samples, "rollback_required", now, checks, tip);
  if (!evidenceShapeValid || !summaryFlagsValid) return decision(policy, window, samples, "hold", now, checks, tip);
  const runtimeStable = runtimeIdentityStable(policy, samples);
  add("runtime_identity_stable", runtimeStable);
  if (!runtimeStable) return decision(policy, window, samples, "hold", now, checks, tip);
  const startMs = epoch(window.startedAt);
  if (samples.length === 0) {
    const startValid = Number.isFinite(startMs) && startMs <= nowMs;
    const ageSeconds = startValid ? (nowMs - startMs) / 1000 : Number.POSITIVE_INFINITY;
    const initialGapValid = ageSeconds >= 0 && ageSeconds <= policy.maxGapSeconds;
    add("timestamps", startValid);
    add("window_elapsed", false, Number.isFinite(ageSeconds) ? ageSeconds : null);
    add("sample_count", false, 0);
    add("sample_gaps", initialGapValid, Number.isFinite(ageSeconds) ? ageSeconds : null);
    return decision(policy, window, samples, startValid && initialGapValid ? "observing" : "hold", now, checks, tip);
  }
  const times = samples.map((sample) => epoch(sample.observedAt));
  const timestampsValid = Number.isFinite(startMs)
    && startMs <= nowMs
    && times.every(Number.isFinite)
    && times[0] >= startMs
    && times.every((time, index) => index === 0 || time > times[index - 1]);
  add("timestamps", timestampsValid);
  if (!timestampsValid) return decision(policy, window, samples, "hold", now, checks, tip);
  const elapsedSeconds = Math.floor((times.at(-1) - startMs) / 1000);
  const observing = elapsedSeconds < policy.windowSeconds;
  add("window_elapsed", !observing, elapsedSeconds);
  const enoughSamples = samples.length >= policy.minSamples;
  add("sample_count", enoughSamples, samples.length);
  const gaps = [times[0] - startMs, ...times.slice(1).map((time, index) => time - times[index])];
  const maxGap = Math.max(...gaps) / 1000;
  const gapsValid = maxGap <= policy.maxGapSeconds;
  add("sample_gaps", gapsValid, maxGap);
  const collectionsComplete = summaries.every((summary) => summary.collectionComplete);
  add("collection_complete", collectionsComplete);
  const evidenceAge = (nowMs - times.at(-1)) / 1000;
  const evidenceFresh = evidenceAge >= 0 && evidenceAge <= policy.maxEvidenceAgeSeconds;
  add("evidence_fresh", evidenceFresh, evidenceAge);
  const browser = samples.at(-1).browser;
  const browserAge = browser?.checkedAt ? (nowMs - epoch(browser.checkedAt)) / 1000 : Number.POSITIVE_INFINITY;
  const browserFresh = browser?.passed === true && browserAge >= 0 && browserAge <= policy.browserMaxAgeSeconds;
  add("browser_fresh", browserFresh, Number.isFinite(browserAge) ? browserAge : null);
  const p95Valid = samples.every((sample) => Number.isFinite(sample.public?.p95Ms) && sample.public.p95Ms <= policy.maxP95Ms);
  add("public_p95", p95Valid);
  if (observing && gapsValid && collectionsComplete && evidenceFresh && browserFresh && p95Valid) {
    return decision(policy, window, samples, "observing", now, checks, tip);
  }
  const ready = enoughSamples && gapsValid && collectionsComplete && evidenceFresh && browserFresh && p95Valid;
  return decision(policy, window, samples, ready ? "ready_for_manual_approval" : "hold", now, checks, tip);
}

async function writeDecision(stateDir, result) {
  await atomicWriteJson(path.join(stateDir, "decision.json"), result);
  await atomicWriteJson(path.join(stateDir, "promotion-plan.json"), result.promotionPlan);
}

function approvalPayload(policy, evaluation, samples, actor, reason, now) {
  requireString(actor, "approval_actor");
  requireString(reason, "approval_reason");
  const issuedAt = iso(now);
  const maxAgeSeconds = Number.isSafeInteger(policy.approval.maxAgeSeconds) && policy.approval.maxAgeSeconds > 0
    ? policy.approval.maxAgeSeconds : 3600;
  return {
    schemaVersion: "odyssey.promotionApprovalPayload.v1",
    approvalId: randomUUID(),
    keyId: policy.approval.keyId,
    release: policy.release,
    fingerprint: policy.fingerprint,
    windowId: evaluation.windowId,
    evidenceSha256: evaluation.evidenceSha256,
    cutoffSequence: samples.length,
    cutoffSampleSha256: samples.at(-1)?.sha256 ?? null,
    currentCohort: [...policy.cohort],
    nextCohort: [...REQUIRED_NEXT_COHORT],
    actor,
    reason,
    issuedAt,
    expiresAt: new Date(epoch(issuedAt) + maxAgeSeconds * 1000).toISOString(),
    autoExecute: false,
  };
}

export async function verifyApproval({
  policy,
  window,
  samples,
  tip,
  approval,
  publicKeyPath = policy?.approval?.publicKeyPath,
  now = new Date(),
}) {
  validatePolicy(policy);
  requireString(publicKeyPath, "approval_public_key_path");
  if (policy.approval.publicKeySpkiSha256 === null
    || !approval || approval.schemaVersion !== APPROVAL_SCHEMA || approval.algorithm !== "Ed25519") return false;
  const payload = approval.payload;
  const currentEvaluation = evaluateEvidence({ policy, window, samples, tip, now });
  if (!payload || approval.keyId !== policy.approval.keyId || payload.keyId !== policy.approval.keyId
    || payload.schemaVersion !== "odyssey.promotionApprovalPayload.v1"
    || typeof payload.approvalId !== "string" || payload.approvalId === ""
    || typeof payload.actor !== "string" || payload.actor.trim() === ""
    || typeof payload.reason !== "string" || payload.reason.trim() === ""
    || payload.release !== policy.release || payload.fingerprint !== policy.fingerprint
    || payload.windowId !== currentEvaluation.windowId
    || !exactMembers(payload.currentCohort, policy.cohort) || !exactMembers(payload.nextCohort, REQUIRED_NEXT_COHORT)
    || payload.autoExecute !== false || currentEvaluation.status !== "ready_for_manual_approval"
    || !Number.isSafeInteger(payload.cutoffSequence) || payload.cutoffSequence < policy.minSamples
    || payload.cutoffSequence > samples.length
    || samples[payload.cutoffSequence - 1]?.sha256 !== payload.cutoffSampleSha256) return false;
  const nowMs = new Date(now).getTime();
  const issuedMs = epoch(payload.issuedAt);
  const expiresMs = epoch(payload.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(issuedMs) || !Number.isFinite(expiresMs)
    || expiresMs <= issuedMs || expiresMs - issuedMs > policy.approval.maxAgeSeconds * 1000
    || nowMs < issuedMs || nowMs > expiresMs) return false;
  const cutoffSamples = samples.slice(0, payload.cutoffSequence);
  const cutoffTip = expectedTip(window, cutoffSamples);
  const cutoffEvaluation = evaluateEvidence({
    policy,
    window,
    samples: cutoffSamples,
    tip: cutoffTip,
    now: new Date(issuedMs),
  });
  if (cutoffEvaluation.status !== "ready_for_manual_approval"
    || cutoffEvaluation.evidenceSha256 !== payload.evidenceSha256) return false;
  if (approval.approvalSha256 !== sha256(canonicalJson({ keyId: approval.keyId, payload, signature: approval.signature }))) return false;
  try {
    const publicKey = createPublicKey(await fs.readFile(publicKeyPath));
    const publicKeyDigest = sha256(publicKey.export({ type: "spki", format: "der" }));
    if (publicKey.asymmetricKeyType !== "ed25519" || publicKeyDigest !== policy.approval.publicKeySpkiSha256) return false;
    return cryptoVerify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(approval.signature, "base64url"));
  } catch {
    return false;
  }
}

export async function approveWindow(policy, stateDir, options = {}) {
  validatePolicy(policy, stateDir);
  if (options.target !== `${policy.release}@${policy.fingerprint}`) throw new Error("approval_target_identity_mismatch");
  requireString(options.privateKeyPath, "approval_private_key_path");
  const window = await readJson(path.join(stateDir, "state.json"));
  const samples = await loadSamples(stateDir);
  const tip = await readTip(stateDir);
  const evaluation = evaluateEvidence({ policy, window, samples, tip, now: options.now });
  if (evaluation.status !== "ready_for_manual_approval") throw new Error("window_not_ready_for_manual_approval");
  if (policy.approval.publicKeySpkiSha256 === null) throw new Error("approval_public_key_unprovisioned");
  const stat = await fs.stat(options.privateKeyPath);
  if ((stat.mode & 0o077) !== 0) throw new Error("approval_private_key_permissions_too_open");
  const privateKey = await fs.readFile(options.privateKeyPath);
  const payload = approvalPayload(policy, evaluation, samples, options.actor, options.reason, options.now);
  const signature = cryptoSign(null, Buffer.from(canonicalJson(payload)), privateKey).toString("base64url");
  const approval = {
    schemaVersion: APPROVAL_SCHEMA,
    algorithm: "Ed25519",
    keyId: policy.approval.keyId,
    payload,
    signature,
    approvalSha256: sha256(canonicalJson({ keyId: policy.approval.keyId, payload, signature })),
  };
  if (!await verifyApproval({ policy, window, samples, tip, approval, now: options.now })) throw new Error("approval_signature_verification_failed");
  await atomicWriteJson(path.join(stateDir, "approval.json"), approval);
  return approval;
}

export async function defaultRunCommand(program, args, options = {}) {
  const startedAt = Date.now();
  try {
    const result = await execFileAsync(program, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
      encoding: "utf8",
      windowsHide: true,
    });
    return { exitCode: 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "", durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : "",
      durationMs: Date.now() - startedAt,
    };
  }
}

function parseKeyValues(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

async function inspectContainer(runCommand, name) {
  const result = await runCommand("docker", ["inspect", name], { timeoutMs: 20_000 });
  if (result.exitCode !== 0) return { complete: false, value: null };
  try {
    const parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed) || !parsed[0] || typeof parsed[0] !== "object") throw new Error("invalid_inspect");
    return { complete: true, value: parsed[0] };
  } catch {
    return { complete: false, value: null };
  }
}

function portalUrlFromInspect(portalInspect) {
  const networks = portalInspect?.NetworkSettings?.Networks;
  const address = networks && typeof networks === "object"
    ? Object.values(networks).map((network) => network?.IPAddress).find((value) => typeof value === "string" && value !== "")
    : null;
  if (!address || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) throw new Error("portal_container_ip_unavailable");
  return `http://${address}:8600`;
}

export async function writeBrowserEndpoint(policy, portalInspect) {
  validatePolicy(policy);
  const endpoint = { portalUrl: portalUrlFromInspect(portalInspect) };
  const directory = path.dirname(policy.browser.endpointPath);
  const directoryStat = await fs.stat(directory);
  if (!directoryStat.isDirectory() || (directoryStat.mode & 0o2777) !== 0o2750) {
    throw new Error("browser_endpoint_directory_permissions_invalid");
  }
  await atomicWriteJson(policy.browser.endpointPath, endpoint, { mode: 0o640, createDirectory: false });
  return { written: true, endpointSha256: sha256(canonicalJson(endpoint)) };
}

async function collectCanonical(policy, runCommand) {
  const manifestResult = await runCommand(policy.odysseyctlPath, ["manifest"], { cwd: policy.odysseyRoot });
  const checkResult = await runCommand(policy.odysseyctlPath, ["check", "--repo", policy.cohort.join(",")], { cwd: policy.odysseyRoot });
  const commitExists = await runCommand("git", ["-C", policy.odysseyRoot, "cat-file", "-e", `${policy.canonicalCommit}^{commit}`], { timeoutMs: 20_000 });
  const commitAncestor = await runCommand("git", ["-C", policy.odysseyRoot, "merge-base", "--is-ancestor", policy.canonicalCommit, "HEAD"], { timeoutMs: 20_000 });
  let distributionComplete = true;
  let consumers = [];
  try {
    const distribution = await fs.readFile(path.join(policy.odysseyRoot, "distribution.toml"), "utf8");
    consumers = [...distribution.matchAll(/^path\s*=\s*"\.\.\/([^"/]+)"\s*$/gm)].map((match) => match[1]);
    if (consumers.length === 0 || new Set(consumers).size !== consumers.length) distributionComplete = false;
  } catch {
    distributionComplete = false;
  }
  const manifest = manifestResult.exitCode === 0 ? parseKeyValues(manifestResult.stdout) : {};
  const manifestMatches = manifest.release === policy.release
    && manifest.fingerprint === policy.fingerprint
    && Number(manifest.consumers) === consumers.length;
  let cohortVendorMatches = true;
  let stableFencePassed = true;
  let stableTreePassed = true;
  let vendorComplete = distributionComplete;
  let stableCount = 0;
  for (const name of consumers) {
    let vendor;
    const vendorRoot = path.resolve(policy.odysseyRoot, "..", name, "crates", "odyssey");
    try {
      vendor = parseKeyValues(await fs.readFile(path.join(vendorRoot, ".odyssey-vendor"), "utf8"));
    } catch {
      vendorComplete = false;
      if (policy.cohort.includes(name)) cohortVendorMatches = false;
      else stableFencePassed = false;
      continue;
    }
    if (policy.cohort.includes(name)) {
      cohortVendorMatches &&= vendor.release === policy.release && vendor.fingerprint === policy.fingerprint;
    } else {
      stableCount += 1;
      stableFencePassed &&= vendor.release === policy.stableRelease && vendor.fingerprint === policy.stableFingerprint;
      try {
        stableTreePassed &&= await vendorTreeSha256(vendorRoot) === policy.stableVendorTreeSha256;
      } catch {
        vendorComplete = false;
        stableTreePassed = false;
      }
    }
  }
  const expectedStableCount = consumers.length - policy.cohort.length;
  stableFencePassed &&= stableCount === expectedStableCount && expectedStableCount === 25;
  let implementationComplete = true;
  let implementationMatches = false;
  let collectorSha256 = null;
  let browserRunnerSha256 = null;
  let browserRuntimeSha256 = null;
  try {
    const [collectorBytes, browserRunnerBytes, runtimeDigest] = await Promise.all([
      fs.readFile(policy.implementation.collectorPath),
      fs.readFile(policy.implementation.browserRunnerPath),
      directoryTreeSha256(policy.implementation.browserRuntimePath),
    ]);
    collectorSha256 = sha256(collectorBytes);
    browserRunnerSha256 = sha256(browserRunnerBytes);
    browserRuntimeSha256 = runtimeDigest;
    implementationMatches = collectorSha256 === policy.implementation.collectorSha256
      && browserRunnerSha256 === policy.implementation.browserRunnerSha256
      && browserRuntimeSha256 === policy.implementation.browserRuntimeSha256;
  } catch {
    implementationComplete = false;
  }
  const commitCheckComplete = commitExists.exitCode <= 1 && commitAncestor.exitCode <= 1;
  const canonicalCommitValid = commitExists.exitCode === 0 && commitAncestor.exitCode === 0;
  const complete = manifestResult.exitCode === 0 && distributionComplete && vendorComplete
    && implementationComplete && commitCheckComplete;
  const passed = manifestMatches && checkResult.exitCode === 0 && cohortVendorMatches
    && stableFencePassed && stableTreePassed && implementationMatches && canonicalCommitValid;
  return {
    complete,
    passed,
    observedFailure: complete && !passed,
    manifestMatches,
    cohortCheckPassed: checkResult.exitCode === 0,
    cohortVendorMatches,
    stableFencePassed,
    stableTreePassed,
    implementationMatches,
    collectorSha256,
    browserRunnerSha256,
    browserRuntimeSha256,
    canonicalCommitValid,
    canonicalCommitSha256: sha256(policy.canonicalCommit),
    consumerCount: consumers.length,
    stableCount,
    stableVendorTreeSha256: policy.stableVendorTreeSha256,
    consumersSha256: sha256([...consumers].sort().join("\n")),
  };
}

function countLogSignals(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  let fatalCount = 0;
  let cspCount = 0;
  let secretLikeCount = 0;
  for (const line of lines) {
    if (/\b(?:fatal|panic|uncaught|unhandled|segfault)\b/i.test(line)) fatalCount += 1;
    if (/content.security.policy|\bcsp\b/i.test(line)) cspCount += 1;
    if (scanForSecrets(line).length > 0) secretLikeCount += 1;
  }
  return { lineCount: lines.length, fatalCount, cspCount, secretLikeCount };
}

async function collectRuntime(policy, runCommand) {
  const containers = [];
  let complete = true;
  let passed = true;
  let observedFailure = false;
  let portalInspect = null;
  let endpointWritten = false;
  for (const expected of policy.containers) {
    const inspected = await inspectContainer(runCommand, expected.name);
    if (!inspected.complete) {
      complete = false;
      containers.push({ id: sha256(expected.name).slice(0, 16), inspectAvailable: false });
      continue;
    }
    const value = inspected.value;
    if (expected.name.toLowerCase().includes("portal") || String(expected.image).toLowerCase().includes("portal")) portalInspect = value;
    const expectedImage = await runCommand("docker", ["image", "inspect", expected.image], { timeoutMs: 20_000 });
    const rollback = await runCommand("docker", ["image", "inspect", expected.rollbackTag], { timeoutMs: 20_000 });
    let tagImageId = null;
    let rollbackImageId = null;
    if (expectedImage.exitCode === 0) {
      try {
        tagImageId = JSON.parse(expectedImage.stdout)?.[0]?.Id ?? null;
      } catch {
        complete = false;
      }
    }
    if (rollback.exitCode === 0) {
      try {
        rollbackImageId = JSON.parse(rollback.stdout)?.[0]?.Id ?? null;
      } catch {
        complete = false;
      }
    }
    const logs = await runCommand("docker", ["logs", "--since", `${policy.sampleIntervalSeconds * 2}s`, "--tail", "2000", expected.name], { timeoutMs: 30_000 });
    const logSignals = logs.exitCode === 0 ? countLogSignals(`${logs.stdout}\n${logs.stderr}`) : { lineCount: 0, fatalCount: 0, cspCount: 0, secretLikeCount: 0 };
    if (logs.exitCode !== 0) complete = false;
    const running = value?.State?.Running === true;
    const healthy = value?.State?.Health?.Status === "healthy";
    const expectedImageMatched = tagImageId === expected.currentImageId && value?.Image === expected.currentImageId;
    const rollbackAvailable = rollback.exitCode === 0
      && rollbackImageId === expected.rollbackImageId
      && rollbackImageId !== expected.currentImageId;
    const cleanLogs = logSignals.fatalCount === 0 && logSignals.cspCount === 0 && logSignals.secretLikeCount === 0;
    const containerPassed = running && healthy && expectedImageMatched && rollbackAvailable && cleanLogs;
    passed &&= containerPassed;
    observedFailure ||= !containerPassed;
    if (expectedImage.exitCode !== 0 || rollback.exitCode !== 0) complete = false;
    containers.push({
      id: typeof value?.Id === "string" ? value.Id : sha256(expected.name).slice(0, 16),
      imageId: typeof value?.Image === "string" ? value.Image : null,
      tagImageId,
      rollbackImageId,
      inspectAvailable: true,
      running,
      healthy,
      expectedImage: expectedImageMatched,
      rollbackAvailable,
      restartCount: Number.isSafeInteger(value?.RestartCount) ? value.RestartCount : 0,
      ...logSignals,
    });
  }
  if (portalInspect) {
    try {
      await writeBrowserEndpoint(policy, portalInspect);
      endpointWritten = true;
    } catch {
      complete = false;
    }
  } else {
    complete = false;
  }
  passed &&= endpointWritten;
  return { complete, passed, observedFailure, endpointWritten, containers };
}

function postgresIdentity(inspect, policy) {
  const environment = Array.isArray(inspect?.Config?.Env) ? inspect.Config.Env : [];
  const values = new Map(environment.map((entry) => {
    const separator = entry.indexOf("=");
    return separator > 0 ? [entry.slice(0, separator), entry.slice(separator + 1)] : [entry, ""];
  }));
  return {
    user: values.get("POSTGRES_USER") || policy.postgresUser || "postgres",
    database: values.get("POSTGRES_DB") || policy.postgresDatabase || values.get("POSTGRES_USER") || "postgres",
  };
}

async function collectRoutes(policy, runCommand) {
  const postgresName = policy.postgresContainer ?? "holdfast-postgres-1";
  const inspected = await inspectContainer(runCommand, postgresName);
  if (!inspected.complete) return { complete: false, passed: false, observedFailure: false, queryPassed: false, rowCount: 0, statusPublic: false, portalSso: false };
  const identity = postgresIdentity(inspected.value, policy);
  const sql = "SELECT host, auth, require_group FROM routes WHERE host IN ('status.w33d.xyz','w33d.xyz') AND path_prefix='/' ORDER BY host";
  const query = await runCommand("docker", ["exec", postgresName, "psql", "-U", identity.user, "-d", identity.database, "-At", "-F", "\t", "-c", sql], { timeoutMs: 20_000 });
  if (query.exitCode !== 0) return { complete: false, passed: false, observedFailure: false, queryPassed: false, rowCount: 0, statusPublic: false, portalSso: false };
  const rows = query.stdout.split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"));
  const statusPublic = rows.some(([host, auth, group]) => host === "status.w33d.xyz" && auth === "public" && (group ?? "") === "");
  const portalSso = rows.some(([host, auth, group]) => host === "w33d.xyz" && auth === "sso" && (group ?? "") === "");
  const passed = rows.length === 2 && statusPublic && portalSso;
  return { complete: true, passed, observedFailure: !passed, queryPassed: true, rowCount: rows.length, statusPublic, portalSso };
}

async function fetchBounded(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "manual", headers: options.headers ?? {}, signal: controller.signal });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > JSON_LIMIT_BYTES) throw new Error("response_too_large");
    return { complete: true, response, body: bytes.toString("utf8"), bytes, durationMs: Math.max(1, Date.now() - startedAt) };
  } catch {
    return { complete: false, durationMs: Math.max(1, Date.now() - startedAt) };
  } finally {
    clearTimeout(timer);
  }
}

function noStore(response) {
  return /(?:^|,)\s*(?:private,\s*)?no-store(?:\s*(?:,|$))/i.test(response.headers.get("cache-control") ?? "");
}

function variesOnWire(response) {
  return (response.headers.get("vary") ?? "").split(",").some((value) => value.trim().toLowerCase() === "x-wire");
}

function statusLiveFragment(html) {
  const id = html.indexOf('id="status-live"');
  if (id < 0) return null;
  const start = html.lastIndexOf("<div", id);
  const subscribe = html.indexOf('id="subscribe"', id);
  if (start < 0 || subscribe < 0) return null;
  const section = html.lastIndexOf("<section", subscribe);
  if (section < start) return null;
  return html.slice(start, section).trim();
}

function statusFragmentContract(html) {
  if (typeof html !== "string") return false;
  const fragment = html.trim();
  return fragment.startsWith('<div id="status-live" class="status-live" role="region"')
    && (fragment.match(/id="status-live"/g) ?? []).length === 1
    && (fragment.match(/<section class="status-hero(?:\s|"|--)/g) ?? []).length === 1
    && fragment.includes("<h2>Components</h2>")
    && fragment.includes('class="crow"')
    && fragment.includes('class="crow__name"')
    && fragment.includes('class="crow__state')
    && !/<!doctype|<script|method\s*=\s*["']?post|csrf/i.test(fragment);
}

function normalizeStatusFragment(fragment) {
  if (!statusFragmentContract(fragment)) return null;
  return fragment.trim().replace(
    /title="24h average · latest [^"]+"/g,
    'title="24h average · latest <volatile>"',
  );
}

export function statusFragmentsSemanticallyMatch(fullFragment, wireFragment) {
  const normalizedFull = normalizeStatusFragment(fullFragment);
  const normalizedWire = normalizeStatusFragment(wireFragment);
  return normalizedFull !== null && normalizedFull === normalizedWire;
}

function percentile95(values) {
  if (values.length === 0) return 0;
  const orderedValues = [...values].sort((a, b) => a - b);
  return orderedValues[Math.max(0, Math.ceil(orderedValues.length * 0.95) - 1)];
}

async function collectPublic(policy, fetchImpl) {
  const durations = [];
  const get = async (url, options) => {
    const result = await fetchBounded(fetchImpl, url, options);
    durations.push(result.durationMs);
    return result;
  };
  const statusBase = policy.public.statusBaseUrl.replace(/\/$/, "");
  let [root, status, api, admin, wireStatus, wireAdmin] = await Promise.all([
    get(`${statusBase}/`),
    get(`${statusBase}/status`),
    get(`${statusBase}/api/status`),
    get(`${statusBase}/admin`),
    get(`${statusBase}/status`, { headers: { "X-Wire": "1" } }),
    get(`${statusBase}/admin`, { headers: { "X-Wire": "1" } }),
  ]);
  let fullFragment = status.complete ? statusLiveFragment(status.body) : null;
  let wireBody = wireStatus.complete ? wireStatus.body.trim() : null;
  let byteParity = typeof fullFragment === "string" && wireBody === fullFragment;
  let parityAttempts = 1;
  while (!byteParity && status.complete && wireStatus.complete && parityAttempts < 3) {
    [status, wireStatus] = await Promise.all([
      get(`${statusBase}/status`),
      get(`${statusBase}/status`, { headers: { "X-Wire": "1" } }),
    ]);
    parityAttempts += 1;
    fullFragment = status.complete ? statusLiveFragment(status.body) : null;
    wireBody = wireStatus.complete ? wireStatus.body.trim() : null;
    byteParity = typeof fullFragment === "string" && wireBody === fullFragment;
  }
  const parity = statusFragmentsSemanticallyMatch(fullFragment, wireBody);
  const statusRequests = [root, status, api, admin, wireStatus, wireAdmin];
  const statusComplete = statusRequests.every((result) => result.complete);
  const statusBoundaryHeaders = statusComplete && statusRequests.every((result) => !result.response.headers.has("location") && !result.response.headers.has("set-cookie"));
  const statusBodies = [root, status, api, wireStatus].filter((result) => result.complete).map((result) => result.body.toLowerCase());
  const forbiddenHosts = Array.isArray(policy.public.forbiddenPortalHosts) ? policy.public.forbiddenPortalHosts : [];
  const statusExcludesForbiddenHosts = forbiddenHosts.every((host) => statusBodies.every((body) => !body.includes(String(host).toLowerCase())));
  let apiJson = false;
  if (api.complete) {
    try { JSON.parse(api.body); apiJson = true; } catch { apiJson = false; }
  }
  const wireSafe = wireStatus.complete
    && !/<!doctype|<script|method\s*=\s*["']?post|csrf/i.test(wireStatus.body);
  const statusPassed = statusComplete
    && root.response.status === 200 && status.response.status === 200 && api.response.status === 200
    && admin.response.status === 401 && wireStatus.response.status === 200 && wireAdmin.response.status === 401
    && noStore(root.response) && noStore(status.response) && noStore(api.response) && noStore(wireStatus.response)
    && variesOnWire(wireStatus.response) && apiJson && parity && wireSafe
    && statusBoundaryHeaders && statusExcludesForbiddenHosts;

  const [portal, odysseyRoot] = await Promise.all([
    get(policy.public.portalUrl),
    get(policy.public.odysseyUrl),
  ]);
  let portalRedirect = false;
  if (portal.complete && [302, 303, 307, 308].includes(portal.response.status)) {
    try {
      const location = new URL(portal.response.headers.get("location"), policy.public.portalUrl);
      const expectedOrigin = policy.public.portalSsoOrigin ?? "https://sso.w33d.xyz";
      const expectedPath = policy.public.portalSsoPath ?? "/authorize";
      portalRedirect = location.origin === expectedOrigin && location.pathname === expectedPath;
    } catch {
      portalRedirect = false;
    }
  }
  const odysseyCanary = odysseyRoot.complete
    && odysseyRoot.response.status === 200
    && (odysseyRoot.body.includes(policy.release) || /\bv1\.2\s+canary\b/i.test(odysseyRoot.body));

  const assets = [];
  let assetsComplete = true;
  let assetsPassed = true;
  let assetObservedFailure = false;
  for (const [assetPath, expected] of Object.entries(policy.public.assetSha256)) {
    const result = await get(new URL(assetPath, policy.public.odysseyUrl).toString());
    const observed = result.complete ? sha256(result.bytes) : null;
    const immutable = result.complete
      && /(?:^|,)\s*public(?:\s*,|$)/i.test(result.response.headers.get("cache-control") ?? "")
      && /(?:^|,)\s*immutable(?:\s*,|$)/i.test(result.response.headers.get("cache-control") ?? "");
    const matched = result.complete && result.response.status === 200 && immutable
      && observed === expected.replace(/^sha256:/, "").toLowerCase();
    assetsComplete &&= result.complete;
    assetsPassed &&= matched;
    assetObservedFailure ||= result.complete && !matched;
    assets.push({
      id: sha256(assetPath).slice(0, 16),
      generation: assetPath.includes("/1.1/") ? "stable" : assetPath.includes("/1.2/") ? "canary" : "other",
      expectedSha256: expected.replace(/^sha256:/, "").toLowerCase(),
      observedSha256: observed,
      immutable,
      matched,
    });
  }
  const p95Ms = percentile95(durations);
  const p95Passed = p95Ms <= policy.maxP95Ms;
  const complete = statusComplete && portal.complete && odysseyRoot.complete && assetsComplete;
  const passed = statusPassed && portalRedirect && odysseyCanary && assetsPassed && p95Passed;
  return {
    complete,
    passed,
    observedFailure: (statusComplete && !statusPassed)
      || (portal.complete && !portalRedirect)
      || (odysseyRoot.complete && !odysseyCanary)
      || assetObservedFailure
      || !p95Passed,
    p95Ms,
    requestCount: durations.length,
    status: {
      rootStatus: root.complete ? root.response.status : 0,
      pageStatus: status.complete ? status.response.status : 0,
      apiStatus: api.complete ? api.response.status : 0,
      adminStatus: admin.complete ? admin.response.status : 0,
      wireStatus: wireStatus.complete ? wireStatus.response.status : 0,
      wireAdminStatus: wireAdmin.complete ? wireAdmin.response.status : 0,
      noStore: statusComplete && [root, status, api, wireStatus].every((result) => noStore(result.response)),
      variesOnWire: wireStatus.complete && variesOnWire(wireStatus.response),
      apiJson,
      parity,
      byteParity,
      parityAttempts,
      wireSafe,
      boundaryHeaders: statusBoundaryHeaders,
      excludesForbiddenHosts: statusExcludesForbiddenHosts,
      fullFragmentSha256: fullFragment === null ? null : sha256(fullFragment),
      wireFragmentSha256: wireBody === null ? null : sha256(wireBody),
      normalizedFullFragmentSha256: fullFragment === null ? null : sha256(normalizeStatusFragment(fullFragment) ?? ""),
      normalizedWireFragmentSha256: wireBody === null ? null : sha256(normalizeStatusFragment(wireBody) ?? ""),
    },
    portal: { status: portal.complete ? portal.response.status : 0, ssoRedirect: portalRedirect },
    odyssey: {
      status: odysseyRoot.complete ? odysseyRoot.response.status : 0,
      canaryAdvertised: odysseyCanary,
      bodySha256: odysseyRoot.complete ? sha256(odysseyRoot.bytes) : null,
    },
    assets,
  };
}

export async function readBrowserEvidence(policy, now = new Date()) {
  let bytes;
  let stat;
  try {
    [bytes, stat] = await Promise.all([fs.readFile(policy.browser.evidencePath), fs.stat(policy.browser.evidencePath)]);
  } catch {
    return { complete: false, observedFailure: false, available: false, passed: false, fresh: false, checkedAt: null, checkCount: 0, failedCheckCount: 0, evidenceSha256: null };
  }
  if (bytes.length > JSON_LIMIT_BYTES || !stat.isFile()) return { complete: false, observedFailure: false, available: false, passed: false, fresh: false, checkedAt: null, checkCount: 0, failedCheckCount: 0, evidenceSha256: null };
  let evidence;
  try {
    evidence = JSON.parse(bytes.toString("utf8"));
    assertNoSecrets(evidence);
  } catch {
    return { complete: false, observedFailure: false, available: false, passed: false, fresh: false, checkedAt: null, checkCount: 0, failedCheckCount: 0, evidenceSha256: sha256(bytes) };
  }
  const checks = Array.isArray(evidence.checks) ? evidence.checks : [];
  const checkNames = checks.map((check) => check?.name);
  const exactChecks = exactMembers(checkNames, REQUIRED_BROWSER_CHECKS) && new Set(checkNames).size === REQUIRED_BROWSER_CHECKS.length;
  const shapeValid = evidence.schemaVersion === BROWSER_SCHEMA
    && evidence.sanitized === true
    && ["pass", "fail"].includes(evidence.status)
    && Number.isFinite(epoch(evidence.checkedAt))
    && exactChecks
    && checks.every((check) => typeof check?.name === "string" && ["pass", "fail"].includes(check.status));
  const nowMs = new Date(now).getTime();
  const checkedMs = epoch(evidence.checkedAt);
  const mtimeSkewValid = shapeValid && Math.abs(stat.mtimeMs - checkedMs) <= 300_000;
  const ageSeconds = shapeValid ? (nowMs - checkedMs) / 1000 : Number.POSITIVE_INFINITY;
  const fresh = shapeValid && mtimeSkewValid && ageSeconds >= 0 && ageSeconds <= policy.browserMaxAgeSeconds;
  const failedCheckCount = checks.filter((check) => check.status !== "pass").length;
  const passed = shapeValid && evidence.status === "pass" && failedCheckCount === 0;
  return {
    complete: shapeValid && fresh,
    observedFailure: shapeValid && fresh && !passed,
    available: shapeValid,
    passed,
    fresh,
    checkedAt: shapeValid ? evidence.checkedAt : null,
    checkCount: checks.length,
    failedCheckCount,
    evidenceSha256: sha256(bytes),
  };
}

export async function collectEvidence(policy, stateDir, options = {}) {
  validatePolicy(policy, stateDir);
  const runCommand = options.runCommand ?? defaultRunCommand;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const window = await startWindow(policy, stateDir, { now: options.now });
  const existing = await loadSamples(stateDir);
  const observedAt = iso(options.now);
  const [canonical, runtime, routes, publicEvidence, browser] = await Promise.all([
    collectCanonical(policy, runCommand),
    collectRuntime(policy, runCommand),
    collectRoutes(policy, runCommand),
    collectPublic(policy, fetchImpl),
    readBrowserEvidence(policy, options.now),
  ]);
  const collectionComplete = canonical.complete && runtime.complete && routes.complete && publicEvidence.complete && browser.complete;
  const hardFailure = canonical.observedFailure || runtime.observedFailure || routes.observedFailure || publicEvidence.observedFailure || browser.observedFailure;
  const sample = sealSample({
    schemaVersion: SAMPLE_SCHEMA,
    windowId: window.windowId,
    sequence: existing.length + 1,
    observedAt,
    previousSha256: existing.at(-1)?.sha256 ?? null,
    identity: {
      release: policy.release,
      fingerprint: policy.fingerprint,
      stableRelease: policy.stableRelease,
      stableFingerprint: policy.stableFingerprint,
      cohort: [...policy.cohort],
      nextCohort: [...policy.nextCohort],
      policySha256: window.policySha256,
    },
    canonical,
    runtime,
    routes,
    public: publicEvidence,
    browser,
    collectionComplete,
    hardFailure,
  });
  assertNoSecrets(sample);
  const { tip } = await appendSample(stateDir, window, sample);
  const samples = [...existing, sample];
  const evaluation = evaluateEvidence({ policy, window, samples, tip, now: options.now });
  await writeDecision(stateDir, evaluation);
  return { sample, evaluation };
}

function parseCli(argv) {
  const command = argv[0];
  if (!command || command.startsWith("--")) throw new Error("missing_command");
  const flags = new Map();
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) throw new Error("invalid_argument");
    if (flag === "--json") {
      flags.set(flag, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("missing_argument_value");
    flags.set(flag, value);
    index += 1;
  }
  const required = (flag) => {
    const value = flags.get(flag);
    if (typeof value !== "string" || value === "") throw new Error(`missing_${flag.slice(2).replaceAll("-", "_")}`);
    return value;
  };
  return { command, flags, required };
}

async function loadCliContext(parsed) {
  const configPath = parsed.flags.get("--config") ?? parsed.flags.get("--policy");
  if (!configPath) throw new Error("missing_config");
  const stateDir = parsed.required("--state-dir");
  const policy = await readJson(configPath);
  validatePolicy(policy, stateDir);
  return { policy, stateDir };
}

async function cliEvaluation(policy, stateDir, now = new Date()) {
  const window = await readJson(path.join(stateDir, "state.json"));
  const samples = await loadSamples(stateDir);
  const tip = await readTip(stateDir);
  return { window, samples, tip, evaluation: evaluateEvidence({ policy, window, samples, tip, now }) };
}

export async function runCli(argv = process.argv.slice(2)) {
  const parsed = parseCli(argv);
  const { policy, stateDir } = await loadCliContext(parsed);
  switch (parsed.command) {
    case "window-start": {
      const window = await startWindow(policy, stateDir);
      const portal = policy.containers.find((container) => container.name.toLowerCase().includes("portal") || container.image.toLowerCase().includes("portal"));
      if (portal) {
        const inspected = await inspectContainer(defaultRunCommand, portal.name);
        if (inspected.complete) await writeBrowserEndpoint(policy, inspected.value);
      }
      return window;
    }
    case "collect":
      return collectEvidence(policy, stateDir);
    case "evaluate": {
      const { evaluation } = await cliEvaluation(policy, stateDir);
      await writeDecision(stateDir, evaluation);
      return evaluation;
    }
    case "status":
      return (await cliEvaluation(policy, stateDir)).evaluation;
    case "approve":
      return approveWindow(policy, stateDir, {
        target: parsed.required("--target"),
        privateKeyPath: parsed.required("--private-key"),
        actor: parsed.required("--actor"),
        reason: parsed.required("--reason"),
      });
    case "verify-approval": {
      const context = await cliEvaluation(policy, stateDir);
      const approvalPath = parsed.flags.get("--approval") ?? path.join(stateDir, "approval.json");
      const approval = await readJson(approvalPath);
      const valid = await verifyApproval({ policy, ...context, approval });
      if (!valid) throw new Error("approval_invalid");
      return { valid: true };
    }
    default:
      throw new Error("unknown_command");
  }
}

async function main() {
  try {
    const result = await runCli();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: typeof error?.message === "string" ? error.message : "odyssey_gate_failed" })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
