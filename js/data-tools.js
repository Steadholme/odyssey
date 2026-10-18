/* Optional Odyssey data compositions. Hosts own queries, sources, permissions and time zones. */
(function (global) {
  'use strict';
  var mounts = new WeakMap(), sequence = 0;
  var messages = {
    "Filter field": ["data.filterField", ["筛选字段", "フィルター項目"]],
    "Filter operator": ["data.filterOperator", ["筛选运算符", "条件"]],
    "Filter value": ["data.filterValue", ["筛选值", "フィルター値"]],
    "Add a condition…": ["data.addACondition", ["添加条件…", "条件を追加…"]],
    "Add filter": ["data.addFilter", ["添加筛选", "条件を追加"]],
    "Clear all": ["data.clearAll", ["全部清除", "すべてクリア"]],
    "Active filters": ["data.activeFilters", ["已启用的筛选", "適用中の条件"]],
    "Saved view name": ["data.savedViewName", ["保存视图名称", "保存するビュー名"]],
    "Name this view": ["data.nameThisView", ["为视图命名", "ビューに名前を付ける"]],
    "Save view": ["data.saveView", ["保存视图", "ビューを保存"]],
    "Restore a saved view": ["data.restoreASavedView", ["恢复保存的视图", "保存したビューを復元"]],
    "Saved views": ["data.savedViews", ["已保存的视图", "保存したビュー"]],
    "contains": ["data.contains", ["包含", "含む"]],
    "is": ["data.is", ["等于", "一致"]],
    "Wrap lines": ["data.wrapLines", ["自动换行", "折り返し"]],
    "Copy text": ["data.copyText", ["复制文本", "テキストをコピー"]],
    "Source text": ["data.sourceText", ["源文本", "ソーステキスト"]],
    "Text copied": ["data.textCopied", ["已复制文本", "テキストをコピーしました"]],
    "Clipboard unavailable. Select the text to copy.": ["data.clipboardUnavailableSelectTheTextToCopy", ["剪贴板不可用，请选中文本复制。", "クリップボードを使用できません。テキストを選択してコピーしてください。"]],
    "Added: ": ["data.added", ["新增：", "追加："]],
    "Removed: ": ["data.removed", ["删除：", "削除："]],
    "← Previous": ["data.previous", ["← 上个月", "← 前の月"]],
    "Next →": ["data.next", ["下个月 →", "次の月 →"]],
    "Date-only": ["data.dateOnly", ["仅日期", "日付のみ"]],
    "Calendar dates": ["data.calendarDates", ["日历日期", "カレンダーの日付"]],
    "From": ["data.from", ["开始日期", "開始日"]],
    "Through": ["data.through", ["结束日期", "終了日"]],
    "Apply range": ["data.applyRange", ["应用日期范围", "期間を適用"]],
    "Agenda · this month": ["data.agendaThisMonth", ["日程 · 本月", "今月の予定"]],
    "No events in this range.": ["data.noEventsInThisRange", ["此范围内没有日程。", "この期間に予定はありません。"]],
    "All day": ["data.allDay", ["全天", "終日"]],
    "Choose a valid start and end date in order.": ["data.chooseAValidStartAndEndDateInOrder", ["请选择有效且按先后顺序排列的开始和结束日期。", "開始日と終了日を正しい順序で入力してください。"]],
    "Search resources": ["data.searchResources", ["搜索资源", "リソースを検索"]],
    "Search resources…": ["data.searchResourcesPlaceholder", ["搜索资源…", "リソースを検索…"]],
    "Search": ["data.search", ["搜索", "検索"]],
    "Follow current version": ["data.followCurrentVersion", ["跟随当前版本", "現在のバージョンに追従"]],
    "Pin selected version": ["data.pinSelectedVersion", ["固定所选版本", "選択したバージョンを固定"]],
    "Version policy": ["data.versionPolicy", ["版本策略", "バージョンポリシー"]],
    "Retry source": ["data.retrySource", ["重试来源", "取得を再試行"]],
    "Previous": ["data.previousLabel", ["上一页", "前へ"]],
    "Next": ["data.nextLabel", ["下一页", "次へ"]],
    "Loading source…": ["data.loadingSource", ["正在加载来源…", "取得中…"]],
    "No matching resources. Change the search to try again.": ["data.noMatchingResourcesChangeTheSearchToTryAgain", ["没有匹配的资源，请修改搜索后重试。", "一致するリソースがありません。検索条件を変更してください。"]],
    "No resource selected": ["data.noResourceSelected", ["尚未选择资源", "リソース未選択"]],
    "Permission denied. ": ["data.permissionDenied", ["权限被拒绝。", "アクセスが拒否されました。"]],
    "Source unavailable. ": ["data.sourceUnavailable", ["来源不可用。", "取得元を利用できません。"]],
    "Source error. ": ["data.sourceError", ["来源错误。", "取得元でエラーが発生しました。"]],
    "Virtual collection": ["data.virtualCollection", ["虚拟化集合", "仮想リスト"]],
    "Analysis": ["data.analysis", ["分析图表", "分析"]],
    "Chart series": ["data.chartSeries", ["图表序列", "グラフの系列"]],
    "No values to plot. Enable a series or supply data.": ["data.noValuesToPlotEnableASeriesOrSupplyData", ["没有可绘制的数据，请启用一个序列或提供数据。", "表示する値がありません。系列を有効にするかデータを渡してください。"]],
    "No value": ["data.noValue", ["缺失值", "値なし"]],
    "Date": ["data.date", ["日期", "日付"]],
    "{count} results · {conditions} conditions": ["data.countResultsConditionsConditions", ["{count} 个结果 · {conditions} 个条件", "{count} 件 · {conditions} 条件"]],
    "Remove {field} filter: {value}": ["data.removeFieldFilterValue", ["移除 {field} 筛选：{value}", "{field} 条件を削除：{value}"]],
    "{field} {operator} {value} ×": ["data.fieldOperatorValue", ["{field} {operator} {value} ×", "{field} {operator} {value} ×"]],
    "{count} new lines below": ["data.countNewLinesBelow", ["下方新增 {count} 行", "下に {count} 行追加"]],
    "Schedule zone: {zone} · event dates and time labels supplied by the host.": ["data.scheduleZoneZoneEventDatesAndTimeLabelsSuppliedByTheHost", ["日程时区：{zone} · 事件日期和时间标签由宿主提供。", "予定のタイムゾーン：{zone} · 日付と時刻ラベルはホストが提供します。"]],
    "{count} events": ["data.countEvents", ["{count} 个日程", "予定 {count} 件"]],
    "Agenda · {start}{end}": ["data.agendaStartEnd", ["日程 · {start}{end}", "予定 · {start}{end}"]],
    "{count} resources available": ["data.countResourcesAvailable", ["{count} 个可用资源", "{count} 件のリソース"]],
    "Pinned {identity}@{version}": ["data.pinnedIdentityVersion", ["已固定 {identity}@{version}", "固定済み {identity}@{version}"]],
    "Following current: {identity} (last observed {version})": ["data.followingCurrentIdentityLastObservedVersion", ["跟随当前：{identity}（最近观测版本 {version}）", "現在に追従：{identity}（最終確認 {version}）"]],
    "{count} items · {selected} selected": ["data.countItemsSelectedSelected", ["{count} 项 · 已选择 {selected} 项", "{count} 件 · {selected} 件選択"]],
    "{count} series. Missing observations remain gaps; negative values are preserved.": ["data.countSeriesMissingObservationsRemainGapsNegativeValuesArePreserved", ["{count} 个序列。缺失值保留为空段，负值原样显示。", "{count} 系列。欠測値は途切れとして表示し、負の値を保持します。"]]
  };
  var registeredI18n;
  function translator(root) {
    return function (text, vars) {
      var entry = messages[text], i18n = global.Odyssey && global.Odyssey.i18n;
      if (entry && i18n) {
        if (registeredI18n !== i18n) {
          ['en','zh','ja'].forEach(function(locale,index){var strings={};Object.entries(messages).forEach(function(pair){strings[pair[1][0]]=index===0?pair[0]:pair[1][1][index-1];});i18n.register(locale,strings);});registeredI18n=i18n;
        }
        return i18n.t(entry[0], vars, root);
      }
      return text.replace(/\{(\w+)\}/g,function(match,key){return vars&&vars[key]!==undefined?String(vars[key]):match;});
    };
  }

  function node(tag, text, attrs) {
    var element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    Object.entries(attrs || {}).forEach(function (pair) { element.setAttribute(pair[0], String(pair[1])); });
    return element;
  }
  function button(text, action) { return node('button', text, {type:'button', 'data-action':action}); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function mount(root, kind, build) {
    if (!root) throw new Error('A data-tools root is required.');
    var previous = mounts.get(root);
    if (previous) {
      if (previous.kind !== kind) throw new Error('This root already owns a different data composition.');
      return previous.api;
    }
    var original=document.createDocumentFragment(),attributes={},controller=new AbortController(),cleanups=[],destroyed=false;
    ['class','data-ody-data-tools','aria-busy'].forEach(function(name){attributes[name]=root.getAttribute(name);});
    while(root.firstChild)original.append(root.firstChild);
    root.classList.add('ody-data-tool'); root.dataset.odyDataTools=kind;
    function dispose(){if(destroyed)return;destroyed=true;controller.abort();cleanups.forEach(function(fn){fn();});root.replaceChildren(original);Object.entries(attributes).forEach(function(pair){if(pair[1]===null)root.removeAttribute(pair[0]);else root.setAttribute(pair[0],pair[1]);});mounts.delete(root);}
    var lifecycle = {
      on:function (target, name, handler) { target.addEventListener(name, handler, {signal:controller.signal}); },
      cleanup:function (fn) { cleanups.push(fn); },
      emit:function (name, detail) { root.dispatchEvent(new CustomEvent('ody:' + name, {bubbles:true, detail:clone(detail)})); }
    };
    var animations=[];
    lifecycle.reveal=function(element,event){if(!event||!event.detail||!element.animate||global.matchMedia('(prefers-reduced-motion: reduce)').matches)return;animations.forEach(function(animation){animation.cancel();});animations=[element.animate([{opacity:.55},{opacity:1}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'})];};
    cleanups.push(function(){animations.forEach(function(animation){animation.cancel();});});
    var api;
    try{api=build(lifecycle,translator(root));}catch(error){dispose();throw error;}
    api.destroy=dispose;
    mounts.set(root, {kind:kind, api:api}); return api;
  }
  function labelled(text, input) { var label = node('label', text); label.append(input); return label; }
  function status() { return node('p', '', {role:'status', 'aria-live':'polite', class:'ody-data-status'}); }
  function select(items, label) {
    var element = node('select', null, {'aria-label':label});
    items.forEach(function (item) { element.append(node('option', item.label || item, {value:item.value || item})); }); return element;
  }
  function report(error) { return error && error.message ? error.message : String(error); }
  function validateFilters(filters, fields) {
    if (!Array.isArray(filters)) throw new Error('Filters must be an array.');
    return filters.map(function (filter) {
      if (!fields.some(function (field) { return field.key === filter.field; })) throw new Error('Unknown query field: ' + filter.field);
      if (!['eq', 'contains'].includes(filter.op)) throw new Error('Unsupported filter operator.');
      return {field:filter.field, op:filter.op, value:String(filter.value)};
    });
  }
  function mountFilters(root, options) {
    options = options || {};
    return mount(root, 'filters', function (life, ui) {
      var fields = options.fields || [], state = {filters:[], savedViews:clone(options.savedViews || []), name:'', count:0}, error = '';
      if (!fields.length) throw new Error('Provide an allowlisted fields array.');
      var param = options.urlParam || 'filters', form = node('form', null, {class:'ody-data-toolbar'});
      var field = select(fields.map(function (item) { return {value:item.key, label:item.label}; }), ui('Filter field'));
      var op = select([{value:ui('contains'),label:ui('contains')}, {value:'eq',label:ui('is')}], ui('Filter operator'));
      var value = node('input', null, {type:'text', 'aria-label':ui('Filter value'), placeholder:ui('Add a condition…')});
      var add = node('button', ui('Add filter'), {type:'submit'}), clear = button(ui('Clear all'), 'clear');
      form.append(field, op, value, add, clear);
      var chips = node('div', null, {class:'ody-query-chips', role:'group', 'aria-label':ui('Active filters')}), feedback = status();
      var errorNode = node('p', '', {role:'alert', class:'ody-data-error'});
      var saveForm = node('form', null, {class:'ody-data-toolbar'}), name = node('input', null, {'aria-label':ui('Saved view name'), placeholder:ui('Name this view'), maxlength:60});
      var save = node('button', ui('Save view'), {type:'submit'}), views = select([{value:'',label:ui('Restore a saved view')}], ui('Saved views'));
      saveForm.append(name, save, views); root.append(form, chips, feedback, errorNode, saveForm);
      function serialise(filters) { return JSON.stringify(validateFilters(filters, fields)); }
      function writeUrl() {
        if (!options.syncUrl) return;
        var url = new URL(location.href); if (state.filters.length) url.searchParams.set(param, serialise(state.filters)); else url.searchParams.delete(param);
        history.pushState(null, '', url);
      }
      function render() {
        chips.replaceChildren();
        state.filters.forEach(function (filter, index) {
          var descriptor = fields.find(function (item) { return item.key === filter.field; });
          var chip = button(ui('{field} {operator} {value} ×',{field:descriptor.label,operator:filter.op === 'eq' ? ui('is') : ui('contains'),value:filter.value}), 'remove');
          chip.dataset.index = index; chip.setAttribute('aria-label', ui('Remove {field} filter: {value}',{field:descriptor.label,value:filter.value})); chips.append(chip);
        });
        feedback.textContent = ui('{count} results · {conditions} conditions',{count:state.count,conditions:state.filters.length});
        clear.disabled = !state.filters.length && !error; errorNode.textContent = error; errorNode.hidden = !error;
        views.replaceChildren(node('option', ui('Restore a saved view'), {value:''}));
        state.savedViews.forEach(function (view, i) { views.append(node('option', view.name, {value:i})); });
      }
      function apply(filters, updateUrl) {
        try {
          state.filters = validateFilters(filters, fields); error = '';
          if (updateUrl) writeUrl();
          var result = options.onChange ? options.onChange(clone(state.filters)) : undefined;
          if (typeof result === 'number') state.count = result;
          render(); life.emit('filters-change', state);
        } catch (failure) { error = report(failure); render(); }
      }
      function readUrl() {
        var raw = new URL(location.href).searchParams.get(param);
        try { apply(raw ? JSON.parse(raw) : [], false); } catch (failure) { error = 'Invalid view URL: ' + report(failure); render(); }
      }
      life.on(form, 'submit', function (event) { event.preventDefault(); if (event.isComposing || !value.value.trim()) return; apply(state.filters.concat([{field:field.value, op:op.value, value:value.value.trim()}]), true); value.value = ''; value.focus(); });
      life.on(clear, 'click', function () { apply([], true); });
      life.on(chips, 'click', function (event) { var target = event.target.closest('[data-index]'); if (!target) return; var index = Number(target.dataset.index); apply(state.filters.filter(function (_, i) { return i !== index; }), true); (chips.children[Math.min(index, chips.children.length - 1)] || value).focus(); });
      life.on(saveForm, 'submit', function (event) {
        event.preventDefault(); if (!name.value.trim()) { name.focus(); return; }
        var saved = {name:name.value.trim(), filters:clone(state.filters)};
        state.savedViews.push(saved); name.value = ''; render(); life.emit('filters-save', saved);
        if (options.onSaveView) options.onSaveView(clone(saved));
      });
      life.on(views, 'change', function () { var saved = state.savedViews[Number(views.value)]; if (views.value !== '' && saved) apply(saved.filters, true); });
      if (options.syncUrl) life.on(global, 'popstate', readUrl);
      if (options.state) { state.savedViews = clone(options.state.savedViews || state.savedViews); apply(options.state.filters || [], false); }
      else if (options.syncUrl) readUrl(); else apply(options.filters || [], false);
      return {getState:function () { return clone(state); }, setFilters:function (filters) { apply(filters, true); }, setResultCount:function (count) { state.count = Number(count); render(); }, serialize:function () { return serialise(state.filters); }, restore:function (serialized) { apply(JSON.parse(serialized), true); }};
    });
  }
  function textLines(value) {
    if (typeof value === 'string') return value.split('\n').map(function (text) { return {text:text, kind:'context'}; });
    return (value || []).map(function (line) { return {text:String(line.text), kind:['add','remove'].includes(line.kind) ? line.kind : 'context'}; });
  }
  function mountText(root, options) {
    options = options || {};
    return mount(root, 'text', function (life, ui) {
      var state = options.state ? clone(options.state) : {lines:textLines(options.lines || options.text || ''), wrap:!!options.wrap, folded:!!options.folded};
      state.lines = textLines(state.lines);
      var toolbar = node('div', null, {class:'ody-data-toolbar'}), wrap = button(ui('Wrap lines'), 'wrap'), copy = button(ui('Copy text'), 'copy');
      toolbar.append(wrap, copy);
      var details = node('details'), summary = node('summary', options.label || ui('Source text'));
      var viewport = node('div', null, {class:'ody-text-viewport', tabindex:0, role:'region', 'aria-label':options.label || ui('Source text')}), pre = node('pre'), feedback = status();
      details.append(summary, viewport); viewport.append(pre); root.append(toolbar, details, feedback);
      function lineElement(line, index) {
        var row = node('span', null, {class:'ody-text-line', 'data-kind':line.kind});
        row.append(node('span', index + 1, {class:'ody-line-number', 'aria-hidden':true}), node('span', line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' ', {class:'ody-diff-mark','aria-hidden':true}), node('code', line.text)); if(line.kind!=='context')row.prepend(node('span',line.kind==='add'?ui('Added: '):ui('Removed: '),{class:'ody-data-sr-only'})); return row;
      }
      function appearance() { details.open = !state.folded; wrap.setAttribute('aria-pressed', String(state.wrap)); viewport.dataset.wrap = String(state.wrap); }
      state.lines.forEach(function (line, index) { pre.append(lineElement(line, index)); }); appearance();
      life.on(wrap, 'click', function () { state.wrap = !state.wrap; appearance(); });
      life.on(details, 'toggle', function () { state.folded = !details.open; });
      life.on(copy, 'click', async function () {
        var plain = state.lines.map(function (line) { return line.text; }).join('\n');
        try {
          if (options.onCopy) await options.onCopy(plain); else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(plain); else throw new Error(ui('Clipboard unavailable. Select the text to copy.'));
          feedback.textContent = ui('Text copied');
        } catch (failure) { feedback.textContent = report(failure); }
      });
      return {getState:function () { state.folded = !details.open; return clone(state); }, getText:function () { return state.lines.map(function (line) { return line.text; }).join('\n'); }, append:function (lines) {
        var following = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 8, incoming = textLines(lines), start = state.lines.length;
        state.lines = state.lines.concat(incoming); incoming.forEach(function (line, i) { pre.append(lineElement(line, start + i)); });
        if (following) viewport.scrollTop = viewport.scrollHeight; else feedback.textContent = ui('{count} new lines below',{count:incoming.length});
        life.emit('text-append', {count:incoming.length, following:following});
      }};
    });
  }
  function validDate(value) { var date=new Date(value + 'T00:00:00Z'); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value; }
  function dateAt(value, delta) { var date = new Date(value + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0,10); }
  function monthAt(value, delta) { var date = new Date(value + '-01T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + delta); return date.toISOString().slice(0,7); }
  function mountCalendar(root, options) {
    options = options || {};
    return mount(root, 'calendar', function (life, ui) {
      var state = options.state ? clone(options.state) : {month:options.month || '2026-10', start:options.start || '', end:options.end || '', events:clone(options.events || [])};
      if(!validDate(state.month+'-01'))throw new Error('Calendar month must be YYYY-MM.');
      state.events.forEach(function(event){if(!validDate(event.date))throw new Error('Event dates must be valid date-only YYYY-MM-DD values.');});
      var toolbar = node('div', null, {class:'ody-data-toolbar'}), previous = button(ui('← Previous'), 'previous'), title = node('h3'), next = button(ui('Next →'), 'next');
      toolbar.append(previous, title, next);
      var context = node('p', ui('Schedule zone: {zone} · event dates and time labels supplied by the host.',{zone:options.timeZone || ui('Date-only')}), {class:'ody-data-caption'});
      var grid = node('div', null, {class:'ody-calendar-grid', role:'group', 'aria-label':ui('Calendar dates')}), agenda = node('div', null, {class:'ody-agenda'}), feedback = status();
      var range = node('form', null, {class:'ody-data-toolbar'}), start = node('input', null, {type:'date', value:state.start}), end = node('input', null, {type:'date', value:state.end}), submit = node('button', ui('Apply range'), {type:'submit'});
      range.append(labelled(ui('From'), start), labelled(ui('Through'), end), submit); root.append(toolbar, context, range, grid, agenda, feedback);
      function selected(date) { return !!state.start && date >= state.start && date <= (state.end || state.start); }
      function choose(date, extend) {
        if (extend && state.start) { var anchor = state.start; state.start = date < anchor ? date : anchor; state.end = date < anchor ? anchor : date; }
        else { state.start = date; state.end = date; }
        start.value = state.start; end.value = state.end; render(); life.emit('calendar-change', state);
      }
      function render() {
        title.textContent = new Intl.DateTimeFormat(options.locale || (global.Odyssey&&global.Odyssey.i18n?global.Odyssey.i18n.locale(root):'en'), {year:'numeric',month:'long',timeZone:'UTC'}).format(new Date(state.month + '-01T00:00:00Z'));
        grid.replaceChildren(); var calendarLocale=options.locale || (global.Odyssey&&global.Odyssey.i18n?global.Odyssey.i18n.locale(root):'en'); for(var weekdayIndex=0;weekdayIndex<7;weekdayIndex++){var weekdayLabel=new Intl.DateTimeFormat(calendarLocale,{weekday:'short',timeZone:'UTC'}).format(new Date(dateAt('2026-10-05',weekdayIndex)+'T00:00:00Z'));grid.append(node('span',weekdayLabel,{'aria-hidden':true,class:'ody-weekday'}));}
        var first = state.month + '-01', weekday = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7, last = monthAt(state.month, 1) + '-01';
        for (var i = 0; i < weekday; i++) grid.append(node('span', '', {'aria-hidden':true}));
        for (var date = first; date < last; date = dateAt(date, 1)) {
          var count = state.events.filter(function (event) { return event.date === date; }).length;
          var day = button(String(Number(date.slice(8))), 'date'); day.dataset.date = date;
          day.setAttribute('aria-label', date + (count ? ', ' + ui('{count} events',{count:count}) : '')); day.setAttribute('aria-pressed', String(selected(date)));
          if (count) day.append(node('span', '•', {'aria-hidden':true})); grid.append(day);
        }
        agenda.replaceChildren(node('h3', state.start ? ui('Agenda · {start}{end}',{start:state.start,end:state.end !== state.start ? ' — ' + state.end : ''}) : ui('Agenda · this month')));
        var events = state.events.filter(function (event) { return state.start ? selected(event.date) : event.date.slice(0,7) === state.month; }).sort(function (a,b) { return a.date.localeCompare(b.date); });
        if (!events.length) agenda.append(node('p', ui('No events in this range.'), {class:'ody-data-caption'}));
        events.forEach(function (event) {
          var item = node('article', null, {class:'ody-agenda-event'});
          item.append(node('time', event.date, {datetime:event.date}), node('strong', event.title), node('span', event.timeLabel || ui('All day')));
          if (event.timeZone) item.append(node('small', event.timeZone)); agenda.append(item);
        });
        feedback.textContent = ui('{count} events',{count:events.length});
      }
      life.on(previous, 'click', function (event) { state.month = monthAt(state.month, -1); render(); life.reveal(grid,event); });
      life.on(next, 'click', function (event) { state.month = monthAt(state.month, 1); render(); life.reveal(grid,event); });
      life.on(grid, 'click', function (event) { var day = event.target.closest('[data-date]'); if (!day) return; choose(day.dataset.date, event.shiftKey); grid.querySelector('[data-date="' + day.dataset.date + '"]').focus(); });
      life.on(grid, 'keydown', function (event) {
        var day = event.target.closest('[data-date]'); if (!day || event.isComposing) return;
        var offset = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key], target;
        if (offset) target = dateAt(day.dataset.date, offset);
        if (event.key === 'Home') target = dateAt(day.dataset.date, -((new Date(day.dataset.date + 'T00:00:00Z').getUTCDay() + 6) % 7));
        if (event.key === 'End') target = dateAt(day.dataset.date, 6 - ((new Date(day.dataset.date + 'T00:00:00Z').getUTCDay() + 6) % 7));
        if (event.key === 'PageUp' || event.key === 'PageDown') target = monthAt(state.month, event.key === 'PageUp' ? -1 : 1) + '-01';
        if (!target) return; event.preventDefault(); state.month = target.slice(0,7); if (event.shiftKey) choose(target, true); else render(); grid.querySelector('[data-date="' + target + '"]').focus();
      });
      life.on(range, 'submit', function (event) { event.preventDefault(); if (!validDate(start.value) || !validDate(end.value) || end.value < start.value) { feedback.textContent = ui('Choose a valid start and end date in order.'); start.focus(); return; } state.start = start.value; state.end = end.value; state.month = state.start.slice(0,7); render(); life.emit('calendar-change', state); });
      render(); return {getState:function () { return clone(state); }, setEvents:function (events) { events.forEach(function(event){if(!validDate(event.date))throw new Error('Event dates must be valid date-only YYYY-MM-DD values.');});state.events = clone(events); render(); }};
    });
  }
  function mountResources(root, options) {
    options = options || {};
    return mount(root, 'resources', function (life, ui) {
      var state = options.state ? clone(options.state) : {query:'',page:1,pages:1,total:0,items:[],selected:null,mode:'follow',status:'idle',error:''};
      var generation = 0, request;
      if (typeof options.load !== 'function') throw new Error('Resources require a host load adapter.');
      var form = node('form', null, {class:'ody-data-toolbar'}), search = node('input', null, {type:'search',value:state.query,'aria-label':ui('Search resources'),placeholder:ui('Search resources…')}), submit = node('button',ui('Search'),{type:'submit'});
      form.append(search,submit);
      var modes = select([{value:'follow',label:ui('Follow current version')},{value:'pin',label:ui('Pin selected version')}], ui('Version policy')); modes.value = state.mode;
      var feedback = status(), list = node('div', null, {class:'ody-resource-list'}), errorNode = node('p','',{role:'alert',class:'ody-data-error'}), retry = button(ui('Retry source'),'retry');
      var pager = node('div', null, {class:'ody-data-toolbar'}), previous = button(ui('Previous'),'previous'), page = node('span'), next = button(ui('Next'),'next'), selection = node('p','',{class:'ody-resource-selection'});
      pager.append(previous,page,next); root.append(form,labelled(ui('Version policy'),modes),feedback,errorNode,retry,list,pager,selection);
      function render() {
        root.setAttribute('aria-busy', String(state.status === 'loading')); feedback.textContent = state.status === 'loading' ? ui('Loading source…') : state.status === 'ready' ? ui('{count} resources available',{count:state.total}) : '';
        errorNode.textContent = state.error; errorNode.hidden = !state.error; retry.hidden = !['error','permission','unavailable'].includes(state.status);
        list.replaceChildren();
        if (state.status === 'ready' && !state.items.length) list.append(node('p',ui('No matching resources. Change the search to try again.')));
        if (state.status === 'ready') state.items.forEach(function (item, index) {
          var row = button('', 'select'); row.dataset.resourceId = String(item.id); row.dataset.resourceIndex = index; row.append(node('strong',item.name),node('small',item.source + ' / ' + item.id + ' · version ' + item.version));
          row.setAttribute('aria-pressed',String(!!state.selected && state.selected.id === item.id && state.selected.source === item.source && state.selected.version === item.version)); list.append(row);
        });
        page.textContent = state.page + ' / ' + state.pages; previous.disabled = state.page <= 1 || state.status === 'loading'; next.disabled = state.page >= state.pages || state.status === 'loading';
        selection.textContent = state.selected ? ui(state.mode === 'pin' ? 'Pinned {identity}@{version}' : 'Following current: {identity} (last observed {version})',{identity:state.selected.source + '/' + state.selected.id,version:state.selected.version}) : ui('No resource selected');
        selection.dataset.mode = state.mode;
      }
      async function load() {
        if (request) request.abort(); request = new AbortController(); var id = ++generation; state.status = 'loading'; state.error = ''; render();
        try {
          var response = await options.load({query:state.query,page:state.page,signal:request.signal}); if (id !== generation) return;
          if (!response || !Array.isArray(response.items)) throw new Error('Source returned an invalid resource page.');
          state.items = response.items.map(function (item) { if (item.id === undefined || !item.source || item.version === undefined) throw new Error('Resource identity requires id, source and version.'); return clone(item); });
          if(!Number.isInteger(response.total)||response.total<0)throw new Error('Source total must be a non-negative integer.');
          state.total = Number(response.total); state.pages = Math.max(1, Number(response.pages) || 1); state.status = 'ready';
        } catch (failure) {
          if (id !== generation) return;
          state.items = []; state.status = failure.code === 'permission' ? 'permission' : failure.code === 'unavailable' ? 'unavailable' : 'error';
          state.error = (state.status === 'permission' ? ui('Permission denied. ') : state.status === 'unavailable' ? ui('Source unavailable. ') : ui('Source error. ')) + report(failure);
        }
        render(); life.emit('resources-state', state);
      }
      life.on(form,'submit',function(event){event.preventDefault();state.query=search.value;state.page=1;load();});
      life.on(retry,'click',load); life.on(previous,'click',function(){state.page--;load();}); life.on(next,'click',function(){state.page++;load();});
      life.on(modes,'change',function(){state.mode=modes.value;render();life.emit('resource-selection', {resource:state.selected,mode:state.mode});});
      life.on(list,'click',function(event){var row=event.target.closest('[data-resource-id]');if(!row)return;state.selected=clone(state.items[Number(row.dataset.resourceIndex)]);render();life.emit('resource-selection',{resource:state.selected,mode:state.mode}); if(options.onSelect) options.onSelect(clone({resource:state.selected,mode:state.mode}));});
      life.cleanup(function(){generation++;if(request)request.abort();root.removeAttribute('aria-busy');});
      load(); return {getState:function(){return clone(state);},reload:load,getSelection:function(){return clone({resource:state.selected,mode:state.mode});}};
    });
  }
  function mountVirtualList(root, options) {
    options = options || {};
    return mount(root, 'virtual', function (life, ui) {
      var items=options.items || [],mode=options.mode || 'list',columns=options.columns || [],estimate=options.estimatedHeight || 52,overscan=options.overscan || 4,heights=new Map(options.state&&options.state.mode===mode?options.state.measurements || []:[]),offsets=[],total=0,frame=0;
      if(!['list','table','tree'].includes(mode))throw new Error('Virtual mode must be list, table or tree.');
      if(mode==='table'&&!columns.length)throw new Error('Table mode requires columns.');
      var state=Object.assign({active:0,column:0,selected:[],scrollTop:0},clone(options.state || {})),id='ody-virtual-'+(++sequence);
      var viewport=node('div',null,{class:'ody-virtual-viewport',tabindex:0,role:mode==='table'?'grid':mode==='tree'?'tree':'listbox','aria-label':options.label || ui('Virtual collection'),'aria-multiselectable':'true'}),canvas=node('div',null,{class:'ody-virtual-canvas'}),feedback=status();
      viewport.dataset.mode=mode;viewport.style.height=(options.height || 340)+'px';
      var header;
      if(mode==='table'){
        viewport.setAttribute('aria-colcount',columns.length);
        header=node('div',null,{role:'row','aria-rowindex':1,class:'ody-virtual-header'});header.style.gridTemplateColumns='repeat('+columns.length+',minmax(0,1fr))';
        columns.forEach(function(column,index){header.append(node('div',column.label,{role:'columnheader','aria-colindex':index+1}));});viewport.append(header);
      }
      viewport.append(canvas);root.append(viewport,feedback);
      function recalculate(){offsets=[0];total=0;items.forEach(function(item){total+=heights.get(String(item.id)) || estimate;offsets.push(total);});canvas.style.height=total+'px';if(mode==='table')viewport.setAttribute('aria-rowcount',items.length+1);}
      function headerHeight(){return header?header.offsetHeight:0;}
      function indexAt(top){var low=0,high=items.length;while(low<high){var mid=(low+high)>>1;if(offsets[mid+1]<=top)low=mid+1;else high=mid;}return Math.min(low,Math.max(0,items.length-1));}
      function visibleRange(){var top=Math.max(0,viewport.scrollTop-headerHeight());return{start:Math.max(0,indexAt(top)-overscan),end:Math.min(items.length,indexAt(top+viewport.clientHeight)+overscan+1)};}
      var measurements=new Map(),measureFrame=0;
      var observer=typeof ResizeObserver==='function'?new ResizeObserver(function(entries){
        entries.forEach(function(entry){var height=entry.borderBoxSize&&entry.borderBoxSize[0]?entry.borderBoxSize[0].blockSize:entry.target.getBoundingClientRect().height;if(height>0)measurements.set(entry.target.dataset.key,height);});
        if(measureFrame)return;
        // Apply measured layout in the next frame, never mutate an observed layout in its delivery cycle.
        measureFrame=requestAnimationFrame(function(){measureFrame=0;var anchor=indexAt(Math.max(0,viewport.scrollTop-headerHeight())),before=offsets[anchor] || 0,changed=false;
          measurements.forEach(function(height,key){if(Math.abs((heights.get(key)||estimate)-height)>.5){heights.set(key,height);changed=true;}});measurements.clear();
          if(changed){recalculate();viewport.scrollTop+=(offsets[anchor] || 0)-before;render();}
        });
      }):null;
      function render(){
        var range=visibleRange(),indices=[];for(var i=range.start;i<range.end;i++)indices.push(i);
        if(items.length&&!indices.includes(state.active))indices.push(state.active);indices.sort(function(a,b){return a-b;});
        if(observer)observer.disconnect();canvas.replaceChildren();
        indices.forEach(function(index){
          var item=items[index],attrs={class:'ody-virtual-row',id:id+'-'+index,role:mode==='table'?'row':mode==='tree'?'treeitem':'option','aria-selected':String(state.selected.includes(String(item.id))),'data-index':index,'data-key':String(item.id),'data-active':String(index===state.active)},siblings;
          if(mode==='table')attrs['aria-rowindex']=index+2;
          else if(mode==='tree'){
            siblings=items.filter(function(candidate){return(candidate.parentId || '')===(item.parentId || '');});
            attrs['aria-level']=item.level || 1;attrs['aria-setsize']=item.setSize || siblings.length;attrs['aria-posinset']=item.posInSet || siblings.findIndex(function(candidate){return candidate.id===item.id;})+1;
            if(item.hasChildren)attrs['aria-expanded']=String(!!item.expanded);
          }else{attrs['aria-setsize']=items.length;attrs['aria-posinset']=index+1;}
          var row=node('div',null,attrs);row.style.transform='translateY('+offsets[index]+'px)';
          if(mode==='table'){
            row.style.display='grid';row.style.gridTemplateColumns='repeat('+columns.length+',minmax(0,1fr))';
            columns.forEach(function(column,columnIndex){var cell=node('div',null,{role:'gridcell','aria-colindex':columnIndex+1,'data-active-cell':String(index===state.active&&columnIndex===state.column),id:id+'-'+index+'-cell-'+columnIndex});if(column.render){var content=column.render(item,index);if(!(content instanceof Node))throw new Error('Column render must return a DOM Node.');cell.append(content);}else cell.textContent=String(item[column.key]===undefined?'':item[column.key]);row.append(cell);});
          }else{
            var content=options.renderItem?options.renderItem(item,index):node('span',item.label || item.name || item.id);
            if(!(content instanceof Node))throw new Error('renderItem must return a text-safe DOM Node.');row.append(content);
            if(mode==='tree'){row.style.paddingInlineStart=(12+((item.level || 1)-1)*18)+'px';if(item.hasChildren)row.prepend(node('span',item.expanded?'▾ ':'▸ ',{'aria-hidden':true}));}
          }
          canvas.append(row);if(observer)observer.observe(row);
        });
        if(items.length)viewport.setAttribute('aria-activedescendant',id+'-'+state.active+(mode==='table'?'-cell-'+state.column:''));else viewport.removeAttribute('aria-activedescendant');
        feedback.textContent=ui('{count} items · {selected} selected',{count:options.totalCount || items.length,selected:state.selected.length});state.scrollTop=viewport.scrollTop;
      }
      function locate(index){state.active=Math.max(0,Math.min(items.length-1,index));if(!items.length)return;var top=offsets[state.active]+headerHeight(),bottom=offsets[state.active+1]+headerHeight();
        if(top<viewport.scrollTop+headerHeight())viewport.scrollTop=top-headerHeight();else if(bottom>viewport.scrollTop+viewport.clientHeight)viewport.scrollTop=bottom-viewport.clientHeight;render();}
      function toggle(){if(!items.length)return;var key=String(items[state.active].id),index=state.selected.indexOf(key);if(index<0)state.selected.push(key);else state.selected.splice(index,1);render();life.emit('virtual-selection',state);}
      function toggleBranch(item,expanded){life.emit('virtual-toggle',{id:item.id,expanded:expanded});if(options.onToggle)options.onToggle(item,expanded);}
      life.on(viewport,'scroll',function(){if(frame)return;frame=requestAnimationFrame(function(){frame=0;render();});});
      life.on(viewport,'keydown',function(event){if(event.isComposing)return;var next=state.active,item=items[state.active];
        if(mode==='table'&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();state.column=Math.max(0,Math.min(columns.length-1,state.column+(event.key==='ArrowRight'?1:-1)));render();return;}
        if(mode==='tree'&&item&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
          event.preventDefault();if(event.key==='ArrowRight'){if(item.hasChildren&&!item.expanded)toggleBranch(item,true);else if(items[state.active+1]&&(items[state.active+1].level || 1)>(item.level || 1))locate(state.active+1);}
          else if(item.hasChildren&&item.expanded)toggleBranch(item,false);else{for(var parent=state.active-1;parent>=0;parent--){if((items[parent].level || 1)<(item.level || 1)){locate(parent);break;}}}return;
        }
        if(event.key==='ArrowDown')next++;else if(event.key==='ArrowUp')next--;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else if(event.key==='PageDown')next+=Math.max(1,Math.floor(viewport.clientHeight/estimate));else if(event.key==='PageUp')next-=Math.max(1,Math.floor(viewport.clientHeight/estimate));else if(event.key===' '||event.key==='Enter'){event.preventDefault();toggle();return;}else return;event.preventDefault();locate(next);
      });
      life.on(canvas,'click',function(event){var row=event.target.closest('[data-index]');if(!row)return;if(mode==='table'){var cell=event.target.closest('[role=gridcell]');if(cell)state.column=Number(cell.getAttribute('aria-colindex'))-1;}locate(Number(row.dataset.index));toggle();viewport.focus();});
      life.cleanup(function(){if(observer)observer.disconnect();if(frame)cancelAnimationFrame(frame);if(measureFrame)cancelAnimationFrame(measureFrame);});
      recalculate();if(state.activeId!==undefined){var restored=items.findIndex(function(item){return String(item.id)===String(state.activeId);});if(restored>=0)state.active=restored;}state.active=Math.max(0,Math.min(items.length-1,state.active));state.column=Math.max(0,Math.min(Math.max(0,columns.length-1),state.column));viewport.scrollTop=state.scrollTop;render();
      return{getState:function(){state.scrollTop=viewport.scrollTop;return clone(Object.assign({},state,{activeId:items[state.active]&&items[state.active].id,mode:mode,measurements:Array.from(heights.entries())}));},scrollToIndex:locate,setItems:function(next){var activeId=items[state.active]&&String(items[state.active].id);items=next;var found=items.findIndex(function(item){return String(item.id)===activeId;});state.active=found<0?Math.max(0,Math.min(state.active,items.length-1)):found;recalculate();render();},getMetrics:function(){return{total:options.totalCount || items.length,visibleItems:items.length,rendered:canvas.children.length,measured:heights.size,totalHeight:total,mode:mode};}};
    });
  }
  function mountPlot(root, options) {
    options=options || {};
    return mount(root,'plot',function(life,ui){
      if(options.type&&options.type!=='line'&&!options.adapter)throw new Error('Non-line plots require a host chart adapter.');
      if(!global.Odyssey || typeof global.Odyssey.describeChart!=='function')throw new Error('Plot requires Odyssey.describeChart (core 1.5 or newer).');
      var state=Object.assign({hidden:[]},clone(options.state || {})),series=options.series || [],chart=node('div',null,{class:'ody-analysis-chart'}),legend=node('div',null,{class:'ody-data-toolbar','aria-label':ui('Chart series')}),caption=node('p',options.name || ui('Analysis'),{class:'ody-data-caption'}),adapterCleanup;
      root.append(caption,legend,chart);
      function xValue(value){return options.xType==='time'?Date.parse(value):Number(value);}
      function render(){
        if(adapterCleanup){adapterCleanup();adapterCleanup=null;}chart.replaceChildren();legend.replaceChildren();
        series.forEach(function(item){var toggle=button(item.name,'legend');toggle.dataset.series=item.id;toggle.setAttribute('aria-pressed',String(!state.hidden.includes(item.id)));legend.append(toggle);});
        var active=series.filter(function(item){return !state.hidden.includes(item.id);}),points=active.flatMap(function(item){return item.values.filter(function(point){return point.y!==null&&Number.isFinite(Number(point.y))&&Number.isFinite(xValue(point.x));});});
        var x=active.flatMap(function(item){return item.values.map(function(point){return xValue(point.x);}).filter(Number.isFinite);}),y=points.map(function(point){return Number(point.y);}),domain=options.xDomain || [Math.min.apply(null,x),Math.max.apply(null,x)],range=options.yDomain || [Math.min.apply(null,[0].concat(y)),Math.max.apply(null,[0].concat(y))];
        if(!points.length){chart.append(node('p',ui('No values to plot. Enable a series or supply data.')));}
        else if(options.adapter){var result=options.adapter(chart,{type:options.type || 'line',series:clone(active),xType:options.xType || 'number',xDomain:domain,yDomain:range,xUnit:options.xUnit || '',yUnit:options.yUnit || ''});if(typeof result==='function')adapterCleanup=result;}
        else {
          var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 680 240');
          function svgNode(tag,attrs,text){var el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(function(pair){el.setAttribute(pair[0],pair[1]);});if(text!==undefined)el.textContent=text;svg.append(el);return el;}
          var dx=domain[1]-domain[0] || 1,dy=range[1]-range[0] || 1;
          function px(value){return 56+(xValue(value)-domain[0])/dx*600;}function py(value){return 202-(Number(value)-range[0])/dy*176;}
          [0,.5,1].forEach(function(t){var value=range[0]+t*dy,pos=202-t*176;svgNode('line',{x1:56,x2:656,y1:pos,y2:pos,class:'ody-plot-grid'});svgNode('text',{x:48,y:pos+4,'text-anchor':'end',class:'ody-plot-label'},Number(value.toFixed(2))+(options.yUnit?' '+options.yUnit:''));});
          function xLabel(value){return options.xType==='time'?new Date(value).toISOString().slice(0,10):String(value)+(options.xUnit?' '+options.xUnit:'');}
          svgNode('text',{x:56,y:228,class:'ody-plot-label'},xLabel(domain[0]));svgNode('text',{x:656,y:228,'text-anchor':'end',class:'ody-plot-label'},xLabel(domain[1]));
          active.forEach(function(item,index){var path='',continuing=false;item.values.forEach(function(point){if(point.y===null||!Number.isFinite(Number(point.y))||!Number.isFinite(xValue(point.x))){continuing=false;return;}path+=(continuing?' L':' M')+px(point.x)+' '+py(point.y);continuing=true;});svgNode('path',{d:path,fill:'none',class:'ody-plot-series','data-series':item.id,'data-color':series.indexOf(item)%4});});chart.append(svg);
        }
        var xs=Array.from(new Set(series.flatMap(function(item){return item.values.map(function(point){return String(point.x);});}))).sort(function(a,b){return xValue(a)-xValue(b);});
        var rows=xs.map(function(value){return [value].concat(series.map(function(item){var point=item.values.find(function(p){return String(p.x)===value;});return point&&point.y!==null?point.y:ui('No value');}));});
        global.Odyssey.describeChart(chart,{name:options.name || ui('Analysis'),summary:options.summary || ui('{count} series. Missing observations remain gaps; negative values are preserved.',{count:series.length}),columns:[options.xType==='time'?ui('Date'):'X'+(options.xUnit?' ('+options.xUnit+')':'')].concat(series.map(function(item){return item.name+(options.yUnit?' ('+options.yUnit+')':'');})),rows:rows,decorative:false});
      }
      life.on(legend,'click',function(event){var toggle=event.target.closest('[data-series]');if(!toggle)return;var id=toggle.dataset.series,index=state.hidden.indexOf(id);if(index<0)state.hidden.push(id);else state.hidden.splice(index,1);render();life.reveal(chart,event);legend.querySelector('[data-series="'+CSS.escape(id)+'"]').focus();life.emit('plot-change',state);});
      life.cleanup(function(){if(adapterCleanup)adapterCleanup();});render();
      return {getState:function(){return clone(state);},setSeries:function(next){series=clone(next);render();}};
    });
  }
  var constructors={filters:mountFilters,text:mountText,calendar:mountCalendar,resources:mountResources,virtual:mountVirtualList,plot:mountPlot};
  function init(root, options){root=root || document;var elements=Array.from(root.querySelectorAll('[data-ody-data-tools]'));if(root.matches&&root.matches('[data-ody-data-tools]'))elements.unshift(root);return elements.map(function(element){var kind=element.dataset.odyDataTools,settings=options&&options[element.id];if(!constructors[kind])throw new Error('Unknown data composition: '+kind);if(mounts.has(element))return mounts.get(element).api;return constructors[kind](element,settings || {});});}
  global.OdysseyDataTools={init:init,mountFilters:mountFilters,mountText:mountText,mountCalendar:mountCalendar,mountResources:mountResources,mountVirtualList:mountVirtualList,mountPlot:mountPlot};
}(window));
