// Test-only conformance helpers. Product adapters own their DOM, routes, state and authority.
// Adopted from Odyssey's existing remote-checkout helper on 2026-10-18.
// Its former consumer acceptance records are not evidence for this candidate.
import assert from 'node:assert/strict';

export const PATTERN_CONTRACT = 'odyssey.application-patterns.v1';
export const VIEWPORTS = Object.freeze([320, 390, 768, 1440]);
export const THEMES = Object.freeze(['light', 'dark']);

export async function assertSurface(page, { AxeBuilder, label = 'surface' } = {}) {
  await page.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('h1').count(), 1, `${label}: one page heading`);
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(width.document <= width.viewport + 1 && width.body <= width.viewport + 1,
    `${label}: document overflow ${JSON.stringify(width)}`);
  let accessibility = 'not_run';
  if (AxeBuilder) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${label}: accessibility`);
    accessibility = 'passed';
  }
  return { contract: PATTERN_CONTRACT, label, width, accessibility };
}

/** Reach a real product control with Tab, without focus() or injecting a tabindex. */
export async function assertKeyboardReachable(page, target, { maxTabs = 120, focusIndicator = target } = {}) {
  assert.equal(await target.count(), 1, 'keyboard target must be unique');
  assert.equal(await focusIndicator.count(), 1, 'focus indicator must be unique');
  await focusIndicator.waitFor({ state: 'visible' });
  const baselineShadow = await focusIndicator.evaluate(el => getComputedStyle(el).boxShadow);
  let found = await target.evaluate(el => el === document.activeElement && el.matches(':focus-visible'));
  for (let step = 0; !found && step < maxTabs; step++) {
    await page.keyboard.press('Tab');
    found = await target.evaluate(el => el === document.activeElement && el.matches(':focus-visible'));
  }
  assert.ok(found, `control not keyboard-reachable within ${maxTabs} tabs`);
  const focus = await focusIndicator.evaluate((el, baselineShadow) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && !['transparent', 'rgba(0, 0, 0, 0)'].includes(s.outlineColor)) || (baselineShadow !== null && s.boxShadow !== 'none' && s.boxShadow !== baselineShadow),
      inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    };
  }, baselineShadow);
  assert.ok(focus.ring, 'keyboard focus must have a visible outline or shadow');
  assert.ok(focus.inViewport, 'focused control must be visible in the viewport');
  assert.equal(await target.isEnabled(), true, 'keyboard action must be enabled');
}

/** Checks form semantics without returning/recording any CSRF or hidden-field values. */
export async function assertNativeForm(form, { method = 'post', csrfField = 'csrf_token' } = {}) {
  assert.equal(await form.count(), 1, 'native form must be unique');
  const result = await form.evaluate((el, { method, csrfField }) => {
    const url = new URL(el.getAttribute('action') || location.href, location.href);
    const controls = [...el.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),textarea,select')];
    const labelled = controls.every(c => [...(c.labels || [])].some(label => label.textContent.trim()) || c.getAttribute('aria-label')?.trim() ||
      (c.getAttribute('aria-labelledby') || '').split(/\s+/).some(id => document.getElementById(id)?.textContent.trim()));
    const csrf = [...el.elements].filter(c => c.name === csrfField);
    return {
      form: el.tagName === 'FORM', method: el.method.toLowerCase(),
      sameOrigin: url.origin === location.origin && ['http:', 'https:'].includes(url.protocol),
      labelled, csrf: method === 'post' ? csrf.some(c => c.type === 'hidden' && c.value.length > 0) : csrf.length === 0,
      submit: Boolean(el.querySelector('button:not([type]),button[type="submit"],input[type="submit"]')),
    };
  }, { method, csrfField });
  assert.deepEqual(result, { form: true, method, sameOrigin: true, labelled: true, csrf: true, submit: true }, 'native form contract');
}

export async function assertFeedback(notice, { kind = 'status', text } = {}) {
  assert.equal(await notice.count(), 1, 'feedback region must be unique');
  await notice.waitFor({ state: 'visible' });
  const message = (await notice.innerText()).trim();
  assert.ok(message, 'feedback must explain the actual state');
  if (text instanceof RegExp) assert.match(message, text);
  else if (typeof text === 'string') assert.ok(message.includes(text), 'expected state feedback missing');
  const accessible = await notice.evaluate((el, kind) => kind === 'error'
    ? el.getAttribute('role') === 'alert' || el.getAttribute('aria-live') === 'assertive'
    : ['status', 'alert'].includes(el.getAttribute('role')) || ['polite', 'assertive'].includes(el.getAttribute('aria-live')), kind);
  assert.ok(accessible, `${kind} feedback needs an explicit announcement region`);
}

/** Allowlisted visible user fields only; callers never pass hidden credentials/FormData. */
export async function assertRetained(form, values) {
  for (const [name, expected] of Object.entries(values)) {
    assert.match(name, /^[a-z][a-z0-9_]{0,63}$/);
    assert.doesNotMatch(name, /csrf|password|secret|token|signature|authorization|proof|cookie/i);
    const control = form.locator(`[name="${name}"]:not([type="hidden"])`);
    assert.equal(await control.count(), 1, `one visible user field ${name}`);
    assert.equal(await control.inputValue(), expected, `retained user field ${name}`);
  }
}

/** DOM relationships plus the browser's computed accessibility name; no screen-reader claim. */
export async function assertFieldAssociation(field, { name, description, invalid } = {}) {
  assert.equal(await field.count(), 1, 'associated field must be unique');
  const relations = await field.evaluate(el => {
    const ids = attribute => (el.getAttribute(attribute) || '').trim().split(/\s+/).filter(Boolean);
    const resolve = attribute => ids(attribute).map(id => ({ id, count: [...document.querySelectorAll('[id]')].filter(node => node.id === id).length, text: document.getElementById(id)?.textContent.trim() || '' }));
    return { labelled: resolve('aria-labelledby'), described: resolve('aria-describedby'), errors: resolve('aria-errormessage'), invalid: el.getAttribute('aria-invalid') };
  });
  for (const relation of [...relations.labelled, ...relations.described, ...relations.errors]) {
    assert.equal(relation.count, 1, `one associated element ${relation.id}`);
  }
  relations.labelled.forEach(relation => assert.ok(relation.text, `label ${relation.id} needs useful text`));
  const snapshot = await field.ariaSnapshot();
  assert.match(snapshot.split('\n')[0], /".+"/, 'field needs a computed accessible name');
  if (name instanceof RegExp) assert.match(snapshot.split('\n')[0], name);
  else if (typeof name === 'string') assert.ok(snapshot.split('\n')[0].includes(JSON.stringify(name)), `computed field name must be ${name}`);
  if (description) assert.ok(relations.described.concat(relations.errors).map(item => item.text).join(' ').includes(description), 'associated help/error text missing');
  if (invalid !== undefined) assert.equal(relations.invalid, String(invalid));
  return { snapshot, ...relations };
}

/** An active descendant must exist once, belong to its controlled popup, and be exposed. */
export async function assertActiveDescendant(control, { role = 'option', selected = true } = {}) {
  const result = await control.evaluate(el => {
    const id = el.getAttribute('aria-activedescendant');
    const active = id && document.getElementById(id);
    const popups = (el.getAttribute('aria-controls') || '').split(/\s+/).map(id => document.getElementById(id)).filter(Boolean);
    return { id, unique: !!id && [...document.querySelectorAll('[id]')].filter(node => node.id === id).length === 1,
      controlled: !!active && popups.some(popup => popup.contains(active)), role: active?.getAttribute('role'),
      visible: !!active && active.getClientRects().length > 0 && getComputedStyle(active).visibility !== 'hidden' && !active.closest('[hidden],[inert],[aria-hidden="true"]'),
      selected: active?.getAttribute('aria-selected'), disabled: !!active && active.matches(':disabled,[aria-disabled="true"]') };
  });
  assert.ok(result.unique && result.controlled && result.visible && !result.disabled, `valid active descendant: ${JSON.stringify(result)}`);
  assert.equal(result.role, role);
  if (selected !== undefined) assert.equal(result.selected, String(selected));
  return result;
}

export async function assertValidFocus(page, { within } = {}) {
  const focus = await page.evaluate(selector => {
    const el = document.activeElement, rect = el?.getBoundingClientRect();
    const style = el && getComputedStyle(el);
    return { id: el?.id || '', tag: el?.tagName, valid: !!el && el !== document.body && el.isConnected &&
      !el.closest('[hidden],[inert],[aria-hidden="true"]') && !el.matches(':disabled,[aria-disabled="true"]') &&
      style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth,
      within: !selector || !!document.querySelector(selector)?.contains(el) };
  }, within);
  assert.ok(focus.valid && focus.within, `visible enabled focus: ${JSON.stringify(focus)}`);
  return focus;
}

/** Text-only 200% adaptation, not CSS zoom. Reload the fixture to restore its styles. */
export async function applyTextAdaptation(page, { scale = 2, spacing = true } = {}) {
  assert.ok(scale >= 1 && scale <= 2, 'text scale must be between 1 and 2');
  return page.evaluate(({ scale, spacing }) => {
    const nodes = [...document.querySelectorAll('body,body *')].filter(el => !el.closest('svg,script,style'));
    const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize));
    nodes.forEach((el, index) => {
      el.style.setProperty('font-size', `${sizes[index] * scale}px`, 'important');
      if (spacing) {
        el.style.setProperty('line-height', '1.5', 'important');
        el.style.setProperty('letter-spacing', '.12em', 'important');
        el.style.setProperty('word-spacing', '.16em', 'important');
        if (el.matches('p')) el.style.setProperty('margin-bottom', '2em', 'important');
      }
    });
    return { scale, spacing, elements: nodes.length };
  }, { scale, spacing });
}

/** Detect hidden/clip overflow, while allowing intentional, keyboard-scrollable content. */
export async function assertTextFits(targets) {
  const clipped = await targets.evaluateAll(nodes => nodes.filter(el => {
    if (!el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    // A deliberately visually-hidden accessible label is not visible text clipping.
    if (style.position === 'absolute' && rect.width <= 1 && rect.height <= 1 && (style.clip !== 'auto' || style.clipPath !== 'none')) return false;
    return (/hidden|clip/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) ||
      (/hidden|clip/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1);
  }).map(el => ({ tag: el.tagName, id: el.id, class: el.className, text: el.textContent.trim().slice(0, 80) })));
  assert.deepEqual(clipped, [], 'adapted text must not be clipped');
}

/** Synthetic composition probe only; actual OS IME and VoiceOver remain separate evidence. */
export async function dispatchComposingKey(control, key, { legacy = false } = {}) {
  return control.evaluate((el, { key, legacy }) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, isComposing: !legacy, keyCode: legacy ? 229 : 0 });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  }, { key, legacy });
}
