// src/workmodes/library/creatures/create-spec.ts
// Declarative field specification for creature creation using modular sections

import { creatureSchema } from "./create-spec-schema";
import { abilitiesFields } from "./create-spec-sections/abilities";
import { basicInfoFields } from "./create-spec-sections/basic-info";
import { combatStatsFields } from "./create-spec-sections/combat-stats";
import { entriesFields } from "./create-spec-sections/entries";
import { equipmentFields } from "./create-spec-sections/equipment";
import { habitatFields } from "./create-spec-sections/habitat";
import { movementFields } from "./create-spec-sections/movement";
import { resistancesFields } from "./create-spec-sections/resistances";
import { sensesLanguagesFields } from "./create-spec-sections/senses-languages";
import { skillsFields } from "./create-spec-sections/skills";
import { spellcastingFields } from "./create-spec-sections/spellcasting";
// Serializer removed - using SQLite backend
import type { StatblockData } from "./creature-types";
import type { CreateSpec } from "@features/data-manager/data-manager-types";
import { createVirtualFilePostSaveHook } from "../core/virtual-file-hooks";

// ============================================================================
// MAIN CREATE SPEC
// ============================================================================

export const creatureSpec: CreateSpec<StatblockData> = {
  kind: "creature",
  title: "Kreatur erstellen",
  subtitle: "Neue Kreatur für deine Kampagne",
  schema: creatureSchema,
  fields: [
    ...basicInfoFields,
    ...combatStatsFields,
    ...movementFields,
    ...abilitiesFields,
    ...skillsFields,
    ...sensesLanguagesFields,
    ...habitatFields,
    ...resistancesFields,
    ...equipmentFields,
    ...spellcastingFields,
    ...entriesFields,
  ],
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Creatures/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Creatures",
    preserveCase: true,
    frontmatter: [
      "name", "size", "type", "typeTags",
      "alignmentLawChaos", "alignmentGoodEvil", "alignmentOverride",
      "ac", "initiative", "hp", "hitDice",
      "speeds", "abilities", "pb", "saves", "skills",
      "sensesList", "languagesList", "passivesList",
      "climatePreference", "terrainPreference", "weatherPreference", "activityPeriod",
      "damageVulnerabilitiesList", "damageResistancesList",
      "damageImmunitiesList", "conditionImmunitiesList",
      "gearList", "cr", "xp",
      "entries", "spellcasting"
    ],
    // SQLite backend - no bodyTemplate needed
  },
  ui: {
    submitLabel: "Kreatur erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: true,
    sections: [
      {
        id: "basic",
        label: "Grunddaten",
        description: "Name, Größe, Typ und Gesinnung",
        fieldIds: ["name", "size", "alignmentLawChaos", "alignmentGoodEvil", "alignmentOverride", "type", "typeTags"],
      },
      {
        id: "combat",
        label: "Kampfwerte",
        description: "AC, HP, Initiative und CR",
        fieldIds: ["ac", "initiative", "hp", "hitDice", "cr", "xp", "pb"],
      },
      {
        id: "abilities",
        label: "Attribute",
        description: "Grundattribute und Modifikatoren",
        fieldIds: ["abilities"],
      },
      {
        id: "senses",
        label: "Fähigkeiten",
        description: "Bewegungsraten, Fertigkeiten, Sinneswahrnehmungen und Kommunikation",
        fieldIds: ["speeds", "skills", "sensesList", "passivesList", "languagesList"],
      },
      {
        id: "habitat",
        label: "Habitat & Umgebung",
        description: "Klima, Terrain, Wetter und Aktivitätszeiten",
        fieldIds: ["climatePreference", "terrainPreference", "weatherPreference", "activityPeriod"],
      },
      {
        id: "resistances",
        label: "Widerstände",
        description: "Schadenswiderstände und Immunitäten",
        fieldIds: ["damageVulnerabilitiesList", "damageResistancesList", "damageImmunitiesList", "conditionImmunitiesList"],
      },
      {
        id: "equipment",
        label: "Ausrüstung",
        description: "Gegenstände und Ausrüstung",
        fieldIds: ["gearList"],
      },
      {
        id: "spellcasting",
        label: "Zauber & Zauberwirken",
        description: "Zaubersprüche und Zauberfähigkeiten",
        fieldIds: ["spellcastingEntries"],
      },
      {
        id: "entries",
        label: "Eigenschaften & Aktionen",
        description: "Spezialfähigkeiten, Angriffe und Reaktionen (ohne Zauber)",
        fieldIds: ["entries"],
      },
    ],
  },
  // Browse configuration - replaces view-config.ts and list-schema.ts
  browse: {
    metadata: [
      {
        id: "type",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.type,
      },
      {
        id: "cr",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.cr ? `CR ${entry.cr}` : undefined,
      },
    ],
    filters: [
      { id: "type", field: "type", label: "Type", type: "string" },
      {
        id: "cr",
        field: "cr",
        label: "CR",
        type: "custom",
        sortComparator: (a: string, b: string) => {
          const parseCr = (value?: string): number => {
            if (!value) return Number.POSITIVE_INFINITY;
            if (value.includes("/")) {
              const [num, denom] = value.split("/").map(part => Number(part.trim()));
              if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
                return num / denom;
              }
            }
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
          };
          return parseCr(a) - parseCr(b);
        },
      },
    ],
    sorts: [
      { id: "name", label: "Name", field: "name" },
      { id: "type", label: "Type", field: "type" },
      {
        id: "cr",
        label: "CR",
        compareFn: (a, b) => {
          const parseCr = (value?: string): number => {
            if (!value) return Number.POSITIVE_INFINITY;
            if (value.includes("/")) {
              const [num, denom] = value.split("/").map(part => Number(part.trim()));
              if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
                return num / denom;
              }
            }
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
          };
          return parseCr(a.cr) - parseCr(b.cr) || a.name.localeCompare(b.name);
        },
      },
    ],
    search: ["type", "cr"],
  },
  // Loader configuration - replaces loader.ts (uses auto-loader by default)
  loader: {
    fromFrontmatter: (fm, file) => {
      // Helper: Strip " ft." from values since UI adds it via valueConfig.unit
      const stripUnit = (value: string): string => {
        if (!value) return '';
        return value.replace(/\s*ft\.?$/i, '').trim();
      };

      // Auto-migrate legacy speeds format to array format
      if (fm.speeds && !Array.isArray(fm.speeds)) {
        const oldSpeeds = fm.speeds as any;
        const newSpeeds: Array<{type: string; value: string; hover?: boolean}> = [];

        // Convert known speed types
        const speedTypes = ['walk', 'burrow', 'climb', 'fly', 'swim'];
        for (const type of speedTypes) {
          if (oldSpeeds[type]?.distance) {
            const entry: any = {
              type,
              value: stripUnit(oldSpeeds[type].distance),  // Strip unit
            };
            if (type === 'fly' && oldSpeeds[type].hover === true) {
              entry.hover = true;
            }
            newSpeeds.push(entry);
          }
        }

        // Convert extras if present
        if (oldSpeeds.extras && Array.isArray(oldSpeeds.extras)) {
          for (const extra of oldSpeeds.extras) {
            if (extra.label && extra.distance) {
              newSpeeds.push({
                type: extra.label,
                value: stripUnit(extra.distance),  // Strip unit
              });
            }
          }
        }

        fm.speeds = newSpeeds.length > 0 ? newSpeeds : undefined;
      }

      // Normalize passivesList: Parse legacy format "Passive Perception 20" → {skill: "Perception", value: "20"}
      if (fm.passivesList && Array.isArray(fm.passivesList)) {
        fm.passivesList = fm.passivesList.map(item => {
          let text: string;

          // Handle both string and {value: "..."} formats
          if (typeof item === 'string') {
            text = item;
          } else if (item && typeof item === 'object' && 'value' in item) {
            text = String(item.value);
          } else if (item && typeof item === 'object' && 'skill' in item && 'value' in item) {
            // Already in new format
            return item;
          } else {
            return item;
          }

          // Parse "Passive Perception 20" format
          const match = text.match(/^Passive\s+(\w+)\s+(\d+)$/i);
          if (match) {
            return {
              skill: match[1], // e.g., "Perception"
              value: match[2], // e.g., "20"
            };
          }

          // Fallback: if no match, try to salvage what we can
          return {
            skill: "Perception",
            value: text.replace(/\D/g, '') || "10",
          };
        });
      }

      // Normalize languagesList: Clean up Obsidian's YAML parsing quirks
      // Obsidian merges keys from adjacent list items, so we need to separate them
      if (fm.languagesList && Array.isArray(fm.languagesList)) {
        fm.languagesList = fm.languagesList.map(item => {
          if (typeof item === 'string') {
            return { value: item };
          }

          // Remove empty/whitespace-only fields
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' && value.trim() === '') {
              continue;
            }
            cleaned[key] = value;
          }

          // If token has BOTH value AND type, but value looks like a language name
          // (not empty), then this is a case where Obsidian merged two tokens
          // Keep only the value field for simple language tokens
          if (cleaned.value && cleaned.type && !cleaned.range) {
            // This is likely a simple language that got 'type' added from the next token
            return { value: cleaned.value };
          }

          return cleaned;
        });
      }

      // Normalize sensesList: Same treatment as languagesList
      if (fm.sensesList && Array.isArray(fm.sensesList)) {
        fm.sensesList = fm.sensesList.map(item => {
          if (typeof item === 'string') {
            return { value: item };
          }

          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' && value.trim() === '') {
              continue;
            }
            cleaned[key] = value;
          }

          return cleaned;
        });
      }

      // Flatten nested entry structures for UI compatibility
      if (fm.entries && Array.isArray(fm.entries)) {
        fm.entries = fm.entries.map(entry => {
          const flattened: any = {};

          // Helper to flatten nested objects
          const flatten = (obj: any, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
              const newKey = prefix ? `${prefix}.${key}` : key;

              // Special case: save.onSuccess can be string or object
              if (newKey === 'save.onSuccess' && typeof value === 'string') {
                flattened['save.onSuccess.legacyText'] = value;
                continue;
              }

              if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Recurse for nested objects (but not arrays)
                flatten(value, newKey);
              } else {
                // Assign primitive or array values
                flattened[newKey] = value;
              }
            }
          };

          flatten(entry);
          return flattened;
        });
      }

      return fm as StatblockData;
    },
  },
  transformers: {
    postSave: createVirtualFilePostSaveHook("creatures"),
  },
};
