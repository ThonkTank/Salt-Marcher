import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

// The real Atlas and normal wheel/view controls, with a reproducible forest.
// Run alone through tools/ui-session.py after build:desktop.
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/forest-style');
await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url);
buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './src/app/vegetation';export * from './src/app/atlas-landscape';"},outfile:out+'/fixture.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,vegetationSpec,emptyRecord}=require(out+'/fixture.cjs');
const native=await createNativeSession({root,output:out,name:'forest-style'}),checks=[],views=[];
try{
 const store=new CampaignStore(native.profile+'/workbench.sqlite'),cam=store.create('Wald am Hohlweg'),token=store.activateShell(cam.id).token;
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token,action});
 const save=record=>write({kind:'landscape-put',record,expectedRevision:null});
 for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)save(heightRecord(x*131072,y*131072,2048,new Float32Array(4096).fill(20)));
 for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)save(heightRecord(x*4096,y*4096,64,Float32Array.from({length:4096},(_,i)=>20+24*Math.exp(-((x*4096+i%64*64+200)**2+(y*4096+Math.floor(i/64)*64)**2)/300000))));
 const polygon=points=>({outer:points.map(([x,y])=>({x,y})),holes:[]});
 const oak={...emptyRecord('vegetation'),id:'oak-wood',name:'Eichenhain',resolution:3,values:{terrain:'forest'},vegetation:vegetationSpec('deciduous',123),polygons:[polygon([[-24000,-18000],[9000,-20000],[18000,-10000],[700,-1000],[200,-300],[100,150],[-200,250],[-300,800],[10000,15000],[-16000,22000],[-27000,5000]])]};
 oak.vegetation.overrides=[{id:'ancient-oak',x:-120,y:-40,asset:'oak',size:22,angle:.5}];save(oak);
 save({...emptyRecord('vegetation'),id:'pine-wood',name:'Kiefernhang',resolution:3,values:{terrain:'forest'},vegetation:vegetationSpec('conifer',77),polygons:[polygon([[280,-350],[650,-410],[900,-240],[820,160],[600,250],[450,80]])]});
 save({...emptyRecord('road'),id:'track',name:'Hohlweg',points:[{x:-900,y:450},{x:-300,y:150},{x:100,y:10},{x:700,y:-100}],width:7});
 store.tutorial('skipped');const before=store.db.prepare('SELECT id,payload FROM atlas_landscape ORDER BY id').all();store.close();
 const page=await native.launch();
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-40000,y:-30000,width:80000,height:60000})),cam.id);
 await page.locator('.campaign-card').filter({hasText:'Wald am Hohlweg'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await page.locator('#atlas-units').selectOption('metric');
 const surface=await page.locator('#atlas-terrain-spatial').elementHandle();
 const ready=async()=>{await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready'&&document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:90000});};
 const box=()=>page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.atlasView));
 const capture=async name=>{
  await ready();assert(await surface.evaluate(n=>n===document.querySelector('#atlas-terrain-spatial')));
  const hint=await page.locator('#atlas-hint').textContent();
  assert(!hint.includes('Landschaft nicht verfügbar'),name+': '+hint);
  views.push({name,hint,box:await box(),projection:JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection'))});await native.capture(page,name);
 };
 const zoom=async width=>{
  for(let n=0;n<12;n++){
   const b=await box(),ratio=width/b.width;if(Math.abs(Math.log(ratio))<.01)break;
   const r=await page.locator('#campaign-map').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,Math.log(ratio)/.002);
   await page.waitForFunction(w=>Math.abs(JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width/w-1)>.05,b.width);
   await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.canvasState==='loaded');
  }
 };
 await capture('01-world');await zoom(6000);await capture('02-region');await zoom(1200);await capture('03-village');await zoom(300);await capture('04-crowns');
 await page.locator('#atlas-view').click();await page.locator('#atlas-terrain-tilt').click();await page.locator('#atlas-search').click();await capture('05-tilted');
 await native.app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},out+'/export.png');
 await page.locator('#atlas-output-open').click();await page.locator('#atlas-output summary').filter({hasText:'Bildoptionen'}).click();await page.locator('#atlas-export-size').fill('1024');await page.locator('#atlas-export-grid').uncheck();await page.locator('#atlas-export-png').click();
 await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert',null,{timeout:90000});
 assert((await readFile(out+'/export.png')).length>10000);
 checks.push('World, region, village and crown detail share the normal Atlas canvas; tilted output is saved through the native export.');
 await native.close();
 const fresh=new CampaignStore(native.profile+'/workbench.sqlite');try{assert.equal(fresh.atlasLandscapeObject(fresh.activateShell(cam.id).token,'oak-wood').vegetation.overrides[0].id,'ancient-oak');}finally{fresh.close();}
 // Opening changes campaign usage metadata, so compare authored terrain only.
 const Database=require('better-sqlite3'),db=new Database(native.profile+'/workbench.sqlite',{readonly:true});
 try{assert.deepEqual(db.prepare('SELECT id,payload FROM atlas_landscape ORDER BY id').all(),before);}finally{db.close();}
 checks.push('Navigation and export preserve all authored landscape rows and protected identities.');
 const hashes={};for(const file of ['src/app/atlas-spatial-scene.ts','src/app/vegetation.ts','src/app/vegetation-lod.ts','src/app/storage/atlas-landscape-region.ts','src/app/atlas-spatial-vegetation.ts','src/app/vegetation-display.ts','src/app/vegetation-view.ts','src/app/landscape-raster.ts'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
 await native.finish({checks,views,hashes});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
