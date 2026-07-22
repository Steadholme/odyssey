# SPEC — Sanctum Vault Ledger (off-fleet lab, frozen)

**Status of this document:** Lab-only design specification. It freezes one specimen
identity and two archetype surfaces for review. Nothing in this file is production
authority, rollout authority, or a promise of either. Promotion of any clause into
Odyssey Foundation, Odyssey Components, or the Sanctum product would require a
separate, explicit acceptance outside this directory.

**Boundary:** synthetic · off-fleet · not live · not served · authority-free ·
no JavaScript · no network · thirteen files.

## 1. Identity contract (frozen)

Archival system: warm paper ground, dark ink, ruled ledger lines, one blue-wax
brand accent. `lab-dna.css` is the **only** declaration authority for `--vault-*`
tokens; `lab-vault.css` consumes them and declares none.

| Token | Value | Use |
|---|---|---|
| `--vault-paper` | `#f1e7cd` | page ground |
| `--vault-paper-alt` | `#eaddbd` | alternating ledger rows, recessed fold |
| `--vault-panel` | `#faf4e3` | register and dossier surfaces |
| `--vault-edge` | `#d7c6a0` | 1 px component edges |
| `--vault-rule` | `#cbba92` | 1 px ledger row rules |
| `--vault-rule-strong` | `#b0995f` | 2 px zone rules, margin rule, custody chain |
| `--vault-ink` | `#2f2a1e` | text, heavy structural rules |
| `--vault-ink-2` | `#58503f` | secondary text |
| `--vault-ink-3` | `#837962` | muted metadata |
| `--vault-wax` | `#294f8c` | brand emblem, links, focus — nothing else |
| `--vault-wax-strong` | `#1d3a68` | brand/link pressed edge |
| `--vault-focus` | `#294f8c` | focus outline |

Type roles are system stacks only, nothing fetched: `--vault-serif` for headings
and labels, `--vault-mono` for identifiers, timestamps, state words, and due text.

Structure rules: heavy **2 px** rules separate zones; **1 px** rules separate
ledger rows; a ruled left margin column carries the seal and category sigil. No
card grid, KPI tiles, locker wall, status dashboard, terminal aesthetic, gradient,
or glow.

## 2. Archetype contract (frozen)

Two archetypes share the identity but not a template:

- **`register`** (`index.html`) — ruled sealed ledger: due window, an eight-record
  register in fixture order, and three jurisdictions. Every record row carries the
  seal geometry, the state word, the jurisdiction, and the rotation window.
- **`dossier`** (`secret.html`) — one sealed folio for `seal-briar-02`. The
  expiring state and seal stay outside a **closed native `<details class="vault-seal
  vault-gate">`**; the custody chain (`ol.vault-chain`, four entries), the
  `inspection will be recorded` notice, and the `DEED OF DESTRUCTION` sit inside it.

Markup rules:

- `<body data-lab="sanctum-vault-ledger" data-ody-archetype="register|dossier">`.
- `data-ody-archetype` is consumed **only** by lab CSS. The lab defines no
  `data-ody-profile`, `data-ody-shell`, or `data-ody-identity` anywhere.
- The lab defines no `--ody-*`, `--c-*`, or `--app` custom properties. Every
  selector is scoped under `[data-lab="sanctum-vault-ledger"]` or a `.vault-*`
  class; the structure gate parses and enforces this mechanically.
- No script, form, button, input, inline handler, inline style, `src`, `srcset`,
  image, font file, external asset, or mutation affordance. Every `href` is a
  local `./` or `#` reference; no transport-scheme literal appears in either page,
  either stylesheet, this file, or the README.

## 3. State and category contract (frozen)

State is carried three ways at once — **word + geometry + hue** — so hue is never
the sole channel and survives forced colors through the word and border:

| State | Word | Seal geometry | Tone token |
|---|---|---|---|
| `active` | SEALED | round, embossed inner ring | `--vault-active` |
| `expiring` | EXPIRING | dripped silhouette, upward wedge | `--vault-expiring` |
| `expired` | EXPIRED | dashed rim, fracture line | `--vault-expired` |
| `revoked` | REVOKED | struck cross | `--vault-revoked` |

Category (jurisdiction) is **orthogonal to state**: each policy scope has a
distinct sigil and label — `archive-ledger`, `custody-window`, `dispatch-notes` —
drawn in ink, never in a state hue. Blue wax is brand, link, and focus only and is
never a status channel.

