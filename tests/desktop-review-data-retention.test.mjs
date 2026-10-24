import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {buildSync} from './helpers/build.mjs';
const require=createRequire(import.meta.url);
function bundle(entry,name){buildSync({entryPoints:[entry],outfile:'.build/review-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});return require('../.build/review-'+name+'.cjs');}
const {CampaignStore}=bundle('src/app/storage/store.ts','retention-store');
const {finishCampaignErasure,clearCampaignStaging,discardCampaignTickets}=bundle('desktop/campaign-erasure.ts','erasure');
const {newDocument}=bundle('src/model.ts','document');
const {inspectDungeon}=bundle('src/app/import-dungeon.ts','import');
const {newElement}=bundle('src/app/drawing-model.ts','element');
const {validateDatabase}=bundle('src/app/storage/snapshot-validation.ts','validate');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'review-retention-')),file=path.join(root,'workbench.sqlite'),x={root,file,store:new CampaignStore(file)};
 t.after(()=>{x.store.close();rmSync(root,{recursive:true,force:true});});
 x.fresh=()=>{x.store.close();x.store=new CampaignStore(file);};
 x.erase=cam=>{const row=x.store.campaignOverview().find(r=>r.id===cam.id);x.store.trashCampaign({commandId:randomUUID(),id:cam.id,expectedRevision:row.trashRevision,trashed:true});x.store.eraseCampaign({commandId:randomUUID(),id:cam.id,expectedRevision:row.trashRevision+1,confirmName:cam.name});};
 return x;
}
function image(x,cam,bytes){const asset={id:randomUUID(),kind:'custom',subjectId:null,title:'Handout',sha256:hash(bytes),extension:'.png',bytes:Buffer.byteLength(bytes)},w=x.store.activate(cam.id);x.store.registerPlayerAsset(w.token,asset);mkdirSync(path.join(x.root,'player-images'),{recursive:true});const file=path.join(x.root,'player-images',asset.sha256+'.png');writeFileSync(file,bytes);return file;}

test('permanent erasure resumes after restart and preserves shared images and unrelated files',async t=>{
 const x=fixture(t),a=x.store.create('Delete'),b=x.store.create('Keep'),owned=image(x,a,'exclusive'),shared=image(x,a,'shared');image(x,b,'shared');
 const unrelated=path.join(x.root,'player-images','user-file.png');writeFileSync(unrelated,'unmanaged');
 const snap=path.join(x.root,'campaign-jobs','snapshot-old');mkdirSync(snap,{recursive:true});await x.store.campaignSnapshot(x.store.activate(a.id).token,path.join(snap,'campaign.sqlite'));assert.ok(existsSync(path.join(snap,'campaign.sqlite')));
 const importDir=path.join(x.root,'campaign-jobs','import-old'),mediaStage=path.join(x.root,'player-images','.campaign-old'),unmanaged=path.join(x.root,'campaign-jobs','user-documents');for(const dir of [importDir,mediaStage,unmanaged]){mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'data'),'retained bytes');}
 x.erase(a);assert.ok(existsSync(owned));assert.equal(x.store.campaignErasureFiles(a.id).length,2);x.fresh();clearCampaignStaging(x.root);
 assert.equal(existsSync(snap),false);assert.equal(existsSync(importDir),false);assert.equal(existsSync(mediaStage),false);assert.equal(existsSync(unmanaged),true);
 writeFileSync(path.join(x.root,'recovery.sqlite'),'previous backup');await finishCampaignErasure(x.store,x.root,a.id);
 assert.equal(existsSync(owned),false);assert.equal(readFileSync(shared,'utf8'),'shared');assert.equal(existsSync(unrelated),true);assert.equal(existsSync(path.join(x.root,'recovery.sqlite')),false);
 assert.deepEqual(x.store.pendingCampaignErasures(),[]);assert.deepEqual(x.store.campaignErasureFiles(a.id),[]);assert.equal(x.store.campaignOverview().find(c=>c.id===b.id).name,'Keep');
 x.erase(b);await finishCampaignErasure(x.store,x.root,b.id);assert.equal(existsSync(shared),false,'last remaining owner releases the bytes');
});

