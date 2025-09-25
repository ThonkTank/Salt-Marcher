// src/plugins/layout-editor/definitions.ts
import {
    LayoutContainerAlign,
    LayoutContainerConfig,
    LayoutElementDefinition,
    LayoutElementType,
} from "./types";

export const MIN_ELEMENT_SIZE = 60;

export const DEFAULT_ELEMENT_DEFINITIONS: LayoutElementDefinition[] = [
    {
        type: "label",
        buttonLabel: "Label",
        defaultLabel: "Überschrift",
        category: "element",
        paletteGroup: "element",
        width: 260,
        height: 160,
    },
    {
        type: "text-input",
        buttonLabel: "Textfeld",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "",
        width: 260,
        height: 140,
    },
    {
        type: "textarea",
        buttonLabel: "Mehrzeiliges Feld",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Text erfassen…",
        width: 320,
        height: 180,
    },
    {
        type: "box-container",
        buttonLabel: "BoxContainer",
        defaultLabel: "",
        category: "container",
        paletteGroup: "container",
        layoutOrientation: "vertical",
        width: 360,
        height: 220,
        defaultLayout: { gap: 16, padding: 16, align: "stretch" },
    },
    {
        type: "separator",
        buttonLabel: "Trennstrich",
        defaultLabel: "",
        category: "element",
        paletteGroup: "element",
        width: 320,
        height: 80,
    },
    {
        type: "dropdown",
        buttonLabel: "Dropdown",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Option wählen…",
        options: ["Option A", "Option B"],
        width: 260,
        height: 150,
    },
    {
        type: "search-dropdown",
        buttonLabel: "Such-Dropdown",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Suchen…",
        options: ["Erster Eintrag", "Zweiter Eintrag"],
        width: 280,
        height: 160,
    },
    {
        type: "vbox-container",
        buttonLabel: "VBoxContainer",
        defaultLabel: "",
        category: "container",
        paletteGroup: "container",
        layoutOrientation: "vertical",
        defaultDescription: "Ordnet verknüpfte Elemente automatisch untereinander an.",
        width: 340,
        height: 260,
        defaultLayout: { gap: 16, padding: 16, align: "stretch" },
    },
    {
        type: "hbox-container",
        buttonLabel: "HBoxContainer",
        defaultLabel: "",
        category: "container",
        paletteGroup: "container",
        layoutOrientation: "horizontal",
        defaultDescription: "Ordnet verknüpfte Elemente automatisch nebeneinander an.",
        width: 360,
        height: 220,
        defaultLayout: { gap: 16, padding: 16, align: "center" },
    },
];

type RegistryListener = (definitions: LayoutElementDefinition[]) => void;

class LayoutElementRegistry {
    private readonly definitions = new Map<LayoutElementType, LayoutElementDefinition>();
    private readonly listeners = new Set<RegistryListener>();

    constructor(initial: LayoutElementDefinition[]) {
        for (const def of initial) {
            this.definitions.set(def.type, { ...def });
        }
    }

    register(definition: LayoutElementDefinition) {
        this.definitions.set(definition.type, { ...definition });
        this.emit();
    }

    unregister(type: LayoutElementType) {
        if (this.definitions.delete(type)) {
            this.emit();
        }
    }

    replaceAll(definitions: LayoutElementDefinition[]) {
        this.definitions.clear();
        for (const def of definitions) {
            this.definitions.set(def.type, { ...def });
        }
        this.emit();
    }

    getAll(): LayoutElementDefinition[] {
        return Array.from(this.definitions.values());
    }

    get(type: LayoutElementType): LayoutElementDefinition | undefined {
        return this.definitions.get(type);
    }

    onChange(listener: RegistryListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit() {
        const snapshot = this.getAll();
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }
}

const registry = new LayoutElementRegistry(DEFAULT_ELEMENT_DEFINITIONS);

export function getElementDefinitions(): LayoutElementDefinition[] {
    return registry.getAll();
}

export function getElementDefinition(type: LayoutElementType): LayoutElementDefinition | undefined {
    return registry.get(type);
}

export function registerLayoutElementDefinition(definition: LayoutElementDefinition) {
    registry.register(definition);
}

export function unregisterLayoutElementDefinition(type: LayoutElementType) {
    registry.unregister(type);
}

export function resetLayoutElementDefinitions(definitions: LayoutElementDefinition[]) {
    registry.replaceAll(definitions);
}

export function onLayoutElementDefinitionsChanged(listener: RegistryListener): () => void {
    return registry.onChange(listener);
}

export const ATTRIBUTE_GROUPS: Array<{ label: string; options: Array<{ value: string; label: string }> }> = [
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

export const ATTRIBUTE_LABEL_LOOKUP = new Map(
    ATTRIBUTE_GROUPS.flatMap(group => group.options.map(opt => [opt.value, opt.label] as const)),
);

export function isVerticalContainer(type: LayoutContainerType): boolean {
    const definition = registry.get(type);
    if (definition?.layoutOrientation) {
        return definition.layoutOrientation !== "horizontal";
    }
    return type === "box-container" || type === "vbox-container";
}

export function getContainerAlignLabel(type: LayoutContainerType, align: LayoutContainerAlign): string {
    if (isVerticalContainer(type)) {
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

export function getAttributeSummary(attributes: string[]): string {
    if (!attributes.length) return "Attribute wählen…";
    return attributes.map(attr => ATTRIBUTE_LABEL_LOOKUP.get(attr) ?? attr).join(", ");
}

export function getElementTypeLabel(type: LayoutElementType): string {
    return registry.get(type)?.buttonLabel ?? type;
}

export function isContainerType(type: LayoutElementType): boolean {
    const definition = registry.get(type);
    if (definition) {
        return definition.category === "container";
    }
    return type === "box-container" || type === "vbox-container" || type === "hbox-container";
}

export function ensureContainerDefaults(config: LayoutElementDefinition): LayoutContainerConfig | undefined {
    return config.defaultLayout ? { ...config.defaultLayout } : undefined;
}
