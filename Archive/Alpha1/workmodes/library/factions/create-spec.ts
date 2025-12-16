// src/workmodes/library/entities/factions/create-spec.ts
// Declarative CreateSpec for factions in the library workmode

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-factions');
import {
  FACTION_INFLUENCE_TAGS,
  FACTION_CULTURE_TAGS,
  FACTION_GOAL_TAGS,
  FACTION_MEMBER_ROLES,
  FACTION_MEMBER_STATUSES,
  FACTION_JOB_TYPES,
  FACTION_POSITION_TYPES,
  FACTION_RELATIONSHIP_TYPES,
  FACTION_RESOURCE_TYPES,
} from "./constants";
// Removed: import { factionToMarkdown } from "../../../features/factions/faction-serializer";
import type { FactionData, FactionMember } from './calendar-types';
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

// ============================================================================
// SCHEMA
// ============================================================================

function isStringArray(value: unknown): value is Array<{ value: string }> {
  return Array.isArray(value) && value.every(entry => {
    if (typeof entry === "string") return entry.trim().length > 0;
    return typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>).value === "string";
  });
}

function normalizeTagArray(value: unknown): Array<{ value: string }> | undefined {
  if (!value) return undefined;
  if (!Array.isArray(value)) return undefined;
  const normalized: Array<{ value: string }> = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      normalized.push({ value: entry.trim() });
    } else if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).value === "string") {
      const val = ((entry as Record<string, unknown>).value as string).trim();
      if (val) normalized.push({ value: val });
    }
  }
  return normalized;
}

function normalizeMembers(value: unknown): FactionMember[] | undefined {
  if (!value) return undefined;
  if (!Array.isArray(value)) return undefined;
  const result: FactionMember[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    result.push({
      name,
      role: typeof record.role === "string" ? record.role.trim() || undefined : undefined,
      status: typeof record.status === "string" ? record.status.trim() || undefined : undefined,
      is_named: typeof record.is_named === "boolean" ? record.is_named : undefined,
      notes: typeof record.notes === "string" ? record.notes.trim() || undefined : undefined,
    });
  }
  return result;
}

