// src/workmodes/library/entities/factions/create-spec.ts
// Declarative CreateSpec for factions in the library workmode

import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../../features/data-manager/types";
import type { FactionData, FactionMember } from "./types";
import {
  FACTION_INFLUENCE_TAGS,
  FACTION_CULTURE_TAGS,
  FACTION_GOAL_TAGS,
  FACTION_MEMBER_ROLES,
  FACTION_MEMBER_STATUSES,
} from "./constants";
import { factionToMarkdown } from "./serializer";

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
    label: "Beziehungen",
    type: "textarea",
    placeholder: "Wichtige Bündnisse, Rivalitäten oder Verpflichtungen…",
    description: "Politische oder persönliche Beziehungen zu anderen Fraktionen",
  },
  {
    id: "members",
    label: "Mitglieder",
    type: "repeating",
    description: "Wichtige Ansprechpartner, Agenten oder Funktionsträger",
    config: {
      insertPosition: "end",
      synchronizeWidths: true,
    },
    itemTemplate: {
      name: {
        type: "text",
        label: "Name",
        placeholder: "Agent Thorne",
        required: true,
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
      is_named: {
        type: "toggle",
        label: "Benannter NSC",
        default: true,
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
      "motto",
      "headquarters",
      "territory",
      "influence_tags",
      "goal_tags",
      "culture_tags",
      "summary",
      "assets",
      "relationships",
      "members",
    ],
    bodyTemplate: (data) => factionToMarkdown(data as FactionData),
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
