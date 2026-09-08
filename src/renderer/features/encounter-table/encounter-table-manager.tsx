import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import type { EncounterTableScope } from '../../../shared/contracts/encounter-source.js'
import {
  presentCapabilityError,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/catalog-runtime.de.js'
import {
  formatChallengeRatingLabel,
  formatPercent
} from '../../i18n/domain-formatters.de.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import { DiscardChangesDialog } from '../../shell/modal-dialog.js'
import {
  EncounterTableCreatureCatalogTable,
  CreatureCollectionManagerDialog
} from '../creature-collection/creature-collection.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  useCreatureSearch
} from '../creatures/creature-state.js'
import { useBiomeOptionSearch } from '../creatures/use-biome-option-search.js'
import {
  createEncounterTableDraftState,
  encounterTableDraftDirty,
  encounterTableDraftReducer,
  encounterTableDraftValue,
  type EncounterTableDraftAction
} from './encounter-table-draft.js'
import type { EncounterTableEditorRenderProps } from './encounter-table-editor-types.js'
import type { EncounterTableSaveResult } from './encounter-table-editor-types.js'
import { parseEncounterTableEditorSubmission } from './encounter-table-editor-submission.js'
import { allocateEncounterTableShares } from './encounter-table-shares.js'
import {
  executePersistedSubmission,
  PersistedSubmissionLifecycle,
  retryPersistedSubmissionReconciliation
} from '../shared/submission-lifecycle.js'

export type { EncounterTableSaveResult } from './encounter-table-editor-types.js'

