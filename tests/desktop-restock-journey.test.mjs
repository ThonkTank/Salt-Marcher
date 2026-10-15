import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/restock-journey-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/restock-journey-store.cjs');
function fixture(t,overflow=false){
 const root=mkdtempSync(path.join(tmpdir(),'restock-journey-')),file=path.join(root,'source.sqlite'),x={root,file,store:new CampaignStore(file)};
 t.after(()=>{x.store.close();rmSync(root,{recursive:true,force:true});});x.cam=x.store.create('Zwei Reiseuhren');x.w=x.store.activate(x.cam.id);x.command=action=>({commandId:randomUUID(),campaignId:x.cam.id,token:x.w.token,action});
 const location={kind:'location',version:1,id:randomUUID(),name:'Markt',type:'poi',sections:[],detailMaps:[],keyLinks:[]};x.store.changePreparation({...x.command(null),change:{kind:'location',document:location,expectedRevision:null}});
 const definition=x.store.executeItemShop(x.command({kind:'definition',expectedRevision:null,definition:{id:randomUUID(),revision:0,name:'Seil',category:'equipment',magic:false,rarity:'',attunement:'no',unitCopper:'100',weightText:'',properties:[],description:'',source:{kind:'authored',label:'GM',license:null,url:null},trashed:false}})).definition;
 const characters=['Vorhut','Nachhut'].map(name=>x.store.executeLive(x.command({kind:'create-character',profile:{name}})).character);
 for(const c of characters){const live=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:live.focusRevision}));}
 x.a=x.store.executeLive(x.command({kind:'initialize',expectedRosterRevision:x.store.live(x.w.token).rosterRevision})).scene.id;const a=x.store.liveScene(x.w.token,x.a),live=x.store.live(x.w.token);
 x.b=x.store.executeLive(x.command({kind:'move',sceneId:x.a,memberIds:[characters[1].id],expectedRosterRevision:live.rosterRevision,expectedFocusRevision:live.focusRevision,expectedClockRevision:a.clock.revision,expectedSceneMembershipRevision:a.membershipRevision,target:{kind:'new',title:'Nachhut',expectedContentRevision:a.revision}})).session.createdScene.id;
 const mapId=randomUUID();x.store.executeWorld(x.command({kind:'map',expectedRevision:null,map:{id:mapId,revision:0,name:'Weg',hexMeters:1000,climate:'temperate',seed:'fixed',cells:[]}}));
 const b=x.store.liveScene(x.w.token,x.b);x.store.executeWorld(x.command({kind:'place-scene',sceneId:x.b,position:{mapId:mapId,q:0,r:0,locationId:null},expectedSceneRevision:b.revision,expectedPositionRevision:x.store.sceneWorld(x.w.token,x.b).position.revision}));
 const preview=x.store.previewTravel(x.w.token,{sceneId:x.b,mapId,destination:{q:3,r:0},destinationLocationId:null,waypoints:[],paceKmh:1,factor:1,finalSeconds:9});assert.deepEqual(preview.segmentSeconds,[3,3,3]);
 x.journey=x.store.executeWorld(x.command({kind:'journey',preview})).scene.journey;
 const entry=(id,quantity,restock)=>({id,reference:{kind:'authored',definitionId:definition.id,revision:definition.revision},quantity,unique:false,instanceId:null,buyCopper:'100',sellCopper:'50',notes:'  Original\r\n',restock});
 x.shop=x.store.executeItemShop(x.command({kind:'shop',expectedRevision:null,shop:{id:randomUUID(),revision:0,name:'Marktstand',owner:{kind:'location',id:location.id},notes:'  Bleibt\r\n',trashed:false,stock:[entry('add',0,{mode:'add',quantity:1,intervalMs:'1000',nextDueMs:'1000'}),entry('fill',overflow?999998:0,{mode:overflow?'add':'fill',quantity:overflow?3:5,intervalMs:'5000',nextDueMs:'5000'}),entry('manual',13,null)]}})).shop.shop;
 x.step=maxSteps=>x.command({kind:'journey-step',id:x.journey.id,expectedRevision:x.journey.revision,maxSteps});
 x.history=()=>x.store.shop(x.w.token,x.shop.id).history.filter(e=>e.facts?.intervals!==undefined);
 x.reopen=()=>{x.store.close();x.store=new CampaignStore(file);x.w=x.store.activate(x.cam.id);};return x;
}
test('journey restock survives another scene catching up, replay, restart and an independent copy',async t=>{
 const x=fixture(t),step=x.step(2),focus=x.store.live(x.w.token).focusId;
 const result=x.store.executeWorld(step);assert.equal(result.scene.scene.id,x.b);assert.equal(x.store.live(x.w.token).focusId,focus);assert.equal(x.store.liveScene(x.w.token,x.a).clock.instantMs,'0');assert.equal(result.scene.scene.clock.instantMs,'6000');
 assert.deepEqual(x.store.shop(x.w.token,x.shop.id).shop.stock.map(e=>e.quantity),[6,5,13]);
 const beforeHistory=x.history();assert.equal(beforeHistory.length,3);assert.deepEqual(beforeHistory.map(e=>[e.facts.firstDueMs,e.facts.lastDueMs,e.facts.intervals]),[['5000','5000','1'],['4000','6000','3'],['1000','3000','3']]);
 let shop=x.store.shop(x.w.token,x.shop.id).shop;x.store.executeItemShop(x.command({kind:'restock',shopId:shop.id,expectedRevision:shop.revision,entryId:'add',mode:'add',quantity:7,reason:'Explizite Korrektur'}));
 shop=x.store.shop(x.w.token,x.shop.id).shop;x.store.executeItemShop(x.command({kind:'shop',shop:{...shop,stock:shop.stock.map(e=>e.id==='add'?{...e,restock:{...e.restock,quantity:2}}:e)},expectedRevision:shop.revision}));
 const scene=x.store.liveScene(x.w.token,x.a);x.store.executeLive(x.command({kind:'advance-clock',sceneId:x.a,expectedRevision:scene.clock.revision,amount:6,unit:'seconds',calendarVersion:'relative-v1',reason:'Nachholen'}));assert.deepEqual(x.history(),beforeHistory);
 const state=x.store.shop(x.w.token,x.shop.id);x.reopen();x.store.executeWorld({...step,token:x.w.token});assert.deepEqual(x.store.shop(x.w.token,x.shop.id),state);
 const snapshot=path.join(x.root,'snapshot.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const bytes=readFileSync(snapshot),source=x.store.db.serialize(),copyFile=path.join(x.root,'copy.sqlite');let copy=new CampaignStore(copyFile),campaign=copy.acceptCampaignSnapshot(snapshot,'Unabhängig',{}),w=copy.activate(campaign.id);
 try{
  const shopId=copy.shops(w.token,false)[0].id,b=copy.live(w.token).scenes.find(s=>s.title==='Nachhut').id,j=copy.sceneWorld(w.token,b).journey;
  assert.notEqual(shopId,x.shop.id);assert.notEqual(b,x.b);assert.notEqual(j.id,x.journey.id);
  assert.deepEqual(copy.shop(w.token,shopId).shop.stock.map(e=>[e.quantity,e.restock?.nextDueMs??null]),[[13,'7000'],[5,'10000'],[13,null]]);
  const next={commandId:randomUUID(),campaignId:campaign.id,token:w.token,action:{kind:'journey-step',id:j.id,expectedRevision:j.revision,maxSteps:1}};copy.executeWorld(next);
  const final=copy.shop(w.token,shopId);assert.deepEqual(final.shop.stock.map(e=>e.quantity),[19,5,13]);assert.equal(copy.liveScene(w.token,b).clock.instantMs,'9000');assert.equal(final.history.filter(e=>e.facts?.intervals!==undefined).length,4);assert.equal(final.history.find(e=>e.facts?.lastDueMs==='9000').facts.rule.quantity,2);
  copy.close();copy=new CampaignStore(copyFile);w=copy.activate(campaign.id);copy.executeWorld({...next,token:w.token});assert.deepEqual(copy.shop(w.token,shopId),final);
  assert.ok(x.store.db.serialize().equals(source));assert.ok(readFileSync(snapshot).equals(bytes));
 }finally{copy.close();}
});
test('a later segment restock failure rolls back earlier journey segments and every clock receipt',t=>{
 const x=fixture(t,true),step=x.step(2),before=x.store.db.serialize();assert.throws(()=>x.store.executeWorld(step),/Bestandsgrenze/);assert.ok(x.store.db.serialize().equals(before));
 assert.equal(x.store.sceneWorld(x.w.token,x.b).journey.nextIndex,1);assert.equal(x.store.liveScene(x.w.token,x.b).clock.instantMs,'0');assert.equal(x.store.sceneWorld(x.w.token,x.b).position.q,0);assert.equal(x.history().length,0);
 assert.equal(x.store.db.prepare('SELECT 1 FROM world_receipt WHERE command_id=?').get(step.commandId),undefined);assert.equal(x.store.db.prepare('SELECT 1 FROM live_receipt WHERE command_id LIKE ?').get(step.commandId+':clock:%'),undefined);
});

for(const [name,damage] of [
 ['nonadjacent route',j=>{j.route[1]={q:50,r:0};}],
 ['negative segment',j=>{j.segmentSeconds[0]=-1;}],
 ['missing segment',j=>{j.segmentSeconds.pop();}],
 ['contradictory duration',j=>{j.plannedSeconds++;}],
 ['rounded total',j=>{j.segmentSeconds=[Number.MAX_SAFE_INTEGER,2,2];j.plannedSeconds=j.segmentSeconds.reduce((sum,n)=>sum+n,0);j.finalSeconds=null;}],
 ['invalid checkpoint',j=>{j.nextIndex=0;}],
 ['early arrival',j=>{j.status='arrived';}],
])for(const boundary of ['read','write','backup'])test(`stored journey ${name} is rejected at the ${boundary} boundary without replacing original data`,async t=>{
 const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const safeBytes=readFileSync(safe),broken=structuredClone(x.journey);damage(broken);const payload=JSON.stringify(broken);
 x.store.db.prepare('UPDATE world_journey SET status=?,payload=?,checksum=? WHERE campaign_id=? AND id=?').run(broken.status,payload,createHash('sha256').update(payload).digest('hex'),x.cam.id,x.journey.id);const original=x.store.db.serialize();
 if(boundary==='read')assert.throws(()=>x.store.sceneWorld(x.w.token,x.b),/Reise|Route|Abschnitt|Zeit|Checkpoint/);
 else if(boundary==='write')assert.throws(()=>x.store.executeWorld(x.command({kind:'journey-state',id:x.journey.id,expectedRevision:x.journey.revision,state:'ended'})),/Reise|Route|Abschnitt|Zeit|Checkpoint/);
 else{await assert.rejects(()=>x.store.backup(safe),/Reise|Route|Abschnitt|Zeit|Checkpoint/);assert.ok(readFileSync(safe).equals(safeBytes));}
 assert.ok(x.store.db.serialize().equals(original));
});

for(const state of ['paused','ended','arrived','interrupted-at-destination'])test(`valid journey ${state} stays readable through backup and restart`,async t=>{
 const x=fixture(t);
 if(state==='paused'||state==='ended')x.store.executeWorld(x.command({kind:'journey-state',id:x.journey.id,expectedRevision:x.journey.revision,state}));
 else{
  if(state==='interrupted-at-destination'){
   const map=x.store.world(x.w.token).maps[0];x.store.executeWorld(x.command({kind:'cell',mapId:map.id,expectedRevision:map.revision,cell:{q:3,r:0,level:0,terrain:'plains',elevationM:0,climate:null,road:false,river:false,label:'',faction:'',interrupt:'GM-Entscheidung am Ziel'}}));
   const preview=x.store.previewTravel(x.w.token,{sceneId:x.b,mapId:map.id,destination:{q:3,r:0},destinationLocationId:null,waypoints:[],paceKmh:1,factor:1,finalSeconds:9});x.journey=x.store.executeWorld(x.command({kind:'journey',preview})).scene.journey;
  }
  x.store.executeWorld(x.step(3));
 }
 const before=x.store.sceneWorld(x.w.token,x.b).journey;assert.equal(before.status,state==='interrupted-at-destination'?'interrupted':state);if(state==='interrupted-at-destination')assert.equal(before.nextIndex,before.route.length);
 const safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);x.reopen();assert.deepEqual(x.store.sceneWorld(x.w.token,x.b).journey,before);
 if(state==='interrupted-at-destination'){const resumed=x.store.executeWorld(x.command({kind:'journey-state',id:before.id,expectedRevision:before.revision,state:'active'})).scene.journey;assert.equal(resumed.status,'arrived');assert.equal(x.store.liveScene(x.w.token,x.b).clock.instantMs,'9000');}
});

test('an exactly represented large journey total retains its stored format through read and backup',async t=>{
 const x=fixture(t),large={...x.journey,segmentSeconds:[4503599627370496,4503599627370496,2],plannedSeconds:9007199254740994,finalSeconds:null},payload=JSON.stringify(large);
 x.store.db.prepare('UPDATE world_journey SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,createHash('sha256').update(payload).digest('hex'),x.cam.id,large.id);
 assert.deepEqual(x.store.sceneWorld(x.w.token,x.b).journey,large);await x.store.backup(path.join(x.root,'large-safe.sqlite'));assert.equal(x.store.db.prepare('SELECT payload FROM world_journey WHERE id=?').get(large.id).payload,payload);
});
