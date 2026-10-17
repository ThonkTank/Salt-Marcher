import { immutable, safePath } from "../../model";
import type {
  AtlasFileWrite,
  AtlasFileJournal,
  AtlasFileRollbackReceipt,
  AtlasFileTransactionObserver,
  FileTransaction,
} from "../atlas/file-transaction";
import {
  changeWorldNotes,
  serializeWorldNote,
  worldNoteDocument,
  worldNotesSnapshot,
  type WorldNoteChange,
  type WorldNoteKind,
  type WorldNoteV1,
  type WorldNotesSnapshotV1,
} from "../world/world-notes";
import {
  campaignCommandId,
  campaignLocalId,
  campaignNamespace,
  payloadDigest,
  revisionToken,
  sameSnapshot,
  type CampaignCommandId,
  type CampaignContextProjection,
  type CampaignLocalId,
  type CampaignNamespace,
} from "./campaign-contracts";
import {
  campaignOwnershipDigestValue,
  campaignDomainOwnershipProjection,
  campaignDomainOwnershipProjectionDigest,
  type CampaignDomainOwnerProjectionV1,
  type CampaignDomainOwnershipProjectionV1,
  type CampaignOwnershipDigest,
  type CampaignOwnershipRecordV1,
} from "./campaign-ownership";
import {
  parseCampaignRuntimeManifest,
  type CampaignRuntimeSaveAcknowledgmentV1,
  type CampaignRuntimeSaveAcknowledgmentValidator,
  type CampaignRuntimeSaveRollbackV1,
  type CampaignRuntimeManifestV1,
} from "./campaign-runtime-source";

const OWNER_ID = "world-notes";
const SCHEMA_REVISION = "schema:world-notes:v1";
const POLICY_REVISION = "policy:world-notes:v1";
const REFERENCE_SCHEMAS = Object.freeze(["catalog-entry.v1", "world-notes.v1"]);
const exact = (value: unknown) => JSON.stringify(value);

export interface WorldNotesPreparedCommitV1 {
  readonly version: 1;
  readonly commandId: CampaignCommandId;
  readonly change: WorldNoteChange;
  readonly changeDigest: string;
  readonly context: CampaignContextProjection;
  readonly beforeSnapshot: WorldNotesSnapshotV1;
  readonly afterSnapshot: WorldNotesSnapshotV1;
  readonly beforeSnapshotDigest: string;
  readonly afterSnapshotDigest: string;
  readonly notePath: string;
  readonly manifestPath: string;
  readonly writes: readonly AtlasFileWrite[];
}

export interface WorldNoteNativeWrite extends AtlasFileWrite {}

export interface WorldNotesCommitReceiptV1 {
  readonly version: 1;
  readonly status: "committed";
  readonly commandId: CampaignCommandId;
  readonly transactionId: string;
  readonly contextToken: string;
  readonly changeDigest: string;
  readonly recordId: CampaignLocalId;
  readonly notePath: string;
  readonly beforeSnapshotRevision: number;
  readonly afterSnapshotRevision: number;
  readonly beforeSnapshotDigest: string;
  readonly afterSnapshotDigest: string;
  readonly beforeRecordRevision: number | null;
  readonly afterRecordRevision: number;
  readonly afterPayloadDigest: string;
  readonly deleted: boolean;
}

export interface WorldNotesCampaignRuntimeSavePort {
  basis(): Promise<{
    readonly context: CampaignContextProjection;
    readonly projection: CampaignDomainOwnershipProjectionV1;
  }>;
  issued(
    participant: CampaignRuntimeSaveAcknowledgmentValidator,
    proof: CampaignRuntimeSaveAcknowledgmentV1 | CampaignRuntimeSaveRollbackV1,
  ): void;
  prepared(proof: CampaignRuntimeSaveAcknowledgmentV1): void;
  committed(proof: CampaignRuntimeSaveAcknowledgmentV1): Promise<void>;
  rolledBack(proof: CampaignRuntimeSaveRollbackV1): void;
}

