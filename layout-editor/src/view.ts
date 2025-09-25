// src/plugins/layout-editor/view.ts
import { ItemView, Notice } from "obsidian";
import {
    MIN_ELEMENT_SIZE,
    getElementDefinition,
    getElementDefinitions,
    getElementTypeLabel,
    isVerticalContainer,
    isContainerType,
    onLayoutElementDefinitionsChanged,
} from "./definitions";
import {
    LayoutBlueprint,
    LayoutEditorSnapshot,
    LayoutElement,
    LayoutElementDefinition,
    LayoutElementType,
    SavedLayout,
} from "./types";
import { LayoutHistory } from "./history";
import { AttributePopoverController } from "./attribute-popover";
import { renderElementPreview } from "./element-preview";
import { renderInspectorPanel } from "./inspector-panel";
import { clamp, cloneLayoutElement, collectDescendantIds, isContainerElement } from "./utils";
import { listSavedLayouts, loadSavedLayout, saveLayoutToLibrary } from "./layout-library";
import { NameInputModal } from "./name-input-modal";
import { LayoutPickerModal } from "./layout-picker-modal";
import { ElementPickerModal } from "./element-picker-modal";
import { getLayoutElementComponent } from "./elements/registry";
import {
    createElementsButton,
    createElementsField,
    createElementsHeading,
    createElementsInput,
    createElementsStatus,
    ensureFieldLabelFor,
} from "./elements/ui";
import { onViewBindingsChanged } from "./view-registry";

export const VIEW_LAYOUT_EDITOR = "salt-layout-editor";
export class LayoutEditorView extends ItemView {
    private elements: LayoutElement[] = [];
    private selectedElementId: string | null = null;
    private canvasWidth = 800;
    private canvasHeight = 600;
    private isImporting = false;
    private elementDefinitions: LayoutElementDefinition[] = getElementDefinitions();
    private disposeDefinitionListener: (() => void) | null = null;
    private disposeViewBindingListener: (() => void) | null = null;

    private structureWidth = 260;
    private inspectorWidth = 320;
    private readonly minPanelWidth = 200;
    private readonly minStageWidth = 320;
    private readonly resizerSize = 6;

    private cameraScale = 1;
    private cameraX = 0;
    private cameraY = 0;
    private panPointerId: number | null = null;
    private panStartX = 0;
    private panStartY = 0;
    private panOriginX = 0;
    private panOriginY = 0;
    private hasInitializedCamera = false;

    private canvasEl!: HTMLElement;
    private bodyEl!: HTMLElement;
    private structurePanelEl!: HTMLElement;
    private structureHost!: HTMLElement;
    private structureRootDropZone: HTMLElement | null = null;
    private stageViewportEl!: HTMLElement;
    private cameraPanEl!: HTMLElement;
    private cameraZoomEl!: HTMLElement;
    private inspectorHost!: HTMLElement;
    private inspectorPanelEl!: HTMLElement;
    private exportEl!: HTMLTextAreaElement;
    private importBtn!: HTMLButtonElement;
    private statusEl!: HTMLElement;
    private addElementControlEl: HTMLElement | null = null;
    private widthInput?: HTMLInputElement;
    private heightInput?: HTMLInputElement;
    private sandboxEl!: HTMLElement;

