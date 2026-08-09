import type {
  ChallengeRating,
  EncounterCatalog,
  EncounterRole
} from './catalog.js'
import { compareText, type EncounterEntropy } from './deterministic-order.js'
import {
  effectiveEncounterMultiplier,
  quantityMultiplier
} from '../encounter/xp-multipliers.js'
import {
  type GeneratorPresetConfigV3,
  type ScaledRange
} from '../../shared/contracts/generator-presets.js'
import {
  generatorChallengeRatings,
  maximumGeneratorCandidateCount,
  roleAt,
  type GeneratorRole
} from '../../shared/generator/generator-config-model.js'

export type CompositionCatalog = Readonly<{
  challengeRatings: readonly Readonly<
    ChallengeRating & {
      availableQuantity: number | null
      maximumSingleQuantity: number | null
      availableStatblocks: number | null
    }
  >[]
}>

export type Block = Readonly<{
  id: string
  role: EncounterRole
  cr: ChallengeRating
  quantity: number
  rawXp: number
  adjustedXp: number
  availableStatblocks: number | null
}>

export type FixedRoster = Readonly<{
  units: readonly Readonly<{ unitXp: number; quantity: number }>[]
  statblockCount: number
  initiativeSlots: number
}>

export const emptyFixedRoster: FixedRoster = {
  units: [],
  statblockCount: 0,
  initiativeSlots: 0
}

export type SoftConstraintDiagnostic = Readonly<{
  constraint: 'statblocks' | 'monsters' | 'initiativeSlots'
  value: number
  minimum: number
  maximum: number
  normalizedDistance: number
  message: string
}>

export type CompositionMetrics = Readonly<{
  adjustedXp: number
  xpDelta: number
  monsterCount: number
  statblockCount: number
  initiativeSlots: number
  effectiveMonsterCount: number
  xpMultiplier: number
}>

export type EncounterComposition = Readonly<{
  blocks: readonly Readonly<{
    role: GeneratorRole
    challengeRating: string
    quantity: number
    statblockSlots: number
  }>[]
  metrics: CompositionMetrics
  diagnostics: readonly SoftConstraintDiagnostic[]
  candidateCount: number
  fitCandidateCount: number
}>

export type EncounterCandidate = Readonly<{
  id: string
  combinationId: string
  target: number
  blocks: readonly Block[]
  adjustedXp: number
  delta: number
  monsterCount: number
  statblockCount: number
  statblockSlots: readonly number[]
  initiativeSlots: number
  effectiveMonsterCount: number
  xpMultiplier: number
  maxCr: number
  softFit: boolean
  softDistance: number
  tuningDistance: number
  diagnostics: readonly SoftConstraintDiagnostic[]
}>

export type SelectionIndex = ReadonlyMap<EncounterRole, readonly Block[]>

export type SelectedEncounter = Readonly<{
  encounterNumber: number
  target: number
  candidate: EncounterCandidate | undefined
  composition: EncounterComposition | undefined
  candidateCount: number
  fitCandidateCount: number
  selectedFit: boolean
  selectedSoftFit: boolean
}>

export function buildSelectionIndex(
  catalog: CompositionCatalog,
  partyLevel: number,
  config: GeneratorPresetConfigV3
): SelectionIndex {
  const crById = new Map(
    catalog.challengeRatings
      .filter((entry) => entry.active)
      .map((entry) => [entry.id, entry])
  )
  const bands = catalog.challengeRatings
    .filter((entry) => entry.active)
    .flatMap((cr) => {
      const crIndex = generatorChallengeRatings.indexOf(
        cr.label as (typeof generatorChallengeRatings)[number]
      )
      if (crIndex < 0) return []
      const cell = roleAt(config.composition.roleMatrix, partyLevel, crIndex)
      return cell === 'none' ? [] : [{ role: titleRole(cell), crId: cr.id }]
    })
  const blocksByRole = new Map<EncounterRole, Block[]>()
  for (const band of bands) {
    const cr = crById.get(band.crId)
    if (!cr) continue
    const range = config.composition.roleQuantities[lowerRole(band.role)]
    for (
      let quantity = Math.max(1, range.min);
      quantity <= range.max;
      quantity += 1
    ) {
      const availableQuantity =
        config.composition.mixing === 'one-per-cr-block'
          ? cr.maximumSingleQuantity
          : cr.availableQuantity
      if (availableQuantity !== null && quantity > availableQuantity) continue
      const block: Block = {
        id: `${band.role}_CR${cr.label.replace('/', '_')}_Nr${quantity}`,
        role: band.role,
        cr,
        quantity,
        rawXp: cr.xp * quantity,
        adjustedXp: Math.round(cr.xp * quantity * quantityMultiplier(quantity)),
        availableStatblocks: cr.availableStatblocks
      }
      const current = blocksByRole.get(band.role) ?? []
      current.push(block)
      blocksByRole.set(band.role, current)
    }
  }
  return new Map(
    [...blocksByRole].map(([role, blocks]) => [
      role,
      blocks.toSorted(
        (left, right) =>
          left.adjustedXp - right.adjustedXp || compareText(left.id, right.id)
      )
    ])
  )
}