function recordType(kind: WorldNoteKind): string {
  return `world-${kind}`;
}

export function worldNotePath(
  namespace: CampaignNamespace,
  kind: WorldNoteKind,
  id: CampaignLocalId,
): string {
  campaignNamespace(namespace);
  campaignLocalId(id);
  if (!["note", "npc", "faction", "quest", "rumor", "rule"].includes(kind))
    throw new Error("Unbekannte World-Art.");
  return safePath(
    `Kampagnen/SaltMarcher/${namespace}/Weltwissen/${kind}/${id}.world-note.json`,
  );
}

function parseNote(bytes: string): WorldNoteV1 {
  let value: unknown;
  try {
    value = JSON.parse(bytes);
  } catch {
    throw new Error("World-Datei ist kein gültiges JSON.");
  }
  return worldNoteDocument(value as WorldNoteV1);
}

function noteRecord(
  note: WorldNoteV1,
  bytes: string,
  digest: CampaignOwnershipDigest,
): CampaignOwnershipRecordV1 {
  const references = [
    ...note.relations.map((relation) => ({
      id: relation.targetId,
      scope: "campaign-local" as const,
      schema: "world-notes.v1",
    })),
    ...(note.creatureId === null
      ? []
      : [{ id: note.creatureId, scope: "shared" as const, schema: "catalog-entry.v1" }]),
  ].sort((a, b) => `${a.scope}:${a.id}:${a.schema}`.localeCompare(`${b.scope}:${b.id}:${b.schema}`));
  return Object.freeze({
    id: note.id,
    recordType: recordType(note.kind),
    references: Object.freeze(references),
    payloadDigest: payloadDigest(digest(bytes)),
    media: null,
  });
}

function ownerPolicyDigest(digest: CampaignOwnershipDigest): string {
  return campaignOwnershipDigestValue(
    { ownerId: OWNER_ID, policyRevision: POLICY_REVISION, transferPolicies: [] },
    digest,
  );
}

function ownerRevision(
  records: readonly CampaignOwnershipRecordV1[],
  digest: CampaignOwnershipDigest,
): string {
  return `owner:${campaignOwnershipDigestValue({ schema: SCHEMA_REVISION, records }, digest).slice("sha256:".length)}`;
}

function worldOwner(
  before: CampaignDomainOwnerProjectionV1 | undefined,
  records: readonly CampaignOwnershipRecordV1[],
  digest: CampaignOwnershipDigest,
): CampaignDomainOwnerProjectionV1 {
  if (before && (
    before.ownerId !== OWNER_ID ||
    before.schemaRevision !== SCHEMA_REVISION ||
    before.policyRevision !== POLICY_REVISION ||
    before.policyDigest !== ownerPolicyDigest(digest) ||
    before.source.adapterType !== "native-world-notes" ||
    exact(before.referenceSchemas) !== exact(REFERENCE_SCHEMAS) ||
    before.transferPolicies.length !== 0
  )) throw new Error("World-Notes-Owner besitzt einen fremden Vertrag.");
  const revision = ownerRevision(records, digest);
  return Object.freeze({
    ownerId: OWNER_ID,
    ownerRevision: revision,
    schemaRevision: SCHEMA_REVISION,
    snapshotRevision: `snapshot:${revision.slice("owner:".length)}`,
    policyRevision: POLICY_REVISION,
    policyDigest: ownerPolicyDigest(digest),
    availability: "confirmed",
    emptyConfirmed: records.length === 0,
    referenceSchemas: REFERENCE_SCHEMAS,
    source: Object.freeze({
      adapterType: "native-world-notes",
      generation: `source:${revision.slice("owner:".length)}`,
    }),
    records: Object.freeze([...records].sort((a, b) => a.id.localeCompare(b.id))),
    transferPolicies: Object.freeze([]),
  });
}

