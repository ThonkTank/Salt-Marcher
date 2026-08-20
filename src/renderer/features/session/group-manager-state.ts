import type {
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import type {
  LootCatalogPage,
  LootCatalogQuery
} from '../../../shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import type { CapabilityIssue } from '../../../shared/errors/capability-issue.js'
import {
  beginGroupLootDraftTransaction,
  createGroupLootDraftHistory,
  endGroupLootDraftTransaction,
  groupLootDraftDirty,
  mutateGroupLootDraft,
  redoGroupLootDraft,
  undoGroupLootDraft,
  type GroupLootDraft,
  type GroupLootDraftCommand,
  type GroupLootDraftHistory
} from '../loot/group-loot-draft.js'
import {
  emptyCreatureOptions,
  emptyQuery
} from '../creatures/creature-state.js'
import {
  groupDraftReducer,
  groupDraftStateDirty,
  groupDraftStateFromGroup,
  type DraftCreatureFact,
  type GroupDraftMutation,
  type GroupDraftState
} from './group-draft.js'
import type { PendingGroupManagerIntent } from './group-manager-intent.js'

export type GroupCatalogMode = 'creatures' | 'loot'
export type GroupWorkspaceMode = 'group' | 'loot'
export type GroupDraftLootPhase =
  'idle' | 'generating' | 'ready' | 'committing' | 'error'

export type GroupManagerLootState = Readonly<{
  run: GroupRewardGeneratedRun | null
  history: GroupLootDraftHistory | null
  seed: number | null
  phase: GroupDraftLootPhase
  error: string
  issues: readonly CapabilityIssue[]
}>

export type GroupDraftSession = Readonly<{
  sourceRevision: number | null
  group: GroupDraftState
  loot: GroupManagerLootState
  externalConflict: boolean
}>

type LootCatalogDraftQuery = Omit<
  LootCatalogQuery,
  'runId' | 'catalogContentHash'
>

export type GroupManagerState = Readonly<{
  activeKey: string | null
  sessions: Readonly<Record<string, GroupDraftSession>>
  prospectiveGroupId: string
  catalogMode: GroupCatalogMode
  workspaceMode: GroupWorkspaceMode
  draftPaneWidth: number
  pendingIntent: PendingGroupManagerIntent | null
  creatureCatalog: Readonly<{
    query: CreatureCatalogQuery
    page: CreatureCatalogPage | null
    total: number
    options: CreatureFilterOptions
    error: string
  }>
  lootCatalog: Readonly<{
    query: LootCatalogDraftQuery
    page: LootCatalogPage | null
    error: string
  }>
}>

export type GroupManagerAction =
  | {
      kind: 'activate'
      key: string | null
      fallback: GroupDraftState
      sourceRevision: number | null
    }
  | { kind: 'mutate-group'; mutation: GroupDraftMutation }
  | { kind: 'group-message'; key: string; message: string }
  | {
      kind: 'facts-result'
      key: string
      facts: Readonly<Record<string, DraftCreatureFact>>
    }
  | {
      kind: 'evaluation-result'
      key: string
      evaluation: GroupDraftState['evaluation']
    }
  | {
      kind: 'roster-generated'
      key: string
      quantities: Record<string, number>
      deadQuantities: Record<string, number>
      facts: Readonly<Record<string, DraftCreatureFact>>
      evaluation: GroupDraftState['evaluation']
      seed: number
      message: string
      generationSummary: string
    }
  | { kind: 'invalidate-loot'; key: string }
  | {
      kind: 'loot-request-began'
      key: string
      phase: 'generating' | 'committing'
      seed?: number
    }
  | {
      kind: 'loot-generated'
      key: string
      run: GroupRewardGeneratedRun
      draft: GroupLootDraft
      seed: number
    }
  | { kind: 'loot-committed'; key: string }
  | {
      kind: 'loot-failed'
      key: string
      error: string
      issues: readonly CapabilityIssue[]
    }
  | { kind: 'loot-command'; key: string; command: GroupLootDraftCommand }
  | { kind: 'loot-history'; key: string; direction: 'undo' | 'redo' }
  | { kind: 'loot-edit-began'; key: string; editKey: string }
  | { kind: 'loot-edit-ended'; key: string }
  | {
      kind: 'creature-page'
      page: CreatureCatalogPage
    }
  | {
      kind: 'creature-options'
      options: CreatureFilterOptions
      total: number
    }
  | {
      kind: 'loot-catalog-page'
      page: LootCatalogPage
    }
  | {
      kind: 'catalog-error'
      request: 'creature-search' | 'loot-catalog'
      error: string
    }
  | { kind: 'creature-query'; query: CreatureCatalogQuery }
  | {
      kind: 'merge-biome-options'
      options: readonly { id: string; label: string }[]
      selectedIds: readonly string[]
    }
  | {
      kind: 'loot-query'
      patch: Partial<LootCatalogDraftQuery>
      preserveOffset?: boolean
    }
  | {
      kind: 'view'
      catalogMode?: GroupCatalogMode
      workspaceMode?: GroupWorkspaceMode
    }
  | { kind: 'draft-width'; width: number }
  | { kind: 'pending-intent'; pending: PendingGroupManagerIntent | null }
  | { kind: 'sync-external'; groups: readonly SceneGroup[] }

export function createGroupManagerState(input: {
  activeKey: string | null
  initialGroup: SceneGroup | null
  prospectiveGroupId: string
  locationId: string | null
}): GroupManagerState {
  return {
    activeKey: input.activeKey,
    sessions: input.activeKey
      ? {
          [input.activeKey]: createSession(
            groupDraftStateFromGroup(input.initialGroup),
            input.initialGroup?.revision ?? null
          )
        }
      : {},
    prospectiveGroupId: input.prospectiveGroupId,
    catalogMode: 'creatures',
    workspaceMode: 'group',
    draftPaneWidth: 460,
    pendingIntent: null,
    creatureCatalog: {
      query: { ...emptyQuery, locationId: input.locationId, limit: 30 },
      page: null,
      total: 0,
      options: emptyCreatureOptions,
      error: ''
    },
    lootCatalog: {
      query: {
        search: '',
        types: [],
        categories: [],
        rarities: [],
        offset: 0,
        limit: 30
      },
      page: null,
      error: ''
    }
  }
}

export function groupManagerReducer(
  state: GroupManagerState,
  action: GroupManagerAction
): GroupManagerState {
  if (action.kind === 'activate') {
    if (action.key === state.activeKey) return state
    const nextSession = action.key ? state.sessions[action.key] : undefined
    const lootAvailable = Boolean(nextSession?.loot.run)
    return {
      ...state,
      activeKey: action.key,
      ...(lootAvailable
        ? {}
        : {
            catalogMode: 'creatures' as const,
            workspaceMode: 'group' as const
          }),
      sessions:
        action.key && !state.sessions[action.key]
          ? {
              ...state.sessions,
              [action.key]: createSession(
                action.fallback,
                action.sourceRevision
              )
            }
          : state.sessions,
      pendingIntent: null
    }
  }
  if (action.kind === 'mutate-group')
    return updateActiveSession(state, (session) => ({
      ...session,
      group: groupDraftReducer(session.group, action.mutation),
      ...(groupMutationInvalidatesLoot(action.mutation)
        ? { loot: emptyLoot() }
        : {})
    }))
  if (action.kind === 'group-message')
    return updateSession(state, action.key, (session) => ({
      ...session,
      group: { ...session.group, message: action.message }
    }))
  if (action.kind === 'facts-result') {
    return updateSession(state, action.key, (session) => ({
      ...session,
      group: groupDraftReducer(session.group, {
        kind: 'facts',
        update: { ...session.group.facts, ...action.facts }
      })
    }))
  }
  if (action.kind === 'evaluation-result') {
    return updateSession(state, action.key, (session) => ({
      ...session,
      group: { ...session.group, evaluation: action.evaluation }
    }))
  }
  if (action.kind === 'roster-generated') {
    return updateSession(state, action.key, (session) => ({
      ...session,
      group: {
        ...groupDraftReducer(session.group, {
          kind: 'roster',
          update: {
            quantities: action.quantities,
            deadQuantities: action.deadQuantities
          }
        }),
        facts: { ...session.group.facts, ...action.facts },
        evaluation: action.evaluation,
        seed: action.seed,
        message: action.message,
        generationSummary: action.generationSummary
      },
      loot: emptyLoot()
    }))
  }
  if (action.kind === 'invalidate-loot')
    return updateSession(state, action.key, (session) => ({
      ...session,
      loot: emptyLoot()
    }))
  if (action.kind === 'loot-request-began')
    return updateSession(state, action.key, (session) => ({
      ...session,
      loot: {
        ...session.loot,
        phase: action.phase,
        error: '',
        issues: [],
        ...(action.seed === undefined ? {} : { seed: action.seed })
      }
    }))
  if (action.kind === 'loot-generated') {
    return updateSession(
      {
        ...state,
        ...(state.activeKey === action.key
          ? {
              catalogMode: 'loot' as const,
              workspaceMode: 'loot' as const
            }
          : {})
      },
      action.key,
      (session) => ({
        ...session,
        loot: {
          run: action.run,
          history: createGroupLootDraftHistory(action.draft),
          phase: 'ready',
          error: '',
          issues: [],
          seed: action.seed
        }
      })
    )
  }
  if (action.kind === 'loot-committed')
    return updateSession(state, action.key, (session) => ({
      ...session,
      loot: {
        ...session.loot,
        phase: 'ready',
        error: '',
        issues: []
      }
    }))
  if (action.kind === 'loot-failed')
    return updateSession(state, action.key, (session) => ({
      ...session,
      loot: {
        ...session.loot,
        phase: 'error',
        error: action.error,
        issues: action.issues
      }
    }))
  if (action.kind === 'loot-command')
    return updateLootHistory(state, action.key, (history) =>
      mutateGroupLootDraft(history, action.command)
    )
  if (action.kind === 'loot-history')
    return updateLootHistory(state, action.key, (history) =>
      action.direction === 'undo'
        ? undoGroupLootDraft(history)
        : redoGroupLootDraft(history)
    )
  if (action.kind === 'loot-edit-began')
    return updateLootHistory(state, action.key, (history) =>
      beginGroupLootDraftTransaction(history, action.editKey)
    )
  if (action.kind === 'loot-edit-ended')
    return updateLootHistory(state, action.key, endGroupLootDraftTransaction)
  if (action.kind === 'creature-page')
    return {
      ...state,
      creatureCatalog: {
        ...state.creatureCatalog,
        page: action.page,
        error: ''
      }
    }
  if (action.kind === 'creature-options')
    return {
      ...state,
      creatureCatalog: {
        ...state.creatureCatalog,
        options: action.options,
        total: action.total
      }
    }
  if (action.kind === 'loot-catalog-page')
    return {
      ...state,
      lootCatalog: { ...state.lootCatalog, page: action.page, error: '' }
    }
  if (action.kind === 'catalog-error') {
    return {
      ...state,
      ...(action.request === 'creature-search'
        ? {
            creatureCatalog: {
              ...state.creatureCatalog,
              error: action.error
            }
          }
        : {
            lootCatalog: { ...state.lootCatalog, error: action.error }
          })
    }
  }
  if (action.kind === 'creature-query')
    return {
      ...state,
      creatureCatalog: { ...state.creatureCatalog, query: action.query }
    }
  if (action.kind === 'merge-biome-options') {
    const selected = new Set(action.selectedIds)
    const retained = state.creatureCatalog.options.biomes.filter(
      (option) => !isUuid(option.id) || selected.has(option.id)
    )
    const biomes = new Map(retained.map((option) => [option.id, option]))
    for (const option of action.options) biomes.set(option.id, option)
    return {
      ...state,
      creatureCatalog: {
        ...state.creatureCatalog,
        options: {
          ...state.creatureCatalog.options,
          biomes: [...biomes.values()]
        }
      }
    }
  }
  if (action.kind === 'loot-query')
    return {
      ...state,
      lootCatalog: {
        ...state.lootCatalog,
        query: {
          ...state.lootCatalog.query,
          ...action.patch,
          ...(!action.preserveOffset ? { offset: 0 } : {})
        }
      }
    }
  if (action.kind === 'view')
    return {
      ...state,
      catalogMode: action.catalogMode ?? state.catalogMode,
      workspaceMode: action.workspaceMode ?? state.workspaceMode
    }
  if (action.kind === 'draft-width')
    return { ...state, draftPaneWidth: action.width }
  if (action.kind === 'pending-intent')
    return { ...state, pendingIntent: action.pending }
  return synchronizeExternalGroups(state, action.groups)
}

export function activeGroupSession(
  state: GroupManagerState
): GroupDraftSession | null {
  return state.activeKey ? (state.sessions[state.activeKey] ?? null) : null
}

export function groupManagerAnyDirty(state: GroupManagerState): boolean {
  return Object.values(state.sessions).some(groupDraftSessionDirty)
}

export function groupDraftSessionDirty(session: GroupDraftSession): boolean {
  return (
    groupDraftStateDirty(session.group) ||
    Boolean(session.loot.history && groupLootDraftDirty(session.loot.history))
  )
}

export function groupManagerAnyLootDirty(state: GroupManagerState): boolean {
  return Object.values(state.sessions).some((session) =>
    Boolean(session.loot.history && groupLootDraftDirty(session.loot.history))
  )
}

export function groupManagerCurrentLootDirty(
  state: GroupManagerState
): boolean {
  const session = activeGroupSession(state)
  return Boolean(
    session?.loot.history && groupLootDraftDirty(session.loot.history)
  )
}

function createSession(
  group: GroupDraftState,
  sourceRevision: number | null
): GroupDraftSession {
  return {
    sourceRevision,
    group,
    loot: emptyLoot(),
    externalConflict: false
  }
}

function emptyLoot(): GroupManagerLootState {
  return {
    run: null,
    history: null,
    seed: null,
    phase: 'idle',
    error: '',
    issues: []
  }
}

function updateActiveSession(
  state: GroupManagerState,
  update: (session: GroupDraftSession) => GroupDraftSession
): GroupManagerState {
  return state.activeKey ? updateSession(state, state.activeKey, update) : state
}

function updateSession(
  state: GroupManagerState,
  key: string,
  update: (session: GroupDraftSession) => GroupDraftSession
): GroupManagerState {
  const current = state.sessions[key]
  if (!current) return state
  const next = update(current)
  return next === current
    ? state
    : { ...state, sessions: { ...state.sessions, [key]: next } }
}

function updateLootHistory(
  state: GroupManagerState,
  key: string,
  update: (history: GroupLootDraftHistory) => GroupLootDraftHistory
): GroupManagerState {
  return updateSession(state, key, (session) =>
    session.loot.history
      ? {
          ...session,
          loot: {
            ...session.loot,
            history: update(session.loot.history)
          }
        }
      : session
  )
}

function synchronizeExternalGroups(
  state: GroupManagerState,
  groups: readonly SceneGroup[]
): GroupManagerState {
  const byId = new Map(groups.map((group) => [group.id, group]))
  const sessions = { ...state.sessions }
  let changed = false
  for (const [key, session] of Object.entries(state.sessions)) {
    if (key === 'new') continue
    const group = byId.get(key)
    if (!group) {
      if (groupDraftSessionDirty(session)) {
        if (!session.externalConflict) {
          sessions[key] = { ...session, externalConflict: true }
          changed = true
        }
      } else {
        delete sessions[key]
        changed = true
      }
      continue
    }
    if (session.sourceRevision === group.revision) continue
    if (groupDraftSessionDirty(session)) {
      sessions[key] = { ...session, externalConflict: true }
    } else {
      sessions[key] = createSession(
        groupDraftStateFromGroup(group),
        group.revision
      )
    }
    changed = true
  }
  const activeKey =
    state.activeKey && state.activeKey !== 'new' && !sessions[state.activeKey]
      ? null
      : state.activeKey
  return changed || activeKey !== state.activeKey
    ? { ...state, sessions, activeKey }
    : state
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function groupMutationInvalidatesLoot(mutation: GroupDraftMutation): boolean {
  return (
    mutation.kind === 'roster' ||
    mutation.kind === 'undo-roster' ||
    mutation.kind === 'redo-roster'
  )
}
