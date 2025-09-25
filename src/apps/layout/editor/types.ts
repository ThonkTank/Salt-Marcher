// src/apps/layout/editor/types.ts
import type { Setting } from "obsidian";

export type LayoutElementType =
    | "label"
    | "text-input"
    | "textarea"
    | "box-container"
    | "separator"
    | "dropdown"
    | "search-dropdown"
    | "vbox-container"
    | "hbox-container";

export type LayoutContainerType = "box-container" | "vbox-container" | "hbox-container";

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

export interface CreateSettingOptions {
    host: HTMLElement;
    withDescription?: boolean;
    prepare?: (setting: Setting) => void;
}