    private elementElements = new Map<string, HTMLElement>();
    private draggedElementId: string | null = null;
    private saveButton?: HTMLButtonElement;
    private isSavingLayout = false;
    private lastSavedLayoutId: string | null = null;
    private lastSavedLayoutName = "";
    private lastSavedLayoutCreatedAt: string | null = null;
    private lastSavedLayoutUpdatedAt: string | null = null;

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
        this.disposeDefinitionListener = onLayoutElementDefinitionsChanged(defs => {
            this.elementDefinitions = defs;
            this.renderAddElementControl();
            this.renderInspector();
        });
        this.disposeViewBindingListener = onViewBindingsChanged(() => {
            this.renderInspector();
            this.renderElements();
        });
        this.render();
        this.refreshExport();
        this.updateStatus();
    }

    async onClose() {
        this.attributePopover.close();
        this.elementElements.clear();
        this.contentEl.empty();
        this.contentEl.removeClass("sm-layout-editor");
        this.addElementControlEl = null;
        this.saveButton = undefined;
        this.isSavingLayout = false;
        this.disposeDefinitionListener?.();
        this.disposeDefinitionListener = null;
        this.disposeViewBindingListener?.();
        this.disposeViewBindingListener = null;
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
        if (isContainerElement(element)) {
            this.applyContainerLayout(element, { silent: true });
        }
        this.refreshExport();
        this.renderInspector();
        this.updateStatus();
        this.pushHistory();
    }

    private render() {
        const root = this.contentEl;
        root.empty();

        const header = root.createDiv({ cls: "sm-le-header" });
        createElementsHeading(header, 2, "Layout Editor");

        const controls = header.createDiv({ cls: "sm-le-controls" });

        const addGroup = createElementsField(controls, { label: "Element hinzufügen", layout: "stack" });
        addGroup.fieldEl.addClass("sm-le-control");
        addGroup.fieldEl.addClass("sm-le-control--stack");
        this.addElementControlEl = addGroup.controlEl;
        this.addElementControlEl.addClass("sm-le-add");
        this.renderAddElementControl();

        const libraryGroup = createElementsField(controls, { label: "Layout-Bibliothek", layout: "stack" });
        libraryGroup.fieldEl.addClass("sm-le-control");
        this.importBtn = createElementsButton(libraryGroup.controlEl, { label: "Gespeichertes Layout laden" });
        this.importBtn.onclick = () => this.promptImportSavedLayout();

        const sizeGroup = createElementsField(controls, { label: "Arbeitsfläche", layout: "inline" });
        sizeGroup.fieldEl.addClass("sm-le-control");
        const sizeWrapper = sizeGroup.controlEl;
        sizeWrapper.addClass("sm-le-size");
        this.widthInput = createElementsInput(sizeWrapper, {
            type: "number",
            min: 200,
            max: 2000,
            value: String(this.canvasWidth),
        });
        ensureFieldLabelFor(sizeGroup, this.widthInput);
        this.widthInput.onchange = () => {
            const next = clamp(parseInt(this.widthInput!.value, 10) || this.canvasWidth, 200, 2000);
            this.canvasWidth = next;
            this.widthInput!.value = String(next);
            this.applyCanvasSize();
            this.refreshExport();
            this.updateStatus();
            this.pushHistory();
        };
        sizeWrapper.createSpan({ cls: "sm-elements-inline-text", text: "×" });
        this.heightInput = createElementsInput(sizeWrapper, {
            type: "number",
            min: 200,
            max: 2000,
            value: String(this.canvasHeight),
        });
        this.heightInput.onchange = () => {
            const next = clamp(parseInt(this.heightInput!.value, 10) || this.canvasHeight, 200, 2000);
            this.canvasHeight = next;
            this.heightInput!.value = String(next);
            this.applyCanvasSize();
            this.refreshExport();
            this.updateStatus();
            this.pushHistory();
        };
        sizeWrapper.createSpan({ cls: "sm-elements-inline-text", text: "px" });

        this.statusEl = createElementsStatus(header, { text: "" });
        this.statusEl.addClass("sm-le-status");

        this.bodyEl = root.createDiv({ cls: "sm-le-body" });

        this.structurePanelEl = this.bodyEl.createDiv({ cls: "sm-le-panel sm-le-panel--structure" });
        this.structurePanelEl.createEl("h3", { text: "Struktur" });
        this.structureHost = this.structurePanelEl.createDiv({ cls: "sm-le-structure" });

        const leftResizer = this.bodyEl.createDiv({ cls: "sm-le-resizer sm-le-resizer--structure" });
        leftResizer.setAttr("role", "separator");
        leftResizer.setAttr("aria-orientation", "vertical");
        leftResizer.tabIndex = 0;
        leftResizer.onpointerdown = event => this.beginResizePanel(event, "structure");

        const stage = this.bodyEl.createDiv({ cls: "sm-le-stage" });
        this.stageViewportEl = stage.createDiv({ cls: "sm-le-stage__viewport" });
        this.stageViewportEl.addEventListener("pointerdown", this.onStagePointerDown);
        this.stageViewportEl.addEventListener("pointermove", this.onStagePointerMove);
        this.stageViewportEl.addEventListener("pointerup", this.onStagePointerUp);
        this.stageViewportEl.addEventListener("pointercancel", this.onStagePointerUp);
        this.stageViewportEl.addEventListener("wheel", this.onStageWheel, { passive: false });

        this.cameraPanEl = this.stageViewportEl.createDiv({ cls: "sm-le-stage__camera" });
        this.cameraZoomEl = this.cameraPanEl.createDiv({ cls: "sm-le-stage__zoom" });
        this.canvasEl = this.cameraZoomEl.createDiv({ cls: "sm-le-canvas" });
        this.canvasEl.style.width = `${this.canvasWidth}px`;
        this.canvasEl.style.height = `${this.canvasHeight}px`;
        this.registerDomEvent(this.canvasEl, "pointerdown", (ev: PointerEvent) => {
            if (ev.target === this.canvasEl) {
                this.selectElement(null);
            }
        });
        this.registerDomEvent(window, "keydown", this.onKeyDown);

        const rightResizer = this.bodyEl.createDiv({ cls: "sm-le-resizer sm-le-resizer--inspector" });
        rightResizer.setAttr("role", "separator");
        rightResizer.setAttr("aria-orientation", "vertical");
        rightResizer.tabIndex = 0;
        rightResizer.onpointerdown = event => this.beginResizePanel(event, "inspector");

        this.inspectorPanelEl = this.bodyEl.createDiv({ cls: "sm-le-panel sm-le-panel--inspector" });
        this.inspectorPanelEl.createEl("h3", { text: "Eigenschaften" });
        this.inspectorHost = this.inspectorPanelEl.createDiv({ cls: "sm-le-inspector" });
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
        const copyBtn = createElementsButton(exportControls, { label: "JSON kopieren" });
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
        this.saveButton = createElementsButton(exportControls, { label: "Layout speichern", variant: "primary" });
        this.saveButton.onclick = () => this.promptSaveLayout();
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

        this.applyPanelSizes();
        this.applyCameraTransform();
        this.renderStructure();
        requestAnimationFrame(() => {
            if (this.hasInitializedCamera) return;
            this.centerCamera();
            this.hasInitializedCamera = true;
        });
    }

    private renderAddElementControl() {
        if (!this.addElementControlEl) return;
        const host = this.addElementControlEl;
        host.empty();
        const button = createElementsButton(host, { label: "+ Element", variant: "primary" });
        button.classList.add("sm-le-add__trigger");
        button.onclick = () => this.openElementPicker();
    }

    private openElementPicker() {
        if (!this.elementDefinitions.length) {
            new Notice("Keine Elementtypen registriert.");
            return;
        }
        const modal = new ElementPickerModal(this.app, {
            definitions: this.elementDefinitions,
            onPick: type => this.createElement(type),
        });
        modal.open();
    }

    private findDefinition(type: LayoutElementType): LayoutElementDefinition | undefined {
        return this.elementDefinitions.find(def => def.type === type) ?? getElementDefinition(type);
    }

    private promptSaveLayout() {
        if (this.isSavingLayout) return;
        const modal = new NameInputModal(
            this.app,
            name => {
                void this.handleSaveLayout(name);
            },
            {
                placeholder: "Layout-Namen eingeben",
                title: "Layout speichern",
                cta: "Speichern",
                initialValue: this.lastSavedLayoutName,
            },
        );
        modal.open();
    }

    private async handleSaveLayout(name: string) {
        const trimmed = name.trim();
        if (!trimmed) {
            new Notice("Bitte gib einen Namen für das Layout an");
            return;
        }
        if (this.isSavingLayout) return;
        this.isSavingLayout = true;
        this.saveButton?.setAttribute("disabled", "disabled");
        const reuseId = this.lastSavedLayoutName === trimmed ? this.lastSavedLayoutId ?? undefined : undefined;
        try {
            const saved = await saveLayoutToLibrary(this.app, {
                name: trimmed,
                id: reuseId,
                canvasWidth: this.canvasWidth,
                canvasHeight: this.canvasHeight,
                elements: this.elements.map(cloneLayoutElement),
            });
            this.lastSavedLayoutId = saved.id;
            this.lastSavedLayoutName = saved.name;
            this.lastSavedLayoutCreatedAt = saved.createdAt;
            this.lastSavedLayoutUpdatedAt = saved.updatedAt;
            new Notice(`Layout „${saved.name}” gespeichert`);
        } catch (error) {
            console.error("Failed to save layout", error);
            const message = error instanceof Error && error.message ? error.message : "Konnte Layout nicht speichern";
            new Notice(message);
        } finally {
            this.isSavingLayout = false;
            this.saveButton?.removeAttribute("disabled");
        }
    }

    private applyPanelSizes() {
        if (this.structurePanelEl) {
            const width = Math.max(this.minPanelWidth, Math.round(this.structureWidth));
            this.structurePanelEl.style.flex = `0 0 ${width}px`;
            this.structurePanelEl.style.width = `${width}px`;
        }
        if (this.inspectorPanelEl) {
            const width = Math.max(this.minPanelWidth, Math.round(this.inspectorWidth));
            this.inspectorPanelEl.style.flex = `0 0 ${width}px`;
            this.inspectorPanelEl.style.width = `${width}px`;
        }
    }

    private beginResizePanel(event: PointerEvent, target: "structure" | "inspector") {
        if (event.button !== 0) return;
        if (!this.bodyEl) return;
        event.preventDefault();
        const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        const pointerId = event.pointerId;
        const otherWidth = target === "structure" ? this.inspectorWidth : this.structureWidth;
        const onPointerMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            const bodyRect = this.bodyEl.getBoundingClientRect();
            const maxWidth = Math.max(
                this.minPanelWidth,
                bodyRect.width - otherWidth - this.resizerSize * 2 - this.minStageWidth,
            );
            let proposedWidth: number;
            if (target === "structure") {
                proposedWidth = ev.clientX - bodyRect.left - this.resizerSize / 2;
            } else {
                proposedWidth = bodyRect.right - ev.clientX - this.resizerSize / 2;
            }
            const next = clamp(Math.round(proposedWidth), this.minPanelWidth, maxWidth);
            if (target === "structure") {
                this.structureWidth = next;
            } else {
                this.inspectorWidth = next;
            }
            this.applyPanelSizes();
        };
        const onPointerUp = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            handle?.removeEventListener("pointermove", onPointerMove);
            handle?.removeEventListener("pointerup", onPointerUp);
            handle?.releasePointerCapture(pointerId);
            handle?.removeClass("is-active");
        };
        handle?.setPointerCapture(pointerId);
        handle?.addClass("is-active");
        handle?.addEventListener("pointermove", onPointerMove);
        handle?.addEventListener("pointerup", onPointerUp);
    }

    private centerCamera() {
        if (!this.stageViewportEl) return;
        const rect = this.stageViewportEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const scaledWidth = this.canvasWidth * this.cameraScale;
        const scaledHeight = this.canvasHeight * this.cameraScale;
        this.cameraX = Math.round((rect.width - scaledWidth) / 2);
        this.cameraY = Math.round((rect.height - scaledHeight) / 2);
        this.applyCameraTransform();
    }

    private applyCameraTransform() {
        if (this.cameraPanEl) {
            this.cameraPanEl.style.transform = `translate(${Math.round(this.cameraX)}px, ${Math.round(this.cameraY)}px)`;
        }
        if (this.cameraZoomEl) {
            this.cameraZoomEl.style.transform = `scale(${this.cameraScale})`;
        }
    }

    private focusElementInCamera(element: LayoutElement) {
        if (!this.stageViewportEl) return;
        const rect = this.stageViewportEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const scale = this.cameraScale || 1;
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        this.cameraX = Math.round(rect.width / 2 - centerX * scale);
        this.cameraY = Math.round(rect.height / 2 - centerY * scale);
        this.applyCameraTransform();
    }

    private onStagePointerDown = (event: PointerEvent) => {
        if (event.button !== 1) return;
        if (!this.stageViewportEl) return;
        event.preventDefault();
        this.panPointerId = event.pointerId;
        this.panStartX = event.clientX;
        this.panStartY = event.clientY;
        this.panOriginX = this.cameraX;
        this.panOriginY = this.cameraY;
        this.stageViewportEl.setPointerCapture(event.pointerId);
        this.stageViewportEl.addClass("is-panning");
    };

    private onStagePointerMove = (event: PointerEvent) => {
        if (this.panPointerId === null) return;
        if (event.pointerId !== this.panPointerId) return;
        const dx = event.clientX - this.panStartX;
        const dy = event.clientY - this.panStartY;
        this.cameraX = this.panOriginX + dx;
        this.cameraY = this.panOriginY + dy;
        this.applyCameraTransform();
    };

    private onStagePointerUp = (event: PointerEvent) => {
        if (this.panPointerId === null) return;
        if (event.pointerId !== this.panPointerId) return;
        this.stageViewportEl?.releasePointerCapture(event.pointerId);
        this.stageViewportEl?.removeClass("is-panning");
        this.panPointerId = null;
    };

    private onStageWheel = (event: WheelEvent) => {
        if (!this.stageViewportEl) return;
        if (!event.deltaY) return;
        event.preventDefault();
        const scaleFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        const nextScale = clamp(this.cameraScale * scaleFactor, 0.25, 3);
        if (Math.abs(nextScale - this.cameraScale) < 0.0001) return;
        const rect = this.stageViewportEl.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const worldX = (pointerX - this.cameraX) / this.cameraScale;
        const worldY = (pointerY - this.cameraY) / this.cameraScale;
        this.cameraScale = nextScale;
        this.cameraX = pointerX - worldX * this.cameraScale;
        this.cameraY = pointerY - worldY * this.cameraScale;
        this.applyCameraTransform();
    };

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
        this.renderStructure();
    }

    private createElement(type: LayoutElementType, options?: { parentId?: string | null }) {
        const def = this.findDefinition(type);
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

        const requestedParentId = options?.parentId ?? null;
        let parentContainer: LayoutElement | null = null;
        if (requestedParentId) {
            const candidate = this.elements.find(el => el.id === requestedParentId);
            if (candidate && isContainerElement(candidate)) {
                parentContainer = candidate;
            }
        }
        if (!parentContainer) {
            const selected = this.selectedElementId ? this.elements.find(el => el.id === this.selectedElementId) : null;
            parentContainer = selected && isContainerElement(selected) ? selected : null;
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
        this.renderStructure();
    }

    private createElementNode(element: LayoutElement) {
        const el = this.canvasEl.createDiv({ cls: "sm-le-box" });
        el.dataset.id = element.id;

        const content = el.createDiv({ cls: "sm-le-box__content" });
        content.dataset.role = "content";

        const updateCursor = (event: PointerEvent) => {
            const mode = this.resolveInteractionMode(el, event);
            if (!mode) {
                el.style.cursor = "";
                return;
            }
            if (mode.type === "resize") {
                const cursor =
                    mode.corner === "nw" || mode.corner === "se"
                        ? "nwse-resize"
                        : "nesw-resize";
                el.style.cursor = cursor;
            } else {
                el.style.cursor = "move";
            }
        };

        el.addEventListener("pointermove", ev => {
            if (ev.buttons) return;
            updateCursor(ev);
        });

        el.addEventListener("pointerleave", () => {
            if (el.hasClass("is-interacting")) return;
            el.style.cursor = "";
        });

        el.addEventListener("pointerdown", ev => {
            this.selectElement(element.id);
            const mode = this.resolveInteractionMode(el, ev);
            if (!mode) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            el.addClass("is-interacting");
            if (mode.type === "resize") {
                this.beginResize(element, ev, mode.corner, () => {
                    el.removeClass("is-interacting");
                    el.style.cursor = "";
                });
            } else {
                this.beginMove(element, ev, () => {
                    el.removeClass("is-interacting");
                    el.style.cursor = "";
                });
            }
        });

        return el;
    }

    private syncElementElement(element: LayoutElement) {
        const el = this.elementElements.get(element.id);
        if (!el) return;
        el.style.left = `${Math.round(element.x)}px`;
        el.style.top = `${Math.round(element.y)}px`;
        el.style.width = `${Math.round(element.width)}px`;
        el.style.height = `${Math.round(element.height)}px`;
        el.classList.toggle("is-container", isContainerType(element.type));
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
                createElement: (type, options) => this.createElement(type, options),
            });
        }
    }

    private selectElement(id: string | null) {
        this.attributePopover.close();
        this.selectedElementId = id;
        this.updateSelectionStyles();
        this.renderInspector();
        this.renderStructure();
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
            definitions: this.elementDefinitions,
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
        this.renderStructure();
    }

    private refreshExport() {
        if (!this.exportEl) return;
        const payload: LayoutBlueprint & {
            id: string | null;
            name: string | null;
            createdAt: string | null;
            updatedAt: string | null;
        } = {
            canvasWidth: Math.round(this.canvasWidth),
            canvasHeight: Math.round(this.canvasHeight),
            elements: this.elements.map(element => {
                const clone = cloneLayoutElement(element);
                return {
                    ...clone,
                    x: Math.round(clone.x),
                    y: Math.round(clone.y),
                    width: Math.round(clone.width),
                    height: Math.round(clone.height),
                };
            }),
            id: this.lastSavedLayoutId,
            name: this.lastSavedLayoutName.trim() ? this.lastSavedLayoutName : null,
            createdAt: this.lastSavedLayoutCreatedAt,
            updatedAt: this.lastSavedLayoutUpdatedAt ?? this.lastSavedLayoutCreatedAt,
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

    private renderStructure() {
        if (!this.structureHost) return;
        this.structureHost.empty();
        this.structureRootDropZone = null;
        if (!this.elements.length) {
            this.structureHost.createDiv({ cls: "sm-le-empty", text: "Noch keine Elemente." });
            return;
        }

        const elementById = new Map(this.elements.map(element => [element.id, element]));
        const childrenByParent = new Map<string | null, LayoutElement[]>();

        for (const element of this.elements) {
            const parentExists = element.parentId && elementById.has(element.parentId) ? element.parentId : null;
            const key = parentExists ?? null;
            const bucket = childrenByParent.get(key);
            if (bucket) {
                bucket.push(element);
            } else {
                childrenByParent.set(key, [element]);
            }
        }

        for (const element of this.elements) {
            if (!isContainerElement(element) || !element.children?.length) continue;
            const list = childrenByParent.get(element.id);
            if (!list) continue;
            const lookup = new Map(list.map(child => [child.id, child]));
            const ordered: LayoutElement[] = [];
            for (const childId of element.children) {
                const child = lookup.get(childId);
                if (child) {
                    ordered.push(child);
                    lookup.delete(childId);
                }
            }
            for (const child of list) {
                if (lookup.has(child.id)) {
                    ordered.push(child);
                    lookup.delete(child.id);
                }
            }
            childrenByParent.set(element.id, ordered);
        }

        const rootDropZone = this.structureHost.createDiv({
            cls: "sm-le-structure__root-drop",
            text: "Ziehe ein Element hierher, um es aus seinem Container zu lösen.",
        });
        this.structureRootDropZone = rootDropZone;

        const canDropToRoot = () => {
            if (!this.draggedElementId) return false;
            const dragged = elementById.get(this.draggedElementId);
            if (!dragged) return false;
            return Boolean(dragged.parentId);
        };

        rootDropZone.addEventListener("dragenter", event => {
            if (!canDropToRoot()) return;
            event.preventDefault();
            rootDropZone.addClass("is-active");
        });
        rootDropZone.addEventListener("dragover", event => {
            if (!canDropToRoot()) return;
            event.preventDefault();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "move";
            }
            rootDropZone.addClass("is-active");
        });
        rootDropZone.addEventListener("dragleave", event => {
            const related = event.relatedTarget as HTMLElement | null;
            if (!related || !rootDropZone.contains(related)) {
                rootDropZone.removeClass("is-active");
            }
        });
        rootDropZone.addEventListener("drop", event => {
            if (!canDropToRoot()) return;
            event.preventDefault();
            event.stopPropagation();
            rootDropZone.removeClass("is-active");
            const draggedId = this.draggedElementId;
            if (draggedId) {
                this.assignElementToContainer(draggedId, null);
            }
            this.clearStructureDragState();
        });

        const renderLevel = (parentId: string | null, container: HTMLElement) => {
            const children = childrenByParent.get(parentId);
            if (!children || !children.length) return;
            const listEl = container.createEl("ul", { cls: "sm-le-structure__list" });
            for (const child of children) {
                const itemEl = listEl.createEl("li", { cls: "sm-le-structure__item" });
                const entry = createElementsButton(itemEl, { label: "" });
                entry.addClass("sm-le-structure__entry");
                entry.dataset.id = child.id;
                if (this.selectedElementId === child.id) {
                    entry.addClass("is-selected");
                }
                entry.setText("");
                const name = child.label?.trim() || getElementTypeLabel(child.type);
                entry.createSpan({ cls: "sm-le-structure__title", text: name });
                const parentElement = child.parentId ? elementById.get(child.parentId) ?? null : null;
                const metaParts: string[] = [getElementTypeLabel(child.type)];
                if (parentElement) {
                    const parentName = parentElement.label?.trim() || getElementTypeLabel(parentElement.type);
                    metaParts.push(`Übergeordnet: ${parentName}`);
                }
                if (isContainerElement(child)) {
                    const count = child.children?.length ?? 0;
                    const label = count === 1 ? "1 Kind" : `${count} Kinder`;
                    metaParts.push(label);
                    entry.addClass("sm-le-structure__entry--container");
                }
                entry.createSpan({ cls: "sm-le-structure__meta", text: metaParts.join(" • ") });
                entry.onclick = ev => {
                    ev.preventDefault();
                    this.selectElement(child.id);
                    this.focusElementInCamera(child);
                };
                entry.draggable = true;
                entry.addClass("is-draggable");
                entry.addEventListener("dragstart", dragEvent => {
                    this.draggedElementId = child.id;
                    dragEvent.dataTransfer?.setData("text/plain", child.id);
                    if (dragEvent.dataTransfer) {
                        dragEvent.dataTransfer.effectAllowed = "move";
                    }
                });
                entry.addEventListener("dragend", () => {
                    this.clearStructureDragState();
                });
                if (isContainerElement(child)) {
                    const canDropHere = () => this.canDropOnContainer(child.id);
                    entry.addEventListener("dragenter", dragEvent => {
                        if (!canDropHere()) return;
                        dragEvent.preventDefault();
                        entry.addClass("is-drop-target");
                    });
                    entry.addEventListener("dragover", dragEvent => {
                        if (!canDropHere()) return;
                        dragEvent.preventDefault();
                        if (dragEvent.dataTransfer) {
                            dragEvent.dataTransfer.dropEffect = "move";
                        }
                        entry.addClass("is-drop-target");
                    });
                    entry.addEventListener("dragleave", dragEvent => {
                        const related = dragEvent.relatedTarget as HTMLElement | null;
                        if (!related || !entry.contains(related)) {
                            entry.removeClass("is-drop-target");
                        }
                    });
                    entry.addEventListener("drop", dragEvent => {
                        if (!canDropHere()) return;
                        dragEvent.preventDefault();
                        dragEvent.stopPropagation();
                        const draggedId = this.draggedElementId;
                        if (draggedId) {
                            this.assignElementToContainer(draggedId, child.id);
                        }
                        this.clearStructureDragState();
                    });
                }
                renderLevel(child.id, itemEl);
            }
        };

        renderLevel(null, this.structureHost);
    }

    private clearStructureDragState() {
        this.draggedElementId = null;
        if (this.structureHost) {
            const targets = Array.from(this.structureHost.querySelectorAll<HTMLElement>(".sm-le-structure__entry.is-drop-target"));
            for (const target of targets) {
                target.removeClass("is-drop-target");
            }
        }
        this.structureRootDropZone?.removeClass("is-active");
    }

    private canDropOnContainer(containerId: string): boolean {
        if (!this.draggedElementId) return false;
        const container = this.elements.find(el => el.id === containerId);
        if (!container || !isContainerElement(container)) return false;
        const dragged = this.elements.find(el => el.id === this.draggedElementId);
        if (!dragged) return false;
        if (dragged.id === containerId) return false;
        if (dragged.parentId === containerId) return false;
        if (isContainerElement(dragged)) {
            const descendants = collectDescendantIds(dragged, this.elements);
            if (descendants.has(containerId)) return false;
        }
        let cursor = container.parentId ? this.elements.find(el => el.id === container.parentId) : null;
        while (cursor) {
            if (cursor.id === dragged.id) return false;
            cursor = cursor.parentId ? this.elements.find(el => el.id === cursor.parentId) : null;
        }
        return true;
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
        this.renderStructure();
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
        if (!element) return;
        const currentParent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;
        let nextParent: (LayoutElement & { children: string[] }) | null = null;
        if (containerId) {
            const candidate = this.elements.find(el => el.id === containerId);
            if (candidate && isContainerElement(candidate)) {
                if (candidate.id === element.id) {
                    nextParent = null;
                } else if (isContainerElement(element)) {
                    const descendants = collectDescendantIds(element, this.elements);
                    if (!descendants.has(candidate.id)) {
                        let cursor = candidate.parentId ? this.elements.find(el => el.id === candidate.parentId) : null;
                        let isValid = true;
                        while (cursor) {
                            if (cursor.id === element.id) {
                                isValid = false;
                                break;
                            }
                            cursor = cursor.parentId ? this.elements.find(el => el.id === cursor.parentId) : null;
                        }
                        if (isValid) {
                            nextParent = candidate;
                        }
                    }
                } else {
                    nextParent = candidate;
                }
            }
        }
        if (containerId && !nextParent) {
            return;
        }
        const resolvedParent = nextParent ?? null;
        const currentId = currentParent && isContainerElement(currentParent) ? currentParent.id : null;
        const nextId = resolvedParent ? resolvedParent.id : null;
        if (currentId === nextId) {
            return;
        }
        if (currentParent && isContainerElement(currentParent)) {
            this.removeChildFromContainer(currentParent, element.id);
            this.applyContainerLayout(currentParent);
        }
        if (nextParent) {
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
        this.renderStructure();
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

        if (isVerticalContainer(element.type)) {
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
        if (!options?.silent) {
            this.renderStructure();
        }
    }

    private ensureContainerDefaults(element: LayoutElement) {
        if (!isContainerType(element.type)) return;
        const component = getLayoutElementComponent(element.type);
        if (component?.ensureDefaults) {
            component.ensureDefaults(element);
        } else {
            if (!element.layout) {
                const def = this.findDefinition(element.type);
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
    }

    private beginMove(element: LayoutElement, event: PointerEvent, onComplete?: () => void) {
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
            const scale = this.cameraScale || 1;
            const dx = (ev.clientX - startX) / scale;
            const dy = (ev.clientY - startY) / scale;
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
            onComplete?.();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private beginResize(
        element: LayoutElement,
        event: PointerEvent,
        corner: "nw" | "ne" | "sw" | "se",
        onComplete?: () => void,
    ) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originW = element.width;
        const originH = element.height;
        const isContainer = isContainerType(element.type);
        const parent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;
        const originX = element.x;
        const originY = element.y;
        const resizeLeft = corner === "nw" || corner === "sw";
        const resizeTop = corner === "nw" || corner === "ne";

        const onMove = (ev: PointerEvent) => {
            const scale = this.cameraScale || 1;
            const dx = (ev.clientX - startX) / scale;
            const dy = (ev.clientY - startY) / scale;
            let nextX = originX;
            let nextY = originY;
            let nextW = originW;
            let nextH = originH;

            if (resizeLeft) {
                const maxLeft = originX + originW - MIN_ELEMENT_SIZE;
                const proposedX = clamp(originX + dx, 0, maxLeft);
                nextX = proposedX;
                nextW = originW + (originX - proposedX);
            } else {
                const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - originX);
                nextW = clamp(originW + dx, MIN_ELEMENT_SIZE, maxWidth);
            }

            if (resizeTop) {
                const maxTop = originY + originH - MIN_ELEMENT_SIZE;
                const proposedY = clamp(originY + dy, 0, maxTop);
                nextY = proposedY;
                nextH = originH + (originY - proposedY);
            } else {
                const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - originY);
                nextH = clamp(originH + dy, MIN_ELEMENT_SIZE, maxHeight);
            }

            element.x = nextX;
            element.y = nextY;
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
            onComplete?.();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private resolveInteractionMode(el: HTMLElement, event: PointerEvent):
        | { type: "move" }
        | { type: "resize"; corner: "nw" | "ne" | "sw" | "se" }
        | null {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const margin = Math.min(14, rect.width / 2, rect.height / 2);
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) {
            return null;
        }
        const nearLeft = offsetX <= margin;
        const nearRight = rect.width - offsetX <= margin;
        const nearTop = offsetY <= margin;
        const nearBottom = rect.height - offsetY <= margin;
        if (nearLeft && nearTop) return { type: "resize", corner: "nw" };
        if (nearRight && nearTop) return { type: "resize", corner: "ne" };
        if (nearLeft && nearBottom) return { type: "resize", corner: "sw" };
        if (nearRight && nearBottom) return { type: "resize", corner: "se" };
        if (nearLeft || nearRight || nearTop || nearBottom) return { type: "move" };
        return null;
    }

    private promptImportSavedLayout() {
        if (this.isImporting) return;
        const modal = new LayoutPickerModal(this.app, {
            loadLayouts: () => listSavedLayouts(this.app),
            onPick: layoutId => {
                void this.importSavedLayout(layoutId);
            },
        });
        modal.open();
    }

    private async importSavedLayout(layoutId: string) {
        if (this.isImporting) return;
        this.isImporting = true;
        this.importBtn?.addClass("is-loading");
        if (this.importBtn) this.importBtn.disabled = true;
        try {
            const layout = await loadSavedLayout(this.app, layoutId);
            if (!layout) {
                new Notice("Layout konnte nicht geladen werden");
                return;
            }
            this.applySavedLayout(layout);
            new Notice(`Layout „${layout.name}” geladen`);
        } catch (error) {
            console.error("Failed to import saved layout", error);
            new Notice("Konnte Layout nicht laden");
        } finally {
            this.sandboxEl.empty();
            this.importBtn?.removeClass("is-loading");
            if (this.importBtn) this.importBtn.disabled = false;
            this.isImporting = false;
        }
    }

    private applySavedLayout(layout: SavedLayout) {
        this.attributePopover.close();
        this.canvasWidth = layout.canvasWidth;
        this.canvasHeight = layout.canvasHeight;
        this.elements = layout.elements.map(cloneLayoutElement);
        this.selectedElementId = null;
        this.lastSavedLayoutId = layout.id;
        this.lastSavedLayoutName = layout.name;
        this.lastSavedLayoutCreatedAt = layout.createdAt;
        this.lastSavedLayoutUpdatedAt = layout.updatedAt;
        if (this.widthInput) this.widthInput.value = String(this.canvasWidth);
        if (this.heightInput) this.heightInput.value = String(this.canvasHeight);
        this.applyCanvasSize();
        this.centerCamera();
        this.renderElements();
        this.renderInspector();
        this.refreshExport();
        this.updateStatus();
        this.history.reset(this.captureSnapshot());
    }

    private nextFrame(): Promise<void> {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }
}

function generateElementId() {
    return `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
