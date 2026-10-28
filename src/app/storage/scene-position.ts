import type { LiveScene } from '../runtime/live-contracts';
import type { ScenePosition, SceneWorld } from '../runtime/world-contracts';
import { readLiveScene } from './live-read';
import { scenePosition, savePosition, journeyRow } from './world-state';
export function position(db: any, cam: string, sceneId: string): ScenePosition {
  return scenePosition(db, cam, readLiveScene(db, cam, sceneId));
}

export function inheritScenePosition(db: any, cam: string, source: LiveScene, target: LiveScene) {
  const p = scenePosition(db, cam, source);
  savePosition(db, cam, target.id, { ...p, locationId: target.locationId, revision: 1 });
}

/** Atlas display context: no map catalog, events, knowledge set or historical prose. */
export function readAtlasScene(
  db: any,
  cam: string,
  id: string,
): Pick<SceneWorld, 'scene' | 'position' | 'journey'> {
  const row = db
    .prepare(
      'SELECT * FROM world_journey WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 1',
    )
    .get(cam, id);
  const scene = readLiveScene(db, cam, id);
  return { scene, position: scenePosition(db, cam, scene), journey: row ? journeyRow(row) : null };
}
