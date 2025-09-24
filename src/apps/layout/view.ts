// src/apps/layout/view.ts
import { ItemView, Notice } from "obsidian";
import type { StatblockData } from "../library/core/creature-files";
import {
    mountCreatureBasicsSection,
    mountCreatureSensesAndDefensesSection,
    mountCreatureStatsAndSkillsSection,
    mountEntriesSection,
    mountSpellsKnownSection,
} from "../library/create/creature";
import { translateText } from "../../core/translator";

export const VIEW_LAYOUT_EDITOR = "salt-layout-editor";

interface LayoutBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    translationText: string;
    translationSource?: string;
    lastTranslatedAt?: number;
    translationPending?: boolean;
    translationError?: string | null;
}

const MIN_BOX_SIZE = 60;

const LANG_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "de", label: "Deutsch" },
    { value: "en", label: "Englisch" },
    { value: "fr", label: "Französisch" },
    { value: "es", label: "Spanisch" },
    { value: "it", label: "Italienisch" },
    { value: "pl", label: "Polnisch" },
    { value: "ja", label: "Japanisch" },
];

export class LayoutEditorView extends ItemView {
    private boxes: LayoutBox[] = [];
    private selectedBoxId: string | null = null;
    private canvasWidth = 800;
    private canvasHeight = 600;
    private isTranslating = false;
    private isImporting = false;

    private canvasEl!: HTMLElement;
    private inspectorHost!: HTMLElement;
    private exportEl!: HTMLTextAreaElement;
    private languageSelect!: HTMLSelectElement;
    private translateAllBtn!: HTMLButtonElement;
    private importBtn!: HTMLButtonElement;
    private statusEl!: HTMLElement;
    private widthInput?: HTMLInputElement;
    private heightInput?: HTMLInputElement;
    private sandboxEl?: HTMLElement;

    private boxElements = new Map<string, HTMLElement>();

    getViewType() { return VIEW_LAYOUT_EDITOR; }
    getDisplayText() { return "Layout Editor"; }
    getIcon() { return "layout-grid" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-layout-editor");
        this.render();
        if (this.boxes.length === 0) {
            await this.importCreatureCreatorLayout({ silent: true });
        }
        if (this.boxes.length === 0) {
            this.createBox();
        }
        this.refreshExport();
        this.updateStatus();
    }

    async onClose() {
        this.boxElements.clear();
        this.contentEl.empty();
        this.contentEl.removeClass("sm-layout-editor");
    }

    private render() {
        const root = this.contentEl;
        root.empty();

        const header = root.createDiv({ cls: "sm-le-header" });
        header.createEl("h2", { text: "Layout Editor" });

        const controls = header.createDiv({ cls: "sm-le-controls" });

        const addBtn = controls.createEl("button", { text: "Box hinzufügen" });
        addBtn.onclick = () => this.createBox();

        this.importBtn = controls.createEl("button", { text: "Creature-Layout importieren" });
        this.importBtn.onclick = () => { void this.importCreatureCreatorLayout(); };

        const languageGroup = controls.createDiv({ cls: "sm-le-control" });
        languageGroup.createEl("label", { text: "Zielsprache" });
        this.languageSelect = languageGroup.createEl("select") as HTMLSelectElement;
        for (const opt of LANG_OPTIONS) {
            const option = this.languageSelect.createEl("option", { text: opt.label, attr: { value: opt.value } });
            option.selected = opt.value === "en";
        }
        this.languageSelect.value = this.languageSelect.value || "en";
        this.languageSelect.onchange = () => {
            this.updateStatus();
            this.refreshExport();
            this.renderInspector();
        };

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
        };
        sizeWrapper.createSpan({ text: "px" });

        this.translateAllBtn = controls.createEl("button", { text: "Alle übersetzen" });
        this.translateAllBtn.onclick = () => { void this.translateAll(); };

        this.statusEl = header.createDiv({ cls: "sm-le-status" });

