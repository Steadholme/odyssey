/* Explicit in-memory source fixtures. No network, timers, credentials or durable-service claim. */
(function (global) {
  'use strict';
  var mounts = new WeakMap();
  function mount(scope) {
    scope = scope || document;
    if (mounts.has(scope)) return mounts.get(scope);
    var controllers = {}, next = 0, taskSource = null, queueSources = new Map(), savedDraft = null;
    function find(selector) { return scope.querySelector(selector); }
    function rejected(id) { var input=find('#'+id); return input && input.checked; }
    function receipt(name) { return {id:'example-'+name+'-'+(++next)}; }
    var task = find('#task-workflow');
    if (task) {
      var taskAdapter = {
        start:function () { taskSource={state:'queued',operationId:'example-export-'+(++next)}; return Promise.resolve(taskSource); },
        cancel:function (state) { taskSource={state:'cancelling',operationId:state.operationId}; return Promise.resolve(taskSource); },
        refresh:function () { return Promise.resolve(taskSource); },
        retry:function (state) { taskSource={state:'queued',operationId:state.operationId,attemptId:'attempt-'+(++next)}; return Promise.resolve(taskSource); }
      };
      controllers.task=global.OdysseyWorkflows.mountTask(task,{adapter:taskAdapter});
      scope.querySelectorAll('[data-task-source]').forEach(function (button) { button.addEventListener('click',function () {
        var current=controllers.task.getState(); if (!current.operationId) return;
        var state=button.dataset.taskSource;
        if (state==='cancelled' && current.state!=='cancelling') return;
        taskSource={state:state,operationId:current.operationId};
        if (state==='running') taskSource.progress=36;
        if (state==='success') taskSource.receipt=receipt('export');
        controllers.task.update(taskSource);
      }); });
    }
    var auth=find('#auth-workflow');
    if (auth) {
      controllers.auth=global.OdysseyWorkflows.mountAuth(auth,{returnTo:'/workflows.html#auth-title',adapter:{
        signIn:function () { if (rejected('auth-deny')) return Promise.reject(new Error('Example source: sign-in denied. Check your credentials and try again.')); return Promise.resolve({state:'mfa',challengeId:'example-challenge-'+(++next)}); },
        verify:function (value) { return value.verification_code==='482931' ? Promise.resolve({state:'authenticated',user:{name:'Ellis'}}) : Promise.reject(new Error('That verification code was not accepted. Try 482931.')); },
        recover:function () { return Promise.resolve({state:'recovery-sent'}); }
      }});
      find('#expire-session').addEventListener('click',function () { controllers.auth.expire('/workflows.html#auth-title'); });
      auth.addEventListener('ody:workflow-auth',function (event) { find('[data-auth-again]').hidden=!['authenticated','recovery-sent'].includes(event.detail.state); });
    }
    var wizard=find('#wizard-workflow');
    if (wizard) {
      controllers.wizard=global.OdysseyWorkflows.mountWizard(wizard,{fields:['workspace','focus','contact'],adapter:{
        saveDraft:function (value) { savedDraft=JSON.parse(JSON.stringify(value)); return Promise.resolve({id:'example-draft'}); },
        submit:function (value) { if (!value.values.workspace || !value.values.contact) return Promise.reject(new Error('Example source: workspace and contact are required.')); if (rejected('wizard-fail')) return Promise.reject(new Error('Example source: workspace creation failed. Your answers are retained.')); return Promise.resolve({receipt:receipt('workspace'),workspace:value.values.workspace}); }
      }});
      find('#restore-draft').addEventListener('click',function () { if (savedDraft) controllers.wizard.restore(savedDraft); });
    }
    var queue=find('#queue-workflow');
    if (queue) {
      function queueRequest(value,state) { var nextState={state:state,operationId:queueSources.has(value.id)?queueSources.get(value.id).operationId:'example-upload-'+(++next)}; queueSources.set(value.id,nextState); return Promise.resolve(nextState); }
      controllers.queue=global.OdysseyWorkflows.mountQueue(queue,{adapter:{start:function (value) { return queueRequest(value,'queued'); },cancel:function (value) { return queueRequest(value,'cancelling'); },retry:function (value) { return queueRequest(value,'queued'); },refresh:function (value) { return Promise.resolve(queueSources.get(value.id)); }}});
      scope.querySelectorAll('[data-queue-source]').forEach(function (button) { button.addEventListener('click',function () {
        controllers.queue.getState().forEach(function (item) {
          if (!['queued','uploading','running','cancelling'].includes(item.state)) return;
          var state=button.dataset.queueSource;
          if (state==='cancelled' && item.state!=='cancelling') return;
          var nextState={state:state,operationId:item.operationId};
          if (state==='uploading') nextState.progress=58;
          if (state==='success') nextState.receipt=receipt('upload');
          queueSources.set(item.id,nextState); controllers.queue.update(item.id,nextState);
        });
      }); });
    }
    var access=find('#access-workflow');
    if (access) {
      var source={canManage:true,members:[{name:'Ellis Chen',role:'owner',state:'active'},{name:'Jordan Lee',role:'editor',state:'active'}],roles:[{name:'Owner',permissions:['Manage members','Edit','Read']},{name:'Editor',permissions:['Edit','Read']},{name:'Viewer',permissions:['Read']}],preferences:{channel:'email',frequency:'daily'}};
      function copy() { return JSON.parse(JSON.stringify(source)); }
      function authorize() { if (!source.canManage || rejected('access-deny')) throw new Error('The example source denied this change. Your unsaved values remain available.'); }
      controllers.access=global.OdysseyWorkflows.mountAccess(access,{value:copy(),adapter:{
        load:function () { return Promise.resolve(copy()); },
        savePreferences:function (value) { authorize(); source.preferences=value.preferences; return Promise.resolve(Object.assign(copy(),{receipt:receipt('preferences')})); },
        invite:function (value) { authorize(); if (source.members.some(function (member) { return member.name===value.email; })) return Promise.reject(new Error('This member already has an invitation or workspace access.')); source.members.push({name:value.email,role:value.role,state:'invited'}); return Promise.resolve(Object.assign(copy(),{receipt:receipt('invite')})); }
      }});
      find('#access-readonly').addEventListener('click',function () { source.canManage=!source.canManage; controllers.access.update(copy()); });
    }
    mounts.set(scope,controllers); return controllers;
  }
  global.OdysseyWorkflowExamples={mount:mount};
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',function () { if (document.querySelector('[data-ody-workflows-example]')) mount(document); });
  else if (document.querySelector('[data-ody-workflows-example]')) mount(document);
}(window));
