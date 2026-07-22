# Sanctum Vault Ledger — synthetic design lab

> ⚠ **BOUNDARY: SYNTHETIC · OFF-FLEET · NOT LIVE · NOT SERVED · NOT ROLLOUT AUTHORITY.**
> This directory is a static design specimen. Every seal, persona, and date is
> fictional. It is not included in any server, Docker image, dist build, release
> snapshot, route, or Sanctum build, and it never will be by accident: the
> structure gate below fails on any production reference or external address.

One archival-register identity expressed in two archetypes:

- **Register** (`index.html`, `data-ody-archetype="register"`) — a ruled sealed
  ledger that answers “which seals need attention?” at a glance: a fourteen-day
  due window, eight synthetic records in fixture order, and three jurisdictions.
  Each seal states its condition three ways at once — word, geometry, and hue.
- **Dossier** (`secret.html`, `data-ody-archetype="dossier"`) — a single sealed
  folio for `seal-briar-02`. The expiring state stays on the front; the custody
  chain and destruction deed sit behind a **closed native `<details>` fold** that
  opens with keyboard or pointer, no JavaScript involved.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Register archetype specimen |
| `secret.html` | Dossier archetype specimen |
| `assets/lab-dna.css` | Sole declaration authority for the `--vault-*` token vocabulary |
| `assets/lab-vault.css` | Presentation; consumes the tokens and declares none |
| `fixtures/vault.json` | Synthetic seed — eight sealed records with `as_of` |
| `fixtures/policies.json` | Synthetic policy jurisdictions (three scopes) |
| `fixtures/lineage.json` | Synthetic custody chains per record |
| `fixtures/schema.json` | Fail-closed shape for the three fixture documents |
| `tests/fixtures.test.mjs` | Zero-dependency data gate |
| `tests/structure.test.mjs` | Zero-dependency structure gate |
| `tests/browser.test.mjs` | Playwright + system Chromium browser gate |
| `README.md` | This file |
| `SPEC.md` | Frozen identity, ownership, and falsification contracts |

Thirteen files, no others.

## View

No build, no server, no network — open the files directly:

```
odyssey/labs/sanctum-vault-ledger/index.html      # double-click, or:
xdg-open odyssey/labs/sanctum-vault-ledger/index.html
```

## Test

Run from the lab directory:

```
cd odyssey/labs/sanctum-vault-ledger
node --test tests/fixtures.test.mjs      # 5 data tests
node --test tests/structure.test.mjs     # 9 structure tests
node --test tests/browser.test.mjs       # 6 browser tests (Playwright + Chromium)
```

The browser gate reuses the repository Playwright (`siteflow/node_modules`) and
`/usr/bin/chromium`. It skips with a precise reason only when one of them is
genuinely absent. Screenshots from the gate are written outside the lab, to
`.workflow/.scratchpad/sanctum-vault-ledger/`.

## Editing

The fixtures are the source of truth for every record. When you change data, edit
the fixture and the matching HTML together — the structure gate cross-checks
identifiers, state words, versions, scopes, and due-day arithmetic between them,
so drift fails the build. The `--vault-*` tokens live only in `lab-dna.css`;
`lab-vault.css` must keep consuming them without declaring any.

## Manual pilot record

The results below cannot be automated; they are the human half of the
falsification contract in `SPEC.md` §7. **Every human result is `NOT RUN`.** No
usability, low-vision, keyboard-only, or screen-reader verification has taken
place. Record honestly — a failed pilot is a finding, not an embarrassment.

**Claim P1 — the register answers “which seals need attention?” in ≤ 5 s.**

| Date | Participant | Viewport | Seals named (of 2 in window) | Time to answer | Result |
|---|---|---|---|---|---|
| — | — | — | — | — | NOT RUN |
| — | — | — | — | — | NOT RUN |
| — | — | — | — | — | NOT RUN |

**Claim P2 — the dossier’s custody chain is reachable in ≤ 10 s with the seal broken.**

| Date | Participant | Viewport | Chain read (4 of 4 entries) | Time to full chain | Result |
|---|---|---|---|---|---|
| — | — | — | — | — | NOT RUN |
| — | — | — | — | — | NOT RUN |
| — | — | — | — | — | NOT RUN |

**Keyboard-only pilot — skip link, register, and native fold.**

| Date | Participant | Path exercised | First focus is skip link? | Seal opens with Enter/Space? | Result |
|---|---|---|---|---|---|
| — | — | — | — | — | NOT RUN |
| — | — | — | — | — | NOT RUN |

**Screen-reader pilot — state words, jurisdictions, and custody chain.**

| Date | Participant | Reader / mode | State announced as word (not colour)? | Chain order correct? | Result |
|---|---|---|---|---|---|
| — | — | — | — | — | NOT RUN |
| — | — | — | — | — | NOT RUN |

Suggested procedure: cold-open the page at 1440 px and again at 390 px, start a
timer at first paint, stop when the participant states the answer aloud; for the
keyboard and screen-reader rows, drive the page with no pointer. None of this has
been done: the rows above stay `NOT RUN` until a real person runs them.
