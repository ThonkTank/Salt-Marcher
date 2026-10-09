import type {
  Creature,
  CreatureCatalogQuery,
  CreatureCatalogSort,
} from "./creature-catalog";

export const CREATURE_CATALOG_PAGE_SIZE = 50;
const SORTS: readonly CreatureCatalogSort[] = ["name", "cr", "ac", "hp", "xp"];

export interface CreatureCatalogViewState {
  readonly text?: string;
  readonly textDraft?: string;
  readonly crMin?: number;
  readonly crMax?: number;
  readonly types?: readonly string[];
  readonly subtypes?: readonly string[];
  readonly sizes?: readonly string[];
  readonly habitats?: readonly string[];
  readonly alignments?: readonly string[];
  readonly acMin?: number;
  readonly acMax?: number;
  readonly hpMin?: number;
  readonly hpMax?: number;
  readonly movement?: string;
  readonly movementDraft?: string;
  readonly senses?: string;
  readonly sensesDraft?: string;
  readonly vulnerabilities?: string;
  readonly vulnerabilitiesDraft?: string;
  readonly resistances?: string;
  readonly resistancesDraft?: string;
  readonly immunities?: string;
  readonly immunitiesDraft?: string;
  readonly conditionImmunities?: string;
  readonly conditionImmunitiesDraft?: string;
  readonly sort?: CreatureCatalogSort;
  readonly direction?: "asc" | "desc";
  readonly page?: number;
  readonly selectedId?: string;
  readonly resultsScroll?: number;
  readonly detailScroll?: number;
}

export type CreatureCatalogArrayFilter = "types" | "subtypes" | "sizes" | "habitats" | "alignments";
export type CreatureCatalogScalarFilter = "text" | "crMin" | "crMax" | "acMin" | "acMax" |
  "hpMin" | "hpMax" | "movement" | "senses" | "vulnerabilities" | "resistances" |
  "immunities" | "conditionImmunities";
export type CreatureCatalogFilterKey = CreatureCatalogArrayFilter | CreatureCatalogScalarFilter;
export type CreatureCatalogTextFilter = "text" | "movement" | "senses" | "vulnerabilities" |
  "resistances" | "immunities" | "conditionImmunities";
export type CreatureCatalogDraftKey = "textDraft" | "movementDraft" | "sensesDraft" |
  "vulnerabilitiesDraft" | "resistancesDraft" | "immunitiesDraft" | "conditionImmunitiesDraft";

export const CREATURE_CATALOG_DRAFT_FILTERS:
readonly [CreatureCatalogTextFilter, CreatureCatalogDraftKey][] = [
  ["text", "textDraft"],
  ["movement", "movementDraft"],
  ["senses", "sensesDraft"],
  ["vulnerabilities", "vulnerabilitiesDraft"],
  ["resistances", "resistancesDraft"],
  ["immunities", "immunitiesDraft"],
  ["conditionImmunities", "conditionImmunitiesDraft"],
];

export function creatureCatalogDraftKeyForFilter(
  filterKey: CreatureCatalogTextFilter,
): CreatureCatalogDraftKey {
  const pair = CREATURE_CATALOG_DRAFT_FILTERS.find(([candidate]) => candidate === filterKey);
  if (!pair) throw new Error(`Missing catalog draft mapping for ${filterKey}`);
  return pair[1];
}

export interface CreatureCatalogFilterChip {
  readonly key: CreatureCatalogFilterKey;
  readonly value?: string;
  readonly label: string;
}

export interface RestoredCreatureCatalogViewState extends CreatureCatalogViewState {
  readonly sort: CreatureCatalogSort;
  readonly direction: "asc" | "desc";
  readonly page: number;
}

const ARRAY_FILTERS: readonly CreatureCatalogArrayFilter[] =
  ["types", "subtypes", "sizes", "habitats", "alignments"];
