import { safePath } from "../../model";
import {
  campaignContext,
  campaignContextToken,
  campaignId,
  campaignLocalId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
  payloadDigest,
  revisionToken,
  type CampaignContextProjection,
  type CampaignLocalId,
} from "./campaign-contracts";
import type {
  MwsImportMediaInventoryPort,
  MwsImportMediaInventoryReadOutcome,
  MwsImportMediaInventoryV1,
  MwsImportMediaInventoryVerifyOutcome,
} from "./mws-complete-import-media";

export interface MwsImportMediaFilePort {
  read(path: string): Promise<Uint8Array | null>;
}

export type MwsImportMediaByteDigest = (bytes: Uint8Array) => string;

export interface MwsImportMediaManifestV1 {
  readonly version: 1;
  readonly importId: string;
  readonly revision: string;
  readonly context: {
    readonly campaignId: string;
    readonly campaignRevision: number;
    readonly campaignName: string;
    readonly namespace: string;
    readonly lifecycle: "active" | "trashed";
    readonly contextToken: string;
  };
  readonly registry: {
    readonly registryId: string;
    readonly registryRevision: string;
    readonly projectionDigest: string;
  };
  readonly assets: readonly {
    readonly sourceId: string;
    readonly availability: "available" | "missing";
    readonly metadataPath: string | null;
    readonly bytePath: string | null;
  }[];
}

type ReadRequest = Parameters<MwsImportMediaInventoryPort["read"]>[0];

interface ParsedAsset {
  readonly sourceId: CampaignLocalId;
  readonly availability: "available" | "missing";
  readonly metadataPath: string | null;
  readonly bytePath: string | null;
}

interface ParsedManifest {
  readonly importId: string;
  readonly revision: string;
  readonly context: CampaignContextProjection;
  readonly registryId: string;
  readonly registryRevision: string;
  readonly projectionDigest: string;
  readonly assets: readonly ParsedAsset[];
}

interface Snapshot {
  readonly request: ReadRequest;
  readonly inventory: MwsImportMediaInventoryV1;
}

const MANIFEST_FILE = "media-inventory.json";

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Ungültiger ${label}.`);
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new Error(`Ungültiger ${label}.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length)
    throw new Error(`Ungültige ${label}.`);
  return value;
}

function bytesEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameContext(a: CampaignContextProjection, b: CampaignContextProjection): boolean {
  return a.schemaVersion === b.schemaVersion && a.campaignId === b.campaignId &&
    a.revision === b.revision && a.name === b.name && a.namespace === b.namespace &&
    a.lifecycle === b.lifecycle && a.contextToken === b.contextToken;
}

function inventoryKey(inventory: MwsImportMediaInventoryV1): string {
  return `${inventory.importId}\n${inventory.revision}`;
}

function inventoryBytes(inventory: MwsImportMediaInventoryV1): string {
  return JSON.stringify(inventory);
}

/**
 * Reads the already materialized import staging inventory. This is deliberately
 * not an archive reader or publisher: it only turns stable host bytes into the
 * existing M/W/S review port and rechecks them before acceptance.
 */
export class MwsImportMediaInventory implements MwsImportMediaInventoryPort {
  readonly manifestPath: string;
  private readonly snapshots = new Map<string, Snapshot | null>();

  constructor(
    private readonly files: MwsImportMediaFilePort,
    root: string,
    private readonly digest: MwsImportMediaByteDigest,
  ) {
    const checked = safePath(root);
    this.manifestPath = `${checked}/${MANIFEST_FILE}`;
  }

  private assetPath(path: string): string {
    return `${this.manifestPath.slice(0, -MANIFEST_FILE.length)}${safePath(path)}`;
  }

  private parse(raw: Uint8Array): ParsedManifest {
    let decoded: unknown;
    try {
      decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    } catch {
      throw new Error("Medieninventar-Manifest ist kein gültiges UTF-8-JSON.");
    }
    const manifest = record(decoded, ["version", "importId", "revision", "context", "registry", "assets"],
      "Medieninventar-Manifest");
    if (manifest.version !== 1) throw new Error("Unbekannte Medieninventar-Version.");
    const context = record(manifest.context, ["campaignId", "campaignRevision", "campaignName", "namespace",
      "lifecycle", "contextToken"], "Medieninventar-Context"),
      registry = record(manifest.registry, ["registryId", "registryRevision", "projectionDigest"],
        "Medieninventar-Registry"), paths = new Set<string>();
    const parsedContext = campaignContext(campaignSnapshot({
      schemaVersion: 1,
      campaignId: campaignId(String(context.campaignId)),
      revision: campaignRevision(Number(context.campaignRevision)),
      name: context.campaignName,
      namespace: campaignNamespace(String(context.namespace)),
      lifecycle: context.lifecycle,
    }), campaignContextToken(String(context.contextToken)));
    const assets = array(manifest.assets, "Medieninventar-Einträge").map((value): ParsedAsset => {
      const asset = record(value, ["sourceId", "availability", "metadataPath", "bytePath"],
        "Medieninventar-Eintrag"), sourceId = campaignLocalId(String(asset.sourceId));
      if (asset.availability === "missing") {
        if (asset.metadataPath !== null || asset.bytePath !== null)
          throw new Error("Fehlendes Medium darf keine Dateipfade behaupten.");
        return Object.freeze({ sourceId, availability: "missing" as const,
          metadataPath: null, bytePath: null });
      }
      if (asset.availability !== "available" || typeof asset.metadataPath !== "string" ||
          typeof asset.bytePath !== "string")
        throw new Error("Verfügbares Medium braucht Metadaten- und Bytepfad.");
      const metadataPath = this.assetPath(asset.metadataPath), bytePath = this.assetPath(asset.bytePath);
      if (metadataPath === bytePath || paths.has(metadataPath) || paths.has(bytePath) ||
          metadataPath === this.manifestPath || bytePath === this.manifestPath)
        throw new Error("Medieninventar-Dateipfade sind doppelt oder kollidieren.");
      paths.add(metadataPath); paths.add(bytePath);
      return Object.freeze({ sourceId, availability: "available" as const, metadataPath, bytePath });
    }).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    if (new Set(assets.map((asset) => asset.sourceId)).size !== assets.length)
      throw new Error("Doppelte Medieninventar-ID.");
    return Object.freeze({
      importId: revisionToken(String(manifest.importId), "Import-ID"),
      revision: revisionToken(String(manifest.revision), "Medieninventar-Revision"),
      context: parsedContext,
      registryId: revisionToken(String(registry.registryId), "Registry-ID"),
      registryRevision: revisionToken(String(registry.registryRevision), "Registry-Revision"),
      projectionDigest: payloadDigest(String(registry.projectionDigest)),
      assets: Object.freeze(assets),
    });
  }

