import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {weatherAt} from './src/app/world-model';",resolveDir:process.cwd(),sourcefile:'weather-integrity.ts',loader:'ts'},outfile:'.build/weather-integrity.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,weatherAt}=createRequire(import.meta.url)('../.build/weather-integrity.cjs'),hash=s=>createHash('sha256').update(s).digest('hex');
const weather=()=>({label:'  Eigener Nebel\r\n',kind:'fog',intensity:.8,windKmh:17,effects:{visibilityMeters:150,travelFactor:1.25,perception:'  GM entscheidet.\r\n',temperatureC:8,ambience:['Leiser Wind',''],combatNote:'  Unveränderter Text.\r\n'},source:'Eigene Quelle'});
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'weather-integrity-')),filename=path.join(root,'store.sqlite'),x={root,filename,store:new CampaignStore(filename)};t.after(()=>{x.store.close();rmSync(root,{recursive:true,force:true});});
 x.cam=x.store.create('Wetter');x.w=x.store.activate(x.cam.id);x.command=action=>({commandId:randomUUID(),campaignId:x.cam.id,token:x.w.token,action});x.scene=x.store.executeLive(x.command({kind:'initialize',expectedRosterRevision:0})).scene;
 const map={id:randomUUID(),revision:0,name:'Region',hexMeters:1000,climate:'temperate',seed:'weather-review',cells:[]};x.store.executeWorld(x.command({kind:'map',map,expectedRevision:null}));x.map=x.store.world(x.w.token).maps[0];
 x.store.executeWorld(x.command({kind:'place-scene',sceneId:x.scene.id,position:{mapId:x.map.id,q:0,r:0,locationId:null},expectedSceneRevision:x.scene.revision,expectedPositionRevision:0}));
 x.set=value=>x.store.executeWorld(x.command({kind:'weather-override',sceneId:x.scene.id,expectedClockRevision:x.store.liveScene(x.w.token,x.scene.id).clock.revision,weather:value}));x.frame=()=>x.store.sceneWorld(x.w.token,x.scene.id);return x;
}
for(const damage of ['unknown kind','negative wind','non-numeric wind','invalid ambience','invalid perception'])test(`weather writer rejects ${damage} without state, history or receipt effects`,t=>{
 const x=fixture(t),value=weather();if(damage==='unknown kind')value.kind='hail';if(damage==='negative wind')value.windKmh=-1;if(damage==='non-numeric wind')value.windKmh='17';if(damage==='invalid ambience')value.effects.ambience='Wind';if(damage==='invalid perception')value.effects.perception={private:true};
 const bytes=x.store.db.serialize();assert.throws(()=>x.set(value),/Wetter/i);assert.ok(x.store.db.serialize().equals(bytes));
});
test('checksummed invalid weather cannot be read, replace a safe backup or replace a campaign export',async t=>{
 const x=fixture(t);x.set(weather());const backup=path.join(x.root,'safe.sqlite'),file=path.join(x.root,'campaign.sqlite');await x.store.backup(backup);await x.store.campaignSnapshot(x.w.token,file);const safe=readFileSync(backup),packageBytes=readFileSync(file),row=x.store.db.prepare("SELECT * FROM world_record WHERE kind='weather-override'").get(),value=JSON.parse(row.payload);value.weather.kind='hail';const payload=JSON.stringify(value);x.store.db.prepare('UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?').run(payload,hash(payload),x.cam.id,row.kind,row.id);
 const bytes=x.store.db.serialize();assert.throws(x.frame,/Wetter/i);assert.throws(()=>x.set(weather()),/Wetter/i);assert.throws(()=>x.set(null),/Wetter/i);await assert.rejects(x.store.backup(backup),/Wetter/i);await assert.rejects(x.store.campaignSnapshot(x.w.token,file),/Wetter/i);assert.ok(bytes.equals(x.store.db.serialize()));assert.ok(safe.equals(readFileSync(backup)));assert.ok(packageBytes.equals(readFileSync(file)));
});
test('valid override keeps exact GM text through time, campaign switch and Fresh; release resumes automatic weather',t=>{
 const x=fixture(t),value=weather();x.set(value);const scene=x.store.liveScene(x.w.token,x.scene.id);x.store.executeLive(x.command({kind:'advance-clock',sceneId:scene.id,expectedRevision:scene.clock.revision,amount:3,unit:'days',calendarVersion:'relative-v1',reason:'Bestätigte Wetterzeit'}));assert.deepEqual(x.frame().weather,{...value,source:'GM-Override'});
 const other=x.store.create('Andere Kampagne'),otherWork=x.store.activate(other.id),otherScene=x.store.executeLive({commandId:randomUUID(),campaignId:other.id,token:otherWork.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene;assert.equal(x.store.sceneWorld(otherWork.token,otherScene.id).weather,null);
 x.store.close();x.store=new CampaignStore(x.filename);x.w=x.store.activate(x.cam.id);assert.deepEqual(x.frame().weather,{...value,source:'GM-Override'});x.set(null);const frame=x.frame(),world=x.store.world(x.w.token);assert.deepEqual(frame.weather,weatherAt(world.maps[0],frame.position,frame.scene.clock.instantMs,world.calendar,world.phenomena));
});
test('an override and clock change in one Scene leave the split Scene weather and clock independent',t=>{
 const x=fixture(t),characters=['Iri','Dorn'].map(name=>x.store.executeLive(x.command({kind:'create-character',profile:{name}})).character);
 for(const character of characters){const live=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision}));}
 const live=x.store.live(x.w.token),scene=x.store.liveScene(x.w.token,x.scene.id),result=x.store.executeLive(x.command({kind:'move',sceneId:scene.id,memberIds:[characters[1].id],expectedRosterRevision:live.rosterRevision,expectedFocusRevision:live.focusRevision,expectedClockRevision:scene.clock.revision,expectedSceneMembershipRevision:scene.membershipRevision,target:{kind:'new',title:'Andere Gruppe',expectedContentRevision:scene.revision}})),split=x.store.liveScene(x.w.token,result.session.createdScene.id);
 x.store.executeWorld(x.command({kind:'place-scene',sceneId:split.id,position:{mapId:x.map.id,q:0,r:0,locationId:null},expectedSceneRevision:split.revision,expectedPositionRevision:x.store.sceneWorld(x.w.token,split.id).position.revision}));const before=x.store.sceneWorld(x.w.token,split.id),value=weather();x.set(value);
 const current=x.store.liveScene(x.w.token,x.scene.id);x.store.executeLive(x.command({kind:'advance-clock',sceneId:current.id,expectedRevision:current.clock.revision,amount:3,unit:'days',calendarVersion:'relative-v1',reason:'Nur erste Gruppe'}));
 const after=x.store.sceneWorld(x.w.token,split.id);assert.deepEqual(after.weather,before.weather);assert.deepEqual(after.scene.clock,before.scene.clock);assert.deepEqual(x.frame().weather,{...value,source:'GM-Override'});
 const second=x.store.liveScene(x.w.token,split.id);x.store.executeLive(x.command({kind:'advance-clock',sceneId:second.id,expectedRevision:second.clock.revision,amount:1,unit:'days',calendarVersion:'relative-v1',reason:'Nur zweite Gruppe'}));const updated=x.store.sceneWorld(x.w.token,split.id),world=x.store.world(x.w.token);assert.deepEqual(updated.weather,weatherAt(world.maps[0],updated.position,updated.scene.clock.instantMs,world.calendar,world.phenomena));assert.deepEqual(x.frame().weather,{...value,source:'GM-Override'});
});
