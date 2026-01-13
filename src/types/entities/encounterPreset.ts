// Ziel: Unified Encounter Preset Schema fuer authored, template und embedded Encounters
// Siehe: docs/types/encounter-preset.md
//
// Drei Modi:
// - authored: Referenziert existierende NPCs per ID
// - template: Creature-Definitionen mit Count (generiert NPCs zur Runtime)
// - embedded: Vollstaendige NPCs (fuer persistierte generierte Encounters)

import { z } from 'zod';
import {
  narrativeRoleSchema,
  encounterGroupSchema,
  encounterContextSchema,
  encounterDifficultySchema,
} from '../encounterTypes';
import { slotCountSchema } from './groupTemplate';

// ============================================================================
// GROUP SCHEMAS (Mode-spezifisch)
// ============================================================================

/**
 * Authored Group: Referenziert existierende NPCs per ID.
 * Verwendet fuer Tournament-Szenarien und curated Encounters.
 */
export const authoredGroupSchema = z.object({
  groupId: z.string().min(1),
  npcIds: z.array(z.string().min(1)).min(1),
  narrativeRole: narrativeRoleSchema.optional().default('threat'),
  factionId: z.string().optional(),
});
export type AuthoredGroup = z.infer<typeof authoredGroupSchema>;

/**
 * Creature Entry fuer Template Groups.
 */
export const creatureEntrySchema = z.object({
  creatureId: z.string().min(1),
  count: slotCountSchema,
});
export type CreatureEntry = z.infer<typeof creatureEntrySchema>;

/**
 * Template Group: Creature-Definitionen mit Count.
 * Generiert NPCs zur Runtime basierend auf Creature-IDs.
 */
export const templateGroupSchema = z.object({
  groupId: z.string().min(1),
  creatures: z.array(creatureEntrySchema).min(1),
  narrativeRole: narrativeRoleSchema.optional().default('threat'),
  factionId: z.string().optional(),
});
export type TemplateGroup = z.infer<typeof templateGroupSchema>;

/**
 * Embedded Group: Vollstaendige NPCs.
 * Identisch mit EncounterGroup aus encounterTypes.ts.
 * Verwendet fuer persistierte generierte Encounters.
 */
export const embeddedGroupSchema = encounterGroupSchema;
export type EmbeddedGroup = z.infer<typeof embeddedGroupSchema>;

// ============================================================================
// COMBAT CONFIGURATION
// ============================================================================

/**
 * Combat-Konfiguration fuer den Encounter.
 * mapId referenziert eine CombatMap-Factory (z.B. aus presets/combatMaps).
 */
export const encounterCombatConfigSchema = z.object({
  /** Referenz auf CombatMap-Factory (z.B. "1v1 Melee", "Kiting"). */
  mapId: z.string().optional(),
  /** Resource-Budget fuer Spell Slots (0-1, default 1.0). */
  resourceBudget: z.number().min(0).max(1).optional().default(1.0),
  /** Initiale Distanz in Feet (optional, default aus Map oder 60ft). */
  encounterDistanceFeet: z.number().positive().optional(),
});
export type EncounterCombatConfig = z.infer<typeof encounterCombatConfigSchema>;

// ============================================================================
// ENCOUNTER PRESET MODES
// ============================================================================

export const ENCOUNTER_PRESET_MODES = ['authored', 'template', 'embedded'] as const;
export const encounterPresetModeSchema = z.enum(ENCOUNTER_PRESET_MODES);
export type EncounterPresetMode = z.infer<typeof encounterPresetModeSchema>;

// ============================================================================
// ENCOUNTER PRESET
// ============================================================================

/**
 * Base Schema mit gemeinsamen Feldern.
 */
const encounterPresetBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),

  /**
   * Optionale Allianzen zwischen Groups.
   * Format: groupId → Array von verbuendeten groupIds.
   * Wenn nicht angegeben, werden Allianzen zur Runtime berechnet.
   */
  alliances: z.record(z.string(), z.array(z.string())).optional(),

  /** Combat-Konfiguration (Map, Resources). */
  combat: encounterCombatConfigSchema.optional(),

  /** Tags fuer Filterung/Kategorisierung. */
  tags: z.array(z.string()).optional(),

  // ============================================================================
  // RUNTIME-FELDER (nur bei embedded mode nach Generierung)
  // ============================================================================

  /**
   * Kontext der Encounter-Generierung.
   * Position, Terrain, Zeit und Wetter zum Zeitpunkt der Generierung.
   */
  context: encounterContextSchema.optional(),

  /**
   * Schwierigkeitsgrad nach Balancing.
   * Label, Win-Probability und TPK-Risiko.
   */
  difficulty: encounterDifficultySchema.optional(),
});

/**
 * Authored Preset: Fixe NPC-IDs.
 */
export const authoredPresetSchema = encounterPresetBaseSchema.extend({
  mode: z.literal('authored'),
  groups: z.array(authoredGroupSchema).min(1),
});
export type AuthoredPreset = z.infer<typeof authoredPresetSchema>;

/**
 * Template Preset: Creature-Counts.
 */
export const templatePresetSchema = encounterPresetBaseSchema.extend({
  mode: z.literal('template'),
  groups: z.array(templateGroupSchema).min(1),
});
export type TemplatePreset = z.infer<typeof templatePresetSchema>;

/**
 * Embedded Preset: Vollstaendige NPCs.
 */
export const embeddedPresetSchema = encounterPresetBaseSchema.extend({
  mode: z.literal('embedded'),
  groups: z.array(embeddedGroupSchema).min(1),
});
export type EmbeddedPreset = z.infer<typeof embeddedPresetSchema>;

/**
 * Unified Encounter Preset Schema (Discriminated Union).
 */
export const encounterPresetSchema = z.discriminatedUnion('mode', [
  authoredPresetSchema,
  templatePresetSchema,
  embeddedPresetSchema,
]);
export type EncounterPreset = z.infer<typeof encounterPresetSchema>;
