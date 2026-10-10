import { immutable, safePath } from "../../model";
import { payloadDigest, revisionToken, sameSnapshot, type CampaignContextProjection } from "./campaign-contracts";
import {
  campaignDomainOwnershipProjection,
  campaignDomainOwnershipProjectionDigest,
  campaignOwnershipDigestValue,
  type CampaignDomainOwnerProjectionV1,
  type CampaignDomainOwnershipProjectionV1,
  type CampaignOwnershipDigest,
} from "./campaign-ownership";
import {
  parseCampaignRuntimeManifest,
  type CampaignRuntimeSaveJournal,
  type CampaignRuntimeManifestV1,
  type CampaignRuntimeSaveAcknowledgmentV1,
  type CampaignRuntimeSaveAcknowledgmentValidator,
  type CampaignRuntimeSaveRollbackV1,
  type CampaignRuntimeSaveRollbackReceipt,
} from "./campaign-runtime-source";

export interface CampaignManifestNativeWrite {
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
}
export interface CampaignManifestSaveInput {
  readonly beforeManifestBytes: string;
  /** Complete native guard set for the requested post-save Atlas inventory. */
  readonly nativeWrites: readonly CampaignManifestNativeWrite[];
  /** Full projections supplied by their actual owners, never inferred from file bytes. */
  readonly beforeOwners: readonly CampaignDomainOwnerProjectionV1[];
  readonly afterOwners: readonly CampaignDomainOwnerProjectionV1[];
  /** Explicit post-save inventory. Omit only when the immutable file/record closure is unchanged. */
  readonly afterFiles?: CampaignRuntimeManifestV1["atlas"]["files"];
  readonly afterRecords?: CampaignRuntimeManifestV1["atlas"]["records"];
}
export interface CampaignManifestRecoveryJournal {
  readonly writes: readonly CampaignManifestNativeWrite[];
}
export interface CampaignManifestSaveAcknowledgmentInput {
  readonly context: CampaignContextProjection;
  readonly beforeRegistry: CampaignDomainOwnershipProjectionV1;
  readonly journal: CampaignRuntimeSaveJournal;
}
export interface CampaignManifestSaveRollbackInput {
  readonly prepared: CampaignRuntimeSaveAcknowledgmentV1;
  readonly receipt: CampaignRuntimeSaveRollbackReceipt;
}
export interface CampaignRuntimeSaveRollbackAuthority {
  validateRollbackReceipt(receipt: CampaignRuntimeSaveRollbackReceipt): void;
}
export interface CampaignRuntimeOwnerSaveAuthority {
  readonly ownerId: string;
  /** Deterministic owner adapter; it must bind every record proof to these exact native guards. */
  verify(input: {
    readonly mode: "prepare" | "recovery";
    readonly beforeOwner: CampaignDomainOwnerProjectionV1;
    readonly afterOwner: CampaignDomainOwnerProjectionV1;
    readonly beforeFiles: CampaignRuntimeManifestV1["atlas"]["files"];
    readonly afterFiles: CampaignRuntimeManifestV1["atlas"]["files"];
    readonly beforeRecords: CampaignRuntimeManifestV1["atlas"]["records"];
    readonly afterRecords: CampaignRuntimeManifestV1["atlas"]["records"];
    readonly nativeWrites: readonly CampaignManifestNativeWrite[];
  }): void;
  /** Required in addition to verify() when this owner authorizes new records or changed references. */
  verifyExtension?(input: {
    readonly mode: "prepare" | "recovery";
    readonly beforeOwner: CampaignDomainOwnerProjectionV1;
    readonly afterOwner: CampaignDomainOwnerProjectionV1;
    readonly beforeFiles: CampaignRuntimeManifestV1["atlas"]["files"];
    readonly afterFiles: CampaignRuntimeManifestV1["atlas"]["files"];
    readonly beforeRecords: CampaignRuntimeManifestV1["atlas"]["records"];
    readonly afterRecords: CampaignRuntimeManifestV1["atlas"]["records"];
    readonly nativeWrites: readonly CampaignManifestNativeWrite[];
  }): void;
}

