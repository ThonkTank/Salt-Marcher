import type Database from 'better-sqlite3'
import { z } from 'zod'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  combatSnapshotSchema,
  type CombatCondition,
  type CombatSnapshot,
  type PartyMember
} from '../../shared/contracts/live-session.js'
import { combatConditionSchema } from '../../shared/contracts/combat-status.js'
import type { SceneGroup } from '../../shared/contracts/scene.js'
import type { GeneratorPresetConfigV3 } from '../../shared/contracts/generator-presets.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'
import type { PartyStore } from '../party/party-store.js'
import type { SceneStore } from '../scene/scene-store.js'
import { fingerprintGeneratorConfig } from '../session-generation/generator-config-fingerprint.js'
import {
  partitionMonsterSource,
  reconcileMonsterSource
} from './combat-partition-policy.js'
import { CombatRepository } from './combat-repository.js'
import {
  projectedCards,
  reduceCombatState,
  nextCombatRevision,
  sortedCardIds,
  type CombatStateAction,
  type Combatant,
  type CombatMemento
} from './combat-state-reducer.js'

export class CombatService {
  private readonly changedGroupIds = new Set<string>()
  private readonly repository: CombatRepository

  constructor(
    db: Database.Database,
    sceneId: string,
    private readonly scene: SceneStore,
    party: PartyStore,
    private readonly preset: {
      config: GeneratorPresetConfigV3
      id: string
      revision: number
    }
  ) {
    this.repository = new CombatRepository(db, sceneId, scene, party)
  }

  private get mobThreshold(): number {
    return this.preset.config.combat.mobThreshold
  }

  prepare(
    members: readonly PartyMember[],
    groups: readonly {
      id: string
      name: string
      entries: readonly {
        id: string
        creatureId: string
        quantity: number
        aliveQuantity: number
        available: boolean
        members: readonly {
          id: string
          currentHp: number
          conditions: readonly CombatCondition[]
          concentrating: boolean
          exhaustionLevel: number
        }[]
      }[]
    }[],
    groupIds: readonly string[]
  ): void {
    const party = members.filter((member) => member.active)
    if (party.length === 0)
      throw new CapabilityError('validation_failed', false)
    const selected = Array.from(new Set(groupIds))
    const chosenGroups = selected.map((id) =>
      groups.find((group) => group.id === id)
    )
    if (chosenGroups.some((group) => group === undefined))
      throw new CapabilityError('not_found', false)
    const sources: CombatMemento['sources'] = party.map((member, index) => ({
      kind: 'party',
      rowId: `party:${member.id}`,
      partyId: member.id,
      name: member.name,
      initiative: 10 + index
    }))
    for (const group of chosenGroups) {
      for (const entry of group?.entries ?? []) {
        if (entry.aliveQuantity === 0) continue
        const creature = creatureById(entry.creatureId)
        if (!entry.available || !creature)
          throw new CapabilityError('not_found', false)
        const memberIds = entry.members
          .filter((member) => member.currentHp > 0)
          .map((member) => member.id)
        sources.push(
          ...partitionMonsterSource({
            entryId: entry.id,
            groupId: group?.id ?? null,
            creatureId: creature.id,
            creatureName: creature.name,
            initiative: 12 + Math.max(-3, Math.min(6, creature.initiative)),
            memberIds,
            mobThreshold: this.mobThreshold
          })
        )
      }
    }
    if (!sources.some((source) => source.kind === 'monster'))
      throw new CapabilityError('validation_failed', false)
    this.repository.clearHistory()
    this.save({
      id: uuidv7(),
      revision: 0,
      phase: 'initiative',
      selectedGroupIds: selected,
      sources,
      combatants: [],
      turnOrder: [],
      activeIndex: 0,
      round: 1,
      preparedWith: {
        presetId: this.preset.id,
        presetRevision: this.preset.revision,
        configHash: fingerprintGeneratorConfig(this.preset.config),
        mobThreshold: this.mobThreshold
      },
      resolution: null
    })
  }

  includesGroup(groupId: string): boolean {
    return this.repository.load()?.selectedGroupIds.includes(groupId) ?? false
  }

  joinGroup(group: SceneGroup): void {
    const state = this.requireCombat()
    if (state.selectedGroupIds.includes(group.id)) {
      this.reconcileGroup(group)
      return
    }
    state.selectedGroupIds.push(group.id)
    this.reconcileGroupState(state, group)
    this.bump(state)
  }

