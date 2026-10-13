import { createHash } from "node:crypto";
import type { FinishOwner, FinishDraft } from "../finish-draft-contracts";
import { readNarrative } from "./narrative";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function installFinishDrafts(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS finish_draft(campaign_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('combat','narrative')),target_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,target_id),FOREIGN KEY(campaign_id) REFERENCES campaign(id)) STRICT;`,
  );
}
function checkedOwner(o: FinishOwner) {
  if (
    !o ||
    !["combat", "narrative"].includes(o.kind) ||
    typeof o.targetId !== "string" ||
    !o.targetId ||
    o.targetId.length > 1000 ||
    !Number.isSafeInteger(o.revision) ||
    o.revision < 0
  )
    throw new Error("Abschlussziel ungültig.");
}
function currentOwner(db: any, cam: string, o: FinishOwner) {
  checkedOwner(o);
  if (o.kind === "narrative") {
    const n = readNarrative(db, cam, o.targetId);
    return { revision: n.state.revision, closed: !!n.state.awardId };
  }
  const r = db
    .prepare("SELECT * FROM combat WHERE campaign_id=? AND id=?")
    .get(cam, o.targetId);
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error("Kampf des Abschlussentwurfs nicht verfügbar.");
  const c = JSON.parse(r.payload);
  if (c.id !== r.id || c.revision !== r.revision || c.phase !== r.phase)
    throw new Error("Kampfzuordnung widersprüchlich.");
  return { revision: c.revision, closed: c.phase === "finished" };
}
function checkedDraft(d: FinishDraft) {
  checkedOwner(d);
  const text = (v: unknown, max = 1000) =>
    typeof v === "string" && v.length <= max;
  if (
    !text(d.writeId) ||
    !d.writeId ||
    !text(d.outcome, 10000) ||
    !text(d.poolXp) ||
    !text(d.loadXp) ||
    typeof d.noXp !== "boolean" ||
    typeof d.hasLoot !== "boolean" ||
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
        !["coins", "equipment", "trade-goods", "magic", "other"].includes(
          i.category,
        ),
    ) ||
    Buffer.byteLength(JSON.stringify(d)) > 256000
  )
    throw new Error("Abschlussentwurf hat ungültige oder zu große Rohfelder.");
  return d;
}
function stored(db: any, cam: string, o: FinishOwner): FinishDraft | null {
  checkedOwner(o);
  const r = db
    .prepare(
      "SELECT * FROM finish_draft WHERE campaign_id=? AND kind=? AND target_id=?",
    )
    .get(cam, o.kind, o.targetId);
  if (!r) return null;
  if (hash(r.payload) !== r.checksum)
    throw new Error("Abschlussentwurf beschädigt.");
  const d = checkedDraft(JSON.parse(r.payload));
  if (d.kind !== o.kind || d.targetId !== o.targetId)
    throw new Error("Abschlussentwurf gehört zu einem anderen Ziel.");
  return d;
}
export function readFinishDraft(db: any, cam: string, o: FinishOwner) {
  const current = currentOwner(db, cam, o),
    d = stored(db, cam, o);
  if (d && d.revision > current.revision)
    throw new Error("Abschlussentwurf stammt aus einem neueren Stand.");
  return d;
}
export function keepFinishDraft(
  db: any,
  cam: string,
  d: FinishDraft,
  expected: string | null,
) {
  return db
    .transaction(() => {
      checkedDraft(d);
      const current = currentOwner(db, cam, d),
        old = stored(db, cam, d),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if (current.closed || d.revision > current.revision)
        throw new Error("Abschlussziel bereits abgeschlossen oder geändert.");
      if ((old?.writeId ?? null) !== expected)
        throw new Error("Abschlusseingabe inzwischen geändert.");
      db.prepare(
        "INSERT INTO finish_draft VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,kind,target_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum",
      ).run(cam, d.kind, d.targetId, payload, hash(payload));
    })
    .immediate();
}
export function consumeFinishDraft(
  db: any,
  cam: string,
  o: FinishOwner,
  writeId?: string,
) {
  const d = stored(db, cam, o);
  if (
    (d && (d.writeId !== writeId || d.revision !== o.revision)) ||
    (!d && writeId !== undefined)
  )
    throw new Error(
      "Abschlusseingabe geändert. Vor Bestätigung neu öffnen und prüfen.",
    );
  if (d)
    db.prepare(
      "DELETE FROM finish_draft WHERE campaign_id=? AND kind=? AND target_id=?",
    ).run(cam, o.kind, o.targetId);
}
export function discardFinishDraft(
  db: any,
  cam: string,
  o: FinishOwner,
  writeId: string,
) {
  return db
    .transaction(() => {
      currentOwner(db, cam, o);
      const d = stored(db, cam, o);
      if (!d) return;
      if (d.writeId !== writeId)
        throw new Error("Abschlusseingabe inzwischen geändert.");
      db.prepare(
        "DELETE FROM finish_draft WHERE campaign_id=? AND kind=? AND target_id=?",
      ).run(cam, o.kind, o.targetId);
    })
    .immediate();
}
