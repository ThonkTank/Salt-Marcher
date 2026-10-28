import { checkedRow, type SqliteDatabase } from './sqlite-connection';
import { validateAtlasShapeSources } from './atlas-shape-source';
import { validateTerrainEnvironment } from './terrain-environment';
import { validateTravelHistory } from './travel-history';
import { journeyRow, weatherOverride } from './world-state';
import {
  checkedPositionRow,
  checkedWorldReceipt,
  checkedWorldRecord,
  checkedWorldHistoryRow,
} from './world-record-read';
export function validateWorldBackup(db: SqliteDatabase) {
  validateTerrainEnvironment(db);
  validateAtlasShapeSources(db);
  validateTravelHistory(db);
  for (const row of db.prepare('SELECT * FROM world_journey').iterate()) journeyRow(row);
  for (const row of db.prepare('SELECT * FROM world_record').iterate()) {
    const { kind } = checkedRow(row, { kind: 'text' });
    // These projection/environment records have already been checked by their owners above.
    if (['terrain-environment', 'atlas-shape-source', 'atlas-geometry-source'].includes(kind))
      continue;
    if (kind === 'weather-override') weatherOverride(row);
    else checkedWorldRecord(row);
  }
  for (const row of db.prepare('SELECT * FROM scene_position').iterate()) checkedPositionRow(row);
  for (const row of db.prepare('SELECT * FROM world_history').iterate())
    checkedWorldHistoryRow(row);
  for (const row of db.prepare('SELECT * FROM world_receipt').iterate())
    checkedWorldReceipt(db, row);
}
