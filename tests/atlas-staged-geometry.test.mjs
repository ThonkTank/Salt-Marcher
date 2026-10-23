import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-projection-index';export * from './src/app/drawing-model';",resolveDir:process.cwd()},outfile:'.build/atlas-staged-geometry-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionReader,AtlasProjectionIndex,newElement}=require('../.build/atlas-staged-geometry-test.cjs');
const box={x:-5,y:-5,width:500,height:30},query={box,width:1000,height:300,scopeId:'local',floorId:'ground',slice:null,roofs:true};
async function fixture(t){
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/staged-geometry-');
 const store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Staged geometry',[{id:'room',scopeId:'local',floorId:'ground',number:'1',name:'Room',revision:0,polygons:[{outer:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],holes:[]}],sections:[]}]),token=store.activateShell(campaign.id).token;
 const draw=action=>store.atlasDrawingCommit({commandId:randomUUID(),campaignId:campaign.id,token,action});
 const element={...newElement('door','local','ground','room',[{x:0,y:0}]),anchor:{roomId:'room',polygon:0,edge:0,t:.5}};
 draw({kind:'element',element,expectedRevision:null});
 let db,index,reader,source;const projected=[];
 const close=async()=>{if(index){await index.flush();await index.close();db.close();index=undefined;}};
 const open=async()=>{await close();source=undefined;db=new Database(store.filename,{readonly:true});index=await AtlasProjectionIndex.open(db,store.atlasRegionSource(token),dir+'/cache');reader=new AtlasRegionReader(db,undefined,index);const project=reader.project.bind(reader);reader.project=(table,row)=>{projected.push(table+':'+row.id);return project(table,row);};};
 await open();t.after(async()=>{await close();store.close();rmSync(dir,{recursive:true,force:true});});
 const sync=async(mode=true)=>{source=store.atlasRegionSource(token,source);db.exec('BEGIN');try{await reader.sync(source,mode);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');reader.rollback(mode);throw error;}return source;};
 return {store,campaign,token,element,draw,open,sync,projected,get reader(){return reader;},get index(){return index;},get source(){return source;},view:()=>reader.read(source,query),chunks:()=>[...reader.geometryTileSourceBatches(source,box)]};
}
test('cold and reopened core indexes cannot stand for full geometry; promotion only adds elements',async t=>{
 const f=await fixture(t);await f.sync('core');
 assert.deepEqual(f.projected,['room:room']);assert(f.index.valid('geometry-core',f.source));assert(!f.index.valid('geometry',f.source));
 assert.throws(()=>f.view(),/zuerst synchronisiert/);assert.throws(()=>f.reader.geometryTileSource(f.source,box),/zuerst synchronisiert/);
 const meshSource=f.reader.geometryTileSource(f.source,box,true);
 assert.equal(meshSource.workspace.rooms.length,1);assert.equal(meshSource.geometry.drawing.elements.length,0);assert.equal(meshSource.unmodeledDrawingSources,1);
 assert.deepEqual(f.projected,['room:room'],'fine mesh sources also avoid full drawing projection');
 assert.equal(f.chunks().reduce((n,c)=>n+c.unsupportedElements,0),1);
 await f.open();f.projected.length=0;await f.sync('core');assert.deepEqual(f.projected,[]);assert.throws(()=>f.view(),/zuerst synchronisiert/);
 await f.sync();assert.deepEqual(f.projected,['drawing_element:'+f.element.id]);assert.equal(f.view().drawing.elements.length,1);
 // Existing full caches without a core marker remain complete and reusable.
 f.index.forget('geometry-core');await f.open();f.projected.length=0;await f.sync();assert.deepEqual(f.projected,[]);assert.equal(f.view().drawing.elements.length,1);
});
test('overview and terrain jobs retain deferred anchored-element moves, deletions, and hidden floors',async t=>{
 const f=await fixture(t);await f.sync();const before=f.view().drawing.elements[0].points;
 const room=f.store.atlasRoom(f.token,'room');f.draw({kind:'shape',roomId:'room',expectedRevision:room.revision,polygons:room.polygons.map(p=>({...p,outer:p.outer.map(v=>({...v,x:v.x+100}))}))});
 f.projected.length=0;await f.sync('core');assert.deepEqual(f.projected,['room:room']);assert.throws(()=>f.view(),/zuerst synchronisiert/);
 await f.sync(false);await f.sync();assert.notDeepEqual(f.view().drawing.elements[0].points,before);assert.equal(f.projected.filter(p=>p.startsWith('drawing_element:')).length,1);
 f.store.db.prepare('DELETE FROM drawing_element WHERE campaign_id=? AND id=?').run(f.campaign.id,f.element.id);
 await f.sync('core');assert.equal(f.chunks().reduce((n,c)=>n+c.unsupportedElements,0),0);await f.sync();assert.equal(f.view().drawing.elements.length,0);
 f.store.db.prepare("INSERT INTO drawing_hidden VALUES(?,?,'local','floor',1,1)").run(f.campaign.id,'ground');
 await f.sync('core');assert.equal(f.chunks().flatMap(c=>c.view.workspace.rooms).length,0);await f.sync();assert.equal(f.view().rooms.length,0);
});
test('deferred corrupt elements remain explicit unsupported sources then full-query faults after restart',async t=>{
 const f=await fixture(t);await f.sync();
 f.store.db.prepare('UPDATE drawing_element SET payload=? WHERE id=?').run('{broken',f.element.id);
 await f.sync('core');assert.equal(f.chunks().reduce((n,c)=>n+c.unsupportedElements,0),1);
 await f.open();await f.sync();assert.equal(f.view().coverage.unreadable,1);assert.equal(f.view().drawing.elements.length,0);
 assert.equal(f.store.db.prepare('SELECT payload FROM drawing_element WHERE id=?').get(f.element.id).payload,'{broken');
});
test('failed promotion rolls back readiness and recovers to the canonical full view',async t=>{
 const f=await fixture(t);await f.sync('core');const mark=f.index.mark.bind(f.index);
 f.index.mark=(part,source)=>{if(part==='geometry')throw Error('promotion interrupted');return mark(part,source);};
 await assert.rejects(f.sync(),/promotion interrupted/);assert.throws(()=>f.view(),/zuerst synchronisiert/);
 f.index.mark=mark;await f.sync();assert.equal(f.view().drawing.elements.length,1);assert.equal(f.view().coverage.unreadable,0);
});
