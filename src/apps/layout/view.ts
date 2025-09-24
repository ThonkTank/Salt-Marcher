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

export const VIEW_LAYOUT_EDITOR = "salt-layout-editor";

type LayoutElementType =
    | "label"
    | "text-input"
    | "textarea"
    | "box"
    | "separator"
    | "dropdown"
    | "search-dropdown";

interface LayoutElement {
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
}

const MIN_ELEMENT_SIZE = 60;

const ELEMENT_DEFINITIONS: Array<{
    type: LayoutElementType;
    buttonLabel: string;
    defaultLabel: string;
    defaultPlaceholder?: string;
    defaultValue?: string;
    defaultDescription?: string;
    options?: string[];
    width: number;
    height: number;
}> = [
    {
        type: "label",
        buttonLabel: "Label",
        defaultLabel: "Label",
        defaultDescription: "Beschreibender Text für den Dialog.",
        width: 220,
        height: 120,
    },
    {
        type: "text-input",
        buttonLabel: "Textfeld",
        defaultLabel: "Label",
        defaultPlaceholder: "Wert eingeben…",
        width: 260,
        height: 140,
    },
    {
        type: "textarea",
        buttonLabel: "Mehrzeiliges Feld",
        defaultLabel: "Beschreibung",
        defaultPlaceholder: "Text erfassen…",
        width: 320,
        height: 180,
    },
    {
        type: "box",
        buttonLabel: "Box",
        defaultLabel: "Abschnitt",
        defaultDescription: "Container für zusammengehörige Felder.",
        width: 360,
        height: 200,
    },
    {
        type: "separator",
        buttonLabel: "Trennstrich",
        defaultLabel: "Trennlinie",
        width: 320,
        height: 80,
    },
    {
        type: "dropdown",
        buttonLabel: "Dropdown",
        defaultLabel: "Auswahl",
        defaultPlaceholder: "Option wählen…",
        options: ["Option A", "Option B"],
        width: 260,
        height: 150,
    },
    {
        type: "search-dropdown",
        buttonLabel: "Such-Dropdown",
        defaultLabel: "Suchfeld",
        defaultPlaceholder: "Suchen…",
        options: ["Erster Eintrag", "Zweiter Eintrag"],
        width: 280,
        height: 160,
    },
];

const ELEMENT_DEFINITION_LOOKUP = new Map(
    ELEMENT_DEFINITIONS.map(def => [def.type, def]),
);

