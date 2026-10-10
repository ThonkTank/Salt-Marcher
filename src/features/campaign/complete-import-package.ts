import { safePath } from "../../model";
import {
  campaignId,
  campaignNamespace,
  campaignRevision,
  campaignSnapshot,
  payloadDigest,
  revisionToken,
  type CampaignSnapshotV1,
} from "./campaign-contracts";

type Digest = string;

export interface CompleteImportPackageFilePort {
  list(root: string): Promise<readonly string[] | null>;
  read(path: string): Promise<Uint8Array | null>;
}

export type CompleteImportPackageByteDigest = (bytes: Uint8Array) => string;

export interface CompleteImportPackageLimits {
  readonly maxFiles: number;
  readonly maxManifestBytes: number;
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
}

export const COMPLETE_IMPORT_PACKAGE_LIMITS: CompleteImportPackageLimits = Object.freeze({
  maxFiles: 4096,
  maxManifestBytes: 4 * 1024 * 1024,
  maxFileBytes: 256 * 1024 * 1024,
  maxTotalBytes: 4 * 1024 * 1024 * 1024,
});

export interface CompleteImportPackageBindingV1 {
  readonly importId: string;
  readonly revision: string;
  readonly source: CampaignSnapshotV1;
  readonly registryId: string;
  readonly registryRevision: string;
  readonly projectionDigest: Digest;
}

export interface CompleteImportPackageFileV1 {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: Digest;
}

export interface CompleteImportPackageInventoryV1 {
  readonly version: 1;
  readonly binding: CompleteImportPackageBindingV1;
  readonly manifestSha256: Digest;
  readonly files: readonly CompleteImportPackageFileV1[];
  readonly totalBytes: number;
}

export type CompleteImportPackageReadOutcome =
  | { readonly kind: "confirmed"; readonly inventory: CompleteImportPackageInventoryV1 }
  | { readonly kind: "unknown" | "unavailable" };

export type CompleteImportPackageVerifyOutcome =
  | { readonly kind: "current" }
  | { readonly kind: "stale" | "unknown" | "unavailable" };

interface ParsedManifest {
  readonly binding: CompleteImportPackageBindingV1;
  readonly files: readonly CompleteImportPackageFileV1[];
  readonly totalBytes: number;
}

interface Snapshot {
  readonly expected: CompleteImportPackageBindingV1;
  readonly inventory: CompleteImportPackageInventoryV1;
}

const MANIFEST_FILE = "complete-import-package.json";

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

