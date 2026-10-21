// Actual app entry and fresh-process reopening of a retained synthetic full world.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readdir,stat} from 'node:fs/promises';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),input=process.env.ATLAS_MIXED_SOURCE;
assert(input,'Set ATLAS_MIXED_SOURCE to a retained synthetic full world');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-cache-reopen'),native=await createNativeSession({output,name:'atlas-cache-reopen'}),source=new Database(input,{readonly:true});
const id=source.prepare('SELECT id FROM campaign').get().id;await source.backup(native.profile+'/workbench.sqlite');source.close();
const runs=[];
try{
 for(const label of ['cold','reopened']){
  const page=await native.launch();page.setDefaultTimeout(90000);await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900));
  await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-20000000,y:-12500000,width:40000000,height:25000000})),id);
  const start=performance.now();await page.locator('.campaign-card').getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert,null,{timeout:90000});
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:90000});
  const firstTerrainMs=performance.now()-start,state=await page.locator('#campaign-map').evaluate(n=>({view:n.dataset.atlasView,revision:n.dataset.terrainRevision,quality:n.dataset.terrainQuality}));
  const firstRegionState=await page.locator('#campaign-atlas').getAttribute('data-region-state');
  await atlasCanvasReady(page);const regionReadyMs=performance.now()-start;
  let detailReadyMs,detailState;
  if(process.env.ATLAS_WAIT_DETAIL==='1'){
   await page.waitForFunction(()=>{const m=document.querySelector('#campaign-map'),[done,total]=(m.dataset.terrainTiles??'').split('/').map(Number);return m.dataset.terrainQuality==='detail'&&done>0&&done===total;},null,{timeout:90000});
   detailReadyMs=performance.now()-start;detailState=await page.locator('#campaign-map').evaluate(m=>({quality:m.dataset.terrainQuality,tiles:m.dataset.terrainTiles}));
  }
  await native.capture(page,label);await native.close();const files=[];for(const name of await readdir(native.profile+'/atlas-region-cache')){const info=await stat(native.profile+'/atlas-region-cache/'+name);files.push({name,bytes:info.size,mtimeMs:info.mtimeMs});}
  const run={label,firstTerrainMs,regionReadyMs,firstRegionState,state,files,...(detailState?{detailReadyMs,detailState}:{})};runs.push(run);console.log(JSON.stringify(run));
 }
 assert.equal(runs[0].files.length,1);assert.deepEqual(runs[1].files,runs[0].files,'unchanged restart must reuse the cache without rewriting it');assert.deepEqual(runs[1].state,runs[0].state);
 await native.finish({runs});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
