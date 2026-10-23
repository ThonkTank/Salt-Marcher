// Reopen one frozen synthetic world at five fixed scales. No regenerated terrain.
import {createNativeSession} from '../../../tools/native-session.mjs';
import {atlasCanvasReady} from '../../../tools/atlas-canvas-probe.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const reference=path.dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(await readFile(path.join(reference,'fixture.json'),'utf8'));
const bytes=gunzipSync(await readFile(path.join(reference,'asterfall.sqlite.gz')));
assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.snapshotSha256);
const frame=name=>JSON.parse(fixture.cameraStages.find(s=>s.name===name).view);
const room=frame('07-building-room');
const views=[
 ['world',frame('02-continents')],
 ['continent',frame('03-continental-relief')],
 ['kingdom',{x:room.x+room.width/2-1e6,y:room.y+room.height/2-750000,width:2e6,height:1500000}],
 ['settlement',frame('06-settlement')],
 ['interior',room],
];
const native=await createNativeSession({output:path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-fixed-reference'),name:'atlas-fixed-reference'});
await writeFile(path.join(native.profile,'workbench.sqlite'),bytes);
const stages=[];
try{
 for(const [name,view] of views){
  const page=await native.launch();
  await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900));
  await page.evaluate(({id,view})=>localStorage.setItem('atlas-camera:'+id,JSON.stringify(view)),{id:fixture.campaignId,view});
  await page.locator('.campaign-card').filter({hasText:'Asterfall – Autorenwelt'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
  await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  if(await page.locator('#campaign-atlas').isHidden()){
   if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();
   await page.locator('#atlas-tab').click();
  }
  await atlasCanvasReady(page);
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
  await native.capture(page,name);
  stages.push({name,requested:view,actual:await page.locator('#campaign-map').evaluate(n=>({...n.dataset}))});
  await native.close();
  console.log(name);
 }
 await native.finish({fixtureSha256:fixture.snapshotSha256,stages,scope:'Five settled views of identical saved author data; no continuous-navigation, edit-latency or visual acceptance claim.'});
}catch(error){await native.fail(error);throw error;}
finally{await native.dispose();}