export function selectEncounter(
  seed: number,
  encounterNumber: number,
  target: number,
  blocksByRole: SelectionIndex,
  entropy: EncounterEntropy,
  config: GeneratorPresetConfigV3,
  partySize: number,
  fixed: FixedRoster = emptyFixedRoster
): SelectedEncounter {
  const evaluationContext = candidateEvaluationContext(config, partySize, fixed)
  let chosenBlocks: readonly Block[] | undefined
  let chosenCombinationId: string | undefined
  let chosenEvaluation: CandidateEvaluation | undefined
  let chosenFit = false
  let chosenEntropy: number | undefined
  let candidateCount = 0
  let fitCandidateCount = 0

  for (const roles of config.composition.roleCombinations) {
    if (
      roles.length < config.composition.crBlocks.min ||
      roles.length > config.composition.crBlocks.max
    )
      continue
    const choices = roles.map((role) => blocksByRole.get(titleRole(role)) ?? [])
    if (choices.some((choice) => choice.length === 0)) continue
    const combinationId = `preset:${roles.join('-')}`
    visitCartesian(choices, (blocks) => {
      const requestedStatblocks = statblockSlotsForBlocks(blocks, config)
      if (
        blocks.some(
          (block, index) =>
            block.availableStatblocks !== null &&
            (requestedStatblocks[index] ?? 1) > block.availableStatblocks
        )
      )
        return
      candidateCount += 1
      if (candidateCount > maximumGeneratorCandidateCount)
        throw new Error('Generator candidate limit exceeded after validation.')
      const current = evaluateCandidate(
        blocks,
        requestedStatblocks,
        evaluationContext,
        target
      )
      const fit = withinTargetBand(current.delta, target)
      if (fit) fitCandidateCount += 1
      const domainOrder = chosenEvaluation
        ? compareCandidateDomain(current, fit, chosenEvaluation, chosenFit)
        : -1
      let replace = domainOrder < 0
      let currentEntropy: number | undefined
      if (domainOrder === 0 && chosenBlocks) {
        const currentId = candidateId(encounterNumber, blocks)
        const chosenId = candidateId(encounterNumber, chosenBlocks)
        currentEntropy = candidateEntropy(
          currentId,
          seed,
          encounterNumber,
          entropy
        )
        chosenEntropy ??= candidateEntropy(
          chosenId,
          seed,
          encounterNumber,
          entropy
        )
        replace =
          currentEntropy < chosenEntropy ||
          (currentEntropy === chosenEntropy &&
            compareText(currentId, chosenId) < 0)
      }
      if (replace) {
        chosenBlocks = [...blocks]
        chosenCombinationId = combinationId
        chosenEvaluation = current
        chosenFit = fit
        chosenEntropy = currentEntropy
      }
    })
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
          chosenEvaluation
        )
      : undefined

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
    selectedSoftFit: chosen?.softFit ?? false
  }
}

