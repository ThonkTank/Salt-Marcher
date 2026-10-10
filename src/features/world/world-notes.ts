import { immutable } from "../../model";
import {
  campaignId as validateCampaignId,
  campaignLocalId,
  campaignNamespace as validateCampaignNamespace,
  type CampaignContextProjection,
  type CampaignId,
  type CampaignLocalId,
  type CampaignNamespace,
} from "../campaign/campaign-contracts";

export type WorldNoteKind = "npc" | "faction" | "quest" | "rumor";
export interface WorldNoteRelation {
  readonly targetId: CampaignLocalId;
  readonly label: string;
}
export interface WorldNoteV1 {
  readonly version: 1;
  readonly id: CampaignLocalId;
  readonly revision: number;
  readonly kind: WorldNoteKind;
  readonly title: string;
  readonly readAloud: string;
  readonly gmNotes: string;
  readonly relations: readonly WorldNoteRelation[];
  /** Catalog identity only. Creature/statblock content stays with its owner. */
  readonly creatureId: string | null;
  readonly deleted: boolean;
}
export interface WorldNotesSnapshotV1 {
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly namespace: CampaignNamespace;
  readonly revision: number;
  readonly records: readonly WorldNoteV1[];
}
export type WorldNoteDraft = Pick<WorldNoteV1,
  "kind" | "title" | "readAloud" | "gmNotes" | "relations" | "creatureId">;
export type WorldNoteChange =
  | { readonly kind: "create"; readonly id: CampaignLocalId; readonly draft: WorldNoteDraft }
  | { readonly kind: "update"; readonly id: CampaignLocalId; readonly expectedRevision: number; readonly draft: WorldNoteDraft }
  | { readonly kind: "delete"; readonly id: CampaignLocalId; readonly expectedRevision: number };

