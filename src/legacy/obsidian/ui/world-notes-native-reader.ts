import type { FileStore } from "../../../persistence";
import { safePath } from "../../../model";
import { sameSnapshot, payloadDigest,
  type CampaignContextProjection } from "../../../features/campaign/campaign-contracts";
import type { CampaignOwnershipDigest } from "../../../features/campaign/campaign-ownership";
import { parseCampaignRuntimeManifest,
  type CampaignRuntimeStorage } from "../../../features/campaign/campaign-runtime-source";
import { worldNotePath } from "../../../features/campaign/world-notes-commit";
import { emptyWorldNotes, serializeWorldNote, worldNoteDocument, worldNotesSnapshot,
  type WorldNoteKind, type WorldNoteV1, type WorldNotesSnapshotV1 } from "../../../features/world/world-notes";

export interface ConfirmedWorldNotes {
  readonly manifestPath: string;
  readonly manifestBytes: string;
  readonly snapshot: WorldNotesSnapshotV1;
}

/** Read only the Campaign-confirmed native records; never make an orphan file authoritative. */
export async function readConfirmedWorldNotes(input: {
  readonly storage: CampaignRuntimeStorage;
  readonly files: FileStore;
  readonly digest: CampaignOwnershipDigest;
  readonly context: CampaignContextProjection;
  readonly currentContext: () => CampaignContextProjection | null;
}): Promise<ConfirmedWorldNotes> {
  const assertCurrent = () => {
    const current = input.currentContext();
    if (!current || current.lifecycle !== "active" || !sameSnapshot(current, input.context) ||
        current.contextToken !== input.context.contextToken)
      throw new Error("World-Kontext wurde während des Lesens widerrufen.");
  };
  assertCurrent();
  const matches = (await input.storage.list()).filter((file) => {
    try {
      const manifest = parseCampaignRuntimeManifest(file.bytes, input.digest);
      return sameSnapshot(manifest.snapshot, input.context);
    } catch { return false; }
  });
  assertCurrent();
  if (matches.length !== 1) throw new Error("World Notes benötigen genau ein bestätigtes Campaignmanifest.");
  const file = matches[0]!, manifest = parseCampaignRuntimeManifest(file.bytes, input.digest),
    owners = manifest.registry.owners.filter((owner) => owner.ownerId === "world-notes");
  safePath(file.path);
  if (!file.path.startsWith("Kampagnen/SaltMarcher/") || !file.path.endsWith(".campaign.json"))
    throw new Error("World Notes benötigen ein natives Campaignmanifest.");
  const journalPath = file.path.replace(/\.campaign\.json$/, ".world-notes.journal");
  const assertJournalAbsent = async () => {
    if (await input.files.read(journalPath) !== null)
      throw new Error("World-Notes-Journal ist noch offen; Kampagne vor dem erneuten Öffnen sicher schließen.");
    assertCurrent();
  };
  await assertJournalAbsent();
  if (owners.length > 1) throw new Error("World-Notes-Owner ist mehrdeutig.");
  const assertManifestUnchanged = async () => {
    if (await input.files.read(file.path) !== file.bytes)
      throw new Error("Campaignmanifest wurde während des World-Notes-Lesens geändert.");
    await assertJournalAbsent();
    assertCurrent();
  };
  if (!owners.length) {
    await assertManifestUnchanged();
    return { manifestPath: file.path, manifestBytes: file.bytes,
      snapshot: emptyWorldNotes(input.context) };
  }
  const owner = owners[0]!;
  if (owner.schemaRevision !== "schema:world-notes:v1" ||
      owner.policyRevision !== "policy:world-notes:v1" ||
      owner.source.adapterType !== "native-world-notes" ||
      owner.availability !== "confirmed" || owner.transferPolicies.length ||
      JSON.stringify(owner.referenceSchemas) !== JSON.stringify(["catalog-entry.v1", "world-notes.v1"]))
    throw new Error("World-Notes-Owner besitzt keinen bestätigten nativen Vertrag.");
  const seen = new Set<string>(), records: WorldNoteV1[] = [];
  for (const entry of owner.records) {
    if (seen.has(entry.id) || !["world-note", "world-npc", "world-faction", "world-quest", "world-rumor", "world-rule"].includes(entry.recordType) ||
        entry.media !== null) throw new Error("World-Notes-Inventory ist ungültig.");
    seen.add(entry.id);
    const kind = entry.recordType.slice("world-".length) as WorldNoteKind,
      path = worldNotePath(input.context.namespace, kind, entry.id),
      bytes = await input.files.read(path);
    assertCurrent();
    if (bytes === null || payloadDigest(input.digest(bytes)) !== entry.payloadDigest)
      throw new Error("World-Notes-Datei fehlt oder weicht vom bestätigten Digest ab.");
    let record: WorldNoteV1;
    try { record = worldNoteDocument(JSON.parse(bytes) as WorldNoteV1); }
    catch { throw new Error("Bestätigte World-Notes-Datei ist ungültig."); }
    const references = [
      ...record.relations.map((relation) => ({ id: relation.targetId,
        scope: "campaign-local" as const, schema: "world-notes.v1" })),
      ...(record.creatureId === null ? [] : [{ id: record.creatureId,
        scope: "shared" as const, schema: "catalog-entry.v1" }]),
    ].sort((a, b) => `${a.scope}:${a.id}:${a.schema}`.localeCompare(`${b.scope}:${b.id}:${b.schema}`));
    if (record.id !== entry.id || record.kind !== kind || serializeWorldNote(record) !== bytes ||
        JSON.stringify(references) !== JSON.stringify(entry.references))
      throw new Error("World-Notes-Datei stimmt nicht mit der Ownerprojektion überein.");
    records.push(record);
  }
  const revision = 1 + records.reduce((sum, record) => sum + record.revision, 0);
  if (!Number.isSafeInteger(revision)) throw new Error("World-Notes-Revision ist ungültig.");
  const snapshot = worldNotesSnapshot({ version: 1, campaignId: input.context.campaignId,
    namespace: input.context.namespace, revision, records });
  await assertManifestUnchanged();
  return { manifestPath: file.path, manifestBytes: file.bytes, snapshot };
}
