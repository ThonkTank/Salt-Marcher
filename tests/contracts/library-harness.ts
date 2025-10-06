// salt-marcher/tests/contracts/library-harness.ts
// Bietet einen konfigurierbaren Vertragstest-Harness für Library-Ports inklusive Legacy/v2-Adapterumschaltung.
import * as Obsidian from "obsidian";
import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { scoreName, type Mode as LibraryRendererMode } from "../../src/apps/library/view/mode";
import {
    createCreatureFile,
    listCreatureFiles,
    statblockToMarkdown,
    type StatblockData,
} from "../../src/apps/library/core/creature-files";
import {
    createItemFile,
    listItemFiles,
    itemToMarkdown,
    type ItemData,
} from "../../src/apps/library/core/item-files";
import {
    createEquipmentFile,
    listEquipmentFiles,
    equipmentToMarkdown,
    type EquipmentData,
} from "../../src/apps/library/core/equipment-files";
import {
    ensureTerrainFile,
    loadTerrains,
    saveTerrains,
    stringifyTerrainBlock,
} from "../../src/core/terrain-store";
import {
    ensureRegionsFile,
    loadRegions,
    saveRegions,
    type Region,
} from "../../src/core/regions-store";
import type { LibraryFixtureSet } from "./library-fixtures";
import { libraryFixtures as defaultFixtures } from "./library-fixtures";

type EventRef = { off: () => void };

if (!(Obsidian as any).TFolder) {
    (Obsidian as any).TFolder = class extends TAbstractFile {
        children: TAbstractFile[] = [];
    } as typeof TFolder;
}

export type LibraryPortId = "renderer" | "storage" | "serializer" | "event";
export type LibraryAdapterKind = "legacy" | "v2";

export interface LibraryHarnessTelemetry {
    onAdapterActivated?: (info: { port: LibraryPortId; kind: LibraryAdapterKind }) => void;
    onEvent?: (info: { event: string; payload: unknown }) => void;
}

export interface RendererPort {
    listModes(): LibraryRendererMode[];
    render(mode: LibraryRendererMode, options?: { query?: string }): Array<{ fixtureId: string; name: string }>;
}

export type LibraryStorageDomain = "creatures" | "items" | "equipment";

export interface StoragePort {
    seed(fixtures: LibraryFixtureSet, serializer: SerializerPort): Promise<void>;
    list(domain: LibraryStorageDomain): Promise<string[]>;
    read(path: string): Promise<string>;
    writeCreature(data: StatblockData): Promise<string>;
    writeItem(data: ItemData): Promise<string>;
    writeEquipment(data: EquipmentData): Promise<string>;
    loadTerrains(): Promise<Record<string, { color: string; speed: number }>>;
    saveTerrains(map: Record<string, { color: string; speed: number }>): Promise<void>;
    loadRegions(): Promise<Region[]>;
    saveRegions(regions: Region[]): Promise<void>;
}

export interface SerializerPort {
    creatureToMarkdown(data: StatblockData): string;
    itemToMarkdown(data: ItemData): string;
    equipmentToMarkdown(data: EquipmentData): string;
    terrainToMarkdown(map: Record<string, { color: string; speed: number }>): string;
    normalizeFileName(name: string, fallback: string): string;
}

export interface EventPort {
    emit(event: string, payload?: unknown): void;
    subscribe(event: string, handler: (payload: unknown) => void): () => void;
    debounce(event: string, handler: (payload: unknown) => void, waitMs: number): () => void;
    reset(): void;
    flushDebounce(): Promise<void>;
}

export interface LibraryHarness {
    readonly app: HarnessApp;
    readonly fixtures: LibraryFixtureSet;
    readonly telemetry?: LibraryHarnessTelemetry;
    readonly ports: {
        renderer: RendererPort;
        storage: StoragePort;
        serializer: SerializerPort;
        event: EventPort;
    };
    reset(): Promise<void>;
    use(selection: Partial<Record<LibraryPortId, LibraryAdapterKind>>): Promise<void>;
}

export interface LibraryHarnessOptions {
    fixtures?: LibraryFixtureSet;
    selection?: Partial<Record<LibraryPortId, LibraryAdapterKind>>;
    telemetry?: LibraryHarnessTelemetry;
}

type AdapterFactories<T> = {
    legacy: () => T;
    v2: () => T;
};

type LibraryAdapterFactories = {
    [K in LibraryPortId]: AdapterFactories<LibraryPortFor<K>>;
};

type LibraryPortFor<K extends LibraryPortId> = K extends "renderer"
    ? RendererPort
    : K extends "storage"
        ? StoragePort
        : K extends "serializer"
            ? SerializerPort
            : EventPort;

