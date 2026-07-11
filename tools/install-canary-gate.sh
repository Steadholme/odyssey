#!/bin/sh
set -eu

umask 077

if [ "$(id -u)" -ne 0 ]; then
  echo "install-canary-gate.sh must run as root" >&2
  exit 1
fi

for command in cargo docker flock getent groupadd id install mktemp node openssl runuser systemctl systemd-tmpfiles useradd; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "required command is missing: $command" >&2
    exit 1
  fi
done

exec 9>/run/lock/odyssey-canary-install.lock
if ! flock -n 9; then
  echo "another Odyssey canary installation is running" >&2
  exit 1
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SITEFLOW_ROOT=/root/w33d_infra/siteflow
RELEASE=1.2.0-canary.1
LIBEXEC=/usr/local/libexec/odyssey-gate
BROWSER_RUNTIME=/usr/local/lib/odyssey-browser
CONFIG_DIR=/etc/odyssey-canary
STATE_DIR=/var/lib/odyssey-canary/$RELEASE
PUBLIC_KEY=$CONFIG_DIR/approval-public.pem
APPROVAL_KEY_PIN=$(node -e '
  const policy = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const pin = policy?.approval?.publicKeySpkiSha256;
  if (pin !== null && !/^[a-f0-9]{64}$/.test(pin ?? "")) process.exit(1);
  process.stdout.write(pin ?? "");
' "$ROOT/canary/$RELEASE.json")
EXPECTED_COLLECTOR_SHA=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).implementation.collectorSha256)' "$ROOT/canary/$RELEASE.json")
EXPECTED_BROWSER_RUNNER_SHA=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).implementation.browserRunnerSha256)' "$ROOT/canary/$RELEASE.json")
EXPECTED_BROWSER_RUNTIME_SHA=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).implementation.browserRuntimeSha256)' "$ROOT/canary/$RELEASE.json")

if [ -e "$CONFIG_DIR/approval-private.pem" ]; then
  echo "refusing local approval private key; move it to an offline signer first" >&2
  exit 1
fi

LIBEXEC_STAGE=
BROWSER_STAGE=
cleanup() {
  [ -z "$LIBEXEC_STAGE" ] || rm -rf "$LIBEXEC_STAGE"
  [ -z "$BROWSER_STAGE" ] || rm -rf "$BROWSER_STAGE"
}
trap cleanup EXIT HUP INT TERM

public_key_spki_sha256() {
  node -e '
    const { createHash, createPublicKey } = require("node:crypto");
    const key = createPublicKey(require("node:fs").readFileSync(process.argv[1]));
    if (key.asymmetricKeyType !== "ed25519") process.exit(1);
    const der = key.export({ type: "spki", format: "der" });
    process.stdout.write(createHash("sha256").update(der).digest("hex"));
  ' "$1"
}

file_sha256() {
  node -e '
    const { createHash } = require("node:crypto");
    const bytes = require("node:fs").readFileSync(process.argv[1]);
    process.stdout.write(createHash("sha256").update(bytes).digest("hex"));
  ' "$1"
}

directory_tree_sha256() {
  node --input-type=module -e '
    import { pathToFileURL } from "node:url";
    const { directoryTreeSha256 } = await import(pathToFileURL(process.argv[2]).href);
    process.stdout.write(await directoryTreeSha256(process.argv[3]));
  ' odyssey-installer "$ROOT/tools/odyssey-gate.mjs" "$1"
}

stop_unit() {
  unit=$1
  if ! systemctl stop "$unit" >/dev/null 2>&1 && systemctl is-active --quiet "$unit"; then
    echo "failed to stop active unit: $unit" >&2
    exit 1
  fi
}

if ! getent group odyssey-browser >/dev/null 2>&1; then
  groupadd --system odyssey-browser
fi
if ! id odyssey-browser >/dev/null 2>&1; then
  useradd --system --gid odyssey-browser --home-dir /nonexistent --shell /usr/sbin/nologin odyssey-browser
fi

cargo build --locked --release --manifest-path "$ROOT/tools/odysseyctl/Cargo.toml"

install -d -m 0755 /usr/local/libexec /usr/local/lib /usr/local/bin
LIBEXEC_STAGE=$(mktemp -d /usr/local/libexec/.odyssey-gate-stage.XXXXXX)
chmod 0755 "$LIBEXEC_STAGE"
install -m 0755 "$ROOT/tools/odyssey-gate.mjs" "$LIBEXEC_STAGE/odyssey-gate.mjs"
install -m 0755 "$ROOT/tools/odyssey-gate-browser.mjs" "$LIBEXEC_STAGE/odyssey-gate-browser.mjs"
node --check "$LIBEXEC_STAGE/odyssey-gate.mjs"
node --check "$LIBEXEC_STAGE/odyssey-gate-browser.mjs"

