import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseHTML } from "linkedom";
import bundledSrd from "../src/features/catalog/data/srd-5.1.generated.json";
import {
  CreatureCatalog,
  SRD_5_1_NOTICE,
  type Creature,
} from "../src/features/catalog/creature-catalog";
import { CreatureCatalogViewContent } from "../src/features/catalog/creature-catalog-view-content";
import {
  createCreatureCatalogProvider,
  type CatalogProviderRequest,
  type CatalogQueryResult,
  type CatalogSectionProvider,
} from "../src/features/catalog/catalog-provider";
import { CREATURE_CATALOG_DRAFT_FILTERS } from "../src/features/catalog/creature-catalog-view-state";
import type { CreatureCatalogViewState } from "../src/features/catalog/creature-catalog-view-state";

interface DomWindow {
  readonly Event: typeof Event;
  readonly HTMLElement: { readonly prototype: HTMLElement };
  readonly HTMLInputElement: { readonly prototype: HTMLInputElement };
}

async function openedView(value: unknown = bundledSrd): Promise<{
  readonly view: CreatureCatalogViewContent;
  readonly root: HTMLElement;
  readonly window: DomWindow;
}> {
  const { document, window } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  let focused: HTMLElement | undefined;
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => focused });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) { focused = this; },
  });
  if (!("setCustomValidity" in window.HTMLInputElement.prototype))
    Object.defineProperty(window.HTMLInputElement.prototype, "setCustomValidity", { value: () => undefined });
  if (!("reportValidity" in window.HTMLInputElement.prototype))
    Object.defineProperty(window.HTMLInputElement.prototype, "reportValidity", { value: () => true });
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(value);
  const view = new CreatureCatalogViewContent(root, {
    notice: SRD_5_1_NOTICE,
    provider: createCreatureCatalogProvider(async () => catalog),
  });
  await view.onOpen();
  return { view, root, window: window as unknown as DomWindow };
}

function event(window: DomWindow, type: string): Event {
  return new window.Event(type, { bubbles: true });
}

