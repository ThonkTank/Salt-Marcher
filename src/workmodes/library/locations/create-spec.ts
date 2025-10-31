// src/workmodes/library/locations/create-spec.ts
// Declarative CreateSpec for locations in the library workmode

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../features/data-manager/types";
import type { LocationData, LocationType, OwnerType } from "./types";
import { LOCATION_TYPES, OWNER_TYPES, OWNER_TYPE_LABELS } from "./constants";
import { locationToMarkdown } from "./serializer";
import { BUILDING_TEMPLATES } from "../../../features/locations/building-production";

// ============================================================================
// SCHEMA
// ============================================================================

const locationSchema: DataSchema<LocationData> = {
    parse: (data: unknown) => data as LocationData,
    safeParse: (data: unknown) => {
        try {
            if (!data || typeof data !== "object") {
                throw new Error("Location data must be an object");
            }

            const location = data as LocationData;

            if (typeof location.name !== "string" || location.name.trim().length === 0) {
                throw new Error("Name is required");
            }

            if (typeof location.type !== "string" || location.type.trim().length === 0) {
                throw new Error("Type is required");
            }

            return { success: true, data: location };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    },
};

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const fields: AnyFieldSpec[] = [
    {
        id: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "Die Taverne zum Goldenen Drachen",
        description: "Name des Ortes",
    },
    {
        id: "type",
        label: "Typ",
        type: "select",
        required: true,
        options: LOCATION_TYPES.map(type => ({ value: type, label: type })),
        default: "Gebäude",
        description: "Art des Ortes",
    },
    {
        id: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Eine gemütliche Taverne im Herzen der Stadt...",
        description: "Ausführliche Beschreibung des Ortes",
    },
    {
        id: "parent",
        label: "Übergeordneter Ort",
        type: "text",
        placeholder: "Marktplatz-Viertel",
        description: "Name des übergeordneten Ortes (für Hierarchie)",
    },
    {
        id: "owner_type",
        label: "Besitzertyp",
        type: "select",
        options: OWNER_TYPES.map(type => ({
            value: type,
            label: OWNER_TYPE_LABELS[type],
        })),
        default: "none",
        description: "Wer besitzt oder kontrolliert diesen Ort?",
    },
    {
        id: "owner_name",
        label: "Besitzer Name",
        type: "text",
        placeholder: "Die Schildbrüder",
        description: "Name der Fraktion oder des NPCs (falls zutreffend)",
    },
    {
        id: "region",
        label: "Region",
        type: "text",
        placeholder: "Salzmarsch",
        description: "Optionale Regionszuordnung",
    },
    {
        id: "coordinates",
        label: "Koordinaten",
        type: "text",
        placeholder: "12,34",
        description: "Optionale Hex-Koordinaten (Format: X,Y)",
    },
    {
        id: "notes",
        label: "Notizen",
        type: "textarea",
        placeholder: "Wichtige Details, Geheimnisse, Hooks...",
        description: "Zusätzliche Notizen und Informationen",
    },
    // Dungeon-specific fields (only visible when type === "Dungeon")
    {
        id: "grid_width",
        label: "Rasterbreite",
        type: "number-stepper",
        min: 5,
        max: 100,
        step: 5,
        default: 30,
        placeholder: "30",
        description: "Breite des Dungeon-Rasters (Anzahl Zellen)",
        visibleIf: (values) => values.type === "Dungeon",
        dependsOn: ["type"],
    },
    {
        id: "grid_height",
        label: "Rasterhöhe",
        type: "number-stepper",
        min: 5,
        max: 100,
        step: 5,
        default: 20,
        placeholder: "20",
        description: "Höhe des Dungeon-Rasters (Anzahl Zellen)",
        visibleIf: (values) => values.type === "Dungeon",
        dependsOn: ["type"],
    },
    {
        id: "cell_size",
        label: "Zellgröße",
        type: "number-stepper",
        min: 20,
        max: 80,
        step: 5,
        default: 40,
        placeholder: "40",
        description: "Größe einer Rasterzelle in Pixeln (Standard: 40)",
        visibleIf: (values) => values.type === "Dungeon",
        dependsOn: ["type"],
    },
    // Building-specific fields (only visible when type === "Gebäude")
    {
        id: "building_production.buildingType",
        label: "Gebäudetyp",
        type: "select",
        required: false,
        options: Object.keys(BUILDING_TEMPLATES).map(key => ({
            value: key,
            label: BUILDING_TEMPLATES[key].name,
        })),
        placeholder: "Wähle einen Gebäudetyp",
        description: "Art des Gebäudes (bestimmt erlaubte Jobs und Produktion)",
        visibleIf: (values) => values.type === "Gebäude",
        dependsOn: ["type"],
    },
    {
        id: "building_production.condition",
        label: "Zustand",
        type: "number-stepper",
        min: 0,
        max: 100,
        step: 1,
        default: 100,
        placeholder: "100",
        description: "Gebäudezustand (0-100%, beeinflusst Produktionsrate)",
        visibleIf: (values) => values.type === "Gebäude" && !!values.building_production?.buildingType,
        dependsOn: ["type", "building_production.buildingType"],
    },
    {
        id: "building_production.maintenanceOverdue",
        label: "Wartung überfällig",
        type: "number-stepper",
        min: 0,
        max: 365,
        step: 1,
        default: 0,
        placeholder: "0",
        description: "Tage seit fälliger Wartung (reduziert Produktionsrate um -5%/Tag, max -50%)",
        visibleIf: (values) => values.type === "Gebäude" && !!values.building_production?.buildingType,
        dependsOn: ["type", "building_production.buildingType"],
    },
    {
        id: "building_production.currentWorkers",
        label: "Aktuelle Arbeiter",
        type: "number-stepper",
        min: 0,
        max: 100,
        step: 1,
        default: 0,
        placeholder: "0",
        description: "Anzahl der zugewiesenen Arbeiter (max. durch Gebäudetyp begrenzt)",
        visibleIf: (values) => values.type === "Gebäude" && !!values.building_production?.buildingType,
        dependsOn: ["type", "building_production.buildingType"],
    },
];

// ============================================================================
// SPEC
// ============================================================================

export const locationSpec: CreateSpec<LocationData> = {
    kind: "location",
    title: "Ort erstellen",
    subtitle: "Neuer Ort für deine Kampagne",
    schema: locationSchema,
    fields,
    storage: {
        format: "md-frontmatter",
        pathTemplate: "SaltMarcher/Locations/{name}.md",
        filenameFrom: "name",
        directory: "SaltMarcher/Locations",
        frontmatter: [
            "name",
            "type",
            "parent",
            "owner_type",
            "owner_name",
            "region",
            "coordinates",
            "description",
            "notes",
            "grid_width",
            "grid_height",
            "cell_size",
            "rooms",
            "tokens",
            "building_production",
        ],
        bodyTemplate: (data) => locationToMarkdown(data as LocationData),
    },
    ui: {
        submitLabel: "Ort speichern",
        cancelLabel: "Abbrechen",
    },
    browse: {
        metadata: [
            {
                id: "type",
                cls: "sm-cc-item__type",
                getValue: (entry) => entry.type || "—",
            },
            {
                id: "owner",
                cls: "sm-cc-item__cr",
                getValue: (entry) => {
                    if (!entry.owner_type || entry.owner_type === "none") return "Kein Besitzer";
                    const ownerName = entry.owner_name?.trim() || "—";
                    const ownerLabel = OWNER_TYPE_LABELS[entry.owner_type as OwnerType];
                    return `${ownerLabel}: ${ownerName}`;
                },
            },
            {
                id: "parent",
                cls: "sm-cc-item__meta",
                getValue: (entry) => {
                    if (!entry.parent) return "Top-Level";
                    return `In: ${entry.parent}`;
                },
            },
            {
                id: "grid_size",
                cls: "sm-cc-item__meta sm-cc-item__grid-badge",
                getValue: (entry) => {
                    if (!entry.grid_size) return null;
                    return `⬚ ${entry.grid_size}`;
                },
            },
            {
                id: "building_status",
                cls: "sm-cc-item__meta sm-cc-item__building-status",
                getValue: (entry) => {
                    if (entry.type !== "Gebäude" || !entry.building_production) return null;

                    const prod = entry.building_production;
                    const template = BUILDING_TEMPLATES[prod.buildingType];
                    if (!template) return null;

                    // Condition indicator: 🟢 80-100%, 🟡 40-79%, 🔴 0-39%
                    const conditionIcon = prod.condition >= 80 ? "🟢" : prod.condition >= 40 ? "🟡" : "🔴";

                    return `${conditionIcon} ${template.name} (${prod.condition}%) • ${prod.currentWorkers}/${template.maxWorkers} workers`;
                },
            },
        ],
        filters: [
            { id: "type", field: "type", label: "Typ", type: "string" },
            { id: "owner_type", field: "owner_type", label: "Besitzertyp", type: "string" },
            { id: "owner_name", field: "owner_name", label: "Besitzer", type: "string" },
            { id: "region", field: "region", label: "Region", type: "string" },
            { id: "parent", field: "parent", label: "Übergeordneter Ort", type: "string" },
        ],
        sorts: [
            { id: "name", label: "Name", field: "name" },
            { id: "type", label: "Typ", field: "type" },
            { id: "owner", label: "Besitzer", field: "owner_name" },
        ],
    },
};