  private validateBinding(manifest: ParsedManifest, expected: ReadRequest): void {
    if (!sameContext(manifest.context, expected.context) || manifest.registryId !== expected.registryId ||
        manifest.registryRevision !== expected.registryRevision ||
        manifest.projectionDigest !== expected.projectionDigest)
      throw new Error("Medieninventar gehört zu einer fremden oder veralteten Campaign-Registry.");
    const actual = manifest.assets.map((asset) => asset.sourceId), wanted = [...expected.audioSourceIds].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted))
      throw new Error("Medieninventar ist für die bestätigten Audioquellen unvollständig oder fremd.");
  }

  private async load(expected: ReadRequest): Promise<MwsImportMediaInventoryReadOutcome> {
    const firstManifest = await this.files.read(this.manifestPath);
    if (firstManifest === null) return { kind: "unavailable" };
    const manifest = this.parse(firstManifest);
    this.validateBinding(manifest, expected);
    const first = await Promise.all(manifest.assets.map(async (asset) => asset.availability === "missing"
      ? Object.freeze({ metadata: null, bytes: null })
      : Object.freeze({ metadata: await this.files.read(asset.metadataPath!),
        bytes: await this.files.read(asset.bytePath!) })));
    const second = await Promise.all(manifest.assets.map(async (asset) => asset.availability === "missing"
      ? Object.freeze({ metadata: null, bytes: null })
      : Object.freeze({ metadata: await this.files.read(asset.metadataPath!),
        bytes: await this.files.read(asset.bytePath!) })));
    const finalManifest = await this.files.read(this.manifestPath);
    if (!bytesEqual(firstManifest, finalManifest) || first.some((value, index) =>
      !bytesEqual(value.metadata, second[index]!.metadata) || !bytesEqual(value.bytes, second[index]!.bytes)))
      return { kind: "unknown" };
    const assets = manifest.assets.map((asset, index) => {
      const stable = second[index]!;
      if (asset.availability === "missing" || stable.metadata === null || stable.bytes === null)
        return Object.freeze({ sourceId: asset.sourceId, availability: "missing" as const,
          metadataDigest: null, byteDigest: null });
      return Object.freeze({ sourceId: asset.sourceId, availability: "available" as const,
        metadataDigest: payloadDigest(this.digest(stable.metadata)),
        byteDigest: payloadDigest(this.digest(stable.bytes)) });
    });
    const inventory = Object.freeze({ version: 1 as const, importId: manifest.importId,
      revision: manifest.revision, assets: Object.freeze(assets) });
    return { kind: "confirmed", inventory };
  }

  async read(expected: ReadRequest): Promise<MwsImportMediaInventoryReadOutcome> {
    const request = structuredClone({ ...expected,
        audioSourceIds: [...expected.audioSourceIds].sort() }) as ReadRequest,
      outcome = await this.load(request);
    if (outcome.kind === "confirmed") {
      const key = inventoryKey(outcome.inventory), current = this.snapshots.get(key),
        snapshot = Object.freeze({ request, inventory: outcome.inventory });
      // Reusing one import revision for another binding is ambiguous even when
      // its media happens to be byte-identical. Do not let the narrower verify
      // signature silently authorize either context.
      if (current === undefined) this.snapshots.set(key, snapshot);
      else if (current !== null && JSON.stringify(current.request) === JSON.stringify(request))
        this.snapshots.set(key, snapshot);
      else this.snapshots.set(key, null);
    }
    return outcome;
  }

  async verify(expected: MwsImportMediaInventoryV1): Promise<MwsImportMediaInventoryVerifyOutcome> {
    const snapshot = this.snapshots.get(inventoryKey(expected));
    if (!snapshot || inventoryBytes(snapshot.inventory) !== inventoryBytes(expected)) return { kind: "unknown" };
    const current = await this.load(snapshot.request);
    if (current.kind !== "confirmed") return { kind: current.kind };
    return inventoryBytes(current.inventory) === inventoryBytes(expected) ? { kind: "current" } : { kind: "stale" };
  }
}
