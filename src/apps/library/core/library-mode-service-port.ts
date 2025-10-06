// src/apps/library/core/library-mode-service-port.ts
// Spezifiziert den Application-Service-Port, der Renderer-Lifecycles mit Storage- und Serializer-Adaptern verbindet.
// Der Port kapselt sämtliche IO-Zugriffe für Bibliotheksbereiche und beschreibt Kill-Switch-Strategien.
import type { LibrarySourceId } from "./sources";
import { LIBRARY_SOURCE_IDS, describeLibrarySource } from "./sources";
import type { StatblockData } from "./creature-files";
import type { SpellData } from "./spell-files";
import type { ItemData } from "./item-files";
import type { EquipmentData } from "./equipment-files";
import type { Region } from "../../../core/regions-store";

export type LibraryModeId = LibrarySourceId;

export interface LibraryEntryRef {
    readonly path: string;
    readonly mode: LibraryModeId;
}

export interface CreatureEntrySummary extends LibraryEntryRef {
    readonly mode: "creatures";
    readonly name: string;
    readonly creatureType?: string;
    readonly challengeRating?: string;
}

export interface SpellEntrySummary extends LibraryEntryRef {
    readonly mode: "spells";
    readonly name: string;
    readonly level?: number;
    readonly school?: string;
}

export interface ItemEntrySummary extends LibraryEntryRef {
    readonly mode: "items";
    readonly name: string;
    readonly rarity?: string;
    readonly category?: string;
}

export interface EquipmentEntrySummary extends LibraryEntryRef {
    readonly mode: "equipment";
    readonly name: string;
    readonly type: EquipmentData["type"];
    readonly category?: string;
}

export interface TerrainEntrySummary extends LibraryEntryRef {
    readonly mode: "terrains";
    readonly name: string;
    readonly color: string;
    readonly speed: number;
}

export interface RegionEntrySummary extends LibraryEntryRef {
    readonly mode: "regions";
    readonly name: string;
    readonly terrain: string;
    readonly encounterOdds?: number;
}

export type LibraryEntrySummary =
    | CreatureEntrySummary
    | SpellEntrySummary
    | ItemEntrySummary
    | EquipmentEntrySummary
    | TerrainEntrySummary
    | RegionEntrySummary;

export interface CreatureEntryDocument {
    readonly mode: "creatures";
    readonly ref: CreatureEntrySummary;
    readonly statblock: StatblockData;
}

export interface SpellEntryDocument {
    readonly mode: "spells";
    readonly ref: SpellEntrySummary;
    readonly spell: SpellData;
}

export interface ItemEntryDocument {
    readonly mode: "items";
    readonly ref: ItemEntrySummary;
    readonly item: ItemData;
}

export interface EquipmentEntryDocument {
    readonly mode: "equipment";
    readonly ref: EquipmentEntrySummary;
    readonly equipment: EquipmentData;
}

export interface TerrainEntryDocument {
    readonly mode: "terrains";
    readonly ref: TerrainEntrySummary;
    readonly terrain: { name: string; color: string; speed: number };
}

export interface RegionEntryDocument {
    readonly mode: "regions";
    readonly ref: RegionEntrySummary;
    readonly region: Region;
}

export type LibraryEntryDocument =
    | CreatureEntryDocument
    | SpellEntryDocument
    | ItemEntryDocument
    | EquipmentEntryDocument
    | TerrainEntryDocument
    | RegionEntryDocument;

export type LibraryModeAdapterKind = "legacy" | "storage-port";

export type LibraryModeServiceTelemetryEvent =
    | { type: "session.opened"; mode: LibraryModeId; adapter: LibraryModeAdapterKind }
    | { type: "session.closed"; mode: LibraryModeId; adapter: LibraryModeAdapterKind }
    | { type: "entries.synced"; mode: LibraryModeId; adapter: LibraryModeAdapterKind; durationMs: number; count: number }
    | { type: "entry.created"; mode: LibraryModeId; adapter: LibraryModeAdapterKind; ref: LibraryEntryRef }
    | { type: "entry.failed"; mode: LibraryModeId; adapter: LibraryModeAdapterKind; ref?: LibraryEntryRef; error: unknown };

