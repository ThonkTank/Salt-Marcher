import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/free-room-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/free-room-store.cjs');

function fixture(t){
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(base+'/free-rooms-');let store=new CampaignStore(dir+'/campaign.sqlite');
 const campaign=store.create('Freie Raumkonturen');let token=store.activateShell(campaign.id).token;
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 return {get store(){return store;},draw(action){const commandId=randomUUID(),command={commandId,token,campaignId:campaign.id,action};return store.executeAtlasCommit({...command,action:{kind:'drawing',command}});},
  history(kind){store.executeAtlasCommit({commandId:randomUUID(),token,campaignId:campaign.id,action:{kind}});},
  room(id){return store.workspace().rooms.find(r=>r.id===id);},volumes(){return store.drawing(token).volumes;},
  fresh(){store.close();store=new CampaignStore(dir+'/campaign.sqlite');token=store.activateShell(campaign.id).token;}};
}
const polygon=(outer,holes=[])=>({outer:outer.map(([x,y])=>({x,y})),holes:holes.map(r=>r.map(([x,y])=>({x,y})))});
const shapes={
 large:[polygon([[-500.125,-500.375],[999.875,1.125],[300.625,700.875]])],
 diagonal:[polygon([[.125,.375],[9.875,1.125],[7.625,8.875]],[[[3,3],[4,3],[4,4],[3,4]]])],
 narrow:[polygon([[.1,.1],[.35,.1],[.2,.4]])],
 disconnected:[polygon([[-12.25,-8.5],[-9.75,-8.5],[-10.125,-5.625]]),polygon([[2.25,3.5],[5.125,3.5],[4.25,6.875]])],
};
for(const [name,polygons]of Object.entries(shapes))test(`free room ${name} keeps exact contours, holes and one identity across history and reopening`,t=>{
 const f=fixture(t),source=structuredClone(polygons);
 f.draw({kind:'create-room',scopeId:'local',floorId:'ground',name,polygons});
 const created=f.store.workspace().rooms.find(r=>r.name===name);assert(created);
 assert.deepEqual(created.polygons,source);assert.equal(f.volumes().length,0);assert.deepEqual(polygons,source);
 f.history('undo');assert.equal(f.room(created.id),undefined);
 f.history('redo');assert.deepEqual(f.room(created.id).polygons,source);
 f.fresh();assert.deepEqual(f.room(created.id).polygons,source);assert.equal(f.volumes().length,0);
 const moved=source.map(p=>({outer:p.outer.map(p=>({x:p.x+.333,y:p.y-.217})),holes:p.holes.map(r=>r.map(p=>({x:p.x+.333,y:p.y-.217})))}));
 f.draw({kind:'shape',roomId:created.id,expectedRevision:f.room(created.id).revision,polygons:moved});
 assert.deepEqual(f.room(created.id).polygons,moved);assert.equal(f.volumes().length,0);
 f.history('undo');assert.deepEqual(f.room(created.id).polygons,source);
});

test('explicit volume initialization remains a separate reversible command',t=>{
 const f=fixture(t),polygons=shapes.diagonal;
 f.draw({kind:'create-room',scopeId:'local',floorId:'ground',name:'Volumenwahl',polygons});
 const room=f.store.workspace().rooms.find(r=>r.name==='Volumenwahl');assert(room);assert.equal(f.volumes().length,0);
 f.draw({kind:'volume-initialize',roomId:room.id,expectedRoomRevision:room.revision,expectedVolumeRevision:null,heightSteps:2});
 assert.equal(f.volumes().length,1);const volume=f.volumes()[0],raster=f.room(room.id).polygons;
 assert.equal(volume.roomId,room.id);assert.notDeepEqual(raster,polygons);
 f.history('undo');assert.equal(f.volumes().length,0);assert.deepEqual(f.room(room.id).polygons,polygons);
 f.history('redo');assert.equal(f.volumes()[0].id,volume.id);assert.deepEqual(f.room(room.id).polygons,raster);
 f.fresh();assert.equal(f.volumes()[0].id,volume.id);assert.deepEqual(f.room(room.id).polygons,raster);
});

test('free room creation rejects a missing floor atomically',t=>{
 const f=fixture(t),before=f.store.db.serialize();
 assert.throws(()=>f.draw({kind:'create-room',scopeId:'local',floorId:'missing',name:'Ungültig',polygons:shapes.diagonal}),/Geschoss/);
 assert.deepEqual(f.store.db.serialize(),before);
});
