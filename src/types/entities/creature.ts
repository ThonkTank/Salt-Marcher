// Vault-persistierte CreatureDefinition und Runtime CreatureInstance
// Siehe: docs/entities/creature.md
//
// TASKS:
// |  # | Status | Domain   | Layer    | Beschreibung                                                          |  Prio  | MVP? | Deps | Spec                        | Imp.                                |
// |--:|:----:|:-------|:-------|:--------------------------------------------------------------------|:----:|:--:|:---|:--------------------------|:----------------------------------|
// | 62 |   ✅    | creature | entities | CreatureDefinition: disposition zu baseDisposition (number) migrieren | mittel | Nein | #61  | entities/creature.md#Felder | types/entities/creature.ts [ändern] |

import { z } from 'zod';
import { timeSegmentSchema } from '#types/time';
import {
  CREATURE_SIZES,
  DESIGN_ROLES,
  NOISE_LEVELS,
  SCENT_STRENGTHS,
  STEALTH_ABILITIES,
} from '../../constants/creature';
import { WEALTH_TIERS } from '../../constants/loot';
import { validateDiceExpression } from '@/utils/diceParser';
import { diceMax, diceAvg } from '@/utils/random';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const sizeSchema = z.enum(CREATURE_SIZES);

// baseDisposition: numerische Basis-Disposition (-100 bis +100)
// Effektive Disposition = clamp(baseDisposition + reputation, -100, +100)
// Siehe: docs/services/encounter/groupActivity.md#Disposition-Berechnung
export const baseDispositionSchema = z.number().min(-100).max(100);

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

// DefaultLootEntry: Garantiertes/wahrscheinliches Loot pro Creature
// Siehe: docs/services/Loot.md#creature-default-loot
export const defaultLootEntrySchema = z.object({
  itemId: z.string().min(1),
  chance: z.number().min(0).max(1),
  quantity: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
});
export type DefaultLootEntry = z.infer<typeof defaultLootEntrySchema>;

// WealthTier: Beeinflusst Loot-WERT, nicht Pool
// Siehe: docs/services/Loot.md#wealth-system
export const wealthTierSchema = z.enum(WEALTH_TIERS);
export type WealthTier = z.infer<typeof wealthTierSchema>;

// ============================================================================
// CREATURE DEFINITION (Vault-persistiert)
// ============================================================================

// Input-Schema: Was in Presets/Vault gespeichert wird (ohne berechnete Felder)
const creatureDefinitionInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cr: z.number().min(0).max(30),
  hitDice: z.string().min(1).refine(validateDiceExpression, { message: 'Invalid dice expression' }),
  ac: z.number().int().min(1).max(30),
  size: sizeSchema,
  tags: z.array(z.string()).min(1),
  species: z.string().optional(),
  baseDisposition: baseDispositionSchema,
  terrainAffinities: z.array(z.string()).min(1),
  activeTime: z.array(timeSegmentSchema).min(1),
  designRole: designRoleSchema,
  groupSize: z.union([z.number().int().positive(), countRangeSchema]).optional(),
  activities: z.array(z.string()).optional(),
  preferences: creaturePreferencesSchema.optional(),
  lootPool: z.array(z.string()).optional(),   // Item-IDs, überschreibt Culture-Kaskade
  wealthTier: wealthTierSchema.optional(),    // Beeinflusst Loot-WERT
  defaultLoot: z.array(defaultLootEntrySchema).optional(),
  carriesLoot: z.boolean().optional(),
  detectionProfile: detectionProfileSchema,
  abilities: abilityScoresSchema,
  speed: speedBlockSchema,
  senses: sensesSchema.optional(),
  languages: z.array(z.string()).optional(),
  description: z.string().optional(),
  source: z.string().optional(),
});

// Output-Schema: Mit berechneten maxHp und averageHp aus hitDice
export const creatureDefinitionSchema = creatureDefinitionInputSchema.transform((data) => ({
  ...data,
  maxHp: diceMax(data.hitDice),
  averageHp: Math.ceil(diceAvg(data.hitDice)),
}));

export type CreatureDefinition = z.infer<typeof creatureDefinitionSchema>;
export type CreatureId = CreatureDefinition['id'];

// ============================================================================
// CREATURE INSTANCE (Runtime - in Encounter/Combat)
// ============================================================================

export const creatureLootItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive(),
});
export type CreatureLootItem = z.infer<typeof creatureLootItemSchema>;

export const creatureInstanceSchema = z.object({
  instanceId: z.string().uuid(), // Eindeutige Instanz-ID (crypto.randomUUID)
  definitionId: z.string().min(1),
  currentHp: z.number().int(),
  maxHp: z.number().int().positive(),
  npcId: z.string().optional(), // Referenz auf NPC falls zugewiesen
  loot: z.array(creatureLootItemSchema).optional(), // Zugewiesene Items
  slotName: z.string().optional(), // Slot-Zuordnung (leader, follower, etc.)
});

export type CreatureInstance = z.infer<typeof creatureInstanceSchema>;
