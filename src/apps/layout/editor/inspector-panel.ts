// src/apps/layout/editor/inspector-panel.ts
import { Menu } from "obsidian";
import { getAttributeSummary, getElementTypeLabel, isContainerType, MIN_ELEMENT_SIZE } from "./definitions";
import { LayoutContainerAlign, LayoutElement, LayoutElementType } from "./types";

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
    canvasWidth: number;
    canvasHeight: number;
    callbacks: InspectorCallbacks;
}

export function renderInspectorPanel(deps: InspectorDependencies) {
    const { host, element } = deps;
    host.empty();
    host.createEl("h3", { text: "Eigenschaften" });

    if (!element) {
        host.createDiv({ cls: "sm-le-empty", text: "Wähle ein Element, um Details anzupassen." });
        return;
    }

    const callbacks = deps.callbacks;
    const { elements, canvasWidth, canvasHeight } = deps;
    const isContainer = isContainerType(element.type);
    if (isContainer) {
        callbacks.ensureContainerDefaults(element);
    }
    const parentContainer = !isContainer && element.parentId ? elements.find(el => el.id === element.parentId) : null;

    host.createDiv({ cls: "sm-le-meta", text: `Typ: ${getElementTypeLabel(element.type)}` });

    const labelField = host.createDiv({ cls: "sm-le-field" });
    labelField.createEl("label", { text: element.type === "label" ? "Text" : "Label" });
    const labelInput = labelField.createEl("textarea") as HTMLTextAreaElement;
    labelInput.value = element.label;
    labelInput.rows = element.type === "textarea" ? 3 : 2;
    const initialLabel = element.label;
    labelInput.oninput = () => {
        element.label = labelInput.value;
        callbacks.syncElementElement(element);
        callbacks.refreshExport();
    };
    labelInput.onblur = () => {
        if (element.label === initialLabel) return;
        callbacks.updateStatus();
        callbacks.pushHistory();
        callbacks.renderInspector();
    };

    if (!isContainer) {
        const containers = elements.filter(el => isContainerType(el.type));
        if (containers.length) {
            const containerField = host.createDiv({ cls: "sm-le-field" });
            containerField.createEl("label", { text: "Container" });
            const parentSelect = containerField.createEl("select") as HTMLSelectElement;
            parentSelect.createEl("option", { value: "", text: "Kein Container" });
            for (const container of containers) {
                const label = container.label || getElementTypeLabel(container.type);
                const option = parentSelect.createEl("option", { value: container.id, text: label });
                if (element.parentId === container.id) option.selected = true;
            }
            parentSelect.onchange = () => {
                const value = parentSelect.value || null;
                callbacks.assignElementToContainer(element.id, value);
            };
        }
    }

    if (element.type === "label" || element.type === "box") {
        const descField = host.createDiv({ cls: "sm-le-field" });
        descField.createEl("label", { text: element.type === "box" ? "Beschreibung" : "Zusatztext" });
        const descInput = descField.createEl("textarea") as HTMLTextAreaElement;
        descInput.value = element.description || "";
        descInput.rows = 3;
        const initialDesc = element.description ?? "";
        descInput.oninput = () => {
            element.description = descInput.value || undefined;
            callbacks.syncElementElement(element);
            callbacks.refreshExport();
        };
        descInput.onblur = () => {
            const current = element.description ?? "";
            if (current === initialDesc) return;
            callbacks.updateStatus();
            callbacks.pushHistory();
            callbacks.renderInspector();
        };
    }

    if (element.type === "text-input" || element.type === "textarea" || element.type === "dropdown" || element.type === "search-dropdown") {
        const placeholderField = host.createDiv({ cls: "sm-le-field" });
        placeholderField.createEl("label", { text: "Platzhalter" });
        const placeholderInput = placeholderField.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
        placeholderInput.value = element.placeholder || "";
        const initialPlaceholder = element.placeholder ?? "";
        placeholderInput.oninput = () => {
            element.placeholder = placeholderInput.value || undefined;
            callbacks.syncElementElement(element);
            callbacks.refreshExport();
        };
        placeholderInput.onblur = () => {
            const current = element.placeholder ?? "";
            if (current === initialPlaceholder) return;
            callbacks.updateStatus();
            callbacks.pushHistory();
            callbacks.renderInspector();
        };

        const defaultField = host.createDiv({ cls: "sm-le-field" });
        defaultField.createEl("label", { text: "Default-Wert" });
        if (element.type === "textarea") {
            const defaultTextarea = defaultField.createEl("textarea") as HTMLTextAreaElement;
            defaultTextarea.rows = 3;
            defaultTextarea.value = element.defaultValue || "";
            const initialDefault = element.defaultValue ?? "";
            defaultTextarea.oninput = () => {
                element.defaultValue = defaultTextarea.value || undefined;
                callbacks.syncElementElement(element);
                callbacks.refreshExport();
            };
            defaultTextarea.onblur = () => {
                const current = element.defaultValue ?? "";
                if (current === initialDefault) return;
                callbacks.updateStatus();
                callbacks.pushHistory();
                callbacks.renderInspector();
            };
        } else {
            const defaultInput = defaultField.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
            defaultInput.value = element.defaultValue || "";
            const initialDefault = element.defaultValue ?? "";
            defaultInput.oninput = () => {
                element.defaultValue = defaultInput.value || undefined;
                callbacks.syncElementElement(element);
                callbacks.refreshExport();
            };
            defaultInput.onblur = () => {
                const current = element.defaultValue ?? "";
                if (current === initialDefault) return;
                callbacks.updateStatus();
                callbacks.pushHistory();
                callbacks.renderInspector();
            };
        }
    }

    if (element.type === "dropdown" || element.type === "search-dropdown") {
        const optionsField = host.createDiv({ cls: "sm-le-field" });
        optionsField.createEl("label", { text: "Optionen (eine pro Zeile)" });
        const optionsInput = optionsField.createEl("textarea") as HTMLTextAreaElement;
        optionsInput.rows = 4;
        optionsInput.value = (element.options || []).join("\n");
        const initialOptionsValue = optionsInput.value;
        optionsInput.oninput = () => {
            const lines = optionsInput.value
                .split(/\r?\n/)
                .map(v => v.trim())
                .filter(Boolean);
            element.options = lines.length ? lines : undefined;
            callbacks.syncElementElement(element);
            callbacks.refreshExport();
        };
        optionsInput.onblur = () => {
            if (optionsInput.value === initialOptionsValue) return;
            callbacks.updateStatus();
            callbacks.pushHistory();
            callbacks.renderInspector();
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
        } else if (parentContainer && isContainerType(parentContainer.type)) {
            callbacks.applyContainerLayout(parentContainer);
        }
    };

    const meta = host.createDiv({ cls: "sm-le-meta" });
    meta.setText(`Fläche: ${Math.round(element.width * element.height)} px²`);

    if (isContainer) {
        renderContainerInspectorSections({ element, host, elements, callbacks });
    } else {
        renderAttributeSelector({ element, attributesChip });
    }
}

