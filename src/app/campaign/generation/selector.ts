// Adapted from the existing SaltMarcher pure generator module.
import type { ChallengeRating, EncounterRole } from './catalog-types';
import { encounterXpMultiplier } from '../../catalog/encounter-contracts';
import { compareText, type EncounterEntropy } from './deterministic-order.js';
import { encounterCandidateStream } from './entropy-streams.js';
import { type GeneratorPresetConfigV3, type ScaledRange } from './config';
import {
  generatorChallengeRatings,
  maximumGeneratorCandidateCount,
  roleAt,
  type GeneratorRole,
} from './model';

export type CompositionCatalog = Readonly<{
  challengeRatings: readonly Readonly<
    ChallengeRating & {
      availableQuantity: number | null;
      maximumSingleQuantity: number | null;
      availableStatblocks: number | null;
    }
  >[];
}>;

export type Block = Readonly<{
  id: string;
  role: EncounterRole;
  cr: ChallengeRating;
  quantity: number;
  availableStatblocks: number | null;
}>;

export type FixedRoster = Readonly<{
  units: readonly Readonly<{ unitXp: number; quantity: number }>[];
  statblockCount: number;
  initiativeSlots: number;
}>;

export const emptyFixedRoster: FixedRoster = {
  units: [],
  statblockCount: 0,
  initiativeSlots: 0,
};

export type SoftConstraintDiagnostic = Readonly<{
  constraint: 'statblocks' | 'monsters' | 'initiativeSlots';
  value: number;
  minimum: number;
  maximum: number;
  normalizedDistance: number;
}>;

export type CompositionMetrics = Readonly<{
  adjustedXp: number;
  xpDelta: number;
  monsterCount: number;
  statblockCount: number;
  initiativeSlots: number;
  xpMultiplier: number;
}>;

export type EncounterComposition = Readonly<{
  blocks: readonly Readonly<{
    role: GeneratorRole;
    challengeRating: string;
    quantity: number;
    statblockSlots: number;
  }>[];
  metrics: CompositionMetrics;
  diagnostics: readonly SoftConstraintDiagnostic[];
  candidateCount: number;
  fitCandidateCount: number;
}>;

export type EncounterCandidate = Readonly<{
  id: string;
  combinationId: string;
  target: number;
  blocks: readonly Block[];
  adjustedXp: number;
  delta: number;
  monsterCount: number;
  statblockCount: number;
  statblockSlots: readonly number[];
  initiativeSlots: number;
  xpMultiplier: number;
  softFit: boolean;
  softDistance: number;
  tuningDistance: number;
  diagnostics: readonly SoftConstraintDiagnostic[];
}>;

export type SelectionIndex = ReadonlyMap<EncounterRole, readonly Block[]>;

export type SelectedEncounter = Readonly<{
  encounterNumber: number;
  target: number;
  candidate: EncounterCandidate | undefined;
  composition: EncounterComposition | undefined;
  candidateCount: number;
  fitCandidateCount: number;
  selectedFit: boolean;
  selectedSoftFit: boolean;
}>;

export function buildSelectionIndex(
  catalog: CompositionCatalog,
  partyLevel: number,
  config: GeneratorPresetConfigV3,
): SelectionIndex {
  const blocksByRole = new Map<EncounterRole, Block[]>();
  for (const cr of catalog.challengeRatings) {
    if (!cr.active) continue;
    const crIndex = generatorChallengeRatings.indexOf(
      cr.label as (typeof generatorChallengeRatings)[number],
    );
    if (crIndex < 0) continue;
    const role = roleAt(config.composition.roleMatrix, partyLevel, crIndex);
    if (role === 'none') continue;
    const range = config.composition.roleQuantities[role];
    const encounterRole = titleRole(role);
    for (let quantity = Math.max(1, range.min); quantity <= range.max; quantity += 1) {
      const availableQuantity =
        config.composition.mixing === 'one-per-cr-block'
          ? cr.maximumSingleQuantity
          : cr.availableQuantity;
      if (availableQuantity !== null && quantity > availableQuantity) continue;
      const block: Block = {
        id: `${encounterRole}_CR${cr.label.replace('/', '_')}_Nr${quantity}`,
        role: encounterRole,
        cr,
        quantity,
        availableStatblocks: cr.availableStatblocks,
      };
      const current = blocksByRole.get(encounterRole) ?? [];
      current.push(block);
      blocksByRole.set(encounterRole, current);
    }
  }
  // Ranking is exhaustive and uses named entropy plus a stable ID for ties.
  // Index order is not a second ranking policy.
  return blocksByRole;
}

