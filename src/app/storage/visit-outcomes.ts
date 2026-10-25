import { createHash } from 'node:crypto';
import type { SessionProgress, VisitOutcome } from '../visit-outcome-contracts';
import { readPlan } from './session';
export function readVisitOutcome(db: any, cam: string, adoptionId: string): VisitOutcome | null {
  const row = db
    .prepare(
      "SELECT payload,checksum FROM world_history WHERE campaign_id=? AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.kind') END='visit-outcome' AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.adoptionId') END=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(cam, adoptionId);
  if (!row) return null;
  if (createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Besuchsergebnis ist beschädigt.');
  const p = JSON.parse(row.payload);
  if (
    !['open', 'completed', 'skipped'].includes(p.facts.status) ||
    typeof p.facts.outcome !== 'string' ||
    typeof p.recordedAt !== 'string'
  )
    throw new Error('Besuchsergebnis ist ungültig.');
  return { status: p.facts.status, text: p.facts.outcome, recordedAt: p.recordedAt };
}
export function readSessionProgress(
  db: any,
  cam: string,
  planId: string,
  sceneId?: string,
): SessionProgress {
  return db.transaction(() => {
    const plan = readPlan(db, cam, planId);
    const focused = (visitId: string) => {
      if (!sceneId) return undefined;
      const a = db
        .prepare(
          'SELECT a.id AS adoptionId,a.scene_id AS sceneId,s.title AS sceneTitle FROM scene_adoption a JOIN live_scene s ON s.campaign_id=a.campaign_id AND s.id=a.scene_id WHERE a.campaign_id=? AND a.plan_id=? AND a.visit_id=? AND a.scene_id=? ORDER BY a.rowid DESC LIMIT 1',
        )
        .get(cam, planId, visitId, sceneId);
      return a ? { ...a, outcome: readVisitOutcome(db, cam, a.adoptionId) } : null;
    };
    return {
      planId,
      planRevision: plan.revision,
      visits: plan.scenes.map((v) => ({
        id: v.id,
        title: v.title || 'Unbenannter Besuch',
        focused: focused(v.id),
        count: db
          .prepare(
            'SELECT count(*) n FROM scene_adoption WHERE campaign_id=? AND plan_id=? AND visit_id=?',
          )
          .get(cam, planId, v.id).n,
        occurrences: db
          .prepare(
            'SELECT a.id AS adoptionId,a.scene_id AS sceneId,s.title AS sceneTitle FROM scene_adoption a JOIN live_scene s ON s.campaign_id=a.campaign_id AND s.id=a.scene_id WHERE a.campaign_id=? AND a.plan_id=? AND a.visit_id=? ORDER BY a.rowid DESC LIMIT 5',
          )
          .all(cam, planId, v.id)
          .map((a: any) => ({ ...a, outcome: readVisitOutcome(db, cam, a.adoptionId) })),
      })),
    };
  })();
}
