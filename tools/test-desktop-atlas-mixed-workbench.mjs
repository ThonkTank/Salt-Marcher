import assert from 'node:assert/strict';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {createRequire} from 'node:module';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(import.meta.url),Database=require('better-sqlite3');
const native=await createNativeSession({root,output:root+'/.build/atlas-mixed-workbench',name:'atlas-mixed-workbench'}),results=[],errors=[];
let db;
try{
 await pipeline(createReadStream(root+'/tests/fixtures/atlas/mixed-world.sqlite.gz'),createGunzip(),createWriteStream(native.profile+'/workbench.sqlite',{flags:'wx'}));
 db=new Database(native.profile+'/workbench.sqlite',{readonly:true});const campaign=db.prepare('SELECT id,name FROM campaign LIMIT 1').get();
 assert(db.prepare('SELECT count(*) n FROM room_group').get().n>=5000);assert(db.prepare("SELECT count(*) n FROM room WHERE scope_id='mixed-dungeon'").get().n>=4000);
 const revision=()=>db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(campaign.id).revision,before=revision();
 let page=await native.launch();page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:30-16384,y:30-16384,width:32768,height:32768})),campaign.id);
 await page.locator('.campaign-card').filter({hasText:campaign.name}).getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
 await atlasCanvasReady(page);
 for(const target of [32768,4096,512,64,16]){
  for(let n=0;n<70;n++){
   const view=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));if(view.width<=target*1.02)break;
   await page.getByRole('button',{name:'Vergrößern',exact:true}).click();
  }
  await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:120000});
  const view=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));assert(view.width<=target*1.02);assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'),'deck');
  await native.capture(page,'width-'+target);assert.equal(revision(),before);results.push({target,view});console.log('Mixed Workbench scale',target);
 }
 await native.close();page=await native.launch();await page.locator('.campaign-card').filter({hasText:campaign.name}).getByRole('button',{name:/Öffnen|Fortsetzen/}).click();await atlasCanvasReady(page);await native.capture(page,'reopened');
 assert.equal(revision(),before);assert.deepEqual(errors,[]);await native.close();await native.finish({results,canonicalRevision:before,groups:5000,dungeonRooms:4000});
}catch(e){await native.fail(e);throw e;}finally{db?.close();await native.dispose();}
