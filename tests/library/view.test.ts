// salt-marcher/tests/library/view.test.ts
// Prüft den Library-View auf Initialisierung, Kopien und Moduswechsel.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mode } from "../../src/apps/library/view/mode";
import { LIBRARY_COPY, LibraryView } from "../../src/apps/library/view";
import { App, WorkspaceLeaf } from "obsidian";

const SOURCE_LABELS: Record<Mode, string> = {
    creatures: "SaltMarcher/Creatures/",
    spells: "SaltMarcher/Spells/",
    items: "SaltMarcher/Items/",
    equipment: "SaltMarcher/Equipment/",
    terrains: "SaltMarcher/Terrains.md",
    regions: "SaltMarcher/Regions.md",
};

vi.mock("../../src/apps/library/core/sources", () => ({
    ensureLibrarySources: vi.fn().mockResolvedValue(undefined),
    describeLibrarySource: (mode: Mode) => SOURCE_LABELS[mode],
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

vi.mock("../../src/apps/library/view/terrains", () => ({
    TerrainsRenderer: createRenderer("terrains" as Mode),
}));

vi.mock("../../src/apps/library/view/equipment", () => ({
    EquipmentRenderer: createRenderer("equipment" as Mode),
}));

vi.mock("../../src/apps/library/view/regions", () => ({
    RegionsRenderer: createRenderer("regions" as Mode),
}));

const ensureObsidianDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(tag: string, options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
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

        const buttons = Array.from(root.querySelectorAll(".sm-tab-nav__button"));
        expect(buttons.map(b => b.textContent)).toEqual([
            LIBRARY_COPY.modes.creatures,
            LIBRARY_COPY.modes.spells,
            LIBRARY_COPY.modes.items,
            LIBRARY_COPY.modes.equipment,
        ]);

        const search = root.querySelector("input[type=\"text\"]");
        expect(search?.getAttribute("placeholder")).toBe(LIBRARY_COPY.searchPlaceholder);

        const createBtn = root.querySelector(".sm-cc-searchbar button");
        expect(createBtn?.textContent).toBe(LIBRARY_COPY.createButton);

        const desc = root.querySelector(".sm-workmode-header__description");
        expect(desc?.textContent).toBe(`${LIBRARY_COPY.sources.prefix}${SOURCE_LABELS.creatures}`);
    });

    it("updates the source description when switching modes", async () => {
        await view.onOpen();
        const root = (view as unknown as { contentEl: HTMLElement }).contentEl;
        const itemsButton = root.querySelector(".sm-tab-nav__button[data-tab-id=\"items\"]");
        const equipmentButton = root.querySelector(".sm-tab-nav__button[data-tab-id=\"equipment\"]");

        itemsButton?.dispatchEvent(new Event("click"));
        await flush();
        const descAfterItems = root.querySelector(".sm-workmode-header__description")?.textContent;
        expect(descAfterItems).toBe(`${LIBRARY_COPY.sources.prefix}${SOURCE_LABELS.items}`);

        equipmentButton?.dispatchEvent(new Event("click"));
        await flush();
        const descAfterEquipment = root.querySelector(".sm-workmode-header__description")?.textContent;
        expect(descAfterEquipment).toBe(`${LIBRARY_COPY.sources.prefix}${SOURCE_LABELS.equipment}`);
    });
});
