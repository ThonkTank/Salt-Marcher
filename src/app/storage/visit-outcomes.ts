import type { SessionProgress } from '../runtime/visit-outcome-contracts';
import { readPlan } from './session-read';
import { readVisitOutcome } from './visit-outcome-read';
export { readVisitOutcome } from './visit-outcome-read';
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
