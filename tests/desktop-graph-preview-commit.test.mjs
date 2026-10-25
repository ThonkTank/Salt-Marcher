import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import Database from 'better-sqlite3';
import {buildSync} from './helpers/build.mjs';
import {desktopMainHost,mainHostBuildRoot} from './helpers/desktop-main-host.mjs';
import {atlasProjectionFault} from './helpers/atlas-projection-fault.mjs';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export {CampaignStore} from './src/app/storage/store';export {newElement} from './src/app/drawing-model';"},outfile:mainHostBuildRoot+'/preview-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,newElement}=createRequire(import.meta.url)(mainHostBuildRoot+'/preview-store.cjs');
const digest=db=>createHash('sha256').update(db.serialize()).digest('hex');
const target=state=>({kind:'graph-preview',previewId:state.id,scopeId:state.scopeId,revision:state.revision});
const wrapped=c=>({...c,action:{kind:c.action.kind==='accept'?'graph-accept':'graph-preview',command:c}});
function fixture(t){
 const store=new CampaignStore(':memory:');t.after(()=>store.close());
 const rooms=[0,1].map(i=>({id:randomUUID(),scopeId:'local',floorId:'ground',number:String(i+1),name:'Room '+i,revision:0,polygons:[{outer:[{x:i*6,y:0},{x:i*6+6,y:0},{x:i*6+6,y:6},{x:i*6,y:6}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:'Original'}]}));
 const campaign=store.create('Single preview owner',rooms),w=store.activateShell(campaign.id),owner={campaignId:campaign.id,token:w.token};
 const command=(action,tgt)=>({...owner,commandId:randomUUID(),target:tgt,action});
 const graph=(action,tgt)=>({...command(action,tgt??(store.graphShadow?target(store.graphShadow.state()):{kind:'graph-preview',previewId:randomUUID(),scopeId:'local',revision:0})),scopeId:'local'});
 const start=()=>{const c=graph({kind:'raster'});store.executeGraph(c);return c;};
 return{store,rooms,owner,command,graph,start};
}
const root=(s,cam)=>s.db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(cam);
const roomEdit=(x,room,name,tgt=target(x.store.graphShadow.state()))=>({...x.owner,commandId:randomUUID(),target:tgt,roomId:room.id,expectedRevision:room.revision,name,polygons:room.polygons,sections:room.sections});

test('navigation does not create a preview; explicit target, receipt replay and stale revision never change the owner',t=>{
 const x=fixture(t),{store,rooms}=x;
 store.executeGraph({...x.owner,commandId:randomUUID(),scopeId:'local',action:{kind:'select',roomId:rooms[0].id}});assert.equal(store.graphShadow,null);
 const before=digest(store.db),c=x.graph({kind:'graph-move',roomIds:[rooms[0].id],dxSteps:2,dySteps:0}),result=store.executeGraph(c),shadow=store.graphShadow;
 assert.equal(result.view.preview.id,c.target.previewId);assert.equal(result.workspace.graphPreview.revision,1);assert.equal(digest(store.db),before);
 assert.equal(shadow.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name IN ('campaign_atlas','atlas_receipt','scene_position')").get().n,0);
 const saved=digest(shadow.db);store.executeGraph(c);assert.equal(digest(shadow.db),saved);
 assert.equal(store.reconcileAtlasCommit(wrapped(c)).outcome,'applied');
 assert.throws(()=>store.executeGraph({...c,commandId:randomUUID()}),/inzwischen geändert/);assert.equal(digest(shadow.db),saved);
 assert.throws(()=>store.executeGraph({...c,target:{...c.target,previewId:randomUUID()}}),/anderen Graphvorschau/);assert.equal(digest(shadow.db),saved);
 assert.throws(()=>store.atlasRoomCommit({...roomEdit(x,store.atlasRoom(x.owner.token,rooms[0].id),'Implicit'),target:undefined}),/explizites/);
 assert.throws(()=>store.executeGraph({...x.owner,commandId:randomUUID(),scopeId:'local',action:{kind:'select',roomId:rooms[1].id}}),/Vorschauziel/);
 assert.equal(digest(shadow.db),saved);assert.equal(digest(store.db),before);
});

test('one preview room edit groups shared wall and anchor changes; local Undo/Redo never change canonical history',t=>{
 const x=fixture(t),{store,rooms}=x,r=rooms[1],door=newElement('door',r.scopeId,r.floorId,r.id,[{x:6,y:3}]);
 door.roomId=r.id;door.anchor={roomId:r.id,polygon:0,edge:3,t:0.5};
 store.atlasDrawingCommit(x.command({kind:'element',element:door,expectedRevision:null,expectedRoom:{id:r.id,revision:r.revision}}));
 x.start();const before=digest(store.db),initial=store.workspace(),a=store.atlasRoom(x.owner.token,rooms[0].id),edit=roomEdit(x,a,'Moved shared wall');
 edit.polygons=structuredClone(edit.polygons);edit.polygons[0].outer[1].x=7;edit.polygons[0].outer[2].x=7;
 const ack=store.atlasRoomCommit(edit),shadow=store.graphShadow;
 assert.equal(ack.graphPreview.revision,2);assert.equal(ack.canUndo,true);
 const neighbor=store.atlasRoom(x.owner.token,r.id);assert.equal(neighbor.polygons[0].outer[0].x,7);assert.equal(neighbor.polygons[0].outer[3].x,7);
 assert.equal(store.drawing(x.owner.token).elements.find(e=>e.id===door.id).points[0].x,7);
 assert.equal(shadow.db.prepare('SELECT count(*) n FROM preview_command').get().n,1);
 assert.equal(shadow.db.prepare('SELECT count(*) n FROM preview_receipt WHERE command_id=?').get(edit.commandId).n,1);
 const after=store.workspace();
 const undo=store.executeAtlasCommit(x.command({kind:'undo'},target(shadow.state())));assert.equal(undo.preview.revision,3);assert.equal(undo.canRedo,true);assert.equal(undo.revision,root(store,x.owner.campaignId).revision);
 for(const room of initial.rooms)assert.deepEqual(store.atlasRoom(x.owner.token,room.id).polygons,room.polygons);
 assert.equal(store.drawing(x.owner.token).elements.find(e=>e.id===door.id).points[0].x,6);
 store.executeAtlasCommit(x.command({kind:'redo'},target(shadow.state())));
 for(const room of after.rooms)assert.deepEqual(store.atlasRoom(x.owner.token,room.id).polygons,room.polygons);
 assert.equal(store.drawing(x.owner.token).elements.find(e=>e.id===door.id).points[0].x,7);assert.equal(digest(store.db),before);
});

for(const mode of ['later-geometry','deferred-commit'])test(`canonical ${mode} failure preserves exact preview; direct accept commits once and retires only afterward`,t=>{
 const x=fixture(t),{store}=x;x.start();const r=store.atlasRoom(x.owner.token,x.rooms[0].id),edit=roomEdit(x,r,'Preview remains');store.atlasRoomCommit(edit);
 const shadow=store.graphShadow,local=digest(shadow.db),before=digest(store.db),base=root(store,x.owner.campaignId),c=x.graph({kind:'accept'}),reconcile=store.reconcileAtlasGeometry;
 store.reconcileAtlasGeometry=function(token){
  reconcile.call(this,token);
  assert.equal(this.db.inTransaction,true);assert.equal(shadow.db.inTransaction,false);
  if(mode==='later-geometry')this.db.prepare("SELECT json_extract('broken', '$.dungeon')").get();
  else{this.db.pragma('defer_foreign_keys=ON');this.db.prepare('UPDATE room SET scope_id=? WHERE id=?').run('missing-scope',r.id);}
 };
 assert.throws(()=>store.executeGraph(c),mode==='later-geometry'?/malformed JSON/:/FOREIGN KEY/);
 assert.equal(store.graphShadow,shadow);assert.equal(digest(shadow.db),local);assert.equal(digest(store.db),before);assert.equal(store.reconcileAtlasCommit(wrapped(c)).outcome,'not-applied');
 store.reconcileAtlasGeometry=reconcile;
 let observed=false;const dispose=shadow.dispose.bind(shadow);shadow.dispose=()=>{observed=true;assert.equal(store.db.inTransaction,false);assert.equal(store.reconcileAtlasCommit(wrapped(c)).outcome,'applied');dispose();};
 const result=store.executeGraph(c);assert(observed);assert.equal(store.graphShadow,null);assert.equal(result.workspace.graphPreview,undefined);assert.equal(result.workspace.rooms.find(v=>v.id===r.id).name,edit.name);
 assert.deepEqual(root(store,x.owner.campaignId),{revision:base.revision+1,cursor:base.cursor+1});
 assert.equal(store.db.prepare('SELECT count(*) n FROM atlas_receipt WHERE command_id=?').get(c.commandId).n,1);
 const saved=digest(store.db);store.executeGraph(c);assert.equal(digest(store.db),saved);
 store.executeAtlasCommit(x.command({kind:'undo'}));assert.equal(store.atlasRoom(x.owner.token,r.id).name,r.name);
 store.executeAtlasCommit(x.command({kind:'redo'}));assert.equal(store.atlasRoom(x.owner.token,r.id).name,edit.name);
 // Replaying an old accepted command must never dispose a newer preview.
 x.start();const newer=store.graphShadow;store.executeGraph(c);assert.equal(store.graphShadow,newer);
});

test('preview commit constraint failure rolls back rows, receipt, revision and grouped history together',t=>{
 const x=fixture(t),{store}=x;x.start();const shadow=store.graphShadow,before=digest(shadow.db),main=digest(store.db),r=store.atlasRoom(x.owner.token,x.rooms[0].id),edit=roomEdit(x,r,'No commit'),validate=store.validateGraphPreview;
 store.validateGraphPreview=function(){validate.call(this);this.db.pragma('defer_foreign_keys=ON');this.db.prepare('UPDATE room SET scope_id=? WHERE id=?').run('missing-scope',r.id);};
 assert.throws(()=>store.atlasRoomCommit(edit),/FOREIGN KEY/);store.validateGraphPreview=validate;
 assert.equal(digest(shadow.db),before);assert.equal(digest(store.db),main);assert.equal(store.reconcileAtlasCommit({...edit,action:{kind:'room-edit',edit}}).outcome,'not-applied');
});

test('restore receipt retains its original preview identity across later previews and rejects reused IDs',t=>{
 const x=fixture(t),{store}=x;x.start();const c=x.graph({kind:'restore'});store.executeGraph(c);assert.equal(store.reconcileAtlasCommit(wrapped(c)).outcome,'applied');
 const other=x.start(),newer=store.graphShadow;store.executeGraph(c);assert.equal(store.graphShadow,newer);assert.equal(store.reconcileAtlasCommit(wrapped(c)).outcome,'applied');
 store.executeGraph(x.graph({kind:'restore'}));assert.equal(store.reconcileAtlasCommit(wrapped(c)).outcome,'applied');
 assert.throws(()=>store.executeGraph({...other,target:{...other.target,previewId:c.target.previewId,revision:0}}),/abgeschlossen/);
 assert.throws(()=>store.reconcileAtlasCommit({...wrapped(c),action:{kind:'graph-preview',command:{...c,action:{kind:'raster'}}}}),/anders verwendet/);
});

function ok(reply){assert.equal(reply.ok,true,reply.error);return reply.value;}
for(const [method,reader] of [['atlasRoomCommit','readRoomCommit'],['atlasDrawingCommit','workspace'],['executeGraph','workspace']])test(`${method}: real preview postcommit read failure travels Worker/Main/Preload as unknown and resolves exact local receipt`,async t=>{
 const fault=atlasProjectionFault({target:method,reader,previewPostcommit:true}),host=await desktopMainHost(t,{workerFile:fault.file}),campaign=ok(await host.api.create('Preview transport')),shell=ok(await host.api.activateShell(campaign.id)),owner={campaignId:campaign.id,token:shell.token};
 ok(await host.api.executeAtlasCommit({...owner,commandId:randomUUID(),action:{kind:'room-default'}}));
 const original=ok(await host.api.campaignAtlas(owner.token)),r=original.workspace.rooms[0],start={...owner,commandId:randomUUID(),scopeId:r.scopeId,target:{kind:'graph-preview',previewId:randomUUID(),scopeId:r.scopeId,revision:0},action:{kind:'raster'}};
 if(method!=='executeGraph')ok(await host.api.executeGraph(start));
 const state=method==='executeGraph'?null:ok(await host.api.dungeonAuthoring(owner.token)).drawing.graphPreview;
 const c=method==='executeGraph'?start:method==='atlasRoomCommit'?{...owner,commandId:randomUUID(),target:target(state),roomId:r.id,expectedRevision:r.revision,name:'Saved in preview',polygons:r.polygons,sections:r.sections}:{...owner,commandId:randomUUID(),target:target(state),action:{kind:'key-batch',rooms:[{id:r.id,expectedRevision:r.revision,keyRevision:null}],patch:{gmNotes:{mode:'replace',text:'Saved in preview'}}}};
 const reply=await host.api[method](c);assert.equal(reply.ok,false);assert.equal(reply.errorKind,'store-outcome-unknown');assert.match(reply.error,/projection read failure/);
 const ref=method==='executeGraph'?wrapped(c):{...c,action:method==='atlasRoomCommit'?{kind:'room-edit',edit:c}:{kind:'drawing',command:c}};
 const ack=ok(await host.api.reconcileAtlasCommit(ref));assert.equal(ack.outcome,'applied');assert.equal(ack.ack.preview.id,c.target.previewId);assert.equal(ack.ack.preview.revision,c.target.revision+1);assert.equal(ack.ack.revision,original.revision);
 assert.deepEqual(ok(await host.api.reconcileAtlasCommit(ref)),ack);
 const view=ok(await host.api.dungeonAuthoring(owner.token));
 if(method==='atlasRoomCommit')assert.equal(view.rooms.find(v=>v.id===r.id).name,'Saved in preview');
 if(method==='atlasDrawingCommit')assert(view.drawing.keyContent.find(v=>v.id===r.id).blocks.some(v=>v.text==='Saved in preview'));
 assert.equal(host.dispatches.filter(d=>d.method===method&&d.value.value[0]?.commandId===c.commandId).length,1);
 const trace=readFileSync(fault.trace,'utf8').trim().split('\n').map(v=>JSON.parse(v));assert(trace.some(v=>v.reader===reader&&v.receipt&&!v.inTransaction));
});

for(const method of ['atlasRoomCommit','atlasDrawingCommit'])test(`${method}: local edit avoids canonical geometry; later accept geometry fault rolls back only canonical owner through Main`,async t=>{
 const fault=atlasProjectionFault({target:'executeGraph',reader:'canonical-geometry'}),host=await desktopMainHost(t,{workerFile:fault.file}),campaign=ok(await host.api.create('Canonical acceptance boundary')),shell=ok(await host.api.activateShell(campaign.id)),owner={campaignId:campaign.id,token:shell.token};
 ok(await host.api.executeAtlasCommit({...owner,commandId:randomUUID(),action:{kind:'room-default'}}));
 const original=ok(await host.api.campaignAtlas(owner.token)),r=original.workspace.rooms[0];
 const preview=ok(await host.api.executeGraph({...owner,commandId:randomUUID(),scopeId:r.scopeId,target:{kind:'graph-preview',previewId:randomUUID(),scopeId:r.scopeId,revision:0},action:{kind:'raster'}})).view.preview;
 const c=method==='atlasRoomCommit'?{...owner,commandId:randomUUID(),target:target(preview),roomId:r.id,expectedRevision:r.revision,name:'Keep local edit',polygons:r.polygons,sections:r.sections}:{...owner,commandId:randomUUID(),target:target(preview),action:{kind:'key-batch',rooms:[{id:r.id,expectedRevision:r.revision,keyRevision:null}],patch:{gmNotes:{mode:'replace',text:'Keep local edit'}}}};
 ok(await host.api[method](c));
 const author=ok(await host.api.dungeonAuthoring(owner.token)),accept={...owner,commandId:randomUUID(),scopeId:r.scopeId,target:target(author.drawing.graphPreview),action:{kind:'accept'}};
 const path=readFileSync(fault.trace,'utf8').trim().split('\n').map(v=>JSON.parse(v)).findLast(v=>v.shadow).shadow;
 const snapshot=file=>{const db=new Database(file,{readonly:true});try{return digest(db);}finally{db.close();}};
 const shadowBefore=snapshot(path),mainBefore=snapshot(host.store.filename);
 const reply=await host.api.executeGraph(accept);assert.equal(reply.ok,false);assert.equal(reply.errorKind,undefined);assert.match(reply.error,/malformed JSON/);
 assert.equal(snapshot(path),shadowBefore);assert.equal(snapshot(host.store.filename),mainBefore);assert.deepEqual(ok(await host.api.dungeonAuthoring(owner.token)),author);
 assert.equal(ok(await host.api.reconcileAtlasCommit(wrapped(accept))).outcome,'not-applied');
 const ref={...c,action:method==='atlasRoomCommit'?{kind:'room-edit',edit:c}:{kind:'drawing',command:c}};
 assert.equal(ok(await host.api.reconcileAtlasCommit(ref)).outcome,'applied');
 assert.equal(readFileSync(fault.trace,'utf8').trim().split('\n').map(v=>JSON.parse(v)).filter(v=>v.reader==='canonical-geometry'&&v.commandId===accept.commandId).length,1);
});

test('mixed preview history rebases revisions across graph, room edits and default room; main transactions cannot enclose a preview commit',t=>{
 const x=fixture(t),{store}=x,c=x.graph({kind:'graph-move',roomIds:[x.rooms[0].id],dxSteps:2,dySteps:0});store.executeGraph(c);
 const main=digest(store.db),shadow=store.graphShadow,r=store.atlasRoom(x.owner.token,x.rooms[0].id),edit=roomEdit(x,r,'Later edit');
 assert.throws(()=>store.db.transaction(()=>store.atlasRoomCommit(edit))(),/äußersten Transaktionsbesitzer/);assert.equal(shadow.state().revision,1);
 store.atlasRoomCommit(edit);store.executeAtlasCommit(x.command({kind:'room-default'},target(shadow.state())));assert.equal(store.workspace().rooms.length,3);
 for(let i=0;i<3;i++)store.executeAtlasCommit(x.command({kind:'undo'},target(shadow.state())));
 assert.equal(store.workspace().rooms.length,2);assert.deepEqual(store.atlasRoom(x.owner.token,r.id).polygons,x.rooms[0].polygons);assert.equal(store.atlasRoom(x.owner.token,r.id).name,x.rooms[0].name);
 for(let i=0;i<3;i++)store.executeAtlasCommit(x.command({kind:'redo'},target(shadow.state())));
 assert.equal(store.workspace().rooms.length,3);assert.deepEqual(store.atlasRoom(x.owner.token,r.id).polygons,r.polygons);assert.equal(store.atlasRoom(x.owner.token,r.id).name,edit.name);assert.equal(digest(store.db),main);
 const restore=x.graph({kind:'restore'});store.executeGraph(restore);const canonical=digest(store.db);
 assert.throws(()=>store.edit(edit),/nicht verfügbar/);assert.equal(digest(store.db),canonical);
});
