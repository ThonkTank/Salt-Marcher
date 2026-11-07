import type { SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';

export function sceneReadAloud(db: SqliteDatabase, cam: string, sceneId: string): string {
  const row = db
    .prepare('SELECT * FROM live_scene_extra WHERE campaign_id=? AND scene_id=?')
    .get(cam, sceneId);
  if (!row) return '';
  const value = decodeStored(row, shape.live_scene_extra);
  if (value.readAloud.length > 2000000) throw new Error('Vorlesetext ist zu lang.');
  return value.readAloud;
}