const ATTRIBUTE_GROUPS: Array<{
    label: string;
    options: Array<{ value: string; label: string }>;
}> = [
    {
        label: "Allgemein",
        options: [
            { value: "name", label: "Name" },
            { value: "type", label: "Typ" },
            { value: "size", label: "Größe" },
            { value: "alignmentLawChaos", label: "Gesinnung (Gesetz/Chaos)" },
            { value: "alignmentGoodEvil", label: "Gesinnung (Gut/Böse)" },
            { value: "cr", label: "Herausforderungsgrad" },
            { value: "xp", label: "Erfahrungspunkte" },
        ],
    },
    {
        label: "Kampfwerte",
        options: [
            { value: "ac", label: "Rüstungsklasse" },
            { value: "initiative", label: "Initiative" },
            { value: "hp", label: "Trefferpunkte" },
            { value: "hitDice", label: "Trefferwürfel" },
            { value: "pb", label: "Proficiency Bonus" },
        ],
    },
    {
        label: "Bewegung",
        options: [
            { value: "speedWalk", label: "Geschwindigkeit (Laufen)" },
            { value: "speedFly", label: "Geschwindigkeit (Fliegen)" },
            { value: "speedSwim", label: "Geschwindigkeit (Schwimmen)" },
            { value: "speedBurrow", label: "Geschwindigkeit (Graben)" },
            { value: "speedList", label: "Geschwindigkeiten (Liste)" },
        ],
    },
    {
        label: "Attribute",
        options: [
            { value: "str", label: "Stärke" },
            { value: "dex", label: "Geschicklichkeit" },
            { value: "con", label: "Konstitution" },
            { value: "int", label: "Intelligenz" },
            { value: "wis", label: "Weisheit" },
            { value: "cha", label: "Charisma" },
        ],
    },
    {
        label: "Rettungswürfe & Fertigkeiten",
        options: [
            { value: "saveProf.str", label: "Rettungswurf: Stärke" },
            { value: "saveProf.dex", label: "Rettungswurf: Geschicklichkeit" },
            { value: "saveProf.con", label: "Rettungswurf: Konstitution" },
            { value: "saveProf.int", label: "Rettungswurf: Intelligenz" },
            { value: "saveProf.wis", label: "Rettungswurf: Weisheit" },
            { value: "saveProf.cha", label: "Rettungswurf: Charisma" },
            { value: "skillsProf", label: "Fertigkeiten (Proficiencies)" },
            { value: "skillsExpertise", label: "Fertigkeiten (Expertise)" },
        ],
    },
    {
        label: "Sinne & Sprache",
        options: [
            { value: "sensesList", label: "Sinne" },
            { value: "languagesList", label: "Sprachen" },
        ],
    },
    {
        label: "Resistenzen & Immunitäten",
        options: [
            { value: "damageVulnerabilitiesList", label: "Verwundbarkeiten" },
            { value: "damageResistancesList", label: "Resistenzen" },
            { value: "damageImmunitiesList", label: "Schadensimmunitäten" },
            { value: "conditionImmunitiesList", label: "Zustandsimmunitäten" },
        ],
    },
    {
        label: "Ausrüstung & Ressourcen",
        options: [
            { value: "gearList", label: "Ausrüstung" },
            { value: "passivesList", label: "Passive Werte" },
        ],
    },
    {
        label: "Texte & Abschnitte",
        options: [
            { value: "traits", label: "Traits (Text)" },
            { value: "actions", label: "Actions (Text)" },
            { value: "legendary", label: "Legendary Actions (Text)" },
            { value: "entries", label: "Strukturierte Einträge" },
            { value: "actionsList", label: "Strukturierte Actions" },
            { value: "spellsKnown", label: "Bekannte Zauber" },
        ],
    },
];

