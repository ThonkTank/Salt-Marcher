import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {standardNeeds,type AutonomyActor,type AutonomyJob} from '../../../src/app/runtime/autonomy-contracts';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../../src/features/location/location-schema';

function fixture(sharedLocation=false){
  const root=mkdtempSync(join(tmpdir(),'autonomy-scene-time-')),path=join(root,'campaign.sqlite'),store=new CampaignStore(path,'test');
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
  return{root,path,store,campaignId:campaign.id,token,actorId,primaryId:primary.id,secondaryId};
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

test('an already newer actor state requires a reasoned decision that survives restart',()=>{
  const f=fixture(true);let reopened:CampaignStore|undefined,originalClosed=false;
  try{
    advance(f,'lead-two-hours',f.primaryId,0,2);
    assert.equal(hunger(f),8);
    advance(f,'lag-one-hour',f.secondaryId,0,1);
    const actor=f.store.autonomy(f.token).actors.find(value=>value.id===f.actorId)!;
    assert.equal(hunger(f),8);
    assert.equal(actor.paused,true);
    assert.match(actor.pending??'',/Zeitkonflikt/);
    assert.equal(actor.cursor,1);
    const decision=f.store.autonomy(f.token).logs.find(entry=>entry.actorId===f.actorId&&entry.kind==='decision')!;
    assert.equal(decision.facts.actorInstantMs,'7200000');assert.equal(decision.facts.sceneInstantMs,'3600000');
    assert.throws(()=>f.store.executeAutonomy({commandId:'bypass-pending',campaignId:f.campaignId,token:f.token,action:{kind:'pause',actorId:f.actorId,paused:false,expectedRevision:actor.revision}}),/GM-Entscheidung/);
    assert.throws(()=>f.store.executeAutonomy({commandId:'bypass-pending-config',campaignId:f.campaignId,token:f.token,action:{kind:'actor',actor:{...actor,paused:false},expectedRevision:actor.revision,initialLocationId:null}}),/Autonomielaufstand/);
    f.store.close();originalClosed=true;reopened=new CampaignStore(f.path,'test');const workspace=reopened.activate(f.campaignId),fresh=reopened.autonomy(workspace.token).actors.find(value=>value.id===f.actorId)!;assert.equal(fresh.pending,actor.pending);assert.equal(fresh.paused,true);
    assert.throws(()=>reopened!.executeAutonomy({commandId:'unknown-action',campaignId:f.campaignId,token:workspace.token,action:{kind:'unknown',actorId:f.actorId,expectedRevision:fresh.revision} as any}),/Unbekannte Autonomieaktion/);
    assert.throws(()=>reopened!.executeAutonomy({commandId:'unknown-resolution',campaignId:f.campaignId,token:workspace.token,action:{kind:'accept-pending',actorId:f.actorId,expectedRevision:fresh.revision,resolution:'discard',reason:'Ungültige Entscheidung'} as any}),/GM-Entscheidung prüfen/);
    const afterRejected=reopened.autonomy(workspace.token).actors.find(value=>value.id===f.actorId)!;assert.equal(afterRejected.revision,fresh.revision);assert.equal(afterRejected.pending,fresh.pending);assert.equal(afterRejected.paused,true);
    reopened.executeAutonomy({commandId:'resume-pending',campaignId:f.campaignId,token:workspace.token,action:{kind:'accept-pending',actorId:f.actorId,expectedRevision:fresh.revision,resolution:'resume',reason:'Aktuellen Worldstand geprüft'}});const resumed=reopened.autonomy(workspace.token);assert.equal(resumed.actors.find(value=>value.id===f.actorId)!.pending,null);assert.equal(resumed.actors.find(value=>value.id===f.actorId)!.paused,false);assert.match(resumed.logs[0]!.text,/Aktuellen Worldstand geprüft/);
  }finally{reopened?.close();if(!originalClosed)f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('job selection logs a bounded deterministic explanation',()=>{
  const f=fixture();
  try{
    f.store.executeLive({commandId:'move-secondary-away',campaignId:f.campaignId,token:f.token,action:{kind:'scene-content',sceneId:f.secondaryId,expectedRevision:1,title:'Zweite Gruppe',notes:'',readAloud:'',locationId:'place-a'}});
    const current=f.store.autonomy(f.token).actors.find(value=>value.id===f.actorId)!;
    current.role='wache';current.jobPriorities={'job-a':2};current.needs.find(need=>need.id==='hunger')!.value=20;
    f.store.executeAutonomy({commandId:'explain-actor',campaignId:f.campaignId,token:f.token,action:{kind:'actor',actor:current,expectedRevision:current.revision,initialLocationId:null}});
    const job=(id:string,name:string,priority:number,roles:string[]=[],needEffects:Record<string,number>={}):AutonomyJob=>({id,revision:1,name,kind:'work',locationId:null,routeId:null,targetActorId:null,roles,priority,durationSeconds:3600,exclusive:false,enabled:true,needEffects,maxDamage:0});
    for(const value of [job('job-b','Tor prüfen',32),job('job-a','Vorräte ordnen',10,[],{hunger:1}),...Array.from({length:8},(_,index)=>job('job-role-'+index,'Schmiede '+index,100,['schmied']))])f.store.executeAutonomy({commandId:'create-'+value.id,campaignId:f.campaignId,token:f.token,action:{kind:'job',job:value,expectedRevision:null}});
    advance(f,'explain-time',f.primaryId,0,1);
    f.store.executeAutonomy({commandId:'explain-catch-up',campaignId:f.campaignId,token:f.token,action:{kind:'catch-up',actorIds:[f.actorId],maxSteps:12}});
    const view=f.store.autonomy(f.token),entry=view.logs.find(value=>value.actorId===f.actorId&&value.kind==='job');assert.ok(entry,JSON.stringify(view.logs));
    assert.equal(entry.facts.jobId,'job-a');assert.equal(entry.facts.priority,32);
    assert.deepEqual(entry.facts.considered,[
      {jobId:'job-a',name:'Vorräte ordnen',priority:32,reason:'Grundpriorität 10 + NPC-Bonus 2 + Hunger 20 × 1 = 20'},
      {jobId:'job-b',name:'Tor prüfen',priority:32,reason:'Grundpriorität 32'}
    ]);
    assert.deepEqual(entry.facts.excluded,Array.from({length:6},(_,index)=>'Schmiede '+index+': Rolle wache ist nicht zugelassen'));assert.equal(entry.facts.excludedRemaining,2);
    assert.equal(entry.facts.tieBreak,'Priorität absteigend, bei Gleichstand Job-ID aufsteigend');
  }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
