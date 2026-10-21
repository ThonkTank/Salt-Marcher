import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
buildSync({entryPoints:['src/app/room-group-generator.ts','src/app/storage/store.ts','src/app/drawing-model.ts','src/app/dungeon-model.ts','src/app/spatial-3d.ts'],outdir:'.build/room-groups',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'},external:['better-sqlite3']});
const require=createRequire(import.meta.url),{generateRoomGroup,GROUP_PROFILES}=require('../.build/room-groups/room-group-generator.cjs'),{CampaignStore}=require('../.build/room-groups/storage/store.cjs'),{inside,anchored}=require('../.build/room-groups/drawing-model.cjs');
const {planDungeon}=require('../.build/room-groups/dungeon-model.cjs'),{poseOwner}=require('../.build/room-groups/spatial-3d.cjs');
const recipe=(profile='Taverne',seed='silberner-ast')=>({version:1,profile,width:16,depth:18,seed});
function fixture(t){const dir=mkdtempSync(tmpdir()+'/room-groups-');let store=new CampaignStore(dir+'/workbench.sqlite'),cam=store.create('Raumgruppen'),w=store.activate(cam.id);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return{get store(){return store;},get w(){return w;},cam,dir,read:()=>store.campaignAtlas(w.token),write:action=>{const commandId=randomUUID();if(action.command)action.command.commandId=commandId;if(action.edit)action.edit.commandId=commandId;return store.executeAtlas({commandId,token:w.token,campaignId:cam.id,action});},fresh:()=>{store.close();store=new CampaignStore(dir+'/workbench.sqlite');w=store.activate(cam.id);}};}
test('all profiles generate reproducible furnished rooms with reachable doors and floors',()=>{
 for(const profile of GROUP_PROFILES){const a=generateRoomGroup('group',recipe(profile));assert.deepEqual(a,generateRoomGroup('group',recipe(profile)));assert.notDeepEqual(a,generateRoomGroup('group',recipe(profile,'other')));assert(a.rooms.length>1);assert(a.elements.some(e=>e.kind==='object'));
  const reached=new Set([a.rooms.find(r=>r.floorId==='ground'&&a.elements.some(e=>e.name==='Eingang'&&e.roomId===r.id)).id]);let changed=true;while(changed){changed=false;for(const e of a.elements.filter(e=>['door','stairs'].includes(e.kind)&&e.targetRoomId))if(reached.has(e.roomId)||reached.has(e.targetRoomId)){const n=reached.size;reached.add(e.roomId);reached.add(e.targetRoomId);changed||=reached.size!==n;}}assert.equal(reached.size,a.rooms.length,profile);
  for(const e of a.elements.filter(e=>e.kind==='object')){const r=a.rooms.find(r=>r.id===e.roomId);for(const dx of [-e.width/2,e.width/2])for(const dy of [-e.height/2,e.height/2])assert(inside({x:e.points[0].x+dx*Math.cos(e.angle*Math.PI/180)-dy*Math.sin(e.angle*Math.PI/180),y:e.points[0].y+dx*Math.sin(e.angle*Math.PI/180)+dy*Math.cos(e.angle*Math.PI/180)},r.polygons),profile+' '+e.name);}
 }
});
test('type controls automatic floors; explicit overrides and small footprints remain valid',()=>{
 assert.equal(generateRoomGroup('a',recipe('Taverne')).floors.length,3);assert.equal(generateRoomGroup('a',recipe('Lager')).floors.length,1);
 assert.equal(generateRoomGroup('a',{...recipe(),floors:1,basement:false}).floors.length,1);
 for(const profile of GROUP_PROFILES)assert(generateRoomGroup('tiny',{...recipe(profile),width:3,depth:3}).rooms.length>=1);
 assert.throws(()=>generateRoomGroup('bad',{...recipe(),width:0}));
});
test('generation is an atomic Atlas edit with fresh reopen and independent campaign transfer',async t=>{
 const x=fixture(t),result=x.write({kind:'group-generate',name:'Zum Silbernen Ast',x:20,y:40,recipe:recipe()}),id=result.result.id;
 const snapshot=x.read(),rooms=snapshot.workspace.rooms.filter(r=>r.scopeId===id);assert(rooms.length>5);assert(snapshot.geometry.drawing.elements.some(e=>e.scopeId===id&&e.kind==='stairs'));
 x.write({kind:'undo'});assert.equal(x.read().workspace.rooms.filter(r=>r.scopeId===id).length,0);
 x.write({kind:'redo'});assert.deepEqual(x.read().workspace.rooms.filter(r=>r.scopeId===id).map(r=>r.id),rooms.map(r=>r.id));x.fresh();assert.equal(x.read().workspace.rooms.length,rooms.length);
 const target=x.dir+'/transfer.sqlite';await x.store.campaignSnapshot(x.w.token,target);const copy=x.store.acceptCampaignSnapshot(target,'Kopie',{});const copied=x.store.activate(copy.id);assert.equal(copied.rooms.length,rooms.length);assert(!copied.rooms.some(r=>rooms.some(original=>original.id===r.id)));
});
test('city houses ARE their room groups and wall changes update derived outer shape',t=>{
 const x=fixture(t),c=x.write({kind:'city-create',name:'Hafen',x:0,y:0,width:500,height:500}).atlas.cities[0],id=randomUUID();
 const u={id,kind:'building',name:'Taverne',protected:false,position:{x:30,y:40},angle:0,outline:[{x:-8,y:-9},{x:8,y:-9},{x:8,y:9},{x:-8,y:9}],use:'Taverne',notes:'',groupRecipe:recipe()};
 const commandId=randomUUID();x.write({kind:'city',command:{commandId,token:x.w.token,campaignId:x.cam.id,cityId:c.header.id,expectedRevision:c.header.revision,action:{kind:'change',upsert:[u],remove:[],label:'Haus erzeugen'}}});
 const a=x.read(),house=a.cities[0].units.find(u=>u.id===id);assert.equal(house.groupId,id);assert(a.workspace.rooms.some(r=>r.scopeId===id));assert.equal(a.bindings.find(b=>b.ownerId===id).parentId,id);
 const room=a.workspace.rooms.find(r=>r.scopeId===id&&r.floorId==='ground'&&r.polygons[0].outer.some(p=>p.x===8));
 const changed=structuredClone(room);changed.polygons[0].outer=changed.polygons[0].outer.map(p=>({...p,x:p.x===8?10:p.x}));
 const editId=randomUUID();x.write({kind:'room-edit',edit:{commandId:editId,token:x.w.token,campaignId:x.cam.id,roomId:room.id,expectedRevision:room.revision,name:room.name,sections:room.sections,polygons:changed.polygons}});
 assert.equal(Math.max(...x.read().cities[0].units.find(u=>u.id===id).outline.map(p=>p.x)),10);assert(x.read().cities[0].units.find(u=>u.id===id).protected);
 x.write({kind:'undo'});assert.equal(Math.max(...x.read().cities[0].units.find(u=>u.id===id).outline.map(p=>p.x)),8);x.fresh();assert.equal(x.read().cities[0].units.find(u=>u.id===id).groupId,id);
});

test('furnished tavern has a bed in every guest room and an actual walkable route to every room',()=>{
 const a=generateRoomGroup('group',recipe()),g={rooms:a.rooms,floors:a.floors.map(f=>({...f,scopeId:'group'})),drawing:{elements:a.elements,styles:[],volumes:[],paths:[],passages:[],hiddenRooms:[],hiddenFloors:[],features:[]}};
 const start=poseOwner(g,{x:0,y:-7.5,z:0,scopeId:'group'},'walk');
 for(const room of a.rooms){if(room.name==='Gästezimmer')assert(a.elements.some(e=>e.roomId===room.id&&e.variant==='bed'),'Guest room needs its bed');const p=room.polygons[0].outer,x=(Math.min(...p.map(p=>p.x))+Math.max(...p.map(p=>p.x)))/2,y=(Math.min(...p.map(p=>p.y))+Math.max(...p.map(p=>p.y)))/2,z=a.floors.find(f=>f.id===room.floorId).elevation,end=poseOwner(g,{x,y,z,scopeId:'group'},'walk',room.id);assert(end);assert(planDungeon(g,start,end).length>0,room.floorId+' '+room.name);}
});
test('whole-group scaling preserves identities, room prose, furniture and floor elevations through undo',t=>{
 const x=fixture(t),id=x.write({kind:'group-generate',name:'Taverne',x:0,y:0,recipe:recipe()}).result.id,before=x.read();x.write({kind:'group-scale',scopeId:id,factor:1.5});const after=x.read();
 assert.deepEqual(after.workspace.floors,before.workspace.floors);assert.deepEqual(after.workspace.rooms.map(r=>r.id),before.workspace.rooms.map(r=>r.id));for(let i=0;i<after.workspace.rooms.length;i++){assert.deepEqual(after.workspace.rooms[i].sections,before.workspace.rooms[i].sections);assert.equal(after.workspace.rooms[i].polygons[0].outer[0].x,before.workspace.rooms[i].polygons[0].outer[0].x*1.5);}
 const old=before.geometry.drawing.elements.find(e=>e.kind==='object'),next=after.geometry.drawing.elements.find(e=>e.id===old.id);assert.equal(next.width,old.width*1.5);assert.equal(next.points[0].x,old.points[0].x*1.5);x.write({kind:'undo'});assert.equal(x.read().geometry.drawing.elements.find(e=>e.id===old.id).width,old.width);
});
test('room split retains authored identity/prose and moves furniture without duplication, with undo',t=>{
 const x=fixture(t),id=x.write({kind:'group-generate',name:'Haus',x:0,y:0,recipe:{...recipe('Wohnhaus'),width:6,depth:6,floors:1,basement:false}}).result.id,before=x.read(),room=before.workspace.rooms[0],count=before.geometry.drawing.elements.length;
 const commandId=randomUUID();x.write({kind:'room-edit',edit:{commandId,token:x.w.token,campaignId:x.cam.id,roomId:room.id,expectedRevision:room.revision,name:'Wohnküche',polygons:room.polygons,sections:room.sections.map(s=>({...s,markdown:'Originale Beschreibung'}))}});
 const original=x.read().workspace.rooms[0],newId=x.write({kind:'group-room-split',roomId:original.id,expectedRevision:original.revision,axis:'x',ratio:.4}).result.id,after=x.read();assert.equal(after.workspace.rooms.filter(r=>r.scopeId===id).length,2);assert.equal(after.workspace.rooms.find(r=>r.id===room.id).sections[0].markdown,'Originale Beschreibung');assert.equal(after.workspace.rooms.find(r=>r.id===newId).sections[0].markdown,'');assert.equal(after.geometry.drawing.elements.length,count);for(const door of before.geometry.drawing.elements.filter(e=>e.kind==='door'))assert.deepEqual(anchored(after.geometry.drawing.elements.find(e=>e.id===door.id),after.workspace.rooms),anchored(door,before.workspace.rooms),'split preserves physical door position');x.write({kind:'undo'});assert.equal(x.read().workspace.rooms.length,1);assert.deepEqual(x.read().workspace.rooms[0].polygons,room.polygons);
});
test('failed generation rolls back every child and generated replacements preserve protected work',t=>{
 const x=fixture(t);assert.throws(()=>x.write({kind:'group-generate',name:'Ungültig',x:0,y:0,recipe:{...recipe(),width:0}}));assert.equal(x.read().workspace.rooms.length,0);assert.equal(x.store.db.prepare('SELECT count(*) n FROM room_group').get().n,0);
 const c=x.write({kind:'city-create',name:'Stadt',x:0,y:0,width:500,height:500}).atlas.cities[0],id=randomUUID(),u={id,kind:'building',name:'Haus',protected:false,position:{x:30,y:40},angle:0,outline:[{x:-8,y:-9},{x:8,y:-9},{x:8,y:9},{x:-8,y:9}],use:'Taverne',notes:'',groupRecipe:recipe()};
 const change=(upsert,remove,extra={})=>x.write({kind:'city',command:{commandId:randomUUID(),token:x.w.token,campaignId:x.cam.id,cityId:c.header.id,expectedRevision:x.read().cities[0].header.revision,action:{kind:'change',upsert,remove,label:'Bebauung',...extra}}});
 change([u],[]);const first=x.read().workspace.rooms.map(r=>r.id);change([{...u,groupRecipe:recipe('Wohnhaus','replacement')}],[id]);assert.notDeepEqual(x.read().workspace.rooms.map(r=>r.id),first);x.write({kind:'undo'});assert.deepEqual(x.read().workspace.rooms.map(r=>r.id),first);
 x.write({kind:'group-scale',scopeId:id,factor:1.1});assert.throws(()=>change([u],[id]),/geschützt/);assert(x.read().workspace.rooms.length>0);change([],[id],{removeGroups:true});assert.equal(x.read().cities[0].units.length,0);assert.equal(x.read().workspace.rooms.length,0);x.write({kind:'undo'});assert(x.read().workspace.rooms.length>0);
});

test('splitting a furnished tavern room keeps boundary doors at the same world coordinates',t=>{
 const x=fixture(t);x.write({kind:'group-generate',name:'Taverne',x:0,y:0,recipe:recipe()});const before=x.read(),room=before.workspace.rooms.find(r=>r.name==='Schankraum');
 x.write({kind:'group-room-split',roomId:room.id,expectedRevision:room.revision,axis:'x',ratio:.5});const after=x.read();
 const ends=(e,rooms)=>anchored(e,rooms).map(p=>({x:Math.round(p.x*1e6),y:Math.round(p.y*1e6)})).sort((a,b)=>a.x-b.x||a.y-b.y);
 for(const door of before.geometry.drawing.elements.filter(e=>e.kind==='door'))assert.deepEqual(ends(after.geometry.drawing.elements.find(e=>e.id===door.id),after.workspace.rooms),ends(door,before.workspace.rooms),door.id);
});

test('the shared drawing command adds an exact free room to a building and updates its derived hull through history',t=>{
 const x=fixture(t),city=x.write({kind:'city-create',name:'Ablage',x:0,y:0,width:100,height:100}).atlas.cities[0],id=randomUUID();
 const unit={id,kind:'building',name:'Werkstatt',protected:false,position:{x:20,y:30},angle:0,outline:[{x:-6,y:-6},{x:6,y:-6},{x:6,y:6},{x:-6,y:6}],use:'Werkstatt',notes:'',groupRecipe:{...recipe('Werkstatt'),width:12,depth:12,floors:1,basement:false}};
 x.write({kind:'city',command:{commandId:randomUUID(),token:x.w.token,campaignId:x.cam.id,cityId:city.header.id,expectedRevision:city.header.revision,action:{kind:'change',upsert:[unit],remove:[],label:'Werkstatt'}}});
 const house=()=>x.read().cities[0].units.find(u=>u.id===id),before=structuredClone(house().footprint),polygons=[{outer:[{x:5.5,y:1.125},{x:9.125,y:1.75},{x:5.5,y:4.375}],holes:[]}];
 x.write({kind:'drawing',command:{commandId:randomUUID(),token:x.w.token,campaignId:x.cam.id,action:{kind:'create-room',scopeId:id,floorId:'ground',name:'Freier Anbau',polygons}}});
 const added=x.read().workspace.rooms.find(r=>r.name==='Freier Anbau');assert(added);assert.deepEqual(added.polygons,polygons);
 assert.equal(Math.max(...house().footprint.flatMap(p=>p.outer.map(p=>p.x))),9.125);assert(house().protected);
 assert(!x.read().geometry.drawing.volumes.some(v=>v.roomId===added.id));
 x.write({kind:'undo'});assert.deepEqual(house().footprint,before);assert(!x.read().workspace.rooms.some(r=>r.id===added.id));
 x.write({kind:'redo'});x.fresh();assert.deepEqual(x.read().workspace.rooms.find(r=>r.id===added.id).polygons,polygons);
 assert.equal(Math.max(...house().footprint.flatMap(p=>p.outer.map(p=>p.x))),9.125);
});
