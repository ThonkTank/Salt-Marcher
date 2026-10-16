import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/autonomy-job-integrity.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/autonomy-job-integrity.cjs'),hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'autonomy-jobs-')),filename=path.join(root,'source.sqlite'),store=new CampaignStore(filename),cam=store.create('NPC-Angebote'),w=store.activate(cam.id),command=action=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,action});t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const job={id:randomUUID(),revision:0,name:'Wache',kind:'guard',locationId:null,routeId:null,targetActorId:null,roles:[],priority:1,durationSeconds:60,exclusive:false,enabled:true,needEffects:{},maxDamage:0};store.executeAutonomy(command({kind:'job',job,expectedRevision:null}));
 return{root,filename,store,cam,w,command,job:{...job,revision:1},mutate:fn=>{const payload=JSON.stringify(fn({...job,revision:1}));store.db.prepare('UPDATE autonomy_job SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),cam.id,job.id);}};
}
test('damaged autonomy job cannot replace an earlier complete backup or campaign export',async t=>{
 const x=fixture(t),backup=path.join(x.root,'backup.sqlite'),snapshot=path.join(x.root,'campaign.sqlite');await x.store.backup(backup);await x.store.campaignSnapshot(x.w.token,snapshot);const beforeBackup=readFileSync(backup),beforeSnapshot=readFileSync(snapshot);x.store.db.prepare('UPDATE autonomy_job SET checksum=?').run('broken');const source=x.store.db.serialize();
 await assert.rejects(x.store.backup(backup),/Autonomie|Job/i);await assert.rejects(x.store.campaignSnapshot(x.w.token,snapshot),/Autonomie|Job/i);assert.deepEqual(readFileSync(backup),beforeBackup);assert.deepEqual(readFileSync(snapshot),beforeSnapshot);assert.deepEqual(x.store.db.serialize(),source);
});
for(const field of ['id','revision'])test(`job ${field} must agree with its SQL owner before read, time confirmation and backup`,async t=>{
 const x=fixture(t);x.mutate(j=>({...j,[field]:field==='id'?randomUUID():99}));const source=x.store.db.serialize();assert.throws(()=>x.store.autonomy(x.w.token),/Autonomie|Job/i);
 x.store.executeLive(x.command({kind:'initialize',expectedRosterRevision:0}));const scene=x.store.live(x.w.token).scene,before=x.store.db.serialize();assert.throws(()=>x.store.executeLive(x.command({kind:'advance-clock',sceneId:scene.id,expectedRevision:scene.clock.revision,amount:60,unit:'seconds',calendarVersion:'relative-v1',reason:'NPC-Zeit'})),/Autonomie|Job/i);assert.deepEqual(x.store.db.serialize(),before);await assert.rejects(x.store.backup(path.join(x.root,'invalid.sqlite')),/Autonomie|Job/i);assert.ok(source.length);
});
test('invalid job controls and need effects are rejected before any state or receipt is written',t=>{
 const x=fixture(t);for(const changes of [{enabled:'false'},{exclusive:1},{roles:'guard'},{needEffects:[]},{needEffects:{hunger:'10'}},{priority:'10'},{locationId:17}]){
  const before=x.store.db.serialize();assert.throws(()=>x.store.executeAutonomy(x.command({kind:'job',job:{...x.job,...changes},expectedRevision:1})),/Job/i);assert.deepEqual(x.store.db.serialize(),before);
 }
});
test('a checksummed job with invalid stored controls is rejected by read and backup',async t=>{
 const x=fixture(t);x.mutate(j=>({...j,enabled:'false'}));assert.throws(()=>x.store.autonomy(x.w.token),/Job/i);await assert.rejects(x.store.backup(path.join(x.root,'invalid.sqlite')),/Job/i);
});
test('valid jobs without later optional dungeon fields survive fresh and independent transfer',async t=>{
 const x=fixture(t),snapshot=path.join(x.root,'valid.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const bytes=readFileSync(snapshot),copy=x.store.acceptCampaignSnapshot(snapshot,'Kopie',{}),cw=x.store.activate(copy.id),jobs=x.store.autonomy(cw.token).jobs;assert.equal(jobs.length,1);assert.notEqual(jobs[0].id,x.job.id);assert.equal(jobs[0].name,x.job.name);assert.deepEqual(readFileSync(snapshot),bytes);const fresh=new CampaignStore(x.filename);try{assert.deepEqual(fresh.autonomy(fresh.activate(copy.id).token).jobs,jobs);}finally{fresh.close();}
});