BROWSER_STAGE=$(mktemp -d /usr/local/lib/.odyssey-browser-stage.XXXXXX)
chmod 0755 "$BROWSER_STAGE"
install -d -m 0755 "$BROWSER_STAGE/node_modules"
install -m 0644 "$ROOT/tools/browser-runtime/package.json" "$BROWSER_STAGE/package.json"
cp -a "$SITEFLOW_ROOT/node_modules/playwright" "$BROWSER_STAGE/node_modules/playwright"
cp -a "$SITEFLOW_ROOT/node_modules/playwright-core" "$BROWSER_STAGE/node_modules/playwright-core"
node -e "require('node:module').createRequire('$BROWSER_STAGE/package.json')('playwright')"

if [ "$(file_sha256 "$ROOT/tools/odyssey-gate.mjs")" != "$EXPECTED_COLLECTOR_SHA" ] \
  || [ "$(file_sha256 "$ROOT/tools/odyssey-gate-browser.mjs")" != "$EXPECTED_BROWSER_RUNNER_SHA" ] \
  || [ "$(directory_tree_sha256 "$BROWSER_STAGE")" != "$EXPECTED_BROWSER_RUNTIME_SHA" ]; then
  echo "installed implementation does not match release policy pins" >&2
  exit 1
fi

if [ -f "$STATE_DIR/state.json" ]; then
  node --input-type=module -e '
    import fs from "node:fs/promises";
    import { pathToFileURL } from "node:url";
    const { policyDigest } = await import(pathToFileURL(process.argv[2]).href);
    const policy = JSON.parse(await fs.readFile(process.argv[3], "utf8"));
    const state = JSON.parse(await fs.readFile(process.argv[4], "utf8"));
    if (state.policySha256 !== policyDigest(policy)) {
      process.stderr.write("existing canary window uses a different release policy; archive it explicitly before reinstall\n");
      process.exit(1);
    }
  ' odyssey-installer "$ROOT/tools/odyssey-gate.mjs" "$ROOT/canary/$RELEASE.json" "$STATE_DIR/state.json"
fi

if [ -n "${ODYSSEY_APPROVAL_PUBLIC_KEY_SOURCE:-}" ]; then
  if [ -z "$APPROVAL_KEY_PIN" ]; then
    echo "approval public key is not pinned in release policy; refusing provisioning" >&2
    exit 1
  fi
  openssl pkey -pubin -in "$ODYSSEY_APPROVAL_PUBLIC_KEY_SOURCE" -noout >/dev/null 2>&1
  if [ "$(public_key_spki_sha256 "$ODYSSEY_APPROVAL_PUBLIC_KEY_SOURCE")" != "$APPROVAL_KEY_PIN" ]; then
    echo "approval public key does not match release policy fingerprint" >&2
    exit 1
  fi
elif [ -f "$PUBLIC_KEY" ]; then
  if [ -z "$APPROVAL_KEY_PIN" ] || [ "$(public_key_spki_sha256 "$PUBLIC_KEY")" != "$APPROVAL_KEY_PIN" ]; then
    echo "installed approval public key is not pinned by release policy" >&2
    exit 1
  fi
fi

stop_unit odyssey-canary.timer
stop_unit odyssey-canary-browser.timer
stop_unit odyssey-canary.service
stop_unit odyssey-canary-browser.service

if [ -d "$LIBEXEC" ]; then
  rm -rf "$LIBEXEC.previous"
  mv "$LIBEXEC" "$LIBEXEC.previous"
fi
mv "$LIBEXEC_STAGE" "$LIBEXEC"
LIBEXEC_STAGE=

if [ -d "$BROWSER_RUNTIME" ]; then
  rm -rf "$BROWSER_RUNTIME.previous"
  mv "$BROWSER_RUNTIME" "$BROWSER_RUNTIME.previous"
fi
mv "$BROWSER_STAGE" "$BROWSER_RUNTIME"
BROWSER_STAGE=

