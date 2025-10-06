// salt-marcher/tests/mocks/obsidian.ts
// Stellt schlanke Mock-Typen und Klassen für Obsidian-APIs bereit.
export type EventRef = { off: () => void };

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    author: string;
    description?: string;
}

export class Notice {
    message: string | undefined;
    constructor(message?: string) {
        this.message = message;
    }
}

export class TAbstractFile {
    path = "";
}

export class TFile extends TAbstractFile {
    path = "";
    basename = "";
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];
}

export class WorkspaceLeaf {
    view: unknown = null;
    setViewState = async (_state: unknown) => {};
    detach = async () => {};
}

export class ItemView {
    containerEl: HTMLElement;
    app: App | null = null;
    constructor(public leaf: WorkspaceLeaf) {
        this.containerEl = document.createElement("div");
    }
    getViewType(): string {
        return "";
    }
}

export interface FrontMatterInfo {
    exists: boolean;
    frontmatter: string;
    from: number;
    to: number;
    contentStart: number;
}

export function getFrontMatterInfo(content: string): FrontMatterInfo {
    const match = content.match(/^---\s*\n?([\s\S]*?)\n?---\s*/);
    if (!match) {
        return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
    }
    const block = match[1] ?? "";
    const start = match.index ?? 0;
    const prefix = match[0] ?? "";
    return {
        exists: true,
        frontmatter: block,
        from: start,
        to: start + block.length,
        contentStart: start + prefix.length,
    };
}

export class App {
    vault: {
        on: (event: string, handler: (file: TAbstractFile) => void) => EventRef;
        off: (event: string, handler: (file: TAbstractFile) => void) => void;
        offref: (ref: EventRef) => void;
    };
    metadataCache: {
        getFileCache: (file: TFile) => unknown;
        getCache: (path: string) => unknown;
        on: (event: string, handler: (file: TAbstractFile) => void) => EventRef;
        off: (event: string, handler: (file: TAbstractFile) => void) => void;
        resolvedLinks: Record<string, Record<string, number>>;
    };
    workspace = {
        getLeavesOfType: (_type: string) => [] as WorkspaceLeaf[],
        getLeaf: (_create: boolean) => new WorkspaceLeaf(),
        revealLeaf: (_leaf: WorkspaceLeaf) => {},
        getActiveFile: () => null as TFile | null,
        on: (_name: string, _callback: (...args: unknown[]) => void) => {},
        off: (_name: string, _callback: (...args: unknown[]) => void) => {},
        trigger: (_name: string, ..._args: unknown[]) => {},
    };
    constructor() {
        this.vault = {
            on: (_event: string, _handler: (file: TAbstractFile) => void) => ({ off: () => {} }),
            off: (_event: string, _handler: (file: TAbstractFile) => void) => {},
            offref: (_ref: EventRef) => {},
        };
        this.metadataCache = {
            getFileCache: () => null,
            getCache: () => null,
            on: () => ({ off: () => {} }),
            off: () => {},
            resolvedLinks: {},
        };
    }
}

export function setIcon(_el: HTMLElement, _name: string): void {}

export class Modal {
    constructor(public app: App) {}
    open() {}
    close() {}
}

export class FuzzySuggestModal<T> extends Modal {
    getItems(): T[] {
        return [];
    }
    getItemText(_item: T): string {
        return "";
    }
    renderSuggestion(_item: T, _el: HTMLElement): void {}
    onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}

export function normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
}

export class Plugin {
    app: App;
    manifest: PluginManifest;
    views = new Map<string, (leaf: WorkspaceLeaf) => ItemView>();
    ribbons: Array<{ name: string; title: string; callback: () => void }> = [];
    commands: Array<{ id: string; name: string; callback?: () => void }> = [];
    constructor(app: App, manifest: PluginManifest) {
        this.app = app;
        this.manifest = manifest;
    }
    registerView(type: string, factory: (leaf: WorkspaceLeaf) => ItemView) {
        this.views.set(type, factory);
    }
    addRibbonIcon(name: string, title: string, callback: () => void) {
        this.ribbons.push({ name, title, callback });
        const el = document.createElement("div");
        el.dataset.icon = name;
        el.title = title;
        el.addEventListener("click", callback);
        return el;
    }
    addCommand(command: { id: string; name: string; callback?: () => void }) {
        this.commands.push(command);
        return command;
    }
    register(cb: () => void) {
        return cb;
    }
}
