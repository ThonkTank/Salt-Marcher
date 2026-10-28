import { checkedQuery, type SqliteDatabase } from './sqlite-connection';
import { checkedWorldReceipt } from './world-record-read';
import { installTravelHistory } from './travel-history';
import { installAtlasMemory } from './atlas-knowledge';
import { canonicalJson } from '../campaign/generation/canonical-json';
import type { WorldCommand } from '../runtime/world-contracts';
import { hash } from './world-calendar-read';
import { json } from './world-state';
export { position, inheritScenePosition, readAtlasScene } from './scene-position';
export { readWorld, savePosition, readSceneWorld, syncSceneWorld } from './world-state';
export {
  travelEnvironmentBasis,
  previewTravel,
  type WorldTimePort,
  executeWorld,
} from './world-commands';
export { validateWorldBackup } from './world-validation';
export { storedExecuteWorld } from './world-command-flow';

export { readWorldCalendar } from './world-calendar-read';

export function installWorldSchema(db: SqliteDatabase) {
  db.exec(`CREATE TABLE IF NOT EXISTS world_record(campaign_id TEXT NOT NULL REFERENCES campaign(id),kind TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_place(campaign_id TEXT NOT NULL,location_id TEXT NOT NULL,map_id TEXT NOT NULL,revision INTEGER NOT NULL,q INTEGER NOT NULL,r INTEGER NOT NULL,PRIMARY KEY(campaign_id,location_id),FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS scene_position(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS world_journey(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_knowledge(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,map_id TEXT NOT NULL,q INTEGER NOT NULL,r INTEGER NOT NULL,PRIMARY KEY(campaign_id,character_id,map_id,q,r),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS world_history(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,scene_id TEXT,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS world_notice(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,id TEXT NOT NULL,text TEXT NOT NULL,active INTEGER NOT NULL,dismissed INTEGER NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS world_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
  installAtlasMemory(db);
  installTravelHistory(db);
}

/** Read-only acknowledgement lookup; never retries a world effect. */
export function reconcileWorld(db: SqliteDatabase, c: WorldCommand) {
  if (!c || typeof c.commandId !== 'string' || !c.commandId)
    throw new Error('Weltänderungskennung fehlt.');
  const receipt = checkedQuery(db, 'SELECT * FROM world_receipt WHERE command_id=?', {
    command_id: 'text',
    campaign_id: 'text',
    fingerprint: 'text',
    payload: 'text',
    checksum: 'text',
  }).get(c.commandId);
  if (!receipt) return { outcome: 'not-applied' as const, ack: null };
  const fingerprint = hash(json({ campaignId: c.campaignId, action: c.action }));
  if (receipt.campaign_id !== c.campaignId || receipt.fingerprint !== fingerprint)
    throw new Error('Weltänderungskennung anders verwendet.');
  const ack = checkedWorldReceipt(db, receipt);
  const w = ack.world;
  if (
    !w ||
    !w.calendar ||
    !Array.isArray(w.maps) ||
    !Array.isArray(w.events) ||
    !Array.isArray(w.phenomena) ||
    !Array.isArray(w.places) ||
    (ack.scene !== null && (!ack.scene || !ack.scene.scene))
  )
    throw new Error('Weltbestätigung hat ein ungültiges Format. Originalbytes bleiben erhalten.');
  const a = c.action;
  let expected: unknown, actual: unknown;
  if (a.kind === 'map') {
    expected = { ...a.map, revision: (a.expectedRevision ?? 0) + 1 };
    actual = w.maps.find((m) => m?.id === a.map.id);
  } else if (a.kind === 'calendar') {
    expected = { ...a.calendar, revision: a.expectedRevision + 1 };
    actual = w.calendar;
  } else if (a.kind === 'calendar-event') {
    expected = { ...a.event, revision: (a.expectedRevision ?? 0) + 1 };
    actual = w.events.find((e) => e?.id === a.event.id);
  } else if (a.kind === 'phenomenon') {
    expected = { ...a.phenomenon, revision: (a.expectedRevision ?? 0) + 1 };
    actual = w.phenomena.find((p) => p?.id === a.phenomenon.id);
  }
  // New weather commands retain their saved override basis; old receipts stay unchanged.
  if (a.kind === 'weather-override' && a.expectedOverrideRevision !== undefined) {
    const scene = ack.scene;
    if (
      !scene ||
      scene.scene.id !== a.sceneId ||
      scene.scene.clock.revision !== a.expectedClockRevision ||
      scene.weatherOverrideRevision !== (a.expectedOverrideRevision ?? 0) + 1
    )
      throw new Error(
        'Weltbestätigung widerspricht ihrem Wetterauftrag. Originalbytes bleiben erhalten.',
      );
    if (a.weather !== null) {
      expected = { ...a.weather, source: 'GM-Override' };
      actual = scene.weather;
    } else if (scene.weather?.source === 'GM-Override')
      throw new Error(
        'Weltbestätigung widerspricht der Wetterfreigabe. Originalbytes bleiben erhalten.',
      );
  }
  if (expected && (!actual || canonicalJson(actual) !== canonicalJson(expected)))
    throw new Error(
      'Weltbestätigung widerspricht ihrem gespeicherten Auftrag. Originalbytes bleiben erhalten.',
    );
  return { outcome: 'applied' as const, ack };
}
