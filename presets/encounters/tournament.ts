// Ziel: Tournament Encounter Presets (migriert von scripts/evolution/tournament/scenarios.ts)
// Siehe: docs/types/encounter-preset.md
//
// Diese Presets definieren NPC-vs-NPC Szenarien fuer das NEAT Tournament System.
// WICHTIG: Beide Seiten (party + enemies) sind NPCs - keine Player Characters.
// Die loadEncounterPreset() Funktion erhaelt eine leere PartyInput { level: 1, size: 0, members: [] }.

import { z } from 'zod';
import { authoredPresetSchema, type AuthoredPreset } from '../../src/types/entities/encounterPreset';

// ============================================================================
// PRESET-SCHEMA VALIDATION
// ============================================================================

const tournamentPresetsSchema = z.array(authoredPresetSchema);

// ============================================================================
// BASIC SCENARIOS - Einfache Szenarien fuer Basis-Training
// ============================================================================

const basicScenarios: AuthoredPreset[] = [
  {
    id: '1v1-melee',
    name: '1v1 Melee',
    description: 'Thug (HP 32) vs Hobgoblin (HP 11) - Pure Melee-Entscheidungen',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['einaeugiger-pete'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['borgrik'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: '1v1 Melee', resourceBudget: 1.0 },
    tags: ['basic', '1v1', 'melee'],
  },
  {
    id: '2v4-mixed',
    name: '2v4 Mixed',
    description: 'Thug + Bandit vs Goblins + Hobgoblin + Wolf - Mixed-Range Combat',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['einaeugiger-pete', 'schwarzer-jack'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['griknak', 'snaggle', 'borgrik', 'einsamer-wolf'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: '2v4 Mixed', resourceBudget: 1.0 },
    tags: ['basic', 'outnumbered', 'mixed'],
  },
  {
    id: '1vn-horde',
    name: '1vN Horde',
    description: 'Hobgoblin vs Horde - Single Strong vs Many Weak',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['borgrik'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['griknak', 'snaggle', 'schwarzer-jack', 'einsamer-wolf'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: '1vN Horde', resourceBudget: 1.0 },
    tags: ['basic', 'horde', 'solo'],
  },
];

// ============================================================================
// TACTICAL SCENARIOS - Erfordern echte Entscheidungen
// ============================================================================

const tacticalScenarios: AuthoredPreset[] = [
  {
    id: 'aura-cluster',
    name: 'Aura-Cluster',
    description: '2x Knight vs Captain + Goblins - Captain zuerst toeten entfernt Advantage',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['knight-aldric', 'knight-elara'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['captain-krug', 'griknak', 'snaggle'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: 'Aura-Cluster', resourceBudget: 1.0 },
    tags: ['tactical', 'aura', 'priority-target'],
  },
  {
    id: 'bloodied',
    name: 'Bloodied',
    description: 'Knight + Scout vs 2x Berserker - Berserker werden staerker bei <50% HP',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['knight-aldric', 'scout-finn'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['berserker-ragnar', 'berserker-bjorn'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: 'Bloodied', resourceBudget: 1.0 },
    tags: ['tactical', 'bloodied', 'escalation'],
  },
  {
    id: 'kiting',
    name: 'Kiting',
    description: '3x Scout vs Ogre + Goblins - Distanz halten gegen Glass Cannon',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['scout-finn', 'scout-mira', 'scout-thorn'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['ogre-grok', 'griknak', 'snaggle'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: 'Kiting', resourceBudget: 1.0 },
    tags: ['tactical', 'kiting', 'positioning'],
  },
  {
    id: 'kill-healer',
    name: 'Kill Healer',
    description: 'Knight + Bandit vs Priest + Hobgoblin + Goblin - Healer priorisieren',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['knight-aldric', 'schwarzer-jack'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['priest-marcus', 'borgrik', 'griknak'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: 'Kill Healer', resourceBudget: 1.0 },
    tags: ['tactical', 'healer', 'priority-target'],
  },
  {
    id: 'grapple',
    name: 'Grapple',
    description: '2x Scout vs 2x Bugbear - Enger Korridor, 10ft Reach + Grapple',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['scout-finn', 'scout-mira'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['bugbear-gruk', 'bugbear-thrak'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: 'Grapple', resourceBudget: 1.0 },
    tags: ['tactical', 'grapple', 'corridor'],
  },
  {
    id: 'rampage',
    name: 'Rampage',
    description: 'Knight vs Gnolls + Goblins - Gnoll Rampage nach Bloodying',
    mode: 'authored',
    groups: [
      { groupId: 'party', npcIds: ['knight-aldric'], narrativeRole: 'ally' },
      { groupId: 'enemies', npcIds: ['gnoll-yipp', 'gnoll-krak', 'griknak', 'snaggle'], narrativeRole: 'threat' },
    ],
    alliances: {
      party: [],
      enemies: [],
    },
    combat: { mapId: 'Rampage', resourceBudget: 1.0 },
    tags: ['tactical', 'rampage', 'bonus-action'],
  },
];

// ============================================================================
// EXPORTS
// ============================================================================

/** Alle Tournament Presets. */
export const tournamentPresets: AuthoredPreset[] = tournamentPresetsSchema.parse([
  ...basicScenarios,
  ...tacticalScenarios,
]);

/** Quick Presets fuer schnelles Training (1 Basic + 1 Tactical). */
export const quickTournamentPresets: AuthoredPreset[] = [
  tournamentPresets[0],  // 1v1-melee
  tournamentPresets[3],  // aura-cluster
];

/** Findet ein Preset nach ID. */
export function getTournamentPresetById(id: string): AuthoredPreset | undefined {
  return tournamentPresets.find(p => p.id === id);
}

/** Findet ein Preset nach Name (fuer Backward-Compatibility mit ScenarioConfig). */
export function getTournamentPresetByName(name: string): AuthoredPreset | undefined {
  return tournamentPresets.find(p => p.name === name);
}

export default tournamentPresets;
