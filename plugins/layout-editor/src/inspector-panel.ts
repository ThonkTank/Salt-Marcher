// src/plugins/layout-editor/inspector-panel.ts
import { Menu } from "obsidian";
import {
    getAttributeSummary,
    getElementTypeLabel,
    isContainerType,
    isVerticalContainer,
    MIN_ELEMENT_SIZE,
} from "./definitions";
import { LayoutContainerAlign, LayoutElement, LayoutElementDefinition, LayoutElementType } from "./types";
import { collectAncestorIds, collectDescendantIds, isContainerElement } from "./utils";

export interface InspectorCallbacks {
    ensureContainerDefaults(element: LayoutElement): void;
    assignElementToContainer(elementId: string, containerId: string | null): void;
    syncElementElement(element: LayoutElement): void;
    refreshExport(): void;
    updateStatus(): void;
    pushHistory(): void;
    renderInspector(): void;
    applyContainerLayout(element: LayoutElement, options?: { silent?: boolean }): void;
    createElement(type: LayoutElementType, options?: { parentId?: string | null }): void;
    moveChildInContainer(container: LayoutElement, childId: string, offset: number): void;
    deleteElement(id: string): void;
}

export interface InspectorDependencies {
    host: HTMLElement;
    element: LayoutElement | null;
    elements: LayoutElement[];
    definitions: LayoutElementDefinition[];
    canvasWidth: number;
    canvasHeight: number;
    callbacks: InspectorCallbacks;
}

const LABEL_INSPECTOR_TYPES = new Set<LayoutElementType>([
    "textarea",
    "dropdown",
    "search-dropdown",
    "separator",
    "box-container",
    "vbox-container",
    "hbox-container",
]);