function registryRevision(
  manifest: CampaignRuntimeManifestV1,
  owners: readonly CampaignDomainOwnerProjectionV1[],
  digest: CampaignOwnershipDigest,
): string {
  return `registry:${campaignOwnershipDigestValue({
    registryId: manifest.registry.registryId,
    campaignId: manifest.registry.campaignId,
    campaignRevision: manifest.registry.campaignRevision,
    namespace: manifest.registry.namespace,
    owners,
  }, digest).slice("sha256:".length)}`;
}

function manifestBytes(
  before: CampaignRuntimeManifestV1,
  owners: readonly CampaignDomainOwnerProjectionV1[],
  digest: CampaignOwnershipDigest,
): string {
  const unsigned = {
    version: before.registry.version,
    registryId: before.registry.registryId,
    registryRevision: registryRevision(before, owners, digest),
    campaignId: before.registry.campaignId,
    campaignRevision: before.registry.campaignRevision,
    namespace: before.registry.namespace,
    owners,
  };
  const bytes = JSON.stringify({
    version: before.version,
    snapshot: before.snapshot,
    registry: {
      ...unsigned,
      registryContentDigest: campaignOwnershipDigestValue(unsigned, digest),
    },
    atlas: before.atlas,
  }, null, 2) + "\n";
  parseCampaignRuntimeManifest(bytes, digest);
  return bytes;
}

function unchangedTombstone(before: WorldNoteV1, after: WorldNoteV1): boolean {
  return after.id === before.id && after.version === before.version &&
    after.kind === before.kind && after.title === before.title &&
    after.readAloud === before.readAloud && after.gmNotes === before.gmNotes &&
    after.creatureId === before.creatureId && after.deleted &&
    after.revision === before.revision + 1 && after.relations.length === 0;
}

function validTransition(before: WorldNoteV1 | null, after: WorldNoteV1): boolean {
  if (before === null)
    return after.revision === 1 && !after.deleted;
  if (before.deleted || after.id !== before.id || after.kind !== before.kind ||
      after.revision !== before.revision + 1) return false;
  if (after.deleted) return unchangedTombstone(before, after);
  return true;
}

/** Campaign-owned producer contribution; the host supplies the actual FileTransaction. */
export class WorldNotesCampaignCommitParticipant implements CampaignRuntimeSaveAcknowledgmentValidator {
  private readonly preparations = new WeakSet<object>();
  private readonly acknowledgments = new WeakSet<object>();
  private readonly rollbacks = new WeakSet<object>();
  private readonly receipts = new WeakSet<object>();
  constructor(
    readonly manifestPath: string,
    private readonly beforeManifestBytes: string,
    private readonly digest: CampaignOwnershipDigest,
    private readonly runtime?: WorldNotesCampaignRuntimeSavePort,
  ) {
    safePath(manifestPath);
    if (!manifestPath.startsWith("Kampagnen/SaltMarcher/") ||
        !manifestPath.endsWith(".campaign.json"))
      throw new Error("Campaignmanifest liegt außerhalb des bestätigten Campaignroots.");
    parseCampaignRuntimeManifest(beforeManifestBytes, digest);
  }

