// tests/apps/atlas/regions-create-modal.test.ts
// Regression: ensures the regions renderer opens the shared create modal with the app instance.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";

const regionStore = vi.hoisted(() => ({
    ensureRegionsFile: vi.fn().mockResolvedValue(undefined),
    loadRegions: vi.fn().mockResolvedValue([]),
    saveRegions: vi.fn().mockResolvedValue(undefined),
    watchRegions: vi.fn().mockReturnValue(() => {}),
    stringifyRegionsBlock: vi.fn().mockReturnValue(""),
    REGIONS_FILE: "SaltMarcher/Regions.md",
}));

const terrainStore = vi.hoisted(() => ({
    loadTerrains: vi.fn().mockResolvedValue({ Forest: { color: "#228833", speed: 1 } }),
    watchTerrains: vi.fn().mockReturnValue(() => {}),
}));

vi.mock("../../../src/core/regions-store", () => regionStore);
vi.mock("../../../src/core/terrain-store", () => terrainStore);

import { RegionsRenderer } from "../../../src/apps/atlas/view/regions";
import * as createModule from "../../../src/ui/workmode/create";

const ensureDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(tag: keyof HTMLElementTagNameMap, options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            const el = document.createElement(tag);
            if (options?.text) el.textContent = options.text;
            if (options?.cls) el.classList.add(options.cls);
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
            while (this.firstChild) this.removeChild(this.firstChild);
            return this;
        };
    }
    if (!proto.setText) {
        proto.setText = function(text: string) {
            this.textContent = text;
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
};

beforeAll(() => {
    ensureDomHelpers();
});

describe("RegionsRenderer create modal integration", () => {
    it("passes the app instance to openCreateModal", async () => {
        const app = new App();
        const container = document.createElement("div");
        const renderer = new RegionsRenderer(app, container);
        await renderer.init();

        const openSpy = vi.spyOn(createModule, "openCreateModal");
        const modalSpy = vi
            .spyOn(createModule.DeclarativeCreateModal.prototype, "open")
            .mockImplementation(function(this: InstanceType<typeof createModule.DeclarativeCreateModal>) {
                this.close();
            });
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await renderer.handleCreate("Shallows");

        expect(openSpy).toHaveBeenCalledTimes(1);
        const options = openSpy.mock.calls[0]?.[1];
        expect(options?.app).toBe(app);
        expect(errorSpy).not.toHaveBeenCalled();

        modalSpy.mockRestore();
        openSpy.mockRestore();
        errorSpy.mockRestore();
        await renderer.destroy();
    });
});
