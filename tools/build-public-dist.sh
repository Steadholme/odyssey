#!/bin/sh
set -eu

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
STAGE=$(mktemp -d)
SNAPSHOT_STAGE=
cleanup() {
  rm -rf "$STAGE"
  if [ -n "$SNAPSHOT_STAGE" ]; then
    rm -rf "$SNAPSHOT_STAGE"
  fi
}
trap cleanup EXIT HUP INT TERM
RELEASE=1.3.0-canary.1
SERIES=1.3
SNAPSHOT="$ROOT/releases/$SERIES"

# The current public bank is additive over the immutable 1.1 component bank.
# Replace the release identity owned by the core header/API and normalize the
# retired brand only in the new bank, then append the canonical opt-in profile
# layer and its network-free enhancer. Older versioned banks are inputs/evidence
# only and are never opened for writing.
sed \
  -e "0,/Version : v1\\.1\\.0/s//Version : v$RELEASE/" \
  -e 's/HOLDFAST/Steadholme/g' \
  "$ROOT/releases/1.1/odyssey.css" > "$STAGE/odyssey.css"
printf '\n' >> "$STAGE/odyssey.css"
sed -n '1,$p' "$ROOT/css/profile.css" >> "$STAGE/odyssey.css"

sed \
  -e "0,/Odyssey UI JS · v1\\.1\\.0/s//Odyssey UI JS · v$RELEASE/" \
  -e "0,/var VERSION = '1\\.1\\.0';/s//var VERSION = '$RELEASE';/" \
  -e 's/HOLDFAST/Steadholme/g' \
  "$ROOT/releases/1.1/odyssey.js" > "$STAGE/odyssey.js"
printf '\n' >> "$STAGE/odyssey.js"
sed -n '1,$p' "$ROOT/js/canary.js" >> "$STAGE/odyssey.js"

cp "$ROOT/releases/1.1/odyssey-font.css" "$STAGE/odyssey-font.css"

if [ -d "$SNAPSHOT" ]; then
  for file in odyssey.css odyssey.js odyssey-font.css; do
    cmp "$STAGE/$file" "$SNAPSHOT/$file"
  done
else
  SNAPSHOT_STAGE=$(mktemp -d "$ROOT/releases/.${SERIES}.XXXXXX")
  for file in odyssey.css odyssey.js odyssey-font.css; do
    install -m 0644 "$STAGE/$file" "$SNAPSHOT_STAGE/$file"
  done
  mv "$SNAPSHOT_STAGE" "$SNAPSHOT"
  SNAPSHOT_STAGE=
fi

mkdir -p "$ROOT/dist"
for file in odyssey.css odyssey.js odyssey-font.css; do
  install -m 0644 "$SNAPSHOT/$file" "$ROOT/dist/$file"
  cmp "$ROOT/dist/$file" "$SNAPSHOT/$file"
done
