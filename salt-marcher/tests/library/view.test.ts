import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mode } from "../../src/apps/library/view/mode";
import { LIBRARY_COPY, LibraryView } from "../../src/apps/library/view";
import { App, WorkspaceLeaf } from "obsidian";

vi.mock("../../src/apps/library/core/creature-files", () => ({
    ensureCreatureDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/apps/library/core/spell-files", () => ({
    ensureSpellDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/core/terrain-store", () => ({
    ensureTerrainFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/core/regions-store", () => ({
    ensureRegionsFile: vi.fn().mockResolvedValue(undefined),
}));

const noop = () => {};

function createRenderer(mode: Mode) {
    return class {
        readonly mode = mode;
        constructor(public app: App, public container: HTMLElement) {
            void this.app;
            void this.container;
        }
        async init() {}
        render() {}
        setQuery = noop;
        async handleCreate() {}
        async destroy() {}
    };
}

vi.mock("../../src/apps/library/view/creatures", () => ({
    CreaturesRenderer: createRenderer("creatures" as Mode),
}));

vi.mock("../../src/apps/library/view/spells", () => ({
    SpellsRenderer: createRenderer("spells" as Mode),
}));

const terrainsSource = "Source: SaltMarcher/Terrains/";
const regionsSource = "Source: SaltMarcher/Regions.json";

vi.mock("../../src/apps/library/view/terrains", () => ({
    TerrainsRenderer: createRenderer("terrains" as Mode),
    describeTerrainsSource: () => terrainsSource,
}));

vi.mock("../../src/apps/library/view/regions", () => ({
    RegionsRenderer: createRenderer("regions" as Mode),
    describeRegionsSource: () => regionsSource,
}));

const ensureObsidianDomHelpers = () => {
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
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
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
    ensureObsidianDomHelpers();
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("LibraryView copy", () => {
    let app: App;
    let view: LibraryView;

    beforeEach(() => {
        app = new App();
        const leaf = new WorkspaceLeaf();
        view = new LibraryView(leaf as unknown as WorkspaceLeaf);
        (view as unknown as { app: App }).app = app;
        (view as unknown as { contentEl: HTMLElement }).contentEl = document.createElement("div");
    });

    it("renders the standard English labels", async () => {
        await view.onOpen();
        const root = (view as unknown as { contentEl: HTMLElement }).contentEl;

        const heading = root.querySelector("h2");
        expect(heading?.textContent).toBe(LIBRARY_COPY.title);

        const buttons = Array.from(root.querySelectorAll(".sm-lib-header button"));
        expect(buttons.map(b => b.textContent)).toEqual([
            LIBRARY_COPY.modes.creatures,
            LIBRARY_COPY.modes.spells,
            LIBRARY_COPY.modes.terrains,
            LIBRARY_COPY.modes.regions,
        ]);

        const search = root.querySelector("input[type=\"text\"]");
        expect(search?.getAttribute("placeholder")).toBe(LIBRARY_COPY.searchPlaceholder);

        const createBtn = root.querySelector(".sm-cc-searchbar button");
        expect(createBtn?.textContent).toBe(LIBRARY_COPY.createButton);

        const desc = root.querySelector(".desc");
        expect(desc?.textContent).toBe(`${LIBRARY_COPY.sources.prefix}${LIBRARY_COPY.sources.creatures}`);
    });

    it("updates the source description when switching modes", async () => {
        await view.onOpen();
        const root = (view as unknown as { contentEl: HTMLElement }).contentEl;
        const [_, __, terrainsButton, regionsButton] = Array.from(root.querySelectorAll(".sm-lib-header button"));

        terrainsButton.dispatchEvent(new Event("click"));
        await flush();
        const descAfterTerrains = root.querySelector(".desc")?.textContent;
        expect(descAfterTerrains).toBe(terrainsSource);

        regionsButton.dispatchEvent(new Event("click"));
        await flush();
        const descAfterRegions = root.querySelector(".desc")?.textContent;
        expect(descAfterRegions).toBe(regionsSource);
    });
});
