// src/apps/layout/editor/definitions.ts
import { LayoutContainerAlign, LayoutContainerConfig, LayoutElementDefinition, LayoutElementType } from "./types";

export const MIN_ELEMENT_SIZE = 60;

export const ELEMENT_DEFINITIONS: LayoutElementDefinition[] = [
    {
        type: "label",
        buttonLabel: "Label",
        defaultLabel: "Überschrift",
        width: 260,
        height: 160,
    },
    {
        type: "text-input",
        buttonLabel: "Textfeld",
        defaultLabel: "",
        defaultPlaceholder: "",
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

export const ELEMENT_DEFINITION_LOOKUP = new Map<LayoutElementType, LayoutElementDefinition>(
    ELEMENT_DEFINITIONS.map(def => [def.type, def]),
);

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

export function getContainerAlignLabel(type: LayoutContainerType, align: LayoutContainerAlign): string {
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

export function getAttributeSummary(attributes: string[]): string {
    if (!attributes.length) return "Attribute wählen…";
    return attributes.map(attr => ATTRIBUTE_LABEL_LOOKUP.get(attr) ?? attr).join(", ");
}

export function getElementTypeLabel(type: LayoutElementType): string {
    return ELEMENT_DEFINITION_LOOKUP.get(type)?.buttonLabel ?? type;
}

export function isContainerType(type: LayoutElementType): type is LayoutContainerType {
    return type === "vbox" || type === "hbox";
}

export function ensureContainerDefaults(config: LayoutElementDefinition): LayoutContainerConfig | undefined {
    return config.defaultLayout ? { ...config.defaultLayout } : undefined;
}
