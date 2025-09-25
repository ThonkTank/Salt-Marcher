// src/apps/layout/editor/view.ts
import { ItemView, Notice } from "obsidian";
import {
    ELEMENT_DEFINITION_LOOKUP,
    ELEMENT_DEFINITIONS,
    MIN_ELEMENT_SIZE,
    getAttributeSummary,
    getElementTypeLabel,
    isContainerType,
} from "./definitions";
import {
    LayoutContainerAlign,
    LayoutContainerType,
    LayoutEditorSnapshot,
    LayoutElement,
    LayoutElementType,
} from "./types";
import { LayoutHistory } from "./history";
import { AttributePopoverController } from "./attribute-popover";
import { renderElementPreview } from "./element-preview";
import { renderInspectorPanel } from "./inspector-panel";
import { clamp, cloneLayoutElement, isContainerElement } from "./utils";
import { importCreatureLayout } from "./creature-import";

export const VIEW_LAYOUT_EDITOR = "salt-layout-editor";

export class LayoutEditorView extends ItemView {
    private elements: LayoutElement[] = [];
    private selectedElementId: string | null = null;
    private canvasWidth = 800;
    private canvasHeight = 600;
    private isImporting = false;

    private canvasEl!: HTMLElement;
    private inspectorHost!: HTMLElement;
    private exportEl!: HTMLTextAreaElement;
    private importBtn!: HTMLButtonElement;
    private statusEl!: HTMLElement;
    private widthInput?: HTMLInputElement;
    private heightInput?: HTMLInputElement;
    private sandboxEl!: HTMLElement;

    private elementElements = new Map<string, HTMLElement>();

    private readonly history = new LayoutHistory(
        () => this.captureSnapshot(),
        snapshot => this.restoreSnapshot(snapshot),
    );

    private readonly attributePopover = new AttributePopoverController({
        getElementById: id => this.elements.find(el => el.id === id),
        syncElementElement: element => this.syncElementElement(element),
        refreshExport: () => this.refreshExport(),
        renderInspector: () => this.renderInspector(),
        updateStatus: () => this.updateStatus(),
        pushHistory: () => this.pushHistory(),
    });

    getViewType() { return VIEW_LAYOUT_EDITOR; }
    getDisplayText() { return "Layout Editor"; }
    getIcon() { return "layout-grid" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-layout-editor");
        this.render();
        this.refreshExport();
        this.updateStatus();
    }

    async onClose() {
        this.attributePopover.close();
        this.elementElements.clear();
        this.contentEl.empty();
        this.contentEl.removeClass("sm-layout-editor");
    }

    private onKeyDown = (ev: KeyboardEvent) => {
        if (this.isEditingTarget(ev.target)) {
            return;
        }
        const key = ev.key.toLowerCase();
        const isModifier = ev.metaKey || ev.ctrlKey;
        if (key === "delete") {
            if (this.selectedElementId) {
                ev.preventDefault();
                this.deleteElement(this.selectedElementId);
            }
            return;
        }
        if (!isModifier) return;
        if (key === "z") {
            ev.preventDefault();
            if (ev.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        }
    };

    private isEditingTarget(target: EventTarget | null): boolean {
        if (!target) return false;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
            return true;
        }
        if (target instanceof HTMLElement && target.isContentEditable) {
            return true;
        }
        return false;
    }

    private captureSnapshot(): LayoutEditorSnapshot {
        return {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            selectedElementId: this.selectedElementId,
            elements: this.elements.map(cloneLayoutElement),
        };
    }

    private restoreSnapshot(snapshot: LayoutEditorSnapshot) {
        this.canvasWidth = snapshot.canvasWidth;
        this.canvasHeight = snapshot.canvasHeight;
        this.selectedElementId = snapshot.selectedElementId;
        this.elements = snapshot.elements.map(cloneLayoutElement);
        if (this.widthInput) this.widthInput.value = String(this.canvasWidth);
        if (this.heightInput) this.heightInput.value = String(this.canvasHeight);
        this.attributePopover.close();
        this.applyCanvasSize();
        this.renderElements();
        this.renderInspector();
        this.refreshExport();
        this.updateStatus();
    }