export function selectEncounter(
  seed: number,
  encounterNumber: number,
  target: number,
  blocksByRole: SelectionIndex,
  entropy: EncounterEntropy,
  config: GeneratorPresetConfigV3,
  partySize: number,
  fixed: FixedRoster = emptyFixedRoster,
  maximumAdjustedXp: number = Infinity,
): SelectedEncounter {
  const evaluationContext = candidateEvaluationContext(config, partySize, fixed);
  let chosenBlocks: readonly Block[] | undefined;
  let chosenCombinationId: string | undefined;
  let chosenEvaluation: CandidateEvaluation | undefined;
  let chosenFit = false;
  let chosenEntropy: number | undefined;
  let candidateCount = 0;
  let fitCandidateCount = 0;

  // An explicit roster can already be a complete encounter. Never force filler.
  if (
    fixed.units.some((unit) => unit.quantity > 0) &&
    evaluateCandidate([], [], evaluationContext, target).adjustedXp <= maximumAdjustedXp
  ) {
    chosenBlocks = [];
    chosenCombinationId = 'fixed-roster';
    chosenEvaluation = evaluateCandidate([], [], evaluationContext, target);
    chosenFit = withinTargetBand(chosenEvaluation.delta, target);
    candidateCount = 1;
    fitCandidateCount = chosenFit ? 1 : 0;
  }

  for (const roles of config.composition.roleCombinations) {
    if (
      roles.length < config.composition.crBlocks.min ||
      roles.length > config.composition.crBlocks.max
    )
      continue;
    const choices = roles.map((role) => blocksByRole.get(titleRole(role)) ?? []);
    if (choices.some((choice) => choice.length === 0)) continue;
    const combinationId = `preset:${roles.join('-')}`;
    visitCartesian(choices, (blocks) => {
      const requestedStatblocks = statblockSlotsForBlocks(blocks, config);
      if (
        blocks.some(
          (block, index) =>
            block.availableStatblocks !== null &&
            (requestedStatblocks[index] ?? 1) > block.availableStatblocks,
        )
      )
        return;
      candidateCount += 1;
      if (candidateCount > maximumGeneratorCandidateCount)
        throw new Error('Generator candidate limit exceeded after validation.');
      const current = evaluateCandidate(blocks, requestedStatblocks, evaluationContext, target);
      if (current.adjustedXp > maximumAdjustedXp) return;
      const fit = withinTargetBand(current.delta, target);
      if (fit) fitCandidateCount += 1;
      const domainOrder = chosenEvaluation
        ? compareCandidateDomain(current, fit, chosenEvaluation, chosenFit)
        : -1;
      let replace = domainOrder < 0;
      let currentEntropy: number | undefined;
      if (domainOrder === 0 && chosenBlocks) {
        const currentId = candidateId(encounterNumber, blocks);
        const chosenId = candidateId(encounterNumber, chosenBlocks);
        currentEntropy = candidateEntropy(currentId, seed, encounterNumber, entropy);
        chosenEntropy ??= candidateEntropy(chosenId, seed, encounterNumber, entropy);
        replace =
          currentEntropy < chosenEntropy ||
          (currentEntropy === chosenEntropy && compareText(currentId, chosenId) < 0);
      }
      if (replace) {
        chosenBlocks = [...blocks];
        chosenCombinationId = combinationId;
        chosenEvaluation = current;
        chosenFit = fit;
        chosenEntropy = currentEntropy;
      }
    });
  }

  const chosen =
    chosenBlocks && chosenCombinationId && chosenEvaluation
      ? candidate(
          encounterNumber,
          target,
          chosenCombinationId,
          chosenBlocks,
          config,
          partySize,
          chosenEvaluation,
        )
      : undefined;

  return {
    encounterNumber,
    target,
    candidate: chosen,
    composition: chosen
      ? encounterComposition(chosen, candidateCount, fitCandidateCount)
      : undefined,
    candidateCount,
    fitCandidateCount,
    selectedFit: chosen !== undefined && withinTargetBand(chosen.delta, target),
    selectedSoftFit: chosen?.softFit ?? false,
  };
}