function exact(value: unknown): string {
  return JSON.stringify(value);
}
function snapshot<T>(value: T): T {
  return immutable(JSON.parse(JSON.stringify(value)) as T);
}
function revision(
  label: string,
  value: unknown,
  digest: CampaignOwnershipDigest,
): string {
  return `${label}:${payloadDigest(campaignOwnershipDigestValue(value, digest)).slice("sha256:".length)}`;
}
function ownerClosure(owner: CampaignDomainOwnerProjectionV1): unknown {
  return {
    ownerId: owner.ownerId,
    schemaRevision: owner.schemaRevision,
    policyRevision: owner.policyRevision,
    policyDigest: owner.policyDigest,
    availability: owner.availability,
    emptyConfirmed: owner.emptyConfirmed,
    referenceSchemas: owner.referenceSchemas,
    adapterType: owner.source.adapterType,
    records: owner.records.map(({ id, recordType, references, media }) => ({
      id,
      recordType,
      references,
      media,
    })),
    transferPolicies: owner.transferPolicies,
  };
}
function ownerStableClosure(owner: CampaignDomainOwnerProjectionV1): unknown {
  const { records: _records, ...closure } = ownerClosure(owner) as {
    records: unknown;
    [key: string]: unknown;
  };
  return closure;
}
function recordClosure(
  record: CampaignDomainOwnerProjectionV1["records"][number],
): unknown {
  const { payloadDigest: _payloadDigest, ...closure } = record;
  return closure;
}
function serialize(
  manifest: CampaignRuntimeManifestV1,
  digest: CampaignOwnershipDigest,
): string {
  const bytes = JSON.stringify(manifest, null, 2) + "\n";
  parseCampaignRuntimeManifest(bytes, digest);
  return bytes;
}

/** Campaign-owned, stateless contribution to a host-owned native transaction. */
export class CampaignRuntimeManifestSaveParticipant implements CampaignRuntimeSaveAcknowledgmentValidator {
  readonly manifestPath: string;
  private readonly acknowledgments = new WeakSet<object>();
  private readonly rollbacks = new WeakSet<object>();
  constructor(
    manifestPath: string,
    private readonly digest: CampaignOwnershipDigest,
    private readonly authorities: readonly CampaignRuntimeOwnerSaveAuthority[],
    private readonly rollbackAuthority?: CampaignRuntimeSaveRollbackAuthority,
  ) {
    this.manifestPath = safePath(manifestPath);
    if (
      !this.manifestPath.startsWith("Kampagnen/SaltMarcher/") ||
      !this.manifestPath.endsWith(".campaign.json")
    )
      throw new Error(
        "Campaignmanifest liegt außerhalb des bestätigten Campaignroots.",
      );
    if (
      !Array.isArray(authorities) ||
      new Set(authorities.map((authority) => authority.ownerId)).size !==
        authorities.length
    )
      throw new Error(
        "Owner-Save-Autoritäten sind unvollständig oder doppelt.",
      );
  }

  owns(path: string): boolean {
    return path === this.manifestPath;
  }