    private pushHistory() {
        if (this.history.isRestoring) return;
        this.history.push();
    }

    private undo() {
        this.history.undo();
    }

    private redo() {
        this.history.redo();
    }

    private finalizeInlineMutation(element: LayoutElement) {
        if (this.history.isRestoring) return;
        this.syncElementElement(element);
        this.refreshExport();
        this.renderInspector();
        this.updateStatus();
        this.pushHistory();
    }

    private render() {
        const root = this.contentEl;
        root.empty();

        const header = root.createDiv({ cls: "sm-le-header" });
        header.createEl("h2", { text: "Layout Editor" });

        const controls = header.createDiv({ cls: "sm-le-controls" });

        const addGroup = controls.createDiv({ cls: "sm-le-control sm-le-control--stack" });
        addGroup.createEl("label", { text: "Element hinzufügen" });
        const addWrap = addGroup.createDiv({ cls: "sm-le-add" });
        for (const def of ELEMENT_DEFINITIONS) {
            const btn = addWrap.createEl("button", { text: def.buttonLabel });
            btn.onclick = () => this.createElement(def.type);
        }

        this.importBtn = controls.createEl("button", { text: "Creature-Layout importieren" });
        this.importBtn.onclick = () => { void this.importCreatureCreatorLayout(); };

        const sizeGroup = controls.createDiv({ cls: "sm-le-control" });
        sizeGroup.createEl("label", { text: "Arbeitsfläche" });
        const sizeWrapper = sizeGroup.createDiv({ cls: "sm-le-size" });
        this.widthInput = sizeWrapper.createEl("input", { attr: { type: "number", min: "200", max: "2000" } }) as HTMLInputElement;
        this.widthInput.value = String(this.canvasWidth);
        this.widthInput.onchange = () => {
            const next = clamp(parseInt(this.widthInput!.value, 10) || this.canvasWidth, 200, 2000);
            this.canvasWidth = next;
            this.widthInput!.value = String(next);
            this.applyCanvasSize();
            this.refreshExport();
            this.updateStatus();
            this.pushHistory();
        };
        sizeWrapper.createSpan({ text: "×" });
        this.heightInput = sizeWrapper.createEl("input", { attr: { type: "number", min: "200", max: "2000" } }) as HTMLInputElement;
        this.heightInput.value = String(this.canvasHeight);
        this.heightInput.onchange = () => {
            const next = clamp(parseInt(this.heightInput!.value, 10) || this.canvasHeight, 200, 2000);
            this.canvasHeight = next;
            this.heightInput!.value = String(next);
            this.applyCanvasSize();
            this.refreshExport();
            this.updateStatus();
            this.pushHistory();
        };
        sizeWrapper.createSpan({ text: "px" });

        this.statusEl = header.createDiv({ cls: "sm-le-status" });

        const body = root.createDiv({ cls: "sm-le-body" });
        const stage = body.createDiv({ cls: "sm-le-stage" });
        this.canvasEl = stage.createDiv({ cls: "sm-le-canvas" });
        this.canvasEl.style.width = `${this.canvasWidth}px`;
        this.canvasEl.style.height = `${this.canvasHeight}px`;
        this.registerDomEvent(this.canvasEl, "pointerdown", (ev: PointerEvent) => {
            if (ev.target === this.canvasEl) {
                this.selectElement(null);
            }
        });
        this.registerDomEvent(window, "keydown", this.onKeyDown);

        this.inspectorHost = body.createDiv({ cls: "sm-le-inspector" });
        this.registerDomEvent(this.inspectorHost, "sm-layout-open-attributes" as any, (ev: Event) => {
            const detail = (ev as CustomEvent<{ elementId: string; anchor: HTMLElement }>).detail;
            if (!detail) return;
            const element = this.elements.find(el => el.id === detail.elementId);
            if (element) {
                this.attributePopover.open(element, detail.anchor);
                this.attributePopover.position();
            }
        });

        const exportWrap = root.createDiv({ cls: "sm-le-export" });
        exportWrap.createEl("h3", { text: "Layout-Daten" });
        const exportControls = exportWrap.createDiv({ cls: "sm-le-export__controls" });
        const copyBtn = exportControls.createEl("button", { text: "JSON kopieren" });
        copyBtn.onclick = async () => {
            if (!this.exportEl.value) return;
            try {
                const clip = navigator.clipboard;
                if (!clip || typeof clip.writeText !== "function") {
                    throw new Error("Clipboard API nicht verfügbar");
                }
                await clip.writeText(this.exportEl.value);
                new Notice("Layout kopiert");
            } catch (error) {
                console.error("Clipboard write failed", error);
                new Notice("Konnte nicht in die Zwischenablage kopieren");
            }
        };
        this.exportEl = exportWrap.createEl("textarea", {
            cls: "sm-le-export__textarea",
            attr: { rows: "10", readonly: "readonly" },
        }) as HTMLTextAreaElement;

        this.sandboxEl = root.createDiv({ cls: "sm-le-sandbox" });
        this.sandboxEl.style.position = "absolute";
        this.sandboxEl.style.top = "-10000px";
        this.sandboxEl.style.left = "-10000px";
        this.sandboxEl.style.visibility = "hidden";
        this.sandboxEl.style.pointerEvents = "none";
        this.sandboxEl.style.width = "960px";
        this.sandboxEl.style.padding = "24px";
        this.sandboxEl.style.boxSizing = "border-box";

        this.renderElements();
        this.renderInspector();
        this.history.reset(this.captureSnapshot());
    }

