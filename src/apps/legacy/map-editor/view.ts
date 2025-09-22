// src/apps/legacy/map-editor/view.ts
import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { App } from "obsidian";
import { mountCartographer, type CartographerController } from "../../cartographer/view-shell";

export const VIEW_TYPE_MAP_EDITOR = "map-editor-view" as const;

type EditorState = { mapPath?: string };

export class MapEditorView extends ItemView {
    private _state: EditorState = {};
    private _controller: CartographerController | null = null;

    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return VIEW_TYPE_MAP_EDITOR; }
    getDisplayText() { return "Map Editor"; }

    async onOpen() {
        const container = this.contentEl as HTMLElement;
        container.empty();
        container.addClass("hex-map-editor-root");

        // Leaf-ViewState aus Obsidian ziehen (kommt oft NACH onOpen)
        const vs = this.leaf.getViewState();
        const initial = (vs?.state as EditorState) ?? this._state ?? {};
        this._state = initial;

        let initialFile: TFile | null = null;
        if (initial.mapPath) {
            const af = this.app.vault.getAbstractFileByPath(initial.mapPath);
            if (af instanceof TFile) initialFile = af;
        }
        if (!initialFile) {
            initialFile = this.app.workspace.getActiveFile() ?? null;
        }

        this._controller = await mountCartographer(this.app as App, container, initialFile);
        await this._controller.setMode("editor");
    }

    async onClose() {
        await this._controller?.destroy();
        this._controller = null;
    }

    // ---- View State (serialisierbar) ----
    getState(): EditorState {
        return this._state;
    }

    async setState(state: EditorState): Promise<void> {
        this._state = state ?? {};
        // Wenn die UI schon steht, direkt Karte laden
        if (this._controller && this._state.mapPath) {
            const af = this.app.vault.getAbstractFileByPath(this._state.mapPath);
            if (af instanceof TFile) await this._controller.setFile(af);
            await this._controller.setMode("editor");
        }
    }
}
