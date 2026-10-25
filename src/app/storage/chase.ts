import { installChaseDraftSchema, readChaseDraft, advanceChaseDraft } from './chase-drafts';
import { createHash, randomUUID } from 'node:crypto';
import {
  applyChaseAction,
  checkedChase,
  checkedChaseView,
  type ChaseCommand,
  type ChaseState,
  type ChaseView,
} from '../chase-contracts';
import { recordMaskReconciliation } from './mask-reconciliation';
const json = (v: unknown) => JSON.stringify(v),
  hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installChaseSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS chase(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS chase_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
  installChaseDraftSchema(db);
}
function decoded(row: any): ChaseState {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Verfolgungsstand nicht verfügbar.');
  const s = checkedChase(JSON.parse(row.payload));
  if (
    s.id !== row.id ||
    s.sceneId !== row.scene_id ||
    s.revision !== row.revision ||
    s.status !== row.status
  )
    throw new Error('Verfolgungsstand beschädigt.');
  return s;
}
function receipt(row: any): ChaseView {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Verfolgungsbeleg ist beschädigt.');
  return checkedChaseView(JSON.parse(row.payload));
}
function save(db: any, cam: string, s: ChaseState) {
  checkedChase(s);
  const payload = json(s);
  db.prepare(
    'INSERT INTO chase VALUES(?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,status=excluded.status,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, s.id, s.sceneId, s.revision, s.status, payload, hash(payload));
}
export function readChase(db: any, cam: string, sceneId: string, id?: string): ChaseView {
  const row = id
    ? db
        .prepare('SELECT * FROM chase WHERE campaign_id=? AND id=? AND scene_id=?')
        .get(cam, id, sceneId)
    : db
        .prepare(
          "SELECT * FROM chase WHERE campaign_id=? AND scene_id=? AND status='running' ORDER BY rowid DESC LIMIT 1",
        )
        .get(cam, sceneId);
  if (id && !row) throw new Error('Verfolgung nicht gefunden.');
  const recent = db
    .prepare('SELECT * FROM chase WHERE campaign_id=? AND scene_id=? ORDER BY rowid DESC LIMIT 30')
    .all(cam, sceneId)
    .map((r: any) => {
      const s = decoded(r);
      return { id: s.id, title: s.title, status: s.status };
    });
  return checkedChaseView({
    chase: row ? decoded(row) : null,
    recent,
    draft: row ? readChaseDraft(db, cam, row.id) : null,
  });
}
export function validateChaseBackup(db: any) {
  const tables = new Set<string>(
    db
      .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
      .all()
      .map((r: any) => r.name),
  );
  if (tables.has('world_history'))
    for (const link of db
      .prepare(
        "SELECT campaign_id,scene_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.chaseId') END chase_id FROM world_history",
      )
      .iterate()) {
      if (link.chase_id === null) continue;
      if (
        !tables.has('chase') ||
        typeof link.chase_id !== 'string' ||
        !db
          .prepare('SELECT 1 FROM chase WHERE campaign_id=? AND id=? AND scene_id=?')
          .get(link.campaign_id, link.chase_id, link.scene_id)
      )
        throw new Error('Verfolgungshistorie besitzt keine passende Verfolgung.');
    }
  if (!tables.has('chase')) {
    if (tables.has('chase_receipt'))
      throw new Error('Verfolgungsbelege besitzen keinen Datenspeicher.');
    return;
  }
  for (const row of db.prepare('SELECT * FROM chase').iterate()) decoded(row);
  // Schema 38 existed both before chase storage and before chase receipts were added.
  if (tables.has('chase_receipt'))
    for (const row of db.prepare('SELECT * FROM chase_receipt').iterate()) {
      const view = receipt(row);
      if (
        view.chase &&
        !db
          .prepare('SELECT 1 FROM chase WHERE campaign_id=? AND id=? AND scene_id=?')
          .get(row.campaign_id, view.chase.id, view.chase.sceneId)
      )
        throw new Error('Verfolgungsbeleg besitzt keine passende Verfolgung.');
    }
}
export function reconcileChaseParticipants(
  db: any,
  cam: string,
  characterIds: string[],
  commandId: string,
  retiredScenes: Set<string> = new Set(),
) {
  const moving = new Set(characterIds);
  for (const row of db
    .prepare("SELECT * FROM chase WHERE campaign_id=? AND status='running'")
    .all(cam)) {
    const s = decoded(row),
      removed = s.participants.filter((p) => p.characterId && moving.has(p.characterId)),
      participants = s.participants.filter((p) => !p.characterId || !moving.has(p.characterId)),
      retired = retiredScenes.has(s.sceneId);
    if (!removed.length && !retired) continue;
    const next = {
      ...s,
      revision: s.revision + 1,
      participants,
      status: retired ? ('retired' as const) : s.status,
    };
    save(db, cam, next);
    recordMaskReconciliation(db, {
      version: 1,
      commandId,
      campaignId: cam,
      ownerKind: 'chase',
      ownerId: s.id,
      sceneId: s.sceneId,
      beforeRevision: s.revision,
      afterRevision: next.revision,
      removedCharacterIds: removed.map((p) => p.characterId!),
      retired,
    });
  }
}

export function executeChase(
  db: any,
  c: ChaseCommand,
  guard: () => void,
  advanceRound: (chase: ChaseState) => void,
): ChaseView {
  return db
    .transaction(() => {
      guard();
      if (
        !c.commandId ||
        typeof c.commandId !== 'string' ||
        c.commandId.length > 1000 ||
        typeof c.sceneId !== 'string' ||
        !c.sceneId ||
        c.sceneId.length > 1000 ||
        !c.action
      )
        throw new Error('Verfolgungsauftrag fehlt.');
      const fp = hash(json({ ...c, token: undefined })),
        prior = db.prepare('SELECT * FROM chase_receipt WHERE command_id=?').get(c.commandId);
      if (prior) {
        if (prior.campaign_id !== c.campaignId || prior.fingerprint !== fp)
          throw new Error('Auftragskennung bereits anders verwendet.');
        return receipt(prior);
      }
      const a = c.action;
      let s: ChaseState;
      if (a.kind === 'create') {
        if (
          c.chaseId !== null ||
          c.expectedRevision !== null ||
          typeof a.title !== 'string' ||
          !a.title.trim() ||
          a.title.length > 1000 ||
          typeof a.goal !== 'string' ||
          a.goal.length > 4000 ||
          !db
            .prepare('SELECT 1 FROM live_scene WHERE campaign_id=? AND id=?')
            .get(c.campaignId, c.sceneId)
        )
          throw new Error('Titel, Ziel und Scene der Verfolgung prüfen.');
        s = checkedChase({
          id: randomUUID(),
          revision: 1,
          sceneId: c.sceneId,
          title: a.title,
          status: 'running',
          round: 0,
          goal: a.goal,
          complication: '',
          outcome: '',
          participants: [],
        });
      } else {
        if (typeof c.chaseId !== 'string' || !Number.isSafeInteger(c.expectedRevision))
          throw new Error('Verfolgungsstand neu laden.');
        const row = db
          .prepare('SELECT * FROM chase WHERE campaign_id=? AND id=? AND scene_id=?')
          .get(c.campaignId, c.chaseId, c.sceneId);
        s = decoded(row);
        if (s.revision !== c.expectedRevision) throw new Error('Verfolgung wurde geändert.');
        const before = s;
        s = applyChaseAction(s, a);
        advanceChaseDraft(db, c.campaignId, before, s, a, c.draftWriteId);
      }
      save(db, c.campaignId, s);
      if (a.kind === 'round') advanceRound(s);
      if (a.kind === 'finish') {
        const event = json({
          text: 'Verfolgung abgeschlossen: ' + s.title,
          recordedAt: new Date().toISOString(),
          facts: { chaseId: s.id, outcome: s.outcome, rounds: s.round },
        });
        db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
          c.campaignId,
          randomUUID(),
          s.sceneId,
          event,
          hash(event),
        );
      }
      const result = readChase(db, c.campaignId, c.sceneId, s.id),
        payload = json(result);
      db.prepare('INSERT INTO chase_receipt VALUES(?,?,?,?,?)').run(
        c.commandId,
        c.campaignId,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}