function candidate(
  encounterNumber: number,
  target: number,
  combinationId: string,
  blocks: readonly Block[],
  config: GeneratorPresetConfigV3,
  partySize: number,
  evaluated: CandidateEvaluation,
): EncounterCandidate {
  const {
    adjustedXp,
    delta,
    initiativeSlots,
    monsterCount,
    softDistance,
    statblockCount,
    statblockSlots,
    tuningDistance,
    xpMultiplier,
  } = evaluated;
  const diagnostics = [
    rangeDiagnostic('statblocks', statblockCount, config.composition.statblocks),
    rangeDiagnostic('monsters', monsterCount, resolveRange(config.composition.monsters, partySize)),
    rangeDiagnostic(
      'initiativeSlots',
      initiativeSlots,
      resolveRange(config.composition.initiativeSlots, partySize),
    ),
  ].filter((entry): entry is SoftConstraintDiagnostic => entry !== null);
  return {
    id: candidateId(encounterNumber, blocks),
    combinationId,
    target,
    blocks: [...blocks],
    adjustedXp,
    delta,
    monsterCount,
    statblockCount,
    statblockSlots,
    initiativeSlots,
    xpMultiplier,
    softFit: diagnostics.length === 0,
    softDistance,
    tuningDistance,
    diagnostics,
  };
}

type CandidateEvaluation = Readonly<{
  adjustedXp: number;
  delta: number;
  monsterCount: number;
  statblockCount: number;
  statblockSlots: readonly number[];
  initiativeSlots: number;
  xpMultiplier: number;
  softDistance: number;
  tuningDistance: number;
}>;

type CandidateEvaluationContext = Readonly<{
  config: GeneratorPresetConfigV3;
  partySize: number;
  fixed: FixedRoster;
  fixedMonsterCount: number;
  fixedRawXp: number;
  monsterRange: Readonly<{ min: number; max: number }>;
  initiativeRange: Readonly<{ min: number; max: number }>;
  amountTarget: number | null;
  diversityTarget: number | null;
}>;

function candidateEvaluationContext(
  config: GeneratorPresetConfigV3,
  partySize: number,
  fixed: FixedRoster,
): CandidateEvaluationContext {
  const monsterRange = resolveRange(config.composition.monsters, partySize);
  const initiativeRange = resolveRange(config.composition.initiativeSlots, partySize);
  return {
    config,
    partySize,
    fixed,
    fixedMonsterCount: fixed.units.reduce((sum, unit) => sum + unit.quantity, 0),
    fixedRawXp: fixed.units.reduce((sum, unit) => sum + unit.unitXp * unit.quantity, 0),
    monsterRange,
    initiativeRange,
    amountTarget:
      config.generationDefaults.amount === 'few'
        ? monsterRange.min
        : config.generationDefaults.amount === 'many'
          ? monsterRange.max
          : config.generationDefaults.amount === 'standard'
            ? (monsterRange.min + monsterRange.max) / 2
            : null,
    diversityTarget:
      config.generationDefaults.diversity === 'low'
        ? config.composition.statblocks.min
        : config.generationDefaults.diversity === 'high'
          ? config.composition.statblocks.max
          : null,
  };
}

