import {
  formatMessage,
  message as uiMessage
} from '../../i18n/session-runtime.de.js'
import {
  useCallback,
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
import { CreatureCollectionManagerDialog } from '../creature-collection/creature-collection.js'
import {
  creatureFact,
  groupDraftEntries,
  newGroupDraftKey,
  type DraftCreatureFact,
  type GroupDraftMutation,
  type GroupDraftState
} from './group-draft.js'
import {
  createGroupDraftSessions,
  groupDraftSessionsDirty,
  groupDraftSessionsReducer,
  groupDraftStateDirty,
  groupDraftStateFromGroup
} from './group-draft-sessions.js'
import { GroupManagerDraftPane } from './group-manager-draft-pane.js'
import {
  GroupManagerCatalogPane,
  GroupManagerCatalogTools,
  type GroupCatalogMode
} from './group-manager-catalog.js'
import {
  groupManagerIntentNeedsConfirmation,
  type GroupManagerGuard,
  type GroupManagerIntent,
  type PendingGroupManagerIntent
} from './group-manager-intent.js'

import { useGroupDraftLootController } from './use-group-draft-loot-controller.js'
import { generationSeed } from './generation-seed.js'

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
  const initialSelection =
    props.group?.id ?? (activeGroups.length === 0 ? newGroupDraftKey : null)
  const [draftSessions, dispatchDraftSessions] = useReducer(
    groupDraftSessionsReducer,
    createGroupDraftSessions(
      initialSelection,
      groupDraftStateFromGroup(props.group)
    )
  )
  const selection = draftSessions.activeKey
  const draft = draftSessions.draft
  const dispatchDraft = useCallback(
    (mutation: GroupDraftMutation) =>
      dispatchDraftSessions({ kind: 'mutate', mutation }),
    []
  )
  const {
    name,
    note,
    disposition,
    quantities,
    deadQuantities,
    facts,
    evaluation,
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
  const [pendingIntent, setPendingIntent] =
    useState<PendingGroupManagerIntent | null>(null)
  const [busy, setBusy] = useState(false)
  const [prospectiveGroupId] = useState(() => crypto.randomUUID())
  const [draftPaneWidth, setDraftPaneWidth] = useState(460)
  const [catalogMode, setCatalogMode] = useState<GroupCatalogMode>('creatures')
  const evaluationRequest = useRef(0)
  const factsRequest = useRef(0)
  const entries = useMemo(
    () => groupDraftEntries(quantities, deadQuantities),
    [deadQuantities, quantities]
  )
  const active = selection !== null
  const dirty = active && groupDraftStateDirty(draft)
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
  }, [
    active,
    api,
    dispatchDraft,
    entries,
    focused.id,
    props.snapshot.scene.revision
  ])

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
  }, [api, dispatchDraft, focused.groups, selection])

  function load(nextSelection: string | null) {
    const group = nextSelection
      ? focused.groups.find((candidate) => candidate.id === nextSelection)
      : undefined
    dispatchDraftSessions({
      kind: 'activate',
      key: nextSelection,
      fallback: groupDraftStateFromGroup(group)
    })
  }

  function requestIntent(intent: GroupManagerIntent, guard: GroupManagerGuard) {
    if (
      groupManagerIntentNeedsConfirmation(guard, {
        anyGroup: groupDraftSessionsDirty(draftSessions),
        currentLoot: lootController.dirty,
        anyLoot: lootController.hasDirtyDrafts()
      })
    ) {
      setPendingIntent({ intent, guard })
      return
    }
    performIntent(intent)
  }

  function performIntent(intent: GroupManagerIntent) {
    setPendingIntent(null)
    switch (intent.kind) {
      case 'close':
        props.close()
        return
      case 'add-creature':
        applyAddCreature(intent.creature)
        return
      case 'change-quantity':
        applyQuantityChange(
          intent.creatureId,
          intent.delta,
          intent.quantityKind
        )
        return
      case 'remove-creature':
        applyRemoveCreature(intent.creatureId)
        return
      case 'roster-history':
        applyRosterHistory(intent.direction)
        return
      case 'generate-roster':
        void applyGenerate(intent.mode)
        return
      case 'regenerate-loot':
        void (intent.mode === 'retry'
          ? lootController.retry()
          : lootController.reroll())
        return
      case 'save':
        void applySave()
        return
      case 'archive':
        void applyArchive()
        return
      case 'join-combat':
        void applyJoinCombat()
    }
  }

  function addCreature(creature: Creature) {
    requestIntent({ kind: 'add-creature', creature }, 'current-loot')
  }

  function applyAddCreature(creature: Creature) {
    if (!active) return
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
    kind: 'alive' | 'dead' = 'alive'
  ) {
    requestIntent(
      { kind: 'change-quantity', creatureId, delta, quantityKind: kind },
      'current-loot'
    )
  }

  function applyQuantityChange(
    creatureId: string,
    delta: number,
    kind: 'alive' | 'dead'
  ) {
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

  function removeCreature(creatureId: string) {
    requestIntent({ kind: 'remove-creature', creatureId }, 'current-loot')
  }

  function applyRemoveCreature(creatureId: string) {
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

  function moveRosterHistory(kind: 'undo-roster' | 'redo-roster') {
    requestIntent({ kind: 'roster-history', direction: kind }, 'current-loot')
  }

  function applyRosterHistory(kind: 'undo-roster' | 'redo-roster') {
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

  function generate(mode: 'fill' | 'replace') {
    requestIntent({ kind: 'generate-roster', mode }, 'current-loot')
  }

  async function applyGenerate(mode: 'fill' | 'replace') {
    if (!canGenerate) return
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

  function save() {
    requestIntent({ kind: 'save' }, 'all-loot')
  }

  async function applySave() {
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

  function archive() {
    requestIntent({ kind: 'archive' }, 'all-loot')
  }

  async function applyArchive() {
    if (!selection || selection === newGroupDraftKey) return
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

  function joinCombat() {
    requestIntent({ kind: 'join-combat' }, 'all-loot')
  }

  async function applyJoinCombat() {
    if (!selection || selection === newGroupDraftKey || !props.snapshot.combat)
      return
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
    groupDraftSessionsDirty(draftSessions) || lootController.hasDirtyDrafts()
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
        close={() => requestIntent({ kind: 'close' }, 'close')}
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
              onChange={(event) => load(event.target.value || null)}
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
              onClick={() => load(newGroupDraftKey)}
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
          <GroupManagerCatalogTools
            mode={effectiveCatalogMode}
            lootAvailable={Boolean(lootController.run)}
            query={query}
            options={options}
            searchBiomeOptions={searchBiomeOptions}
            queryChanged={setQuery}
            modeChanged={setCatalogMode}
            filterSummary={filterSummary}
            busy={busy}
            canGenerate={canGenerate}
            generate={generate}
          />
        }
        catalog={
          <GroupManagerCatalogPane
            mode={effectiveCatalogMode}
            run={lootController.run}
            query={query}
            options={options}
            page={page}
            queryChanged={setQuery}
            addCreature={addCreature}
            inspectCreature={(creature) => void inspect(creature)}
            quantities={totalInDraft}
            footerStatus={catalogFooterStatus}
            addLoot={lootController.addCatalogEntry}
          />
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
          <GroupManagerDraftPane
            active={active}
            name={name}
            note={note}
            message={message}
            entries={entries}
            facts={facts}
            evaluation={evaluation}
            canUndoRoster={history.past.length > 0}
            canRedoRoster={history.future.length > 0}
            canGenerateLoot={canGenerateLoot}
            loot={lootController}
            moveRosterHistory={moveRosterHistory}
            changeQuantity={changeQuantity}
            removeCreature={removeCreature}
            retryLoot={() =>
              requestIntent(
                { kind: 'regenerate-loot', mode: 'retry' },
                'current-loot'
              )
            }
            rerollLoot={() =>
              requestIntent(
                { kind: 'regenerate-loot', mode: 'reroll' },
                'current-loot'
              )
            }
            commitLoot={() => void commitGroupReward()}
            noteChanged={setNote}
          />
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
                onClick={() => requestIntent({ kind: 'close' }, 'close')}
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
      {pendingIntent && (
        <DiscardChangesDialog
          message={
            pendingIntent.guard === 'close'
              ? uiMessage('ui.ungespeicherte.aenderungen.verwerfen')
              : uiMessage('loot.discardQuestion')
          }
          cancelLabel={uiMessage('action.cancel')}
          discardLabel={uiMessage('ui.aenderungen.verwerfen')}
          onCancel={() => setPendingIntent(null)}
          onDiscard={() => {
            const { intent } = pendingIntent
            setPendingIntent(null)
            performIntent(intent)
          }}
        />
      )}
    </>
  )
}
