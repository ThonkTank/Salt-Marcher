// plugins/layout-editor/src/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
import { LayoutEditorView, VIEW_LAYOUT_EDITOR } from "./view";
import {
    DEFAULT_ELEMENT_DEFINITIONS,
    getElementDefinitions,
    onLayoutElementDefinitionsChanged,
    registerLayoutElementDefinition as registerElementDefinition,
    resetLayoutElementDefinitions,
    unregisterLayoutElementDefinition as unregisterElementDefinition,
} from "./definitions";
import { listSavedLayouts, loadSavedLayout, saveLayoutToLibrary } from "./layout-library";
import type {
    LayoutBlueprint,
    LayoutElementDefinition,
    LayoutElementType,
    SavedLayout,
} from "./types";
import { LAYOUT_EDITOR_CSS } from "./css";

export interface LayoutEditorPluginApi {
    viewType: string;
    openView(): Promise<void>;
    registerElementDefinition(definition: LayoutElementDefinition): void;
    unregisterElementDefinition(type: LayoutElementType): void;
    resetElementDefinitions(definitions?: LayoutElementDefinition[]): void;
    getElementDefinitions(): LayoutElementDefinition[];
    onDefinitionsChanged(listener: (definitions: LayoutElementDefinition[]) => void): () => void;
    saveLayout(payload: LayoutBlueprint & { name: string; id?: string }): Promise<SavedLayout>;
    listLayouts(): Promise<SavedLayout[]>;
    loadLayout(id: string): Promise<SavedLayout | null>;
}

export default class LayoutEditorPlugin extends Plugin {
    private api!: LayoutEditorPluginApi;

    async onload() {
        resetLayoutElementDefinitions(DEFAULT_ELEMENT_DEFINITIONS);

        this.registerView(VIEW_LAYOUT_EDITOR, (leaf: WorkspaceLeaf) => new LayoutEditorView(leaf));

        this.addRibbonIcon("layout-grid", "Layout Editor öffnen", () => {
            void this.openView();
        });

        this.addCommand({
            id: "open-layout-editor",
            name: "Layout Editor öffnen",
            callback: () => this.openView(),
        });

        this.injectCss();

        this.api = {
            viewType: VIEW_LAYOUT_EDITOR,
            openView: () => this.openView(),
            registerElementDefinition,
            unregisterElementDefinition,
            resetElementDefinitions: definitions => {
                if (definitions && definitions.length) {
                    resetLayoutElementDefinitions(definitions);
                } else {
                    resetLayoutElementDefinitions(DEFAULT_ELEMENT_DEFINITIONS);
                }
            },
            getElementDefinitions,
            onDefinitionsChanged: listener => onLayoutElementDefinitionsChanged(listener),
            saveLayout: payload => saveLayoutToLibrary(this.app, payload),
            listLayouts: () => listSavedLayouts(this.app),
            loadLayout: id => loadSavedLayout(this.app, id),
        };
    }

    onunload() {
        resetLayoutElementDefinitions(DEFAULT_ELEMENT_DEFINITIONS);
        this.removeCss();
    }

    getApi(): LayoutEditorPluginApi {
        return this.api;
    }

    private async openView(): Promise<void> {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_LAYOUT_EDITOR, active: true });
        this.app.workspace.revealLeaf(leaf);
    }

    private injectCss() {
        const style = document.createElement("style");
        style.id = "layout-editor-css";
        style.textContent = LAYOUT_EDITOR_CSS;
        document.head.appendChild(style);
        this.register(() => style.remove());
    }

    private removeCss() {
        document.getElementById("layout-editor-css")?.remove();
    }
}
