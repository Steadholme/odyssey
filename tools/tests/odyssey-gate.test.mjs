import assert from "node:assert/strict";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  approveWindow,
  atomicWriteJson,
  canonicalJson,
  evaluateEvidence,
  policyDigest,
  readBrowserEvidence,
  scanForSecrets,
  sealSample,
  sha256,
  startWindow,
  statusFragmentsSemanticallyMatch,
  vendorTreeSha256,
  verifyApproval,
  writeBrowserEndpoint,
} from "../odyssey-gate.mjs";

const RELEASE = "1.2.0-canary.1";
const START = Date.parse("2026-07-10T00:00:00.000Z");
const ASSET_HASH = sha256("asset");

function imageId(name, generation) {
  return `sha256:${sha256(`${name}-${generation}`)}`;
}

function policy(
  root,
  publicKeyPath = path.join(root, "approval-public.pem"),
  publicKeySpkiSha256 = "d".repeat(64),
) {
  return {
    schemaVersion: "odyssey.canaryPolicy.v1",
    release: RELEASE,
    fingerprint: "fnv1a64:20ae76d5c2ada57d",
    stableRelease: "1.1.0",
    stableFingerprint: "fnv1a64:ec3b6050f90a4cf7",
    stableVendorTreeSha256: "c".repeat(64),
    canonicalCommit: "a".repeat(40),
    windowSeconds: 86_400,
    sampleIntervalSeconds: 3_600,
    maxGapSeconds: 3_600,
    minSamples: 25,
    maxEvidenceAgeSeconds: 900,
    browserMaxAgeSeconds: 3_900,
    maxP95Ms: 2_500,
    cohort: ["beacon", "portal"],
    nextCohort: ["sanctum"],
    odysseyRoot: path.join(root, "odyssey"),
    deployRoot: path.join(root, "deploy"),
    odysseyctlPath: path.join(root, "odysseyctl"),
    containers: [
      { name: "odyssey", image: "odyssey:test", rollbackTag: "odyssey:rollback", currentImageId: imageId("odyssey", "current"), rollbackImageId: imageId("odyssey", "rollback") },
      { name: "beacon", image: "beacon:test", rollbackTag: "beacon:rollback", currentImageId: imageId("beacon", "current"), rollbackImageId: imageId("beacon", "rollback") },
      { name: "portal", image: "portal:test", rollbackTag: "portal:rollback", currentImageId: imageId("portal", "current"), rollbackImageId: imageId("portal", "rollback") },
    ],
    public: {
      statusBaseUrl: "https://status.w33d.xyz",
      portalUrl: "https://w33d.xyz",
      odysseyUrl: "https://odyssey.w33d.xyz",
      portalSsoOrigin: "https://sso.w33d.xyz",
      portalSsoPath: "/authorize",
      assetSha256: {
        "/1.1/odyssey.css": ASSET_HASH,
        "/1.2/odyssey.css": ASSET_HASH,
      },
    },
    browser: {
      evidencePath: path.join(root, "browser-evidence.json"),
      endpointPath: path.join(root, "run", "browser-endpoint.json"),
    },
    implementation: {
      collectorPath: path.join(root, "odyssey-gate.mjs"),
      collectorSha256: "e".repeat(64),
      browserRunnerPath: path.join(root, "odyssey-gate-browser.mjs"),
      browserRunnerSha256: "f".repeat(64),
      browserRuntimePath: path.join(root, "browser-runtime"),
      browserRuntimeSha256: "1".repeat(64),
    },
    approval: {
      keyId: "odyssey-test-approver",
      publicKeyPath,
      publicKeySpkiSha256,
      maxAgeSeconds: 3_600,
    },
  };
}

