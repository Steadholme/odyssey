import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
const playwright=await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const engines=(process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map(value=>value.trim());
assert.ok(engines.length && engines.every(value=>['chromium','firefox','webkit'].includes(value)));
let server,base=process.env.ODYSSEY_BASE_URL;
if(!base){
  const script=await readFile(new URL('../../js/workflows.js',import.meta.url));
  server=createServer((request,response)=>{if(request.url==='/1.5.0/workflows.js'){response.writeHead(200,{'content-type':'application/javascript'});response.end(script);}else{response.writeHead(404);response.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
}
base=base.replace(/\/$/,'');
const fixture=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Workflow operation identity fixture</title><script defer src="/1.5.0/workflows.js"></script></head><body><main><h1>Operation identity</h1><section id="task"><p data-ody-wf-status></p><p data-ody-wf-error hidden></p><progress data-ody-wf-progress max="100" aria-label="Task progress"></progress><code data-ody-wf-receipt hidden></code><button data-ody-wf-start>Start</button><button data-ody-wf-cancel>Cancel</button><button data-ody-wf-retry>Retry</button><button data-ody-wf-refresh>Refresh</button></section><section id="queue"><label>Files<input type="file" multiple data-ody-wf-files></label><p data-ody-wf-status></p><p data-ody-wf-error hidden></p><ul data-ody-wf-list></ul></section></main></body></html>`;
try{
  for(const engine of engines){
    const browser=await playwright[engine].launch({headless:true,...(engine==='chromium' && process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    try{
      const context=await browser.newContext(),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
      await page.route(base+'/__odyssey-workflow-identity',route=>route.fulfill({contentType:'text/html',body:fixture}));
      await page.goto(base+'/__odyssey-workflow-identity');
      const results=await page.evaluate(async()=>{
        const checks={};
        const equal=(first,second)=>JSON.stringify(first)===JSON.stringify(second);
        const flush=()=>new Promise(resolve=>requestAnimationFrame(resolve));
        let counter=0,taskRetryResolve,wrongRefresh=false;
        const callbacks=[],taskRoot=document.querySelector('#task');
        const task=OdysseyWorkflows.mountTask(taskRoot,{adapter:{
          start:(_state,ctx)=>{callbacks.push(ctx.onUpdate);return Promise.resolve({state:'queued',operationId:'operation-'+(++counter)});},
          retry:(_state,ctx)=>{callbacks.push(ctx.onUpdate);return new Promise(resolve=>{taskRetryResolve=resolve;});},
          refresh:state=>Promise.resolve({state:'success',operationId:wrongRefresh?'unrelated-refresh-operation':state.operationId,receipt:{id:'receipt-'+state.operationId}})
        }});
        function rejectTask(snapshot){const before=task.getState(),html=taskRoot.outerHTML;try{task.update(snapshot,true);return false;}catch{return equal(task.getState(),before) && html===taskRoot.outerHTML;}}
        checks['unbound update cannot establish an arbitrary operation']=rejectTask({state:'success',operationId:'unbound-old',receipt:{id:'old'}});
        await task.start();const first=task.getState().operationId;
        checks['explicit start binds its returned operation']=first==='operation-1' && task.getState().state==='queued';
        checks['unrelated external receipt leaves state and DOM unchanged']=rejectTask({state:'success',operationId:'unrelated-old-operation',receipt:{id:'unrelated-old-receipt'}});
        checks['source update cannot omit the current identity']=rejectTask({state:'running'});
        task.update({state:'unknown-result',operationId:first});await task.refresh();
        checks['matching recovery can commit the original operation']=task.getState().state==='success' && task.getState().operationId===first;
        await task.start();const second=task.getState().operationId;
        checks['a later explicit start can establish a new operation']=second==='operation-2';
        checks['old operation receipt cannot complete a new start']=rejectTask({state:'success',operationId:first,receipt:{id:'old-start-receipt'}});
        const beforeLate=task.getState();callbacks[0]({state:'success',operationId:first,receipt:{id:'late-start-receipt'}});
        checks['late previous-request callback cannot change the new operation']=equal(task.getState(),beforeLate);
        task.update({state:'error',operationId:second});const retry=task.retry();
        checks['old receipt is rejected while retry establishes identity']=rejectTask({state:'success',operationId:second,receipt:{id:'old-during-retry'}});
        taskRetryResolve({state:'queued',operationId:'operation-retry-3'});await retry;const current=task.getState().operationId;
        checks['explicit retry can return a different source operation']=current==='operation-retry-3' && task.getState().state==='queued';
        checks['previous retry identity cannot overwrite the new operation']=rejectTask({state:'success',operationId:second,receipt:{id:'old-retry-receipt'}});
        let mismatch=false;const beforeStream=task.getState();try{callbacks[2]({state:'success',operationId:second,receipt:{id:'wrong-current-stream'}});}catch{mismatch=true;}
        checks['a bound request stream cannot switch operation identity']=mismatch && equal(task.getState(),beforeStream);
        callbacks[2]({state:'running',operationId:current,progress:42});
        checks['matching source updates still advance the current operation']=task.getState().state==='running' && task.getState().progress===42;
        task.update({state:'unknown-result',operationId:current});wrongRefresh=true;await task.refresh();
        checks['mismatched recovery never commits or replaces the current identity']=task.getState().state==='unknown-result' && task.getState().operationId===current && !task.getState().receipt;
        wrongRefresh=false;await task.refresh();
        checks['valid recovery remains available after a rejected receipt']=task.getState().state==='success' && task.getState().operationId===current;

        let queueRetryResolve,queueWrongRefresh=false;const queueCallbacks=[],queueRoot=document.querySelector('#queue');
        const queue=OdysseyWorkflows.mountQueue(queueRoot,{adapter:{
          start:(value,ctx)=>{queueCallbacks.push(ctx.onUpdate);return Promise.resolve({state:'queued',operationId:'upload-'+value.id+'-1'});},
          cancel:value=>Promise.resolve({state:'cancelled',operationId:value.operationId}),
          retry:(value,ctx)=>{queueCallbacks.push(ctx.onUpdate);return new Promise(resolve=>{queueRetryResolve=()=>resolve({state:'queued',operationId:'upload-'+value.id+'-'+value.attempt});});},
          refresh:value=>Promise.resolve({state:'success',operationId:queueWrongRefresh?'unrelated-upload':value.operationId,receipt:{id:'upload-receipt-'+value.operationId}})
        }});
        queue.add([new File(['first'],'same-name.txt'),new File(['second'],'same-name.txt')]);await flush();
        const files=queue.getState(),file=files[0],other=files[1];
        function rejectFile(snapshot){const before=queue.getState(),html=queueRoot.outerHTML;try{queue.update(file.id,snapshot);return false;}catch{return equal(queue.getState(),before) && html===queueRoot.outerHTML;}}
        function action(name){queueRoot.querySelector('button[data-task-id="'+file.id+'"][data-queue-action="'+name+'"]').click();}
        checks['file source identity binds independently for same-name files']=files.length===2 && file.operationId!==other.operationId;
        checks['another file receipt cannot complete the current file']=rejectFile({state:'success',operationId:other.operationId,receipt:{id:'other-file-receipt'}});
        checks['file updates require the current operation identity']=rejectFile({state:'uploading',progress:5});
        action('cancel');await flush();action('retry');
        checks['file old receipt is rejected while retry identity is pending']=rejectFile({state:'success',operationId:file.operationId,receipt:{id:'old-pending-upload'}});
        queueRetryResolve();await flush();const retried=queue.getState()[0];
        checks['explicit per-file retry may bind a new operation']=retried.operationId!==file.operationId && retried.attempt===2 && retried.state==='queued';
        checks['old upload receipt cannot overwrite the new file attempt']=rejectFile({state:'success',operationId:file.operationId,receipt:{id:'old-upload-receipt'}});
        const beforeQueueLate=queue.getState();queueCallbacks[0]({state:'success',operationId:file.operationId,receipt:{id:'late-file-callback'}});
        checks['previous per-file callback cannot mutate the retry']=equal(queue.getState(),beforeQueueLate);
        queueCallbacks[2]({state:'uploading',operationId:retried.operationId,progress:62});
        checks['matching current file updates retain source progress']=queue.getState()[0].progress===62;
        queue.update(file.id,{state:'unknown-result',operationId:retried.operationId});queueWrongRefresh=true;action('refresh');await flush();
        checks['foreign recovery result cannot commit a file']=queue.getState()[0].state==='unknown-result' && queue.getState()[0].operationId===retried.operationId;
        queueWrongRefresh=false;action('refresh');await flush();
        checks['matching file recovery confirms only its original task']=queue.getState()[0].state==='success' && queue.getState()[0].operationId===retried.operationId && queue.getState()[1].state==='queued' && queue.getState()[1].operationId===other.operationId;
        task.destroy();queue.destroy();return checks;
      });
      for(const [name,passed] of Object.entries(results))assert.equal(passed,true,engine+': '+name);
      assert.deepEqual(errors,[],engine+': source identity fixture browser errors');
      console.log(engine+' workflow identity: '+Object.keys(results).length+' regressions passed; external updates, new start/retry binding, source streams and matching recovery.');
      await context.close();
    }finally{await browser.close();}
  }
}finally{if(server)await new Promise(resolve=>server.close(resolve));}
