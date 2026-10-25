import { createHash } from 'node:crypto';
import type { FinishOwner, FinishDraft } from '../finish-draft-contracts';
import { readNarrative } from './narrative';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installFinishDrafts(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS finish_draft(campaign_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('combat','narrative')),target_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,target_id),FOREIGN KEY(campaign_id) REFERENCES campaign(id)) STRICT;`,
  );
}
function checkedOwner(o: FinishOwner) {
  if (
    !o ||
    !['combat', 'narrative'].includes(o.kind) ||
    typeof o.targetId !== 'string' ||
    !o.targetId ||
    o.targetId.length > 1000 ||
    !Number.isSafeInteger(o.revision) ||
    o.revision < 0 ||
    (o.noteRevision !== undefined && (!Number.isSafeInteger(o.noteRevision) || o.noteRevision < 1))
  )
    throw new Error('Abschlussziel ungültig.');
}
function currentOwner(db: any, cam: string, o: FinishOwner, retained = false) {
  checkedOwner(o);
  if (o.kind === 'narrative') {
    const n = readNarrative(db, cam, o.targetId, retained);
    return { revision: n.state.revision, noteRevision: n.noteRevision, closed: !!n.state.awardId };
  }
  const r = db.prepare('SELECT * FROM combat WHERE campaign_id=? AND id=?').get(cam, o.targetId);
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error('Kampf des Abschlussentwurfs nicht verfügbar.');
  const c = JSON.parse(r.payload);
  if (c.id !== r.id || c.revision !== r.revision || c.phase !== r.phase)
    throw new Error('Kampfzuordnung widersprüchlich.');
  return { revision: c.revision, closed: c.phase === 'finished' };
}
function checkedDraft(d: FinishDraft) {
  checkedOwner(d);
  const text = (v: unknown, max = 1000) => typeof v === 'string' && v.length <= max;
  const reference = (r: any) =>
    r === undefined ||
    (!!r &&
      typeof r === 'object' &&
      r.kind === 'authored' &&
      text(r.definitionId) &&
      !!r.definitionId &&
      Number.isSafeInteger(r.revision) &&
      r.revision >= 1 &&
      (r.historicalDefinitionId === undefined ||
        (text(r.historicalDefinitionId) && !!r.historicalDefinitionId)));
  if (
    !text(d.writeId) ||
    !d.writeId ||
    !text(d.outcome, 10000) ||
    !text(d.poolXp) ||
    !text(d.loadXp) ||
    typeof d.noXp !== 'boolean' ||
    typeof d.hasLoot !== 'boolean' ||
    !Array.isArray(d.recipientIds) ||
    d.recipientIds.length > 1000 ||
    d.recipientIds.some((v) => !text(v) || !v) ||
    new Set(d.recipientIds).size !== d.recipientIds.length ||
    !Array.isArray(d.items) ||
    d.items.length > 100 ||
    d.items.some(
      (i) =>
        !i ||
        !text(i.name) ||
        !text(i.quantity) ||
        !text(i.valueGold) ||
        !reference(i.reference) ||
        !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(i.category),
    ) ||
    Buffer.byteLength(JSON.stringify(d)) > 256000
  )
    throw new Error('Abschlussentwurf hat ungültige oder zu große Rohfelder.');
  return d;
}
function stored(db: any, cam: string, o: FinishOwner): FinishDraft | null {
  checkedOwner(o);
  const r = db
    .prepare('SELECT * FROM finish_draft WHERE campaign_id=? AND kind=? AND target_id=?')
    .get(cam, o.kind, o.targetId);
  if (!r) return null;
  return checkedRow(db, cam, r);
}
function checkedRow(db: any, cam: string, row: any) {
  if (hash(row.payload) !== row.checksum) throw new Error('Abschlussentwurf beschädigt.');
  const d = checkedDraft(JSON.parse(row.payload));
  if (d.kind !== row.kind || d.targetId !== row.target_id)
    throw new Error('Abschlussentwurf gehört zu einem anderen Ziel.');
  validateReferences(db, cam, d);
  return d;
}
function validateReferences(db: any, cam: string, d: FinishDraft) {
  for (const id of d.recipientIds)
    if (!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam, id))
      throw new Error('Abschlussempfänger gehört nicht zur Kampagne.');
  for (const item of d.items)
    if (
      item.reference &&
      !db.prepare('SELECT 1 FROM authored_item WHERE id=?').get(item.reference.definitionId)
    )
      throw new Error('Abschlussgegenstand fehlt.');
}
export function validateFinishDrafts(db: any) {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='finish_draft'").get()) {
    if (db.pragma('user_version', { simple: true }) < 37) return;
    throw new Error('Abschlussentwurfsspeicher fehlt.');
  }
  for (const row of db.prepare('SELECT * FROM finish_draft').iterate()) {
    const d = checkedRow(db, row.campaign_id, row),
      current = currentOwner(db, row.campaign_id, d, true);
    if (d.revision > current.revision)
      throw new Error('Abschlussentwurf stammt aus einem neueren Stand.');
  }
}
export function readFinishDraft(db: any, cam: string, o: FinishOwner) {
  const current = currentOwner(db, cam, o),
    d = stored(db, cam, o);
  if (
    d &&
    (d.revision > current.revision ||
      (d.kind === 'narrative' &&
        d.noteRevision !== undefined &&
        d.noteRevision > current.noteRevision!))
  )
    throw new Error('Abschlussentwurf stammt aus einem neueren Stand.');
  return d;
}
export function keepFinishDraft(db: any, cam: string, d: FinishDraft, expected: string | null) {
  return db
    .transaction(() => {
      checkedDraft(d);
      validateReferences(db, cam, d);
      const current = currentOwner(db, cam, d),
        old = stored(db, cam, d),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if (
        current.closed ||
        d.revision > current.revision ||
        (d.kind === 'narrative' &&
          d.noteRevision !== undefined &&
          d.noteRevision > current.noteRevision!)
      )
        throw new Error('Abschlussziel bereits abgeschlossen oder geändert.');
      if ((old?.writeId ?? null) !== expected)
        throw new Error('Abschlusseingabe inzwischen geändert.');
      db.prepare(
        'INSERT INTO finish_draft VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,kind,target_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, d.kind, d.targetId, payload, hash(payload));
    })
    .immediate();
}
export function consumeFinishDraft(db: any, cam: string, o: FinishOwner, writeId?: string) {
  const d = stored(db, cam, o);
  if (
    (d &&
      (d.writeId !== writeId ||
        d.revision !== o.revision ||
        (o.kind === 'narrative' &&
          (d.noteRevision === undefined || d.noteRevision !== o.noteRevision)))) ||
    (!d && writeId !== undefined)
  )
    throw new Error('Abschlusseingabe geändert. Vor Bestätigung neu öffnen und prüfen.');
  if (d)
    db.prepare('DELETE FROM finish_draft WHERE campaign_id=? AND kind=? AND target_id=?').run(
      cam,
      o.kind,
      o.targetId,
    );
}
export function discardFinishDraft(db: any, cam: string, o: FinishOwner, writeId: string) {
  return db
    .transaction(() => {
      currentOwner(db, cam, o);
      const d = stored(db, cam, o);
      if (!d) return;
      if (d.writeId !== writeId) throw new Error('Abschlusseingabe inzwischen geändert.');
      db.prepare('DELETE FROM finish_draft WHERE campaign_id=? AND kind=? AND target_id=?').run(
        cam,
        o.kind,
        o.targetId,
      );
    })
    .immediate();
}
