// plugins/layout-editor/src/creature-import.ts
import { Notice } from "obsidian";
import { MIN_ELEMENT_SIZE } from "./definitions";
import type { LayoutElement } from "./types";

export interface CreatureImportContext {
    setCanvasSize(width: number, height: number): void;
    updateCanvasInputs(width: number, height: number): void;
    setElements(elements: LayoutElement[]): void;
    applyCanvasSize(): void;
    renderElements(): void;
    renderInspector(): void;
    refreshExport(): void;
    updateStatus(): void;
    pushHistory(): void;
}

const DEFAULT_CANVAS = { width: 960, height: 1480 };

const CREATURE_BLUEPRINT: LayoutElement[] = [
    {
        id: "creature-title",
        type: "label",
        x: 40,
        y: 40,
        width: 880,
        height: 90,
        label: "Kreatur",
        description: "Name oder Überschrift des Statblocks",
        attributes: [],
    },
    {
        id: "creature-meta",
        type: "text-input",
        x: 40,
        y: 150,
        width: 420,
        height: 110,
        label: "Grundwerte",
        placeholder: "Typ, Gesinnung, Größe …",
        attributes: [],
    },
    {
        id: "creature-ac",
        type: "text-input",
        x: 500,
        y: 150,
        width: 420,
        height: 110,
        label: "Rüstungsklasse",
        placeholder: "AC",
        attributes: [],
    },
    {
        id: "creature-hp",
        type: "text-input",
        x: 40,
        y: 280,
        width: 420,
        height: 110,
        label: "Trefferpunkte",
        placeholder: "HP",
        attributes: [],
    },
    {
        id: "creature-speed",
        type: "text-input",
        x: 500,
        y: 280,
        width: 420,
        height: 110,
        label: "Bewegung",
        placeholder: "Geschwindigkeit",
        attributes: [],
    },
    {
        id: "creature-separator",
        type: "separator",
        x: 40,
        y: 420,
        width: 880,
        height: 60,
        label: "",
        attributes: [],
    },
    {
        id: "creature-abilities",
        type: "textarea",
        x: 40,
        y: 500,
        width: 420,
        height: 220,
        label: "Attribute & Saves",
        placeholder: "STR, DEX, CON …",
        attributes: [],
    },
    {
        id: "creature-defenses",
        type: "textarea",
        x: 500,
        y: 500,
        width: 420,
        height: 220,
        label: "Verteidigungen & Sinne",
        placeholder: "Resistenzen, Immunitäten, Sinne",
        attributes: [],
    },
    {
        id: "creature-traits",
        type: "textarea",
        x: 40,
        y: 740,
        width: 880,
        height: 240,
        label: "Eigenschaften",
        placeholder: "Besondere Fähigkeiten & Traits",
        attributes: [],
    },
    {
        id: "creature-actions",
        type: "textarea",
        x: 40,
        y: 1000,
        width: 880,
        height: 220,
        label: "Aktionen",
        placeholder: "Angriffe, Aktionen, Multiattacke",
        attributes: [],
    },
    {
        id: "creature-reactions",
        type: "textarea",
        x: 40,
        y: 1240,
        width: 880,
        height: 180,
        label: "Reaktionen & Legendäre Aktionen",
        placeholder: "Reaktionen, legendäre Aktionen, Mythische Aktionen",
        attributes: [],
    },
    {
        id: "creature-spells",
        type: "textarea",
        x: 40,
        y: 1440,
        width: 880,
        height: 200,
        label: "Zauber & Notizen",
        placeholder: "Zauberlisten, Anmerkungen",
        attributes: [],
    },
];

export async function importCreatureLayout(
    context: CreatureImportContext,
    options?: { silent?: boolean },
) {
    try {
        const normalized = CREATURE_BLUEPRINT.map(element => normalizeElement(element));
        const height = Math.max(DEFAULT_CANVAS.height, ...normalized.map(el => el.y + el.height + 40));
        const width = Math.max(DEFAULT_CANVAS.width, ...normalized.map(el => el.x + el.width + 40));

        context.setCanvasSize(width, height);
        context.updateCanvasInputs(width, height);
        context.setElements(normalized);
        context.applyCanvasSize();
        context.renderElements();
        context.renderInspector();
        context.refreshExport();
        context.updateStatus();
        context.pushHistory();

        if (!options?.silent) new Notice("Creature-Layout importiert");
    } catch (error) {
        console.error("importCreatureLayout", error);
        if (!options?.silent) new Notice("Konnte Creature-Layout nicht importieren");
    }
}

function normalizeElement(element: LayoutElement): LayoutElement {
    return {
        ...element,
        width: Math.max(MIN_ELEMENT_SIZE, Math.round(element.width)),
        height: Math.max(MIN_ELEMENT_SIZE, Math.round(element.height)),
        x: Math.max(0, Math.round(element.x)),
        y: Math.max(0, Math.round(element.y)),
        attributes: element.attributes ?? [],
    };
}
