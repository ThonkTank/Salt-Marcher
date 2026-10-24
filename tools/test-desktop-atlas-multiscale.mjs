import {createNativeSession} from './native-session.mjs';
import {createCartographicFixture} from './atlas-cartographic-fixture.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
import {setTerrainContours} from './atlas-brush-probe.mjs';

const root=process.cwd(),output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-cartography');
const native=await createNativeSession({root,output,name:'atlas-cartography'}),views=[],exports=[],navigation=[],sweeps=[];
let page;const shaderErrors=[];
try{
 const fixture=createCartographicFixture(native.profile,{bridge:process.env.QA_STRUCTURES==='1'});
 const open=async(mpp)=>{
  await page.evaluate(({id,mpp})=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-960*mpp,y:-540*mpp,width:1920*mpp,height:1080*mpp})),{id:fixture.campaignId,mpp});
  await page.reload();await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  await page.locator('.campaign-card').filter({hasText:'Waldpass und Brückendorf'}).getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
  await page.waitForFunction(()=>document.querySelector('#campaign-map')?.dataset.terrainReady==='failed'||!document.querySelector('main').inert&&document.querySelector('#campaign-map')?.dataset.terrainQuality==='detail',null,{timeout:120000});
  assert.notEqual(await page.locator('#campaign-map').getAttribute('data-terrain-ready'),'failed',await page.locator('[data-error="true"]').first().getAttribute('title').catch(()=>'Terrain failed'));
  assert.deepEqual(shaderErrors,[]);
  if(await page.locator('#atlas-secondary').isVisible())await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-view').click();await page.locator('#land-grid').uncheck();await page.keyboard.press('Escape');
  if(process.env.QA_DRAWN==='1')await setTerrainContours(page,'0');
 };
 for(const zoom of (process.env.QA_ZOOMS??'1,2').split(',').map(Number)){
  page=await native.launch(zoom);page.on('console',m=>{if(/Link error|Compilation error|initialization of/.test(m.text()))shaderErrors.push(m.text());});await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
  for(const mpp of (process.env.QA_SCALES??'2048,128,16,4,1,0.25').split(',').map(Number)){
   const started=performance.now();await open(mpp);
   for(const tilt of (process.env.QA_TILTS??'0,45,75').split(',').map(Number)){
    if(tilt){await page.locator('#atlas-view').click();await page.locator('#terrain-tilt').fill(String(tilt));await page.locator('#terrain-tilt').dispatchEvent('input');await page.keyboard.press('Escape');}
    await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:120000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const view=await page.evaluate(()=>{const c=document.querySelector('#campaign-map'),v=JSON.parse(c.dataset.atlasView);return{box:v,mpp:v.width/c.clientWidth,renderer:c.dataset.renderer,cache:JSON.parse(c.dataset.terrainCache??'null'),gpu:JSON.parse(c.dataset.terrainGpu??'null')};});
    assert.equal(view.renderer,'deck');assert.deepEqual(shaderErrors,[]);
    if(view.cache){assert(view.cache.tiles<=64);assert(view.cache.bytes<=64*1024*1024);}
    const name=`zoom-${zoom}-mpp-${mpp}-tilt-${tilt}`;await native.capture(page,name);
    views.push({name,...view,readyMs:performance.now()-started});console.log(name,Math.round(performance.now()-started)+'ms');
   }
  }
  if(process.env.QA_PERF==='1'||process.env.QA_EXPORT==='1'){
   const b=await page.locator('#campaign-map').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   await page.locator('#atlas-pan').click();
   await page.evaluate(()=>{window.__cartographicFrames=[];window.__cartographicActive=true;let last;const tick=now=>{if(!window.__cartographicActive)return;if(last!==undefined)window.__cartographicFrames.push(now-last);last=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
   for(let i=0;i<20;i++){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(i%2?-30:30),y,{steps:3});await page.mouse.up();}
   const row=await page.evaluate(()=>{window.__cartographicActive=false;const values=window.__cartographicFrames.sort((a,b)=>a-b);return{samples:values.length,p95FrameMs:values[Math.ceil(values.length*.95)-1],maxFrameMs:values.at(-1)};});
   assert(row.samples>20);navigation.push({zoom,...row,targetMet:row.p95FrameMs<=33.3});
   await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:120000});
  }
  if(process.env.QA_SWEEP==='1'){
   const b=await page.locator('#campaign-map').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
   const scale=()=>page.locator('#campaign-map').evaluate(c=>JSON.parse(c.dataset.atlasView).width/c.clientWidth);
   const before=await scale();const positions=[before];
   for(const direction of [1,-1])for(let i=0;i<18;i++){await page.mouse.wheel(0,direction*250);await page.waitForTimeout(100);positions.push(await scale());}
   await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:120000});
   assert.deepEqual(shaderErrors,[]);const after=await scale();assert(Math.max(...positions)/Math.min(...positions)>1000,'zoom sweep must traverse the actual scale hierarchy');
   sweeps.push({zoom,positions,before,after});await native.capture(page,'continuous-zoom-'+zoom);
  }
  if(process.env.QA_EXPORT==='1'){
   await page.locator('#atlas-output-open').click();
   await page.locator('#atlas-output summary').filter({hasText:'Bildoptionen'}).click();
   await page.locator('#atlas-export-grid').uncheck();
   const images=[];
   for(const size of (process.env.QA_EXPORT_SIZES??'1024,2048').split(',').map(Number)){
    const file=output+'/export-'+zoom+'-'+size+'.png';
    await native.app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
    await page.locator('#atlas-export-size').fill(String(size));await page.locator('#atlas-export-png').click();
    await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert',null,{timeout:120000});
    const png=PNG.sync.read(await readFile(file));assert.equal(Math.max(png.width,png.height),size);images.push(png);
   }
   const [a,b]=images;let difference=0,count=0;
   // Compare an interior woodland patch, away from captions, shore and village.
   for(let y=Math.ceil(a.height*.65);y<a.height*.9;y++)for(let x=Math.ceil(a.width*.15);x<a.width*.4;x++)for(let c=0;c<3;c++){
    const xx=Math.floor(x*b.width/a.width),yy=Math.floor(y*b.height/a.height);
    difference+=Math.abs(a.data[(y*a.width+x)*4+c]-b.data[(yy*b.width+xx)*4+c]);count++;
   }
   const meanDifference=difference/count;assert(meanDifference<6,'Export forest style changed with resolution: '+meanDifference);
   exports.push({zoom,sizes:images.map(p=>Math.max(p.width,p.height)),meanDifference});
  }
  await native.close();
 }
 await native.finish({fixture,views,exports,navigation,sweeps,scope:'Fixed canonical landscape; identical cameras across builds. Visual review is recorded separately.'});
}catch(error){if(page)await writeFile(output+'/failure-state.json',JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,dataset:{...document.querySelector('#campaign-map')?.dataset},titles:[...document.querySelectorAll('[title]')].map(n=>[n.id,n.title])})).catch(()=>null),null,2));await native.fail(error);throw error;}finally{await native.dispose();}
