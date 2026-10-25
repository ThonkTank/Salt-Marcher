import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import {remapSnapshot} from '../../../src/app/storage/campaign-data';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';

const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const dbOf=(store:CampaignStore)=>(store as unknown as {db:any}).db;

test('campaign provenance records each successive copy without consuming source text or pair history',async()=>{
 const root=mkdtempSync(join(tmpdir(),'campaign-origin-chain-')),stores:CampaignStore[]=[];
 try{
  let store=new CampaignStore(join(root,'source.sqlite'),'test');stores.push(store);
  let campaign=store.create('Original'),w=store.activate(campaign.id);
  let source=campaignLocalId('00000000-0000-4000-8000-000000000661'),target=campaignLocalId('00000000-0000-4000-8000-000000000662');
  const prose='  Ursprüngliche ID '+source+'\r\n[[Externe Quelle#Kapitel]]  ';
  for(const [id,title] of [[source,'Ada'],[target,'Bert']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes:prose,relations:[],creatureId:null,deleted:false}}});
  store.executeWorldRelationPair({commandId:'pair',campaignId:campaign.id,token:w.token,action:{kind:'add',sourceId:source,targetId:target,sourceRevision:1,targetRevision:1,forwardLabel:'kennt',reverseLabel:'kennt'}});
  const seen=new Set([campaign.id,source,target]);
  for(let hop=1;hop<=3;hop++){
   const snapshot=join(root,'hop-'+hop+'.sqlite');await store.campaignSnapshot(w.token,snapshot);const bytes=readFileSync(snapshot),previous=dbOf(store).serialize();
   const next=new CampaignStore(join(root,'copy-'+hop+'.sqlite'),'test');stores.push(next);const copied=next.acceptCampaignSnapshot(snapshot,'Kopie '+hop,{}),nw=next.activate(copied.id);
   const notes=next.preparation(nw.token,'').notes.map(row=>row.note),ns=notes.find(note=>note.title==='Ada')!,nt=notes.find(note=>note.title==='Bert')!;
   for(const id of [copied.id,ns.id,nt.id]){assert.ok(!seen.has(id));seen.add(id);}
   assert.equal(ns.gmNotes,prose);assert.equal(nt.gmNotes,prose);assert.equal(ns.relations[0]?.targetId,nt.id);
   const origin=dbOf(next).prepare('SELECT * FROM campaign_origin').get();assert.equal(origin.source_id,campaign.id);assert.equal(origin.source_name,campaign.name);
   assert.equal(origin.checksum,digest(origin.original_database));assert.deepEqual(JSON.parse(origin.original_database.toString()),{format:'Campaign provenance',version:1,campaignId:campaign.id,name:campaign.name,schema:dbOf(store).pragma('user_version',{simple:true}),sha256:digest(bytes)});
   const map=JSON.parse(origin.local_map);assert.equal(map[source],ns.id);assert.equal(map[target],nt.id);
   next.executeWorldRelationPairHistory({commandId:'undo-'+hop,campaignId:copied.id,token:nw.token,expectedCursor:1,direction:'undo'});assert.equal(next.preparation(nw.token,'').notes.find(row=>row.note.id===ns.id)!.note.relations.length,0);
   next.executeWorldRelationPairHistory({commandId:'redo-'+hop,campaignId:copied.id,token:nw.token,expectedCursor:0,direction:'redo'});assert.equal(next.preparation(nw.token,'').notes.find(row=>row.note.id===nt.id)!.note.relations[0]?.targetId,ns.id);
   assert.ok(dbOf(store).serialize().equals(previous));assert.ok(readFileSync(snapshot).equals(bytes));
   store=next;campaign=copied;w=nw;source=ns.id;target=nt.id;
  }
 }finally{for(const store of stores.reverse())store.close();rmSync(root,{recursive:true,force:true});}
});

for(const damage of ['blob','json','array','value'] as const)test('campaign provenance rejects '+damage+' damage before replacing exports or accepting a copy',async()=>{
 const root=mkdtempSync(join(tmpdir(),'campaign-origin-damage-')),source=new CampaignStore(join(root,'source.sqlite'),'test'),copy=new CampaignStore(join(root,'copy.sqlite'),'test'),destination=new CampaignStore(join(root,'destination.sqlite'),'test');
 try{
  const campaign=source.create('Original'),w=source.activate(campaign.id),input=join(root,'input.sqlite');await source.campaignSnapshot(w.token,input);
  const copied=copy.acceptCampaignSnapshot(input,'Kopie',{}),cw=copy.activate(copied.id),snapshot=join(root,'export.sqlite'),backup=join(root,'backup.sqlite');await copy.campaignSnapshot(cw.token,snapshot);await copy.backup(backup);
  const goodSnapshot=readFileSync(snapshot),goodBackup=readFileSync(backup);
  const corrupt=(db:any)=>damage==='blob'?db.prepare('UPDATE campaign_origin SET original_database=?').run(Buffer.from('beschädigt')):db.prepare('UPDATE campaign_origin SET local_map=?').run(damage==='json'?'{':damage==='array'?'[]':'{"source":12}');
  corrupt(dbOf(copy));const before=dbOf(copy).serialize();
  await assert.rejects(copy.campaignSnapshot(cw.token,snapshot),/[Hh]erkunft/);await assert.rejects(copy.backup(backup),/[Hh]erkunft/);
  assert.ok(readFileSync(snapshot).equals(goodSnapshot));assert.ok(readFileSync(backup).equals(goodBackup));assert.ok(dbOf(copy).serialize().equals(before));
  const external=new Database(snapshot);try{corrupt(external);}finally{external.close();}
  const damagedBytes=readFileSync(snapshot),destinationBefore=dbOf(destination).serialize();
  assert.throws(()=>destination.campaignPreview(snapshot),/[Hh]erkunft/);assert.throws(()=>destination.acceptCampaignSnapshot(snapshot,'Verbotene Kopie',{}),/[Hh]erkunft/);
  assert.ok(dbOf(destination).serialize().equals(destinationBefore));assert.ok(readFileSync(snapshot).equals(damagedBytes));
  assert.throws(()=>remapSnapshot(dbOf(copy),copied.id,'Keine Heilung',new Map(),new Map()),/[Hh]erkunft/);assert.ok(dbOf(copy).serialize().equals(before));
  assert.ok(!readdirSync(root).some(name=>name.includes('.candidate-')||name.includes('.snapshot-')||name.includes('.accept-')));
 }finally{destination.close();copy.close();source.close();rmSync(root,{recursive:true,force:true});}
});

test('campaign provenance preserves checksum-valid opaque legacy bytes and arbitrary source map keys',async()=>{
 const root=mkdtempSync(join(tmpdir(),'campaign-origin-opaque-')),store=new CampaignStore(join(root,'source.sqlite'),'test');
 try{
  const c=store.create('Legacy'),w=store.activate(c.id),bytes=Buffer.from([0,255,13,10,128]),map=JSON.stringify({'alte Kennung:ohne UUID':'neue Kennung'});
  dbOf(store).prepare('INSERT INTO campaign_origin VALUES(?,?,?,?,?,?)').run(c.id,'extern-alt','Alte Quelle',map,bytes,digest(bytes));
  const file=join(root,'opaque.sqlite');await store.campaignSnapshot(w.token,file);store.campaignPreview(file);
  const snapshot=new Database(file,{readonly:true});try{const origin=snapshot.prepare('SELECT * FROM campaign_origin').get() as any;assert.ok(origin.original_database.equals(bytes));assert.equal(origin.local_map,map);}finally{snapshot.close();}
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
