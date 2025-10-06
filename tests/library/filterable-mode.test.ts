// salt-marcher/tests/library/filterable-mode.test.ts
// Validiert die gemeinsame Filter- und Watcher-Logik der Library-Renderer.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { CreaturesRenderer } from "../../src/apps/library/view/creatures";
import { LibrarySourceWatcherHub } from "../../src/apps/library/view/mode";
import { LIBRARY_DATA_SOURCES, type LibraryEntry } from "../../src/apps/library/core/data-sources";

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
};

function fakeFile(path: string): TFile {
    const segments = path.split("/");
    const name = segments[segments.length - 1];
    const dot = name.lastIndexOf(".");
    const basename = dot >= 0 ? name.slice(0, dot) : name;
    const extension = dot >= 0 ? name.slice(dot + 1) : "md";
    return {
        path,
        name,
        basename,
        extension,
    } as unknown as TFile;
}

function extractNames(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll(".sm-cc-item__name"))
        .map(el => el.textContent || "");
}

type CreatureEntry = LibraryEntry<"creatures">;

const originalList = LIBRARY_DATA_SOURCES.creatures.list;
const originalLoad = LIBRARY_DATA_SOURCES.creatures.load;
const originalWatch = LIBRARY_DATA_SOURCES.creatures.watch;

describe("Filterable creatures renderer", () => {
    beforeAll(() => {
        ensureObsidianDomHelpers();
    });

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        LIBRARY_DATA_SOURCES.creatures.list = originalList;
        LIBRARY_DATA_SOURCES.creatures.load = originalLoad;
        LIBRARY_DATA_SOURCES.creatures.watch = originalWatch;
    });

    it("sorts, filters und durchsucht Einträge anhand des Schemata", async () => {
        const baseEntries: CreatureEntry[] = [
            { file: fakeFile("SaltMarcher/Creatures/basilisk.md"), name: "Basilisk", type: "Monstrosity", cr: "3" },
            { file: fakeFile("SaltMarcher/Creatures/fiend-lieutenant.md"), name: "Lieutenant", type: "Fiend", cr: "6" },
            { file: fakeFile("SaltMarcher/Creatures/crypt-wight.md"), name: "Crypt Wight", type: "Undead", cr: "5" },
        ];
        let files = baseEntries.map(entry => entry.file);
        let entries = baseEntries;

        const listMock = vi.fn(async (_app: App) => files);
        const loadMock = vi.fn(async (_app: App, file: TFile) => entries.find(entry => entry.file === file)!);
        const watchMock = vi.fn((_app: App, _onChange: () => void) => () => {});

        LIBRARY_DATA_SOURCES.creatures.list = listMock;
        LIBRARY_DATA_SOURCES.creatures.load = loadMock;
        LIBRARY_DATA_SOURCES.creatures.watch = watchMock;

        const app = { workspace: { openLinkText: vi.fn() } } as unknown as App;
        const container = document.createElement("div");
        const renderer = new CreaturesRenderer(app, container, new LibrarySourceWatcherHub());

        await renderer.init();
        renderer.render();

        expect(extractNames(container)).toEqual(["Basilisk", "Crypt Wight", "Lieutenant"]);

        const selects = Array.from(container.querySelectorAll(".sm-cc-filter-content select"));
        expect(selects.length).toBe(2);
        const typeSelect = selects[0] as HTMLSelectElement;
        typeSelect.value = "Undead";
        typeSelect.dispatchEvent(new Event("change"));
        expect(extractNames(container)).toEqual(["Crypt Wight"]);

        typeSelect.value = "";
        typeSelect.dispatchEvent(new Event("change"));
        renderer.setQuery("fiend");
        expect(extractNames(container)).toEqual(["Lieutenant"]);

        await renderer.destroy();
    });

    it("lädt Daten nach Watcher-Signalen neu", async () => {
        const firstEntries: CreatureEntry[] = [
            { file: fakeFile("SaltMarcher/Creatures/alpha.md"), name: "Alpha", type: "Beast", cr: "1" },
        ];
        const secondEntries: CreatureEntry[] = [
            { file: fakeFile("SaltMarcher/Creatures/dragon.md"), name: "Dragon", type: "Dragon", cr: "10" },
        ];

        let files = firstEntries.map(entry => entry.file);
        let entries = firstEntries;

        const listMock = vi.fn(async (_app: App) => files);
        const loadMock = vi.fn(async (_app: App, file: TFile) => entries.find(entry => entry.file === file)!);
        let onChangeHandler: (() => void) | undefined;
        const watchMock = vi.fn((_app: App, onChange: () => void) => {
            onChangeHandler = onChange;
            return () => { onChangeHandler = undefined; };
        });

        LIBRARY_DATA_SOURCES.creatures.list = listMock;
        LIBRARY_DATA_SOURCES.creatures.load = loadMock;
        LIBRARY_DATA_SOURCES.creatures.watch = watchMock;

        const app = { workspace: { openLinkText: vi.fn() } } as unknown as App;
        const container = document.createElement("div");
        const watchers = new LibrarySourceWatcherHub();
        const renderer = new CreaturesRenderer(app, container, watchers);

        await renderer.init();
        renderer.render();
        expect(extractNames(container)).toEqual(["Alpha"]);
        expect(onChangeHandler).toBeDefined();

        files = secondEntries.map(entry => entry.file);
        entries = secondEntries;
        onChangeHandler?.();
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(extractNames(container)).toEqual(["Dragon"]);
        expect(listMock).toHaveBeenCalledTimes(2);

        await renderer.destroy();
    });
});
