import { checkedQuery, checkedRow, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { checkedTreasureRow, checkedItemInput } from './progression-records';
import { checkedWorldNoteRow } from './world-note-row';
import { readItemDefinition } from './item-definitions';
import { exactWeight } from '../campaign/generation-contracts';
import { validateEncounterPlanInput } from '../catalog/encounter-contracts';
import { checkVisitPlanning } from '../runtime/session-day';
import { checkedPreparedGroupRow, checkedPreparedGroupValue } from './prepared-group';
import { readVisitBinding } from './scene-visits';
import { npcRecord, npcDisposition } from './npc-record';
import { createHash } from 'node:crypto';
import { manualPlan, type ManualPlan } from '../../features/planner/manual-planner';
import { checkedHealth } from '../runtime/progression';
import type {
  SessionProfile,
  VisitDetail,
  PreparedGroup,
  WorldActor,
  SessionSnapshot,
  ScenePreparation,
} from '../campaign/session-contracts';
export const json = (v: unknown) => JSON.stringify(v);

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export function readPlan(db: SqliteDatabase, cam: string, id: string): ManualPlan {
  const row = checkedQuery(db, 'SELECT * FROM plan WHERE campaign_id=? AND id=?', {
    campaign_id: 'text',
    id: 'text',
    revision: 'integer',
    name: 'text',
  }).required(cam, id);
  const scenes = checkedQuery(
    db,
    'SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=? ORDER BY ordinal',
    {
      campaign_id: 'text',
      plan_id: 'text',
      id: 'text',
      ordinal: 'integer',
      payload: 'text',
      checksum: 'text',
    },
  )
    .all(cam, id)
    .map((r, index) => {
      const scene = decodeStored(r, shape.planned_visit);
      if (scene.id !== r.id || r.plan_id !== id || r.campaign_id !== cam || r.ordinal !== index)
        throw new Error('Geplanter Besuch gehört nicht zu seinem Plan oder seiner Reihenfolge.');
      if (
        scene.locationId &&
        !checkedQuery(db, 'SELECT 1 FROM location WHERE campaign_id=? AND id=?', {
          '1': 'integer',
        }).get(cam, scene.locationId)
      )
        throw new Error('Geplanter Ort gehört nicht zur Kampagne.');
      return scene;
    });
  return manualPlan({ version: 1, id: row.id, revision: row.revision, name: row.name, scenes });
}

function positiveRevision(revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1)
    throw new Error('Gespeicherte Spielabendrevision ungültig.');
}
export function checkedSessionProfileValue(value: unknown, persisted = true): SessionProfile {
  const p = shape.session_profile(value);
  if (persisted) positiveRevision(p.revision);
  else if (!Number.isSafeInteger(p.revision) || p.revision < 0)
    throw new Error('Profilrevision ungültig.');
  if (
    !p.planId.trim() ||
    p.planId.length > 1000 ||
    !p.seed.trim() ||
    p.seed.length > 1000 ||
    (p.encounterCount != null &&
      (!Number.isSafeInteger(p.encounterCount) || p.encounterCount < 1 || p.encounterCount > 10))
  )
    throw new Error('Spielabendprofil hat ungültige Kennungen oder Begegnungszahl.');
  validateEncounterPlanInput({
    id: p.planId,
    name: '',
    notes: '',
    revision: 1,
    party: p.party,
    entries: [],
    sources: [],
    catalogHash: '',
  });
  const fraction = Number(exactWeight(p.adventureDayFraction));
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 10)
    throw new Error('Adventure Day benötigt einen Anteil zwischen 0 und 10.');
  return p;
}
export function checkedSessionProfile(row: unknown): SessionProfile {
  const r = checkedRow(row, { plan_id: 'text', revision: 'integer' }),
    p = decodeStored(row, checkedSessionProfileValue);
  if (p.planId !== r.plan_id || p.revision !== r.revision)
    throw new Error('Spielabendprofilzuordnung widersprüchlich.');
  return p;
}
export function profile(
  db: SqliteDatabase,
  cam: string,
  id: string,
  knownPlan?: ManualPlan,
): SessionProfile {
  const plan = knownPlan ?? readPlan(db, cam, id);
  if (plan.id !== id) throw new Error('Spielabendprofil gehört zu einem anderen Plan.');
  const row = checkedQuery(db, 'SELECT * FROM session_profile WHERE campaign_id=? AND plan_id=?', {
    campaign_id: 'text',
    plan_id: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  }).get(cam, id);
  return row
    ? checkedSessionProfile(row)
    : { planId: id, revision: 0, party: [], adventureDayFraction: '0.5', seed: 'spielabend-1' };
}