export function renderInspectorPanel(deps: InspectorDependencies) {
    const { host, element } = deps;
    host.empty();
    host.createEl("h3", { text: "Eigenschaften" });

    if (!element) {
        host.createDiv({ cls: "sm-le-empty", text: "Wähle ein Element, um Details anzupassen." });
        return;
    }

    const callbacks = deps.callbacks;
    const { elements, canvasWidth, canvasHeight, definitions } = deps;
    const isContainer = isContainerType(element.type);
    if (isContainer) {
        callbacks.ensureContainerDefaults(element);
    }
    const parentContainer = element.parentId ? elements.find(el => el.id === element.parentId) : null;

    host.createDiv({ cls: "sm-le-meta", text: `Typ: ${getElementTypeLabel(element.type)}` });

    host.createDiv({
        cls: "sm-le-hint",
        text: "Benennungen und Eigenschaften pflegst du hier im Inspector. Reine Textblöcke bearbeitest du direkt im Arbeitsbereich.",
    });

    if (LABEL_INSPECTOR_TYPES.has(element.type)) {
        const labelText = element.type === "separator" ? "Titel" : "Bezeichnung";
        renderLabelField({ host, element, callbacks, label: labelText });
    }

    const containers = elements.filter(el => isContainerType(el.type));
    if (containers.length) {
        const blockedContainers = new Set<string>();
        if (isContainerElement(element)) {
            const descendants = collectDescendantIds(element, elements);
            for (const id of descendants) blockedContainers.add(id);
            const ancestors = collectAncestorIds(element, elements);
            for (const id of ancestors) blockedContainers.add(id);
            blockedContainers.add(element.id);
        }
        const containerField = host.createDiv({ cls: "sm-le-field" });
        containerField.createEl("label", { text: "Container" });
        const parentSelect = containerField.createEl("select") as HTMLSelectElement;
        parentSelect.createEl("option", { value: "", text: "Kein Container" });
        for (const container of containers) {
            if (blockedContainers.has(container.id)) continue;
            const label = container.label || getElementTypeLabel(container.type);
            const option = parentSelect.createEl("option", { value: container.id, text: label });
            if (element.parentId === container.id) option.selected = true;
        }
        parentSelect.onchange = () => {
            const value = parentSelect.value || null;
            callbacks.assignElementToContainer(element.id, value);
        };
    }

    const attributesField = host.createDiv({ cls: "sm-le-field" });
    attributesField.createEl("label", { text: "Attribute" });
    const attributesChip = attributesField.createDiv({ cls: "sm-le-attr" });
    attributesChip.setText(getAttributeSummary(element.attributes));

    const actions = host.createDiv({ cls: "sm-le-actions" });
    const deleteBtn = actions.createEl("button", { text: "Element löschen" });
    deleteBtn.classList.add("mod-warning");
    deleteBtn.onclick = () => callbacks.deleteElement(element.id);

    const dimsField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
    dimsField.createEl("label", { text: "Breite (px)" });
    const widthInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_ELEMENT_SIZE) } }) as HTMLInputElement;
    widthInput.value = String(Math.round(element.width));
    widthInput.onchange = () => {
        const maxWidth = Math.max(MIN_ELEMENT_SIZE, canvasWidth - element.x);
        const next = clampNumber(parseInt(widthInput.value, 10) || element.width, MIN_ELEMENT_SIZE, maxWidth);
        element.width = next;
        widthInput.value = String(next);
        callbacks.syncElementElement(element);
        callbacks.refreshExport();
        if (isContainer) {
            callbacks.applyContainerLayout(element);
            if (parentContainer && isContainerType(parentContainer.type)) {
                callbacks.applyContainerLayout(parentContainer);
            }
        } else if (parentContainer && isContainerType(parentContainer.type)) {
            callbacks.applyContainerLayout(parentContainer);
        }
    };
    dimsField.createEl("label", { text: "Höhe (px)" });
    const heightInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_ELEMENT_SIZE) } }) as HTMLInputElement;
    heightInput.value = String(Math.round(element.height));
    heightInput.onchange = () => {
        const maxHeight = Math.max(MIN_ELEMENT_SIZE, canvasHeight - element.y);
        const next = clampNumber(parseInt(heightInput.value, 10) || element.height, MIN_ELEMENT_SIZE, maxHeight);
        element.height = next;
        heightInput.value = String(next);
        callbacks.syncElementElement(element);
        callbacks.refreshExport();
        if (isContainer) {
            callbacks.applyContainerLayout(element);
            if (parentContainer && isContainerType(parentContainer.type)) {
                callbacks.applyContainerLayout(parentContainer);
            }
        } else if (parentContainer && isContainerType(parentContainer.type)) {
            callbacks.applyContainerLayout(parentContainer);
        }
    };

    const posField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
    posField.createEl("label", { text: "X-Position" });
    const posXInput = posField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
    posXInput.value = String(Math.round(element.x));
    posXInput.onchange = () => {
        const maxX = Math.max(0, canvasWidth - element.width);
        const next = clampNumber(parseInt(posXInput.value, 10) || element.x, 0, maxX);
        element.x = next;
        posXInput.value = String(next);
        callbacks.syncElementElement(element);
        callbacks.refreshExport();
        if (isContainer) {
            callbacks.applyContainerLayout(element);
            if (parentContainer && isContainerType(parentContainer.type)) {
                callbacks.applyContainerLayout(parentContainer);
            }
        } else if (parentContainer && isContainerType(parentContainer.type)) {
            callbacks.applyContainerLayout(parentContainer);
        }
    };
    posField.createEl("label", { text: "Y-Position" });
    const posYInput = posField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
    posYInput.value = String(Math.round(element.y));
    posYInput.onchange = () => {
        const maxY = Math.max(0, canvasHeight - element.height);
        const next = clampNumber(parseInt(posYInput.value, 10) || element.y, 0, maxY);
        element.y = next;
        posYInput.value = String(next);
        callbacks.syncElementElement(element);
        callbacks.refreshExport();
        if (isContainer) {
            callbacks.applyContainerLayout(element);
            if (parentContainer && isContainerType(parentContainer.type)) {
                callbacks.applyContainerLayout(parentContainer);
            }
        } else if (parentContainer && isContainerType(parentContainer.type)) {
            callbacks.applyContainerLayout(parentContainer);
        }
    };

    renderElementProperties({ host, element, callbacks });

    const meta = host.createDiv({ cls: "sm-le-meta" });
    meta.setText(`Fläche: ${Math.round(element.width * element.height)} px²`);

    if (isContainer) {
        renderContainerInspectorSections({ element, host, elements, callbacks, definitions });
    } else {
        renderAttributeSelector({ element, attributesChip });
    }
}

