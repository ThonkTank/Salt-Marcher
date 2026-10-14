import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,copyFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
mkdirSync('.build/catalog',{recursive:true});
copyFileSync('src/features/catalog/data/srd-5.1.generated.json','.build/catalog/srd-5.1.generated.json');
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/npc-integrity.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/npc-integrity.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'npc-integrity-')),file=path.join(root,'source.sqlite'),store=new CampaignStore(file),cam=store.create('NPCs'),w=store.activate(cam.id);
 t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const id=randomUUID(),factionId=randomUUID(),locationId=randomUUID();
 const base=()=>({commandId:randomUUID(),campaignId:cam.id,token:w.token});
 store.changePreparation({...base(),change:{kind:'note',expectedRevision:null,note:{version:1,id:factionId,revision:1,kind:'faction',title:'Guild',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
 store.changePreparation({...base(),change:{kind:'location',expectedRevision:null,document:{version:1,kind:'location',id:locationId,name:'Square',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}});
 const command={...base(),expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name:'Guard',creatureId:'guard',readAloud:'  Public\r\n',gmNotes:'  Private\r\n',locationId,record:{id,revision:0,factionId,modifier:2,lifecycle:'active',appearance:'coat',behavior:'waits',history:'  Author history\r\n'},health:null}};
 const view=store.executeNpc(command);
 const draft={id,writeId:randomUUID(),basis:view,concentrating:false,fields:{name:'',creature:'guard',faction:factionId,location:locationId,modifier:'-',lifecycle:'active',appearance:'  Draft appearance\r\n',behavior:'',history:'  Draft history\r\n',readAloud:'',gmNotes:'',hp:'01',maxHp:'1,5',tempHp:'',conditions:''}};
 store.keepNpcDraft(w.token,draft,null);
 return{root,file,store,cam,w,id,factionId,locationId,view,command,draft,base};
}
function damage(x,table,edit){const row=x.store.db.prepare('SELECT * FROM '+table).get(),v=JSON.parse(row.payload);edit(v);const p=JSON.stringify(v);x.store.db.prepare('UPDATE '+table+' SET payload=?,checksum=?').run(p,hash(p));}
for(const [table,name,edit,read]of [
 ['npc_record','identity',v=>v.id=randomUUID(),x=>x.store.npc(x.w.token,x.id)],
 ['npc_record','revision',v=>v.revision=99,x=>x.store.npc(x.w.token,x.id)],
 ['npc_record','modifier',v=>v.modifier='2',x=>x.store.npcs(x.w.token,{text:'',lifecycle:'all',factionId:null,locationId:null,offset:0})],
 ['npc_record','lifecycle',v=>v.lifecycle='deleted',x=>x.store.npc(x.w.token,x.id)],
 ['npc_record','faction',v=>v.factionId=randomUUID(),x=>x.store.npc(x.w.token,x.id)],
 ['npc_draft','identity',v=>v.id=randomUUID(),x=>x.store.npcDraft(x.w.token,x.id)],
 ['npc_draft','raw fields',v=>v.fields.hp=1,x=>x.store.npcDraft(x.w.token,x.id)],
 ['npc_draft','missing raw fields',v=>delete v.fields.history,x=>x.store.npcDraft(x.w.token,x.id)],
 ['npc_draft','future basis',v=>v.basis.noteRevision=99,x=>x.store.npcDraft(x.w.token,x.id)],
 ['npc_draft','health basis',v=>v.basis.health.hp=999,x=>x.store.npcDraft(x.w.token,x.id)],
 ['npc_receipt','result identity',v=>v.id=randomUUID(),null],
 ['npc_receipt','role',v=>v.role='hostile',x=>x.store.executeNpc(x.command)],
])test(`checksummed NPC ${name} damage is rejected without replacing a safe backup (${table})`,async t=>{
 const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const original=readFileSync(safe);damage(x,table,edit);const bytes=x.store.db.serialize();if(read)assert.throws(()=>read(x));await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(original));assert.ok(x.store.db.serialize().equals(bytes));
});
test('invalid raw draft and profile writes leave saved inputs and the database intact',t=>{
 const x=fixture(t);
 for(const edit of [d=>d.fields=[],d=>d.fields.hp=1,d=>d.basis.record.id=randomUUID(),d=>d.basis.actorRevision=-1,d=>d.fields.faction=randomUUID()]){const d=structuredClone(x.draft);d.writeId=randomUUID();edit(d);const bytes=x.store.db.serialize();assert.throws(()=>x.store.keepNpcDraft(x.w.token,d,x.draft.writeId));assert.ok(x.store.db.serialize().equals(bytes));assert.deepEqual(x.store.npcDraft(x.w.token,x.id),x.draft);}
 const c={...x.base(),expectedNoteRevision:x.view.noteRevision,expectedRecordRevision:x.view.record.revision,expectedActorRevision:x.view.actorRevision,expectedPositionRevision:x.view.positionRevision,npc:structuredClone(x.view)};c.npc.record.revision=99;const bytes=x.store.db.serialize();assert.throws(()=>x.store.executeNpc(c));assert.ok(x.store.db.serialize().equals(bytes));
});
test('NPC profile, raw draft and historical receipts copy independently and reopen',async t=>{
 const x=fixture(t),snapshot=path.join(x.root,'snapshot.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const original=readFileSync(snapshot),file=path.join(x.root,'copy.sqlite'),target=new CampaignStore(file);let camId,id,draft;
 try{const copy=target.acceptCampaignSnapshot(snapshot,'Copy',{}),w=target.activate(copy.id);camId=copy.id;id=target.db.prepare('SELECT id FROM npc_record WHERE campaign_id=?').get(camId).id;assert.notEqual(id,x.id);const v=target.npc(w.token,id);assert.notEqual(v.record.factionId,x.factionId);assert.notEqual(v.locationId,x.locationId);assert.equal(v.record.history,x.view.record.history);draft=target.npcDraft(w.token,id);assert.equal(draft.basis.id,id);assert.equal(draft.fields.faction,v.record.factionId);assert.equal(draft.fields.location,v.locationId);assert.equal(draft.fields.hp,'01');assert.equal(draft.fields.maxHp,'1,5');assert.equal(draft.fields.history,x.draft.fields.history);await target.backup(path.join(x.root,'copy-safe.sqlite'));}finally{target.close();}
 const fresh=new CampaignStore(file);try{const w=fresh.activate(camId);assert.deepEqual(fresh.npcDraft(w.token,id),draft);}finally{fresh.close();}assert.ok(readFileSync(snapshot).equals(original));
});
test('stale NPC inputs remain readable and portable after a profile changes or is archived',async t=>{
 const x=fixture(t),row=x.store.db.prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?').get(x.cam.id,x.id),n=JSON.parse(row.payload);
 x.store.changePreparation({...x.base(),change:{kind:'note',expectedRevision:n.revision,note:{...n,revision:n.revision+1,gmNotes:'Updated elsewhere'}}});assert.deepEqual(x.store.npcDraft(x.w.token,x.id),x.draft);
 x.store.changePreparation({...x.base(),change:{kind:'note-trash',id:x.id,expectedRevision:n.revision+1,trashed:true}});assert.deepEqual(x.store.npcDraft(x.w.token,x.id),x.draft);await x.store.backup(path.join(x.root,'stale-safe.sqlite'));
});
for(const table of ['npc_record','npc_draft','npc_receipt'])test(`missing ${table} cannot replace a valid backup`,async t=>{const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const original=readFileSync(safe);x.store.db.exec('DROP TABLE '+table);await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(original));});