    private applyCanvasSize() {
        if (!this.canvasEl) return;
        this.canvasEl.style.width = `${this.canvasWidth}px`;
        this.canvasEl.style.height = `${this.canvasHeight}px`;
        for (const element of this.elements) {
            const maxX = Math.max(0, this.canvasWidth - element.width);
            const maxY = Math.max(0, this.canvasHeight - element.height);
            element.x = clamp(element.x, 0, maxX);
            element.y = clamp(element.y, 0, maxY);
            const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
            const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
            element.width = clamp(element.width, MIN_ELEMENT_SIZE, maxWidth);
            element.height = clamp(element.height, MIN_ELEMENT_SIZE, maxHeight);
            this.syncElementElement(element);
        }
        for (const element of this.elements) {
            if (isContainerType(element.type)) {
                this.applyContainerLayout(element, { silent: true });
            }
        }
        this.attributePopover.refresh();
    }

    private createElement(type: LayoutElementType, options?: { parentId?: string | null }) {
        const def = ELEMENT_DEFINITION_LOOKUP.get(type);
        const width = def ? def.width : Math.min(240, Math.max(160, Math.round(this.canvasWidth * 0.25)));
        const height = def ? def.height : Math.min(160, Math.max(120, Math.round(this.canvasHeight * 0.25)));
        const element: LayoutElement = {
            id: generateElementId(),
            type,
            x: Math.max(0, Math.round((this.canvasWidth - width) / 2)),
            y: Math.max(0, Math.round((this.canvasHeight - height) / 2)),
            width,
            height,
            label: def?.defaultLabel ?? type,
            description: def?.defaultDescription,
            placeholder: def?.defaultPlaceholder,
            defaultValue: def?.defaultValue,
            options: def?.options ? [...def.options] : undefined,
            attributes: [],
        };

        if (def?.defaultLayout) {
            element.layout = { ...def.defaultLayout };
            element.children = [];
        }

        const requestedParentId = !isContainerType(type) ? options?.parentId ?? null : null;
        let parentContainer: (LayoutElement & { type: LayoutContainerType }) | null = null;
        if (requestedParentId) {
            const candidate = this.elements.find(el => el.id === requestedParentId);
            if (candidate && isContainerElement(candidate)) {
                parentContainer = candidate;
            }
        }
        if (!parentContainer) {
            const selected = this.selectedElementId ? this.elements.find(el => el.id === this.selectedElementId) : null;
            parentContainer = selected && isContainerElement(selected) && !isContainerType(type) ? selected : null;
        }
        if (parentContainer) {
            element.parentId = parentContainer.id;
            const padding = parentContainer.layout!.padding;
            element.x = parentContainer.x + padding;
            element.y = parentContainer.y + padding;
            element.width = Math.min(parentContainer.width - padding * 2, element.width);
            element.height = Math.min(parentContainer.height - padding * 2, element.height);
        }

        this.elements.push(element);

        if (parentContainer) {
            this.addChildToContainer(parentContainer, element.id);
            this.applyContainerLayout(parentContainer);
        }

        this.renderElements();
        this.selectElement(element.id);
        this.refreshExport();
        this.updateStatus();
        this.pushHistory();
    }