function renderContainerInspectorSections(options: {
    element: LayoutElement;
    host: HTMLElement;
    elements: LayoutElement[];
    callbacks: InspectorCallbacks;
}) {
    const { element, host, elements, callbacks } = options;
    const layoutField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
    layoutField.createEl("label", { text: "Abstand" });
    const gapInput = layoutField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
    gapInput.value = String(Math.round(element.layout!.gap));
    gapInput.onchange = () => {
        const next = Math.max(0, parseInt(gapInput.value, 10) || 0);
        if (next === element.layout!.gap) return;
        element.layout!.gap = next;
        gapInput.value = String(next);
        callbacks.applyContainerLayout(element);
        callbacks.pushHistory();
    };
    layoutField.createEl("label", { text: "Innenabstand" });
    const paddingInput = layoutField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
    paddingInput.value = String(Math.round(element.layout!.padding));
    paddingInput.onchange = () => {
        const next = Math.max(0, parseInt(paddingInput.value, 10) || 0);
        if (next === element.layout!.padding) return;
        element.layout!.padding = next;
        paddingInput.value = String(next);
        callbacks.applyContainerLayout(element);
        callbacks.pushHistory();
    };

    const alignField = host.createDiv({ cls: "sm-le-field" });
    alignField.createEl("label", { text: "Ausrichtung" });
    const alignSelect = alignField.createEl("select") as HTMLSelectElement;
    const alignOptions: Array<[LayoutContainerAlign, string]> =
        element.type === "vbox"
            ? [
                  ["start", "Links ausgerichtet"],
                  ["center", "Zentriert"],
                  ["end", "Rechts ausgerichtet"],
                  ["stretch", "Breite gestreckt"],
              ]
            : [
                  ["start", "Oben ausgerichtet"],
                  ["center", "Vertikal zentriert"],
                  ["end", "Unten ausgerichtet"],
                  ["stretch", "Höhe gestreckt"],
              ];
    for (const [value, label] of alignOptions) {
        const option = alignSelect.createEl("option", { value, text: label });
        if (element.layout!.align === value) option.selected = true;
    }
    alignSelect.onchange = () => {
        const next = (alignSelect.value as LayoutContainerAlign) ?? element.layout!.align;
        if (next === element.layout!.align) return;
        element.layout!.align = next;
        callbacks.applyContainerLayout(element);
        callbacks.pushHistory();
    };

    const quickAddField = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
    quickAddField.createEl("label", { text: "Neues Element erstellen" });
    const quickAddBtn = quickAddField.createEl("button", { text: "Element hinzufügen" });
    quickAddBtn.classList.add("sm-le-inline-add", "sm-le-inline-add--menu");
    quickAddBtn.onclick = ev => {
        ev.preventDefault();
        const menu = new Menu();
        for (const type of ["label", "text-input", "textarea", "box", "separator", "dropdown", "search-dropdown"] as LayoutElementType[]) {
            menu.addItem(item => {
                item.setTitle(getElementTypeLabel(type));
                item.onClick(() => callbacks.createElement(type, { parentId: element.id }));
            });
        }
        menu.showAtMouseEvent(ev);
    };

    const childField = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
    childField.createEl("label", { text: "Zugeordnete Elemente" });
    const addRow = childField.createDiv({ cls: "sm-le-container-add" });
    const addSelect = addRow.createEl("select") as HTMLSelectElement;
    addSelect.createEl("option", { value: "", text: "Element auswählen…" });
    const candidates = elements.filter(el => el.id !== element.id && !isContainerType(el.type));
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

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
