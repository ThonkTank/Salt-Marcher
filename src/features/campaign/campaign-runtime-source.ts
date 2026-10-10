import { immutable, safePath } from "../../model";
import type {
  AtlasConfirmedInventory,
  AtlasInventoryPort,
  AtlasNavigationKind,
} from "../atlas/atlas-campaign-navigation";
import { nativeArray, nativeId, nativeRecord } from "../atlas/native-values";
import {
  campaignContext,
  campaignContextToken,
  campaignCommandId,
  campaignId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
  payloadDigest,
  revisionToken,
  sameSnapshot,
  type CampaignContextProjection,
  type CampaignCommandId,
  type CampaignId,
  type CampaignSnapshotV1,
} from "./campaign-contracts";
import {
  CampaignLifecycle,
  type CampaignActivationResult,
  CampaignLifecyclePort,
  CampaignMutationRequest,
  CampaignPortOutcome,
} from "./campaign-lifecycle";
import {
  campaignDomainOwnershipProjection,
  campaignDomainOwnershipProjectionDigest,
  campaignDomainOwnerPolicyDigest,
  campaignOwnershipDigestValue,
  type CampaignDomainOwnerProjectionV1,
  type CampaignDomainOwnershipProjectionV1,
  type CampaignOwnerRegistryPort,
  type CampaignOwnershipDigest,
} from "./campaign-ownership";

const PLACEHOLDER_DIGEST = `sha256:${"0".repeat(64)}`;
const navigationKinds: readonly AtlasNavigationKind[] = [
  "world", "location", "location-section", "city", "building",
  "dungeon", "room", "room-section",
];

export interface CampaignRuntimeRegistryV1 {
  readonly version: 1;
  readonly registryId: string;
  readonly registryRevision: string;
  readonly campaignId: CampaignId;
  readonly campaignRevision: number;
  readonly namespace: string;
  readonly owners: readonly CampaignDomainOwnerProjectionV1[];
  readonly registryContentDigest: string;
}
export interface CampaignRuntimeManifestV1 {
  readonly version: 1;
  readonly snapshot: CampaignSnapshotV1;
  readonly registry: CampaignRuntimeRegistryV1;
  readonly atlas: {
    readonly worldId: string;
    readonly files: AtlasConfirmedInventory["files"];
    readonly records: AtlasConfirmedInventory["records"];
  };
}
export interface CampaignRuntimeFile {
  readonly path: string;
  readonly bytes: string;
}
export interface CampaignRuntimeStorage {
  list(): Promise<readonly CampaignRuntimeFile[]>;
  subscribe?(changed: () => void): () => void;
}
export interface CampaignRuntimeEntry {
  readonly key: string;
  readonly campaignId: CampaignId | null;
  readonly name: string;
  readonly status: "available" | "trashed" | "unavailable";
  readonly reason: string | null;
}

interface LoadedManifest {
  readonly path: string;
  readonly bytes: string;
  readonly manifest: CampaignRuntimeManifestV1;
}
interface LoadedSet {
  readonly generation: number;
  readonly manifests: ReadonlyMap<CampaignId, LoadedManifest>;
  readonly entries: readonly CampaignRuntimeEntry[];
}

