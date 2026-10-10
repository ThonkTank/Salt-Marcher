import { isStructuredRoom, parseDocument } from "../../model";
import { parseCityDocument } from "../city/codec";
import { parseLocationDocument } from "../location/location-schema";
import {
  campaignOwnershipDigestValue,
  type CampaignDomainOwnerProjectionV1,
  type CampaignOwnershipDigest,
  type CampaignDomainOwnershipProjectionV1,
} from "../campaign/campaign-ownership";
import {
  parseCampaignRuntimeManifest,
  type CampaignRuntimeManifestV1,
  type CampaignRuntimeSaveAcknowledgmentV1,
  type CampaignRuntimeSaveRollbackV1,
} from "../campaign/campaign-runtime-source";
import {
  CampaignRuntimeManifestSaveParticipant,
  type CampaignRuntimeOwnerSaveAuthority,
} from "../campaign/campaign-runtime-save-participant";
import { payloadDigest, type CampaignContextProjection } from "../campaign/campaign-contracts";
import type { FileStore } from "../../persistence";
import { parseAtlasDraft } from "./atlas-draft";
import type { AtlasNativeFile } from "./atlas-campaign-source";
import type { AtlasFileJournal, AtlasFileWrite, FileTransaction, AtlasFileTransactionObserver } from "./file-transaction";
import { parseSpatialWorld } from "./spatial-schema";

const exact = (value: unknown) => JSON.stringify(value);
type RecordBinding = { ownerId: string; kind: string; path: string };
export interface AtlasCampaignRuntimeSavePort {
  basis(): Promise<{ context: CampaignContextProjection; projection: CampaignDomainOwnershipProjectionV1 }>;
  issued(participant: CampaignRuntimeManifestSaveParticipant, proof: CampaignRuntimeSaveAcknowledgmentV1 | CampaignRuntimeSaveRollbackV1): void;
  prepared(proof: CampaignRuntimeSaveAcknowledgmentV1): void;
  committed(proof: CampaignRuntimeSaveAcknowledgmentV1): Promise<void>;
  rolledBack(proof: CampaignRuntimeSaveRollbackV1): void;
}

/** The explicit native-atlas/city/dungeon proof protocol supplied by PR32. No owner discovery. */
function records(
  files: readonly AtlasNativeFile[],
  side: "before" | "after",
): Map<string, RecordBinding> {
  const result = new Map<string, RecordBinding>();
  const add = (id: string, ownerId: string, kind: string, path: string) => {
    if (result.has(id)) throw new Error("Mehrdeutige native Save-Kennung.");
    result.set(id, { ownerId, kind, path });
  };
  for (const file of files) {
    const bytes = file[side];
    if (bytes === null)
      throw new Error(
        "Bestätigter Campaignbestand darf nicht erweitert oder gelöscht werden.",
      );
    switch (file.kind) {
      case "world": {
        const doc = parseSpatialWorld(bytes);
        if (doc.id !== file.id)
          throw new Error("Fremde Weltkennung im Campaign-Save.");
        add(doc.id, "atlas", "world", file.path);
        for (const p of doc.placements)
          add(p.id, "atlas", "location-placement", file.path);
        if (doc.version === 2)
          for (const p of doc.detailPlacements)
            add(p.id, "atlas", p.kind + "-placement", file.path);
        break;
      }
      case "location": {
        const doc = parseLocationDocument(bytes);
        if (doc.id !== file.id)
          throw new Error("Fremde Ortskennung im Campaign-Save.");
        add(doc.id, "atlas", "location", file.path);
        for (const s of doc.sections)
          add(s.id, "atlas", "location-section", file.path);
        break;
      }
      case "city": {
        const doc = parseCityDocument(bytes);
        if (doc.id !== file.id)
          throw new Error("Fremde Stadtkennung im Campaign-Save.");
        add(doc.id, "city", "city", file.path);
        for (const [kind, values] of [
          ["road-node", doc.roadNodes],
          ["road", doc.roads],
          ["plaza", doc.plazas],
          ["plot", doc.plots],
          ["district", doc.districts],
          ["building", doc.buildings],
        ] as const)
          for (const value of values) add(value.id, "city", kind, file.path);
        break;
      }
      case "dungeon": {
        const doc = parseDocument(bytes);
        if (doc.id !== file.id)
          throw new Error("Fremde Dungeonkennung im Campaign-Save.");
        add(doc.id, "dungeon", "dungeon", file.path);
        for (const f of doc.floors) add(f.id, "dungeon", "floor", file.path);
        for (const e of doc.entities)
          if (isStructuredRoom(e)) {
            add(e.id, "dungeon", "room", file.path);
            for (const s of e.key.sections)
              add(s.id, "dungeon", "room-section", file.path);
          }
        for (const r of doc.content.routes)
          add(r.id, "dungeon", "route", file.path);
        break;
      }
      case "terrain":
        break; // Native terrain codecs and World closure are co-validated by Repository.
    }
  }
  return result;
}

