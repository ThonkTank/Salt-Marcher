import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {standardNeeds,type AutonomyActor} from '../../src/app/autonomy-contracts';
import {CampaignStore} from '../../src/app/storage/store';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../src/features/location/location-schema';

function fixture(sharedLocation=false){
  const root=mkdtempSync(join(tmpdir(),'autonomy-scene-time-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
  const campaign=store.create('Autonomiezeit'),token=store.activate(campaign.id).token;
  for(const [id,name] of [['place-a','Vorhut'],['place-b','Hinterland']] as const)store.changePreparation({commandId:'location-'+id,campaignId:campaign.id,token,change:{kind:'location',expectedRevision:null,document:newLocation(id,name,'poi',[id+'-description',id+'-notes'])}});
  const actorId=campaignLocalId('00000000-0000-4000-8000-000000000101');
  store.changePreparation({commandId:'npc',campaignId:campaign.id,token,change:{kind:'note',expectedRevision:null,note:{version:1,id:actorId,revision:1,kind:'npc',title:'Wache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  const one=store.executeLive({commandId:'character-one',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const two=store.executeLive({commandId:'character-two',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Borin'}}}).character!;
  const primary=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:2}}).scene!;
  store.executeLive({commandId:'activate-one',campaignId:campaign.id,token,action:{kind:'membership',characterId:one.id,expectedRevision:0,expectedRosterRevision:2,active:true,targetSceneId:primary.id,expectedFocusRevision:0}});
  store.executeLive({commandId:'activate-two',campaignId:campaign.id,token,action:{kind:'membership',characterId:two.id,expectedRevision:0,expectedRosterRevision:3,active:true,targetSceneId:primary.id,expectedFocusRevision:0}});
  const split=store.executeLive({commandId:'split',campaignId:campaign.id,token,action:{kind:'move',sceneId:primary.id,expectedRosterRevision:4,expectedFocusRevision:0,expectedClockRevision:0,expectedSceneMembershipRevision:2,memberIds:[two.id],target:{kind:'new',title:'Zweite Gruppe',expectedContentRevision:0}}});
  const secondaryId=split.session!.createdScene!.id;
  store.executeLive({commandId:'primary-place',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:primary.id,expectedRevision:0,title:'Vorhut',notes:'',readAloud:'',locationId:sharedLocation?'place-b':'place-a'}});
  store.executeLive({commandId:'secondary-place',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:secondaryId,expectedRevision:0,title:'Zweite Gruppe',notes:'',readAloud:'',locationId:'place-b'}});
  const actor:AutonomyActor={id:actorId,revision:1,enabled:true,paused:false,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null};
  store.executeAutonomy({commandId:'actor',campaignId:campaign.id,token,action:{kind:'actor',actor,expectedRevision:null,initialLocationId:'place-b'}});
  return{root,store,campaignId:campaign.id,token,actorId,primaryId:primary.id,secondaryId};
}

const advance=(f:ReturnType<typeof fixture>,commandId:string,sceneId:string,expectedRevision:number,amount:number)=>f.store.executeLive({commandId,campaignId:f.campaignId,token:f.token,action:{kind:'advance-clock',sceneId,expectedRevision,amount,unit:'hours',calendarVersion:'relative-v1',reason:'Testzeit'}});
const hunger=(f:ReturnType<typeof fixture>)=>f.store.autonomy(f.token).actors.find(actor=>actor.id===f.actorId)!.needs.find(need=>need.id==='hunger')!.value;

test('automatic autonomy catch-up stops at the advancing scene clock',()=>{
  const f=fixture();
  try{
    advance(f,'lead-two-hours',f.primaryId,0,2);
    advance(f,'lag-one-hour',f.secondaryId,0,1);
    let actor=f.store.autonomy(f.token).actors.find(value=>value.id===f.actorId)!;
    assert.equal(hunger(f),4);
    assert.equal(actor.cursor,0);
    assert.equal(actor.offsetSeconds,3600);

    advance(f,'lag-catches-up',f.secondaryId,1,1);
    actor=f.store.autonomy(f.token).actors.find(value=>value.id===f.actorId)!;
    assert.equal(hunger(f),8);
    assert.equal(actor.cursor,1);
    assert.equal(actor.offsetSeconds,0);
  }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('an already newer actor state pauses at a lagging scene instead of rolling back',()=>{
  const f=fixture(true);
  try{
    advance(f,'lead-two-hours',f.primaryId,0,2);
    assert.equal(hunger(f),8);
    advance(f,'lag-one-hour',f.secondaryId,0,1);
    const actor=f.store.autonomy(f.token).actors.find(value=>value.id===f.actorId)!;
    assert.equal(hunger(f),8);
    assert.equal(actor.paused,true);
    assert.match(actor.pending??'',/Zeitkonflikt/);
    assert.equal(actor.cursor,1);
  }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
