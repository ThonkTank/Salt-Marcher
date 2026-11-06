import { captureVisitBinding } from './scene-visits';
import { randomUUID } from 'node:crypto';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { worldNoteDocument } from '../../features/world/world-notes';
import { type EncounterPlan } from '../catalog/encounter-contracts';
import type { VisitDetail, PreparedGroup, WorldActor } from '../campaign/session-contracts';
import { json, hash, readWorldActor, detail, readPlan, readPreparedGroup } from './session-read';
export function saveDetail(db: any, cam: string, planId: string, d: VisitDetail) {
  d.revision++;
  const payload = json(d);
  db.prepare(
    'INSERT INTO session_visit VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, planId, d.visitId, d.revision, payload, hash(payload));
}

export function writeWorldActorHealth(
  db: any,
  cam: string,
  id: string,
  expectedRevision: number,
  health: Pick<WorldActor, 'hp' | 'maxHp' | 'tempHp' | 'conditions' | 'concentrating'>,
) {
  const actor = readWorldActor(db, cam, id);
  if (actor.revision !== expectedRevision || actor.unavailable)
    throw new Error(
      'NPC-Zustand wurde geändert. Kampfabschluss zuerst mit dem aktuellen NPC-Stand abgleichen.',
    );
  const next = { ...actor, ...health, revision: actor.revision + 1 },
    payload = json(next);
  db.prepare(
    'UPDATE world_actor SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(next.revision, payload, hash(payload), cam, id);
  return next;
}

export function saveGroup(
  db: any,
  cam: string,
  g: PreparedGroup,
  draftPlan: string | null,
  draftVisit: string | null,
) {
  const payload = json(g);
  db.prepare(
    'INSERT INTO prepared_group VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET draft_plan_id=excluded.draft_plan_id,draft_visit_id=excluded.draft_visit_id,location_id=excluded.location_id,revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, g.id, draftPlan, draftVisit, g.locationId, g.revision, payload, hash(payload));
}

export function newGroup(
  db: any,
  cam: string,
  source: EncounterPlan,
  planId: string | null,
  visitId: string | null,
): PreparedGroup {
  const g: PreparedGroup = {
    id: randomUUID(),
    revision: 1,
    title: source.name,
    notes: source.notes,
    sourceEncounterId: source.id,
    sourceRevision: source.revision,
    locationId: null,
    plan: structuredClone(source),
    actors: [],
  };
  saveGroup(db, cam, g, planId, visitId);
  return g;
}

export function materialize(db: any, cam: string, g: PreparedGroup) {
  if (g.actors.length) return;
  for (const entry of g.plan.entries) {
    const c = g.plan.sources.find((c) => c.id === entry.creatureId);
    if (!c) throw new Error('Kreaturquelle der vorbereiteten Gruppe fehlt.');
    if (entry.worldActorIds) {
      for (const id of entry.worldActorIds) {
        const actor = readWorldActor(db, cam, id);
        if (
          actor.creatureId !== entry.creatureId ||
          actor.unavailable ||
          actor.defeated ||
          actor.hp <= 0
        )
          throw new Error('Benannter NPC nicht verfügbar. Weltprofil prüfen.');
        g.actors.push({ ...actor, entryId: entry.id });
      }
    }
    for (let i = entry.worldActorIds?.length ?? 0; i < entry.count; i++) {
      const id = randomUUID(),
        name = c.name + ' ' + (i + 1) + ' · ' + g.title,
        npc = worldNoteDocument({
          version: 1,
          id: campaignLocalId(id),
          revision: 1,
          kind: 'npc',
          title: name,
          readAloud: '',
          gmNotes: g.notes,
          relations: [],
          creatureId: c.id,
          deleted: false,
        }),
        payload = json(npc);
      db.prepare('INSERT INTO world_note VALUES(?,?,1,0,?,?)').run(cam, id, payload, hash(payload));
      db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)').run(
        cam,
        id,
        name,
        npc.gmNotes,
      );
      const actor: WorldActor = {
          id,
          name,
          creatureId: c.id,
          revision: 1,
          hp: c.hp,
          maxHp: c.hp,
          tempHp: 0,
          conditions: '',
          concentrating: false,
          unavailable: false,
          entryId: entry.id,
        },
        body = json(actor);
      db.prepare('INSERT INTO world_actor VALUES(?,?,1,?,?)').run(cam, id, body, hash(body));
      g.actors.push(actor);
    }
  }
}

export function captureVisitDetails(
  db: any,
  cam: string,
  planId: string,
  visitId: string,
  sceneId: string,
  adoptionId: string,
  locationId: string | null,
) {
  const d = detail(db, cam, planId, visitId),
    plan = readPlan(db, cam, planId);
  captureVisitBinding(
    db,
    cam,
    adoptionId,
    sceneId,
    plan.name,
    d,
    plan.scenes.find((s) => s.id === visitId)?.title ?? 'Besuch',
  );
  writeSceneReadAloud(db, cam, sceneId, d.readAloud);
  for (const id of d.groupIds) {
    let g = readPreparedGroup(db, cam, id);
    if (!g.locationId) {
      const existing = db
        .prepare(
          'SELECT world_group_id FROM prepared_group_origin WHERE campaign_id=? AND source_group_id=?',
        )
        .get(cam, g.id);
      if (existing) g = readPreparedGroup(db, cam, existing.world_group_id);
      else {
        const sourceId = g.id;
        // Copy the author's prepared content, not the earlier encounter template.
        g = { ...g, id: randomUUID(), revision: 1, locationId, actors: [] };
        materialize(db, cam, g);
        saveGroup(db, cam, g, null, null);
        db.prepare('INSERT INTO prepared_group_origin VALUES(?,?,?)').run(cam, sourceId, g.id);
      }
    }
    db.prepare('INSERT INTO scene_prepared_group VALUES(?,?,?)').run(cam, adoptionId, g.id);
  }
}

export function writeSceneReadAloud(db: any, cam: string, sceneId: string, text: string) {
  if (typeof text !== 'string' || text.length > 2000000) throw new Error('Ungültiger Vorlesetext.');
  const payload = json({ readAloud: text });
  db.prepare(
    'INSERT INTO live_scene_extra VALUES(?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, sceneId, payload, hash(payload));
}
