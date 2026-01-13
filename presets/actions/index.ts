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
    id: 'std-move',
    name: 'Move',
    actionType: 'utility',
    timing: { type: 'free' },  // Keine Action-Economy (verbraucht nur Movement)
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    budgetCosts: [{ resource: 'movement', cost: { type: 'toTarget' } }],
    description: 'Move up to your remaining movement.',
  },
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
    budgetCosts: [
      { resource: 'action', cost: { type: 'fixed', value: 1 } },
      { resource: 'movement', cost: { type: 'toTarget' } },  // Bewegt nach Movement-Grant
    ],
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
    id: 'std-hide',
    name: 'Hide',
    actionType: 'utility',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    effects: [{
      condition: 'hidden',
      duration: { type: 'rounds', value: 1 },
      affectsTarget: 'self',
    }],
    description: 'Make a Stealth check to become hidden.',
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
  {
    id: 'std-opportunity-attack',
    name: 'Opportunity Attack',
    actionType: 'melee-weapon',
    timing: {
      type: 'reaction',
      triggerCondition: { event: 'leaves-reach' },
    },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    // HACK: autoHit placeholder - actual attack comes from baseAction
    autoHit: true,
    // Stats werden von baseAction übernommen - keine eigenen attack/damage
    budgetCosts: [{ resource: 'reaction', cost: { type: 'fixed', value: 1 } }],
    // Verfügbarkeits-Prüfung: Nur wenn Combatant eine Melee-Weapon-Action hat
    requires: {
      hasAction: { actionType: ['melee-weapon'] },
    },
    // Übernimm attack/damage/properties von bester Melee-Action
    baseAction: {
      actionType: ['melee-weapon'],
      select: 'best-damage',
      usage: 'inherit',
    },
    description: 'When a creature leaves your reach, you can use your reaction to make one melee attack against it.',
  },
  {
    id: 'std-grapple',
    name: 'Grapple',
    actionType: 'debuff',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    contested: {
      attackerSkill: 'athletics',
      defenderChoice: ['athletics', 'acrobatics'],
      sizeLimit: 1,  // Target max 1 size larger
      onSuccess: {
        condition: 'grappled',
        duration: {
          type: 'until-escape',
          escapeCheck: {
            type: 'contested',
            timing: 'action',
            defenderSkill: 'athletics',  // Grappler's Athletics
            escaperChoice: ['athletics', 'acrobatics'],
          },
        },
        affectsTarget: 'enemy',
      },
    },
    budgetCosts: [{ resource: 'action', cost: { type: 'fixed', value: 1 } }],
    description: 'Contested Athletics vs Athletics/Acrobatics. On success, target is Grappled (speed 0). Target can escape with Action.',
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
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
    // Pack Tactics: handled via trait-pack-tactics passive action in creature's actionIds
    // SRD 5.2: "If the target is a Medium or smaller creature, it has the Prone condition."
    effects: [
      {
        condition: 'prone',
        duration: { type: 'instant' },
        affectsTarget: 'enemy',
        targetSizeMax: 'medium',
      },
    ],
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
  // OWLBEAR (CR 3) - SRD 5.2
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
      attacks: [{ actionRef: 'Rend', count: 2 }],
      description: 'The owlbear makes two Rend attacks.',
    },
  },
  {
    id: 'owlbear-rend',
    name: 'Rend',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 7 },
    damage: { dice: '2d8', modifier: 5, type: 'slashing' },
  },

  // ==========================================================================
  // SKELETON (CR 1/4) - SRD 5.2
  // ==========================================================================
  {
    id: 'skeleton-shortsword',
    name: 'Shortsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d6', modifier: 3, type: 'piercing' },
  },
  {
    id: 'skeleton-shortbow',
    name: 'Shortbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 80, long: 320 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d6', modifier: 3, type: 'piercing' },
  },

  // ==========================================================================
  // HOBGOBLIN (CR 1/2) - SRD 5.2
  // ==========================================================================
  {
    id: 'hobgoblin-longsword',
    name: 'Longsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 3 },
    damage: { dice: '2d10', modifier: 1, type: 'slashing' },  // SRD 5.2: 2d10+1
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
    extraDamage: [{ dice: '3d4', modifier: 0, type: 'poison' }],  // SRD 5.2: +3d4 poison
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
    id: 'goblin-boss-shortbow',
    name: 'Shortbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 80, long: 320 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },
  {
    id: 'goblin-boss-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Scimitar', count: 2 },
      ],
      description: 'The goblin boss makes two attacks with its scimitar.',
    },
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
        { actionRef: 'Scimitar', count: 1 },
        { actionRef: 'Pistol', count: 1 },
      ],
      description: 'The bandit makes two attacks, using Scimitar and Pistol in any combination.',
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
    id: 'bandit-captain-pistol',
    name: 'Pistol',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 30, long: 90 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d10', modifier: 3, type: 'piercing' },
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

  // ==========================================================================
  // BUGBEAR WARRIOR (CR 1) - SRD 5.2
  // ==========================================================================
  // NOTE: Bugbear has Long-Limbed trait (10 ft reach on all attacks)
  // TODO: Abduct trait - no extra movement cost for grappled creatures
  {
    id: 'bugbear-grab',
    name: 'Grab',
    actionType: 'melee-weapon',  // SRD 5.2: Attack Roll, nicht Contested Check
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },  // Base 5ft, Long-Limbed trait adds +5
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },  // +4 to hit
    damage: { dice: '2d6', modifier: 2, type: 'bludgeoning' },  // 9 (2d6+2) damage
    effects: [{
      condition: 'grappled',
      duration: {
        type: 'until-escape',
        escapeCheck: {
          type: 'dc',  // Fixed DC, nicht contested
          timing: 'action',
          dc: 12,
          ability: 'str',  // Escape via Strength (Athletics) check
        },
      },
      affectsTarget: 'enemy',
      targetSizeMax: 'medium',  // Medium or smaller only
    }],
    description: 'Melee Attack: +4, reach 10 ft. 9 (2d6+2) bludgeoning. If Medium or smaller: Grappled (escape DC 12).',
  },
  {
    id: 'bugbear-light-hammer',
    name: 'Light Hammer',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },  // Base 5ft, Long-Limbed trait adds +5 (also thrown 20/60)
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '3d4', modifier: 2, type: 'bludgeoning' },  // 9 (3d4+2)
    // Advantage against grappled targets (via schemaModifiers)
    schemaModifiers: [{
      id: 'grappled-advantage',
      name: 'Grappled Advantage',
      description: 'Advantage on attacks against grappled targets',
      condition: { type: 'has-condition', entity: 'target', condition: 'grappled' },
      effect: { advantage: true },
      priority: 8,
    }],
    properties: ['light', 'thrown'],  // Dokumentation: kann auch geworfen werden (20/60 ft)
    description: 'Melee or Ranged Attack: +4, reach 10 ft or range 20/60 ft. Advantage if target grappled.',
  },

  // ==========================================================================
  // HOBGOBLIN CAPTAIN (CR 3)
  // ==========================================================================
  {
    id: 'hobcaptain-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'enemies' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Greatsword', count: 2, orRef: 'Longbow' },
      ],
      // SRD 5.2: "two attacks, using Greatsword or Longbow in any combination"
      description: 'The hobgoblin captain makes two attacks (Greatsword or Longbow).',
    },
  },
  {
    id: 'hobcaptain-greatsword',
    name: 'Greatsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '2d6', modifier: 2, type: 'slashing' },
    extraDamage: [{ dice: '1d6', modifier: 0, type: 'poison' }],
  },
  {
    id: 'hobcaptain-longbow',
    name: 'Longbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 150, long: 600 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d8', modifier: 2, type: 'piercing' },
    extraDamage: [{ dice: '2d4', modifier: 0, type: 'poison' }],
  },

  // ==========================================================================
  // BERSERKER (CR 2)
  // ==========================================================================
  {
    id: 'berserker-greataxe',
    name: 'Greataxe',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d12', modifier: 3, type: 'slashing' },
    // Bloodied Frenzy: Advantage when bloodied (handled via schemaModifiers)
    modifierRefs: ['bloodied-frenzy'],
  },

  // ==========================================================================
  // KNIGHT (CR 3)
  // ==========================================================================
  {
    id: 'knight-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'enemies' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Greatsword', count: 2 },
      ],
      description: 'The knight makes two attacks with its greatsword or heavy crossbow.',
    },
  },
  {
    id: 'knight-greatsword',
    name: 'Greatsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '2d6', modifier: 3, type: 'slashing' },
    extraDamage: [{ dice: '1d8', modifier: 0, type: 'radiant' }],
  },
  {
    id: 'knight-heavy-crossbow',
    name: 'Heavy Crossbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 100, long: 400 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 2 },
    damage: { dice: '2d10', modifier: 0, type: 'piercing' },
    extraDamage: [{ dice: '1d8', modifier: 0, type: 'radiant' }],
  },

  // ==========================================================================
  // GNOLL WARRIOR (CR 1/2)
  // ==========================================================================
  {
    id: 'gnoll-rend',
    name: 'Rend',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },
  {
    id: 'gnoll-bone-bow',
    name: 'Bone Bow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 150, long: 600 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 3 },
    damage: { dice: '1d10', modifier: 1, type: 'piercing' },
  },
  {
    id: 'gnoll-rampage',
    name: 'Rampage',
    actionType: 'melee-weapon',
    timing: { type: 'bonus' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
    recharge: { type: 'per-day', uses: 1 },
    // Trigger: After dealing damage to bloodied creature
    description: 'After dealing damage to a bloodied creature, move half speed and make one Rend attack.',
  },

  // ==========================================================================
  // OGRE (CR 2)
  // ==========================================================================
  {
    id: 'ogre-greatclub',
    name: 'Greatclub',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 6 },
    damage: { dice: '2d8', modifier: 4, type: 'bludgeoning' },
  },
  {
    id: 'ogre-javelin',
    name: 'Javelin',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 30, long: 120 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 6 },
    damage: { dice: '2d6', modifier: 4, type: 'piercing' },
  },

  // ==========================================================================
  // SCOUT (CR 1/2)
  // ==========================================================================
  {
    id: 'scout-multiattack',
    name: 'Multiattack',
    actionType: 'multiattack',
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'enemies' },
    autoHit: true,
    multiattack: {
      attacks: [
        { actionRef: 'Shortsword', count: 1 },
        { actionRef: 'Longbow', count: 1 },
      ],
      description: 'The scout makes two attacks, using Shortsword and Longbow in any combination.',
    },
  },
  {
    id: 'scout-shortsword',
    name: 'Shortsword',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  },
  {
    id: 'scout-longbow',
    name: 'Longbow',
    actionType: 'ranged-weapon',
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 150, long: 600 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 4 },
    damage: { dice: '1d8', modifier: 2, type: 'piercing' },
  },

  // ==========================================================================
  // PRIEST (CR 2)
  // ==========================================================================
  {
    id: 'priest-multiattack',
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
      description: 'The priest makes two attacks, using Mace or Radiant Flame in any combination.',
    },
  },
  {
    id: 'priest-mace',
    name: 'Mace',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 5 },
    damage: { dice: '1d6', modifier: 3, type: 'bludgeoning' },
    extraDamage: [{ dice: '2d4', modifier: 0, type: 'radiant' }],
  },
]);

