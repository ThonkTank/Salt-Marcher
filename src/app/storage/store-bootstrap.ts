import { checkedRow } from './sqlite-connection';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import DATA_FORMAT from '../data-format.json';
import { installLandscape } from './atlas-landscape';
import { installAtlasShapeSource } from './atlas-shape-source';
import { installSourceCellIndex } from './atlas-source-cell';
import { installTerritories } from './atlas-territories';
import { installAtlasTravel } from './atlas-travel';
import { installAutonomySchema } from './autonomy';
import { installAutonomyDungeonSchema } from './autonomy-dungeon';
import { installAutonomyResources } from './autonomy-resources';
import { installCampaignAtlas } from './campaign-atlas';
import { installCampaignSchema } from './campaign-data';
import { installChaseSchema } from './chase';
import { installCitySchema } from './city';
import { installCombatSchema } from './combat';
import { installCombatDraftSchema } from './combat-drafts';
import { installContentRuntime } from './content-runtime';
import { installDrawingSchema } from './drawing';
import { installDungeonKey } from './dungeon-key';
import { installDungeonPlaySchema } from './dungeon-play';
import { installDungeonSenses } from './dungeon-senses';
import { installEncounterSchema } from './encounters';
import { installFinishDrafts } from './finish-drafts';
import { installGenerationSchema } from './generation';
import { installGraph } from './graph';
import { installGroups } from './groups';
import { installItemsSchema } from './items';
import { installLiveSchema } from './live';
import { installMaskHistoryIndexes } from './mask-history';
import { installMaskReconciliationSchema } from './mask-reconciliation';
import { installMusicSchema } from './music';
import { installNarrative } from './narrative';
import { installNpcDungeonSchema } from './npc-dungeon';
import { installNpcRecords } from './npc-record';
import { installNpcWorldSchema } from './npc-world';
import { installPathSchema } from './paths';
import { installPlayerSchema } from './player';
import { installProgressSchema } from './progression';
import { installRoomGroups } from './room-groups';
import { installRuleReferenceSchema } from './rule-references';
import { installSceneCheckSchema } from './scene-checks';
import { installSceneDesk } from './scene-desk';
import { installSessionSchema } from './session';
import { installTravelHistory } from './travel-history';
import { installTreasury } from './treasury';
import { installTriggers } from './triggers';
import { installVolumeSchema } from './volume';
import { installWorldSchema } from './world';
import { installWorldRelationPairs } from './world-relation-pair';

