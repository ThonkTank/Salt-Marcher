import { z } from 'zod'
import {
  combatConditionSchema,
  exhaustionLevelSchema
} from '../../shared/contracts/combat-status.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export const combatSourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('party'),
      rowId: z.string(),
      partyId: z.uuid(),
      name: z.string(),
      initiative: z.number().int()
    })
    .strict(),
  z
    .object({
      kind: z.literal('monster'),
      rowId: z.string(),
      sourceEntryId: z.uuid(),
      partitionKind: z.enum(['individual', 'mob']),
      displayOrdinal: z.number().int().positive().nullable(),
      groupId: z.uuid().nullable(),
      creatureId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      memberIds: z.array(z.uuid()),
      initiative: z.number().int()
    })
    .strict()
])

export const combatantSchema = z
  .object({
    id: z.string(),
    cardId: z.string(),
    sceneMemberId: z.uuid().nullable(),
    creatureId: z.string().nullable(),
    name: z.string(),
    playerCharacter: z.boolean(),
    currentHp: z.number().int().nonnegative(),
    maxHp: z.number().int().nonnegative(),
    armorClass: z.number().int().nonnegative(),
    initiative: z.number().int(),
    xp: z.number().int().nonnegative(),
    detail: z.string(),
    conditions: z.array(combatConditionSchema),
    concentrating: z.boolean(),
    exhaustionLevel: exhaustionLevelSchema,
    order: z.number().int().nonnegative()
  })
  .strict()

export const combatResolutionStateSchema = z
  .object({
    selectedEnemyIds: z.array(z.string()),
    mode: z.enum(['defeated', 'manual']),
    xpFraction: z.number().min(0).max(1),
    xpAwarded: z.boolean()
  })
  .strict()

export const combatMementoSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    phase: z.enum(['initiative', 'combat', 'resolution']),
    selectedGroupIds: z.array(z.uuid()),
    sources: z.array(combatSourceSchema),
    combatants: z.array(combatantSchema),
    turnOrder: z.array(z.string()),
    activeIndex: z.number().int().nonnegative(),
    round: z.number().int().positive(),
    preparedWith: z
      .object({
        presetId: z.uuid(),
        presetRevision: z.number().int().nonnegative(),
        configHash: z.string().regex(/^[a-f0-9]{64}$/),
        mobThreshold: z.number().int().nonnegative()
      })
      .strict(),
    resolution: combatResolutionStateSchema.nullable()
  })
  .strict()

export type CombatMemento = z.infer<typeof combatMementoSchema>
export type Combatant = z.infer<typeof combatantSchema>

export type CombatHistoryEffect = Readonly<{
  label: string
  inverse:
    | Readonly<{
        kind: 'member-states'
        states: readonly ReturnType<typeof memberStatus>[]
      }>
    | Readonly<{
        kind: 'turn'
        activeIndex: number
        round: number
      }>
    | Readonly<{
        kind: 'initiative'
        values: readonly Readonly<{ id: string; initiative: number }>[]
        turnOrder: readonly string[]
        activeIndex: number
      }>
}>

export type CombatStateAction =
  | Readonly<{
      kind: 'set-sources'
      sources: CombatMemento['sources']
    }>
  | Readonly<{
      kind: 'confirm-initiative'
      sources: CombatMemento['sources']
      combatants: readonly Combatant[]
    }>
  | Readonly<{ kind: 'advance' | 'retreat' }>
  | Readonly<{
      kind: 'move-phase'
      target: 'initiative' | 'combat'
    }>
  | Readonly<{
      kind: 'adjust-initiative'
      cardId: string
      initiative: number
    }>
  | Readonly<{
      kind: 'change-hp'
      cardId: string
      amount: number
      healing: boolean
    }>
  | Readonly<{
      kind: 'condition'
      cardId: string
      condition: z.infer<typeof combatConditionSchema>
      active: boolean
    }>
  | Readonly<{
      kind: 'concentration'
      cardId: string
      concentrating: boolean
    }>
  | Readonly<{
      kind: 'exhaustion'
      cardId: string
      exhaustionLevel: number
    }>
  | Readonly<{ kind: 'begin-resolution' }>
  | Readonly<{
      kind: 'update-resolution'
      selectedEnemyIds: readonly string[]
      mode: 'defeated' | 'manual'
      xpFraction: number
    }>
  | Readonly<{ kind: 'mark-xp-awarded' }>
  | Readonly<{
      kind: 'undo'
      inverse: CombatHistoryEffect['inverse']
    }>