function windowFor(currentPolicy) {
  return {
    schemaVersion: "odyssey.canaryWindow.v1",
    windowId: "window-test-id",
    release: currentPolicy.release,
    fingerprint: currentPolicy.fingerprint,
    stableRelease: currentPolicy.stableRelease,
    stableFingerprint: currentPolicy.stableFingerprint,
    cohort: [...currentPolicy.cohort],
    nextCohort: [...currentPolicy.nextCohort],
    policySha256: policyDigest(currentPolicy),
    startedAt: new Date(START).toISOString(),
    windowSeconds: currentPolicy.windowSeconds,
  };
}

function tipFor(window, samples) {
  return {
    schemaVersion: "odyssey.canaryTip.v1",
    windowId: window.windowId,
    sequence: samples.length,
    sampleSha256: samples.at(-1)?.sha256 ?? null,
  };
}

function samplesFor(currentPolicy, window, offsets, hardFailureIndex = -1) {
  const samples = [];
  for (const [index, offset] of offsets.entries()) {
    const assets = Object.entries(currentPolicy.public.assetSha256).map(([assetPath, digest]) => ({
      id: sha256(assetPath).slice(0, 16),
      generation: assetPath.includes("/1.1/") ? "stable" : "canary",
      expectedSha256: digest,
      observedSha256: digest,
      immutable: true,
      matched: true,
    }));
    samples.push(sealSample({
      schemaVersion: "odyssey.canarySample.v1",
      windowId: window.windowId,
      sequence: index + 1,
      observedAt: new Date(START + offset).toISOString(),
      previousSha256: samples.at(-1)?.sha256 ?? null,
      identity: {
        release: currentPolicy.release,
        fingerprint: currentPolicy.fingerprint,
        stableRelease: currentPolicy.stableRelease,
        stableFingerprint: currentPolicy.stableFingerprint,
        cohort: [...currentPolicy.cohort],
        nextCohort: [...currentPolicy.nextCohort],
        policySha256: window.policySha256,
      },
      canonical: {
        complete: true,
        passed: true,
        observedFailure: false,
        manifestMatches: true,
        cohortCheckPassed: true,
        cohortVendorMatches: true,
        stableFencePassed: true,
        stableTreePassed: true,
        implementationMatches: true,
        collectorSha256: currentPolicy.implementation.collectorSha256,
        browserRunnerSha256: currentPolicy.implementation.browserRunnerSha256,
        browserRuntimeSha256: currentPolicy.implementation.browserRuntimeSha256,
        canonicalCommitValid: true,
        canonicalCommitSha256: sha256(currentPolicy.canonicalCommit),
        consumerCount: 27,
        stableCount: 25,
        stableVendorTreeSha256: currentPolicy.stableVendorTreeSha256,
        consumersSha256: sha256("consumers"),
      },
      public: {
        complete: true,
        passed: index !== hardFailureIndex,
        observedFailure: index === hardFailureIndex,
        p95Ms: 100,
        status: {
          rootStatus: 200,
          pageStatus: 200,
          apiStatus: 200,
          adminStatus: 401,
          wireStatus: 200,
          wireAdminStatus: 401,
          noStore: true,
          variesOnWire: true,
          apiJson: true,
          parity: true,
          parityAttempts: 1,
          wireSafe: true,
          boundaryHeaders: true,
          excludesForbiddenHosts: true,
          fullFragmentSha256: sha256("fragment"),
          wireFragmentSha256: sha256("fragment"),
          normalizedFullFragmentSha256: sha256("normalized-fragment"),
          normalizedWireFragmentSha256: sha256("normalized-fragment"),
        },
        portal: { status: 302, ssoRedirect: true },
        odyssey: { status: 200, canaryAdvertised: true, bodySha256: sha256("odyssey") },
        assets,
      },
      runtime: {
        complete: true,
        passed: true,
        observedFailure: false,
        endpointWritten: true,
        containers: ["odyssey", "beacon", "portal"].map((name) => ({
          id: `${name}-container-id`,
          imageId: imageId(name, "current"),
          tagImageId: imageId(name, "current"),
          rollbackImageId: imageId(name, "rollback"),
          inspectAvailable: true,
          running: true,
          healthy: true,
          expectedImage: true,
          rollbackAvailable: true,
          restartCount: 0,
          fatalCount: 0,
          cspCount: 0,
          secretLikeCount: 0,
        })),
      },
      routes: {
        complete: true,
        passed: true,
        observedFailure: false,
        queryPassed: true,
        rowCount: 2,
        statusPublic: true,
        portalSso: true,
      },
      browser: {
        complete: true,
        observedFailure: false,
        available: true,
        passed: true,
        fresh: true,
        checkedAt: new Date(START + offset).toISOString(),
        checkCount: 5,
        failedCheckCount: 0,
        evidenceSha256: sha256(`browser-${index}`),
      },
      collectionComplete: true,
      hardFailure: index === hardFailureIndex,
    }));
  }
  return samples;
}