    private renderElements() {
        if (!this.canvasEl) return;
        const seen = new Set<string>();
        for (const element of this.elements) {
            if (isContainerType(element.type)) {
                this.ensureContainerDefaults(element);
            }
            seen.add(element.id);
            let el = this.elementElements.get(element.id);
            if (!el) {
                el = this.createElementNode(element);
                this.elementElements.set(element.id, el);
            }
            this.syncElementElement(element);
        }
        for (const [id, el] of Array.from(this.elementElements.entries())) {
            if (!seen.has(id)) {
                el.remove();
                this.elementElements.delete(id);
            }
        }
        this.updateSelectionStyles();
        this.updateStatus();
        this.attributePopover.refresh();
    }

    private createElementNode(element: LayoutElement) {
        const el = this.canvasEl.createDiv({ cls: "sm-le-box" });
        el.dataset.id = element.id;

        const header = el.createDiv({ cls: "sm-le-box__header" });
        const handle = header.createSpan({ cls: "sm-le-box__handle", text: "⠿" });
        handle.dataset.role = "move";
        const dims = header.createSpan({ cls: "sm-le-box__dims", text: "" });
        dims.dataset.role = "dims";

        const body = el.createDiv({ cls: "sm-le-box__body" });
        body.createDiv({ cls: "sm-le-box__type", text: "" }).dataset.role = "type";
        body.createDiv({ cls: "sm-le-box__content" }).dataset.role = "content";

        const footer = el.createDiv({ cls: "sm-le-box__footer" });
        const attrs = footer.createSpan({ cls: "sm-le-box__attrs", text: "" }) as HTMLElement;
        attrs.dataset.role = "attrs";

        handle.addEventListener("pointerdown", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            this.selectElement(element.id);
            this.beginMove(element, ev);
        });

        el.addEventListener("pointerdown", ev => {
            ev.stopPropagation();
            this.selectElement(element.id);
        });

