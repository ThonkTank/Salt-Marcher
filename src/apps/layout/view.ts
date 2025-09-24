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
    | "search-dropdown"
    | "vbox"
    | "hbox";

type LayoutContainerType = "vbox" | "hbox";

type LayoutContainerAlign = "start" | "center" | "end" | "stretch";

interface LayoutContainerConfig {
    gap: number;
    padding: number;
    align: LayoutContainerAlign;
}

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
    parentId?: string;
    layout?: LayoutContainerConfig;
    children?: string[];
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
    defaultLayout?: LayoutContainerConfig;
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
    {
        type: "vbox",
        buttonLabel: "VBox-Container",
        defaultLabel: "VBox",
        defaultDescription: "Ordnet verknüpfte Elemente automatisch untereinander an.",
        width: 340,
        height: 260,
        defaultLayout: { gap: 16, padding: 16, align: "stretch" },
    },
    {
        type: "hbox",
        buttonLabel: "HBox-Container",
        defaultLabel: "HBox",
        defaultDescription: "Ordnet verknüpfte Elemente automatisch nebeneinander an.",
        width: 360,
        height: 220,
        defaultLayout: { gap: 16, padding: 16, align: "center" },
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

interface AttributePopover {
    elementId: string;
    container: HTMLElement;
    anchor: HTMLElement;
    dispose: () => void;
}

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
    private activeAttributePopover: AttributePopover | null = null;

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
        for (const element of this.elements) {
            if (isContainerType(element.type)) {
                this.applyContainerLayout(element, { silent: true });
            }
        }
    }

    private createElement(type: LayoutElementType) {
        const def = ELEMENT_DEFINITION_LOOKUP.get(type);
        const width = def ? def.width : Math.min(240, Math.max(160, Math.round(this.canvasWidth * 0.25)));
        const height = def ? def.height : Math.min(160, Math.max(120, Math.round(this.canvasHeight * 0.25)));
        const id = `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const element: LayoutElement = {
            id,
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

        const selected = this.selectedElementId ? this.elements.find(el => el.id === this.selectedElementId) : null;
        const parentContainer = selected && isContainerElement(selected) && !isContainerType(type) ? selected : null;
        if (parentContainer) {
            element.parentId = parentContainer.id;
            const padding = parentContainer.layout.padding;
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
    }

    private ensureContainerDefaults(element: LayoutElement) {
        if (!isContainerType(element.type)) return;
        if (!element.layout) {
            const def = ELEMENT_DEFINITION_LOOKUP.get(element.type);
            element.layout = def?.defaultLayout ? { ...def.defaultLayout } : { gap: 16, padding: 16, align: "stretch" };
        }
        if (!Array.isArray(element.children)) {
            element.children = [];
        }
    }

    private addChildToContainer(container: LayoutElement, childId: string) {
        if (!isContainerType(container.type)) return;
        this.ensureContainerDefaults(container);
        if (!container.children!.includes(childId)) {
            container.children!.push(childId);
        }
    }

    private removeChildFromContainer(container: LayoutElement, childId: string) {
        if (!isContainerType(container.type) || !Array.isArray(container.children)) return;
        container.children = container.children.filter(id => id !== childId);
    }

    private moveChildInContainer(container: LayoutElement, childId: string, delta: number) {
        if (!isContainerType(container.type) || !Array.isArray(container.children)) return;
        const index = container.children.indexOf(childId);
        if (index === -1) return;
        const nextIndex = clamp(index + delta, 0, container.children.length - 1);
        if (nextIndex === index) return;
        const [id] = container.children.splice(index, 1);
        container.children.splice(nextIndex, 0, id);
        this.applyContainerLayout(container);
    }

    private assignElementToContainer(elementId: string, containerId: string | null) {
        const element = this.elements.find(el => el.id === elementId);
        if (!element) return;
        const previousParent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;
        if (previousParent) {
            this.removeChildFromContainer(previousParent, element.id);
        }
        element.parentId = undefined;

        const nextParent = containerId ? this.elements.find(el => el.id === containerId) : null;
        if (nextParent) {
            this.addChildToContainer(nextParent, element.id);
            element.parentId = nextParent.id;
        }

        if (previousParent) {
            this.applyContainerLayout(previousParent);
        }
        if (nextParent) {
            this.applyContainerLayout(nextParent);
        }
        this.syncElementElement(element);
        this.refreshExport();
        this.renderInspector();
    }

    private applyContainerLayout(container: LayoutElement, options?: { silent?: boolean }) {
        if (!isContainerType(container.type)) return;
        this.ensureContainerDefaults(container);
        const layout = container.layout!;
        const gap = Math.max(0, layout.gap);
        const padding = Math.max(0, layout.padding);
        const align = layout.align;
        const childIds = Array.isArray(container.children) ? container.children.slice() : [];
        const children: LayoutElement[] = [];
        const validIds: string[] = [];
        for (const id of childIds) {
            if (id === container.id) continue;
            const child = this.elements.find(el => el.id === id);
            if (child) {
                children.push(child);
                validIds.push(id);
            }
        }
        container.children = validIds;
        if (!children.length) {
            if (!options?.silent) {
                this.refreshExport();
                this.renderInspector();
            }
            return;
        }

        const innerWidth = Math.max(MIN_ELEMENT_SIZE, container.width - padding * 2);
        const innerHeight = Math.max(MIN_ELEMENT_SIZE, container.height - padding * 2);
        const gapCount = Math.max(0, children.length - 1);

        if (container.type === "vbox") {
            const availableHeight = innerHeight - gap * gapCount;
            const slotHeight = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableHeight / children.length));
            let y = container.y + padding;
            for (const child of children) {
                child.parentId = container.id;
                child.height = slotHeight;
                child.y = y;
                let width = innerWidth;
                if (align === "stretch") {
                    child.x = container.x + padding;
                } else {
                    width = Math.min(child.width, innerWidth);
                    if (align === "center") {
                        child.x = container.x + padding + Math.round((innerWidth - width) / 2);
                    } else if (align === "end") {
                        child.x = container.x + padding + (innerWidth - width);
                    } else {
                        child.x = container.x + padding;
                    }
                }
                child.width = width;
                y += slotHeight + gap;
                this.syncElementElement(child);
            }
        } else {
            const availableWidth = innerWidth - gap * gapCount;
            const slotWidth = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableWidth / children.length));
            let x = container.x + padding;
            for (const child of children) {
                child.parentId = container.id;
                child.width = slotWidth;
                child.x = x;
                let height = innerHeight;
                if (align === "stretch") {
                    child.y = container.y + padding;
                } else {
                    height = Math.min(child.height, innerHeight);
                    if (align === "center") {
                        child.y = container.y + padding + Math.round((innerHeight - height) / 2);
                    } else if (align === "end") {
                        child.y = container.y + padding + (innerHeight - height);
                    } else {
                        child.y = container.y + padding;
                    }
                }
                child.height = height;
                x += slotWidth + gap;
                this.syncElementElement(child);
            }
        }

        this.syncElementElement(container);
        if (!options?.silent) {
            this.refreshExport();
            this.renderInspector();
        }
        this.refreshAttributePopover();
    }

    private openAttributePopover(element: LayoutElement, anchor: HTMLElement) {
        this.closeAttributePopover();
        const container = document.createElement("div");
        container.className = "sm-le-attr-popover";
        container.style.position = "absolute";
        container.style.zIndex = "1000";
        container.style.visibility = "hidden";
        container.addEventListener("pointerdown", ev => ev.stopPropagation());

        const heading = document.createElement("div");
        heading.className = "sm-le-attr-popover__heading";
        heading.textContent = "Attribute";
        container.appendChild(heading);

        const hint = document.createElement("div");
        hint.className = "sm-le-attr-popover__hint";
        hint.textContent = "Mehrfachauswahl möglich.";
        container.appendChild(hint);

        const scroll = document.createElement("div");
        scroll.className = "sm-le-attr-popover__scroll";
        container.appendChild(scroll);

        const clearBtn = document.createElement("button");
        clearBtn.className = "sm-le-attr-popover__clear";
        clearBtn.textContent = "Alle entfernen";
        clearBtn.addEventListener("click", ev => {
            ev.preventDefault();
            if (element.attributes.length === 0) return;
            element.attributes = [];
            this.syncElementElement(element);
            this.refreshExport();
            this.renderInspector();
            this.refreshAttributePopover();
        });
        container.appendChild(clearBtn);

        for (const group of ATTRIBUTE_GROUPS) {
            const groupEl = document.createElement("div");
            groupEl.className = "sm-le-attr-popover__group";
            const title = document.createElement("div");
            title.className = "sm-le-attr-popover__group-title";
            title.textContent = group.label;
            groupEl.appendChild(title);
            for (const option of group.options) {
                const optionLabel = document.createElement("label");
                optionLabel.className = "sm-le-attr-popover__option";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.dataset.attr = option.value;
                checkbox.checked = element.attributes.includes(option.value);
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        if (!element.attributes.includes(option.value)) {
                            element.attributes = [...element.attributes, option.value];
                        }
                    } else {
                        element.attributes = element.attributes.filter(v => v !== option.value);
                    }
                    this.syncElementElement(element);
                    this.refreshExport();
                    this.renderInspector();
                    this.refreshAttributePopover();
                });
                const labelText = document.createElement("span");
                labelText.textContent = option.label;
                optionLabel.appendChild(checkbox);
                optionLabel.appendChild(labelText);
                groupEl.appendChild(optionLabel);
            }
            scroll.appendChild(groupEl);
        }

        const onPointerDown = (ev: PointerEvent) => {
            if (!(ev.target instanceof Node)) return;
            if (!container.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target as Node)) {
                this.closeAttributePopover();
            }
        };
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
                this.closeAttributePopover();
            }
        };
        document.body.appendChild(container);
        const state: AttributePopover = {
            elementId: element.id,
            container,
            anchor,
            dispose: () => {
                document.removeEventListener("pointerdown", onPointerDown, true);
                document.removeEventListener("keydown", onKeyDown, true);
                container.remove();
            },
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);

        this.activeAttributePopover = state;
        this.positionAttributePopover(state);
        container.style.visibility = "visible";
    }

    private closeAttributePopover() {
        if (!this.activeAttributePopover) return;
        this.activeAttributePopover.dispose();
        this.activeAttributePopover = null;
    }

    private refreshAttributePopover() {
        if (!this.activeAttributePopover) return;
        const element = this.elements.find(el => el.id === this.activeAttributePopover!.elementId);
        if (!element) {
            this.closeAttributePopover();
            return;
        }
        const checkboxes = this.activeAttributePopover.container.querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-attr]");
        checkboxes.forEach(checkbox => {
            const attr = checkbox.dataset.attr;
            if (!attr) return;
            checkbox.checked = element.attributes.includes(attr);
        });
    }

    private positionAttributePopover(state: AttributePopover) {
        const anchorRect = state.anchor.getBoundingClientRect();
        const popRect = state.container.getBoundingClientRect();
        const margin = 8;
        let left = anchorRect.left + window.scrollX;
        let top = anchorRect.bottom + window.scrollY + margin;
        const viewportWidth = window.innerWidth + window.scrollX;
        const viewportHeight = window.innerHeight + window.scrollY;
        if (left + popRect.width > viewportWidth - margin) {
            left = viewportWidth - popRect.width - margin;
        }
        if (left < margin) left = margin;
        if (top + popRect.height > viewportHeight - margin) {
            top = anchorRect.top + window.scrollY - popRect.height - margin;
        }
        if (top < margin) top = margin;
        state.container.style.left = `${Math.round(left)}px`;
        state.container.style.top = `${Math.round(top)}px`;
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
        const attrs = footer.createSpan({ cls: "sm-le-box__attrs", text: "" }) as HTMLElement;
        attrs.dataset.role = "attrs";
        attrs.addClass("is-editable");
        attrs.onclick = (ev: MouseEvent) => {
            ev.stopPropagation();
            this.selectElement(element.id);
            this.openAttributePopover(element, attrs);
        };

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
        el.classList.toggle("sm-le-box--container", isContainerType(element.type));

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
            attrsEl.classList.toggle("is-empty", element.attributes.length === 0);
        }
        if (this.activeAttributePopover?.elementId === element.id) {
            this.refreshAttributePopover();
            this.positionAttributePopover(this.activeAttributePopover);
        }
    }

    private beginDrag(element: LayoutElement, event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = element.x;
        const originY = element.y;
        const isContainer = isContainerType(element.type);
        const parent = element.parentId ? this.elements.find(el => el.id === element.parentId) : null;
        const childOrigins: Array<{ child: LayoutElement; x: number; y: number }> = [];
        if (isContainer && Array.isArray(element.children)) {
            for (const childId of element.children) {
                const child = this.elements.find(el => el.id === childId);
                if (child) {
                    childOrigins.push({ child, x: child.x, y: child.y });
                }
            }
        }

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
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    private selectElement(id: string | null) {
        this.closeAttributePopover();
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

        const isContainer = isContainerType(element.type);
        if (isContainer) {
            this.ensureContainerDefaults(element);
        }
        const parentContainer = !isContainer && element.parentId ? this.elements.find(el => el.id === element.parentId) : null;

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

        if (!isContainer) {
            const containers = this.elements.filter(el => isContainerType(el.type));
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
                    this.assignElementToContainer(element.id, value);
                };
            }
        }

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
                    this.refreshAttributePopover();
                };
                row.createEl("label", { text: option.label, attr: { for: optionId } });
            }
        }

        if (isContainerElement(element)) {
            const layoutField = host.createDiv({ cls: "sm-le-field sm-le-field--grid" });
            layoutField.createEl("label", { text: "Abstand (px)" });
            const gapInput = layoutField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
            gapInput.value = String(Math.round(element.layout.gap));
            gapInput.onchange = () => {
                const next = Math.max(0, parseInt(gapInput.value, 10) || 0);
                element.layout!.gap = next;
                gapInput.value = String(next);
                this.applyContainerLayout(element);
            };
            layoutField.createEl("label", { text: "Innenabstand (px)" });
            const paddingInput = layoutField.createEl("input", { attr: { type: "number", min: "0" } }) as HTMLInputElement;
            paddingInput.value = String(Math.round(element.layout.padding));
            paddingInput.onchange = () => {
                const next = Math.max(0, parseInt(paddingInput.value, 10) || 0);
                element.layout!.padding = next;
                paddingInput.value = String(next);
                this.applyContainerLayout(element);
            };

            const alignField = host.createDiv({ cls: "sm-le-field" });
            alignField.createEl("label", { text: element.type === "vbox" ? "Horizontale Ausrichtung" : "Vertikale Ausrichtung" });
            const alignSelect = alignField.createEl("select") as HTMLSelectElement;
            const alignOptions: Array<[LayoutContainerAlign, string]> =
                element.type === "vbox"
                    ? [
                          ["start", "Links"],
                          ["center", "Zentriert"],
                          ["end", "Rechts"],
                          ["stretch", "Breite strecken"],
                      ]
                    : [
                          ["start", "Oben"],
                          ["center", "Zentriert"],
                          ["end", "Unten"],
                          ["stretch", "Höhe strecken"],
                      ];
            for (const [value, label] of alignOptions) {
                const option = alignSelect.createEl("option", { value, text: label });
                if (element.layout.align === value) option.selected = true;
            }
            alignSelect.onchange = () => {
                const next = (alignSelect.value as LayoutContainerAlign) ?? element.layout!.align;
                element.layout!.align = next;
                this.applyContainerLayout(element);
            };

            const childField = host.createDiv({ cls: "sm-le-field sm-le-field--stack" });
            childField.createEl("label", { text: "Zugeordnete Elemente" });
            const addRow = childField.createDiv({ cls: "sm-le-container-add" });
            const addSelect = addRow.createEl("select") as HTMLSelectElement;
            addSelect.createEl("option", { value: "", text: "Element auswählen…" });
            const candidates = this.elements.filter(el => el.id !== element.id && !isContainerType(el.type));
            for (const candidate of candidates) {
                const textBase = candidate.label || getElementTypeLabel(candidate.type);
                let optionText = textBase;
                if (candidate.parentId && candidate.parentId !== element.id) {
                    const parentElement = this.elements.find(el => el.id === candidate.parentId);
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
                    this.assignElementToContainer(target, element.id);
                }
            };

            const childList = childField.createDiv({ cls: "sm-le-container-children" });
            const children = Array.isArray(element.children)
                ? element.children
                      .map(childId => this.elements.find(el => el.id === childId))
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
                        this.moveChildInContainer(element, child.id, -1);
                    };
                    const downBtn = controls.createEl("button", { text: "↓", attr: { title: "Nach unten" } });
                    downBtn.disabled = idx === children.length - 1;
                    downBtn.onclick = ev => {
                        ev.preventDefault();
                        this.moveChildInContainer(element, child.id, 1);
                    };
                    const removeBtn = controls.createEl("button", { text: "✕", attr: { title: "Entfernen" } });
                    removeBtn.onclick = ev => {
                        ev.preventDefault();
                        this.assignElementToContainer(child.id, null);
                    };
                }
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
            if (isContainer) {
                this.applyContainerLayout(element);
            } else if (parentContainer && isContainerType(parentContainer.type)) {
                this.applyContainerLayout(parentContainer);
            }
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
            if (isContainer) {
                this.applyContainerLayout(element);
            } else if (parentContainer && isContainerType(parentContainer.type)) {
                this.applyContainerLayout(parentContainer);
            }
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
            if (isContainer) {
                this.applyContainerLayout(element);
            } else if (parentContainer && isContainerType(parentContainer.type)) {
                this.applyContainerLayout(parentContainer);
            }
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
            if (isContainer) {
                this.applyContainerLayout(element);
            } else if (parentContainer && isContainerType(parentContainer.type)) {
                this.applyContainerLayout(parentContainer);
            }
        };

        const meta = host.createDiv({ cls: "sm-le-meta" });
        meta.setText(`Fläche: ${Math.round(element.width * element.height)} px²`);
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
        if (this.activeAttributePopover?.elementId === id) {
            this.closeAttributePopover();
        }
        if (this.selectedElementId === id) {
            this.selectedElementId = null;
        }
        this.renderInspector();
        this.refreshExport();
        this.updateStatus();
    }

    private getElementDetails(element: LayoutElement): string {
        const parts: string[] = [];
        if (isContainerType(element.type)) {
            const layout = element.layout;
            const gap = layout ? Math.round(layout.gap) : 0;
            const alignLabel = layout ? getContainerAlignLabel(element.type, layout.align) : null;
            const count = element.children?.length ?? 0;
            parts.push(element.type === "vbox" ? "Vertikale Verteilung" : "Horizontale Verteilung");
            parts.push(`Abstand ${gap}px`);
            if (alignLabel) parts.push(alignLabel);
            parts.push(`${count} Elemente`);
        }
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
        if (!attributes.length) return "Attribute wählen…";
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
                if (element.parentId) node.parentId = element.parentId;
                if (isContainerType(element.type)) {
                    if (element.layout) {
                        node.layout = {
                            gap: Math.round(element.layout.gap),
                            padding: Math.round(element.layout.padding),
                            align: element.layout.align,
                        } satisfies LayoutContainerConfig;
                    }
                    if (element.children && element.children.length) {
                        node.children = [...element.children];
                    }
                }
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

function isContainerType(type: LayoutElementType): type is LayoutContainerType {
    return type === "vbox" || type === "hbox";
}

function isContainerElement(element: LayoutElement): element is LayoutElement & {
    type: LayoutContainerType;
    layout: LayoutContainerConfig;
    children: string[];
} {
    return isContainerType(element.type) && !!element.layout && Array.isArray(element.children);
}

function getContainerAlignLabel(type: LayoutContainerType, align: LayoutContainerAlign): string {
    if (type === "vbox") {
        switch (align) {
            case "start":
                return "Links ausgerichtet";
            case "center":
                return "Zentriert";
            case "end":
                return "Rechts ausgerichtet";
            case "stretch":
                return "Breite gestreckt";
        }
    } else {
        switch (align) {
            case "start":
                return "Oben ausgerichtet";
            case "center":
                return "Vertikal zentriert";
            case "end":
                return "Unten ausgerichtet";
            case "stretch":
                return "Höhe gestreckt";
        }
    }
    return "";
}
