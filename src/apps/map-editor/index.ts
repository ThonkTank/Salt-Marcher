// src/apps/map-editor/index.ts
import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { mountMapEditor } from "./editor-ui";

export const VIEW_TYPE_MAP_EDITOR = "map-editor-view" as const;

type EditorState = { mapPath?: string };

// Rückgabeschnittstelle aus editor-ui.ts
type EditorController = {
    setFile: (f?: TFile) => Promise<void>;
    setTool: (t: "brush" | "inspektor") => void;
};

export class MapEditorView extends ItemView {
    private _state: EditorState = {};
    private _controller: EditorController | null = null;

    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return VIEW_TYPE_MAP_EDITOR; }
    getDisplayText() { return "Map Editor"; }

    async onOpen() {
        const container = this.contentEl as HTMLElement;
        container.empty();
        container.addClass("hex-map-editor-root");

        // Leaf-ViewState aus Obsidian ziehen (kommt oft NACH onOpen)
        const vs = this.leaf.getViewState();
        const initial = (vs?.state as EditorState) ?? this._state;

        // UI mounten und Controller merken
        this._controller = mountMapEditor(this.app, container, initial);

        // Falls _state vorher gesetzt wurde und sich unterscheidet → anwenden
        if (this._state?.mapPath && this._state.mapPath !== initial.mapPath) {
            const af = this.app.vault.getAbstractFileByPath(this._state.mapPath);
            if (af instanceof TFile) await this._controller.setFile(af);
        }
    }

    onClose() {
        // optional: cleanup/teardown hier, falls editor-ui eine Unmount-API bekommt
        this._controller = null;
    }

    // ---- View State (serialisierbar) ----
    getState(): EditorState {
        return this._state;
    }

    async setState(state: EditorState): Promise<void> {
        this._state = state ?? {};
        // Wenn die UI schon steht, direkt Karte laden
        if (this._controller?.setFile && this._state.mapPath) {
            const af = this.app.vault.getAbstractFileByPath(this._state.mapPath);
            if (af instanceof TFile) await this._controller.setFile(af);
        }
    }
}
