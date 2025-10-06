// salt-marcher/tests/apps/almanac/almanac-controller.dom.test.ts
// Validiert das Rendering des Recently-Triggered-Abschnitts nach Zeitfortschritt.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => await import("../../mocks/obsidian"));

import { App } from "obsidian";
import { AlmanacController } from "../../../src/apps/almanac/mode/almanac-controller";

const ensureObsidianDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(
            tag: string,
            options?: { text?: string; cls?: string; attr?: Record<string, string> }
        ) {
            const el = document.createElement(tag);
            if (options?.text) el.textContent = options.text;
            if (options?.cls) {
                for (const cls of options.cls.split(/\s+/).filter(Boolean)) {
                    el.classList.add(cls);
                }
            }
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
        proto.createDiv = function(options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
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
    if (!proto.setText) {
        proto.setText = function(text: string) {
            this.textContent = text;
            return this;
        };
    }
};

describe("AlmanacController Dashboard", () => {
    beforeAll(() => {
        ensureObsidianDomHelpers();
    });

    it("blendet ausgelöste Ereignisse nach Zeitfortschritt ein", async () => {
        const app = new App();
        const controller = new AlmanacController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        expect(container.textContent?.includes("Recently Triggered")).toBe(false);

        await (controller as unknown as { handleAdvanceTime: (amount: number, unit: "day" | "hour") => Promise<void> }).handleAdvanceTime(
            15,
            "day"
        );

        const triggeredHeading = Array.from(container.querySelectorAll("h2")).find(
            heading => heading.textContent === "Recently Triggered"
        );
        expect(triggeredHeading).toBeTruthy();

        const triggeredSection = triggeredHeading?.closest(".almanac-section");
        const items = triggeredSection?.querySelectorAll(".almanac-event-item") ?? [];
        expect(items.length).toBeGreaterThan(0);

        const titles = Array.from(items).map(item => item.querySelector("strong")?.textContent ?? "");
        expect(titles.some(title => title.includes("Team Meeting"))).toBe(true);
    });
});
