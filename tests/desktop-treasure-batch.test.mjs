import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/planner-treasure-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});const {CampaignStore}=createRequire(import.meta.url)('../.build/planner-treasure-store.cjs');
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'treasure-batch-')),file=path.join(root,'store.sqlite'),x={root,file,store:new CampaignStore(file)};x.campaign=x.store.create('Schatz');x.w=x.store.activate(x.campaign.id);x.command=action=>({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action});x.characters=['Ada','Borin'].map(name=>x.store.executeLive(x.command({kind:'create-character',profile:{name}})).character);for(const c of x.characters){const v=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:v.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:v.focusRevision}));}x.characters=x.store.live(x.w.token).roster;x.unknown=x.store.executeItemShop(x.command({kind:'definition',expectedRevision:null,definition:{id:randomUUID(),revision:0,name:'Stein',category:'other',magic:false,rarity:'',attunement:'no',unitCopper:null,weightText:'',properties:[],description:'',source:{kind:'authored',label:'Unbekannter Wert',license:null,url:null},trashed:false}})).definition;const ack=x.store.executeProgress(x.command({kind:'treasure',sceneId:null,title:'  Originalfund\r\n',items:[{name:'Seil',category:'equipment',quantity:5,valueGold:'1.01'},{name:'Stein',category:'other',quantity:3,valueGold:'',reference:{kind:'authored',definitionId:x.unknown.id,revision:x.unknown.revision}}]}));x.id=ack.treasureId;x.book=()=>x.store.treasure(x.w.token,x.id);x.portion=(item=0,character=0,quantity=1)=>{const lot=x.book().items[item],c=x.characters[character];return{itemId:lot.id,expectedDefinitionRevision:lot.currentDefinition.revision,quantity,characterId:c.id,expectedMembershipRevision:c.membershipRevision};};x.action=allocations=>({kind:'allocate-batch',treasureId:x.id,expectedRevision:x.book().revision,allocations});t.after(()=>{x.store.close();rmSync(root,{recursive:true,force:true});});return x;}
test('batch preserves quantities, unknown values, recipients and exact replay through Fresh',t=>{const x=fixture(t),book=x.book(),progress=x.store.progress(x.w.token),command=x.command(x.action([x.portion(0,0,2),x.portion(0,1,1),x.portion(1,1,2)])),ack=x.store.executeProgress(command);assert.equal(ack.ledgerIds.length,3);assert.equal(x.book().revision,book.revision+1);assert.deepEqual(x.book().items.map(i=>i.allocated),[3,2]);const ledger=ack.ledgerIds.map(id=>x.store.ledgerItem(x.w.token,id));assert.deepEqual(ledger.map(i=>i.quantity),[2,1,2]);for(const [i,entry]of ledger.entries()){assert.equal(entry.treasureId,x.id);assert.equal(entry.reference.definitionId,book.items[i===2?1:0].reference.definitionId);}assert.equal(ledger[0].unitCopper,'101');assert.equal(ledger[2].unitCopper,null);assert.deepEqual(ledger.map(i=>i.characterId),[x.characters[0].id,x.characters[1].id,x.characters[1].id]);assert.deepEqual(x.store.progress(x.w.token),progress);const before=x.store.db.serialize();x.store.executeProgress(command);assert.ok(x.store.db.serialize().equals(before));x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);command.token=x.w.token;assert.deepEqual(x.store.executeProgress(command).ledgerIds,ack.ledgerIds);assert.deepEqual(x.book().items.map(i=>i.allocated),[3,2]);});
for(const fault of ['total','definition','membership','duplicate'])test('invalid '+fault+' in a later batch portion rolls all effects back',t=>{const x=fixture(t),a=x.portion(0,0,3),b=x.portion(0,1,1);if(fault==='total')b.quantity=3;if(fault==='definition')b.expectedDefinitionRevision++;if(fault==='membership')b.expectedMembershipRevision++;if(fault==='duplicate')Object.assign(b,a);const before=x.store.db.serialize();assert.throws(()=>x.store.executeProgress(x.command(x.action([a,b]))));assert.ok(x.store.db.serialize().equals(before));});
test('a ledger fault in the second recipient rolls back the first allocation and receipt',t=>{const x=fixture(t);x.store.db.exec(`CREATE TRIGGER reject_later BEFORE INSERT ON character_ledger WHEN NEW.character_id='${x.characters[1].id}' BEGIN SELECT RAISE(ABORT,'controlled second ledger'); END`);const command=x.command(x.action([x.portion(0,0,2),x.portion(0,1,1)])),before=x.store.db.serialize();assert.throws(()=>x.store.executeProgress(command),/controlled second ledger/);assert.ok(x.store.db.serialize().equals(before));x.store.db.exec('DROP TRIGGER reject_later');assert.equal(x.store.executeProgress(command).ledgerIds.length,2);});