const ATTRIBUTE_LABEL_LOOKUP = new Map(
    ATTRIBUTE_GROUPS.flatMap(group => group.options.map(opt => [opt.value, opt.label] as const)),
);

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
    private sandboxEl?: HTMLElement;

    private elementElements = new Map<string, HTMLElement>();

    getViewType() { return VIEW_LAYOUT_EDITOR; }
    getDisplayText() { return "Layout Editor"; }
    getIcon() { return "layout-grid" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-layout-editor");
        this.render();
        if (this.elements.length === 0) {
            await this.importCreatureCreatorLayout({ silent: true });
        }
        if (this.elements.length === 0) {
            this.createElement("label");
        }
        this.refreshExport();
        this.updateStatus();
    }

    async onClose() {
        this.elementElements.clear();
        this.contentEl.empty();
        this.contentEl.removeClass("sm-layout-editor");
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

        this.renderElements();

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
    }

    private createElement(type: LayoutElementType) {
        const def = ELEMENT_DEFINITION_LOOKUP.get(type);
        const width = def ? def.width : Math.min(240, Math.max(160, Math.round(this.canvasWidth * 0.25)));
        const height = def ? def.height : Math.min(160, Math.max(120, Math.round(this.canvasHeight * 0.25)));
        const element: LayoutElement = {
            id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        this.elements.push(element);
        this.renderElements();
        this.selectElement(element.id);
        this.refreshExport();
    }

    private renderElements() {
        if (!this.canvasEl) return;
        const seen = new Set<string>();
        for (const element of this.elements) {
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
        body.createDiv({ cls: "sm-le-box__label", text: "(Label)" }).dataset.role = "label";
        body.createDiv({ cls: "sm-le-box__details", text: "" }).dataset.role = "details";
        const footer = el.createDiv({ cls: "sm-le-box__footer" });
        footer.createSpan({ cls: "sm-le-box__attrs", text: "" }).dataset.role = "attrs";

        const resize = el.createDiv({ cls: "sm-le-box__resize" });
        resize.dataset.role = "resize";

        el.onclick = (ev: MouseEvent) => {
            if (ev.target instanceof HTMLElement && ev.target.dataset.role === "resize") return;
            this.selectElement(element.id);
        };

        handle.onpointerdown = (ev: PointerEvent) => {
            ev.preventDefault();
            this.selectElement(element.id);
            this.beginDrag(element, ev);
        };

        resize.onpointerdown = (ev: PointerEvent) => {
            ev.preventDefault();
            this.selectElement(element.id);
            this.beginResize(element, ev);
        };

        return el;
    }

    private syncElementElement(element: LayoutElement) {
        const el = this.elementElements.get(element.id);
        if (!el) return;
        el.style.left = `${element.x}px`;
        el.style.top = `${element.y}px`;
        el.style.width = `${element.width}px`;
        el.style.height = `${element.height}px`;

        const typeEl = el.querySelector('[data-role="type"]') as HTMLElement | null;
        const labelEl = el.querySelector('[data-role="label"]') as HTMLElement | null;
        const detailsEl = el.querySelector('[data-role="details"]') as HTMLElement | null;
        const dimsEl = el.querySelector('[data-role="dims"]') as HTMLElement | null;
        const attrsEl = el.querySelector('[data-role="attrs"]') as HTMLElement | null;

        typeEl?.setText(getElementTypeLabel(element.type));
        labelEl?.setText(element.label || "(Label)");
        detailsEl?.setText(this.getElementDetails(element));
        if (dimsEl) {
            dimsEl.setText(`${Math.round(element.width)} × ${Math.round(element.height)} px`);
        }
        if (attrsEl) {
            attrsEl.setText(this.getAttributeSummary(element.attributes));
        }
    }

    private beginDrag(element: LayoutElement, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = element.x;
        const originY = element.y;

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

    private beginResize(element: LayoutElement, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originW = element.width;
        const originH = element.height;

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

    private selectElement(id: string | null) {
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
        const host = this.inspectorHost;
        host.empty();
        host.createEl("h3", { text: "Eigenschaften" });

        const element = this.selectedElementId ? this.elements.find(b => b.id === this.selectedElementId) : null;
        if (!element) {
            host.createDiv({ cls: "sm-le-empty", text: "Wähle ein Element, um Details anzupassen." });
            return;
        }

        host.createDiv({ cls: "sm-le-meta", text: `Typ: ${getElementTypeLabel(element.type)}` });

        const labelField = host.createDiv({ cls: "sm-le-field" });
        labelField.createEl("label", { text: element.type === "label" ? "Text" : "Label" });
        const labelInput = labelField.createEl("textarea") as HTMLTextAreaElement;
        labelInput.value = element.label;
        labelInput.rows = element.type === "textarea" ? 3 : 2;
        labelInput.oninput = () => {
            element.label = labelInput.value;
            this.syncElementElement(element);
            this.refreshExport();
        };

        if (element.type === "label" || element.type === "box") {
            const descField = host.createDiv({ cls: "sm-le-field" });
            descField.createEl("label", { text: element.type === "box" ? "Beschreibung" : "Zusatztext" });
            const descInput = descField.createEl("textarea") as HTMLTextAreaElement;
            descInput.value = element.description || "";
            descInput.rows = 3;
            descInput.oninput = () => {
                element.description = descInput.value || undefined;
                this.syncElementElement(element);
                this.refreshExport();
            };
        }

        if (element.type === "text-input" || element.type === "textarea" || element.type === "dropdown" || element.type === "search-dropdown") {
            const placeholderField = host.createDiv({ cls: "sm-le-field" });
            placeholderField.createEl("label", { text: "Platzhalter" });
            const placeholderInput = placeholderField.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
            placeholderInput.value = element.placeholder || "";
            placeholderInput.oninput = () => {
                element.placeholder = placeholderInput.value || undefined;
                this.syncElementElement(element);
                this.refreshExport();
            };

            const defaultField = host.createDiv({ cls: "sm-le-field" });
            defaultField.createEl("label", { text: "Default-Wert" });
            if (element.type === "textarea") {
                const defaultTextarea = defaultField.createEl("textarea") as HTMLTextAreaElement;
                defaultTextarea.rows = 3;
                defaultTextarea.value = element.defaultValue || "";
                defaultTextarea.oninput = () => {
                    element.defaultValue = defaultTextarea.value || undefined;
                    this.syncElementElement(element);
                    this.refreshExport();
                };
            } else {
                const defaultInput = defaultField.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
                defaultInput.value = element.defaultValue || "";
                defaultInput.oninput = () => {
                    element.defaultValue = defaultInput.value || undefined;
                    this.syncElementElement(element);
                    this.refreshExport();
                };
            }
        }

        if (element.type === "dropdown" || element.type === "search-dropdown") {
            const optionsField = host.createDiv({ cls: "sm-le-field" });
            optionsField.createEl("label", { text: "Optionen (eine pro Zeile)" });
            const optionsInput = optionsField.createEl("textarea") as HTMLTextAreaElement;
            optionsInput.rows = 4;
            optionsInput.value = (element.options || []).join("\n");
            optionsInput.oninput = () => {
                const lines = optionsInput.value
                    .split(/\r?\n/)
                    .map(v => v.trim())
                    .filter(Boolean);
                element.options = lines.length ? lines : undefined;
                this.syncElementElement(element);
                this.refreshExport();
            };
        }

        const attributesField = host.createDiv({ cls: "sm-le-field sm-le-field--attributes" });
        attributesField.createEl("label", { text: "Verknüpfte Attribute" });
        const attributesList = attributesField.createDiv({ cls: "sm-le-attributes" });
        for (const group of ATTRIBUTE_GROUPS) {
            const groupEl = attributesList.createDiv({ cls: "sm-le-attributes__group" });
            groupEl.createEl("div", { cls: "sm-le-attributes__group-title", text: group.label });
            for (const option of group.options) {
                const optionId = `${element.id}-${option.value}`;
                const row = groupEl.createDiv({ cls: "sm-le-attributes__option" });
                const checkbox = row.createEl("input", { attr: { type: "checkbox", id: optionId } }) as HTMLInputElement;
                checkbox.checked = element.attributes.includes(option.value);
                checkbox.onchange = () => {
                    if (checkbox.checked) {
                        if (!element.attributes.includes(option.value)) {
                            element.attributes.push(option.value);
                        }
                    } else {
                        element.attributes = element.attributes.filter(v => v !== option.value);
                    }
                    this.syncElementElement(element);
                    this.refreshExport();
                };
                row.createEl("label", { text: option.label, attr: { for: optionId } });
            }
        }

        const actions = host.createDiv({ cls: "sm-le-actions" });
        const deleteBtn = actions.createEl("button", { text: "Element löschen" });
        deleteBtn.classList.add("mod-warning");
        deleteBtn.onclick = () => this.deleteElement(element.id);

        const dimsField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
        dimsField.createEl("label", { text: "Breite (px)" });
        const widthInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_ELEMENT_SIZE) } }) as HTMLInputElement;
        widthInput.value = String(Math.round(element.width));
        widthInput.onchange = () => {
            const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
            const next = clamp(parseInt(widthInput.value, 10) || element.width, MIN_ELEMENT_SIZE, maxWidth);
            element.width = next;
            widthInput.value = String(next);
            this.syncElementElement(element);
            this.refreshExport();
        };
        dimsField.createEl("label", { text: "Höhe (px)" });
        const heightInput = dimsField.createEl("input", { attr: { type: "number", min: String(MIN_ELEMENT_SIZE) } }) as HTMLInputElement;
        heightInput.value = String(Math.round(element.height));
        heightInput.onchange = () => {
            const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
            const next = clamp(parseInt(heightInput.value, 10) || element.height, MIN_ELEMENT_SIZE, maxHeight);
            element.height = next;
            heightInput.value = String(next);
            this.syncElementElement(element);
            this.refreshExport();
        };

        const posField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
        posField.createEl("label", { text: "X-Position" });
        const posXInput = posField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
        posXInput.value = String(Math.round(element.x));
        posXInput.onchange = () => {
            const maxX = Math.max(0, this.canvasWidth - element.width);
            const next = clamp(parseInt(posXInput.value, 10) || element.x, 0, maxX);
            element.x = next;
            posXInput.value = String(next);
            this.syncElementElement(element);
            this.refreshExport();
        };
        posField.createEl("label", { text: "Y-Position" });
        const posYInput = posField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
        posYInput.value = String(Math.round(element.y));
        posYInput.onchange = () => {
            const maxY = Math.max(0, this.canvasHeight - element.height);
            const next = clamp(parseInt(posYInput.value, 10) || element.y, 0, maxY);
            element.y = next;
            posYInput.value = String(next);
            this.syncElementElement(element);
            this.refreshExport();
        };

        const meta = host.createDiv({ cls: "sm-le-meta" });
        meta.setText(`Fläche: ${Math.round(element.width * element.height)} px²`);
    }

    private deleteElement(id: string) {
        const index = this.elements.findIndex(b => b.id === id);
        if (index === -1) return;
        this.elements.splice(index, 1);
        const el = this.elementElements.get(id);
        el?.remove();
        this.elementElements.delete(id);
        if (this.selectedElementId === id) {
            this.selectedElementId = null;
        }
        this.renderInspector();
        this.refreshExport();
        this.updateStatus();
    }

    private getElementDetails(element: LayoutElement): string {
        const parts: string[] = [];
        if ((element.type === "label" || element.type === "box") && element.description) {
            parts.push(element.description);
        }
        if (element.type === "text-input" || element.type === "textarea") {
            if (element.placeholder) parts.push(`Platzhalter: ${element.placeholder}`);
            if (element.defaultValue) parts.push(`Default: ${element.defaultValue}`);
        }
        if (element.type === "dropdown" || element.type === "search-dropdown") {
            if (element.placeholder) parts.push(`Platzhalter: ${element.placeholder}`);
            if (element.defaultValue) parts.push(`Default: ${element.defaultValue}`);
            if (element.options && element.options.length) {
                const preview = element.options.slice(0, 3).join(", ");
                const suffix = element.options.length > 3 ? "…" : "";
                parts.push(`Optionen: ${preview}${suffix}`);
            }
        }
        if (element.type === "separator") {
            parts.push("Trennlinie");
        }
        return parts.join(" · ");
    }

    private getAttributeSummary(attributes: string[]): string {
        if (!attributes.length) return "Keine Attribute verknüpft";
        return attributes.map(attr => ATTRIBUTE_LABEL_LOOKUP.get(attr) ?? attr).join(", ");
    }

    private detectElementTypeFromDom(node: HTMLElement): LayoutElementType {
        if (node.querySelector("hr")) return "separator";
        const select = node.querySelector("select");
        if (select instanceof HTMLSelectElement) {
            if (select.classList.contains("sm-sd") || select.dataset.sdOpenAll != null) {
                return "search-dropdown";
            }
            return "dropdown";
        }
        const textarea = node.querySelector("textarea");
        if (textarea instanceof HTMLTextAreaElement) return "textarea";
        const input = node.querySelector("input[type='text'], input[type='number'], input[type='search'], input[type='email'], input[type='url']");
        if (input instanceof HTMLInputElement) return "text-input";
        return "box";
    }

    private extractElementDefaults(node: HTMLElement, type: LayoutElementType): {
        description?: string;
        placeholder?: string;
        defaultValue?: string;
        options?: string[];
    } {
        const defaults: { description?: string; placeholder?: string; defaultValue?: string; options?: string[] } = {};
        const desc = node.querySelector(".setting-item-description");
        if (desc?.textContent?.trim()) {
            defaults.description = desc.textContent.trim();
        }
        if (type === "text-input") {
            const input = node.querySelector("input[type='text'], input[type='number'], input[type='search'], input[type='email'], input[type='url']") as HTMLInputElement | null;
            if (input) {
                if (input.placeholder) defaults.placeholder = input.placeholder;
                if (input.value) defaults.defaultValue = input.value;
            }
        } else if (type === "textarea") {
            const textarea = node.querySelector("textarea") as HTMLTextAreaElement | null;
            if (textarea) {
                if (textarea.placeholder) defaults.placeholder = textarea.placeholder;
                if (textarea.value) defaults.defaultValue = textarea.value;
            }
        } else if (type === "dropdown" || type === "search-dropdown") {
            const select = node.querySelector("select") as HTMLSelectElement | null;
            if (select) {
                const options = Array.from(select.options)
                    .map(opt => opt.textContent?.trim() || "")
                    .filter(Boolean);
                if (options.length) defaults.options = options;
                const selected = select.selectedOptions[0]?.textContent?.trim();
                if (selected) defaults.defaultValue = selected;
            }
        }
        return defaults;
    }

    private refreshExport() {
        if (!this.exportEl) return;
        const payload = {
            canvas: { width: Math.round(this.canvasWidth), height: Math.round(this.canvasHeight) },
            elements: this.elements.map(element => {
                const node: Record<string, unknown> = {
                    id: element.id,
                    type: element.type,
                    label: element.label,
                    x: Math.round(element.x),
                    y: Math.round(element.y),
                    width: Math.round(element.width),
                    height: Math.round(element.height),
                    attributes: [...element.attributes],
                };
                if (element.description) node.description = element.description;
                if (element.placeholder) node.placeholder = element.placeholder;
                if (element.defaultValue) node.defaultValue = element.defaultValue;
                if (element.options && element.options.length) node.options = [...element.options];
                return node;
            }),
        };
        this.exportEl.value = JSON.stringify(payload, null, 2);
    }

    private updateStatus() {
        if (!this.statusEl) return;
        const info = `${this.elements.length} Elemente · ${Math.round(this.canvasWidth)} × ${Math.round(this.canvasHeight)} px`;
        this.statusEl.setText(info);
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
            const elements: LayoutElement[] = [];
            const used = new Set<HTMLElement>();
            let counter = 0;

            const pushElement = (element: Element | null, label: string) => {
                if (!(element instanceof HTMLElement)) return;
                if (used.has(element)) return;
                const rect = element.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                const x = rect.left - containerRect.left + margin;
                const y = rect.top - containerRect.top + margin;
                const width = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.width));
                const height = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.height));
                const type = this.detectElementTypeFromDom(element);
                const defaults = this.extractElementDefaults(element, type);
                elements.push({
                    id: `creature-${String(++counter).padStart(2, "0")}`,
                    type,
                    x: Math.round(x),
                    y: Math.round(y),
                    width,
                    height,
                    label,
                    description: defaults.description,
                    placeholder: defaults.placeholder,
                    defaultValue: defaults.defaultValue,
                    options: defaults.options,
                    attributes: [],
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

            elements.sort((a, b) => (a.y - b.y) || (a.x - b.x));
            if (!elements.length) {
                throw new Error("Keine Layout-Elemente gefunden");
            }

            this.canvasWidth = Math.max(200, Math.round(containerRect.width) + margin * 2);
            this.canvasHeight = Math.max(200, Math.round(containerRect.height) + margin * 2);
            this.widthInput && (this.widthInput.value = String(this.canvasWidth));
            this.heightInput && (this.heightInput.value = String(this.canvasHeight));

            this.elements = elements;
            this.selectedElementId = null;
            this.applyCanvasSize();
            this.renderElements();
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

function getElementTypeLabel(type: LayoutElementType): string {
    return ELEMENT_DEFINITION_LOOKUP.get(type)?.buttonLabel ?? type;
}
