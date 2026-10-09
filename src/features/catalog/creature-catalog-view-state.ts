import type {
  Creature,
  CreatureCatalogQuery,
  CreatureCatalogSort,
} from "./creature-catalog";

export const CREATURE_CATALOG_PAGE_SIZE = 50;
const SORTS: readonly CreatureCatalogSort[] = ["name", "cr", "ac", "hp", "xp"];

export const CREATURE_CATALOG_TEXT_FILTERS = [
  "text",
  "movement",
  "senses",
  "vulnerabilities",
  "resistances",
  "immunities",
  "conditionImmunities",
] as const;

export type CreatureCatalogTextFilter =
  (typeof CREATURE_CATALOG_TEXT_FILTERS)[number];

export interface CreatureCatalogPendingText {
  readonly text?: string;
  readonly movement?: string;
  readonly senses?: string;
  readonly vulnerabilities?: string;
  readonly resistances?: string;
  readonly immunities?: string;
  readonly conditionImmunities?: string;
}

export interface CreatureCatalogViewState {
  readonly text?: string;
  readonly crMin?: number;
  readonly crMax?: number;
  readonly type?: string;
  readonly subtype?: string;
  readonly size?: string;
  readonly habitat?: string;
  readonly alignment?: string;
  readonly acMin?: number;
  readonly acMax?: number;
  readonly hpMin?: number;
  readonly hpMax?: number;
  readonly movement?: string;
  readonly senses?: string;
  readonly vulnerabilities?: string;
  readonly resistances?: string;
  readonly immunities?: string;
  readonly conditionImmunities?: string;
  readonly pendingText?: CreatureCatalogPendingText;
  readonly sort?: CreatureCatalogSort;
  readonly direction?: "asc" | "desc";
  readonly page?: number;
  readonly selectedId?: string;
  readonly resultsScroll?: number;
  readonly detailScroll?: number;
}

export interface CreatureCatalogActiveFilter {
  readonly key: Exclude<
    keyof CreatureCatalogViewState,
    | "pendingText"
    | "sort"
    | "direction"
    | "page"
    | "selectedId"
    | "resultsScroll"
    | "detailScroll"
  >;
  readonly label: string;
  readonly value: string;
}

const FILTER_LABELS: Readonly<
  Record<CreatureCatalogActiveFilter["key"], string>
> = {
  text: "Name",
  crMin: "HG min",
  crMax: "HG max",
  type: "Typ",
  subtype: "Subtyp",
  size: "Größe",
  habitat: "Habitat",
  alignment: "Gesinnung",
  acMin: "RK min",
  acMax: "RK max",
  hpMin: "TP min",
  hpMax: "TP max",
  movement: "Bewegung",
  senses: "Sinne",
  vulnerabilities: "Verwundbarkeit",
  resistances: "Resistenz",
  immunities: "Immunität",
  conditionImmunities: "Zustandsimmunität",
};

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function pendingText(value: unknown): CreatureCatalogPendingText | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const input = value as Record<string, unknown>,
    result: Record<string, string> = {};
  for (const key of CREATURE_CATALOG_TEXT_FILTERS)
    if (typeof input[key] === "string") result[key] = input[key];
  return Object.keys(result).length ? result : undefined;
}

export function normalizeCreatureCatalogViewState(
  value: Record<string, unknown>,
): CreatureCatalogViewState {
  const sort = SORTS.includes(value.sort as CreatureCatalogSort)
    ? (value.sort as CreatureCatalogSort)
    : undefined;
  const direction =
    value.direction === "asc" || value.direction === "desc"
      ? value.direction
      : undefined;
  return {
    text: stringValue(value.text),
    crMin: finiteNonNegative(value.crMin),
    crMax: finiteNonNegative(value.crMax),
    type: stringValue(value.type),
    subtype: stringValue(value.subtype),
    size: stringValue(value.size),
    habitat: stringValue(value.habitat),
    alignment: stringValue(value.alignment),
    acMin: finiteNonNegative(value.acMin),
    acMax: finiteNonNegative(value.acMax),
    hpMin: finiteNonNegative(value.hpMin),
    hpMax: finiteNonNegative(value.hpMax),
    movement: stringValue(value.movement),
    senses: stringValue(value.senses),
    vulnerabilities: stringValue(value.vulnerabilities),
    resistances: stringValue(value.resistances),
    immunities: stringValue(value.immunities),
    conditionImmunities: stringValue(value.conditionImmunities),
    pendingText: pendingText(value.pendingText),
    sort,
    direction,
    page:
      typeof value.page === "number" &&
      Number.isSafeInteger(value.page) &&
      value.page >= 0
        ? value.page
        : undefined,
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
    subtypes: state.subtype ? [state.subtype] : undefined,
    sizes: state.size ? [state.size] : undefined,
    habitats: state.habitat ? [state.habitat] : undefined,
    alignments: state.alignment ? [state.alignment] : undefined,
    acMin: state.acMin,
    acMax: state.acMax,
    hpMin: state.hpMin,
    hpMax: state.hpMax,
    movement: state.movement,
    senses: state.senses,
    vulnerabilities: state.vulnerabilities,
    resistances: state.resistances,
    immunities: state.immunities,
    conditionImmunities: state.conditionImmunities,
    sort: state.sort ?? "name",
    direction: state.direction ?? "asc",
    offset: (state.page ?? 0) * CREATURE_CATALOG_PAGE_SIZE,
    limit: CREATURE_CATALOG_PAGE_SIZE,
  };
}

export function creatureCatalogActiveFilters(
  state: CreatureCatalogViewState,
): readonly CreatureCatalogActiveFilter[] {
  const filters: CreatureCatalogActiveFilter[] = [];
  for (const key of Object.keys(
    FILTER_LABELS,
  ) as CreatureCatalogActiveFilter["key"][]) {
    const value = state[key];
    if (typeof value === "string" && value.trim())
      filters.push({ key, label: FILTER_LABELS[key], value });
    else if (typeof value === "number" && Number.isFinite(value))
      filters.push({ key, label: FILTER_LABELS[key], value: String(value) });
  }
  return filters;
}

export function clearCreatureCatalogFilters(
  state: CreatureCatalogViewState,
): CreatureCatalogViewState {
  return {
    sort: state.sort,
    direction: state.direction,
    page: 0,
    selectedId: state.selectedId,
    resultsScroll: 0,
    detailScroll: state.detailScroll,
  };
}

export function applyCreatureCatalogPendingText(
  state: CreatureCatalogViewState,
): CreatureCatalogViewState {
  if (!state.pendingText) return state;
  const next: Record<string, unknown> = {
    ...state,
    pendingText: undefined,
    page: 0,
    resultsScroll: 0,
  };
  for (const key of CREATURE_CATALOG_TEXT_FILTERS) {
    const value = state.pendingText[key];
    if (value === undefined) continue;
    next[key] = value.trim() || undefined;
  }
  return next as CreatureCatalogViewState;
}

export function creatureCatalogSortChange(
  state: CreatureCatalogViewState,
  sort: CreatureCatalogSort,
): Partial<CreatureCatalogViewState> {
  return {
    sort,
    direction:
      state.sort === sort && state.direction === "asc" ? "desc" : "asc",
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