export function buildEncounterIntents(
  selected: readonly SelectedEncounter[],
  party: readonly { level: number; count: number }[]
) {
  const totalAdjustedXp = selected.reduce(
    (sum, entry) => sum + entry.candidate!.adjustedXp,
    0
  )
  const maxLevel = Math.max(...party.map((entry) => entry.level))
  const scores = selected.map((entry) => {
    const candidate = entry.candidate!
    const difficulty = difficultyFor(entry.encounterNumber, selected.length)
    const difficultyMultiplier =
      difficulty === 'MEDIUM'
        ? 1.5
        : difficulty === 'HARD'
          ? 2
          : difficulty === 'DEADLY'
            ? 3
            : 1
    return (
      (candidate.adjustedXp / Math.max(1, totalAdjustedXp)) *
      difficultyMultiplier *
      Math.min(2.5, 1 + candidate.maxCr / Math.max(1, maxLevel))
    )
  })
  const ranks = scores.map(
    (score, index) =>
      1 +
      scores.filter(
        (other, otherIndex) =>
          other > score || (other === score && otherIndex < index)
      ).length
  )
  return selected.map((entry, index) => {
    const candidate = entry.candidate!
    const composition = entry.composition!
    return {
      encounterNumber: entry.encounterNumber,
      targetXp: entry.target,
      adjustedXp: candidate.adjustedXp,
      xpDelta: candidate.delta,
      difficulty: difficultyFor(entry.encounterNumber, selected.length),
      patternId: candidate.combinationId,
      blocks: composition.blocks.map((block, blockIndex) => ({
        role: titleRole(block.role),
        challengeRating: block.challengeRating,
        challengeRatingCode: candidate.blocks[blockIndex]!.cr.code,
        quantity: block.quantity,
        statblockSlots: block.statblockSlots,
        unitXp: candidate.blocks[blockIndex]!.cr.xp
      })),
      monsterCount: composition.metrics.monsterCount,
      statblockCount: composition.metrics.statblockCount,
      effectiveMonsterCount: composition.metrics.effectiveMonsterCount,
      xpMultiplier: composition.metrics.xpMultiplier,
      bossinessRank: ranks[index]!,
      constraintDiagnostics: composition.diagnostics.map(
        (diagnostic) => diagnostic.message
      )
    }
  })
}

function candidate(
  encounterNumber: number,
  target: number,
  combinationId: string,
  blocks: readonly Block[],
  config: GeneratorPresetConfigV3,
  partySize: number,
  evaluated: CandidateEvaluation
): EncounterCandidate {
  const {
    adjustedXp,
    delta,
    effectiveMonsterCount,
    initiativeSlots,
    maxCr,
    monsterCount,
    softDistance,
    statblockCount,
    statblockSlots,
    tuningDistance,
    xpMultiplier
  } = evaluated
  const diagnostics = [
    rangeDiagnostic(
      'statblocks',
      'Statblöcke',
      statblockCount,
      config.composition.statblocks
    ),
    rangeDiagnostic(
      'monsters',
      'Monster',
      monsterCount,
      resolveRange(config.composition.monsters, partySize)
    ),
    rangeDiagnostic(
      'initiativeSlots',
      'Init-Slots',
      initiativeSlots,
      resolveRange(config.composition.initiativeSlots, partySize)
    )
  ].filter((entry): entry is SoftConstraintDiagnostic => entry !== null)
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
    effectiveMonsterCount,
    xpMultiplier,
    maxCr,
    softFit: diagnostics.length === 0,
    softDistance,
    tuningDistance,
    diagnostics
  }
}

type CandidateEvaluation = Readonly<{
  adjustedXp: number
  delta: number
  monsterCount: number
  statblockCount: number
  statblockSlots: readonly number[]
  initiativeSlots: number
  effectiveMonsterCount: number
  xpMultiplier: number
  maxCr: number
  softDistance: number
  tuningDistance: number
}>

type CandidateEvaluationContext = Readonly<{
  config: GeneratorPresetConfigV3
  fixed: FixedRoster
  fixedMonsterCount: number
  fixedRawXp: number
  monsterRange: Readonly<{ min: number; max: number }>
  initiativeRange: Readonly<{ min: number; max: number }>
  amountTarget: number | null
  diversityTarget: number | null
}>

function candidateEvaluationContext(
  config: GeneratorPresetConfigV3,
  partySize: number,
  fixed: FixedRoster
): CandidateEvaluationContext {
  const monsterRange = resolveRange(config.composition.monsters, partySize)
  const initiativeRange = resolveRange(
    config.composition.initiativeSlots,
    partySize
  )
  return {
    config,
    fixed,
    fixedMonsterCount: fixed.units.reduce(
      (sum, unit) => sum + unit.quantity,
      0
    ),
    fixedRawXp: fixed.units.reduce(
      (sum, unit) => sum + unit.unitXp * unit.quantity,
      0
    ),
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
          : null
  }
}