test('failed erasure keeps its file plan and retries safely after restart and a new shared owner',async t=>{
 const x=fixture(t),a=x.store.create('Delete'),file=image(x,a,'recoverable');x.erase(a);
 // A directory where an image file should be makes unlink fail deterministically, even as root.
 rmSync(file);mkdirSync(file);await assert.rejects(finishCampaignErasure(x.store,x.root,a.id));assert.deepEqual(x.store.pendingCampaignErasures(),[a.id]);assert.equal(x.store.campaignErasureFiles(a.id).length,1);
 x.fresh();rmSync(file,{recursive:true});const b=x.store.create('New owner');image(x,b,'recoverable');await finishCampaignErasure(x.store,x.root,a.id);
 assert.deepEqual(x.store.pendingCampaignErasures(),[]);assert.equal(readFileSync(file,'utf8'),'recoverable');
});

test('erasure removes matching copy and import tickets but preserves other campaigns',t=>{
 const x=fixture(t),tickets=new Map();for(const [key,source,copy]of [['copy','a',true],['import','a',false],['other','b',true]]){const dir=path.join(x.root,key);mkdirSync(dir);writeFileSync(path.join(dir,'campaign.sqlite'),'snapshot');tickets.set(key,{dir,manifest:{campaignId:source},fence:copy?{id:source}:null});}
 discardCampaignTickets(tickets,'a');assert.deepEqual([...tickets.keys()],['other']);assert.equal(existsSync(path.join(x.root,'copy')),false);assert.equal(existsSync(path.join(x.root,'import')),false);assert.equal(existsSync(path.join(x.root,'other','campaign.sqlite')),true);
});

test('drawing import remaps identities while preserving identifier-shaped author text byte for byte',t=>{
 const x=fixture(t),doc=newDocument('Import',12,12);doc.entities.push({id:'1',kind:'building',floorId:doc.floors[0].id,name:'1',number:'1',polygons:[{outer:[{x:1,y:1},{x:5,y:1},{x:5,y:5},{x:1,y:5}],holes:[]}],layer:0,fill:0xeeeeee,wall:0x222222,wallWidth:.1,key:{sections:[{id:'section',kind:'markdown',markdown:'1'},{id:'other',kind:'markdown',markdown:'section'}]}});
 const source=JSON.stringify(doc),preview=inspectDungeon(source),cam=x.store.create('Destination'),w=x.store.activate(cam.id);
 const result=x.store.executeAtlas({commandId:randomUUID(),token:w.token,campaignId:cam.id,action:{kind:'drawing-import',name:preview.name,rooms:preview.rooms,source,x:0,y:0}});
 const room=x.store.workspace().rooms.find(r=>r.name==='1');assert.ok(room);assert.notEqual(room.id,'1');assert.notEqual(room.scopeId,doc.id);assert.notEqual(room.floorId,doc.floors[0].id);assert.equal(room.number,'1');assert.deepEqual(room.sections.map(s=>s.markdown),['1','section']);assert.notEqual(room.sections[0].id,'section');
 x.fresh();const fresh=x.store.activate(cam.id).rooms.find(r=>r.id===room.id);assert.deepEqual(fresh,room);
 const saved=x.store.db.prepare('SELECT * FROM atlas_import_source').get();assert.ok(Object.values(saved).includes(source));
});