/** Thin native-owner adapter for the already authorized, immutable Campaign closure. */
export class AtlasCampaignManifestSave {
  private manifestBytes: string;
  private recoveryManifest?: string;
  private saveParticipant?: CampaignRuntimeManifestSaveParticipant;
  readonly worldPath: string;
  readonly draftPath: string;
  readonly additionalLocations: readonly { id: string; path: string }[];
  constructor(
    readonly manifestPath: string,
    manifestBytes: string,
    private readonly digest: CampaignOwnershipDigest,
    private readonly runtime?: AtlasCampaignRuntimeSavePort,
  ) {
    this.manifestBytes = manifestBytes;
    const manifest = parseCampaignRuntimeManifest(manifestBytes, digest);
    this.worldPath = manifest.atlas.files.find(
      (f) => f.kind === "world" && f.id === manifest.atlas.worldId,
    )!.path;
    this.draftPath = this.worldPath + ".draft";
    this.additionalLocations = manifest.atlas.files
      .filter((f) => f.kind === "location")
      .map((f) => ({ id: f.id!, path: f.path }));
    // The Campaign participant itself validates the exact claimed manifest root.
    new CampaignRuntimeManifestSaveParticipant(manifestPath, digest, []);
  }
  owns(path: string): boolean {
    return path === this.manifestPath;
  }