## 4. Fixture mapping (frozen)

The fixtures are the source of truth; the HTML mirrors them exactly.

- `vault.json` seeds the eight rows in order: `seal-ash-01`, `seal-briar-02`,
  `seal-cinder-03`, `seal-dune-04`, `seal-flint-05`, `seal-ochre-06`,
  `seal-slate-07`, `seal-umber-08`. Distribution: 5 active, 1 expiring, 1 expired,
  1 revoked.
- Each row stamps `data-vault-id`, `data-state`, `data-sealed`, `data-version`,
  `data-scope`, and `data-due-days`, where due-days is the whole-day distance from
  `as_of` (`2026-07-20T00:00:00Z`) to `rotates_at`: ash 43, briar 8, cinder −5,
  dune 25, flint 73, ochre 31, slate 108, umber 19.
- `policies.json` supplies the three jurisdiction labels and descriptions.
- `lineage.json` supplies the dossier’s four-entry custody chain for
  `seal-briar-02` (v1 briar, v2 cinder, v3 briar, v4 flint), monotonic and closed.
- No credential, plaintext, ciphertext, token, key-material, real host, route, or
  authority identifier appears in any fixture or page; personas are synthetic
  (`persona-ash|briar|cinder|dune|flint`).

## 5. Focus and accessibility contract (frozen)

- The skip link is the first focusable element on each page and lands fully on
  screen the instant it is focused, with a solid ≥ 2 px `--vault-focus` outline and
  no transform or position transition delay.
- `:focus-visible` draws a solid `--vault-focus` outline on links and the fold
  summary. The native `<details>` keeps its keyboard behaviour (Enter/Space).
- `prefers-reduced-motion: reduce` computes every transition and animation to zero.
- `forced-colors: active` keeps seal borders, state words, ruled structure, and the
  brand/fold marks (system colors take over; the brand and fold discs preserve with
  `forced-color-adjust: none`).
- Task-critical due, seal, scope, and state surfaces are never `display:none` or
  `visibility:hidden`; the layout reflows without hiding overflow at 320/390/768/
  1440 px and 200% zoom.

## 6. Ownership and isolation contract (frozen)

Thirteen files, no others:

```
README.md  SPEC.md  index.html  secret.html
assets/lab-dna.css  assets/lab-vault.css
fixtures/vault.json  fixtures/policies.json  fixtures/lineage.json  fixtures/schema.json
tests/fixtures.test.mjs  tests/structure.test.mjs  tests/browser.test.mjs
```

The lab never:

- references, imports, or links production Sanctum, Odyssey canonical layers,
  releases, dist, server, routes, distribution manifests, or `Cargo.toml`;
- loads JavaScript, external addresses, content-delivery hosts, fonts, or images;
- puts a form, button, mutation affordance, or production link on either surface;
- names a real service, host, container, target, address, credential, or
  secret-bearing field;
- is included by any Odyssey server, Docker image, dist builder, release snapshot,
  or Sanctum build. (Procedural; the structure gate proves the inverse — the lab
  holds no inbound production references.)

## 7. Falsification contract (frozen)

Every claim is disprovable:

- **Data gate** (`tests/fixtures.test.mjs`): synthetic flags, schema shape, the
  8-record state distribution, the deterministic expiring record inside the
  fourteen-day window, closed and monotonic lineage reaching each current version,
  and the absence of secret-shaped keys or real authority identifiers.
- **Structure gate** (`tests/structure.test.mjs`): the 13-file inventory, forbidden
  references, no external addresses or scripts, archetype stamps, selector scoping
  and token confinement, landmark/heading/register/due-window/chain semantics,
  fixture↔HTML agreement across all eight records, the dossier’s expiring record and
  four-step lineage, and that task-critical surfaces are not CSS-hidden.
- **Browser gate** (`tests/browser.test.mjs`, repository Playwright + system
  Chromium): no page overflow at 320/390/768/1440 px or 200% zoom, the due column
  never hidden, eight rows and one expiring row rendered with JavaScript disabled,
  the fold closed by default and opened by keyboard, four chain entries, the skip
  link first and visibly focused, forced colors preserving seal shapes and state
  words, and reduced motion removing every transition. Skips only when Playwright or
  the Chromium executable is genuinely absent, with the precise reason.
- **Human pilot (not automatable, remains open):** timing and assistive-technology
  claims live in `README.md` and are all `NOT RUN`.
