import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {assertReferenceContents,assertReferenceInventory,referenceContents,assertReferenceMapImage} from './atlas-reference-fixture.mjs';
const root=process.cwd(),require=createRequire(import.meta.url),Database=require('better-sqlite3'),{PNG}=require('pngjs');
const imageManifest=JSON.parse(await readFile(root+'/tests/fixtures/atlas/reference-images/manifest.json','utf8'));
const manifest=JSON.parse(await readFile(root+'/tests/fixtures/atlas/mixed-world-manifest.json','utf8'));
for(const zoom of [1,2]){
 const output=root+'/.build/atlas-mixed-workbench/'+zoom;
 const native=await createNativeSession({root,output,name:'atlas-mixed-workbench'}),results=[],errors=[];
 let db;
 try{
  await writeFile(native.profile+'/workbench.sqlite',gunzipSync(await readFile(root+'/tests/fixtures/atlas/mixed-world.sqlite.gz')),{flag:'wx'});
  db=new Database(native.profile+'/workbench.sqlite',{readonly:true});assertReferenceContents(db,manifest);
  const campaign=db.prepare('SELECT id,name FROM campaign LIMIT 1').get();
  const initialSettings=db.prepare('SELECT * FROM settings ORDER BY key').all();
  const initialUsage=db.prepare('SELECT * FROM campaign_usage').get();
  const revision=()=>db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(campaign.id).revision,before=revision();
  const open=async()=>{
   const page=await native.launch(zoom);page.on('pageerror',e=>errors.push(String(e)));
   await native.app.evaluate(({BrowserWindow},{zoom})=>BrowserWindow.getAllWindows()[0].setContentSize(1280*zoom,852*zoom),{zoom});
   await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:30-16384,y:30-16384,width:32768,height:32768})),campaign.id);
   await page.locator('.campaign-card').filter({hasText:campaign.name}).getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
   await atlasCanvasReady(page);return page;
  };
  let page=await open();
  async function checkImage(target,name){
   const expected=PNG.sync.read(await readFile(root+`/tests/fixtures/atlas/reference-images/width-${target}.png`));
   let comparison,lastError;
   for(let attempt=0;attempt<20;attempt++){
    await native.capture(page,name);
    try{comparison=assertReferenceMapImage(PNG.sync.read(await readFile(output+'/'+name+'.png')),expected);break;}
    catch(error){lastError=error;await page.waitForTimeout(100);}
   }
   assert(comparison,lastError?.message);return comparison;
  }
  for(const {target,view:expectedView} of imageManifest.views){
   for(let n=0;n<70;n++){
    const view=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));if(view.width<=expectedView.width*(1+1e-7))break;
    const nextWidth=view.width/1.4;
    await page.getByRole('button',{name:'Vergrößern',exact:true}).click();
    await page.waitForFunction(width=>Math.abs(JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width-width)<width*1e-7,nextWidth);
   }
   await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:120000});
   const view=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));for(const key of ['x','y','width','height'])assert(Math.abs(view[key]-expectedView[key])<expectedView.width*1e-6,`Baseline camera mismatch: ${key}`);assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'),'deck');
   const visual=await checkImage(target,'width-'+target);
   assert.equal(revision(),before);results.push({target,view,visual});console.log('Mixed Workbench scale',target,'zoom',zoom,visual);
  }
  await native.close();page=await open();
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:120000});
  const reopened=await checkImage(32768,'reopened');
  // Export the same overview and reject a water-only output independently of UI.
  await page.locator('#atlas-output-open').click();await page.locator('#atlas-output details summary').click();
  await page.locator('#atlas-export-size').fill('512');const file=native.profile+'/overview.png';
  await native.app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert',null,{timeout:120000});
  const png=PNG.sync.read(await readFile(file));let land=0;
  for(let i=0;i<png.data.length;i+=4)if(png.data[i]>png.data[i+2]+15)land++;
  assert(land>png.width*png.height*.2,'Export lost its land surface');
  await writeFile(output+'/overview-export.png',await readFile(file));
  await page.locator('#atlas-output-back').click();await atlasCanvasReady(page);
  assert.equal(revision(),before);assertReferenceInventory(db);
  // Opening a campaign records normal catalog receipts, last-open time and the
  // current app's tutorial setting. Every other stored table remains identical.
  const actual=referenceContents(db);
  for(const [table,expected] of Object.entries(manifest.tables))if(!['campaign_catalog_receipt','campaign_usage','settings'].includes(table))assert.deepEqual(actual[table],expected,table);
  const usage=db.prepare('SELECT * FROM campaign_usage').all();assert.equal(usage.length,1);
  assert.equal(usage[0].campaign_id,initialUsage.campaign_id);assert.equal(usage[0].created_at,initialUsage.created_at);assert(Number.isFinite(Date.parse(usage[0].last_opened_at)));
  const receipts=db.prepare('SELECT payload FROM campaign_catalog_receipt').all();assert.equal(receipts.length,2);
  for(const row of receipts){const receipt=JSON.parse(row.payload);assert.equal(receipt.kind,'open');assert.equal(receipt.campaignId,campaign.id);}
  const settings=db.prepare('SELECT * FROM settings ORDER BY key').all();
  for(const original of initialSettings)assert.deepEqual(settings.find(s=>s.key===original.key),original);
  const {version}=JSON.parse(await readFile(root+'/package.json','utf8'));
  for(const added of settings.filter(s=>!initialSettings.some(old=>old.key===s.key)))assert.equal(added.key,'tutorial:app:'+version);
  assert.deepEqual(errors,[]);
  await native.close();await native.finish({zoom,results,reopened,export:{width:png.width,height:png.height,landPixels:land},canonicalRevision:before});
 }catch(e){await native.fail(e);throw e;}finally{db?.close();await native.dispose();}
}
