# Compose a workflow without the Patterns page

Load the released assets and add the form from [workspace-settings.html](workspace-settings.html). It works without the Patterns shell, private IDs, a bundler, or the core JavaScript runtime:

```html
<link rel="stylesheet" href="/1.4.0/odyssey-line.css">
<link rel="stylesheet" href="/1.4.0/compositions.css">
<script src="/1.4.0/compositions.js" defer></script>
```

`odyssey-font.css` is optional. `compositions.css` also supplies readable defaults when no Odyssey token layer is present. The standalone example applies values in memory and labels that result **Changes applied locally**. It does not persist or send requests.

## Workspace settings: the consumable composition

Use one `form[data-ody-composition="workspace-settings"]` per instance. Its scoped slots are:

- `data-ody-workspace-name` and `data-ody-workspace-slug` on labelled inputs.
- `data-ody-workspace-save` on the submit button, and `data-ody-workspace-discard` on a `type="button"` button.
- `data-ody-workspace-status` for the live status text.
- `data-ody-workspace-error="name"`, `"slug"`, and `"save"` for errors.
- Optional `data-ody-workspace-status-icon` for a decorative status mark.

Keep the labels and help text meaningful for your product. Existing `aria-describedby` IDs are preserved; the composition appends its field-error ID. Name validation accepts 2–40 trimmed characters. Slugs accept 3–32 lowercase letters/numbers separated by single hyphens; `admin`, `api`, and `support` are reserved by this recipe.

The script initializes declared forms at DOM ready. For a fragment or an explicit host adapter:

```js
const form = fragment.querySelector('[data-ody-composition="workspace-settings"]');
const settings = OdysseyCompositions.mountWorkspace(form, {
  value: { name: 'North Studio', slug: 'north-studio' },
  draft: restoredDraft, // optional; otherwise starts from value
  onChange(state) {
    saveDraftInHost(state.draft);
    showUnsavedNavigationGuard(state.dirty);
  },
  async onSave(value, { previous }) {
    // The host checks permission, sends the operation, and confirms its result.
    return await saveWorkspace(value, previous);
  }
});
```

A resolved `onSave` confirms success. Return the canonical `{name, slug}`, or return nothing to confirm the submitted value. A rejection displays the error and retains the draft for retry. While waiting, the form is busy and its fields are read-only; it never starts a second save. This adapter is the place for operation identity, authorization, transport, and durable storage.

The controller provides:

- `getState()` → `{value, draft, dirty, valid, errors, status, error}`; returned values are copies. `status` is `idle`, `saving`, `saved`, or `error`.
- `setValue(value)` replaces the confirmed value and resets the draft.
- `setDraft(draft)` restores a host-owned draft and validates it.
- `reset()` discards the current draft.
- `destroy()` removes this instance's listeners. The host still owns any pending transport operation.

`setValue` and `setDraft` reject replacement during a pending save. `OdysseyCompositions.init(root)` initializes the root itself and its descendants, returning controllers; repeated initialization returns the existing instance. An explicit `mountWorkspace(form, options)` can attach or replace the host adapter after declarative initialization, without duplicate listeners. Adapter replacement is rejected while a save is pending. `Odyssey.init(root)` can delegate to this optional module when loaded.

The form emits bubbling `ody:workspace-change` with the state above, `ody:workspace-save` with `{value, mode}` (`host-confirmed` or `local`), `ody:workspace-discard` with state, and `ody:workspace-error` with `{error, draft}`. The Patterns Settings view consumes this same controller and supplies its demo-local storage adapter.

## Three Patterns, one component language

The public composition above is the smallest independent full flow. Release and Inbox remain assembly recipes in `site/patterns.html`; their page navigation and demo persistence are not part of `compositions.js`.

| Workflow | Component mapping | Minimal assembly | Host-owned state and actions |
| --- | --- | --- | --- |
| Release review | TAB, TRE/LST, AVT, PRG, BTN, MDL, TIM, TST; plain-text diff and native date-time input | Review tabs + diff/checks + reviewers + schedule dialog | Release identity/project/environment, changed-file lines, check outcomes, reviewers/current actor, confirmed approvals, schedule timestamp, activity receipts. The host confirms approve/withdraw/schedule/cancel; UI state alone grants no permission and deploys nothing. |
| Inbox | TAB/SEG, FLD, CBX, LST, TBR, PNL, EMP, TST | Filter/search + selectable list + detail + bulk actions/Undo | Notifications with stable `id`, category/title/body, `read`, `archived`, `needsAction`, time and destination; filter/query, selected IDs, active ID, and an undo receipt. Counts derive from those records. The host owns event ingestion, acknowledgements, batch persistence, and which operations can be undone. |
| Workspace settings | FRM, FLD, BTN, ALT, SWT/SEG, TST | Declared identity form + optional preference controls | Confirmed `{name,slug}`, draft, validation/save state; host-confirmed adapter as above. Appearance is a separate host preference object `{expression,theme,density,reduced}` shared by its controls, not a second persisted identity model. |

### Release state interface

Keep data and confirmed workflow state separate. A host renderer needs these values; they are not a deployment API:

```js
{
  release: { id: '54', project: 'checkout-api', environment: 'Production' },
  files: [{ path: 'src/retry.ts', lines: [{ kind: 'add', text: 'return retry();' }] }],
  checks: [{ id: 'build', status: 'passed', summary: 'Build completed' }],
  reviewers: [{ id: 'emma', approved: true }, { id: 'you', approved: false }],
  currentActor: 'you', scheduledAt: null, activity: []
}
```

Derive added/deleted counts from `kind`, and readiness from confirmed required checks/approvals. The Patterns demo's `release.approved`, `scheduledAt`, and `events` are its local fixture adapter; a consuming product replaces that adapter with its own confirmed records.

### Inbox state interface

```js
{
  notifications: [{ id: 'n1', title: 'Review requested', read: false,
    archived: false, needsAction: true, body: 'Review release 54.', destination: 'release/54' }],
  filter: 'all', query: '', selectedIds: [], activeId: 'n1', undoReceipt: null
}
```

`all`, `unread`, and `needsAction` filter the same collection. Select-all applies only to the visible result; indeterminate selection reflects a proper subset. After an operation removes the last filtered row, focus a usable search/filter control. Undo restores affected records and returns focus to a restored row control. Navigation hands focus to its destination rather than restoring a closed overlay's trigger.

## Check the consumption boundary

`tools/tests/compositions-browser.test.mjs` verifies this fixture without the Patterns shell, repeated initialization, multiple independent roots, host-confirmed success/error recovery, preserved descriptions, state copies, IME candidate Enter, and the Patterns command-menu IME paths. Set `ODYSSEY_BASE_URL` to a candidate or production origin to exercise published routes. Without it, the test serves only its declared fixture/source assets on a temporary loopback port.
