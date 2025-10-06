// src/apps/library/core/library-storage-port.ts
// Spezifiziert den Storage-Port, der Vault-Zugriffe, Marker-Handling und Dry-Run-Flows für die Library kapselt.
// Der Vertrag beschreibt Fehlercodes, Telemetrie-Events sowie die Legacy-Mapping-Tabelle für die anstehenden Adapter.
import type { LibrarySourceId } from "./sources";
import { LIBRARY_SOURCE_IDS } from "./sources";
import { CREATURES_DIR } from "./creature-files";
import { SPELLS_DIR } from "./spell-files";
import { ITEMS_DIR } from "./item-files";
import { EQUIPMENT_DIR } from "./equipment-files";
import { TERRAIN_FILE } from "../../../core/terrain-store";
import { REGIONS_FILE } from "../../../core/regions-store";

export type LibraryStorageDomainId = LibrarySourceId | "presets";

export interface LibraryStorageDomainDescriptor {
    readonly id: LibraryStorageDomainId;
    readonly description: string;
    readonly kind: "directory" | "single-file";
    readonly defaultExtension: string;
}

const LIBRARY_STORAGE_DOMAIN_DESCRIPTORS: ReadonlyArray<LibraryStorageDomainDescriptor> = Object.freeze([
    Object.freeze({
        id: "creatures" as const,
        description: `${CREATURES_DIR}/`,
        kind: "directory" as const,
        defaultExtension: "md" as const,
    }),
    Object.freeze({
        id: "spells" as const,
        description: `${SPELLS_DIR}/`,
        kind: "directory" as const,
        defaultExtension: "md" as const,
    }),
    Object.freeze({
        id: "items" as const,
        description: `${ITEMS_DIR}/`,
        kind: "directory" as const,
        defaultExtension: "md" as const,
    }),
    Object.freeze({
        id: "equipment" as const,
        description: `${EQUIPMENT_DIR}/`,
        kind: "directory" as const,
        defaultExtension: "md" as const,
    }),
    Object.freeze({
        id: "terrains" as const,
        description: TERRAIN_FILE,
        kind: "single-file" as const,
        defaultExtension: "md" as const,
    }),
    Object.freeze({
        id: "regions" as const,
        description: REGIONS_FILE,
        kind: "single-file" as const,
        defaultExtension: "md" as const,
    }),
    Object.freeze({
        id: "presets" as const,
        description: "SaltMarcher Preset Imports",
        kind: "directory" as const,
        defaultExtension: "md" as const,
    }),
]);

export function listLibraryStorageDomains(): readonly LibraryStorageDomainDescriptor[] {
    return LIBRARY_STORAGE_DOMAIN_DESCRIPTORS;
}

export function describeLibraryStorageDomain(id: LibraryStorageDomainId): LibraryStorageDomainDescriptor {
    const descriptor = LIBRARY_STORAGE_DOMAIN_DESCRIPTORS.find(entry => entry.id === id);
    if (!descriptor) {
        throw new Error(`Unknown library storage domain: ${id as string}`);
    }
    return descriptor;
}

export type LibraryStorageAdapterKind = "legacy" | "vault" | "mock";

export interface LibraryStorageFileRef {
    readonly path: string;
    readonly domain: LibraryStorageDomainId;
}

export interface LibraryStorageStat {
    readonly mtimeMs?: number;
    readonly ctimeMs?: number;
    readonly size?: number;
    readonly hash?: string;
}

export interface LibraryStorageReadRequest {
    readonly ref: LibraryStorageFileRef;
    readonly context?: LibraryStorageRequestContext;
}

export interface LibraryStorageReadResult {
    readonly ref: LibraryStorageFileRef;
    readonly content: string;
    readonly frontmatter?: Record<string, unknown>;
    readonly stat?: LibraryStorageStat;
    readonly marker?: LibraryStorageMarkerSummary;
}

export type LibraryStorageWriteMode = "create" | "update" | "delete";

export interface LibraryStorageWriteRequest {
    readonly mode: LibraryStorageWriteMode;
    readonly ref: LibraryStorageFileRef;
    readonly nextContent?: string;
    readonly context?: LibraryStorageRequestContext;
    readonly marker?: LibraryStorageMarkerPlan;
}

