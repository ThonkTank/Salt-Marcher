import { useCallback, useRef, useState } from 'react'
import type { SessionPlannerWorkspace } from '../../../shared/contracts/session-planner.js'
import type {
  AsyncCommandCoordinator,
  AsyncCommandOutcome
} from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { SessionPlannerPort } from './use-session-planner-ports.js'
import type { SessionPlannerAuthority } from './use-session-planner-workspace.js'

type Dependencies = Readonly<{
  coordinator: AsyncCommandCoordinator
  planner: SessionPlannerPort
  read: () => SessionPlannerAuthority
  applyWorkspace: (workspace: SessionPlannerWorkspace) => void
  mergeCatalog: (sessions: SessionPlannerWorkspace['sessions']) => void
  resetEncounterQuery: () => void
  failed?: (cause: unknown) => void
  onError: (message: string) => void
}>

/** Owns revision-bound Session save, open, create, rename and delete commands. */
export function useSessionPlannerSessionCommands(dependencies: Dependencies) {
  const {
    applyWorkspace,
    failed,
    coordinator,
    mergeCatalog,
    onError,
    planner,
    read,
    resetEncounterQuery
  } = dependencies
  const [nameDialog, setNameDialogState] = useState<'create' | 'rename' | null>(
    null
  )
  const [name, setName] = useState('')
  const [deleteConfirm, setDeleteConfirmState] = useState(false)

  const dialogs = useRef({ name: false, delete: false })
  const setNameDialog = useCallback((value: 'create' | 'rename' | null) => {
    dialogs.current.name = value !== null
    setNameDialogState(value)
  }, [])
  const setDeleteConfirm = useCallback((value: boolean) => {
    dialogs.current.delete = value
    setDeleteConfirmState(value)
  }, [])

  const execute = useCallback(
    async (
      target: SessionPlannerAuthority,
      transport: () => Promise<SessionPlannerWorkspace>,
      accepted?: () => void
    ): Promise<SessionPlannerWorkspace | null> => {
      let published = false
      const entityKey = target.workspace
        ? `session:${target.workspace.session.id}`
        : 'catalog'
      const outcome = await coordinator.run({
        scope: 'planner.session-command',
        entityKey,
        mode: 'queue',
        execute: transport,
        accept: (next) => {
          if (sameAuthority(read(), target)) {
            applyWorkspace(next)
            accepted?.()
            published = true
          } else {
            mergeCatalog(next.sessions)
          }
        }
      })
      if (outcome.status === 'failure') failed?.(outcome.cause)
      reportCommandFailure(outcome, onError)
      return outcome.status === 'success' && published ? outcome.value : null
    },
    [applyWorkspace, coordinator, failed, mergeCatalog, onError, read]
  )

  const saveDraft =
    useCallback(async (): Promise<SessionPlannerWorkspace | null> => {
      const target = read()
      if (!target.draft) return target.workspace
      return execute(target, () => planner.save(target.draft!))
    }, [execute, planner, read])

  const openSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const target = read()
      if (!target.workspace || sessionId === target.workspace.session.id) return
      const opened = await execute(
        target,
        () =>
          target.dirty && target.draft
            ? planner.switch(sessionId, target.draft)
            : planner.open(sessionId),
        resetEncounterQuery
      )
      void opened
    },
    [execute, planner, read, resetEncounterQuery]
  )

  const submitName = useCallback(async (): Promise<void> => {
    const operation = nameDialog
    const requestedName = name
    if (!operation || !requestedName.trim()) return
    let target = read()
    if (!target.workspace) return
    if (target.dirty) {
      const saved = await saveDraft()
      if (!saved) return
      target = read()
    }
    const current = target.workspace
    if (!current) return
    await execute(
      target,
      () =>
        operation === 'create'
          ? planner.create(requestedName)
          : planner.rename(
              current.session.id,
              current.session.revision,
              requestedName
            ),
      () => setNameDialog(null)
    )
  }, [execute, name, nameDialog, planner, read, saveDraft, setNameDialog])

  const deleteSession = useCallback(async (): Promise<void> => {
    const target = read()
    const current = target.workspace
    if (!current) return
    await execute(
      target,
      () => planner.delete(current.session.id, current.session.revision),
      () => setDeleteConfirm(false)
    )
  }, [execute, planner, read, setDeleteConfirm])

  return {
    hasOpenDialog: () => dialogs.current.name || dialogs.current.delete,
    nameDialog,
    name,
    deleteConfirm,
    setNameDialog,
    setName,
    setDeleteConfirm,
    saveDraft,
    openSession,
    submitName,
    deleteSession
  }
}

function sameAuthority(
  current: SessionPlannerAuthority,
  target: SessionPlannerAuthority
): boolean {
  return (
    current.authoredRevision === target.authoredRevision &&
    Boolean(current.workspace) === Boolean(target.workspace)
  )
}

function reportCommandFailure(
  outcome: AsyncCommandOutcome<unknown>,
  onError: (message: string) => void
): void {
  if (outcome.status === 'failure') onError(capabilityErrorText(outcome.cause))
}
