import { createHash } from 'node:crypto';
import { worldNoteDocument, type WorldNoteV1 } from '../../features/world/world-notes';
import { readLiveScene } from './live-read';
import type {
  SceneRuleCommand,
  SceneRulePin,
  SceneRules,
} from '../catalog/rule-reference-contracts';

const json = (value: unknown) => JSON.stringify(value),
  hash = (text: string) => createHash('sha256').update(text).digest('hex');
const fingerprint = (command: SceneRuleCommand) => hash(json({ ...command, token: undefined }));
type StoredPin = Pick<
  SceneRulePin,
  'noteId' | 'sourceRevision' | 'title' | 'readAloud' | 'gmNotes'
>;

export function installRuleReferenceSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS scene_rule_state(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id));
 CREATE TABLE IF NOT EXISTS scene_rule_pin(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,note_id TEXT NOT NULL,ordinal INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id,note_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id));
 CREATE TABLE IF NOT EXISTS scene_rule_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL);`);
}
function checkedSource(row: any, id: string): WorldNoteV1 {
  if (!row || row.trashed || hash(row.payload) !== row.checksum)
    throw new Error('Regelreferenz fehlt oder liegt im Papierkorb.');
  const note = worldNoteDocument(JSON.parse(row.payload));
  if (note.id !== id || note.revision !== row.revision)
    throw new Error('Regelquelle hat eine widersprüchliche Identität oder Revision.');
  if (note.kind !== 'rule')
    throw new Error('Nur Regelreferenzen können an eine Scene geheftet werden.');
  return note;
}
function source(db: any, cam: string, id: string): WorldNoteV1 {
  return checkedSource(
    db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id),
    id,
  );
}
function stored(row: any): StoredPin {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Angeheftete Regelreferenz ist beschädigt.');
  const pin = JSON.parse(row.payload);
  if (
    !pin ||
    pin.noteId !== row.note_id ||
    !Number.isSafeInteger(pin.sourceRevision) ||
    pin.sourceRevision < 1 ||
    ![pin.title, pin.readAloud, pin.gmNotes].every((v: unknown) => typeof v === 'string')
  )
    throw new Error('Angeheftete Regelreferenz hat ein unbekanntes Format.');
  return pin;
}
function snapshot(note: WorldNoteV1): StoredPin {
  return {
    noteId: note.id,
    sourceRevision: note.revision,
    title: note.title,
    readAloud: note.readAloud,
    gmNotes: note.gmNotes,
  };
}
export function readSceneRules(db: any, cam: string, sceneId: string): SceneRules {
  readLiveScene(db, cam, sceneId);
  const revision =
    db
      .prepare('SELECT revision FROM scene_rule_state WHERE campaign_id=? AND scene_id=?')
      .get(cam, sceneId)?.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('Regelreferenz-Revision ist ungültig.');
  // Missing or damaged current sources must not remove their frozen pins.
  const pins: SceneRulePin[] = [];
  // Do not collect a second array containing all current source texts.
  for (const row of db
    .prepare(
      `SELECT p.*,n.payload AS source_payload,n.checksum AS source_checksum,n.trashed AS source_trashed,n.revision AS source_revision
  FROM scene_rule_pin p LEFT JOIN world_note n ON n.campaign_id=p.campaign_id AND n.id=p.note_id
  WHERE p.campaign_id=? AND p.scene_id=? ORDER BY p.ordinal,p.note_id`,
    )
    .iterate(cam, sceneId)) {
    const pin = stored(row);
    let currentRevision: number | null = null,
      unavailable = true;
    try {
      const note = checkedSource(
        {
          payload: row.source_payload,
          checksum: row.source_checksum,
          trashed: row.source_trashed,
          revision: row.source_revision,
        },
        pin.noteId,
      );
      currentRevision = note.revision;
      unavailable = false;
    } catch {
      /* An invalid current source cannot invalidate the separately checked frozen pin. */
    }
    pins.push({
      ...pin,
      currentRevision,
      unavailable,
      stale: unavailable || currentRevision !== pin.sourceRevision,
    });
  }
  return { sceneId, revision, pins };
}
export function executeSceneRule(
  db: any,
  command: SceneRuleCommand,
  guard: () => void,
): SceneRules {
  return db
    .transaction(() => {
      const a = command?.action;
      if (
        !command ||
        ![command.commandId, command.campaignId, command.token, command.sceneId].every(
          (value) => typeof value === 'string' && !!value && value.length <= 1000,
        ) ||
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision < 0 ||
        !a ||
        !['pin', 'refresh', 'unpin'].includes(a.kind) ||
        typeof a.noteId !== 'string' ||
        !a.noteId ||
        a.noteId.length > 1000 ||
        (a.kind !== 'unpin' &&
          a.expectedSourceRevision !== undefined &&
          (!Number.isSafeInteger(a.expectedSourceRevision) || a.expectedSourceRevision < 1))
      )
        throw new Error('Ungültiger Regelreferenz-Auftrag.');
      guard();
      const fp = fingerprint(command),
        prior = db
          .prepare('SELECT * FROM scene_rule_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (
          prior.campaign_id !== command.campaignId ||
          prior.fingerprint !== fp ||
          hash(prior.payload) !== prior.checksum
        )
          throw new Error('Regelreferenz-Auftrag ist nicht verlässlich wiederholbar.');
        return JSON.parse(prior.payload);
      }
      const current = readSceneRules(db, command.campaignId, command.sceneId);
      if (current.revision !== command.expectedRevision)
        throw new Error('Regelreferenzen dieser Scene wurden geändert.');
      db.prepare('INSERT OR IGNORE INTO scene_rule_state VALUES(?,?,0)').run(
        command.campaignId,
        command.sceneId,
      );
      const existing = current.pins.find((p) => p.noteId === a.noteId);
      if (a.kind === 'unpin') {
        if (!existing) throw new Error('Regelreferenz ist nicht angeheftet.');
        db.prepare(
          'DELETE FROM scene_rule_pin WHERE campaign_id=? AND scene_id=? AND note_id=?',
        ).run(command.campaignId, command.sceneId, a.noteId);
      } else {
        const pin = snapshot(source(db, command.campaignId, a.noteId));
        if (
          a.expectedSourceRevision !== undefined &&
          pin.sourceRevision !== a.expectedSourceRevision
        )
          throw new Error('Regelquelle geändert. Erneut lesen und ausdrücklich anheften.');
        if (a.kind === 'pin' && existing) throw new Error('Regelreferenz ist bereits angeheftet.');
        if (a.kind === 'refresh' && !existing)
          throw new Error('Regelreferenz ist nicht angeheftet.');
        const payload = json(pin),
          ordinal = existing
            ? db
                .prepare(
                  'SELECT ordinal FROM scene_rule_pin WHERE campaign_id=? AND scene_id=? AND note_id=?',
                )
                .get(command.campaignId, command.sceneId, a.noteId).ordinal
            : db
                .prepare(
                  'SELECT coalesce(max(ordinal),-1)+1 n FROM scene_rule_pin WHERE campaign_id=? AND scene_id=?',
                )
                .get(command.campaignId, command.sceneId).n;
        if (!existing && current.pins.length >= 50)
          throw new Error('Eine Scene kann höchstens 50 Regelreferenzen anheften.');
        db.prepare(
          'INSERT INTO scene_rule_pin VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,scene_id,note_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
        ).run(command.campaignId, command.sceneId, a.noteId, ordinal, payload, hash(payload));
      }
      db.prepare(
        'UPDATE scene_rule_state SET revision=revision+1 WHERE campaign_id=? AND scene_id=?',
      ).run(command.campaignId, command.sceneId);
      const result = readSceneRules(db, command.campaignId, command.sceneId),
        payload = json(result);
      db.prepare('INSERT INTO scene_rule_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        command.campaignId,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}
export function validateRuleReferences(db: any) {
  if (
    !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='scene_rule_state'").get()
  )
    return;
  for (const row of db.prepare('SELECT campaign_id,scene_id FROM scene_rule_state').all())
    readSceneRules(db, row.campaign_id, row.scene_id);
  for (const row of db.prepare('SELECT * FROM scene_rule_receipt').iterate())
    if (hash(row.payload) !== row.checksum)
      throw new Error('Regelreferenz-Receipt ist beschädigt.');
}
