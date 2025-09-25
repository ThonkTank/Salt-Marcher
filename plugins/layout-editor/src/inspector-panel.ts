// src/plugins/layout-editor/inspector-panel.ts
import {
    getAttributeSummary,
    getElementTypeLabel,
    isContainerType,
    isVerticalContainer,
    MIN_ELEMENT_SIZE,
} from "./definitions";
import { getLayoutElementComponent } from "./elements/registry";
import type { ElementInspectorContext } from "./elements/base";
import { LayoutContainerAlign, LayoutElement, LayoutElementDefinition, LayoutElementType } from "./types";
import { collectAncestorIds, collectDescendantIds, isContainerElement } from "./utils";
import { openEditorMenu } from "./ui/editor-menu";
import {
    createElementsButton,
    createElementsField,
    createElementsHeading,
    createElementsInput,
    createElementsMeta,
    createElementsSelect,
    ensureFieldLabelFor,
} from "./elements/ui";

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

export function renderInspectorPanel(deps: InspectorDependencies) {
    const { host, element } = deps;
    host.empty();
    const heading = createElementsHeading(host, 3, "Eigenschaften");
    heading.addClass("sm-le-panel__heading");

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

    const component = getLayoutElementComponent(element.type);
    const customHeader = host.createDiv({ cls: "sm-le-section sm-le-section--custom-header" });

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
        const containerField = createElementsField(host, { label: "Container" });
        containerField.fieldEl.addClass("sm-le-field");
        const options = [
            { value: "", label: "Kein Container" },
            ...containers
                .filter(container => !blockedContainers.has(container.id))
                .map(container => ({
                    value: container.id,
                    label: container.label || getElementTypeLabel(container.type),
                })),
        ];
        const parentSelect = createElementsSelect(containerField.controlEl, {
            options,
            value: element.parentId ?? "",
        });
        ensureFieldLabelFor(containerField, parentSelect);
        parentSelect.onchange = () => {
            const value = parentSelect.value || null;
            callbacks.assignElementToContainer(element.id, value);
        };
    }

    const attributesField = createElementsField(host, { label: "Attribute" });
    attributesField.fieldEl.addClass("sm-le-field");
    const attributesChip = attributesField.controlEl.createDiv({ cls: "sm-le-attr" });
    attributesChip.setText(getAttributeSummary(element.attributes));

    const actions = host.createDiv({ cls: "sm-le-actions" });
    const deleteBtn = createElementsButton(actions, { label: "Element löschen", variant: "warning" });
    deleteBtn.classList.add("mod-warning");
    deleteBtn.onclick = () => callbacks.deleteElement(element.id);

    const sizeField = createElementsField(host, { label: "Größe (px)", layout: "inline" });
    sizeField.fieldEl.addClass("sm-le-field");
    const widthInput = createElementsInput(sizeField.controlEl, {
        type: "number",
        min: MIN_ELEMENT_SIZE,
        value: String(Math.round(element.width)),
    });
    ensureFieldLabelFor(sizeField, widthInput);
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
    sizeField.controlEl.createSpan({ cls: "sm-elements-inline-text", text: "×" });
    const heightInput = createElementsInput(sizeField.controlEl, {
        type: "number",
        min: MIN_ELEMENT_SIZE,
        value: String(Math.round(element.height)),
    });
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

    const positionField = createElementsField(host, { label: "Position (px)", layout: "inline" });
    positionField.fieldEl.addClass("sm-le-field");
    const posXInput = createElementsInput(positionField.controlEl, {
        type: "number",
        min: 0,
        value: String(Math.round(element.x)),
    });
    ensureFieldLabelFor(positionField, posXInput);
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
    positionField.controlEl.createSpan({ cls: "sm-elements-inline-text", text: "," });
    const posYInput = createElementsInput(positionField.controlEl, {
        type: "number",
        min: 0,
        value: String(Math.round(element.y)),
    });
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

    const customBody = host.createDiv({ cls: "sm-le-section sm-le-section--custom-body" });

    const sections = { header: customHeader, body: customBody };
    const inspectorContext: ElementInspectorContext = {
        element,
        callbacks,
        sections,
        renderLabelField: ({ label, host: target } = {}) =>
            renderLabelField({
                host: target ?? sections.header,
                element,
                callbacks,
                label: label ?? "Bezeichnung",
            }),
        renderPlaceholderField: ({ label, host: target } = {}) =>
            renderPlaceholderField({
                host: target ?? sections.body,
                element,
                callbacks,
                label: label ?? "Platzhalter",
            }),
        renderOptionsEditor: ({ host: target } = {}) =>
            renderOptionsEditor({ host: target ?? sections.body, element, callbacks }),
        renderContainerLayoutControls: ({ host: target } = {}) =>
            renderContainerLayoutControls({ host: target ?? sections.body, element, callbacks }),
    };

    component?.renderInspector?.(inspectorContext);

    const meta = createElementsMeta(host, `Fläche: ${Math.round(element.width * element.height)} px²`);
    meta.addClass("sm-le-meta");

    if (isContainer) {
        renderContainerInspectorSections({ element, host, elements, callbacks, definitions });
    } else {
        renderAttributeSelector({ element, attributesChip });
    }
}

