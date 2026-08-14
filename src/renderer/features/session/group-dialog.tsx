import {
  formatMessage,
  message as uiMessage
} from '../../i18n/session-runtime.de.js'
import {
  formatInteger,
  formatMultiplier
} from '../../i18n/domain-formatters.de.js'
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import type {
  SceneGroup,
  SceneGroupDisposition
} from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { encounterCapabilities } from '../encounter/encounter-capabilities.js'
import { createBiomeOptionSearchPort } from '../creatures/biome-option-search-port.js'
import { createCreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import './session-dialogs.css'
import './group-dialog-frame.css'
import './group-dialog-generator.css'
import './group-dialog-draft.css'
import './group-dialog-footer.css'
import {
  applyCombatCommandResult,
  applySceneGroupCommandResult
} from './session-patches.js'
import { CreatureFilters, FilterChips } from '../creatures/creature-controls.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  useCreatureSearch
} from '../creatures/creature-state.js'
import { creaturesCapabilities } from '../creatures/creatures-capabilities.js'
import { useBiomeOptionSearch } from '../creatures/use-biome-option-search.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { sessionCapabilities } from './session-capabilities.js'
import { DiscardChangesDialog } from '../../shell/modal-dialog.js'
import {
  CreatureBuilderCatalogTable,
  CreatureCollectionManagerDialog
} from '../creature-collection/creature-collection.js'
import {
  creatureFact,
  emptyGroupDraftHistory,
  groupDraftEntries,
  groupDraftReducer,
  groupDraftSignature,
  newGroupDraftKey,
  type DraftCreatureFact,
  type GroupDraftAction,
  type GroupDraftState
} from './group-draft.js'

import { useGroupDraftLootController } from './use-group-draft-loot-controller.js'
import { generationSeed } from './generation-seed.js'

const LazyGroupLootInlinePanel = lazy(async () => {
  const module = await import('../loot/group-loot-inline-panel.js')
  return { default: module.GroupLootInlinePanel }
})

const LazyLootCatalogPane = lazy(async () => {
  const module = await import('../loot/loot-catalog-pane.js')
  return { default: module.LootCatalogPane }
})

