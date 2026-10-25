import { createHash } from 'node:crypto';
import { checkedCombat, checkedCombatant } from '../combat-contracts';
import {
  fighterDraftFields,
  type CombatWorkingDraft,
  type CombatDraftKind,
  type CombatDraftPage,
} from '../combat-draft-contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const fields = (v: any, keys: string[]) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const id = (v: unknown) => typeof v === 'string' && !!v && v.length <= 1000;
function kind(k: unknown): asserts k is CombatDraftKind {
  if (k !== 'fighter' && k !== 'notes' && k !== 'initiative')
    throw new Error('Unbekannter Kampfeingabeentwurf.');
}
export function installCombatDraftSchema(db: any) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS combat_working_draft(campaign_id TEXT NOT NULL,combat_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('fighter','notes','initiative')),target_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,combat_id,kind,target_id),FOREIGN KEY(campaign_id,combat_id) REFERENCES combat(campaign_id,id)) STRICT;",
  );
}
export function checkedCombatDraft(d: any): CombatWorkingDraft {
  kind(d?.kind);
  if (
    !fields(
      d,
      d.kind === 'fighter'
        ? [
            'version',
            'writeId',
            'combatId',
            'sceneId',
            'targetId',
            'revision',
            'kind',
            'basis',
            'values',
            'concentrating',
            'counted',
          ]
        : [
            'version',
            'writeId',
            'combatId',
            'sceneId',
            'targetId',
            'revision',
            'kind',
            'basis',
            'values',
          ],
    ) ||
    d.version !== 1 ||
    ![d.writeId, d.combatId, d.sceneId, d.targetId].every(id) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 1
  )
    throw new Error('Kampfeingabe besitzt einen ungültigen Ziel-/Versionsvertrag.');
  if (d.kind === 'fighter') {
    checkedCombatant(d.basis);
    for (const k of ['sourceId', 'sourceEntryId', 'worldActorId'])
      if (d.basis[k] !== undefined && !id(d.basis[k]))
        throw new Error('Ungültige Teilnehmerreferenz.');
    for (const k of ['sourceOrdinal', 'worldActorRevision'])
      if (d.basis[k] !== undefined && (!Number.isSafeInteger(d.basis[k]) || d.basis[k] < 0))
        throw new Error('Ungültige Teilnehmerbasisrevision.');
    if (
      (d.basis.countForMultiplier !== undefined &&
        typeof d.basis.countForMultiplier !== 'boolean') ||
      (d.basis.partitionKind !== undefined &&
        !['mob', 'individual'].includes(d.basis.partitionKind))
    )
      throw new Error('Ungültige Teilnehmerbasisgruppe.');
    const allowed = [
      'id',
      'characterId',
      'groupId',
      'groupName',
      'role',
      'name',
      'initiative',
      'initiativeBonus',
      'armorClass',
      'hp',
      'maxHp',
      'tempHp',
      'conditions',
      'concentrating',
      'death',
      'deathLast',
      'concentrationChecks',
      'concentrationLast',
      'legendaryActions',
      'timedEffects',
      'hiddenFromPlayers',
      'healthKnown',
      'xp',
      'countForMultiplier',
      'sourceId',
      'sourceOrdinal',
      'worldActorId',
      'worldActorRevision',
      'sourceEntryId',
      'partitionKind',
    ];
    if (
      Object.keys(d.basis).some((k) => !allowed.includes(k)) ||
      (d.basis.characterId !== null && !id(d.basis.characterId))
    )
      throw new Error('Teilnehmerbasis hat einen unbekannten Referenzvertrag.');
    if (
      d.basis.id !== d.targetId ||
      !(
        fields(d.values, [...fighterDraftFields]) ||
        fields(d.values, [...fighterDraftFields, 'fighter-group-name'])
      ) ||
      Object.values(d.values).some((v) => typeof v !== 'string' || v.length > 10000) ||
      typeof d.concentrating !== 'boolean' ||
      typeof d.counted !== 'boolean' ||
      Buffer.byteLength(JSON.stringify(d)) > 65536
    )
      throw new Error('Teilnehmereingabe hat ungültige Rohfelder.');
  } else if (d.kind === 'initiative') {
    const b = d.basis;
    if (
      d.targetId !== d.combatId ||
      !fields(b, ['phase', 'round', 'turnId', 'participants']) ||
      !['preparing', 'running'].includes(b.phase) ||
      !Number.isSafeInteger(b.round) ||
      b.round < 0 ||
      (b.turnId !== null && !id(b.turnId)) ||
      !Array.isArray(b.participants) ||
      b.participants.length > 1000 ||
      b.participants.some(
        (p: any) =>
          !fields(p, ['id', 'groupId', 'initiative']) ||
          !id(p.id) ||
          !id(p.groupId) ||
          !Number.isSafeInteger(p.initiative) ||
          Math.abs(p.initiative) > 1000000,
      ) ||
      new Set(b.participants.map((p: any) => p.id)).size !== b.participants.length ||
      (b.turnId !== null && !b.participants.some((p: any) => p.id === b.turnId))
    )
      throw new Error('Initiativeentwurf hat eine ungültige Grundlage.');
    if (
      !Array.isArray(d.values) ||
      d.values.length > 1000 ||
      d.values.some(
        (v: any) =>
          !fields(v, ['participantId', 'raw']) ||
          !id(v.participantId) ||
          !b.participants.some((p: any) => p.id === v.participantId) ||
          typeof v.raw !== 'string' ||
          v.raw.length > 100,
      ) ||
      new Set(d.values.map((v: any) => v.participantId)).size !== d.values.length
    )
      throw new Error('Initiativeentwurf hat ungültige Eingaben.');
  } else {
    if (
      d.targetId !== d.combatId ||
      !fields(d.basis, ['title', 'notes']) ||
      !fields(d.values, ['title', 'notes']) ||
      [d.basis, d.values].some(
        (v) =>
          typeof v.title !== 'string' ||
          v.title.length > 1000 ||
          typeof v.notes !== 'string' ||
          v.notes.length > 2000000,
      )
    )
      throw new Error('Kampfnotizentwurf hat ungültige Rohfelder.');
  }
  return d;
}
function owner(db: any, cam: string, combatId: string) {
  const r = db.prepare('SELECT * FROM combat WHERE campaign_id=? AND id=?').get(cam, combatId);
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error('Kampf des Entwurfs fehlt oder ist beschädigt.');
  const c = checkedCombat(JSON.parse(r.payload));
  if (c.id !== r.id || c.sceneId !== r.scene_id || c.revision !== r.revision || c.phase !== r.phase)
    throw new Error('Kampfzuordnung des Entwurfs widersprüchlich.');
  return c;
}
function references(db: any, cam: string, d: CombatWorkingDraft) {
  if (d.kind !== 'fighter') return;
  if (
    d.basis.characterId &&
    !db
      .prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?')
      .get(cam, d.basis.characterId)
  )
    throw new Error('Teilnehmerbasis besitzt einen fremden Charakter.');
  if (
    d.basis.worldActorId &&
    !db
      .prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?')
      .get(cam, d.basis.worldActorId)
  )
    throw new Error('Teilnehmerbasis besitzt einen fremden NPC.');
}
function decode(db: any, row: any): CombatWorkingDraft {
  if (hash(row.payload) !== row.checksum)
    throw new Error('Kampfeingabe ist beschädigt. Originalbytes bleiben erhalten.');
  const d = checkedCombatDraft(JSON.parse(row.payload)),
    c = owner(db, row.campaign_id, row.combat_id);
  if (
    d.combatId !== row.combat_id ||
    d.kind !== row.kind ||
    d.targetId !== row.target_id ||
    d.sceneId !== c.sceneId ||
    d.revision > c.revision
  )
    throw new Error('Kampfeingabe gehört zu einem anderen Ziel.');
  references(db, row.campaign_id, d);
  return d;
}
export function readCombatDraft(
  db: any,
  cam: string,
  combatId: string,
  k: CombatDraftKind,
  targetId: string,
) {
  kind(k);
  owner(db, cam, combatId);
  const row = db
    .prepare(
      'SELECT * FROM combat_working_draft WHERE campaign_id=? AND combat_id=? AND kind=? AND target_id=?',
    )
    .get(cam, combatId, k, targetId);
  return row ? decode(db, row) : null;
}
export function keepCombatDraft(
  db: any,
  cam: string,
  value: CombatWorkingDraft,
  expected: string | null,
) {
  return db
    .transaction(() => {
      const d = checkedCombatDraft(value),
        c = owner(db, cam, d.combatId),
        old = readCombatDraft(db, cam, d.combatId, d.kind, d.targetId),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId) {
        if (JSON.stringify(old) !== payload) throw new Error('Entwurfskennung anders verwendet.');
        return;
      }
      if ((expected !== null && !id(expected)) || (old?.writeId ?? null) !== expected)
        throw new Error('Kampfeingabe inzwischen geändert. Rohwerte bleiben erhalten.');
      if (
        d.revision > c.revision ||
        d.sceneId !== c.sceneId ||
        !['preparing', 'running'].includes(c.phase) ||
        (d.kind === 'fighter' && !c.participants.some((p) => p.id === d.targetId))
      )
        throw new Error('Entwurfsziel ist nicht mehr bearbeitbar.');
      references(db, cam, d);
      db.prepare(
        'INSERT INTO combat_working_draft VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,combat_id,kind,target_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, d.combatId, d.kind, d.targetId, payload, hash(payload));
    })
    .immediate();
}
export function discardCombatDraft(
  db: any,
  cam: string,
  combatId: string,
  k: CombatDraftKind,
  targetId: string,
  writeId: string,
) {
  return db
    .transaction(() => {
      if (!id(writeId)) throw new Error('Entwurfskennung fehlt.');
      const d = readCombatDraft(db, cam, combatId, k, targetId);
      if (!d) return;
      if (d.writeId !== writeId) throw new Error('Kampfeingabe inzwischen geändert.');
      db.prepare(
        'DELETE FROM combat_working_draft WHERE campaign_id=? AND combat_id=? AND kind=? AND target_id=?',
      ).run(cam, combatId, k, targetId);
    })
    .immediate();
}
export function combatDrafts(
  db: any,
  cam: string,
  combatId: string,
  after: string | null,
): CombatDraftPage {
  owner(db, cam, combatId);
  if (after !== null && (typeof after !== 'string' || !/^[0-9]+$/.test(after)))
    throw new Error('Entwurfsseite ungültig.');
  const rows = db
      .prepare(
        'SELECT rowid AS ordinal,* FROM combat_working_draft WHERE campaign_id=? AND combat_id=? AND (? IS NULL OR rowid>CAST(? AS INTEGER)) ORDER BY rowid LIMIT 21',
      )
      .all(cam, combatId, after, after),
    items: CombatDraftPage['items'] = [],
    problems: CombatDraftPage['problems'] = [];
  for (const row of rows.slice(0, 20))
    try {
      const d = decode(db, row);
      items.push({
        kind: d.kind,
        targetId: d.targetId,
        writeId: d.writeId,
        label:
          d.kind === 'fighter'
            ? d.basis.name
            : d.kind === 'initiative'
              ? 'Initiative'
              : d.basis.title,
      });
    } catch (error) {
      problems.push({ kind: row.kind, targetId: row.target_id, message: (error as Error).message });
    }
  return { items, problems, next: rows.length > 20 ? String(rows[19].ordinal) : null };
}
export function validateCombatDrafts(db: any) {
  if (
    !db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='combat_working_draft'")
      .get()
  ) {
    if (db.pragma('user_version', { simple: true }) >= 34)
      throw new Error('Kampfeingabeschema fehlt.');
    return;
  }
  for (const row of db.prepare('SELECT * FROM combat_working_draft').iterate()) decode(db, row);
}