function evaluateCandidate(
  blocks: readonly Block[],
  statblockSlots: readonly number[],
  context: CandidateEvaluationContext,
  target: number,
): CandidateEvaluation {
  const { config, fixed } = context;
  let rawXp = context.fixedRawXp;
  let monsterCount = context.fixedMonsterCount;
  for (const block of blocks) {
    rawXp += block.cr.xp * block.quantity;
    monsterCount += block.quantity;
  }
  const xpMultiplier = encounterXpMultiplier(monsterCount, context.partySize);
  const adjustedXp = Math.round(rawXp * xpMultiplier);
  const statblockCount =
    fixed.statblockCount + statblockSlots.reduce((sum, quantity) => sum + quantity, 0);
  const initiativeSlots =
    fixed.initiativeSlots +
    estimatedInitiativeSlots(blocks, statblockSlots, config.combat.mobThreshold);
  const softDistance =
    rangeDistance(statblockCount, config.composition.statblocks) +
    rangeDistance(monsterCount, context.monsterRange) +
    rangeDistance(initiativeSlots, context.initiativeRange);
  let minimumBlockXp = Number.POSITIVE_INFINITY;
  let maximumBlockXp = 1;
  for (const block of blocks) {
    minimumBlockXp = Math.min(minimumBlockXp, block.cr.xp);
    maximumBlockXp = Math.max(maximumBlockXp, block.cr.xp);
  }
  const amountDistance =
    context.amountTarget === null
      ? 0
      : Math.abs(monsterCount - context.amountTarget) /
        Math.max(1, context.monsterRange.max - context.monsterRange.min);
  const diversityDistance =
    context.diversityTarget === null
      ? 0
      : Math.abs(statblockCount - context.diversityTarget) /
        Math.max(1, config.composition.statblocks.max - config.composition.statblocks.min);
  const spread = blocks.length ? (maximumBlockXp - minimumBlockXp) / maximumBlockXp : 0;
  const balanceDistance =
    config.generationDefaults.balance === 'even'
      ? spread
      : config.generationDefaults.balance === 'varied'
        ? 1 - spread
        : 0;
  return {
    adjustedXp,
    delta: adjustedXp - target,
    monsterCount,
    statblockCount,
    statblockSlots,
    initiativeSlots,
    xpMultiplier,
    softDistance,
    tuningDistance: amountDistance + diversityDistance + balanceDistance,
  };
}

function candidateId(encounterNumber: number, blocks: readonly Block[]): string {
  return `${encounterNumber}:${blocks.map((block) => block.id).join('|')}`;
}

function encounterComposition(
  selected: EncounterCandidate,
  candidateCount: number,
  fitCandidateCount: number,
): EncounterComposition {
  return {
    blocks: selected.blocks.map((block, index) => ({
      role: lowerRole(block.role),
      challengeRating: block.cr.label,
      quantity: block.quantity,
      statblockSlots: selected.statblockSlots[index] ?? 1,
    })),
    metrics: {
      adjustedXp: selected.adjustedXp,
      xpDelta: selected.delta,
      monsterCount: selected.monsterCount,
      statblockCount: selected.statblockCount,
      initiativeSlots: selected.initiativeSlots,
      xpMultiplier: selected.xpMultiplier,
    },
    diagnostics: selected.diagnostics,
    candidateCount,
    fitCandidateCount,
  };
}

function visitCartesian(
  choices: readonly (readonly Block[])[],
  visit: (blocks: readonly Block[]) => void,
  depth = 0,
  prefix: Block[] = [],
): void {
  if (depth === choices.length) {
    visit(prefix);
    return;
  }
  for (const block of choices[depth] ?? []) {
    prefix.push(block);
    visitCartesian(choices, visit, depth + 1, prefix);
    prefix.pop();
  }
}

function candidateEntropy(
  candidateId: string,
  seed: number,
  encounterNumber: number,
  entropy: EncounterEntropy,
): number {
  return entropy.unit(encounterCandidateStream(seed, encounterNumber, candidateId));
}