// ============================================================================
// GENERIC SPELLS
// Stats (attack bonus, save DC) werden zur Laufzeit aus dem Spellcasting-Trait
// des Casters injiziert via resolveSpellWithCaster().
// ============================================================================

export const genericSpells = z.array(actionSchema).parse([
  // --------------------------------------------------------------------------
  // CANTRIPS (At-will)
  // --------------------------------------------------------------------------
  {
    id: 'spell-light',
    name: 'Light',
    actionType: 'utility',
    isSpell: true,
    timing: { type: 'action' },
    range: { type: 'touch', normal: 0 },
    targeting: { type: 'single', validTargets: 'any' },
    autoHit: true,
    description: 'Touch an object. It sheds bright light in a 20ft radius.',
  },
  {
    id: 'spell-radiant-flame',
    name: 'Radiant Flame',
    actionType: 'ranged-spell',
    isSpell: true,
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 60 },
    targeting: { type: 'single', validTargets: 'enemies' },
    attack: { bonus: 0 }, // Injiziert aus Spellcasting-Trait
    damage: { dice: '2d10', modifier: 0, type: 'radiant' },
    description: 'Ranged spell attack. 2d10 radiant damage.',
  },

  // --------------------------------------------------------------------------
  // 1ST LEVEL SPELLS
  // --------------------------------------------------------------------------
  {
    id: 'spell-healing-word',
    name: 'Healing Word',
    actionType: 'healing',
    isSpell: true,
    timing: { type: 'bonus' },
    range: { type: 'ranged', normal: 60 },
    targeting: { type: 'single', validTargets: 'allies' },
    autoHit: true,
    healing: { dice: '1d4', modifier: 3 },
    description: 'Heals 1d4+3 HP to an ally within 60 feet.',
  },
  {
    id: 'spell-bless',
    name: 'Bless',
    actionType: 'buff',
    isSpell: true,
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 30 },
    targeting: { type: 'multiple', validTargets: 'allies', maxTargets: 3 },
    autoHit: true,
    concentration: true,
    effects: [
      {
        rollModifiers: [
          { on: 'attacks', type: 'dice', value: '1d4' },
          { on: 'saves', type: 'dice', value: '1d4' },
        ],
        duration: { type: 'concentration', value: 10 },
        affectsTarget: 'ally',
      },
    ],
    description: 'Up to 3 creatures gain +1d4 to attacks and saves.',
  },

  // --------------------------------------------------------------------------
  // 2ND LEVEL SPELLS
  // --------------------------------------------------------------------------
  {
    id: 'spell-lesser-restoration',
    name: 'Lesser Restoration',
    actionType: 'buff',
    isSpell: true,
    timing: { type: 'action' },
    range: { type: 'touch', normal: 0 },
    targeting: { type: 'single', validTargets: 'allies' },
    autoHit: true,
    effects: [
      {
        removeConditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
        affectsTarget: 'ally',
      },
    ],
    description: 'Removes blinded, deafened, paralyzed, or poisoned.',
  },

  // --------------------------------------------------------------------------
  // 3RD LEVEL SPELLS
  // --------------------------------------------------------------------------
  {
    id: 'spell-dispel-magic',
    name: 'Dispel Magic',
    actionType: 'debuff',
    isSpell: true,
    timing: { type: 'action' },
    range: { type: 'ranged', normal: 120 },
    targeting: { type: 'single', validTargets: 'any' },
    autoHit: true,
    effects: [
      {
        breakConcentration: true,
        affectsTarget: 'enemy',
      },
    ],
    description: 'Ends concentration spell effects on target.',
  },
  {
    id: 'spell-spirit-guardians',
    name: 'Spirit Guardians',
    actionType: 'buff',
    isSpell: true,
    timing: { type: 'action' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    concentration: true,
    effects: [
      // on-start-turn: Damage when enemy starts turn in zone
      {
        trigger: 'on-start-turn',
        damage: { dice: '3d8', modifier: 0, type: 'radiant' },
        save: { ability: 'wis', dc: 1, onSave: 'half' }, // DC injiziert aus Trait (placeholder)
        affectsTarget: 'enemy',
        duration: { type: 'concentration', value: 100 },
        zone: { radius: 15, targetFilter: 'enemies', speedModifier: 0.5 },
      },
      // on-enter: Damage when enemy enters zone
      {
        trigger: 'on-enter',
        damage: { dice: '3d8', modifier: 0, type: 'radiant' },
        save: { ability: 'wis', dc: 1, onSave: 'half' }, // DC injiziert aus Trait (placeholder)
        affectsTarget: 'enemy',
        zone: { radius: 15, targetFilter: 'enemies' },
      },
    ],
    description: '15ft emanation. 3d8 radiant (WIS save half) when enemy enters or starts turn. Halves enemy speed.',
  },
]);

