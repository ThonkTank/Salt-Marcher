import { formatMessage, message as uiMessage } from '../../i18n/messages.de.js'
import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../../shared/contracts/encounter-tuning.js'
import type {
  SceneGroup,
  SceneGroupDisposition,
  SceneGroupDraftEvaluation
} from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { SessionHexMap, TravelScenario } from '../hex/hex-workspaces.js'
import { SessionEncounterPanel } from '../encounter/encounter-panels.js'
import {
  DifficultySummary,
  TuningControls
} from '../encounter/encounter-tuning.js'
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
import { CreatureInspector } from '../catalog/creature-inspector.js'
import './session.css'
import { sessionCapabilities } from './session-capabilities.js'
import { useSessionDetailHistory } from './use-session-detail-history.js'
import { SessionPanelLayout } from './session-panel-layout.js'
import { SessionGroupCard } from './session-group-card.js'
import { ScenePartyCard } from './scene-party-card.js'
import {
  creatureFact,
  groupDraftEntries,
  groupDraftSignature,
  newGroupDraftKey,
  type DraftCreatureFact,
  type GroupDraftAction,
  type GroupDraftState
} from './group-draft.js'

export default function SessionWorkspace(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  groupDialogOpen: boolean
  setGroupDialogOpen: (open: boolean) => void
  scenario: '' | 'encounter' | 'travel'
  setScenario: (scenario: '' | 'encounter' | 'travel') => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  onError: (message: string) => void
}) {
  const [editingGroup, setEditingGroup] = useState<SceneGroup | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [catalogQuery, setCatalogQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [catalogPage, setCatalogPage] = useState<CreatureCatalogPage | null>(
    null
  )
  const [catalogOptions, setCatalogOptions] = useState(emptyCreatureOptions)
  const followedCombatCard = useRef<string | null>(null)
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const { history, detail, breadcrumb, openDetail, moveHistory, closeDetail } =
    useSessionDetailHistory(focused.id)

  useCreatureSearch(catalogQuery, setCatalogPage, props.onError)
  useEffect(() => {
    void sessionCapabilities()
      .creatures.filterOptions()
      .then(setCatalogOptions)
      .catch(reportCapabilityError(props.onError))
  }, [props.onError])

  async function openCreature(creatureId: string, context: string) {
    try {
      const creature = await sessionCapabilities().creatures.detail(creatureId)
      openDetail(creature, `${context} › ${creature.name}`)
      props.setLayout({ ...props.layout, centerTab: 'details' })
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  const activeCombatCard = props.snapshot.combat?.cards.find(
    (card) => card.active && !card.playerCharacter && card.creatureId
  )
  useEffect(() => {
    if (!activeCombatCard?.creatureId) {
      followedCombatCard.current = null
      return
    }
    if (followedCombatCard.current === activeCombatCard.id) return
    followedCombatCard.current = activeCombatCard.id
    const group = focused.groups.find((candidate) =>
      candidate.entries.some(
        (entry) => entry.creatureId === activeCombatCard.creatureId
      )
    )
    void openCreature(activeCombatCard.creatureId, group?.name ?? 'Encounter')
    // The active card identity deliberately controls this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCombatCard?.id, activeCombatCard?.creatureId])

  const control = (
    <section
      className="session-control-panel"
      aria-label={uiMessage('ui.session.steuerung')}
    >
      <div className="panel-heading">
        <h2>{uiMessage('ui.session.steuerung')}</h2>
        <button
          onClick={() => {
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
        >
          {uiMessage('ui.gruppen.managen')}
        </button>
      </div>
      <label>
        {uiMessage('ui.aktive.szene')}
        <select
          aria-label={uiMessage('ui.aktive.szene')}
          value={focused.id}
          disabled={props.snapshot.scene.scenes.length < 2}
          onChange={(event) =>
            void scenarioAction(props, () =>
              sessionCapabilities().scene.focus(
                event.target.value,
                props.snapshot.scene.revision
              )
            )
          }
        >
          {props.snapshot.scene.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        {uiMessage('ui.ort')}
        <select
          aria-label={uiMessage('ui.scene.ort')}
          value={focused.locationId ?? ''}
          onChange={(event) =>
            void scenarioAction(props, () =>
              sessionCapabilities().scene.setLocation(
                focused.id,
                event.target.value || null,
                props.snapshot.scene.revision
              )
            )
          }
        >
          <option value="">{uiMessage('ui.kein.ort')}</option>
          {focused.locationId &&
            !props.snapshot.scene.locationChoices.some(
              (location) => location.id === focused.locationId
            ) && (
              <option value={focused.locationId}>
                {uiMessage('ui.nicht.verfuegbarer.ort')}
              </option>
            )}
          {props.snapshot.scene.locationChoices.map((location) => (
            <option key={location.id} value={location.id}>
              {location.displayName}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-hint">
        {props.snapshot.scene.scenes.length > 1
          ? uiMessage('session.independentHint')
          : uiMessage('session.additionalHint')}
      </p>
    </section>
  )

  const groups = (
    <section className="session-groups" aria-label={uiMessage('ui.gruppen')}>
      <div className="groups-heading">
        <h2>{uiMessage('ui.gruppen')}</h2>
      </div>
      <ScenePartyCard
        snapshot={props.snapshot}
        sceneId={focused.id}
        setSnapshot={props.setSnapshot}
        onError={props.onError}
      />
      {focused.groups
        .filter((group) => !group.archived)
        .map((group) => (
          <SessionGroupCard
            key={group.id}
            group={group}
            inspect={(creatureId) => void openCreature(creatureId, group.name)}
            edit={() => {
              setEditingGroup(group)
              props.setGroupDialogOpen(true)
            }}
          />
        ))}
      {focused.groups.some((group) => group.archived) && (
        <div className="inactive-groups">
          <h3>{uiMessage('group.inactive')}</h3>
          {focused.groups
            .filter((group) => group.archived)
            .map((group) => (
              <SessionGroupCard
                key={group.id}
                group={group}
                inspect={(creatureId) =>
                  void openCreature(creatureId, group.name)
                }
                restore={() =>
                  void scenarioAction(props, () =>
                    sessionCapabilities().scene.setGroupArchived(
                      focused.id,
                      group.id,
                      false,
                      props.snapshot.scene.revision
                    )
                  )
                }
                deleteRequested={() => setDeleteGroupId(group.id)}
                deleteConfirming={deleteGroupId === group.id}
                cancelDelete={() => setDeleteGroupId(null)}
                deleteGroup={() => {
                  setDeleteGroupId(null)
                  void scenarioAction(props, () =>
                    sessionCapabilities().scene.deleteGroup(
                      focused.id,
                      group.id,
                      props.snapshot.scene.revision
                    )
                  )
                }}
              />
            ))}
        </div>
      )}
    </section>
  )

  const details = (
    <section
      className="session-detail-panel"
      aria-label={uiMessage('ui.detailansicht')}
    >
      <div className="session-panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={props.layout.centerTab === 'details'}
          onClick={() =>
            props.setLayout({ ...props.layout, centerTab: 'details' })
          }
        >
          {uiMessage('ui.detail')}
        </button>
        <button
          role="tab"
          aria-selected={props.layout.centerTab === 'catalog'}
          onClick={() =>
            props.setLayout({ ...props.layout, centerTab: 'catalog' })
          }
        >
          {uiMessage('nav.catalog')}
        </button>
        <button
          role="tab"
          aria-selected={props.layout.centerTab === 'map'}
          onClick={() => props.setLayout({ ...props.layout, centerTab: 'map' })}
        >
          {uiMessage('ui.karte')}
        </button>
      </div>
      {props.layout.centerTab === 'map' ? (
        <SessionHexMap
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          onError={props.onError}
        />
      ) : props.layout.centerTab === 'catalog' ? (
        <CreatureCollectionCatalogPane
          query={catalogQuery}
          options={catalogOptions}
          page={catalogPage}
          changed={setCatalogQuery}
          inspect={(creature) => void openCreature(creature.id, 'Katalog')}
          variant="inspector"
        />
      ) : (
        <>
          <nav
            className="detail-history"
            aria-label={uiMessage('ui.detail.verlauf')}
          >
            <button
              aria-label={uiMessage('ui.zurueck')}
              disabled={history.index <= 0}
              onClick={() => moveHistory(-1)}
            >
              ‹
            </button>
            <button
              aria-label={uiMessage('ui.vor')}
              disabled={history.index >= history.entries.length - 1}
              onClick={() => moveHistory(1)}
            >
              ›
            </button>
            <span>{breadcrumb ?? (focused.locationName || focused.title)}</span>
            <button
              className="detail-close"
              aria-label={uiMessage('ui.detail.schliessen')}
              disabled={!detail}
              onClick={closeDetail}
            >
              ×
            </button>
          </nav>
          <div
            className="detail-scroll"
            tabIndex={0}
            aria-label={uiMessage('ui.detailansicht')}
          >
            {detail ? (
              <CreatureInspector creature={detail} embedded />
            ) : (
              <div className="detail-empty">
                <p className="section-kicker">{focused.title}</p>
                <h2>{focused.locationName || 'Keine Detailauswahl'}</h2>
                <p>
                  {uiMessage(
                    'ui.waehle.ein.monster.aus.einer.gruppe.oder.spaeter'
                  )}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )

  const scenarioPanel = (
    <aside
      className="scenario-panel"
      aria-label={uiMessage('ui.szenario.panel')}
    >
      <header>
        <select
          aria-label={uiMessage('ui.szenario.auswahl')}
          value={props.scenario}
          onChange={(event) =>
            props.setScenario(event.target.value as '' | 'encounter' | 'travel')
          }
        >
          <option value="">{uiMessage('ui.szenario.auswaehlen')}</option>
          <option value="encounter">{uiMessage('ui.encounter')}</option>
          <option value="travel">{uiMessage('ui.reise')}</option>
        </select>
      </header>
      {!props.scenario ? (
        <div className="scenario-empty">{uiMessage('ui.szenario.panel')}</div>
      ) : props.scenario === 'travel' ? (
        <TravelScenario
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          openMap={() => props.setLayout({ ...props.layout, centerTab: 'map' })}
          onError={props.onError}
        />
      ) : (
        <SessionEncounterPanel
          {...props}
          inspect={(creature) => {
            openDetail(creature, `Encounter › ${creature.name}`)
            props.setLayout({ ...props.layout, centerTab: 'details' })
          }}
          close={() => props.setScenario('')}
          manageGroups={() => {
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
        />
      )}
    </aside>
  )

  return (
    <section
      className="session-mockup"
      aria-label={uiMessage('ui.session.workspace')}
    >
      <div className="session-layout">
        <SessionPanelLayout
          preference={props.layout}
          changed={props.setLayout}
          control={control}
          groups={groups}
          details={details}
          scenario={scenarioPanel}
        />
      </div>
      {props.groupDialogOpen && (
        <GroupDialog
          snapshot={props.snapshot}
          group={editingGroup}
          close={() => props.setGroupDialogOpen(false)}
          saved={(snapshot) => {
            props.setSnapshot(snapshot)
            props.setGroupDialogOpen(false)
          }}
          inspect={(creature) => {
            openDetail(creature, `Katalog › ${creature.name}`)
            props.setLayout({ ...props.layout, centerTab: 'details' })
          }}
          onError={props.onError}
        />
      )}
    </section>
  )
}

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

function GroupDialog(props: {
  snapshot: LiveSessionSnapshot
  group: SceneGroup | null
  close: () => void
  saved: (snapshot: LiveSessionSnapshot) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
}) {
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const activeGroups = focused.groups.filter((group) => !group.archived)
  const initialQuantities = Object.fromEntries(
    props.group?.entries.map((entry) => [entry.creatureId, entry.quantity]) ??
      []
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
  const [name, setName] = useState(props.group?.name ?? '')
  const [note, setNote] = useState(props.group?.note ?? '')
  const [disposition, setDisposition] = useState<SceneGroupDisposition>(
    props.group?.disposition ?? 'hostile'
  )
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    locationId: focused.locationId,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [quantities, setQuantities] =
    useState<Record<string, number>>(initialQuantities)
  const [facts, setFacts] =
    useState<Record<string, DraftCreatureFact>>(initialFacts)
  const [tuning, setTuning] = useState<EncounterTuning>({
    difficulty: 'auto',
    amount: 'auto',
    balance: 'auto',
    diversity: 'auto'
  })
  const [evaluation, setEvaluation] =
    useState<SceneGroupDraftEvaluation | null>(null)
  const [baseline, setBaseline] = useState(() =>
    groupDraftSignature(
      props.group?.name ?? '',
      props.group?.note ?? '',
      props.group?.disposition ?? 'hostile',
      initialQuantities
    )
  )
  const [pending, setPending] = useState<GroupDraftAction | null>(null)
  const [seed, setSeed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const drafts = useRef(new Map<string, GroupDraftState>())
  const evaluationRequest = useRef(0)
  const factsRequest = useRef(0)
  const entries = useMemo(() => groupDraftEntries(quantities), [quantities])
  const creatureCount = entries.reduce(
    (total, entry) => total + entry.quantity,
    0
  )
  const active = selection !== null
  const dirty =
    active &&
    groupDraftSignature(name, note, disposition, quantities) !== baseline
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
          if (evaluationRequest.current === token) setEvaluation(next)
        })
        .catch((cause) => {
          if (evaluationRequest.current === token)
            setMessage(capabilityErrorText(cause))
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
      setFacts((current) => {
        const next = { ...current }
        for (const creature of creatures)
          if (creature) next[creature.id] = creatureFact(creature)
        return next
      })
    })
  }, [focused.groups, selection])

  function load(nextSelection: string | null) {
    cacheCurrentDraft()
    const cached = nextSelection ? drafts.current.get(nextSelection) : null
    if (cached) {
      setSelection(nextSelection)
      setName(cached.name)
      setNote(cached.note)
      setDisposition(cached.disposition)
      setQuantities(cached.quantities)
      setFacts(cached.facts)
      setBaseline(cached.baseline)
      setEvaluation(cached.evaluation)
      setMessage(cached.message)
      setSeed(cached.seed)
      return
    }
    const group = nextSelection
      ? focused.groups.find((candidate) => candidate.id === nextSelection)
      : undefined
    const nextName = group?.name ?? ''
    const nextNote = group?.note ?? ''
    const nextDisposition = group?.disposition ?? 'hostile'
    const nextQuantities = Object.fromEntries(
      group?.entries.map((entry) => [entry.creatureId, entry.quantity]) ?? []
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
    setName(nextName)
    setNote(nextNote)
    setDisposition(nextDisposition)
    setQuantities(nextQuantities)
    setFacts(nextFacts)
    setBaseline(
      groupDraftSignature(nextName, nextNote, nextDisposition, nextQuantities)
    )
    setEvaluation(null)
    setMessage('')
    setSeed(0)
  }

  function cacheCurrentDraft() {
    if (!selection) return
    drafts.current.set(selection, {
      name,
      note,
      disposition,
      quantities,
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
          draft.quantities
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

  function changeQuantity(creatureId: string, delta: number) {
    setQuantities((current) => {
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
      setMessage('Ein Gruppenname ist erforderlich.')
      return
    }
    if (
      entries.length > 0 &&
      !entries.some((entry) => facts[entry.creatureId]?.available === true)
    ) {
      setMessage('Mindestens ein verfügbares Monster ist erforderlich.')
      return
    }
    setBusy(true)
    try {
      props.saved(
        await sessionCapabilities().scene.saveGroup(
          focused.id,
          selection === newGroupDraftKey ? null : selection,
          name.trim(),
          note.trim(),
          disposition,
          entries,
          props.snapshot.scene.revision
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
      props.saved(
        await sessionCapabilities().scene.setGroupArchived(
          focused.id,
          selection,
          true,
          props.snapshot.scene.revision
        )
      )
    } catch (cause) {
      setMessage(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="group-dialog group-builder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-builder-title"
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
            quantities={quantities}
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
                  label: group.name
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
                          <div className="roster-quantity">
                            <button
                              aria-label={`Anzahl ${fact?.displayName ?? entry.creatureId} verringern`}
                              onClick={() =>
                                changeQuantity(entry.creatureId, -1)
                              }
                            >
                              −
                            </button>
                            <strong>{entry.quantity}</strong>
                            <button
                              aria-label={`Anzahl ${fact?.displayName ?? entry.creatureId} erhöhen`}
                              onClick={() =>
                                changeQuantity(entry.creatureId, 1)
                              }
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="remove"
                            aria-label={`${fact?.displayName ?? entry.creatureId} entfernen`}
                            onClick={() =>
                              changeQuantity(entry.creatureId, -entry.quantity)
                            }
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
      </section>
    </div>
  )
}

async function scenarioAction(
  props: {
    setSnapshot: (snapshot: LiveSessionSnapshot) => void
    onError: (message: string) => void
  },
  operation: () => Promise<LiveSessionSnapshot>
): Promise<void> {
  try {
    props.setSnapshot(await operation())
  } catch (cause) {
    props.onError(capabilityErrorText(cause))
  }
}