  prepare(input: {
    readonly commandId: CampaignCommandId;
    readonly context: CampaignContextProjection;
    readonly beforeSnapshot: WorldNotesSnapshotV1;
    readonly afterSnapshot: WorldNotesSnapshotV1;
    readonly change: WorldNoteChange;
    /** Complete native guard set for every record in the post-commit projection. */
    readonly nativeWrites: readonly WorldNoteNativeWrite[];
  }): WorldNotesPreparedCommitV1 {
    const commandId = campaignCommandId(input.commandId),
      before = worldNotesSnapshot(input.beforeSnapshot),
      after = worldNotesSnapshot(input.afterSnapshot),
      manifest = parseCampaignRuntimeManifest(this.beforeManifestBytes, this.digest);
    if (!sameSnapshot(manifest.snapshot, input.context) ||
        input.context.lifecycle !== "active" ||
        before.campaignId !== input.context.campaignId ||
        before.namespace !== input.context.namespace ||
        after.campaignId !== before.campaignId || after.namespace !== before.namespace)
      throw new Error("World-Commit gehört zu einem fremden Campaigncontext.");
    const expected = changeWorldNotes(before, input.context, input.context, before.revision, input.change);
    if (exact(expected) !== exact(after))
      throw new Error("World-Commit bestätigt nicht die angeforderte Änderung.");
    const beforeRecord = before.records.find((record) => record.id === input.change.id) ?? null,
      afterRecord = after.records.find((record) => record.id === input.change.id);
    if (!afterRecord || !validTransition(beforeRecord, afterRecord))
      throw new Error("World-Commit besitzt keinen kausalen Recordübergang.");
    if (!Array.isArray(input.nativeWrites) || input.nativeWrites.length !== after.records.length)
      throw new Error("Native World-Guards decken die Projection nicht vollständig.");
    const byPath = new Map(input.nativeWrites.map((write) => [safePath(write.path), write]));
    if (byPath.size !== input.nativeWrites.length)
      throw new Error("Native World-Guards sind doppelt.");
    for (const record of after.records) {
      const path = worldNotePath(after.namespace, record.kind, record.id),
        write = byPath.get(path),
        oldRecord = before.records.find((candidate) => candidate.id === record.id) ?? null,
        expectedBefore = oldRecord === null ? null : serializeWorldNote(oldRecord),
        expectedAfter = serializeWorldNote(record);
      if (!write || write.before !== expectedBefore || write.after !== expectedAfter)
        throw new Error("Native World-Datei passt nicht zur bestätigten Projection.");
    }
    const notePath = worldNotePath(after.namespace, afterRecord.kind, afterRecord.id),
      owners = [...manifest.registry.owners],
      index = owners.findIndex((owner) => owner.ownerId === OWNER_ID),
      oldOwner = index < 0 ? undefined : owners[index],
      oldRecords = oldOwner?.records ?? [],
      expectedOldRecords = before.records.map((record) =>
        noteRecord(record, serializeWorldNote(record), this.digest));
    if (exact([...oldRecords].sort((a, b) => a.id.localeCompare(b.id))) !==
        exact(expectedOldRecords.sort((a, b) => a.id.localeCompare(b.id))))
      throw new Error("World-Ownerclosure passt nicht zum vollständigen Before-Snapshot.");
    const nextRecords = after.records.map((record) =>
      noteRecord(record, serializeWorldNote(record), this.digest));
    const nextOwner = worldOwner(oldOwner, nextRecords, this.digest);
    if (index < 0) owners.push(nextOwner); else owners[index] = nextOwner;
    owners.sort((a, b) => a.ownerId.localeCompare(b.ownerId));
    const afterManifestBytes = manifestBytes(manifest, Object.freeze(owners), this.digest),
      changeDigest = campaignOwnershipDigestValue(input.change, this.digest),
      writes = Object.freeze([
        ...input.nativeWrites.map((write) => Object.freeze({ ...write })),
        Object.freeze({ path: this.manifestPath, before: this.beforeManifestBytes, after: afterManifestBytes }),
      ]);
    const prepared = immutable({
      version: 1 as const,
      commandId,
      change: input.change,
      changeDigest,
      context: input.context,
      beforeSnapshot: before,
      afterSnapshot: after,
      beforeSnapshotDigest: campaignOwnershipDigestValue(before, this.digest),
      afterSnapshotDigest: campaignOwnershipDigestValue(after, this.digest),
      notePath,
      manifestPath: this.manifestPath,
      writes,
    });
    this.preparations.add(prepared);
    return prepared;
  }

