import assert from "node:assert/strict";
import test from "node:test";
import bundledSrd from "../../src/features/catalog/data/srd-5.1.generated.json";
import { CreatureCatalog } from "../../src/features/catalog/creature-catalog";
import { createCatalogProviderRegistry } from "../../src/features/catalog/catalog-provider";
import {
  CATALOG_SECTIONS,
  CATALOG_WORKSPACE_SCHEMA_VERSION,
  restoreCatalogWorkspaceState,
  type UnavailableCatalogSectionState,
} from "../../src/features/catalog/catalog-workspace-state";

test("catalog workspace has exactly one canonical seven-section definition", () => {
  assert.deepEqual(CATALOG_SECTIONS.map(({ key }) => key), [
    "creatures", "items", "savedEncounters", "npcs", "factions", "places", "encounterTables",
  ]);
  assert.equal(new Set(CATALOG_SECTIONS.map(({ key }) => key)).size, 7);
  assert.equal(new Set(CATALOG_SECTIONS.map(({ label }) => label)).size, 7);
  assert.deepEqual(CATALOG_SECTIONS.map(({ capability }) => capability), [
    "available", "unavailable", "unavailable", "unavailable", "unavailable", "unavailable", "unavailable",
  ]);
  assert.equal(Object.isFrozen(CATALOG_SECTIONS), true);
  assert.equal(CATALOG_SECTIONS.every(Object.isFrozen), true);
});

test("catalog workspace migrates CE-01 and isolates damaged section state", () => {
  for (const damaged of [null, "broken", 42, []]) {
    const safe = restoreCatalogWorkspaceState(damaged);
    assert.equal(safe.activeSection, "creatures");
    assert.equal(safe.schemaVersion, 1);
  }
  const migrated = restoreCatalogWorkspaceState({
    text: "dragon", textDraft: "drag", sort: "hp", direction: "desc", page: 2,
    selectedId: "young-red-dragon", resultsScroll: 90, detailScroll: 40,
  });
  assert.equal(migrated.schemaVersion, CATALOG_WORKSPACE_SCHEMA_VERSION);
  assert.equal(migrated.activeSection, "creatures");
  assert.equal(migrated.sections.creatures.text, "dragon");
  assert.equal(migrated.sections.creatures.textDraft, "drag");
  assert.equal(migrated.sections.creatures.sort, "hp");
  assert.equal(migrated.sections.creatures.selectedId, "young-red-dragon");
  assert.equal(migrated.sections.creatures.resultsScroll, 90);
  assert.equal(migrated.sections.creatures.detailScroll, 40);

  const restored = restoreCatalogWorkspaceState({
    schemaVersion: 1,
    activeSection: "items",
    sections: {
      creatures: { text: "aboleth" },
      items: { search: "sword", searchDraft: "", page: 3, resultsScroll: 25 },
      npcs: "damaged",
      unknown: { selectedId: "must-not-survive" },
    },
  });
  assert.equal(restored.activeSection, "items");
  assert.equal(restored.sections.creatures.text, "aboleth");
  assert.equal(restored.sections.items.search, "sword");
  assert.equal(restored.sections.items.searchDraft, "");
  assert.equal(restored.sections.items.page, 3);
  assert.equal(restored.sections.items.sort, "name");
  assert.deepEqual(restored.sections.items.filters, []);
  assert.equal(restored.sections.npcs.page, 0);
  assert.equal("unknown" in restored.sections, false);
  assert.equal(restoreCatalogWorkspaceState({ schemaVersion: 1,
    activeSection: "unknown", sections: {} }).activeSection, "creatures");
  assert.equal(restoreCatalogWorkspaceState({ schemaVersion: 99,
    activeSection: "items", sections: { items: { search: "must-not-survive" } } })
    .sections.items.search, undefined);

  const allSections = Object.fromEntries(CATALOG_SECTIONS.map(({ key }, index) => [key, {
    search: `applied-${key}`, searchDraft: `draft-${key}`, filters: ["invalid"],
    sort: "invalid", direction: index % 2 ? "desc" : "asc", page: index,
    selectedId: `selected-${key}`, resultsScroll: index + 10, detailScroll: index + 20,
  }]));
  const roundTrip = restoreCatalogWorkspaceState({ schemaVersion: 1,
    activeSection: "encounterTables", sections: allSections });
  for (const [index, { key }] of CATALOG_SECTIONS.entries()) {
    if (key === "creatures") continue;
    const section = roundTrip.sections[key] as UnavailableCatalogSectionState;
    assert.equal(section.search, `applied-${key}`);
    assert.equal((section as UnavailableCatalogSectionState & { section: string }).section, key);
    assert.equal(section.searchDraft, `draft-${key}`);
    assert.equal(section.sort, "name");
    assert.deepEqual(section.filters, []);
    assert.equal(section.page, index);
    assert.equal(section.selectedId, `selected-${key}`);
    assert.equal(section.resultsScroll, index + 10);
    assert.equal(section.detailScroll, index + 20);
  }
});

test("catalog providers expose one real Monster owner and six honest unavailable owners", async () => {
  const catalog = new CreatureCatalog(bundledSrd);
  const providers = createCatalogProviderRegistry(async () => catalog);
  assert.deepEqual(Object.keys(providers), CATALOG_SECTIONS.map(({ key }) => key));
  assert.deepEqual(providers.creatures.capability, { status: "available", source: "SRD 5.1" });
  for (const { key } of CATALOG_SECTIONS.slice(1)) {
    assert.equal(providers[key].capability.status, "unavailable");
  }
  const unavailable = await providers.items.query({ section: "items", filters: [], sort: "name", direction: "asc", page: 0,
    resultsScroll: 0, detailScroll: 0 }, {
    section: "items", generation: 1, signal: new AbortController().signal,
  });
  assert.equal(unavailable.status, "unavailable");
  const page = await providers.creatures.query({ text: "aboleth" }, {
    section: "creatures", generation: 3, signal: new AbortController().signal,
  });
  assert.equal(page.status, "ready");
  if (page.status !== "ready") throw new Error("Expected ready creature page");
  assert.equal(page.total, 1);
  assert.equal((page.rows[0] as { name: string }).name, "Aboleth");
  assert.equal(Object.isFrozen(page), true);
  assert.equal(Object.isFrozen(page.rows), true);
  assert.equal(Object.isFrozen(page.facets), true);
  assert.equal(Object.isFrozen(providers.creatures.capability), true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => providers.creatures.query({}, {
    section: "creatures", generation: 4, signal: controller.signal,
  }),
    (error: Error) => error.name === "AbortError");

  const failed = createCatalogProviderRegistry(async () => { throw new Error("kaputt"); });
  const failure = await failed.creatures.query({}, {
    section: "creatures", generation: 5, signal: new AbortController().signal,
  });
  assert.deepEqual(failure, { status: "error", message: "kaputt", retryable: true });
});
