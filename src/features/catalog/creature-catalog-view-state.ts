import type { Creature, CreatureCatalogQuery, CreatureCatalogSort } from "./creature-catalog";

export const CREATURE_CATALOG_PAGE_SIZE = 50;
const SORTS: readonly CreatureCatalogSort[] = ["name", "cr", "ac", "hp", "xp"];

export interface CreatureCatalogViewState {
  readonly text?: string;
  readonly crMin?: number;
  readonly crMax?: number;
  readonly type?: string;
  readonly size?: string;
  readonly sort?: CreatureCatalogSort;
  readonly direction?: "asc" | "desc";
  readonly page?: number;
  readonly selectedId?: string;
  readonly resultsScroll?: number;
  readonly detailScroll?: number;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function normalizeCreatureCatalogViewState(
  value: Record<string, unknown>,
): CreatureCatalogViewState {
  const sort = SORTS.includes(value.sort as CreatureCatalogSort)
    ? value.sort as CreatureCatalogSort : undefined;
  const direction = value.direction === "asc" || value.direction === "desc"
    ? value.direction : undefined;
  return {
    text: stringValue(value.text),
    crMin: finiteNonNegative(value.crMin),
    crMax: finiteNonNegative(value.crMax),
    type: stringValue(value.type),
    size: stringValue(value.size),
    sort,
    direction,
    page: typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 0
      ? value.page : undefined,
    selectedId: stringValue(value.selectedId),
    resultsScroll: finiteNonNegative(value.resultsScroll),
    detailScroll: finiteNonNegative(value.detailScroll),
  };
}

export function creatureCatalogQueryForState(
  state: CreatureCatalogViewState,
): CreatureCatalogQuery {
  return {
    text: state.text,
    crMin: state.crMin,
    crMax: state.crMax,
    types: state.type ? [state.type] : undefined,
    sizes: state.size ? [state.size] : undefined,
    sort: state.sort ?? "name",
    direction: state.direction ?? "asc",
    offset: (state.page ?? 0) * CREATURE_CATALOG_PAGE_SIZE,
    limit: CREATURE_CATALOG_PAGE_SIZE,
  };
}

export function creatureCatalogSortChange(
  state: CreatureCatalogViewState,
  sort: CreatureCatalogSort,
): Partial<CreatureCatalogViewState> {
  return {
    sort,
    direction: state.sort === sort && state.direction === "asc" ? "desc" : "asc",
    page: 0,
    resultsScroll: 0,
  };
}

export function adjacentCreatureId(
  rows: readonly Creature[],
  id: string,
  delta: -1 | 1,
): string | undefined {
  const current = rows.findIndex((creature) => creature.id === id);
  if (current < 0 || !rows.length) return undefined;
  return rows[Math.max(0, Math.min(rows.length - 1, current + delta))]?.id;
}
