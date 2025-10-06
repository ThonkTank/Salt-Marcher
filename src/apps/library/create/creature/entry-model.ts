// src/apps/library/create/creature/entry-model.ts
// Type-sichere Definitionen und Helper für Creature Entries

import type { CreatureEntryCategory } from "./presets";
import type { ToHitAutoConfig, DamageAutoConfig } from "../shared/auto-calc";
import type { AbilityScoreKey } from "../../core/creature-files";

/**
 * Entry type determines which fields are relevant and how the UI is rendered
 */
export type EntryType =
  | 'passive'        // Only name + text (e.g. Amphibious, Keen Senses)
  | 'attack'         // To Hit + Damage + Range + Target
  | 'save-action'    // Save DC + Effect + Text
  | 'multiattack'    // Special: Only name + text (but type=action)
  | 'spellcasting';  // Spell lists + Ability + DC

/**
 * Spell group for spellcasting entries
 */
export interface SpellGroup {
  type: 'at-will' | 'per-day' | 'level';
  label?: string;      // "At Will", "3/Day each", "1st Level"
  level?: number;      // for type='level': 1-9
  slots?: number;      // for type='level': number of spell slots
  spells: string[];    // Spell names (links to spell files)
}

/**
 * A single entry (Trait, Action, Bonus Action, Reaction, or Legendary Action)
 */
export interface CreatureEntry {
  // Core identification
  category: CreatureEntryCategory;
  entryType?: EntryType;  // NEW: Determines UI layout (optional for backwards compat)
  name?: string;

  // Attack/Action basics (used for entryType='attack')
  kind?: string; // e.g. "Melee Attack Roll", "Ranged Attack Roll"
  range?: string; // e.g. "reach 5 ft.", "range 80/320 ft."
  target?: string; // e.g. "one target", "all creatures in range"

  // Combat values (used for entryType='attack')
  to_hit?: string; // Final to-hit value (e.g. "+5")
  to_hit_from?: ToHitAutoConfig; // Auto-calculation config

  damage?: string; // Final damage value (e.g. "1d8 +3 slashing")
  damage_from?: DamageAutoConfig; // Auto-calculation config

  // Saving throw (used for entryType='save-action')
  save_ability?: string; // e.g. "STR", "DEX", "CON"
  save_dc?: number; // e.g. 15
  save_effect?: string; // e.g. "Half damage on success"

  // Recharge / Usage limits (used for all types)
  recharge?: string; // e.g. "Recharge 5-6", "1/Day", "2/Day"

  // Description (used for passive, multiattack, and as additional text for others)
  text?: string; // Markdown description

  // Spellcasting-specific fields (used for entryType='spellcasting')
  spellAbility?: AbilityScoreKey;  // Which ability modifier to use
  spellDcOverride?: number;        // Override calculated DC
  spellAttackOverride?: number;    // Override calculated attack bonus
  spellGroups?: SpellGroup[];      // Spell lists organized by usage
}

/**
 * Creates a new empty entry
 */
export function createEntry(category: CreatureEntryCategory): CreatureEntry {
  return {
    category,
    name: "",
  };
}

/**
 * Infers the entry type based on existing fields (for backwards compatibility)
 */
export function inferEntryType(entry: CreatureEntry): EntryType {
  // Explicit type wins
  if (entry.entryType) return entry.entryType;

  // Spellcasting detection
  if (entry.spellGroups || entry.spellAbility) return 'spellcasting';

  // Attack detection
  if (entry.to_hit || entry.to_hit_from || entry.damage || entry.damage_from || entry.kind) {
    return 'attack';
  }

  // Save-based action detection
  if (entry.save_ability && entry.save_dc) return 'save-action';

  // Multiattack detection (special case)
  if (entry.name?.toLowerCase().includes('multiattack')) return 'multiattack';

  // Default for traits and simple entries
  if (entry.category === 'trait') return 'passive';

  // Default fallback
  return 'passive';
}

/**
 * Type guard: Is this an attack entry?
 */
export function isAttackEntry(entry: CreatureEntry): boolean {
  return inferEntryType(entry) === 'attack';
}

/**
 * Type guard: Is this a spellcasting entry?
 */
