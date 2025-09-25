// src/plugins/layout-editor/types.ts
export type LayoutElementType = string;

export type LayoutContainerType = LayoutElementType;

export type LayoutContainerAlign = "start" | "center" | "end" | "stretch";

export interface LayoutContainerConfig {
    gap: number;
    padding: number;
    align: LayoutContainerAlign;
}

export interface LayoutElement {
    id: string;
    type: LayoutElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    options?: string[];
    attributes: string[];
    parentId?: string;
    layout?: LayoutContainerConfig;
    children?: string[];
    viewBindingId?: string;
    viewState?: Record<string, unknown>;
}

export interface LayoutEditorSnapshot {
    canvasWidth: number;
    canvasHeight: number;
    selectedElementId: string | null;
    elements: LayoutElement[];
}

export interface InlineEditOptions {
    parent: HTMLElement;
    value?: string;
    placeholder: string;
    onCommit: (value: string) => void;
    onInput?: (value: string) => void;
    multiline?: boolean;
    block?: boolean;
    trim?: boolean;
}

export interface LayoutElementDefinition {
    type: LayoutElementType;
    buttonLabel: string;
    defaultLabel: string;
    category?: "element" | "container";
    layoutOrientation?: "vertical" | "horizontal";
    paletteGroup?: "element" | "input" | "container";
    defaultPlaceholder?: string;
    defaultValue?: string;
    defaultDescription?: string;
    options?: string[];
    width: number;
    height: number;
    defaultLayout?: LayoutContainerConfig;
}

export interface AttributeGroup {
    label: string;
    options: Array<{ value: string; label: string }>;
}

export interface AttributePopoverState {
    elementId: string;
    container: HTMLElement;
    anchor: HTMLElement;
    dispose: () => void;
}

export interface LayoutBlueprint {
    canvasWidth: number;
    canvasHeight: number;
    elements: LayoutElement[];
}

export interface SavedLayout extends LayoutBlueprint {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

