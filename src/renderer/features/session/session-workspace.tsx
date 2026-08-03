import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
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
  SceneGroupDraftEvaluation
} from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { SessionHexMap, TravelScenario } from '../hex/hex-workspaces.js'
import {
  DifficultySummary,
  SessionEncounterPanel,
  TuningControls
} from '../encounter/encounter-panels.js'
import { CreatureFilters, FilterChips } from '../catalog/catalog-controls.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  errorText,
  showError,
  useCreatureSearch
} from '../catalog/catalog-state.js'
import { CreatureInspector } from '../catalog/creature-inspector.js'
import './session.css'

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
  const [detailHistories, setDetailHistories] = useState<
    Record<string, { entries: Creature[]; index: number }>
  >({})
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!

  const history = detailHistories[focused.id] ?? { entries: [], index: -1 }
  const detail = history.entries[history.index] ?? null
  const openDetail = (creature: Creature) =>
    setDetailHistories((current) => {
      const previous = current[focused.id] ?? { entries: [], index: -1 }
      if (previous.entries[previous.index]?.id === creature.id) return current
      const entries = [
        ...previous.entries.slice(0, previous.index + 1),
        creature
      ]
      return {
        ...current,
        [focused.id]: { entries, index: entries.length - 1 }
      }
    })
  const moveHistory = (offset: number) =>
    setDetailHistories((current) => {
      const previous = current[focused.id] ?? { entries: [], index: -1 }
      return {
        ...current,
        [focused.id]: {
          ...previous,
          index: Math.max(
            -1,
            Math.min(previous.entries.length - 1, previous.index + offset)
          )
        }
      }
    })

  const control = (
    <section className="session-control-panel" aria-label="Session Steuerung">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Session</p>
          <h2>Steuerung</h2>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
        >
          Gruppen managen
        </button>
      </div>
      <label>
        Aktive Szene
        <select
          aria-label="Aktive Szene"
          value={focused.id}
          disabled={props.snapshot.scene.scenes.length < 2}
          onChange={(event) =>
            void scenarioAction(props, () =>
              window.saltMarcher.scene.focus(
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
        Ort
        <select
          aria-label="Scene-Ort"
          value={focused.locationId ?? ''}
          onChange={(event) =>
            void scenarioAction(props, () =>
              window.saltMarcher.scene.setLocation(
                focused.id,
                event.target.value || null,
                props.snapshot.scene.revision
              )
            )
          }
        >
          <option value="">Kein Ort</option>
          {focused.locationId &&
            !props.snapshot.scene.locationChoices.some(
              (location) => location.id === focused.locationId
            ) && (
              <option value={focused.locationId}>Nicht verfügbarer Ort</option>
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
          ? 'Szenen führen Gruppen, Details und Combat unabhängig.'
          : 'Weitere simultane Szenen erscheinen automatisch in der Auswahl.'}
      </p>
    </section>
  )

  const groups = (
    <section className="session-groups" aria-label="Gruppen">
      <div className="groups-heading">
        <h2>Gruppen</h2>
      </div>
      <PartyGroup
        snapshot={props.snapshot}
        sceneId={focused.id}
        setSnapshot={props.setSnapshot}
        onError={props.onError}
      />
      {focused.groups.map((group) => (
        <article className="group-card" key={group.id}>
          <div className="group-card-title">
            <strong>{group.name}</strong>
            <div className="row-actions">
              <button
                onClick={() => {
                  setEditingGroup(group)
                  props.setGroupDialogOpen(true)
                }}
              >
                Bearbeiten
              </button>
              <button
                className="danger"
                onClick={() =>
                  void scenarioAction(props, () =>
                    window.saltMarcher.scene.deleteGroup(
                      focused.id,
                      group.id,
                      props.snapshot.scene.revision
                    )
                  )
                }
              >
                Löschen
              </button>
            </div>
          </div>
          <div className="group-members">
            {group.entries.map((entry) => (
              <button
                key={entry.id}
                className={entry.available ? '' : 'unavailable'}
                disabled={!entry.available}
                onClick={() =>
                  void window.saltMarcher.creatures
                    .detail(entry.creatureId)
                    .then(openDetail)
                    .catch(showError(props.onError))
                }
              >
                {entry.displayName} × {entry.quantity}
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  )

  const details = (
    <section className="session-detail-panel" aria-label="Detailansicht">
      <div className="session-panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={props.layout.upperRightTab === 'details'}
          onClick={() =>
            props.setLayout({ ...props.layout, upperRightTab: 'details' })
          }
        >
          Details
        </button>
        <button
          role="tab"
          aria-selected={props.layout.upperRightTab === 'map'}
          onClick={() =>
            props.setLayout({ ...props.layout, upperRightTab: 'map' })
          }
        >
          Karte
        </button>
      </div>
      {props.layout.upperRightTab === 'map' ? (
        <SessionHexMap
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          onError={props.onError}
        />
      ) : (
        <>
          <nav className="detail-history" aria-label="Detail Verlauf">
            <button
              aria-label="Zurück"
              disabled={history.index <= 0}
              onClick={() => moveHistory(-1)}
            >
              ←
            </button>
            <button
              aria-label="Vor"
              disabled={history.index >= history.entries.length - 1}
              onClick={() => moveHistory(1)}
            >
              →
            </button>
            <button
              aria-label="Detail schließen"
              disabled={!detail}
              onClick={() =>
                setDetailHistories((current) => ({
                  ...current,
                  [focused.id]: { entries: [], index: -1 }
                }))
              }
            >
              ×
            </button>
            <span>
              {detail?.name ?? (focused.locationName || focused.title)}
            </span>
          </nav>
          <div className="detail-scroll">
            {detail ? (
              <CreatureInspector creature={detail} embedded />
            ) : (
              <div className="detail-empty">
                <p className="section-kicker">{focused.title}</p>
                <h2>{focused.locationName || 'Keine Detailauswahl'}</h2>
                <p>
                  Wähle ein Monster aus einer Gruppe oder später einen Ort bzw.
                  ein anderes beschriebenes Szenenobjekt aus.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )

  const scenarioPanel = (
    <aside className="scenario-panel" aria-label="Szenario Panel">
      <select
        aria-label="Szenario Auswahl"
        value={props.scenario}
        onChange={(event) =>
          props.setScenario(event.target.value as '' | 'encounter' | 'travel')
        }
      >
        <option value="">Szenario auswählen …</option>
        <option value="encounter">Encounter</option>
        <option value="travel">Reise</option>
      </select>
      {!props.scenario ? (
        <div className="scenario-empty">Szenario Panel</div>
      ) : props.scenario === 'travel' ? (
        <TravelScenario
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          openMap={() =>
            props.setLayout({ ...props.layout, upperRightTab: 'map' })
          }
          onError={props.onError}
        />
      ) : (
        <SessionEncounterPanel
          {...props}
          inspect={openDetail}
          close={() => props.setScenario('')}
        />
      )}
    </aside>
  )

  return (
    <section className="session-mockup" aria-label="Session workspace">
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
          inspect={openDetail}
          onError={props.onError}
        />
      )}
    </section>
  )
}

function SessionPanelLayout(props: {
  preference: SessionLayoutPreference
  changed: (preference: SessionLayoutPreference) => void
  control: ReactNode
  groups: ReactNode
  details: ReactNode
  scenario: ReactNode
}) {
  const p = props.preference
  return (
    <div className="session-workspace">
      <div
        className="session-column session-left-column"
        style={{ flexBasis: `${p.leftFraction * 100}%` }}
      >
        <div className="session-control-pane">{props.control}</div>
        <div className="session-pane">{props.groups}</div>
      </div>
      <SessionDivider
        axis="vertical"
        value={p.leftFraction}
        changed={(leftFraction) => props.changed({ ...p, leftFraction })}
        label="Gekoppelte Grenze zwischen linker und rechter Spalte"
      />
      <div className="session-column">
        <div
          className="session-pane"
          style={{ flexBasis: `${p.rightTopFraction * 100}%` }}
        >
          {props.details}
        </div>
        <SessionDivider
          axis="horizontal"
          value={p.rightTopFraction}
          changed={(rightTopFraction) =>
            props.changed({ ...p, rightTopFraction })
          }
          label="Grenze zwischen Details und Szenario"
        />
        <div className="session-pane">{props.scenario}</div>
      </div>
    </div>
  )
}

function SessionDivider(props: {
  axis: 'horizontal' | 'vertical'
  value: number
  changed: (value: number) => void
  label: string
}) {
  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const parent = event.currentTarget.parentElement
    if (!parent) return
    const bounds = parent.getBoundingClientRect()
    const update = (clientX: number, clientY: number) => {
      const raw =
        props.axis === 'vertical'
          ? (clientX - bounds.left) / bounds.width
          : (clientY - bounds.top) / bounds.height
      props.changed(Math.max(0.18, Math.min(0.82, raw)))
    }
    update(event.clientX, event.clientY)
    const move = (next: PointerEvent) => update(next.clientX, next.clientY)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }
  const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction =
      props.axis === 'vertical'
        ? event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : 0
        : event.key === 'ArrowUp'
          ? -1
          : event.key === 'ArrowDown'
            ? 1
            : 0
    if (!direction) return
    event.preventDefault()
    props.changed(
      Math.max(0.18, Math.min(0.82, props.value + direction * 0.02))
    )
  }
  return (
    <div
      className={`session-divider session-divider-${props.axis}`}
      role="separator"
      aria-label={props.label}
      aria-orientation={props.axis}
      aria-valuemin={18}
      aria-valuemax={82}
      aria-valuenow={Math.round(props.value * 100)}
      tabIndex={0}
      onPointerDown={resize}
      onKeyDown={keyboard}
    />
  )
}

function PartyGroup(props: {
  snapshot: LiveSessionSnapshot
  sceneId: string
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
}) {
  const active = props.snapshot.party.members.filter((member) => member.active)
  const scene = props.snapshot.scene.scenes.find(
    (entry) => entry.id === props.sceneId
  )!
  return (
    <article className="group-card party-group">
      <div className="group-card-title">
        <strong>Party</strong>
        <span>{scene.partyMemberIds.length} in dieser Scene</span>
      </div>
      <div className="group-members">
        {active.length === 0 ? (
          <span>Keine aktiven Mitglieder</span>
        ) : (
          active.map((member) => (
            <span key={member.id} className="scene-party-member">
              {member.name} · Lv {member.level ?? '—'}{' '}
              <button
                onClick={() =>
                  void scenarioAction(props, () =>
                    window.saltMarcher.scene.assignPartyMember(
                      props.sceneId,
                      member.id,
                      !scene.partyMemberIds.includes(member.id),
                      props.snapshot.scene.revision
                    )
                  )
                }
              >
                {scene.partyMemberIds.includes(member.id)
                  ? 'Entfernen'
                  : 'Zur Scene'}
              </button>
            </span>
          ))
        )}
      </div>
    </article>
  )
}

export function CreatureCollectionCatalogPane(props: {
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  page: CreatureCatalogPage | null
  changed: (query: CreatureCatalogQuery) => void
  add: (creature: Creature) => void
  inspect: (creature: Creature) => void
}) {
  return (
    <section className="group-catalog-pane" aria-label="Monsterkatalog">
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
              <th>Monster</th>
              <th>CR</th>
              <th>Typ</th>
              <th>XP</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {props.page?.rows.map((creature) => (
              <tr key={creature.id}>
                <td>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => props.inspect(creature)}
                  >
                    {creature.name}
                  </button>
                </td>
                <td>{creature.challengeRating}</td>
                <td>{creature.type}</td>
                <td>{creature.xp.toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    aria-label={`${creature.name} hinzufügen`}
                    onClick={() => props.add(creature)}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
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
            Zurück
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
            Weiter
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
  newLabel: string
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
          <option value="new">{props.newLabel}</option>
          {props.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => props.changed('new')}>
        {props.newLabel}
      </button>
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
    props.group?.id ?? null
  )
  const [name, setName] = useState(props.group?.name ?? '')
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
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
    groupDraftSignature(props.group?.name ?? '', initialQuantities)
  )
  const [pending, setPending] = useState<GroupDraftAction | null>(null)
  const [seed, setSeed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const evaluationRequest = useRef(0)
  const factsRequest = useRef(0)
  const entries = useMemo(() => groupDraftEntries(quantities), [quantities])
  const active = selection !== null
  const dirty = active && groupDraftSignature(name, quantities) !== baseline
  const assigned = props.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const canGenerate =
    active &&
    assigned.length > 0 &&
    assigned.every((member) => member.level !== null)
  const sourceQuery = useMemo(
    () => ({ ...query, locationId: focused.locationId }),
    [focused.locationId, query]
  )

  useCreatureSearch(sourceQuery, setPage, props.onError)
  useEffect(() => {
    void window.saltMarcher.creatures
      .filterOptions()
      .then(setOptions)
      .catch(showError(props.onError))
  }, [props.onError])

  useEffect(() => {
    if (!active) return
    const token = ++evaluationRequest.current
    const timer = window.setTimeout(() => {
      void window.saltMarcher.scene
        .evaluateGroupDraft(focused.id, entries, props.snapshot.scene.revision)
        .then((next) => {
          if (evaluationRequest.current === token) setEvaluation(next)
        })
        .catch((cause) => {
          if (evaluationRequest.current === token) setMessage(errorText(cause))
        })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [active, entries, focused.id, props.snapshot.scene.revision])

  useEffect(() => {
    if (!selection || selection === 'new') return
    const group = focused.groups.find((candidate) => candidate.id === selection)
    if (!group) return
    const token = ++factsRequest.current
    void Promise.all(
      group.entries.map((entry) =>
        window.saltMarcher.creatures.detail(entry.creatureId).catch(() => null)
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
    const group =
      nextSelection && nextSelection !== 'new'
        ? focused.groups.find((candidate) => candidate.id === nextSelection)
        : undefined
    const nextName = group?.name ?? ''
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
    setQuantities(nextQuantities)
    setFacts(nextFacts)
    setBaseline(groupDraftSignature(nextName, nextQuantities))
    setEvaluation(null)
    setMessage('')
    setSeed(0)
  }

  function perform(action: GroupDraftAction) {
    setPending(null)
    if (action.kind === 'close') props.close()
    else load(action.selection)
  }

  function request(action: GroupDraftAction) {
    if (dirty) setPending(action)
    else perform(action)
  }

  function addCreature(creature: Creature) {
    if (!active) {
      setSelection('new')
      setName('')
      setQuantities({ [creature.id]: 1 })
      setBaseline(groupDraftSignature('', {}))
    } else {
      setQuantities((current) => ({
        ...current,
        [creature.id]: Math.min(999, (current[creature.id] ?? 0) + 1)
      }))
    }
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
      props.inspect(await window.saltMarcher.creatures.detail(creature.id))
    } catch (cause) {
      setMessage(errorText(cause))
    }
  }

  async function generate(mode: 'fill' | 'replace') {
    if (!canGenerate) return
    const nextSeed = seed + 1
    setBusy(true)
    try {
      const result = await window.saltMarcher.scene.generateGroupDraft(
        focused.id,
        entries,
        mode,
        sourceQuery,
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
      setMessage(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!active || !name.trim() || entries.length === 0) {
      setMessage('Gruppenname und mindestens ein Monster sind erforderlich.')
      return
    }
    if (!entries.some((entry) => facts[entry.creatureId]?.available === true)) {
      setMessage('Mindestens ein verfügbares Monster ist erforderlich.')
      return
    }
    setBusy(true)
    try {
      props.saved(
        await window.saltMarcher.scene.saveGroup(
          focused.id,
          selection === 'new' ? null : selection,
          name.trim(),
          entries,
          props.snapshot.scene.revision
        )
      )
    } catch (cause) {
      setMessage(errorText(cause))
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
          <div>
            <p className="section-kicker">{focused.title}</p>
            <h2 id="group-builder-title">Gruppen managen</h2>
          </div>
          <button
            type="button"
            aria-label="Dialog schließen"
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
          />
          <section className="group-draft-pane" aria-label="Aktuelle Gruppe">
            <CreatureCollectionSelection
              label="Gruppe"
              value={selection}
              emptyLabel="Gruppe auswählen …"
              newLabel="Neue Gruppe"
              choices={focused.groups.map((group) => ({
                id: group.id,
                label: group.name
              }))}
              changed={(nextSelection) =>
                request({ kind: 'select', selection: nextSelection })
              }
            />
            {!active ? (
              <p className="empty-state">
                Wähle eine Gruppe aus oder lege eine neue Gruppe an.
              </p>
            ) : (
              <>
                <input
                  autoFocus
                  aria-label="Gruppenname"
                  placeholder="Gruppenname"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
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
                        <div className="roster-quantity">
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
                        <span>
                          <strong>
                            {fact?.displayName ?? entry.creatureId}
                          </strong>
                          <small>
                            CR {fact?.cr ?? '—'} ·{' '}
                            {(fact?.xp ?? 0).toLocaleString()} XP
                          </small>
                        </span>
                        <button
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
                  <p className="empty-state">
                    Monster links mit <strong>+</strong> hinzufügen oder eine
                    Gruppe generieren.
                  </p>
                )}
                <TuningControls tuning={tuning} changed={setTuning} />
                <div className="group-generator-actions">
                  <button
                    disabled={busy || !canGenerate}
                    onClick={() => void generate('fill')}
                  >
                    Auffüllen
                  </button>
                  <button
                    disabled={busy || !canGenerate}
                    onClick={() => void generate('replace')}
                  >
                    Neu generieren
                  </button>
                </div>
                {!canGenerate && (
                  <small className="muted">
                    Zum Generieren braucht die Scene eine zugewiesene Party mit
                    vollständigen Leveln.
                  </small>
                )}
                {evaluation && (
                  <DifficultySummary evaluation={evaluation} meter />
                )}
              </>
            )}
            {pending && (
              <div className="confirm-row group-draft-confirm" role="alert">
                <span>Ungespeicherte Änderungen verwerfen?</span>
                <button onClick={() => setPending(null)}>Abbrechen</button>
                <button className="danger" onClick={() => perform(pending)}>
                  Änderungen verwerfen
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
            {focused.locationName || 'Kein Ort gesetzt'} · {assigned.length}{' '}
            zugewiesene PCs
          </span>
          <div>
            <button type="button" onClick={() => request({ kind: 'close' })}>
              Abbrechen
            </button>
            <button
              disabled={busy || !active || !name.trim() || entries.length === 0}
              onClick={() => void save()}
            >
              {selection === 'new' ? 'Gruppe erstellen' : 'Speichern'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

type DraftCreatureFact = {
  displayName: string
  cr: number
  xp: number
  available: boolean
}

type GroupDraftAction =
  { kind: 'close' } | { kind: 'select'; selection: string | null }

function creatureFact(creature: Creature): DraftCreatureFact {
  return {
    displayName: creature.name,
    cr: creature.cr,
    xp: creature.xp,
    available: true
  }
}

function groupDraftEntries(quantities: Record<string, number>) {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([creatureId, quantity]) => ({ creatureId, quantity }))
    .sort((a, b) => a.creatureId.localeCompare(b.creatureId))
}

function groupDraftSignature(
  name: string,
  quantities: Record<string, number>
): string {
  return JSON.stringify({ name, entries: groupDraftEntries(quantities) })
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
    props.onError(errorText(cause))
  }
}
