/**
 * Text Formatter
 *
 * Formatiert Pipeline-Outputs als lesbaren Text.
 */

import type {
  EncounterContext,
  EncounterDraft,
  FlavouredEncounter,
  DifficultyResult,
  BalancedEncounter,
  PipelineState,
  CreatureGroup,
  FlavouredGroup,
} from '../types/encounter.js';

// =============================================================================
// Helper
// =============================================================================

/**
 * Erstellt eine Zeile mit Label und Wert.
 */
function line(label: string, value: string | number, indent = 2): string {
  const padding = ' '.repeat(indent);
  return `${padding}${label.padEnd(14)} ${value}`;
}

/**
 * Erstellt einen Header-Block.
 */
function header(title: string): string {
  return `\n=== ${title} ===\n`;
}

/**
 * Erstellt einen Sub-Header.
 */
function subHeader(title: string): string {
  return `\n  --- ${title} ---`;
}

// =============================================================================
// Context Formatter
// =============================================================================

/**
 * Formatiert einen EncounterContext als lesbaren Text.
 */
export function formatContextText(context: EncounterContext): string {
  const lines: string[] = [];

  lines.push(header('EncounterContext'));
  lines.push(line('Terrain:', `${context.terrain.name} (${context.terrain.id})`));
  lines.push(line('Time:', context.time));
  lines.push(line('Trigger:', context.triggeredBy));
  lines.push(line('Party Size:', `${context.party.size} (avg level ${context.party.averageLevel})`));
  lines.push(line('Features:', `${context.features.length}`));

  if (context.weather) {
    lines.push(line('Weather:', `${context.weather.precipitation}, visibility ${context.weather.visibility}`));
  } else {
    lines.push(line('Weather:', '(not set)'));
  }

  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// Draft Formatter
// =============================================================================

/**
 * Formatiert eine CreatureGroup.
 */
function formatGroup(group: CreatureGroup, index: number): string[] {
  const lines: string[] = [];
  lines.push(`    Group ${index + 1}: ${group.id}`);
  lines.push(`      Role: ${group.narrativeRole}`);
  lines.push(`      Template: ${group.templateId}`);
  lines.push(`      Creatures: ${group.creatures.length}`);

  for (const creature of group.creatures) {
    lines.push(`        - ${creature.name} (HP ${creature.currentHp}/${creature.maxHp}, AC ${creature.ac})`);
  }

  return lines;
}

/**
 * Formatiert einen EncounterDraft als lesbaren Text.
 */
export function formatDraftText(draft: EncounterDraft): string {
  const lines: string[] = [];

  lines.push(header('EncounterDraft'));
  lines.push(line('Seed:', `${draft.seedCreature.name} (CR ${draft.seedCreature.cr})`));
  lines.push(line('Template:', `${draft.template.name} (${draft.template.id})`));
  lines.push(line('Multi-Group:', draft.isMultiGroup ? 'Yes' : 'No'));
  lines.push(line('Groups:', `${draft.groups.length}`));

  for (let i = 0; i < draft.groups.length; i++) {
    lines.push(...formatGroup(draft.groups[i], i));
  }

  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// Flavoured Formatter
// =============================================================================

/**
 * Formatiert eine FlavouredGroup.
 */
function formatFlavouredGroup(group: FlavouredGroup, index: number): string[] {
  const lines: string[] = [];
  lines.push(`    Group ${index + 1}: ${group.id}`);
  lines.push(`      Role: ${group.narrativeRole}`);
  lines.push(`      Activity: ${group.activity.name} (${group.activity.awareness})`);
  lines.push(`      Goal: ${group.goal.name} (${group.goal.priority})`);

  if (group.leadNpc) {
    lines.push(`      Lead NPC: ${group.leadNpc.name}`);
  }

  lines.push(`      Loot: ${group.loot.items.length} items (${group.loot.totalValue.toFixed(1)} gp)`);
  if (group.loot.items.length > 0) {
    for (const { item, quantity } of group.loot.items.slice(0, 5)) {
      lines.push(`        - ${quantity}x ${item.name} (${(item.value * quantity).toFixed(1)} gp)`);
    }
    if (group.loot.items.length > 5) {
      lines.push(`        ... and ${group.loot.items.length - 5} more items`);
    }
  }
  lines.push(`      Creatures: ${group.creatures.length}`);

  for (const creature of group.creatures) {
    lines.push(`        - ${creature.name} (HP ${creature.currentHp}/${creature.maxHp})`);
  }

  return lines;
}

/**
 * Formatiert ein FlavouredEncounter als lesbaren Text.
 */
export function formatFlavouredText(flavoured: FlavouredEncounter): string {
  const lines: string[] = [];

  lines.push(header('FlavouredEncounter'));
  lines.push(line('Seed:', `${flavoured.seedCreature.name} (CR ${flavoured.seedCreature.cr})`));
  lines.push(line('Template:', `${flavoured.template.name}`));
  lines.push(line('Distance:', `${flavoured.encounterDistance} ft`));
  lines.push(line('Multi-Group:', flavoured.isMultiGroup ? 'Yes' : 'No'));
  lines.push(line('Groups:', `${flavoured.groups.length}`));

  for (let i = 0; i < flavoured.groups.length; i++) {
    lines.push(...formatFlavouredGroup(flavoured.groups[i], i));
  }

  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// Difficulty Formatter
// =============================================================================

/**
 * Formatiert ein DifficultyResult als lesbaren Text.
 */
export function formatDifficultyText(difficulty: DifficultyResult): string {
  const lines: string[] = [];

  lines.push(header('DifficultyResult'));
  lines.push(line('Difficulty:', difficulty.difficulty.toUpperCase()));
  lines.push(line('Win Prob:', `${(difficulty.partyWinProbability * 100).toFixed(1)}%`));
  lines.push(line('TPK Risk:', `${(difficulty.tpkRisk * 100).toFixed(1)}%`));
  lines.push(line('XP Reward:', `${difficulty.xpReward}`));
  lines.push(line('Method:', difficulty.simulationMethod));

  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// Balanced Formatter
// =============================================================================

/**
 * Formatiert ein BalancedEncounter als lesbaren Text.
 * Updated for new BalanceInfo schema (Adjustments.md:917-933)
 */
export function formatBalancedText(balanced: BalancedEncounter): string {
  const lines: string[] = [];

  lines.push(header('BalancedEncounter'));

  // Balance info
  lines.push(subHeader('Balance'));
  lines.push(line('Target:', balanced.balance.targetDifficulty.toUpperCase()));
  lines.push(line('Actual:', balanced.balance.actualDifficulty.toUpperCase()));
  lines.push(line('Win Prob:', `${(balanced.balance.partyWinProbability * 100).toFixed(1)}%`));
  lines.push(line('TPK Risk:', `${(balanced.balance.tpkRisk * 100).toFixed(1)}%`));
  lines.push(line('Combat Prob:', `${(balanced.balance.combatProbability * 100).toFixed(1)}%`));
  lines.push(line('Adjustments:', `${balanced.balance.adjustmentsMade}`));

  // XP info
  lines.push(subHeader('XP'));
  lines.push(line('Base XP:', `${balanced.balance.xpReward}`));
  lines.push(line('Adjusted XP:', `${balanced.balance.adjustedXP}`));

  // Groups summary
  lines.push(subHeader('Groups'));
  lines.push(line('Count:', `${balanced.groups.length}`));
  lines.push(line('Distance:', `${balanced.encounterDistance} ft`));

  for (let i = 0; i < balanced.groups.length; i++) {
    const group = balanced.groups[i];
    lines.push(`    Group ${i + 1}: ${group.creatures.length} creatures, ${group.activity.name}`);
  }

  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// State Formatter
// =============================================================================

/**
 * Formatiert den gesamten PipelineState als lesbaren Text.
 */
export function formatStateText(state: PipelineState): string {
  const hasState = Object.values(state).some((v) => v !== undefined);

  if (!hasState) {
    return '\nPipeline-State ist leer.\nStarte mit "initiate --terrain <terrain> --time <time>" oder "generate".\n';
  }

  const lines: string[] = [];
  lines.push(header('Pipeline State'));

  // Show what's available
  const stages = [
    { name: 'Context', value: state.context },
    { name: 'Draft', value: state.draft },
    { name: 'Flavoured', value: state.flavoured },
    { name: 'Difficulty', value: state.difficulty },
    { name: 'Balanced', value: state.balanced },
  ];

  for (const stage of stages) {
    const status = stage.value ? 'SET' : '-';
    lines.push(line(`${stage.name}:`, status));
  }

  lines.push('');

  // Show details for each available stage
  if (state.context) {
    lines.push(formatContextText(state.context));
  }

  if (state.draft) {
    lines.push(formatDraftText(state.draft));
  }

  if (state.flavoured) {
    lines.push(formatFlavouredText(state.flavoured));
  }

  if (state.difficulty) {
    lines.push(formatDifficultyText(state.difficulty));
  }

  if (state.balanced) {
    lines.push(formatBalancedText(state.balanced));
  }

  return lines.join('\n');
}
