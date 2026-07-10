#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM

# The 1.2 public bank is additive over the immutable 1.1 component bank. Replace
# only the release identity owned by the core header/API, then append the opt-in
# profile layer and its network-free enhancer.
sed '0,/Version : v1\.1\.0/s//Version : v1.2.0-canary.1/' \
  "$ROOT/releases/1.1/odyssey.css" > "$STAGE/odyssey.css"
printf '\n' >> "$STAGE/odyssey.css"
sed -n '1,$p' "$ROOT/css/profile.css" >> "$STAGE/odyssey.css"

sed \
  -e '0,/Odyssey UI JS · v1\.1\.0/s//Odyssey UI JS · v1.2.0-canary.1/' \
  -e "0,/var VERSION = '1\.1\.0';/s//var VERSION = '1.2.0-canary.1';/" \
  "$ROOT/releases/1.1/odyssey.js" > "$STAGE/odyssey.js"
printf '\n' >> "$STAGE/odyssey.js"
sed -n '1,$p' "$ROOT/js/canary.js" >> "$STAGE/odyssey.js"

cp "$ROOT/releases/1.1/odyssey-font.css" "$STAGE/odyssey-font.css"

mkdir -p "$ROOT/dist"
for file in odyssey.css odyssey.js odyssey-font.css; do
  install -m 0644 "$STAGE/$file" "$ROOT/dist/$file"
done

if [ -d "$ROOT/releases/1.2" ]; then
  for file in odyssey.css odyssey.js odyssey-font.css; do
    cmp "$STAGE/$file" "$ROOT/releases/1.2/$file"
  done
else
  mkdir -p "$ROOT/releases/1.2"
  for file in odyssey.css odyssey.js odyssey-font.css; do
    install -m 0644 "$STAGE/$file" "$ROOT/releases/1.2/$file"
  done
fi
