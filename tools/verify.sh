#!/bin/sh
# One candidate, one entry point: local checks and CI use the same contracts.
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
BROWSERS=${BROWSERS:-chromium,firefox,webkit}
export BROWSERS
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<12)){console.error("Odyssey verification requires Node >=22.12");process.exit(1)}'
if [ ! -f tools/browser-runtime/node_modules/playwright/package.json ]; then
  echo 'Install the locked test environment first: npm ci --prefix tools/browser-runtime && npm run --prefix tools/browser-runtime install:browsers' >&2
  exit 1
fi
export PLAYWRIGHT_MODULE="file://$ROOT/tools/browser-runtime/node_modules/playwright/index.mjs"
export AXE_PLAYWRIGHT_MODULE="file://$ROOT/tools/browser-runtime/node_modules/@axe-core/playwright/dist/index.mjs"

cargo fmt --all -- --check
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo fmt --manifest-path tools/odysseyctl/Cargo.toml -- --check
cargo test --locked --all-targets
cargo test --locked --manifest-path tools/odysseyctl/Cargo.toml
cargo test --locked --manifest-path server/Cargo.toml
cargo build --locked --manifest-path server/Cargo.toml
cargo test --locked --manifest-path examples/rust-line/Cargo.toml
cargo doc --locked --no-deps
node --test tools/tests/release-builder.test.mjs tools/tests/odyssey-gate.test.mjs tools/tests/pattern-assertions.test.mjs
./tools/build-public-dist.sh --check

SERVER_PID=
cleanup() { if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || :; wait "$SERVER_PID" 2>/dev/null || :; fi; }
trap cleanup EXIT HUP INT TERM
if [ -z "${ODYSSEY_BASE_URL:-}" ]; then
  PORT=${ODYSSEY_VERIFY_PORT:-18770}
  node --input-type=module -e 'import net from "node:net";const s=net.createServer();s.on("error",e=>{console.error("Verification port is already in use; set ODYSSEY_VERIFY_PORT or ODYSSEY_BASE_URL:",e.message);process.exitCode=1});s.listen(Number(process.argv[1]),"127.0.0.1",()=>s.close())' "$PORT"
  BIND_ADDR="127.0.0.1:$PORT" ./server/target/debug/odyssey-server &
  SERVER_PID=$!
  ODYSSEY_BASE_URL="http://127.0.0.1:$PORT"
  export ODYSSEY_BASE_URL
fi
node --input-type=module -e 'let ready=false;for(let n=0;n<50;n++){try{const r=await fetch(process.env.ODYSSEY_BASE_URL+"/healthz");if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready)throw new Error("candidate server did not become healthy")'
node tools/tests/library-contracts.test.mjs
# The candidate build and inventory above are prerequisites. Each browser suite
# below is independent: finish all of them, retain every failure, and fail once.
FAILED_GATES=''
run_gate() {
  GATE_NAME=$1
  shift
  printf '\n=== %s ===\n' "$GATE_NAME"
  if "$@"; then
    printf 'PASS gate: %s\n' "$GATE_NAME"
  else
    GATE_STATUS=$?
    FAILED_GATES="$FAILED_GATES\n- $GATE_NAME (exit $GATE_STATUS)"
    printf 'FAIL gate: %s (exit %s)\n' "$GATE_NAME" "$GATE_STATUS" >&2
  fi
}
run_gate runtime-p1 node --test tools/tests/runtime-p1.test.mjs
run_gate line-browser node tools/tests/line-browser.test.mjs
run_gate extensions-browser node tools/tests/extensions-browser.test.mjs
run_gate patterns-browser node tools/tests/patterns-browser.test.mjs
run_gate compositions-browser node tools/tests/compositions-browser.test.mjs
run_gate line-p1 node tools/tests/line-p1.test.mjs
run_gate carousel-targets node tools/tests/carousel-targets.test.mjs
run_gate library-a11y-p1 node tools/tests/library-a11y-p1.test.mjs
run_gate core-p2 node --test tools/tests/core-p2.test.mjs
run_gate extensions-p2 node --test tools/tests/extensions-p2.test.mjs
run_gate rust-p2-browser node tools/tests/rust-p2-browser.test.mjs
run_gate workflows-browser node tools/tests/workflows-browser.test.mjs
run_gate data-tools-browser node tools/tests/data-tools-browser.test.mjs
run_gate data-tools-motion node tools/tests/data-tools-motion.test.mjs
run_gate data-tools-plot node tools/tests/data-tools-plot.test.mjs
run_gate states-browser node tools/tests/states-browser.test.mjs
run_gate performance-budget node tools/tests/performance-budget.test.mjs
run_gate visual-regression node tools/browser-runtime/node_modules/playwright/cli.js test --config tools/tests/visual.config.mjs
run_gate compatibility-browser node tools/tests/compatibility-browser.test.mjs
if [ -n "$FAILED_GATES" ]; then
  printf '\nOdyssey candidate verification failed:%b\n' "$FAILED_GATES" >&2
  exit 1
fi
if [ "${BROWSERS:-chromium,firefox,webkit}" = 'chromium,firefox,webkit' ]; then
  printf '\nPASS: Odyssey candidate verification, including all three browser engines.\n'
else
  printf '\nPASS: scoped verification (browser engines: %s); remaining engines are still required for promotion.\n' "$BROWSERS"
fi