function evaluate(currentPolicy, window, samples, now) {
  return evaluateEvidence({
    policy: currentPolicy,
    window,
    samples,
    tip: tipFor(window, samples),
    now,
  });
}

function resealFrom(samples, startIndex) {
  for (let index = startIndex; index < samples.length; index += 1) {
    samples[index].previousSha256 = samples[index - 1]?.sha256 ?? null;
    samples[index] = sealSample(samples[index]);
  }
}

async function temporaryRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "odyssey-gate-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("23:59:59 remains observing and exactly 24 hours becomes ready", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const beforeOffsets = [
    ...Array.from({ length: 24 }, (_, index) => index * 3_600_000),
    86_399_000,
  ];
  const beforeSamples = samplesFor(currentPolicy, window, beforeOffsets);
  const before = evaluate(currentPolicy, window, beforeSamples, new Date(START + 86_399_000));
  assert.equal(before.status, "observing");

  const exactOffsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const exactSamples = samplesFor(currentPolicy, window, exactOffsets);
  const exact = evaluate(currentPolicy, window, exactSamples, new Date(START + 86_400_000));
  assert.equal(exact.status, "ready_for_manual_approval");
  assert.deepEqual(exact.promotionPlan.nextCohort, ["sanctum"]);
  assert.equal(exact.promotionPlan.autoExecute, false);
  assert.deepEqual(exact.promotionPlan.commands, []);
});

test("a sample gap holds the window", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index <= 10 ? index * 3_600_000 : (index + 1) * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  const result = evaluate(currentPolicy, window, samples, new Date(START + offsets.at(-1)));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "sample_gaps")?.passed, false);
});

test("a sample before the signed window start holds the window", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = [-1_000, ...Array.from({ length: 25 }, (_, index) => index * 3_600_000)];
  const samples = samplesFor(currentPolicy, window, offsets);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 86_400_000));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "timestamps")?.passed, false);
});

test("stale browser evidence cannot remain observing", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  currentPolicy.browserMaxAgeSeconds = 60;
  const window = windowFor(currentPolicy);
  const samples = samplesFor(currentPolicy, window, [0, 3_600_000]);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 3_700_000));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "browser_fresh")?.passed, false);
});

test("status semantic parity tolerates volatile latency but rejects unsafe fragments", () => {
  const fragment = (latency) => `<div id="status-live" class="status-live" role="region" aria-label="Live system status">
<section class="status-hero status-hero--ok"><h2>Healthy</h2></section>
<section class="card"><h2>Components</h2><div class="crow"><span class="crow__name">Beacon</span><span class="crow__lat" title="24h average · latest ${latency} ms">~4 ms</span><span class="crow__state crow__state--ok">Operational</span></div></section>
</div>`;
  assert.equal(statusFragmentsSemanticallyMatch(fragment(2), fragment(6)), true);
  assert.equal(statusFragmentsSemanticallyMatch(fragment(2), `${fragment(6)}<script>alert(1)</script>`), false);
  assert.equal(statusFragmentsSemanticallyMatch(fragment(2), fragment(6).replace("Operational", "Down")), false);
  assert.equal(statusFragmentsSemanticallyMatch(fragment(2), fragment("ATTACK")), false);
});