function renderElementProperties(options: { host: HTMLElement; element: LayoutElement; callbacks: InspectorCallbacks }) {
    const { host, element, callbacks } = options;
    if (isContainerType(element.type)) {
        renderContainerLayoutControls({ host, element, callbacks });
        return;
    }
    if (element.type === "textarea") {
        renderPlaceholderField({ host, element, callbacks, label: "Platzhalter" });
    }
    if (element.type === "dropdown" || element.type === "search-dropdown") {
        renderPlaceholderField({ host, element, callbacks, label: "Platzhalter" });
        renderOptionsEditor({ host, element, callbacks });
    }
}

function renderContainerInspectorSections(options: {
    element: LayoutElement;
    host: HTMLElement;
    elements: LayoutElement[];
    callbacks: InspectorCallbacks;
    definitions: LayoutElementDefinition[];
}) {
    const { element, host, elements, callbacks, definitions } = options;
    const quickAddField = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
    quickAddField.createEl("label", { text: "Neues Element erstellen" });
    const quickAddBtn = quickAddField.createEl("button", { text: "Element hinzufügen" });
    quickAddBtn.classList.add("sm-le-inline-add", "sm-le-inline-add--menu");
    quickAddBtn.onclick = ev => {
        ev.preventDefault();
        const menu = new Menu();
        const standardDefs = definitions.filter(def => !isContainerType(def.type));
        const containerDefs = definitions.filter(def => isContainerType(def.type));
        for (const def of standardDefs) {
            menu.addItem(item => {
                item.setTitle(def.buttonLabel);
                item.onClick(() => callbacks.createElement(def.type, { parentId: element.id }));
            });
        }
        if (standardDefs.length && containerDefs.length) {
            menu.addSeparator();
        }
        for (const def of containerDefs) {
            menu.addItem(item => {
                item.setTitle(def.buttonLabel);
                item.onClick(() => callbacks.createElement(def.type, { parentId: element.id }));
            });
        }
        menu.showAtMouseEvent(ev);
    };

    const childField = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
    childField.createEl("label", { text: "Zugeordnete Elemente" });
    const addRow = childField.createDiv({ cls: "sm-le-container-add" });
    const addSelect = addRow.createEl("select") as HTMLSelectElement;
    addSelect.createEl("option", { value: "", text: "Element auswählen…" });
    const blockedIds = new Set<string>([element.id]);
    const descendants = collectDescendantIds(element, elements);
    for (const id of descendants) blockedIds.add(id);
    const ancestors = collectAncestorIds(element, elements);
    for (const id of ancestors) blockedIds.add(id);
    const candidates = elements.filter(el => !blockedIds.has(el.id));
    for (const candidate of candidates) {
        const textBase = candidate.label || getElementTypeLabel(candidate.type);
        let optionText = textBase;
        if (candidate.parentId && candidate.parentId !== element.id) {
            const parentElement = elements.find(el => el.id === candidate.parentId);
            if (parentElement) {
                const parentName = parentElement.label || getElementTypeLabel(parentElement.type);
                optionText = `${textBase} (in ${parentName})`;
            }
        }
        addSelect.createEl("option", { value: candidate.id, text: optionText });
    }
    const addButton = addRow.createEl("button", { text: "Hinzufügen" });
    addButton.onclick = ev => {
        ev.preventDefault();
        const target = addSelect.value;
        if (target) {
            callbacks.assignElementToContainer(target, element.id);
        }
    };

    const childList = childField.createDiv({ cls: "sm-le-container-children" });
    const children = Array.isArray(element.children)
        ? element.children
              .map(childId => elements.find(el => el.id === childId))
              .filter((child): child is LayoutElement => !!child)
        : [];
    if (!children.length) {
        childList.createDiv({ cls: "sm-le-empty", text: "Keine Elemente verknüpft." });
    } else {
        for (const [idx, child] of children.entries()) {
            const row = childList.createDiv({ cls: "sm-le-container-child" });
            row.createSpan({ cls: "sm-le-container-child__label", text: child.label || getElementTypeLabel(child.type) });
            const controls = row.createDiv({ cls: "sm-le-container-child__actions" });
            const upBtn = controls.createEl("button", { text: "↑", attr: { title: "Nach oben" } });
            upBtn.disabled = idx === 0;
            upBtn.onclick = ev => {
                ev.preventDefault();
                callbacks.moveChildInContainer(element, child.id, -1);
            };
            const downBtn = controls.createEl("button", { text: "↓", attr: { title: "Nach unten" } });
            downBtn.disabled = idx === children.length - 1;
            downBtn.onclick = ev => {
                ev.preventDefault();
                callbacks.moveChildInContainer(element, child.id, 1);
            };
            const removeBtn = controls.createEl("button", { text: "✕", attr: { title: "Entfernen" } });
            removeBtn.onclick = ev => {
                ev.preventDefault();
                callbacks.assignElementToContainer(child.id, null);
            };
        }
    }
}

