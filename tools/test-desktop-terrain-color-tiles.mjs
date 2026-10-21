// Inspect progressive colour on a non-uniform coast through the ordinary Atlas entry.
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-colour-coast');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';"},outfile:'.build/colour-coast-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord}=require(root+'/.build/colour-coast-store.cjs'),native=await createNativeSession({root,output:out,name:'colour-coast'});
const store=new CampaignStore(native.profile+'/workbench.sqlite'),campaign=store.create('Küste und Farbkacheln'),token=store.activate(campaign.id).token;
for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>{const px=x*1024+i%64*16,py=y*1024+Math.floor(i/64)*16;return 80*Math.sin(px/150)+30*Math.cos(py/75);}))}});
store.tutorial('skipped');store.close();let page;
try{
 page=await native.launch();await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-450,y:-300,width:900,height:600})),campaign.id);
 await page.evaluate(()=>{window.__colourStages=[];new MutationObserver(()=>{const m=document.querySelector('#campaign-map'),n=m?.dataset.terrainTiles;if(m?.dataset.terrainReady==='ready'&&n&&window.__colourStages.at(-1)?.tiles!==n)window.__colourStages.push({tiles:n,time:performance.now()});}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-terrain-tiles']});});
 await page.locator('.campaign-card').filter({hasText:'Küste und Farbkacheln'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);
 await page.waitForFunction(()=>{const n=document.querySelector('#campaign-map').dataset.terrainTiles?.split('/').map(Number);return n&&n[0]>0&&n[0]<n[1];});
 await native.capture(page,'01-partial-coast.png');
 await page.waitForFunction(()=>{const n=document.querySelector('#campaign-map').dataset.terrainTiles?.split('/').map(Number);return n&&n[0]>=n[1]/2;});
 await native.capture(page,'04-middle-coast.png');
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 await native.capture(page,'02-complete-coast.png');
 const stages=await page.evaluate(()=>window.__colourStages);assert(stages.length>1);const [done,total]=stages.at(-1).tiles.split('/').map(Number);assert.equal(done,total);
 const canvas=await page.locator('#atlas-terrain-spatial').elementHandle();
 await page.locator('#atlas-view').click();await page.locator('#terrain-tilt').fill('45');await page.locator('#terrain-tilt').dispatchEvent('input');await page.keyboard.press('Escape');await atlasCanvasReady(page);assert(await canvas.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));await native.capture(page,'03-tilted-coast.png');
 await native.close();await native.finish({stages,checks:['Non-uniform coast refines incrementally on the main Atlas; all tiles complete and the same canvas tilts.']});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
