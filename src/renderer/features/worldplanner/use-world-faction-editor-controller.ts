import { useMemo, useReducer, useRef, useState } from 'react'
import type { EncounterTableSnapshot } from '../../../shared/contracts/encounter-source.js'
import { presentCapabilityError } from '../../capabilities/capability-errors.js'
import {
  encounterTableSummaries,
  encounterTables
} from '../encounter-table/encounter-table-snapshot.js'
import {
  executePersistedSubmission,
  PersistedSubmissionLifecycle,
  retryPersistedSubmissionReconciliation
} from '../shared/submission-lifecycle.js'
import {
  createWorldFactionDraftState,
  worldFactionDraftDirty,
  worldFactionDraftReducer,
  worldFactionDraftValue
} from './world-faction-draft.js'
import type {
  WorldFactionEditorRenderProps,
  WorldFactionSaveResult
} from './world-faction-editor-types.js'
import { useCreatureFacts } from './use-creature-facts.js'

export function useWorldFactionEditorController(
  props: WorldFactionEditorRenderProps
) {
  const [draft, dispatch] = useReducer(
    worldFactionDraftReducer,
    props.faction,
    createWorldFactionDraftState
  )
  const [inlineTableSnapshot, setInlineTableSnapshot] =
    useState<EncounterTableSnapshot | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [persisted, setPersisted] = useState(false)
  const [reconciliationFailed, setReconciliationFailed] = useState(false)
  const [error, setError] = useState('')
  const submission = useRef(
    new PersistedSubmissionLifecycle<WorldFactionSaveResult>()
  )
  const tableSnapshot = inlineTableSnapshot ?? props.tableSnapshot
  const tables = useMemo(() => encounterTables(tableSnapshot), [tableSnapshot])
  const tableSummaries = useMemo(
    () => encounterTableSummaries(tableSnapshot),
    [tableSnapshot]
  )
  const selectedTable = tables.find(
    (table) => table.id === draft.primaryEncounterTableId
  )
  const selectedCreatureIds = useMemo(
    () => selectedTable?.entries.map((entry) => entry.creatureId) ?? [],
    [selectedTable]
  )
  const facts = useCreatureFacts(selectedCreatureIds, props.creatures)
  const dirty = worldFactionDraftDirty(draft)

  const selectPrimaryTable = (
    id: string | null,
    availableTables = tableSnapshot
  ) => {
    if (id === draft.primaryEncounterTableId) return
    const allowed = new Set(
      encounterTables(availableTables)
        .find((table) => table.id === id)
        ?.entries.map((entry) => entry.creatureId) ?? []
    )
    dispatch({ kind: 'primary-table', id, creatureIds: allowed })
  }

  const requestClose = () => {
    if (busy) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }

  const submit = async () => {
    const name = draft.displayName.trim()
    if (!name || busy || persisted) return
    setBusy(true)
    setError('')
    const outcome = await executePersistedSubmission(
      submission.current,
      () => props.save({ ...worldFactionDraftValue(draft), displayName: name }),
      props.saved
    )
    if (
      outcome.status === 'reconciled' ||
      outcome.status === 'reconciliation-failed'
    )
      setPersisted(true)
    if (
      outcome.status === 'mutation-failed' ||
      outcome.status === 'reconciliation-failed'
    ) {
      const nextError = presentCapabilityError(outcome.cause, props.onError)
      setError(nextError)
    }
    setReconciliationFailed(outcome.status === 'reconciliation-failed')
    setBusy(false)
  }

  const retryReconciliation = async () => {
    if (busy || !reconciliationFailed) return
    setBusy(true)
    setError('')
    const outcome = await retryPersistedSubmissionReconciliation(
      submission.current,
      props.saved
    )
    setReconciliationFailed(outcome.status === 'reconciliation-failed')
    if (outcome.status === 'reconciliation-failed')
      setError(presentCapabilityError(outcome.cause, props.onError))
    setBusy(false)
  }

  const requestTableCreation = () =>
    props.requestTableCreation((result) => {
      setInlineTableSnapshot(result.snapshot)
      selectPrimaryTable(result.saved.id, result.snapshot)
    })

  return {
    draft,
    dispatch,
    busy,
    persisted,
    reconciliationFailed,
    error,
    discardOpen,
    setDiscardOpen,
    selectedTable,
    tableSummaries,
    facts,
    selectPrimaryTable,
    requestTableCreation,
    requestClose,
    submit,
    retryReconciliation
  }
}
