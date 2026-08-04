import { formatMessage, message as uiMessage } from '../../i18n/messages.de.js'
import {
  Fragment,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../../shared/contracts/encounter-tuning.js'
import type {
  SceneGroup,
  SceneGroupDisposition
} from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import {
  DifficultySummary,
  TuningControls
} from '../encounter/encounter-tuning.js'
import { encounterCapabilities } from '../encounter/encounter-capabilities.js'
import {
  applyCombatCommandResult,
  applySceneGroupCommandResult
} from './session-patches.js'
import { CreatureFilters, FilterChips } from '../catalog/catalog-controls.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  useCreatureSearch
} from '../catalog/catalog-state.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { sessionCapabilities } from './session-capabilities.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { CreatureInspector } from '../catalog/creature-inspector.js'
import {
  creatureFact,
  groupDraftEntries,
  groupDraftReducer,
  groupDraftSignature,
  newGroupDraftKey,
  type DraftCreatureFact,
  type GroupDraftAction,
  type GroupDraftState
} from './group-draft.js'

function DispositionSelect(props: {
  value: SceneGroupDisposition
  changed: (value: SceneGroupDisposition) => void
}) {
  return (
    <label>
      {uiMessage('group.disposition')}
      <select
        value={props.value}
        onChange={(event) =>
          props.changed(event.target.value as SceneGroupDisposition)
        }
      >
        <option value="hostile">
          {uiMessage('group.disposition.hostile')}
        </option>
        <option value="neutral">
          {uiMessage('group.disposition.neutral')}
        </option>
        <option value="allied">{uiMessage('group.disposition.allied')}</option>
      </select>
    </label>
  )
}