export type LibraryModeServiceTelemetryEmitter = (event: LibraryModeServiceTelemetryEvent) => void;

export interface LibraryModeServiceError {
    readonly mode: LibraryModeId;
    readonly operation: "list" | "read" | "create" | "update" | "delete" | "watch";
    readonly kind: "storage" | "serializer" | "validation" | "unknown";
    readonly cause: unknown;
}

export interface LibraryModeSessionObserver {
    onEntriesChanged?(entries: readonly LibraryEntrySummary[]): void | Promise<void>;
    onError?(error: LibraryModeServiceError): void;
    onTelemetry?(event: LibraryModeServiceTelemetryEvent): void;
}

export interface LibraryModeWatch {
    unsubscribe(): void;
}

export interface LibraryModeRequestContext {
    readonly signal?: AbortSignal;
    readonly reason?: string;
}

export interface LibraryModeCreateRequest {
    readonly mode: LibraryModeId;
    readonly document:
        | { mode: "creatures"; statblock: StatblockData; presetPath?: string }
        | { mode: "spells"; spell: SpellData }
        | { mode: "items"; item: ItemData }
        | { mode: "equipment"; equipment: EquipmentData }
        | { mode: "terrains"; terrain: { name: string; color: string; speed: number } }
        | { mode: "regions"; region: Region };
}

export interface LibraryModeCreateResult {
    readonly document: LibraryEntryDocument;
    readonly summary: LibraryEntrySummary;
}

export interface LibraryModeSession {
    readonly mode: LibraryModeDescriptor;
    listEntries(context?: LibraryModeRequestContext): Promise<readonly LibraryEntrySummary[]>;
    readEntry(ref: LibraryEntryRef, context?: LibraryModeRequestContext): Promise<LibraryEntryDocument>;
    createEntry(request: LibraryModeCreateRequest, context?: LibraryModeRequestContext): Promise<LibraryModeCreateResult>;
    watch(observer: LibraryModeSessionObserver): LibraryModeWatch;
    dispose(): Promise<void>;
}

export interface LibraryModeConnectOptions {
    readonly mode: LibraryModeId;
    readonly observer?: LibraryModeSessionObserver;
    readonly context?: LibraryModeRequestContext;
    readonly telemetry?: LibraryModeServiceTelemetryEmitter;
    readonly killSwitch?: Partial<LibraryModeKillSwitch>;
}

export interface LibraryModeServicePort {
    readonly features: LibraryModeServiceFeatures;
    listModes(): readonly LibraryModeDescriptor[];
    describeMode(id: LibraryModeId): LibraryModeDescriptor;
    connect(options: LibraryModeConnectOptions): Promise<LibraryModeSession>;
}

export interface LibraryModeServiceFeatures {
    readonly rendererServiceFlag: string;
    readonly legacyFallbackFlag: string;
}

export const LIBRARY_MODE_SERVICE_FEATURES: LibraryModeServiceFeatures = Object.freeze({
    rendererServiceFlag: "library.service.enabled",
    legacyFallbackFlag: "library.service.legacyFallback",
});

export interface LibraryModeKillSwitchFlags {
    readonly [LIBRARY_MODE_SERVICE_FEATURES.rendererServiceFlag]?: boolean;
    readonly [LIBRARY_MODE_SERVICE_FEATURES.legacyFallbackFlag]?: boolean;
}

export interface LibraryModeKillSwitch {
    readonly useService: boolean;
    readonly allowLegacyFallback: boolean;
}

export interface LibraryModeKillSwitchOptions {
    readonly flags?: LibraryModeKillSwitchFlags | Record<string, boolean | undefined>;
    readonly overrides?: Partial<LibraryModeKillSwitch>;
}

