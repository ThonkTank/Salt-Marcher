import { createHash, randomUUID } from 'node:crypto';
import type { SceneVisit, SceneVisitPage } from '../runtime/scene-visit-contracts';
import { readVisitOutcome } from './visit-outcome-read';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function decoded(row: any) {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Übernommener Besuch ist beschädigt.');
  return JSON.parse(row.payload);
}
export function captureVisitBinding(
  db: any,
  cam: string,
  adoptionId: string,
  sceneId: string,
  planName: string,
  detail: { noteIds: string[]; readAloud: string },
  title: string,
) {
  const payload = JSON.stringify({
    recordedAt: new Date().toISOString(),
    text: 'Besuch übernommen: ' + title,
    facts: {
      kind: 'visit-adopted',
      version: 1,
      adoptionId,
      planName,
      noteIds: detail.noteIds,
      readAloud: detail.readAloud,
    },
  });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    cam,
    randomUUID(),
    sceneId,
    payload,
    hash(payload),
  );
}
/** Legacy reads remain available without inventing the missing original preparation. */
export function readVisitBinding(
  db: any,
  cam: string,
  adoption: any,
): {
  readAloud: string;
  noteIds: string[];
  planName: string;
  captured: boolean;
  capturedAt: string | null;
  warnings: string[];
} {
  const row = db
    .prepare(
      "SELECT * FROM world_history WHERE campaign_id=? AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.kind') END='visit-adopted' AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.adoptionId') END=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(cam, adoption.id);
  if (row) {
    const p = decoded(row),
      f = p.facts;
    if (
      f.version !== 1 ||
      row.scene_id !== adoption.scene_id ||
      typeof f.planName !== 'string' ||
      typeof f.readAloud !== 'string' ||
      f.readAloud.length > 2000000 ||
      !Array.isArray(f.noteIds) ||
      f.noteIds.length > 1000 ||
      new Set(f.noteIds).size !== f.noteIds.length ||
      f.noteIds.some((id: any) => typeof id !== 'string' || !id) ||
      typeof p.recordedAt !== 'string'
    )
      throw new Error('Übernommene Besuchsbindung ist ungültig.');
    return {
      readAloud: f.readAloud,
      noteIds: f.noteIds,
      planName: f.planName,
      captured: true,
      capturedAt: p.recordedAt,
      warnings: [],
    };
  }
  const source = db
      .prepare('SELECT * FROM session_visit WHERE campaign_id=? AND plan_id=? AND id=?')
      .get(cam, adoption.plan_id, adoption.visit_id),
    plan = db
      .prepare('SELECT name FROM plan WHERE campaign_id=? AND id=?')
      .get(cam, adoption.plan_id),
    detail = source ? decoded(source) : null;
  return {
    readAloud: detail?.readAloud ?? '',
    noteIds: detail?.noteIds ?? [],
    planName: plan?.name ?? 'Früherer Spielabendplan',
    captured: false,
    capturedAt: null,
    warnings: [
      'Ältere Übernahme ohne festgehaltenen Vorlesetext und Notizbindung.' +
        (detail
          ? ' Ergänzende Inhalte stammen aus der noch vorhandenen Vorbereitung.'
          : ' Die frühere Vorbereitung ist nicht mehr vorhanden; erhaltene Scene-Texte, Gruppen und Ergebnisse bleiben verfügbar.'),
    ],
  };
}
export function readSceneVisits(
  db: any,
  cam: string,
  sceneId: string,
  after: string | null,
): SceneVisitPage {
  return db.transaction(() => {
    if (
      after !== null &&
      (typeof after !== 'string' ||
        !/^\d{1,15}$/.test(after) ||
        !Number.isSafeInteger(Number(after)))
    )
      throw new Error('Besuchscursor ist ungültig.');
    const scene = db
      .prepare('SELECT title FROM live_scene WHERE campaign_id=? AND id=?')
      .get(cam, sceneId);
    if (!scene) throw new Error('Gruppe nicht verfügbar.');
    const current = db
      .prepare(
        'SELECT id FROM scene_adoption WHERE campaign_id=? AND scene_id=? ORDER BY ordinal DESC LIMIT 1',
      )
      .get(cam, sceneId)?.id;
    const rows = db
      .prepare(
        'SELECT * FROM scene_adoption WHERE campaign_id=? AND scene_id=? AND (? IS NULL OR ordinal<?) ORDER BY ordinal DESC LIMIT 26',
      )
      .all(cam, sceneId, after, after === null ? null : Number(after));
    const items: SceneVisit[] = rows.slice(0, 25).map((a: any) => {
      const binding = readVisitBinding(db, cam, a),
        warnings = [...binding.warnings],
        plan = db
          .prepare('SELECT revision FROM plan WHERE campaign_id=? AND id=?')
          .get(cam, a.plan_id),
        visit = db
          .prepare('SELECT 1 FROM planned_visit WHERE campaign_id=? AND plan_id=? AND id=?')
          .get(cam, a.plan_id, a.visit_id);
      if (!visit) warnings.push('Dieser Besuch steht nicht mehr in der aktuellen Timeline.');
      else if (plan.revision !== a.plan_revision)
        warnings.push('Die aktuelle Timeline wurde seit der Übernahme geändert.');
      const place = a.location_id
        ? db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?').get(cam, a.location_id)
        : null;
      if (!binding.captured && a.id === current && !binding.readAloud) {
        const extra = db
          .prepare(
            'SELECT payload,checksum FROM live_scene_extra WHERE campaign_id=? AND scene_id=?',
          )
          .get(cam, sceneId);
        if (extra) {
          binding.readAloud = decoded(extra).readAloud;
          if (binding.readAloud)
            warnings.push(
              'Vorlesetext aus dem aktuellen Scene-Stand; die ursprüngliche Übernahme ist nicht festgehalten.',
            );
        }
      }
      const references = binding.noteIds.map((id) => {
        const row = db
            .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
            .get(cam, id),
          n = row ? decoded(row) : null;
        return {
          id,
          title: n?.title ?? 'Nicht verfügbarer Weltverweis',
          kind: n?.kind ?? '',
          available: !!row && !row.trashed,
        };
      });
      const groups = db
        .prepare(
          'SELECT g.id,g.payload,g.checksum FROM scene_prepared_group s JOIN prepared_group g ON g.campaign_id=s.campaign_id AND g.id=s.group_id WHERE s.campaign_id=? AND s.adoption_id=?',
        )
        .all(cam, a.id)
        .map((row: any) => ({ id: row.id, title: decoded(row).title, available: true }));
      return {
        adoptionId: a.id,
        ordinal: a.ordinal,
        sceneId: a.scene_id,
        planId: a.plan_id,
        planName: binding.planName,
        planRevision: a.plan_revision,
        visitId: a.visit_id,
        title: a.title,
        notes: a.notes,
        readAloud: binding.readAloud,
        locationId: a.location_id,
        location: place && !place.trashed ? decoded(place).name : null,
        capturedAt: binding.capturedAt,
        captured: binding.captured,
        current: a.id === current,
        outcome: readVisitOutcome(db, cam, a.id),
        references,
        groups,
        warnings,
      };
    });
    return {
      sceneId,
      sceneTitle: scene.title,
      items,
      next: rows.length > 25 ? String(rows[24].ordinal) : null,
    };
  })();
}