export interface LibraryStorageWriteResult {
    readonly ref: LibraryStorageFileRef;
    readonly mode: LibraryStorageWriteMode;
    readonly stat?: LibraryStorageStat;
    readonly backup?: LibraryStorageBackupPlan;
    readonly dryRun?: LibraryStorageDryRunReport;
}

export interface LibraryStorageMarkerPlan {
    readonly kind: "preset-import" | "sync" | "custom";
    readonly label: string;
    readonly path: string;
    readonly content?: string;
}

export interface LibraryStorageMarkerSummary {
    readonly path: string;
    readonly exists: boolean;
    readonly lastUpdated?: number;
}

export interface LibraryStorageBackupPlan {
    readonly directory: string;
    readonly strategy: "replace" | "append";
    readonly note?: string;
}

export interface LibraryStorageDryRunReport {
    readonly performed: boolean;
    readonly persistedContent?: string;
    readonly skippedWrite?: boolean;
}

export interface LibraryStorageRequestContext {
    readonly signal?: AbortSignal;
    readonly dryRun?: boolean;
    readonly reason?: string;
    readonly telemetry?: LibraryStorageTelemetryEmitter;
}

export type LibraryStorageErrorOperation =
    | "ensure-domain"
    | "list-domain"
    | "read-domain"
    | "write-domain"
    | "delete-domain"
    | "ensure-marker";

export type LibraryStorageErrorKind =
    | "not-found"
    | "conflict"
    | "validation"
    | "permission"
    | "io"
    | "marker"
    | "unknown";

export interface LibraryStorageError {
    readonly domain: LibraryStorageDomainId;
    readonly operation: LibraryStorageErrorOperation;
    readonly kind: LibraryStorageErrorKind;
    readonly message: string;
    readonly cause?: unknown;
    readonly ref?: LibraryStorageFileRef;
    readonly marker?: LibraryStorageMarkerPlan;
}

export function createLibraryStorageError(
    options: Omit<LibraryStorageError, "message"> & { message?: string }
): LibraryStorageError {
    const { message, ...rest } = options;
    const fallback = `${rest.operation} failed for ${rest.domain}`;
    return Object.freeze({
        ...rest,
        message: message ?? fallback,
    });
}

export type LibraryStorageTelemetryEvent =
    | {
          type: "storage.read";
          domain: LibraryStorageDomainId;
          ref: LibraryStorageFileRef;
          durationMs: number;
          adapter: LibraryStorageAdapterKind;
          size?: number;
      }
    | {
          type: "storage.write";
          domain: LibraryStorageDomainId;
          ref: LibraryStorageFileRef;
          mode: LibraryStorageWriteMode;
          durationMs: number;
          adapter: LibraryStorageAdapterKind;
          dryRun?: boolean;
          backup?: LibraryStorageBackupPlan;
      }
    | {
          type: "storage.marker";
          domain: LibraryStorageDomainId;
          marker: LibraryStorageMarkerPlan;
          adapter: LibraryStorageAdapterKind;
          ensured: boolean;
          durationMs: number;
      }
    | {
          type: "storage.error";
          domain: LibraryStorageDomainId;
          operation: LibraryStorageErrorOperation;
          adapter: LibraryStorageAdapterKind;
          error: LibraryStorageError;
      };

export type LibraryStorageTelemetryEmitter = (event: LibraryStorageTelemetryEvent) => void;

export interface LibraryStoragePort {
    readonly features: LibraryStoragePortFeatures;
    listDomains(): readonly LibraryStorageDomainDescriptor[];
    describeDomain(id: LibraryStorageDomainId): LibraryStorageDomainDescriptor;
    readDomainFile(request: LibraryStorageReadRequest): Promise<LibraryStorageReadResult>;
    writeDomainFile(request: LibraryStorageWriteRequest): Promise<LibraryStorageWriteResult>;
    ensureMarker(domain: LibraryStorageDomainId, marker: LibraryStorageMarkerPlan): Promise<LibraryStorageMarkerSummary>;
}

export interface LibraryStoragePortFeatures {
    readonly storagePortFlag: string;
    readonly dryRunFlag: string;
}

export const LIBRARY_STORAGE_PORT_FEATURES: LibraryStoragePortFeatures = Object.freeze({
    storagePortFlag: "library.storage.port.enabled",
    dryRunFlag: "library.storage.dryRun",
});