  validateRecovery(journal: AtlasFileJournal): void {
    if (!journal || !Array.isArray(journal.writes) || journal.writes.length !== 2)
      throw new Error("World-Recoveryjournal ist unvollständig.");
    const manifestWrite = journal.writes.find((write) => write.path === this.manifestPath),
      noteWrite = journal.writes.find((write) => write.path !== this.manifestPath);
    if (!manifestWrite?.before || !manifestWrite.after || !noteWrite?.after)
      throw new Error("World-Recoveryjournal besitzt unvollständige Bytes.");
    const beforeManifest = parseCampaignRuntimeManifest(manifestWrite.before, this.digest),
      afterManifest = parseCampaignRuntimeManifest(manifestWrite.after, this.digest);
    if (!sameSnapshot(beforeManifest.snapshot, afterManifest.snapshot) ||
        exact(beforeManifest.atlas) !== exact(afterManifest.atlas))
      throw new Error("World-Recovery verändert eine fremde Campaignclosure.");
    const oldOwners = new Map(beforeManifest.registry.owners.map((owner) => [owner.ownerId, owner])),
      newOwners = new Map(afterManifest.registry.owners.map((owner) => [owner.ownerId, owner]));
    const expectedOwnerIds = new Set(oldOwners.keys());
    expectedOwnerIds.add(OWNER_ID);
    if (newOwners.size !== expectedOwnerIds.size ||
        [...newOwners.keys()].some((id) => !expectedOwnerIds.has(id)))
      throw new Error("World-Recovery schleust einen fremden Owner ein.");
    for (const [id, owner] of oldOwners)
      if (id !== OWNER_ID && exact(owner) !== exact(newOwners.get(id)))
        throw new Error("World-Recovery verändert einen fremden Owner.");
    const beforeNote = noteWrite.before === null ? null : parseNote(noteWrite.before),
      afterNote = parseNote(noteWrite.after);
    if ((beforeNote !== null && serializeWorldNote(beforeNote) !== noteWrite.before) ||
        serializeWorldNote(afterNote) !== noteWrite.after ||
        !validTransition(beforeNote, afterNote) ||
        noteWrite.path !== worldNotePath(afterManifest.snapshot.namespace, afterNote.kind, afterNote.id))
      throw new Error("World-Recovery besitzt keinen kausalen nativen Übergang.");
    const oldOwner = oldOwners.get(OWNER_ID), newOwner = newOwners.get(OWNER_ID);
    if (!newOwner) throw new Error("World-Recovery besitzt keinen bestätigten Owner.");
    const oldRecords = oldOwner?.records ?? [], newRecords = newOwner.records,
      oldRecord = oldRecords.find((record) => record.id === afterNote.id),
      newRecord = newRecords.find((record) => record.id === afterNote.id);
    if ((beforeNote === null) !== (oldRecord === undefined) ||
        beforeNote !== null && exact(oldRecord) !== exact(noteRecord(beforeNote, noteWrite.before!, this.digest)) ||
        exact(newRecord) !== exact(noteRecord(afterNote, noteWrite.after, this.digest)) ||
        exact(oldRecords.filter((record) => record.id !== afterNote.id)) !==
          exact(newRecords.filter((record) => record.id !== afterNote.id)))
      throw new Error("World-Recovery besitzt eine fremde Ownerclosure.");
    const expectedOwner = worldOwner(oldOwner, newRecords, this.digest);
    if (exact(expectedOwner) !== exact(newOwner) ||
        manifestBytes(beforeManifest, afterManifest.registry.owners, this.digest) !== manifestWrite.after)
      throw new Error("World-Recoverymanifest ist nicht aus den nativen Bytes abgeleitet.");
  }

