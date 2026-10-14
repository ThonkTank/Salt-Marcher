import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,copyFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
mkdirSync('.build/catalog',{recursive:true});copyFileSync('src/features/catalog/data/srd-5.1.generated.json','.build/catalog/srd-5.1.generated.json');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {validateItemInput,checkedItem} from './src/app/storage/progression';",resolveDir:process.cwd(),sourcefile:'proposal-store.ts'},outfile:'.build/session-proposal-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,validateItemInput,checkedItem}=createRequire(import.meta.url)('../.build/session-proposal-store.cjs');
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'session-proposal-')),file=path.join(root,'source.sqlite'),store=new CampaignStore(file),cam=store.create('Session'),w=store.activate(cam.id),command=action=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,action});t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const planId=randomUUID();store.changePreparation({...command(null),change:{kind:'plan',expectedRevision:null,plan:{version:1,id:planId,revision:1,name:'Evening',scenes:[]}}});
 const hero=store.executeLive(command({kind:'create-character',profile:{name:'Hero'}})).character;
 const profile=store.session(w.token,planId).profile;store.executeSession(command({kind:'profile',expectedRevision:profile.revision,profile:{...profile,party:[{id:hero.id,name:'Hero',count:1,level:1}],adventureDayFraction:'1',seed:'guards'}}));
 const tableId=randomUUID();store.executeGeneration(command({kind:'table-save',expectedRevision:null,table:{id:tableId,revision:0,scope:'campaign',name:'Watch',description:'',entries:[{creatureId:'guard',weight:'1'}],habitats:[],time:'any',lootTableId:null,trashed:false}}));
 const run=store.generateSession(w.token,{planId,expectedProfileRevision:profile.revision+1,count:2,locationIds:[],noteIds:[],encounter:{tableIds:[tableId],filters:{text:'guard'},habitat:'',time:'any',difficulty:'easy',amount:'neutral',balance:'neutral',diversity:'neutral'}});
 const item={name:'  Ring',quantity:2,valueGold:'2.5',category:'equipment'},action={kind:'edit-proposal',planId,runId:run.id,index:0,expectedRevision:1,title:'  Gate',notes:'  Private\r\n',readAloud:'  Public\r\n',locationId:null,noteIds:[],reward:{poolXp:10,items:[item]}};
 return{root,file,store,cam,w,command,planId,run,item,action,hero};
}
test('proposal edits and independent encounter regeneration preserve author content and create no World loot',async t=>{
 const x=fixture(t),before=x.store.db.prepare('SELECT count(*) n FROM authored_item').get().n,edit=x.command(x.action),result=x.store.executeSession(edit);assert.deepEqual(x.store.executeSession(edit),result);
 const edited=x.store.sessionRun(x.w.token,x.run.id);assert.equal(edited.proposals[0].notes,x.action.notes);assert.deepEqual(edited.proposals[0].reward,x.action.reward);assert.deepEqual(edited.proposals[1],x.run.proposals[1]);assert.equal(x.store.db.prepare('SELECT count(*) n FROM authored_item').get().n,before);assert.equal(x.store.treasures(x.w.token,null).items.length,0);assert.equal(x.store.preparation(x.w.token).plans.find(p=>p.id===x.planId).scenes.length,0);
 const next=x.store.regenerateSessionProposal(x.w.token,edited.id,0,'new seed');assert.equal(next.proposals[0].notes,x.action.notes);assert.equal(next.proposals[0].readAloud,x.action.readAloud);assert.deepEqual(next.proposals[0].reward,x.action.reward);assert.deepEqual(next.proposals[1],edited.proposals[1]);await x.store.backup(path.join(x.root,'safe.sqlite'));
});
test('invalid and stale proposal rewards cause no partial writes',t=>{
 const x=fixture(t);
 for(const mutate of [a=>a.reward.items[0].quantity=0,a=>a.reward.items[0].valueGold='-',a=>a.reward.items=Array.from({length:101},()=>x.item),a=>a.expectedRevision=99,a=>a.reward.items[0]=Object.assign([],{...x.item}),a=>a.reward=Object.assign([],{...a.reward})]){const action=structuredClone(x.action);mutate(action);const bytes=x.store.db.serialize();assert.throws(()=>x.store.executeSession(x.command(action)));assert.ok(x.store.db.serialize().equals(bytes));}
});
test('read-only item validation and materialization share the same rules',t=>{
 const x=fixture(t),before=x.store.db.serialize();validateItemInput(x.store.db,x.item);assert.ok(x.store.db.serialize().equals(before));const made=checkedItem(x.store.db,x.item);assert.equal(made.quantity,2);assert.equal(made.unitCopper,'250');const pinned={...x.item,reference:made.reference};assert.equal(validateItemInput(x.store.db,pinned).id,made.reference.definitionId);
 for(const change of [i=>i.quantity=0,i=>i.name='',i=>i.category='invalid',i=>i.reference.revision=999,i=>i.reference.kind='invalid',i=>i.reference=Object.assign([],{...i.reference})]){const item=structuredClone(pinned);change(item);const bytes=x.store.db.serialize();assert.throws(()=>validateItemInput(x.store.db,item));assert.throws(()=>checkedItem(x.store.db,item));assert.ok(x.store.db.serialize().equals(bytes));}
});
test('accepted proposal and reward retain independent identities and author text through copy and fresh',async t=>{
 const x=fixture(t);x.store.executeSession(x.command(x.action));const plan=x.store.preparation(x.w.token).plans.find(p=>p.id===x.planId);x.store.executeSession(x.command({kind:'accept-proposal',planId:x.planId,runId:x.run.id,index:0,expectedPlanRevision:plan.revision}));
 const snapshot=path.join(x.root,'snapshot.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const original=readFileSync(snapshot),file=path.join(x.root,'copy.sqlite'),copy=new CampaignStore(file);let camId,planId,runId;
 try{const cam=copy.acceptCampaignSnapshot(snapshot,'Copy',{}),w=copy.activate(cam.id);camId=cam.id;planId=copy.preparation(w.token).plans[0].id;runId=copy.sessionRuns(w.token,planId)[0].id;assert.notEqual(planId,x.planId);assert.notEqual(runId,x.run.id);const copied=copy.sessionRun(w.token,runId);assert.notEqual(copied.generationRunId,x.run.generationRunId);assert.equal(copy.generationRun(w.token,copied.generationRunId).id,copied.generationRunId);assert.equal(copied.proposals[0].notes,x.action.notes);assert.notEqual(copied.proposals[0].acceptedVisitId,x.store.sessionRun(x.w.token,x.run.id).proposals[0].acceptedVisitId);assert.deepEqual(copied.proposals[0].reward,x.action.reward);await copy.backup(path.join(x.root,'copy-safe.sqlite'));}finally{copy.close();}
 const fresh=new CampaignStore(file);try{const w=fresh.activate(camId);assert.equal(fresh.sessionRun(w.token,runId).proposals[0].notes,x.action.notes);assert.equal(fresh.session(w.token,planId).visits[0].reward.items[0].quantity,2);}finally{fresh.close();}assert.ok(readFileSync(snapshot).equals(original));
});

for(const [name,mutate]of [
 ['run identity',r=>r.id=randomUUID()],['plan identity',r=>r.planId=randomUUID()],['future profile',r=>r.profileRevision=99],
 ['budget',r=>r.usedXp++],['negative reward',r=>r.proposals[0].reward.items[0].quantity=-1],['raw numeric reward',r=>r.proposals[0].reward.items[0].quantity='01'],
 ['proposal order',r=>r.proposals[0].index=99],['repeated proposal',r=>r.proposals[1].id=r.proposals[0].id],
 ['unknown location',r=>r.proposals[0].locationId=randomUUID()],['unknown knowledge',r=>r.proposals[0].noteIds=[randomUUID()]],
 ['source identity',r=>r.generationRunId=randomUUID()],['source index',r=>r.proposals[0].encounter.generationOrigin.index=-1],
 ['assessment',r=>r.proposals[0].encounter.assessment.baseXp++],['status',r=>r.proposals[0].rejected='yes'],
])test(`checksummed proposal ${name} damage cannot replace a safe backup`,async t=>{
 const x=fixture(t);x.store.executeSession(x.command(x.action));const safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const before=readFileSync(safe),row=x.store.db.prepare('SELECT payload FROM session_run WHERE campaign_id=? AND id=?').get(x.cam.id,x.run.id),run=JSON.parse(row.payload);mutate(run);const payload=JSON.stringify(run);x.store.db.prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,createHash('sha256').update(payload).digest('hex'),x.cam.id,x.run.id);const bytes=x.store.db.serialize();assert.throws(()=>x.store.sessionRun(x.w.token,x.run.id));assert.throws(()=>x.store.sessionRuns(x.w.token,x.planId));await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(before));assert.ok(x.store.db.serialize().equals(bytes));
});
test('invalid proposal acceptance cannot replace a safe backup',async t=>{
 const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const before=readFileSync(safe);x.store.db.prepare('INSERT INTO session_proposal_acceptance VALUES(?,?,?,?)').run(x.cam.id,x.run.id,99,randomUUID());const bytes=x.store.db.serialize();assert.throws(()=>x.store.sessionRun(x.w.token,x.run.id));await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(before));assert.ok(x.store.db.serialize().equals(bytes));
});
test('stale profile and archived world references preserve valid proposals',async t=>{
 const x=fixture(t),id=randomUUID();x.store.changePreparation({...x.command(null),change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'rumor',title:'Harbor',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});x.store.executeSession(x.command({...x.action,noteIds:[id]}));const profile=x.store.session(x.w.token,x.planId).profile;x.store.executeSession(x.command({kind:'profile',expectedRevision:profile.revision,profile:{...profile,seed:'Changed'}}));x.store.changePreparation({...x.command(null),change:{kind:'note-trash',id,expectedRevision:1,trashed:true}});assert.deepEqual(x.store.sessionRun(x.w.token,x.run.id).proposals[0].noteIds,[id]);await x.store.backup(path.join(x.root,'stale-safe.sqlite'));
});

