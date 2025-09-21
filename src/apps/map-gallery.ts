// src/apps/map-gallery.ts
import { App, ItemView, WorkspaceLeaf, TFile, Notice, setIcon } from "obsidian";
import { NameInputModal, MapSelectModal } from "../ui/modals";
import { parseOptions } from "../core/options";
import { renderHexMap } from "../core/hex-mapper/hex-render";
import { getAllMapFiles, getFirstHexBlock } from "../core/map-list";
import { getRightLeaf, getCenterLeaf } from "../core/layout";
import { VIEW_TYPE_MAP_EDITOR } from "./map-editor/index"; // Pfad ggf. anpassen
import { createHexMapFile } from "../core/map-maker";
import { ConfirmDeleteModal } from "../ui/confirm-delete";
import { deleteMapAndTiles } from "../core/map-delete";

export const VIEW_TYPE_HEX_GALLERY = "hex-gallery-view" as const;
export type OpenTarget = "map-editor" | "travel-guide";

/* ---------------- Obsidian View ---------------- */
export class HexGalleryView extends ItemView {
    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return VIEW_TYPE_HEX_GALLERY; }
    getDisplayText() { return "Map Gallery"; }
    async onOpen() {
        const container = this.contentEl as HTMLElement;
        container.empty();
        container.addClass("hex-gallery-root");
        mountMapGallery(this.app as App, container);
    }
    async onClose() { /* optional cleanup */ }
}

/* ---------------- Header (UI-only) ---------------- */
type HeaderCallbacks = {
    openMap: () => void;
    createMap: () => void;
    onOpenIn: (target: OpenTarget) => void;
    onDelete: () => void;
};

function renderHeader(
    app: App,
    root: HTMLElement,
    cbs: HeaderCallbacks,
    currentFile?: TFile
) {
    const header = root.createDiv({ cls: "hex-gallery-header" });
    Object.assign(header.style, { display: "flex", flexDirection: "column", gap: "0.4rem" });

    // Row 1: Titel | Open | +
    const row1 = header.createDiv({ cls: "hex-gallery-row1" });
    Object.assign(row1.style, { display: "flex", alignItems: "center", gap: "0.5rem" });

    const hTitle = row1.createEl("h2", { text: "Map Gallery" });
    Object.assign(hTitle.style, { marginRight: "auto", fontSize: "1.1rem" });

    const btnOpen = row1.createEl("button", { text: "Open Map" });
    setIcon(btnOpen, "folder-open");
    Object.assign(btnOpen.style, btnStyle());
    btnOpen.addEventListener("click", () => cbs.openMap());

    const btnPlus = row1.createEl("button");
    setIcon(btnPlus, "plus");
    Object.assign(btnPlus.style, btnStyle());
    btnPlus.addEventListener("click", () => cbs.createMap());

    // Row 2: aktueller Name | Öffnen in | Löschen
    const row2 = header.createDiv({ cls: "hex-gallery-row2" });
    Object.assign(row2.style, { display: "flex", alignItems: "center", gap: "0.5rem" });

    const current = row2.createEl("div", {
        text: currentFile ? currentFile.basename : "—",
    });
    Object.assign(current.style, { marginRight: "auto", opacity: "0.85" });

    const openWrap = row2.createDiv();
    Object.assign(openWrap.style, { display: "flex", alignItems: "center", gap: "0.4rem" });
    openWrap.createEl("span", { text: "Öffnen in:" });

    const select = openWrap.createEl("select");
    select.createEl("option", { text: "Map Editor" }).value = "map-editor";
    select.createEl("option", { text: "Travel Guide" }).value = "travel-guide";

    const btnGo = openWrap.createEl("button", { text: "Los" });
    Object.assign(btnGo.style, btnStyle());
    btnGo.addEventListener("click", () => {
        const target = (select.value as OpenTarget) || "map-editor";
        cbs.onOpenIn(target);
    });

    // Papierkorb (nur aktiv, wenn Karte gewählt)
    const btnDelete = row2.createEl("button", { attr: { "aria-label": "Delete map" } });
    setIcon(btnDelete, "trash");
    Object.assign(btnDelete.style, btnStyle());
    toggleButton(btnDelete, !!currentFile);
    btnDelete.addEventListener("click", () => cbs.onDelete());

    return {
        header,
        setCurrentTitle: (f?: TFile) => {
            currentFile = f;
            current.textContent = f ? f.basename : "—";
            toggleButton(btnDelete, !!f);
        },
    };
}