test("evaluator accepts raw fragment drift only when normalized hashes match", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  samples[9].public.status.fullFragmentSha256 = sha256("latest 2 ms");
  samples[9].public.status.wireFragmentSha256 = sha256("latest 6 ms");
  resealFrom(samples, 9);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 86_400_000));
  assert.equal(result.status, "ready_for_manual_approval");
});

test("tampering with a sealed sample holds the window", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  samples[8].public.p95Ms = 101;
  const result = evaluate(currentPolicy, window, samples, new Date(START + 86_400_000));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "sample_chain")?.passed, false);
});

test("an observed hard-gate failure requires rollback immediately", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets, 3);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 10_800_000));
  assert.equal(result.status, "rollback_required");
});

test("container or image identity drift holds the window", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  samples[12].runtime.containers[0].tagImageId = "different-image-id";
  resealFrom(samples, 12);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 86_400_000));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "runtime_identity_stable")?.passed, false);
});

test("nested evidence cannot be overridden by forged summary flags", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  samples[4].canonical = { complete: true, passed: false, observedFailure: false };
  samples[4].collectionComplete = true;
  samples[4].hardFailure = false;
  resealFrom(samples, 4);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 86_400_000));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "sample_evidence_shape")?.passed, false);
});

test("summary-only evidence groups cannot become ready", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  samples[7].canonical = { complete: true, passed: true, observedFailure: false };
  samples[7].routes = { complete: true, passed: true, observedFailure: false };
  resealFrom(samples, 7);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 86_400_000));
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "sample_evidence_shape")?.passed, false);
});

test("a hard failure takes precedence over simultaneous runtime drift", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets, 6);
  samples[6].runtime.containers[0].tagImageId = imageId("odyssey", "unexpected");
  resealFrom(samples, 6);
  const result = evaluate(currentPolicy, window, samples, new Date(START + 21_600_000));
  assert.equal(result.status, "rollback_required");
});

test("an empty window becomes hold after the maximum initial gap", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const samples = [];
  const result = evaluate(currentPolicy, window, samples, new Date(START + (currentPolicy.maxGapSeconds + 1) * 1_000));
  assert.equal(result.status, "hold");
});

test("a persisted tip detects deletion of the sample tail", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const window = windowFor(currentPolicy);
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  const result = evaluateEvidence({
    policy: currentPolicy,
    window,
    samples: samples.slice(0, -1),
    tip: tipFor(window, samples),
    now: new Date(START + 86_400_000),
  });
  assert.equal(result.status, "hold");
  assert.equal(result.checks.find((check) => check.name === "sample_tip")?.passed, false);
});

test("stable vendor hash ignores build artifacts but detects payload drift", async (t) => {
  const root = await temporaryRoot(t);
  const vendor = path.join(root, "vendor");
  await fs.mkdir(path.join(vendor, "src"), { recursive: true });
  await fs.mkdir(path.join(vendor, "target", "debug"), { recursive: true });
  await fs.writeFile(path.join(vendor, "src", "lib.rs"), "pub fn stable() {}\n");
  await fs.writeFile(path.join(vendor, ".odyssey-vendor"), "release=1.1.0\n");
  await fs.writeFile(path.join(vendor, "Cargo.lock"), "ignored\n");
  await fs.writeFile(path.join(vendor, "target", "debug", "cache"), "ignored\n");
  const baseline = await vendorTreeSha256(vendor);
  await fs.writeFile(path.join(vendor, "Cargo.lock"), "still ignored\n");
  assert.equal(await vendorTreeSha256(vendor), baseline);
  await fs.writeFile(path.join(vendor, "src", "lib.rs"), "pub fn drifted() {}\n");
  assert.notEqual(await vendorTreeSha256(vendor), baseline);
});

