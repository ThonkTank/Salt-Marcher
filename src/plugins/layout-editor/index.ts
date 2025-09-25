// src/plugins/layout-editor/index.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
import { LayoutEditorView, VIEW_LAYOUT_EDITOR } from "./view";
import {
    getElementDefinitions,
    onLayoutElementDefinitionsChanged,
    registerLayoutElementDefinition,
    unregisterLayoutElementDefinition,
    resetLayoutElementDefinitions,
    DEFAULT_ELEMENT_DEFINITIONS,
} from "./definitions";
import { listSavedLayouts, loadSavedLayout, saveLayoutToLibrary } from "./layout-library";
import type {
    LayoutBlueprint,
    LayoutElementDefinition,
    LayoutElementType,
    SavedLayout,
} from "./types";

export interface LayoutEditorPluginApi {
    viewType: string;
    registerView: () => void;
    registerElementDefinition(definition: LayoutElementDefinition): void;
    unregisterElementDefinition(type: LayoutElementType): void;
    resetElementDefinitions(definitions?: LayoutElementDefinition[]): void;
    getElementDefinitions(): LayoutElementDefinition[];
    onDefinitionsChanged(listener: (definitions: LayoutElementDefinition[]) => void): () => void;
    saveLayout(payload: LayoutBlueprint & { name: string; id?: string }): Promise<SavedLayout>;
    listLayouts(): Promise<SavedLayout[]>;
    loadLayout(id: string): Promise<SavedLayout | null>;
}

export function createLayoutEditorPlugin(plugin: Plugin): LayoutEditorPluginApi {
    const registerView = () => {
        plugin.registerView(VIEW_LAYOUT_EDITOR, (leaf: WorkspaceLeaf) => new LayoutEditorView(leaf));
    };
    return {
        viewType: VIEW_LAYOUT_EDITOR,
        registerView,
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
        saveLayout: payload => saveLayoutToLibrary(plugin.app, payload),
        listLayouts: () => listSavedLayouts(plugin.app),
        loadLayout: id => loadSavedLayout(plugin.app, id),
    };
}

export { LayoutEditorView, VIEW_LAYOUT_EDITOR };
export * from "./types";
export { DEFAULT_ELEMENT_DEFINITIONS } from "./definitions";
export { listSavedLayouts, loadSavedLayout, saveLayoutToLibrary } from "./layout-library";