/** Opens the sole canonical connection; its lifetime belongs to CampaignStore. */
export function openStoreDatabase(filename: string, applicationVersion: string) {
  if (
    typeof applicationVersion !== 'string' ||
    !applicationVersion.trim() ||
    applicationVersion.length > 128
  )
    throw new Error('Anwendungsversion fehlt.');
  mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  try {
    const schema = db.pragma('user_version', { simple: true });
    if (
      (schema !== 0 && schema !== DATA_FORMAT.schema) ||
      (schema === 0 &&
        db.prepare("SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' LIMIT 1").get())
    ) {
      throw new Error(
        'Nicht unterstütztes Testdatenformat. Eine neue Kampagne im aktuellen Format anlegen. Originaldatei bleibt erhalten.',
      );
    }
    if (schema === DATA_FORMAT.schema) {
      const findTable = db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?");
      for (const table of DATA_FORMAT.tables) {
        if (!findTable.get(table)) {
          const message: Record<string, string> = {
            travel_checkpoint: 'Reisecheckpoint-Speicher fehlt.',
            room_group: 'Raumgruppenspeicher fehlt.',
            scene_opponent_group: 'Szenengegner-Zuordnung fehlt.',
            atlas_territory: 'Regionsspeicher fehlt.',
            atlas_territory_layer: 'Regionsspeicher fehlt.',
            chase_working_draft: 'Verfolgungsentwurfsspeicher fehlt.',
          };
          throw new Error(message[table] ?? 'Kampagnenspeicher ist unvollständig: ' + table);
        }
      }
    }
    const version = checkedRow(db.prepare('SELECT sqlite_version() v').get(), { v: 'text' }).v;
    if (version.localeCompare('3.53.4', undefined, { numeric: true }) < 0) {
      throw new Error('SQLite-Wartungsstand zu alt.');
    }
    db.pragma('foreign_keys=ON');
    db.pragma('journal_mode=WAL');
    db.pragma('synchronous=FULL');
    db.pragma('secure_delete=ON');
    db.pragma('busy_timeout=5000');

    db.transaction(() => {
      if (schema === 0) {
        db.exec(`
      CREATE TABLE IF NOT EXISTS campaign(id TEXT PRIMARY KEY, name TEXT NOT NULL, selected_id TEXT, cursor INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0) STRICT;
      CREATE TABLE IF NOT EXISTS scope(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS room(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scope_id TEXT NOT NULL, number TEXT NOT NULL, name TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, floor_id TEXT NOT NULL DEFAULT 'ground', PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS history(campaign_id TEXT NOT NULL REFERENCES campaign(id), ordinal INTEGER NOT NULL, room_id TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, guard_revision INTEGER NOT NULL, PRIMARY KEY(campaign_id,ordinal)) STRICT;
      CREATE TABLE IF NOT EXISTS receipt(command_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, campaign_id TEXT NOT NULL REFERENCES campaign(id), room_id TEXT NOT NULL, revision INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS source(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), bytes BLOB NOT NULL, checksum TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    `);
        db.exec(`
      CREATE TABLE IF NOT EXISTS world_note(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, trashed INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS plan(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS planned_visit(campaign_id TEXT NOT NULL, plan_id TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,plan_id) REFERENCES plan(campaign_id,id)) STRICT;
      CREATE VIRTUAL TABLE IF NOT EXISTS note_search USING fts5(campaign_id UNINDEXED, note_id UNINDEXED, title, body);
      INSERT INTO note_search(note_search,rank) VALUES('secure-delete',1);
    `);
        db.exec(
          'CREATE TABLE IF NOT EXISTS drawing_floor(campaign_id TEXT NOT NULL, scope_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, source_elevation REAL NOT NULL, PRIMARY KEY(campaign_id,scope_id,id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;',
        );
        db.exec(
          'CREATE TABLE IF NOT EXISTS room_draft(campaign_id TEXT NOT NULL, room_id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,room_id), FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;',
        );
        db.exec(`CREATE TABLE IF NOT EXISTS location(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, trashed INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
        CREATE TABLE IF NOT EXISTS location_map(campaign_id TEXT NOT NULL, scope_id TEXT NOT NULL, location_id TEXT NOT NULL, PRIMARY KEY(campaign_id,scope_id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id), FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;`);
        installLiveSchema(db);
        installCombatSchema(db);
        installCombatDraftSchema(db);
        installChaseSchema(db);
        installMaskHistoryIndexes(db);
        installMaskReconciliationSchema(db);
        installRuleReferenceSchema(db);
        installSceneCheckSchema(db);
        installProgressSchema(db);
        installEncounterSchema(db);
        installGenerationSchema(db);
        installNpcRecords(db);
        db.exec(
          "CREATE TABLE IF NOT EXISTS preparation_draft(campaign_id TEXT NOT NULL REFERENCES campaign(id), kind TEXT NOT NULL CHECK(kind IN ('note','plan','location')), target_id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,kind,target_id)) STRICT;",
        );
        installSessionSchema(db);
        installItemsSchema(db);
        installWorldSchema(db);
        installMusicSchema(db);
        installCampaignSchema(db);
        installCitySchema(db);
        installPlayerSchema(db);
        installNpcWorldSchema(db);
        installAutonomySchema(db);
        installDrawingSchema(db);
        installDungeonPlaySchema(db);
        installNpcDungeonSchema(db);
        installAutonomyDungeonSchema(db);
        installAutonomyResources(db);
        installDungeonSenses(db);
        installVolumeSchema(db);
        installPathSchema(db);
        installDungeonKey(db);
        installGraph(db);
        installTriggers(db);
        installContentRuntime(db);
        installNarrative(db);
        installFinishDrafts(db);
        installSceneDesk(db);
        installTreasury(db);
        installGroups(db);
        installWorldRelationPairs(db);
        installCampaignAtlas(db);
        installAtlasTravel(db);
        installLandscape(db);
        installTerritories(db);
        installRoomGroups(db);
        installTravelHistory(db);
        db.pragma('user_version=' + DATA_FORMAT.schema);
      }
      installSourceCellIndex(db);
      installAtlasShapeSource(db);
    }).immediate();
    db.function('atlas_lower', { deterministic: true }, (text: unknown) =>
      typeof text === 'string' ? text.normalize('NFC').toLocaleLowerCase('de') : '',
    );
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