export function checkedVisitDetail(db: SqliteDatabase, cam: string, row: unknown): VisitDetail {
  const r = checkedRow(row, {
    campaign_id: 'text',
    plan_id: 'text',
    id: 'text',
    revision: 'integer',
  });
  const d = decodeStored(row, shape.session_visit);
  const identity = (id: string) => !!id.trim() && id.length <= 1000;
  positiveRevision(d.revision);
  if (
    r.campaign_id !== cam ||
    d.visitId !== r.id ||
    d.revision !== r.revision ||
    !identity(d.visitId) ||
    d.readAloud.length > 2000000
  )
    throw new Error('Besuchsvorbereitung gehört nicht zu ihrer Identität oder Revision.');
  checkVisitPlanning(d);
  for (const [table, ids] of [
    ['world_note', d.noteIds],
    ['prepared_group', d.groupIds],
  ] as const) {
    if (ids.length > 1000 || ids.some((id) => !identity(id)) || new Set(ids).size !== ids.length)
      throw new Error('Besuchsvorbereitung enthält ungültige oder doppelte Verweise.');
    for (const id of ids)
      if (!db.prepare(`SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?`).get(cam, id))
        throw new Error('Besuchsverweis gehört nicht zur Kampagne.');
  }
  for (const id of d.groupIds) {
    const g = checkedQuery(
      db,
      'SELECT draft_plan_id,draft_visit_id,location_id FROM prepared_group WHERE campaign_id=? AND id=?',
      {
        draft_plan_id: 'nullable-text',
        draft_visit_id: 'nullable-text',
        location_id: 'nullable-text',
      },
    ).required(cam, id);
    if (
      (g.draft_plan_id !== null || g.draft_visit_id !== null) &&
      (g.draft_plan_id !== r.plan_id || g.draft_visit_id !== r.id)
    )
      throw new Error('Vorbereitete Gruppe gehört zu einem anderen Plan oder Besuch.');
  }
  if (d.reward) {
    const reward = d.reward;
    if (
      !identity(reward.id) ||
      !Number.isSafeInteger(reward.poolXp) ||
      reward.poolXp < 0 ||
      reward.items.length > 100 ||
      (reward.placedTreasureId !== null && !identity(reward.placedTreasureId))
    )
      throw new Error('Besuchsbelohnung beschädigt.');
    for (const item of reward.items) {
      checkedItemInput(item);
      if (item.reference)
        readItemDefinition(db, item.reference.definitionId, item.reference.revision);
    }
    if (
      reward.placedTreasureId &&
      !checkedQuery(db, 'SELECT 1 FROM treasure WHERE campaign_id=? AND id=?', {
        '1': 'integer',
      }).get(cam, reward.placedTreasureId)
    )
      throw new Error('Besuchsschatz gehört nicht zur Kampagne.');
  }
  return d;
}
export function detail(
  db: SqliteDatabase,
  cam: string,
  planId: string,
  visitId: string,
  knownPlan?: ManualPlan,
): VisitDetail {
  const plan = knownPlan ?? readPlan(db, cam, planId);
  if (plan.id !== planId || !plan.scenes.some((s) => s.id === visitId))
    throw new Error('Vorbereiteter Besuch fehlt.');
  const row = checkedQuery(db, 'SELECT * FROM session_visit WHERE campaign_id=? AND id=?', {
    campaign_id: 'text',
    plan_id: 'text',
    id: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  }).get(cam, visitId);
  if (!row) return { visitId, revision: 0, readAloud: '', noteIds: [], groupIds: [], reward: null };
  if (row.plan_id !== planId) throw new Error('Besuchsvorbereitung gehört zu einem anderen Plan.');
  const value = checkedVisitDetail(db, cam, row);
  const index = plan.scenes.findIndex((s) => s.id === visitId);
  if (value.restAfter && value.restAfter.beforeVisitId !== plan.scenes[index + 1]?.id)
    throw new Error('Geplante Rast gehört nicht zwischen benachbarte Szenen.');
  return value;
}

