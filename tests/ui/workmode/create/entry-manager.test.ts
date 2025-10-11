// tests/ui/workmode/create/entry-manager.test.ts
// Prüft Hinzufügen, Filtern und Neuordnen im shared Entry-Manager.
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mountEntryManager, type EntryRenderContext } from "../../../../src/ui/workmode/create";

const proto = HTMLElement.prototype as any;
if (!proto.createEl) {
  proto.createEl = function(tag: keyof HTMLElementTagNameMap, options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
    const el = document.createElement(tag);
    if (options?.cls) el.className = options.cls;
    if (options?.text) el.textContent = options.text;
    if (options?.attr) {
      for (const [key, value] of Object.entries(options.attr)) {
        el.setAttribute(key, value);
      }
    }
    this.appendChild(el);
    return el;
  };
}
if (!proto.createDiv) {
  proto.createDiv = function(options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
    return this.createEl("div", options);
  };
}
if (!proto.empty) {
  proto.empty = function() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
    return this;
  };
}
if (!proto.addClass) {
  proto.addClass = function(cls: string) {
    this.classList.add(cls);
    return this;
  };
}
if (!proto.removeClass) {
  proto.removeClass = function(cls: string) {
    this.classList.remove(cls);
    return this;
  };
}
if (!proto.toggleClass) {
  proto.toggleClass = function(cls: string, force?: boolean) {
    this.classList.toggle(cls, force);
    return this;
  };
}

describe("mountEntryManager", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it("adds entries through category buttons and notifies listeners", () => {
    const entries: Array<{ category: "info" | "note"; title: string }> = [];
    const onEntriesChanged = vi.fn();
    const contexts: EntryRenderContext<{ category: "info" | "note"; title: string }>[] = [];

    mountEntryManager(host, {
      label: "Einträge",
      entries,
      categories: [
        { id: "info", label: "Info" },
        { id: "note", label: "Note" },
      ],
      createEntry: (category) => ({ category, title: "" }),
      renderEntry: (container, context) => {
        contexts.push(context);
        const card = container.createDiv({ cls: "card" });
        card.dataset.category = context.entry.category;
        const remove = card.createEl("button", { text: "x" });
        remove.addEventListener("click", context.remove);
        return card;
      },
      onEntriesChanged,
    });

    const addButtons = host.querySelectorAll<HTMLButtonElement>(".sm-cc-entry-add-btn");
    expect(addButtons).toHaveLength(2);

    addButtons[0].click();

    expect(entries).toEqual([{ category: "info", title: "" }]);
    expect(onEntriesChanged).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll(".card")).toHaveLength(1);

    // Trigger removal via rendered button
    const removeButton = host.querySelector<HTMLButtonElement>(".card button");
    removeButton?.click();
    expect(entries).toEqual([]);
    expect(onEntriesChanged).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll(".card")).toHaveLength(0);
    expect(contexts).toHaveLength(1);
  });

  it("filters and reorders entries via render context helpers", () => {
    const entries: Array<{ category: "info" | "note"; title: string }> = [
      { category: "info", title: "First" },
      { category: "note", title: "Second" },
    ];
    const contexts: EntryRenderContext<{ category: "info" | "note"; title: string }>[] = [];
    const registerValidation = vi.fn((runner: () => string[]) => runner);
    const collectIssues = vi.fn(() => []);

    const handle = mountEntryManager(host, {
      label: "Einträge",
      entries,
      categories: [
        { id: "info", label: "Info" },
        { id: "note", label: "Note" },
      ],
      filters: [
        { id: "info", label: "Info", predicate: (entry) => entry.category === "info" },
        { id: "note", label: "Note", predicate: (entry) => entry.category === "note" },
      ],
      createEntry: (category) => ({ category, title: "New" }),
      renderEntry: (container, context) => {
        contexts[context.index] = context;
        const card = container.createDiv({ cls: "card" });
        card.dataset.index = String(context.index);
        card.dataset.category = context.entry.category;
        return card;
      },
      registerValidation,
      collectIssues,
      insertPosition: "end",
    });

    // Initial render creates two cards
    expect(host.querySelectorAll(".card")).toHaveLength(2);
    expect(registerValidation).toHaveBeenCalledOnce();
    expect(collectIssues).toHaveBeenCalledWith(entries);

    // Apply filter and ensure visibility toggles
    handle.setFilter("info");
    const cards = Array.from(host.querySelectorAll<HTMLElement>(".card"));
    expect(cards[0].getAttribute("aria-hidden")).toBe("false");
    expect(cards[1].getAttribute("aria-hidden")).toBe("true");

    // Use context helpers to reorder
    contexts[1].moveUp();
    expect(entries[0].title).toBe("Second");
    contexts[0].moveDown();
    expect(entries[1].title).toBe("Second");

    // Removing via context updates collection
    contexts[1].remove();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("First");
  });

  it("renders cards via shared card factory when provided", () => {
    const entries: Array<{ category: "info"; title: string }> = [];
    const factory = vi.fn(() => ({
      type: "info",
      badge: { text: "INFO", variant: "info" },
      renderName: (nameBox: HTMLDivElement) => {
        const input = document.createElement("input");
        input.className = "name-input";
        nameBox.appendChild(input);
        return input;
      },
      renderBody: (card: HTMLDivElement, context: EntryRenderContext<{ category: "info"; title: string }>) => {
        card.createDiv({ cls: "body", text: context.entry.title });
      },
    }));

    mountEntryManager(host, {
      label: "Einträge",
      entries,
      categories: [{ id: "info", label: "Info" }],
      createEntry: (category) => ({ category, title: "" }),
      card: (context) => factory(context),
    });

    host.querySelector<HTMLButtonElement>(".sm-cc-entry-add-btn")?.click();

    expect(entries).toHaveLength(1);
    expect(factory).toHaveBeenCalled();

    const card = host.querySelector<HTMLElement>(".sm-cc-entry-card");
    expect(card).not.toBeNull();
    expect(card?.classList.contains("sm-cc-entry-card--type-info")).toBe(true);
    expect(card?.querySelector(".sm-cc-entry-badge")?.textContent).toBe("INFO");
    expect(card?.querySelector(".name-input")).toBeTruthy();
    expect(card?.querySelector(".body")?.textContent).toBe("");
  });
});
