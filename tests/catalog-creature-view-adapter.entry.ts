import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import bundledSrd from "../src/features/catalog/data/srd-5.1.generated.json";
import { CreatureCatalog, SRD_5_1_NOTICE } from "../src/features/catalog/creature-catalog";
import { CreatureCatalogView } from "../src/features/catalog/creature-catalog-view";
import { CatalogWorkspaceViewContent } from "../src/features/catalog/catalog-workspace-view-content";
import { CREATURE_CATALOG_VIEW } from "../src/ui/view-types";

test("Obsidian catalog ItemView is a thin port adapter for host-neutral content", async () => {
  const { document, window } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  let focused: HTMLElement | undefined;
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => focused });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) { focused = this; },
  });
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(bundledSrd);
  const plugin = { creatureCatalog: { notice: SRD_5_1_NOTICE, load: async () => catalog } };
  const view = new CreatureCatalogView({ contentEl: root } as never, plugin as never);
  assert.equal(view.getViewType(), CREATURE_CATALOG_VIEW);
  assert.equal(view.getDisplayText(), "Katalog");
  assert.equal(view.getIcon(), "book-open");
  await view.onOpen();
  assert.equal(root.querySelectorAll('[role="tab"]').length, 7);
  assert.equal(root.querySelectorAll(".dn-catalog-section-content").length, 1);
  assert.ok(root.querySelector(".dn-catalog-results"));
  await view.setState({ text: "aboleth", textDraft: "aboleth" });
  let state = view.getState() as { activeSection: string; sections: {
    creatures: { text?: string }; items: { search?: string; page: number } } };
  assert.equal(state.sections.creatures.text, "aboleth");
  assert.match(root.querySelector(".dn-catalog-footer")?.textContent ?? "", /1–1 von 1/);

  await view.setState({ schemaVersion: 1, activeSection: "items", sections: {
    creatures: state.sections.creatures,
    items: { search: "sword", searchDraft: "swo", sort: "name", direction: "asc",
      page: 2, selectedId: "item-1", resultsScroll: 31, detailScroll: 17 },
  } });
  assert.equal(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent, "Items");
  assert.equal(root.querySelectorAll(".dn-catalog-section-content").length, 1);
  assert.equal(root.querySelectorAll(".dn-catalog-section-content .dn-catalog-footer").length, 1);
  assert.equal(root.querySelectorAll(".dn-catalog-section-content .dn-catalog-detail").length, 1);
  assert.match(root.querySelector('[role="status"]')?.textContent ?? "", /noch nicht implementiert/);
  state = view.getState() as typeof state;
  assert.equal(state.sections.items.search, "sword");
  (state.sections.items as { search?: string }).search = "external-mutation";
  assert.equal((view.getState() as typeof state).sections.items.search, "sword");
  assert.equal(state.sections.items.page, 2);

  const itemTab = root.querySelector<HTMLButtonElement>('[data-catalog-section="items"]')!;
  itemTab.focus();
  const press = (value: string) => {
    const keyboard = new window.Event("keydown", { bubbles: true });
    Object.defineProperty(keyboard, "key", { value });
    document.activeElement!.dispatchEvent(keyboard);
  };
  press("ArrowRight");
  assert.equal(document.activeElement?.getAttribute("data-catalog-section"), "savedEncounters");
  press("ArrowLeft");
  assert.equal(document.activeElement?.getAttribute("data-catalog-section"), "items");
  press("Home");
  assert.equal(document.activeElement?.getAttribute("data-catalog-section"), "creatures");
  const end = new window.Event("keydown", { bubbles: true });
  Object.defineProperty(end, "key", { value: "End" });
  itemTab.dispatchEvent(end);
  assert.equal(document.activeElement?.getAttribute("data-catalog-section"), "encounterTables");
  assert.equal(document.activeElement?.getAttribute("aria-selected"), "false");
  press(" ");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
    "Encounter-Tabellen");

  root.querySelector<HTMLButtonElement>('[data-catalog-section="items"]')!.focus();
  press("Enter");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent, "Items");

  root.querySelector<HTMLButtonElement>('[data-catalog-section="creatures"]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(root.querySelector<HTMLInputElement>('[data-focus-key="search"]')?.value, "aboleth");
  state = view.getState() as typeof state;
  assert.equal(state.sections.items.search, "sword");
  await view.onClose();
  assert.equal(root.childElementCount, 0);
});

test("catalog section activation ignores a stale slow Monster render and loads only once", async () => {
  const { document, window } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  let focused: HTMLElement | undefined;
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => focused });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) { focused = this; },
  });
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(bundledSrd);
  let resolveLoad: ((catalog: CreatureCatalog) => void) | undefined;
  let loads = 0;
  const content = new CatalogWorkspaceViewContent(root, {
    notice: SRD_5_1_NOTICE,
    loadCreatures: () => {
      loads++;
      return new Promise((resolve) => { resolveLoad = resolve; });
    },
  });
  await content.setState({ schemaVersion: 1, activeSection: "items", sections: {} });
  await content.onOpen();
  root.querySelector<HTMLButtonElement>('[data-catalog-section="creatures"]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(loads, 1);
  root.querySelector<HTMLButtonElement>('[data-catalog-section="npcs"]')!.click();
  await Promise.resolve();
  assert.equal(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent, "NSCs");
  resolveLoad!(catalog);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent, "NSCs");
  assert.equal(document.activeElement?.getAttribute("data-catalog-section"), "npcs");
  assert.equal(loads, 1);
  await content.onClose();
});
