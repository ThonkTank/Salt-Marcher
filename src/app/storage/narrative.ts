import { createHash } from "node:crypto";
import type {
  NarrativeState,
  NarrativeAward,
  NarrativeView,
  NarrativeDraft,
} from "../narrative-contracts";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function installNarrative(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS narrative_state(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_award(campaign_id TEXT NOT NULL,id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_draft(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS ledger_parent_lookup ON character_ledger(campaign_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.parentId') END);
CREATE INDEX IF NOT EXISTS ledger_credit_lookup ON character_ledger(campaign_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.rewardCreditId') END);`);
}
export function narrativeNote(db: any, cam: string, id: string) {
  const r = db
    .prepare("SELECT * FROM world_note WHERE campaign_id=? AND id=?")
    .get(cam, id);
  if (!r || r.trashed || hash(r.payload) !== r.checksum)
    throw new Error("Narrative Notiz nicht verfügbar.");
  const n = JSON.parse(r.payload);
  if (!["quest", "rumor"].includes(n.kind))
    throw new Error("Quest oder Gerücht auswählen.");
  return n;
}
function parsed<T>(r: any): T {
  if (!r || hash(r.payload) !== r.checksum)
    throw new Error("Narrative Belohnung beschädigt.");
  return JSON.parse(r.payload);
}
export function readNarrative(db: any, cam: string, id: string): NarrativeView {
  const n = narrativeNote(db, cam, id),
    r = db
      .prepare(
        "SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?",
      )
      .get(cam, id),
    state: NarrativeState = r
      ? parsed(r)
      : {
          noteId: id,
          revision: 0,
          status: "open",
          locationId: null,
          contributors: [],
          poolXp: 0,
          items: [],
          awardId: null,
        },
    award = state.awardId
      ? parsed<NarrativeAward>(
          db
            .prepare(
              "SELECT * FROM narrative_award WHERE campaign_id=? AND id=?",
            )
            .get(cam, state.awardId),
        )
      : null;
  return {
    state,
    award,
    noteRevision: n.revision,
    draft: readNarrativeDraft(db, cam, id),
  };
}
export function saveNarrative(db: any, cam: string, state: NarrativeState) {
  const payload = JSON.stringify(state);
  db.prepare(
    "INSERT INTO narrative_state VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum",
  ).run(cam, state.noteId, state.revision, payload, hash(payload));
}
export function saveNarrativeAward(
  db: any,
  cam: string,
  award: NarrativeAward,
) {
  const payload = JSON.stringify(award);
  db.prepare("INSERT INTO narrative_award VALUES(?,?,?,?,?)").run(
    cam,
    award.id,
    award.noteId,
    payload,
    hash(payload),
  );
}
export function validateNarrativeState(
  db: any,
  cam: string,
  s: NarrativeState,
) {
  if (
    !s ||
    !["open", "closed"].includes(s.status) ||
    !Number.isSafeInteger(s.poolXp) ||
    s.poolXp < 0 ||
    !Array.isArray(s.contributors) ||
    s.contributors.length > 1000 ||
    new Set(s.contributors).size !== s.contributors.length ||
    !Array.isArray(s.items) ||
    s.items.length > 100
  )
    throw new Error("Status, Mitwirkende und Belohnung prüfen.");
  if (
    s.locationId &&
    !db
      .prepare(
        "SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0",
      )
      .get(cam, s.locationId)
  )
    throw new Error("Verknüpfter Ort nicht verfügbar.");
  for (const id of s.contributors)
    if (
      !db
        .prepare("SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?")
        .get(cam, id)
    )
      throw new Error("Mitwirkende Figur fehlt.");
  for (const i of s.items)
    if (
      !i ||
      typeof i.name !== "string" ||
      !i.name.trim() ||
      !Number.isSafeInteger(i.quantity) ||
      i.quantity < 1 ||
      typeof i.valueGold !== "string"
    )
      throw new Error("Belohnungsgegenstand prüfen.");
}

export function readNarrativeDraft(
  db: any,
  cam: string,
  id: string,
): NarrativeDraft | null {
  const r = db
    .prepare("SELECT * FROM narrative_draft WHERE campaign_id=? AND note_id=?")
    .get(cam, id);
  return r ? parsed<NarrativeDraft>(r) : null;
}
export function keepNarrativeDraft(
  db: any,
  cam: string,
  d: NarrativeDraft,
  expected: string | null,
) {
  return db
    .transaction(() => {
      narrativeNote(db, cam, d.noteId);
      const text = (v: unknown, max = 1000) =>
        typeof v === "string" && v.length <= max;
      if (
        !d.writeId ||
        !text(d.writeId) ||
        !Number.isSafeInteger(d.revision) ||
        d.revision < 0 ||
        !["open", "closed"].includes(d.status) ||
        (d.locationId !== null && !text(d.locationId)) ||
        !text(d.poolXp) ||
        !Array.isArray(d.contributors) ||
        d.contributors.length > 1000 ||
        d.contributors.some((v) => !text(v)) ||
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
        throw new Error("Narrative Eingabe ist zu groß oder ungültig.");
      const old = readNarrativeDraft(db, cam, d.noteId),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if ((old?.writeId ?? null) !== expected)
        throw new Error("Narrativer Entwurf inzwischen geändert.");
      db.prepare(
        "INSERT INTO narrative_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum",
      ).run(cam, d.noteId, payload, hash(payload));
    })
    .immediate();
}
export function discardNarrativeDraft(
  db: any,
  cam: string,
  id: string,
  writeId: string,
) {
  return db
    .transaction(() => {
      narrativeNote(db, cam, id);
      consumeNarrativeDraft(db, cam, id, writeId);
    })
    .immediate();
}
export function consumeNarrativeDraft(
  db: any,
  cam: string,
  id: string,
  writeId?: string,
) {
  const d = readNarrativeDraft(db, cam, id);
  if (d && d.writeId !== writeId)
    throw new Error(
      "Offene narrative Eingabe zuerst speichern oder verwerfen.",
    );
  if (d)
    db.prepare(
      "DELETE FROM narrative_draft WHERE campaign_id=? AND note_id=?",
    ).run(cam, id);
}
