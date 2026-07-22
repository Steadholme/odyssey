# SPEC — Beacon Two Faces (Lab D1, frozen)

**Status of this document:** Lab-only design specification. It freezes one specimen
identity and two archetype surfaces for review. Nothing in this file is production
authority, rollout authority, or a promise of either. Promotion of any clause into
Odyssey Foundation, Odyssey Components, or the Beacon product would require a
separate, explicit acceptance outside this directory.

**Boundary:** synthetic · off-fleet · not live · not served · no JavaScript ·
no network · twelve files.

## 1. Identity contract (frozen)

Mineral system: warm paper ground, basalt ink, one oxide accent.

| Token | Value | Use |
|---|---|---|
| `--lab-paper` | `#f6f3ec` | page ground |
| `--lab-paper-2` | `#eee9dd` | recessed fills, hover, target highlight |
| `--lab-ink` | `#1f1b16` | text, heavy 2 px structural rules |
| `--lab-ink-2` | `#57503f` | secondary text |
| `--lab-hairline` | `#d9d2c2` | 1 px ledger row separators |
| `--lab-accent` | `#9a4a15` | brand tile, active navigation, links, focus — nothing else |
| `--lab-accent-ink` | `#fff8f0` | text on accent/status fills |

Type roles (system stacks only, nothing fetched):

- `--lab-font-display` — serif; publication H1, cover title, state samples.
- `--lab-font-text` — grotesque; everything textual.
- `--lab-font-mono` — mono **uppercase only** for coordinates, IDs, timestamps,
  and status labels. Mono uppercase is never used for sentence microcopy.

Structure rules:

- Heavy **2 px** basalt rules separate major structural zones; **1 px** hairlines
  separate ledger rows.
- Containers are flat. A hard shadow appears only on the skip link when raised
  by focus — the one genuinely raised interactive surface.
- No dashboard motifs: no full-width status-colored hero, no KPI tile wall, no
  decorative diagonal stripes, no severity-tinted cards, no nested cards.

## 2. Archetype contract (frozen)

Two archetypes share the identity but not a template:

- **`publication`** — centered reading stack (max 68 rem), serif factual headline,
  one overall status chip, incident-first ledger entry, 24-row component ledger,
  maintenance, history, update channels, state appendix.
- **`control-room`** — full-width dense ledger, sans/mono only, anomaly-first
  block, one semantic table of 51 checks, method legend. Read-only.

Markup rules:

- `<body data-lab="beacon-two-faces" data-ody-archetype="publication|control-room">`.
  The index page carries `data-lab` only.
- `data-ody-archetype` is consumed **only** by Lab CSS. The Lab defines no
  `data-ody-profile`, `data-ody-shell`, or `data-ody-identity` anywhere.
- The Lab defines no `--ody-*` or `--c-*` custom properties. All primitives are
  `--lab-*`, defined once on `[data-lab="beacon-two-faces"]`.
- The `--app` compatibility mapping is **not used**: the Lab loads no consumer
  `APP_CSS`, so there is nothing to map to. If a future pilot embeds this
  identity inside an Odyssey consumer, the mapping is allowed only inside
  `[data-lab="beacon-two-faces"]` and must be recorded here first.
- Every CSS selector is scoped under `[data-lab="beacon-two-faces"]` or a
  `.lab-*` class. The structure gate parses and enforces this mechanically.

## 3. Focus contract (frozen)

