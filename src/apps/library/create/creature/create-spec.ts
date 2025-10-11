// src/apps/library/create/creature/create-spec.ts
// Stellt das deklarative Create-Spec für neue Kreaturen bereit.
import { normalizePath, type App } from "obsidian";
import {
  type CreateSpec,
  type DataSchema,
} from "../../../../ui/workmode/create";
import {
  ensureCreatureDir,
  sanitizeFileName,
  statblockToMarkdown,
  type StatblockData,
} from "../../core/creature-files";
import {
  collectEntryDependencyIssues,
  collectStatsAndSkillsIssues,
  mountCreatureClassificationSection,
  mountCreatureSensesAndDefensesSection,
  mountCreatureStatsAndSkillsSection,
  mountCreatureVitalSection,
  mountEntriesSection,
} from "./sections";

const CREATURES_DIR = "SaltMarcher/Creatures" as const;

type CreatureDraft = StatblockData & { existingFilePath?: string | null };

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeList(values?: string[]): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const trimmed = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => Boolean(value));
  return trimmed.length ? trimmed : undefined;
}

function trimField<T extends Record<string, unknown>>(target: T, key: keyof T): void {
  const value = target[key];
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed) {
    (target as Record<string, unknown>)[key] = trimmed;
  } else {
    delete (target as Record<string, unknown>)[key];
  }
}

class CreatureSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatureSchemaError";
  }
}

function sanitizeStatblock(source: CreatureDraft): CreatureDraft {
  const data = deepClone(source) as CreatureDraft;
  data.name = (data.name ?? "").trim();
  if (!data.name) {
    throw new CreatureSchemaError("Name ist erforderlich");
  }

  const simpleFields: (keyof StatblockData)[] = [
    "size",
    "type",
    "alignmentLawChaos",
    "alignmentGoodEvil",
    "alignmentOverride",
    "ac",
    "initiative",
    "hp",
    "hitDice",
    "cr",
    "xp",
    "traits",
    "actions",
    "legendary",
    "pb",
  ];
  for (const key of simpleFields) {
    trimField(data as Record<string, unknown>, key);
  }

  const listFields: (keyof StatblockData)[] = [
    "typeTags",
    "sensesList",
    "languagesList",
    "passivesList",
    "damageVulnerabilitiesList",
    "damageResistancesList",
    "damageImmunitiesList",
    "conditionImmunitiesList",
    "gearList",
  ];
  for (const key of listFields) {
    const normalized = normalizeList((data as Record<string, unknown>)[key] as string[] | undefined);
    if (normalized) {
      (data as Record<string, unknown>)[key] = normalized;
    } else {
      delete (data as Record<string, unknown>)[key];
    }
  }

  if (!Array.isArray(data.entries)) {
    data.entries = [];
  }

  const existingPath = typeof source.existingFilePath === "string" ? source.existingFilePath.trim() : undefined;
  if (existingPath) {
    data.existingFilePath = normalizePath(existingPath);
  } else {
    delete data.existingFilePath;
  }

  return data;
}

const creatureSchema: DataSchema<CreatureDraft, CreatureDraft> = {
  parse: (input) => {
    if (!input || typeof input !== "object") {
      throw new CreatureSchemaError("Ungültige Werte übermittelt");
    }

    const sanitized = sanitizeStatblock(input as CreatureDraft);
    const issues = [
      ...collectStatsAndSkillsIssues(sanitized).map((message) => ({ path: "stats", message })),
      ...collectEntryDependencyIssues(sanitized).map((message) => ({ path: "entries", message })),
    ];

    if (issues.length > 0) {
      const error = new CreatureSchemaError(issues[0]?.message ?? "Ungültige Werte");
      (error as { issues?: Array<{ path: Array<string>; message: string }> }).issues = issues.map(({ path, message }) => ({
        path: [path],
        message,
      }));
      throw error;
    }

    return sanitized;
  },
  safeParse: (value) => {
    try {
      const parsed = creatureSchema.parse(value);
      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error };
    }
  },
};

async function ensureUniquePath(app: App, name: string): Promise<string> {
  const baseName = sanitizeFileName(name);
  const dir = normalizePath(CREATURES_DIR);
  let fileName = `${baseName}.md`;
  let fullPath = normalizePath(`${dir}/${fileName}`);
  let counter = 2;
  while (app.vault.getAbstractFileByPath(fullPath)) {
    fileName = `${baseName} (${counter}).md`;
    fullPath = normalizePath(`${dir}/${fileName}`);
    counter += 1;
  }
  return fullPath;
}