function boundedInteger(value: unknown, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum)
    throw new Error(`Ungültige ${label}.`);
  return Number(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Ungültige ${label}.`);
  return value;
}

function checkedLimits(value: CompleteImportPackageLimits): CompleteImportPackageLimits {
  const keys: (keyof CompleteImportPackageLimits)[] = [
    "maxFiles", "maxManifestBytes", "maxFileBytes", "maxTotalBytes",
  ];
  for (const key of keys)
    if (!Number.isSafeInteger(value[key]) || value[key] < 1)
      throw new Error("Ungültige Complete-Import-Paketgrenze.");
  return Object.freeze({ ...value });
}

function checkedBinding(value: CompleteImportPackageBindingV1): CompleteImportPackageBindingV1 {
  const source = campaignSnapshot(value.source);
  return Object.freeze({
    importId: revisionToken(value.importId, "Import-ID"),
    revision: revisionToken(value.revision, "Importrevision"),
    source,
    registryId: revisionToken(value.registryId, "Registry-ID"),
    registryRevision: revisionToken(value.registryRevision, "Registryrevision"),
    projectionDigest: payloadDigest(value.projectionDigest),
  });
}

function sameBinding(a: CompleteImportPackageBindingV1, b: CompleteImportPackageBindingV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function equalBytes(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function equalList(a: readonly string[] | null, b: readonly string[] | null): boolean {
  return a !== null && b !== null && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function inventoryKey(value: CompleteImportPackageBindingV1): string {
  return JSON.stringify([value.importId, value.revision]);
}

function inventoryBytes(value: CompleteImportPackageInventoryV1): string {
  return JSON.stringify(value);
}

/**
 * Validates an already materialized Complete-Import package. Archive extraction,
 * ID allocation and publication stay outside this read-only host boundary.
 */
export class CompleteImportPackageInventory {
  readonly manifestPath: string;
  private readonly limits: CompleteImportPackageLimits;
  private readonly snapshots = new Map<string, Snapshot | null>();

  constructor(
    private readonly port: CompleteImportPackageFilePort,
    readonly root: string,
    private readonly digest: CompleteImportPackageByteDigest,
    limits: CompleteImportPackageLimits = COMPLETE_IMPORT_PACKAGE_LIMITS,
  ) {
    this.root = safePath(root);
    this.manifestPath = `${this.root}/${MANIFEST_FILE}`;
    this.limits = checkedLimits(limits);
  }

  private filePath(relative: string): string {
    const checked = safePath(relative);
    if (checked === MANIFEST_FILE)
      throw new Error("Paketdatei kollidiert mit dem Manifest.");
    return `${this.root}/${checked}`;
  }

  private parse(bytes: Uint8Array): ParsedManifest {
    if (bytes.length > this.limits.maxManifestBytes)
      throw new Error("Complete-Import-Manifest überschreitet die Größenbegrenzung.");
    let decoded: unknown;
    try {
      decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new Error("Complete-Import-Manifest ist kein gültiges UTF-8-JSON.");
    }
    const manifest = record(decoded, ["version", "importId", "revision", "source", "registry", "files"],
        "Complete-Import-Manifest");
    if (manifest.version !== 1) throw new Error("Unbekannte Complete-Import-Paketversion.");
    const source = record(manifest.source,
        ["campaignId", "campaignRevision", "campaignName", "namespace", "lifecycle"],
        "Complete-Import-Source"),
      registry = record(manifest.registry,
        ["registryId", "registryRevision", "projectionDigest"], "Complete-Import-Registry"),
      binding = checkedBinding({
        importId: requiredString(manifest.importId, "Import-ID"),
        revision: requiredString(manifest.revision, "Importrevision"),
        source: campaignSnapshot({
          schemaVersion: 1,
          campaignId: campaignId(requiredString(source.campaignId, "Kampagnen-ID")),
          revision: campaignRevision(boundedInteger(source.campaignRevision,
            "Campaign-Revision", Number.MAX_SAFE_INTEGER)),
          name: source.campaignName,
          namespace: campaignNamespace(requiredString(source.namespace, "Kampagnen-Namespace")),
          lifecycle: source.lifecycle,
        }),
        registryId: requiredString(registry.registryId, "Registry-ID"),
        registryRevision: requiredString(registry.registryRevision, "Registryrevision"),
        projectionDigest: requiredString(registry.projectionDigest, "Projektions-Digest"),
      }), paths = new Set<string>();
    const rawFiles = array(manifest.files, "Complete-Import-Dateien");
    if (rawFiles.length < 1 || rawFiles.length > this.limits.maxFiles)
      throw new Error("Complete-Import-Dateianzahl überschreitet die Begrenzung.");
    let totalBytes = 0;
    const files = rawFiles.map((raw): CompleteImportPackageFileV1 => {
      const file = record(raw, ["path", "bytes", "sha256"], "Complete-Import-Datei"),
        path = safePath(requiredString(file.path, "Complete-Import-Dateipfad"));
      if (paths.has(path)) throw new Error("Doppelter Complete-Import-Dateipfad.");
      paths.add(path);
      this.filePath(path);
      const size = boundedInteger(file.bytes, "Complete-Import-Dateigröße", this.limits.maxFileBytes);
      totalBytes += size;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > this.limits.maxTotalBytes)
        throw new Error("Complete-Import-Paket überschreitet die Gesamtgrößenbegrenzung.");
      return Object.freeze({
        path,
        bytes: size,
        sha256: payloadDigest(requiredString(file.sha256, "Complete-Import-Datei-Digest")),
      });
    }).sort((a, b) => a.path.localeCompare(b.path));
    return Object.freeze({ binding, files: Object.freeze(files), totalBytes });
  }

  private expectedPaths(parsed: ParsedManifest): readonly string[] {
    return Object.freeze([this.manifestPath, ...parsed.files.map((file) => this.filePath(file.path))].sort());
  }

  private checkedList(paths: readonly string[]): readonly string[] {
    if (paths.length > this.limits.maxFiles + 1)
      throw new Error("Materialisiertes Complete-Import-Paket enthält zu viele Dateien.");
    const checked = paths.map((path) => safePath(path)).sort();
    if (new Set(checked).size !== checked.length || checked.some((path) =>
      path !== this.manifestPath && !path.startsWith(`${this.root}/`)))
      throw new Error("Materialisiertes Complete-Import-Paket enthält fremde oder doppelte Pfade.");
    return Object.freeze(checked);
  }

  private async load(expectedRaw: CompleteImportPackageBindingV1): Promise<CompleteImportPackageReadOutcome> {
    const expected = checkedBinding(expectedRaw), firstListRaw = await this.port.list(this.root);
    if (firstListRaw === null) return { kind: "unavailable" };
    const firstList = this.checkedList(firstListRaw), firstManifest = await this.port.read(this.manifestPath);
    if (firstManifest === null) return { kind: "unavailable" };
    const parsed = this.parse(firstManifest);
    if (!sameBinding(parsed.binding, expected))
      throw new Error("Complete-Import-Paket gehört zu einer fremden oder veralteten Bindung.");
    if (JSON.stringify(firstList) !== JSON.stringify(this.expectedPaths(parsed)))
      throw new Error("Complete-Import-Paketdateien stimmen nicht exakt mit dem Manifest überein.");
    const first = await Promise.all(parsed.files.map((file) => this.port.read(this.filePath(file.path))));
    if (first.some((bytes) => bytes === null)) return { kind: "unavailable" };
    const secondListRaw = await this.port.list(this.root), secondManifest = await this.port.read(this.manifestPath),
      second = await Promise.all(parsed.files.map((file) => this.port.read(this.filePath(file.path)))),
      finalListRaw = await this.port.list(this.root), finalManifest = await this.port.read(this.manifestPath);
    if (!equalList(firstList, secondListRaw) || !equalList(firstList, finalListRaw) ||
        !equalBytes(firstManifest, secondManifest) || !equalBytes(firstManifest, finalManifest) ||
        first.some((bytes, index) => !equalBytes(bytes, second[index]!)))
      return { kind: "unknown" };
    const files = parsed.files.map((file, index) => {
      const bytes = second[index];
      if (bytes === null || bytes === undefined) return null;
      if (bytes.length !== file.bytes || payloadDigest(this.digest(bytes)) !== file.sha256)
        throw new Error(`Complete-Import-Datei ist beschädigt: ${file.path}`);
      return file;
    });
    if (files.some((file) => file === null)) return { kind: "unavailable" };
    const inventory = Object.freeze({
      version: 1 as const,
      binding: parsed.binding,
      manifestSha256: payloadDigest(this.digest(finalManifest!)),
      files: parsed.files,
      totalBytes: parsed.totalBytes,
    });
    return { kind: "confirmed", inventory };
  }

  async read(expectedRaw: CompleteImportPackageBindingV1): Promise<CompleteImportPackageReadOutcome> {
    const expected = checkedBinding(structuredClone(expectedRaw)), outcome = await this.load(expected);
    if (outcome.kind === "confirmed") {
      const key = inventoryKey(expected), current = this.snapshots.get(key),
        snapshot = Object.freeze({ expected, inventory: outcome.inventory });
      if (current === undefined)
        this.snapshots.set(key, snapshot);
      else if (current !== null && (!sameBinding(current.expected, expected) ||
          inventoryBytes(current.inventory) !== inventoryBytes(outcome.inventory)))
        this.snapshots.set(key, null);
    }
    return outcome;
  }

  async verify(expected: CompleteImportPackageInventoryV1): Promise<CompleteImportPackageVerifyOutcome> {
    const key = inventoryKey(expected.binding), snapshot = this.snapshots.get(key);
    if (!snapshot || inventoryBytes(snapshot.inventory) !== inventoryBytes(expected)) return { kind: "unknown" };
    const current = await this.load(snapshot.expected);
    if (this.snapshots.get(key) !== snapshot) return { kind: "unknown" };
    if (current.kind !== "confirmed") return { kind: current.kind };
    return inventoryBytes(current.inventory) === inventoryBytes(expected) ? { kind: "current" } : { kind: "stale" };
  }
}
