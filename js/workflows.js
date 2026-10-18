/* Optional source-backed workflow controllers. Adapters own authentication, authority and durable receipts. */
(function (global) {
  'use strict';
  var mounted = new WeakMap();
  var serial = 0;
  var registeredI18n = null;
  var catalogs = {
    en: {idle:'Ready', queued:'Queued', running:'Running', uploading:'Uploading', cancelling:'Cancellation requested', cancelled:'Cancellation confirmed', success:'Source confirmed completion', error:'Could not complete the operation', offline:'Source offline. Refresh to check the original operation.', permission:'The source denied this operation.', 'unknown-result':'Result unknown. Check the original operation before retrying.', empty:'No work yet', missing:'Connect a host adapter to continue.', receipt:'The source did not return a completion receipt.', saving:'Saving…', saved:'Changes confirmed by the source', draft:'Draft saved', signin:'Sign in to continue', mfa:'Enter your verification code', recovery:'Request account recovery', 'recovery-sent':'Recovery request accepted', expired:'Your session expired. Sign in to return.', authenticated:'Signed in', invalid:'Check the highlighted field.', incomplete:'Complete every required step before submitting.', readonly:'Read-only access', cancel:'Cancel', retry:'Retry', refresh:'Refresh', progress:'Progress', invite:'Invitation accepted by the source',files:'files',complete:'complete',active:'active',skipped:'Skipped'},
    zh: {idle:'准备就绪', queued:'已排队', running:'执行中', uploading:'上传中', cancelling:'已请求取消', cancelled:'来源已确认取消', success:'来源已确认完成', error:'操作未完成', offline:'来源离线，请刷新核对原操作。', permission:'来源拒绝了此操作。', 'unknown-result':'结果未知，请先核对原操作再重试。', empty:'暂无任务', missing:'请连接宿主 adapter 后继续。', receipt:'来源未返回完成凭据。', saving:'保存中…', saved:'来源已确认保存', draft:'草稿已保存', signin:'登录后继续', mfa:'输入验证码', recovery:'请求恢复账户', 'recovery-sent':'已受理恢复请求', expired:'会话已过期，请登录后返回。', authenticated:'已登录', invalid:'请检查标记的字段。', incomplete:'提交前请完成所有必填步骤。', readonly:'只读权限', cancel:'取消', retry:'重试', refresh:'刷新', progress:'进度', invite:'来源已确认邀请',files:'个文件',complete:'已完成',active:'进行中',skipped:'已跳过'},
    ja: {idle:'準備完了', queued:'待機中', running:'実行中', uploading:'アップロード中', cancelling:'キャンセルを要求しました', cancelled:'キャンセルが確認されました', success:'完了が確認されました', error:'操作を完了できませんでした', offline:'接続できません。元の操作を再確認してください。', permission:'操作が拒否されました。', 'unknown-result':'結果が不明です。再試行する前に元の操作を確認してください。', empty:'タスクはありません', missing:'ホスト adapter を接続してください。', receipt:'完了レシートが返されませんでした。', saving:'保存中…', saved:'保存が確認されました', draft:'下書きを保存しました', signin:'ログインしてください', mfa:'確認コードを入力してください', recovery:'アカウントを復元', 'recovery-sent':'復元リクエストを受け付けました', expired:'セッションが終了しました。再ログインしてください。', authenticated:'ログインしました', invalid:'入力内容を確認してください。', incomplete:'必須ステップを完了してください。', readonly:'読み取り専用', cancel:'キャンセル', retry:'再試行', refresh:'再確認', progress:'進捗', invite:'招待が確認されました',files:'ファイル',complete:'完了',active:'進行中',skipped:'スキップ済み'}
  };
  function translate(root, options, key) {
    if (options.messages && options.messages[key]) return options.messages[key];
    var i18n = global.Odyssey && global.Odyssey.i18n;
    if (i18n) {
      if (registeredI18n !== i18n) {
        Object.keys(catalogs).forEach(function (locale) { var entries = {}; Object.keys(catalogs[locale]).forEach(function (name) { entries['workflow.' + name] = catalogs[locale][name]; }); i18n.register(locale, entries); });
        registeredI18n = i18n;
      }
      return i18n.t('workflow.' + key, {}, root);
    }
    var lang = ((root.closest('[lang]') || document.documentElement).lang || 'en').toLowerCase().split('-')[0];
    return (catalogs[lang] || catalogs.en)[key] || key;
  }
  function slot(root, name, optional) {
    var node = root.querySelector('[data-ody-wf-' + name + ']');
    if (!node && !optional) throw new Error('Workflow requires data-ody-wf-' + name);
    return node;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function event(root, name, detail) { root.dispatchEvent(new CustomEvent('ody:workflow-' + name, {bubbles:true, detail:detail})); }
  function context(root, kind, options, setup) {
    var existing = mounted.get(root);
    if (existing) return existing;
    if (!root || root.nodeType !== 1) throw new Error('Mount a workflow on an element.');
    options = options || {};
    var abort = new AbortController(), requests = new Set(), generation = 0, destroyed = false;
    var status = slot(root, 'status'), error = slot(root, 'error');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    error.setAttribute('role', 'alert'); error.tabIndex = -1;
    var originalBusy = root.getAttribute('aria-busy'), composing = false;
    root.addEventListener('compositionstart',function () { composing=true; },{signal:abort.signal});
    root.addEventListener('compositionend',function () { composing=false; },{signal:abort.signal});
    root.addEventListener('keydown',function (event) { if (event.key==='Enter' && (composing || event.isComposing || event.keyCode===229)) event.preventDefault(); },{signal:abort.signal});
    var cleanups = [];
    var api = {
      root:root, options:options, active:function () { return !destroyed; }, composing:function () { return composing; },
      t:function (key) { return translate(root, options, key); },
      listen:function (node, type, callback) { node.addEventListener(type, callback, {signal:abort.signal}); },
      feedback:function (state, message, failed) {
        root.dataset.odyWorkflowState = state;
        status.textContent = failed ? '' : message || api.t(state);
        error.textContent = failed ? message || api.t(state) : '';
        error.hidden = !failed;
      },
      busy:function (value) { root.setAttribute('aria-busy', String(value)); },
      request:async function (method, payload, update) {
        var adapter = options.adapter || {}, fn = adapter[method];
        if (typeof fn !== 'function') throw new Error(api.t('missing'));
        var request = ++generation, controller = new AbortController(); requests.add(controller);
        try {
          var result = await fn(payload, {root:root, signal:controller.signal, onUpdate:function (snapshot) { if (!destroyed && request === generation && update) update(snapshot); }});
          return !destroyed && request === generation ? {value:result} : null;
        } finally { requests.delete(controller); }
      },
      invalidate:function () { generation++; requests.forEach(function (request) { request.abort(); }); requests.clear(); },
      cleanup:function (fn) { cleanups.push(fn); },
      emit:function (detail) { event(root, kind, detail); },
      destroy:function () {
        if (destroyed) return;
        destroyed = true; api.invalidate(); abort.abort(); cleanups.forEach(function (fn) { fn(); });
        if (originalBusy === null) root.removeAttribute('aria-busy'); else root.setAttribute('aria-busy', originalBusy);
        mounted.delete(root);
      }
    };
    var controller;
    try { controller=setup(api); } catch (error) { api.destroy(); throw error; }
    controller.destroy = api.destroy;
    mounted.set(root, controller);
    return controller;
  }
  var taskStates = ['idle','empty','queued','running','uploading','cancelling','cancelled','success','error','offline','permission','unknown-result'];
  function confirmed(snapshot) { return snapshot && snapshot.receipt && typeof snapshot.receipt.id === 'string' && snapshot.receipt.id.length > 0; }
  function taskSnapshot(snapshot, previous, establishIdentity) {
    if (!snapshot || !taskStates.includes(snapshot.state)) throw new Error('Adapter must return a workflow state.');
    if (!establishIdentity && ((previous.operationId != null && snapshot.operationId !== previous.operationId) || (previous.operationId == null && snapshot.operationId != null))) {
      throw new Error('Workflow snapshot must match the current operationId.');
    }
    var next = Object.assign({}, previous, snapshot);
    if (snapshot.message === undefined) delete next.message;
    if (snapshot.state !== 'success') delete next.receipt;
    if (snapshot.progress === undefined) delete next.progress;
    if (snapshot.state === 'success' && !confirmed(snapshot)) throw new Error('The source did not return a completion receipt.');
    if (['queued','running','uploading','cancelling','cancelled','success','unknown-result'].includes(next.state) && !next.operationId) throw new Error('Source state requires its operationId.');
    if (snapshot.progress !== undefined && (!Number.isFinite(snapshot.progress) || snapshot.progress < 0 || snapshot.progress > 100)) throw new Error('Source progress must be between 0 and 100.');
    return next;
  }
  function mountTask(root, options) {
    return context(root, 'task', options, function (ctx) {
      var state = {state:'idle', operationId:null}, pending = false, requestSerial = 0, establishingIdentity = false;
      var start = slot(root, 'start'), cancel = slot(root, 'cancel'), retry = slot(root, 'retry'), refresh = slot(root, 'refresh');
      var progress = slot(root, 'progress'), result = slot(root, 'receipt');
      function render() {
        if (!ctx.active()) return;
        var active = ['queued','running','uploading','cancelling'].includes(state.state);
        start.disabled = pending || active || state.state === 'unknown-result' || (state.state === 'offline' && !!state.operationId);
        cancel.disabled = !['queued','running','uploading'].includes(state.state);
        retry.disabled = pending || !['error','cancelled'].includes(state.state);
        refresh.disabled = pending || !state.operationId;
        progress.hidden = !active;
        if (state.progress === undefined) progress.removeAttribute('value'); else progress.value = state.progress;
        result.textContent = state.receipt ? state.receipt.id : '';
        result.hidden = !state.receipt;
        ctx.busy(pending && state.state==='idle');
        ctx.feedback(state.state, pending && state.state==='idle' ? ctx.t('saving') : state.message, ['error','offline','permission','unknown-result'].includes(state.state));
        ctx.emit(clone(state));
      }
      function update(snapshot) { if (establishingIdentity) throw new Error('Wait for the source to establish the new operationId.'); state=taskSnapshot(snapshot,state,false); render(); }
      async function run(method) {
        if (method==='start' && (['queued','running','uploading','cancelling','unknown-result'].includes(state.state) || (state.state==='offline' && state.operationId))) return;
        if (method==='cancel' && !['queued','running','uploading'].includes(state.state)) return;
        if (method==='retry' && !['error','cancelled'].includes(state.state)) return;
        if (method==='refresh' && !state.operationId) return;
        if (pending && method !== 'cancel') return;
        var request = ++requestSerial, allowIdentity = method==='start' || method==='retry';
        establishingIdentity = allowIdentity;
        function accept(snapshot) { state=taskSnapshot(snapshot,state,allowIdentity); if (snapshot.operationId != null) { allowIdentity=false; establishingIdentity=false; } render(); }
        if (method === 'cancel') ctx.invalidate();
        pending = true;
        if (method === 'start') state = {state:'idle',operationId:null};
        if (method === 'cancel') state = Object.assign({}, state, {state:'cancelling'});
        render();
        try {
          var next = await ctx.request(method, clone(state), accept);
          if (next) accept(next.value);
        } catch (error) {
          if (request !== requestSerial || !ctx.active()) return;
          state = Object.assign({}, state, {state:method === 'start' && !state.operationId ? 'error' : 'unknown-result', message:error.message});
        } finally { if (request === requestSerial) { pending = false; establishingIdentity=false; render(); } }
      }
      ctx.listen(start, 'click', function () { run('start'); });
      ctx.listen(cancel, 'click', function () { run('cancel'); });
      ctx.listen(retry, 'click', function () { run('retry'); });
      ctx.listen(refresh, 'click', function () { run('refresh'); });
      render();
      return {getState:function () { return clone(state); }, update:update, start:function () { return run('start'); }, cancel:function () { return run('cancel'); }, retry:function () { return run('retry'); }, refresh:function () { return run('refresh'); }};
    });
  }
  function mountAuth(root, options) {
    return context(root, 'auth', options, function (ctx) {
      var state = {state:'signin', challengeId:null, returnTo:ctx.options.returnTo || null}, pending = false, requestSerial = 0;
      var forms = Array.from(root.querySelectorAll('form[data-ody-auth-stage]'));
      var initialDisabled = new Map(Array.from(root.querySelectorAll('button,input')).map(function (node) { return [node,node.disabled]; }));
      function render() {
        if (!ctx.active()) return;
        forms.forEach(function (form) { form.hidden = form.dataset.odyAuthStage !== (['signin','mfa','recovery'].includes(state.state) ? state.state : state.state === 'expired' ? 'signin' : ''); });
        root.querySelectorAll('button,input').forEach(function (node) { node.disabled = pending || initialDisabled.get(node); });
        ctx.busy(pending); ctx.feedback(state.state, pending ? ctx.t('saving') : state.message, !!state.error);
        ctx.emit({state:state.state, returnTo:state.returnTo, challengeId:state.challengeId});
      }
      function move(next, focus) {
        state = Object.assign({}, state, next, {error:false});
        if (['signin','recovery'].includes(state.state)) state.challengeId=null;
        render();
        if (focus) { var first = root.querySelector('form:not([hidden]) input:not([type="hidden"])'); if (first) first.focus(); }
      }
      async function submit(form) {
        if (pending || ctx.composing() || !form.reportValidity()) return;
        var method = form.dataset.odyAuthStage === 'signin' ? 'signIn' : form.dataset.odyAuthStage === 'mfa' ? 'verify' : 'recover';
        var request=++requestSerial;
        var payload = Object.fromEntries(new FormData(form));
        payload.challengeId = state.challengeId; payload.returnTo = state.returnTo;
        state.error=false; state.message=null; pending = true; render();
        try {
          var next = await ctx.request(method, payload);
          if (next) {
            next=next.value;
            if (!next || !['mfa','authenticated','recovery-sent'].includes(next.state)) throw new Error('Authentication adapter returned an unsupported state.');
            if (next.state === 'mfa' && !next.challengeId) throw new Error('MFA requires a source challengeId.');
            form.querySelectorAll('input[type="password"]').forEach(function (input) { input.value = ''; });
            move(next, true);
          }
        } catch (error) { if (request===requestSerial && ctx.active()) { state.error = true; state.message = error.message; } }
        finally { if (request!==requestSerial) return; pending = false; render(); if (ctx.active() && (root.contains(document.activeElement) || document.activeElement===document.body)) { if (state.error) slot(root,'error').focus(); else { var first=root.querySelector('form:not([hidden]) input:not([type="hidden"])'); if (first) first.focus(); } } }
      }
      forms.forEach(function (form) { ctx.listen(form, 'submit', function (event) { event.preventDefault(); submit(form); }); });
      root.querySelectorAll('[data-ody-auth-go]').forEach(function (button) { ctx.listen(button, 'click', function () { if (!pending) move({state:button.dataset.odyAuthGo, message:null}, true); }); });
      ctx.cleanup(function () { initialDisabled.forEach(function (disabled,node) { node.disabled = disabled; }); });
      render();
      return {getState:function () { return {state:state.state, challengeId:state.challengeId, returnTo:state.returnTo}; }, expire:function (returnTo) { requestSerial++; ctx.invalidate(); pending = false; forms.forEach(function (form) { form.querySelectorAll('input[type="password"]').forEach(function (input) { input.value=''; }); }); move({state:'expired', returnTo:returnTo || state.returnTo, challengeId:null, message:null}, true); }};
    });
  }
  function mountWizard(root, options) {
    return context(root, 'wizard', options, function (ctx) {
      var form = root.tagName === 'FORM' ? root : root.querySelector('form');
      if (!form) throw new Error('Wizard requires a native form.');
      var steps = Array.from(form.querySelectorAll('fieldset[data-ody-step]'));
      var current = 0, completed = new Set(), skipped = new Set(), pending = false, finished = false;
      var previous = slot(root,'previous'), next = slot(root,'next'), skip = slot(root,'skip'), submit = slot(root,'submit'), draft = slot(root,'draft');
      var fieldNames = ctx.options.fields || Array.from(form.elements).filter(function (input) { return input.name && !['hidden','password','file','submit','button'].includes(input.type); }).map(function (input) { return input.name; });
      var fields = Array.from(form.elements).filter(function (input) { return input.name && !['hidden','password','file','submit','button'].includes(input.type); });
      function values() {
        var value = {};
        fieldNames.forEach(function (name) {
          var entries = [];
          fields.filter(function (input) { return input.name===name; }).forEach(function (input) {
            if (['checkbox','radio'].includes(input.type) && !input.checked) return;
            if (input.tagName==='SELECT' && input.multiple) Array.from(input.selectedOptions).forEach(function (option) { entries.push(option.value); });
            else entries.push(input.value);
          });
          value[name] = entries.length > 1 ? entries : entries[0] || '';
        });
        return value;
      }
      function snapshot() { return {step:current, completed:Array.from(completed), skipped:Array.from(skipped), values:values(), finished:finished}; }
      function render(message, failed) {
        if (!ctx.active()) return;
        steps.forEach(function (step,index) { step.hidden = current !== index; step.disabled = pending || finished; });
        root.querySelectorAll('[data-ody-step-index]').forEach(function (node,index) { node.setAttribute('aria-current',index === current ? 'step' : 'false'); node.classList.toggle('is-active',index===current); node.classList.toggle('is-done',completed.has(index)); var dot=node.querySelector('.ody-step__dot'); if (dot) dot.textContent=completed.has(index)?'✓':String(index+1).padStart(2,'0'); node.dataset.state = index === current ? 'current' : completed.has(index) ? 'complete' : skipped.has(index) ? 'skipped' : 'upcoming'; var mark=node.querySelector('[data-ody-step-state]'); if (!mark) { mark=document.createElement('small'); mark.dataset.odyStepState=''; node.append(mark); } mark.hidden=!completed.has(index) && !skipped.has(index); mark.textContent=completed.has(index)?ctx.t('complete'):skipped.has(index)?ctx.t('skipped'):''; });
        previous.disabled = pending || finished || current === 0; next.hidden = current === steps.length - 1; next.disabled = pending || finished;
        skip.hidden = steps[current].dataset.optional !== 'true'; skip.disabled = pending || finished;
        submit.hidden = current !== steps.length - 1; submit.disabled = pending || finished;
        draft.disabled = pending || finished || typeof (ctx.options.adapter || {}).saveDraft !== 'function';
        ctx.busy(pending); ctx.feedback(finished ? 'success' : pending ? 'saving' : 'idle', message, failed);
        ctx.emit(snapshot());
      }
      function focusStep() { var legend = steps[current].querySelector('legend'); if (legend) { legend.tabIndex = -1; legend.focus(); } }
      function valid(index) {
        var invalid = Array.from(steps[index].elements).find(function (input) { return input.willValidate && !input.checkValidity(); });
        var errors = ctx.options.validate ? ctx.options.validate(index, values()) : {};
        var key = Object.keys(errors || {})[0];
        if (!invalid && key) invalid = Array.from(steps[index].elements).find(function (input) { return input.name === key; });
        if (invalid || key) { current = index; render(key ? errors[key] : ctx.t('invalid'), true); if (invalid) { invalid.focus(); invalid.reportValidity(); } return false; }
        return true;
      }
      function advance(optional) {
        if (pending || finished || (!optional && !valid(current))) return;
        if (optional && steps[current].dataset.optional !== 'true') return;
        if (optional) skipped.add(current); else { completed.add(current); skipped.delete(current); }
        if (current < steps.length - 1) current++;
        render(); focusStep();
      }
      ctx.listen(previous,'click',function () { if (!pending && current > 0) { current--; render(); focusStep(); } });
      ctx.listen(next,'click',function () { advance(false); }); ctx.listen(skip,'click',function () { advance(true); });
      ctx.listen(form,'input',function () { completed.delete(current); finished = false; render(); });
      ctx.listen(form,'submit',async function (event) {
        event.preventDefault(); if (pending || finished || ctx.composing()) return;
        if (current < steps.length - 1) { advance(false); return; }
        for (var index=0; index<steps.length; index++) if (!skipped.has(index) && !valid(index)) return;
        var payload = snapshot(); pending = true; render();
        try { var result = await ctx.request('submit',payload); if (result) { if (!confirmed(result.value)) throw new Error(ctx.t('receipt')); finished = true; } }
        catch (error) { render(error.message,true); pending = false; render(error.message,true); return; }
        finally { pending = false; }
        render();
      });
      ctx.listen(draft,'click',async function () {
        if (pending) return; var payload = snapshot(); pending = true; render();
        try { var result = await ctx.request('saveDraft',payload); pending = false; if (result) render(ctx.t('draft')); }
        catch (error) { pending = false; render(error.message,true); }
      });
      render();
      return {getState:snapshot, restore:function (value) {
        if (pending) throw new Error('Wait for the pending request before restoring a draft.');
        fields.forEach(function (input) { if (!fieldNames.includes(input.name) || !value.values || value.values[input.name] === undefined) return; var saved=value.values[input.name], entries=Array.isArray(saved)?saved:[saved]; if (['checkbox','radio'].includes(input.type)) input.checked=entries.includes(input.value); else if (input.tagName==='SELECT' && input.multiple) Array.from(input.options).forEach(function (option) { option.selected=entries.includes(option.value); }); else input.value=saved; });
        current = Math.max(0,Math.min(steps.length-1,Number(value.step)||0)); completed = new Set(); skipped = new Set(); finished = false; render();
      }};
    });
  }
  function mountQueue(root, options) {
    return context(root,'queue',options,function (ctx) {
      var input = slot(root,'files'), list = slot(root,'list'), tasks = new Map();
      function render() {
        if (!ctx.active()) return;
        var focused=list.contains(document.activeElement) && document.activeElement.closest('[data-task-id]');
        var focusId=focused && focused.dataset.taskId, focusAction=focused && focused.dataset.queueAction;
        list.replaceChildren();
        tasks.forEach(function (task) {
          var row = document.createElement('li'); row.className = 'ody-workflow__file'; row.dataset.taskId=task.id;
          var name = document.createElement('strong'); name.textContent=task.file.name; row.append(name);
          var detail = document.createElement('span'); detail.textContent=task.message || ctx.t(task.state); row.append(detail);
          if (['queued','uploading','running','cancelling'].includes(task.state)) { var progress=document.createElement('progress'); progress.max=100; progress.setAttribute('aria-label',task.file.name+' '+ctx.t('progress')); if (task.progress !== undefined) progress.value=task.progress; row.append(progress); }
          ['cancel','retry','refresh'].forEach(function (action) {
            var allowed = action==='cancel' ? ['queued','uploading','running'].includes(task.state) : action==='retry' ? ['error','cancelled'].includes(task.state) : ['unknown-result','offline'].includes(task.state);
            if (!allowed) return;
            var button=document.createElement('button'); button.type='button'; button.textContent=ctx.t(action); button.dataset.queueAction=action; button.dataset.taskId=task.id; button.disabled=task.pending && action !== 'cancel'; row.append(button);
          });
          list.append(row);
        });
        if (focusId) { var row=list.querySelector('[data-task-id="'+focusId+'"]'), target=row && focusAction && row.querySelector('[data-queue-action="'+focusAction+'"]'); if (row) { row.tabIndex=-1; (target || row).focus({preventScroll:true}); } }
        var all=Array.from(tasks.values()), done=all.filter(function (task) { return task.state==='success'; }).length, active=all.filter(function (task) { return ['queued','running','uploading','cancelling'].includes(task.state); }).length;
        ctx.feedback(tasks.size?'idle':'empty',tasks.size ? tasks.size+' '+ctx.t('files')+' · '+done+' '+ctx.t('complete')+' · '+active+' '+ctx.t('active') : undefined); ctx.emit(getState());
      }
      function getState() { return Array.from(tasks.values()).map(function (task) { return {id:task.id,name:task.file.name,state:task.state,operationId:task.operationId,attempt:task.attempt,progress:task.progress}; }); }
      async function run(task, method) {
        if (method==='cancel' && !['queued','uploading','running'].includes(task.state)) return;
        if (method==='retry' && !['error','cancelled'].includes(task.state)) return;
        if (task.pending && method !== 'cancel') return;
        if (method === 'cancel' && task.abort) task.abort.abort();
        var adapter=ctx.options.adapter || {}, fn=adapter[method];
        if (typeof fn!=='function') { task.state='error'; task.message=ctx.t('missing'); render(); return; }
        task.pending=true; var generation=++task.generation, controller=new AbortController(), allowIdentity=method==='start' || method==='retry'; task.establishingIdentity=allowIdentity; task.abort=controller;
        if (method==='cancel') task.state='cancelling';
        if (method==='retry') { task.attempt++; delete task.progress; delete task.receipt; }
        render();
        function apply(next) { if (task.generation!==generation || !tasks.has(task.id)) return; var state=taskSnapshot(next,task,allowIdentity); Object.assign(task,state); if (next.operationId != null) { allowIdentity=false; task.establishingIdentity=false; } render(); }
        try {
          var result=await fn({file:task.file, id:task.id, operationId:task.operationId, attempt:task.attempt}, {root:root,signal:controller.signal,onUpdate:apply});
          if (task.generation===generation && tasks.has(task.id)) apply(result);
        } catch (error) { if (task.generation===generation && tasks.has(task.id)) { task.state=task.operationId?'unknown-result':'error'; task.message=error.message; } }
        finally { if (task.generation===generation && tasks.has(task.id)) { task.pending=false; task.establishingIdentity=false; render(); } }
      }
      function add(files) {
        Array.from(files).forEach(function (file) { var id='ody-file-'+(++serial); var task={id:id,file:file,state:'idle',operationId:null,attempt:1,generation:0,pending:false}; tasks.set(id,task); run(task,'start'); }); render();
      }
      ctx.listen(input,'change',function () { add(input.files); input.value=''; });
      ctx.listen(list,'click',function (event) { var button=event.target.closest('[data-queue-action]'); if (button && tasks.has(button.dataset.taskId)) run(tasks.get(button.dataset.taskId),button.dataset.queueAction); });
      ctx.cleanup(function () { tasks.forEach(function (task) { task.generation++; if (task.abort) task.abort.abort(); }); tasks.clear(); });
      render(); return {getState:getState,add:add,update:function (id,next) { var task=tasks.get(id); if (!task) throw new Error('Unknown file task.'); if (task.establishingIdentity) throw new Error('Wait for the source to establish the new operationId.'); Object.assign(task,taskSnapshot(next,task,false)); render(); }};
    });
  }
  function mountAccess(root, options) {
    return context(root,'access',options,function (ctx) {
      var form=slot(root,'preferences'), invite=slot(root,'invite'), members=slot(root,'members'), matrix=slot(root,'matrix');
      var state={canManage:false,members:[],roles:[],preferences:{channel:'email',frequency:'daily'}}, pending=false, requestSerial=0;
      var originalDisabled=new Map(Array.from(root.querySelectorAll('input,select,button')).map(function (node) { return [node,node.disabled]; }));
      function setPreferences(value) { Object.keys(value).forEach(function (key) { var input=form.elements.namedItem(key); if (input) input.value=value[key]; }); }
      function render(message,failed) {
        if (!ctx.active()) return;
        members.replaceChildren(); state.members.forEach(function (member) { var row=document.createElement('li'), label=document.createElement('strong'), role=document.createElement('span'); label.textContent=member.name; role.textContent=member.role+' · '+member.state; row.append(label,role); members.append(row); });
        matrix.replaceChildren(); state.roles.forEach(function (role) { var row=document.createElement('tr'); [role.name,role.permissions.join(', ')].forEach(function (text) { var cell=document.createElement('td'); cell.textContent=text; row.append(cell); }); matrix.append(row); });
        root.querySelectorAll('input,select,button').forEach(function (node) { node.disabled=pending || !state.canManage || originalDisabled.get(node); });
        ctx.busy(pending); ctx.feedback(pending?'saving':state.canManage?'idle':'readonly',message,failed); ctx.emit(clone(state));
      }
      function apply(next) { if (!next || typeof next.canManage!=='boolean' || !Array.isArray(next.members) || !Array.isArray(next.roles)) throw new Error('Access adapter requires source permissions, members and roles.'); state=clone(next); setPreferences(state.preferences); render(); }
      async function request(method,payload) {
        if (pending) return; var request=++requestSerial; pending=true; render();
        try { var next=await ctx.request(method,payload); if (next) { if (!confirmed(next.value)) throw new Error(ctx.t('receipt')); pending=false; apply(next.value); render(ctx.t(method==='invite'?'invite':'saved')); } }
        catch (error) { if (request===requestSerial) { pending=false; render(error.message,true); } }
        finally { if (request===requestSerial) pending=false; }
      }
      ctx.listen(form,'submit',function (event) { event.preventDefault(); if (state.canManage && form.reportValidity()) request('savePreferences',{preferences:Object.fromEntries(new FormData(form))}); });
      ctx.listen(invite,'submit',function (event) { event.preventDefault(); if (state.canManage && invite.reportValidity()) request('invite',Object.fromEntries(new FormData(invite))); });
      ctx.listen(slot(root,'restore'),'click',function () { if (!pending) { setPreferences(state.preferences); render(); } });
      ctx.cleanup(function () { originalDisabled.forEach(function (disabled,node) { node.disabled=disabled; }); });
      if (ctx.options.value) apply(ctx.options.value); else render();
      return {getState:function () { return clone(state); },update:function (next) { requestSerial++; ctx.invalidate(); pending=false; apply(next); }, refresh:async function () { if (pending) return; var request=++requestSerial; pending=true; render(); try { var next=await ctx.request('load',{}); if (request!==requestSerial) return; pending=false; if (next) apply(next.value); else render(); } catch (error) { if (request===requestSerial) { pending=false; render(error.message,true); } } }};
    });
  }
  var mounts={task:mountTask,auth:mountAuth,wizard:mountWizard,queue:mountQueue,access:mountAccess};
  function init(root,options) {
    root=root || document; options=options || {};
    var nodes=root.matches && root.matches('[data-ody-workflow]') ? [root] : [];
    nodes=nodes.concat(Array.from(root.querySelectorAll('[data-ody-workflow]')));
    return nodes.map(function (node) { var mount=mounts[node.dataset.odyWorkflow]; if (!mount) throw new Error('Unknown workflow kind.'); return mount(node,options[node.dataset.odyWorkflow]); });
  }
  global.OdysseyWorkflows={init:init,mountTask:mountTask,mountAuth:mountAuth,mountWizard:mountWizard,mountQueue:mountQueue,mountAccess:mountAccess};
}(window));