runuser -u odyssey-browser -- test -r "$LIBEXEC/odyssey-gate-browser.mjs"
runuser -u odyssey-browser -- test -r "$BROWSER_RUNTIME/package.json"
runuser -u odyssey-browser -- test -r "$BROWSER_RUNTIME/node_modules/playwright/package.json"
rm -rf "$LIBEXEC.previous"
rm -rf "$BROWSER_RUNTIME.previous"

install -d -m 0700 "$CONFIG_DIR"
install -d -m 0700 "$STATE_DIR"
install -m 0755 "$ROOT/tools/odysseyctl/target/release/odysseyctl" /usr/local/bin/.odysseyctl.new
mv /usr/local/bin/.odysseyctl.new /usr/local/bin/odysseyctl
install -m 0644 "$ROOT/canary/$RELEASE.json" "$CONFIG_DIR/.policy.json.new"
mv "$CONFIG_DIR/.policy.json.new" "$CONFIG_DIR/policy.json"

if [ -n "${ODYSSEY_APPROVAL_PUBLIC_KEY_SOURCE:-}" ]; then
  install -m 0644 "$ODYSSEY_APPROVAL_PUBLIC_KEY_SOURCE" "$CONFIG_DIR/.approval-public.pem.new"
  mv "$CONFIG_DIR/.approval-public.pem.new" "$PUBLIC_KEY"
elif [ ! -f "$PUBLIC_KEY" ]; then
  echo "manual approval is locked; pin an offline public key in release policy and begin a new window before provisioning"
fi

install -m 0644 "$ROOT/tools/systemd/odyssey-canary.service" /etc/systemd/system/.odyssey-canary.service.new
install -m 0644 "$ROOT/tools/systemd/odyssey-canary.timer" /etc/systemd/system/.odyssey-canary.timer.new
install -m 0644 "$ROOT/tools/systemd/odyssey-canary-browser.service" /etc/systemd/system/.odyssey-canary-browser.service.new
install -m 0644 "$ROOT/tools/systemd/odyssey-canary-browser.timer" /etc/systemd/system/.odyssey-canary-browser.timer.new
mv /etc/systemd/system/.odyssey-canary.service.new /etc/systemd/system/odyssey-canary.service
mv /etc/systemd/system/.odyssey-canary.timer.new /etc/systemd/system/odyssey-canary.timer
mv /etc/systemd/system/.odyssey-canary-browser.service.new /etc/systemd/system/odyssey-canary-browser.service
mv /etc/systemd/system/.odyssey-canary-browser.timer.new /etc/systemd/system/odyssey-canary-browser.timer
install -m 0644 "$ROOT/tools/systemd/odyssey-canary.conf" /etc/tmpfiles.d/odyssey-canary.conf
systemd-tmpfiles --create /etc/tmpfiles.d/odyssey-canary.conf
systemctl daemon-reload

if [ ! -f "$STATE_DIR/state.json" ]; then
  node "$LIBEXEC/odyssey-gate.mjs" window-start \
    --config "$CONFIG_DIR/policy.json" \
    --state-dir "$STATE_DIR"
else
  node "$LIBEXEC/odyssey-gate.mjs" status \
    --config "$CONFIG_DIR/policy.json" \
    --state-dir "$STATE_DIR" >/dev/null
fi

systemctl start odyssey-canary-browser.service
systemctl start odyssey-canary.service
node "$LIBEXEC/odyssey-gate.mjs" status \
  --config "$CONFIG_DIR/policy.json" \
  --state-dir "$STATE_DIR" | node -e '
    let bytes = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { bytes += chunk; });
    process.stdin.on("end", () => {
      const value = JSON.parse(bytes);
      const checks = new Map((value.checks ?? []).map((check) => [check.name, check.passed]));
      if (!["observing", "ready_for_manual_approval"].includes(value.status)
        || !Number.isSafeInteger(value.sampleCount) || value.sampleCount < 1
        || checks.get("sample_tip") !== true
        || checks.get("sample_evidence_shape") !== true
        || checks.get("sample_summary_flags") !== true
        || checks.get("hard_gates") !== true
        || checks.get("collection_complete") !== true
        || checks.get("browser_fresh") !== true) process.exit(1);
    });
  '
systemctl enable --now odyssey-canary.timer odyssey-canary-browser.timer

systemctl --no-pager --full status odyssey-canary.timer odyssey-canary-browser.timer | sed -n '1,24p'
node "$LIBEXEC/odyssey-gate.mjs" status \
  --config "$CONFIG_DIR/policy.json" \
  --state-dir "$STATE_DIR"

echo "approval remains manual; no sync, build, commit, push, or deploy command was executed"