class MemoryVault {
    private files = new Map<string, { file: TFile; data: string }>();
    private folders = new Map<string, TFolder>();
    private folderPaths = new Set<string>();
    private listeners: Record<string, Set<(file: TAbstractFile) => void>> = {
        create: new Set(),
        modify: new Set(),
        delete: new Set(),
        rename: new Set(),
    };

    constructor() {
        this.registerFolder("");
    }

    reset(): void {
        this.files.clear();
        this.folders.clear();
        this.folderPaths.clear();
        this.registerFolder("");
    }

    getAbstractFileByPath(path: string): TAbstractFile | null {
        const normalized = normalizeFolderPath(path);
        return this.files.get(normalized)?.file ?? this.folders.get(normalized) ?? null;
    }

    async create(path: string, data: string): Promise<TFile> {
        const normalized = normalizeFolderPath(path);
        if (this.files.has(normalized)) {
            throw new Error(`File already exists: ${normalized}`);
        }
        const parentPath = normalized.split("/").slice(0, -1).join("/");
        this.registerFolder(parentPath);
        const file = new TFile();
        file.path = normalized;
        file.basename = normalized.split("/").pop() ?? normalized;
        this.files.set(normalized, { file, data });
        this.emit("create", file);
        return file;
    }

    async read(file: TFile): Promise<string> {
        const entry = this.files.get(normalizeFolderPath(file.path));
        if (!entry) throw new Error(`Missing file: ${file.path}`);
        return entry.data;
    }

    async modify(file: TFile, data: string): Promise<void> {
        const entry = this.files.get(normalizeFolderPath(file.path));
        if (!entry) throw new Error(`Missing file: ${file.path}`);
        entry.data = data;
        await this.emit("modify", entry.file);
    }

    async delete(path: string): Promise<void> {
        const normalized = normalizeFolderPath(path);
        const entry = this.files.get(normalized);
        if (!entry) return;
        this.files.delete(normalized);
        await this.emit("delete", entry.file);
    }

    async rename(file: TFile, newPath: string): Promise<void> {
        const normalized = normalizeFolderPath(file.path);
        const entry = this.files.get(normalized);
        if (!entry) throw new Error(`Missing file: ${file.path}`);
        this.files.delete(normalized);
        const nextPath = normalizeFolderPath(newPath);
        file.path = nextPath;
        file.basename = nextPath.split("/").pop() ?? nextPath;
        this.files.set(nextPath, { file, data: entry.data });
        await this.emit("rename", entry.file);
    }

    async createFolder(path: string): Promise<TFolder> {
        const normalized = normalizeFolderPath(path);
        return this.registerFolder(normalized);
    }

    on(event: "create" | "modify" | "delete" | "rename", handler: (file: TAbstractFile) => unknown): EventRef {
        this.listeners[event].add(handler);
        return { off: () => this.listeners[event].delete(handler) };
    }

    off(event: "create" | "modify" | "delete" | "rename", handler: (file: TAbstractFile) => unknown): void {
        this.listeners[event].delete(handler);
    }

    offref(ref: EventRef): void {
        ref.off();
    }

    private registerFolder(path: string): TFolder {
        const normalized = normalizeFolderPath(path);
        let folder = this.folders.get(normalized);
        if (folder) return folder;
        if (normalized) {
            const parent = normalized.split("/").slice(0, -1).join("/");
            if (parent !== normalized) {
                this.registerFolder(parent);
            }
        }
        folder = instantiateFolder(normalized);
        Object.defineProperty(folder, "children", {
            get: () => this.collectChildren(normalized),
        });
        this.folders.set(normalized, folder);
        this.folderPaths.add(normalized);
        return folder;
    }

    private async emit(event: "create" | "modify" | "delete" | "rename", file: TAbstractFile): Promise<void> {
        const handlers = Array.from(this.listeners[event]);
        await Promise.all(handlers.map(handler => Promise.resolve(handler(file))));
    }

    private collectChildren(path: string): TAbstractFile[] {
        const prefix = path ? `${path}/` : "";
        const seen = new Set<string>();
        const out: TAbstractFile[] = [];
        for (const folderPath of this.folderPaths) {
            if (!folderPath || folderPath === path) continue;
            if (!folderPath.startsWith(prefix)) continue;
            const remainder = folderPath.slice(prefix.length);
            if (!remainder || remainder.includes("/")) continue;
            const folder = this.folders.get(folderPath);
            if (folder && !seen.has(folderPath)) {
                seen.add(folderPath);
                out.push(folder);
            }
        }
        for (const [filePath, entry] of this.files) {
            if (!filePath.startsWith(prefix)) continue;
            const remainder = filePath.slice(prefix.length);
            if (!remainder || remainder.includes("/")) continue;
            out.push(entry.file);
        }
        return out;
    }
}