function positive(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Ungültige World-Revision.");
  return value;
}
function nonblank(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} fehlt.`);
  return value;
}
function draft(value: WorldNoteDraft): WorldNoteDraft {
  if (!["npc", "faction", "quest", "rumor"].includes(value.kind))
    throw new Error("Unbekannter World-Eintrag.");
  nonblank(value.title, "Titel");
  if (typeof value.readAloud !== "string" || typeof value.gmNotes !== "string")
    throw new Error("Ungültiger World-Text.");
  if (value.kind !== "npc" && value.creatureId !== null)
    throw new Error("Nur NPCs dürfen eine Kreaturreferenz haben.");
  if (value.creatureId !== null) nonblank(value.creatureId, "Kreaturreferenz");
  if (!Array.isArray(value.relations)) throw new Error("Ungültige Beziehungen.");
  const seen = new Set<string>();
  const relations = value.relations.map((relation) => {
    const targetId = campaignLocalId(relation.targetId);
    const label = nonblank(relation.label, "Beziehungsname");
    const key = `${targetId}\u0000${label}`;
    if (seen.has(key)) throw new Error("Beziehung ist doppelt.");
    seen.add(key);
    return { targetId, label };
  });
  return immutable({ kind: value.kind, title: value.title, readAloud: value.readAloud,
    gmNotes: value.gmNotes, creatureId: value.creatureId, relations });
}
function validate(snapshot: WorldNotesSnapshotV1): void {
  if (snapshot.version !== 1) throw new Error("Unbekanntes World-Format.");
  validateCampaignId(snapshot.campaignId); validateCampaignNamespace(snapshot.namespace);
  positive(snapshot.revision);
  if (!Array.isArray(snapshot.records)) throw new Error("Ungültiger World-Bestand.");
  const ids = new Set<string>();
  for (const record of snapshot.records) {
    campaignLocalId(record.id); positive(record.revision);
    if (record.version !== 1 || typeof record.deleted !== "boolean" || ids.has(record.id))
      throw new Error("Ungültiger World-Bestand.");
    ids.add(record.id); draft(record);
  }
  for (const record of snapshot.records) {
    if (record.deleted && record.relations.length) throw new Error("Gelöschter Eintrag besitzt Beziehungen.");
    for (const relation of record.relations)
      if (!snapshot.records.some((target) => target.id === relation.targetId && !target.deleted))
        throw new Error("Beziehung zeigt nicht auf einen aktiven Eintrag.");
  }
}
export function emptyWorldNotes(context: CampaignContextProjection): WorldNotesSnapshotV1 {
  if (context.lifecycle !== "active") throw new Error("Kampagne ist nicht aktiv.");
  return immutable({ version: 1, campaignId: context.campaignId,
    namespace: context.namespace, revision: 1, records: [] });
}
/** Canonical native record validation; cross-record relation closure is checked by the snapshot. */
export function worldNoteDocument(value: WorldNoteV1): WorldNoteV1 {
  campaignLocalId(value.id);
  positive(value.revision);
  if (value.version !== 1 || typeof value.deleted !== "boolean")
    throw new Error("Ungültiger World-Eintrag.");
  const checkedDraft = draft(value);
  if (value.deleted && checkedDraft.relations.length)
    throw new Error("Gelöschter Eintrag besitzt Beziehungen.");
  return immutable({
    version: 1,
    id: value.id,
    revision: value.revision,
    ...checkedDraft,
    deleted: value.deleted,
  });
}
export function serializeWorldNote(value: WorldNoteV1): string {
  return JSON.stringify(worldNoteDocument(value), null, 2) + "\n";
}
export function worldNotesSnapshot(value: WorldNotesSnapshotV1): WorldNotesSnapshotV1 {
  validate(value);
  return immutable({ ...value, records: [...value.records]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) => ({ ...record,
      relations: record.relations.map((relation) => ({ ...relation })) })) });
}
function assertContext(snapshot: WorldNotesSnapshotV1, expected: CampaignContextProjection,
  current: CampaignContextProjection | null): void {
  if (!current || expected.lifecycle !== "active" || current.lifecycle !== "active" ||
      snapshot.campaignId !== expected.campaignId || snapshot.namespace !== expected.namespace ||
      current.campaignId !== expected.campaignId || current.namespace !== expected.namespace ||
      current.revision !== expected.revision || current.contextToken !== expected.contextToken)
    throw new Error("World-Kontext ist veraltet oder fremd.");
}
/** Pure proposed change. The Campaign owner must confirm and atomically publish the native bytes. */
export function changeWorldNotes(snapshot: WorldNotesSnapshotV1, expected: CampaignContextProjection,
  current: CampaignContextProjection | null, expectedRevision: number,
  change: WorldNoteChange): WorldNotesSnapshotV1 {
  validate(snapshot); assertContext(snapshot, expected, current);
  if (snapshot.revision !== expectedRevision) throw new Error("World-Bestand wurde geändert.");
  const records: WorldNoteV1[] = snapshot.records.map((record) => ({ ...record, relations: [...record.relations] }));
  const index = records.findIndex((record) => record.id === change.id);
  if (change.kind === "create") {
    campaignLocalId(change.id);
    if (index >= 0) throw new Error("World-ID ist bereits vergeben.");
    records.push({ version: 1, id: change.id, revision: 1, ...draft(change.draft), deleted: false });
  } else {
    const before = records[index];
    if (!before || before.deleted || before.revision !== change.expectedRevision)
      throw new Error("World-Eintrag wurde geändert oder gelöscht.");
    if (change.kind === "delete") {
      if (records.some((record) => !record.deleted && record.id !== change.id &&
        record.relations.some((relation) => relation.targetId === change.id)))
        throw new Error("World-Eintrag ist noch verknüpft.");
      records[index] = { ...before, revision: positive(before.revision + 1),
        relations: [], deleted: true };
    } else {
      if (change.draft.kind !== before.kind) throw new Error("World-Art darf sich nicht ändern.");
      records[index] = { ...before, ...draft(change.draft), revision: positive(before.revision + 1) };
    }
  }
  return worldNotesSnapshot({ ...snapshot, revision: positive(snapshot.revision + 1), records });
}
export function searchWorldNotes(snapshot: WorldNotesSnapshotV1, query: string,
  kinds?: readonly WorldNoteKind[]): readonly WorldNoteV1[] {
  const needle = query.trim().normalize("NFKC").toLocaleLowerCase("de");
  return Object.freeze(snapshot.records.filter((record) => !record.deleted &&
    (!kinds || kinds.includes(record.kind)) &&
    [record.title, record.readAloud, record.gmNotes].some((value) =>
      value.normalize("NFKC").toLocaleLowerCase("de").includes(needle))));
}
