import { retainSceneOpponents } from './scene-opponents';
import {
  sceneEncounterParty,
  selectedSceneGroup,
  sceneGroupMembers,
  assessSceneGroups,
} from '../runtime/scene-encounter-selection';
import { areaTargetDamage } from '../runtime/area-damage';
import { confirmCombatNpcLosses } from './combat-world-losses';
import { isDamageType, adjustedHitDamage } from '../runtime/damage-adjustment';
import { npcRecord } from './npc-record';
import { npcPosition } from './npc-world';
import { publishCombatHealth, syncOpenMaskHealth } from './mask-health';
import { consumeFinishDraft } from './finish-drafts';
import { readCombatDraft } from './combat-drafts';
import { randomUUID, randomInt, createHash } from 'node:crypto';
import {
  checkedCombat,
  combatOrder,
  combatStartIssue,
  concentrationDc,
  type CombatState,
  type CombatView,
  type CombatCommand,
  type Combatant,
} from '../runtime/combat-contracts';
import { readLiveScene, readLive } from './live-read';
import {
  finishCombatRewards,
  latestCombatStatuses,
  detachCombatHealth,
  resumeCombatHealth,
  lastCombatPartyParticipant,
} from './progression';
import { readProgressCharacter, event } from './progression-records';
import {
  applyHealthDamage,
  applyHealthHealing,
  applyDeathSave,
  checkedHealth,
  xpLevel,
  type DeathSaveResult,
} from '../runtime/progression';
import { assessEncounter } from '../catalog/encounter-contracts';
import { readCreature, readEncounterPlan } from './encounters';
import { acceptGeneration } from './generation';
import { readGeneratorRegistry, readGenerationRun } from './generation-read';
import { readWorldActor, readPreparedGroup, scenePreparedGroupIds } from './session-read';
import { groupView } from './groups';
import { groupCombatBasis } from '../campaign/groups-contracts';
import type { Creature } from '../../features/catalog/creature-catalog';
import {
  creatureActionForRolls,
  creatureActionRolls,
  creatureRollKey,
  parseDiceFormula,
  criticalDamageFormula,
  legendaryActionCost,
} from '../shared/dice-formula';
import { initiativeBasisMatches, initiativeNumber } from '../runtime/combat-initiative';
import { fighterDraftBasisMatches } from '../runtime/combat-draft-contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function addNamedActor(
  db: any,
  cam: string,
  state: CombatState,
  actorId: string,
  locationId: string | null,
  entryId?: string,
  groupId?: string,
  source?: Creature,
) {
  const actor = readWorldActor(db, cam, actorId),
    position = npcPosition(db, cam, actorId);
  if (actor.unavailable || actor.defeated || actor.hp <= 0)
    throw new Error('Benannter NPC ist nicht verfügbar. Weltprofil prüfen.');
  if (position.locationId && position.locationId !== locationId)
    throw new Error(
      'NPC ' + actor.name + ' befindet sich an einem anderen Ort. Platzierung ausdrücklich ändern.',
    );
  if (state.participants.some((p) => p.worldActorId === actor.id))
    throw new Error('NPC steht bereits in dieser Begegnung.');
  const c = source ?? readCreature(actor.creatureId),
    id = randomUUID(),
    role = actor.role ?? 'hostile';
  if (c.id !== actor.creatureId) throw new Error('NPC-Statblock passt nicht zur Gruppe.');
  state.sources ??= [];
  if (!state.sources.some((s) => s.id === c.id)) state.sources.push(c);
  const participant: Combatant = {
    id,
    characterId: null,
    groupId: groupId ?? id,
    name: actor.name,
    initiative: 0,
    initiativeBonus: c.initiative,
    armorClass: c.ac,
    hp: actor.hp,
    maxHp: actor.maxHp,
    tempHp: actor.tempHp,
    conditions: actor.conditions,
    concentrating: actor.concentrating,
    role,
    xp: role === 'hostile' ? c.xp : 0,
    countForMultiplier: role === 'hostile',
    sourceId: c.id,
    sourceEntryId: entryId ?? actor.entryId,
    partitionKind: groupId ? 'mob' : 'individual',
    worldActorId: actor.id,
    worldActorRevision: actor.revision,
  };
  if (state.phase === 'running' && c.legendaryActions.length)
    participant.legendaryActions = { remaining: 3, maximum: 3, lastResetRound: state.round };
  state.participants.push(participant);
}
/** Join a persisted scene group without recreating participants already in this mask. */
function reinforcePreparedGroup(
  db: any,
  cam: string,
  state: CombatState,
  a: Extract<CombatCommand['action'], { kind: 'add-prepared-group' }>,
) {
  const scene = readLiveScene(db, cam, state.sceneId),
    group = groupView(db, cam, a.preparedGroupId);
  if (
    group.revision !== a.expectedPreparedRevision ||
    groupCombatBasis(group) !== a.expectedRosterBasis
  )
    throw new Error('Gruppe oder Figuren seit Vorschau geändert. Gruppe erneut ansehen.');
  if (
    !scenePreparedGroupIds(db, cam, scene.id).includes(group.id) ||
    (group.locationId && group.locationId !== scene.locationId)
  )
    throw new Error('Gruppe gehört nicht zum aktuellen Szenenort oder vorbereiteten Besuch.');
  if (
    !Array.isArray(a.worldActorIds) ||
    !a.worldActorIds.length ||
    a.worldActorIds.length > 200 ||
    new Set(a.worldActorIds).size !== a.worldActorIds.length ||
    a.worldActorIds.some((id) => !group.actors.some((actor) => actor.id === id))
  )
    throw new Error('Wähle eindeutige Figuren dieser Gruppe.');
  if (!Number.isSafeInteger(a.initiative) || Math.abs(a.initiative) > 1000000)
    throw new Error('Initiative benötigt eine gültige ganze Zahl.');
  const selected = group.actors.filter((actor) => a.worldActorIds.includes(actor.id));
  for (const actor of selected)
    if (
      actor.unavailable ||
      actor.defeated ||
      actor.hp <= 0 ||
      actor.role === 'neutral' ||
      (actor.locationId && actor.locationId !== scene.locationId)
    )
      throw new Error(
        'Ausgewählte Figur ist neutral, besiegt, nicht verfügbar oder an einem anderen Ort. Gruppe erneut ansehen.',
      );
  const incoming = selected.filter(
    (actor) => !state.participants.some((p) => p.worldActorId === actor.id),
  );
  if (state.participants.length + incoming.length > 1000)
    throw new Error('Höchstens 1000 Teilnehmer je Begegnung.');
  if (!incoming.length) return;
  if (!state.generatorPreset) {
    const registry = readGeneratorRegistry(db, cam),
      preset = registry.presets.find((p) => p.id === registry.effectiveId)!;
    state.generatorPreset = {
      id: preset.id,
      revision: preset.revision,
      hash: preset.hash,
      mobThreshold: preset.config.combat.mobThreshold,
    };
  }
  for (const entry of group.plan.entries) {
    const actors = incoming.filter((actor) => actor.entryId === entry.id);
    if (!actors.length) continue;
    const source = group.plan.sources.find((c) => c.id === entry.creatureId);
    if (!source) throw new Error('Kreaturquelle der Gruppe fehlt.');
    const existingSource = state.sources?.find((c) => c.id === source.id);
    if (existingSource && JSON.stringify(existingSource) !== JSON.stringify(source))
      throw new Error(
        'Diese Begegnung verwendet einen anderen Quellenstand von ' +
          source.name +
          '. Gruppe in einer eigenen Begegnung vorbereiten.',
      );
    const peers = state.participants.filter(
      (p) =>
        p.sourceEntryId === entry.id && group.actors.some((actor) => actor.id === p.worldActorId),
    );
    // Once prepared, a source entry keeps its partition even when its living count changes.
    const mob = peers.length
      ? peers[0]!.partitionKind === 'mob'
      : state.generatorPreset.mobThreshold > 0 &&
        selected.filter((actor) => actor.entryId === entry.id).length >=
          state.generatorPreset.mobThreshold;
    const shared = mob ? (peers[0]?.groupId ?? randomUUID()) : undefined;
    for (const actor of actors) {
      addNamedActor(db, cam, state, actor.id, scene.locationId, entry.id, shared, source);
      const p = state.participants.at(-1)!;
      p.initiative = mob && peers.length ? peers[0]!.initiative : a.initiative;
      const name = peers.length ? peers[0]!.groupName : entry.groupName?.trim();
      if (name) p.groupName = name;
      if (mob && peers.length) {
        p.initiativeBonus = peers[0]!.initiativeBonus;
        if (peers[0]!.hiddenFromPlayers) p.hiddenFromPlayers = true;
      }
    }
  }
  event(db, cam, null, 'combat-group-entry', {
    combatId: state.id,
    groupId: group.id,
    actorIds: incoming.map((actor) => actor.id),
  });
}
export function installCombatSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS combat(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scene_id TEXT NOT NULL, ordinal INTEGER NOT NULL, revision INTEGER NOT NULL, phase TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    DROP INDEX IF EXISTS combat_active_scene;
    CREATE INDEX IF NOT EXISTS combat_scene_masks ON combat(campaign_id,scene_id,phase,ordinal);
    CREATE TABLE IF NOT EXISTS combat_undo(campaign_id TEXT NOT NULL, combat_id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,combat_id,ordinal), FOREIGN KEY(campaign_id,combat_id) REFERENCES combat(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS combat_receipt(command_id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaign(id), fingerprint TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL) STRICT;`);
}
function decode(row: any): CombatState {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Kampf nicht verfügbar oder beschädigt.');
  const state = checkedCombat(JSON.parse(row.payload));
  if (
    state.id !== row.id ||
    state.sceneId !== row.scene_id ||
    state.revision !== row.revision ||
    state.phase !== row.phase
  )
    throw new Error('Kampfzuordnung widersprüchlich.');
  return state;
}
function decodeUndo(row: any, owner: Pick<CombatState, 'id' | 'sceneId'>): CombatState {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Kein rückgängiger Schritt verfügbar.');
  const state = checkedCombat(JSON.parse(row.payload));
  if (state.id !== owner.id || state.sceneId !== owner.sceneId)
    throw new Error('Rückgängiger Schritt gehört nicht zum Kampf.');
  return state;
}
export function validateCombatBackup(db: any) {
  for (const row of db.prepare('SELECT * FROM combat').iterate()) decode(row);
  for (const row of db.prepare('SELECT * FROM combat_undo').iterate()) {
    const owner = db
      .prepare('SELECT id,scene_id AS sceneId FROM combat WHERE campaign_id=? AND id=?')
      .get(row.campaign_id, row.combat_id);
    if (!owner) throw new Error('Kampfhistory besitzt keinen Kampf.');
    decodeUndo(row, owner);
  }
  for (const row of db.prepare('SELECT * FROM combat_receipt').iterate()) {
    if (hash(row.payload) !== row.checksum) throw new Error('Kampfreceipt ist beschädigt.');
    const view = JSON.parse(row.payload) as CombatView;
    if (!view || !view.combat || !Array.isArray(view.recent) || typeof view.canUndo !== 'boolean')
      throw new Error('Kampfreceipt hat ein ungültiges Format.');
    const state = checkedCombat(view.combat);
    if (
      !db
        .prepare('SELECT 1 FROM combat WHERE campaign_id=? AND id=? AND scene_id=?')
        .get(row.campaign_id, state.id, state.sceneId)
    )
      throw new Error('Kampfreceipt besitzt keinen passenden Kampf.');
  }
}
function combatParty(db: any, cam: string, state: CombatState) {
  return state.participants
    .filter((p) => p.characterId)
    .map((p) => {
      const progress = readProgressCharacter(db, cam, p.characterId!);
      return {
        id: p.characterId!,
        name: p.name,
        level: progress.xp === null ? null : xpLevel(progress.xp).level,
        count: 1,
      };
    });
}
function assessment(db: any, cam: string, state: CombatState) {
  return assessEncounter(
    state.partyBasis ?? combatParty(db, cam, state),
    state.participants
      .filter((p) => !p.characterId)
      .map((p) => ({ xp: p.xp, count: 1, countForMultiplier: p.countForMultiplier })),
  );
}
function startCombat(db: any, cam: string, state: CombatState) {
  if (state.phase !== 'preparing')
    throw new Error('Nur eine vorbereitete Begegnung kann begonnen werden.');
  const issue = combatStartIssue(state);
  if (issue) throw new Error(issue);
  if (state.participants.some((p) => p.concentrationChecks?.length))
    throw new Error('Offene Konzentrationsprüfung zuerst klären.');
  state.partyBasis = combatParty(db, cam, state);
  state.assessment = assessment(db, cam, state);
  state.phase = 'running';
  state.round = 1;
  state.turnId = combatOrder(state)[0]!.id;
  for (const actor of state.participants) resetLegendary(state, actor);
  tickEffects(state.participants.find((actor) => actor.id === state.turnId)!, 'start');
}
function label(index: number) {
  let result = '';
  do {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);
  return result;
}
function legendarySource(state: CombatState, p: Combatant) {
  return state.sources?.find(
    (source) => source.id === p.sourceId && source.legendaryActions.length,
  );
}
function resetLegendary(state: CombatState, p: Combatant) {
  if (legendarySource(state, p))
    p.legendaryActions = { remaining: 3, maximum: 3, lastResetRound: state.round };
}
function tickEffects(p: Combatant, tick: 'start' | 'end') {
  if (!p.timedEffects) return;
  for (const effect of p.timedEffects) if (effect.tick === tick) effect.remaining--;
  p.timedEffects = p.timedEffects.filter((effect) => effect.remaining > 0);
  if (!p.timedEffects.length) delete p.timedEffects;
}
function addCreature(
  state: CombatState,
  creature: Creature,
  count: number,
  grouped: boolean,
  groupId?: string,
  entryId?: string,
  initiative?: number,
) {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 1000 ||
    state.participants.length + count > 1000
  )
    throw new Error('Bitte eine gültige Teilnehmermenge angeben.');
  const peer = groupId
    ? state.participants.find((p) => p.groupId === groupId && p.sourceId === creature.id)
    : undefined;
  if (groupId && !peer)
    throw new Error('Verstärkung benötigt eine vorhandene Gruppe dieser Kreatur.');
  if (
    initiative !== undefined &&
    (!Number.isSafeInteger(initiative) || Math.abs(initiative) > 1000000)
  )
    throw new Error('Initiative benötigt eine gültige ganze Zahl.');
  if (peer && initiative !== undefined && initiative !== peer.initiative)
    throw new Error('Vorhandene Initiativegruppe behält ihren Wert.');
  const shared = peer?.groupId ?? randomUUID(),
    sourceEntryId = peer?.sourceEntryId ?? entryId ?? randomUUID(),
    partitionKind = peer?.partitionKind ?? (grouped ? 'mob' : 'individual');
  state.sources ??= [];
  if (!state.sources.some((c) => c.id === creature.id)) state.sources.push(creature);
  state.sourceSerials ??= {};
  let serial =
    state.sourceSerials[creature.id] ??
    Math.max(
      -1,
      ...state.participants
        .filter((p) => p.sourceId === creature.id)
        .map((p) => p.sourceOrdinal ?? -1),
    ) + 1;
  for (let i = 0; i < count; i++) {
    const id = randomUUID(),
      actor: Combatant = {
        id,
        groupId: grouped || peer ? shared : id,
        characterId: null,
        name: creature.name + ' ' + label(serial),
        initiative: peer?.initiative ?? initiative ?? 0,
        initiativeBonus: peer?.initiativeBonus ?? creature.initiative,
        armorClass: creature.ac,
        hp: creature.hp,
        maxHp: creature.hp,
        tempHp: 0,
        conditions: '',
        concentrating: false,
        xp: creature.xp,
        countForMultiplier: true,
        sourceId: creature.id,
        sourceOrdinal: serial++,
        sourceEntryId,
        partitionKind,
        ...(peer?.groupName ? { groupName: peer.groupName } : {}),
        ...(peer?.hiddenFromPlayers ? { hiddenFromPlayers: true } : {}),
      };
    if (state.phase === 'running' && creature.legendaryActions.length)
      actor.legendaryActions = { remaining: 3, maximum: 3, lastResetRound: state.round };
    state.participants.push(actor);
  }
  state.sourceSerials[creature.id] = serial;
}
function partyCombatant(
  character: ReturnType<typeof readLive>['roster'][number],
  progress: ReturnType<typeof readProgressCharacter>,
  status?: Pick<Combatant, 'tempHp' | 'conditions' | 'concentrating'>,
): Combatant {
  const id = randomUUID();
  return {
    id,
    groupId: id,
    characterId: character.id,
    name: character.profile.name,
    initiative: 0,
    initiativeBonus: 0,
    armorClass: character.profile.armorClass ?? null,
    maxHp: 1,
    hp: 0,
    tempHp: 0,
    conditions: '',
    concentrating: false,
    healthKnown: progress.health !== null,
    ...(progress.health ?? progress.combatStatus ?? status),
  };
}
function priorPartyParticipant(db: any, cam: string, state: CombatState, characterId: string) {
  const fact = lastCombatPartyParticipant(db, cam, state, characterId);
  if (fact) return fact;
  for (const row of db
    .prepare('SELECT * FROM combat_undo WHERE campaign_id=? AND combat_id=? ORDER BY ordinal DESC')
    .iterate(cam, state.id)) {
    const actor = decodeUndo(row, state).participants.find((p) => p.characterId === characterId);
    if (actor) return actor;
  }
  return undefined;
}
export function readCombat(db: any, campaignId: string, sceneId: string, id?: string): CombatView {
  return db.transaction(() => {
    readLiveScene(db, campaignId, sceneId);
    const recentRows = db
      .prepare(
        "SELECT * FROM combat WHERE campaign_id=? AND scene_id=? ORDER BY phase IN('preparing','running') DESC,ordinal DESC LIMIT 100",
      )
      .all(campaignId, sceneId);
    const row = id
      ? (recentRows.find((r: any) => r.id === id) ??
        db
          .prepare('SELECT * FROM combat WHERE campaign_id=? AND scene_id=? AND id=?')
          .get(campaignId, sceneId, id))
      : recentRows[0];
    if (id && !row) throw new Error('Kampf nicht gefunden.');
    const combat = row ? decode(row) : null;
    const partyCandidates =
      combat && ['preparing', 'running'].includes(combat.phase)
        ? readLive(db, campaignId)
            .roster.filter(
              (c) =>
                c.active &&
                c.sceneId === sceneId &&
                !combat.participants.some((p) => p.characterId === c.id),
            )
            .map((c) => {
              const p = readProgressCharacter(db, campaignId, c.id);
              return {
                characterId: c.id,
                name: c.profile.name,
                membershipRevision: c.membershipRevision,
                progressRevision: p.revision,
                health: p.health,
              };
            })
        : [];
    return {
      combat,
      partyCandidates,
      assessment: combat ? assessment(db, campaignId, combat) : undefined,
      canUndo:
        !!row &&
        ['preparing', 'running'].includes(row.phase) &&
        !!db
          .prepare('SELECT 1 FROM combat_undo WHERE campaign_id=? AND combat_id=? LIMIT 1')
          .get(campaignId, row.id),
      recent: recentRows.map((r: any) => {
        const c = r === row ? combat! : decode(r);
        return { id: c.id, title: c.title, phase: c.phase, sequence: r.ordinal };
      }),
    };
  })();
}
function applyCombatDamage(p: Combatant, amount: number, critical = false) {
  const wasConcentrating = p.concentrating;
  const beforeHp = p.hp,
    next = applyHealthDamage(
      {
        hp: p.hp,
        maxHp: p.maxHp,
        tempHp: p.tempHp,
        conditions: p.conditions,
        concentrating: p.concentrating,
        ...(p.death ? { death: p.death } : {}),
      },
      amount,
      !!p.characterId,
      critical,
    );
  Object.assign(p, next.health);
  if (!next.health.death) delete p.death;
  if (beforeHp > 0 && p.hp === 0) delete p.deathLast;
  if (next.deathResult) p.deathLast = { result: next.deathResult, roll: null };
  if (wasConcentrating) {
    if (p.hp === 0) {
      p.concentrating = false;
      delete p.concentrationChecks;
    } else {
      p.concentrationChecks ??= [];
      if (p.concentrationChecks.length >= 100)
        throw new Error('Zu viele offene Konzentrationsprüfungen.');
      p.concentrationChecks.push({ damage: amount, dc: concentrationDc(amount) });
    }
  }
}
function spendLegendaryAction(
  state: CombatState,
  participantId: string,
  actionId: string,
  cost: number,
) {
  const p = state.participants.find((p) => p.id === participantId),
    source = p && legendarySource(state, p),
    action = source?.legendaryActions.find((action) => action.id === actionId),
    expected = action ? legendaryActionCost(action) : 0;
  if (!p || state.phase !== 'running' || !action)
    throw new Error('Legendäre Aktion gehört nicht zu dieser laufenden Kreatur.');
  if (state.turnId === p.id)
    throw new Error('Legendäre Aktionen sind nicht im eigenen Zug verfügbar.');
  if (cost !== expected)
    throw new Error('Kosten der legendären Aktion stimmen nicht mit dem Statblock überein.');
  const points = p.legendaryActions;
  if (!points || points.remaining < expected)
    throw new Error('Nicht genügend legendäre Aktionspunkte verfügbar.');
  if (points.lastUsedRound === state.round && points.lastUsedTurnId === state.turnId)
    throw new Error('Diese Kreatur hat in diesem Zug bereits eine legendäre Aktion eingesetzt.');
  points.remaining -= expected;
  points.lastUsedRound = state.round;
  points.lastUsedTurnId = state.turnId!;
  points.lastUsedActionId = action.id;
  points.hitResolved = false;
}
export function executeCombat(db: any, command: CombatCommand, guard: () => void): CombatView {
  return db
    .transaction(() => {
      guard();
      if (!command.commandId || command.commandId.length > 1000 || !command.action)
        throw new Error('Kampfauftrag fehlt.');
      const fp = hash(JSON.stringify({ ...command, token: undefined }));
      const prior = db
        .prepare('SELECT * FROM combat_receipt WHERE command_id=?')
        .get(command.commandId);
      if (prior) {
        if (
          prior.campaign_id !== command.campaignId ||
          prior.fingerprint !== fp ||
          hash(prior.payload) !== prior.checksum
        )
          throw new Error('Auftragskennung bereits anders verwendet.');
        return JSON.parse(prior.payload);
      }
      const a = command.action,
        cam = command.campaignId;
      let consumedDraft: import('../runtime/combat-draft-contracts').CombatWorkingDraft | null =
        null;
      if (command.draftWriteId !== undefined) {
        if (
          typeof command.draftWriteId !== 'string' ||
          !command.draftWriteId ||
          !command.combatId ||
          (a.kind !== 'edit' && a.kind !== 'notes' && a.kind !== 'initiative')
        )
          throw new Error('Ungültige Entwurfsübernahme.');
        consumedDraft = readCombatDraft(
          db,
          cam,
          command.combatId,
          a.kind === 'edit' ? 'fighter' : a.kind === 'initiative' ? 'initiative' : 'notes',
          a.kind === 'edit' ? a.participantId : command.combatId,
        );
        if (!consumedDraft || consumedDraft.writeId !== command.draftWriteId)
          throw new Error('Kampfeingabe inzwischen geändert.');
        const current = decode(
            db
              .prepare('SELECT * FROM combat WHERE campaign_id=? AND id=?')
              .get(cam, command.combatId),
          ),
          basis =
            consumedDraft.kind === 'initiative'
              ? null
              : consumedDraft.kind === 'fighter'
                ? current.participants.find((p) => p.id === consumedDraft!.targetId)
                : { title: current.title, notes: current.notes };
        const matches =
          consumedDraft.kind === 'initiative'
            ? initiativeBasisMatches(consumedDraft.basis, current)
            : consumedDraft.kind === 'fighter' && basis
              ? fighterDraftBasisMatches(consumedDraft.basis, basis as Combatant)
              : JSON.stringify(basis) === JSON.stringify(consumedDraft.basis);
        if (!matches)
          throw new Error('Gespeicherte Werte des Entwurfs wurden geändert. Zuerst abgleichen.');
        if (consumedDraft.kind === 'initiative' && a.kind === 'initiative') {
          const submitted = [...a.values].sort((x, y) =>
              x.participantId.localeCompare(y.participantId),
            ),
            saved = consumedDraft.values
              .map((v) => ({ participantId: v.participantId, initiative: initiativeNumber(v.raw) }))
              .sort((x, y) => x.participantId.localeCompare(y.participantId));
          if (JSON.stringify(submitted) !== JSON.stringify(saved))
            throw new Error('Initiativeeingabe stimmt nicht mit dem gesicherten Entwurf überein.');
        }
      }
      let state: CombatState;
      if (a.kind === 'create') {
        if (
          a.catalogCreature !== undefined &&
          (a.planId !== undefined ||
            a.preparedGroupId !== undefined ||
            a.generation !== undefined ||
            a.sceneSelection !== undefined ||
            a.worldActorIds !== undefined)
        )
          throw new Error('Katalogauswahl benötigt eine eindeutige Kampfquelle.');
        const scene = readLiveScene(db, cam, a.sceneId);
        if (scene.retired || scene.membershipRevision !== a.expectedMembershipRevision)
          throw new Error('Gruppe geändert. Bitte aktualisieren.');
        const party = a.includeParty
          ? readLive(db, cam).roster.filter((c) => c.active && c.sceneId === scene.id)
          : [];
        // Conditions and temporary HP remain usable when players keep their own HP.
        // Read only validated history and stop once every unknown-health PC is found.
        const progress = new Map(party.map((c) => [c.id, readProgressCharacter(db, cam, c.id)]));
        const statuses = latestCombatStatuses(
          db,
          cam,
          party
            .filter((c) => progress.get(c.id)!.health === null && !progress.get(c.id)!.combatStatus)
            .map((c) => c.id),
        );
        state = {
          id: randomUUID(),
          sceneId: scene.id,
          revision: 1,
          title: a.title || 'Neue Begegnung',
          phase: 'preparing',
          round: 0,
          turnId: null,
          notes: '',
          outcome: '',
          participants: party.map((c) =>
            partyCombatant(c, progress.get(c.id)!, statuses.get(c.id)),
          ),
        };
        let generated: import('../catalog/encounter-contracts').EncounterPlan | null = null;
        if (a.generation) {
          const live = readLive(db, cam),
            g = a.generation;
          if (
            a.planId ||
            a.preparedGroupId ||
            !a.includeParty ||
            live.focusId !== scene.id ||
            live.focusRevision !== g.expectedFocusRevision ||
            scene.locationId !== g.locationId
          )
            throw new Error('Fokussierte Gruppe oder Ort geändert. Begegnung erneut ansehen.');
          const run = readGenerationRun(db, cam, g.runId);
          if (run.request.locationId && run.request.locationId !== scene.locationId)
            throw new Error('Ortsquellen gehören zu einem anderen Ort. Neu erzeugen.');
          const actual = party
            .map((c) => ({
              id: c.id,
              name: c.profile.name,
              level:
                progress.get(c.id)!.xp === null ? null : xpLevel(progress.get(c.id)!.xp!).level,
              count: 1,
            }))
            .sort((x, y) => x.id.localeCompare(y.id));
          if (
            JSON.stringify(actual) !==
            JSON.stringify([...run.request.party].sort((x, y) => x.id.localeCompare(y.id)))
          )
            throw new Error(
              'Aktuelle Gruppe oder Level passen nicht mehr zur Vorschau. Neu erzeugen.',
            );
          generated = acceptGeneration(
            db,
            {
              commandId: command.commandId + '|generation',
              campaignId: cam,
              token: command.token,
              runId: g.runId,
              index: g.index,
              expectedRegistryRevision: g.expectedRegistryRevision,
            },
            guard,
          );
          if (generated.revision !== 1)
            throw new Error(
              'Die übernommene Vorlage wurde bearbeitet. Neue Vorschau erzeugen oder die aktuelle Vorlage öffnen.',
            );
        }
        if (a.planId || generated) {
          const plan = generated ?? readEncounterPlan(db, cam, a.planId!);
          if (!generated && plan.revision !== a.expectedPlanRevision)
            throw new Error('Encounter-Vorlage geändert. Bitte erneut öffnen.');
          if (plan.generationOrigin) {
            const registry = readGeneratorRegistry(db, cam),
              preset = registry.presets.find((p) => p.id === registry.effectiveId)!;
            state.generatorPreset = {
              id: preset.id,
              revision: preset.revision,
              hash: preset.hash,
              mobThreshold: preset.config.combat.mobThreshold,
            };
          }
          for (const entry of plan.entries) {
            const creature = plan.sources.find((c) => c.id === entry.creatureId);
            if (!creature) throw new Error('Vorlage hat eine fehlende Kreaturquelle.');
            const grouped = state.generatorPreset
              ? state.generatorPreset.mobThreshold > 0 &&
                entry.count >= state.generatorPreset.mobThreshold
              : entry.grouped;
            if (entry.worldActorIds?.length) {
              const shared = grouped ? randomUUID() : undefined;
              for (const id of entry.worldActorIds) {
                if (readWorldActor(db, cam, id).creatureId !== entry.creatureId)
                  throw new Error('NPC-Statblock passt nicht zur Vorlage.');
                addNamedActor(db, cam, state, id, scene.locationId, entry.id, shared);
              }
              if (entry.count > entry.worldActorIds.length)
                addCreature(
                  state,
                  creature,
                  entry.count - entry.worldActorIds.length,
                  grouped,
                  shared,
                  entry.id,
                );
            } else addCreature(state, creature, entry.count, grouped, undefined, entry.id);
            if (entry.groupName?.trim())
              for (const actor of state.participants.filter((p) => p.sourceEntryId === entry.id))
                actor.groupName = entry.groupName.trim();
          }
          state.notes = plan.notes;
          state.title = a.title || plan.name;
          state.planOrigin = { id: plan.id, revision: plan.revision, name: plan.name };
        }
        if (a.preparedGroupId) {
          const group = readPreparedGroup(db, cam, a.preparedGroupId),
            selectedActors = a.worldActorIds
              ? group.actors.filter((actor) => a.worldActorIds!.includes(actor.id))
              : group.actors;
          if (
            a.worldActorIds &&
            (!a.worldActorIds.length ||
              new Set(a.worldActorIds).size !== a.worldActorIds.length ||
              a.worldActorIds.some((id) => !group.actors.some((actor) => actor.id === id)))
          )
            throw new Error('Ausgewählte NPCs gehören nicht zur vorbereiteten Gruppe.');
          if (
            group.revision !== a.expectedPreparedRevision ||
            (group.locationId && group.locationId !== scene.locationId) ||
            !selectedActors.length ||
            selectedActors.some((actor) => actor.hp > 0 && (actor.unavailable || actor.defeated)) ||
            !selectedActors.some((actor) => actor.hp > 0)
          )
            throw new Error(
              'Vorbereitete Gruppe geändert, nicht am aktuellen Ort oder ein NPC nicht verfügbar.',
            );
          const registry = readGeneratorRegistry(db, cam),
            preset = registry.presets.find((p) => p.id === registry.effectiveId)!;
          state.generatorPreset = {
            id: preset.id,
            revision: preset.revision,
            hash: preset.hash,
            mobThreshold: preset.config.combat.mobThreshold,
          };
          state.sources = group.plan.sources;
          state.title = a.title || group.title;
          state.notes = group.notes;
          state.planOrigin = { id: group.id, revision: group.revision, name: group.title };
          for (const entry of group.plan.entries) {
            const actors = selectedActors.filter(
                (actor) => actor.entryId === entry.id && actor.hp > 0 && !actor.defeated,
              ),
              mob =
                preset.config.combat.mobThreshold > 0 &&
                actors.filter((actor) => actor.hp > 0).length >= preset.config.combat.mobThreshold,
              shared = randomUUID();
            for (const actor of actors) {
              addNamedActor(
                db,
                cam,
                state,
                actor.id,
                scene.locationId,
                entry.id,
                mob ? shared : undefined,
                group.plan.sources.find((c) => c.id === entry.creatureId),
              );
              if (entry.groupName?.trim())
                state.participants.at(-1)!.groupName = entry.groupName.trim();
            }
          }
        }
        if (a.sceneSelection) {
          const basis = a.sceneSelection,
            live = readLive(db, cam);
          if (
            a.planId ||
            generated ||
            a.preparedGroupId ||
            !a.includeParty ||
            live.focusId !== scene.id ||
            live.focusRevision !== basis.expectedFocusRevision ||
            live.rosterRevision !== basis.expectedRosterRevision
          )
            throw new Error('Fokussierte Szene oder Party geändert. Auswahl neu lesen.');
          if (
            !Array.isArray(basis.groups) ||
            !basis.groups.length ||
            basis.groups.length > 1000 ||
            new Set(basis.groups.map((g) => g.id)).size !== basis.groups.length
          )
            throw new Error('Eindeutige Szenengruppen auswählen.');
          const currentParty = sceneEncounterParty(live, [...progress.values()], scene.id);
          if (currentParty.basis !== basis.partyBasis)
            throw new Error('Party oder XP seit Bewertung geändert. Auswahl neu lesen.');
          const available = new Set(scenePreparedGroupIds(db, cam, scene.id));
          const groups = basis.groups.map((b) => {
            if (!available.has(b.id))
              throw new Error('Gruppe gehört nicht zum fokussierten Szenenort oder Besuch.');
            const g = groupView(db, cam, b.id);
            if (g.revision !== b.revision || groupCombatBasis(g) !== b.basis)
              throw new Error('Szenengruppe seit Bewertung geändert. Auswahl neu lesen.');
            return g;
          });
          const chosen = groups.map((g, i) =>
            selectedSceneGroup(g, basis.groups[i]!.worldActorIds),
          );
          const evaluation = assessSceneGroups(currentParty.party, chosen, scene.locationId);
          if (evaluation.issue) throw new Error(evaluation.issue);
          state.sceneGroups = groups.map((g) => ({
            id: g.id,
            revision: g.revision,
            name: g.title,
          }));
          state.title =
            a.title ||
            groups
              .map((g) => g.title)
              .join(' + ')
              .slice(0, 1000);
          state.notes = groups.map((g) => g.title + '\n' + g.notes).join('\n\n');
          for (const [i, group] of groups.entries())
            reinforcePreparedGroup(db, cam, state, {
              kind: 'add-prepared-group',
              preparedGroupId: group.id,
              expectedPreparedRevision: group.revision,
              expectedRosterBasis: groupCombatBasis(group),
              worldActorIds: sceneGroupMembers(chosen[i]!).map((a) => a.id),
              initiative: 0,
            });
        }
        if (a.catalogCreature !== undefined) {
          const first = a.catalogCreature;
          if (
            !first ||
            typeof first.creatureId !== 'string' ||
            !first.creatureId ||
            typeof first.grouped !== 'boolean'
          )
            throw new Error('Ungültige Katalogauswahl.');
          const source = readCreature(first.creatureId),
            before = state.participants.length;
          addCreature(state, source, first.count, first.grouped);
          retainSceneOpponents(db, cam, state, source, state.participants.slice(before));
        }
        checkedCombat(state);
        const ordinal = db
          .prepare('SELECT coalesce(max(ordinal),0)+1 n FROM combat WHERE campaign_id=?')
          .get(cam).n;
        const payload = JSON.stringify(state);
        db.prepare('INSERT INTO combat VALUES(?,?,?,?,?,?,?,?)').run(
          cam,
          state.id,
          state.sceneId,
          ordinal,
          state.revision,
          state.phase,
          payload,
          hash(payload),
        );
      } else {
        state = decode(
          db
            .prepare('SELECT * FROM combat WHERE campaign_id=? AND id=?')
            .get(cam, command.combatId),
        );
        if (state.revision !== command.expectedRevision)
          throw new Error('Kampf wurde geändert. Bitte aktualisieren.');
        if (a.kind === 'confirm-npc-losses') {
          if (readLiveScene(db, cam, state.sceneId).retired)
            throw new Error('Diese Gruppe ist nicht mehr aktiv.');
          confirmCombatNpcLosses(db, cam, state, a.losses);
          state.revision++;
          checkedCombat(state);
          const payload = JSON.stringify(state);
          db.prepare(
            'UPDATE combat SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
          ).run(state.revision, payload, hash(payload), cam, state.id);
          const result = readCombat(db, cam, state.sceneId, state.id),
            receipt = JSON.stringify(result);
          db.prepare('INSERT INTO combat_receipt VALUES(?,?,?,?,?)').run(
            command.commandId,
            cam,
            fp,
            receipt,
            hash(receipt),
          );
          return result;
        }
        if (!['preparing', 'running'].includes(state.phase))
          throw new Error(
            state.phase === 'finished'
              ? 'Der abgeschlossene Kampf bleibt als Ergebnis erhalten. Beginne eine neue Begegnung.'
              : 'Der Kampf gehört zu einer archivierten Scene.',
          );
        if (readLiveScene(db, cam, state.sceneId).retired)
          throw new Error('Diese Gruppe ist nicht mehr aktiv.');
        const before = JSON.stringify(state);
        const participant = (): Combatant => {
          const id = 'participantId' in a ? a.participantId : null;
          const p = state.participants.find((p) => p.id === id);
          if (!p) throw new Error('Teilnehmer nicht gefunden.');
          return p;
        };
        if (a.kind === 'undo') {
          const entry = db
            .prepare(
              'SELECT * FROM combat_undo WHERE campaign_id=? AND combat_id=? ORDER BY ordinal DESC LIMIT 1',
            )
            .get(cam, state.id);
          const restored = decodeUndo(entry, state);
          state = { ...restored, revision: state.revision };
          db.prepare(
            'DELETE FROM combat_undo WHERE campaign_id=? AND combat_id=? AND ordinal=?',
          ).run(cam, state.id, entry.ordinal);
        } else {
          if (a.kind === 'add-party') {
            const character = readLive(db, cam).roster.find((c) => c.id === a.characterId);
            if (!character?.active || character.sceneId !== state.sceneId)
              throw new Error('Wähle eine aktive Party-Figur dieser Gruppe.');
            if (character.membershipRevision !== a.expectedMembershipRevision)
              throw new Error('Party-Zuordnung geändert. Auswahl aktualisieren.');
            if (state.participants.some((p) => p.characterId === character.id))
              throw new Error('Figur steht bereits in dieser Initiative.');
            const progress = readProgressCharacter(db, cam, character.id);
            if (progress.revision !== a.expectedProgressRevision)
              throw new Error('Figurenstand geändert. Auswahl aktualisieren.');
            const status =
                progress.health === null && !progress.combatStatus
                  ? latestCombatStatuses(db, cam, [character.id]).get(character.id)
                  : undefined,
              actor = partyCombatant(character, progress, status),
              prior = priorPartyParticipant(db, cam, state, character.id);
            if (prior) {
              actor.id = prior.id;
              actor.groupId = prior.groupId;
              actor.initiative =
                state.participants.find((p) => p.groupId === prior.groupId)?.initiative ??
                prior.initiative;
              actor.initiativeBonus = prior.initiativeBonus;
              actor.armorClass = prior.armorClass;
            }
            if (a.initiative !== undefined) {
              if (!Number.isSafeInteger(a.initiative) || Math.abs(a.initiative) > 1000000)
                throw new Error('Initiative benötigt eine gültige ganze Zahl.');
              if (
                state.participants.some(
                  (p) => p.groupId === actor.groupId && p.initiative !== a.initiative,
                )
              )
                actor.groupId = randomUUID();
              actor.initiative = a.initiative;
            }
            state.participants.push(actor);
            if (state.partyBasis && !state.partyBasis.some((p) => p.id === character.id))
              state.partyBasis.push({
                id: character.id,
                name: character.profile.name,
                level: progress.xp === null ? null : xpLevel(progress.xp).level,
                count: 1,
              });
            event(db, cam, character.id, 'combat-entry', {
              commandId: command.commandId,
              combatId: state.id,
              title: state.title,
              participant: actor,
              returning: !!prior,
            });
          } else if (a.kind === 'add-prepared-group') {
            reinforcePreparedGroup(db, cam, state, a);
          } else if (a.kind === 'add-world-actor') {
            const actor = readWorldActor(db, cam, a.actorId),
              record = npcRecord(db, cam, a.actorId),
              position = npcPosition(db, cam, a.actorId),
              scene = readLiveScene(db, cam, state.sceneId);
            if (
              actor.revision !== a.expectedActorRevision ||
              record.revision !== a.expectedRecordRevision ||
              actor.unavailable ||
              actor.defeated ||
              actor.hp <= 0
            )
              throw new Error('NPC geändert, besiegt oder ohne kampffähige HP. Weltprofil prüfen.');
            if (position.locationId && position.locationId !== scene.locationId)
              throw new Error(
                'NPC befindet sich an einem anderen Ort. Platzierung ausdrücklich ändern.',
              );
            if (state.participants.some((p) => p.worldActorId === actor.id))
              throw new Error('NPC steht bereits in dieser Begegnung.');
            addNamedActor(db, cam, state, actor.id, scene.locationId);
          } else if (a.kind === 'add-creature') {
            const source = readCreature(a.creatureId),
              before = state.participants.length;
            addCreature(state, source, a.count, a.grouped, a.groupId, undefined, a.initiative);
            retainSceneOpponents(db, cam, state, source, state.participants.slice(before));
          } else if (a.kind === 'add') {
            if (
              !Number.isSafeInteger(a.count) ||
              a.count < 1 ||
              a.count > 100 ||
              state.participants.length + a.count > 1000
            )
              throw new Error('Bitte 1–100 Teilnehmer hinzufügen.');
            const shared = randomUUID();
            for (let i = 0; i < a.count; i++) {
              const id = randomUUID();
              state.participants.push({
                id,
                characterId: null,
                groupId: a.grouped ? shared : id,
                name: a.count > 1 ? a.name + ' ' + (i + 1) : a.name,
                initiative: 0,
                initiativeBonus: a.initiativeBonus,
                armorClass: a.armorClass,
                hp: a.maxHp,
                maxHp: a.maxHp,
                tempHp: 0,
                conditions: '',
                concentrating: false,
              });
            }
          } else if (a.kind === 'initiative') {
            if (
              !Array.isArray(a.values) ||
              !a.values.length ||
              a.values.length > 1000 ||
              (a.start !== undefined && typeof a.start !== 'boolean')
            )
              throw new Error('Initiative benötigt gültige Teilnehmerwerte.');
            const groups = new Set<string>();
            for (const value of a.values) {
              const p = state.participants.find((p) => p.id === value.participantId);
              if (
                !p ||
                groups.has(p.groupId) ||
                !Number.isSafeInteger(value.initiative) ||
                Math.abs(value.initiative) > 1000000
              )
                throw new Error(
                  'Initiativegruppe fehlt, ist doppelt oder besitzt einen ungültigen Wert.',
                );
              groups.add(p.groupId);
              for (const peer of state.participants.filter((peer) => peer.groupId === p.groupId))
                peer.initiative = value.initiative;
            }
            if (a.start) startCombat(db, cam, state);
          } else if (a.kind === 'edit') {
            const p = participant();
            const beforeHp = p.hp;
            const fields = [
              'name',
              'groupName',
              'initiative',
              'initiativeBonus',
              'armorClass',
              'hp',
              'maxHp',
              'tempHp',
              'conditions',
              'concentrating',
              'xp',
              'countForMultiplier',
            ];
            if (!a.changes || Object.keys(a.changes).some((k) => !fields.includes(k)))
              throw new Error('Unbekanntes Kampffeld.');
            if (
              'groupName' in a.changes &&
              (typeof a.changes.groupName !== 'string' || a.changes.groupName.length > 120)
            )
              throw new Error('Truppname benötigt höchstens 120 Zeichen.');
            if (p.concentrationChecks?.length && a.changes.concentrating === false)
              throw new Error('Offene Konzentrationsprüfung zuerst klären.');
            if (
              p.healthKnown === false &&
              ('hp' in a.changes || 'maxHp' in a.changes) &&
              !('hp' in a.changes && 'maxHp' in a.changes)
            )
              throw new Error('Aktuelle und maximale HP gemeinsam eintragen.');
            if (p.death?.dead && a.changes.hp !== undefined && a.changes.hp > 0)
              throw new Error(
                'Figur ist tot. Zum Wiederbeleben „Ins Leben zurückholen“ verwenden.',
              );
            Object.assign(p, a.changes);
            if ('hp' in a.changes && 'maxHp' in a.changes) p.healthKnown = true;
            p.hp = Math.min(p.hp, p.maxHp);
            if (p.hp > 0 || (beforeHp > 0 && p.hp === 0)) {
              delete p.death;
              delete p.deathLast;
            }
            if (!p.concentrating) delete p.concentrationChecks;
            if ('groupName' in a.changes)
              for (const peer of state.participants.filter((peer) => peer.groupId === p.groupId)) {
                if (a.changes.groupName!.trim()) peer.groupName = a.changes.groupName!.trim();
                else delete peer.groupName;
              }
            if ('initiative' in a.changes)
              for (const peer of state.participants.filter((peer) => peer.groupId === p.groupId))
                peer.initiative = p.initiative;
          } else if (a.kind === 'hit') {
            const p = participant(),
              attacker = state.participants.find((actor) => actor.id === a.source?.participantId),
              source = state.sources?.find((c) => c.id === attacker?.sourceId),
              original =
                source &&
                [...source.actions, ...source.legendaryActions].find(
                  (action) => action.id === a.source?.actionId,
                ),
              action = source && original ? creatureActionForRolls(source, original) : null;
            if (
              !attacker ||
              !source ||
              !action ||
              !creatureActionRolls(action).some((roll) => roll.kind === 'attack')
            )
              throw new Error('Treffer benötigt einen Angriff aus dem Statblock des Angreifers.');
            if (
              p.healthKnown === false ||
              typeof a.critical !== 'boolean' ||
              !Array.isArray(a.components) ||
              !a.components.length ||
              a.components.length > 20
            )
              throw new Error(
                'Treffer benötigt bekannte HP, Kritisch-Markierung und Schadensanteile.',
              );
            const readCheck = (id: string) => {
              const row = db
                .prepare(
                  'SELECT scene_id,payload,checksum FROM scene_check WHERE campaign_id=? AND id=?',
                )
                .get(cam, id);
              if (!row || row.scene_id !== state.sceneId || hash(row.payload) !== row.checksum)
                throw new Error('Wurfbeleg gehört nicht zu dieser Scene.');
              const check = JSON.parse(row.payload);
              if (
                check.id !== id ||
                check.sourceCreatureId !== source.id ||
                check.sourceActionId !== action.id ||
                check.actor !== attacker.name ||
                check.rollKind !== 'formula'
              )
                throw new Error('Wurfbeleg gehört nicht zu diesem Angriff.');
              return check;
            };
            if (a.attackCheckId) {
              const check = readCheck(a.attackCheckId);
              if (
                check.formulaKind !== 'attack' ||
                check.formula !==
                  parseDiceFormula(
                    creatureActionRolls(action).find((roll) => roll.kind === 'attack')!.formula,
                  ).formula ||
                check.outcome !== 'success' ||
                check.dc !== p.armorClass ||
                a.critical !== (check.rolls?.[0] === 20) ||
                check.label !==
                  creatureActionRolls(action).find((roll) => roll.kind === 'attack')!.label +
                    ' gegen ' +
                    p.name
              )
                throw new Error('Angriffswurf passt nicht zu Ziel, RK oder Kritisch-Markierung.');
            }
            const legendary = source.legendaryActions.some(
              (candidate) => candidate.id === action.id,
            );
            if (a.paidLegendary !== undefined && typeof a.paidLegendary !== 'boolean')
              throw new Error('Legendäre Kostenübernahme ist ungültig.');
            if (legendary) {
              if (a.paidLegendary) {
                const points = attacker.legendaryActions;
                if (
                  a.legendary ||
                  !a.attackCheckId ||
                  !points ||
                  points.lastUsedActionId !== action.id ||
                  points.lastUsedRound !== state.round ||
                  points.lastUsedTurnId !== state.turnId ||
                  points.hitResolved
                )
                  throw new Error(
                    'Legendärer Angriff wurde nicht in diesem Zug bezahlt oder bereits aufgelöst.',
                  );
              } else {
                if (
                  !a.legendary ||
                  a.legendary.participantId !== attacker.id ||
                  a.legendary.actionId !== action.id
                )
                  throw new Error('Legendärer Treffer benötigt die passenden Aktionskosten.');
                spendLegendaryAction(state, attacker.id, action.id, a.legendary.cost);
              }
            } else if (a.legendary || a.paidLegendary)
              throw new Error('Dieser Angriff ist keine legendäre Aktion.');
            const known = new Map(
                creatureActionRolls(action)
                  .filter((roll) => roll.kind === 'damage')
                  .map((roll) => [creatureRollKey(roll), roll]),
              ),
              keys = new Set<string>(),
              checks = new Set<string>();
            let total = 0;
            for (const part of a.components) {
              const preset = part && known.get(part.key);
              if (
                !preset ||
                keys.has(part.key) ||
                !Number.isSafeInteger(part.amount) ||
                part.amount < 0 ||
                part.amount > 1000000 ||
                !['auto', 'full', 'half', 'double', 'none'].includes(part.scale)
              )
                throw new Error(
                  'Schadensanteile müssen eindeutig aus der Aktion stammen und gültige Beträge enthalten.',
                );
              keys.add(part.key);
              if (part.sourceCheckId) {
                const check = readCheck(part.sourceCheckId);
                if (
                  checks.has(check.id) ||
                  check.formulaKind !== 'damage' ||
                  check.total !== part.amount ||
                  check.formula !==
                    (a.critical ? criticalDamageFormula(preset.formula) : preset.formula) ||
                  check.label !== preset.label + (a.critical ? ' · Kritisch' : '')
                )
                  throw new Error('Schadensbetrag passt nicht zum gespeicherten Anteil.');
                checks.add(check.id);
              }
              const adjusted = adjustedHitDamage(
                preset,
                part.amount,
                part.scale,
                state.sources?.find((source) => source.id === p.sourceId),
              );
              if (adjusted.amount === null) throw new Error(adjusted.note);
              total += adjusted.amount;
            }
            if (!Number.isSafeInteger(total) || total > 1000000)
              throw new Error('Gesamtschaden überschreitet 1.000.000.');
            if (total) applyCombatDamage(p, total, a.critical);
            if (legendary) attacker.legendaryActions!.hitResolved = true;
          } else if (a.kind === 'area-damage') {
            if (a.damageType !== undefined && !isDamageType(a.damageType))
              throw new Error('Unbekannte Schadensart.');
            if (
              !Number.isSafeInteger(a.amount) ||
              a.amount < 1 ||
              a.amount > 1000000 ||
              !Array.isArray(a.targets) ||
              !a.targets.length ||
              a.targets.length > 1000
            )
              throw new Error('Flächenschaden benötigt einen positiven Betrag und Ziele.');
            if (a.source) {
              const actor = state.participants.find((p) => p.id === a.source!.participantId),
                source = state.sources?.find((c) => c.id === actor?.sourceId);
              if (
                !source ||
                ![...source.actions, ...source.legendaryActions].some(
                  (action) => action.id === a.source!.actionId,
                )
              )
                throw new Error('Aktion gehört nicht zu diesem Teilnehmer.');
              if (
                source.legendaryActions.some((action) => action.id === a.source!.actionId) &&
                !a.legendary
              )
                throw new Error('Legendäre Aktion benötigt ihre Aktionskosten.');
              const action = [...source.actions, ...source.legendaryActions].find(
                  (action) => action.id === a.source!.actionId,
                )!,
                types = creatureActionRolls(creatureActionForRolls(source, action))
                  .filter((p) => p.kind === 'damage')
                  .map((p) => p.damageType);
              if (a.damageType && types.length && !types.includes(a.damageType))
                throw new Error('Schadensart gehört nicht zur gespeicherten Aktion.');
            }
            if (a.legendary) {
              if (
                !a.source ||
                a.source.participantId !== a.legendary.participantId ||
                a.source.actionId !== a.legendary.actionId
              )
                throw new Error('Legendäre Schadensquelle stimmt nicht überein.');
              spendLegendaryAction(
                state,
                a.legendary.participantId,
                a.legendary.actionId,
                a.legendary.cost,
              );
            }
            const participants = new Map(state.participants.map((p) => [p.id, p])),
              sources = new Map<string, Creature>();
            state.sources?.forEach((source) => {
              if (!sources.has(source.id)) sources.set(source.id, source);
            });
            const ids = new Set<string>();
            for (const target of a.targets) {
              if (
                !target ||
                ids.has(target.participantId) ||
                !['full', 'half', 'none'].includes(target.scale) ||
                (target.defense !== undefined &&
                  !['auto', 'full', 'half', 'double', 'none'].includes(target.defense)) ||
                (!a.damageType && target.defense !== undefined && target.defense !== 'full')
              )
                throw new Error('Schadensziele müssen eindeutig und gültig sein.');
              ids.add(target.participantId);
              const p = participants.get(target.participantId);
              if (!p || p.healthKnown === false)
                throw new Error('Schadensziel fehlt oder seine HP sind noch offen.');
              const adjusted = areaTargetDamage(
                sources.get(p.sourceId ?? ''),
                a.amount,
                target.scale,
                a.damageType,
                target.defense ?? (a.damageType ? 'auto' : 'full'),
              );
              if (adjusted.amount === null) throw new Error(p.name + ': ' + adjusted.note);
              if (adjusted.amount) applyCombatDamage(p, adjusted.amount);
            }
            if (a.legendary)
              state.participants.find(
                (p) => p.id === a.legendary!.participantId,
              )!.legendaryActions!.hitResolved = true;
          } else if (a.kind === 'damage' || a.kind === 'heal') {
            const p = participant();
            if (p.healthKnown === false)
              throw new Error(
                'HP noch offen. Aktuelle und maximale HP eintragen, bevor Schaden oder Heilung angewendet wird.',
              );
            if (!Number.isSafeInteger(a.amount) || a.amount <= 0 || a.amount > 1000000)
              throw new Error('Betrag benötigt eine positive ganze Zahl.');
            if (a.kind === 'damage') {
              if ((a.sourceCheckId === undefined) !== (a.sourceScale === undefined))
                throw new Error('Schadensbeleg und Anpassung müssen gemeinsam angegeben werden.');
              if (a.sourceCheckId !== undefined) {
                const row = db
                  .prepare(
                    'SELECT scene_id,payload,checksum FROM scene_check WHERE campaign_id=? AND id=?',
                  )
                  .get(cam, a.sourceCheckId);
                if (!row || row.scene_id !== state.sceneId || hash(row.payload) !== row.checksum)
                  throw new Error('Der Schadenswurf gehört nicht zu dieser Begegnung.');
                const source = JSON.parse(row.payload);
                if (
                  source.id !== a.sourceCheckId ||
                  source.sceneId !== state.sceneId ||
                  source.rollKind !== 'formula' ||
                  source.formulaKind !== 'damage' ||
                  !Number.isSafeInteger(source.total) ||
                  source.total <= 0
                )
                  throw new Error('Der gewählte Beleg ist kein anwendbarer Schadenswurf.');
                const expected =
                  a.sourceScale === 'half'
                    ? Math.floor(source.total / 2)
                    : a.sourceScale === 'double'
                      ? source.total * 2
                      : a.sourceScale === 'full'
                        ? source.total
                        : NaN;
                if (a.amount !== expected)
                  throw new Error(
                    'Der Schadensbetrag stimmt nicht mit dem gespeicherten Wurf überein.',
                  );
              }
              applyCombatDamage(p, a.amount);
            } else {
              const health = applyHealthHealing(
                {
                  hp: p.hp,
                  maxHp: p.maxHp,
                  tempHp: p.tempHp,
                  conditions: p.conditions,
                  concentrating: p.concentrating,
                  ...(p.death ? { death: p.death } : {}),
                },
                a.amount,
              );
              Object.assign(p, health);
              if (p.hp > 0) {
                delete p.death;
                delete p.deathLast;
              }
            }
          } else if (a.kind === 'revive') {
            const p = participant();
            if (!p.characterId || p.healthKnown === false || p.hp !== 0 || !p.death?.dead)
              throw new Error('Wiederbelebung benötigt eine tote Party-Figur mit bekannten HP.');
            if (!Number.isSafeInteger(a.hp) || a.hp < 1 || a.hp > p.maxHp)
              throw new Error(
                'HP nach Wiederbelebung müssen zwischen 1 und den maximalen HP liegen.',
              );
            p.hp = a.hp;
            p.concentrating = false;
            delete p.death;
            delete p.deathLast;
            delete p.concentrationChecks;
          } else if (a.kind === 'death' || a.kind === 'death-roll') {
            const p = participant();
            if (!p.characterId)
              throw new Error('Todesrettungswürfe sind nur für Party-Figuren verfügbar.');
            if (p.healthKnown === false)
              throw new Error('Todesrettungswürfe benötigen bekannte HP.');
            const roll = a.kind === 'death-roll' ? randomInt(1, 21) : null,
              result: DeathSaveResult =
                a.kind === 'death'
                  ? a.result
                  : roll === 20
                    ? 'natural-20'
                    : roll === 1
                      ? 'natural-1'
                      : roll! >= 10
                        ? 'success'
                        : 'failure';
            const next = applyDeathSave(
              checkedHealth({
                hp: p.hp,
                maxHp: p.maxHp,
                tempHp: p.tempHp,
                conditions: p.conditions,
                concentrating: p.concentrating,
                ...(p.death ? { death: p.death } : {}),
              }),
              result,
            );
            p.hp = next.hp;
            p.maxHp = next.maxHp;
            p.tempHp = next.tempHp;
            p.conditions = next.conditions;
            p.concentrating = next.concentrating;
            p.death = next.death;
            p.deathLast = { result, roll };
          } else if (a.kind === 'concentration' || a.kind === 'concentration-roll') {
            const p = participant(),
              check = p.concentrationChecks?.[0];
            if (!p.concentrating || !check)
              throw new Error('Keine offene Konzentrationsprüfung für diese Figur.');
            const roll = a.kind === 'concentration-roll' ? randomInt(1, 21) : null,
              modifier = a.kind === 'concentration-roll' ? a.modifier : 0;
            if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 1000)
              throw new Error('Konzentrationsmodifikator benötigt eine ganze Zahl bis 1000.');
            const total = roll === null ? null : roll + modifier,
              success = a.kind === 'concentration' ? a.success : total! >= check.dc;
            p.concentrationLast = { ...check, roll, modifier, total, success };
            p.concentrationChecks = p.concentrationChecks!.slice(1);
            if (!success) {
              p.concentrating = false;
              delete p.concentrationChecks;
            } else if (!p.concentrationChecks.length) delete p.concentrationChecks;
          } else if (a.kind === 'legendary-action') {
            spendLegendaryAction(state, a.participantId, a.actionId, a.cost);
          } else if (a.kind === 'effect-add') {
            const p = participant();
            if (
              typeof a.name !== 'string' ||
              !a.name.trim() ||
              a.name.length > 500 ||
              !Number.isSafeInteger(a.rounds) ||
              a.rounds < 1 ||
              a.rounds > 1000 ||
              !['start', 'end'].includes(a.tick)
            )
              throw new Error('Rundeneffekt benötigt Name, 1–1000 Runden und einen Zeitpunkt.');
            p.timedEffects ??= [];
            if (p.timedEffects.length >= 100)
              throw new Error('Zu viele Rundeneffekte für diesen Teilnehmer.');
            p.timedEffects.push({
              id: randomUUID(),
              name: a.name.trim(),
              remaining: a.rounds,
              tick: a.tick,
            });
          } else if (a.kind === 'effect-remove') {
            const p = participant(),
              before = p.timedEffects?.length ?? 0;
            if (typeof a.effectId !== 'string' || !a.effectId)
              throw new Error('Rundeneffekt fehlt.');
            p.timedEffects = p.timedEffects?.filter((effect) => effect.id !== a.effectId);
            if ((p.timedEffects?.length ?? 0) === before)
              throw new Error('Rundeneffekt nicht gefunden.');
            if (!p.timedEffects?.length) delete p.timedEffects;
          } else if (a.kind === 'visibility') {
            const p = participant();
            if (p.characterId)
              throw new Error('Partyfiguren bleiben auf der Spieleranzeige sichtbar.');
            if (typeof a.hidden !== 'boolean') throw new Error('Spielersichtbarkeit prüfen.');
            if (a.hidden) p.hiddenFromPlayers = true;
            else delete p.hiddenFromPlayers;
          } else if (a.kind === 'remove') {
            const p = participant(),
              order = combatOrder(state),
              index = order.findIndex((c) => c.id === p.id);
            if (p.concentrationChecks?.length)
              throw new Error('Offene Konzentrationsprüfung zuerst klären.');
            detachCombatHealth(db, cam, state, p, command.commandId);
            state.participants = state.participants.filter((c) => c.id !== p.id);
            if (state.turnId === p.id) {
              const next = order[index + 1] ?? order[0];
              state.turnId = state.participants.length
                ? next?.id === p.id
                  ? state.participants[0]!.id
                  : next!.id
                : null;
              if (index === order.length - 1 && state.participants.length) state.round++;
              const current = state.participants.find((actor) => actor.id === state.turnId);
              if (current) {
                resetLegendary(state, current);
                tickEffects(current, 'start');
              }
            }
            if (!state.participants.length) {
              state.phase = 'preparing';
              state.round = 0;
              state.turnId = null;
            }
          } else if (a.kind === 'start') {
            startCombat(db, cam, state);
          } else if (a.kind === 'next') {
            if (state.phase !== 'running') throw new Error('Kampf zuerst beginnen.');
            if (state.participants.some((p) => p.concentrationChecks?.length))
              throw new Error('Offene Konzentrationsprüfung zuerst klären.');
            const order = combatOrder(state),
              index = order.findIndex((p) => p.id === state.turnId);
            tickEffects(order[index]!, 'end');
            const nextIndex = (index + 1) % order.length;
            state.turnId = order[nextIndex]!.id;
            if (nextIndex === 0) state.round++;
            resetLegendary(state, order[nextIndex]!);
            tickEffects(order[nextIndex]!, 'start');
          } else if (a.kind === 'notes') {
            state.title = a.title;
            state.notes = a.notes;
          } else if (a.kind === 'finish') {
            if (state.participants.some((p) => p.concentrationChecks?.length))
              throw new Error('Offene Konzentrationsprüfung zuerst klären.');
            consumeFinishDraft(
              db,
              cam,
              { kind: 'combat', targetId: state.id, revision: state.revision },
              a.finishDraftWriteId,
            );
            if (typeof a.outcome !== 'string' || !a.outcome.trim())
              throw new Error('Die Begegnung benötigt ein Ergebnis.');
            state.assessment = assessment(db, cam, state);
            state.rewards = finishCombatRewards(db, cam, state, a.rewards);
            state.phase = 'finished';
            state.outcome = a.outcome;
          } else throw new Error('Unbekannte Kampfaktion.');
          const ordinal = db
            .prepare(
              'SELECT coalesce(max(ordinal),0)+1 n FROM combat_undo WHERE campaign_id=? AND combat_id=?',
            )
            .get(cam, state.id).n;
          db.prepare('INSERT INTO combat_undo VALUES(?,?,?,?,?)').run(
            cam,
            state.id,
            ordinal,
            before,
            hash(before),
          );
          db.prepare(
            'DELETE FROM combat_undo WHERE campaign_id=? AND combat_id=? AND ordinal<=?',
          ).run(cam, state.id, ordinal - 100);
        }
        const oldState = JSON.parse(before) as CombatState;
        if (a.kind === 'undo') {
          for (const actor of state.participants)
            if (
              actor.characterId &&
              !oldState.participants.some((p) => p.characterId === actor.characterId)
            )
              resumeCombatHealth(db, cam, state, actor, command.commandId);
          for (const actor of oldState.participants)
            if (
              actor.characterId &&
              !state.participants.some((p) => p.characterId === actor.characterId)
            )
              detachCombatHealth(db, cam, oldState, actor, command.commandId);
        }
        publishCombatHealth(db, cam, state, oldState);
        delete state.sharedNotice;
        state.revision++;
        checkedCombat(state);
        const payload = JSON.stringify(state);
        db.prepare(
          'UPDATE combat SET revision=?,phase=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
        ).run(state.revision, state.phase, payload, hash(payload), cam, state.id);
      }
      if (a.kind === 'create') publishCombatHealth(db, cam, state);
      syncOpenMaskHealth(db, cam, state.id);
      const result = readCombat(db, cam, state.sceneId, state.id),
        payload = JSON.stringify(result);
      db.prepare('INSERT INTO combat_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      if (consumedDraft)
        db.prepare(
          'DELETE FROM combat_working_draft WHERE campaign_id=? AND combat_id=? AND kind=? AND target_id=?',
        ).run(cam, consumedDraft.combatId, consumedDraft.kind, consumedDraft.targetId);
      return result;
    })
    .immediate();
}
