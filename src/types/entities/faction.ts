// Vault-persistierte Faction
// Siehe: docs/entities/faction.md

import { z } from 'zod';
import { groupTemplateSchema } from './groupTemplate';
import { FACTION_STATUSES } from '../../constants/faction';
import { reputationEntrySchema } from '../common/reputation';
import { layerTraitConfigSchema } from '../common/layerTraitConfig';

// ============================================================================
// CULTURE SUB-SCHEMAS
// ============================================================================

// DEPRECATED: WeightedTrait wird nicht mehr verwendet
// Traits werden jetzt zentral in presets/traits/ definiert und per ID referenziert
export const weightedTraitSchema = z.object({
  trait: z.string(),
  randWeighting: z.number().min(0).max(1),
});
export type WeightedTrait = z.infer<typeof weightedTraitSchema>;

// PersonalityConfig: Trait-IDs referenzieren zentrale Trait-Definitionen
// - traits: bevorzugte Traits (5x Gewicht)
// - forbidden: benachteiligte Traits (0.2x Gewicht)
// - Alle anderen Traits haben Basis-Gewicht (1x)
export const personalityConfigSchema = z.object({
  traits: z.array(z.string()).optional(),    // Trait-IDs → 5x Gewicht
  forbidden: z.array(z.string()).optional(), // Trait-IDs → 0.2x Gewicht
});
export type PersonalityConfig = z.infer<typeof personalityConfigSchema>;

export const namingConfigSchema = z.object({
  patterns: z.array(z.string()).optional(),
  prefixes: z.array(z.string()).optional(),
  roots: z.array(z.string()).optional(),
  suffixes: z.array(z.string()).optional(),
  titles: z.array(z.string()).optional(),
});
export type NamingConfig = z.infer<typeof namingConfigSchema>;

// DEPRECATED: WeightedQuirk wird nicht mehr verwendet
// Quirks werden jetzt zentral in presets/quirks/ definiert und per ID referenziert
// Siehe: src/types/entities/quirk.ts
export const weightedQuirkSchema = z.object({
  quirk: z.string(),
  randWeighting: z.number().min(0).max(1),
  description: z.string().optional(),
  compatibleTags: z.array(z.string()).optional(),
});
export type WeightedQuirk = z.infer<typeof weightedQuirkSchema>;

// DEPRECATED: FactionActivityRef wird durch einfache string[] ersetzt
// Siehe: docs/entities/activity.md - Activities werden ohne Gewichtung referenziert
export const factionActivityRefSchema = z.object({
  activityId: z.string(),
  randWeighting: z.number(),
});
export type FactionActivityRef = z.infer<typeof factionActivityRefSchema>;

// DEPRECATED: PersonalityBonusEntry wird nicht mehr in CultureData verwendet
// Siehe: src/types/entities/goal.ts - personalityBonus ist Teil der Goal-Entity
export const personalityBonusEntrySchema = z.object({
  trait: z.string(),
  multiplier: z.number(),
});
export type PersonalityBonusEntry = z.infer<typeof personalityBonusEntrySchema>;

// DEPRECATED: WeightedGoal wird nicht mehr verwendet
// Goals werden jetzt zentral in presets/goals/ definiert und per ID referenziert
// Siehe: src/types/entities/goal.ts
export const weightedGoalSchema = z.object({
  goal: z.string(),
  randWeighting: z.number(),
  description: z.string().optional(),
  personalityBonus: z.array(personalityBonusEntrySchema).optional(),
});
export type WeightedGoal = z.infer<typeof weightedGoalSchema>;

export const valuesConfigSchema = z.object({
  priorities: z.array(z.string()).optional(),
  taboos: z.array(z.string()).optional(),
  greetings: z.array(z.string()).optional(),
});
export type ValuesConfig = z.infer<typeof valuesConfigSchema>;

export const speechConfigSchema = z.object({
  dialect: z.string().optional(),
  commonPhrases: z.array(z.string()).optional(),
  accent: z.string().optional(),
});
export type SpeechConfig = z.infer<typeof speechConfigSchema>;

export const cultureDataSchema = z.object({
  // Naming (Pattern-basiert, bleibt unverändert)
  naming: namingConfigSchema.optional(),

  // NPC-Attribute (LayerTraitConfig: add[] + unwanted[])
  personality: layerTraitConfigSchema.optional(),
  values: layerTraitConfigSchema.optional(),
  quirks: layerTraitConfigSchema.optional(),
  appearance: layerTraitConfigSchema.optional(),
  goals: layerTraitConfigSchema.optional(),

  // Sonstige Culture-Daten
  activities: z.array(z.string()).optional(), // Activity-IDs für Encounter
  speech: speechConfigSchema.optional(),
  lootPool: z.array(z.string()).optional(),   // Item-IDs für Loot-Generierung
});
export type CultureData = z.infer<typeof cultureDataSchema>;

// ============================================================================
// FACTION SCHEMA
// ============================================================================

export const factionStatusSchema = z.enum(FACTION_STATUSES);

export const factionCreatureGroupSchema = z.object({
  creatureId: z.string(),
  count: z.number().int().positive(),
});
export type FactionCreatureGroup = z.infer<typeof factionCreatureGroupSchema>;

export const factionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().optional(),
  status: factionStatusSchema,
  culture: cultureDataSchema,
  creatures: z.array(factionCreatureGroupSchema),
  encounterTemplates: z.array(groupTemplateSchema).optional(),
  controlledLandmarks: z.array(z.string()),
  displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  reputations: z.array(reputationEntrySchema).optional().default([]),
  description: z.string().optional(),
  gmNotes: z.string().optional(),
});

export type Faction = z.infer<typeof factionSchema>;
