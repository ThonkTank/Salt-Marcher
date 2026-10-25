import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {standardNeeds,type AutonomyActor,type AutonomyCommand,type AutonomyJob} from '../../../src/app/runtime/autonomy-contracts';
import {validateAutonomy} from '../../../src/app/storage/autonomy';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';

const checksum=(payload:string)=>createHash('sha256').update(payload).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'autonomy-persistence-')),path=join(root,'campaign.sqlite'),store=new CampaignStore(path,'test'),campaign=store.create('Autonomieintegrität'),token=store.activate(campaign.id).token,actorId=campaignLocalId('00000000-0000-4000-8000-000000000201'),jobId='integrity-job';
 store.changePreparation({commandId:'npc',campaignId:campaign.id,token,change:{kind:'note',expectedRevision:null,note:{version:1,id:actorId,revision:1,kind:'npc',title:'Wache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
 const actor:AutonomyActor={id:actorId,revision:0,enabled:true,paused:false,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null};
 const job:AutonomyJob={id:jobId,revision:0,name:'Wache halten',kind:'guard',locationId:null,routeId:null,targetActorId:null,roles:[],priority:10,durationSeconds:60,exclusive:true,enabled:true,needEffects:{hunger:1},maxDamage:0};
 store.executeAutonomy({commandId:'actor',campaignId:campaign.id,token,action:{kind:'actor',actor,expectedRevision:null,initialLocationId:null}});
 store.executeAutonomy({commandId:'job',campaignId:campaign.id,token,action:{kind:'job',job,expectedRevision:null}});
 const scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
 return{root,path,store,campaignId:campaign.id,token,actorId,jobId,sceneId:scene.id,db:(store as unknown as {db:any}).db};
}

test('historical actor, route, feature and dungeon bases are validated without current owners',async()=>{
 const f=fixture(),backup=join(f.root,'invalid.sqlite');let reopened:CampaignStore|undefined,originalClosed=false;
 try{
  f.store.executeLive({commandId:'advance-basis',campaignId:f.campaignId,token:f.token,action:{kind:'advance-clock',sceneId:f.sceneId,expectedRevision:0,amount:60,unit:'seconds',calendarVersion:'relative-v1',reason:'Autonomiezeit'}});
  const row=f.db.prepare('SELECT * FROM autonomy_interval WHERE campaign_id=?').get(f.campaignId),original=JSON.parse(row.payload),write=(basis:any)=>{const payload=JSON.stringify(basis);f.db.prepare('UPDATE autonomy_interval SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,checksum(payload),f.campaignId,row.id);};
  for(const mutate of [(basis:any)=>{basis.actors[0].needs[0].ratePerHour=-1;},(basis:any)=>{basis.actors[0].positionBasis.dungeon={scopeId:'scope',floorId:'floor',roomId:'room',x:'bad',y:0,z:0};},(basis:any)=>{basis.routes=[{id:'route',revision:1,name:'Historischer Weg',fromLocationId:'same',toLocationId:'same',durationSeconds:60,enabled:true}];},(basis:any)=>{basis.features=[{id:'feature',revision:-1}];},(basis:any)=>{basis.spatial=[{scopeId:'scope',snapshotId:'missing'}];}]){const basis=structuredClone(original);mutate(basis);write(basis);assert.throws(()=>validateAutonomy(f.db),/Autonomie|Dungeon/);}
  const snapshotId='historical-spatial',snapshot:any={owners:{scopeId:'historical-scope',locationId:null,rooms:[],elements:[],styles:[],floors:[],hidden:[],volumes:[],paths:[],passages:[],triggerFields:[]},geometry:{rooms:[],floors:[],drawing:{triggerFields:[],paths:[],passages:[],volumes:[],elements:[],styles:[],features:[],hiddenRooms:[],hiddenFloors:[]}}},snapshotPayload=JSON.stringify(snapshot);f.db.prepare('INSERT INTO autonomy_dungeon_basis VALUES(?,?,?,?,?)').run(f.campaignId,snapshotId,'a'.repeat(64),snapshotPayload,checksum(snapshotPayload));const valid=structuredClone(original);valid.spatial=[{scopeId:'historical-scope',snapshotId}];write(valid);validateAutonomy(f.db);f.store.executeAutonomy({commandId:'catch-up-valid-basis',campaignId:f.campaignId,token:f.token,action:{kind:'catch-up',actorIds:[f.actorId],maxSteps:12}});assert.equal(f.db.prepare('SELECT count(*) count FROM autonomy_target_booking WHERE campaign_id=?').get(f.campaignId).count,1);f.store.close();originalClosed=true;reopened=new CampaignStore(f.path,'test');const db=(reopened as unknown as {db:any}).db;validateAutonomy(db);
  snapshot.owners.rooms=[{id:'old-room',revision:-1}];const damaged=JSON.stringify(snapshot);db.prepare('UPDATE autonomy_dungeon_basis SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(damaged,checksum(damaged),f.campaignId,snapshotId);assert.throws(()=>validateAutonomy(db),/Dungeonbasis/);await assert.rejects(reopened.backup(backup),/Dungeonbasis/);assert.throws(()=>readFileSync(backup));
 }finally{reopened?.close();if(!originalClosed)f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('receipts, frontiers, reservations, bookings and logs fail closed',()=>{
 const f=fixture();
 try{
  const command:AutonomyCommand={commandId:'empty-catch-up',campaignId:f.campaignId,token:f.token,action:{kind:'catch-up',actorIds:[],maxSteps:1}};f.store.executeAutonomy(command);
  const validReceipt=JSON.stringify({progressed:0,pending:0}),badReceipt=JSON.stringify({progressed:-1,pending:0});f.db.prepare('UPDATE autonomy_receipt SET payload=?,checksum=? WHERE command_id=?').run(badReceipt,checksum(badReceipt),command.commandId);assert.throws(()=>f.store.executeAutonomy(command),/Autonomie-Receipt/);f.db.prepare('UPDATE autonomy_receipt SET payload=?,checksum=? WHERE command_id=?').run(validReceipt,checksum(validReceipt),command.commandId);
  const frontier=f.db.prepare('SELECT * FROM autonomy_frontier WHERE campaign_id=?').get(f.campaignId);f.db.prepare('UPDATE autonomy_frontier SET instant_ms=? WHERE campaign_id=? AND epoch_id=?').run('-1',f.campaignId,frontier.epoch_id);assert.throws(()=>validateAutonomy(f.db),/Zeitfront/);f.db.prepare('UPDATE autonomy_frontier SET instant_ms=? WHERE campaign_id=? AND epoch_id=?').run(frontier.instant_ms,f.campaignId,frontier.epoch_id);
  f.db.prepare('INSERT INTO autonomy_reservation VALUES(?,?,?)').run(f.campaignId,f.jobId,f.actorId);assert.throws(()=>validateAutonomy(f.db),/Reservierung/);f.db.prepare('DELETE FROM autonomy_reservation WHERE campaign_id=?').run(f.campaignId);
	  f.db.prepare('INSERT INTO autonomy_booking VALUES(?,?,?,?,?,?,?)').run(f.campaignId,'bad-booking',f.jobId,f.actorId,frontier.epoch_id,'000000000000000000000000000010','000000000000000000000000000001');assert.throws(()=>validateAutonomy(f.db),/Buchung/);f.db.prepare('DELETE FROM autonomy_booking WHERE campaign_id=?').run(f.campaignId);
	  f.db.prepare('INSERT INTO autonomy_target_booking VALUES(?,?,?,?,?,?,?,?,?)').run(f.campaignId,'bad-target-booking',f.jobId,f.actorId,'unknown','resource',frontier.epoch_id,'000000000000000000000000000001','000000000000000000000000000010');assert.throws(()=>validateAutonomy(f.db),/Buchung/);f.db.prepare('DELETE FROM autonomy_target_booking WHERE campaign_id=?').run(f.campaignId);
	  const log=JSON.stringify({id:'other-log',actorId:f.actorId,intervalId:'manual',kind:'override',text:'Manuell',facts:{}});f.db.prepare('INSERT INTO autonomy_log VALUES(?,?,?,?,?,?)').run(f.campaignId,'bad-log',f.actorId,'manual',log,checksum(log));assert.throws(()=>validateAutonomy(f.db),/Log/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('manual autonomy log sentinel survives independent campaign remapping',async()=>{
 const f=fixture(),snapshot=join(f.root,'source.sqlite'),destination=new CampaignStore(join(f.root,'destination.sqlite'),'test');
 try{
  const payload=JSON.stringify({id:'manual-log',actorId:f.actorId,intervalId:'manual',kind:'override',text:'GM-Korrektur',facts:{reason:'Test'}});f.db.prepare('INSERT INTO autonomy_log VALUES(?,?,?,?,?,?)').run(f.campaignId,'manual-log',f.actorId,'manual',payload,checksum(payload));validateAutonomy(f.db);
  await f.store.campaignSnapshot(f.token,snapshot);const imported=destination.acceptCampaignSnapshot(snapshot,'Autonomiekopie',{},'autonomy-copy'),db=(destination as unknown as {db:any}).db,row=db.prepare("SELECT * FROM autonomy_log WHERE campaign_id=? AND interval_id='manual'").get(imported.id);
  assert.ok(row);assert.equal(JSON.parse(row.payload).intervalId,'manual');assert.notEqual(row.actor_id,f.actorId);validateAutonomy(db);
 }finally{destination.close();f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