test('copied interrupted journey resolves its remapped trigger and can finish after reopening',async t=>{
 const x=fixture(t),u=1.524,room={id:randomUUID(),scopeId:'local',floorId:'ground',number:'1',name:'Trap corridor',revision:0,polygons:[{outer:[{x:0,y:0},{x:8*u,y:0},{x:8*u,y:4*u},{x:0,y:4*u}],holes:[]}],sections:[]},cam=x.store.create('Interrupted',[room]);let w=x.store.activate(cam.id);const command=action=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,action});
 x.store.executeDrawing(command({kind:'volume-initialize',roomId:room.id,expectedRoomRevision:0,expectedVolumeRevision:null,heightSteps:4}));
 const feature=newElement('feature','local','ground',room.id,[{x:3.5*u,y:1.5*u}]);feature.triggerRadius=0;x.store.executeDrawing(command({kind:'element',element:feature,expectedRevision:null}));
 const volume=x.store.drawing(w.token).volumes.find(v=>v.roomId===room.id);x.store.executeDrawing(command({kind:'trigger-field',expectedRevision:null,field:{id:randomUUID(),revision:1,scopeId:'local',trapId:feature.id,name:'Trap',mode:'interrupt',archived:false,fragments:[{id:randomUUID(),volumeId:volume.id,cells:[{x:3,y:1,z:0}]}]}}));
 const hero=x.store.executeLive(command({kind:'create-character',profile:{name:'Ada',speedFeet:30}})).character,live=x.store.live(w.token);x.store.executeLive(command({kind:'membership',characterId:hero.id,expectedRevision:hero.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:live.focusRevision}));const scene=x.store.executeLive(command({kind:'initialize',expectedRosterRevision:x.store.live(w.token).rosterRevision})).scene;
 const pose={scopeId:'local',floorId:'ground',roomId:room.id,x:1.5*u,y:1.5*u,z:0};x.store.executeDungeon(command({kind:'place',sceneId:scene.id,expectedPositionRevision:0,pose}));const preview=x.store.previewDungeon(w.token,{sceneId:scene.id,destination:{...pose,x:5.5*u},speedMetersPerMinute:18,factor:1,finalSeconds:60});x.store.executeDungeon(command({kind:'journey',preview}));let journey=x.store.dungeon(w.token).journey;x.store.executeDungeon(command({kind:'step',sceneId:scene.id,id:journey.id,expectedRevision:journey.revision,maxSteps:24}));journey=x.store.dungeon(w.token).journey;assert.equal(journey.status,'decision');assert.ok(journey.triggerEventId);validateDatabase(x.store.db);
 const snapshot=path.join(x.root,'campaign.sqlite');await x.store.campaignSnapshot(w.token,snapshot);const copy=x.store.acceptCampaignSnapshot(snapshot,'Copy',{});x.fresh();w=x.store.activate(copy.id);let view=x.store.dungeon(w.token),event=view.triggerEvents.find(e=>e.id===view.journey.triggerEventId);assert.ok(event);assert.notEqual(event.id,journey.triggerEventId);assert.equal(event.journeyId,view.journey.id);validateDatabase(x.store.db);
 const copied=action=>({commandId:randomUUID(),campaignId:copy.id,token:w.token,action});x.store.executeDungeon(copied({kind:'trigger-event',sceneId:view.sceneId,eventId:event.id,expectedRevision:event.revision,operation:'dismiss'}));view=x.store.dungeon(w.token);assert.equal(view.journey.status,'active');x.store.executeDungeon(copied({kind:'step',sceneId:view.sceneId,id:view.journey.id,expectedRevision:view.journey.revision,maxSteps:24}));assert.equal(x.store.dungeon(w.token).journey.status,'arrived');
 // Corruption must fail closed even with a valid payload checksum.
 const row=x.store.db.prepare('SELECT * FROM dungeon_journey WHERE campaign_id=?').get(cam.id),broken=JSON.parse(row.payload);broken.triggerEventId=randomUUID();const payload=JSON.stringify(broken);x.store.db.prepare('UPDATE dungeon_journey SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),cam.id,row.id);assert.throws(()=>validateDatabase(x.store.db),/Triggerkontext/);
});