function renderAttributeSelector(options: { element: LayoutElement; attributesChip: HTMLElement }) {
    const { element, attributesChip } = options;
    attributesChip.onclick = ev => {
        ev.preventDefault();
        const event = new CustomEvent("sm-layout-open-attributes", {
            detail: { elementId: element.id, anchor: attributesChip },
            bubbles: true,
        });
        attributesChip.dispatchEvent(event);
    };
}

function renderPlaceholderField(options: {
    host: HTMLElement;
    element: LayoutElement;
    callbacks: InspectorCallbacks;
    label: string;
}) {
    const { host, element, callbacks, label } = options;
    const field = host.createDiv({ cls: "sm-le-field" });
    field.createEl("label", { text: label });
    const input = field.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
    input.value = element.placeholder ?? "";
    const commit = () => {
        const raw = input.value;
        const next = raw ? raw : undefined;
        if (next === element.placeholder) return;
        element.placeholder = next;
        finalizeElementChange(element, callbacks);
    };
    input.onchange = commit;
    input.onblur = commit;
}

function renderLabelField(options: { host: HTMLElement; element: LayoutElement; callbacks: InspectorCallbacks; label: string }) {
    const { host, element, callbacks, label } = options;
    const field = host.createDiv({ cls: "sm-le-field" });
    field.createEl("label", { text: label });
    const input = field.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
    input.value = element.label ?? "";
    const commit = () => {
        const next = input.value ?? "";
        if (next === element.label) return;
        element.label = next;
        finalizeElementChange(element, callbacks, { rerender: true });
    };
    input.onchange = commit;
    input.onblur = commit;
}

function renderOptionsEditor(options: { host: HTMLElement; element: LayoutElement; callbacks: InspectorCallbacks }) {
    const { host, element, callbacks } = options;
    const field = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
    field.createEl("label", { text: "Optionen" });
    const optionList = field.createDiv({ cls: "sm-le-inline-options" });
    const optionValues = element.options ?? [];
    if (!optionValues.length) {
        optionList.createDiv({ cls: "sm-le-inline-options__empty", text: "Noch keine Optionen." });
    } else {
        optionValues.forEach((opt, index) => {
            const row = optionList.createDiv({ cls: "sm-le-inline-option" });
            const input = row.createEl("input", {
                attr: { type: "text" },
                cls: "sm-le-inline-option__input",
                value: opt,
            }) as HTMLInputElement;
            input.onchange = () => {
                const next = input.value || opt;
                if (next === opt) return;
                const nextOptions = [...(element.options ?? [])];
                nextOptions[index] = next;
                element.options = nextOptions;
                if (element.defaultValue && element.defaultValue === opt) {
                    element.defaultValue = next;
                }
                finalizeElementChange(element, callbacks, { rerender: true });
            };
            const remove = row.createEl("button", {
                text: "✕",
                cls: "sm-le-inline-option__remove",
                attr: { title: "Option entfernen" },
            });
            remove.onclick = ev => {
                ev.preventDefault();
                const nextOptions = (element.options ?? []).filter((_, idx) => idx !== index);
                element.options = nextOptions.length ? nextOptions : undefined;
                if (element.defaultValue && !nextOptions.includes(element.defaultValue)) {
                    element.defaultValue = undefined;
                }
                finalizeElementChange(element, callbacks, { rerender: true });
            };
        });
    }
    const addButton = field.createEl("button", { text: "Option hinzufügen" });
    addButton.classList.add("sm-le-inline-add");
    addButton.onclick = ev => {
        ev.preventDefault();
        const nextOptions = [...(element.options ?? [])];
        const labelText = `Option ${nextOptions.length + 1}`;
        nextOptions.push(labelText);
        element.options = nextOptions;
        finalizeElementChange(element, callbacks, { rerender: true });
    };
}