function guided(x){
 const progress=x.store.progress(x.w.token).characters.find(c=>c.characterId===x.hero.id);x.store.executeProgress(x.command({kind:'xp',characterId:x.hero.id,expectedRevision:progress.revision,mode:'set',amount:0,reason:'Known planning XP'}));
 const profile=x.store.session(x.w.token,x.planId).profile,encounter=x.store.generationRun(x.w.token,x.run.generationRunId).request;
 return x.store.generateSession(x.w.token,{planId:x.planId,expectedProfileRevision:profile.revision,count:2,locationIds:[],noteIds:[],compensateLoot:true,encounter});
}
test('cumulative loot snapshots copy with independent roster and generator identities',async t=>{
 const x=fixture(t),run=guided(x);assert.ok(run.lootGuidance);const snapshot=path.join(x.root,'guided.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const copy=x.store.acceptCampaignSnapshot(snapshot,'Guided copy',{}),w=x.store.activate(copy.id),id=x.store.sessionRuns(w.token,x.store.preparation(w.token).plans[0].id)[0].id,copied=x.store.sessionRun(w.token,id);assert.notEqual(copied.lootGuidance.characters[0].characterId,x.hero.id);assert.deepEqual(copied.lootGuidance.allocationsCopper,run.lootGuidance.allocationsCopper);assert.notEqual(copied.generationRunId,run.generationRunId);await x.store.backup(path.join(x.root,'guided-safe.sqlite'));
});
for(const [name,mutate]of [['allocation',g=>g.allocationsCopper[0]='-1'],['total',g=>g.targetCopper=String(BigInt(g.targetCopper)+1n)],['roster owner',g=>g.characters[0].characterId=randomUUID()]])test(`checksummed cumulative loot ${name} damage retains the safe backup`,async t=>{
 const x=fixture(t),run=guided(x),safe=path.join(x.root,'guided-safe.sqlite');await x.store.backup(safe);const before=readFileSync(safe),row=x.store.db.prepare('SELECT payload FROM session_run WHERE campaign_id=? AND id=?').get(x.cam.id,run.id),v=JSON.parse(row.payload);mutate(v.lootGuidance);const payload=JSON.stringify(v);x.store.db.prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,createHash('sha256').update(payload).digest('hex'),x.cam.id,run.id);const bytes=x.store.db.serialize();assert.throws(()=>x.store.sessionRun(x.w.token,run.id));await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(before));assert.ok(x.store.db.serialize().equals(bytes));
});