function checkedOwners(value: unknown): readonly CampaignDomainOwnerProjectionV1[] {
  return nativeArray(value).map((raw) => {
    const owner = nativeRecord(raw, ["ownerId", "ownerRevision", "schemaRevision", "snapshotRevision",
      "policyRevision", "policyDigest", "availability", "emptyConfirmed", "referenceSchemas", "source",
      "records", "transferPolicies"]);
    nativeRecord(owner.source, ["adapterType", "generation"]);
    for (const record of nativeArray(owner.records)) {
      const r = nativeRecord(record, ["id", "recordType", "references", "payloadDigest", "media"]);
      for (const reference of nativeArray(r.references)) nativeRecord(reference, ["id", "scope", "schema"]);
      if (r.media !== null) nativeRecord(r.media, ["metadataDigest", "byteDigest"]);
    }
    for (const policy of nativeArray(owner.transferPolicies))
      nativeRecord(policy, ["recordId", "transfer", "sourceDisposition"]);
    return owner as unknown as CampaignDomainOwnerProjectionV1;
  });
}
function checkedRegistry(
  raw: unknown,
  snapshot: CampaignSnapshotV1,
  digest: CampaignOwnershipDigest,
): CampaignRuntimeRegistryV1 {
  const value = nativeRecord(raw, ["version", "registryId", "registryRevision", "campaignId",
    "campaignRevision", "namespace", "owners", "registryContentDigest"]);
  if (value.version !== 1 || campaignId(String(value.campaignId)) !== snapshot.campaignId ||
      campaignRevision(Number(value.campaignRevision)) !== snapshot.revision ||
      campaignNamespace(String(value.namespace)) !== snapshot.namespace)
    throw new Error("Registry gehört zu einer fremden Campaign.");
  const content = {
    version: 1 as const,
    registryId: revisionToken(String(value.registryId), "Registry-ID"),
    registryRevision: revisionToken(String(value.registryRevision), "Registry-Revision"),
    campaignId: snapshot.campaignId,
    campaignRevision: snapshot.revision,
    namespace: snapshot.namespace,
    owners: checkedOwners(value.owners),
  };
  const context = campaignContext(snapshot, campaignContextToken("runtime-validation"));
  const validated = campaignDomainOwnershipProjection({
    version: 1,
    registryId: content.registryId,
    registryRevision: content.registryRevision,
    projectionDigest: PLACEHOLDER_DIGEST,
    context,
    owners: content.owners,
  });
  for (const owner of validated.owners)
    if (campaignDomainOwnerPolicyDigest(owner, digest) !== owner.policyDigest)
      throw new Error("Owner-Policy-Digest stimmt nicht.");
  const normalized = { ...content, owners: validated.owners };
  const expected = campaignOwnershipDigestValue(normalized, digest);
  if (payloadDigest(String(value.registryContentDigest)) !== expected)
    throw new Error("Registry-Content-Digest stimmt nicht.");
  return immutable({ ...normalized, registryContentDigest: expected });
}
function checkedAtlas(raw: unknown): CampaignRuntimeManifestV1["atlas"] {
  const value = nativeRecord(raw, ["worldId", "files", "records"]), worldId = nativeId(value.worldId);
  const paths = new Set<string>(), documentIds = new Set<string>();
  const files = nativeArray(value.files).map((rawFile) => {
    const file = nativeRecord(rawFile, ["kind", "id", "path", "savedDigest"]);
    if (!["world", "terrain", "location", "city", "dungeon"].includes(String(file.kind)) ||
        typeof file.path !== "string") throw new Error("Ungültige Atlasdatei im Campaignmanifest.");
    safePath(file.path);
    const id = file.id === null ? null : nativeId(file.id);
    if ((file.kind === "terrain") !== (id === null) || paths.has(file.path) || id !== null && documentIds.has(id))
      throw new Error("Doppelte oder fremde Atlasdatei im Campaignmanifest.");
    paths.add(file.path); if (id !== null) documentIds.add(id);
    return Object.freeze({ kind: file.kind as "world" | "terrain" | "location" | "city" | "dungeon",
      id, path: file.path, savedDigest: file.savedDigest === null ? null : payloadDigest(String(file.savedDigest)) });
  });
  const ids = new Set<string>();
  const records = nativeArray(value.records).map((rawRecord) => {
    const record = nativeRecord(rawRecord, ["id", "kind", "documentId", "ownerId", "availability"]),
      id = nativeId(record.id), documentId = nativeId(record.documentId), kind = record.kind as AtlasNavigationKind;
    if (ids.has(id) || !navigationKinds.includes(kind) || !documentIds.has(documentId) ||
        !["available", "retired", "unavailable"].includes(String(record.availability)))
      throw new Error("Ungültiger Atlasrecord im Campaignmanifest.");
    ids.add(id);
    return Object.freeze({ id, kind, documentId,
      ownerId: revisionToken(String(record.ownerId), "Owner-ID"),
      availability: record.availability as "available" | "retired" | "unavailable" });
  });
  if (!files.some((file) => file.kind === "world" && file.id === worldId) ||
      !records.some((record) => record.kind === "world" && record.id === worldId &&
        record.documentId === worldId && record.availability === "available"))
    throw new Error("Bestätigte Atlaswelt fehlt im Campaignmanifest.");
  return immutable({ worldId, files: Object.freeze(files), records: Object.freeze(records) });
}
export function parseCampaignRuntimeManifest(
  bytes: string,
  digest: CampaignOwnershipDigest,
): CampaignRuntimeManifestV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(bytes); } catch { throw new Error("Campaignmanifest ist kein gültiges JSON."); }
  const value = nativeRecord(parsed, ["version", "snapshot", "registry", "atlas"]);
  if (value.version !== 1) throw new Error("Unbekannte Campaignmanifest-Version.");
  const snapshot = campaignSnapshot(value.snapshot), registry = checkedRegistry(value.registry, snapshot, digest),
    atlas = checkedAtlas(value.atlas);
  for (const record of atlas.records) {
    const owner = registry.owners.find((candidate) => candidate.ownerId === record.ownerId),
      owned = owner?.records.find((candidate) => candidate.id === record.id);
    if (!owned || owned.recordType !== record.kind)
      throw new Error("Atlasrecord gehört keinem bestätigten Registryowner.");
  }
  const navigable = registry.owners.flatMap((owner) => owner.records
    .filter((record) => navigationKinds.includes(record.recordType as AtlasNavigationKind))
    .map((record) => `${owner.ownerId}:${record.recordType}:${record.id}`)).sort(),
    inventoried = atlas.records.map((record) => `${record.ownerId}:${record.kind}:${record.id}`).sort();
  if (navigable.length !== inventoried.length || navigable.some((value, index) => value !== inventoried[index]))
    throw new Error("Atlasinventar deckt die bestätigten Registryrecords nicht vollständig.");
  for (const file of atlas.files) {
    if (file.kind === "terrain") continue;
    if (file.id === null || !atlas.records.some((record) => record.documentId === file.id && record.kind === file.kind))
      throw new Error("Atlasmanifest enthält eine zusätzliche unregistrierte Datei.");
  }
  return immutable({ version: 1, snapshot, registry, atlas });
}