  private authorizedOwners(
    mode: "prepare" | "recovery",
    before: CampaignRuntimeManifestV1,
    afterFiles: CampaignRuntimeManifestV1["atlas"]["files"],
    afterRecords: CampaignRuntimeManifestV1["atlas"]["records"],
    afterOwners: readonly CampaignDomainOwnerProjectionV1[],
    nativeWrites: readonly CampaignManifestNativeWrite[],
    changedFiles: ReadonlySet<string>,
  ): readonly CampaignDomainOwnerProjectionV1[] {
    if (afterOwners.length !== before.registry.owners.length)
      throw new Error("Ownerprojektion ist unvollständig.");
    const afterById = new Map(
      afterOwners.map((owner) => [owner.ownerId, owner]),
    );
    if (afterById.size !== afterOwners.length)
      throw new Error("Ownerprojektion ist doppelt.");
    const authorityById = new Map(
      this.authorities.map((authority) => [authority.ownerId, authority]),
    );
    if (
      authorityById.size !== before.registry.owners.length ||
      before.registry.owners.some((owner) => !authorityById.has(owner.ownerId))
    )
      throw new Error(
        "Owner-Save-Autoritäten decken die Registry nicht exakt.",
      );
    const changedOwnerIds = new Set<string>();
    const owners = before.registry.owners.map((oldOwner) => {
      const next = afterById.get(oldOwner.ownerId);
      if (!next || exact(ownerStableClosure(oldOwner)) !== exact(ownerStableClosure(next)))
        throw new Error("Stabile Owner-Closure wurde im lokalen Save verändert.");
      const authority = authorityById.get(oldOwner.ownerId)!,
        nextRecords = new Map(next.records.map((record) => [record.id, record])),
        closureChanged = exact(ownerClosure(oldOwner)) !== exact(ownerClosure(next));
      for (const oldRecord of oldOwner.records) {
        const nextRecord = nextRecords.get(oldRecord.id);
        if (!nextRecord)
          throw new Error("Bestehende Owner-Recordclosure wurde im lokalen Save entfernt.");
        if (!authority.verifyExtension && exact(recordClosure(oldRecord)) !== exact(recordClosure(nextRecord)))
          throw new Error("Bestehende Owner-Recordclosure wurde im lokalen Save verändert.");
      }
      for (const record of next.records) {
        if (oldOwner.records.some((old) => old.id === record.id)) continue;
        const inventory = afterRecords.find((candidate) => candidate.id === record.id);
        if (inventory && (inventory.ownerId !== oldOwner.ownerId || inventory.kind !== record.recordType))
          throw new Error("Neue Owner-Recordclosure besitzt keinen exakten Atlasbestand.");
        if (!inventory && !authority.verifyExtension)
          throw new Error("Neue nicht navigierbare Owner-Recordclosure besitzt keine Erweiterungsautorität.");
      }
      const ownerChanged = exact(oldOwner.records) !== exact(next.records);
      if (!ownerChanged) {
        if (exact(oldOwner) !== exact(next))
          throw new Error("Unveränderter Owner trägt eine erfundene Revision.");
      } else {
        if (
          oldOwner.ownerRevision === next.ownerRevision ||
          oldOwner.snapshotRevision === next.snapshotRevision ||
          oldOwner.source.generation === next.source.generation
        )
          throw new Error(
            "Geänderter Owner besitzt keine frische autorisierte Bindung.",
          );
        changedOwnerIds.add(oldOwner.ownerId);
      }
      const evidence = immutable({
        mode,
        beforeOwner: oldOwner,
        afterOwner: next,
        beforeFiles: before.atlas.files,
        afterFiles,
        beforeRecords: before.atlas.records,
        afterRecords,
        nativeWrites,
      });
      authority.verify(evidence);
      if (closureChanged) {
        if (!authority.verifyExtension)
          throw new Error("Owner-Closure wurde ohne Erweiterungsautorität verändert.");
        authority.verifyExtension(evidence);
      }
      return next;
    });
    const expectedChangedOwners = new Set<string>();
    for (const file of afterFiles) {
      if (!changedFiles.has(file.path)) continue;
      if (file.kind === "terrain") {
        const world = afterRecords.find(
          (record) =>
            record.kind === "world" && record.id === before.atlas.worldId,
        );
        if (world) expectedChangedOwners.add(world.ownerId);
      } else {
        for (const record of afterRecords)
          if (record.documentId === file.id)
            expectedChangedOwners.add(record.ownerId);
      }
    }
    if (
      exact([...changedOwnerIds].sort()) !==
      exact([...expectedChangedOwners].sort())
    )
      throw new Error(
        "Native Änderungen und autorisierte Ownerprojektionen sind nicht deckungsgleich.",
      );
    return Object.freeze(owners);
  }

  private registryRevision(
    before: CampaignRuntimeManifestV1,
    owners: readonly CampaignDomainOwnerProjectionV1[],
  ): string {
    return revision(
      "registry",
      {
        schema: "campaign-runtime-registry-save-v1",
        registryId: before.registry.registryId,
        campaignId: before.registry.campaignId,
        campaignRevision: before.registry.campaignRevision,
        namespace: before.registry.namespace,
        owners,
      },
      this.digest,
    );
  }