type ContainerInspectorOptions = {
    element: LayoutElement;
    host: HTMLElement;
    elements: LayoutElement[];
    callbacks: InspectorCallbacks;
    definitions: LayoutElementDefinition[];
};

function renderContainerInspectorSections(options: ContainerInspectorOptions) {
    const { element, host, elements, callbacks, definitions } = options;
    const quickAddField = createElementsField(host, { label: "Neues Element erstellen", layout: "stack" });
    quickAddField.fieldEl.addClass("sm-le-field");
    const quickAddBtn = createElementsButton(quickAddField.controlEl, { label: "Element hinzufügen" });
    quickAddBtn.classList.add("sm-le-inline-add", "sm-le-inline-add--menu");
    quickAddBtn.onclick = ev => {
        ev.preventDefault();
        const standardDefs = definitions.filter(def => !isContainerType(def.type));
        const containerDefs = definitions.filter(def => isContainerType(def.type));
        const entries = [
            ...standardDefs.map(def => ({
                type: "item" as const,
                label: def.buttonLabel,
                onSelect: () => callbacks.createElement(def.type, { parentId: element.id }),
            })),
            ...(standardDefs.length && containerDefs.length ? ([{ type: "separator" as const }] as const) : []),
            ...containerDefs.map(def => ({
                type: "item" as const,
                label: def.buttonLabel,
                onSelect: () => callbacks.createElement(def.type, { parentId: element.id }),
            })),
        ];
        openEditorMenu({ anchor: quickAddBtn, entries, event: ev });
    };

    const childField = createElementsField(host, { label: "Zugeordnete Elemente", layout: "stack" });
    childField.fieldEl.addClass("sm-le-field");
    const addRow = childField.controlEl.createDiv({ cls: "sm-le-container-add" });
    const addSelect = createElementsSelect(addRow, {
        options: [{ value: "", label: "Element auswählen…" }],
        value: "",
    });
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
        const option = document.createElement("option");
        option.value = candidate.id;
        option.text = optionText;
        addSelect.add(option);
    }
    const addButton = createElementsButton(addRow, { label: "Hinzufügen" });
    addButton.onclick = ev => {
        ev.preventDefault();
        const target = addSelect.value;
        if (target) {
            callbacks.assignElementToContainer(target, element.id);
        }
    };

    const childList = childField.controlEl.createDiv({ cls: "sm-le-container-children" });
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
            const upBtn = createElementsButton(controls, { label: "↑" });
            upBtn.setAttr("title", "Nach oben");
            upBtn.disabled = idx === 0;
            upBtn.onclick = ev => {
                ev.preventDefault();
                callbacks.moveChildInContainer(element, child.id, -1);
            };
            const downBtn = createElementsButton(controls, { label: "↓" });
            downBtn.setAttr("title", "Nach unten");
            downBtn.disabled = idx === children.length - 1;
            downBtn.onclick = ev => {
                ev.preventDefault();
                callbacks.moveChildInContainer(element, child.id, 1);
            };
            const removeBtn = createElementsButton(controls, { label: "✕" });
            removeBtn.setAttr("title", "Entfernen");
            removeBtn.onclick = ev => {
                ev.preventDefault();
                callbacks.assignElementToContainer(child.id, null);
            };
        }
    }
}

type AttributeSelectorOptions = { element: LayoutElement; attributesChip: HTMLElement };

