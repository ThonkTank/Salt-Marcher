import type { LayoutElement, LayoutElementDefinition, LayoutElementType } from "../types";
import type { InspectorCallbacks } from "../inspector-panel";

export interface ElementPreviewDependencies {
    host: HTMLElement;
    element: LayoutElement;
    elements: LayoutElement[];
    finalize(element: LayoutElement): void;
    ensureContainerDefaults(element: LayoutElement): void;
    applyContainerLayout(element: LayoutElement, options?: { silent?: boolean }): void;
    pushHistory(): void;
    createElement(type: LayoutElementType, options?: { parentId?: string | null }): void;
}

export interface ElementPreviewContext extends ElementPreviewDependencies {
    preview: HTMLElement;
    container: HTMLElement;
    registerPreviewCleanup(cleanup: () => void): void;
}

export interface ElementInspectorSections {
    header: HTMLElement;
    body: HTMLElement;
}

export interface ElementInspectorContext {
    element: LayoutElement;
    callbacks: InspectorCallbacks;
    sections: ElementInspectorSections;
    renderLabelField(options?: { label?: string; host?: HTMLElement }): HTMLElement;
    renderPlaceholderField(options?: { label?: string; host?: HTMLElement }): HTMLElement;
    renderOptionsEditor(options?: { host?: HTMLElement }): HTMLElement;
    renderContainerLayoutControls(options?: { host?: HTMLElement }): HTMLElement;
}

export interface LayoutElementComponent {
    definition: LayoutElementDefinition;
    renderPreview(context: ElementPreviewContext): void;
    renderInspector?(context: ElementInspectorContext): void;
    ensureDefaults?(element: LayoutElement): void;
}

export type LayoutElementComponentModule = {
    default: LayoutElementComponent;
};

export type LayoutElementComponentFactory = () => LayoutElementComponent;
