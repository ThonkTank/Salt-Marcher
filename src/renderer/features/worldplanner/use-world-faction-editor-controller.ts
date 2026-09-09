import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftHandle
} from '../../shell/maintenance-draft-coordinator.js'
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
  worldFactionDraftValue,
  type WorldFactionDraftAction
} from './world-faction-draft.js'
import type {
  WorldFactionEditorRenderProps,
  WorldFactionSaveResult
} from './world-faction-editor-types.js'
import { useCreatureFacts } from './use-creature-facts.js'

export function useWorldFactionEditorController(
  props: WorldFactionEditorRenderProps
) {
  const [draft, rawDispatch] = useReducer(
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
  const draftRef = useRef(draft)
  const settled = useRef(false)
  const pending = useRef<Promise<boolean> | null>(null)
  const child = useRef<MaintenanceDraftHandle | null>(null)
  const blocked = useMaintenanceDraft(
    {
      label: `Fraktion: ${draft.displayName.trim() || 'Neue Fraktion'}`,
      get dependsOn() {
        return child.current?.isOpen() ? [child.current.id] : []
      },
      isDirty: () =>
        !settled.current &&
        (pending.current !== null || worldFactionDraftDirty(draftRef.current)),
      save: saveDraft,
      discard: discardDraft
    },
    props.maintenanceId
  )
  const inputBlocked = () =>
    maintenanceDraftCoordinator.isLocked() || pending.current !== null
  const apply = (action: WorldFactionDraftAction) => {
    if (submission.current.persistedValue !== null)
      throw new Error(
        'Die Fraktion wurde bereits gespeichert. Bitte erneut öffnen.'
      )
    draftRef.current = worldFactionDraftReducer(draftRef.current, action)
    settled.current = false
    rawDispatch(action)
  }
  const dispatch = (action: WorldFactionDraftAction) => {
    if (!inputBlocked() && !persisted) apply(action)
  }

  const selectPrimaryTable = (
    id: string | null,
    availableTables = tableSnapshot,
    fromChild = false
  ) => {
    if (!fromChild && (inputBlocked() || persisted)) return
    if (id === draftRef.current.primaryEncounterTableId) return
    const allowed = new Set(
      encounterTables(availableTables)
        .find((table) => table.id === id)
        ?.entries.map((entry) => entry.creatureId) ?? []
    )
    apply({ kind: 'primary-table', id, creatureIds: allowed })
  }

  const requestClose = () => {
    if (inputBlocked()) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }

  function saveDraft(): Promise<boolean> {
    if (pending.current) return pending.current
    if (submission.current.phase === 'reconciled') return Promise.resolve(true)
    const name = draftRef.current.displayName.trim()
    if (!name) return Promise.resolve(false)
    const value = {
      ...worldFactionDraftValue(draftRef.current),
      displayName: name
    }
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
              () => props.save(value),
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
  const submit = () => {
    if (inputBlocked() || persisted || child.current?.isOpen()) return
    return saveDraft()
  }
  const retryReconciliation = () => {
    if (inputBlocked() || !reconciliationFailed) return
    return saveDraft()
  }
  const requestTableCreation = () => {
    if (inputBlocked() || persisted || child.current?.isOpen()) return
    child.current = props.requestTableCreation((result) => {
      selectPrimaryTable(result.saved.id, result.snapshot, true)
      setInlineTableSnapshot(result.snapshot)
    })
  }

  return {
    draft,
    dispatch,
    busy: busy || blocked,
    persisted,
    reconciliationFailed,
    error,
    discardOpen,
    setDiscardOpen: (open: boolean) => {
      if (!inputBlocked()) setDiscardOpen(open)
    },
    discard: () => {
      if (!inputBlocked()) return discardDraft()
    },
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
