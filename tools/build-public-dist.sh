#!/bin/sh
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
# dist/ is the mutable public-core source. Never rewrite it or older releases.
exec node "$ROOT/tools/build-public-dist.mjs" "$@"
