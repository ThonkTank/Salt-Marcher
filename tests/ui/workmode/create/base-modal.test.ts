// tests/ui/workmode/create/base-modal.test.ts
// Verifiziert das Pipeline-Verhalten des gemeinsamen BaseCreateModal.
import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { BaseCreateModal, type CreateModalPipeline } from "../../../../src/ui/workmode/create";

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

describe("BaseCreateModal pipeline", () => {
  interface Draft {
    name: string;
    notes?: string;
  }

  class TestCreateModal extends BaseCreateModal<Draft, Draft, string> {
    public closed = false;
    constructor(app: App, pipeline: CreateModalPipeline<Draft, Draft, string>, validate?: (data: Draft) => string[]) {
      super(app, undefined, {
        title: "Test",
        defaultName: "Draft",
        pipeline,
        validate,
      });
      // Provide a validation container for simple mode assertions
      this.validationEl = document.createElement("div");
    }

    protected createDefault(name: string): Draft {
      return { name };
    }

    protected buildFields(): void {
      // Fields are not required for the tests
    }

    close(): void {
      this.closed = true;
      super.close();
    }
  }

  it("runs serialize, persist and onComplete with modal context", async () => {
    const app = new App();
    const serialize = vi.fn((draft: Draft) => ({ ...draft, notes: "serialized" }));
    const persist = vi.fn(async (payload: Draft) => {
      return `${payload.name}::${payload.notes}`;
    });
    const onComplete = vi.fn();

    const pipeline: CreateModalPipeline<Draft, Draft, string> = {
      serialize,
      persist,
      onComplete,
    };

    const modal = new TestCreateModal(app, pipeline);
    modal.data.name = "Example";

    await modal.submit();

    expect(serialize).toHaveBeenCalledTimes(1);
    expect(serialize).toHaveBeenCalledWith({ name: "Example" });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(
      { name: "Example", notes: "serialized" },
      expect.objectContaining({ app, draft: { name: "Example" } })
    );
    expect(onComplete).toHaveBeenCalledWith(
      "Example::serialized",
      expect.objectContaining({ app, draft: { name: "Example" }, serialized: { name: "Example", notes: "serialized" } })
    );
    expect(modal.closed).toBe(true);
  });

  it("aborts submission when validation reports issues", async () => {
    const app = new App();
    const serialize = vi.fn();
    const persist = vi.fn();

    const pipeline: CreateModalPipeline<Draft, Draft, string> = {
      serialize,
      persist,
    };

    const modal = new TestCreateModal(app, pipeline, () => ["invalid"]);
    modal.data.name = "Invalid";

    await modal.submit();

    expect(serialize).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(modal.closed).toBe(false);
  });
});