  reconcileGroup(group: SceneGroup): void {
    const state = this.repository.load()
    if (!state || !state.selectedGroupIds.includes(group.id)) return
    this.reconcileGroupState(state, group)
    this.bump(state)
  }

  unlinkGroup(groupId: string): void {
    const state = this.repository.load()
    if (!state || !state.selectedGroupIds.includes(groupId)) return
    const memberIds = new Set(
      state.sources
        .filter(
          (
            source
          ): source is Extract<
            CombatMemento['sources'][number],
            { kind: 'monster' }
          > => source.kind === 'monster' && source.groupId === groupId
        )
        .flatMap((source) => source.memberIds)
    )
    const activeCard = state.turnOrder[state.activeIndex]
    state.selectedGroupIds = state.selectedGroupIds.filter(
      (id) => id !== groupId
    )
    state.sources = state.sources.filter(
      (source) => source.kind === 'party' || source.groupId !== groupId
    )
    state.combatants = state.combatants.filter(
      (combatant) =>
        !combatant.sceneMemberId || !memberIds.has(combatant.sceneMemberId)
    )
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
    this.repository.clearHistory()
    this.bump(state)
  }

  private reconcileGroupState(state: CombatMemento, group: SceneGroup): void {
    this.repository.clearHistory()
    const activeCard = state.turnOrder[state.activeIndex]
    const previousMemberIds = new Set(
      state.sources
        .filter(
          (
            source
          ): source is Extract<
            CombatMemento['sources'][number],
            { kind: 'monster' }
          > => source.kind === 'monster' && source.groupId === group.id
        )
        .flatMap((source) => source.memberIds)
    )
    const existingParticipantIds = new Set(
      state.combatants.flatMap((combatant) =>
        combatant.sceneMemberId ? [combatant.sceneMemberId] : []
      )
    )
    const desiredEntries = group.entries.filter(
      (entry) =>
        entry.available &&
        entry.members.some(
          (member) =>
            member.currentHp > 0 || existingParticipantIds.has(member.id)
        )
    )
    const desiredMemberIds = new Set(
      desiredEntries.flatMap((entry) =>
        entry.members
          .filter(
            (member) =>
              member.currentHp > 0 || existingParticipantIds.has(member.id)
          )
          .map((member) => member.id)
      )
    )
    const partySources = state.sources.filter(
      (source) => source.kind === 'party'
    )
    const otherMonsterSources = state.sources.filter(
      (source) => source.kind === 'monster' && source.groupId !== group.id
    )
    const previousSources = state.sources.filter(
      (
        source
      ): source is Extract<
        CombatMemento['sources'][number],
        { kind: 'monster' }
      > => source.kind === 'monster' && source.groupId === group.id
    )
    const groupSources = desiredEntries.flatMap((entry) => {
      const creature = creatureById(entry.creatureId)
      if (!creature) throw new CapabilityError('not_found', false)
      const memberIds = entry.members
        .filter(
          (member) =>
            member.currentHp > 0 || existingParticipantIds.has(member.id)
        )
        .map((member) => member.id)
      return reconcileMonsterSource({
        entryId: entry.id,
        groupId: group.id,
        creatureId: entry.creatureId,
        creatureName: creature.name,
        initiative: 12 + Math.max(-3, Math.min(6, creature.initiative)),
        memberIds,
        mobThreshold: this.mobThreshold,
        previous: previousSources
      })
    })
    state.sources = [...partySources, ...otherMonsterSources, ...groupSources]
    if (state.phase === 'initiative') return
    state.combatants = state.combatants.filter(
      (combatant) =>
        !combatant.sceneMemberId ||
        !previousMemberIds.has(combatant.sceneMemberId) ||
        desiredMemberIds.has(combatant.sceneMemberId)
    )
    for (const entry of desiredEntries) {
      const creature = creatureById(entry.creatureId)!
      for (const member of entry.members.filter(
        (candidate) => candidate.currentHp > 0
      )) {
        if (
          state.combatants.some(
            (combatant) => combatant.sceneMemberId === member.id
          )
        )
          continue
        const source = groupSources.find((candidate) =>
          candidate.memberIds.includes(member.id)
        )!
        const matchingCard = source.memberIds
          .filter((id) => id !== member.id)
          .map(
            (id) =>
              state.combatants.find(
                (combatant) => combatant.sceneMemberId === id
              )?.cardId
          )
          .find((cardId) => cardId !== undefined)
        state.combatants.push({
          id: member.id,
          cardId: matchingCard ?? `monster-card:${uuidv7()}`,
          sceneMemberId: member.id,
          creatureId: entry.creatureId,
          name: creature.name,
          playerCharacter: false,
          currentHp: member.currentHp,
          maxHp: creature.hp,
          armorClass: creature.ac,
          initiative: source.initiative,
          xp: creature.xp,
          detail: `CR ${creature.cr} · ${creature.type}`,
          conditions: [...member.conditions],
          concentrating: member.concentrating,
          exhaustionLevel: member.exhaustionLevel,
          order: state.combatants.length
        })
      }
    }
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
  }

