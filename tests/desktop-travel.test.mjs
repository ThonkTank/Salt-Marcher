import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/travel-review.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/travel-review.cjs');

function setup(interrupt='',destination=false){
 const root=mkdtempSync(path.join(tmpdir(),'travel-review-')),filename=path.join(root,'store.sqlite'),store=new CampaignStore(filename),campaign=store.create('Reise'),workspace=store.activate(campaign.id);
 const x={root,filename,store,campaign,workspace,cleanup(){x.store.close();rmSync(root,{recursive:true,force:true});}};
 x.command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:x.workspace.token,action});
 x.world=action=>x.store.executeWorld(x.command(action));x.live=action=>x.store.executeLive(x.command(action));
 const character=x.live({kind:'create-character',profile:{name:'Iri'}}).character,roster=store.live(workspace.token);
 x.live({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:roster.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:roster.focusRevision});
 x.scene=x.live({kind:'initialize',expectedRosterRevision:store.live(workspace.token).rosterRevision}).scene;
 x.map={id:randomUUID(),revision:0,name:'Region',hexMeters:1000,climate:'temperate',seed:'travel-review',cells:[{q:1,r:0,level:0,terrain:'plains',elevationM:0,climate:null,road:false,river:false,label:'',faction:'',interrupt}]};
 x.world({kind:'map',map:x.map,expectedRevision:null});x.map=store.world(workspace.token).maps[0];
 x.world({kind:'place-scene',sceneId:x.scene.id,position:{mapId:x.map.id,q:0,r:0,locationId:null},expectedSceneRevision:x.scene.revision,expectedPositionRevision:0});
 x.weather={label:'Klar',kind:'clear',intensity:0,windKmh:0,effects:{visibilityMeters:10000,travelFactor:1,perception:'Normal',temperatureC:15,ambience:[],combatNote:''},source:'GM-Override'};
 x.world({kind:'weather-override',sceneId:x.scene.id,expectedClockRevision:0,expectedOverrideRevision:store.sceneWorld(workspace.token,x.scene.id).weatherOverrideRevision,weather:x.weather});
 if(destination){
  x.location={kind:'location',version:1,id:randomUUID(),name:'Ankunft',type:'poi',sections:[],detailMaps:[],keyLinks:[]};
  store.changePreparation({...x.command(null),change:{kind:'location',document:x.location,expectedRevision:null}});
  x.world({kind:'place',mapId:x.map.id,locationId:x.location.id,expectedRevision:null,hex:{q:3,r:0}});
 }
 x.request={sceneId:x.scene.id,mapId:x.map.id,destination:{q:3,r:0},destinationLocationId:x.location?.id??null,waypoints:[],paceKmh:1,factor:1,finalSeconds:9};
 x.preview=()=>x.store.previewTravel(x.workspace.token,x.request);
 x.accept=()=>x.world({kind:'journey',preview:x.preview()}).scene.journey;
 x.step=(journey,maxSteps=1)=>x.command({kind:'journey-step',id:journey.id,expectedRevision:journey.revision,maxSteps});
 x.state=()=>x.store.sceneWorld(x.workspace.token,x.scene.id);
 x.reopen=()=>{x.store.close();x.store=new CampaignStore(filename);x.workspace=x.store.activate(campaign.id);};
 return x;
}

test('journey acceptance rejects a forged displayed total instead of persisting contradictory timing',()=>{
 const x=setup();try{
  const preview=x.preview(),before=x.state();assert.equal(preview.durationSeconds,9);assert.equal(preview.segmentSeconds.reduce((a,b)=>a+b),9);
  assert.throws(()=>x.world({kind:'journey',preview:{...preview,durationSeconds:9999}}),/Vorschau|Reisebasis/);
  assert.deepEqual(x.state(),before);
 }finally{x.cleanup();}
});

test('independent live prose does not invalidate an otherwise unchanged travel preview',()=>{
 const x=setup();try{
  const preview=x.preview(),scene=x.state().scene;
  x.live({kind:'scene-content',sceneId:scene.id,expectedRevision:scene.revision,title:'Neuer Live-Titel',notes:'  Unabhängige Notiz.\r\n',locationId:null});
  const accepted=x.world({kind:'journey',preview}).scene;assert.equal(accepted.journey.plannedSeconds,9);assert.equal(accepted.scene.notes,'  Unabhängige Notiz.\r\n');assert.equal(accepted.scene.clock.instantMs,'0');
 }finally{x.cleanup();}
});

