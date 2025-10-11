// tests/ui/workmode/create/entry-card.test.ts
// Validates the shared entry card helper renders Library styling and actions.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderEntryCard, type EntryRenderContext } from "../../../../src/ui/workmode/create";

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

describe("renderEntryCard", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
    vi.useRealTimers();
  });

  it("applies Library classes, focuses name input and wires default actions", () => {
    vi.useFakeTimers();
    const remove = vi.fn();
    const moveUp = vi.fn();
    const moveDown = vi.fn();
    const context: EntryRenderContext<{ category: string }> = {
      entry: { category: "trait" },
      index: 0,
      total: 1,
      shouldFocus: true,
      canMoveUp: true,
      canMoveDown: true,
      remove,
      moveUp,
      moveDown,
      requestRender: vi.fn(),
    };

    const { card } = renderEntryCard({
      parent: host,
      context,
      type: () => "trait",
      badge: { text: "TRAIT", variant: "trait" },
      renderName: (nameBox) => {
        const input = document.createElement("input");
        input.className = "name-field";
        nameBox.appendChild(input);
        return input;
      },
      renderBody: (container) => {
        container.createDiv({ cls: "body" });
      },
    });

    vi.runAllTimers();

    expect(card.classList.contains("sm-cc-entry-card--type-trait")).toBe(true);
    expect(card.querySelector(".sm-cc-entry-badge")?.textContent).toBe("TRAIT");
    expect(card.querySelector(".body")).toBeTruthy();
    expect(document.activeElement?.classList.contains("name-field")).toBe(true);

    const moveButtons = card.querySelectorAll<HTMLButtonElement>(".sm-cc-entry-move-btn");
    expect(moveButtons).toHaveLength(2);
    expect(moveButtons[1].disabled).toBe(false);
    moveButtons[0].click();
    expect(moveUp).toHaveBeenCalled();
    moveButtons[1].click();
    expect(moveDown).toHaveBeenCalled();

    const deleteButton = card.querySelector<HTMLButtonElement>(".sm-cc-entry-delete");
    deleteButton?.click();
    expect(remove).toHaveBeenCalled();
  });
});