  roll(): void {
    const state = this.require()
    if (state.phase !== 'initiative')
      throw new CapabilityError('validation_failed', false)
    const sources = state.sources.map((source) => {
      if (source.kind === 'party') return source
      const creature = creatureById(source.creatureId)
      if (!creature) throw new CapabilityError('not_found', false)
      return {
        ...source,
        initiative: 1 + Math.floor(Math.random() * 20) + creature.initiative
      }
    })
    this.reduce(state, { kind: 'set-sources', sources })
  }

  confirmInitiative(
    values: readonly { id: string; initiative: number }[]
  ): void {
    const state = this.require()
    if (state.phase !== 'initiative')
      throw new CapabilityError('validation_failed', false)
    const input = new Map(values.map((value) => [value.id, value.initiative]))
    const sources = state.sources.map((source) => ({
      ...source,
      initiative: input.get(source.rowId) ?? source.initiative
    }))
    const combatants: Combatant[] = []
    let order = 0
    for (const source of sources) {
      if (source.kind === 'party') {
        combatants.push({
          id: source.partyId,
          cardId: `party-card:${source.partyId}`,
          sceneMemberId: null,
          creatureId: null,
          name: source.name,
          playerCharacter: true,
          currentHp: 0,
          maxHp: 0,
          armorClass: 0,
          initiative: source.initiative,
          xp: 0,
          detail: 'Aktives Party-Mitglied',
          conditions: [],
          concentrating: false,
          exhaustionLevel: 0,
          order: order++
        })
        continue
      }
      const creature = creatureById(source.creatureId)
      if (!creature) throw new CapabilityError('not_found', false)
      let ordinal = 1
      const memberIds = source.memberIds.length
        ? source.memberIds
        : Array.from({ length: source.quantity }, () => null)
      let memberOffset = 0
      const cardId = `monster-card:${uuidv7()}`
      for (let member = 0; member < memberIds.length; member += 1) {
        const sceneMemberId = memberIds[memberOffset++] ?? null
        const sceneState = sceneMemberId
          ? this.sceneMemberState(sceneMemberId)
          : null
        const name =
          memberIds.length === 1
            ? creature.name
            : `${creature.name} #${ordinal++}`
        combatants.push({
          id: sceneMemberId ?? `monster-member:${uuidv7()}`,
          cardId,
          sceneMemberId,
          creatureId: source.creatureId,
          name,
          playerCharacter: false,
          currentHp: sceneState?.currentHp ?? creature.hp,
          maxHp: creature.hp,
          armorClass: creature.ac,
          initiative: source.initiative,
          xp: creature.xp,
          detail: `CR ${creature.cr} · ${creature.type}`,
          conditions: sceneState?.conditions ?? [],
          concentrating: sceneState?.concentrating ?? false,
          exhaustionLevel: sceneState?.exhaustionLevel ?? 0,
          order: order++
        })
      }
    }
    this.reduce(state, { kind: 'confirm-initiative', sources, combatants })
  }

  advance(): void {
    this.reduce(this.requireCombat(), { kind: 'advance' })
  }

  retreat(): void {
    this.reduce(this.requireCombat(), { kind: 'retreat' })
  }

  moveToPhase(target: 'initiative' | 'combat'): void {
    const state = this.require()
    if (target === state.phase) return
    this.reduce(state, { kind: 'move-phase', target })
  }

  adjustInitiative(id: string, initiative: number): void {
    this.reduce(this.requireCombat(), {
      kind: 'adjust-initiative',
      cardId: id,
      initiative
    })
  }

