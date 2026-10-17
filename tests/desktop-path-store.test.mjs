import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/path-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/path-store.cjs'),sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const dir=mkdtempSync(path.join(tmpdir(),'path-store-')),store=new CampaignStore(path.join(dir,'source.sqlite'));
 const rooms=[0,1,2].map(i=>({id:randomUUID(),scopeId:'local',floorId:'ground',number:String(i+1),name:i===2?'Protected room':'Endpoint '+i,revision:0,polygons:[{outer:[{x:i===2?30:i*7.62,y:0},{x:(i===2?30:i*7.62)+3.048,y:0},{x:(i===2?30:i*7.62)+3.048,y:3.048},{x:i===2?30:i*7.62,y:3.048}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:'  Protected key '+i+'\r\n'}]}));
 const campaign=store.create('Dungeon',rooms),w=store.activate(campaign.id),send=action=>store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 for(const r of rooms.slice(0,2))send({kind:'volume-initialize',roomId:r.id,expectedRoomRevision:0,expectedVolumeRevision:null,heightSteps:2});
 const input={id:randomUUID(),revision:0,scopeId:'local',name:'Connection',notes:'  Authored path\r\n',from:{roomId:rooms[0].id,volumeId:null,pinned:false,local:null},to:{roomId:rooms[1].id,volumeId:null,pinned:false,local:null},waypoints:[],segments:[{form:'corridor',widthSteps:1,heightSteps:2,factor:1}],medium:'air',mode:'path',roomId:null,volumeId:null,fromPassageId:randomUUID(),toPassageId:randomUUID(),basis:'',route:[]};
 const preview=p=>store.previewPath(w.token,p??input),publish=()=>send({kind:'path-publish',preview:preview(),expectedRevision:null});
 const rows=()=>Object.fromEntries(['campaign','room','dungeon_volume','dungeon_path','dungeon_passage','drawing_history','drawing_revision','receipt'].map(table=>[table,store.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return{dir,store,rooms,campaign,w,input,send,preview,publish,rows};
}
for(const[table,name,change]of [
 ['dungeon_path','identity',p=>p.id='foreign'],['dungeon_path','revision',p=>p.revision++],['dungeon_path','scope',p=>p.scopeId='other'],['dungeon_path','materialized room',p=>p.roomId='other'],['dungeon_path','medium',p=>p.medium='lava'],['dungeon_path','segment',p=>p.segments[0].widthSteps=0],['dungeon_path','route',p=>p.route[0].x=.5],['dungeon_path','route jump',p=>p.route.at(-1).x+=9],['dungeon_path','owned volume',p=>p.volumeId='missing'],
 ['dungeon_passage','identity',p=>p.id='foreign'],['dungeon_passage','revision',p=>p.revision++],['dungeon_passage','scope',p=>p.scopeId='other'],['dungeon_passage','owned volume',p=>p.volumeId='missing'],['dungeon_passage','anchor owner',p=>p.anchor.roomId='other'],['dungeon_passage','face',p=>p.anchor.local.face='diagonal'],['dungeon_passage','width',p=>p.widthSteps=0],['dungeon_passage','direction',p=>p.outbound.passable='yes'],['dungeon_passage','time',p=>p.inbound.additionalSeconds=-1]
])test(`checksummed invalid ${table} ${name} is rejected by reads, backup and campaign import`,async t=>{
 const x=fixture(t);x.publish();const safe=path.join(x.dir,'qualified.sqlite');await x.store.backup(safe);const bytes=readFileSync(safe),row=x.store.db.prepare('SELECT * FROM '+table+' ORDER BY rowid LIMIT 1').get(),body=JSON.parse(row.payload);change(body);const payload=JSON.stringify(body);x.store.db.prepare('UPDATE '+table+' SET payload=?,checksum=? WHERE id=?').run(payload,sha(payload),row.id);const before=x.rows();
 assert.throws(()=>x.store.drawing(x.w.token),/Pfad|Passage/);await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(bytes));assert.deepEqual(x.rows(),before);
 const input=path.join(x.dir,'damaged.sqlite');await x.store.db.backup(input);const original=readFileSync(input),destination=new CampaignStore(path.join(x.dir,'destination.sqlite'));t.after(()=>destination.close());assert.throws(()=>destination.campaignPreview(input));assert.throws(()=>destination.acceptCampaignSnapshot(input,'Reject',{}));assert.ok(readFileSync(input).equals(original));assert.equal(destination.db.prepare('SELECT count(*) n FROM campaign').get().n,0);
});
test('a new path cannot claim a protected existing room as its generated area',t=>{const x=fixture(t),before=x.rows();assert.throws(()=>x.preview({...x.input,roomId:x.rooms[2].id}));assert.deepEqual(x.rows(),before);});
test('a published path cannot change its generated area or steal another passage identity',t=>{const x=fixture(t);x.publish();const p=x.store.drawing(x.w.token).paths[0],before=x.rows();for(const changes of [{roomId:x.rooms[2].id},{volumeId:x.store.drawing(x.w.token).volumes.find(v=>v.roomId===x.rooms[0].id).id},{fromPassageId:randomUUID()}])assert.throws(()=>x.preview({...p,...changes}));assert.deepEqual(x.rows(),before);});
test('an independent copy retains path geometry, both passage descriptions and executable Undo/Redo',async t=>{const x=fixture(t);x.publish();const p=x.store.drawing(x.w.token).passages.find(p=>p.id===x.input.fromPassageId);x.send({kind:'passage',passage:{...p,outbound:{...p.outbound,description:'  Outgoing prose\r\n'},inbound:{...p.inbound,description:'Return prose',additionalSeconds:7}},expectedRevision:p.revision});const file=path.join(x.dir,'campaign.sqlite');await x.store.campaignSnapshot(x.w.token,file);const destination=new CampaignStore(path.join(x.dir,'destination.sqlite'));t.after(()=>destination.close());const copied=destination.acceptCampaignSnapshot(file,'Copy',{}),w=destination.activate(copied.id),view=destination.drawing(w.token),pathCopy=view.paths[0],passage=view.passages.find(p=>p.id===pathCopy.fromPassageId);assert.notEqual(pathCopy.id,x.input.id);assert.notEqual(pathCopy.roomId,x.store.drawing(x.w.token).paths[0].roomId);assert.equal(pathCopy.notes,x.input.notes);assert.deepEqual(pathCopy.route,x.store.drawing(x.w.token).paths[0].route);assert.equal(passage.pathId,pathCopy.id);assert.equal(passage.otherRoomId,pathCopy.roomId);assert.equal(passage.outbound.description,'  Outgoing prose\r\n');assert.equal(passage.inbound.additionalSeconds,7);destination.history(w.token,'undo');assert.equal(destination.drawing(w.token).passages.find(p=>p.id===passage.id).outbound.description,'');destination.history(w.token,'redo');assert.equal(destination.drawing(w.token).passages.find(p=>p.id===passage.id).outbound.description,'  Outgoing prose\r\n');await destination.backup(path.join(x.dir,'copy.sqlite'));});
for(const edit of ['factor','form','waypoint'])test(`a saved path can change ${edit} while its previous derived route is awaiting recalculation`,t=>{
 const x=fixture(t);x.publish();const p=x.store.drawing(x.w.token).paths[0];
 const changed=edit==='factor'?{...p,segments:[{...p.segments[0],factor:3}]}:edit==='form'?{...p,segments:[{...p.segments[0],form:'ramp'}]}:{...p,waypoints:[{x:4.572,y:.762,z:0}],segments:[p.segments[0],p.segments[0]]};
 const preview=x.preview(changed);x.send({kind:'path-publish',preview,expectedRevision:p.revision});const saved=x.store.drawing(x.w.token).paths[0];assert.deepEqual(saved.segments,changed.segments);assert.deepEqual(saved.waypoints,changed.waypoints);
});
test('stale and explicitly unbound passages remain readable and can be backed up',async t=>{
 const x=fixture(t);x.publish();const view=x.store.drawing(x.w.token),passage=view.passages[0],room=x.store.workspace().rooms.find(r=>r.id===passage.roomId);
 x.send({kind:'passage',passage:{...passage,assigned:false},expectedRevision:passage.revision});
 const shifted=room.polygons.map(p=>({outer:p.outer.map(p=>({x:p.x+1.524,y:p.y})),holes:[]}));x.send({kind:'shape',roomId:room.id,expectedRevision:room.revision,polygons:shifted,transform:{dx:1.524,dy:0,scale:1,angle:0,origin:{x:0,y:0}}});
 assert.equal(x.store.drawing(x.w.token).paths[0].status,'stale');assert.equal(x.store.drawing(x.w.token).passages.find(p=>p.id===passage.id).assigned,false);await x.store.backup(path.join(x.dir,'stale.sqlite'));
});
for(const table of ['dungeon_path','dungeon_passage'])test(`a malformed historical ${table} cannot replace a good backup`,async t=>{
 const x=fixture(t);x.publish();const view=x.store.drawing(x.w.token);if(table==='dungeon_path')x.send({kind:'path-convert',id:view.paths[0].id,expectedRevision:view.paths[0].revision});else x.send({kind:'passage',passage:{...view.passages[0],assigned:false},expectedRevision:view.passages[0].revision});
 const safe=path.join(x.dir,'safe.sqlite');await x.store.backup(safe);const bytes=readFileSync(safe),row=x.store.db.prepare('SELECT * FROM drawing_history ORDER BY ordinal DESC LIMIT 1').get(),history=JSON.parse(row.payload),state=history.changes.find(d=>d.key.table===table).before,p=JSON.parse(state.payload);if(table==='dungeon_path')p.segments[0].heightSteps=0;else p.inbound.additionalSeconds=-1;state.payload=JSON.stringify(p);state.checksum=sha(state.payload);const payload=JSON.stringify(history);x.store.db.prepare('UPDATE drawing_history SET payload=?,checksum=? WHERE ordinal=?').run(payload,sha(payload),row.ordinal);
 const before=x.rows();assert.ok(x.store.drawing(x.w.token).paths.length);await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(bytes));assert.deepEqual(x.rows(),before);await assert.rejects(x.store.campaignSnapshot(x.w.token,path.join(x.dir,'reject.sqlite')));
});
test('a late passage write failure rolls back generated rooms, volumes and history together',t=>{
 const x=fixture(t),preview=x.preview(),before=x.rows();x.store.db.exec("CREATE TRIGGER refuse_path_passage BEFORE INSERT ON dungeon_passage BEGIN SELECT RAISE(ABORT,'Controlled passage refusal'); END;");assert.throws(()=>x.send({kind:'path-publish',preview,expectedRevision:null}),/Controlled passage refusal/);assert.deepEqual(x.rows(),before);
});

test('renaming and widening a path keeps one room/key and all prose through Undo and Redo',t=>{
 const x=fixture(t);x.publish();let view=x.store.drawing(x.w.token),p=view.paths[0],room=x.store.workspace().rooms.find(r=>r.id===p.roomId);
 x.send({kind:'key-batch',rooms:[{id:room.id,expectedRevision:room.revision,keyRevision:null}],patch:{gmNotes:{mode:'replace',text:'  Prepared key prose\r\n'}}});
 room=x.store.workspace().rooms.find(r=>r.id===p.roomId);const sections=room.sections,key=x.store.drawing(x.w.token).keyContent.find(k=>k.id===room.id),roomCount=x.store.workspace().rooms.length;
 p=x.store.drawing(x.w.token).paths[0];const changed=x.preview({...p,name:'Broad watch corridor',segments:p.segments.map(s=>({...s,widthSteps:2}))});
 x.send({kind:'path-publish',preview:changed,expectedRevision:p.revision});
 const inspect=()=>{const v=x.store.drawing(x.w.token);return{path:v.paths[0],room:x.store.workspace().rooms.find(r=>r.id===p.roomId),key:v.keyContent.find(k=>k.id===p.roomId)};};
 let saved=inspect();assert.equal(saved.path.name,'Broad watch corridor');assert.equal(saved.room.name,saved.path.name);assert.equal(saved.key.name,saved.path.name);assert.equal(x.store.workspace().rooms.length,roomCount);assert.deepEqual(saved.room.sections,sections);assert.deepEqual(saved.key.blocks,key.blocks);assert.equal(saved.path.roomId,p.roomId);assert.equal(saved.path.volumeId,p.volumeId);assert.equal(saved.path.fromPassageId,p.fromPassageId);assert.equal(saved.path.segments[0].widthSteps,2);assert.equal(saved.path.notes,p.notes);
 const raw=JSON.parse(x.store.db.prepare('SELECT payload FROM dungeon_path WHERE campaign_id=? AND id=?').get(x.campaign.id,p.id).payload);assert.equal(Object.hasOwn(raw,'roomNameBasis'),false);
 x.store.history(x.w.token,'undo');saved=inspect();assert.equal(saved.room.name,p.name);assert.equal(saved.path.name,p.name);assert.equal(saved.path.segments[0].widthSteps,1);assert.deepEqual(saved.key.blocks,key.blocks);
 x.store.history(x.w.token,'redo');saved=inspect();assert.equal(saved.key.name,'Broad watch corridor');assert.equal(saved.path.name,saved.key.name);assert.deepEqual(saved.key.blocks,key.blocks);assert.deepEqual(saved.room.sections,sections);
});
test('a room rename is immediately reflected in the existing path editor and survives room Undo',t=>{
 const x=fixture(t);x.publish();const p=x.store.drawing(x.w.token).paths[0],room=x.store.workspace().rooms.find(r=>r.id===p.roomId);
 x.store.edit({commandId:randomUUID(),token:x.w.token,campaignId:x.campaign.id,roomId:room.id,expectedRevision:room.revision,name:'Name from room key',polygons:room.polygons,sections:room.sections});
 assert.equal(x.store.drawing(x.w.token).paths[0].name,'Name from room key');assert.equal(x.store.drawing(x.w.token).paths[0].roomNameBasis,'Name from room key');
 x.store.history(x.w.token,'undo');assert.equal(x.store.drawing(x.w.token).paths[0].name,p.name);
});
for(const timing of ['before preview','after preview'])test(`a foreign generated-room rename ${timing} cannot be overwritten by an older path form`,t=>{
 const x=fixture(t);x.publish();const p=x.store.drawing(x.w.token).paths[0],room=x.store.workspace().rooms.find(r=>r.id===p.roomId),request={...p,name:'My unconfirmed rename'};
 const preview=timing==='after preview'?x.preview(request):null;
 x.store.edit({commandId:randomUUID(),token:x.w.token,campaignId:x.campaign.id,roomId:room.id,expectedRevision:room.revision,name:'Protected peer name',polygons:room.polygons,sections:room.sections});
 const rows=x.rows();if(preview)assert.throws(()=>x.send({kind:'path-publish',preview,expectedRevision:p.revision}),/Gangname.*geändert/);else assert.throws(()=>x.preview(request),/Gangname.*geändert/);
 assert.equal(x.store.workspace().rooms.find(r=>r.id===room.id).name,'Protected peer name');assert.deepEqual(x.rows(),rows);
});

buildSync({entryPoints:['src/app/path-spatial.ts'],outfile:'.build/path-store-spatial.cjs',bundle:true,platform:'node',format:'cjs'});
const {passageOpening}=createRequire(import.meta.url)('../.build/path-store-spatial.cjs');
test('two-field passage permits the far half of the real floor and rejects the empty half-field beside it',t=>{
 const x=fixture(t),preview=x.preview({...x.input,segments:[{...x.input.segments[0],widthSteps:2}]});x.send({kind:'path-publish',preview,expectedRevision:null});
 const g=x.store.dungeon(x.w.token),p=g.drawing.passages.find(p=>p.roomId===x.rooms[0].id),edge=preview.fromWorld;
 for(const kind of ['move','sight','sound','light']){
  assert.ok(passageOpening(g,p.roomId,p.otherRoomId,{x:edge.x,y:2.8,z:.1},kind));
  assert.equal(passageOpening(g,p.roomId,p.otherRoomId,{x:edge.x,y:-.3,z:.1},kind),null);
 }
 const closed={...g,drawing:{...g.drawing,passages:g.drawing.passages.map(q=>q.id===p.id?{...q,outbound:{...q.outbound,passable:false}}:q)}};
 assert.equal(passageOpening(closed,p.roomId,p.otherRoomId,{x:edge.x,y:2.8,z:.1},'move'),null);
});
