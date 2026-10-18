/* Odyssey compositions. Host data and confirmed save outcomes stay with the application. */
(function (global) {
  'use strict';
  var mounted = new WeakMap();
  var nextId = 0;
  var selector = 'form[data-ody-composition="workspace-settings"]';
  function copy(value) { return {name:String(value.name || ''), slug:String(value.slug || '')}; }
  function validateWorkspace(value) {
    var errors = {};
    var name = value.name.trim();
    if (name.length < 2) errors.name = 'Use at least 2 characters for the workspace name.';
    else if (name.length > 40) errors.name = 'Keep the workspace name to 40 characters or fewer.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || value.slug.length < 3 || value.slug.length > 32) {
      errors.slug = 'Use 3–32 lowercase letters, numbers, or single hyphens.';
    } else if (['admin', 'api', 'support'].includes(value.slug)) {
      errors.slug = 'This workspace URL is reserved. Choose another one.';
    }
    return errors;
  }
  function mountWorkspace(form, options) {
    var existing = mounted.get(form);
    if (existing) {
      if (options) existing.configure(options);
      return existing.controller;
    }
    options = options || {};
    function slot(name) {
      var node = form.querySelector('[data-ody-workspace-' + name + ']');
      if (!node) throw new Error('Workspace composition requires data-ody-workspace-' + name);
      return node;
    }
    var inputs = {name:slot('name'), slug:slot('slug')};
    var save = slot('save'), discard = slot('discard'), statusNode = slot('status');
    var statusIcon = form.querySelector('[data-ody-workspace-status-icon]');
    var errorNodes = {name:slot('error="name"'), slug:slot('error="slug"'), save:slot('error="save"')};
    var initialReadOnly = {name:inputs.name.readOnly, slug:inputs.slug.readOnly};
    var value = copy(options.value || {name:inputs.name.value, slug:inputs.slug.value});
    var draft = copy(options.draft || value);
    var errors = {}, status = 'idle', saveError = '', composing = false, destroyed = false;
    var generation = 0;
    var listeners = new AbortController();
    var id = 'ody-workspace-' + (++nextId);
    ['name', 'slug'].forEach(function (key) {
      var error = errorNodes[key];
      if (!error.id) error.id = id + '-' + key + '-error';
      var describedBy = new Set((inputs[key].getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      describedBy.add(error.id);
      inputs[key].setAttribute('aria-describedby', Array.from(describedBy).join(' '));
      error.setAttribute('role', 'alert');
    });
    errorNodes.save.setAttribute('role', 'alert');
    statusNode.setAttribute('role', 'status');
    statusNode.setAttribute('aria-live', 'polite');
    function dirty() { return value.name !== draft.name || value.slug !== draft.slug; }
    function getState() {
      return {value:copy(value), draft:copy(draft), dirty:dirty(), valid:Object.keys(validateWorkspace(draft)).length === 0,
        errors:Object.assign({}, errors), status:status, error:saveError};
    }
    function emit(name, detail) { form.dispatchEvent(new CustomEvent(name, {bubbles:true, detail:detail})); }
    function render() {
      var changed = dirty(), busy = status === 'saving';
      save.disabled = !changed || busy;
      discard.disabled = !changed || busy;
      form.setAttribute('aria-busy', String(busy));
      form.dataset.odyWorkspaceDirty = String(changed);
      ['name', 'slug'].forEach(function (key) {
        inputs[key].readOnly = busy || initialReadOnly[key];
        inputs[key].setAttribute('aria-invalid', String(!!errors[key]));
        errorNodes[key].textContent = errors[key] || '';
        errorNodes[key].hidden = !errors[key];
      });
      errorNodes.save.textContent = saveError;
      errorNodes.save.hidden = !saveError;
      statusNode.textContent = busy ? 'Saving changes…' : changed ? 'Unsaved changes' : status === 'saved' && !options.onSave ? 'Changes applied locally' : 'All changes saved';
      if (statusIcon) statusIcon.textContent = changed ? '•' : '✓';
    }
    function update(notify) {
      render();
      if (notify) {
        var state = getState();
        if (options.onChange) options.onChange(state);
        emit('ody:workspace-change', state);
      }
    }
    function writeInputs() { inputs.name.value = draft.name; inputs.slug.value = draft.slug; }
    function reset() {
      if (status === 'saving') return;
      draft = copy(value); errors = {}; saveError = ''; status = 'idle';
      writeInputs(); update(true);
    }
    function isComposing(event) { return composing || event.isComposing || event.keyCode === 229; }
    form.addEventListener('compositionstart', function () { composing = true; }, {signal:listeners.signal});
    form.addEventListener('compositionend', function () { composing = false; }, {signal:listeners.signal});
    form.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && isComposing(event)) event.preventDefault();
    }, {signal:listeners.signal});
    form.addEventListener('input', function (event) {
      var key = event.target === inputs.name ? 'name' : event.target === inputs.slug ? 'slug' : null;
      if (!key || status === 'saving') return;
      draft[key] = event.target.value;
      var current = validateWorkspace(draft);
      if (current[key]) errors[key] = current[key]; else delete errors[key];
      saveError = ''; status = 'idle'; update(true);
    }, {signal:listeners.signal});
    discard.addEventListener('click', function () {
      reset(); inputs.name.focus(); emit('ody:workspace-discard', getState());
    }, {signal:listeners.signal});
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (composing || status === 'saving' || !dirty()) return;
      errors = validateWorkspace(draft); saveError = ''; update(true);
      var invalid = Object.keys(errors)[0];
      if (invalid) { inputs[invalid].focus(); return; }
      var submitted = copy(draft); submitted.name = submitted.name.trim();
      var request = ++generation;
      status = 'saving'; update(true);
      try {
        var confirmed = options.onSave ? await options.onSave(copy(submitted), {root:form, previous:copy(value)}) : submitted;
        if (destroyed || request !== generation) return;
        value = copy(confirmed || submitted); draft = copy(value); errors = {}; status = 'saved';
        writeInputs(); update(true); inputs.name.focus();
        emit('ody:workspace-save', {value:copy(value), mode:options.onSave ? 'host-confirmed' : 'local'});
      } catch (error) {
        if (destroyed || request !== generation) return;
        status = 'error'; saveError = error && error.message ? error.message : 'Could not save changes. Try again.';
        update(true); errorNodes.save.tabIndex = -1; errorNodes.save.focus();
        emit('ody:workspace-error', {error:saveError, draft:copy(draft)});
      }
    }, {signal:listeners.signal});
    var controller = {
      getState:getState,
      setValue:function (next) { if (status === 'saving') throw new Error('Wait for the pending save before replacing its confirmed value.'); value = copy(next); draft = copy(value); errors = {}; saveError = ''; status = 'idle'; writeInputs(); update(true); },
      setDraft:function (next) { if (status === 'saving') throw new Error('Wait for the pending save before replacing its draft.'); draft = copy(next); errors = validateWorkspace(draft); saveError = ''; status = 'idle'; writeInputs(); update(true); },
      reset:reset,
      destroy:function () { destroyed = true; generation++; listeners.abort(); inputs.name.readOnly = initialReadOnly.name; inputs.slug.readOnly = initialReadOnly.slug; form.removeAttribute('aria-busy'); mounted.delete(form); }
    };
    function configure(next) {
      if (status === 'saving') throw new Error('Wait for the pending save before changing its host adapter.');
      options = Object.assign({}, options, next);
      if (next.value || next.draft) {
        if (next.value) value = copy(next.value);
        draft = copy(next.draft || value); errors = {}; saveError = ''; status = 'idle';
        writeInputs(); update(false);
      }
    }
    mounted.set(form, {controller:controller, configure:configure}); writeInputs(); update(false);
    return controller;
  }
  function init(root) {
    root = root || document;
    var forms = root.matches && root.matches(selector) ? [root] : [];
    forms = forms.concat(Array.from(root.querySelectorAll(selector)));
    return forms.map(function (form) { return mountWorkspace(form); });
  }
  global.OdysseyCompositions = {init:init, mountWorkspace:mountWorkspace, validateWorkspace:validateWorkspace};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
}(window));
