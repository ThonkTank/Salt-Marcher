import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/treasury-integrity.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/treasury-integrity.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'treasury-integrity-')),file=path.join(root,'source.sqlite'),store=new CampaignStore(file),cam=store.create('Treasury'),w=store.activate(cam.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:cam.id,action});
 const locationId=randomUUID();store.changePreparation({...command(null),change:{kind:'location',expectedRevision:null,document:{kind:'location',version:1,id:locationId,name:'Cache',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}});
 const id=store.executeProgress(command({kind:'treasure-create',title:'Old cache',locationId})).treasureId;
 store.executeProgress(command({kind:'treasure-edit',treasureId:id,expectedRevision:1,title:'Old cache',locationId,items:[{lotId:null,item:{name:'Rope',category:'equipment',quantity:5,valueGold:'2'}}],reason:'Initial content'}));
 const treasure=store.treasure(w.token,id),item=treasure.items[0],draft={treasureId:id,revision:treasure.revision,writeId:randomUUID(),title:'  Unfinished cache\r\n',locationId,reason:'  Authored reason\r\nDo not trim.\r\n',items:[{lotId:item.id,reference:{...item.reference},name:'  Rope\r\n',category:item.category,quantity:'-',valueGold:'1,5'}]};
 store.keepTreasuryDraft(w.token,draft,null);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});return{root,file,store,cam,w,command,id,treasure,draft,locationId};
}
function activeMember(x){
 const character=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Recipient'}})).character;
 let live=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:null}));
 live=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'initialize',expectedRosterRevision:live.rosterRevision}));return x.store.live(x.w.token).roster[0];
}
function damage(x,table,edit){const row=x.store.db.prepare('SELECT * FROM '+table).get(),value=JSON.parse(row.payload);edit(value);const p=JSON.stringify(value);x.store.db.prepare('UPDATE '+table+' SET payload=?,checksum=?').run(p,hash(p));}
for(const [name,edit]of [
 ['target identity',d=>d.treasureId=randomUUID()],['future revision',d=>d.revision=99],['raw quantity',d=>d.items[0].quantity=3],['definition version',d=>d.items[0].reference.revision=-1],['definition owner',d=>d.items[0].reference.definitionId=randomUUID()],['lot identity',d=>d.items[0].lotId=42],['location owner',d=>d.locationId=randomUUID()],['write identity',d=>d.writeId=''],
])test(`checksummed treasury draft ${name} damage cannot be read or replace a safe backup`,async t=>{
 const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const before=readFileSync(safe);damage(x,'treasury_draft',edit);const bytes=x.store.db.serialize();assert.throws(()=>x.store.treasuryDraft(x.w.token,x.id));await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(before));assert.ok(x.store.db.serialize().equals(bytes));
});
for(const [name,edit]of [['identity',d=>d.id=randomUUID()],['allocated quantity',d=>d.items[0].allocated=6],['duplicate lot',d=>d.items.push({...d.items[0]})],['negative quantity',d=>d.items[0].quantity=-1],['definition owner',d=>d.items[0].reference.definitionId=randomUUID()]])test(`checksummed treasure ${name} damage cannot replace a safe backup`,async t=>{
 const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const before=readFileSync(safe);damage(x,'treasure',edit);const bytes=x.store.db.serialize();assert.throws(()=>x.store.treasure(x.w.token,x.id));await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(before));assert.ok(x.store.db.serialize().equals(bytes));
});
test('missing treasury draft table cannot replace a safe backup',async t=>{
 const x=fixture(t),safe=path.join(x.root,'safe.sqlite');await x.store.backup(safe);const before=readFileSync(safe);x.store.db.exec('DROP TABLE treasury_draft');await assert.rejects(x.store.backup(safe));assert.ok(readFileSync(safe).equals(before));
});
test('invalid structured draft references cannot overwrite the previous raw input',t=>{
 const x=fixture(t);for(const edit of [d=>d.items[0].reference.revision=-1,d=>d.items[0].lotId=42,d=>d.locationId=randomUUID()]){const d=structuredClone(x.draft);edit(d);d.writeId=randomUUID();const bytes=x.store.db.serialize();assert.throws(()=>x.store.keepTreasuryDraft(x.w.token,d,x.draft.writeId));assert.deepEqual(x.store.treasuryDraft(x.w.token,x.id),x.draft);assert.ok(x.store.db.serialize().equals(bytes));}
});
test('independent copy remaps raw draft targets and lots without changing prose or source bytes',async t=>{
 const x=fixture(t);x.store.changePreparation({...x.command(null),change:{kind:'location-trash',id:x.locationId,expectedRevision:1,trashed:true}});
 const snapshot=path.join(x.root,'snapshot.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const bytes=readFileSync(snapshot),file=path.join(x.root,'copy.sqlite'),target=new CampaignStore(file);let copyId,id;
 try{const copy=target.acceptCampaignSnapshot(snapshot,'Copy',{}),w=target.activate(copy.id),row=target.db.prepare('SELECT * FROM treasury_draft WHERE campaign_id=?').get(copy.id),d=JSON.parse(row.payload);copyId=copy.id;id=row.treasure_id;assert.notEqual(id,x.id);assert.notEqual(d.writeId,x.draft.writeId);assert.notEqual(d.items[0].lotId,x.draft.items[0].lotId);assert.equal(d.items[0].lotId,target.treasure(w.token,id).items[0].id);assert.notEqual(d.locationId,x.locationId);assert.equal(d.reason,x.draft.reason);assert.equal(d.title,x.draft.title);assert.equal(d.items[0].quantity,'-');assert.equal(d.items[0].valueGold,'1,5');assert.equal(target.treasuryDraft(w.token,id).reason,x.draft.reason);await target.backup(path.join(x.root,'copy-safe.sqlite'));}finally{target.close();}
 const fresh=new CampaignStore(file);try{const w=fresh.activate(copyId);assert.equal(fresh.treasuryDraft(w.token,id).reason,x.draft.reason);}finally{fresh.close();}assert.ok(readFileSync(snapshot).equals(bytes));
});
test('editing remaining quantities and moving lots preserve allocations, provenance and replay',async t=>{
 const x=fixture(t);x.store.discardTreasuryDraft(x.w.token,x.id,x.draft.writeId);
 const member=activeMember(x),lot=x.treasure.items[0];
 const allocated=x.store.executeProgress(x.command({kind:'allocate',treasureId:x.id,expectedRevision:2,itemId:lot.id,expectedDefinitionRevision:lot.currentDefinition.revision,quantity:2,characterId:member.id,expectedMembershipRevision:member.membershipRevision}));
 const ledger=x.store.ledgerItem(x.w.token,allocated.ledgerIds[0]);const edit=x.command({kind:'treasure-edit',treasureId:x.id,expectedRevision:3,title:'Edited cache',locationId:x.locationId,reason:'  Keep granted items\r\n',items:[{lotId:lot.id,item:{name:lot.name,category:lot.category,quantity:2,valueGold:'2',reference:lot.reference}}]});
 const edited=x.store.executeProgress(edit);assert.deepEqual(x.store.executeProgress(edit),edited);let treasure=x.store.treasure(x.w.token,x.id);assert.equal(treasure.items[0].quantity,4);assert.equal(treasure.items[0].allocated,2);assert.deepEqual(x.store.ledgerItem(x.w.token,ledger.id),ledger);
 const move=x.command({kind:'treasure-move',treasureId:x.id,expectedRevision:4,itemId:lot.id,quantity:1,target:{title:'New cache',locationId:null},reason:'  Split cache\r\n'}),moved=x.store.executeProgress(move);assert.deepEqual(x.store.executeProgress(move),moved);
 treasure=x.store.treasure(x.w.token,x.id);assert.equal(treasure.items[0].quantity,3);assert.equal(treasure.items[0].allocated,2);const target=x.store.treasure(x.w.token,moved.treasureId);assert.equal(target.items[0].origin.treasureId,x.id);assert.equal(target.items[0].origin.itemId,lot.id);assert.equal(target.items[0].quantity,1);assert.deepEqual(x.store.ledgerItem(x.w.token,ledger.id),ledger);await x.store.backup(path.join(x.root,'moved-safe.sqlite'));
});

test('raw draft saves replay exactly and a stale writer cannot replace newer input',async t=>{
 const x=fixture(t),next={...structuredClone(x.draft),writeId:randomUUID(),title:'',reason:'  Later notes\r\n'};next.items[0].quantity='';
 x.store.keepTreasuryDraft(x.w.token,next,x.draft.writeId);const bytes=x.store.db.serialize();x.store.keepTreasuryDraft(x.w.token,next,x.draft.writeId);assert.ok(x.store.db.serialize().equals(bytes));assert.deepEqual(x.store.treasuryDraft(x.w.token,x.id),next);
 assert.throws(()=>x.store.keepTreasuryDraft(x.w.token,{...x.draft,writeId:randomUUID()},x.draft.writeId));assert.ok(x.store.db.serialize().equals(bytes));await x.store.backup(path.join(x.root,'raw-safe.sqlite'));
});

test('allocated history and editable remaining quantities have independent bounds',async t=>{
 const x=fixture(t),member=activeMember(x),lot=x.treasure.items[0];x.store.discardTreasuryDraft(x.w.token,x.id,x.draft.writeId);
 const edit=expectedRevision=>x.command({kind:'treasure-edit',treasureId:x.id,expectedRevision,title:'Large cache',locationId:null,reason:'Restock remaining quantities',items:[{lotId:lot.id,item:{name:lot.name,category:lot.category,quantity:1000000,valueGold:'2',reference:lot.reference}}]});
 x.store.executeProgress(edit(2));const award=x.store.executeProgress(x.command({kind:'allocate',treasureId:x.id,expectedRevision:3,itemId:lot.id,expectedDefinitionRevision:lot.currentDefinition.revision,quantity:1000000,characterId:member.id,expectedMembershipRevision:member.membershipRevision}));
 const ledger=x.store.ledgerItem(x.w.token,award.ledgerIds[0]);x.store.executeProgress(edit(4));const book=x.store.treasure(x.w.token,x.id);assert.equal(book.items[0].quantity,2000000);assert.equal(book.items[0].allocated,1000000);assert.deepEqual(x.store.ledgerItem(x.w.token,ledger.id),ledger);await x.store.backup(path.join(x.root,'restocked-safe.sqlite'));
});

function batchRecipients(x){
 const first=activeMember(x),second=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Second recipient'}})).character,live=x.store.live(x.w.token);
 x.store.executeLive(x.command({kind:'membership',characterId:second.id,expectedRevision:second.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:live.scene.id,expectedFocusRevision:live.focusRevision}));return[first,x.store.live(x.w.token).roster.find(c=>c.id===second.id)];
}
test('one batch distributes distinct quantities to two recipients and replays without further awards',t=>{
 const x=fixture(t),people=batchRecipients(x),lot=x.treasure.items[0],progress=x.store.progress(x.w.token),allocations=people.map((c,i)=>({itemId:lot.id,expectedDefinitionRevision:lot.currentDefinition.revision,quantity:i===0?2:1,characterId:c.id,expectedMembershipRevision:c.membershipRevision})),cmd=x.command({kind:'allocate-batch',treasureId:x.id,expectedRevision:x.treasure.revision,allocations}),ack=x.store.executeProgress(cmd),after=x.store.db.serialize();
 assert.equal(ack.ledgerIds.length,2);for(let i=0;i<2;i++){const entry=x.store.ledgerItem(x.w.token,ack.ledgerIds[i]);assert.equal(entry.characterId,people[i].id);assert.equal(entry.quantity,allocations[i].quantity);assert.equal(entry.treasureId,x.id);assert.equal(entry.reference.definitionId,lot.reference.definitionId);}
 assert.equal(x.store.treasure(x.w.token,x.id).items[0].allocated,3);assert.equal(x.store.treasure(x.w.token,x.id).revision,x.treasure.revision+1);assert.deepEqual(x.store.executeProgress(cmd),ack);assert.ok(x.store.db.serialize().equals(after));assert.deepEqual(x.store.progress(x.w.token),progress);
});
test('an overdrawn second allocation rolls back the first recipient and the whole batch receipt',t=>{
 const x=fixture(t),people=batchRecipients(x),lot=x.treasure.items[0],allocations=people.map((c,i)=>({itemId:lot.id,expectedDefinitionRevision:lot.currentDefinition.revision,quantity:i===0?2:4,characterId:c.id,expectedMembershipRevision:c.membershipRevision})),before=x.store.db.serialize();
 assert.throws(()=>x.store.executeProgress(x.command({kind:'allocate-batch',treasureId:x.id,expectedRevision:x.treasure.revision,allocations})),/Menge/);assert.ok(x.store.db.serialize().equals(before));assert.equal(x.store.treasure(x.w.token,x.id).items[0].allocated,0);
});