/* ---------------- Widget (Logik + State) ---------------- */
export function mountMapGallery(app: App, container: HTMLElement) {
    container.empty();
    Object.assign(container.style, { display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%" });

    let currentFile: TFile | undefined;

    const viewer = container.createDiv({ cls: "hex-gallery-viewer" });
    Object.assign(viewer.style, { flex: "1 1 auto", minHeight: "200px", overflow: "hidden" });

    const { setCurrentTitle } = renderHeader(
        app,
        container,
        {
            openMap: async () => {
                const files = await getAllMapFiles(app);
                if (!files.length) return new Notice("Keine Karten gefunden.");
                new MapSelectModal(app, files, async (f) => {
                    currentFile = f;
                    setCurrentTitle(currentFile);
                    await refreshViewer();
                }).open();
            },
            createMap: () => {
                new NameInputModal(app, async (name) => {
                    const file = await createHexMapFile(app, name);
                    new Notice("Karte erstellt.");
                    currentFile = file;
                    setCurrentTitle(currentFile);
                    await refreshViewer();
                }).open();
            },
            onOpenIn: (target) => {
                if (!currentFile) return new Notice("Keine Karte ausgewählt.");
                openIn(app, target, currentFile);
            },
            onDelete: () => {
                if (!currentFile) return;
                new ConfirmDeleteModal(app, currentFile, async () => {
                    try {
                        await deleteMapAndTiles(app, currentFile!);
                        new Notice("Map gelöscht.");
                        currentFile = undefined;
                        setCurrentTitle(undefined);
                        await refreshViewer();
                    } catch (e) {
                        console.error(e);
                        new Notice("Löschen fehlgeschlagen.");
                    }
                }).open();
            },
        },
        currentFile
    );

    async function refreshViewer() {
        viewer.empty();
        if (!currentFile) {
            viewer.createEl("div", { text: "Keine Karte ausgewählt." });
            return;
        }
        await renderViewer(app, viewer, currentFile);
    }

    return {
        async setFile(f?: TFile) {
            currentFile = f;
            setCurrentTitle(currentFile);
            await refreshViewer();
        },
    };
}

/* ---------------- Viewer ---------------- */
async function renderViewer(app: App, root: HTMLElement, file: TFile) {
    const host = root.createDiv({ cls: "hex3x3-container" });
    Object.assign(host.style, { width: "100%", height: "100%" });

    const block = await getFirstHexBlock(app, file);
    if (!block) {
        host.createEl("div", { text: "Kein hex3x3-Block in dieser Datei." });
        return;
    }

    const opts = parseOptions(block);
    await renderHexMap(app, host, opts, file.path);
}

/* ---------------- Navigation ---------------- */
async function openIn(app: App, target: OpenTarget, file: TFile) {
    if (target === "map-editor") {
        const leaf = getCenterLeaf(app);
        await leaf.setViewState({
            type: VIEW_TYPE_MAP_EDITOR,
            active: true,
            state: { mapPath: file.path },
        });
        app.workspace.revealLeaf(leaf);
        return;
    }
    // Travel Guide rechts öffnen
    const leaf = getRightLeaf(app);
    await leaf.openFile(file, { state: { mode: "travel-guide" } as any });
}

/* ---------------- Utils ---------------- */
function btnStyle() {
    return {
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "6px 10px",
        cursor: "pointer",
    } as Partial<CSSStyleDeclaration>;
}

function toggleButton(btn: HTMLButtonElement, enabled: boolean) {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? "1" : "0.5";
    btn.style.pointerEvents = enabled ? "auto" : "none";
}