for(const change of ['clock','position ABA','map','weather','calendar','destination'])test(`accepted journey rejects changed ${change} without booking movement or time`,()=>{
 const x=setup('',change==='destination');try{
  const journey=x.accept();
  if(change==='clock')x.live({kind:'advance-clock',sceneId:x.scene.id,expectedRevision:0,amount:1,unit:'seconds',calendarVersion:'relative-v1',reason:'Unabhängige Zeitänderung'});
  if(change==='position ABA')for(const q of [1,0]){const state=x.state();x.world({kind:'place-scene',sceneId:x.scene.id,position:{mapId:x.map.id,q,r:0,locationId:null},expectedSceneRevision:state.scene.revision,expectedPositionRevision:state.position.revision});}
  if(change==='map')x.world({kind:'cell',mapId:x.map.id,expectedRevision:x.map.revision,cell:{...x.map.cells[0],terrain:'hills'}});
  if(change==='weather')x.world({kind:'weather-override',sceneId:x.scene.id,expectedClockRevision:0,expectedOverrideRevision:x.state().weatherOverrideRevision,weather:{...x.weather,effects:{...x.weather.effects,travelFactor:2}}});
  if(change==='calendar'){const calendar=x.store.world(x.workspace.token).calendar;x.world({kind:'calendar',expectedRevision:calendar.revision,calendar:{...calendar,daySeconds:calendar.daySeconds*2}});}
  if(change==='destination')x.world({kind:'place',mapId:x.map.id,locationId:x.location.id,expectedRevision:1,hex:{q:4,r:0}});
  const before=x.state();assert.throws(()=>x.store.executeWorld(x.step(journey)),/Reise|Route|Ziel|Basis/);assert.deepEqual(x.state(),before);
 }finally{x.cleanup();}
});

test('interruption, receipt replay, restart and resume preserve exact segment timing and independent scene prose',()=>{
 const x=setup('Spuren');try{
  const accepted=x.accept();assert.equal(x.state().scene.clock.instantMs,'0');assert.equal(x.state().position.q,0);
  const current=x.state().scene;x.live({kind:'scene-content',sceneId:current.id,expectedRevision:current.revision,title:'Eigener Titel',notes:'  Unabhängige Liveprosa.\r\n',locationId:null});
  const command=x.step(accepted,12),first=x.store.executeWorld(command).scene;
  assert.equal(first.journey.status,'interrupted');assert.equal(first.position.q,1);assert.equal(first.scene.clock.instantMs,'3000');assert.equal(first.scene.notes,'  Unabhängige Liveprosa.\r\n');
  assert.equal(first.knowledge.some(h=>h.q===3&&h.r===0),false);
  assert.deepEqual(x.store.executeWorld(command).scene,first);x.reopen();assert.deepEqual(x.store.executeWorld({...command,token:x.workspace.token}).scene,first);
  const resumed=x.world({kind:'journey-state',id:first.journey.id,expectedRevision:first.journey.revision,state:'active'}).scene.journey;
  const arrived=x.store.executeWorld(x.step(resumed,12)).scene;assert.equal(arrived.journey.status,'arrived');assert.equal(arrived.position.q,3);assert.equal(arrived.scene.clock.instantMs,'9000');assert.equal(arrived.scene.id,x.scene.id);
  assert.equal(arrived.journey.segmentSeconds.reduce((a,b)=>a+b),arrived.journey.plannedSeconds);
  x.reopen();assert.deepEqual(x.state(),arrived);
 }finally{x.cleanup();}
});

test('receipt failure rolls back position, clock, knowledge, journey and nested live receipts together',()=>{
 const x=setup();try{
  const journey=x.accept(),before=x.state(),count=x.store.db.prepare('SELECT count(*) n FROM live_receipt').get().n;
  x.store.db.exec("CREATE TRIGGER deny_travel_receipt BEFORE INSERT ON world_receipt BEGIN SELECT RAISE(ABORT,'synthetic travel failure'); END;");
  assert.throws(()=>x.store.executeWorld(x.step(journey,12)),/synthetic travel failure/);assert.deepEqual(x.state(),before);assert.equal(x.store.db.prepare('SELECT count(*) n FROM live_receipt').get().n,count);
 }finally{x.cleanup();}
});

