export { validateLiveBackup } from './live-validation';
export { liveStatus, executeLive } from './live-commands';
export { consumeSceneTime, applyLiveCommand } from './live-command-flow';

export {
  readRoster,
  readCampaignTime,
  readLiveScene,
  readLive,
  readArchives,
  readArchivedRoster,
} from './live-read';

export function installLiveSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS roster_state(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), revision INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS campaign_time(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), epoch_id TEXT NOT NULL, instant_ms TEXT NOT NULL) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS campaign_time_epoch ON campaign_time(campaign_id,epoch_id);
    CREATE TABLE IF NOT EXISTS live_scene(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL, location_id TEXT, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS live_moment_draft(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS scene_clock(campaign_id TEXT NOT NULL, scene_id TEXT NOT NULL, revision INTEGER NOT NULL, epoch_id TEXT NOT NULL, instant_ms TEXT NOT NULL, PRIMARY KEY(campaign_id,scene_id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id), FOREIGN KEY(campaign_id,epoch_id) REFERENCES campaign_time(campaign_id,epoch_id)) STRICT;
    CREATE TABLE IF NOT EXISTS live_state(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), primary_id TEXT NOT NULL, focus_id TEXT NOT NULL, focus_revision INTEGER NOT NULL, FOREIGN KEY(campaign_id,primary_id) REFERENCES live_scene(campaign_id,id), FOREIGN KEY(campaign_id,focus_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS roster_member(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, ordinal INTEGER NOT NULL, active INTEGER NOT NULL CHECK(active IN(0,1)), membership_revision INTEGER NOT NULL, scene_id TEXT, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS character_profile(campaign_id TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,id) REFERENCES roster_member(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS scene_adoption(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scene_id TEXT NOT NULL, ordinal INTEGER NOT NULL, plan_id TEXT NOT NULL, plan_revision INTEGER NOT NULL, visit_id TEXT NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL, location_id TEXT, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS live_receipt(command_id TEXT PRIMARY KEY REFERENCES receipt(command_id), payload TEXT NOT NULL, checksum TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS scene_lifecycle(campaign_id TEXT NOT NULL, id TEXT NOT NULL, membership_revision INTEGER NOT NULL, retired INTEGER NOT NULL CHECK(retired IN(0,1)), PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,id) REFERENCES live_scene(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS scene_time_step(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scene_id TEXT NOT NULL, command_id TEXT NOT NULL REFERENCES receipt(command_id) DEFERRABLE INITIALLY DEFERRED, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id), UNIQUE(campaign_id,scene_id,ordinal)) STRICT;`);
}

export function ensureLiveOwners(db: any, campaignId: string) {
  db.prepare('INSERT OR IGNORE INTO roster_state VALUES(?,0)').run(campaignId);
  db.prepare("INSERT OR IGNORE INTO campaign_time VALUES(?,?,'0')").run(campaignId, campaignId);
}

export { readCharacter } from './live-read';