function normalizeFolderPath(path: string): string {
    if (!path) return "";
    return normalizePath(path);
}

function instantiateFolder(path: string): TFolder {
    const ctor = TFolder as unknown as { new (): TFolder } | undefined;
    if (ctor && typeof ctor === "function") {
        const folder = new ctor();
        folder.path = path;
        return folder;
    }
    const folder = Object.create(TAbstractFile.prototype) as TFolder;
    folder.path = path;
    (folder as unknown as { children: TAbstractFile[] }).children = [];
    return folder;
}

class HarnessApp extends App {
    vault: MemoryVault;
    workspace: { trigger: (event: string, ...args: unknown[]) => void; on: () => void; off: () => void };
    readonly workspaceEvents: Array<{ event: string; args: unknown[] }>; // historisiert Telemetrie

    constructor(vault: MemoryVault) {
        super();
        this.vault = vault as unknown as App["vault"];
        this.workspaceEvents = [];
        this.workspace = {
            trigger: (event: string, ...args: unknown[]) => {
                this.workspaceEvents.push({ event, args });
            },
            on: () => {},
            off: () => {},
        } as any;
    }
}

class LegacyRendererAdapter implements RendererPort {
    constructor(private readonly fixtures: LibraryFixtureSet, private readonly telemetry?: LibraryHarnessTelemetry) {}

    listModes(): LibraryRendererMode[] {
        return ["creatures", "items", "equipment", "terrains", "regions"] as LibraryRendererMode[];
    }

    render(mode: LibraryRendererMode, options?: { query?: string }): Array<{ fixtureId: string; name: string }> {
        const query = (options?.query ?? "").toLowerCase();
        const entries = this.collectEntries(mode).filter(entry =>
            !query || entry.name.toLowerCase().includes(query)
        );
        entries.sort((a, b) => a.name.localeCompare(b.name));
        this.telemetry?.onAdapterActivated?.({ port: "renderer", kind: "legacy" });
        return entries;
    }

    private collectEntries(mode: LibraryRendererMode): Array<{ fixtureId: string; name: string }> {
        switch (mode) {
            case "creatures":
                return this.fixtures.creatures.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name }));
            case "items":
                return this.fixtures.items.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name ?? "" }));
            case "equipment":
                return this.fixtures.equipment.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name ?? "" }));
            case "terrains":
                return Object.entries(this.fixtures.terrains.entries).map(([name]) => ({ fixtureId: `terrain.${name || "base"}`, name }));
            case "regions":
                return this.fixtures.regions.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name }));
            default:
                return [];
        }
    }
}

class V2RendererAdapter implements RendererPort {
    constructor(private readonly fixtures: LibraryFixtureSet, private readonly telemetry?: LibraryHarnessTelemetry) {}

    listModes(): LibraryRendererMode[] {
        return ["creatures", "items", "equipment", "terrains", "regions"] as LibraryRendererMode[];
    }

    render(mode: LibraryRendererMode, options?: { query?: string }): Array<{ fixtureId: string; name: string }> {
        const query = (options?.query ?? "").trim().toLowerCase();
        const entries = this.collectEntries(mode);
        const ranked = query
            ? entries
                  .map(entry => ({ entry, score: scoreName(entry.name.toLowerCase(), query) }))
                  .filter(r => Number.isFinite(r.score) && r.score > -Infinity)
                  .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
                  .map(r => r.entry)
            : entries.sort((a, b) => a.name.localeCompare(b.name));
        this.telemetry?.onAdapterActivated?.({ port: "renderer", kind: "v2" });
        return ranked;
    }

    private collectEntries(mode: LibraryRendererMode): Array<{ fixtureId: string; name: string }> {
        switch (mode) {
            case "creatures":
                return this.fixtures.creatures.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name }));
            case "items":
                return this.fixtures.items.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name ?? "" }));
            case "equipment":
                return this.fixtures.equipment.entries.map(e => ({ fixtureId: e.fixtureId, name: e.name ?? "" }));
            case "terrains":
                return Object.entries(this.fixtures.terrains.entries).map(([name]) => ({ fixtureId: `terrain.${name || "base"}`, name }));
            case "regions":
                return this.fixtures.regions.entries.map(e => ({ fixtureId: e.fixtureId, name: `${e.name} (${e.terrain})` }));
            default:
                return [];
        }
    }
}