test('a legacy journey without persisted time and position bases remains unchanged and cannot resume under invented bases',()=>{
 const x=setup();try{
  const j=x.accept(),legacy={...j};delete legacy.clockRevision;delete legacy.positionRevision;delete legacy.environmentBasis;
  const payload=JSON.stringify(legacy),checksum=createHash('sha256').update(payload).digest('hex');
  x.store.db.prepare('UPDATE world_journey SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,checksum,x.campaign.id,j.id);
  assert.throws(()=>x.store.executeWorld(x.step(j)),/Reise|Route|Basis/);
  assert.deepEqual(x.store.db.prepare('SELECT payload,checksum FROM world_journey WHERE id=?').get(j.id),{payload,checksum});
  assert.equal(x.state().scene.clock.instantMs,'0');assert.equal(x.state().position.q,0);
 }finally{x.cleanup();}
});

test('resuming a paused journey cannot silently accept an independent clock change',()=>{
 const x=setup();try{
  const j=x.accept(),paused=x.world({kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'paused'}).scene.journey;
  x.live({kind:'advance-clock',sceneId:x.scene.id,expectedRevision:0,amount:1,unit:'seconds',calendarVersion:'relative-v1',reason:'Während Pause geändert'});
  const before=x.state();assert.throws(()=>x.world({kind:'journey-state',id:j.id,expectedRevision:paused.revision,state:'active'}),/Reise|Route/);assert.deepEqual(x.state(),before);
 }finally{x.cleanup();}
});

for(const field of ['id','sceneId','status'])test(`journey ${field} mismatch is rejected by reads, writes and backup without replacing original bytes`,async()=>{
 const x=setup();try{
  const j=x.accept(),target=path.join(x.root,'safe.sqlite');await x.store.backup(target);const safe=readFileSync(target);
  const altered={...j,[field]:field==='status'?'paused':randomUUID()},payload=JSON.stringify(altered),checksum=createHash('sha256').update(payload).digest('hex');
  x.store.db.prepare('UPDATE world_journey SET payload=?,checksum=? WHERE id=?').run(payload,checksum,j.id);
  const clock=x.store.liveScene(x.workspace.token,x.scene.id).clock;
  assert.throws(()=>x.state(),/Reiseidentität/);
  assert.throws(()=>x.world({kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'ended'}),/Reiseidentität/);
  await assert.rejects(x.store.backup(target),/Reiseidentität/);assert.deepEqual(readFileSync(target),safe);
  assert.deepEqual(x.store.db.prepare('SELECT payload,checksum FROM world_journey WHERE id=?').get(j.id),{payload,checksum});assert.deepEqual(x.store.liveScene(x.workspace.token,x.scene.id).clock,clock);
 }finally{x.cleanup();}
});

function enableTimeConsumer(x){
 const location={kind:'location',version:1,id:randomUUID(),name:'Remote NPC site',type:'poi',sections:[],detailMaps:[],keyLinks:[]};x.store.changePreparation({...x.command(null),change:{kind:'location',document:location,expectedRevision:null}});
 const note={version:1,id:randomUUID(),revision:1,kind:'npc',title:'Clock observer',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false};x.store.changePreparation({...x.command(null),change:{kind:'note',note,expectedRevision:null}});
 x.store.executeAutonomy(x.command({kind:'actor',actor:{id:note.id,revision:0,enabled:true,paused:false,role:'',needs:[{id:'hunger',name:'Hunger',enabled:true,value:0,ratePerHour:4,weight:1}],jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null},expectedRevision:null,initialLocationId:location.id}));return note.id;
}
function focusAnotherGroup(x){
 const c=x.live({kind:'create-character',profile:{name:'Other group member'}}).character,v=x.store.live(x.workspace.token);
 x.live({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:v.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:v.focusRevision});
 const live=x.store.live(x.workspace.token),s=x.store.liveScene(x.workspace.token,x.scene.id);
 const split=x.live({kind:'move',sceneId:s.id,expectedRosterRevision:live.rosterRevision,expectedFocusRevision:live.focusRevision,expectedClockRevision:s.clock.revision,expectedSceneMembershipRevision:s.membershipRevision,memberIds:[c.id],target:{kind:'new',title:'Independent focus',expectedContentRevision:s.revision}});
 const created=split.session.createdScene;x.live({kind:'focus',sceneId:created.id,expectedRevision:x.store.live(x.workspace.token).focusRevision});return created;
}
test('a nonfocused journey records confirmed time for its own scene instead of the focused group',()=>{
 const x=setup();try{
  const npc=enableTimeConsumer(x),other=focusAnotherGroup(x);assert.equal(x.store.live(x.workspace.token).scene.id,other.id);
  const focusedClock=JSON.stringify(x.store.liveScene(x.workspace.token,other.id).clock),j=x.accept();x.store.executeWorld(x.step(j));
  const rows=x.store.db.prepare('SELECT * FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal').all(x.campaign.id);
  assert.equal(rows.length,1);assert.equal(rows[0].scene_id,x.scene.id);assert.equal(BigInt(rows[0].to_ms)-BigInt(rows[0].from_ms),3000n);
  assert.equal(JSON.stringify(x.store.liveScene(x.workspace.token,other.id).clock),focusedClock);assert.equal(x.store.autonomy(x.workspace.token).actors.find(a=>a.id===npc).remaining,1);
 }finally{x.cleanup();}
});
test('a multisegment world command publishes its confirmed time at each actual journey boundary',()=>{
 const x=setup();try{
  enableTimeConsumer(x);const j=x.accept();x.store.executeWorld(x.step(j,3));const rows=x.store.db.prepare('SELECT * FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal').all(x.campaign.id);
  assert.equal(rows.length,3);for(let i=0;i<rows.length;i++){assert.equal(rows[i].scene_id,x.scene.id);assert.equal(BigInt(rows[i].to_ms)-BigInt(rows[i].from_ms),3000n);if(i)assert.equal(rows[i].from_ms,rows[i-1].to_ms);}
 }finally{x.cleanup();}
});

test('replaying a confirmed multisegment journey cannot add or consume time again',()=>{
 const x=setup();try{
  enableTimeConsumer(x);const j=x.accept(),command=x.step(j,3);x.store.executeWorld(command);
  const state=JSON.stringify(x.state()),intervals=JSON.stringify(x.store.db.prepare('SELECT * FROM autonomy_interval ORDER BY ordinal').all()),actors=JSON.stringify(x.store.autonomy(x.workspace.token));
  x.store.executeWorld(command);assert.equal(JSON.stringify(x.state()),state);assert.equal(JSON.stringify(x.store.db.prepare('SELECT * FROM autonomy_interval ORDER BY ordinal').all()),intervals);assert.equal(JSON.stringify(x.store.autonomy(x.workspace.token)),actors);
 }finally{x.cleanup();}
});
test('a rejected second segment consumer rolls back earlier segment time, movement and knowledge',()=>{
 const x=setup();try{
  enableTimeConsumer(x);const j=x.accept(),before=JSON.stringify(x.state()),actors=JSON.stringify(x.store.autonomy(x.workspace.token)),receipts=x.store.db.prepare('SELECT count(*) n FROM world_receipt').get().n;
  x.store.db.exec("CREATE TRIGGER deny_second_interval BEFORE INSERT ON autonomy_interval WHEN NEW.ordinal=2 BEGIN SELECT RAISE(ABORT,'Second consumer refused'); END;");
  assert.throws(()=>x.store.executeWorld(x.step(j,3)),/Second consumer refused/);
  assert.equal(JSON.stringify(x.state()),before);assert.equal(JSON.stringify(x.store.autonomy(x.workspace.token)),actors);assert.equal(x.store.db.prepare('SELECT count(*) n FROM autonomy_interval').get().n,0);assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_receipt').get().n,receipts);
 }finally{x.cleanup();}
});
test('changing focus between journey segments preserves the actual scene time frontier',()=>{
 const x=setup();try{
  enableTimeConsumer(x);const other=focusAnotherGroup(x),j=x.accept();x.store.executeWorld(x.step(j));
  x.live({kind:'focus',sceneId:x.scene.id,expectedRevision:x.store.live(x.workspace.token).focusRevision});const next=x.state().journey;x.store.executeWorld(x.step(next));
  const rows=x.store.db.prepare('SELECT * FROM autonomy_interval ORDER BY ordinal').all();assert.equal(rows.length,2);assert.ok(rows.every(r=>r.scene_id===x.scene.id));assert.equal(rows[1].from_ms,rows[0].to_ms);
  assert.equal(x.store.liveScene(x.workspace.token,other.id).clock.instantMs,'0');
 }finally{x.cleanup();}
});


test('party-derived travel uses only assigned active PCs, warns about missing movement and retains its mode after reopening',()=>{
 const x=setup();try{
  const m={...x.map,hexMeters:4828.032};x.world({kind:'map',map:m,expectedRevision:m.revision});
  const add=(name,speedFeet,active=true)=>{const c=x.live({kind:'create-character',profile:{name,...(speedFeet===undefined?{}:{speedFeet})}}).character;if(active){const l=x.store.live(x.workspace.token);x.live({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:l.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:l.focusRevision});}return c;};
  add('Langsam',20);add('Reserve',5,false);x.request={...x.request,destination:{q:2,r:0},finalSeconds:null,usePartyPace:true};const p=x.preview();assert.equal(p.request.paceKmh,3.218688);assert.equal(p.durationSeconds,10800);assert.match(p.warnings.join(' '),/Iri.*30 ft/);assert.equal(p.actorIds.length,2);
  let j=x.accept();assert.equal(j.usePartyPace,true);x.world(x.step(j).action);j=x.state().journey;x.world({kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'paused'});x.reopen();assert.equal(x.state().journey.usePartyPace,true);assert.equal(x.state().position.q,1);assert.equal(x.state().scene.clock.instantMs,'5400000');
 }finally{x.cleanup();}
});
test('movement changes reject stale automatic previews and checkpoints but allow an explicit manual override',()=>{
 const x=setup();try{
  x.request={...x.request,finalSeconds:null,usePartyPace:true};const p=x.preview(),c=x.store.live(x.workspace.token).roster[0];x.live({kind:'profile',characterId:c.id,expectedRevision:c.profileRevision,profile:{...c.profile,speedFeet:20}});assert.throws(()=>x.world({kind:'journey',preview:p}),/Reisebasis/);
  const j=x.accept(),next=x.store.live(x.workspace.token).roster[0];x.live({kind:'profile',characterId:c.id,expectedRevision:next.profileRevision,profile:{...next.profile,speedFeet:0}});const before=x.state();assert.throws(()=>x.world(x.step(j).action),/Gruppentempo/);assert.deepEqual(x.state(),before);assert.throws(()=>x.preview(),/Bewegung 0/);
  x.request={...x.request,usePartyPace:false,paceKmh:4,finalSeconds:600};const manual=x.preview();assert.equal(manual.durationSeconds,600);assert.equal(manual.request.paceKmh,4);assert.equal(x.world({kind:'journey',preview:manual}).scene.journey.usePartyPace,undefined);
 }finally{x.cleanup();}
});
test('the three-mile missing-speed default is one hour and explicit duration still wins',()=>{
 const x=setup();try{const m={...x.map,hexMeters:4828.032};x.world({kind:'map',map:m,expectedRevision:m.revision});x.request={...x.request,destination:{q:1,r:0},usePartyPace:true,finalSeconds:null};assert.equal(x.preview().durationSeconds,3600);x.request.finalSeconds=123;assert.equal(x.preview().durationSeconds,123);}finally{x.cleanup();}
});

for(const mode of ['party','weather','stale-party','stale-weather','stale-map','stale-clock'])test('independent paused hex journey copy preserves '+mode+' authority and exact remaining time',async t=>{
 const x=setup();t.after(()=>x.cleanup());const weather=mode.includes('weather');
 const companion=x.live({kind:'create-character',profile:{name:'Borin',speedFeet:20}}).character,roster=x.store.live(x.workspace.token);x.live({kind:'membership',characterId:companion.id,expectedRevision:companion.membershipRevision,expectedRosterRevision:roster.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:roster.focusRevision});
 if(weather)x.world({kind:'phenomenon',expectedRevision:null,phenomenon:{id:randomUUID(),revision:0,mapId:x.map.id,name:'Wandernde Wolke',kind:'rain',intensity:.5,center:{q:0,r:0},radiusHexes:20,movement:{q:0,r:0},startMs:'0',durationMs:'86400000',state:'active',pausedAtMs:null,temperatureC:null,travelFactor:2,notes:'  Wettertext.\r\n'}});
 if(weather)x.world({kind:'weather-override',sceneId:x.scene.id,expectedClockRevision:0,expectedOverrideRevision:x.state().weatherOverrideRevision,weather:null});
 x.request={...x.request,usePartyPace:!weather};let j=x.accept();x.world(x.step(j).action);j=x.state().journey;x.world({kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'paused'});
 if(mode==='stale-party'){const pc=x.store.live(x.workspace.token).roster[0];x.live({kind:'profile',characterId:pc.id,expectedRevision:pc.profileRevision,profile:{...pc.profile,speedFeet:20}});}
 if(mode==='stale-weather'){const p=x.store.world(x.workspace.token).phenomena[0];x.world({kind:'phenomenon',expectedRevision:p.revision,phenomenon:{...p,intensity:.8}});}
 if(mode==='stale-map')x.world({kind:'cell',mapId:x.map.id,expectedRevision:x.map.revision,cell:{...x.map.cells[0],terrain:'hills'}});
 if(mode==='stale-clock')x.live({kind:'advance-clock',sceneId:x.scene.id,expectedRevision:x.state().scene.clock.revision,amount:1,unit:'seconds',calendarVersion:'relative-v1',reason:'Manuelle Zeitänderung'});
 const original=x.state(),snapshot=path.join(x.root,'hex-copy-source.sqlite');await x.store.campaignSnapshot(x.workspace.token,snapshot);const sourceBytes=x.store.db.serialize(),snapshotBytes=readFileSync(snapshot),copyFile=path.join(x.root,'hex-copy.sqlite');let copy=new CampaignStore(copyFile);
 try{
  const campaign=copy.acceptCampaignSnapshot(snapshot,'Unabhängige Reisekopie',{});copy.close();copy=new CampaignStore(copyFile);const w=copy.activate(campaign.id),scene=copy.live(w.token).scene,before=copy.sceneWorld(w.token,scene.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
  assert.notEqual(scene.id,x.scene.id);assert.notEqual(before.journey.id,original.journey.id);assert.notEqual(before.position.mapId,original.position.mapId);assert.deepEqual(before.journey.segmentSeconds,original.journey.segmentSeconds);assert.equal(before.journey.nextIndex,original.journey.nextIndex);assert.equal(before.scene.clock.instantMs,original.scene.clock.instantMs);assert.equal(before.journey.status,'paused');assert.equal(before.scene.members.length,2);assert.deepEqual(before.journey.actorIds,before.scene.members);if(weather)assert.equal(copy.world(w.token).phenomena[0].notes,'  Wettertext.\r\n');
  const resume=command({kind:'journey-state',id:before.journey.id,expectedRevision:before.journey.revision,state:'active'});
  if(mode.startsWith('stale-')){const unchanged=copy.db.serialize();assert.throws(()=>copy.executeWorld(resume),/Reisebasis|Gruppentempo|Zeit oder Position/);assert.ok(copy.db.serialize().equals(unchanged));}
  else{
   let active=copy.executeWorld(resume).scene.journey;const remaining=active.segmentSeconds.slice(active.nextIndex-1).reduce((a,b)=>a+b,0),start=BigInt(before.scene.clock.instantMs),first=active.segmentSeconds[active.nextIndex-1],step=command({kind:'journey-step',id:active.id,expectedRevision:active.revision,maxSteps:1});copy.executeWorld(step);let state=copy.sceneWorld(w.token,scene.id);assert.equal(BigInt(state.scene.clock.instantMs),start+BigInt(first)*1000n);assert.equal(state.journey.nextIndex,before.journey.nextIndex+1);const replayBytes=copy.db.serialize();copy.executeWorld(step);assert.ok(copy.db.serialize().equals(replayBytes));active=state.journey;
   copy.executeWorld(command({kind:'journey-step',id:active.id,expectedRevision:active.revision,maxSteps:12}));state=copy.sceneWorld(w.token,scene.id);assert.equal(state.journey.status,'arrived');assert.equal(BigInt(state.scene.clock.instantMs),start+BigInt(remaining)*1000n);assert.deepEqual({q:state.position.q,r:state.position.r},x.request.destination);assert.equal(state.journey.usePartyPace,weather?undefined:true);
  }
  assert.ok(x.store.db.serialize().equals(sourceBytes));assert.ok(readFileSync(snapshot).equals(snapshotBytes));
 }finally{copy.close();}
});