  changeHp(cardId: string, amount: number, healing: boolean): void {
    this.reduce(this.requireCombat(), {
      kind: 'change-hp',
      cardId,
      amount,
      healing
    })
  }

  toggleCondition(
    cardId: string,
    condition: CombatCondition,
    active: boolean
  ): void {
    this.reduce(this.requireCombat(), {
      kind: 'condition',
      cardId,
      condition,
      active
    })
  }

  setConcentration(cardId: string, concentrating: boolean): void {
    this.reduce(this.requireCombat(), {
      kind: 'concentration',
      cardId,
      concentrating
    })
  }

  setExhaustion(cardId: string, exhaustionLevel: number): void {
    this.reduce(this.requireCombat(), {
      kind: 'exhaustion',
      cardId,
      exhaustionLevel
    })
  }

  undo(): void {
    const current = this.require()
    const history = this.repository.latestHistory()
    if (!history) throw new CapabilityError('validation_failed', false)
    const reduced = reduceCombatState(current, {
      kind: 'undo',
      inverse: history.inverse
    })
    this.repository.deleteHistory(history.revision)
    this.save(reduced.state)
  }

  end(): void {
    this.reduce(this.requireCombat(), { kind: 'begin-resolution' })
  }

  updateResolution(
    selectedEnemyIds: readonly string[],
    mode: 'defeated' | 'manual',
    xpFraction: number
  ): void {
    this.reduce(this.require(), {
      kind: 'update-resolution',
      selectedEnemyIds,
      mode,
      xpFraction
    })
  }

  xpAward(members: readonly PartyMember[]): {
    combatId: string
    xpEach: number
  } {
    const state = this.require()
    if (
      state.phase !== 'resolution' ||
      !state.resolution ||
      state.resolution.xpAwarded
    )
      throw new CapabilityError('validation_failed', false)
    const partySize = members.filter((member) => member.active).length
    if (partySize === 0) throw new CapabilityError('validation_failed', false)
    const selected = new Set(state.resolution.selectedEnemyIds)
    const eligible = state.combatants
      .filter((combatant) => selected.has(combatant.id))
      .reduce((total, combatant) => total + combatant.xp, 0)
    return {
      combatId: state.id,
      xpEach: Math.floor((eligible * state.resolution.xpFraction) / partySize)
    }
  }

  markXpAwarded(): void {
    this.reduce(this.require(), { kind: 'mark-xp-awarded' })
  }

  reconcileParty(members: readonly PartyMember[]): void {
    const state = this.repository.load()
    if (!state || state.phase === 'resolution') return
    const active = members.filter((member) => member.active)
    if (state.phase === 'initiative') {
      const monsters = state.sources.filter(
        (source) => source.kind === 'monster'
      )
      const nextSources: CombatMemento['sources'] = [
        ...active.map((member, index) => ({
          kind: 'party' as const,
          rowId: `party:${member.id}`,
          partyId: member.id,
          name: member.name,
          initiative: 10 + index
        })),
        ...monsters
      ]
      if (JSON.stringify(nextSources) === JSON.stringify(state.sources)) return
      state.sources = nextSources
      this.bump(state)
      return
    }
    const activeIds = new Set(active.map((member) => member.id))
    const activeCard = state.turnOrder[state.activeIndex]
    const before = JSON.stringify(state.combatants)
    state.combatants = state.combatants.filter(
      (combatant) => !combatant.playerCharacter || activeIds.has(combatant.id)
    )
    active.forEach((member, index) => {
      if (state.combatants.some((combatant) => combatant.id === member.id))
        return
      state.combatants.push({
        id: member.id,
        cardId: `party-card:${member.id}`,
        sceneMemberId: null,
        creatureId: null,
        name: member.name,
        playerCharacter: true,
        currentHp: 0,
        maxHp: 0,
        armorClass: 0,
        initiative: 10 + index,
        xp: 0,
        detail: 'Aktives Party-Mitglied',
        conditions: [],
        concentrating: false,
        exhaustionLevel: 0,
        order: state.combatants.length
      })
    })
    if (JSON.stringify(state.combatants) === before) return
    state.turnOrder = sortedCardIds(state.combatants)
    state.activeIndex = Math.max(0, state.turnOrder.indexOf(activeCard ?? ''))
    this.bump(state)
  }

