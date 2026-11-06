import {
  restoreCreatureCatalogViewState,
  type CreatureCatalogViewState,
} from "./creature-catalog-view-state";

export const CATALOG_WORKSPACE_SCHEMA_VERSION = 1;

export const CATALOG_SECTIONS = Object.freeze([
  Object.freeze({ key: "creatures", label: "Monster", capability: "available" }),
  Object.freeze({ key: "items", label: "Items", capability: "unavailable" }),
  Object.freeze({ key: "savedEncounters", label: "Gespeicherte Encounter", capability: "unavailable" }),
  Object.freeze({ key: "npcs", label: "NSCs", capability: "unavailable" }),
  Object.freeze({ key: "factions", label: "Fraktionen", capability: "unavailable" }),
  Object.freeze({ key: "places", label: "Orte", capability: "unavailable" }),
  Object.freeze({ key: "encounterTables", label: "Encounter-Tabellen", capability: "unavailable" }),
] as const);

export type CatalogSectionKey = typeof CATALOG_SECTIONS[number]["key"];

export interface UnavailableCatalogSectionState {
  readonly search?: string;
  readonly searchDraft?: string;
  readonly filters: readonly [];
  readonly sort: "name";
  readonly direction: "asc" | "desc";
  readonly page: number;
  readonly selectedId?: string;
  readonly resultsScroll: number;
  readonly detailScroll: number;
}

export interface ItemCatalogSectionState extends UnavailableCatalogSectionState { readonly section: "items" }
export interface SavedEncounterCatalogSectionState extends UnavailableCatalogSectionState { readonly section: "savedEncounters" }
export interface NpcCatalogSectionState extends UnavailableCatalogSectionState { readonly section: "npcs" }
export interface FactionCatalogSectionState extends UnavailableCatalogSectionState { readonly section: "factions" }
export interface PlaceCatalogSectionState extends UnavailableCatalogSectionState { readonly section: "places" }
export interface EncounterTableCatalogSectionState extends UnavailableCatalogSectionState { readonly section: "encounterTables" }

export interface CatalogSectionStateMap {
  readonly creatures: CreatureCatalogViewState;
  readonly items: ItemCatalogSectionState;
  readonly savedEncounters: SavedEncounterCatalogSectionState;
  readonly npcs: NpcCatalogSectionState;
  readonly factions: FactionCatalogSectionState;
  readonly places: PlaceCatalogSectionState;
  readonly encounterTables: EncounterTableCatalogSectionState;
}

export interface CatalogWorkspaceState {
  readonly schemaVersion: typeof CATALOG_WORKSPACE_SCHEMA_VERSION;
  readonly activeSection: CatalogSectionKey;
  readonly sections: CatalogSectionStateMap;
}

const SECTION_KEYS = new Set<string>(CATALOG_SECTIONS.map(({ key }) => key));

export function isCatalogSectionKey(value: unknown): value is CatalogSectionKey {
  return typeof value === "string" && SECTION_KEYS.has(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function draftValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function restoreUnavailableCatalogSectionState(value: unknown): UnavailableCatalogSectionState {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    search: stringValue(source.search),
    searchDraft: draftValue(source.searchDraft) ?? stringValue(source.search),
    filters: Object.freeze([]),
    sort: "name",
    direction: source.direction === "desc" ? "desc" : "asc",
    page: nonNegativeInteger(source.page),
    selectedId: stringValue(source.selectedId),
    resultsScroll: nonNegativeNumber(source.resultsScroll),
    detailScroll: nonNegativeNumber(source.detailScroll),
  };
}

export const restoreItemCatalogSectionState = (value: unknown): ItemCatalogSectionState =>
  ({ ...restoreUnavailableCatalogSectionState(value), section: "items" });
export const restoreSavedEncounterCatalogSectionState = (value: unknown): SavedEncounterCatalogSectionState =>
  ({ ...restoreUnavailableCatalogSectionState(value), section: "savedEncounters" });
export const restoreNpcCatalogSectionState = (value: unknown): NpcCatalogSectionState =>
  ({ ...restoreUnavailableCatalogSectionState(value), section: "npcs" });
export const restoreFactionCatalogSectionState = (value: unknown): FactionCatalogSectionState =>
  ({ ...restoreUnavailableCatalogSectionState(value), section: "factions" });
export const restorePlaceCatalogSectionState = (value: unknown): PlaceCatalogSectionState =>
  ({ ...restoreUnavailableCatalogSectionState(value), section: "places" });
export const restoreEncounterTableCatalogSectionState = (value: unknown): EncounterTableCatalogSectionState =>
  ({ ...restoreUnavailableCatalogSectionState(value), section: "encounterTables" });

const SECTION_RESTORERS = Object.freeze({
  creatures: restoreCreatureCatalogViewState,
  items: restoreItemCatalogSectionState,
  savedEncounters: restoreSavedEncounterCatalogSectionState,
  npcs: restoreNpcCatalogSectionState,
  factions: restoreFactionCatalogSectionState,
  places: restorePlaceCatalogSectionState,
  encounterTables: restoreEncounterTableCatalogSectionState,
});

function emptySections(): CatalogSectionStateMap {
  return {
    creatures: SECTION_RESTORERS.creatures({}),
    items: SECTION_RESTORERS.items({}),
    savedEncounters: SECTION_RESTORERS.savedEncounters({}),
    npcs: SECTION_RESTORERS.npcs({}),
    factions: SECTION_RESTORERS.factions({}),
    places: SECTION_RESTORERS.places({}),
    encounterTables: SECTION_RESTORERS.encounterTables({}),
  };
}

/** Restore v1 state, or losslessly place the current CE-01 state under creatures. */
export function restoreCatalogWorkspaceState(value: unknown): CatalogWorkspaceState {
  const root = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  if (!("schemaVersion" in root)) {
    return {
      schemaVersion: CATALOG_WORKSPACE_SCHEMA_VERSION,
      activeSection: "creatures",
      sections: { ...emptySections(), creatures: restoreCreatureCatalogViewState(root) },
    };
  }
  if (root.schemaVersion !== CATALOG_WORKSPACE_SCHEMA_VERSION ||
    !root.sections || typeof root.sections !== "object" || Array.isArray(root.sections))
    return { schemaVersion: CATALOG_WORKSPACE_SCHEMA_VERSION,
      activeSection: "creatures", sections: emptySections() };
  const source = root.sections as Record<string, unknown>;
  const creatureState = source.creatures && typeof source.creatures === "object"
    ? source.creatures as Record<string, unknown> : {};
  const sections: CatalogSectionStateMap = {
    creatures: SECTION_RESTORERS.creatures(creatureState),
    items: SECTION_RESTORERS.items(source.items),
    savedEncounters: SECTION_RESTORERS.savedEncounters(source.savedEncounters),
    npcs: SECTION_RESTORERS.npcs(source.npcs),
    factions: SECTION_RESTORERS.factions(source.factions),
    places: SECTION_RESTORERS.places(source.places),
    encounterTables: SECTION_RESTORERS.encounterTables(source.encounterTables),
  };
  return {
    schemaVersion: CATALOG_WORKSPACE_SCHEMA_VERSION,
    activeSection: isCatalogSectionKey(root.activeSection) ? root.activeSection : "creatures",
    sections,
  };
}