  createAcknowledgment(input: {
    readonly prepared: WorldNotesPreparedCommitV1;
    readonly context: CampaignContextProjection;
    readonly beforeRegistry: CampaignDomainOwnershipProjectionV1;
    readonly journal: AtlasFileJournal;
  }): CampaignRuntimeSaveAcknowledgmentV1 {
    if (!this.preparations.has(input.prepared) ||
        !["prepared", "committed"].includes(input.journal.state))
      throw new Error("World-Save-Acknowledgment besitzt keine autorisierte Vorbereitung.");
    const expectedWrites = input.prepared.writes
      .filter((write) => write.before !== write.after)
      .sort((a, b) => a.path.localeCompare(b.path));
    if (exact([...input.journal.writes].sort((a, b) => a.path.localeCompare(b.path))) !==
        exact(expectedWrites))
      throw new Error("World-Save-Acknowledgment passt nicht zu den vorbereiteten Writes.");
    this.validateRecovery(input.journal);
    const transactionId = revisionToken(input.journal.transactionId, "Transaktions-ID"),
      manifestWrite = input.journal.writes.find((write) => write.path === this.manifestPath)!;
    if (!sameSnapshot(input.prepared.context, input.context) ||
        input.prepared.context.contextToken !== input.context.contextToken ||
        manifestWrite.before !== this.beforeManifestBytes || manifestWrite.after === null)
      throw new Error("World-Save-Acknowledgment gehört zu einer fremden Campaignbasis.");
    const before = parseCampaignRuntimeManifest(manifestWrite.before, this.digest),
      candidate = campaignDomainOwnershipProjection({
        version: 1,
        registryId: before.registry.registryId,
        registryRevision: before.registry.registryRevision,
        projectionDigest: `sha256:${"0".repeat(64)}`,
        context: input.context,
        owners: before.registry.owners,
      }),
      expected = campaignDomainOwnershipProjection({
        ...candidate,
        projectionDigest: campaignDomainOwnershipProjectionDigest(candidate, this.digest),
      });
    if (exact(expected) !== exact(input.beforeRegistry))
      throw new Error("World-Save-Acknowledgment besitzt eine fremde Registrybasis.");
    const proof = immutable({
      version: 1 as const,
      transactionId,
      manifestPath: this.manifestPath,
      beforeManifestBytes: manifestWrite.before,
      afterManifestBytes: manifestWrite.after,
      context: input.context,
      beforeRegistry: input.beforeRegistry,
      journal: input.journal,
    });
    this.acknowledgments.add(proof);
    return proof;
  }

  validateAcknowledgment(proof: CampaignRuntimeSaveAcknowledgmentV1): void {
    if (!this.acknowledgments.has(proof))
      throw new Error("World-Save-Acknowledgment wurde nicht vom zuständigen Participant ausgestellt.");
  }

  createRollbackAcknowledgment(
    prepared: CampaignRuntimeSaveAcknowledgmentV1,
    receipt: AtlasFileRollbackReceipt,
    transaction: FileTransaction,
  ): CampaignRuntimeSaveRollbackV1 {
    transaction.validateRollbackReceipt(receipt);
    this.validateAcknowledgment(prepared);
    if (prepared.journal.state !== "prepared" || receipt.outcome !== "rolled_back" ||
        receipt.journalState !== "absent" || receipt.transactionId !== prepared.transactionId ||
        receipt.writes.length !== prepared.journal.writes.length ||
        prepared.journal.writes.some((write, index) =>
          receipt.writes[index]?.path !== write.path ||
          receipt.writes[index]?.before !== write.before ||
          receipt.writes[index]?.after !== write.after ||
          receipt.writes[index]?.current !== write.before))
      throw new Error("World-Save-Rollback bestätigt nicht die vollständige vorbereitete Transaktion.");
    const proof = immutable({
      version: 1 as const,
      transactionId: prepared.transactionId,
      prepared,
      receipt,
    });
    this.rollbacks.add(proof);
    return proof;
  }

  validateRollback(proof: CampaignRuntimeSaveRollbackV1): void {
    if (!this.rollbacks.has(proof))
      throw new Error("World-Save-Rollback wurde nicht vom zuständigen Participant ausgestellt.");
  }

