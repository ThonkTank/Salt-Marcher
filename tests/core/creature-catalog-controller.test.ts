import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Window } from "happy-dom";
import {
  CreatureCatalogController,
  creatureCatalogLayout,
  type CreatureCatalogScheduler,
  type CreatureCatalogSource,
} from "../../src/features/catalog/creature-catalog-controller";
import {
  CreatureCatalog,
  type CreatureCatalogPage,
  type CreatureCatalogQuery,
} from "../../src/features/catalog/creature-catalog";
import bundledSrd from "../../src/features/catalog/data/srd-5.1.generated.json";

class ManualScheduler implements CreatureCatalogScheduler {
  private next = 1;
  private readonly pending = new Map<number, () => void>();
  readonly delays: number[] = [];

  schedule(callback: () => void, delayMs: number): unknown {
    const handle = this.next++;
    this.delays.push(delayMs);
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: unknown): void {
    if (typeof handle === "number") this.pending.delete(handle);
  }

  runAll(): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback();
  }
}

function fixture(
  source: CreatureCatalogSource = new CreatureCatalog(bundledSrd),
) {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = "<main id='root'></main>";
  const root = document.querySelector("#root") as unknown as HTMLElement;
  const scheduler = new ManualScheduler();
  const controller = new CreatureCatalogController({
    root,
    loadCatalog: async () => source,
    notice: "SRD test notice",
    scheduler,
  });
  return { controller, document, root, scheduler, window };
}

function event(window: unknown, type: string, key?: string): Event {
  const EventType = (window as { Event: typeof Event }).Event;
  const value = new EventType(type, { bubbles: true });
  if (key) Object.defineProperty(value, "key", { value: key });
  return value;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("catalog controller renders the complete accessible catalog without an Obsidian host", async () => {
  const { controller, root } = fixture();
  await controller.open();
  assert.equal(
    root.querySelectorAll(".dn-catalog-filters label").length,
    18,
    root.innerHTML,
  );
  assert.equal(root.querySelector("table")?.getAttribute("role"), "grid");
  assert.equal(
    root.querySelector("th")?.getAttribute("aria-sort"),
    "ascending",
  );
  assert.match(
    root.querySelector(".dn-catalog-source")?.textContent ?? "",
    /SRD 5\.1/,
  );
  assert.equal(root.getAttribute("aria-busy"), "false");
  assert.match(
    root.querySelector("[role='status']")?.textContent ?? "",
    /von 334/,
  );
  assert.match(
    root.querySelector(".dn-catalog-detail")?.textContent ?? "",
    /Monster auswählen/,
  );
  controller.close();
  assert.equal(root.childElementCount, 0);
});

test("catalog controller uses the required responsive layouts", async () => {
  assert.equal(creatureCatalogLayout(900, 650), "stacked");
  assert.equal(creatureCatalogLayout(1150, 700), "split");
  assert.equal(creatureCatalogLayout(1150, 649), "stacked");
  const { controller, root } = fixture();
  await controller.open();
  controller.setViewport(900, 650);
  assert.equal(root.dataset.catalogLayout, "stacked");
  controller.setViewport(1150, 700);
  assert.equal(root.dataset.catalogLayout, "split");
});

test("filter changes reset stale scroll, render removable chips and support reset", async () => {
  const { controller, root, window } = fixture();
  await controller.open();
  const results = root.querySelector<HTMLElement>(".dn-catalog-results")!;
  results.scrollTop = 180;
  const type = root.querySelector<HTMLSelectElement>(
    "[data-focus-key='type']",
  )!;
  type.value = "Dragon";
  type.dispatchEvent(event(window, "change"));
  await settle();
  assert.equal(
    root.querySelector<HTMLElement>(".dn-catalog-results")!.scrollTop,
    0,
  );
  assert.equal(controller.getState().resultsScroll, 0);
  const chip = root.querySelector<HTMLButtonElement>(".dn-catalog-chip")!;
  assert.match(
    chip.getAttribute("aria-label") ?? "",
    /Filter Typ Dragon entfernen/,
  );
  assert.match(
    root.querySelector("[role='status']")?.textContent ?? "",
    /von \d+/,
  );
  root
    .querySelector<HTMLButtonElement>(".dn-catalog-reset")!
    .dispatchEvent(event(window, "click"));
  await settle();
  assert.equal(root.querySelectorAll(".dn-catalog-chip").length, 0);
  assert.equal(controller.getState().type, undefined);
});

test("text filters wait 200 ms, Enter flushes immediately and stale queries cannot overwrite", async () => {
  const catalog = new CreatureCatalog(bundledSrd);
  const queries: CreatureCatalogQuery[] = [];
  const pending: Array<(page: CreatureCatalogPage) => void> = [];
  const source: CreatureCatalogSource = {
    creatures: catalog.creatures,
    detail: (id) => catalog.detail(id),
    search: (query) => {
      queries.push(query);
      if (!query.text) return catalog.search(query);
      return new Promise((resolve) => pending.push(resolve));
    },
  };
  const { controller, root, scheduler, window } = fixture(source);
  await controller.open();
  const input = root.querySelector<HTMLInputElement>(
    "[data-focus-key='text']",
  )!;
  input.value = "dragon";
  input.dispatchEvent(event(window, "input"));
  assert.equal(queries.length, 1);
  assert.deepEqual(scheduler.delays, [200]);
  scheduler.runAll();
  assert.equal(queries.at(-1)?.text, "dragon");

  input.value = "aboleth";
  input.dispatchEvent(event(window, "keydown", "Enter"));
  assert.equal(queries.at(-1)?.text, "aboleth");
  const newer = catalog.search({ text: "aboleth" });
  const older = catalog.search({ text: "dragon" });
  pending[1]!(newer);
  await settle();
  assert.match(root.querySelector("tbody")?.textContent ?? "", /Aboleth/);
  pending[0]!(older);
  await settle();
  assert.match(root.querySelector("tbody")?.textContent ?? "", /Aboleth/);
  assert.doesNotMatch(root.querySelector("tbody")?.textContent ?? "", /Dragon/);
});

test("catalog controller keeps keyboard navigation and detail dismissal accessible", async () => {
  const { controller, root, window } = fixture();
  await controller.open();
  const rows = root.querySelectorAll<HTMLTableRowElement>("tbody tr");
  rows[0]!.dispatchEvent(event(window, "keydown", "Enter"));
  await settle();
  assert.equal(
    root.querySelector("tbody tr")?.getAttribute("aria-selected"),
    "true",
  );
  assert.ok(root.querySelector(".dn-catalog-detail h2"));
  root.dispatchEvent(event(window, "keydown", "Escape"));
  await settle();
  assert.match(
    root.querySelector(".dn-catalog-detail")?.textContent ?? "",
    /Monster auswählen/,
  );
});

test("catalog host boundary stays neutral and the responsive container is active", () => {
  const controller = readFileSync(
    "src/features/catalog/creature-catalog-controller.ts",
    "utf8",
  );
  const adapter = readFileSync(
    "src/features/catalog/creature-catalog-view.ts",
    "utf8",
  );
  const styles = readFileSync("styles.css", "utf8");
  assert.doesNotMatch(controller, /from ["']obsidian["']/);
  assert.doesNotMatch(adapter, /createElement|querySelector|\.search\(/);
  assert.match(adapter, /CreatureCatalogController/);
  assert.match(
    styles,
    /\.dn-creature-catalog\s*\{[^}]*container-type:\s*inline-size/s,
  );
  assert.match(styles, /data-catalog-layout="stacked"/);
});