const SCALAR_FILTERS: readonly CreatureCatalogScalarFilter[] = [
  "text", "crMin", "crMax", "acMin", "acMax", "hpMin", "hpMax", "movement", "senses",
  "vulnerabilities", "resistances", "immunities", "conditionImmunities",
];
const LABELS: Readonly<Record<CreatureCatalogFilterKey, string>> = {
  text: "Name", crMin: "HG min", crMax: "HG max", types: "Typ", subtypes: "Subtyp",
  sizes: "Größe", habitats: "Habitat", alignments: "Gesinnung", acMin: "RK min", acMax: "RK max",
  hpMin: "TP min", hpMax: "TP max", movement: "Bewegung", senses: "Sinne",
  vulnerabilities: "Verwundbarkeit", resistances: "Resistenz", immunities: "Immunität",
  conditionImmunities: "Zustandsimmunität",
};

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function draftValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringValues(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = [...new Set(value.map(stringValue).filter((entry): entry is string => Boolean(entry)))];
  return entries.length ? entries : undefined;
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
    textDraft: draftValue(value.textDraft),
    crMin: finiteNonNegative(value.crMin),
    crMax: finiteNonNegative(value.crMax),
    types: stringValues(value.types ?? (value.type ? [value.type] : undefined)),
    subtypes: stringValues(value.subtypes),
    sizes: stringValues(value.sizes ?? (value.size ? [value.size] : undefined)),
    habitats: stringValues(value.habitats),
    alignments: stringValues(value.alignments),
    acMin: finiteNonNegative(value.acMin),
    acMax: finiteNonNegative(value.acMax),
    hpMin: finiteNonNegative(value.hpMin),
    hpMax: finiteNonNegative(value.hpMax),
    movement: stringValue(value.movement),
    movementDraft: draftValue(value.movementDraft),
    senses: stringValue(value.senses),
    sensesDraft: draftValue(value.sensesDraft),
    vulnerabilities: stringValue(value.vulnerabilities),
    vulnerabilitiesDraft: draftValue(value.vulnerabilitiesDraft),
    resistances: stringValue(value.resistances),
    resistancesDraft: draftValue(value.resistancesDraft),
    immunities: stringValue(value.immunities),
    immunitiesDraft: draftValue(value.immunitiesDraft),
    conditionImmunities: stringValue(value.conditionImmunities),
    conditionImmunitiesDraft: draftValue(value.conditionImmunitiesDraft),
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

export function restoreCreatureCatalogViewState(
  value: Record<string, unknown>,
): RestoredCreatureCatalogViewState {
  const normalized = normalizeCreatureCatalogViewState(value);
  const restored: Record<string, unknown> = {
    ...normalized,
    sort: normalized.sort ?? "name",
    direction: normalized.direction ?? "asc",
    page: normalized.page ?? 0,
  };
  for (const [filterKey, draftKey] of CREATURE_CATALOG_DRAFT_FILTERS)
    restored[draftKey] = normalized[draftKey] ?? normalized[filterKey];
  return restored as unknown as RestoredCreatureCatalogViewState;
}

export function creatureCatalogQueryForState(
  state: CreatureCatalogViewState,
): CreatureCatalogQuery {
  return {
    text: state.text,
    crMin: state.crMin,
    crMax: state.crMax,
    types: state.types,
    subtypes: state.subtypes,
    sizes: state.sizes,
    habitats: state.habitats,
    alignments: state.alignments,
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

export function creatureCatalogRangeError(state: CreatureCatalogViewState): string | undefined {
  for (const [label, minimum, maximum] of [
    ["HG", state.crMin, state.crMax], ["RK", state.acMin, state.acMax], ["TP", state.hpMin, state.hpMax],
  ] as const) if (minimum !== undefined && maximum !== undefined && minimum > maximum)
    return `${label} min darf ${label} max nicht überschreiten.`;
  return undefined;
}

export function creatureCatalogFilterChips(
  state: CreatureCatalogViewState,
): readonly CreatureCatalogFilterChip[] {
  const chips: CreatureCatalogFilterChip[] = [];
  for (const key of ARRAY_FILTERS)
    for (const value of state[key] ?? []) chips.push({ key, value, label: `${LABELS[key]}: ${value}` });
  for (const key of SCALAR_FILTERS) {
    const value = state[key];
    if (value !== undefined && value !== "") chips.push({ key, label: `${LABELS[key]}: ${value}` });
  }
  return chips;
}

export function removeCreatureCatalogFilter(
  state: CreatureCatalogViewState,
  key: CreatureCatalogFilterKey,
  value?: string,
): CreatureCatalogViewState {
  if ((ARRAY_FILTERS as readonly string[]).includes(key)) {
    const arrayKey = key as CreatureCatalogArrayFilter;
    const remaining = state[arrayKey]?.filter((entry) => entry !== value);
    return { ...state, [arrayKey]: remaining?.length ? remaining : undefined, page: 0, resultsScroll: 0 };
  }
  const next = { ...state, [key]: undefined, page: 0, resultsScroll: 0 };
  const draftKey = `${key}Draft`;
  if (draftKey in state) return { ...next, [draftKey]: undefined };
  return next;
}

export function resetCreatureCatalogFilters(state: CreatureCatalogViewState): CreatureCatalogViewState {
  const next = { ...state } as Record<string, unknown>;
  for (const key of [...ARRAY_FILTERS, ...SCALAR_FILTERS,
    ...CREATURE_CATALOG_DRAFT_FILTERS.map(([, draftKey]) => draftKey)])
    delete next[key];
  next.page = 0;
  next.resultsScroll = 0;
  return next as CreatureCatalogViewState;
}

export function applyCreatureCatalogDrafts(
  state: CreatureCatalogViewState,
): CreatureCatalogViewState {
  const next = { ...state } as Record<string, unknown>;
  let changed = false;
  for (const [filterKey, draftKey] of CREATURE_CATALOG_DRAFT_FILTERS) {
    if (!(draftKey in state)) continue;
    const applied = state[draftKey]?.trim() || undefined;
    if (state[filterKey] === applied) continue;
    next[filterKey] = applied;
    changed = true;
  }
  if (!changed) return state;
  next.page = 0;
  next.resultsScroll = 0;
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