export function GroupDialog(props: {
  snapshot: LiveSessionSnapshot
  group: SceneGroup | null
  close: () => void
  saved: (snapshot: LiveSessionSnapshot) => void
  lootChanged: () => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  reinforcementMode: boolean
}) {
  const api = useCapabilityApi()
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const activeGroups = focused.groups.filter((group) => !group.archived)
  const initialQuantities = Object.fromEntries(
    props.group?.entries.map((entry) => [
      entry.creatureId,
      entry.aliveQuantity
    ]) ?? []
  )
  const initialDeadQuantities = Object.fromEntries(
    props.group?.entries.map((entry) => [
      entry.creatureId,
      entry.deadQuantity
    ]) ?? []
  )
  const initialFacts = Object.fromEntries(
    props.group?.entries.map((entry) => [
      entry.creatureId,
      {
        displayName: entry.displayName,
        cr: 0,
        xp: 0,
        available: entry.available
      }
    ]) ?? []
  )
  const [selection, setSelection] = useState<string | null>(
    props.group?.id ?? (activeGroups.length === 0 ? newGroupDraftKey : null)
  )
  const [draft, dispatchDraft] = useReducer(groupDraftReducer, {
    name: props.group?.name ?? '',
    note: props.group?.note ?? '',
    disposition: props.group?.disposition ?? 'hostile',
    quantities: initialQuantities,
    deadQuantities: initialDeadQuantities,
    facts: initialFacts,
    baseline: groupDraftSignature(
      props.group?.name ?? '',
      props.group?.note ?? '',
      props.group?.disposition ?? 'hostile',
      initialQuantities,
      initialDeadQuantities
    ),
    evaluation: null,
    seed: 0,
    message: '',
    generationSummary: '',
    history: emptyGroupDraftHistory()
  })
  const {
    name,
    note,
    disposition,
    quantities,
    deadQuantities,
    facts,
    baseline,
    evaluation,
    seed,
    message,
    generationSummary,
    history
  } = draft
  const setName = (update: string) => dispatchDraft({ kind: 'name', update })
  const setNote = (update: string) => dispatchDraft({ kind: 'note', update })
  const setDisposition = (update: SceneGroupDisposition) =>
    dispatchDraft({ kind: 'disposition', update })
  const setFacts = (
    update:
      | Record<string, DraftCreatureFact>
      | ((
          current: Record<string, DraftCreatureFact>
        ) => Record<string, DraftCreatureFact>)
  ) => dispatchDraft({ kind: 'facts', update })
  const setEvaluation = (update: GroupDraftState['evaluation']) =>
    dispatchDraft({ kind: 'evaluation', update })
  const setSeed = (update: number) => dispatchDraft({ kind: 'seed', update })
  const setMessage = (update: string) =>
    dispatchDraft({ kind: 'message', update })
  const setGenerationSummary = (update: string) =>
    dispatchDraft({ kind: 'generationSummary', update })
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    locationId: focused.locationId,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const searchBiomeOptions = useBiomeOptionSearch(
    createBiomeOptionSearchPort(api.biomes),
    setOptions,
    query.biomes,
    props.onError
  )
  const [tuning] = useState<EncounterTuningOverride>({
    difficulty: 'preset',
    amount: 'preset',
    balance: 'preset',
    diversity: 'preset'
  })
  const [pending, setPending] = useState<GroupDraftAction | null>(null)
  const [lootDiscardPending, setLootDiscardPending] = useState(false)
  const pendingLootAction = useRef<(() => void) | null>(null)
  const [busy, setBusy] = useState(false)
  const [prospectiveGroupId] = useState(() => crypto.randomUUID())
  const [cachedDirty, setCachedDirty] = useState(false)
  const [draftPaneWidth, setDraftPaneWidth] = useState(460)
  const [catalogMode, setCatalogMode] = useState<'creatures' | 'loot'>(
    'creatures'
  )
  const drafts = useRef(new Map<string, GroupDraftState>())
  const evaluationRequest = useRef(0)
  const factsRequest = useRef(0)
  const entries = useMemo(
    () => groupDraftEntries(quantities, deadQuantities),
    [deadQuantities, quantities]
  )
  const active = selection !== null
  const dirty =
    active &&
    groupDraftSignature(name, note, disposition, quantities, deadQuantities) !==
      baseline
  const assigned = props.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const selectedPersistedGroup = focused.groups.find(
    (group) => group.id === selection
  )
  const rewardGroupId =
    selection && selection !== newGroupDraftKey ? selection : prospectiveGroupId
  const lootController = useGroupDraftLootController({
    draftKey: selection ?? 'no-group-selected',
    sceneId: focused.id,
    groupId: rewardGroupId,
    expectedSceneRevision: props.snapshot.scene.revision,
    expectedGroupRevision: selectedPersistedGroup?.revision ?? null,
    expectedPartyRevision: props.snapshot.party.revision,
    entries
  })
  const canGenerate =
    active &&
    assigned.length > 0 &&
    assigned.every((member) => member.level !== null)
  const effectiveCatalogMode =
    catalogMode === 'loot' && lootController.run ? 'loot' : 'creatures'
  useCreatureSearch(
    query,
    setPage,
    props.onError,
    createCreatureCapabilityPort(api.creatures)
  )
  useEffect(() => {
    void creaturesCapabilities(api)
      .creatures.filterOptions()
      .then(setOptions)
      .catch(reportCapabilityError(props.onError))
    void creaturesCapabilities(api)
      .creatures.search({ ...emptyQuery, limit: 1 })
      .then((result) => setCatalogTotal(result.total))
      .catch(reportCapabilityError(props.onError))
  }, [api, props.onError])

  useEffect(() => {
    if (!active) return
    const token = ++evaluationRequest.current
    const timer = window.setTimeout(() => {
      void sessionCapabilities(api)
        .scene.evaluateGroupDraft(
          focused.id,
          entries,
          props.snapshot.scene.revision
        )
        .then((next) => {
          if (evaluationRequest.current === token)
            dispatchDraft({ kind: 'evaluation', update: next })
        })
        .catch((cause) => {
          if (evaluationRequest.current === token)
            dispatchDraft({
              kind: 'message',
              update: capabilityErrorText(cause)
            })
        })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [active, api, entries, focused.id, props.snapshot.scene.revision])

  useEffect(() => {
    if (!selection) return
    const group = focused.groups.find((candidate) => candidate.id === selection)
    if (!group) return
    const token = ++factsRequest.current
    void Promise.all(
      group.entries.map((entry) =>
        creaturesCapabilities(api)
          .creatures.detail(entry.creatureId)
          .catch(() => null)
      )
    ).then((creatures) => {
      if (factsRequest.current !== token) return
      dispatchDraft({
        kind: 'facts',
        update: (current) => {
          const next = { ...current }
          for (const creature of creatures)
            if (creature) next[creature.id] = creatureFact(creature)
          return next
        }
      })
    })
  }, [api, focused.groups, selection])

  function load(nextSelection: string | null) {
    cacheCurrentDraft()
    const cached = nextSelection ? drafts.current.get(nextSelection) : null
    if (cached && nextSelection) {
      drafts.current.delete(nextSelection)
      setCachedDirty(hasDirtyDrafts())
      setSelection(nextSelection)
      dispatchDraft({ kind: 'replace', state: cached })
      return
    }
    const group = nextSelection
      ? focused.groups.find((candidate) => candidate.id === nextSelection)
      : undefined
    const nextName = group?.name ?? ''
    const nextNote = group?.note ?? ''
    const nextDisposition = group?.disposition ?? 'hostile'
    const nextQuantities = Object.fromEntries(
      group?.entries.map((entry) => [entry.creatureId, entry.aliveQuantity]) ??
        []
    )
    const nextDeadQuantities = Object.fromEntries(
      group?.entries.map((entry) => [entry.creatureId, entry.deadQuantity]) ??
        []
    )
    const nextFacts = Object.fromEntries(
      group?.entries.map((entry) => [
        entry.creatureId,
        {
          displayName: entry.displayName,
          cr: 0,
          xp: 0,
          available: entry.available
        }
      ]) ?? []
    )
    setSelection(nextSelection)
    setCachedDirty(hasDirtyDrafts())
    dispatchDraft({
      kind: 'replace',
      state: {
        name: nextName,
        note: nextNote,
        disposition: nextDisposition,
        quantities: nextQuantities,
        deadQuantities: nextDeadQuantities,
        facts: nextFacts,
        baseline: groupDraftSignature(
          nextName,
          nextNote,
          nextDisposition,
          nextQuantities,
          nextDeadQuantities
        ),
        evaluation: null,
        message: '',
        seed: 0,
        generationSummary: '',
        history: emptyGroupDraftHistory()
      }
    })
  }

  function cacheCurrentDraft() {
    if (!selection) return
    drafts.current.set(selection, {
      name,
      note,
      disposition,
      quantities,
      deadQuantities,
      facts,
      baseline,
      evaluation,
      seed,
      message,
      generationSummary,
      history
    })
  }

  function hasDirtyDrafts() {
    return [...drafts.current.values()].some(
      (draft) =>
        groupDraftSignature(
          draft.name,
          draft.note,
          draft.disposition,
          draft.quantities,
          draft.deadQuantities
        ) !== draft.baseline
    )
  }

  function perform(action: GroupDraftAction) {
    setPending(null)
    if (action.kind === 'close') props.close()
    else load(action.selection)
  }

  function request(action: GroupDraftAction) {
    if (action.kind === 'select') {
      load(action.selection)
      return
    }
    cacheCurrentDraft()
    setCachedDirty(hasDirtyDrafts())
    if (dirty || hasDirtyDrafts() || lootController.hasDirtyDrafts())
      setPending(action)
    else perform(action)
  }

  function protectLootReplacement(action: () => void, all = false) {
    if (all ? lootController.hasDirtyDrafts() : lootController.dirty) {
      pendingLootAction.current = action
      setLootDiscardPending(true)
      return
    }
    action()
  }

  function addCreature(creature: Creature, confirmed = false) {
    if (!active) return
    if (!confirmed && lootController.dirty) {
      protectLootReplacement(() => addCreature(creature, true))
      return
    }
    lootController.invalidate()
    dispatchDraft({
      kind: 'roster',
      update: {
        quantities: {
          ...quantities,
          [creature.id]: Math.min(999, (quantities[creature.id] ?? 0) + 1)
        },
        deadQuantities
      }
    })
    setFacts((current) => ({
      ...current,
      [creature.id]: creatureFact(creature)
    }))
  }

  function changeQuantity(
    creatureId: string,
    delta: number,
    kind: 'alive' | 'dead' = 'alive',
    confirmed = false
  ) {
    if (!confirmed && lootController.dirty) {
      protectLootReplacement(() =>
        changeQuantity(creatureId, delta, kind, true)
      )
      return
    }
    lootController.invalidate()
    const current = kind === 'alive' ? quantities : deadQuantities
    const quantity = Math.max(
      0,
      Math.min(999, (current[creatureId] ?? 0) + delta)
    )
    const next = { ...current }
    if (quantity === 0) delete next[creatureId]
    else next[creatureId] = quantity
    dispatchDraft({
      kind: 'roster',
      update: {
        quantities: kind === 'alive' ? next : quantities,
        deadQuantities: kind === 'dead' ? next : deadQuantities
      }
    })
  }

  function removeCreature(creatureId: string, confirmed = false) {
    if (!confirmed && lootController.dirty) {
      protectLootReplacement(() => removeCreature(creatureId, true))
      return
    }
    lootController.invalidate()
    const nextQuantities = { ...quantities }
    const nextDeadQuantities = { ...deadQuantities }
    delete nextQuantities[creatureId]
    delete nextDeadQuantities[creatureId]
    dispatchDraft({
      kind: 'roster',
      update: {
        quantities: nextQuantities,
        deadQuantities: nextDeadQuantities
      }
    })
  }

  function moveRosterHistory(
    kind: 'undo-roster' | 'redo-roster',
    confirmed = false
  ) {
    if (!confirmed && lootController.dirty) {
      protectLootReplacement(() => moveRosterHistory(kind, true))
      return
    }
    lootController.invalidate()
    dispatchDraft({ kind })
  }

  async function inspect(creature: Creature) {
    try {
      props.inspect(
        await creaturesCapabilities(api).creatures.detail(creature.id)
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    }
  }

  async function generate(mode: 'fill' | 'replace', confirmed = false) {
    if (!canGenerate) return
    if (!confirmed && lootController.dirty) {
      protectLootReplacement(() => void generate(mode, true))
      return
    }
    const nextSeed = generationSeed(api.runtime.e2e)
    setBusy(true)
    try {
      const result = await sessionCapabilities(api).scene.generateGroupDraft(
        focused.id,
        entries,
        mode,
        query,
        tuning,
        nextSeed,
        props.snapshot.scene.revision
      )
      const nextQuantities = Object.fromEntries(
        result.entries.map((entry) => [entry.creatureId, entry.quantity])
      )
      const previousCount = Object.values(quantities).reduce(
        (total, quantity) => total + quantity,
        0
      )
      const nextCount = Object.values(nextQuantities).reduce(
        (total, quantity) => total + quantity,
        0
      )
      const nextDeadQuantities = mode === 'fill' ? deadQuantities : {}
      lootController.invalidate()
      if (
        JSON.stringify(
          groupDraftEntries(nextQuantities, nextDeadQuantities)
        ) !== JSON.stringify(entries)
      )
        dispatchDraft({
          kind: 'roster',
          update: {
            quantities: nextQuantities,
            deadQuantities: nextDeadQuantities
          }
        })
      setFacts((current) => ({
        ...current,
        ...Object.fromEntries(
          result.entries.map((entry) => [
            entry.creatureId,
            {
              displayName: entry.displayName,
              cr: entry.cr,
              xp: entry.xp,
              available: entry.available
            }
          ])
        )
      }))
      setEvaluation(result.evaluation)
      setSeed(nextSeed)
      setMessage(result.message)
      setGenerationSummary(
        formatMessage(
          mode === 'fill' ? 'group.generatedFilled' : 'group.generatedReplaced',
          {
            count:
              mode === 'fill'
                ? Math.max(0, nextCount - previousCount)
                : nextCount
          }
        )
      )
      await lootController.generate(
        groupDraftEntries(nextQuantities, nextDeadQuantities)
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function save(confirmed = false) {
    if (!active) return
    if (!confirmed && lootController.hasDirtyDrafts()) {
      protectLootReplacement(() => void save(true), true)
      return
    }
    if (
      entries.length > 0 &&
      !entries.some((entry) => facts[entry.creatureId]?.available === true)
    ) {
      setMessage(uiMessage('group.validation.availableMonster'))
      return
    }
    setBusy(true)
    try {
      const currentGroup = focused.groups.find(
        (group) => group.id === selection
      )
      props.saved(
        applySceneGroupCommandResult(
          props.snapshot,
          await sessionCapabilities(api).scene.saveGroup(
            focused.id,
            selection === newGroupDraftKey ? null : selection,
            name.trim(),
            note.trim(),
            disposition,
            entries,
            props.snapshot.scene.revision,
            currentGroup?.revision ?? null
          )
        )
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function commitGroupReward() {
    if (!active) return
    if (
      entries.length > 0 &&
      !entries.some((entry) => facts[entry.creatureId]?.available === true)
    ) {
      setMessage(uiMessage('group.validation.availableMonster'))
      return
    }
    setBusy(true)
    try {
      const result = await lootController.commit({
        name: name.trim(),
        note: note.trim(),
        disposition,
        entries
      })
      if (!result) return
      props.lootChanged()
      props.saved(
        applySceneGroupCommandResult(props.snapshot, result.groupResult)
      )
    } finally {
      setBusy(false)
    }
  }

  async function archive(confirmed = false) {
    if (!selection || selection === newGroupDraftKey) return
    if (!confirmed && lootController.hasDirtyDrafts()) {
      protectLootReplacement(() => void archive(true), true)
      return
    }
    setBusy(true)
    try {
      const currentGroup = focused.groups.find(
        (group) => group.id === selection
      )
      if (!currentGroup) return
      props.saved(
        applySceneGroupCommandResult(
          props.snapshot,
          await sessionCapabilities(api).scene.setGroupArchived(
            focused.id,
            selection,
            true,
            currentGroup.revision
          )
        )
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function joinCombat(confirmed = false) {
    if (!selection || selection === newGroupDraftKey || !props.snapshot.combat)
      return
    if (!confirmed && lootController.hasDirtyDrafts()) {
      protectLootReplacement(() => void joinCombat(true), true)
      return
    }
    setBusy(true)
    try {
      const currentGroup = focused.groups.find(
        (group) => group.id === selection
      )
      if (!currentGroup) return
      props.saved(
        applyCombatCommandResult(
          props.snapshot,
          await encounterCapabilities(api).combat.joinGroup({
            sceneId: focused.id,
            groupId: selection,
            expectedGroupRevision: currentGroup.revision,
            expectedCombatRevision: props.snapshot.combat.revision
          })
        )
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  const totalInDraft = Object.fromEntries(
    Array.from(
      new Set([...Object.keys(quantities), ...Object.keys(deadQuantities)])
    ).map((id) => [id, (quantities[id] ?? 0) + (deadQuantities[id] ?? 0)])
  )
  const filteredCount = page?.total ?? 0
  const filterSummary = formatMessage('group.catalogCount', {
    filtered: filteredCount,
    total: catalogTotal
  })
  const catalogFooterStatus = [
    page?.message ||
      formatMessage('group.filteredMonsters', { count: filteredCount }),
    generationSummary
  ]
    .filter(Boolean)
    .join(' · ')
  const sceneContext = [focused.title, focused.locationName]
    .filter(Boolean)
    .join(' · ')
  const levelContext = assigned
    .map((member) => member.level?.toString() ?? '—')
    .join(' / ')
  const anyDirty =
    dirty ||
    cachedDirty ||
    lootController.dirty ||
    lootController.hasDirtyDrafts()
  const canGenerateLoot = canGenerate && entries.length > 0

  return (
    <>
      <CreatureCollectionManagerDialog
        className="group-dialog session-group-manager"
        headerClassName="group-manager-header"
        toolsClassName="group-manager-tools"
        layoutClassName="group-manager-workspace"
        footerClassName="group-manager-footer"
        title={uiMessage('ui.gruppen.managen')}
        titleId="group-builder-title"
        heading={
          <div className="title-group">
            <span className="illuminated-initial" aria-hidden="true">
              {uiMessage('ui.gruppen.managen').charAt(0)}
            </span>
            <h2 id="group-builder-title">
              {uiMessage('ui.gruppen.managen').slice(1)}
            </h2>
          </div>
        }
        closeLabel={uiMessage('ui.dialog.schliessen')}
        closeClassName="close"
        close={() => request({ kind: 'close' })}
        busy={busy}
        toolsLabel={uiMessage('group.tools')}
        headerControls={
          <>
            <span className="scene-crumb" title={sceneContext}>
              {sceneContext}
            </span>
            <select
              className="group-manager-selection"
              aria-label={uiMessage('group.select')}
              value={selection ?? ''}
              onChange={(event) =>
                request({
                  kind: 'select',
                  selection: event.target.value || null
                })
              }
            >
              <option value="">{uiMessage('group.selectPlaceholder')}</option>
              {activeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                  {props.snapshot.combat?.selectedGroupIds.includes(group.id)
                    ? ` · ${uiMessage('encounter.inCombat')}`
                    : ''}
                </option>
              ))}
              <option value={newGroupDraftKey}>
                {uiMessage('group.createTitle')}
              </option>
            </select>
            <button
              className="group-manager-new"
              type="button"
              onClick={() =>
                request({ kind: 'select', selection: newGroupDraftKey })
              }
            >
              + {uiMessage('group.createTitle')}
            </button>
            <input
              className="group-manager-name"
              aria-label={uiMessage('ui.gruppenname')}
              placeholder={uiMessage('group.name.placeholder')}
              maxLength={100}
              disabled={!active}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <select
              className="group-manager-disposition"
              aria-label={uiMessage('group.disposition')}
              disabled={!active}
              value={disposition}
              onChange={(event) =>
                setDisposition(event.target.value as SceneGroupDisposition)
              }
            >
              <option value="hostile">
                {uiMessage('group.disposition.hostile')}
              </option>
              <option value="neutral">
                {uiMessage('group.disposition.neutral')}
              </option>
              <option value="allied">
                {uiMessage('group.disposition.allied')}
              </option>
            </select>
          </>
        }
        tools={
          <div>
            <div
              className="group-catalog-mode-tabs"
              role="tablist"
              aria-label={uiMessage('loot.catalogMode')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveCatalogMode === 'creatures'}
                onClick={() => setCatalogMode('creatures')}
              >
                {uiMessage('loot.catalogCreatures')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveCatalogMode === 'loot'}
                disabled={!lootController.run}
                onClick={() => setCatalogMode('loot')}
              >
                {uiMessage('loot.catalogLoot')}
              </button>
            </div>
            {effectiveCatalogMode === 'creatures' && (
              <CreatureFilters
                query={query}
                options={options}
                searchBiomeOptions={searchBiomeOptions}
                changed={setQuery}
                clustered
              />
            )}
            <div className="group-tool-row">
              <div className="group-filter-summary">
                {effectiveCatalogMode === 'creatures' ? (
                  <>
                    <FilterChips
                      query={query}
                      changed={setQuery}
                      options={options}
                    />
                    <span>{filterSummary}</span>
                  </>
                ) : (
                  <span>{uiMessage('loot.catalogHint')}</span>
                )}
              </div>
              <section
                className="group-generator-card"
                aria-label={uiMessage('group.generator')}
              >
                <strong>{uiMessage('group.generator')}</strong>
                <div className="group-generator-actions">
                  <button
                    type="button"
                    disabled={busy || !canGenerate}
                    onClick={() => void generate('fill')}
                  >
                    {uiMessage('ui.auffuellen')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !canGenerate}
                    onClick={() => void generate('replace')}
                  >
                    {uiMessage('ui.neu.generieren')}
                  </button>
                </div>
                {!canGenerate && (
                  <small>
                    {uiMessage(
                      'ui.zum.generieren.braucht.die.scene.eine.zugewiesene.party'
                    )}
                  </small>
                )}
              </section>
            </div>
          </div>
        }
        catalog={
          effectiveCatalogMode === 'creatures' || !lootController.run ? (
            <CreatureBuilderCatalogTable
              className="group-manager-catalog"
              query={query}
              options={options}
              page={page}
              changed={setQuery}
              add={addCreature}
              inspect={(creature) => void inspect(creature)}
              quantities={totalInDraft}
              controls={false}
              showBiome
              footerStatus={catalogFooterStatus}
            />
          ) : (
            <Suspense fallback={null}>
              <LazyLootCatalogPane
                key={lootController.run.catalogContentHash}
                runId={lootController.run.id}
                catalogContentHash={lootController.run.catalogContentHash}
                add={lootController.addCatalogEntry}
              />
            </Suspense>
          )
        }
        divider={{
          kind: 'resizable',
          value: draftPaneWidth,
          minimum: 400,
          maximum: 620,
          label: uiMessage('group.draftWidth'),
          changed: setDraftPaneWidth
        }}
        draft={
          <section
            className="group-manager-draft-rim"
            aria-label={uiMessage('ui.aktuelle.gruppe')}
          >
            <div className="group-manager-draft-sheet">
              <GroupDraftEvaluation
                evaluation={evaluation}
                canUndo={history.past.length > 0}
                canRedo={history.future.length > 0}
                undo={() => moveRosterHistory('undo-roster')}
                redo={() => moveRosterHistory('redo-roster')}
              />
              <div
                className="group-draft-scroll"
                tabIndex={0}
                aria-label={uiMessage('ui.aktuelle.gruppe')}
              >
                {!active ? (
                  <p className="session-group-empty">
                    {uiMessage('ui.waehle.eine.gruppe.aus.oder.lege.eine.neue')}
                  </p>
                ) : entries.length === 0 ? (
                  <p className="session-group-empty">
                    {uiMessage('ui.monster.links.mit')} <strong>+</strong>{' '}
                    {uiMessage('ui.hinzufuegen.oder.eine.gruppe.generieren')}
                  </p>
                ) : (
                  <ul className="creature-collection-roster">
                    {entries.map((entry) => {
                      const fact = facts[entry.creatureId]
                      const displayName = fact?.displayName ?? entry.creatureId
                      return (
                        <li
                          key={entry.creatureId}
                          className={
                            fact?.available === false ? 'unavailable' : ''
                          }
                        >
                          <span>
                            <strong>{displayName}</strong>
                            <small>
                              {uiMessage('ui.cr')} {fact?.cr ?? '—'} ·{' '}
                              {formatInteger(fact?.xp ?? 0)}{' '}
                              {uiMessage('ui.xp.2')}
                              {fact?.available === false
                                ? ` · ${uiMessage('group.unavailable')}`
                                : ''}
                            </small>
                          </span>
                          <div className="group-roster-counts">
                            <div className="creature-collection-quantity">
                              <small>{uiMessage('group.alive')}</small>
                              <button
                                type="button"
                                aria-label={formatMessage(
                                  'group.decreaseAlive',
                                  { name: displayName }
                                )}
                                onClick={() =>
                                  changeQuantity(entry.creatureId, -1)
                                }
                              >
                                −
                              </button>
                              <strong>{entry.quantity}</strong>
                              <button
                                type="button"
                                aria-label={formatMessage(
                                  'group.increaseAlive',
                                  { name: displayName }
                                )}
                                onClick={() =>
                                  changeQuantity(entry.creatureId, 1)
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="creature-collection-quantity">
                              <small>{uiMessage('group.dead')}</small>
                              <button
                                type="button"
                                aria-label={formatMessage(
                                  'group.decreaseDead',
                                  { name: displayName }
                                )}
                                onClick={() =>
                                  changeQuantity(entry.creatureId, -1, 'dead')
                                }
                              >
                                −
                              </button>
                              <strong>{entry.deadQuantity}</strong>
                              <button
                                type="button"
                                aria-label={formatMessage(
                                  'group.increaseDead',
                                  { name: displayName }
                                )}
                                onClick={() =>
                                  changeQuantity(entry.creatureId, 1, 'dead')
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            className="remove"
                            type="button"
                            aria-label={formatMessage('group.removeCreature', {
                              name: displayName
                            })}
                            onClick={() => removeCreature(entry.creatureId)}
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {message && (
                  <p className="group-draft-message" role="status">
                    {message}
                  </p>
                )}
                {active && (
                  <Suspense fallback={null}>
                    <LazyGroupLootInlinePanel
                      groupName={name}
                      run={lootController.run}
                      draft={lootController.draft}
                      phase={lootController.phase}
                      error={lootController.error}
                      canGenerate={canGenerateLoot}
                      canUndo={lootController.canUndo}
                      canRedo={lootController.canRedo}
                      generate={() => void lootController.generate()}
                      retry={() =>
                        protectLootReplacement(
                          () => void lootController.retry()
                        )
                      }
                      reroll={() =>
                        protectLootReplacement(
                          () => void lootController.reroll()
                        )
                      }
                      commit={() => void commitGroupReward()}
                      patchLabel={lootController.patchLabel}
                      patchItem={lootController.patchItem}
                      removeItem={lootController.removeItem}
                      patchContainer={lootController.patchContainer}
                      removeContainer={lootController.removeContainer}
                      undo={lootController.undo}
                      redo={lootController.redo}
                    />
                  </Suspense>
                )}
              </div>
              <label className="group-manager-note">
                <span>{uiMessage('group.note')}</span>
                <textarea
                  aria-label={uiMessage('group.note')}
                  maxLength={1000}
                  rows={2}
                  disabled={!active}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
          </section>
        }
        footer={
          <>
            <span>
              {focused.locationName || uiMessage('ui.kein.ort.gesetzt')} ·{' '}
              {assigned.length} {uiMessage('ui.zugewiesene.pcs')}
              {assigned.length > 0
                ? ` · ${uiMessage('group.levels')} ${levelContext}`
                : ''}
              {anyDirty ? ` · ${uiMessage('group.unsaved')}` : ''}
            </span>
            <div>
              {props.reinforcementMode &&
                props.snapshot.combat?.phase === 'combat' &&
                selection &&
                selection !== newGroupDraftKey &&
                !props.snapshot.combat.selectedGroupIds.includes(selection) && (
                  <button
                    type="button"
                    disabled={busy || dirty || lootController.dirty}
                    onClick={() => void joinCombat()}
                  >
                    {uiMessage('encounter.joinCombat')}
                  </button>
                )}
              {selection && selection !== newGroupDraftKey && (
                <button
                  className="danger"
                  type="button"
                  disabled={busy}
                  onClick={() => void archive()}
                >
                  {uiMessage('group.archive')}
                </button>
              )}
              <button
                className="secondary"
                type="button"
                onClick={() => request({ kind: 'close' })}
              >
                {uiMessage('action.cancel')}
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={busy || !active}
                onClick={() => void save()}
              >
                {uiMessage('action.save')}
              </button>
            </div>
          </>
        }
      />
      {pending && (
        <DiscardChangesDialog
          message={uiMessage('ui.ungespeicherte.aenderungen.verwerfen')}
          cancelLabel={uiMessage('action.cancel')}
          discardLabel={uiMessage('ui.aenderungen.verwerfen')}
          onCancel={() => setPending(null)}
          onDiscard={() => {
            const action = pending
            setPending(null)
            perform(action)
          }}
        />
      )}
      {lootDiscardPending && (
        <DiscardChangesDialog
          message={uiMessage('loot.discardQuestion')}
          cancelLabel={uiMessage('action.cancel')}
          discardLabel={uiMessage('ui.aenderungen.verwerfen')}
          onCancel={() => {
            pendingLootAction.current = null
            setLootDiscardPending(false)
          }}
          onDiscard={() => {
            const action = pendingLootAction.current
            pendingLootAction.current = null
            setLootDiscardPending(false)
            action?.()
          }}
        />
      )}
    </>
  )
}

function GroupDraftEvaluation(props: {
  evaluation: GroupDraftState['evaluation']
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}) {
  const evaluation = props.evaluation
  const maximum = Math.max(1, (evaluation?.partyThresholds[3] ?? 0) * 1.25)
  const position = Math.min(
    100,
    Math.round(((evaluation?.adjustedXp ?? 0) / maximum) * 100)
  )
  const threshold = evaluation ? thresholdForEvaluation(evaluation) : 0
  const difficultyLabel = evaluation
    ? groupDifficultyLabel(evaluation.difficultyBand)
    : '—'
  return (
    <div className="group-draft-evaluation" aria-live="polite">
      <div className="group-draft-evaluation-row">
        <strong>{difficultyLabel}</strong>
        <span>
          {formatInteger(evaluation?.adjustedXp ?? 0)} XP{' '}
          {uiMessage('encounter.adjusted').toLocaleLowerCase()}
        </span>
        <small>
          {evaluation
            ? `${uiMessage('encounter.threshold')} ${difficultyLabel} ${formatInteger(threshold)}`
            : uiMessage('group.evaluationPending')}
        </small>
        <div className="group-history-actions">
          <button
            type="button"
            aria-label={uiMessage('group.undo')}
            disabled={!props.canUndo}
            onClick={props.undo}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={uiMessage('group.redo')}
            disabled={!props.canRedo}
            onClick={props.redo}
          >
            ›
          </button>
        </div>
      </div>
      <div className="group-difficulty-meter" aria-hidden="true">
        <span style={{ width: `${position}%` }} />
      </div>
      <small>
        {formatInteger(evaluation?.baseXp ?? 0)} {uiMessage('group.baseXp')} ·{' '}
        {uiMessage('encounter.multiplier')} ×{' '}
        {formatMultiplier(evaluation?.multiplier ?? 1)} ·{' '}
        {evaluation?.creatureCount ?? 0} {uiMessage('ui.wesen')}
      </small>
    </div>
  )
}

function groupDifficultyLabel(
  band: NonNullable<GroupDraftState['evaluation']>['difficultyBand']
): string {
  if (band === 'trivial') return uiMessage('group.difficulty.trivial')
  if (band === 'easy') return uiMessage('group.difficulty.easy')
  if (band === 'medium') return uiMessage('group.difficulty.medium')
  if (band === 'hard') return uiMessage('group.difficulty.hard')
  if (band === 'deadly') return uiMessage('group.difficulty.deadly')
  return uiMessage('group.difficulty.unavailable')
}

function thresholdForEvaluation(
  evaluation: NonNullable<GroupDraftState['evaluation']>
): number {
  if (evaluation.difficultyBand === 'easy') return evaluation.partyThresholds[0]
  if (evaluation.difficultyBand === 'medium')
    return evaluation.partyThresholds[1]
  if (evaluation.difficultyBand === 'hard') return evaluation.partyThresholds[2]
  if (evaluation.difficultyBand === 'deadly')
    return evaluation.partyThresholds[3]
  return 0
}