  private owners(
    manifest: CampaignRuntimeManifestV1,
    files: readonly AtlasNativeFile[],
    side: "before" | "after",
  ): readonly CampaignDomainOwnerProjectionV1[] {
    const byId = records(files, side),
      byPath = new Map(files.map((f) => [f.path, f]));
    const ownerIds = manifest.registry.owners.map((o) => o.ownerId).sort();
    if (exact(ownerIds) !== exact(["atlas", "city", "dungeon"]))
      throw new Error("Kein autorisierter nativer Owner-Save-Vertrag.");
    if (
      byId.size !==
      manifest.registry.owners.reduce((n, o) => n + o.records.length, 0)
    )
      throw new Error(
        "Native Recordclosure stimmt nicht mit dem autorisierten Campaignbestand überein.",
      );
    const fileDigest = (path: string) =>
      payloadDigest(this.digest(byPath.get(path)![side]!));
    const worldDigest = campaignOwnershipDigestValue(
      {
        schema: "campaign-runtime-world-file-closure-v1",
        world: fileDigest(this.worldPath),
        terrain: manifest.atlas.files
          .filter((f) => f.kind === "terrain")
          .map((f) => ({ path: f.path, savedDigest: fileDigest(f.path) }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      },
      this.digest,
    );
    return manifest.registry.owners.map((owner) => {
      if (
        owner.source.adapterType !== `native-${owner.ownerId}` ||
        owner.schemaRevision !== `schema:${owner.ownerId}:e2e01` ||
        owner.policyRevision !== `policy:${owner.ownerId}:e2e01` ||
        exact(owner.referenceSchemas) !== exact(["atlas.e2e01.v1"])
      )
        throw new Error(
          "Nicht unterstützter autorisierter Owner-Save-Vertrag.",
        );
      const nextRecords = owner.records.map((r) => {
        const binding = byId.get(String(r.id));
        if (
          !binding ||
          binding.ownerId !== owner.ownerId ||
          binding.kind !== r.recordType
        )
          throw new Error(
            "Campaignrecord gehört keinem passenden nativen Owner.",
          );
        return {
          ...r,
          payloadDigest:
            binding.kind === "world" ? worldDigest : fileDigest(binding.path),
        };
      });
      const suffix = campaignOwnershipDigestValue(
        {
          schema: "campaign-runtime-owner-fixture-v1",
          ownerId: owner.ownerId,
          records: nextRecords.map(({ id, payloadDigest }) => ({
            id,
            payloadDigest,
          })),
        },
        this.digest,
      ).slice("sha256:".length);
      return {
        ...owner,
        records: nextRecords,
        ownerRevision: `owner:${suffix}`,
        snapshotRevision: `snapshot:${suffix}`,
        source: { ...owner.source, generation: `source:${suffix}` },
      };
    });
  }
  private participant(
    before: CampaignRuntimeManifestV1,
    files: readonly AtlasNativeFile[],
    transaction?: FileTransaction,
  ) {
    const beforeOwners = this.owners(before, files, "before"),
      afterOwners = this.owners(before, files, "after");
    if (exact(beforeOwners) !== exact(before.registry.owners))
      throw new Error("Native Before-Ownerbelege sind veraltet oder erfunden.");
    const authorities: CampaignRuntimeOwnerSaveAuthority[] = beforeOwners.map(
      (owner, index) => ({
        ownerId: owner.ownerId,
        verify: ({ beforeOwner, afterOwner, beforeFiles, afterFiles }) => {
          if (
            exact(beforeOwner) !== exact(owner) ||
            exact(afterOwner) !== exact(afterOwners[index]) ||
            beforeFiles.some(
              (f) =>
                f.savedDigest !==
                this.digest(files.find((w) => w.path === f.path)!.before!),
            ) ||
            afterFiles.some(
              (f) =>
                f.savedDigest !==
                this.digest(files.find((w) => w.path === f.path)!.after!),
            )
          )
            throw new Error(
              "Ownerprojektion ist nicht durch die exakten nativen Guards autorisiert.",
            );
        },
      }),
    );
    return {
      participant: new CampaignRuntimeManifestSaveParticipant(
        this.manifestPath,
        this.digest,
        authorities,
        transaction,
      ),
      beforeOwners,
      afterOwners,
    };
  }
  prepare(
    files: readonly AtlasNativeFile[],
    draft: AtlasFileWrite,
    transaction?: FileTransaction,
  ): readonly AtlasFileWrite[] {
    const before = parseCampaignRuntimeManifest(
      this.manifestBytes,
      this.digest,
    );
    this.checkFiles(before, files);
    this.checkDraft(draft, files);
    const { participant, beforeOwners, afterOwners } = this.participant(
      before,
      files,
      transaction,
    );
    const result = participant.prepare({
      beforeManifestBytes: this.manifestBytes,
      nativeWrites: files,
      beforeOwners,
      afterOwners,
    });
    this.saveParticipant = result.length ? participant : undefined;
    // Even a no-op save guards the manifest baseline alongside all native files.
    return result.length
      ? result
      : [
          {
            path: this.manifestPath,
            before: this.manifestBytes,
            after: this.manifestBytes,
          },
        ];
  }
  /** The actual transaction owns journal read-back and rollback receipt issuance. */
  transactionObserver(): AtlasFileTransactionObserver | undefined {
    const participant = this.saveParticipant, runtime = this.runtime;
    if (!participant || !runtime) return undefined;
    let basis: Awaited<ReturnType<AtlasCampaignRuntimeSavePort['basis']>> | undefined;
    let prepared: CampaignRuntimeSaveAcknowledgmentV1 | undefined;
    const proof = (journal: AtlasFileJournal) => {
      if (!basis) throw new Error("Speicherbestätigung besitzt keine bestätigte Registrybasis.");
      const value = participant.createAcknowledgment({ context: basis.context, beforeRegistry: basis.projection, journal });
      runtime.issued(participant, value);
      return value;
    };
    return {
      prepared: async (journal) => {
        basis = await runtime.basis();
        prepared = proof(journal);
        runtime.prepared(prepared);
      },
      committed: async (journal) => {
        if (!prepared) throw new Error("Commit besitzt keine ursprüngliche Vorbereitung.");
        await runtime.committed(proof(journal));
      },
      rolledBack: (receipt) => {
        if (!prepared) return;
        const rollback = participant.createRollbackAcknowledgment({ prepared, receipt });
        runtime.issued(participant, rollback);
        runtime.rolledBack(rollback);
      },
    };
  }
  private checkFiles(
    manifest: CampaignRuntimeManifestV1,
    files: readonly AtlasNativeFile[],
  ): void {
    if (
      new Set(files.map((f) => f.path)).size !== files.length ||
      files.length !== manifest.atlas.files.length
    )
      throw new Error(
        "Campaign-Save benötigt den vollständigen nativen Bestand.",
      );
    for (const f of manifest.atlas.files) {
      const w = files.find((w) => w.path === f.path);
      if (
        !w ||
        w.kind !== f.kind ||
        w.id !== f.id ||
        w.before === null ||
        w.after === null ||
        this.digest(w.before) !== f.savedDigest
      )
        throw new Error(
          "Native Guards passen nicht zur bestätigten Campaignbasis.",
        );
    }
  }
  private checkDraft(
    write: AtlasFileWrite,
    files: readonly AtlasNativeFile[],
  ): void {
    if (write.path !== this.draftPath)
      throw new Error("Fremder World-Draftpfad im Campaign-Save.");
    const world = files.find((f) => f.path === this.worldPath)!;
    for (const text of [write.before, write.after])
      if (text !== null) {
        const draft = parseAtlasDraft(text);
        if (draft.worldId !== world.id || draft.baselineWorld !== world.before)
          throw new Error(
            "World-Draft gehört nicht zur nativen Campaignbasis.",
          );
      }
  }
  async validateRecovery(
    store: FileStore,
    journal: AtlasFileJournal,
  ): Promise<void> {
    const manifestWrite = journal.writes.find((w) => this.owns(w.path));
    if (!manifestWrite) {
      if (
        journal.writes.length !== 1 ||
        journal.writes[0]!.path !== this.draftPath
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
    );
    const pinned = parseCampaignRuntimeManifest(
      this.manifestBytes,
      this.digest,
    );
    if (
      (this.manifestBytes !== manifestWrite.before &&
        this.manifestBytes !== manifestWrite.after) ||
      exact(before.snapshot) !== exact(pinned.snapshot) ||
      before.registry.registryId !== pinned.registry.registryId ||
      exact(before.atlas.files.map(({ savedDigest, ...file }) => file)) !==
        exact(pinned.atlas.files.map(({ savedDigest, ...file }) => file))
    )
      throw new Error("Fremde Campaignbindung im Atlasjournal.");
    const files: AtlasNativeFile[] = [];
    for (const f of before.atlas.files) {
      const w = journal.writes.find((w) => w.path === f.path);
      const bytes = w ? null : await store.read(f.path);
      files.push({
        ...f,
        before: w ? w.before : bytes,
        after: w ? w.after : bytes,
      });
    }
    this.checkFiles(before, files);
    const draft = journal.writes.find((w) => w.path === this.draftPath);
    if (draft) this.checkDraft(draft, files);
    this.participant(before, files).participant.validateRecovery(journal);
    this.recoveryManifest =
      journal.state === "committed"
        ? manifestWrite.after
        : manifestWrite.before;
  }
  /** Called only after this same journal has completed or recovered its won canonical save. */
  saved(writes: readonly AtlasFileWrite[]): void {
    const write = writes.find((w) => this.owns(w.path));
    if (write?.after !== null && write?.after !== undefined)
      this.manifestBytes = write.after;
    this.recoveryManifest = undefined;
  }
  async recovered(store: FileStore): Promise<void> {
    const bytes = await store.read(this.manifestPath);
    if (bytes === null)
      throw new Error("Campaignmanifest fehlt nach Wiederherstellung.");
    if (bytes !== (this.recoveryManifest ?? this.manifestBytes))
      throw new Error(
        "Campaignmanifest stimmt nicht mit dem aufgelösten Journal überein.",
      );
    const before = parseCampaignRuntimeManifest(
        this.manifestBytes,
        this.digest,
      ),
      after = parseCampaignRuntimeManifest(bytes, this.digest);
    if (
      exact(before.snapshot) !== exact(after.snapshot) ||
      before.registry.registryId !== after.registry.registryId
    )
      throw new Error(
        "Campaignbindung hat sich während der Wiederherstellung geändert.",
      );
    this.manifestBytes = bytes;
    this.recoveryManifest = undefined;
  }
}
