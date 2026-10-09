import assert from "node:assert/strict";
import test from "node:test";
import type { Creature } from "../../src/features/catalog/creature-catalog";
import {
  CREATURE_CATALOG_PAGE_SIZE,
  adjacentCreatureId,
  creatureCatalogFilterChips,
  creatureCatalogQueryForState,
  creatureCatalogRangeError,
  creatureCatalogSortChange,
  normalizeCreatureCatalogViewState,
  removeCreatureCatalogFilter,
  resetCreatureCatalogFilters,
} from "../../src/features/catalog/creature-catalog-view-state";

test("catalog view state restores only valid serializable values", () => {
  const normalized = normalizeCreatureCatalogViewState({
    text: "dragon",
    crMin: 5,
    crMax: Number.POSITIVE_INFINITY,
    types: ["Dragon", "Dragon", ""],
    sizes: ["Large"],
    sort: "hp",
    direction: "desc",
    page: 2,
    selectedId: "adult-red-dragon",
    resultsScroll: 180,
    detailScroll: -1,
  });
  assert.equal(normalized.text, "dragon");
  assert.equal(normalized.crMin, 5);
  assert.equal(normalized.crMax, undefined);
  assert.deepEqual(normalized.types, ["Dragon"]);
  assert.deepEqual(normalized.sizes, ["Large"]);
  assert.equal(normalized.sort, "hp");
  assert.equal(normalized.direction, "desc");
  assert.equal(normalized.page, 2);
  assert.equal(normalized.selectedId, "adult-red-dragon");
  assert.equal(normalized.resultsScroll, 180);
  assert.equal(normalized.detailScroll, undefined);
  assert.equal(normalizeCreatureCatalogViewState({ sort: "broken", page: 1.5 }).sort, undefined);
  assert.equal(normalizeCreatureCatalogViewState({ sort: "broken", page: 1.5 }).page, undefined);
  assert.equal(normalizeCreatureCatalogViewState({ text: "dragon", textDraft: "" }).textDraft, "");
});

test("catalog view state produces the bounded core query and resets sorting page", () => {
  const state = {
    text: "dragon",
    crMin: 5,
    crMax: 10,
    types: ["Dragon"],
    sizes: ["Large"],
    subtypes: ["Shapechanger"],
    habitats: ["Mountain"],
    alignments: ["Chaotic Evil"],
    acMin: 15,
    acMax: 22,
    hpMin: 100,
    hpMax: 300,
    movement: "fly",
    senses: "blindsight",
    vulnerabilities: "radiant",
    resistances: "cold",
    immunities: "fire",
    conditionImmunities: "charmed",
    sort: "cr" as const,
    direction: "desc" as const,
    page: 3,
  };
  assert.deepEqual(creatureCatalogQueryForState(state), {
    text: "dragon",
    crMin: 5,
    crMax: 10,
    types: ["Dragon"],
    subtypes: ["Shapechanger"],
    sizes: ["Large"],
    habitats: ["Mountain"],
    alignments: ["Chaotic Evil"],
    acMin: 15,
    acMax: 22,
    hpMin: 100,
    hpMax: 300,
    movement: "fly",
    senses: "blindsight",
    vulnerabilities: "radiant",
    resistances: "cold",
    immunities: "fire",
    conditionImmunities: "charmed",
    sort: "cr",
    direction: "desc",
    offset: CREATURE_CATALOG_PAGE_SIZE * 3,
    limit: CREATURE_CATALOG_PAGE_SIZE,
  });
  assert.deepEqual(creatureCatalogSortChange(state, "cr"), {
    sort: "cr", direction: "asc", page: 0, resultsScroll: 0,
  });
  assert.deepEqual(creatureCatalogSortChange(state, "hp"), {
    sort: "hp", direction: "asc", page: 0, resultsScroll: 0,
  });
});

test("catalog filters expose removable chips and reset without losing sort or selection", () => {
  const state = {
    text: "dragon", textDraft: "dragon", types: ["Dragon", "Fiend"], crMin: 5,
    sort: "hp" as const, direction: "desc" as const, page: 4, selectedId: "adult-red-dragon",
  };
  assert.deepEqual(creatureCatalogFilterChips(state).map((chip) => chip.label), [
    "Typ: Dragon", "Typ: Fiend", "Name: dragon", "HG min: 5",
  ]);
  const oneRemoved = removeCreatureCatalogFilter(state, "types", "Dragon");
  assert.deepEqual(oneRemoved.types, ["Fiend"]);
  assert.equal(oneRemoved.page, 0);
  const reset = resetCreatureCatalogFilters(state);
  assert.equal(reset.text, undefined);
  assert.equal(reset.textDraft, undefined);
  assert.equal(reset.types, undefined);
  assert.equal(reset.crMin, undefined);
  assert.equal(reset.sort, "hp");
  assert.equal(reset.direction, "desc");
  assert.equal(reset.selectedId, "adult-red-dragon");
});

test("invalid catalog ranges remain correctable view feedback", () => {
  assert.equal(creatureCatalogRangeError({ crMin: 5, crMax: 4 }), "HG min darf HG max nicht überschreiten.");
  assert.equal(creatureCatalogRangeError({ acMin: 20, acMax: 19 }), "RK min darf RK max nicht überschreiten.");
  assert.equal(creatureCatalogRangeError({ hpMin: 2, hpMax: 1 }), "TP min darf TP max nicht überschreiten.");
  assert.equal(creatureCatalogRangeError({ crMin: 4, crMax: 5 }), undefined);
});

test("catalog keyboard selection stays within the current result page", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }] as Creature[];
  assert.equal(adjacentCreatureId(rows, "a", -1), "a");
  assert.equal(adjacentCreatureId(rows, "a", 1), "b");
  assert.equal(adjacentCreatureId(rows, "c", 1), "c");
  assert.equal(adjacentCreatureId(rows, "missing", 1), undefined);
});