function compareCandidateDomain(
  left: CandidateEvaluation,
  leftFit: boolean,
  right: CandidateEvaluation,
  rightFit: boolean,
): number {
  if (leftFit !== rightFit) return leftFit ? -1 : 1;
  const softDistance = left.softDistance - right.softDistance;
  if (softDistance !== 0) return softDistance;
  const tuningDistance = left.tuningDistance - right.tuningDistance;
  if (tuningDistance !== 0) return tuningDistance;
  return Math.abs(left.delta) - Math.abs(right.delta);
}

function withinTargetBand(delta: number, target: number): boolean {
  return Math.abs(delta) * 100 <= target * 5;
}

export function resolveRange(range: ScaledRange, partySize: number): { min: number; max: number } {
  return {
    min: range.min.value * (range.min.perPlayer ? partySize : 1),
    max: range.max.value * (range.max.perPlayer ? partySize : 1),
  };
}

function rangeDiagnostic(
  constraint: SoftConstraintDiagnostic['constraint'],
  value: number,
  range: { min: number; max: number },
): SoftConstraintDiagnostic | null {
  if (value >= range.min && value <= range.max) return null;
  return {
    constraint,
    value,
    minimum: range.min,
    maximum: range.max,
    normalizedDistance: rangeDistance(value, range),
  };
}

function rangeDistance(value: number, range: { min: number; max: number }): number {
  if (value < range.min) return (range.min - value) / Math.max(1, range.min);
  if (value > range.max) return (value - range.max) / Math.max(1, range.max);
  return 0;
}

function estimatedInitiativeSlots(
  blocks: readonly Block[],
  statblockSlots: readonly number[],
  mobThreshold: number,
): number {
  let slots = 0;
  for (const [index, block] of blocks.entries()) {
    const inCrBlock = statblockSlots[index] ?? 1;
    const base = Math.floor(block.quantity / inCrBlock);
    const remainder = block.quantity % inCrBlock;
    for (let statblock = 0; statblock < inCrBlock; statblock += 1) {
      const quantity = base + (statblock < remainder ? 1 : 0);
      slots += mobThreshold > 0 && quantity >= mobThreshold ? 1 : quantity;
    }
  }
  return slots;
}

export function statblockSlotsForBlocks(
  blocks: readonly {
    quantity: number;
    availableStatblocks?: number | null;
  }[],
  config: GeneratorPresetConfigV3,
): number[] {
  const result = new Array<number>(blocks.length);
  if (config.composition.mixing === 'one-per-cr-block') {
    result.fill(1);
    return result;
  }
  let monsterCount = 0;
  let totalCapacity = 0;
  const maximumByBlock = new Array<number>(blocks.length);
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    monsterCount += block.quantity;
    const capacity = Math.min(block.quantity, block.availableStatblocks ?? block.quantity);
    maximumByBlock[index] = capacity;
    totalCapacity += capacity;
  }
  const requested =
    config.generationDefaults.diversity === 'high'
      ? config.composition.statblocks.max
      : config.composition.statblocks.min;
  let remaining = clamp(
    requested,
    blocks.length,
    Math.min(config.composition.statblocks.max, monsterCount, totalCapacity),
  );
  let consumedCapacity = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const blocksLeft = blocks.length - index;
    const capacity = maximumByBlock[index] ?? block.quantity;
    const futureCapacity = totalCapacity - consumedCapacity - capacity;
    const minimumHere = Math.max(1, remaining - futureCapacity);
    const quantity = clamp(Math.max(minimumHere, Math.ceil(remaining / blocksLeft)), 1, capacity);
    result[index] = quantity;
    remaining -= quantity;
    consumedCapacity += capacity;
  }
  return result;
}

function lowerRole(role: EncounterRole): GeneratorRole {
  return role.toLowerCase() as GeneratorRole;
}

function titleRole(role: GeneratorRole): EncounterRole {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}` as EncounterRole;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
