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

type VaultListener = { event: string; handler: (file: TAbstractFile) => void };

export class App {
    private files = new Map<string, { file: TFile; content: string }>();
    private folders = new Set<string>();
    private listeners: VaultListener[] = [];

    vault: {
        on: (event: string, handler: (file: TAbstractFile) => void) => EventRef;
        off: (event: string, handler: (file: TAbstractFile) => void) => void;
        offref: (ref: EventRef) => void;
        getAbstractFileByPath: (path: string) => TAbstractFile | null;
        read: (file: TFile) => Promise<string>;
        create: (path: string, content: string) => Promise<TFile>;
        modify: (file: TFile, content: string) => Promise<void>;
        createFolder: (path: string) => Promise<void>;
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
            on: (event, handler) => {
                const entry: VaultListener = { event, handler };
                this.listeners.push(entry);
                return { off: () => this.offVaultListener(entry) };
            },
            off: (_event, handler) => {
                this.listeners = this.listeners.filter(l => l.handler !== handler);
            },
            offref: (ref) => {
                ref.off();
            },
            getAbstractFileByPath: (path) => {
                const normalized = normalizePath(path);
                const fileEntry = this.files.get(normalized);
                if (fileEntry) return fileEntry.file;
                if (this.folders.has(normalized)) {
                    const folder = new TFolder();
                    folder.path = normalized;
                    return folder;
                }
                return null;
            },
            read: async (file) => {
                return this.files.get(file.path)?.content ?? "";
            },
            create: async (path, content) => {
                const normalized = normalizePath(path);
                const file = new TFile();
                file.path = normalized;
                file.basename = normalized.split("/").pop() ?? normalized;
                this.files.set(normalized, { file, content });
                this.emitVault("create", file);
                return file;
            },
            modify: async (file, content) => {
                const entry = this.files.get(file.path);
                if (entry) {
                    entry.content = content;
                } else {
                    this.files.set(file.path, { file, content });
                }
                this.emitVault("modify", file);
            },
            createFolder: async (path) => {
                this.folders.add(normalizePath(path));
            },
        };
        this.metadataCache = {
            getFileCache: () => null,
            getCache: () => null,
            on: () => ({ off: () => {} }),
            off: () => {},
            resolvedLinks: {},
        };
    }

    private offVaultListener(entry: VaultListener) {
        this.listeners = this.listeners.filter(l => l !== entry);
    }

    private emitVault(event: string, file: TAbstractFile) {
        for (const listener of this.listeners) {
            if (listener.event === event) {
                try {
                    listener.handler(file);
                } catch (error) {
                    console.error("Vault listener failed", error);
                }
            }
        }
    }
}

class Scope {
    register(_modifiers: string[], _key: string, _handler: (evt: KeyboardEvent) => void) {}
}

export function setIcon(_el: HTMLElement, _name: string): void {}

export class Modal {
    modalEl: HTMLElement;
    contentEl: HTMLElement;
    scope = new Scope();
    constructor(public app: App) {
        this.modalEl = document.createElement("div");
        this.modalEl.classList.add("modal");
        this.contentEl = document.createElement("div");
        this.contentEl.classList.add("modal-content");
        this.modalEl.appendChild(this.contentEl);
    }
    open() {
        const onOpen = (this as { onOpen?: () => void }).onOpen;
        onOpen?.call(this);
    }
    close() {
        const onClose = (this as { onClose?: () => void }).onClose;
        onClose?.call(this);
    }
}

