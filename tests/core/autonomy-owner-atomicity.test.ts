import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {standardNeeds,type AutonomyActor,type AutonomyCommand,type AutonomyJob} from '../../src/app/autonomy-contracts';
import type {DrawingElement} from '../../src/app/atlas/drawing-contracts';
import type {Room} from '../../src/app/contracts';
import {CampaignStore} from '../../src/app/storage/store';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../src/features/location/location-schema';

const checksum=(payload:string)=>createHash('sha256').update(payload).digest('hex');
type Kind='move'|'reset'|'conflict';
function fixture(kind:Kind){
 const root=mkdtempSync(join(tmpdir(),'autonomy-owner-')),path=join(root,'campaign.sqlite'),room:Room={id:'room',scopeId:'local',floorId:'ground',name:'Halle',number:'1',revision:0,polygons:[{outer:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],holes:[]}],sections:[]},store=new CampaignStore(path,'test'),campaign=store.create('Owneratomizität',[room]),token=store.activate(campaign.id).token,db=(store as unknown as {db:any}).db;
 const location={...newLocation('place','Gewölbe','poi',['place-description','place-notes']),detailMaps:[{kind:'dungeon' as const,documentId:'local'}]};
 store.changePreparation({commandId:'location',campaignId:campaign.id,token,change:{kind:'location',expectedRevision:null,document:location}});
 const sourceId=campaignLocalId('00000000-0000-4000-8000-000000000301'),targetId=campaignLocalId('00000000-0000-4000-8000-000000000302');
 for(const [id,name] of [[sourceId,'Wache'],[targetId,'Rivale']] as const){
  store.executeNpc({commandId:'npc-'+id,campaignId:campaign.id,token,expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name,creatureId:'guard',readAloud:'',gmNotes:'',locationId:'place',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},health:{hp:10,maxHp:10,tempHp:0,conditions:'',concentrating:false}}});
  const actor:AutonomyActor={id,revision:0,enabled:true,paused:false,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:true,defense:10,attackBonus:id===sourceId?100:0,maxHpLossPercent:25,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null};
  store.executeAutonomy({commandId:'actor-'+id,campaignId:campaign.id,token,action:{kind:'actor',actor,expectedRevision:null,initialLocationId:'place'}});
 }
 const sourcePose={scopeId:'local',floorId:'ground',roomId:'room',x:1,y:1,z:0},targetPose={...sourcePose,x:7,y:7};
 store.executeDungeon({commandId:'place-source',campaignId:campaign.id,token,action:{kind:'npc-place',actorId:sourceId,expectedRevision:store.npc(token,sourceId).positionRevision,pose:sourcePose}});
 store.executeDungeon({commandId:'place-target',campaignId:campaign.id,token,action:{kind:'npc-place',actorId:targetId,expectedRevision:store.npc(token,targetId).positionRevision,pose:targetPose}});
 let featureId:string|null=null;
 if(kind==='reset'){
  featureId='trap';const element:DrawingElement={id:featureId,revision:0,scopeId:'local',floorId:'ground',roomId:'room',kind:'feature',points:[{x:5,y:5}],name:'Fallgrube',notes:'',secret:true,color:'#000000',width:1,height:1,angle:0,variant:'',blocksSight:false,blocksSound:false,passable:true,state:'open',targetRoomId:null,targetFloorId:null,anchor:null,feature:'trap',maxCharges:1,resetSeconds:0,resetMode:'empty',triggerRadius:0,triggerHeight:0,assetId:null,archived:false};
  store.executeDrawing({commandId:'trap',campaignId:campaign.id,token,action:{kind:'element',element,expectedRevision:null}});const state=db.prepare('SELECT * FROM dungeon_feature_state WHERE campaign_id=? AND id=?').get(campaign.id,featureId),value={...JSON.parse(state.payload),charges:0},payload=JSON.stringify(value);db.prepare('UPDATE dungeon_feature_state SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,checksum(payload),campaign.id,featureId);
 }
 const jobId='job-'+kind,job:AutonomyJob={id:jobId,revision:0,name:'Owner '+kind,kind,locationId:null,routeId:null,targetActorId:kind==='conflict'?targetId:null,featureId,roomId:'room',patrolRoomId:null,speedMetersPerMinute:60,roles:[],priority:100,durationSeconds:30,exclusive:false,enabled:true,needEffects:{},maxDamage:1};
 store.executeAutonomy({commandId:'job',campaignId:campaign.id,token,action:{kind:'job',job,expectedRevision:null}});
 const scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
 store.executeLive({commandId:'advance',campaignId:campaign.id,token,action:{kind:'advance-clock',sceneId:scene.id,expectedRevision:0,amount:60,unit:'seconds',calendarVersion:'relative-v1',reason:'Autonomiezeit'}});
 return{root,store,db,campaignId:campaign.id,token,sourceId,targetId,featureId,command:{commandId:'catch-up-'+kind,campaignId:campaign.id,token,action:{kind:'catch-up',actorIds:[sourceId],maxSteps:12}} as AutonomyCommand};
}

for(const kind of ['move','reset','conflict'] as const)test(kind+' owner effect rolls back atomically and retries exactly once',()=>{
 const f=fixture(kind),logKind=kind==='move'?'dungeon-move':kind;
 try{
  const before=f.db.serialize();f.db.exec(`CREATE TEMP TRIGGER fail_autonomy_owner BEFORE INSERT ON autonomy_log WHEN json_extract(NEW.payload,'$.kind')='${logKind}' BEGIN SELECT RAISE(ABORT,'forced owner failure'); END;`);
  assert.throws(()=>f.store.executeAutonomy(f.command),/forced owner failure/);assert.ok(f.db.serialize().equals(before));assert.equal(f.db.prepare('SELECT count(*) count FROM autonomy_receipt WHERE command_id=?').get(f.command.commandId).count,0);
  f.db.exec('DROP TRIGGER fail_autonomy_owner');f.store.executeAutonomy(f.command);
  if(kind==='move'){assert.notDeepEqual(JSON.parse(f.db.prepare('SELECT payload FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?').get(f.campaignId,f.sourceId).payload),{scopeId:'local',floorId:'ground',roomId:'room',x:1,y:1,z:0});const traces=f.db.prepare('SELECT payload FROM dungeon_trace WHERE campaign_id=? AND actor_id=?').all(f.campaignId,f.sourceId);assert.equal(traces.length,1);assert.ok(JSON.parse(traces[0].payload).path.length>2);assert.equal(f.db.prepare("SELECT count(*) count FROM dungeon_signal WHERE campaign_id=? AND json_extract(payload,'$.actorId')=?").get(f.campaignId,f.sourceId).count,1);}
  if(kind==='reset')assert.equal(JSON.parse(f.db.prepare('SELECT payload FROM dungeon_feature_state WHERE campaign_id=? AND id=?').get(f.campaignId,f.featureId).payload).charges,1);
  if(kind==='conflict')assert.equal(JSON.parse(f.db.prepare('SELECT payload FROM world_actor WHERE campaign_id=? AND id=?').get(f.campaignId,f.targetId).payload).hp,9);
  const applied=f.db.serialize();f.store.executeAutonomy(f.command);assert.ok(f.db.serialize().equals(applied));assert.equal(f.db.prepare('SELECT count(*) count FROM autonomy_receipt WHERE command_id=?').get(f.command.commandId).count,1);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