function renderAttributeSelector(options: AttributeSelectorOptions) {
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

type PlaceholderFieldOptions = {
    host: HTMLElement;
    element: LayoutElement;
    callbacks: InspectorCallbacks;
    label: string;
};

function renderPlaceholderField(options: PlaceholderFieldOptions) {
    const { host, element, callbacks, label } = options;
    const field = createElementsField(host, { label });
    field.fieldEl.addClass("sm-le-field");
    const input = createElementsInput(field.controlEl, {});
    ensureFieldLabelFor(field, input);
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
    return field.fieldEl;
}

type LabelFieldOptions = {
    host: HTMLElement;
    element: LayoutElement;
    callbacks: InspectorCallbacks;
    label: string;
};

function renderLabelField(options: LabelFieldOptions) {
    const { host, element, callbacks, label } = options;
    const field = createElementsField(host, { label });
    field.fieldEl.addClass("sm-le-field");
    const input = createElementsInput(field.controlEl, {});
    ensureFieldLabelFor(field, input);
    input.value = element.label ?? "";
    const commit = () => {
        const next = input.value ?? "";
        if (next === element.label) return;
        element.label = next;
        finalizeElementChange(element, callbacks, { rerender: true });
    };
    input.onchange = commit;
    input.onblur = commit;
    return field.fieldEl;
}

type OptionsEditorOptions = { host: HTMLElement; element: LayoutElement; callbacks: InspectorCallbacks };

function renderOptionsEditor(options: OptionsEditorOptions) {
    const { host, element, callbacks } = options;
    const field = createElementsField(host, { label: "Optionen", layout: "stack" });
    field.fieldEl.addClass("sm-le-field");
    const optionList = field.controlEl.createDiv({ cls: "sm-le-inline-options" });
    const optionValues = element.options ?? [];
    if (!optionValues.length) {
        optionList.createDiv({ cls: "sm-le-inline-options__empty", text: "Noch keine Optionen." });
    } else {
        optionValues.forEach((opt, index) => {
            const row = optionList.createDiv({ cls: "sm-le-inline-option" });
            const input = createElementsInput(row, { value: opt });
            input.addClass("sm-le-inline-option__input");
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
            const remove = createElementsButton(row, { label: "✕" });
            remove.classList.add("sm-le-inline-option__remove");
            remove.setAttr("title", "Option entfernen");
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
    const addButton = createElementsButton(field.controlEl, { label: "Option hinzufügen" });
    addButton.classList.add("sm-le-inline-add");
    addButton.onclick = ev => {
        ev.preventDefault();
        const nextOptions = [...(element.options ?? [])];
        const labelText = `Option ${nextOptions.length + 1}`;
        nextOptions.push(labelText);
        element.options = nextOptions;
        finalizeElementChange(element, callbacks, { rerender: true });
    };
    return field.fieldEl;
}

type ContainerLayoutOptions = { host: HTMLElement; element: LayoutElement; callbacks: InspectorCallbacks };

function renderContainerLayoutControls(options: ContainerLayoutOptions) {
    const { host, element, callbacks } = options;
    if (!element.layout) return host;
    const field = createElementsField(host, { label: "Layout", layout: "stack" });
    field.fieldEl.addClass("sm-le-field");
    const controls = field.controlEl.createDiv({ cls: "sm-le-preview__layout" });
    const layout = element.layout;

    const gapWrap = controls.createDiv({ cls: "sm-le-inline-control" });
    gapWrap.createSpan({ text: "Abstand" });
    const gapInput = createElementsInput(gapWrap, { type: "number", min: 0 });
    gapInput.addClass("sm-le-inline-number");
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
    const paddingInput = createElementsInput(paddingWrap, { type: "number", min: 0 });
    paddingInput.addClass("sm-le-inline-number");
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
    const alignSelect = createElementsSelect(alignWrap, {
        options: alignOptions.map(([value, labelText]) => ({ value, label: labelText })),
        value: layout.align,
    });
    alignSelect.addClass("sm-le-inline-select");
    alignSelect.onchange = () => {
        const next = (alignSelect.value as LayoutContainerAlign) ?? layout.align;
        if (next === layout.align) return;
        layout.align = next;
        callbacks.applyContainerLayout(element, { silent: true });
        finalizeElementChange(element, callbacks);
    };

    return field;
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
