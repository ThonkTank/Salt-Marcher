// src/apps/map-gallery.ts
import { App, ItemView, WorkspaceLeaf, TFile, Notice, setIcon } from "obsidian";
import { getRightLeaf, getCenterLeaf } from "../core/layout";
import { VIEW_TYPE_MAP_EDITOR } from "./map-editor/index"; // Pfad ggf. anpassen
import { ConfirmDeleteModal } from "../ui/confirm-delete";
import { deleteMapAndTiles } from "../core/map-delete";
import {
    applyMapButtonStyle,
    promptCreateMap,
    promptMapSelection,
    renderHexMapFromFile,
} from "../ui/map-workflows";

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
    applyMapButtonStyle(btnOpen);
    btnOpen.addEventListener("click", () => cbs.openMap());

    const btnPlus = row1.createEl("button");
    setIcon(btnPlus, "plus");
    applyMapButtonStyle(btnPlus);
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
    applyMapButtonStyle(btnGo);
    btnGo.addEventListener("click", () => {
        const target = (select.value as OpenTarget) || "map-editor";
        cbs.onOpenIn(target);
    });

    // Papierkorb (nur aktiv, wenn Karte gewählt)
    const btnDelete = row2.createEl("button", { attr: { "aria-label": "Delete map" } });
    setIcon(btnDelete, "trash");
    applyMapButtonStyle(btnDelete);
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
                await promptMapSelection(app, async (f) => {
                    currentFile = f;
                    setCurrentTitle(currentFile);
                    await refreshViewer();
                });
            },
            createMap: () => {
                promptCreateMap(app, async (file) => {
                    currentFile = file;
                    setCurrentTitle(currentFile);
                    await refreshViewer();
                });
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
    await renderHexMapFromFile(app, root, file);
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
function toggleButton(btn: HTMLButtonElement, enabled: boolean) {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? "1" : "0.5";
    btn.style.pointerEvents = enabled ? "auto" : "none";
}