test("atomic evidence writes refuse secret-like material", async (t) => {
  const root = await temporaryRoot(t);
  const evidencePath = path.join(root, "secret.json");
  const value = { authorization: "Bearer abcdefghijklmnopqrstuvwxyz" };
  assert.ok(scanForSecrets(value).length > 0);
  await assert.rejects(atomicWriteJson(evidencePath, value), /secret_material_refused/);
  await assert.rejects(fs.access(evidencePath), { code: "ENOENT" });
});

test("browser evidence requires sanitized schema, freshness, mtime, and records only a hash", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  const checkedAt = new Date(START).toISOString();
  await atomicWriteJson(currentPolicy.browser.evidencePath, {
    schemaVersion: "odyssey.browserSmoke.v1",
    status: "pass",
    checkedAt,
    checks: [
      { name: "status_desktop_refresh", status: "pass" },
      { name: "status_mobile_refresh", status: "pass" },
      { name: "portal_desktop_refresh", status: "pass" },
      { name: "portal_mobile_refresh", status: "pass" },
      { name: "no_javascript_floor", status: "pass" },
    ],
    sanitized: true,
  });
  await fs.utimes(currentPolicy.browser.evidencePath, new Date(START), new Date(START));
  const evidence = await readBrowserEvidence(currentPolicy, new Date(START + 1_000));
  assert.equal(evidence.complete, true);
  assert.equal(evidence.passed, true);
  assert.match(evidence.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes(currentPolicy.browser.evidencePath), false);

  const expired = await readBrowserEvidence(currentPolicy, new Date(START + (currentPolicy.browserMaxAgeSeconds + 1) * 1_000));
  assert.equal(expired.complete, false);
  assert.equal(expired.observedFailure, false);

  await atomicWriteJson(currentPolicy.browser.evidencePath, {
    schemaVersion: "odyssey.browserSmoke.v1",
    status: "pass",
    checkedAt,
    checks: [
      { name: "status_desktop_refresh", status: "pass" },
      { name: "status_desktop_refresh", status: "pass" },
      { name: "portal_desktop_refresh", status: "pass" },
      { name: "portal_mobile_refresh", status: "pass" },
      { name: "no_javascript_floor", status: "pass" },
    ],
    sanitized: true,
  });
  await fs.utimes(currentPolicy.browser.evidencePath, new Date(START), new Date(START));
  const duplicate = await readBrowserEvidence(currentPolicy, new Date(START + 1_000));
  assert.equal(duplicate.complete, false);
  assert.equal(duplicate.available, false);
});

test("browser endpoint bridge is separate from evidence and mode 0640 in a setgid directory", async (t) => {
  const root = await temporaryRoot(t);
  const currentPolicy = policy(root);
  await fs.mkdir(path.dirname(currentPolicy.browser.endpointPath), { recursive: true, mode: 0o2750 });
  await fs.chmod(path.dirname(currentPolicy.browser.endpointPath), 0o2750);
  const result = await writeBrowserEndpoint(currentPolicy, {
    NetworkSettings: { Networks: { private: { IPAddress: "172.20.0.42" } } },
  });
  const endpoint = JSON.parse(await fs.readFile(currentPolicy.browser.endpointPath, "utf8"));
  const stat = await fs.stat(currentPolicy.browser.endpointPath);
  assert.deepEqual(endpoint, { portalUrl: "http://172.20.0.42:8600" });
  const directoryStat = await fs.stat(path.dirname(currentPolicy.browser.endpointPath));
  assert.equal(stat.mode & 0o777, 0o640);
  assert.equal(directoryStat.mode & 0o2777, 0o2750);
  assert.match(result.endpointSha256, /^[a-f0-9]{64}$/);
});

