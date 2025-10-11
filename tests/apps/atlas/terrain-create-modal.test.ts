// tests/apps/atlas/terrain-create-modal.test.ts
// Regression: ensures the terrain renderer forwards the app to the shared create modal.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";

const terrainStore = vi.hoisted(() => ({
    ensureTerrainFile: vi.fn().mockResolvedValue(undefined),
    loadTerrains: vi.fn().mockResolvedValue({}),
    saveTerrains: vi.fn().mockResolvedValue(undefined),
    watchTerrains: vi.fn().mockReturnValue(() => {}),
    stringifyTerrainBlock: vi.fn().mockReturnValue(""),
    TERRAIN_FILE: "SaltMarcher/Terrains.md",
}));

vi.mock("../../../src/core/terrain-store", () => terrainStore);

import { TerrainsRenderer } from "../../../src/apps/atlas/view/terrains";
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

describe("TerrainsRenderer create modal integration", () => {
    it("passes the app instance to openCreateModal", async () => {
        const app = new App();
        const container = document.createElement("div");
        const renderer = new TerrainsRenderer(app, container);
        await renderer.init();

        const openSpy = vi.spyOn(createModule, "openCreateModal");
        const modalSpy = vi
            .spyOn(createModule.DeclarativeCreateModal.prototype, "open")
            .mockImplementation(function(this: InstanceType<typeof createModule.DeclarativeCreateModal>) {
                this.close();
            });
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await renderer.handleCreate("Forest");

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
