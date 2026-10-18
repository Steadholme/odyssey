import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium,firefox,webkit}=await import(process.env.PLAYWRIGHT_MODULE || new URL('../browser-runtime/node_modules/playwright/index.mjs',import.meta.url).href);
const source=new URL('../../js/data-tools.js',import.meta.url);
const line=await readFile(new URL('../../css/line.css',import.meta.url),'utf8');
const expressions=await readFile(new URL('../../css/expressions.css',import.meta.url),'utf8');
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
for(const engine of (process.env.BROWSERS || 'chromium,webkit').split(',')){
  const browser=await({chromium,firefox,webkit}[engine]).launch({headless:true});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><html lang="en"><head></head><body><main><div id="calendar"></div></main></body></html>');
    await page.addScriptTag({content:await readFile(source,'utf8')});
    await page.evaluate(()=>{
      window.animations=[];const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){const result=animate.apply(this,args);animations.push(result);return result;};
      window.calendar=OdysseyDataTools.mountCalendar(document.getElementById('calendar'),{month:'2026-10'});
    });
    const next=page.getByRole('button',{name:'Next →'}),previous=page.getByRole('button',{name:'← Previous'});
    const timing=()=>page.evaluate(()=>{const timing=animations.at(-1).effect.getTiming();return{duration:timing.duration,easing:timing.easing.replace(/\s/g,'')};});
    await next.click();
    check((await timing()).duration===180&&(await timing()).easing==='cubic-bezier(0.2,0.6,0.25,1)','no-Line fallback uses canonical motion defaults');
    await page.locator('#calendar').evaluate(root=>{root.style.setProperty('--dur-2','420ms');root.style.setProperty('--ease-out','ease-out');});
    await previous.click();check((await timing()).duration===420&&(await timing()).easing==='ease-out','legacy motion tokens work without Line');
    await page.addStyleTag({content:line+expressions});
    await page.locator('#calendar').evaluate(root=>{root.style.removeProperty('--dur-2');root.style.removeProperty('--ease-out');root.dataset.odyDesign='line';});
    for(const expression of ['line','soft','studio','signal'])for(const theme of ['light','dark']){
      await page.locator('#calendar').evaluate((root,state)=>{root.dataset.expression=state.expression;root.dataset.theme=state.theme;},{expression,theme});
      await next.click();const actual=await timing();
      const expected=await page.locator('#calendar').evaluate(root=>{const style=getComputedStyle(root);return{duration:parseFloat(style.getPropertyValue('--ody-dur-2')),easing:style.getPropertyValue('--ody-ease-out').replace(/\s/g,'').replace(/\(\./g,'(0.').replace(/,\./g,',0.')};});
      check(actual.duration===expected.duration&&actual.easing===expected.easing,expression+'/'+theme+' reads effective root tokens');
    }
    await page.locator('#calendar').evaluate(root=>{root.style.setProperty('--ody-dur-2','.35s');root.style.setProperty('--ody-ease-out','linear');});
    await previous.click();check((await timing()).duration===350&&(await timing()).easing==='linear','local duration in seconds and easing overrides are live');
    await previous.click();check(await page.evaluate(()=>animations.at(-2).playState==='idle'),'a new pointer reveal cancels its predecessor');
    const count=await page.evaluate(()=>animations.length),month=await page.evaluate(()=>calendar.getState().month);
    await next.focus();await next.press('Enter');
    check(await page.evaluate(()=>animations.length)===count&&await page.evaluate(()=>animations.at(-1).playState==='idle'),'keyboard activation is immediate and cancels a running reveal');
    check(await page.evaluate(()=>calendar.getState().month)!==month,'keyboard activation still applies its action');
    await next.click();const beforeReduce=await page.evaluate(()=>animations.length);await page.emulateMedia({reducedMotion:'reduce'});await previous.click();
    check(await page.evaluate(()=>animations.length)===beforeReduce&&await page.evaluate(()=>animations.at(-1).playState==='idle'),'reduced motion is immediate and cancels a running reveal');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#calendar').evaluate(root=>root.style.setProperty('--ody-dur-2','0ms'));await next.click();
    check(await page.evaluate(()=>animations.length)===beforeReduce,'a zero duration token performs no animation');
    await page.locator('#calendar').evaluate(root=>root.style.setProperty('--ody-dur-2','300ms'));await previous.click();await page.evaluate(()=>calendar.destroy());
    check(await page.evaluate(()=>animations.at(-1).playState==='idle'&&document.getElementById('calendar').children.length===0),'destroy cancels the active animation and restores its floor');
    check(errors.length===0,'no runtime errors: '+JSON.stringify(errors));console.log(engine+': motion token and immediate-input regressions passed');
  }finally{await browser.close();}
}
console.log('PASS: '+checks+' data-tools motion checks.');
