# Beacon Two Faces — synthetic design lab

> ⚠ **BOUNDARY: SYNTHETIC · OFF-FLEET · NOT LIVE · NOT SERVED · NOT ROLLOUT AUTHORITY.**
> This directory is a static design specimen. Every value is fictional. It is not
> included in any server, Docker image, dist build, release snapshot, route, or
> Beacon build, and it never will be by accident: the structure gate below fails
> on any production reference.

One Beacon status identity expressed in two archetypes:

- **Publication** (`public.html`) — a centered reading stack that answers
  “is the estate healthy?” in five seconds: factual headline, one status chip,
  incident-first ledger, all 24 public services with 30-day evidence.
- **Control room** (`operator.html`) — a dense full-width shift ledger that puts
  every anomaly first: 51 synthetic checks in one semantic table, 7 anomalies,
  stacked accessible records on narrow viewports. Read-only.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Lab cover and boundary statement |
| `public.html` | Publication archetype specimen |
| `operator.html` | Control-room archetype specimen |
| `assets/lab-dna.css` | Shared identity (tokens, masthead, status semantics, evidence) |
| `assets/lab-public.css` | Publication layout |
| `assets/lab-operator.css` | Control-room layout |
| `fixtures/public-status.fixture.json` | Synthetic public status data (24 components) |
| `fixtures/operator-checks.fixture.json` | Synthetic check data (51 checks, 7 anomalies) |
| `tests/structure.test.mjs` | Zero-dependency structure gate |
| `tests/browser.test.mjs` | Playwright + system Chromium browser gate |
| `SPEC.md` | Frozen identity, ownership, and falsification contracts |

## View

No build, no server, no network: open the files directly.

```
odyssey/labs/beacon-two-faces/index.html      # double-click, or:
xdg-open odyssey/labs/beacon-two-faces/index.html
```

Optional static-server viewing (identical rendering):

```
cd odyssey/labs/beacon-two-faces && python3 -m http.server 8791
# then open the printed local address in a browser
```

## Test

Run from the workspace root:

```
node --test odyssey/labs/beacon-two-faces/tests/structure.test.mjs
node --test odyssey/labs/beacon-two-faces/tests/browser.test.mjs
node --test odyssey/labs/beacon-two-faces/tests/*.test.mjs
```

The browser gate reuses the repository Playwright (`siteflow/node_modules`) and
`/usr/bin/chromium`. It skips with a precise reason only when one of them is
genuinely absent. Screenshots from the gate are written outside the Lab, to
`.workflow/.scratchpad/beacon-two-faces/`.

## Editing

The fixtures are the source of truth for every row. When you change data, edit
the fixture and the matching HTML rows together — the structure gate
cross-checks counts, identifiers, and anomaly ordering between them, so drift
fails the build.

## Manual pilot record

The two timing claims below cannot be automated; they are the human half of the
falsification contract in `SPEC.md` §7.

**Claim P1 — publication surface answers “is the estate healthy?” in ≤ 5 s.**

| Date | Participant | Viewport | First answer (healthy? what affected?) | Time to answer | Pass? | Notes |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

**Claim P2 — control-room surface locates every anomaly in ≤ 10 s.**

| Date | Participant | Viewport | Anomalies found (of 7) | Time to full list | Pass? | Notes |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

Suggested procedure: cold-open the page at 1440 px and again at 390 px, start a
timer at first paint, stop when the participant states the answer aloud. Record
honestly — a failed pilot is a finding, not an embarrassment.