  snapshot(members: readonly PartyMember[]): CombatSnapshot | null {
    const state = this.repository.load()
    if (!state) return null
    const cards = projectedCards(
      state.combatants,
      state.turnOrder,
      state.activeIndex
    )
    const activePartySize = Math.max(
      1,
      members.filter((member) => member.active).length
    )
    const selected = new Set(state.resolution?.selectedEnemyIds ?? [])
    const eligibleXp = state.combatants
      .filter((combatant) => selected.has(combatant.id))
      .reduce((total, combatant) => total + combatant.xp, 0)
    const awardedXp = Math.floor(
      eligibleXp * (state.resolution?.xpFraction ?? 1)
    )
    return combatSnapshotSchema.parse({
      id: state.id,
      revision: state.revision,
      phase: state.phase,
      selectedGroupIds: state.selectedGroupIds,
      initiativeRows: state.sources.map((source) => ({
        id: source.rowId,
        label:
          source.kind === 'monster' && source.quantity > 1
            ? `${source.name} × ${source.quantity}`
            : source.name,
        kind: source.kind,
        initiative: source.initiative
      })),
      cards,
      round: state.round,
      undoLabel: this.repository.latestUndoLabel(),
      allEnemiesDefeated:
        state.combatants.some((combatant) => !combatant.playerCharacter) &&
        state.combatants
          .filter((combatant) => !combatant.playerCharacter)
          .every((combatant) => combatant.currentHp === 0),
      resolution: state.resolution
        ? {
            enemies: state.combatants
              .filter((combatant) => !combatant.playerCharacter)
              .map((combatant) => ({
                id: combatant.id,
                name: combatant.name,
                alive: combatant.currentHp > 0,
                xp: combatant.xp,
                selected: selected.has(combatant.id)
              })),
            mode: state.resolution.mode,
            xpFraction: state.resolution.xpFraction,
            eligibleXp,
            awardedXp,
            perPlayerXp: Math.floor(awardedXp / activePartySize),
            partySize: activePartySize,
            xpAwarded: state.resolution.xpAwarded,
            lootSummary:
              'Kein Loot · Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.'
          }
        : null
    })
  }

  assertRevision(expectedRevision: number): void {
    if (this.require().revision !== expectedRevision)
      throw new CapabilityError('stale', true)
  }

  clear(): void {
    this.repository.clear()
  }

  changedGroups(): readonly string[] {
    return [...this.changedGroupIds]
  }

  private requireCombat(): CombatMemento {
    const state = this.require()
    if (state.phase !== 'combat')
      throw new CapabilityError('validation_failed', false)
    return state
  }

  private require(): CombatMemento {
    const state = this.repository.load()
    if (!state) throw new CapabilityError('not_found', false)
    return state
  }

  private bump(state: CombatMemento): void {
    this.save(nextCombatRevision(state))
  }

  private reduce(state: CombatMemento, action: CombatStateAction): void {
    const reduced = reduceCombatState(state, action)
    if (reduced.state === state) return
    if (reduced.clearHistory) this.repository.clearHistory()
    if (reduced.history)
      this.repository.recordHistory(
        reduced.history.label,
        reduced.history.inverse,
        state.revision
      )
    this.save(reduced.state)
  }

  private sceneMemberState(memberId: string): {
    currentHp: number
    conditions: CombatCondition[]
    concentrating: boolean
    exhaustionLevel: number
  } | null {
    const row = this.scene.memberState(memberId)
    return row
      ? {
          currentHp: row.currentHp,
          conditions: z.array(combatConditionSchema).parse(row.conditions),
          concentrating: row.concentrating,
          exhaustionLevel: row.exhaustionLevel
        }
      : null
  }

  private persistSceneMemberStates(state: CombatMemento): void {
    const changed = this.scene.updateMemberStates(
      state.combatants.flatMap((combatant) =>
        combatant.sceneMemberId
          ? [
              {
                id: combatant.sceneMemberId,
                currentHp: combatant.currentHp,
                conditions: combatant.conditions,
                concentrating: combatant.concentrating,
                exhaustionLevel: combatant.exhaustionLevel
              }
            ]
          : []
      )
    )
    for (const groupId of changed) this.changedGroupIds.add(groupId)
  }

  private save(state: CombatMemento): void {
    this.persistSceneMemberStates(state)
    this.repository.save(state)
  }
}