function evaluateCandidate(
  blocks: readonly Block[],
  statblockSlots: readonly number[],
  context: CandidateEvaluationContext,
  target: number
): CandidateEvaluation {
  const { config, fixed } = context
  let rawXp = context.fixedRawXp
  let monsterCount = context.fixedMonsterCount
  let maximumUnitXp = 1
  for (const unit of fixed.units)
    maximumUnitXp = Math.max(maximumUnitXp, unit.unitXp)
  for (const block of blocks) {
    rawXp += block.cr.xp * block.quantity
    monsterCount += block.quantity
    maximumUnitXp = Math.max(maximumUnitXp, block.cr.xp)
  }
  let effectiveMonsterCount = 0
  for (const unit of fixed.units)
    effectiveMonsterCount +=
      unit.quantity * Math.sqrt(unit.unitXp / maximumUnitXp)
  for (const block of blocks)
    effectiveMonsterCount +=
      block.quantity * Math.sqrt(block.cr.xp / maximumUnitXp)
  const xpMultiplier = effectiveEncounterMultiplier(effectiveMonsterCount)
  const adjustedXp = Math.round(rawXp * xpMultiplier)
  const statblockCount =
    fixed.statblockCount +
    statblockSlots.reduce((sum, quantity) => sum + quantity, 0)
  const initiativeSlots =
    fixed.initiativeSlots +
    estimatedInitiativeSlots(blocks, statblockSlots, config.combat.mobThreshold)
  const softDistance =
    rangeDistance(statblockCount, config.composition.statblocks) +
    rangeDistance(monsterCount, context.monsterRange) +
    rangeDistance(initiativeSlots, context.initiativeRange)
  let maxCr = Number.NEGATIVE_INFINITY
  let minimumBlockXp = Number.POSITIVE_INFINITY
  let maximumBlockXp = 1
  for (const block of blocks) {
    maxCr = Math.max(maxCr, block.cr.code)
    minimumBlockXp = Math.min(minimumBlockXp, block.cr.xp)
    maximumBlockXp = Math.max(maximumBlockXp, block.cr.xp)
  }
  const amountDistance =
    context.amountTarget === null
      ? 0
      : Math.abs(monsterCount - context.amountTarget) /
        Math.max(1, context.monsterRange.max - context.monsterRange.min)
  const diversityDistance =
    context.diversityTarget === null
      ? 0
      : Math.abs(statblockCount - context.diversityTarget) /
        Math.max(
          1,
          config.composition.statblocks.max - config.composition.statblocks.min
        )
  const spread = (maximumBlockXp - minimumBlockXp) / maximumBlockXp
  const balanceDistance =
    config.generationDefaults.balance === 'even'
      ? spread
      : config.generationDefaults.balance === 'varied'
        ? 1 - spread
        : 0
  return {
    adjustedXp,
    delta: adjustedXp - target,
    monsterCount,
    statblockCount,
    statblockSlots,
    initiativeSlots,
    effectiveMonsterCount,
    xpMultiplier,
    maxCr,
    softDistance,
    tuningDistance: amountDistance + diversityDistance + balanceDistance
  }
}

function candidateId(
  encounterNumber: number,
  blocks: readonly Block[]
): string {
  return `${encounterNumber}:${blocks.map((block) => block.id).join('|')}`
}

function encounterComposition(
  selected: EncounterCandidate,
  candidateCount: number,
  fitCandidateCount: number
): EncounterComposition {
  return {
    blocks: selected.blocks.map((block, index) => ({
      role: lowerRole(block.role),
      challengeRating: block.cr.label,
      quantity: block.quantity,
      statblockSlots: selected.statblockSlots[index] ?? 1
    })),
    metrics: {
      adjustedXp: selected.adjustedXp,
      xpDelta: selected.delta,
      monsterCount: selected.monsterCount,
      statblockCount: selected.statblockCount,
      initiativeSlots: selected.initiativeSlots,
      effectiveMonsterCount: selected.effectiveMonsterCount,
      xpMultiplier: selected.xpMultiplier
    },
    diagnostics: selected.diagnostics,
    candidateCount,
    fitCandidateCount
  }
}

function visitCartesian(
  choices: readonly (readonly Block[])[],
  visit: (blocks: readonly Block[]) => void,
  depth = 0,
  prefix: Block[] = []
): void {
  if (depth === choices.length) {
    visit(prefix)
    return
  }
  for (const block of choices[depth] ?? []) {
    prefix.push(block)
    visitCartesian(choices, visit, depth + 1, prefix)
    prefix.pop()
  }
}

function candidateEntropy(
  candidateId: string,
  seed: number,
  encounterNumber: number,
  entropy: EncounterEntropy
): number {
  return entropy.unit(`${seed}|encounter:${encounterNumber}:${candidateId}`)
}

