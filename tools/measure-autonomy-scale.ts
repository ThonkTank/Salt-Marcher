import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {standardNeeds,type AutonomyActor,type AutonomyJob} from '../src/app/autonomy-contracts';
import {createHash} from 'node:crypto';
import {validateAutonomy} from '../src/app/storage/autonomy';
import {CampaignStore} from '../src/app/storage/store';
import {campaignLocalId} from '../src/features/campaign/campaign-contracts';

const actors=200,samples=1,stepSeconds=900,root=mkdtempSync(join(tmpdir(),'autonomy-scale-')),store=new CampaignStore(join(root,'campaign.sqlite'),'scale-measurement');
const checksum=(payload:string)=>createHash('sha256').update(payload).digest('hex');
const percentile=(values:number[],value:number)=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*value)-1]!;
const round=(value:number)=>Math.round(value*100)/100;
try{
 const campaign=store.create('Autonomy scale'),token=store.activate(campaign.id).token,actorIds:string[]=[],db=(store as unknown as {db:any}).db;
 const job:AutonomyJob={id:'scale-guard',revision:0,name:'Wache',kind:'guard',locationId:null,routeId:null,targetActorId:null,roles:[],priority:10,durationSeconds:3600,exclusive:false,enabled:true,needEffects:{},maxDamage:0};
 store.executeAutonomy({commandId:'job',campaignId:campaign.id,token,action:{kind:'job',job,expectedRevision:null}});
 db.transaction(()=>{const noteInsert=db.prepare('INSERT INTO world_note VALUES(?,?,1,0,?,?)'),searchInsert=db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)'),actorInsert=db.prepare('INSERT INTO autonomy_actor VALUES(?,?,?,?,?)');for(let index=0;index<actors;index++){
  const id=campaignLocalId(`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`),title='Actor '+index;actorIds.push(id);
  const note={version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false},notePayload=JSON.stringify(note);noteInsert.run(campaign.id,id,notePayload,checksum(notePayload));searchInsert.run(campaign.id,id,title,'');
  const actor:AutonomyActor={id,revision:1,enabled:true,paused:false,role:'',needs:standardNeeds(),jobPriorities:{},assignedJobId:null,allowConflict:false,defense:12,attackBonus:0,maxHpLossPercent:10,cursor:0,offsetSeconds:0,jobId:null,progressSeconds:0,pending:null,sightMeters:20,darkvisionMeters:0,hearingMeters:18,passivePerception:10,stealthDc:10,positionBasis:{locationId:null,revision:null}},actorPayload=JSON.stringify(actor);actorInsert.run(campaign.id,id,actor.revision,actorPayload,checksum(actorPayload));
 }}).immediate();validateAutonomy(db);
 const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!,baselineBytes=db.serialize().byteLength,captureMs:number[]=[],catchUpMs:number[]=[],viewMs:number[]=[],intervalBytes:number[]=[];let clockRevision=0,peakRss=process.memoryUsage().rss;
 for(let sample=0;sample<samples;sample++){
  let started=performance.now();store.executeLive({commandId:'time-'+sample,campaignId:campaign.id,token,action:{kind:'advance-clock',sceneId:scene.id,expectedRevision:clockRevision,amount:stepSeconds,unit:'seconds',calendarVersion:'relative-v1',reason:'Scale measurement'}});captureMs.push(performance.now()-started);clockRevision++;
  intervalBytes.push(db.prepare('SELECT length(payload) size FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal DESC LIMIT 1').get(campaign.id).size);
  started=performance.now();const result=store.executeAutonomy({commandId:'catch-up-'+sample,campaignId:campaign.id,token,action:{kind:'catch-up',actorIds,maxSteps:12}});catchUpMs.push(performance.now()-started);if(result.progressed!==actors||result.pending!==0)throw new Error(`Unexpected progress ${result.progressed}/${result.pending}.`);
  started=performance.now();const view=store.autonomy(token);viewMs.push(performance.now()-started);if(view.actors.length!==actors)throw new Error('Actor projection incomplete.');peakRss=Math.max(peakRss,process.memoryUsage().rss);
 }
 const finalBytes=db.serialize().byteLength,metrics={sourceCondition:{actors,samples,confirmedStepSeconds:stepSeconds,jobs:1,locations:0,dungeons:0,maxSteps:12},captureMs:{median:round(percentile(captureMs,.5)),p95:round(percentile(captureMs,.95)),max:round(Math.max(...captureMs))},catchUpMs:{median:round(percentile(catchUpMs,.5)),p95:round(percentile(catchUpMs,.95)),max:round(Math.max(...catchUpMs))},viewMs:{median:round(percentile(viewMs,.5)),p95:round(percentile(viewMs,.95)),max:round(Math.max(...viewMs))},storageBytes:{baseline:baselineBytes,final:finalBytes,growth:finalBytes-baselineBytes,perConfirmedStep:Math.round((finalBytes-baselineBytes)/samples),intervalPayloadMedian:percentile(intervalBytes,.5)},processPeakRssBytes:peakRss};
 const output=JSON.stringify(metrics,null,2)+'\n';writeFileSync(join(process.cwd(),'.build','autonomy-scale.json'),output);process.stdout.write(output);
}finally{store.close();rmSync(root,{recursive:true,force:true});}