export type CombatStateReduction = Readonly<{
  state: CombatMemento
  history?: CombatHistoryEffect
  clearHistory?: boolean
}>

export function reduceCombatState(
  current: CombatMemento,
  action: CombatStateAction
): CombatStateReduction {
  const state = structuredClone(current)
  let history: CombatHistoryEffect | undefined
  let clearHistory = false
  switch (action.kind) {
    case 'set-sources':
      requirePhase(state, 'initiative')
      state.sources = [...action.sources]
      break
    case 'confirm-initiative':
      requirePhase(state, 'initiative')
      state.sources = [...action.sources]
      state.combatants = [...action.combatants]
      state.turnOrder = sortedCardIds(state.combatants)
      state.activeIndex = 0
      state.round = 1
      state.phase = 'combat'
      break
    case 'advance':
    case 'retreat': {
      requirePhase(state, 'combat')
      if (state.turnOrder.length === 0) return { state: current }
      history = {
        label: 'Zugfolge',
        inverse: {
          kind: 'turn',
          activeIndex: state.activeIndex,
          round: state.round
        }
      }
      const direction = action.kind === 'advance' ? 1 : -1
      for (let attempt = 0; attempt < state.turnOrder.length; attempt += 1) {
        const previous = state.activeIndex
        state.activeIndex =
          (state.activeIndex + direction + state.turnOrder.length) %
          state.turnOrder.length
        if (direction > 0 && state.activeIndex === 0) state.round += 1
        if (direction < 0 && previous === 0 && state.round > 1) state.round -= 1
        if (
          cardAlive(state.combatants, state.turnOrder[state.activeIndex] ?? '')
        )
          break
      }
      break
    }
    case 'move-phase':
      if (action.target === state.phase) return { state: current }
      if (action.target === 'combat') {
        requirePhase(state, 'resolution')
        state.phase = 'combat'
      } else {
        state.phase = 'initiative'
        state.combatants = []
        state.turnOrder = []
        state.activeIndex = 0
        state.round = 1
      }
      state.resolution = null
      clearHistory = true
      break
    case 'adjust-initiative': {
      requirePhase(state, 'combat')
      const activeCard = state.turnOrder[state.activeIndex]
      const targets = state.combatants.filter(
        (combatant) => combatant.cardId === action.cardId
      )
      if (targets.length === 0) throw new CapabilityError('not_found', false)
      history = {
        label: 'Initiative',
        inverse: {
          kind: 'initiative',
          values: targets.map(({ id, initiative }) => ({ id, initiative })),
          turnOrder: [...state.turnOrder],
          activeIndex: state.activeIndex
        }
      }
      state.combatants = state.combatants.map((combatant) =>
        combatant.cardId === action.cardId
          ? { ...combatant, initiative: action.initiative }
          : combatant
      )
      state.turnOrder = sortedCardIds(state.combatants)
      state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
      break
    }
    case 'change-hp': {
      requirePhase(state, 'combat')
      const members = targetsForCard(state, action.cardId, false)
      if (members.length === 0) throw new CapabilityError('not_found', false)
      let remaining = action.amount
      const nextHp = new Map<string, number>()
      if (action.healing) {
        const target = members[0]!
        nextHp.set(
          target.id,
          Math.min(target.maxHp, target.currentHp + action.amount)
        )
      } else {
        for (const target of members) {
          if (remaining <= 0) break
          const applied = Math.min(remaining, target.currentHp)
          nextHp.set(target.id, target.currentHp - applied)
          remaining -= applied
        }
      }
      state.combatants = state.combatants.map((combatant) => ({
        ...combatant,
        currentHp: nextHp.get(combatant.id) ?? combatant.currentHp
      }))
      history = {
        label: `${action.healing ? '+' : '−'}${action.amount} TP · ${members[0]!.name}`,
        inverse: {
          kind: 'member-states',
          states: members
            .filter((member) => nextHp.has(member.id))
            .map(memberStatus)
        }
      }
      break
    }
    case 'condition': {
      const target = requireStatusTarget(state, action.cardId)
      const conditions = new Set(target.conditions)
      if (action.active) conditions.add(action.condition)
      else conditions.delete(action.condition)
      state.combatants = state.combatants.map((combatant) =>
        combatant.id === target.id
          ? { ...combatant, conditions: [...conditions] }
          : combatant
      )
      history = memberHistory(`${action.condition} · ${target.name}`, target)
      break
    }
    case 'concentration': {
      const target = requireStatusTarget(state, action.cardId)
      state.combatants = state.combatants.map((combatant) =>
        combatant.id === target.id
          ? { ...combatant, concentrating: action.concentrating }
          : combatant
      )
      history = memberHistory(`Concentration · ${target.name}`, target)
      break
    }
    case 'exhaustion': {
      const target = requireStatusTarget(state, action.cardId)
      const level = exhaustionLevelSchema.parse(action.exhaustionLevel)
      state.combatants = state.combatants.map((combatant) =>
        combatant.id === target.id
          ? { ...combatant, exhaustionLevel: level }
          : combatant
      )
      history = memberHistory(`Exhaustion ${level} · ${target.name}`, target)
      break
    }
    case 'begin-resolution':
      requirePhase(state, 'combat')
      state.phase = 'resolution'
      state.resolution = {
        selectedEnemyIds: state.combatants
          .filter(
            (combatant) =>
              !combatant.playerCharacter && combatant.currentHp === 0
          )
          .map((combatant) => combatant.id),
        mode: 'defeated',
        xpFraction: 1,
        xpAwarded: false
      }
      break
    case 'update-resolution': {
      requirePhase(state, 'resolution')
      if (!state.resolution)
        throw new CapabilityError('validation_failed', false)
      const enemyIds = new Set(
        state.combatants
          .filter((combatant) => !combatant.playerCharacter)
          .map((combatant) => combatant.id)
      )
      if (action.selectedEnemyIds.some((id) => !enemyIds.has(id)))
        throw new CapabilityError('not_found', false)
      state.resolution = {
        ...state.resolution,
        selectedEnemyIds: [...new Set(action.selectedEnemyIds)],
        mode: action.mode,
        xpFraction: action.xpFraction
      }
      break
    }
    case 'mark-xp-awarded':
      if (!state.resolution)
        throw new CapabilityError('validation_failed', false)
      state.resolution = { ...state.resolution, xpAwarded: true }
      break
    case 'undo':
      if (action.inverse.kind === 'member-states') {
        const previous = new Map(
          action.inverse.states.map((entry) => [entry.id, entry])
        )
        if (
          action.inverse.states.some(
            (entry) =>
              !state.combatants.some((combatant) => combatant.id === entry.id)
          )
        )
          throw new CapabilityError('validation_failed', false)
        state.combatants = state.combatants.map((combatant) => {
          const entry = previous.get(combatant.id)
          return entry
            ? {
                ...combatant,
                currentHp: entry.currentHp,
                conditions: [...entry.conditions],
                concentrating: entry.concentrating,
                exhaustionLevel: entry.exhaustionLevel
              }
            : combatant
        })
      } else if (action.inverse.kind === 'turn') {
        state.activeIndex = action.inverse.activeIndex
        state.round = action.inverse.round
      } else {
        const values = new Map(
          action.inverse.values.map((entry) => [entry.id, entry.initiative])
        )
        state.combatants = state.combatants.map((combatant) => ({
          ...combatant,
          initiative: values.get(combatant.id) ?? combatant.initiative
        }))
        state.turnOrder = [...action.inverse.turnOrder]
        state.activeIndex = action.inverse.activeIndex
      }
      break
  }
  return {
    state: nextCombatRevision(state),
    ...(history ? { history } : {}),
    ...(clearHistory ? { clearHistory } : {})
  }
}

