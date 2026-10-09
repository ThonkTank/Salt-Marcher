import assert from "node:assert/strict";
import test from "node:test";
import type { Creature } from "../../src/features/catalog/creature-catalog";
import {
  CREATURE_CATALOG_PAGE_SIZE,
  adjacentCreatureId,
  creatureCatalogQueryForState,
  creatureCatalogSortChange,
  normalizeCreatureCatalogViewState,
} from "../../src/features/catalog/creature-catalog-view-state";

test("catalog view state restores only valid serializable values", () => {
  assert.deepEqual(normalizeCreatureCatalogViewState({
    text: "dragon",
    crMin: 5,
    crMax: Number.POSITIVE_INFINITY,
    type: "Dragon",
    size: "Large",
    sort: "hp",
    direction: "desc",
    page: 2,
    selectedId: "adult-red-dragon",
    resultsScroll: 180,
    detailScroll: -1,
  }), {
    text: "dragon",
    crMin: 5,
    crMax: undefined,
    type: "Dragon",
    size: "Large",
    sort: "hp",
    direction: "desc",
    page: 2,
    selectedId: "adult-red-dragon",
    resultsScroll: 180,
    detailScroll: undefined,
  });
  assert.equal(normalizeCreatureCatalogViewState({ sort: "broken", page: 1.5 }).sort, undefined);
  assert.equal(normalizeCreatureCatalogViewState({ sort: "broken", page: 1.5 }).page, undefined);
});

test("catalog view state produces the bounded core query and resets sorting page", () => {
  const state = {
    text: "dragon",
    crMin: 5,
    crMax: 10,
    type: "Dragon",
    size: "Large",
    sort: "cr" as const,
    direction: "desc" as const,
    page: 3,
  };
  assert.deepEqual(creatureCatalogQueryForState(state), {
    text: "dragon",
    crMin: 5,
    crMax: 10,
    types: ["Dragon"],
    sizes: ["Large"],
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

test("catalog keyboard selection stays within the current result page", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }] as Creature[];
  assert.equal(adjacentCreatureId(rows, "a", -1), "a");
  assert.equal(adjacentCreatureId(rows, "a", 1), "b");
  assert.equal(adjacentCreatureId(rows, "c", 1), "c");
  assert.equal(adjacentCreatureId(rows, "missing", 1), undefined);
});