function renderContainerLayoutControls(options: { host: HTMLElement; element: LayoutElement; callbacks: InspectorCallbacks }) {
    const { host, element, callbacks } = options;
    if (!element.layout) return;
    const field = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
    field.createEl("label", { text: "Layout" });
    const controls = field.createDiv({ cls: "sm-le-preview__layout" });
    const layout = element.layout;

    const gapWrap = controls.createDiv({ cls: "sm-le-inline-control" });
    gapWrap.createSpan({ text: "Abstand" });
    const gapInput = gapWrap.createEl("input", { cls: "sm-le-inline-number", attr: { type: "number", min: "0" } }) as HTMLInputElement;
    gapInput.value = String(Math.round(layout.gap));
    gapInput.onchange = () => {
        const next = Math.max(0, parseInt(gapInput.value, 10) || 0);
        if (next === layout.gap) return;
        layout.gap = next;
        gapInput.value = String(next);
        callbacks.applyContainerLayout(element, { silent: true });
        finalizeElementChange(element, callbacks);
    };

    const paddingWrap = controls.createDiv({ cls: "sm-le-inline-control" });
    paddingWrap.createSpan({ text: "Innenabstand" });
    const paddingInput = paddingWrap.createEl("input", {
        cls: "sm-le-inline-number",
        attr: { type: "number", min: "0" },
    }) as HTMLInputElement;
    paddingInput.value = String(Math.round(layout.padding));
    paddingInput.onchange = () => {
        const next = Math.max(0, parseInt(paddingInput.value, 10) || 0);
        if (next === layout.padding) return;
        layout.padding = next;
        paddingInput.value = String(next);
        callbacks.applyContainerLayout(element, { silent: true });
        finalizeElementChange(element, callbacks);
    };

    const alignWrap = controls.createDiv({ cls: "sm-le-inline-control" });
    alignWrap.createSpan({ text: "Ausrichtung" });
    const alignSelect = alignWrap.createEl("select", { cls: "sm-le-inline-select" }) as HTMLSelectElement;
    const containerType = element.type;
    const alignOptions: Array<[LayoutContainerAlign, string]> = isVerticalContainer(containerType)
        ? [
              ["start", "Links"],
              ["center", "Zentriert"],
              ["end", "Rechts"],
              ["stretch", "Breite"],
          ]
        : [
              ["start", "Oben"],
              ["center", "Zentriert"],
              ["end", "Unten"],
              ["stretch", "Höhe"],
          ];
    for (const [value, labelText] of alignOptions) {
        const option = alignSelect.createEl("option", { value, text: labelText });
        if (layout.align === value) option.selected = true;
    }
    alignSelect.onchange = () => {
        const next = (alignSelect.value as LayoutContainerAlign) ?? layout.align;
        if (next === layout.align) return;
        layout.align = next;
        callbacks.applyContainerLayout(element, { silent: true });
        finalizeElementChange(element, callbacks);
    };
}

function finalizeElementChange(
    element: LayoutElement,
    callbacks: InspectorCallbacks,
    options?: { rerender?: boolean },
) {
    callbacks.syncElementElement(element);
    callbacks.refreshExport();
    callbacks.updateStatus();
    callbacks.pushHistory();
    if (options?.rerender) {
        callbacks.renderInspector();
    }
}

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