export function nextCombatRevision(state: CombatMemento): CombatMemento {
  const next = structuredClone(state)
  next.revision += 1
  return combatMementoSchema.parse(next)
}

export function memberStatus(combatant: Combatant) {
  return {
    id: combatant.id,
    currentHp: combatant.currentHp,
    conditions: combatant.conditions,
    concentrating: combatant.concentrating,
    exhaustionLevel: combatant.exhaustionLevel
  }
}

function requirePhase(
  state: CombatMemento,
  phase: CombatMemento['phase']
): void {
  if (state.phase !== phase)
    throw new CapabilityError('validation_failed', false)
}

function targetsForCard(
  state: CombatMemento,
  cardId: string,
  includeParty: boolean
): Combatant[] {
  return state.combatants
    .filter(
      (combatant) =>
        combatant.cardId === cardId &&
        (includeParty
          ? combatant.playerCharacter || combatant.currentHp > 0
          : !combatant.playerCharacter && combatant.currentHp > 0)
    )
    .toSorted(
      (left, right) =>
        left.currentHp - right.currentHp || left.name.localeCompare(right.name)
    )
}

function requireStatusTarget(state: CombatMemento, cardId: string): Combatant {
  requirePhase(state, 'combat')
  const target = targetsForCard(state, cardId, true)[0]
  if (!target) throw new CapabilityError('not_found', false)
  return target
}