- `:focus-visible` draws a 2 px solid `--lab-accent` outline with 2 px offset.
- The skip link is the first focusable element on every page and becomes fully
  visible on focus (with the Lab's single hard shadow).
- `prefers-reduced-motion: reduce` removes every transition and animation.
- `forced-colors: active` keeps zone rules, row hairlines, table structure, and
  focus outlines (system colors take over; the brand mark is preserved with
  `forced-color-adjust: none`; evidence strips gain a `CanvasText` frame and
  remain redundant through their text counts and dot shapes).

## 4. Status color contract (frozen)

Semantic tokens, usable **only** for status meaning:

| Token | Value | Word (publication) | Word (control-room) |
|---|---|---|---|
| `--lab-st-ok` | `#2e6b4a` | OPERATIONAL | PASS |
| `--lab-st-degraded` | `#8a5d04` | DEGRADED | WARN |
| `--lab-st-outage` | `#a02116` | OUTAGE | FAIL |
| `--lab-st-maintenance` | `#4b5a66` | MAINTENANCE / SCHEDULED | — |
| `--lab-st-nodata` | `#8a8272` | NO DATA (hollow only) | — |

Redundancy: every status is carried by word **and** dot shape **and** hue —
circle ok/pass, diamond degraded/warn, square outage/fail, ring maintenance,
hollow circle no-data. Dot color always follows the word's `currentColor`; dots
define shape only.

Confinement: the structure gate rejects any consumption of `--lab-st-*` or
`--lab-ev-*` outside `.lab-chip`, `.lab-status`, `.lab-ev__cell`, `.lab-event`,
and `[data-lab-status]` anomaly markers. The accent never carries status.

## 5. Data-viz redundant encoding contract (frozen)

- Evidence strips hold exactly **30 cells**, oldest day left, newest right.
- Pass cells are quiet (`--lab-ev-ok`); degraded/warn, outage/fail, and
  maintenance cells are loud. Anomalies pop; calm does not.
- Every strip is wrapped in `role="img"` with an `aria-label` summarizing the
  window, and is **repeated as adjacent text** (publication: sentence summary;
  control-room: mono counts like `28P · 1W · 1F`). Hue is never the sole carrier.
- Letter vocabularies: publication `o/d/u/m/n`, control-room `p/w/f`.

## 6. Ownership and isolation contract (frozen)

Twelve files, no others:

```
README.md  SPEC.md  index.html  public.html  operator.html
assets/lab-dna.css  assets/lab-public.css  assets/lab-operator.css
fixtures/public-status.fixture.json  fixtures/operator-checks.fixture.json
tests/structure.test.mjs  tests/browser.test.mjs
```

The Lab never:

- references, imports, or links production Beacon, Odyssey canonical layers,
  releases, dist, server, site, examples, tools, `distribution.toml`, or
  `Cargo.toml`;
- loads JavaScript, external URLs, CDNs, fonts, or images;
- puts a form, button, acknowledgement control, mutation affordance, or
  production link on the control-room surface;
- names a real service, host, container, target, URL, configuration, vitals
  snapshot, or secret-bearing field in the operator fixture (checks are
  `syn-<mineral-group>-<nn>`, groups are minerals);
- is included by any Odyssey server, Docker image, dist builder, release
  snapshot, or Beacon build. (This clause is procedural; the structure gate
  proves the inverse direction — the Lab itself holds no inbound references.)

Fixture facts the gate enforces: both fixtures declare `"synthetic": true`;
the public fixture holds exactly the 24 catalog components; the operator
fixture holds exactly 51 unique checks with exactly 7 anomalies (2 fail,
5 warn), and any non-pass evidence cell implies an anomalous check.

## 7. Falsification contract (frozen)

Every claim in this SPEC is disprovable:

- **Structure gate** (`tests/structure.test.mjs`, zero-dependency
  `node:test`): file inventory, forbidden references, no external URLs or
  scripts, archetype stamps, selector scoping, token confinement, fixture
  synthetic flags, 24/51/7 counts, fixture↔HTML agreement, anomaly ordering,
  landmark/heading/table semantics, no forms or mutation controls.
- **Browser gate** (`tests/browser.test.mjs`, repository Playwright + system
  Chromium): no page overflow at 320/390/1440 px, navigation visible, focus
  visible, reduced motion honored, forced colors honored, 24/51 rows rendered
  with JavaScript disabled, anomaly-first order in the DOM, one shared computed
  identity across pages, two distinct archetypes, publication headline above
  the fold. Skips only when Playwright or the Chromium executable is genuinely
  absent, with the precise reason.
- **Human pilot (not automatable, remains open):** the five-second estate-health
  answer on the publication surface and the time-to-locate-anomalies on the
  control-room surface are timing claims that only a human pilot can confirm.
  Record sheets live in `README.md`.