export interface LegacyLibraryStorageMappingEntry {
    readonly module: string;
    readonly responsibilities: readonly string[];
    readonly notes?: string;
}

export type LegacyLibraryStorageMapping = Readonly<Record<LibraryStorageDomainId, readonly LegacyLibraryStorageMappingEntry[]>>;

export const LEGACY_LIBRARY_STORAGE_MAPPING: LegacyLibraryStorageMapping = Object.freeze({
    creatures: Object.freeze([
        Object.freeze({
            module: "@app/library/core/creature-files",
            responsibilities: Object.freeze(["list", "watch", "create", "sanitize-name"]),
        }),
        Object.freeze({
            module: "@app/library/core/creature-presets",
            responsibilities: Object.freeze(["preset-import", "marker", "legacy-roundtrip"]),
            notes: "Handles `.plugin-presets-imported` marker during preset migrations.",
        }),
    ]),
    spells: Object.freeze([
        Object.freeze({
            module: "@app/library/core/spell-files",
            responsibilities: Object.freeze(["list", "watch", "create", "sanitize-name"]),
        }),
        Object.freeze({
            module: "@app/library/core/spell-presets",
            responsibilities: Object.freeze(["preset-import", "marker", "legacy-roundtrip"]),
        }),
    ]),
    items: Object.freeze([
        Object.freeze({
            module: "@app/library/core/item-files",
            responsibilities: Object.freeze(["list", "watch", "create", "sanitize-name"]),
        }),
        Object.freeze({
            module: "@app/library/core/plugin-presets",
            responsibilities: Object.freeze([
                "preset-import",
                "marker",
                "read-legacy-json",
                "write-legacy-markdown",
            ]),
            notes: "Covers item + equipment preset markers and import side-effects.",
        }),
    ]),
    equipment: Object.freeze([
        Object.freeze({
            module: "@app/library/core/equipment-files",
            responsibilities: Object.freeze(["list", "watch", "create", "sanitize-name"]),
        }),
        Object.freeze({
            module: "@app/library/core/plugin-presets",
            responsibilities: Object.freeze([
                "preset-import",
                "marker",
                "read-legacy-json",
                "write-legacy-markdown",
            ]),
        }),
    ]),
    terrains: Object.freeze([
        Object.freeze({
            module: "@core/terrain-store",
            responsibilities: Object.freeze(["ensure", "read", "write", "watch", "notify-workspace"]),
            notes: "Single-file Markdown block parsed into terrain map; watchers trigger workspace events.",
        }),
    ]),
    regions: Object.freeze([
        Object.freeze({
            module: "@core/regions-store",
            responsibilities: Object.freeze(["ensure", "read", "write", "watch", "notice"]),
            notes: "Maintains Regions.md including Obsidian notices on recreation failures.",
        }),
    ]),
    presets: Object.freeze([
        Object.freeze({
            module: "@app/library/core/plugin-presets",
            responsibilities: Object.freeze([
                "seed-json",
                "import-markdown",
                "create-marker",
                "telemetry-log",
            ]),
            notes: "Aggregates preset import routines across creatures, spells, items and equipment.",
        }),
    ]),
});

export function ensureLegacyStorageCoverage(): void {
    for (const id of [...LIBRARY_SOURCE_IDS, "presets"] as LibraryStorageDomainId[]) {
        const entries = LEGACY_LIBRARY_STORAGE_MAPPING[id];
        if (!entries || entries.length === 0) {
            throw new Error(`Missing legacy storage mapping for domain ${id}`);
        }
    }
}

export function describeLegacyStorageGaps(): readonly { domain: LibraryStorageDomainId; missing: string[] } {
    const gaps: Array<{ domain: LibraryStorageDomainId; missing: string[] }> = [];
    for (const descriptor of LIBRARY_STORAGE_DOMAIN_DESCRIPTORS) {
        const mapping = LEGACY_LIBRARY_STORAGE_MAPPING[descriptor.id] ?? [];
        const collected = new Set(mapping.flatMap(entry => entry.responsibilities));
        const required = descriptor.kind === "directory"
            ? ["list", "watch", "create"]
            : ["ensure", "read", "write"];
        const missing = required.filter(key => !collected.has(key));
        if (missing.length > 0) {
            gaps.push({ domain: descriptor.id, missing });
        }
    }
    return gaps;
}