export class Setting {
    settingEl: HTMLDivElement;
    infoEl: HTMLDivElement;
    controlEl: HTMLDivElement;
    constructor(container: HTMLElement) {
        const base = (container as any).createDiv?.({ cls: "setting-item" }) ?? (() => {
            const el = document.createElement("div");
            el.classList.add("setting-item");
            container.appendChild(el);
            return el;
        })();
        this.settingEl = base as HTMLDivElement;
        const info = (this.settingEl as any).createDiv?.({ cls: "setting-item-info" }) ?? (() => {
            const el = document.createElement("div");
            el.classList.add("setting-item-info");
            this.settingEl.appendChild(el);
            return el;
        })();
        this.infoEl = info as HTMLDivElement;
        const control = (this.settingEl as any).createDiv?.({ cls: "setting-item-control" }) ?? (() => {
            const el = document.createElement("div");
            el.classList.add("setting-item-control");
            this.settingEl.appendChild(el);
            return el;
        })();
        this.controlEl = control as HTMLDivElement;
    }
    setName(name: string): this {
        const title = this.infoEl.querySelector(".setting-item-name") ?? this.infoEl.appendChild(document.createElement("span"));
        title.classList.add("setting-item-name");
        title.textContent = name;
        return this;
    }
    setDesc(desc: string): this {
        const el = this.infoEl.querySelector(".setting-item-description") ?? this.infoEl.appendChild(document.createElement("div"));
        el.classList.add("setting-item-description");
        el.textContent = desc;
        return this;
    }
    addText(cb: (text: { inputEl: HTMLInputElement; setPlaceholder: (value: string) => unknown; setValue: (value: string) => unknown; onChange: (fn: (value: string) => unknown) => unknown }) => void): this {
        const input = document.createElement("input");
        input.type = "text";
        this.controlEl.appendChild(input);
        const api = {
            inputEl: input,
            setPlaceholder: (value: string) => {
                input.placeholder = value;
                return api;
            },
            setValue: (value: string) => {
                input.value = value ?? "";
                return api;
            },
            onChange: (fn: (value: string) => unknown) => {
                input.addEventListener("change", () => fn(input.value));
                input.addEventListener("input", () => fn(input.value));
                return api;
            },
        };
        cb(api);
        return this;
    }
    addToggle(cb: (toggle: { toggleEl: HTMLInputElement; setValue: (value: boolean) => unknown; onChange: (fn: (value: boolean) => unknown) => unknown }) => void): this {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        this.controlEl.appendChild(toggle);
        const api = {
            toggleEl: toggle,
            setValue: (value: boolean) => {
                toggle.checked = value;
                return api;
            },
            onChange: (fn: (value: boolean) => unknown) => {
                toggle.addEventListener("change", () => fn(toggle.checked));
                return api;
            },
        };
        cb(api);
        return this;
    }
    addDropdown(cb: (dropdown: { selectEl: HTMLSelectElement; addOption: (value: string, label: string) => unknown; setValue: (value: string) => unknown; onChange: (fn: (value: string) => unknown) => unknown }) => void): this {
        const select = document.createElement("select");
        this.controlEl.appendChild(select);
        const api = {
            selectEl: select,
            addOption: (value: string, label: string) => {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = label;
                select.appendChild(option);
                return api;
            },
            setValue: (value: string) => {
                select.value = value ?? "";
                return api;
            },
            onChange: (fn: (value: string) => unknown) => {
                select.addEventListener("change", () => fn(select.value));
                return api;
            },
        };
        cb(api);
        return this;
    }
    addButton(cb: (button: { buttonEl: HTMLButtonElement; setButtonText: (value: string) => unknown; setCta: () => unknown; onClick: (fn: () => unknown) => unknown; setDisabled: (value: boolean) => unknown }) => void): this {
        const button = document.createElement("button");
        button.type = "button";
        this.controlEl.appendChild(button);
        const api = {
            buttonEl: button,
            setButtonText: (value: string) => {
                button.textContent = value;
                return api;
            },
            setCta: () => {
                button.classList.add("mod-cta");
                return api;
            },
            onClick: (fn: () => unknown) => {
                button.addEventListener("click", () => fn());
                return api;
            },
            setDisabled: (value: boolean) => {
                button.disabled = value;
                return api;
            },
        };
        cb(api);
        return this;
    }
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