class LegacySerializerAdapter implements SerializerPort {
    creatureToMarkdown(data: StatblockData): string {
        return statblockToMarkdown(data);
    }

    itemToMarkdown(data: ItemData): string {
        return itemToMarkdown(data);
    }

    equipmentToMarkdown(data: EquipmentData): string {
        return equipmentToMarkdown(data);
    }

    terrainToMarkdown(map: Record<string, { color: string; speed: number }>): string {
        return stringifyTerrainBlock(map);
    }

    normalizeFileName(name: string, fallback: string): string {
        return sanitizeName(name, fallback);
    }
}

class V2SerializerAdapter extends LegacySerializerAdapter {
    override creatureToMarkdown(data: StatblockData): string {
        return super.creatureToMarkdown({ ...data, traits: data.traits?.trim() ?? data.traits });
    }
}

class LegacyStorageAdapter implements StoragePort {
    constructor(
        protected readonly app: HarnessApp,
        private readonly vault: MemoryVault,
        protected readonly telemetry?: LibraryHarnessTelemetry
    ) {}

    async seed(fixtures: LibraryFixtureSet, serializer: SerializerPort): Promise<void> {
        await this.seedCreatures(fixtures.creatures.entries);
        await this.seedItems(fixtures.items.entries);
        await this.seedEquipment(fixtures.equipment.entries);
        await this.seedTerrains(fixtures.terrains.entries);
        await this.seedRegions(fixtures.regions.entries);
        this.telemetry?.onAdapterActivated?.({ port: "storage", kind: "legacy" });
    }

    async list(domain: LibraryStorageDomain): Promise<string[]> {
        switch (domain) {
            case "creatures":
                return (await listCreatureFiles(this.app)).map(file => file.path);
            case "items":
                return (await listItemFiles(this.app)).map(file => file.path);
            case "equipment":
                return (await listEquipmentFiles(this.app)).map(file => file.path);
            default:
                return [];
        }
    }

    async read(path: string): Promise<string> {
        const file = this.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error(`Expected file at ${path}`);
        return await this.vault.read(file as unknown as TFile);
    }

    async writeCreature(data: StatblockData): Promise<string> {
        const file = await createCreatureFile(this.app, data);
        return file.path;
    }

    async writeItem(data: ItemData): Promise<string> {
        const file = await createItemFile(this.app, data);
        return file.path;
    }

    async writeEquipment(data: EquipmentData): Promise<string> {
        const file = await createEquipmentFile(this.app, data);
        return file.path;
    }

    async loadTerrains(): Promise<Record<string, { color: string; speed: number }>> {
        await ensureTerrainFile(this.app);
        return await loadTerrains(this.app);
    }

    async saveTerrains(map: Record<string, { color: string; speed: number }>): Promise<void> {
        await saveTerrains(this.app, map);
    }

    async loadRegions(): Promise<Region[]> {
        await ensureRegionsFile(this.app);
        return await loadRegions(this.app);
    }

    async saveRegions(regions: Region[]): Promise<void> {
        await saveRegions(this.app, regions);
    }

    private async seedCreatures(list: Array<StatblockData>): Promise<void> {
        for (const entry of list) {
            await this.writeCreature(entry);
        }
    }

    private async seedItems(list: Array<ItemData>): Promise<void> {
        for (const entry of list) {
            await this.writeItem(entry);
        }
    }

    private async seedEquipment(list: Array<EquipmentData>): Promise<void> {
        for (const entry of list) {
            await this.writeEquipment(entry);
        }
    }

    private async seedTerrains(map: Record<string, { color: string; speed: number }>): Promise<void> {
        await ensureTerrainFile(this.app);
        await saveTerrains(this.app, map);
    }

    private async seedRegions(list: Region[]): Promise<void> {
        await ensureRegionsFile(this.app);
        await saveRegions(this.app, list);
    }
}

class V2StorageAdapter extends LegacyStorageAdapter {
    constructor(app: HarnessApp, vault: MemoryVault, telemetry?: LibraryHarnessTelemetry) {
        super(app, vault, telemetry);
    }

    override async seed(fixtures: LibraryFixtureSet, serializer: SerializerPort): Promise<void> {
        await super.seed(fixtures, serializer);
        this.telemetry?.onAdapterActivated?.({ port: "storage", kind: "v2" });
    }
}

class LegacyEventAdapter implements EventPort {
    private listeners = new Map<string, Set<(payload: unknown) => void>>();
    private debounced = new Map<
        string,
        Array<{ waitMs: number; handler: (payload: unknown) => void; timer: ReturnType<typeof setTimeout> | null }>
    >();
    private pendingPromises: Promise<void>[] = [];