function key(window: DomWindow, value: string): KeyboardEvent {
  const keyboard = new window.Event("keydown", { bubbles: true });
  Object.defineProperty(keyboard, "key", { value });
  return keyboard as KeyboardEvent;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function choose(root: HTMLElement, window: DomWindow, key: string, value: string): void {
  const select = root.querySelector<HTMLSelectElement>(`[data-focus-key="${key}"]`)!;
  select.querySelector<HTMLOptionElement>(`option[value="${value}"]`)!.selected = true;
  select.dispatchEvent(event(window, "change"));
}

test("catalog DOM exposes advanced filters, chips, reset, ARIA sorting, notice and global Escape", async () => {
  const { view, root, window } = await openedView();
  await view.setState({});
  assert.deepEqual({ sort: view.getState().sort, direction: view.getState().direction,
    page: view.getState().page }, { sort: "name", direction: "asc", page: 0 });
  assert.equal(root.querySelector('[data-focus-key="sort-name"]')?.closest("th")
    ?.getAttribute("aria-sort"), "ascending");
  assert.equal(root.querySelector<HTMLInputElement>('[data-focus-key="search"]')?.placeholder, "Name suchen");
  assert.equal(root.querySelector<HTMLInputElement>('[data-focus-key="search"]')
    ?.getAttribute("aria-label"), "Monstername suchen");
  assert.equal(root.querySelectorAll(".dn-catalog-filters input").length, 13);
  assert.equal(root.querySelectorAll(".dn-catalog-filters select").length, 5);
  choose(root, window, "type", "Dragon");
  choose(root, window, "size", "Large");
  await settle();
  assert.match(root.querySelector(".dn-catalog-chip")?.textContent ?? "", /Typ: Dragon/);
  for (const row of root.querySelectorAll("tbody tr")) {
    assert.equal(row.children[1]?.textContent, "Dragon");
    assert.equal(row.children[2]?.textContent, "Large");
  }
  const typeChip = root.querySelector<HTMLButtonElement>('[data-focus-key="chip-types-Dragon"]')!;
  typeChip.focus();
  typeChip.click();
  await settle();
  assert.equal(root.ownerDocument.activeElement?.getAttribute("data-focus-key"), "chip-sizes-Large");
  root.querySelector<HTMLElement>(".dn-catalog-results")!.scrollTop = 120;
  const hp = root.querySelector<HTMLButtonElement>('[data-focus-key="sort-hp"]')!;
  hp.click();
  await settle();
  assert.equal(root.querySelector<HTMLElement>(".dn-catalog-results")!.scrollTop, 0);
  assert.equal(view.getState().resultsScroll, 0);
  assert.equal(hp.closest("th")?.getAttribute("aria-sort"), "none");
  assert.equal(root.querySelector('[data-focus-key="sort-hp"]')?.closest("th")?.getAttribute("aria-sort"), "ascending");
  root.querySelector<HTMLButtonElement>('[data-focus-key="filter-reset"]')!.click();
  await settle();
  assert.equal(root.querySelectorAll(".dn-catalog-chip").length, 0);
  assert.equal(root.ownerDocument.activeElement?.getAttribute("data-focus-key"), "search");
  assert.equal(root.querySelector('[data-focus-key="sort-hp"]')?.closest("th")?.getAttribute("aria-sort"), "ascending");
  root.querySelector<HTMLButtonElement>('[data-focus-key="license"]')!.click();
  assert.equal(root.querySelector<HTMLElement>(".dn-catalog-notice")?.hidden, false);
  root.querySelector<HTMLButtonElement>('[data-focus-key="page-next"]')!.click();
  await settle();
  assert.match(root.querySelector(".dn-catalog-footer")?.textContent ?? "", /51–100/);
  root.querySelector<HTMLButtonElement>('[data-focus-key="page-previous"]')!.click();
  await settle();
  const [row, second] = [...root.querySelectorAll<HTMLTableRowElement>("tbody tr")];
  row!.focus();
  row!.dispatchEvent(key(window, "ArrowDown"));
  assert.equal((root.ownerDocument.activeElement as HTMLElement | null)?.dataset.focusKey,
    second!.dataset.focusKey);
  root.ownerDocument.activeElement!.dispatchEvent(key(window, "Enter"));
  await settle();
  assert.ok(root.querySelector(".dn-catalog-detail h2"));
  const selectedName = root.querySelector(".dn-catalog-detail h2")?.textContent;
  root.querySelector<HTMLButtonElement>('[data-focus-key="sort-name"]')!.click();
  await settle();
  assert.equal(root.querySelector(".dn-catalog-detail h2")?.textContent, selectedName);
  root.querySelector<HTMLElement>(".dn-catalog-detail")!.dispatchEvent(key(window, "Escape"));
  await settle();
  assert.equal(root.querySelector(".dn-catalog-detail h2"), null);
  await view.onClose();
});

test("every catalog text input publishes through the canonical draft mapping", async () => {
  const { view, root, window } = await openedView();
  for (const [filterKey, draftKey] of CREATURE_CATALOG_DRAFT_FILTERS) {
    const focusKey = filterKey === "text" ? "search"
      : filterKey === "conditionImmunities" ? "condition-immunities" : filterKey;
    const input = root.querySelector<HTMLInputElement>(`[data-focus-key="${focusKey}"]`)!;
    const value = `probe-${filterKey}`;
    input.value = value;
    input.dispatchEvent(event(window, "input"));
    input.dispatchEvent(key(window, "Enter"));
    const state = view.getState();
    assert.equal(state[filterKey], value);
    assert.equal(state[draftKey], value);
  }
  await view.onClose();
});

test("catalog DOM debounces search, flushes Enter and keeps invalid ranges correctable", async () => {
  const { view, root, window } = await openedView();
  const search = root.querySelector<HTMLInputElement>('[data-focus-key="search"]')!;
  search.value = "ancient";
  search.dispatchEvent(event(window, "input"));
  search.value = "aboleth";
  search.dispatchEvent(event(window, "input"));
  assert.doesNotMatch(root.querySelector(".dn-catalog-footer")?.textContent ?? "", /1–1 von 1/);
  await new Promise((resolve) => setTimeout(resolve, 230));
  assert.match(root.querySelector(".dn-catalog-footer")?.textContent ?? "", /1–1 von 1/);
  const movement = root.querySelector<HTMLInputElement>('[data-focus-key="movement"]')!;
  movement.value = "swim";
  movement.dispatchEvent(event(window, "input"));
  await new Promise((resolve) => setTimeout(resolve, 230));
  assert.match(root.querySelector(".dn-catalog-chip")?.parentElement?.textContent ?? "", /Bewegung: swim/);
  const latestSearch = root.querySelector<HTMLInputElement>('[data-focus-key="search"]')!;
  latestSearch.value = "definitely-not-a-monster";
  latestSearch.dispatchEvent(event(window, "input"));
  latestSearch.dispatchEvent(key(window, "Enter"));
  await settle();
  assert.match(root.querySelector(".dn-catalog-footer")?.textContent ?? "", /Keine Monster gefunden/);
  root.querySelector<HTMLButtonElement>('[data-focus-key="filter-reset"]')!.click();
  await settle();
  const minimum = root.querySelector<HTMLInputElement>('[data-focus-key="cr-min"]')!;
  minimum.value = "5";
  minimum.dispatchEvent(event(window, "change"));
  const maximum = root.querySelector<HTMLInputElement>('[data-focus-key="cr-max"]')!;
  maximum.value = "1";
  maximum.dispatchEvent(event(window, "change"));
  assert.match(root.querySelector('[role="alert"]')?.textContent ?? "", /HG min/);
  assert.ok(root.querySelector('[data-focus-key="cr-min"]'));
  await view.onClose();
});

test("catalog DOM preserves an empty draft and commits pending input on close", async () => {
  const { view, root, window } = await openedView();
  await view.setState({ text: "dragon", textDraft: "" });
  assert.equal(root.querySelector<HTMLInputElement>('[data-focus-key="search"]')?.value, "");
  const search = root.querySelector<HTMLInputElement>('[data-focus-key="search"]')!;
  search.value = "aboleth";
  search.dispatchEvent(event(window, "input"));
  await view.onClose();
  await new Promise((resolve) => setTimeout(resolve, 230));
  const state = view.getState();
  assert.equal(state.text, "aboleth");
  assert.equal(state.textDraft, "aboleth");
});

test("catalog keyboard focus tolerates parser-accepted adversarial creature IDs", async () => {
  const raw = JSON.parse(JSON.stringify(bundledSrd)) as { creatures: { id: string }[] };
  const adversarialId = 'bad"]';
  raw.creatures[0]!.id = adversarialId;
  const { view, root, window } = await openedView(raw);
  const rows = [...root.querySelectorAll<HTMLTableRowElement>("tbody tr")];
  const targetIndex = rows.findIndex((row) => row.dataset.focusKey === `row-${adversarialId}`);
  assert.notEqual(targetIndex, -1);
  const sourceIndex = targetIndex === 0 ? 1 : targetIndex - 1;
  const source = rows[sourceIndex]!;
  source.focus();
  assert.doesNotThrow(() => source.dispatchEvent(key(window, targetIndex === 0 ? "ArrowUp" : "ArrowDown")));
  assert.equal(root.ownerDocument.activeElement?.getAttribute("data-focus-key"), `row-${adversarialId}`);
  await view.onClose();
});

test("catalog provider requests abort and stale answers cannot overwrite a newer query or close", async () => {
  const { document } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(bundledSrd);
  const pending: Array<{
    request: CatalogProviderRequest<"creatures">;
    resolve(value: CatalogQueryResult<Creature>): void;
  }> = [];
  const provider: CatalogSectionProvider<"creatures", CreatureCatalogViewState, Creature, Creature> = {
    section: "creatures",
    capability: { status: "available", source: "test" },
    query(_state, request) {
      return new Promise((resolve) => pending.push({ request, resolve }));
    },
    async detail() { return { status: "missing" }; },
  };
  const result = (text: string): CatalogQueryResult<Creature> => {
    const page = catalog.search({ text, limit: 50 });
    return { status: "ready", ...page, facets: {} };
  };
  const view = new CreatureCatalogViewContent(root, { notice: SRD_5_1_NOTICE, provider });
  const opening = view.onOpen();
  assert.equal(pending.length, 1);
  const first = pending[0]!;
  const replacement = view.setState({ text: "aboleth", textDraft: "aboleth" });
  assert.equal(first.request.signal.aborted, true);
  assert.equal(pending.length, 2);
  first.resolve({ status: "error", message: "stale failure", retryable: true });
  await opening;
  assert.match(root.textContent ?? "", /wird geladen/);
  pending[1]!.resolve(result("aboleth"));
  await replacement;
  assert.equal(root.querySelector("tbody tr td")?.textContent, "Aboleth");

  const closing = view.setState({ text: "dragon", textDraft: "dragon" });
  const last = pending[2]!;
  await view.onClose();
  assert.equal(last.request.signal.aborted, true);
  last.resolve(result("dragon"));
  await closing;
  assert.equal(root.childElementCount, 0);
});

test("catalog aborts a delayed detail request on close", async () => {
  const { document } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(bundledSrd);
  let detailRequest: CatalogProviderRequest<"creatures"> | undefined;
  let resolveDetail: ((value: { status: "ready"; detail: Creature }) => void) | undefined;
  const provider: CatalogSectionProvider<"creatures", CreatureCatalogViewState, Creature, Creature> = {
    section: "creatures",
    capability: { status: "available", source: "test" },
    async query() {
      const page = catalog.search({ text: "aboleth", limit: 50 });
      return { status: "ready", ...page, facets: {} };
    },
    detail(_id, request) {
      detailRequest = request;
      return new Promise((resolve) => { resolveDetail = resolve; });
    },
  };
  const view = new CreatureCatalogViewContent(root, { notice: SRD_5_1_NOTICE, provider });
  await view.setState({ text: "aboleth", selectedId: "aboleth" });
  const restoring = view.onOpen();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(detailRequest);
  await view.onClose();
  assert.equal(detailRequest!.signal.aborted, true);
  resolveDetail!({ status: "ready", detail: catalog.detail("aboleth")! });
  await restoring;
  assert.equal(root.childElementCount, 0);
});

test("catalog distinguishes provider status and honors retryability", async () => {
  const cases = [
    { result: { status: "missing", reason: "Quelle fehlt" } as const,
      heading: "Monsterkatalog fehlt", retry: true },
    { result: { status: "unavailable", reason: "Nicht verbunden" } as const,
      heading: "Monsterkatalog nicht verfügbar", retry: false },
    { result: { status: "error", message: "Nicht erneut versuchen", retryable: false } as const,
      heading: "Monsterkatalog nicht verfügbar", retry: false },
  ];
  for (const entry of cases) {
    const { document } = parseHTML("<html><body><main id='catalog'></main></body></html>");
    const root = document.querySelector<HTMLElement>("#catalog")!;
    const provider: CatalogSectionProvider<"creatures", CreatureCatalogViewState, Creature, Creature> = {
      section: "creatures",
      capability: { status: "available", source: "test" },
      async query() { return entry.result; },
      async detail() { return { status: "missing" }; },
    };
    const view = new CreatureCatalogViewContent(root, { notice: SRD_5_1_NOTICE, provider });
    await view.onOpen();
    assert.equal(root.querySelector("h2")?.textContent, entry.heading);
    assert.equal(!![...root.querySelectorAll("button")]
      .find((button) => button.textContent === "Erneut versuchen"), entry.retry);
    await view.onClose();
  }

  const { document } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(bundledSrd);
  const provider: CatalogSectionProvider<"creatures", CreatureCatalogViewState, Creature, Creature> = {
    section: "creatures",
    capability: { status: "available", source: "test" },
    async query() { return { status: "ready", ...catalog.search({ text: "aboleth", limit: 50 }) }; },
    async detail() { return { status: "missing" }; },
  };
  const view = new CreatureCatalogViewContent(root, { notice: SRD_5_1_NOTICE, provider });
  await view.setState({ text: "aboleth", selectedId: "aboleth" });
  await view.onOpen();
  assert.equal(root.querySelector(".dn-catalog-detail h2")?.textContent, "Monster nicht gefunden");
  assert.equal(root.querySelector(".dn-catalog-detail button"), null);
  await view.onClose();
});

test("catalog CSS declares its own responsive container and descendant breakpoints", () => {
  const css = readFileSync("styles.css", "utf8");
  assert.match(css, /\.dn-creature-catalog\s*\{[^}]*container-type:\s*inline-size/s);
  assert.match(css, /@container \(max-width:900px\)[\s\S]*?\.dn-catalog-body\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.dn-catalog-filters\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.dn-catalog-section-tabs \[role="tab"\]\.is-active\s*\{/);
  assert.match(css, /\.dn-catalog-section-tabs \[role="tab"\]:focus-visible\s*\{/);
});