export function CreatureCollectionCatalogPane(props: {
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  page: CreatureCatalogPage | null
  changed: (query: CreatureCatalogQuery) => void
  add?: (creature: Creature) => void
  inspect: (creature: Creature) => void
  quantities?: Readonly<Record<string, number>>
  variant?: 'builder' | 'inspector'
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  function toggleExpanded(creatureId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(creatureId)) next.delete(creatureId)
      else next.add(creatureId)
      return next
    })
  }

  return (
    <section
      className="group-catalog-pane"
      aria-label={uiMessage('ui.monsterkatalog')}
    >
      <div className="catalog-pane-summary">
        <strong>{uiMessage('ui.monsterkatalog')}</strong>
        <span>{props.page?.message}</span>
      </div>
      <CreatureFilters
        query={props.query}
        options={props.options}
        changed={props.changed}
        compact
      />
      <div className="filter-chips">
        <FilterChips query={props.query} changed={props.changed} />
      </div>
      <div className="group-catalog-table-wrap">
        <table className="catalog-table group-catalog-table">
          <thead>
            <tr>
              <th>{uiMessage('ui.monster')}</th>
              <th>{uiMessage('ui.cr')}</th>
              <th>{uiMessage('ui.typ')}</th>
              <th>{uiMessage('ui.xp.2')}</th>
              {props.variant !== 'inspector' && (
                <th>{uiMessage('ui.aktionen')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {props.page?.rows.map((creature) => {
              const open = expanded.has(creature.id)
              const quantity = props.quantities?.[creature.id] ?? 0
              return (
                <Fragment key={creature.id}>
                  <tr className={open ? 'catalog-row expanded' : 'catalog-row'}>
                    <td>
                      <span className="catalog-name-cell">
                        <button
                          type="button"
                          className="catalog-expand"
                          aria-expanded={open}
                          aria-label={formatMessage(
                            open
                              ? 'catalog.hideCreature'
                              : 'catalog.showCreature',
                            { name: creature.name }
                          )}
                          onClick={() =>
                            props.variant === 'inspector'
                              ? props.inspect(creature)
                              : toggleExpanded(creature.id)
                          }
                        >
                          {open ? '▾' : '▸'}
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => props.inspect(creature)}
                        >
                          {creature.name}
                        </button>
                      </span>
                    </td>
                    <td>{creature.challengeRating}</td>
                    <td>{creature.type}</td>
                    <td>{creature.xp.toLocaleString()}</td>
                    {props.variant !== 'inspector' && (
                      <td>
                        {quantity > 0 ? (
                          <span className="catalog-in-draft">
                            {formatMessage('catalog.inGroup', { quantity })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={formatMessage('catalog.addCreature', {
                              name: creature.name
                            })}
                            onClick={() => props.add?.(creature)}
                          >
                            +
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {open && props.variant !== 'inspector' && (
                    <tr className="catalog-expanded-row">
                      <td colSpan={5}>
                        <CreatureInspector creature={creature} embedded />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {props.page?.status === 'empty' && (
          <p className="empty-state">{props.page.message}</p>
        )}
      </div>
      <footer className="catalog-footer">
        <span>
          {props.page?.message || `${props.page?.total ?? 0} Monster`}
        </span>
        <div>
          <button
            type="button"
            disabled={!props.page || props.query.offset === 0}
            onClick={() =>
              props.changed({
                ...props.query,
                offset: Math.max(0, props.query.offset - props.query.limit)
              })
            }
          >
            {uiMessage('ui.zurueck')}
          </button>
          <span>{Math.floor(props.query.offset / props.query.limit) + 1}</span>
          <button
            type="button"
            disabled={
              !props.page ||
              props.query.offset + props.query.limit >= props.page.total
            }
            onClick={() =>
              props.changed({
                ...props.query,
                offset: props.query.offset + props.query.limit
              })
            }
          >
            {uiMessage('ui.weiter')}
          </button>
        </div>
      </footer>
    </section>
  )
}

export function CreatureCollectionSelection(props: {
  label: string
  value: string | null
  emptyLabel: string
  newLabel?: string
  choices: readonly { id: string; label: string }[]
  changed: (value: string | null) => void
}) {
  return (
    <div className="group-selection-row">
      <label>
        {props.label}
        <select
          aria-label={`${props.label} auswählen`}
          value={props.value ?? ''}
          onChange={(event) => props.changed(event.target.value || null)}
        >
          <option value="">{props.emptyLabel}</option>
          {props.newLabel && <option value="new">{props.newLabel}</option>}
          {props.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      {props.newLabel && (
        <button type="button" onClick={() => props.changed('new')}>
          {props.newLabel}
        </button>
      )}
    </div>
  )
}

export function GroupDialog(props: {
  snapshot: LiveSessionSnapshot
  group: SceneGroup | null
  close: () => void
  saved: (snapshot: LiveSessionSnapshot) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  reinforcementMode: boolean
}) {
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
    message: ''
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
    message
  } = draft
  const setName = (update: string) => dispatchDraft({ kind: 'name', update })
  const setNote = (update: string) => dispatchDraft({ kind: 'note', update })
  const setDisposition = (update: SceneGroupDisposition) =>
    dispatchDraft({ kind: 'disposition', update })
  const setQuantities = (
    update:
      | Record<string, number>
      | ((current: Record<string, number>) => Record<string, number>)
  ) => dispatchDraft({ kind: 'quantities', update })
  const setDeadQuantities = (
    update:
      | Record<string, number>
      | ((current: Record<string, number>) => Record<string, number>)
  ) => dispatchDraft({ kind: 'dead-quantities', update })
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
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    locationId: focused.locationId,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [tuning, setTuning] = useState<EncounterTuning>({
    difficulty: 'auto',
    amount: 'auto',
    balance: 'auto',
    diversity: 'auto'
  })
  const [pending, setPending] = useState<GroupDraftAction | null>(null)
  const [busy, setBusy] = useState(false)
  const drafts = useRef(new Map<string, GroupDraftState>())
  const evaluationRequest = useRef(0)
  const factsRequest = useRef(0)
  const entries = useMemo(
    () => groupDraftEntries(quantities, deadQuantities),
    [deadQuantities, quantities]
  )
  const creatureCount = entries.reduce(
    (total, entry) => total + entry.quantity,
    0
  )
  const active = selection !== null
  const dirty =
    active &&
    groupDraftSignature(name, note, disposition, quantities, deadQuantities) !==
      baseline
  const assigned = props.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const canGenerate =
    active &&
    assigned.length > 0 &&
    assigned.every((member) => member.level !== null)
  useCreatureSearch(query, setPage, props.onError)
  useEffect(() => {
    void sessionCapabilities()
      .creatures.filterOptions()
      .then(setOptions)
      .catch(reportCapabilityError(props.onError))
  }, [props.onError])

  useEffect(() => {
    if (!active) return
    const token = ++evaluationRequest.current
    const timer = window.setTimeout(() => {
      void sessionCapabilities()
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
  }, [active, entries, focused.id, props.snapshot.scene.revision])

  useEffect(() => {
    if (!selection) return
    const group = focused.groups.find((candidate) => candidate.id === selection)
    if (!group) return
    const token = ++factsRequest.current
    void Promise.all(
      group.entries.map((entry) =>
        sessionCapabilities()
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
  }, [focused.groups, selection])

  function load(nextSelection: string | null) {
    cacheCurrentDraft()
    const cached = nextSelection ? drafts.current.get(nextSelection) : null
    if (cached) {
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
        seed: 0
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
      message
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
    if (dirty || hasDirtyDrafts()) setPending(action)
    else perform(action)
  }

  function addCreature(creature: Creature) {
    if (!active) return
    setQuantities((current) => ({
      ...current,
      [creature.id]: Math.min(999, (current[creature.id] ?? 0) + 1)
    }))
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
    const update = kind === 'alive' ? setQuantities : setDeadQuantities
    update((current) => {
      const quantity = Math.max(
        0,
        Math.min(999, (current[creatureId] ?? 0) + delta)
      )
      const next = { ...current }
      if (quantity === 0) delete next[creatureId]
      else next[creatureId] = quantity
      return next
    })
  }

  async function inspect(creature: Creature) {
    try {
      props.inspect(await sessionCapabilities().creatures.detail(creature.id))
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    }
  }

  async function generate(mode: 'fill' | 'replace') {
    if (!canGenerate) return
    const nextSeed = seed + 1
    setBusy(true)
    try {
      const result = await sessionCapabilities().scene.generateGroupDraft(
        focused.id,
        entries,
        mode,
        query,
        tuning,
        nextSeed,
        props.snapshot.scene.revision
      )
      setQuantities(
        Object.fromEntries(
          result.entries.map((entry) => [entry.creatureId, entry.quantity])
        )
      )
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
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!active || !name.trim()) {
      setMessage(uiMessage('group.validation.name'))
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
          await sessionCapabilities().scene.saveGroup(
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

  async function archive() {
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
          await sessionCapabilities().scene.setGroupArchived(
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

  async function joinCombat() {
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
          await encounterCapabilities().combat.joinGroup(
            focused.id,
            selection,
            currentGroup.revision,
            props.snapshot.combat.revision
          )
        )
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalDialog
      className="group-dialog group-builder-dialog"
      labelledBy="group-builder-title"
      onClose={() => request({ kind: 'close' })}
      busy={busy}
    >
      <header>
        <div className="builder-title-block">
          <div className="title-group">
            <span className="illuminated-initial" aria-hidden="true">
              {uiMessage('ui.gruppen.managen').charAt(0)}
            </span>
            <h2 id="group-builder-title">
              {uiMessage('ui.gruppen.managen').slice(1)}
            </h2>
          </div>
          <p className="scene-crumb">{focused.title}</p>
        </div>
        <button
          className="close"
          type="button"
          aria-label={uiMessage('ui.dialog.schliessen')}
          onClick={() => request({ kind: 'close' })}
        >
          ×
        </button>
      </header>
      <div className="group-builder-layout">
        <CreatureCollectionCatalogPane
          query={query}
          options={{ ...options, locations: [] }}
          page={page}
          changed={setQuery}
          add={addCreature}
          inspect={(creature) => void inspect(creature)}
          quantities={Object.fromEntries(
            Array.from(
              new Set([
                ...Object.keys(quantities),
                ...Object.keys(deadQuantities)
              ])
            ).map((id) => [
              id,
              (quantities[id] ?? 0) + (deadQuantities[id] ?? 0)
            ])
          )}
        />
        <div className="builder-seam" aria-hidden="true" />
        <section
          className="group-draft-pane"
          aria-label={uiMessage('ui.aktuelle.gruppe')}
        >
          <div className="group-identity">
            <CreatureCollectionSelection
              label="Gruppe"
              value={selection}
              emptyLabel="Gruppe auswählen …"
              newLabel={uiMessage('group.createTitle')}
              choices={activeGroups.map((group) => ({
                id: group.id,
                label: `${group.name}${
                  props.snapshot.combat?.selectedGroupIds.includes(group.id)
                    ? ` · ${uiMessage('encounter.inCombat')}`
                    : ''
                }`
              }))}
              changed={(nextSelection) =>
                request({ kind: 'select', selection: nextSelection })
              }
            />
            {active && (
              <>
                <label>
                  {uiMessage('ui.gruppenname')}
                  <input
                    className="group-name"
                    autoFocus
                    aria-label={uiMessage('ui.gruppenname')}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <DispositionSelect
                  value={disposition}
                  changed={setDisposition}
                />
                <label className="group-note-field">
                  {uiMessage('group.note')}
                  <textarea
                    aria-label={uiMessage('group.note')}
                    maxLength={1000}
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          {!active ? (
            <p className="empty-state">
              {uiMessage('ui.waehle.eine.gruppe.aus.oder.lege.eine.neue')}
            </p>
          ) : (
            <>
              <section className="group-draft-sheet">
                <header>
                  <h3>{uiMessage('ui.entwurf')}</h3>
                  <span className="draft-meta">
                    {creatureCount} {uiMessage('ui.wesen')}
                    {evaluation
                      ? ` · ${evaluation.baseXp.toLocaleString()} XP`
                      : ''}
                  </span>
                  {entries.length > 0 && (
                    <button
                      className="clear-draft"
                      type="button"
                      onClick={() => setQuantities({})}
                    >
                      {uiMessage('ui.leeren')}
                    </button>
                  )}
                </header>
                <ul className="group-draft-roster">
                  {entries.map((entry) => {
                    const fact = facts[entry.creatureId]
                    return (
                      <li
                        key={entry.creatureId}
                        className={
                          fact?.available === false ? 'unavailable' : ''
                        }
                      >
                        <span>
                          <strong>
                            {fact?.displayName ?? entry.creatureId}
                          </strong>
                          <small>
                            {uiMessage('ui.cr')} {fact?.cr ?? '—'} ·{' '}
                            {(fact?.xp ?? 0).toLocaleString()}{' '}
                            {uiMessage('ui.xp.2')}
                          </small>
                        </span>
                        <div className="roster-quantity roster-life-count">
                          <small>{uiMessage('group.alive')}</small>
                          <button
                            aria-label={`Anzahl ${fact?.displayName ?? entry.creatureId} verringern`}
                            onClick={() => changeQuantity(entry.creatureId, -1)}
                          >
                            −
                          </button>
                          <strong>{entry.quantity}</strong>
                          <button
                            aria-label={`Anzahl ${fact?.displayName ?? entry.creatureId} erhöhen`}
                            onClick={() => changeQuantity(entry.creatureId, 1)}
                          >
                            +
                          </button>
                        </div>
                        <div className="roster-quantity roster-dead-count">
                          <small>{uiMessage('group.dead')}</small>
                          <button
                            aria-label={`Tote ${fact?.displayName ?? entry.creatureId} verringern`}
                            onClick={() =>
                              changeQuantity(entry.creatureId, -1, 'dead')
                            }
                          >
                            −
                          </button>
                          <strong>{entry.deadQuantity}</strong>
                          <button
                            aria-label={`Tote ${fact?.displayName ?? entry.creatureId} erhöhen`}
                            onClick={() =>
                              changeQuantity(entry.creatureId, 1, 'dead')
                            }
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="remove"
                          aria-label={`${fact?.displayName ?? entry.creatureId} entfernen`}
                          onClick={() => {
                            changeQuantity(
                              entry.creatureId,
                              -entry.quantity,
                              'alive'
                            )
                            changeQuantity(
                              entry.creatureId,
                              -entry.deadQuantity,
                              'dead'
                            )
                          }}
                        >
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {entries.length === 0 && (
                  <p className="draft-empty">
                    {uiMessage('ui.monster.links.mit')} <strong>+</strong>{' '}
                    {uiMessage('ui.hinzufuegen.oder.eine.gruppe.generieren')}
                  </p>
                )}
              </section>
              <TuningControls tuning={tuning} changed={setTuning} />
              <div className="group-generator-actions">
                <button
                  disabled={busy || !canGenerate}
                  onClick={() => void generate('fill')}
                >
                  {uiMessage('ui.auffuellen')}
                </button>
                <button
                  disabled={busy || !canGenerate}
                  onClick={() => void generate('replace')}
                >
                  {uiMessage('ui.neu.generieren')}
                </button>
              </div>
              {!canGenerate && (
                <small className="muted">
                  {uiMessage(
                    'ui.zum.generieren.braucht.die.scene.eine.zugewiesene.party'
                  )}
                </small>
              )}
              {evaluation && (
                <DifficultySummary evaluation={evaluation} meter />
              )}
            </>
          )}
          {pending && (
            <div className="confirm-row group-draft-confirm" role="alert">
              <span>
                {uiMessage('ui.ungespeicherte.aenderungen.verwerfen')}
              </span>
              <button onClick={() => setPending(null)}>
                {uiMessage('action.cancel')}
              </button>
              <button className="danger" onClick={() => perform(pending)}>
                {uiMessage('ui.aenderungen.verwerfen')}
              </button>
            </div>
          )}
          {message && (
            <p className="generator-status" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
      <footer className="group-builder-footer">
        <span className="muted">
          {focused.locationName || uiMessage('ui.kein.ort.gesetzt')} ·{' '}
          {assigned.length} {uiMessage('ui.zugewiesene.pcs')}
        </span>
        <div>
          {props.reinforcementMode &&
            props.snapshot.combat?.phase === 'combat' &&
            selection &&
            selection !== newGroupDraftKey &&
            !props.snapshot.combat.selectedGroupIds.includes(selection) && (
              <button
                type="button"
                disabled={busy || dirty}
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
            disabled={busy || !active || !name.trim()}
            onClick={() => void save()}
          >
            {uiMessage('action.save')}
          </button>
        </div>
      </footer>
    </ModalDialog>
  )
}
