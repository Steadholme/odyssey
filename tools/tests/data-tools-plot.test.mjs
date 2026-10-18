import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium,firefox,webkit}=await import(process.env.PLAYWRIGHT_MODULE || new URL('../browser-runtime/node_modules/playwright/index.mjs',import.meta.url).href);
const file=path=>new URL('../../'+path,import.meta.url);
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
if(process.env.ODYSSEY_SCREENSHOTS)await mkdir(process.env.ODYSSEY_SCREENSHOTS,{recursive:true});
for(const engine of(process.env.BROWSERS || 'chromium,webkit').split(',')){
  const browser=await({chromium,firefox,webkit}[engine]).launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:760,height:600}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><html lang="en" data-ody-design="line" data-expression="line" data-theme="light"><head></head><body><main style="padding:24px"><h1>Sparse observations</h1><div id="plot"></div></main></body></html>');
    for(const path of ['css/line.css','css/expressions.css','css/data-tools.css'])await page.addStyleTag({content:await readFile(file(path),'utf8')});
    for(const path of ['dist/odyssey.js','js/data-tools.js'])await page.addScriptTag({content:await readFile(file(path),'utf8')});
    await page.evaluate(()=>{window.plot=OdysseyDataTools.mountPlot(document.getElementById('plot'),{name:'Sparse observations',series:[{id:'sparse',name:'Value',values:[{x:1,y:4},{x:2,y:null},{x:3,y:-2}]}]});});
    const markers=page.locator('#plot .ody-plot-point');
    async function alternativeText(){const details=page.locator('#plot details');if(!await details.evaluate(node=>node.open))await details.locator('summary').click();return page.locator('#plot tbody').innerText();}
    check(await markers.count()===2,'both isolated observations have visible markers');
    check(await page.locator('#plot .ody-plot-series').getAttribute('d').then(path=>(path.match(/M/g)||[]).length===2&&!path.includes('L')),'null separates segments without a connecting line');
    check(await markers.evaluateAll(nodes=>nodes.every(node=>{const box=node.getBBox(),style=getComputedStyle(node);return box.width>0&&box.height>0&&style.fill!=='none'&&style.opacity!=='0';})),'zero-length paths no longer hide the observation glyphs');
    check(await markers.evaluateAll(nodes=>Number(nodes[0].getAttribute('cy'))<Number(nodes[1].getAttribute('cy'))),'positive and negative observations retain their real ordering');
    check(await alternativeText().then(text=>text.includes('4')&&text.includes('-2')&&text.includes('No value')),'alternative data retains the same positive, missing and negative observations');
    for(const expression of ['line','soft','studio','signal'])for(const theme of ['light','dark']){
      await page.locator('html').evaluate((root,state)=>{root.dataset.expression=state.expression;root.dataset.theme=state.theme;},{expression,theme});
      check(await markers.evaluateAll(nodes=>nodes.every(node=>{const probe=document.createElement('span');probe.style.color=getComputedStyle(node).getPropertyValue('--ody-accent-ink');document.body.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return getComputedStyle(node).fill===expected;})),expression+'/'+theme+' uses the effective series color token');
    }
    await page.locator('html').evaluate(root=>{root.dataset.expression='line';root.dataset.theme='light';});
    if(process.env.ODYSSEY_SCREENSHOTS)await page.screenshot({path:process.env.ODYSSEY_SCREENSHOTS+'/'+engine+'-sparse-observations.png'});
    await page.evaluate(()=>plot.setSeries([{id:'negative',name:'Negative',values:[{x:5,y:-7}]}]));
    check(await markers.count()===1&&await markers.evaluateAll(nodes=>nodes[0].getBBox().width>0),'a single negative observation has a visible glyph');
    check(await alternativeText().then(text=>text.includes('-7')),'single-point alternative data matches the visual observation');
    await page.evaluate(()=>plot.setSeries([{id:'standalone',name:'Net',values:[{x:1,y:4},{x:2,y:null},{x:3,y:-2},{x:4,y:8}]}]));
    check(await markers.count()===3,'standalone example now renders its previously invisible first observation');
    await page.locator('#plot').getByRole('button',{name:'Net',exact:true}).click();check(await markers.count()===0,'legend hiding removes its markers with its series');
    await page.locator('#plot').getByRole('button',{name:'Net',exact:true}).click();check(await markers.count()===3,'legend restoration retains every observed marker');
    await page.evaluate(()=>plot.setSeries([{id:'empty',name:'Empty',values:[{x:1,y:null}]}]));check(await markers.count()===0&&await page.locator('#plot').innerText().then(text=>text.includes('No values to plot')),'missing-only data does not fabricate a marker');
    check(errors.length===0,'no runtime errors: '+JSON.stringify(errors));console.log(engine+': sparse, single-point and alternate-data regressions passed');
  }finally{await browser.close();}
}
console.log('PASS: '+checks+' data-tools plot checks.');