  transactionObserver(
    preparedCommit: WorldNotesPreparedCommitV1,
    transaction: FileTransaction,
    committed: (receipt: WorldNotesCommitReceiptV1) => void | Promise<void>,
  ): AtlasFileTransactionObserver {
    const runtime = this.runtime;
    if (!runtime) throw new Error("World-Save besitzt keinen Campaign-Runtimeanschluss.");
    let basis: Awaited<ReturnType<WorldNotesCampaignRuntimeSavePort["basis"]>> | undefined,
      preparedProof: CampaignRuntimeSaveAcknowledgmentV1 | undefined;
    const proof = (journal: AtlasFileJournal) => {
      if (!basis) throw new Error("World-Save besitzt keine bestätigte Registrybasis.");
      const value = this.createAcknowledgment({
        prepared: preparedCommit,
        context: basis.context,
        beforeRegistry: basis.projection,
        journal,
      });
      runtime.issued(this, value);
      return value;
    };
    return {
      prepared: async (journal) => {
        basis = await runtime.basis();
        preparedProof = proof(journal);
        runtime.prepared(preparedProof);
      },
      committed: async (journal) => {
        if (!preparedProof)
          throw new Error("World-Commit besitzt keine ursprüngliche Vorbereitung.");
        await runtime.committed(proof(journal));
        await committed(this.createReceipt(preparedCommit, journal));
      },
      rolledBack: (receipt) => {
        if (!preparedProof) return;
        const rollback = this.createRollbackAcknowledgment(preparedProof, receipt, transaction);
        this.preparations.delete(preparedCommit);
        runtime.issued(this, rollback);
        runtime.rolledBack(rollback);
      },
    };
  }

  createReceipt(
    prepared: WorldNotesPreparedCommitV1,
    journal: AtlasFileJournal,
  ): WorldNotesCommitReceiptV1 {
    if (!this.preparations.has(prepared))
      throw new Error("World-Commitvorbereitung stammt nicht aus diesem Producer oder wurde bereits verbraucht.");
    if (journal.state !== "committed" ||
        exact([...journal.writes].sort((a, b) => a.path.localeCompare(b.path))) !==
          exact(prepared.writes.filter((write) => write.before !== write.after)
            .sort((a, b) => a.path.localeCompare(b.path))))
      throw new Error("World-Commitjournal passt nicht zur Vorbereitung.");
    const beforeRecord = prepared.beforeSnapshot.records.find((record) => record.id === prepared.change.id) ?? null,
      afterRecord = prepared.afterSnapshot.records.find((record) => record.id === prepared.change.id)!;
    this.preparations.delete(prepared);
    const receipt = immutable({
      version: 1 as const,
      status: "committed" as const,
      commandId: prepared.commandId,
      transactionId: journal.transactionId,
      contextToken: prepared.context.contextToken,
      changeDigest: prepared.changeDigest,
      recordId: afterRecord.id,
      notePath: prepared.notePath,
      beforeSnapshotRevision: prepared.beforeSnapshot.revision,
      afterSnapshotRevision: prepared.afterSnapshot.revision,
      beforeSnapshotDigest: prepared.beforeSnapshotDigest,
      afterSnapshotDigest: prepared.afterSnapshotDigest,
      beforeRecordRevision: beforeRecord?.revision ?? null,
      afterRecordRevision: afterRecord.revision,
      afterPayloadDigest: payloadDigest(this.digest(serializeWorldNote(afterRecord))),
      deleted: afterRecord.deleted,
    });
    this.receipts.add(receipt);
    return receipt;
  }

  validateReceipt(receipt: WorldNotesCommitReceiptV1): void {
    if (!this.receipts.has(receipt))
      throw new Error("World-Commitreceipt stammt nicht aus diesem Producer.");
  }
}