export class CampaignRuntimeSource {
  private generation = 0;
  private changeEpoch = 0;
  private loadSequence = 0;
  private invalidated = true;
  private closed = false;
  private loaded?: LoadedSet;
  private unsubscribe?: () => void;
  private readonly changed = new Set<() => void>();
  private readonly projectionSources = new Map<string, string | null>();
  constructor(
    private readonly storage: CampaignRuntimeStorage,
    private readonly digest: CampaignOwnershipDigest,
  ) {
    this.unsubscribe = storage.subscribe?.(() => {
      this.invalidated = true; this.changeEpoch++;
      for (const listener of this.changed) listener();
    });
  }
  subscribe(changed: () => void): () => void {
    if (this.closed) throw new Error("Campaignquelle ist geschlossen.");
    this.changed.add(changed); return () => this.changed.delete(changed);
  }
  close(): void {
    this.unsubscribe?.(); this.unsubscribe = undefined; this.invalidated = true;
    this.closed = true; this.changeEpoch++; this.loadSequence++; this.changed.clear();
  }
  private async load(force = false): Promise<LoadedSet> {
    if (this.closed) throw new Error("Campaignquelle ist geschlossen.");
    if (!force && !this.invalidated && this.loaded) return this.loaded;
    const epoch = this.changeEpoch, sequence = ++this.loadSequence,
      files = [...await this.storage.list()].sort((a, b) => a.path.localeCompare(b.path));
    if (this.closed || epoch !== this.changeEpoch || sequence !== this.loadSequence)
      throw new Error("Campaignquelle wurde während des Lesens geändert.");
    const
      manifests = new Map<CampaignId, LoadedManifest>(), entries: CampaignRuntimeEntry[] = [],
      parsed: LoadedManifest[] = [], seenPaths = new Set<string>();
    for (const file of files) {
      try {
        safePath(file.path);
        if (seenPaths.has(file.path)) throw new Error("Campaignmanifestpfad ist doppelt.");
        seenPaths.add(file.path);
        const manifest = parseCampaignRuntimeManifest(file.bytes, this.digest);
        parsed.push(Object.freeze({ path: file.path, bytes: file.bytes, manifest }));
      } catch (error) {
        entries.push(Object.freeze({ key: file.path, campaignId: null, name: file.path,
          status: "unavailable", reason: String(error) }));
      }
    }
    const byId = new Map<CampaignId, LoadedManifest[]>();
    for (const item of parsed) byId.set(item.manifest.snapshot.campaignId,
      [...byId.get(item.manifest.snapshot.campaignId) ?? [], item]);
    const unique: LoadedManifest[] = [];
    for (const items of byId.values()) {
      if (items.length > 1) {
        for (const item of items) entries.push(Object.freeze({ key: item.path, campaignId: null,
          name: item.manifest.snapshot.name, status: "unavailable", reason: "Campaign-ID ist doppelt gespeichert." }));
        continue;
      }
      unique.push(items[0]!);
    }
    const byRegistry = new Map<string, LoadedManifest[]>();
    for (const item of unique) byRegistry.set(item.manifest.registry.registryId,
      [...byRegistry.get(item.manifest.registry.registryId) ?? [], item]);
    for (const items of byRegistry.values()) {
      if (items.length > 1) {
        for (const item of items) entries.push(Object.freeze({ key: item.path, campaignId: null,
          name: item.manifest.snapshot.name, status: "unavailable", reason: "Registry-ID ist doppelt gebunden." }));
        continue;
      }
      const item = items[0]!, id = item.manifest.snapshot.campaignId; manifests.set(id, item);
      entries.push(Object.freeze({ key: id, campaignId: id, name: item.manifest.snapshot.name,
        status: item.manifest.snapshot.lifecycle === "active" ? "available" : "trashed", reason: null }));
    }
    this.loaded = Object.freeze({ generation: ++this.generation, manifests,
      entries: Object.freeze(entries.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))) });
    this.invalidated = false;
    return this.loaded;
  }
  async entries(): Promise<readonly CampaignRuntimeEntry[]> { return (await this.load(true)).entries; }
  private projection(manifest: CampaignRuntimeManifestV1, context: CampaignContextProjection): CampaignDomainOwnershipProjectionV1 {
    if (!sameSnapshot(manifest.snapshot, context)) throw new Error("CampaignContext ist veraltet oder fremd.");
    const candidate = campaignDomainOwnershipProjection({ version: 1,
      registryId: manifest.registry.registryId, registryRevision: manifest.registry.registryRevision,
      projectionDigest: PLACEHOLDER_DIGEST, context, owners: manifest.registry.owners });
    return campaignDomainOwnershipProjection({ ...candidate,
      projectionDigest: campaignDomainOwnershipProjectionDigest(candidate, this.digest) });
  }
  readonly lifecycle: CampaignLifecyclePort = {
    read: async (id) => (await this.load(true)).manifests.get(campaignId(String(id)))?.manifest.snapshot ?? null,
    publish: async (_request: CampaignMutationRequest): Promise<CampaignPortOutcome> => ({ kind: "conflict" }),
    status: async (): Promise<CampaignPortOutcome> => ({ kind: "conflict" }),
  };
  readonly registry: CampaignOwnerRegistryPort = {
    read: async (expected) => {
      try {
        const loaded = (await this.load(true)).manifests.get(expected.campaignId), manifest = loaded?.manifest;
        if (!loaded || !manifest || manifest.snapshot.lifecycle !== "active") return { kind: "unavailable" };
        const projection = this.projection(manifest, expected);
        const sourceDigest = payloadDigest(this.digest(loaded.bytes)), previous = this.projectionSources.get(projection.projectionDigest);
        if (!this.projectionSources.has(projection.projectionDigest))
          this.projectionSources.set(projection.projectionDigest, sourceDigest);
        else if (previous !== sourceDigest)
          this.projectionSources.set(projection.projectionDigest, null);
        return { kind: "confirmed", projection };
      } catch { return { kind: "unavailable" }; }
    },
    verify: async (expected) => {
      try {
        const loaded = (await this.load(true)).manifests.get(expected.context.campaignId), manifest = loaded?.manifest;
        if (!loaded || !manifest || manifest.snapshot.lifecycle !== "active") return { kind: "unavailable" };
        const current = this.projection(manifest, expected.context);
        return current.registryId === expected.registryId && current.registryRevision === expected.registryRevision &&
          current.projectionDigest === expected.projectionDigest &&
          this.projectionSources.get(expected.projectionDigest) === payloadDigest(this.digest(loaded.bytes))
          ? { kind: "current" } : { kind: "stale" };
      } catch { return { kind: "unavailable" }; }
    },
  };
  readonly inventory: AtlasInventoryPort = {
    read: async (projection, worldId) => {
      try {
        const manifest = (await this.load(true)).manifests.get(projection.context.campaignId)?.manifest;
        if (!manifest || manifest.snapshot.lifecycle !== "active" || manifest.atlas.worldId !== worldId)
          return { kind: "unavailable" };
        const current = this.projection(manifest, projection.context);
        if (current.registryId !== projection.registryId || current.registryRevision !== projection.registryRevision ||
            current.projectionDigest !== projection.projectionDigest) return { kind: "unavailable" };
        return { kind: "confirmed", inventory: immutable({ context: projection.context,
          registryId: current.registryId, registryRevision: current.registryRevision,
          projectionDigest: current.projectionDigest, worldId,
          files: manifest.atlas.files, records: manifest.atlas.records }) };
      } catch { return { kind: "unavailable" }; }
    },
  };
}