test('confirmed rewards retain original receipts and linked corrected history through Fresh and independent copy',async t=>{
 const x=fixture(t),hero=x.characters[0],other=x.characters[1];
 const p=()=>x.store.progress(x.w.token).characters.find(c=>c.characterId===hero.id);
 const xp=x.command({kind:'xp',characterId:hero.id,expectedRevision:p().revision,mode:'set',amount:1000,reason:'Originale XP'});
 const xpAck=x.store.executeProgress(xp);
 const allocation=x.command(x.action([x.portion(0,0,2)])),allocationAck=x.store.executeProgress(allocation);
 // The write completed, but its response is assumed lost. Later writes are real
 // independent commands; recovering the old receipt must not replace their truth.
 const originalId=allocationAck.ledgerIds[0],transfer=x.command({kind:'ledger-transfer',entryId:originalId,expectedRevision:1,quantity:1,characterId:other.id,expectedMembershipRevision:other.membershipRevision,reason:'Weitergabe '+originalId});
 const transferAck=x.store.executeProgress(transfer),receivedId=transferAck.ledgerIds[2];
 const sale=x.store.executeProgress(x.command({kind:'ledger',entryId:receivedId,expectedRevision:1,operation:'sold',quantity:1,actualGold:'7',counterparty:'Markt',reason:'Verkauft'}));
 x.store.executeProgress(x.command({kind:'ledger',entryId:sale.ledgerIds[1],expectedRevision:1,operation:'correct',quantity:0,correctedQuantity:1,actualGold:'6',counterparty:'',reason:'Erlös berichtigt'}));
 x.store.executeProgress(x.command({kind:'xp',characterId:hero.id,expectedRevision:p().revision,mode:'subtract',amount:950,reason:'XP berichtigt',correctionOf:xp.commandId}));
 const expected=x.store.lootBalance(x.w.token).characters.map(c=>[c.name,c.copper]);assert.deepEqual(expected,[['Ada','701'],['Borin','0']]);
 const history=x.store.progressHistory(x.w.token,other.id,null).items.find(e=>e.kind==='loot-transfer-received');
 assert.equal(history.facts.sourceId,history.facts.entry.parentId);
 const refs=[xp,allocation,transfer].map(command=>({family:'progress',commandId:command.commandId,campaignId:x.campaign.id,fingerprint:createHash('sha256').update(JSON.stringify({...command,token:undefined})).digest('hex')}));
 const recovered=()=>{
  const before=x.store.db.serialize();
  for(const [i,ack]of [xpAck,allocationAck,transferAck].entries()){
   assert.deepEqual(x.store.commitStatus(refs[i],x.w.token),{outcome:'applied',value:ack});
   assert.deepEqual(x.store.executeProgress({...[xp,allocation,transfer][i],token:x.w.token}),ack);
  }
  assert.ok(x.store.db.serialize().equals(before));assert.equal(p().xp,50);
  assert.deepEqual(x.store.lootBalance(x.w.token).characters.map(c=>[c.name,c.copper]),expected);
 };
 recovered();x.store.close();x.store=new CampaignStore(x.file);x.w=x.store.activate(x.campaign.id);recovered();
 const snapshot=path.join(x.root,'campaign.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);
 const source=x.store.db.serialize(),bytes=readFileSync(snapshot),copyFile=path.join(x.root,'copy.sqlite');let copy=new CampaignStore(copyFile);
 try{
  const cam=copy.acceptCampaignSnapshot(snapshot,'Eigene Fortsetzung',{});let w=copy.activate(cam.id);
  const verify=()=>{
   assert.deepEqual(copy.lootBalance(w.token).characters.map(c=>[c.name,c.copper]),expected);
   const people=copy.live(w.token).roster,ada=people.find(c=>c.profile.name==='Ada'),borin=people.find(c=>c.profile.name==='Borin');
   assert.notEqual(ada.id,hero.id);assert.equal(copy.progress(w.token).characters.find(c=>c.characterId===ada.id).xp,50);
   const xpEvents=copy.progressHistory(w.token,ada.id,null).items.filter(e=>e.kind==='xp');
   const corrected=xpEvents.find(e=>e.facts.correctionOf),original=xpEvents.find(e=>e.id===corrected.facts.correctionOf);
   assert.ok(original);assert.notEqual(original.id,xp.commandId);assert.equal(original.facts.after.xp,1000);assert.equal(corrected.facts.after.xp,50);
   const event=copy.progressHistory(w.token,borin.id,null).items.find(e=>e.kind==='loot-transfer-received');
   assert.equal(event.facts.reason,history.facts.reason); // authored UUID-looking prose is opaque
   assert.notEqual(event.id,history.id);assert.notEqual(event.facts.entry.id,receivedId);
   assert.notEqual(event.facts.entry.parentId,transferAck.ledgerIds[1]);
   assert.equal(event.facts.sourceId,event.facts.entry.parentId);
   const handed=copy.ledgerItem(w.token,event.facts.sourceId);assert.equal(handed.characterId,ada.id);assert.equal(handed.recipientCharacterId,borin.id);
   assert.equal(copy.ledgerItem(w.token,event.facts.entry.id).parentId,handed.id);
  };
  verify();copy.close();copy=new CampaignStore(copyFile);w=copy.activate(cam.id);verify();
 }finally{copy.close();}
 assert.ok(x.store.db.serialize().equals(source));assert.ok(readFileSync(snapshot).equals(bytes));
});