function memberHistory(label: string, target: Combatant): CombatHistoryEffect {
  return {
    label,
    inverse: { kind: 'member-states', states: [memberStatus(target)] }
  }
}

export function sortedCardIds(combatants: readonly Combatant[]): string[] {
  const cards = new Map<string, Combatant>()
  for (const combatant of combatants)
    if (!cards.has(combatant.cardId)) cards.set(combatant.cardId, combatant)
  return Array.from(cards.values())
    .sort((left, right) =>
      right.initiative !== left.initiative
        ? right.initiative - left.initiative
        : left.order - right.order
    )
    .map((combatant) => combatant.cardId)
}

export function cardAlive(
  combatants: readonly Combatant[],
  cardId: string
): boolean {
  return combatants.some(
    (combatant) =>
      combatant.cardId === cardId &&
      (combatant.playerCharacter || combatant.currentHp > 0)
  )
}

export function projectedCards(
  combatants: readonly Combatant[],
  turnOrder: readonly string[],
  activeIndex: number
) {
  const order = new Map(turnOrder.map((cardId, index) => [cardId, index]))
  const activeCard = turnOrder[activeIndex]
  const grouped = new Map<string, Combatant[]>()
  for (const combatant of combatants) {
    const values = grouped.get(combatant.cardId) ?? []
    values.push(combatant)
    grouped.set(combatant.cardId, values)
  }
  return Array.from(grouped.entries())
    .map(([id, values]) => {
      const first = values[0]
      if (!first) throw new Error('invalid combat card')
      const alive = values.filter(
        (value) => value.playerCharacter || value.currentHp > 0
      )
      const front = alive.toSorted(
        (left, right) =>
          left.currentHp - right.currentHp ||
          left.name.localeCompare(right.name)
      )[0]
      return {
        id,
        creatureId: first.creatureId,
        memberIds: values.map((value) => value.id),
        name: values.length > 1 ? first.name.replace(/ #\d+$/, '') : first.name,
        playerCharacter: first.playerCharacter,
        active: id === activeCard,
        done: (order.get(id) ?? 0) < activeIndex,
        alive: alive.length > 0,
        currentHp: front?.currentHp ?? 0,
        maxHp: front?.maxHp ?? first.maxHp,
        armorClass: first.armorClass,
        initiative: first.initiative,
        count: values.length,
        aliveCount: alive.length,
        conditions: front?.conditions ?? [],
        concentrating: front?.concentrating ?? false,
        exhaustionLevel: front?.exhaustionLevel ?? 0,
        detail: first.detail
      }
    })
    .sort(
      (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
    )
}