/** Campaign-owned Atlas navigation ports. Hex owns openNative and the mounted editor. */
export class CampaignRuntimeNavigationProvider {
  private readonly changed = new Set<() => void>();
  private readonly unsubscribe: () => void;
  private sourceCurrent = true;
  readonly registry: CampaignOwnerRegistryPort;
  readonly inventory: AtlasInventoryPort;
  constructor(
    readonly source: CampaignRuntimeSource,
    private readonly lifecycle: CampaignLifecycle,
  ) {
    this.registry = source.registry;
    this.inventory = source.inventory;
    this.unsubscribe = source.subscribe(() => { this.sourceCurrent = false; this.notify(); });
  }
  currentContext = (): CampaignContextProjection | null => this.sourceCurrent ? this.lifecycle.context : null;
  entries(): Promise<readonly CampaignRuntimeEntry[]> { return this.source.entries(); }
  subscribeContextChanged(changed: () => void): () => void {
    this.changed.add(changed); return () => this.changed.delete(changed);
  }
  private notify(): void { for (const listener of this.changed) listener(); }
  async activate(
    commandId: CampaignCommandId,
    targetId: CampaignId,
    kind: "open" | "switch",
  ): Promise<CampaignActivationResult> {
    const result = await this.lifecycle.activate(
      campaignCommandId(String(commandId)), campaignId(String(targetId)), kind,
    );
    if (result.applied) { this.sourceCurrent = true; this.notify(); }
    return result;
  }
  close(): void { this.unsubscribe(); this.changed.clear(); }
}
