// tests/apps/atlas/view.test.ts
// Regression: ensures the Atlas terrain Create Entry button triggers the renderer hook.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App, WorkspaceLeaf } from "obsidian";
import { AtlasView, ATLAS_COPY } from "../../../src/apps/atlas/view";

const { openCreateModalMock } = vi.hoisted(() => ({
    openCreateModalMock: vi.fn().mockResolvedValue({ filePath: "SaltMarcher/Terrains.md", values: {} }),
}));

vi.mock("../../../src/ui/workmode/create", async () => {
    const actual = await vi.importActual<typeof import("../../../src/ui/workmode/create")>("../../../src/ui/workmode/create");
    return { ...actual, openCreateModal: openCreateModalMock };
});

vi.mock("../../../src/apps/atlas/view/regions", () => ({
    RegionsRenderer: class {
        readonly mode = "regions" as const;
        constructor(public app: App, public container: HTMLElement) {
            void this.app;
            void this.container;
        }
        async init() {}
        render() {}
        setQuery() {}
        async destroy() {}
    },
}));

vi.mock("../../../src/core/terrain-store", () => ({
    ensureTerrainFile: vi.fn().mockResolvedValue(undefined),
    loadTerrains: vi.fn().mockResolvedValue({}),
    saveTerrains: vi.fn().mockResolvedValue(undefined),
    watchTerrains: vi.fn().mockReturnValue(() => {}),
    stringifyTerrainBlock: vi.fn().mockReturnValue(""),
    TERRAIN_FILE: "SaltMarcher/Terrains.md",
}));

vi.mock("../../../src/core/regions-store", () => ({
    ensureRegionsFile: vi.fn().mockResolvedValue(undefined),
    REGIONS_FILE: "SaltMarcher/Regions.md",
}));

const ensureDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(tag: string, options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
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

describe("AtlasView terrain actions", () => {
    let app: App;
    let view: AtlasView;

    beforeEach(() => {
        openCreateModalMock.mockClear();
        app = new App();
        const leaf = new WorkspaceLeaf();
        view = new AtlasView(leaf as unknown as WorkspaceLeaf);
        (view as unknown as { app: App }).app = app;
        (view as unknown as { contentEl: HTMLElement }).contentEl = document.createElement("div");
    });

    it("opens the workmode create modal when clicking Create entry", async () => {
        await view.onOpen();
        const root = (view as unknown as { contentEl: HTMLElement }).contentEl;
        const searchInput = root.querySelector(".sm-cc-searchbar input") as HTMLInputElement;
        expect(searchInput).toBeTruthy();
        searchInput.value = "Forest";
        const createBtn = root.querySelector(".sm-cc-searchbar button") as HTMLButtonElement;
        expect(createBtn?.textContent).toBe(ATLAS_COPY.createButton);
        createBtn?.click();
        await Promise.resolve();
        expect(openCreateModalMock).toHaveBeenCalled();
        expect(openCreateModalMock.mock.calls[0]?.[1]).toMatchObject({ preset: "Forest" });
    });
});