export function isSpellcastingEntry(entry: CreatureEntry): boolean {
  return inferEntryType(entry) === 'spellcasting';
}

/**
 * Type guard: Is this a passive entry (just text)?
 */
export function isPassiveEntry(entry: CreatureEntry): boolean {
  const type = inferEntryType(entry);
  return type === 'passive' || type === 'multiattack';
}

/**
 * Type guard: Is this a save-based action?
 */
export function isSaveActionEntry(entry: CreatureEntry): boolean {
  return inferEntryType(entry) === 'save-action';
}

/**
 * Checks if an entry has auto-calculation configured
 */
export function hasAutoCalculation(entry: CreatureEntry): boolean {
  return !!(entry.to_hit_from || entry.damage_from);
}

/**
 * Checks if an entry is a combat action (needs to-hit/damage fields)
 */
export function isCombatAction(entry: CreatureEntry): boolean {
  return entry.category === "action" || entry.category === "bonus";
}

/**
 * Checks if an entry typically uses saving throws
 */
export function usesSavingThrow(entry: CreatureEntry): boolean {
  // Can be any category, but often spells or special actions
  return !!(entry.save_ability || entry.save_dc || entry.save_effect);
}

/**
 * Validates an entry and returns list of issues
 */
export function validateEntry(entry: CreatureEntry, index: number): string[] {
  const issues: string[] = [];
  const label = entry.name?.trim() || `Eintrag ${index + 1}`;

  // Save validation
  if (entry.save_ability && (entry.save_dc == null || Number.isNaN(entry.save_dc))) {
    issues.push(`${label}: Save-DC angeben, wenn ein Attribut gewählt wurde.`);
  }
  if (entry.save_dc != null && !Number.isNaN(entry.save_dc) && !entry.save_ability) {
    issues.push(`${label}: Ein Save-DC benötigt ein Attribut.`);
  }
  if (entry.save_effect && !entry.save_ability) {
    issues.push(`${label}: Save-Effekt ohne Attribut ist unklar.`);
  }

  // Auto-calculation validation
  if (entry.to_hit_from && !entry.to_hit_from.ability) {
    issues.push(`${label}: Automatische Attacke benötigt ein Attribut.`);
  }
  if (entry.damage_from && !entry.damage_from.dice?.trim()) {
    issues.push(`${label}: Automatischer Schaden benötigt Würfelangaben.`);
  }

  return issues;
}

/**
 * Clones an entry (useful for templates/presets)
 */
export function cloneEntry(entry: CreatureEntry): CreatureEntry {
  return {
    ...entry,
    to_hit_from: entry.to_hit_from ? { ...entry.to_hit_from } : undefined,
    damage_from: entry.damage_from ? { ...entry.damage_from } : undefined,
    spellGroups: entry.spellGroups ? entry.spellGroups.map(g => ({
      ...g,
      spells: [...g.spells]
    })) : undefined,
  };
}

/**
 * Converts legacy SpellcastingData to a spellcasting entry
 */
export function spellcastingDataToEntry(spellcastingData: any): CreatureEntry {
  const groups: SpellGroup[] = [];

  // Convert legacy spellcasting groups
  for (const group of spellcastingData.groups || []) {
    if (group.type === 'at-will') {
      groups.push({
        type: 'at-will',
        label: group.title || 'At Will',
        spells: (group.spells || []).map((s: any) => s.name || s),
      });
    } else if (group.type === 'per-day') {
      groups.push({
        type: 'per-day',
        label: group.uses || '1/Day each',
        spells: (group.spells || []).map((s: any) => s.name || s),
      });
    } else if (group.type === 'level') {
      groups.push({
        type: 'level',
        level: group.level || 1,
        slots: group.slots,
        label: group.title,
        spells: (group.spells || []).map((s: any) => s.name || s),
      });
    }
  }

  return {
    category: 'action',
    entryType: 'spellcasting',
    name: spellcastingData.title || 'Spellcasting',
    text: spellcastingData.summary,
    spellAbility: spellcastingData.ability,
    spellDcOverride: spellcastingData.saveDcOverride,
    spellAttackOverride: spellcastingData.attackBonusOverride,
    spellGroups: groups,
  };
}