export function resolveLibraryModeKillSwitch(options?: LibraryModeKillSwitchOptions): LibraryModeKillSwitch {
    const rendererFlagName = LIBRARY_MODE_SERVICE_FEATURES.rendererServiceFlag;
    const fallbackFlagName = LIBRARY_MODE_SERVICE_FEATURES.legacyFallbackFlag;
    const flagState = options?.flags ?? {};
    const overrides = options?.overrides ?? {};

    const rendererEnabled = overrides.useService ?? (flagState[rendererFlagName] ?? true);
    const legacyAllowed = overrides.allowLegacyFallback ?? (flagState[fallbackFlagName] ?? true);

    return {
        useService: !!rendererEnabled,
        allowLegacyFallback: !!legacyAllowed,
    };
}

export interface LibraryModeDescriptor {
    readonly id: LibraryModeId;
    readonly title: string;
    readonly description: string;
    readonly supportsCreation: boolean;
    readonly supportsPresets: boolean;
    readonly defaultCreateLabel: string;
}

const LIBRARY_MODE_LABELS: Record<LibraryModeId, { title: string; createLabel: string; presets: boolean }> = Object.freeze({
    creatures: { title: "Creatures", createLabel: "Neue Kreatur", presets: true },
    spells: { title: "Spells", createLabel: "Neuer Zauber", presets: false },
    items: { title: "Items", createLabel: "Neuer Gegenstand", presets: false },
    equipment: { title: "Equipment", createLabel: "Neue Ausrüstung", presets: false },
    terrains: { title: "Terrains", createLabel: "Neues Terrain", presets: false },
    regions: { title: "Regions", createLabel: "Neue Region", presets: false },
});

export const LIBRARY_MODE_DESCRIPTORS: ReadonlyArray<LibraryModeDescriptor> = Object.freeze(
    LIBRARY_SOURCE_IDS.map((id): LibraryModeDescriptor => {
        const meta = LIBRARY_MODE_LABELS[id];
        return Object.freeze({
            id,
            title: meta.title,
            description: describeLibrarySource(id),
            supportsCreation: true,
            supportsPresets: meta.presets,
            defaultCreateLabel: meta.createLabel,
        });
    })
);

export function listLibraryModeDescriptors(): readonly LibraryModeDescriptor[] {
    return LIBRARY_MODE_DESCRIPTORS;
}

export function describeLibraryMode(id: LibraryModeId): LibraryModeDescriptor {
    const descriptor = LIBRARY_MODE_DESCRIPTORS.find(entry => entry.id === id);
    if (!descriptor) {
        throw new Error(`Unknown library mode: ${id as string}`);
    }
    return descriptor;
}

export interface LibraryModeCompositionPlan {
    readonly storagePortModule: string;
    readonly serializerTemplate: string;
    readonly eventTopics: readonly string[];
}

export const LIBRARY_MODE_COMPOSITION: Readonly<Record<LibraryModeId, LibraryModeCompositionPlan>> = Object.freeze({
    creatures: Object.freeze({
        storagePortModule: "@core/library/storage/creatures",
        serializerTemplate: "statblock.markdown",
        eventTopics: Object.freeze(["library:creature:changed", "library:creature:created"]),
    }),
    spells: Object.freeze({
        storagePortModule: "@core/library/storage/spells",
        serializerTemplate: "spell.markdown",
        eventTopics: Object.freeze(["library:spell:changed", "library:spell:created"]),
    }),
    items: Object.freeze({
        storagePortModule: "@core/library/storage/items",
        serializerTemplate: "item.markdown",
        eventTopics: Object.freeze(["library:item:changed", "library:item:created"]),
    }),
    equipment: Object.freeze({
        storagePortModule: "@core/library/storage/equipment",
        serializerTemplate: "equipment.markdown",
        eventTopics: Object.freeze(["library:equipment:changed", "library:equipment:created"]),
    }),
    terrains: Object.freeze({
        storagePortModule: "@core/library/storage/terrains",
        serializerTemplate: "terrain.block",
        eventTopics: Object.freeze(["library:terrain:changed"]),
    }),
    regions: Object.freeze({
        storagePortModule: "@core/library/storage/regions",
        serializerTemplate: "region.block",
        eventTopics: Object.freeze(["library:region:changed"]),
    }),
});
