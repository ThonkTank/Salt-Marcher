// Action-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/types/action.md
//
// D&D 5e Standard Actions und Monster Manual Actions.

import { z } from 'zod';
import { actionSchema, type Action } from '../../src/types/entities/action';

// ============================================================================
// STANDARD-ACTIONS (verfügbar für alle Combatants)
// ============================================================================

/** D&D 5e Standard-Actions, die allen Combatants zur Verfügung stehen. */
export const standardActions: Action[] = z.array(actionSchema).parse([
  {
    id: 'std-dash',
    name: 'Dash',
    actionType: 'utility',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    effects: [{
      grantMovement: { type: 'dash' },
      duration: { type: 'instant' },
      affectsTarget: 'self',
    }],
    description: 'Gain extra movement equal to your speed for this turn.',
  },
  {
    id: 'std-disengage',
    name: 'Disengage',
    actionType: 'utility',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    effects: [{
      movementBehavior: { noOpportunityAttacks: true },
      duration: { type: 'rounds', value: 1 },
      affectsTarget: 'self',
    }],
    description: 'Your movement does not provoke opportunity attacks for this turn.',
  },
  {
    id: 'std-dodge',
    name: 'Dodge',
    actionType: 'utility',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    effects: [{
      incomingModifiers: { attacks: 'disadvantage' },
      rollModifiers: [{ on: 'dex-save', type: 'advantage' }],
      duration: { type: 'rounds', value: 1 },
      affectsTarget: 'self',
    }],
    description: 'Attacks against you have disadvantage, and you have advantage on DEX saves.',
  },
]);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const actionPresets = z.array(actionSchema).parse([
  // ==========================================================================
  // GOBLIN (CR 1/4)
  // ==========================================================================
  {
    id: 'goblin-scimitar',
    name: 'Scimitar',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'slashing' },
  },
  {
    id: 'goblin-shortbow',
    name: 'Shortbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 80, long: 320 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },

  // ==========================================================================
  // WOLF (CR 1/4)
  // ==========================================================================
  {
    id: 'wolf-bite',
    name: 'Bite',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '2d4', modifier: 2, type: 'piercing' },
    // Pack Tactics: advantage if ally adjacent (conditional bonus)
    conditionalBonuses: [
      { condition: 'ally-adjacent', bonus: { type: 'advantage' } },
    ],
    // Knockdown: DC 11 STR save or prone
    effects: [
      {
        condition: 'prone',
        duration: { type: 'instant' },
        affectsTarget: 'enemy',
      },
    ],
    // Note: The prone effect should only apply on hit, controlled by save
    // For simplicity, we'll add it as an effect (HACK: no save integration yet)
  },

  // ==========================================================================
  // BANDIT (CR 1/8)
  // ==========================================================================
  {
    id: 'bandit-scimitar',
    name: 'Scimitar',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 3 },
    damage: { dice: '1d6', modifier: 1, type: 'slashing' },
  },
  {
    id: 'bandit-light-crossbow',
    name: 'Light Crossbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 80, long: 320 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 3 },
    damage: { dice: '1d8', modifier: 1, type: 'piercing' },
  },

  // ==========================================================================
  // OWLBEAR (CR 3)
  // ==========================================================================
  {
    id: 'owlbear-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'enemies' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Beak', count: 1 },
        { actionRef: 'Claws', count: 1 },
      ],
      description: 'The owlbear makes two attacks: one with its beak and one with its claws.',
    },
  },
  {
    id: 'owlbear-beak',
    name: 'Beak',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 7 },
    damage: { dice: '1d10', modifier: 5, type: 'piercing' },
  },
  {
    id: 'owlbear-claws',
    name: 'Claws',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 7 },
    damage: { dice: '2d8', modifier: 5, type: 'slashing' },
  },

  // ==========================================================================
  // SKELETON (CR 1/4)
  // ==========================================================================
  {
    id: 'skeleton-shortsword',
    name: 'Shortsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },
  {
    id: 'skeleton-shortbow',
    name: 'Shortbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 80, long: 320 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },

  // ==========================================================================
  // HOBGOBLIN (CR 1/2)
  // ==========================================================================
  {
    id: 'hobgoblin-longsword',
    name: 'Longsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 3 },
    damage: { dice: '1d8', modifier: 1, type: 'slashing' },
  },
  {
    id: 'hobgoblin-longbow',
    name: 'Longbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 150, long: 600 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 3 },
    damage: { dice: '1d8', modifier: 1, type: 'piercing' },
  },

  // ==========================================================================
  // GOBLIN BOSS (CR 1)
  // ==========================================================================
  {
    id: 'goblin-boss-scimitar',
    name: 'Scimitar',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'slashing' },
  },
  {
    id: 'goblin-boss-javelin',
    name: 'Javelin',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 30, long: 120 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },

  // ==========================================================================
  // BANDIT CAPTAIN (CR 2)
  // ==========================================================================
  {
    id: 'bandit-captain-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'enemies' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Scimitar', count: 2 },
        { actionRef: 'Dagger', count: 1 },
      ],
      description: 'The captain makes three melee attacks: two with its scimitar and one with its dagger.',
    },
  },
  {
    id: 'bandit-captain-scimitar',
    name: 'Scimitar',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d6', modifier: 3, type: 'slashing' },
  },
  {
    id: 'bandit-captain-dagger',
    name: 'Dagger',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d4', modifier: 3, type: 'piercing' },
  },

  // ==========================================================================
  // THUG (CR 1/2)
  // ==========================================================================
  {
    id: 'thug-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'enemies' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Mace', count: 2 },
      ],
      description: 'The thug makes two melee attacks.',
    },
  },
  {
    id: 'thug-mace',
    name: 'Mace',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'bludgeoning' },
  },
  {
    id: 'thug-heavy-crossbow',
    name: 'Heavy Crossbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 100, long: 400 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 2 },
    damage: { dice: '1d10', modifier: 0, type: 'piercing' },
  },
]);

// Default-Export für CLI-Loading
export default actionPresets;
