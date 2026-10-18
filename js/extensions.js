/* Additive Pencil component contracts. No requests; existing runtimes stay independent. */
(function () {
  'use strict';
  var root = document.documentElement;
  var initialized = new WeakSet();
  var refreshers = new WeakMap();
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

  var messages = {
    en: {
      'extensions.code.help':'Enter or paste {count} digits.', 'extensions.code.complete':'Code complete · all {count} digits captured.',
      'extensions.code.digit':'Digit {index} of {count}', 'extensions.code.required':'Enter all {count} digits.',
      'extensions.file.empty':'No file selected · not uploaded', 'extensions.file.selected':'{size} · selected on this device · not uploaded',
      'extensions.file.count':'{count} files selected', 'extensions.file.accept':'Choose a file matching {accept}.',
      'extensions.file.size':'Choose files of {size} or smaller.', 'extensions.file.multiple':'Choose one file.',
      'extensions.file.limit':'Choose at most {count} files.',
      'extensions.selection.count':'{count} selected', 'extensions.command.empty':'No matching actions. Try another search.'
    },
    zh: {
      'extensions.code.help':'输入或粘贴 {count} 位验证码。', 'extensions.code.complete':'验证码已完整输入，共 {count} 位。',
      'extensions.code.digit':'第 {index} 位，共 {count} 位', 'extensions.code.required':'请输入完整的 {count} 位验证码。',
      'extensions.file.empty':'未选择文件 · 尚未上传', 'extensions.file.selected':'{size} · 已在此设备选择 · 尚未上传',
      'extensions.file.count':'已选择 {count} 个文件', 'extensions.file.accept':'请选择符合 {accept} 的文件。',
      'extensions.file.size':'请选择不超过 {size} 的文件。', 'extensions.file.multiple':'请选择一个文件。',
      'extensions.file.limit':'最多选择 {count} 个文件。',
      'extensions.selection.count':'已选择 {count} 项', 'extensions.command.empty':'没有匹配的操作，请尝试其他搜索词。'
    },
    ja: {
      'extensions.code.help':'{count} 桁のコードを入力または貼り付けてください。', 'extensions.code.complete':'{count} 桁のコードを入力しました。',
      'extensions.code.digit':'{count} 桁中 {index} 桁目', 'extensions.code.required':'{count} 桁すべて入力してください。',
      'extensions.file.empty':'ファイル未選択 · 未アップロード', 'extensions.file.selected':'{size} · この端末で選択済み · 未アップロード',
      'extensions.file.count':'{count} 件のファイルを選択', 'extensions.file.accept':'{accept} に合うファイルを選択してください。',
      'extensions.file.size':'{size} 以下のファイルを選択してください。', 'extensions.file.multiple':'ファイルを 1 件選択してください。',
      'extensions.file.limit':'ファイルは {count} 件まで選択できます。',
      'extensions.selection.count':'{count} 件選択', 'extensions.command.empty':'一致する操作がありません。別の語句を試してください。'
    }
  };
  var registeredI18n;
  function t(key, values, node) {
    var i18n = window.Odyssey && window.Odyssey.i18n;
    if (i18n && i18n !== registeredI18n) {
      Object.keys(messages).forEach(function (locale) { i18n.register(locale, messages[locale]); });
      registeredI18n = i18n;
    }
    if (i18n) return i18n.t(key, values, node);
    var language = (node && node.closest('[lang]') || root).lang.toLowerCase().split('-')[0];
    var text = (messages[language] || messages.en)[key] || key;
    return text.replace(/\{(\w+)\}/g, function (_, name) { return values && values[name] != null ? values[name] : '{' + name + '}'; });
  }
  function describe(node, description) {
    if (!description) return;
    if (!description.id) {do {description.id='ody-ext-description-'+(++descriptionId);} while(document.getElementById(description.id)&&document.getElementById(description.id)!==description);}
    var ids = (node.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!ids.includes(description.id)) ids.push(description.id);
    node.setAttribute('aria-describedby', ids.join(' '));
  }
  var descriptionId = 0;
  function initCode(field) {
    var inputs = all('input:not([type="hidden"])', field);
    if (!inputs.length) return;
    var help = one('[data-ody-code-help]', field);
    var error = one('[data-ody-code-error]', field);
    var hidden = one('[data-ody-code-value]', field);
    var name = field.dataset.odyCodeName || field.getAttribute('name');
    if (!hidden && name) {
      hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = name;
      hidden.setAttribute('data-ody-code-value', ''); field.appendChild(hidden);
    }
    var mode = field.dataset.mode === 'text' ? 'text' : 'numeric';
    function clean(value) { return mode === 'text' ? value : value.replace(/[^0-9]/g, ''); }
    function update(notify, retry) {
      var value = inputs.map(function (input) { return input.value; }).join('');
      var complete = inputs.every(function (input) { return input.value.length === 1; });
      if (hidden) { hidden.value = value; hidden.disabled = field.disabled || inputs.every(function (input) { return input.disabled; }); }
      if (retry) {
        field.removeAttribute('aria-invalid');
        inputs.forEach(function (input) { input.removeAttribute('aria-invalid'); });
        if (error) { error.hidden = true; error.textContent = ''; }
      }
      if (help) {
        var message=t(complete ? 'extensions.code.complete' : 'extensions.code.help', {count:inputs.length}, field);
        if(help.textContent!==message)help.textContent=message;
        help.style.color = complete ? 'var(--ody-ok-ink)' : '';
      }
      inputs.forEach(function (input, index) {
        if (!input.getAttribute('aria-label') || /^(Digit |第|[0-9]+ 桁)/.test(input.getAttribute('aria-label'))) input.setAttribute('aria-label', t('extensions.code.digit', {index:index+1,count:inputs.length}, field));
        describe(input, help); describe(input, error);
      });
      if (field.hasAttribute('data-ody-code-required')) inputs[0].setCustomValidity(complete ? '' : t('extensions.code.required', {count:inputs.length}, field));
      if (notify) {
        var detail = {value:value, complete:complete};
        emit(field, 'ody:code-change', detail); emit(field, 'ody:change', detail);
      }
    }
    function distribute(value, index) {
      var digits = clean(value).slice(0, inputs.length - index);
      Array.from(digits).forEach(function (digit, offset) { inputs[index + offset].value = digit; });
      if (digits) inputs[Math.min(inputs.length - 1, index + digits.length)].focus();
      update(true, true);
    }
    inputs.forEach(function (input, index) {
      input.maxLength = inputs.length;
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('input', function (event) {
        if (isComposing(event)) return;
        var digits = clean(input.value); input.value = digits.slice(0, 1);
        if (digits) distribute(digits, index); else update(true, true);
      });
      input.addEventListener('compositionend', function () { distribute(input.value, index); });
      input.addEventListener('paste', function (event) { event.preventDefault(); distribute(event.clipboardData.getData('text'), index); });
      input.addEventListener('keydown', function (event) {
        if (isComposing(event)) return;
        if (event.key === 'Backspace' && !input.value && index > 0) { event.preventDefault(); inputs[index - 1].value = ''; inputs[index - 1].focus(); update(true, true); }
        if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); inputs[index - 1].focus(); }
        if (event.key === 'ArrowRight' && index < inputs.length - 1) { event.preventDefault(); inputs[index + 1].focus(); }
      });
    });
    var initial = field.dataset.value;
    if (initial != null) Array.from(clean(initial).slice(0, inputs.length)).forEach(function (value, index) { inputs[index].value = value; inputs[index].defaultValue = value; });
    if (inputs[0].form) inputs[0].form.addEventListener('reset', function (event) { setTimeout(function () { if(!event.defaultPrevented)update(true, true); },0); });
    refreshers.set(field, function () { update(false); });
    update(false);
  }
  function initFile(zone) {
    var input = one('[data-ody-file-input]', zone);
    if (!input) return;
    if (!input.hasAttribute('accept')) input.accept='.zip,application/zip';
    var browse = one('[data-ody-file-browse]', zone), clear = one('[data-ody-file-clear]', zone);
    var title = one('[data-ody-file-title]', zone), status = one('[data-ody-file-status]', zone);
    var initialTitle = title && title.textContent;
    var error = one('[data-ody-file-error]', zone) || one('[data-ody-file-error]', zone.parentElement);
    var errorKey = '', errorValues = {};
    if (status) { status.setAttribute('role','status'); status.setAttribute('aria-atomic','true'); }
    describe(input, status); describe(input, error);
    function size(bytes) { return bytes<1024?bytes+' B':bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(1)+' MB'; }
    function render() {
      var files = Array.from(input.files || []);
      if (title) title.textContent = files.length > 1 ? t('extensions.file.count',{count:files.length},zone) : files[0] ? files[0].name : initialTitle;
      if (status) status.textContent = files.length ? t('extensions.file.selected',{size:size(files.reduce(function (sum, file) { return sum + file.size; },0))},zone) : t('extensions.file.empty',{},zone);
      if (error) { error.textContent = errorKey ? t(errorKey,errorValues,zone) : ''; error.hidden = !errorKey; }
      input.setAttribute('aria-invalid',String(!!errorKey));
      if (clear) clear.hidden = !files.length;
    }
    function accepts(file) {
      var rules = (input.accept || '').toLowerCase().split(',').map(function (rule) { return rule.trim(); }).filter(Boolean);
      return !rules.length || rules.some(function (rule) { return rule[0] === '.' ? file.name.toLowerCase().endsWith(rule) : rule.endsWith('/*') ? file.type.toLowerCase().startsWith(rule.slice(0,-1)) : file.type.toLowerCase() === rule; });
    }
    function select(files) {
      errorKey = ''; errorValues = {};
      var max = Number(zone.dataset.odyFileMaxBytes || input.dataset.odyFileMaxBytes || 20 * 1024 * 1024);
      var limit = Number(zone.dataset.odyFileMaxCount || input.dataset.odyFileMaxCount || 0);
      if (!input.multiple && files.length > 1) errorKey = 'extensions.file.multiple';
      else if (limit > 0 && files.length > limit) { errorKey = 'extensions.file.limit'; errorValues.count = limit; }
      else if (files.some(function (file) { return !accepts(file); })) { errorKey = 'extensions.file.accept'; errorValues.accept = input.accept; }
      else if (max > 0 && files.some(function (file) { return file.size > max; })) { errorKey = 'extensions.file.size'; errorValues.size = size(max); }
      if (errorKey) input.value = '';
      render();
      var selected = Array.from(input.files || []);
      if (!errorKey && selected.length) emit(zone, 'ody:file-selected', {file:selected[0],files:selected});
      emit(zone, 'ody:file-change', {file:selected[0] || null,files:selected,valid:!errorKey});
    }
    if (browse) browse.addEventListener('click', function () { input.click(); });
    if (clear) clear.addEventListener('click', function () { input.value = ''; input.dispatchEvent(new Event('change',{bubbles:true})); if(browse)browse.focus(); });
    input.addEventListener('change', function () { select(Array.from(input.files || [])); });
    zone.addEventListener('dragover', function (event) { event.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('dragging'); });
    zone.addEventListener('drop', function (event) {
      event.preventDefault(); zone.classList.remove('dragging');
      if (input.disabled) return;
      var transfer = new DataTransfer(); Array.from(event.dataTransfer.files).forEach(function (file) { transfer.items.add(file); });
      input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
    });
    if (input.form) input.form.addEventListener('reset',function (event) { setTimeout(function () { if(event.defaultPrevented)return;errorKey=''; render(); emit(zone,'ody:file-change',{file:null,files:[],valid:true}); },0); });
    refreshers.set(zone,render); render();
  }
  function initSplit(split) {
    var divider = one('[data-ody-splitter]', split);
    if (!divider) return;
    var minimum = Number(split.dataset.odyMin || divider.getAttribute('aria-valuemin') || 0);
    var maximum = Number(split.dataset.odyMax || divider.getAttribute('aria-valuemax') || Infinity);
    var secondMinimum = Number(split.dataset.odySecondMin || 160);
    var value = Number(divider.getAttribute('aria-valuenow') || minimum);
    function horizontal() { return (split.dataset.odyOrientation || divider.getAttribute('aria-orientation')) === 'horizontal'; }
    function resize(next, source) {
      var vertical = horizontal(), total = vertical ? split.clientHeight : split.clientWidth;
      var gutter = vertical ? divider.offsetHeight : divider.offsetWidth;
      var max = Math.max(0,Math.min(maximum,total - gutter - secondMinimum));
      var min = Math.min(minimum,max), old = value;
      value = Math.round(Math.max(min,Math.min(max,next)));
      split.style.setProperty('--explorer',value + 'px');
      split.dataset.odyOrientation = vertical ? 'horizontal' : 'vertical';
      divider.setAttribute('aria-orientation',split.dataset.odyOrientation);
      divider.setAttribute('aria-valuemin',min); divider.setAttribute('aria-valuemax',max); divider.setAttribute('aria-valuenow',value);
      all('[data-ody-split-value]',split).forEach(function (input) { input.min=min;input.max=max;input.value=value; });
      if (source && value !== old) emit(split,'ody:resize',{value:value,min:min,max:max,orientation:split.dataset.odyOrientation,source:source});
    }
    divider.addEventListener('keydown', function (event) {
      var previous = horizontal() ? 'ArrowUp' : 'ArrowLeft', next = horizontal() ? 'ArrowDown' : 'ArrowRight';
      if (event.key === previous || event.key === next) { event.preventDefault(); resize(value + (event.key === next ? 1 : -1) * (event.shiftKey ? 40 : 10),'keyboard'); }
      if (event.key === 'Home') { event.preventDefault(); resize(-Infinity,'keyboard'); }
      if (event.key === 'End') { event.preventDefault(); resize(Infinity,'keyboard'); }
    });
    divider.addEventListener('pointerdown', function (event) { if(event.button!==0)return;event.preventDefault();divider.focus();divider.setPointerCapture(event.pointerId); });
    divider.addEventListener('pointermove', function (event) {
      if (divider.hasPointerCapture(event.pointerId)) { var box=split.getBoundingClientRect(); resize(horizontal()?event.clientY-box.top:event.clientX-box.left,'pointer'); }
    });
    all('[data-ody-split-preset]',split).forEach(function (button) { button.addEventListener('click',function () { resize(Number(button.dataset.odySplitPreset),'preset'); }); });
    all('[data-ody-split-value]',split).forEach(function (input) { input.addEventListener('change',function () { if(Number.isFinite(Number(input.value)))resize(Number(input.value),'input'); }); });
    new ResizeObserver(function () { resize(value,'container'); }).observe(split);
    refreshers.set(split,function () { resize(value); }); resize(value);
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
    var empty=one('[data-ody-command-empty]', dialog);
    if(empty){var noResults=commandItems(dialog).length===0;empty.hidden=!noResults;if(noResults){var message=t('extensions.command.empty',{},dialog);if(empty.textContent!==message)empty.textContent=message;}}
    selectCommand(dialog, 0);
  }
  function openCommand(dialog) {
    one('[data-ody-command-input]', dialog).value = ''; filterCommands(dialog);
    if (!dialog.open) dialog.showModal();
    one('[data-ody-command-input]', dialog).focus();
  }
  function initCommand(dialog) {
    var input = one('[data-ody-command-input]', dialog);
    var status=one('[data-ody-command-empty]',dialog);
    if(status){status.setAttribute('role','status');status.setAttribute('aria-atomic','true');describe(input,status);}
    refreshers.set(dialog,function () { filterCommands(dialog); });
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
    var bar = one('[data-selection-bar]', group), countNode = one('[data-selection-count]',group);
    function items() { return all('input[type="checkbox"]:not([data-selection-all])',group); }
    function update(notify) {
      var selected = items().filter(function (input) { return input.checked; });
      if (countNode) countNode.textContent = t('extensions.selection.count',{count:selected.length},group);
      if (bar) bar.hidden = selected.length === 0;
      var toggle = one('[data-selection-all]',group);
      if (toggle) { toggle.checked = selected.length > 0 && selected.length === items().length; toggle.indeterminate = selected.length > 0 && selected.length < items().length; }
      if (notify) {var detail={value:selected.map(function (input) { return input.value; }),count:selected.length,selected:selected};emit(group,'ody:selection-change',detail);emit(group,'ody:change',detail);}
    }
    group.addEventListener('change',function (event) {
      if (!event.target.matches('input[type="checkbox"]')) return;
      if (event.target.hasAttribute('data-selection-all')) items().forEach(function (input) { if(!input.disabled)input.checked=event.target.checked; });
      update(true);
    });
    var clear = one('[data-selection-clear]',group);
    if (clear) clear.addEventListener('click',function () { items().forEach(function (input) { input.checked=false; }); var first=items().find(function (input) { return !input.disabled; });if(first)first.focus();update(true); });
    var first=items()[0];
    if (first && first.form) first.form.addEventListener('reset',function (event) { setTimeout(function () { if(!event.defaultPrevented)update(true); },0); });
    refreshers.set(group,function () { update(false); }); update(false);
  }
  function initTree(tree) {
    all('button', tree).forEach(function (button) { button.addEventListener('click', function () {
      all('button', tree).forEach(function (item) { item.removeAttribute('aria-current'); }); button.setAttribute('aria-current', 'page');
    }); });
  }
  function initPopover(panel) {
    var trigger, frame;
    function position() {
      frame=0;
      if (!panel.matches(':popover-open') || !trigger || !trigger.isConnected) return;
      var box=trigger.getBoundingClientRect(), width=panel.offsetWidth, height=panel.offsetHeight;
      var viewport=window.visualViewport, left=viewport?viewport.offsetLeft:0, top=viewport?viewport.offsetTop:0;
      var right=left+(viewport?viewport.width:innerWidth), bottom=top+(viewport?viewport.height:innerHeight), gap=8;
      if(box.bottom<top||box.top>bottom||box.right<left||box.left>right){panel.hidePopover();return;}
      var below=bottom-box.bottom-gap, above=box.top-top-gap;
      var up=height>below && above>below;
      var x=Math.max(left+12,Math.min(box.left,right-width-12));
      var y=Math.max(top+12,Math.min(up?box.top-height-gap:box.bottom+gap,bottom-height-12));
      panel.style.left=x+'px';panel.style.top=y+'px';
      panel.dataset.odyPlacement=up?'top':'bottom';
      panel.style.transformOrigin=Math.max(0,Math.min(width,box.left+box.width/2-x))+'px '+(up?'bottom':'top');
    }
    function schedule() { if(!frame)frame=requestAnimationFrame(position); }
    panel.addEventListener('beforetoggle',function (event) {
      if (event.newState !== 'open') return;
      trigger=event.source || all('[popovertarget]').find(function (button) { return button.getAttribute('popovertarget')===panel.id && button.getAttribute('popovertargetaction')!=='hide'; });
      schedule();
    });
    panel.addEventListener('toggle',function (event) { if(event.newState==='open')position(); });
    document.addEventListener('click',function (event) { var button=event.target.closest('[popovertarget]');if(button&&button.getAttribute('popovertarget')===panel.id&&button.getAttribute('popovertargetaction')!=='hide'){trigger=button;schedule();} },true);
    window.addEventListener('resize',schedule); window.addEventListener('scroll',schedule,true);
    if(window.visualViewport){window.visualViewport.addEventListener('resize',schedule);window.visualViewport.addEventListener('scroll',schedule);}
    new ResizeObserver(schedule).observe(panel);
  }
  function init(scope) {
    [['[data-ody-code-input]',initCode],['[data-ody-file-dropzone]',initFile],['[data-ody-splitpane]',initSplit],['[data-ody-command-menu]',initCommand],['[data-registry-selection]',initSelection],['.ody-ext-tree',initTree],['[data-ody-native-popover]',initPopover]].forEach(function (pair) {
      roots(pair[0], scope).forEach(function (node) { if (!initialized.has(node)) { pair[1](node); initialized.add(node); } else if(refreshers.has(node))refreshers.get(node)(); });
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
