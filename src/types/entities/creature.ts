// Vault-persistierte CreatureDefinition und Runtime CreatureInstance
// Siehe: docs/entities/creature.md
//
// TASKS:
// |  # | Status | Domain   | Layer    | Beschreibung                                                          |  Prio  | MVP? | Deps | Spec                        | Imp.                                |
// |--:|:----:|:-------|:-------|:--------------------------------------------------------------------|:----:|:--:|:---|:--------------------------|:----------------------------------|
// | 62 |   ⬜    | creature | entities | CreatureDefinition: disposition zu baseDisposition (number) migrieren | mittel | Nein | #61  | entities/creature.md#Felder | types/entities/creature.ts [ändern] |

import { z } from 'zod';
import { timeSegmentSchema } from '#types/time';
import {
  CREATURE_SIZES,
  DISPOSITIONS,
  DESIGN_ROLES,
  NOISE_LEVELS,
  SCENT_STRENGTHS,
  STEALTH_ABILITIES,
} from '../../constants/creature';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const sizeSchema = z.enum(CREATURE_SIZES);

export const dispositionSchema = z.enum(DISPOSITIONS);

export const designRoleSchema = z.enum(DESIGN_ROLES);

export const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});
export type AbilityScores = z.infer<typeof abilityScoresSchema>;

export const speedBlockSchema = z.object({
  walk: z.number().int().min(0),
  fly: z.number().int().min(0).optional(),
  swim: z.number().int().min(0).optional(),
  climb: z.number().int().min(0).optional(),
  burrow: z.number().int().min(0).optional(),
});
export type SpeedBlock = z.infer<typeof speedBlockSchema>;

export const sensesSchema = z.object({
  passivePerception: z.number().int().min(1),
  darkvision: z.number().int().min(0).optional(),
  blindsight: z.number().int().min(0).optional(),
  tremorsense: z.number().int().min(0).optional(),
  trueSight: z.number().int().min(0).optional(),
});
export type Senses = z.infer<typeof sensesSchema>;

export const noiseLevelSchema = z.enum(NOISE_LEVELS);

export const scentStrengthSchema = z.enum(SCENT_STRENGTHS);

export const stealthAbilitySchema = z.enum(STEALTH_ABILITIES);

export const detectionProfileSchema = z.object({
  noiseLevel: noiseLevelSchema,
  scentStrength: scentStrengthSchema,
  stealthAbilities: z.array(stealthAbilitySchema).optional(),
});
export type DetectionProfile = z.infer<typeof detectionProfileSchema>;

export const countRangeSchema = z.object({
  min: z.number().int().min(1),
  avg: z.number().int().min(1),
  max: z.number().int().min(1),
});
export type CountRange = z.infer<typeof countRangeSchema>;

// CreaturePreferences: Gewichtungs-Modifikatoren für Encounter-System
// Siehe: docs/entities/creature.md#creaturepreferences
export const creaturePreferencesSchema = z.object({
  terrain: z.record(z.string(), z.number()).optional(),
  timeOfDay: z.record(timeSegmentSchema, z.number()).optional(),
  weather: z.object({
    prefers: z.array(z.string()).optional(),  // ×2.0
    avoids: z.array(z.string()).optional(),   // ×0.5
  }).optional(),
  altitude: z.object({ min: z.number(), max: z.number() }).optional(),
});
export type CreaturePreferences = z.infer<typeof creaturePreferencesSchema>;

// ============================================================================
// CREATURE DEFINITION (Vault-persistiert)
// ============================================================================

export const creatureDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cr: z.number().min(0).max(30),
  maxHp: z.number().int().positive(),
  ac: z.number().int().min(1).max(30),
  size: sizeSchema,
  tags: z.array(z.string()).min(1),
  species: z.string().optional(),
  disposition: dispositionSchema,
  terrainAffinities: z.array(z.string()).min(1),
  activeTime: z.array(timeSegmentSchema).min(1),
  designRole: designRoleSchema,
  groupSize: z.union([z.number().int().positive(), countRangeSchema]).optional(),
  activities: z.array(z.string()).optional(),
  preferences: creaturePreferencesSchema.optional(),
  lootTags: z.array(z.string()),
  carriesLoot: z.boolean().optional(),
  detectionProfile: detectionProfileSchema,
  abilities: abilityScoresSchema,
  speed: speedBlockSchema,
  senses: sensesSchema.optional(),
  languages: z.array(z.string()).optional(),
  description: z.string().optional(),
  source: z.string().optional(),
});

export type CreatureDefinition = z.infer<typeof creatureDefinitionSchema>;
export type CreatureId = CreatureDefinition['id'];

// ============================================================================
// CREATURE INSTANCE (Runtime - in Encounter/Combat)
// ============================================================================

export const creatureInstanceSchema = z.object({
  definitionId: z.string().min(1),
  currentHp: z.number().int(),
  maxHp: z.number().int().positive(),
  npcId: z.string().optional(), // Referenz auf NPC falls zugewiesen
});

export type CreatureInstance = z.infer<typeof creatureInstanceSchema>;
