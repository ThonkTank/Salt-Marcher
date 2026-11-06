import type { Creature, CreatureCatalog, CreatureCatalogPage } from "./creature-catalog";
import { creatureCatalogQueryForState, type CreatureCatalogViewState } from "./creature-catalog-view-state";
import {
  type CatalogSectionKey,
  type CatalogSectionStateMap,
} from "./catalog-workspace-state";

export type CatalogProviderCapability =
  | { readonly status: "available"; readonly source: string }
  | { readonly status: "missing"; readonly reason: string }
  | { readonly status: "unavailable"; readonly reason: string };

export interface CatalogProviderRequest<Section extends CatalogSectionKey> {
  readonly section: Section;
  readonly generation: number;
  readonly signal: AbortSignal;
}

export type CatalogQueryResult<Row> =
  | { readonly status: "ready"; readonly rows: readonly Row[]; readonly total: number;
    readonly offset: number; readonly limit: number;
    readonly facets?: Readonly<Record<string, readonly string[]>> }
  | { readonly status: "empty"; readonly rows: readonly Row[]; readonly total: 0;
    readonly offset: number; readonly limit: number;
    readonly facets?: Readonly<Record<string, readonly string[]>> }
  | { readonly status: "invalid"; readonly message: string }
  | { readonly status: "missing"; readonly reason: string }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "error"; readonly message: string; readonly retryable: boolean };

export type CatalogDetailResult<Detail> =
  | { readonly status: "ready"; readonly detail: Detail }
  | { readonly status: "missing" }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "error"; readonly message: string; readonly retryable: boolean };

export interface CatalogSectionProvider<Section extends CatalogSectionKey, State, Row, Detail> {
  readonly section: Section;
  readonly capability: CatalogProviderCapability;
  query(state: State, request: CatalogProviderRequest<Section>): Promise<CatalogQueryResult<Row>>;
  detail(id: string, request: CatalogProviderRequest<Section>): Promise<CatalogDetailResult<Detail>>;
}

type CatalogProviderFor<Section extends CatalogSectionKey> = Section extends "creatures"
  ? CatalogSectionProvider<Section, CreatureCatalogViewState, Creature, Creature>
  : CatalogSectionProvider<Section, CatalogSectionStateMap[Section], never, never>;

export type CatalogProviderRegistry = Readonly<{
  [Section in CatalogSectionKey]: CatalogProviderFor<Section>;
}>;

function aborted(): Error {
  const error = new Error("Kataloganfrage abgebrochen");
  error.name = "AbortError";
  return error;
}

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw aborted();
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function facets(catalog: CreatureCatalog): Readonly<Record<string, readonly string[]>> {
  const field = (key: "type" | "subtype" | "size" | "alignment" | "biomes") => Object.freeze(
    [...new Set(catalog.creatures.flatMap((creature) => {
      const value = creature[key];
      return Array.isArray(value) ? [...value] : value ? [value] : [];
    }))].sort((left, right) => left.localeCompare(right, "en")),
  );
  return Object.freeze({
    type: field("type"), subtype: field("subtype"), size: field("size"),
    alignment: field("alignment"), biomes: field("biomes"),
  });
}

export function createCreatureCatalogProvider(
  load: () => Promise<CreatureCatalog>,
): CatalogSectionProvider<"creatures", CreatureCatalogViewState, Creature, Creature> {
  return {
    section: "creatures",
    capability: Object.freeze({ status: "available", source: "SRD 5.1" }),
    async query(state, request): Promise<CatalogQueryResult<Creature>> {
      if (request.section !== "creatures")
        return Object.freeze({ status: "invalid", message: "Falscher Providerbereich." });
      try {
        assertActive(request.signal);
        const catalog = await load();
        assertActive(request.signal);
        const page: CreatureCatalogPage = catalog.search(creatureCatalogQueryForState(state));
        const metadata = facets(catalog);
        return page.total
          ? Object.freeze({ status: "ready", rows: Object.freeze([...page.rows]),
            total: page.total, offset: page.offset, limit: page.limit, facets: metadata })
          : Object.freeze({ status: "empty", rows: Object.freeze([]), total: 0 as const,
            offset: page.offset, limit: page.limit, facets: metadata });
      } catch (error) {
        if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
        return Object.freeze({ status: "error", message: message(error), retryable: true });
      }
    },
    async detail(id, request) {
      if (request.section !== "creatures")
        return Object.freeze({ status: "error", message: "Falscher Providerbereich.", retryable: false });
      try {
        assertActive(request.signal);
        const catalog = await load();
        assertActive(request.signal);
        const detail = catalog.detail(id);
        return detail ? Object.freeze({ status: "ready", detail }) : Object.freeze({ status: "missing" });
      } catch (error) {
        if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
        return Object.freeze({ status: "error", message: message(error), retryable: true });
      }
    },
  };
}

export function createCatalogProviderRegistry(
  loadCreatures: () => Promise<CreatureCatalog>,
): CatalogProviderRegistry {
  const unavailable = <Section extends Exclude<CatalogSectionKey, "creatures">>(section: Section):
  CatalogSectionProvider<Section, unknown, never, never> => ({
    section,
    capability: Object.freeze({
      status: "unavailable",
      reason: "Datenquelle für diesen Bereich ist noch nicht implementiert.",
    }),
    async query() {
      return Object.freeze({ status: "unavailable", reason: "Datenquelle für diesen Bereich ist noch nicht implementiert." });
    },
    async detail() {
      return Object.freeze({ status: "unavailable", reason: "Datenquelle für diesen Bereich ist noch nicht implementiert." });
    },
  });
  return Object.freeze({
    creatures: createCreatureCatalogProvider(loadCreatures),
    items: unavailable("items"),
    savedEncounters: unavailable("savedEncounters"),
    npcs: unavailable("npcs"),
    factions: unavailable("factions"),
    places: unavailable("places"),
    encounterTables: unavailable("encounterTables"),
  }) satisfies CatalogProviderRegistry;
}