function compareCandidateDomain(
  left: CandidateEvaluation,
  leftFit: boolean,
  right: CandidateEvaluation,
  rightFit: boolean
): number {
  if (leftFit !== rightFit) return leftFit ? -1 : 1
  const softDistance = left.softDistance - right.softDistance
  if (softDistance !== 0) return softDistance
  const tuningDistance = left.tuningDistance - right.tuningDistance
  if (tuningDistance !== 0) return tuningDistance
  return Math.abs(left.delta) - Math.abs(right.delta)
}

function withinTargetBand(delta: number, target: number): boolean {
  return Math.abs(delta) * 100 <= target * 5
}

export function resolveRange(
  range: ScaledRange,
  partySize: number
): { min: number; max: number } {
  return {
    min: range.min.value * (range.min.perPlayer ? partySize : 1),
    max: range.max.value * (range.max.perPlayer ? partySize : 1)
  }
}

function rangeDiagnostic(
  constraint: SoftConstraintDiagnostic['constraint'],
  label: string,
  value: number,
  range: { min: number; max: number }
): SoftConstraintDiagnostic | null {
  if (value >= range.min && value <= range.max) return null
  return {
    constraint,
    value,
    minimum: range.min,
    maximum: range.max,
    normalizedDistance: rangeDistance(value, range),
    message: `${label}: ${value} liegt außerhalb ${formatNumber(range.min)}–${formatNumber(range.max)}.`
  }
}

function rangeDistance(
  value: number,
  range: { min: number; max: number }
): number {
  if (value < range.min) return (range.min - value) / Math.max(1, range.min)
  if (value > range.max) return (value - range.max) / Math.max(1, range.max)
  return 0
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function estimatedInitiativeSlots(
  blocks: readonly Block[],
  statblockSlots: readonly number[],
  mobThreshold: number
): number {
  let slots = 0
  for (const [index, block] of blocks.entries()) {
    const inCrBlock = statblockSlots[index] ?? 1
    const base = Math.floor(block.quantity / inCrBlock)
    const remainder = block.quantity % inCrBlock
    for (let statblock = 0; statblock < inCrBlock; statblock += 1) {
      const quantity = base + (statblock < remainder ? 1 : 0)
      slots += mobThreshold > 0 && quantity >= mobThreshold ? 1 : quantity
    }
  }
  return slots
}

export function statblockSlotsForBlocks(
  blocks: readonly {
    quantity: number
    availableStatblocks?: number | null
  }[],
  config: GeneratorPresetConfigV3
): number[] {
  const result = new Array<number>(blocks.length)
  if (config.composition.mixing === 'one-per-cr-block') {
    result.fill(1)
    return result
  }
  let monsterCount = 0
  let totalCapacity = 0
  const maximumByBlock = new Array<number>(blocks.length)
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    monsterCount += block.quantity
    const capacity = Math.min(
      block.quantity,
      block.availableStatblocks ?? block.quantity
    )
    maximumByBlock[index] = capacity
    totalCapacity += capacity
  }
  const requested =
    config.generationDefaults.diversity === 'high'
      ? config.composition.statblocks.max
      : config.composition.statblocks.min
  let remaining = clamp(
    requested,
    blocks.length,
    Math.min(config.composition.statblocks.max, monsterCount, totalCapacity)
  )
  let consumedCapacity = 0
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    const blocksLeft = blocks.length - index
    const capacity = maximumByBlock[index] ?? block.quantity
    const futureCapacity = totalCapacity - consumedCapacity - capacity
    const minimumHere = Math.max(1, remaining - futureCapacity)
    const quantity = clamp(
      Math.max(minimumHere, Math.ceil(remaining / blocksLeft)),
      1,
      capacity
    )
    result[index] = quantity
    remaining -= quantity
    consumedCapacity += capacity
  }
  return result
}

function lowerRole(role: EncounterRole): GeneratorRole {
  return role.toLowerCase() as GeneratorRole
}

function titleRole(role: GeneratorRole): EncounterRole {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}` as EncounterRole
}

function difficultyFor(
  number: number,
  count: number
): 'EASY' | 'MEDIUM' | 'HARD' | 'DEADLY' {
  if (count === 1 || number === count) return 'DEADLY'
  if (number === 1) return 'EASY'
  return number / (count + 1) <= 0.5 ? 'MEDIUM' : 'HARD'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

export function sessionCompositionCatalog(
  catalog: Pick<EncounterCatalog, 'challengeRatings'>
): CompositionCatalog {
  return {
    challengeRatings: catalog.challengeRatings.map((rating) => ({
      ...rating,
      availableQuantity: null,
      maximumSingleQuantity: null,
      availableStatblocks: null
    }))
  }
}
