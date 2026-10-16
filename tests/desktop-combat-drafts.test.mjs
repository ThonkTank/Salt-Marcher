import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import Database from 'better-sqlite3';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/combat-drafts-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/combat-drafts-store.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'combat-drafts-')),filename=path.join(root,'source.sqlite'),store=new CampaignStore(filename),campaign=store.create('Entwurfsquelle'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
 const character=store.executeLive(command({kind:'create-character',profile:{name:'Arin'}})).character;let live=store.live(w.token);
 store.executeLive(command({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:null,expectedFocusRevision:null}));live=store.live(w.token);store.executeLive(command({kind:'initialize',expectedRosterRevision:live.rosterRevision}));live=store.live(w.token);
 let combat=store.executeCombat({...command({kind:'create',sceneId:live.focusId,title:'Originaltitel',includeParty:true,expectedMembershipRevision:live.scene.membershipRevision}),combatId:null,expectedRevision:null}).combat;
 const fighter=()=>({version:1,kind:'fighter',writeId:randomUUID(),combatId:combat.id,sceneId:combat.sceneId,targetId:combat.participants[0].id,revision:combat.revision,basis:structuredClone(combat.participants[0]),values:{'fighter-name':'Unfertig','fighter-initiative':'1,5','fighter-bonus':'-','fighter-ac':'14','fighter-hp':'','fighter-max-hp':'','fighter-temp-hp':'0','fighter-conditions':'Notiz '+combat.participants[0].id,'fighter-xp':''},concentrating:true,counted:false});
 const notes=()=>({version:1,kind:'notes',writeId:randomUUID(),combatId:combat.id,sceneId:combat.sceneId,targetId:combat.id,revision:combat.revision,basis:{title:combat.title,notes:combat.notes},values:{title:'Offener Titel',notes:'Ungespeichert ☀'}});
 const act=(action,extra={})=>(combat=store.executeCombat({...command(action),combatId:combat.id,expectedRevision:combat.revision,...extra}).combat);
 t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});return{store,filename,root,campaign,w,command,fighter,notes,act,get combat(){return combat;}};
}
test('raw fighter and note drafts survive a fresh store without changing confirmed combat',t=>{
 const x=fixture(t),f=x.fighter(),n=x.notes(),confirmed=JSON.stringify(x.combat);x.store.keepCombatDraft(x.w.token,f,null);x.store.keepCombatDraft(x.w.token,n,null);
 const fresh=new CampaignStore(x.filename);try{const w=fresh.activate(x.campaign.id);assert.deepEqual(fresh.combatDraft(w.token,f.combatId,'fighter',f.targetId),f);assert.deepEqual(fresh.combatDraft(w.token,n.combatId,'notes',n.targetId),n);assert.equal(JSON.stringify(fresh.combat(w.token,f.sceneId).combat),confirmed);assert.equal(fresh.combatDrafts(w.token,f.combatId,null).items.length,2);}finally{fresh.close();}
});
test('CAS, identical lost-reply retry and exact discard preserve a newer draft',t=>{
 const x=fixture(t),a=x.fighter();x.store.keepCombatDraft(x.w.token,a,null);x.store.keepCombatDraft(x.w.token,a,null);const b={...a,writeId:randomUUID(),values:{...a.values,'fighter-name':'Neu'}};x.store.keepCombatDraft(x.w.token,b,a.writeId);const original=x.store.db.serialize();assert.throws(()=>x.store.keepCombatDraft(x.w.token,{...a,writeId:randomUUID()},a.writeId));assert.throws(()=>x.store.discardCombatDraft(x.w.token,a.combatId,'fighter',a.targetId,a.writeId));assert.ok(x.store.db.serialize().equals(original));x.store.discardCombatDraft(x.w.token,b.combatId,'fighter',b.targetId,b.writeId);assert.equal(x.store.combatDraft(x.w.token,b.combatId,'fighter',b.targetId),null);
});
test('explicit edit atomically consumes its draft; receipt replay cannot delete a newer input',t=>{
 const x=fixture(t),a=x.fighter();x.store.keepCombatDraft(x.w.token,a,null);const c={...x.command({kind:'edit',participantId:a.targetId,changes:{name:'Bestätigt'}}),combatId:a.combatId,expectedRevision:x.combat.revision,draftWriteId:a.writeId},result=x.store.executeCombat(c);assert.equal(x.store.combatDraft(x.w.token,a.combatId,'fighter',a.targetId),null);const b={...a,writeId:randomUUID(),revision:result.combat.revision,basis:result.combat.participants[0]};x.store.keepCombatDraft(x.w.token,b,null);x.store.executeCombat(c);assert.equal(x.store.combatDraft(x.w.token,b.combatId,'fighter',b.targetId).writeId,b.writeId);
});
test('failure at draft consumption rolls combat and receipt back, keeping original raw values',t=>{
 const x=fixture(t),a=x.notes();x.store.keepCombatDraft(x.w.token,a,null);const before=x.store.db.prepare('SELECT payload FROM combat').get().payload;x.store.db.exec("CREATE TRIGGER fail_draft BEFORE DELETE ON combat_working_draft BEGIN SELECT RAISE(ABORT,'controlled delete fault'); END");const c={...x.command({kind:'notes',title:'Bestätigt',notes:'Neu'}),combatId:a.combatId,expectedRevision:x.combat.revision,draftWriteId:a.writeId};assert.throws(()=>x.store.executeCombat(c),/controlled delete fault/);assert.equal(x.store.db.prepare('SELECT payload FROM combat').get().payload,before);assert.equal(x.store.db.prepare('SELECT 1 FROM combat_receipt WHERE command_id=?').get(c.commandId),undefined);assert.deepEqual(x.store.combatDraft(x.w.token,a.combatId,'notes',a.targetId),a);
});
test('changed original basis cannot be rebased by supplying the current combat revision',t=>{
 const x=fixture(t),a=x.fighter();x.store.keepCombatDraft(x.w.token,a,null);x.act({kind:'edit',participantId:a.targetId,changes:{name:'Extern geändert'}});assert.throws(()=>x.act({kind:'edit',participantId:a.targetId,changes:{name:'Ungeprüft'}},{draftWriteId:a.writeId}));assert.equal(x.store.combatDraft(x.w.token,a.combatId,'fighter',a.targetId).writeId,a.writeId);
});
test('removed participant and finished combat retain recoverable draft records',t=>{
 const x=fixture(t),f=x.fighter(),n=x.notes();x.store.keepCombatDraft(x.w.token,f,null);x.store.keepCombatDraft(x.w.token,n,null);x.act({kind:'remove',participantId:f.targetId});x.act({kind:'finish',outcome:'Beendet'});assert.deepEqual(x.store.combatDraft(x.w.token,f.combatId,'fighter',f.targetId),f);assert.deepEqual(x.store.combatDraft(x.w.token,n.combatId,'notes',n.targetId),n);assert.equal(x.store.combatDrafts(x.w.token,f.combatId,null).items.length,2);assert.throws(()=>x.store.keepCombatDraft(x.w.token,{...f,writeId:randomUUID()},f.writeId));
});
test('corrupted records are disclosed and block overwrite and backup without changing safe bytes',async t=>{
 const x=fixture(t),a=x.fighter();x.store.keepCombatDraft(x.w.token,a,null);const filename=path.join(x.root,'safe.sqlite');await x.store.backup(filename);const safe=readFileSync(filename);x.store.db.prepare("UPDATE combat_working_draft SET checksum='broken'").run();const original=x.store.db.prepare('SELECT * FROM combat_working_draft').get();assert.equal(x.store.combatDrafts(x.w.token,a.combatId,null).problems.length,1);assert.throws(()=>x.store.keepCombatDraft(x.w.token,{...a,writeId:randomUUID()},a.writeId));await assert.rejects(x.store.backup(filename));assert.deepEqual(x.store.db.prepare('SELECT * FROM combat_working_draft').get(),original);assert.ok(readFileSync(filename).equals(safe));
});
test('campaign copy remaps structured basis and target while keeping raw prose; erase removes drafts',async t=>{
 const x=fixture(t),a=x.fighter(),n=x.notes();x.store.keepCombatDraft(x.w.token,a,null);x.store.keepCombatDraft(x.w.token,n,null);const snapshot=path.join(x.root,'snapshot.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const bytes=readFileSync(snapshot),target=new CampaignStore(path.join(x.root,'target.sqlite'));try{const copy=target.acceptCampaignSnapshot(snapshot,'Kopie',{}),w=target.activate(copy.id),row=target.db.prepare('SELECT * FROM combat_working_draft WHERE kind=?').get('fighter'),d=JSON.parse(row.payload);assert.notEqual(d.combatId,a.combatId);assert.equal(row.target_id,d.targetId);assert.equal(d.basis.id,d.targetId);assert.notEqual(d.basis.characterId,a.basis.characterId);assert.deepEqual(d.values,a.values);assert.equal(hash(row.payload),row.checksum);assert.ok(readFileSync(snapshot).equals(bytes));await target.backup(path.join(x.root,'copied-safe.sqlite'));target.trashCampaign({commandId:randomUUID(),id:copy.id,expectedRevision:0,trashed:true});target.eraseCampaign({commandId:randomUUID(),id:copy.id,expectedRevision:1,confirmName:'Kopie'});assert.equal(target.db.prepare('SELECT count(*) AS n FROM combat_working_draft').get().n,0);}finally{target.close();}
});
test('old package rejection preserves source and target; owned stores still install current draft tables',async t=>{
 const x=fixture(t),currentSchema=x.store.db.pragma('user_version',{simple:true}),snapshot=path.join(x.root,'v33.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const old=new Database(snapshot);old.exec('DROP TABLE finish_draft; DROP TABLE combat_working_draft; DROP TABLE narrative_draft; DROP TABLE narrative_award; DROP TABLE narrative_state; DROP TABLE dungeon_content_signal; DROP TABLE dungeon_feature_knowledge; DROP TABLE dungeon_content_state');old.pragma('user_version=33');old.close();const original=readFileSync(snapshot),targetBefore=x.store.db.serialize();assert.throws(()=>x.store.campaignPreview(snapshot),/alten Testformat/);assert.throws(()=>x.store.acceptCampaignSnapshot(snapshot,'Altformatkopie',{}),/alten Testformat/);assert.ok(readFileSync(snapshot).equals(original));assert.ok(x.store.db.serialize().equals(targetBefore));const oldStore=path.join(x.root,'old-store.sqlite');await x.store.db.backup(oldStore);const d=new Database(oldStore);d.exec('DROP TABLE finish_draft; DROP TABLE combat_working_draft; DROP TABLE narrative_draft; DROP TABLE narrative_award; DROP TABLE narrative_state; DROP TABLE dungeon_content_signal; DROP TABLE dungeon_feature_knowledge; DROP TABLE dungeon_content_state');d.pragma('user_version=33');d.close();const reopened=new CampaignStore(oldStore);try{assert.equal(reopened.db.pragma('user_version',{simple:true}),currentSchema);assert.equal(reopened.combatDrafts(reopened.activate(x.campaign.id).token,x.combat.id,null).items.length,0);}finally{reopened.close();}
});

test('monster initiative rolls preserve player-entered values through modes, undo and fresh storage',t=>{
 const x=fixture(t),hero=x.combat.participants[0];
 x.act({kind:'edit',participantId:hero.id,changes:{initiative:137,initiativeBonus:999}});
 x.act({kind:'add',name:'Zollwache',count:3,grouped:true,maxHp:11,armorClass:12,initiativeBonus:2});
 for(const mode of ['normal','advantage','disadvantage']){
  const before=structuredClone(x.combat);x.act({kind:'roll',mode});
  assert.equal(x.combat.participants.find(p=>p.id===hero.id).initiative,137);
  const monsters=x.combat.participants.filter(p=>!p.characterId);assert.equal(new Set(monsters.map(p=>p.initiative)).size,1);assert.ok(monsters.every(p=>p.initiative>=3&&p.initiative<=22));
  assert.equal(x.combat.turnId,before.turnId);assert.equal(x.combat.round,before.round);
  x.act({kind:'undo'});assert.deepEqual(x.combat.participants,before.participants);
 }
 x.act({kind:'roll',mode:'normal'});x.act({kind:'start'});const turn=x.combat.turnId;
 x.act({kind:'roll',mode:'advantage'});assert.equal(x.combat.turnId,turn);assert.equal(x.combat.participants.find(p=>p.id===hero.id).initiative,137);
 const fresh=new CampaignStore(x.filename);try{const w=fresh.activate(x.campaign.id),saved=fresh.combat(w.token,x.combat.sceneId,x.combat.id).combat;assert.equal(saved.participants.find(p=>p.id===hero.id).initiative,137);assert.equal(saved.turnId,turn);}finally{fresh.close();}
});


test('initiative draft and fighter HP draft are independent, atomic, retryable and portable',async t=>{
 const x=fixture(t),actor=x.combat.participants[0],hp=x.fighter();hp.values['fighter-hp']='20';x.store.keepCombatDraft(x.w.token,hp,null);
 const d={version:1,kind:'initiative',writeId:randomUUID(),combatId:x.combat.id,sceneId:x.combat.sceneId,targetId:x.combat.id,revision:x.combat.revision,basis:{phase:x.combat.phase,round:x.combat.round,turnId:x.combat.turnId,participants:x.combat.participants.map(p=>({id:p.id,groupId:p.groupId,initiative:p.initiative}))},values:[{participantId:actor.id,raw:'19'}]};x.store.keepCombatDraft(x.w.token,d,null);
 const snapshot=path.join(x.root,'initiative.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const target=new CampaignStore(path.join(x.root,'initiative-copy.sqlite'));try{const copy=target.acceptCampaignSnapshot(snapshot,'Initiativkopie',{}),w=target.activate(copy.id),row=target.db.prepare("SELECT payload FROM combat_working_draft WHERE kind='initiative'").get(),copied=JSON.parse(row.payload);assert.notEqual(copied.values[0].participantId,actor.id);assert.equal(copied.basis.participants[0].id,copied.values[0].participantId);assert.equal(copied.values[0].raw,'19');assert.equal(target.combatDraft(w.token,copied.combatId,'initiative',copied.combatId).writeId,copied.writeId);await target.backup(path.join(x.root,'safe-copy.sqlite'));}finally{target.close();}
 const fresh=new CampaignStore(x.filename);try{const w=fresh.activate(x.campaign.id);assert.deepEqual(fresh.combatDraft(w.token,d.combatId,'initiative',d.combatId),d);}finally{fresh.close();}
 const before=structuredClone(x.combat),command={...x.command({kind:'initiative',values:[{participantId:actor.id,initiative:19}],start:true}),combatId:x.combat.id,expectedRevision:x.combat.revision,draftWriteId:d.writeId};const result=x.store.executeCombat(command);assert.equal(result.combat.phase,'running');assert.equal(result.combat.participants[0].initiative,19);assert.equal(result.combat.participants[0].hp,before.participants[0].hp);assert.deepEqual(x.store.combatDraft(x.w.token,d.combatId,'fighter',hp.targetId),hp);assert.equal(x.store.combatDraft(x.w.token,d.combatId,'initiative',d.combatId),null);assert.deepEqual(x.store.executeCombat(command),result);
 const undo=x.store.executeCombat({...x.command({kind:'undo'}),combatId:d.combatId,expectedRevision:result.combat.revision}).combat;assert.equal(undo.phase,'preparing');assert.deepEqual(undo.participants,before.participants);
});
test('invalid, conflicting and stale initiative values cannot partially book or consume drafts',t=>{
 const x=fixture(t),p=x.combat.participants[0],before=x.store.db.serialize();
 for(const values of [[{participantId:p.id,initiative:12},{participantId:'foreign',initiative:4}],[{participantId:p.id,initiative:12},{participantId:p.id,initiative:13}],[{participantId:p.id,initiative:1.5}]]){assert.throws(()=>x.act({kind:'initiative',values}));assert.ok(x.store.db.serialize().equals(before));}
 const d={version:1,kind:'initiative',writeId:randomUUID(),combatId:x.combat.id,sceneId:x.combat.sceneId,targetId:x.combat.id,revision:x.combat.revision,basis:{phase:x.combat.phase,round:x.combat.round,turnId:x.combat.turnId,participants:x.combat.participants.map(p=>({id:p.id,groupId:p.groupId,initiative:p.initiative}))},values:[{participantId:p.id,raw:'19'}]};x.store.keepCombatDraft(x.w.token,d,null);assert.throws(()=>x.act({kind:'initiative',values:[{participantId:p.id,initiative:18}]},{draftWriteId:d.writeId}),/gesicherten Entwurf/);assert.deepEqual(x.store.combatDraft(x.w.token,d.combatId,'initiative',d.combatId),d);
 x.act({kind:'edit',participantId:p.id,changes:{initiative:5}});assert.throws(()=>x.act({kind:'initiative',values:[{participantId:p.id,initiative:19}]},{draftWriteId:d.writeId}),/abgleichen/);assert.deepEqual(x.store.combatDraft(x.w.token,d.combatId,'initiative',d.combatId),d);
});


test('extending the old draft constraint preserves original rowids, raw bytes and checksum',async t=>{
 const x=fixture(t),f=x.fighter();x.store.keepCombatDraft(x.w.token,f,null);const original=x.store.db.prepare('SELECT rowid,* FROM combat_working_draft').all();
 x.store.db.exec("CREATE TABLE combat_working_draft_old(campaign_id TEXT NOT NULL,combat_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('fighter','notes')),target_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,combat_id,kind,target_id),FOREIGN KEY(campaign_id,combat_id) REFERENCES combat(campaign_id,id)) STRICT; INSERT INTO combat_working_draft_old SELECT * FROM combat_working_draft; DROP TABLE combat_working_draft; ALTER TABLE combat_working_draft_old RENAME TO combat_working_draft;");
 const fresh=new CampaignStore(x.filename);try{assert.deepEqual(fresh.db.prepare('SELECT rowid,* FROM combat_working_draft').all(),original);assert.match(fresh.db.prepare("SELECT sql FROM sqlite_master WHERE name='combat_working_draft'").get().sql,/'initiative'/);const w=fresh.activate(x.campaign.id);assert.deepEqual(fresh.combatDraft(w.token,f.combatId,'fighter',f.targetId),f);await fresh.backup(path.join(x.root,'migrated.sqlite'));}finally{fresh.close();}
});