        const resizeHandle = el.createDiv({ cls: "sm-le-box__resize" });
        resizeHandle.addEventListener("pointerdown", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            this.selectElement(element.id);
            this.beginResize(element, ev);
        });

        attrs.onclick = ev => {
            ev.preventDefault();
            ev.stopPropagation();
            this.selectElement(element.id);
            this.attributePopover.open(element, attrs);
            this.attributePopover.position();
        };

        return el;
    }

    private syncElementElement(element: LayoutElement) {
        const el = this.elementElements.get(element.id);
        if (!el) return;
        el.style.left = `${Math.round(element.x)}px`;
        el.style.top = `${Math.round(element.y)}px`;
        el.style.width = `${Math.round(element.width)}px`;
        el.style.height = `${Math.round(element.height)}px`;
        const typeEl = el.querySelector<HTMLElement>('[data-role="type"]');
        if (typeEl) typeEl.setText(getElementTypeLabel(element.type));
        const dimsEl = el.querySelector<HTMLElement>('[data-role="dims"]');
        if (dimsEl) dimsEl.setText(`${Math.round(element.width)} × ${Math.round(element.height)}px`);
        const contentEl = el.querySelector<HTMLElement>('[data-role="content"]');
        if (contentEl) {
            renderElementPreview({
                host: contentEl,
                element,
                elements: this.elements,
                finalize: target => this.finalizeInlineMutation(target),
                ensureContainerDefaults: target => this.ensureContainerDefaults(target),
                applyContainerLayout: (target, options) => this.applyContainerLayout(target, options),
                pushHistory: () => this.pushHistory(),
            });
        }
        const attrsEl = el.querySelector<HTMLElement>('[data-role="attrs"]');
        if (attrsEl) attrsEl.setText(getAttributeSummary(element.attributes));
    }

    private selectElement(id: string | null) {
        this.attributePopover.close();
        this.selectedElementId = id;
        this.updateSelectionStyles();
        this.renderInspector();
    }

    private updateSelectionStyles() {
        for (const [id, el] of this.elementElements) {
            el.classList.toggle("is-selected", id === this.selectedElementId);
        }
    }

    private renderInspector() {
        if (!this.inspectorHost) return;
        const element = this.selectedElementId ? this.elements.find(el => el.id === this.selectedElementId) : null;
        renderInspectorPanel({
            host: this.inspectorHost,
            element: element ?? null,
            elements: this.elements,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            callbacks: {
                ensureContainerDefaults: target => this.ensureContainerDefaults(target),
                assignElementToContainer: (elementId, containerId) => this.assignElementToContainer(elementId, containerId),
                syncElementElement: target => this.syncElementElement(target),
                refreshExport: () => this.refreshExport(),
                updateStatus: () => this.updateStatus(),
                pushHistory: () => this.pushHistory(),
                renderInspector: () => this.renderInspector(),
                applyContainerLayout: (target, options) => this.applyContainerLayout(target, options),
                createElement: (type, options) => this.createElement(type, options),
                moveChildInContainer: (container, childId, offset) => this.moveChildInContainer(container, childId, offset),
                deleteElement: id => this.deleteElement(id),
            },
        });
        this.attributePopover.refresh();
    }

    private refreshExport() {
        if (!this.exportEl) return;
        const payload = {
            canvas: {
                width: this.canvasWidth,
                height: this.canvasHeight,
            },
            elements: this.elements.map(element => ({
                id: element.id,
                type: element.type,
                label: element.label,
                description: element.description,
                placeholder: element.placeholder,
                defaultValue: element.defaultValue,
                options: element.options ?? [],
                attributes: element.attributes,
                layout: element.layout ?? null,
                children: element.children ?? [],
                x: Math.round(element.x),
                y: Math.round(element.y),
                width: Math.round(element.width),
                height: Math.round(element.height),
                parentId: element.parentId ?? null,
            })),
        };
        this.exportEl.value = JSON.stringify(payload, null, 2);
    }

    private updateStatus() {
        if (!this.statusEl) return;
        const count = this.elements.length;
        const selection = this.selectedElementId ? this.elements.find(el => el.id === this.selectedElementId) : null;
        const parts = [`${count} Element${count === 1 ? "" : "e"}`];
        if (selection) {
            parts.push(`Ausgewählt: ${selection.label || getElementTypeLabel(selection.type)}`);
        }
        this.statusEl.setText(parts.join(" · "));
    }

    private deleteElement(id: string) {
        const index = this.elements.findIndex(b => b.id === id);
        if (index === -1) return;
        const element = this.elements[index];
        this.elements.splice(index, 1);

        if (isContainerType(element.type) && Array.isArray(element.children)) {
            for (const childId of element.children) {
                const child = this.elements.find(el => el.id === childId);
                if (child) {
                    child.parentId = undefined;
                    this.syncElementElement(child);
                }
            }
        }

        if (element.parentId) {
            const parent = this.elements.find(el => el.id === element.parentId);
            if (parent) {
                this.removeChildFromContainer(parent, element.id);
                this.applyContainerLayout(parent);
            }
        }

        const el = this.elementElements.get(id);
        el?.remove();
        this.elementElements.delete(id);
        if (this.attributePopover.activeElementId === id) {
            this.attributePopover.close();
        }
        if (this.selectedElementId === id) {
            this.selectedElementId = null;
        }
        this.renderInspector();
        this.refreshExport();
        this.updateStatus();
        this.pushHistory();
    }

    private addChildToContainer(container: LayoutElement & { children: string[] }, childId: string) {
        if (!Array.isArray(container.children)) container.children = [];
        if (!container.children.includes(childId)) {
            container.children.push(childId);
        }
    }

    private removeChildFromContainer(container: LayoutElement & { children?: string[] }, childId: string) {
        if (!container.children) return;
        container.children = container.children.filter(id => id !== childId);
    }

    private assignElementToContainer(elementId: string, containerId: string | null) {
        const element = this.elements.find(el => el.id === elementId);
        if (!element || isContainerType(element.type)) return;
        const currentParent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;
        if (currentParent && isContainerElement(currentParent)) {
            this.removeChildFromContainer(currentParent, element.id);
            this.applyContainerLayout(currentParent);
        }
        const nextParent = containerId ? this.elements.find(el => el.id === containerId) : null;
        if (nextParent && isContainerElement(nextParent)) {
            element.parentId = nextParent.id;
            this.addChildToContainer(nextParent, element.id);
            this.applyContainerLayout(nextParent);
        } else {
            element.parentId = undefined;
        }
        this.syncElementElement(element);
        this.refreshExport();
        this.renderInspector();
        this.updateStatus();
        this.pushHistory();
    }

    private moveChildInContainer(container: LayoutElement, childId: string, offset: number) {
        if (!isContainerElement(container) || !container.children) return;
        const index = container.children.indexOf(childId);
        if (index === -1) return;
        const nextIndex = clamp(index + offset, 0, container.children.length - 1);
        if (index === nextIndex) return;
        const next = [...container.children];
        const [removed] = next.splice(index, 1);
        next.splice(nextIndex, 0, removed);
        container.children = next;
        this.applyContainerLayout(container);
        this.pushHistory();
    }

    private applyContainerLayout(element: LayoutElement, options?: { silent?: boolean }) {
        if (!isContainerElement(element)) return;
        const padding = element.layout!.padding;
        const gap = element.layout!.gap;
        const align = element.layout!.align;
        const children: LayoutElement[] = [];
        const validIds: string[] = [];
        for (const id of element.children ?? []) {
            if (id === element.id) continue;
            const child = this.elements.find(el => el.id === id);
            if (child) {
                children.push(child);
                validIds.push(id);
            }
        }
        element.children = validIds;
        if (!children.length) {
            if (!options?.silent) {
                this.refreshExport();
                this.renderInspector();
            }
            return;
        }

        const innerWidth = Math.max(MIN_ELEMENT_SIZE, element.width - padding * 2);
        const innerHeight = Math.max(MIN_ELEMENT_SIZE, element.height - padding * 2);
        const gapCount = Math.max(0, children.length - 1);

        if (element.type === "vbox") {
            const availableHeight = innerHeight - gap * gapCount;
            const slotHeight = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableHeight / children.length));
            let y = element.y + padding;
            for (const child of children) {
                child.parentId = element.id;
                child.height = slotHeight;
                child.y = y;
                let width = innerWidth;
                if (align === "stretch") {
                    child.x = element.x + padding;
                } else {
                    width = Math.min(child.width, innerWidth);
                    if (align === "center") {
                        child.x = element.x + padding + Math.round((innerWidth - width) / 2);
                    } else if (align === "end") {
                        child.x = element.x + padding + (innerWidth - width);
                    } else {
                        child.x = element.x + padding;
                    }
                }
                child.width = width;
                y += slotHeight + gap;
                this.syncElementElement(child);
            }
        } else {
            const availableWidth = innerWidth - gap * gapCount;
            const slotWidth = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableWidth / children.length));
            let x = element.x + padding;
            for (const child of children) {
                child.parentId = element.id;
                child.width = slotWidth;
                child.x = x;
                let height = innerHeight;
                if (align === "stretch") {
                    child.y = element.y + padding;
                } else {
                    height = Math.min(child.height, innerHeight);
                    if (align === "center") {
                        child.y = element.y + padding + Math.round((innerHeight - height) / 2);
                    } else if (align === "end") {
                        child.y = element.y + padding + (innerHeight - height);
                    } else {
                        child.y = element.y + padding;
                    }
                }
                child.height = height;
                x += slotWidth + gap;
                this.syncElementElement(child);
            }
        }

        this.syncElementElement(element);
        if (!options?.silent) {
            this.refreshExport();
            this.renderInspector();
            this.updateStatus();
        }
        this.attributePopover.refresh();
    }

    private ensureContainerDefaults(element: LayoutElement) {
        if (!isContainerType(element.type)) return;
        if (!element.layout) {
            const def = ELEMENT_DEFINITION_LOOKUP.get(element.type);
            if (def?.defaultLayout) {
                element.layout = { ...def.defaultLayout };
            } else {
                element.layout = { gap: 16, padding: 16, align: "stretch" };
            }
        }
        if (!Array.isArray(element.children)) {
            element.children = [];
        }
    }

    private beginMove(element: LayoutElement, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = element.x;
        const originY = element.y;
        const isContainer = isContainerType(element.type);
        const parent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;
        const childOrigins = isContainer
            ? element.children?.map(id => {
                  const child = this.elements.find(el => el.id === id);
                  return child ? { child, x: child.x, y: child.y } : null;
              }).filter((entry): entry is { child: LayoutElement; x: number; y: number } => !!entry) ?? []
            : [];

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const nextX = originX + dx;
            const nextY = originY + dy;
            const maxX = Math.max(0, this.canvasWidth - element.width);
            const maxY = Math.max(0, this.canvasHeight - element.height);
            element.x = clamp(nextX, 0, maxX);
            element.y = clamp(nextY, 0, maxY);
            this.syncElementElement(element);
            if (isContainer) {
                for (const entry of childOrigins) {
                    const childMaxX = Math.max(0, this.canvasWidth - entry.child.width);
                    const childMaxY = Math.max(0, this.canvasHeight - entry.child.height);
                    entry.child.x = clamp(entry.x + dx, 0, childMaxX);
                    entry.child.y = clamp(entry.y + dy, 0, childMaxY);
                    this.syncElementElement(entry.child);
                }
            }
            this.refreshExport();
            this.renderInspector();
        };

        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            if (isContainer) {
                this.applyContainerLayout(element);
            } else if (parent && isContainerType(parent.type)) {
                this.applyContainerLayout(parent);
            }
            this.pushHistory();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private beginResize(element: LayoutElement, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originW = element.width;
        const originH = element.height;
        const isContainer = isContainerType(element.type);
        const parent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
            const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
            const nextW = clamp(originW + dx, MIN_ELEMENT_SIZE, maxWidth);
            const nextH = clamp(originH + dy, MIN_ELEMENT_SIZE, maxHeight);
            element.width = nextW;
            element.height = nextH;
            this.syncElementElement(element);
            if (isContainer) {
                this.applyContainerLayout(element, { silent: true });
            }
            this.refreshExport();
            this.renderInspector();
        };

        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            if (isContainer) {
                this.applyContainerLayout(element);
            } else if (parent && isContainerType(parent.type)) {
                this.applyContainerLayout(parent);
            }
            this.pushHistory();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private async importCreatureCreatorLayout(options?: { silent?: boolean }) {
        if (this.isImporting) return;
        this.isImporting = true;
        this.importBtn?.addClass("is-loading");
        if (this.importBtn) this.importBtn.disabled = true;
        try {
            await importCreatureLayout(
                {
                    sandbox: this.sandboxEl,
                    nextFrame: () => this.nextFrame(),
                    setCanvasSize: (width, height) => {
                        this.canvasWidth = width;
                        this.canvasHeight = height;
                    },
                    updateCanvasInputs: (width, height) => {
                        if (this.widthInput) this.widthInput.value = String(width);
                        if (this.heightInput) this.heightInput.value = String(height);
                    },
                    setElements: elements => {
                        this.elements = elements;
                        this.selectedElementId = null;
                    },
                    applyCanvasSize: () => this.applyCanvasSize(),
                    renderElements: () => this.renderElements(),
                    renderInspector: () => this.renderInspector(),
                    refreshExport: () => this.refreshExport(),
                    updateStatus: () => this.updateStatus(),
                    pushHistory: () => this.pushHistory(),
                },
                options,
            );
        } finally {
            this.sandboxEl.empty();
            this.importBtn?.removeClass("is-loading");
            if (this.importBtn) this.importBtn.disabled = false;
            this.isImporting = false;
        }
    }

    private nextFrame(): Promise<void> {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }
}

function generateElementId() {
    return `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