  prepare(
    input: CampaignManifestSaveInput,
  ): readonly CampaignManifestNativeWrite[] {
    const before = parseCampaignRuntimeManifest(
      input.beforeManifestBytes,
      this.digest,
    );
    if (exact(before.registry.owners) !== exact(input.beforeOwners))
      throw new Error(
        "Before-Ownerprojektion passt nicht zum Campaignmanifest.",
      );
    if (!Array.isArray(input.nativeWrites) || !Array.isArray(input.afterOwners) ||
        input.afterFiles !== undefined && !Array.isArray(input.afterFiles) ||
        input.afterRecords !== undefined && !Array.isArray(input.afterRecords))
      throw new Error("Unvollständiger Campaign-Save-Vertrag.");
    const nativeWrites = snapshot(input.nativeWrites),
      afterOwners = snapshot(input.afterOwners),
      requestedFiles = snapshot(input.afterFiles ?? before.atlas.files),
      requestedRecords = snapshot(input.afterRecords ?? before.atlas.records),
      expectedPaths = new Set(before.atlas.files.map((file) => file.path)),
      requestedByPath = new Map<string, CampaignRuntimeManifestV1["atlas"]["files"][number]>(),
      byPath = new Map<string, CampaignManifestNativeWrite>();
    for (const file of requestedFiles) requestedByPath.set(file.path, file);
    if (requestedByPath.size !== requestedFiles.length)
      throw new Error("Post-Save-Atlasbestand ist doppelt.");
    for (const write of nativeWrites) {
      safePath(write.path);
      if (!requestedByPath.has(write.path) || byPath.has(write.path))
        throw new Error("Fremdes oder doppeltes natives Speicherziel.");
      if (expectedPaths.has(write.path) && (write.before === null || write.after === null))
        throw new Error(
          "Bestätigte native Datei darf nicht erzeugt oder gelöscht werden.",
        );
      byPath.set(write.path, write);
    }
    if (byPath.size !== requestedByPath.size)
      throw new Error(
        "Native Speicherziele decken den Post-Save-Atlasbestand nicht exakt.",
      );
    const changedFiles = new Set<string>();
    const files = before.atlas.files.map((file) => {
      const write = byPath.get(file.path)!;
      const requested = requestedByPath.get(file.path);
      if (!requested || requested.kind !== file.kind || requested.id !== file.id)
        throw new Error("Bestätigte Atlasdateibindung wurde verändert.");
      if (
        file.savedDigest === null ||
        payloadDigest(this.digest(write.before!)) !== file.savedDigest
      )
        throw new Error("Native Atlasdatei passt nicht zur Campaignbasis.");
      if (write.before !== write.after) changedFiles.add(file.path);
      return Object.freeze({
        ...file,
        savedDigest: payloadDigest(this.digest(write.after!)),
      });
    });
    const additions = requestedFiles
      .filter((file) => !expectedPaths.has(file.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    for (const file of additions) {
      const write = byPath.get(file.path)!;
      if (file.kind !== "location" || file.id === null || write.before !== null || write.after === null)
        throw new Error("Nur eine autorisierte neue Locationdatei darf den Campaignbestand erweitern.");
      changedFiles.add(file.path);
      files.push(Object.freeze({ ...file, savedDigest: payloadDigest(this.digest(write.after)) }));
    }
    for (const oldRecord of before.atlas.records) {
      const next = requestedRecords.find((record) => record.id === oldRecord.id);
      if (!next || exact(next) !== exact(oldRecord))
        throw new Error("Bestehender Atlasrecord wurde im lokalen Save verändert.");
    }
    if (new Set(requestedRecords.map((record) => record.id)).size !== requestedRecords.length)
      throw new Error("Post-Save-Atlasrecords sind doppelt.");
    const owners = this.authorizedOwners(
      "prepare",
      before,
      files,
      requestedRecords,
      afterOwners,
      nativeWrites,
      changedFiles,
    );
    if (!changedFiles.size) {
      return Object.freeze([]);
    }
    const registryRevision = this.registryRevision(before, owners);
    if (registryRevision === before.registry.registryRevision)
      throw new Error(
        "Geänderter Registryinhalt benötigt eine frische Revision.",
      );
    const unsignedRegistry = {
      version: before.registry.version,
      registryId: before.registry.registryId,
      registryRevision,
      campaignId: before.registry.campaignId,
      campaignRevision: before.registry.campaignRevision,
      namespace: before.registry.namespace,
      owners: Object.freeze(owners),
    };
    const candidate = parseCampaignRuntimeManifest(
      JSON.stringify({
        version: 1,
        snapshot: before.snapshot,
        registry: {
          ...unsignedRegistry,
          registryContentDigest: campaignOwnershipDigestValue(
            unsignedRegistry,
            this.digest,
          ),
        },
        atlas: { ...before.atlas, files, records: requestedRecords },
      }),
      this.digest,
    );
    if (exact(before.snapshot) !== exact(candidate.snapshot) ||
        before.registry.registryId !== candidate.registry.registryId ||
        before.atlas.worldId !== candidate.atlas.worldId)
      throw new Error(
        "Campaignmanifest-Closure wurde im lokalen Save verändert.",
      );
    return Object.freeze([
      {
        path: this.manifestPath,
        before: input.beforeManifestBytes,
        after: serialize(candidate, this.digest),
      },
    ]);
  }

  createAcknowledgment(input: CampaignManifestSaveAcknowledgmentInput): CampaignRuntimeSaveAcknowledgmentV1 {
    if (!input || !["prepared", "committed"].includes(input.journal.state))
      throw new Error("Campaign-Save-Acknowledgment benötigt ein vorbereitetes oder gewonnenes Journal.");
    const transactionId = revisionToken(input.journal.transactionId, "Transaktions-ID");
    this.validateRecovery(input.journal);
    const manifestWrites = input.journal.writes.filter((write) => this.owns(write.path));
    if (manifestWrites.length !== 1)
      throw new Error("Campaign-Save-Acknowledgment benötigt genau einen Manifestwrite.");
    const write = manifestWrites[0]!;
    if (write.before === null || write.after === null)
      throw new Error("Campaign-Save-Acknowledgment besitzt keine exakten Manifestbytes.");
    const before = parseCampaignRuntimeManifest(write.before, this.digest);
    if (!sameSnapshot(before.snapshot, input.context))
      throw new Error("Campaign-Save-Acknowledgment gehört zu einem fremden Context.");
    const candidate = campaignDomainOwnershipProjection({ version: 1,
      registryId: before.registry.registryId, registryRevision: before.registry.registryRevision,
      projectionDigest: `sha256:${"0".repeat(64)}`, context: input.context, owners: before.registry.owners });
    const expected = campaignDomainOwnershipProjection({ ...candidate,
      projectionDigest: campaignDomainOwnershipProjectionDigest(candidate, this.digest) });
    if (exact(expected) !== exact(input.beforeRegistry))
      throw new Error("Campaign-Save-Acknowledgment besitzt eine fremde Registrybasis.");
    const proof = immutable({ version: 1 as const, transactionId, manifestPath: this.manifestPath,
      beforeManifestBytes: write.before, afterManifestBytes: write.after,
      context: input.context, beforeRegistry: input.beforeRegistry, journal: input.journal });
    this.acknowledgments.add(proof);
    return proof;
  }

  validateAcknowledgment(proof: CampaignRuntimeSaveAcknowledgmentV1): void {
    if (!this.acknowledgments.has(proof))
      throw new Error("Campaign-Save-Acknowledgment wurde nicht vom zuständigen Participant ausgestellt.");
  }

  createRollbackAcknowledgment(input: CampaignManifestSaveRollbackInput): CampaignRuntimeSaveRollbackV1 {
    if (!input || !this.rollbackAuthority)
      throw new Error("Campaign-Save-Rollback besitzt keine autoritative Rollback-Quelle.");
    this.rollbackAuthority.validateRollbackReceipt(input.receipt);
    if (input.receipt.outcome !== "rolled_back" || input.receipt.journalState !== "absent")
      throw new Error("Campaign-Save-Rollback benötigt einen terminalen Rollback mit entferntem Journal.");
    this.validateAcknowledgment(input.prepared);
    if (input.prepared.journal.state !== "prepared")
      throw new Error("Campaign-Save-Rollback gehört zu keinem vorbereiteten Save.");
    if (input.receipt.transactionId !== input.prepared.transactionId)
      throw new Error("Campaign-Save-Rollback gehört zu einer fremden Transaktion.");
    const restored = new Set<string>();
    for (const write of input.receipt.writes) {
      safePath(write.path);
      if (restored.has(write.path)) throw new Error("Campaign-Save-Rollback enthält ein doppeltes Ziel.");
      restored.add(write.path);
    }
    if (input.receipt.writes.length !== input.prepared.journal.writes.length ||
        input.prepared.journal.writes.some((write, index) =>
          input.receipt.writes[index]?.path !== write.path || input.receipt.writes[index]?.before !== write.before ||
          input.receipt.writes[index]?.after !== write.after || input.receipt.writes[index]?.current !== write.before))
      throw new Error("Campaign-Save-Rollback bestätigt nicht alle ursprünglichen Bytes.");
    const proof = immutable({ version: 1 as const, transactionId: input.prepared.transactionId,
      prepared: input.prepared, receipt: input.receipt });
    this.rollbacks.add(proof);
    return proof;
  }

  validateRollback(proof: CampaignRuntimeSaveRollbackV1): void {
    if (!this.rollbacks.has(proof))
      throw new Error("Campaign-Save-Rollback wurde nicht vom zuständigen Participant ausgestellt.");
  }

  validateRecovery(journal: CampaignManifestRecoveryJournal): void {
    if (!journal || !Array.isArray(journal.writes))
      throw new Error("Ungültiges Campaignjournal.");
    const paths = new Set<string>();
    for (const write of journal.writes) {
      safePath(write.path);
      if (paths.has(write.path))
        throw new Error("Doppeltes Campaignjournalziel.");
      paths.add(write.path);
    }
    const manifestWrites = journal.writes.filter((write) =>
      this.owns(write.path),
    );
    if (manifestWrites.length > 1)
      throw new Error("Campaignmanifest ist im Journal doppelt.");
    const manifestWrite = manifestWrites[0];
    if (!manifestWrite) {
      if (
        journal.writes.length > 1 ||
        journal.writes.some((write) => !write.path.endsWith(".overworld.draft"))
      )
        throw new Error("Natives Campaignjournal enthält kein Manifestziel.");
      return;
    }
    if (manifestWrite.before === null || manifestWrite.after === null)
      throw new Error(
        "Campaignmanifest darf nicht erzeugt oder gelöscht werden.",
      );
    const before = parseCampaignRuntimeManifest(
        manifestWrite.before,
        this.digest,
      ),
      after = parseCampaignRuntimeManifest(manifestWrite.after, this.digest);
    if (exact(before.snapshot) !== exact(after.snapshot) ||
        before.registry.registryId !== after.registry.registryId ||
        before.atlas.worldId !== after.atlas.worldId)
      throw new Error(
        "Campaignmanifest-Closure wurde im Recoveryjournal verändert.",
      );
    const beforeByPath = new Map(before.atlas.files.map((file) => [file.path, file])),
      afterByPath = new Map(after.atlas.files.map((file) => [file.path, file]));
    for (const oldFile of before.atlas.files) {
      const next = afterByPath.get(oldFile.path);
      if (!next || next.kind !== oldFile.kind || next.id !== oldFile.id)
        throw new Error("Bestehende Atlasdateibindung wurde im Recoveryjournal verändert.");
    }
    for (const oldRecord of before.atlas.records) {
      const next = after.atlas.records.find((record) => record.id === oldRecord.id);
      if (!next || exact(next) !== exact(oldRecord))
        throw new Error("Bestehender Atlasrecord wurde im Recoveryjournal verändert.");
    }
    const filePaths = new Set(after.atlas.files.map((file) => file.path)),
      worldFile = before.atlas.files.find(
        (file) => file.kind === "world" && file.id === before.atlas.worldId,
      ),
      draftPath = worldFile ? `${worldFile.path}.draft` : "",
      nativeWrites = snapshot(journal.writes.filter((write) =>
        filePaths.has(write.path),
      )),
      changedFiles = new Set(
        after.atlas.files
          .filter((file) => beforeByPath.get(file.path)?.savedDigest !== file.savedDigest)
          .map((file) => file.path),
      );
    if (!changedFiles.size)
      throw new Error("Campaign-Recoveryjournal enthält keinen nativen Save.");
    if (
      journal.writes.some(
        (write) =>
          write.path !== this.manifestPath &&
          write.path !== draftPath &&
          !changedFiles.has(write.path),
      )
    )
      throw new Error("Campaign-Recoveryjournal enthält ein fremdes Ziel.");
    if (
      nativeWrites.length !== changedFiles.size ||
      nativeWrites.some((write) => !changedFiles.has(write.path))
    )
      throw new Error(
        "Campaign-Recoveryjournal deckt die nativen Änderungen nicht exakt.",
      );
    for (const write of nativeWrites) {
      const oldFile = beforeByPath.get(write.path),
        newFile = after.atlas.files.find((file) => file.path === write.path)!;
      if (write.after === null ||
          (oldFile
            ? write.before === null || oldFile.savedDigest !== payloadDigest(this.digest(write.before))
            : newFile.kind !== "location" || newFile.id === null || write.before !== null) ||
          newFile.savedDigest !== payloadDigest(this.digest(write.after)))
        throw new Error(
          "Campaign-Recoveryjournal besitzt falsche native Bytes.",
        );
    }
    const owners = this.authorizedOwners(
      "recovery",
      before,
      after.atlas.files,
      after.atlas.records,
      after.registry.owners,
        nativeWrites,
        changedFiles,
      ),
      expectedRevision = this.registryRevision(before, owners);
    if (
      expectedRevision === before.registry.registryRevision ||
      after.registry.registryRevision !== expectedRevision ||
      serialize(after, this.digest) !== manifestWrite.after
    )
      throw new Error("Campaignmanifest passt nicht zum nativen Journal.");
  }
}