const factionSchema: DataSchema<FactionData> = {
  parse: (data: unknown) => data as FactionData,
  safeParse: (data: unknown) => {
    try {
      if (!data || typeof data !== "object") {
        throw new Error("Faction data must be an object");
      }

      const faction = data as FactionData;

      if (typeof faction.name !== "string" || faction.name.trim().length === 0) {
        throw new Error("Name is required");
      }

      if (faction.influence_tags && !isStringArray(faction.influence_tags)) {
        throw new Error("Influence tags must be an array of values");
      }

      if (faction.culture_tags && !isStringArray(faction.culture_tags)) {
        throw new Error("Culture tags must be an array of values");
      }

      if (faction.goal_tags && !isStringArray(faction.goal_tags)) {
        throw new Error("Goal tags must be an array of values");
      }

      if (faction.members) {
        const members = normalizeMembers(faction.members);
        if (!members) {
          throw new Error("Members must be an array of objects");
        }
        faction.members = members;
      }

      faction.influence_tags = normalizeTagArray(faction.influence_tags) ?? [];
      faction.culture_tags = normalizeTagArray(faction.culture_tags) ?? [];
      faction.goal_tags = normalizeTagArray(faction.goal_tags) ?? [];

      return { success: true, data: faction };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const tagField = (id: string, label: string, suggestions: readonly string[], description: string): AnyFieldSpec => ({
  id,
  label,
  type: "tokens",
  config: {
    fields: [
      {
        id: "value",
        type: "select",
        displayInChip: true,
        editable: true,
        suggestions: suggestions.map(value => ({ key: value, label: value })),
        placeholder: `${label} auswählen…`,
      },
    ],
    primaryField: "value",
  },
  default: [],
  description,
});

const fields: AnyFieldSpec[] = [
  {
    id: "name",
    label: "Name",
    type: "text",
    required: true,
    placeholder: "Die Schildbrüder",
    description: "Name der Fraktion",
  },
  {
    id: "color",
    label: "Grenzfarbe",
    type: "color",
    default: "#f44336",
    description: "Farbe für Fraktionsgrenzen und Labels auf der Karte",
  },
  {
    id: "motto",
    label: "Motto",
    type: "text",
    placeholder: "In Schatten liegt unsere Stärke",
    description: "Optionales Motto oder Leitspruch",
  },
  tagField(
    "influence_tags",
    "Einfluss",
    FACTION_INFLUENCE_TAGS,
    "Welche Bereiche dominiert die Fraktion?"
  ),
  tagField(
    "goal_tags",
    "Ziele",
    FACTION_GOAL_TAGS,
    "Strategische Ziele oder Agenda der Fraktion"
  ),
  tagField(
    "culture_tags",
    "Kultur",
    FACTION_CULTURE_TAGS,
    "Kulturelle Ausrichtung oder Herkunft"
  ),
  {
    id: "headquarters",
    label: "Hauptquartier",
    type: "text",
    placeholder: "Zitadelle von Sturmlicht",
    description: "Zentrale Operationsbasis der Fraktion",
  },
  {
    id: "territory",
    label: "Territorium",
    type: "text",
    placeholder: "Region, Einflussbereich oder Revier",
    description: "Gebiete, die von der Fraktion kontrolliert oder beansprucht werden",
  },
  {
    id: "summary",
    label: "Kurzbeschreibung",
    type: "textarea",
    placeholder: "Kurzprofil der Fraktion, Geschichte oder Ruf…",
    description: "Zusammenfassung für den schnellen Überblick",
  },
  {
    id: "assets",
    label: "Ressourcen & Besitz",
    type: "textarea",
    placeholder: "Truppenstärke, finanzielle Mittel, Artefakte…",
    description: "Wichtige Ressourcen, Besitz oder militärische Stärke",
  },
  {
    id: "relationships",
    label: "Beziehungen (Legacy)",
    type: "textarea",
    placeholder: "Wichtige Bündnisse, Rivalitäten oder Verpflichtungen…",
    description: "Freitext-Beziehungen (Legacy-Feld)",
    visibleIf: (values) => Boolean(values.relationships),
  },
  {
    id: "resources",
    label: "Ressourcen",
    type: "repeating",
    description: "Strukturiertes Ressourcen-Tracking (Gold, Food, Equipment, etc.)",
    config: {
      insertPosition: "end",
      synchronizeWidths: true,
    },
    itemTemplate: {
      type: {
        type: "select",
        label: "Typ",
        options: FACTION_RESOURCE_TYPES.map(type => ({ value: type, label: type })),
        required: true,
      },
      amount: {
        type: "number-stepper",
        label: "Menge",
        min: 0,
        max: 999999,
        default: 0,
      },
    },
    default: [],
  },
  {
    id: "faction_relationships",
    label: "Fraktionsbeziehungen",
    type: "repeating",
    description: "Strukturierte Beziehungen zu anderen Fraktionen",
    config: {
      insertPosition: "end",
      synchronizeWidths: true,
    },
    itemTemplate: {
      faction_name: {
        type: "text",
        label: "Fraktion",
        placeholder: "Name der anderen Fraktion",
        required: true,
      },
      value: {
        type: "number-stepper",
        label: "Wert",
        min: -100,
        max: 100,
        default: 0,
        help: "-100 (feindlich) bis +100 (verbündet)",
      },
      type: {
        type: "select",
        label: "Typ",
        options: FACTION_RELATIONSHIP_TYPES.map(type => ({ value: type, label: type })),
      },
      notes: {
        type: "textarea",
        label: "Notizen",
        placeholder: "Details zur Beziehung…",
      },
    },
    default: [],
  },
  {
    id: "members",
    label: "Mitglieder & Einheiten",
    type: "repeating",
    description: "Benannte NSCs oder Einheitentypen mit Positions- und Job-Tracking",
    config: {
      insertPosition: "end",
      synchronizeWidths: false,
    },
    itemTemplate: {
      name: {
        type: "text",
        label: "Name / Einheit",
        placeholder: "Captain Thorne / Goblin Warrior",
        required: true,
      },
      is_named: {
        type: "toggle",
        label: "Benannter NSC",
        default: true,
        help: "Benannte NSCs vs. Einheitentypen mit Menge",
      },
      quantity: {
        type: "number-stepper",
        label: "Anzahl",
        min: 1,
        max: 9999,
        default: 1,
        visibleIf: (data) => !data.is_named,
        help: "Nur für Einheitentypen (nicht benannte NSCs)",
      },
      statblock_ref: {
        type: "text",
        label: "Statblock-Referenz",
        placeholder: "Goblin / Guard",
        help: "Name des Creature-Statblocks aus der Library",
      },
      role: {
        type: "text",
        label: "Rolle",
        placeholder: "Spymaster",
        config: {
          suggestions: FACTION_MEMBER_ROLES.map(role => ({ key: role, label: role })),
        },
      },
      status: {
        type: "select",
        label: "Status",
        options: FACTION_MEMBER_STATUSES.map(status => ({ value: status, label: status })),
      },
      "position.type": {
        type: "select",
        label: "Position-Typ",
        options: FACTION_POSITION_TYPES.map(type => ({ value: type, label: type })),
        default: "unassigned",
      },
      "position.location_name": {
        type: "text",
        label: "Ort",
        placeholder: "Camp Alpha / Zitadelle",
        visibleIf: (data) => data["position.type"] === "poi",
      },
      "position.coords.q": {
        type: "number-stepper",
        label: "Hex Q",
        min: -100,
        max: 100,
        visibleIf: (data) => data["position.type"] === "hex",
      },
      "position.coords.r": {
        type: "number-stepper",
        label: "Hex R",
        min: -100,
        max: 100,
        visibleIf: (data) => data["position.type"] === "hex",
      },
      "position.coords.s": {
        type: "number-stepper",
        label: "Hex S",
        min: -100,
        max: 100,
        visibleIf: (data) => data["position.type"] === "hex",
      },
      "position.route": {
        type: "text",
        label: "Expeditionsroute",
        placeholder: "Norden via Wald",
        visibleIf: (data) => data["position.type"] === "expedition",
      },
      "job.type": {
        type: "select",
        label: "Job-Typ",
        options: FACTION_JOB_TYPES.map(type => ({ value: type, label: type })),
      },
      "job.building": {
        type: "text",
        label: "Gebäude",
        placeholder: "Schmiede / Wachturm",
        visibleIf: (data) => Boolean(data["job.type"]),
      },
      "job.progress": {
        type: "number-stepper",
        label: "Fortschritt %",
        min: 0,
        max: 100,
        default: 0,
        visibleIf: (data) => Boolean(data["job.type"]),
      },
      notes: {
        type: "textarea",
        label: "Notizen",
        placeholder: "Besonderheiten, Loyalität, Geheimnisse…",
      },
    },
    default: [],
  },
];

// ============================================================================
// SPEC
// ============================================================================

export const factionSpec: CreateSpec<FactionData> = {
  kind: "faction",
  title: "Fraktion erstellen",
  subtitle: "Neue Organisation für deine Kampagne",
  schema: factionSchema,
  fields,
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Factions/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Factions",
    frontmatter: [
      "name",
      "color",
      "motto",
      "headquarters",
      "territory",
      "influence_tags",
      "goal_tags",
      "culture_tags",
      "summary",
      "assets",
      "relationships",
      "resources",
      "faction_relationships",
      "members",
    ],
    // Plan system removed - simplified save/load
    save: (data: FactionData) => {
      return { ...data };
    },
    load: (fm: Record<string, unknown>) => {
      return { ...fm } as FactionData;
    },
  },
  ui: {
    submitLabel: "Fraktion speichern",
    cancelLabel: "Abbrechen",
  },
  browse: {
    metadata: [
      {
        id: "primaryInfluence",
        cls: "sm-cc-item__type",
        getValue: (entry) => {
          const tags = entry.influence_tags as Array<{ value: string }> | undefined;
          if (!tags || tags.length === 0) return "Neutral";
          const first = tags[0];
          return typeof first === "string" ? first : first?.value || "Neutral";
        },
      },
      {
        id: "headquarters",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.headquarters || "Unbekannter Sitz",
      },
      {
        id: "memberCount",
        cls: "sm-cc-item__meta",
        getValue: (entry) => {
          const list = Array.isArray(entry.members) ? entry.members : [];
          return `${list.length} Mitglieder`;
        },
      },
    ],
    filters: [
      { id: "influence_tags", field: "influence_tags", label: "Einfluss", type: "array" },
      { id: "goal_tags", field: "goal_tags", label: "Ziele", type: "array" },
      { id: "culture_tags", field: "culture_tags", label: "Kultur", type: "array" },
      { id: "headquarters", field: "headquarters", label: "Hauptquartier", type: "string" },
      { id: "territory", field: "territory", label: "Territorium", type: "string" },
    ],
    sorts: [
      { id: "name", label: "Name", field: "name" },
      { id: "primaryInfluence", label: "Einfluss", field: "influence_tags" },
      { id: "memberCount", label: "Mitgliederzahl", field: "members" },
    ],
  },
};