export const CREATURE_CREATE_SPEC: CreateSpec<CreatureDraft, CreatureDraft> = {
  kind: "creature",
  title: "Neuen Statblock erstellen",
  subtitle: "Pflege Grunddaten, Werte und Notizen für deine Kreatur.",
  schema: creatureSchema,
  defaults: ({ presetName }) => ({
    name: presetName?.trim() || "Neue Kreatur",
    entries: [],
  }),
  fields: [
    {
      id: "name",
      label: "Name",
      type: "text",
      required: true,
      default: "Neue Kreatur",
      render: ({ values, registerValidator }) => {
      registerValidator(() => {
        const current = (values as CreatureDraft).name?.trim();
        return current ? [] : ["Name ist erforderlich"];
      });
      return { setErrors: () => undefined };
    },
  },
    {
      id: "stats",
      label: "Attribute & Fertigkeiten",
      type: "object",
      render: ({ values, registerValidator }) => {
        registerValidator(() => collectStatsAndSkillsIssues(values as CreatureDraft));
        return { setErrors: () => undefined };
      },
    },
    {
      id: "entries",
      label: "Einträge",
      type: "array",
      render: ({ values, registerValidator }) => {
        registerValidator(() => collectEntryDependencyIssues(values as CreatureDraft));
        return { setErrors: () => undefined };
      },
    },
  ],
  storage: {
    format: "md-frontmatter",
    pathTemplate: `${CREATURES_DIR}/{slug}`,
    filenameFrom: "name",
    hooks: {
      ensureDirectory: ensureCreatureDir,
      beforeWrite: async (payload, { app, values }) => {
        const draft = values as CreatureDraft | undefined;
        if (!draft) return;
        const { existingFilePath, ...rest } = draft;
        const statblock = rest as StatblockData;
        const normalizedExisting = typeof existingFilePath === "string" && existingFilePath.trim()
          ? normalizePath(existingFilePath)
          : undefined;
        payload.path = normalizedExisting ?? (await ensureUniquePath(app, statblock.name));
        payload.content = statblockToMarkdown(statblock);
        payload.metadata = { ...(payload.metadata ?? {}), values: statblock, format: "md-frontmatter" };
      },
    },
  },
  ui: {
    enableNavigation: true,
    submitLabel: "Erstellen",
    cancelLabel: "Abbrechen",
    sections: [
      {
        id: "identity",
        label: "Grunddaten",
        description: "Name, Typ, Gesinnung und Tags",
        fieldIds: ["name"],
        mount: ({ container, draft, app, registerValidation, renderField, restartWithDraft }) => {
          renderField("name");
          registerValidation(() => {
            const hasName = Boolean(draft.name?.trim());
            return { issues: hasName ? [] : ["Name ist erforderlich"], summary: hasName ? undefined : "Name ist erforderlich" };
          });
          mountCreatureClassificationSection(container, draft, {
            app,
            onPresetSelected: (preset) => {
              if (!preset) return;
              try {
                const sanitized = sanitizeStatblock(preset as CreatureDraft);
                restartWithDraft(sanitized);
              } catch (error) {
                console.error("Konnte Creature-Preset nicht laden", error);
              }
            },
          });
        },
      },
      {
        id: "vitals",
        label: "Vitalwerte",
        description: "AC, HP, Initiative und Bewegung",
        mount: ({ container, draft }) => {
          mountCreatureVitalSection(container, draft);
        },
      },
      {
        id: "stats",
        label: "Attribute & Fertigkeiten",
        description: "Attributswerte, Rettungswürfe und Fertigkeiten",
        fieldIds: ["stats"],
        mount: ({ container, draft, registerValidation, renderField }) => {
          renderField("stats");
          mountCreatureStatsAndSkillsSection(container, draft, registerValidation);
        },
      },
      {
        id: "defenses",
        label: "Sinne & Verteidigungen",
        mount: ({ container, draft }) => {
          mountCreatureSensesAndDefensesSection(container, draft);
        },
      },
      {
        id: "entries",
        label: "Einträge",
        description: "Traits, Aktionen, Bonusaktionen, Reaktionen und Legendäres",
        fieldIds: ["entries"],
        mount: ({ container, draft, registerValidation, renderField }) => {
          renderField("entries");
          mountEntriesSection(container, draft, registerValidation);
        },
      },
    ],
  },
};