test("manual approval signs exact ready evidence, detects tampering, and runs no command", async (t) => {
  const root = await temporaryRoot(t);
  const stateDir = path.join(root, RELEASE);
  const privateKeyPath = path.join(root, "approval-private.pem");
  const publicKeyPath = path.join(root, "approval-public.pem");
  const keyPair = generateKeyPairSync("ed25519");
  await fs.writeFile(privateKeyPath, keyPair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  await fs.writeFile(publicKeyPath, keyPair.publicKey.export({ type: "spki", format: "pem" }), { mode: 0o600 });
  const publicKeyDigest = sha256(keyPair.publicKey.export({ type: "spki", format: "der" }));
  const currentPolicy = policy(root, publicKeyPath, publicKeyDigest);
  const window = await startWindow(currentPolicy, stateDir, { now: new Date(START) });
  const offsets = Array.from({ length: 25 }, (_, index) => index * 3_600_000);
  const samples = samplesFor(currentPolicy, window, offsets);
  for (const sample of samples) {
    await atomicWriteJson(path.join(stateDir, "samples", `${String(sample.sequence).padStart(6, "0")}.json`), sample);
  }
  const tip = tipFor(window, samples);
  await atomicWriteJson(path.join(stateDir, "tip.json"), tip);
  let externalCalls = 0;
  const approval = await approveWindow(currentPolicy, stateDir, {
    target: `${currentPolicy.release}@${currentPolicy.fingerprint}`,
    privateKeyPath,
    actor: "release-operator",
    reason: "24h canary evidence reviewed",
    now: new Date(START + 86_400_000),
    runCommand: async () => { externalCalls += 1; throw new Error("must not run"); },
  });
  assert.equal(externalCalls, 0);
  assert.equal(await verifyApproval({ policy: currentPolicy, window, samples, tip, approval, now: new Date(START + 86_400_000) }), true);

  const extendedOffsets = [...offsets, 86_400_000 + 1_800_000];
  const extendedSamples = samplesFor(currentPolicy, window, extendedOffsets);
  const extendedTip = tipFor(window, extendedSamples);
  assert.equal(await verifyApproval({
    policy: currentPolicy,
    window,
    samples: extendedSamples,
    tip: extendedTip,
    approval,
    now: new Date(START + 86_400_000 + 1_800_000),
  }), true, "a later passing sample does not move the signed cutoff");

  const failedSamples = samplesFor(currentPolicy, window, extendedOffsets, extendedOffsets.length - 1);
  assert.equal(await verifyApproval({
    policy: currentPolicy,
    window,
    samples: failedSamples,
    tip: tipFor(window, failedSamples),
    approval,
    now: new Date(START + 86_400_000 + 1_800_000),
  }), false, "a hard failure after the signed cutoff invalidates approval");

  const payloadTamper = structuredClone(approval);
  payloadTamper.payload.reason = "changed";
  assert.equal(await verifyApproval({ policy: currentPolicy, window, samples, tip, approval: payloadTamper, now: new Date(START + 86_400_000) }), false);
  const signatureTamper = structuredClone(approval);
  signatureTamper.signature = `${signatureTamper.signature[0] === "A" ? "B" : "A"}${signatureTamper.signature.slice(1)}`;
  assert.equal(await verifyApproval({ policy: currentPolicy, window, samples, tip, approval: signatureTamper, now: new Date(START + 86_400_000) }), false);

  const invalidTime = structuredClone(approval);
  invalidTime.payload.issuedAt = "not-a-date";
  invalidTime.payload.expiresAt = "also-not-a-date";
  invalidTime.signature = cryptoSign(null, Buffer.from(canonicalJson(invalidTime.payload)), keyPair.privateKey).toString("base64url");
  invalidTime.approvalSha256 = sha256(canonicalJson({ keyId: invalidTime.keyId, payload: invalidTime.payload, signature: invalidTime.signature }));
  assert.equal(await verifyApproval({ policy: currentPolicy, window, samples, tip, approval: invalidTime, now: new Date(START + 86_400_000) }), false);
  await assert.rejects(approveWindow(currentPolicy, stateDir, {
    target: `${currentPolicy.release}@wrong`,
    privateKeyPath,
    actor: "release-operator",
    reason: "wrong target",
    now: new Date(START + 86_400_000),
  }), /approval_target_identity_mismatch/);
});
