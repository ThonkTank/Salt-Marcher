import {publishCombatHealth,syncOpenMaskHealth} from './mask-health';
import {consumeFinishDraft} from './finish-drafts';
import {readCombatDraft} from './combat-drafts';
import { randomUUID, randomInt, createHash } from 'node:crypto';
import { checkedCombat, combatOrder, type CombatState, type CombatView, type CombatCommand, type Combatant } from '../combat-contracts';
import { readLiveScene, readLive } from './live';
import { readProgressCharacter, finishCombatRewards, latestCombatStatuses, detachCombatHealth, resumeCombatHealth, lastCombatPartyParticipant, event } from './progression';
import { xpLevel } from '../progression';
import { assessEncounter } from '../encounter-contracts';
import { readCreature, readEncounterPlan } from './encounters';
import { readGeneratorRegistry } from './generation';
import {readPreparedGroup} from './session';
import type { Creature } from '../../features/catalog/creature-catalog';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installCombatSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS combat(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scene_id TEXT NOT NULL, ordinal INTEGER NOT NULL, revision INTEGER NOT NULL, phase TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    DROP INDEX IF EXISTS combat_active_scene;
    CREATE INDEX IF NOT EXISTS combat_scene_masks ON combat(campaign_id,scene_id,phase,ordinal);
    CREATE TABLE IF NOT EXISTS combat_undo(campaign_id TEXT NOT NULL, combat_id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,combat_id,ordinal), FOREIGN KEY(campaign_id,combat_id) REFERENCES combat(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS combat_receipt(command_id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaign(id), fingerprint TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL) STRICT;`);
}
function decode(row: any): CombatState {
  if (!row || hash(row.payload) !== row.checksum) throw new Error('Kampf nicht verfügbar oder beschädigt.');
  const state = checkedCombat(JSON.parse(row.payload));
  if (state.id !== row.id || state.sceneId !== row.scene_id || state.revision !== row.revision || state.phase !== row.phase) throw new Error('Kampfzuordnung widersprüchlich.');
  return state;
}
function decodeUndo(row: any, owner: Pick<CombatState, 'id' | 'sceneId'>): CombatState {
  if (!row || hash(row.payload) !== row.checksum) throw new Error('Kein rückgängiger Schritt verfügbar.');
  const state = checkedCombat(JSON.parse(row.payload));
  if (state.id !== owner.id || state.sceneId !== owner.sceneId) throw new Error('Rückgängiger Schritt gehört nicht zum Kampf.');
  return state;
}
export function validateCombatBackup(db: any) {
  for (const row of db.prepare('SELECT * FROM combat').iterate()) decode(row);
  for (const row of db.prepare('SELECT * FROM combat_undo').iterate()) {
    const owner = db.prepare('SELECT id,scene_id AS sceneId FROM combat WHERE campaign_id=? AND id=?').get(row.campaign_id, row.combat_id);
    if (!owner) throw new Error('Kampfhistory besitzt keinen Kampf.');
    decodeUndo(row, owner);
  }
  for (const row of db.prepare('SELECT * FROM combat_receipt').iterate()) {
    if (hash(row.payload) !== row.checksum) throw new Error('Kampfreceipt ist beschädigt.');
    const view = JSON.parse(row.payload) as CombatView;
    if (!view || !view.combat || !Array.isArray(view.recent) || typeof view.canUndo !== 'boolean') throw new Error('Kampfreceipt hat ein ungültiges Format.');
    const state = checkedCombat(view.combat);
    if (!db.prepare('SELECT 1 FROM combat WHERE campaign_id=? AND id=? AND scene_id=?').get(row.campaign_id, state.id, state.sceneId)) throw new Error('Kampfreceipt besitzt keinen passenden Kampf.');
  }
}
function combatParty(db: any, cam: string, state: CombatState) {
  return state.participants.filter(p=>p.characterId).map(p=>{const progress=readProgressCharacter(db,cam,p.characterId!);return {id:p.characterId!,name:p.name,level:progress.xp===null?null:xpLevel(progress.xp).level,count:1};});
}
function assessment(db: any, cam: string, state: CombatState) {
  return assessEncounter(state.partyBasis??combatParty(db,cam,state),state.participants.filter(p=>!p.characterId).map(p=>({xp:p.xp,count:1,countForMultiplier:p.countForMultiplier})));
}
function label(index: number) { let result=''; do { result=String.fromCharCode(65+index%26)+result;index=Math.floor(index/26)-1; } while(index>=0);return result; }
function addCreature(state: CombatState, creature: Creature, count: number, grouped: boolean, groupId?: string, entryId?: string) {
  if(!Number.isSafeInteger(count)||count<1||count>1000||state.participants.length+count>1000)throw new Error('Bitte eine gültige Teilnehmermenge angeben.');
  const peer=groupId?state.participants.find(p=>p.groupId===groupId&&p.sourceId===creature.id):undefined;
  if(groupId&&!peer)throw new Error('Verstärkung benötigt eine vorhandene Gruppe dieser Kreatur.');
  const shared=peer?.groupId??randomUUID(),sourceEntryId=peer?.sourceEntryId??entryId??randomUUID(),partitionKind=peer?.partitionKind??(grouped?'mob':'individual');state.sources??=[];if(!state.sources.some(c=>c.id===creature.id))state.sources.push(creature);
  state.sourceSerials??={};let serial=state.sourceSerials[creature.id]??Math.max(-1,...state.participants.filter(p=>p.sourceId===creature.id).map(p=>p.sourceOrdinal??-1))+1;
  for(let i=0;i<count;i++){const id=randomUUID();state.participants.push({id,groupId:grouped||peer?shared:id,characterId:null,name:creature.name+' '+label(serial),initiative:peer?.initiative??0,initiativeBonus:peer?.initiativeBonus??creature.initiative,armorClass:creature.ac,hp:creature.hp,maxHp:creature.hp,tempHp:0,conditions:'',concentrating:false,xp:creature.xp,countForMultiplier:true,sourceId:creature.id,sourceOrdinal:serial++,sourceEntryId,partitionKind});}
  state.sourceSerials[creature.id]=serial;
}
function partyCombatant(character: ReturnType<typeof readLive>['roster'][number],progress: ReturnType<typeof readProgressCharacter>,status?: Pick<Combatant,'tempHp'|'conditions'|'concentrating'>): Combatant {
  const id=randomUUID();return {id,groupId:id,characterId:character.id,name:character.profile.name,initiative:0,initiativeBonus:0,armorClass:character.profile.armorClass??10,maxHp:1,hp:0,tempHp:0,conditions:'',concentrating:false,healthKnown:progress.health!==null,...(progress.health??progress.combatStatus??status)};
}
function priorPartyParticipant(db:any,cam:string,state:CombatState,characterId:string) {
  const fact=lastCombatPartyParticipant(db,cam,state,characterId);if(fact)return fact;
  for(const row of db.prepare('SELECT * FROM combat_undo WHERE campaign_id=? AND combat_id=? ORDER BY ordinal DESC').iterate(cam,state.id)){const actor=decodeUndo(row,state).participants.find(p=>p.characterId===characterId);if(actor)return actor;}
  return undefined;
}
export function readCombat(db: any, campaignId: string, sceneId: string, id?: string): CombatView {
  return db.transaction(() => {
    readLiveScene(db, campaignId, sceneId);
    const row = id ? db.prepare('SELECT * FROM combat WHERE campaign_id=? AND scene_id=? AND id=?').get(campaignId, sceneId, id) : db.prepare("SELECT * FROM combat WHERE campaign_id=? AND scene_id=? ORDER BY phase IN('preparing','running') DESC,ordinal DESC LIMIT 1").get(campaignId, sceneId);
    if (id && !row) throw new Error('Kampf nicht gefunden.');
    const combat=row?decode(row):null;
    const partyCandidates=combat&&['preparing','running'].includes(combat.phase)?readLive(db,campaignId).roster.filter(c=>c.active&&c.sceneId===sceneId&&!combat.participants.some(p=>p.characterId===c.id)).map(c=>{const p=readProgressCharacter(db,campaignId,c.id);return {characterId:c.id,name:c.profile.name,membershipRevision:c.membershipRevision,progressRevision:p.revision,health:p.health};}):[];
    return { combat, partyCandidates, assessment: combat ? assessment(db,campaignId,combat) : undefined,
      canUndo: !!row && ['preparing','running'].includes(row.phase) && !!db.prepare('SELECT 1 FROM combat_undo WHERE campaign_id=? AND combat_id=? LIMIT 1').get(campaignId, row.id),
      recent: db.prepare("SELECT id,payload FROM combat WHERE campaign_id=? AND scene_id=? ORDER BY phase IN('preparing','running') DESC,ordinal DESC LIMIT 100").all(campaignId, sceneId).map((r: any) => { const c = JSON.parse(r.payload); return { id: r.id, title: c.title, phase: c.phase }; }) };
  })();
}
export function executeCombat(db: any, command: CombatCommand, guard: () => void): CombatView {
  return db.transaction(() => {
    guard();
    if (!command.commandId || command.commandId.length > 1000 || !command.action) throw new Error('Kampfauftrag fehlt.');
    const fp = hash(JSON.stringify({ ...command, token: undefined }));
    const prior = db.prepare('SELECT * FROM combat_receipt WHERE command_id=?').get(command.commandId);
    if (prior) {
      if (prior.campaign_id !== command.campaignId || prior.fingerprint !== fp || hash(prior.payload) !== prior.checksum) throw new Error('Auftragskennung bereits anders verwendet.');
      return JSON.parse(prior.payload);
    }
    const a = command.action, cam = command.campaignId;
    let consumedDraft:import('../combat-draft-contracts').CombatWorkingDraft|null=null;
    if(command.draftWriteId!==undefined){
      if(typeof command.draftWriteId!=='string'||!command.draftWriteId||!command.combatId||(a.kind!=='edit'&&a.kind!=='notes'))throw new Error('Ungültige Entwurfsübernahme.');
      consumedDraft=readCombatDraft(db,cam,command.combatId,a.kind==='edit'?'fighter':'notes',a.kind==='edit'?a.participantId:command.combatId);
      if(!consumedDraft||consumedDraft.writeId!==command.draftWriteId)throw new Error('Kampfeingabe inzwischen geändert.');
      const current=decode(db.prepare('SELECT * FROM combat WHERE campaign_id=? AND id=?').get(cam,command.combatId)),basis=consumedDraft.kind==='fighter'?current.participants.find(p=>p.id===consumedDraft!.targetId):{title:current.title,notes:current.notes};
      if(JSON.stringify(basis)!==JSON.stringify(consumedDraft.basis))throw new Error('Gespeicherte Werte des Entwurfs wurden geändert. Zuerst abgleichen.');
    }
    let state: CombatState;
    if (a.kind === 'create') {
      const scene = readLiveScene(db, cam, a.sceneId);
      if (scene.retired || scene.membershipRevision !== a.expectedMembershipRevision) throw new Error('Gruppe geändert. Bitte aktualisieren.');
      const party = a.includeParty ? readLive(db, cam).roster.filter(c => c.active && c.sceneId === scene.id) : [];
      // Conditions and temporary HP remain usable when players keep their own HP.
      // Read only validated history and stop once every unknown-health PC is found.
      const progress = new Map(party.map(c => [c.id, readProgressCharacter(db,cam,c.id)]));
      const statuses=latestCombatStatuses(db,cam,party.filter(c=>progress.get(c.id)!.health===null&&!progress.get(c.id)!.combatStatus).map(c=>c.id));
      state = { id: randomUUID(), sceneId: scene.id, revision: 1, title: a.title || 'Neue Begegnung', phase: 'preparing', round: 0, turnId: null, notes: '', outcome: '', participants: party.map(c=>partyCombatant(c,progress.get(c.id)!,statuses.get(c.id))) };
      if (a.planId) {
        const plan=readEncounterPlan(db,cam,a.planId);if(plan.revision!==a.expectedPlanRevision)throw new Error('Encounter-Vorlage geändert. Bitte erneut öffnen.');
        if(plan.generationOrigin){const registry=readGeneratorRegistry(db,cam),preset=registry.presets.find(p=>p.id===registry.effectiveId)!;state.generatorPreset={id:preset.id,revision:preset.revision,hash:preset.hash,mobThreshold:preset.config.combat.mobThreshold};}
        for(const entry of plan.entries){const creature=plan.sources.find(c=>c.id===entry.creatureId);if(!creature)throw new Error('Vorlage hat eine fehlende Kreaturquelle.');const grouped=state.generatorPreset?state.generatorPreset.mobThreshold>0&&entry.count>=state.generatorPreset.mobThreshold:entry.grouped;addCreature(state,creature,entry.count,grouped,undefined,entry.id);}
        state.notes=plan.notes;state.title=a.title||plan.name;state.planOrigin={id:plan.id,revision:plan.revision,name:plan.name};
      }
      if(a.preparedGroupId){const group=readPreparedGroup(db,cam,a.preparedGroupId),selectedActors=a.worldActorIds?group.actors.filter(actor=>a.worldActorIds!.includes(actor.id)):group.actors;if(a.worldActorIds&&(!a.worldActorIds.length||new Set(a.worldActorIds).size!==a.worldActorIds.length||a.worldActorIds.some(id=>!group.actors.some(actor=>actor.id===id))))throw new Error('Ausgewählte NPCs gehören nicht zur vorbereiteten Gruppe.');if(group.revision!==a.expectedPreparedRevision||group.locationId&&group.locationId!==scene.locationId||!selectedActors.length||selectedActors.some(actor=>actor.hp>0&&actor.unavailable)||!selectedActors.some(actor=>actor.hp>0))throw new Error('Vorbereitete Gruppe geändert, nicht am aktuellen Ort oder ein NPC nicht verfügbar.');const registry=readGeneratorRegistry(db,cam),preset=registry.presets.find(p=>p.id===registry.effectiveId)!;state.generatorPreset={id:preset.id,revision:preset.revision,hash:preset.hash,mobThreshold:preset.config.combat.mobThreshold};state.sources=group.plan.sources;state.title=a.title||group.title;state.notes=group.notes;state.planOrigin={id:group.id,revision:group.revision,name:group.title};
        for(const entry of group.plan.entries){const c=group.plan.sources.find(c=>c.id===entry.creatureId)!;const actors=selectedActors.filter(actor=>actor.entryId===entry.id&&actor.hp>0),mob=preset.config.combat.mobThreshold>0&&actors.filter(actor=>actor.hp>0).length>=preset.config.combat.mobThreshold,shared=randomUUID();for(const actor of actors){const id=randomUUID();state.participants.push({id,characterId:null,groupId:mob?shared:id,name:actor.name,initiative:0,initiativeBonus:c.initiative,armorClass:c.ac,hp:actor.hp,maxHp:actor.maxHp,tempHp:actor.tempHp,conditions:actor.conditions,concentrating:actor.concentrating,xp:c.xp,sourceId:c.id,sourceEntryId:entry.id,partitionKind:mob?'mob':'individual',worldActorId:actor.id,worldActorRevision:actor.revision});}}
      }
      checkedCombat(state);
      const ordinal = db.prepare('SELECT coalesce(max(ordinal),0)+1 n FROM combat WHERE campaign_id=?').get(cam).n;
      const payload = JSON.stringify(state);
      db.prepare('INSERT INTO combat VALUES(?,?,?,?,?,?,?,?)').run(cam, state.id, state.sceneId, ordinal, state.revision, state.phase, payload, hash(payload));
    } else {
      state = decode(db.prepare('SELECT * FROM combat WHERE campaign_id=? AND id=?').get(cam, command.combatId));
      if (state.revision !== command.expectedRevision) throw new Error('Kampf wurde geändert. Bitte aktualisieren.');
      if (!['preparing','running'].includes(state.phase)) throw new Error(state.phase==='finished'?'Der abgeschlossene Kampf bleibt als Ergebnis erhalten. Beginne eine neue Begegnung.':'Der Kampf gehört zu einer archivierten Scene.');
      if (readLiveScene(db, cam, state.sceneId).retired) throw new Error('Diese Gruppe ist nicht mehr aktiv.');
      const before = JSON.stringify(state);
      const participant = (): Combatant => { const id = 'participantId' in a ? a.participantId : null; const p = state.participants.find(p => p.id === id); if (!p) throw new Error('Teilnehmer nicht gefunden.'); return p; };
      if (a.kind === 'undo') {
        const entry = db.prepare('SELECT * FROM combat_undo WHERE campaign_id=? AND combat_id=? ORDER BY ordinal DESC LIMIT 1').get(cam, state.id);
        const restored = decodeUndo(entry, state);
        state = { ...restored, revision: state.revision };
        db.prepare('DELETE FROM combat_undo WHERE campaign_id=? AND combat_id=? AND ordinal=?').run(cam, state.id, entry.ordinal);
      } else {
        if(a.kind==='add-party'){
          const character=readLive(db,cam).roster.find(c=>c.id===a.characterId);
          if(!character?.active||character.sceneId!==state.sceneId)throw new Error('Wähle eine aktive Party-Figur dieser Gruppe.');
          if(character.membershipRevision!==a.expectedMembershipRevision)throw new Error('Party-Zuordnung geändert. Auswahl aktualisieren.');
          if(state.participants.some(p=>p.characterId===character.id))throw new Error('Figur steht bereits in dieser Initiative.');
          const progress=readProgressCharacter(db,cam,character.id);if(progress.revision!==a.expectedProgressRevision)throw new Error('Figurenstand geändert. Auswahl aktualisieren.');
          const status=progress.health===null&&!progress.combatStatus?latestCombatStatuses(db,cam,[character.id]).get(character.id):undefined,actor=partyCombatant(character,progress,status),prior=priorPartyParticipant(db,cam,state,character.id);
          if(prior){actor.id=prior.id;actor.groupId=prior.groupId;actor.initiative=state.participants.find(p=>p.groupId===prior.groupId)?.initiative??prior.initiative;actor.initiativeBonus=prior.initiativeBonus;actor.armorClass=prior.armorClass;}
          if(a.initiative!==undefined){if(!Number.isSafeInteger(a.initiative)||Math.abs(a.initiative)>1000000)throw new Error('Initiative benötigt eine gültige ganze Zahl.');if(state.participants.some(p=>p.groupId===actor.groupId&&p.initiative!==a.initiative))actor.groupId=randomUUID();actor.initiative=a.initiative;}
          state.participants.push(actor);if(state.partyBasis&&!state.partyBasis.some(p=>p.id===character.id))state.partyBasis.push({id:character.id,name:character.profile.name,level:progress.xp===null?null:xpLevel(progress.xp).level,count:1});
          event(db,cam,character.id,'combat-entry',{commandId:command.commandId,combatId:state.id,title:state.title,participant:actor,returning:!!prior});
        } else if (a.kind === 'add-creature') {
          addCreature(state,readCreature(a.creatureId),a.count,a.grouped,a.groupId);
        } else if (a.kind === 'add') {
          if (!Number.isSafeInteger(a.count) || a.count < 1 || a.count > 100 || state.participants.length + a.count > 1000) throw new Error('Bitte 1–100 Teilnehmer hinzufügen.');
          const shared = randomUUID();
          for (let i = 0; i < a.count; i++) { const id = randomUUID(); state.participants.push({ id, characterId: null, groupId: a.grouped ? shared : id, name: a.count > 1 ? a.name + ' ' + (i + 1) : a.name, initiative: 0, initiativeBonus: a.initiativeBonus, armorClass: a.armorClass, hp: a.maxHp, maxHp: a.maxHp, tempHp: 0, conditions: '', concentrating: false }); }
        } else if (a.kind === 'edit') {
          const p = participant();
          const fields = ['name', 'initiative', 'initiativeBonus', 'armorClass', 'hp', 'maxHp', 'tempHp', 'conditions', 'concentrating', 'xp', 'countForMultiplier'];
          if (!a.changes || Object.keys(a.changes).some(k => !fields.includes(k))) throw new Error('Unbekanntes Kampffeld.');
          if (p.healthKnown === false && ('hp' in a.changes || 'maxHp' in a.changes) && !('hp' in a.changes && 'maxHp' in a.changes)) throw new Error('Aktuelle und maximale HP gemeinsam eintragen.');
          Object.assign(p, a.changes); if ('hp' in a.changes && 'maxHp' in a.changes) p.healthKnown = true; p.hp = Math.min(p.hp, p.maxHp);
          if ('initiative' in a.changes) for (const peer of state.participants.filter(peer => peer.groupId === p.groupId)) peer.initiative = p.initiative;
        } else if (a.kind === 'damage' || a.kind === 'heal') {
          const p = participant();
          if (p.healthKnown === false) throw new Error('HP noch offen. Aktuelle und maximale HP eintragen, bevor Schaden oder Heilung angewendet wird.');
          if (!Number.isSafeInteger(a.amount) || a.amount <= 0 || a.amount > 1000000) throw new Error('Betrag benötigt eine positive ganze Zahl.');
          if (a.kind === 'damage') { const absorbed = Math.min(p.tempHp, a.amount); p.tempHp -= absorbed; p.hp = Math.max(0, p.hp - (a.amount - absorbed)); }
          else p.hp = Math.min(p.maxHp, p.hp + a.amount);
        } else if (a.kind === 'remove') {
          const p = participant(), order = combatOrder(state), index = order.findIndex(c => c.id === p.id);
          detachCombatHealth(db,cam,state,p,command.commandId);
          state.participants = state.participants.filter(c => c.id !== p.id);
          if (state.turnId === p.id) { const next = order[index + 1] ?? order[0]; state.turnId = state.participants.length ? (next?.id === p.id ? state.participants[0]!.id : next!.id) : null; if (index === order.length - 1 && state.participants.length) state.round++; }
          if (!state.participants.length) { state.phase = 'preparing'; state.round = 0; state.turnId = null; }
        } else if (a.kind === 'roll') {
          if (!['normal', 'advantage', 'disadvantage'].includes(a.mode)) throw new Error('Würfelmodus ungültig.');
          const rolls = new Map<string, number>();
          for (const p of state.participants) { if (!rolls.has(p.groupId)) { const x = randomInt(1, 21), y = a.mode === 'normal' ? x : randomInt(1, 21); rolls.set(p.groupId, (a.mode === 'advantage' ? Math.max(x, y) : Math.min(x, y)) + p.initiativeBonus); } p.initiative = rolls.get(p.groupId)!; }
        } else if (a.kind === 'start') {
          if (state.phase !== 'preparing' || !state.participants.length) throw new Error('Füge Teilnehmer hinzu, bevor du den Kampf beginnst.');
          state.partyBasis=combatParty(db,cam,state); state.assessment=assessment(db,cam,state); state.phase = 'running'; state.round = 1; state.turnId = combatOrder(state)[0]!.id;
        } else if (a.kind === 'next') {
          if (state.phase !== 'running') throw new Error('Kampf zuerst beginnen.');
          const order = combatOrder(state), index = order.findIndex(p => p.id === state.turnId);
          const nextIndex = (index + 1) % order.length; state.turnId = order[nextIndex]!.id; if (nextIndex === 0) state.round++;
        } else if (a.kind === 'notes') { state.title = a.title; state.notes = a.notes;
        } else if (a.kind === 'finish') {
          consumeFinishDraft(db,cam,{kind:'combat',targetId:state.id,revision:state.revision},a.finishDraftWriteId);
          if (typeof a.outcome !== 'string' || !a.outcome.trim()) throw new Error('Die Begegnung benötigt ein Ergebnis.');
          state.assessment=assessment(db,cam,state);
          state.rewards = finishCombatRewards(db, cam, state, a.rewards);
          state.phase = 'finished'; state.outcome = a.outcome;
        } else throw new Error('Unbekannte Kampfaktion.');
        const ordinal = db.prepare('SELECT coalesce(max(ordinal),0)+1 n FROM combat_undo WHERE campaign_id=? AND combat_id=?').get(cam, state.id).n;
        db.prepare('INSERT INTO combat_undo VALUES(?,?,?,?,?)').run(cam, state.id, ordinal, before, hash(before));
        db.prepare('DELETE FROM combat_undo WHERE campaign_id=? AND combat_id=? AND ordinal<=?').run(cam, state.id, ordinal - 100);
      }
      const oldState=JSON.parse(before) as CombatState;
      if(a.kind==='undo'){
        for(const actor of state.participants)if(actor.characterId&&!oldState.participants.some(p=>p.characterId===actor.characterId))resumeCombatHealth(db,cam,state,actor,command.commandId);
        for(const actor of oldState.participants)if(actor.characterId&&!state.participants.some(p=>p.characterId===actor.characterId))detachCombatHealth(db,cam,oldState,actor,command.commandId);
      }
      publishCombatHealth(db,cam,state,oldState);
      delete state.sharedNotice;
      state.revision++; checkedCombat(state);
      const payload = JSON.stringify(state);
      db.prepare('UPDATE combat SET revision=?,phase=?,payload=?,checksum=? WHERE campaign_id=? AND id=?').run(state.revision, state.phase, payload, hash(payload), cam, state.id);
    }
    if(a.kind==='create')publishCombatHealth(db,cam,state);
    syncOpenMaskHealth(db,cam,state.id);
    const result = readCombat(db, cam, state.sceneId, state.id), payload = JSON.stringify(result);
    db.prepare('INSERT INTO combat_receipt VALUES(?,?,?,?,?)').run(command.commandId, cam, fp, payload, hash(payload));
    if(consumedDraft)db.prepare('DELETE FROM combat_working_draft WHERE campaign_id=? AND combat_id=? AND kind=? AND target_id=?').run(cam,consumedDraft.combatId,consumedDraft.kind,consumedDraft.targetId);
    return result;
  }).immediate();
}