export function EncounterTableDialog(props: EncounterTableEditorRenderProps) {
  const [draft, rawDispatch] = useReducer(
    encounterTableDraftReducer,
    props.table,
    createEncounterTableDraftState
  )
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const searchBiomeOptions = useBiomeOptionSearch(
    props.biomePort,
    setOptions,
    query.biomes,
    props.onError
  )
  const [facts, setFacts] = useState<Readonly<Record<string, Creature | null>>>(
    {}
  )
  const [discardOpen, setDiscardOpen] = useState(false)
  const [saving, setBusy] = useState(false)
  const [persisted, setPersisted] = useState(false)
  const submission = useRef(
    new PersistedSubmissionLifecycle<EncounterTableSaveResult>()
  )
  const [reconciliationFailed, setReconciliationFailed] = useState(false)
  const [error, setError] = useState('')
  const [creationScope, rawSetCreationScope] =
    useState<EncounterTableScope>('campaign')
  const creaturePort = props.creaturePort

  const dirty =
    encounterTableDraftDirty(draft) ||
    (!props.table && creationScope !== 'campaign')
  const draftRef = useRef(draft)
  const scopeRef = useRef(creationScope)
  const settled = useRef(false)
  const pending = useRef<Promise<boolean> | null>(null)
  const blocked = useMaintenanceDraft(
    {
      label: `Begegnungstabelle: ${draft.displayName.trim() || 'Neue Tabelle'}`,
      isDirty: () =>
        !settled.current &&
        (pending.current !== null ||
          encounterTableDraftDirty(draftRef.current) ||
          (!props.table && scopeRef.current !== 'campaign')),
      save: saveDraft,
      discard: discardDraft
    },
    props.maintenanceId
  )
  const busy = saving || blocked
  const inputBlocked = () =>
    maintenanceDraftCoordinator.isLocked() || pending.current !== null
  const dispatch = (action: EncounterTableDraftAction) => {
    if (inputBlocked() || submission.current.persistedValue !== null) return
    draftRef.current = encounterTableDraftReducer(draftRef.current, action)
    settled.current = false
    rawDispatch(action)
  }
  const setCreationScope = (scope: EncounterTableScope) => {
    if (inputBlocked() || submission.current.persistedValue !== null) return
    scopeRef.current = scope
    settled.current = false
    rawSetCreationScope(scope)
  }
  const creatureIdsKey = [...draft.order].toSorted().join('\u0000')
  const entries = useMemo(
    () =>
      draft.order.map(
        (creatureId) => [creatureId, draft.weights[creatureId]!] as const
      ),
    [draft.order, draft.weights]
  )
  const shares = useMemo(
    () =>
      new Map(
        allocateEncounterTableShares(
          entries.map(([creatureId, weight]) => ({
            creatureId,
            weight
          }))
        ).map((share) => [share.creatureId, share])
      ),
    [entries]
  )
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)

  useCreatureSearch(query, setPage, props.onError, creaturePort)

  useEffect(() => {
    void creaturePort
      .filterOptions()
      .then(setOptions)
      .catch(reportCapabilityError(props.onError))
  }, [creaturePort, props.onError])

  useEffect(() => {
    const missing = creatureIdsKey
      .split('\u0000')
      .filter((id) => id && facts[id] === undefined)
    if (missing.length === 0) return
    let current = true
    void Promise.all(
      missing.map((id) => creaturePort.detail(id).catch(() => null))
    ).then((rows) => {
      if (!current) return
      setFacts((known) => ({
        ...known,
        ...Object.fromEntries(missing.map((id, index) => [id, rows[index]!]))
      }))
    })
    return () => {
      current = false
    }
    // Facts form an append-only cache; the ID signature triggers missing reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatureIdsKey, creaturePort])

  const requestClose = () => {
    if (inputBlocked()) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }

  function saveDraft(): Promise<boolean> {
    if (pending.current) return pending.current
    if (submission.current.phase === 'reconciled') return Promise.resolve(true)
    const submissionDraft = parseEncounterTableEditorSubmission(
      encounterTableDraftValue(draftRef.current)
    )
    if (!submissionDraft.success) return Promise.resolve(false)
    const scope = props.table?.scope ?? scopeRef.current
    setBusy(true)
    setError('')
    const operation = Promise.resolve()
      .then(() =>
        submission.current.persistedValue !== null
          ? retryPersistedSubmissionReconciliation(
              submission.current,
              props.saved
            )
          : executePersistedSubmission(
              submission.current,
              () => props.save(props.table, submissionDraft.data, scope),
              props.saved
            )
      )
      .then((outcome) => {
        if (
          outcome.status === 'reconciled' ||
          outcome.status === 'reconciliation-failed'
        )
          setPersisted(true)
        if (
          outcome.status === 'mutation-failed' ||
          outcome.status === 'reconciliation-failed'
        )
          setError(presentCapabilityError(outcome.cause, props.onError))
        setReconciliationFailed(outcome.status === 'reconciliation-failed')
        settled.current = outcome.status === 'reconciled'
        return settled.current
      })
      .finally(() => {
        pending.current = null
        setBusy(false)
      })
    pending.current = operation
    return operation
  }
  async function discardDraft(): Promise<boolean> {
    if (pending.current) await pending.current.catch(() => false)
    props.close()
    settled.current = true
    return true
  }
  const save = () => {
    if (!inputBlocked() && !persisted) return saveDraft()
  }
  const retryReconciliation = () => {
    if (!inputBlocked() && reconciliationFailed) return saveDraft()
  }

  const catalog = (
    <EncounterTableCreatureCatalogTable
      disabled={busy || persisted}
      query={query}
      options={options}
      searchBiomeOptions={searchBiomeOptions}
      page={page}
      changed={setQuery}
      inspect={props.inspect}
      quantities={draft.weights}
      footerStatus={formatMessage('table.catalogCount', {
        visible: page?.rows.length ?? 0,
        total: page?.total ?? 0
      })}
      add={(creature) => {
        if (inputBlocked() || submission.current.persistedValue !== null) return
        dispatch({ kind: 'add', creatureId: creature.id })
        setFacts((known) => ({ ...known, [creature.id]: creature }))
      }}
    />
  )

  const draftPane = (
    <section
      className="creature-collection-draft-pane encounter-table-draft-pane"
      aria-label={message('ui.aktuelle.encounter.tabelle')}
    >
      <label>
        {message('ui.name')}
        <input
          required
          aria-label={message('ui.tabellenname')}
          maxLength={100}
          disabled={busy || persisted}
          value={draft.displayName}
          onChange={(event) =>
            dispatch({ kind: 'name', value: event.target.value })
          }
        />
      </label>
      {!props.table && (
        <label>
          {message('encounterTable.scope')}
          <select
            aria-label={message('encounterTable.scopeLabel')}
            disabled={busy || persisted}
            value={creationScope}
            onChange={(event) =>
              setCreationScope(event.target.value as EncounterTableScope)
            }
          >
            <option value="campaign">
              {message('encounterTable.scopeCampaign')}
            </option>
            <option value="installation">
              {message('encounterTable.scopeInstallation')}
            </option>
          </select>
        </label>
      )}
      <label>
        {message('ui.beschreibung')}
        <textarea
          aria-label={message('ui.tabellenbeschreibung')}
          rows={3}
          maxLength={20_000}
          disabled={busy || persisted}
          value={draft.description}
          onChange={(event) =>
            dispatch({ kind: 'description', value: event.target.value })
          }
        />
      </label>
      <div className="encounter-table-entry-heading">
        <h3>{message('ui.gewichtete.eintraege')}</h3>
        <span>
          {formatMessage('table.entriesSummary', {
            count: entries.length,
            sum: totalWeight
          })}
        </span>
      </div>
      <ul className="creature-collection-roster encounter-table-roster">
        {entries.map(([id, weight]) => {
          const creature = facts[id]
          const name =
            creature?.name ??
            formatMessage('catalog.unavailableReference', { id })
          const share = shares.get(id)
          return (
            <li key={id}>
              <span className="encounter-table-creature">
                {creature ? (
                  <button
                    type="button"
                    className="creature-collection-link"
                    onClick={() => props.inspect(creature)}
                  >
                    {name}
                  </button>
                ) : (
                  <strong>{name}</strong>
                )}
                <small>
                  {creature
                    ? formatChallengeRatingLabel(creature.challengeRating)
                    : 'CR —'}
                </small>
                <span
                  className="encounter-table-share-track"
                  aria-hidden="true"
                >
                  <span style={{ width: `${share?.exactPercent ?? 0}%` }} />
                </span>
              </span>
              <div className="creature-collection-quantity">
                <button
                  type="button"
                  aria-label={formatMessage('encounterTable.decreaseWeight', {
                    name
                  })}
                  disabled={weight <= 1 || busy || persisted}
                  onClick={() =>
                    dispatch({
                      kind: 'weight',
                      creatureId: id,
                      value: weight - 1
                    })
                  }
                >
                  −
                </button>
                <strong>{weight}</strong>
                <button
                  type="button"
                  aria-label={formatMessage('encounterTable.increaseWeight', {
                    name
                  })}
                  disabled={weight >= 10 || busy || persisted}
                  onClick={() =>
                    dispatch({
                      kind: 'weight',
                      creatureId: id,
                      value: weight + 1
                    })
                  }
                >
                  +
                </button>
              </div>
              <strong className="encounter-table-share">
                {formatPercent(share?.percent ?? 0)}
              </strong>
              <button
                type="button"
                className="remove"
                aria-label={formatMessage('encounterTable.removeCreature', {
                  name
                })}
                disabled={busy || persisted}
                onClick={() => dispatch({ kind: 'remove', creatureId: id })}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      {entries.length === 0 && (
        <p className="creature-collection-empty">
          {message('ui.monster.links.mit')} <strong>+</strong>{' '}
          {message('ui.hinzufuegen')}
        </p>
      )}
      <p className="encounter-table-share-hint">{message('table.shareHint')}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  )

  const status = !draft.displayName.trim()
    ? message('table.nameRequired')
    : entries.length === 0
      ? message('table.creatureRequired')
      : props.table
        ? message('table.readySave')
        : message('table.readyCreate')

  return (
    <>
      <CreatureCollectionManagerDialog
        className="encounter-table-manager"
        title={
          props.table
            ? message('table.editTitle')
            : message('table.createTitle')
        }
        heading={
          <div>
            <p className="section-kicker">
              {props.invocation.kind === 'location-link'
                ? message('encounterTable.locationBreadcrumb')
                : props.invocation.kind === 'faction-link'
                  ? message('faction.tableBreadcrumb')
                  : message('nav.catalog')}
            </p>
            <IlluminatedHeading
              title={
                props.table
                  ? message('table.editTitle')
                  : message('table.createTitle')
              }
            />
          </div>
        }
        closeLabel={message('ui.dialog.schliessen')}
        close={requestClose}
        busy={busy}
        catalog={catalog}
        divider={{ kind: 'fixed' }}
        draft={draftPane}
        footer={
          <>
            <span className="muted">{status}</span>
            <div>
              <button type="button" disabled={busy} onClick={requestClose}>
                {message('action.cancel')}
              </button>
              <button
                type="button"
                className="encounter-table-primary-action"
                disabled={
                  busy ||
                  persisted ||
                  !draft.displayName.trim() ||
                  entries.length === 0
                }
                onClick={() => void save()}
              >
                {props.table
                  ? message('action.save')
                  : props.invocation.kind !== 'catalog'
                    ? message('action.createAndLink')
                    : message('action.create')}
              </button>
              {reconciliationFailed && (
                <button
                  type="button"
                  className="encounter-table-primary-action"
                  disabled={busy}
                  onClick={() => void retryReconciliation()}
                >
                  {message('action.retry')}
                </button>
              )}
            </div>
          </>
        }
      />
      {discardOpen && (
        <DiscardChangesDialog
          message={message('ui.ungespeicherte.aenderungen.verwerfen')}
          cancelLabel={message('action.cancel')}
          discardLabel={message('ui.aenderungen.verwerfen')}
          onCancel={() => {
            if (!inputBlocked()) setDiscardOpen(false)
          }}
          onDiscard={() => {
            if (!inputBlocked()) void discardDraft()
          }}
        />
      )}
    </>
  )
}