// ============================================================================
// PASSIVE TRAITS
// ============================================================================

export const passiveTraits = z.array(actionSchema).parse([
  {
    id: 'trait-pack-tactics',
    name: 'Pack Tactics',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    schemaModifiers: [{
      id: 'pack-tactics',
      name: 'Pack Tactics',
      description: 'Advantage if non-incapacitated ally is adjacent to target',
      condition: {
        type: 'exists',
        entity: { type: 'quantified', quantifier: 'any', filter: 'ally', relativeTo: 'attacker' },
        where: {
          type: 'and',
          conditions: [
            { type: 'adjacent-to', subject: 'self', object: 'target' },
            { type: 'is-incapacitated', entity: 'self', negate: true },
          ],
        },
      },
      effect: { advantage: true },
      priority: 7,
    }],
    description: 'Advantage on attack rolls if non-incapacitated ally is within 5 feet of target.',
  },
  {
    id: 'trait-long-limbed',
    name: 'Long-Limbed',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    schemaModifiers: [{
      id: 'long-limbed',
      name: 'Long-Limbed',
      description: '+5 ft reach on melee weapon attacks',
      condition: {
        type: 'action-is-type',
        actionType: 'melee-weapon',
      },
      effect: {
        propertyModifiers: [
          { path: 'range.normal', operation: 'add', value: 5 },
        ],
      },
      priority: 5,
    }],
    description: 'Melee weapon attacks have +5 ft reach.',
  },
  {
    id: 'trait-abduct',
    name: 'Abduct',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    // Note: Effect is implemented in combatState.ts getEffectiveSpeed() + setPosition()
    // Creatures with this trait don't have halved speed when dragging grappled targets
    description: 'The creature needn\'t spend extra movement to move a creature it is grappling.',
  },
  {
    id: 'trait-nimble-escape',
    name: 'Nimble Escape',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    schemaModifiers: [{
      id: 'nimble-escape-timing',
      name: 'Nimble Escape',
      description: 'Disengage/Hide as bonus action',
      condition: {
        type: 'action-is-id',
        actionId: ['std-disengage', 'std-hide'],
      },
      effect: {
        propertyModifiers: [
          { path: 'timing.type', operation: 'set', value: 'bonus' },
        ],
      },
      priority: 10,
    }],
    description: 'Take the Disengage or Hide action as a bonus action.',
  },
  {
    id: 'trait-goblin-cunning',
    name: 'Goblin Cunning',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    schemaModifiers: [{
      id: 'goblin-cunning-damage',
      name: 'Goblin Cunning',
      description: '+1d4 damage when attack has advantage',
      condition: {
        type: 'has-advantage',
      },
      effect: { damageBonus: '1d4' },
      priority: 5,
    }],
    description: 'Deal +1d4 damage when attack roll has advantage.',
  },

  // ==========================================================================
  // AURA TRAITS
  // Emanations that affect allies within radius.
  // Uses aura.radius for automatic ally-scanning in situationalModifiers.ts
  // ==========================================================================
  {
    id: 'trait-aura-of-authority',
    name: 'Aura of Authority',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    aura: { radius: 10 },  // 10ft emanation
    schemaModifiers: [{
      id: 'aura-of-authority',
      name: 'Aura of Authority',
      description: 'Advantage on attack rolls within 10ft aura',
      // No condition needed - aura check (distance, incapacitated) is done in situationalModifiers.ts
      // Always active for creatures within the aura
      condition: {
        type: 'not',
        condition: { type: 'is-incapacitated', entity: 'attacker' },
      },
      effect: { advantage: true },
      priority: 8,  // Higher than Pack Tactics (7)
    }],
    // HACK: Saving throw advantage not implemented - only attack rolls
    description: 'Allies within 10 feet have advantage on attack rolls.',
  },

  // ==========================================================================
  // SPELLCASTING TRAITS
  // Definieren Spellcasting-Stats und verfügbare Spells für Caster.
  // Die generischen Spells (spell-*) bekommen ihre Stats aus diesen Traits.
  // ==========================================================================
  {
    id: 'priest-spellcasting',
    name: 'Spellcasting (Priest)',
    actionType: 'buff',
    timing: { type: 'passive' },
    range: { type: 'self', normal: 0 },
    targeting: { type: 'single', validTargets: 'self' },
    autoHit: true,
    spellcasting: {
      ability: 'wis',
      attackBonus: 5,
      saveDC: 13,
      spells: [
        // At-will Cantrips
        { spellId: 'spell-light', uses: 'at-will' },
        { spellId: 'spell-radiant-flame', uses: 'at-will' },
        // 1/Day Spells
        { spellId: 'spell-spirit-guardians', uses: 1 },
        // Divine Aid Pool (3/Day TOTAL für alle 4 Spells)
        { spellId: 'spell-bless', poolId: 'divine-aid' },
        { spellId: 'spell-dispel-magic', poolId: 'divine-aid' },
        { spellId: 'spell-healing-word', poolId: 'divine-aid' },
        { spellId: 'spell-lesser-restoration', poolId: 'divine-aid' },
      ],
      pools: {
        'divine-aid': { uses: 3, rechargeOn: 'long-rest' },
      },
    },
    description: 'WIS-based spellcasting. Spell attack +5, Save DC 13. Divine Aid 3/Day.',
  },
]);

// Default-Export für CLI-Loading
// Inkludiert standardActions + alle Monster-Actions + generic spells + passive traits
export default [...standardActions, ...actionPresets, ...genericSpells, ...passiveTraits];
