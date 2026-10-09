import assert from "node:assert/strict";
import test from "node:test";
import type { Creature } from "../../src/features/catalog/creature-catalog";
import {
  CREATURE_CATALOG_PAGE_SIZE,
  adjacentCreatureId,
  clearCreatureCatalogFilters,
  creatureCatalogActiveFilters,
  creatureCatalogQueryForState,
  creatureCatalogSortChange,
  normalizeCreatureCatalogViewState,
} from "../../src/features/catalog/creature-catalog-view-state";

test("catalog view state restores every valid serializable value and rejects invalid values", () => {
  const state = normalizeCreatureCatalogViewState({
    text: "dragon",
    crMin: 5,
    crMax: Number.POSITIVE_INFINITY,
    type: "Dragon",
    subtype: "Chromatic",
    size: "Large",
    habitat: "Mountain",
    alignment: "Chaotic evil",
    acMin: 17,
    acMax: 22,
    hpMin: 100,
    hpMax: 250,
    movement: "fly",
    senses: "blindsight",
    vulnerabilities: "cold",
    resistances: "magic",
    immunities: "fire",
    conditionImmunities: "paralyzed",
    pendingText: { text: "dra", movement: 7, senses: "blind" },
    sort: "hp",
    direction: "desc",
    page: 2,
    selectedId: "adult-red-dragon",
    resultsScroll: 180,
    detailScroll: -1,
  });
  assert.equal(state.text, "dragon");
  assert.equal(state.crMax, undefined);
  assert.equal(state.subtype, "Chromatic");
  assert.equal(state.habitat, "Mountain");
  assert.equal(state.acMin, 17);
  assert.equal(state.hpMax, 250);
  assert.equal(state.conditionImmunities, "paralyzed");
  assert.deepEqual(state.pendingText, { text: "dra", senses: "blind" });
  assert.equal(state.sort, "hp");
  assert.equal(state.page, 2);
  assert.equal(state.resultsScroll, 180);
  assert.equal(state.detailScroll, undefined);
  assert.equal(
    normalizeCreatureCatalogViewState({ sort: "broken", page: 1.5 }).sort,
    undefined,
  );
  assert.equal(
    normalizeCreatureCatalogViewState({ sort: "broken", page: 1.5 }).page,
    undefined,
  );
});

test("catalog view state maps the complete filter contract into a bounded query", () => {
  const state = {
    text: "dragon",
    crMin: 5,
    crMax: 10,
    type: "Dragon",
    subtype: "Chromatic",
    size: "Large",
    habitat: "Mountain",
    alignment: "Chaotic evil",
    acMin: 17,
    acMax: 22,
    hpMin: 100,
    hpMax: 250,
    movement: "fly",
    senses: "blindsight",
    vulnerabilities: "cold",
    resistances: "magic",
    immunities: "fire",
    conditionImmunities: "paralyzed",
    sort: "cr" as const,
    direction: "desc" as const,
    page: 3,
  };
  assert.deepEqual(creatureCatalogQueryForState(state), {
    text: "dragon",
    crMin: 5,
    crMax: 10,
    types: ["Dragon"],
    subtypes: ["Chromatic"],
    sizes: ["Large"],
    habitats: ["Mountain"],
    alignments: ["Chaotic evil"],
    acMin: 17,
    acMax: 22,
    hpMin: 100,
    hpMax: 250,
    movement: "fly",
    senses: "blindsight",
    vulnerabilities: "cold",
    resistances: "magic",
    immunities: "fire",
    conditionImmunities: "paralyzed",
    sort: "cr",
    direction: "desc",
    offset: CREATURE_CATALOG_PAGE_SIZE * 3,
    limit: CREATURE_CATALOG_PAGE_SIZE,
  });
  assert.deepEqual(creatureCatalogSortChange(state, "cr"), {
    sort: "cr",
    direction: "asc",
    page: 0,
    resultsScroll: 0,
  });
  assert.deepEqual(creatureCatalogSortChange(state, "hp"), {
    sort: "hp",
    direction: "asc",
    page: 0,
    resultsScroll: 0,
  });
});

test("catalog filter chips expose every active filter and reset only filters", () => {
  const state = {
    text: "dragon",
    crMin: 5,
    type: "Dragon",
    conditionImmunities: "paralyzed",
    pendingText: { text: "drag" },
    sort: "hp" as const,
    direction: "desc" as const,
    page: 4,
    selectedId: "adult-red-dragon",
    resultsScroll: 99,
    detailScroll: 12,
  };
  assert.deepEqual(
    creatureCatalogActiveFilters(state).map(({ key, value }) => [key, value]),
    [
      ["text", "dragon"],
      ["crMin", "5"],
      ["type", "Dragon"],
      ["conditionImmunities", "paralyzed"],
    ],
  );
  assert.deepEqual(clearCreatureCatalogFilters(state), {
    sort: "hp",
    direction: "desc",
    page: 0,
    selectedId: "adult-red-dragon",
    resultsScroll: 0,
    detailScroll: 12,
  });
});

test("catalog keyboard selection stays within the current result page", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }] as Creature[];
  assert.equal(adjacentCreatureId(rows, "a", -1), "a");
  assert.equal(adjacentCreatureId(rows, "a", 1), "b");
  assert.equal(adjacentCreatureId(rows, "c", 1), "c");
  assert.equal(adjacentCreatureId(rows, "missing", 1), undefined);
});