    constructor(private readonly telemetry?: LibraryHarnessTelemetry) {}

    emit(event: string, payload?: unknown): void {
        this.telemetry?.onEvent?.({ event, payload });
        for (const handler of this.listeners.get(event) ?? []) {
            handler(payload);
        }
        const debouncedHandlers = this.debounced.get(event) ?? [];
        for (const entry of debouncedHandlers) {
            if (entry.timer) {
                clearTimeout(entry.timer);
            }
            entry.timer = setTimeout(() => {
                entry.handler(payload);
            }, entry.waitMs);
            this.pendingPromises.push(
                new Promise<void>(resolve => {
                    setTimeout(resolve, entry.waitMs);
                })
            );
        }
    }

    subscribe(event: string, handler: (payload: unknown) => void): () => void {
        const set = this.listeners.get(event) ?? new Set();
        set.add(handler);
        this.listeners.set(event, set);
        return () => {
            set.delete(handler);
        };
    }

    debounce(event: string, handler: (payload: unknown) => void, waitMs: number): () => void {
        const list = this.debounced.get(event) ?? [];
        const entry = { waitMs, handler, timer: null as ReturnType<typeof setTimeout> | null };
        list.push(entry);
        this.debounced.set(event, list);
        return () => {
            const arr = this.debounced.get(event);
            if (!arr) return;
            const idx = arr.indexOf(entry);
            if (idx >= 0) {
                if (entry.timer) clearTimeout(entry.timer);
                arr.splice(idx, 1);
            }
        };
    }

    reset(): void {
        this.listeners.clear();
        for (const entries of this.debounced.values()) {
            for (const entry of entries) {
                if (entry.timer) clearTimeout(entry.timer);
            }
        }
        this.debounced.clear();
        this.pendingPromises = [];
    }

    async flushDebounce(): Promise<void> {
        const pending = this.pendingPromises.splice(0);
        await Promise.all(pending);
    }
}

class V2EventAdapter extends LegacyEventAdapter {
    constructor(telemetry?: LibraryHarnessTelemetry) {
        super(telemetry);
    }
}

function sanitizeName(name: string, fallback: string): string {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return fallback.trim() || "Entry";
    return trimmed.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120);
}

export function createLibraryHarness(options: LibraryHarnessOptions = {}): LibraryHarness {
    const fixtures = options.fixtures ?? defaultFixtures;
    const telemetry = options.telemetry;
    const vault = new MemoryVault();
    const app = new HarnessApp(vault);

    const factories: LibraryAdapterFactories = {
        renderer: {
            legacy: () => new LegacyRendererAdapter(fixtures, telemetry),
            v2: () => new V2RendererAdapter(fixtures, telemetry),
        },
        storage: {
            legacy: () => new LegacyStorageAdapter(app, vault, telemetry),
            v2: () => new V2StorageAdapter(app, vault, telemetry),
        },
        serializer: {
            legacy: () => new LegacySerializerAdapter(),
            v2: () => new V2SerializerAdapter(),
        },
        event: {
            legacy: () => new LegacyEventAdapter(telemetry),
            v2: () => new V2EventAdapter(telemetry),
        },
    };

    const initialSelection: Record<LibraryPortId, LibraryAdapterKind> = {
        renderer: options.selection?.renderer ?? "v2",
        storage: options.selection?.storage ?? "v2",
        serializer: options.selection?.serializer ?? "v2",
        event: options.selection?.event ?? "v2",
    } as const;

    let active = instantiateAll(initialSelection);

    async function reset(): Promise<void> {
        vault.reset();
        active.event.reset();
        active = instantiateAll(initialSelection);
        await active.storage.seed(fixtures, active.serializer);
    }

    async function use(selection: Partial<Record<LibraryPortId, LibraryAdapterKind>>): Promise<void> {
        Object.assign(initialSelection, selection);
        vault.reset();
        active = instantiateAll(initialSelection);
        await active.storage.seed(fixtures, active.serializer);
    }

    function instantiateAll(selection: Record<LibraryPortId, LibraryAdapterKind>): LibraryHarness["ports"] {
        return {
            renderer: factories.renderer[selection.renderer](),
            storage: factories.storage[selection.storage](),
            serializer: factories.serializer[selection.serializer](),
            event: factories.event[selection.event](),
        };
    }

    return {
        app,
        fixtures,
        telemetry,
        get ports() {
            return active;
        },
        async reset() {
            await reset();
        },
        async use(selection) {
            await use(selection);
        },
    };
}

export { HarnessApp };
