// src/workmodes/library/locations/create-spec.ts
// Declarative CreateSpec for locations in the library workmode

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../features/data-manager/types";
import type { LocationData, LocationType, OwnerType } from "./types";
import { LOCATION_TYPES, OWNER_TYPES, OWNER_TYPE_LABELS } from "./constants";
import { locationToMarkdown } from "./serializer";

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
