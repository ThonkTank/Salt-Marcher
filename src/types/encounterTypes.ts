// Encounter-Typen: Runtime-Repräsentation und Trigger für Encounters
// Siehe: docs/entities/encounter-instance.md

import { z } from 'zod';
import { npcSchema } from './entities/npc';
import { hexCoordinateSchema } from './entities/map';
import { ENCOUNTER_TRIGGERS, NARRATIVE_ROLES, DIFFICULTY_LABELS, DISPOSITIONS, GROUP_STATUSES } from '../constants';

// Disposition-Schema für berechnetes Ergebnis (Output-Type)
const dispositionSchema = z.enum(DISPOSITIONS);

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const encounterTriggerSchema = z.enum(ENCOUNTER_TRIGGERS);

export const narrativeRoleSchema = z.enum(NARRATIVE_ROLES);

export const difficultyLabelSchema = z.enum(DIFFICULTY_LABELS);

// ============================================================================
// ENCOUNTER GROUP - Vollständiger Typ für Pipeline + Persistenz
// Schrittweise befüllt durch Pipeline-Steps
// ============================================================================

const groupStatusSchema = z.enum(GROUP_STATUSES);

// Loot-Item für Gruppen-Ebene
const groupLootItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive(),
});

// Gruppen-Loot (Step 4.3)
const groupLootSchema = z.object({
  items: z.array(groupLootItemSchema),
  totalValue: z.number().nonnegative(),
  partyObtainableValue: z.number().nonnegative(),
  countsTowardsBudget: z.boolean(),
});

// Gruppen-Perception (Step 4.4)
const groupPerceptionSchema = z.object({
  partyDetectsEncounter: z.number().nonnegative(),
  encounterDetectsParty: z.number().nonnegative(),
  isSurprise: z.boolean(),
});

export const encounterGroupSchema = z.object({
  // Identifikation (Step 3)
  groupId: z.string().uuid(),
  templateRef: z.string().optional(),
  factionId: z.string().nullable(),
  narrativeRole: narrativeRoleSchema,
  status: groupStatusSchema,

  // Population (Step 3) - NPCs direkt in Slots
  slots: z.record(z.string(), z.array(npcSchema)),
  npcIds: z.array(z.string()),

  // Activity (Step 4.2)
  activity: z.string().optional(),
  goal: z.string().optional(),
  disposition: dispositionSchema.optional(),

  // Loot (Step 4.3)
  loot: groupLootSchema.optional(),

  // Perception (Step 4.4)
  perception: groupPerceptionSchema.optional(),
});
export type EncounterGroup = z.infer<typeof encounterGroupSchema>;

// ============================================================================
// ENCOUNTER LOOT
// ============================================================================

export const encounterLootItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive(),
});
export type EncounterLootItem = z.infer<typeof encounterLootItemSchema>;

export const encounterLootSchema = z.object({
  items: z.array(encounterLootItemSchema),
  totalValue: z.number().nonnegative(),
});
export type EncounterLoot = z.infer<typeof encounterLootSchema>;

// ============================================================================
// ENCOUNTER PERCEPTION
// ============================================================================

export const encounterPerceptionSchema = z.object({
  partyDetectsEncounter: z.number().nonnegative(),
  encounterDetectsParty: z.number().nonnegative(),
  isSurprise: z.boolean(),
});
export type EncounterPerception = z.infer<typeof encounterPerceptionSchema>;

// ============================================================================
// ENCOUNTER DIFFICULTY
// ============================================================================

export const encounterDifficultySchema = z.object({
  label: difficultyLabelSchema,
  winProbability: z.number().min(0).max(1),
  tpkRisk: z.number().min(0).max(1),
});
export type EncounterDifficulty = z.infer<typeof encounterDifficultySchema>;

// ============================================================================
// ENCOUNTER CONTEXT
// ============================================================================

export const encounterContextSchema = z.object({
  position: hexCoordinateSchema,
  terrain: z.string().min(1),
  timeSegment: z.string().min(1),
  weather: z.object({
    type: z.string().min(1),
    severity: z.number().min(0).max(1),
  }),
});
export type EncounterContext = z.infer<typeof encounterContextSchema>;

// ============================================================================
// ENCOUNTER INSTANCE (Runtime - generiert vom Encounter-Service)
// ============================================================================

export const encounterInstanceSchema = z.object({
  id: z.string().min(1),
  groups: z.array(encounterGroupSchema),
  npcs: z.array(z.string()), // NPC-IDs (1-3 NPCs pro Encounter)
  loot: encounterLootSchema,
  perception: encounterPerceptionSchema,
  difficulty: encounterDifficultySchema,
  context: encounterContextSchema,
  description: z.string(),
});

export type EncounterInstance = z.infer<typeof encounterInstanceSchema>;
