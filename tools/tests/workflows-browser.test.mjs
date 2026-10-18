import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { assertSurface, assertKeyboardReachable } from '../pattern-assertions.mjs';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
const { default: AxeBuilder } = await import('../browser-runtime/node_modules/@axe-core/playwright/dist/index.mjs');
const source = path => new URL('../../'+path,import.meta.url);
let server, base=process.env.ODYSSEY_BASE_URL;
if (!base) {
  const files = new Map();
  async function add(route,path,type) { files.set(route,[type,await readFile(source(path))]); }
  await add('/workflows.html','site/workflows.html','text/html');
  await add('/examples/workflows/standalone.html','examples/workflows/standalone.html','text/html');
  await add('/examples/workflows/adapter.js','examples/workflows/adapter.js','text/javascript');
  await add('/assets/workflows-demo.js','site/assets/workflows-demo.js','text/javascript');
  for (const [file,path] of Object.entries({'odyssey.css':'dist/odyssey.css','odyssey-font.css':'dist/odyssey-font.css','odyssey-line-font.css':'css/line-font.css','odyssey-line.css':'css/line.css','odyssey-expressions.css':'css/expressions.css','odyssey-extensions.css':'css/extensions.css','workflows.css':'css/workflows.css','odyssey.js':'dist/odyssey.js','odyssey-extensions.js':'js/extensions.js','workflows.js':'js/workflows.js'})) await add('/1.5.0/'+file,path,file.endsWith('.css')?'text/css':'text/javascript');
  server=createServer((request,response)=>{ const file=files.get(new URL(request.url,'http://localhost').pathname); if (request.method!=='GET') {response.writeHead(405);response.end();return;} if (!file) {response.writeHead(404);response.end('Missing test asset');return;} response.writeHead(200,{'content-type':file[0]});response.end(file[1]); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); base='http://127.0.0.1:'+server.address().port;
}
base=base.replace(/\/$/,'');
const evidence=process.env.ODYSSEY_SCREENSHOTS;
if(evidence) await mkdir(evidence,{recursive:true});
const engines=(process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map(name=>name.trim());
assert.ok(engines.length && engines.every(name=>['chromium','firefox','webkit'].includes(name)));
try {
for (const engine of engines) {
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium' && process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const auditBuilder=engine===engines[0]?AxeBuilder:undefined;
let checks=0;
function check(value,message) {assert.ok(value,message);checks++;}
async function keyboardReach(page,target,engine) {
  // Do not assume Tab wraps: Linux Firefox retains its last content focus at the boundary.
  const reverse=await target.evaluate(node=>!!(node.compareDocumentPosition(document.activeElement)&Node.DOCUMENT_POSITION_FOLLOWING));
  if(reverse || engine==='webkit') {
    // Option-Tab includes native macOS WebKit buttons without changing OS settings.
    const key=(engine==='webkit'?'Alt+':'')+(reverse?'Shift+Tab':'Tab');
    let found=await target.evaluate(node=>node===document.activeElement && node.matches(':focus-visible'));
    for(let index=0;index<120 && !found;index++) {
      await page.keyboard.press(key);
      found=await target.evaluate(node=>node===document.activeElement && node.matches(':focus-visible'));
    }
    assert.ok(found,'control not keyboard-reachable within 120 native '+key+' presses');
  }
  await assertKeyboardReachable(page,target);
}
const errors=[];
try {
  const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400) errors.push(response.status()+' '+response.url());});
  page.on('request',request=>{if(request.method()!=='GET') errors.push('Unexpected write: '+request.method()+' '+request.url());});
  await page.goto(base+'/workflows.html'); await page.evaluate(()=>document.fonts.ready);
  check(await page.locator('[data-ody-workflow]').count()===5,'all five workflows are explicit consumers');
  await assertSurface(page,{AxeBuilder:auditBuilder,label:'Workflows Line light'});
  check(await page.evaluate(()=>OdysseyWorkflows.init(document).length===5),'init accepts a document and preserves existing adapters');
  check(await page.evaluate(()=>OdysseyWorkflows.init(document.querySelector('#task-workflow'))[0]===OdysseyWorkflowExamples.mount(document).task),'root init is idempotent');
  await keyboardReach(page,page.locator('[data-ody-wf-start]'),engine);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#task-workflow').dataset.odyWorkflowState==='queued');
  check(await page.locator('[data-ody-wf-progress]').getAttribute('value')===null,'queued progress is indeterminate, not time-based');
  await page.locator('[data-task-source=running]').click();
  check(await page.locator('[data-ody-wf-progress]').getAttribute('value')==='36','only example source reports progress');
  await page.locator('[data-ody-wf-cancel]').click();
  check(await page.locator('#task-workflow').getAttribute('data-ody-workflow-state')==='cancelling','cancel request is not terminal cancellation');
  await page.locator('[data-task-source=cancelled]').click();
  check(await page.locator('#task-workflow').getAttribute('data-ody-workflow-state')==='cancelled','source confirms cancellation');
  await page.locator('[data-ody-wf-retry]').click();
  const op=await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).task.getState().operationId);
  await page.locator('[data-task-source=unknown-result]').click();
  check(await page.locator('[data-ody-wf-start]').isDisabled(),'unknown result cannot enqueue another operation');
  check(await page.locator('[data-ody-wf-retry]').isDisabled(),'unknown result must refresh original identity');
  await page.locator('[data-ody-wf-refresh]').click();
  check(await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).task.getState().operationId)===op,'refresh retains operation identity');
  const rejectedReceipt=await page.evaluate(()=>{try {OdysseyWorkflowExamples.mount(document).task.update({state:'success',operationId:OdysseyWorkflowExamples.mount(document).task.getState().operationId});return false;}catch{return true;}});
  check(rejectedReceipt,'success without source receipt is rejected');
  await page.locator('[data-task-source=success]').click();
  check(await page.locator('[data-ody-wf-receipt]').isVisible(),'source receipt is visible after success');
  check(await page.locator('#auth-workflow form[data-ody-auth-stage=signin] [name=email]').evaluate(node=>{const event=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});node.dispatchEvent(event);return event.defaultPrevented;}),'composition Enter cannot implicitly submit account forms');
  await page.locator('#auth-workflow [name=password]').fill('example-password');
  await page.locator('#auth-workflow form[data-ody-auth-stage=signin] button[type=submit]').click();
  await page.locator('#auth-workflow form[data-ody-auth-stage=mfa]').waitFor({state:'visible'});
  check(await page.locator('#auth-workflow [name=password]').inputValue()==='','password cleared after challenge accepted');
  check(await page.locator('#auth-workflow [autocomplete=one-time-code]').evaluate(node=>node===document.activeElement),'MFA receives focus after pending state');
  await page.locator('#auth-workflow [autocomplete=one-time-code]').fill('111111');
  await page.locator('#auth-workflow form[data-ody-auth-stage=mfa] button[type=submit]').click();
  await page.locator('#auth-workflow [data-ody-wf-error]').waitFor({state:'visible'});
  check(await page.locator('#auth-workflow form[data-ody-auth-stage=mfa]').isVisible(),'MFA error preserves challenge and retry form');
  await page.locator('#auth-workflow [autocomplete=one-time-code]').fill('482931');
  await page.locator('#auth-workflow form[data-ody-auth-stage=mfa] button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#auth-workflow').dataset.odyWorkflowState==='authenticated');
  check(await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).auth.getState().returnTo)==='/workflows.html#auth-title','sign-in keeps host return destination');
  await page.locator('#expire-session').click();
  check(await page.locator('#auth-workflow').getAttribute('data-ody-workflow-state')==='expired','session expiration returns to sign-in');
  await page.locator('[data-ody-auth-go=recovery]').click();
  await page.locator('form[data-ody-auth-stage=recovery] input').fill('recover@example.test');
  await page.locator('form[data-ody-auth-stage=recovery] button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#auth-workflow').dataset.odyWorkflowState==='recovery-sent');
  check(await page.locator('[data-auth-again]').isVisible(),'recovery has a return path');
  await page.locator('[data-ody-wf-next]').click();
  check(await page.locator('[name=workspace]').evaluate(node=>node===document.activeElement),'invalid step focuses its required field');
  await page.locator('[name=workspace]').fill('North Studio');
  await page.locator('[data-ody-wf-draft]').click();
  await page.locator('[name=workspace]').fill('Different draft');
  await page.locator('#restore-draft').click();
  check(await page.locator('[name=workspace]').inputValue()==='North Studio','host draft adapter restores named visible answers');
  await page.locator('[data-ody-wf-next]').click();
  await page.locator('[data-ody-wf-skip]').click();
  check(await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).wizard.getState().skipped.includes(1)),'optional step is explicitly skipped');
  await page.locator('[data-ody-wf-previous]').click();
  await page.locator('[data-ody-wf-previous]').click();
  check(await page.locator('[name=workspace]').inputValue()==='North Studio','back retains answers');
  await page.locator('[data-ody-wf-next]').click(); await page.locator('[data-ody-wf-skip]').click();
  await page.locator('[name=contact]').fill('team@example.test');
  await page.locator('#wizard-fail').check(); await page.locator('[data-ody-wf-submit]').click();
  await page.locator('#wizard-workflow [data-ody-wf-error]').waitFor({state:'visible'});
  check(await page.locator('[name=contact]').inputValue()==='team@example.test','failed final submit retains answers');
  await page.locator('#wizard-fail').uncheck(); await page.locator('[data-ody-wf-submit]').click();
  await page.waitForFunction(()=>document.querySelector('#wizard-workflow').dataset.odyWorkflowState==='success');
  check(await page.locator('[data-ody-wf-submit]').isDisabled(),'source receipt completes wizard once');
  check(await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).wizard.getState().values.workspace)==='North Studio','completed wizard retains its answers in the controller model');
  await page.locator('[data-ody-wf-files]').setInputFiles([{name:'same-name.txt',mimeType:'text/plain',buffer:Buffer.from('one')},{name:'same-name.txt',mimeType:'text/plain',buffer:Buffer.from('two')}]);
  await page.waitForFunction(()=>OdysseyWorkflowExamples.mount(document).queue.getState().every(task=>task.state==='queued'));
  const queue=await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).queue.getState());
  check(queue.length===2 && queue[0].id!==queue[1].id && queue[0].operationId!==queue[1].operationId,'same-name files retain independent task/source identities');
  await page.locator('[data-queue-source=uploading]').click();
  check(await page.locator('#queue-workflow progress[value="58"]').count()===2,'queue progress comes from source snapshots');
  await page.locator('#queue-workflow [data-queue-action=cancel]').first().click();
  check((await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).queue.getState()))[0].state==='cancelling','per-file cancel is pending confirmation');
  await page.locator('[data-queue-source=cancelled]').click();
  await page.locator('#queue-workflow [data-queue-action=retry]').click();
  const retried=await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).queue.getState());
  check(retried[0].attempt===2 && retried[1].attempt===1,'retry isolates per-file attempts');
  await page.locator('[data-queue-source=success]').click();
  check((await page.evaluate(()=>OdysseyWorkflowExamples.mount(document).queue.getState())).every(task=>task.state==='success'),'both source receipts confirm independent files');
  await page.locator('[data-ody-wf-preferences] [name=channel]').selectOption('in-app');
  await page.locator('#access-deny').check();
  await page.locator('[data-ody-wf-preferences] button[type=submit]').click();
  await page.locator('#access-workflow [data-ody-wf-error]').waitFor({state:'visible'});
  check(await page.locator('[data-ody-wf-preferences] [name=channel]').inputValue()==='in-app','denied save retains preference draft');
  await page.locator('[data-ody-wf-restore]').click();
  check(await page.locator('[data-ody-wf-preferences] [name=channel]').inputValue()==='email','discard restores source-confirmed preferences');
  await page.locator('#access-deny').uncheck();
  await page.locator('[data-ody-wf-preferences] [name=frequency]').selectOption('weekly');
  await page.locator('[data-ody-wf-preferences] button[type=submit]').click();
  await page.waitForFunction(()=>OdysseyWorkflowExamples.mount(document).access.getState().preferences.frequency==='weekly');
  await page.locator('[data-ody-wf-invite] [name=email]').fill('new@example.test');
  await page.locator('[data-ody-wf-invite] button[type=submit]').click();
  await page.waitForFunction(()=>OdysseyWorkflowExamples.mount(document).access.getState().members.length===3);
  check(await page.locator('[data-ody-wf-members]').textContent().then(text=>text.includes('invited')),'source invitation state is visible');
  await page.locator('#access-readonly').click();
  check(await page.locator('[data-ody-wf-invite] button[type=submit]').isDisabled(),'source read-only blocks management controls');
  if(evidence) await page.screenshot({path:evidence+'/'+engine+'-workflows-line-desktop.png',fullPage:true});
  for(const expression of ['line','soft','studio','signal']) {
    await page.locator('[data-ody-expression-select]').selectOption(expression);
    for(const theme of ['light','dark']) {
      await page.locator('#wf-theme').selectOption(theme);
      await assertSurface(page,{AxeBuilder:auditBuilder,label:'Workflows '+expression+' '+theme});
    }
  }
  await page.locator('[data-ody-expression-select]').selectOption('line');
  await page.setViewportSize({width:320,height:844});
  await assertSurface(page,{AxeBuilder:auditBuilder,label:'Workflows Line dark 320'});
  if(evidence) await page.screenshot({path:evidence+'/'+engine+'-workflows-line-320.png',fullPage:true});
  const translated=await page.evaluate(()=>{
    const root=document.querySelector('#task-workflow'),task=OdysseyWorkflowExamples.mount(document).task;
    root.lang='zh-CN';task.update({state:'idle',operationId:task.getState().operationId});const zh=root.querySelector('[data-ody-wf-status]').textContent;
    root.lang='ja-JP';task.update({state:'idle',operationId:task.getState().operationId});const ja=root.querySelector('[data-ody-wf-status]').textContent;
    root.removeAttribute('lang');return {zh,ja};
  });
  check(translated.zh==='准备就绪' && translated.ja==='準備完了','workflow status follows the scoped shared Chinese/Japanese locale');
  await page.evaluate(()=>{
    const controllers=OdysseyWorkflowExamples.mount(document);
    controllers.queue.add([new File(['safe content'],'长文件名'.repeat(35)+'<img src=x onerror=alert(1)>.txt')]);
    const source=controllers.access.getState();source.members.push({name:'很长的成员名称'.repeat(25),role:'viewer',state:'invited'});controllers.access.update(source);
  });
  await page.waitForFunction(()=>OdysseyWorkflowExamples.mount(document).queue.getState().some(task=>task.name.startsWith('长文件名') && task.state==='queued'));
  await assertSurface(page,{AxeBuilder:auditBuilder,label:'Long source text at 320'});
  check(await page.locator('#queue-workflow img').count()===0,'file/source text stays text, never interpreted HTML');
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
  check(await page.locator('#task-workflow [data-ody-wf-status]').evaluate(node=>getComputedStyle(node).animationName)==='none','reduced motion removes confirmation animation');
  await assertSurface(page,{AxeBuilder:auditBuilder,label:'Workflows forced colors'});
  await page.evaluate(()=>{
    const original=document.querySelector('#queue-workflow'); OdysseyWorkflowExamples.mount(document).queue.destroy();
    const fresh=original.cloneNode(true);original.replaceWith(fresh);window.queueCallbacks=[];
    window.dynamicQueue=OdysseyWorkflows.mountQueue(fresh,{adapter:{
      start:(value,ctx)=>{queueCallbacks.push(ctx.onUpdate);return Promise.resolve({state:'queued',operationId:'source-'+value.id});},
      cancel:value=>Promise.resolve({state:'cancelled',operationId:value.operationId}),
      retry:(value,ctx)=>{queueCallbacks.push(ctx.onUpdate);return Promise.resolve({state:'queued',operationId:value.operationId});}
    }});
    dynamicQueue.add([new File(['content'],'late-reply.txt',{type:'text/plain'})]);
  });
  await keyboardReach(page,page.locator('#queue-workflow [data-queue-action=cancel]'),engine);
  await page.keyboard.press('Enter');
  check(await page.locator('#queue-workflow li').evaluate(node=>node===document.activeElement),'queue replacement preserves the action row focus');
  await page.locator('#queue-workflow [data-queue-action=retry]').click();
  const lateQueue=await page.evaluate(()=>{const state=dynamicQueue.getState()[0];queueCallbacks[0]({state:'success',operationId:state.operationId,receipt:{id:'old-attempt'}});return dynamicQueue.getState()[0];});
  check(lateQueue.state==='queued' && lateQueue.attempt===2,'late per-file update cannot overwrite a retry attempt');
  check(await page.evaluate(()=>{dynamicQueue.destroy();const root=document.querySelector('#queue-workflow'),before=root.outerHTML;queueCallbacks[1]({state:'success',operationId:'late',receipt:{id:'destroyed'}});return root.outerHTML===before;}),'destroyed file queue ignores late source updates');
  await context.close();

  const standaloneContext=await browser.newContext({viewport:{width:390,height:844}}), standalone=await standaloneContext.newPage();
  await standalone.goto(base+'/examples/workflows/standalone.html');
  await assertSurface(standalone,{AxeBuilder:auditBuilder,label:'Standalone task'});
  check(await standalone.evaluate(()=>!window.Odyssey && typeof OdysseyWorkflows.mountTask==='function'),'standalone requires no runtime, framework, private site shell or unrelated product');
  await standalone.locator('[data-ody-wf-start]').click();
  await standalone.waitForFunction(()=>document.querySelector('[data-ody-workflow]').dataset.odyWorkflowState==='queued');
  check(await standalone.evaluate(()=>OdysseyWorkflows.init(document.querySelector('[data-ody-workflow]'))[0]===OdysseyWorkflows.init(document)[0]),'standalone subtree/root init idempotence');
  // Dynamic mount + actual pending promise: cancellation supersedes the old attempt, never a timer.
  await standalone.evaluate(()=>{
    const old=document.querySelector('[data-ody-workflow]'); OdysseyWorkflows.init(old)[0].destroy();
    const fresh=old.cloneNode(true); fresh.id='dynamic-task'; old.replaceWith(fresh);
    window.dynamic=OdysseyWorkflows.mountTask(fresh,{adapter:{start:(state,ctx)=>new Promise(resolve=>{window.lateResolve=resolve;ctx.onUpdate({state:'running',operationId:'pending-original'});}),cancel:state=>Promise.resolve({state:'cancelled',operationId:state.operationId})}});
  });
  await standalone.locator('[data-ody-wf-start]').click();
  await standalone.locator('[data-ody-wf-cancel]').click();
  await standalone.waitForFunction(()=>dynamic.getState().state==='cancelled');
  await standalone.evaluate(()=>lateResolve({state:'success',operationId:'pending-original',receipt:{id:'too-late'}}));
  check(await standalone.evaluate(()=>dynamic.getState().state==='cancelled'),'late start reply cannot overwrite source-confirmed cancellation');
  const destroyed=await standalone.evaluate(async()=>{
    dynamic.destroy(); const before=document.querySelector('#dynamic-task').outerHTML;
    document.querySelector('[data-ody-wf-start]').click(); await Promise.resolve();
    return document.querySelector('#dynamic-task').outerHTML===before;
  });
  check(destroyed,'destroy removes listeners and leaves no late UI mutation');
  check(await standalone.evaluate(()=>{const root=document.querySelector('#dynamic-task');root.lang='zh-CN';const custom=OdysseyWorkflows.mountTask(root,{messages:{idle:'Host-owned wording'}});return root.querySelector('[data-ody-wf-status]').textContent==='Host-owned wording' && custom.getState().state==='idle';}),'host message overrides take priority over shared locale');
  await standaloneContext.close();
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:844}}),noJsPage=await noJs.newPage();
  await noJsPage.goto(base+'/workflows.html');
  await assertSurface(noJsPage,{label:'Native no-JS reference'});
  check(await noJsPage.locator('noscript').isVisible(),'no-JS reference states the host enhancement boundary');
  await noJs.close();
  assert.deepEqual(errors,[],'no browser errors, failed assets or application write requests');
  console.log(engine+' workflows browser: '+checks+' contracts passed; five workflows, four expressions, light/dark'+(auditBuilder?', Axe':' (Axe in first engine)')+', 320px, native Tab/Option-Tab, dynamic lifecycle and cancellation races.');
} finally {await browser.close();}
}
} finally {if(server)await new Promise(resolve=>server.close(resolve));}
// The source identity contract also runs through the existing unified browser entry.
await import('./workflows-identity.test.mjs');