export function readWorldActor(db: SqliteDatabase, cam: string, id: string): WorldActor {
  const raw = checkedQuery(db, 'SELECT * FROM world_actor WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
    row = checkedRow(raw, { id: 'text', revision: 'integer' }),
    actor = decodeStored(raw, shape.world_actor);
  const validId = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  if (
    actor.id !== row.id ||
    actor.revision !== row.revision ||
    !Number.isSafeInteger(actor.revision) ||
    actor.revision < 1 ||
    !validId(actor.id) ||
    !validId(actor.creatureId) ||
    !validId(actor.entryId) ||
    typeof actor.unavailable !== 'boolean'
  )
    throw new Error('NPC-Zuordnung oder Revision widersprüchlich.');
  checkedHealth(actor);
  const n = checkedQuery(db, 'SELECT * FROM world_note WHERE campaign_id=? AND id=?', {
    campaign_id: 'text',
    id: 'text',
    revision: 'integer',
    trashed: 'integer',
    payload: 'text',
    checksum: 'text',
  }).get(cam, id);
  if (!n) throw new Error('NPC-Profil fehlt.');
  const document = checkedWorldNoteRow(n);
  if (document.kind !== 'npc') throw new Error('NPC-Profilzuordnung widersprüchlich.');
  const record = npcRecord(db, cam, id);
  return {
    ...actor,
    name: document.title,
    unavailable: !!n.trashed,
    defeated: record.lifecycle === 'defeated',
    ...npcDisposition(db, cam, record),
  };
}

export function readPreparedGroup(db: SqliteDatabase, cam: string, id: string): PreparedGroup {
  const g = checkedPreparedGroupRow(
    checkedQuery(db, 'SELECT * FROM prepared_group WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      draft_plan_id: 'nullable-text',
      draft_visit_id: 'nullable-text',
      location_id: 'nullable-text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
  );
  return {
    ...g,
    actors: g.actors.map((a) => ({ ...readWorldActor(db, cam, a.id), entryId: a.entryId })),
  };
}

export function readSession(db: SqliteDatabase, cam: string, planId: string): SessionSnapshot {
  return db.transaction(() => {
    const plan = readPlan(db, cam, planId),
      visits = plan.scenes.map((s) => detail(db, cam, planId, s.id, plan)),
      ids = [...new Set(visits.flatMap((v) => v.groupIds))];
    for (const [index, visit] of visits.entries()) {
      checkVisitPlanning(visit);
      if (visit.restAfter && visit.restAfter.beforeVisitId !== plan.scenes[index + 1]?.id)
        throw new Error('Geplante Rast gehört nicht zwischen benachbarte Szenen.');
    }
    const result = {
      profile: profile(db, cam, planId, plan),
      visits,
      groups: ids.map((id) => readPreparedGroup(db, cam, id)),
      encounters: [],
    };
    return {
      plan,
      ...result,
      replacementBasis: hash(
        json({ plan, profile: result.profile, visits, groups: result.groups }),
      ),
    };
  })();
}

export { sceneReadAloud } from './scene-read-aloud';

function preparedGroupIdsAt(
  db: SqliteDatabase,
  cam: string,
  locationId: string | null,
  adoptionId: string | null,
  sceneId: string,
): string[] {
  const ids = new Set<string>(
    checkedQuery(
      db,
      'SELECT group_id FROM scene_prepared_group WHERE campaign_id=? AND adoption_id=?',
      { group_id: 'text' },
    )
      .all(cam, adoptionId ?? '')
      .map((r) => checkedRow(r, { group_id: 'text' }).group_id),
  );
  for (const row of checkedQuery(
    db,
    'SELECT group_id FROM scene_opponent_group WHERE campaign_id=? AND scene_id=?',
    { group_id: 'text' },
  ).all(cam, sceneId))
    ids.add(checkedRow(row, { group_id: 'text' }).group_id);
  if (locationId)
    for (const row of checkedQuery(
      db,
      'SELECT id FROM prepared_group WHERE campaign_id=? AND location_id=?',
      { id: 'text' },
    ).all(cam, locationId))
      ids.add(checkedRow(row, { id: 'text' }).id);
  return [...ids];
}

export function scenePreparedGroupIds(db: SqliteDatabase, cam: string, sceneId: string): string[] {
  const scene = checkedQuery(
    db,
    'SELECT location_id FROM live_scene WHERE campaign_id=? AND id=?',
    { location_id: 'nullable-text' },
  ).required(cam, sceneId);
  if (!scene) throw new Error('Laufende Scene fehlt.');
  const adoption = checkedQuery(
    db,
    'SELECT id FROM scene_adoption WHERE campaign_id=? AND scene_id=? ORDER BY ordinal DESC LIMIT 1',
    { id: 'text' },
  ).get(cam, sceneId);
  return preparedGroupIdsAt(
    db,
    cam,
    scene.location_id,
    adoption ? checkedRow(adoption, { id: 'text' }).id : null,
    sceneId,
  );
}

export function scenePreparation(
  db: SqliteDatabase,
  cam: string,
  sceneId: string,
): ScenePreparation {
  return db.transaction(() => {
    const scene = checkedQuery(
      db,
      'SELECT location_id FROM live_scene WHERE campaign_id=? AND id=?',
      { location_id: 'nullable-text' },
    ).required(cam, sceneId);
    if (!scene) throw new Error('Laufende Scene fehlt.');
    const adoption = checkedQuery(
      db,
      'SELECT * FROM scene_adoption WHERE campaign_id=? AND scene_id=? ORDER BY ordinal DESC LIMIT 1',
      {
        campaign_id: 'text',
        id: 'text',
        scene_id: 'text',
        ordinal: 'integer',
        plan_id: 'text',
        plan_revision: 'integer',
        visit_id: 'text',
        title: 'text',
        notes: 'text',
        location_id: 'nullable-text',
      },
    ).get(cam, sceneId);
    const binding = adoption
      ? checkedRow(adoption, { id: 'text', plan_id: 'text', visit_id: 'text' })
      : null;
    const ids = preparedGroupIdsAt(db, cam, scene.location_id, binding?.id ?? null, sceneId);
    let nextVisit = null,
      noteIds: string[] = [];
    if (adoption) {
      noteIds = readVisitBinding(db, cam, adoption).noteIds;
      const exists = checkedQuery(db, 'SELECT 1 FROM plan WHERE campaign_id=? AND id=?', {
          '1': 'integer',
        }).get(cam, binding!.plan_id),
        plan = exists ? readPlan(db, cam, binding!.plan_id) : null,
        index = plan?.scenes.findIndex((s) => s.id === binding!.visit_id) ?? -1,
        next = index >= 0 ? plan?.scenes[index + 1] : null;
      if (plan && next)
        nextVisit = {
          planId: plan.id,
          planRevision: plan.revision,
          visitId: next.id,
          title: next.title,
        };
    }
    const treasures = checkedQuery(db, 'SELECT * FROM treasure WHERE campaign_id=?', {
      campaign_id: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    })
      .all(cam)
      .map(checkedTreasureRow)
      .filter((t) => t.locationId && t.locationId === scene.location_id)
      .map((t) => ({ id: t.id, title: t.title }));
    return {
      groups: [...ids].map((id) => readPreparedGroup(db, cam, id)),
      treasures,
      noteIds,
      nextVisit,
    };
  })();
}

export function checkedSessionReceipt(db: SqliteDatabase, value: unknown) {
  const row = checkedRow(value, { campaign_id: 'text', command_id: 'text', fingerprint: 'text' });
  const receipt = decodeStored(value, shape.session_receipt);
  if (
    !row.command_id ||
    !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
    !db.prepare('SELECT 1 FROM campaign WHERE id=?').get(row.campaign_id)
  )
    throw new Error('Spielabendbestätigung beschädigt.');
  checkedSessionProfileValue(receipt.profile, false);
  const ids = new Set<string>();
  for (const visit of receipt.visits) {
    if (
      !visit.visitId.trim() ||
      ids.has(visit.visitId) ||
      !Number.isSafeInteger(visit.revision) ||
      visit.revision < 0 ||
      visit.readAloud.length > 2000000
    )
      throw new Error('Besuchsbestätigung beschädigt.');
    ids.add(visit.visitId);
    checkVisitPlanning(visit);
    for (const list of [visit.noteIds, visit.groupIds])
      if (
        list.length > 1000 ||
        list.some((id) => !id.trim() || id.length > 1000) ||
        new Set(list).size !== list.length
      )
        throw new Error('Bestätigte Besuchsverweise beschädigt.');
    if (visit.reward) {
      const r = visit.reward;
      if (!r.id.trim() || !Number.isSafeInteger(r.poolXp) || r.poolXp < 0 || r.items.length > 100)
        throw new Error('Bestätigte Besuchsbelohnung beschädigt.');
      for (const item of r.items) checkedItemInput(item);
    }
  }
  const groups = new Set(receipt.groups.map((g) => g.id));
  if (
    groups.size !== receipt.groups.length ||
    receipt.visits.some((v) => v.groupIds.some((id) => !groups.has(id)))
  )
    throw new Error('Bestätigte Besuchsgruppen widersprüchlich.');
  for (const g of receipt.groups) checkedPreparedGroupValue(g);
  return receipt;
}
export function validateSessionData(db: SqliteDatabase) {
  for (const row of db.prepare('SELECT * FROM session_profile').iterate()) {
    const r = checkedRow(row, { campaign_id: 'text', plan_id: 'text' });
    profile(db, r.campaign_id, r.plan_id);
  }
  for (const row of db.prepare('SELECT * FROM session_visit').iterate()) {
    const r = checkedRow(row, { campaign_id: 'text', plan_id: 'text', id: 'text' });
    detail(db, r.campaign_id, r.plan_id, r.id);
  }
  for (const row of db.prepare('SELECT * FROM world_actor').iterate()) {
    const r = checkedRow(row, { campaign_id: 'text', id: 'text' });
    readWorldActor(db, r.campaign_id, r.id);
  }
  for (const row of db.prepare('SELECT * FROM live_scene_extra').iterate())
    decodeStored(row, shape.live_scene_extra);
  for (const row of db.prepare('SELECT * FROM session_receipt').iterate())
    checkedSessionReceipt(db, row);
}
