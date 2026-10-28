import { createHash } from 'node:crypto';
import { recordMaskReconciliation } from './mask-reconciliation';
import { checkedCombat, combatOrder } from '../runtime/combat-contracts';
import { type CombatState } from '../runtime/combat-state-contracts';
import { checkedHealth, checkedHealthStatus } from '../runtime/progression';
import { type CharacterHealth } from '../runtime/character-progress-contracts';
import { readProgressCharacter, saveProgress, event } from './progression-records';
import { writeWorldActorHealth } from './preparation-write';
import { readWorldActor } from './session-read';
const json = (v: unknown) => JSON.stringify(v),
  hash = (s: string) => createHash('sha256').update(s).digest('hex');
const health = (p: CharacterHealth): CharacterHealth => ({
  hp: p.hp,
  maxHp: p.maxHp,
  tempHp: p.tempHp,
  conditions: p.conditions,
  concentrating: p.concentrating,
  ...(p.death ? { death: structuredClone(p.death) } : {}),
});
const status = (p: { tempHp: number; conditions: string; concentrating: boolean }) => ({
  tempHp: p.tempHp,
  conditions: p.conditions,
  concentrating: p.concentrating,
});
function decode(row: any): CombatState {
  if (hash(row.payload) !== row.checksum) throw new Error('Kampfstand beschädigt.');
  return checkedCombat(JSON.parse(row.payload));
}
function save(db: any, cam: string, s: CombatState) {
  checkedCombat(s);
  const payload = json(s);
  db.prepare(
    'UPDATE combat SET revision=?,phase=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(s.revision, s.phase, payload, hash(payload), cam, s.id);
}
/** Removing an NPC must not strand an open mask on an unavailable canonical actor. */
export function assertNpcOutsideOpenCombat(db: any, cam: string, id: string) {
  for (const row of db
    .prepare("SELECT * FROM combat WHERE campaign_id=? AND phase IN('preparing','running')")
    .iterate(cam)) {
    if (decode(row).participants.some((p) => p.worldActorId === id))
      throw new Error(
        'NPC ist noch in einer offenen Begegnung verwendet. Teilnehmer zuerst aus der Begegnung entfernen oder die Begegnung abschließen.',
      );
  }
}
/** A mask edits the character or world actor's one persistent health state. */
export function publishCombatHealth(
  db: any,
  cam: string,
  state: CombatState,
  before?: CombatState,
) {
  for (const actor of state.participants) {
    if (actor.characterId) {
      const p = readProgressCharacter(db, cam, actor.characterId);
      let changed = false;
      if (actor.healthKnown === false) {
        const next = checkedHealthStatus(status(actor));
        if (
          p.health !== null ||
          json(status(p.combatStatus ?? { tempHp: 0, conditions: '', concentrating: false })) !==
            json(next)
        ) {
          p.health = null;
          p.combatStatus = next;
          changed = true;
        }
      } else {
        const next = checkedHealth(health(actor));
        if (json(p.health ? health(p.health) : null) !== json(next)) {
          p.health = next;
          delete p.combatStatus;
          changed = true;
        }
      }
      if (changed) saveProgress(db, cam, p);
    } else if (actor.worldActorId) {
      const canonical = readWorldActor(db, cam, actor.worldActorId),
        prior = before?.participants.find((p) => p.worldActorId === actor.worldActorId),
        expected = prior?.worldActorRevision ?? actor.worldActorRevision;
      if (canonical.revision !== expected || canonical.unavailable)
        throw new Error('NPC-Zustand geändert. Kampfstand aktualisieren.');
      actor.worldActorRevision =
        json(health(canonical)) === json(health(actor))
          ? canonical.revision
          : writeWorldActorHealth(db, cam, canonical.id, canonical.revision, health(actor))
              .revision;
    }
  }
}
/** Mirror shared facts into other masks; their older undo cannot reverse a later owner edit. */
export function syncOpenMaskHealth(
  db: any,
  cam: string,
  exceptId?: string,
  renames: ReadonlyMap<string, { before: string; after: string }> = new Map(),
) {
  const people = new Map<string, ReturnType<typeof readProgressCharacter>>(),
    npcs = new Map<string, ReturnType<typeof readWorldActor>>();
  for (const row of db
    .prepare(
      "SELECT * FROM combat WHERE campaign_id=? AND phase IN('preparing','running') ORDER BY ordinal",
    )
    .all(cam)) {
    if (row.id === exceptId) continue;
    const s = decode(row);
    let changed = false;
    for (const actor of s.participants) {
      const previous = json(actor),
        priorHp = actor.hp,
        priorDeath = json(actor.death);
      if (actor.characterId) {
        if (!people.has(actor.characterId))
          people.set(actor.characterId, readProgressCharacter(db, cam, actor.characterId));
        const p = people.get(actor.characterId)!;
        delete actor.death;
        if (p.health) {
          Object.assign(actor, health(p.health));
          actor.healthKnown = true;
        } else {
          Object.assign(
            actor,
            status(p.combatStatus ?? { tempHp: 0, conditions: '', concentrating: false }),
          );
          actor.healthKnown = false;
        }
      } else if (actor.worldActorId) {
        if (!npcs.has(actor.worldActorId))
          npcs.set(actor.worldActorId, readWorldActor(db, cam, actor.worldActorId));
        const p = npcs.get(actor.worldActorId)!,
          rename = renames.get(actor.worldActorId);
        if (rename && actor.name === rename.before) actor.name = rename.after;
        Object.assign(actor, health(p));
        actor.worldActorRevision = p.revision;
      }
      if (actor.characterId && (actor.hp !== priorHp || json(actor.death) !== priorDeath))
        delete actor.deathLast;
      if (!actor.concentrating) delete actor.concentrationChecks;
      if (json(actor) !== previous) changed = true;
    }
    if (changed) {
      s.revision++;
      s.sharedNotice =
        'Name, HP oder Zustände wurden in einer anderen Maske oder am Weltinhalt geändert. Ältere Schritte dieser Begegnung sind nicht mehr rückgängig verfügbar.';
      save(db, cam, s);
      db.prepare('DELETE FROM combat_undo WHERE campaign_id=? AND combat_id=?').run(cam, s.id);
    }
  }
}
/** PCs leave every ongoing mask as part of the same transaction as a party move. */
export function removePartyFromMasks(
  db: any,
  cam: string,
  ids: string[],
  commandId: string,
  retiredScenes: Set<string> = new Set(),
) {
  const moving = new Set(ids);
  for (const row of db
    .prepare(
      "SELECT * FROM combat WHERE campaign_id=? AND phase IN('preparing','running') ORDER BY ordinal",
    )
    .all(cam)) {
    const s = decode(row),
      removed = s.participants.filter((p) => p.characterId && moving.has(p.characterId)),
      retired = retiredScenes.has(s.sceneId);
    if (!removed.length && !retired) continue;
    const beforeRevision = s.revision;
    publishCombatHealth(db, cam, { ...s, participants: removed });
    const order = combatOrder(s),
      turnIndex = order.findIndex((p) => p.id === s.turnId);
    s.participants = s.participants.filter((p) => !p.characterId || !moving.has(p.characterId));
    if (s.turnId && !s.participants.some((p) => p.id === s.turnId)) {
      const candidates = [...order.slice(turnIndex + 1), ...order.slice(0, turnIndex + 1)];
      const next = candidates.find((p) => s.participants.some((left) => left.id === p.id));
      s.turnId = next?.id ?? null;
      if (next) {
        if (order.indexOf(next) < turnIndex) s.round++;
        if (
          s.sources?.some((source) => source.id === next.sourceId && source.legendaryActions.length)
        )
          next.legendaryActions = { remaining: 3, maximum: 3, lastResetRound: s.round };
      }
    }
    if (retired) s.phase = 'retired';
    else if (!s.participants.length) {
      s.phase = 'preparing';
      s.round = 0;
      s.turnId = null;
    }
    s.revision++;
    s.sharedNotice =
      'Party-Figuren wurden in eine andere Scene verschoben oder deaktiviert und aus dieser Begegnung entfernt.';
    save(db, cam, s);
    db.prepare('DELETE FROM combat_undo WHERE campaign_id=? AND combat_id=?').run(cam, s.id);
    recordMaskReconciliation(db, {
      version: 1,
      commandId,
      campaignId: cam,
      ownerKind: 'combat',
      ownerId: s.id,
      sceneId: s.sceneId,
      beforeRevision,
      afterRevision: s.revision,
      removedCharacterIds: removed.map((p) => p.characterId!),
      retired,
    });
    for (const actor of removed)
      event(db, cam, actor.characterId, 'combat-exit', {
        commandId,
        combatId: s.id,
        title: s.title,
        participant: actor,
        reason: 'Party-Zuordnung geändert',
      });
  }
}
