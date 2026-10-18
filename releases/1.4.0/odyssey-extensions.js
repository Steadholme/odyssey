/* Additive Pencil component contracts. No requests; existing runtimes stay independent. */
(function () {
  'use strict';
  var root = document.documentElement;
  var initialized = new WeakSet();
  var expressions = ['line', 'soft', 'studio', 'signal'];
  function all(selector, scope) { return Array.from((scope || document).querySelectorAll(selector)); }
  function roots(selector, scope) { var found=all(selector,scope); if(scope&&scope.matches&&scope.matches(selector))found.unshift(scope);return found; }
  var composing=new WeakSet();
  document.addEventListener('compositionstart',function(event){composing.add(event.target);},true);
  document.addEventListener('compositionend',function(event){composing.delete(event.target);},true);
  function isComposing(event){return event.isComposing||event.keyCode===229||composing.has(event.target);}
  function one(selector, scope) { return (scope || document).querySelector(selector); }
  function emit(node, name, detail) { node.dispatchEvent(new CustomEvent(name, {bubbles:true, detail:detail})); }
  document.addEventListener('pointerdown', function () { root.dataset.input = 'pointer'; }, true);
  document.addEventListener('keydown', function () { root.dataset.input = 'keyboard'; }, true);

  function setExpression(value) {
    if (!expressions.includes(value)) return;
    root.dataset.expression = value;
    all('[data-ody-expression-select]').forEach(function (select) { select.value = value; });
    all('.expression-picker button[data-expression]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.expression === value));
    });
    var url = new URL(location.href);
    if (value === 'line') url.searchParams.delete('expression');
    else url.searchParams.set('expression', value);
    history.replaceState(null, '', url);
    all('a[href]').forEach(function (link) {
      var target = new URL(link.getAttribute('href'), location.href);
      if (target.origin !== location.origin || !target.pathname.endsWith('.html')) return;
      if (value === 'line') target.searchParams.delete('expression');
      else target.searchParams.set('expression', value);
      link.setAttribute('href', target.pathname + target.search + target.hash);
    });
    emit(document, 'ody:expression', {expression:value});
  }

  function initCode(field) {
    var inputs = all('input', field);
    var help = one('[data-ody-code-help]', field);
    function update() {
      var complete = inputs.every(function (input) { return input.value.length === 1; });
      if (help) {
        help.textContent = complete ? 'Code complete · all six digits captured.' : 'Enter or paste six digits to try this field.';
        help.style.color = complete ? 'var(--ody-ok-ink)' : '';
      }
      emit(field, 'ody:code-change', {value:inputs.map(function (input) { return input.value; }).join(''), complete:complete});
    }
    function distribute(value, index) {
      var digits = value.replace(/\D/g, '').slice(0, inputs.length - index);
      Array.from(digits).forEach(function (digit, offset) { inputs[index + offset].value = digit; });
      inputs[Math.min(inputs.length - 1, index + digits.length)].focus();
      update();
    }
    inputs.forEach(function (input, index) {
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('input', function () {
        var digits = input.value.replace(/\D/g, ''); input.value = digits.slice(0, 1);
        if (digits) distribute(digits, index); else update();
      });
      input.addEventListener('paste', function (event) { event.preventDefault(); distribute(event.clipboardData.getData('text'), index); });
      input.addEventListener('keydown', function (event) {
        if(isComposing(event))return;
        if (event.key === 'Backspace' && !input.value && index > 0) inputs[index - 1].focus();
        if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); inputs[index - 1].focus(); }
        if (event.key === 'ArrowRight' && index < inputs.length - 1) { event.preventDefault(); inputs[index + 1].focus(); }
      });
    });
  }
  function initFile(zone) {
    var input = one('[data-ody-file-input]', zone);
    var browse = one('[data-ody-file-browse]', zone);
    var error = one('[data-ody-file-error]', zone) || one('[data-ody-file-error]', zone.parentElement);
    function select(file, dropped) {
      if (!file) return;
      var message = !file.name.toLowerCase().endsWith('.zip') ? 'Choose a ZIP archive.' : file.size > 20 * 1024 * 1024 ? 'Choose a file of 20 MB or smaller.' : '';
      if (error) { error.textContent = message; error.hidden = !message; }
      input.setAttribute('aria-invalid', String(!!message));
      if (message) return;
      if(dropped){var transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return;}
      one('[data-ody-file-title]', zone).textContent = file.name;
      one('[data-ody-file-status]', zone).textContent = (file.size / 1024).toFixed(1) + ' KB · selected on this device · not uploaded';
      emit(zone, 'ody:file-selected', {file:file});
    }
    browse.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { select(input.files[0]); });
    zone.addEventListener('dragover', function (event) { event.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('dragging'); });
    zone.addEventListener('drop', function (event) { event.preventDefault(); zone.classList.remove('dragging'); select(event.dataTransfer.files[0],true); });
  }
  function initSplit(split) {
    var divider = one('[data-ody-splitter]', split);
    function resize(value) {
      var min = Number(divider.getAttribute('aria-valuemin'));
      var max = Math.max(min, Math.min(Number(divider.getAttribute('aria-valuemax')), split.clientWidth - 160));
      var width = Math.round(Math.max(min, Math.min(max, value)));
      split.style.setProperty('--explorer', width + 'px'); divider.setAttribute('aria-valuenow', width);
    }
    divider.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); resize(Number(divider.getAttribute('aria-valuenow')) + (event.key === 'ArrowRight' ? 10 : -10));
      }
      if (event.key === 'Home') { event.preventDefault(); resize(Number(divider.getAttribute('aria-valuemin'))); }
      if (event.key === 'End') { event.preventDefault(); resize(Number(divider.getAttribute('aria-valuemax'))); }
    });
    divider.addEventListener('pointerdown', function (event) { divider.setPointerCapture(event.pointerId); });
    divider.addEventListener('pointermove', function (event) {
      if (divider.hasPointerCapture(event.pointerId)) resize(event.clientX - split.getBoundingClientRect().left);
    });
  }
  function commandItems(dialog) { return all('[data-ody-command-action]', dialog).filter(function (item) { return !item.hidden; }); }
  function selectCommand(dialog, index) {
    var items = commandItems(dialog), active = items.length ? (index + items.length) % items.length : -1;
    dialog.dataset.activeCommand = active;
    all('[data-ody-command-action]', dialog).forEach(function (item) { item.setAttribute('aria-selected', 'false'); });
    var input = one('[data-ody-command-input]', dialog);
    if (items[active]) { items[active].setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', items[active].id); }
    else input.removeAttribute('aria-activedescendant');
  }
  function filterCommands(dialog) {
    var query = one('[data-ody-command-input]', dialog).value.trim().toLowerCase();
    all('[data-ody-command-action]', dialog).forEach(function (item) { item.hidden = !item.textContent.toLowerCase().includes(query); });
    one('[data-ody-command-empty]', dialog).hidden = commandItems(dialog).length > 0;
    selectCommand(dialog, 0);
  }
  function openCommand(dialog) {
    one('[data-ody-command-input]', dialog).value = ''; filterCommands(dialog);
    if (!dialog.open) dialog.showModal();
    one('[data-ody-command-input]', dialog).focus();
  }
  function initCommand(dialog) {
    var input = one('[data-ody-command-input]', dialog);
    all('[data-ody-command-action]', dialog).forEach(function (button, index) {
      if (!button.id) button.id = dialog.id + '-action-' + index;
      button.addEventListener('click', function () { dialog.close(); emit(dialog, 'ody:command', {action:button.dataset.odyCommandAction}); });
    });
    input.addEventListener('input', function () { filterCommands(dialog); });
    input.addEventListener('keydown', function (event) {
      if(isComposing(event))return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selectCommand(dialog, Number(dialog.dataset.activeCommand) + (event.key === 'ArrowDown' ? 1 : -1)); }
      if (event.key === 'Enter') { event.preventDefault(); var item = commandItems(dialog)[Number(dialog.dataset.activeCommand)]; if (item) item.click(); }
    });
    all('[data-ody-command-close]', dialog).forEach(function (button) { button.addEventListener('click', function () { dialog.close(); }); });
  }
  function initSelection(group) {
    var bar = one('[data-selection-bar]', group);
    function update() {
      var count = all('input:checked', group).length;
      one('[data-selection-count]', group).textContent = count + ' selected'; bar.hidden = count === 0;
    }
    all('input', group).forEach(function (input) { input.addEventListener('change', update); });
    one('[data-selection-clear]', group).addEventListener('click', function () {
      all('input', group).forEach(function (input) { input.checked = false; });
      one('input', group).focus(); update();
    });
  }
  function initTree(tree) {
    all('button', tree).forEach(function (button) { button.addEventListener('click', function () {
      all('button', tree).forEach(function (item) { item.removeAttribute('aria-current'); }); button.setAttribute('aria-current', 'page');
    }); });
  }
  function initPopover(panel) {
    panel.addEventListener('beforetoggle', function (event) {
      if (event.newState !== 'open') return;
      var trigger = all('[popovertarget]').find(function (button) { return button.getAttribute('popovertarget') === panel.id && button.getAttribute('popovertargetaction') !== 'hide'; });
      var box = trigger.getBoundingClientRect();
      panel.style.left = Math.max(12, Math.min(box.left, innerWidth - 266)) + 'px';
      panel.style.top = Math.max(12, Math.min(box.bottom + 8, innerHeight - 220)) + 'px';
    });
  }
  function init(scope) {
    [['[data-ody-code-input]',initCode],['[data-ody-file-dropzone]',initFile],['[data-ody-splitpane]',initSplit],['[data-ody-command-menu]',initCommand],['[data-registry-selection]',initSelection],['.ody-ext-tree',initTree],['[data-ody-native-popover]',initPopover]].forEach(function (pair) {
      roots(pair[0], scope).forEach(function (node) { if (!initialized.has(node)) { pair[1](node); initialized.add(node); } });
    });
  }
  all('[data-ody-expression-select]').forEach(function (select) { select.addEventListener('change', function () { setExpression(select.value); }); });
  all('.expression-picker button[data-expression]').forEach(function (button) { button.addEventListener('click', function () { setExpression(button.dataset.expression); }); });
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-ody-command-open]');
    if (trigger) openCommand(document.getElementById(trigger.dataset.odyCommandOpen));
  });
  document.addEventListener('keydown', function (event) {
    if(isComposing(event))return;
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    var dialog = one('[data-ody-command-default]'); if (!dialog) return;
    event.preventDefault();
    if (dialog.open) dialog.close(); else if (!one('dialog[open]')) openCommand(dialog);
  });
  document.addEventListener('ody:command', function (event) {
    if (!event.target.classList.contains('ody-ext-command')) return;
    var target = document.querySelector(event.detail.action);
    if (target) { target.scrollIntoView({block:'start',behavior:'instant'}); target.tabIndex = -1; target.focus({preventScroll:true}); }
  });
  window.OdysseyExtensions = {init:init, openCommand:openCommand, setExpression:setExpression};
  document.addEventListener('wire:after',function(event){if(window.Odyssey)return;var targets=event.detail&&event.detail.targets;if(targets&&targets.length)targets.forEach(function(selector){var node=document.querySelector(selector);if(node)init(node);});else init(event.target);});
  init(document);
  if (!root.dataset.theme) root.dataset.theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  setExpression(new URLSearchParams(location.search).get('expression') || root.dataset.expression || 'line');
}());