        const body = root.createDiv({ cls: "sm-le-body" });
        const stage = body.createDiv({ cls: "sm-le-stage" });
        this.canvasEl = stage.createDiv({ cls: "sm-le-canvas" });
        this.canvasEl.style.width = `${this.canvasWidth}px`;
        this.canvasEl.style.height = `${this.canvasHeight}px`;
        this.registerDomEvent(this.canvasEl, "pointerdown", (ev: PointerEvent) => {
            if (ev.target === this.canvasEl) {
                this.selectBox(null);
            }
        });

        this.inspectorHost = body.createDiv({ cls: "sm-le-inspector" });
        this.renderInspector();

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
        this.exportEl = exportWrap.createEl("textarea", { cls: "sm-le-export__textarea", attr: { rows: "10", readonly: "readonly" } }) as HTMLTextAreaElement;

        this.renderBoxes();

        this.sandboxEl = root.createDiv({ cls: "sm-le-sandbox" });
        this.sandboxEl.style.position = "absolute";
        this.sandboxEl.style.top = "-10000px";
        this.sandboxEl.style.left = "-10000px";
        this.sandboxEl.style.visibility = "hidden";
        this.sandboxEl.style.pointerEvents = "none";
        this.sandboxEl.style.width = "960px";
        this.sandboxEl.style.padding = "24px";
        this.sandboxEl.style.boxSizing = "border-box";
    }

    private applyCanvasSize() {
        if (!this.canvasEl) return;
        this.canvasEl.style.width = `${this.canvasWidth}px`;
        this.canvasEl.style.height = `${this.canvasHeight}px`;
        for (const box of this.boxes) {
            const maxX = Math.max(0, this.canvasWidth - box.width);
            const maxY = Math.max(0, this.canvasHeight - box.height);
            box.x = clamp(box.x, 0, maxX);
            box.y = clamp(box.y, 0, maxY);
            const maxWidth = Math.max(MIN_BOX_SIZE, this.canvasWidth - box.x);
            const maxHeight = Math.max(MIN_BOX_SIZE, this.canvasHeight - box.y);
            box.width = clamp(box.width, MIN_BOX_SIZE, maxWidth);
            box.height = clamp(box.height, MIN_BOX_SIZE, maxHeight);
            this.syncBoxElement(box);
        }
    }

    private createBox() {
        const width = Math.min(240, Math.max(160, Math.round(this.canvasWidth * 0.25)));
        const height = Math.min(160, Math.max(120, Math.round(this.canvasHeight * 0.25)));
        const box: LayoutBox = {
            id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            x: Math.max(0, Math.round((this.canvasWidth - width) / 2)),
            y: Math.max(0, Math.round((this.canvasHeight - height) / 2)),
            width,
            height,
            label: "", 
            translationText: "",
        };
        this.boxes.push(box);
        this.renderBoxes();
        this.selectBox(box.id);
        this.refreshExport();
    }

    private renderBoxes() {
        if (!this.canvasEl) return;
        const seen = new Set<string>();
        for (const box of this.boxes) {
            seen.add(box.id);
            let el = this.boxElements.get(box.id);
            if (!el) {
                el = this.createBoxElement(box);
                this.boxElements.set(box.id, el);
            }
            this.syncBoxElement(box);
        }
        for (const [id, el] of Array.from(this.boxElements.entries())) {
            if (!seen.has(id)) {
                el.remove();
                this.boxElements.delete(id);
            }
        }
        this.updateSelectionStyles();
        this.updateStatus();
    }

    private createBoxElement(box: LayoutBox) {
        const el = this.canvasEl.createDiv({ cls: "sm-le-box" });
        el.dataset.id = box.id;

        const header = el.createDiv({ cls: "sm-le-box__header" });
        const handle = header.createSpan({ cls: "sm-le-box__handle", text: "⠿" });
        handle.dataset.role = "move";
        const dims = header.createSpan({ cls: "sm-le-box__dims", text: "" });
        dims.dataset.role = "dims";

        const body = el.createDiv({ cls: "sm-le-box__body" });
        body.createDiv({ cls: "sm-le-box__label", text: "(Label)" }).dataset.role = "label";
        body.createDiv({ cls: "sm-le-box__translation", text: "" }).dataset.role = "translation";
        const footer = el.createDiv({ cls: "sm-le-box__footer" });
        footer.createSpan({ cls: "sm-le-box__source", text: "" }).dataset.role = "source";

        const resize = el.createDiv({ cls: "sm-le-box__resize" });
        resize.dataset.role = "resize";

        el.onclick = (ev: MouseEvent) => {
            if (ev.target instanceof HTMLElement && ev.target.dataset.role === "resize") return;
            this.selectBox(box.id);
        };

        handle.onpointerdown = (ev: PointerEvent) => {
            ev.preventDefault();
            this.selectBox(box.id);
            this.beginDrag(box, ev);
        };

        resize.onpointerdown = (ev: PointerEvent) => {
            ev.preventDefault();
            this.selectBox(box.id);
            this.beginResize(box, ev);
        };

        return el;
    }

    private syncBoxElement(box: LayoutBox) {
        const el = this.boxElements.get(box.id);
        if (!el) return;
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.width = `${box.width}px`;
        el.style.height = `${box.height}px`;

        const label = el.querySelector('[data-role="label"]') as HTMLElement | null;
        const translation = el.querySelector('[data-role="translation"]') as HTMLElement | null;
        const dims = el.querySelector('[data-role="dims"]') as HTMLElement | null;
        const source = el.querySelector('[data-role="source"]') as HTMLElement | null;

        label?.setText(box.label || "(Label)");
        if (box.translationPending) {
            translation?.setText("Übersetze…");
        } else if (box.translationError) {
            translation?.setText(`Fehler: ${box.translationError}`);
        } else {
            translation?.setText(box.translationText || "");
        }
        if (dims) {
            dims.setText(`${Math.round(box.width)} × ${Math.round(box.height)} px`);
        }
        if (source) {
            const meta = [] as string[];
            if (box.translationSource) meta.push(`aus ${box.translationSource.toUpperCase()}`);
            if (box.lastTranslatedAt) {
                const date = new Date(box.lastTranslatedAt);
                meta.push(date.toLocaleTimeString());
            }
            source.setText(meta.join(" · "));
        }
    }

    private beginDrag(box: LayoutBox, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = box.x;
        const originY = box.y;

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const nextX = originX + dx;
            const nextY = originY + dy;
            const maxX = Math.max(0, this.canvasWidth - box.width);
            const maxY = Math.max(0, this.canvasHeight - box.height);
            box.x = clamp(nextX, 0, maxX);
            box.y = clamp(nextY, 0, maxY);
            this.syncBoxElement(box);
            this.refreshExport();
            this.renderInspector();
        };

        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private beginResize(box: LayoutBox, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originW = box.width;
        const originH = box.height;

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const maxWidth = Math.max(MIN_BOX_SIZE, this.canvasWidth - box.x);
            const maxHeight = Math.max(MIN_BOX_SIZE, this.canvasHeight - box.y);
            const nextW = clamp(originW + dx, MIN_BOX_SIZE, maxWidth);
            const nextH = clamp(originH + dy, MIN_BOX_SIZE, maxHeight);
            box.width = nextW;
            box.height = nextH;
            this.syncBoxElement(box);
            this.refreshExport();
            this.renderInspector();
        };

        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private selectBox(id: string | null) {
        this.selectedBoxId = id;
        this.updateSelectionStyles();
        this.renderInspector();
    }

    private updateSelectionStyles() {
        for (const [id, el] of this.boxElements) {
            el.classList.toggle("is-selected", id === this.selectedBoxId);
        }
    }

    private renderInspector() {
        if (!this.inspectorHost) return;
        const host = this.inspectorHost;
        host.empty();
        host.createEl("h3", { text: "Eigenschaften" });

        const box = this.selectedBoxId ? this.boxes.find(b => b.id === this.selectedBoxId) : null;
        if (!box) {
            host.createDiv({ cls: "sm-le-empty", text: "Wähle eine Box, um Details anzupassen." });
            return;
        }

        const labelField = host.createDiv({ cls: "sm-le-field" });
        labelField.createEl("label", { text: "Label" });
        const labelInput = labelField.createEl("textarea") as HTMLTextAreaElement;
        labelInput.value = box.label;
        labelInput.rows = 2;
        labelInput.oninput = () => {
            box.label = labelInput.value;
            this.syncBoxElement(box);
            this.refreshExport();
        };

        const translationField = host.createDiv({ cls: "sm-le-field" });
        translationField.createEl("label", { text: `Übersetzung (${this.languageSelect?.value?.toUpperCase() || "EN"})` });
        const translationInput = translationField.createEl("textarea") as HTMLTextAreaElement;
        translationInput.value = box.translationText;
        translationInput.rows = 2;
        translationInput.oninput = () => {
            box.translationText = translationInput.value;
            box.translationError = null;
            this.syncBoxElement(box);
            this.refreshExport();
        };

        const translateControls = host.createDiv({ cls: "sm-le-actions" });
        const translateBtn = translateControls.createEl("button", { text: "Label übersetzen" });
        translateBtn.disabled = this.isTranslating || box.translationPending || !box.label.trim();
        translateBtn.onclick = () => { void this.translateSingle(box); };

        const deleteBtn = translateControls.createEl("button", { text: "Box löschen" });
        deleteBtn.classList.add("mod-warning");
        deleteBtn.onclick = () => this.deleteBox(box.id);

        const dimsField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
        dimsField.createEl("label", { text: "Breite (px)" });
        const widthInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_BOX_SIZE) } }) as HTMLInputElement;
        widthInput.value = String(Math.round(box.width));
        widthInput.onchange = () => {
            const maxWidth = Math.max(MIN_BOX_SIZE, this.canvasWidth - box.x);
            const next = clamp(parseInt(widthInput.value, 10) || box.width, MIN_BOX_SIZE, maxWidth);
            box.width = next;
            widthInput.value = String(next);
            this.syncBoxElement(box);
            this.refreshExport();
        };
        dimsField.createEl("label", { text: "Höhe (px)" });
        const heightInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_BOX_SIZE) } }) as HTMLInputElement;
        heightInput.value = String(Math.round(box.height));
        heightInput.onchange = () => {
            const maxHeight = Math.max(MIN_BOX_SIZE, this.canvasHeight - box.y);
            const next = clamp(parseInt(heightInput.value, 10) || box.height, MIN_BOX_SIZE, maxHeight);
            box.height = next;
            heightInput.value = String(next);
            this.syncBoxElement(box);
            this.refreshExport();
        };

        const posField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
        posField.createEl("label", { text: "X-Position" });
        const posXInput = posField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
        posXInput.value = String(Math.round(box.x));
        posXInput.onchange = () => {
            const maxX = Math.max(0, this.canvasWidth - box.width);
            const next = clamp(parseInt(posXInput.value, 10) || box.x, 0, maxX);
            box.x = next;
            posXInput.value = String(next);
            this.syncBoxElement(box);
            this.refreshExport();
        };
        posField.createEl("label", { text: "Y-Position" });
        const posYInput = posField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
        posYInput.value = String(Math.round(box.y));
        posYInput.onchange = () => {
            const maxY = Math.max(0, this.canvasHeight - box.height);
            const next = clamp(parseInt(posYInput.value, 10) || box.y, 0, maxY);
            box.y = next;
            posYInput.value = String(next);
            this.syncBoxElement(box);
            this.refreshExport();
        };

        if (box.translationError) {
            host.createDiv({ cls: "sm-le-error", text: box.translationError });
        }

        const meta = host.createDiv({ cls: "sm-le-meta" });
        meta.setText(`Fläche: ${Math.round(box.width * box.height)} px²`);
    }

    private async translateSingle(box: LayoutBox) {
        if (!box.label.trim()) return;
        box.translationPending = true;
        box.translationError = null;
        this.isTranslating = true;
        this.syncBoxElement(box);
        this.renderInspector();
        this.updateStatus();
        try {
            const result = await translateText({
                text: box.label,
                target: this.languageSelect?.value || "en",
                source: box.translationSource,
            });
            box.translationText = result.translatedText;
            box.translationSource = result.detectedSourceLanguage;
            box.lastTranslatedAt = Date.now();
        } catch (error) {
            console.error("translateSingle", error);
            box.translationError = error instanceof Error ? error.message : String(error);
        } finally {
            box.translationPending = false;
            this.isTranslating = false;
            this.syncBoxElement(box);
            this.renderInspector();
            this.refreshExport();
            this.updateStatus();
        }
    }

    private async translateAll() {
        if (!this.boxes.length || this.isTranslating) return;
        this.isTranslating = true;
        this.updateStatus();
        this.translateAllBtn.disabled = true;
        for (const box of this.boxes) {
            if (!box.label.trim()) continue;
            box.translationPending = true;
            box.translationError = null;
            this.syncBoxElement(box);
        }
        try {
            for (const box of this.boxes) {
                if (!box.label.trim()) {
                    box.translationText = "";
                    continue;
                }
                const result = await translateText({
                    text: box.label,
                    target: this.languageSelect?.value || "en",
                    source: box.translationSource,
                });
                box.translationText = result.translatedText;
                box.translationSource = result.detectedSourceLanguage;
                box.lastTranslatedAt = Date.now();
                box.translationPending = false;
                this.syncBoxElement(box);
                if (this.selectedBoxId === box.id) {
                    this.renderInspector();
                }
                this.refreshExport();
            }
        } catch (error) {
            console.error("translateAll", error);
            const message = error instanceof Error ? error.message : String(error);
            for (const box of this.boxes) {
                if (box.translationPending) {
                    box.translationError = message;
                    box.translationPending = false;
                    this.syncBoxElement(box);
                }
            }
            new Notice("Übersetzung fehlgeschlagen");
        } finally {
            this.isTranslating = false;
            this.translateAllBtn.disabled = false;
            for (const box of this.boxes) {
                box.translationPending = false;
            }
            this.updateStatus();
            this.renderInspector();
            this.refreshExport();
        }
    }

    private deleteBox(id: string) {
        const index = this.boxes.findIndex(b => b.id === id);
        if (index === -1) return;
        this.boxes.splice(index, 1);
        const el = this.boxElements.get(id);
        el?.remove();
        this.boxElements.delete(id);
        if (this.selectedBoxId === id) {
            this.selectedBoxId = null;
        }
        this.renderInspector();
        this.refreshExport();
        this.updateStatus();
    }

    private refreshExport() {
        if (!this.exportEl) return;
        const payload = {
            canvas: { width: Math.round(this.canvasWidth), height: Math.round(this.canvasHeight) },
            targetLanguage: this.languageSelect?.value || "en",
            boxes: this.boxes.map(box => ({
                id: box.id,
                label: box.label,
                translation: box.translationText,
                sourceLanguage: box.translationSource,
                x: Math.round(box.x),
                y: Math.round(box.y),
                width: Math.round(box.width),
                height: Math.round(box.height),
            })),
        };
        this.exportEl.value = JSON.stringify(payload, null, 2);
    }

    private updateStatus() {
        if (!this.statusEl) return;
        const pending = this.boxes.filter(b => b.translationPending).length;
        const info = `${this.boxes.length} Boxen · Zielsprache ${this.languageSelect?.value?.toUpperCase() || "EN"}`;
        this.statusEl.setText(pending > 0 ? `${info} · Übersetzung läuft…` : info);
        if (this.translateAllBtn) {
            this.translateAllBtn.disabled = !this.boxes.length || this.isTranslating;
        }
    }

    private async importCreatureCreatorLayout(options?: { silent?: boolean }) {
        if (this.isImporting) return;
        if (!this.sandboxEl) return;
        this.isImporting = true;
        this.importBtn?.addClass("is-loading");
        this.importBtn.disabled = true;
        try {
            const sandbox = this.sandboxEl;
            sandbox.empty();
            sandbox.addClass("sm-cc-create-modal");
            sandbox.createEl("h3", { text: "Neuen Statblock erstellen" });

            const data: StatblockData = { name: "Neue Kreatur" };
            mountCreatureBasicsSection(sandbox, data);
            mountCreatureStatsAndSkillsSection(sandbox, data);
            mountCreatureSensesAndDefensesSection(sandbox, data);
            mountEntriesSection(sandbox, data);
            mountSpellsKnownSection(sandbox, data, () => []);
            const actions = sandbox.createDiv({ cls: "setting-item sm-cc-actions" });
            actions.dataset.layoutLabel = "Aktionen";
            const actionsCtl = actions.createDiv({ cls: "setting-item-control" });
            actionsCtl.createEl("button", { text: "Abbrechen" });
            const createBtn = actionsCtl.createEl("button", { text: "Erstellen" });
            createBtn.addClass("mod-cta");

            await this.nextFrame();
            await this.nextFrame();

            const containerRect = sandbox.getBoundingClientRect();
            const margin = 48;
            const boxes: LayoutBox[] = [];
            const used = new Set<HTMLElement>();
            let counter = 0;

            const pushElement = (element: Element | null, label: string) => {
                if (!(element instanceof HTMLElement)) return;
                if (used.has(element)) return;
                const rect = element.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                const x = rect.left - containerRect.left + margin;
                const y = rect.top - containerRect.top + margin;
                const width = Math.max(MIN_BOX_SIZE, Math.round(rect.width));
                const height = Math.max(MIN_BOX_SIZE, Math.round(rect.height));
                boxes.push({
                    id: `creature-${String(++counter).padStart(2, "0")}`,
                    x: Math.round(x),
                    y: Math.round(y),
                    width,
                    height,
                    label,
                    translationText: "",
                });
                used.add(element);
            };

            pushElement(sandbox.querySelector("h3"), "Titel");

            const basicsItems = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-basics__grid .setting-item"));
            for (const el of basicsItems) {
                const name = el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
                pushElement(el, `Basics · ${name}`);
            }

            const statRows = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-stat-row"));
            for (const row of statRows) {
                const label = row.querySelector(".sm-cc-stat-row__label")?.textContent?.trim() || "Stat";
                pushElement(row, `Stat · ${label}`);
            }

            const statsSettings = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-stats > .setting-item"));
            for (const el of statsSettings) {
                const name = el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
                pushElement(el, `Stats · ${name}`);
            }

            const defenseSettings = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-defenses .setting-item"));
            for (const el of defenseSettings) {
                const custom = el.dataset.layoutLabel;
                const name = custom || el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
                pushElement(el, `Defenses · ${name}`);
            }

            pushElement(sandbox.querySelector(".sm-cc-entries.setting-item"), "Einträge");
            pushElement(sandbox.querySelector(".sm-cc-spells.setting-item"), "Zauber");
            pushElement(actions, actions.dataset.layoutLabel || "Aktionen");

            boxes.sort((a, b) => (a.y - b.y) || (a.x - b.x));
            if (!boxes.length) {
                throw new Error("Keine Layout-Elemente gefunden");
            }

            this.canvasWidth = Math.max(200, Math.round(containerRect.width) + margin * 2);
            this.canvasHeight = Math.max(200, Math.round(containerRect.height) + margin * 2);
            this.widthInput && (this.widthInput.value = String(this.canvasWidth));
            this.heightInput && (this.heightInput.value = String(this.canvasHeight));

            this.boxes = boxes;
            this.selectedBoxId = null;
            this.applyCanvasSize();
            this.renderBoxes();
            this.renderInspector();
            this.refreshExport();
            this.updateStatus();

            if (!options?.silent) new Notice("Creature-Layout importiert");
        } catch (error) {
            console.error("importCreatureCreatorLayout", error);
            if (!options?.silent) new Notice("Konnte Creature-Layout nicht importieren");
        } finally {
            this.sandboxEl?.empty();
            this.importBtn?.removeClass("is-loading");
            if (this.importBtn) this.importBtn.disabled = false;
            this.isImporting = false;
        }
    }

    private nextFrame(): Promise<void> {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
