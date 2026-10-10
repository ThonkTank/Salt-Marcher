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
} from "./campaign-runtime-source";

export interface CampaignManifestNativeWrite {
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
}
export interface CampaignManifestSaveInput {
  readonly beforeManifestBytes: string;
  readonly nativeWrites: readonly CampaignManifestNativeWrite[];
  /** Full projections supplied by their actual owners, never inferred from file bytes. */
  readonly beforeOwners: readonly CampaignDomainOwnerProjectionV1[];
  readonly afterOwners: readonly CampaignDomainOwnerProjectionV1[];
}
export interface CampaignManifestRecoveryJournal {
  readonly writes: readonly CampaignManifestNativeWrite[];
}
export interface CampaignManifestSaveAcknowledgmentInput {
  readonly context: CampaignContextProjection;
  readonly beforeRegistry: CampaignDomainOwnershipProjectionV1;
  readonly journal: CampaignRuntimeSaveJournal;
}
export interface CampaignRuntimeOwnerSaveAuthority {
  readonly ownerId: string;
  /** Deterministic owner adapter; it must bind every record proof to these exact native guards. */
  verify(input: {
    readonly beforeOwner: CampaignDomainOwnerProjectionV1;
    readonly afterOwner: CampaignDomainOwnerProjectionV1;
    readonly beforeFiles: CampaignRuntimeManifestV1["atlas"]["files"];
    readonly afterFiles: CampaignRuntimeManifestV1["atlas"]["files"];
    readonly nativeWrites: readonly CampaignManifestNativeWrite[];
  }): void;
}

function exact(value: unknown): string {
  return JSON.stringify(value);
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
function payloads(owner: CampaignDomainOwnerProjectionV1): unknown {
  return owner.records.map(({ id, payloadDigest: digest }) => ({
    id,
    payloadDigest: digest,
  }));
}
function immutableManifestClosure(
  manifest: CampaignRuntimeManifestV1,
): unknown {
  return {
    snapshot: manifest.snapshot,
    registry: {
      version: manifest.registry.version,
      registryId: manifest.registry.registryId,
      campaignId: manifest.registry.campaignId,
      campaignRevision: manifest.registry.campaignRevision,
      namespace: manifest.registry.namespace,
      owners: manifest.registry.owners.map(ownerClosure),
    },
    atlas: {
      worldId: manifest.atlas.worldId,
      files: manifest.atlas.files.map(({ kind, id, path }) => ({
        kind,
        id,
        path,
      })),
      records: manifest.atlas.records,
    },
  };
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
  constructor(
    manifestPath: string,
    private readonly digest: CampaignOwnershipDigest,
    private readonly authorities: readonly CampaignRuntimeOwnerSaveAuthority[],
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
    before: CampaignRuntimeManifestV1,
    afterFiles: CampaignRuntimeManifestV1["atlas"]["files"],
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
      if (!next || exact(ownerClosure(oldOwner)) !== exact(ownerClosure(next)))
        throw new Error("Owner-Closure wurde im lokalen Save verändert.");
      const payloadChanged =
        exact(payloads(oldOwner)) !== exact(payloads(next));
      if (!payloadChanged) {
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
      authorityById.get(oldOwner.ownerId)!.verify({
        beforeOwner: oldOwner,
        afterOwner: next,
        beforeFiles: before.atlas.files,
        afterFiles,
        nativeWrites,
      });
      return next;
    });
    const expectedChangedOwners = new Set<string>();
    for (const file of before.atlas.files) {
      if (!changedFiles.has(file.path)) continue;
      if (file.kind === "terrain") {
        const world = before.atlas.records.find(
          (record) =>
            record.kind === "world" && record.id === before.atlas.worldId,
        );
        if (world) expectedChangedOwners.add(world.ownerId);
      } else {
        for (const record of before.atlas.records)
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
    if (!Array.isArray(input.nativeWrites) || !Array.isArray(input.afterOwners))
      throw new Error("Unvollständiger Campaign-Save-Vertrag.");
    const expectedPaths = new Set(before.atlas.files.map((file) => file.path)),
      byPath = new Map<string, CampaignManifestNativeWrite>();
    for (const write of input.nativeWrites) {
      safePath(write.path);
      if (!expectedPaths.has(write.path) || byPath.has(write.path))
        throw new Error("Fremdes oder doppeltes natives Speicherziel.");
      if (write.before === null || write.after === null)
        throw new Error(
          "Bestätigte native Datei darf nicht erzeugt oder gelöscht werden.",
        );
      byPath.set(write.path, write);
    }
    if (byPath.size !== expectedPaths.size)
      throw new Error(
        "Native Speicherziele decken das Campaignmanifest nicht exakt.",
      );
    const changedFiles = new Set<string>();
    const files = before.atlas.files.map((file) => {
      const write = byPath.get(file.path)!;
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
    const owners = this.authorizedOwners(
      before,
      files,
      input.afterOwners,
      input.nativeWrites,
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
        atlas: { ...before.atlas, files },
      }),
      this.digest,
    );
    if (
      exact(immutableManifestClosure(before)) !==
      exact(immutableManifestClosure(candidate))
    )
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
    if (
      exact(immutableManifestClosure(before)) !==
      exact(immutableManifestClosure(after))
    )
      throw new Error(
        "Campaignmanifest-Closure wurde im Recoveryjournal verändert.",
      );
    const filePaths = new Set(before.atlas.files.map((file) => file.path)),
      worldFile = before.atlas.files.find(
        (file) => file.kind === "world" && file.id === before.atlas.worldId,
      ),
      draftPath = worldFile ? `${worldFile.path}.draft` : "",
      nativeWrites = journal.writes.filter((write) =>
        filePaths.has(write.path),
      ),
      changedFiles = new Set(
        before.atlas.files
          .filter(
            (file, index) =>
              file.savedDigest !== after.atlas.files[index]!.savedDigest,
          )
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
      const oldFile = before.atlas.files.find(
          (file) => file.path === write.path,
        )!,
        newFile = after.atlas.files.find((file) => file.path === write.path)!;
      if (
        write.before === null ||
        write.after === null ||
        oldFile.savedDigest !== payloadDigest(this.digest(write.before)) ||
        newFile.savedDigest !== payloadDigest(this.digest(write.after))
      )
        throw new Error(
          "Campaign-Recoveryjournal besitzt falsche native Bytes.",
        );
    }
    const owners = this.authorizedOwners(
        before,
        after.atlas.files,
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
