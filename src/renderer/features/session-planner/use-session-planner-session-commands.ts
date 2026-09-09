import { useCallback, useRef, useState } from 'react'
import type {
  SessionPlannerCommand,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
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
  failed?: (cause: unknown, reconcile?: () => Promise<boolean>) => void
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
  const [name, setNameState] = useState('')
  const nameValue = useRef('')
  const setName = useCallback((value: string) => {
    nameValue.current = value
    setNameState(value)
  }, [])
  const [deleteConfirm, setDeleteConfirmState] = useState(false)

  const dialogs = useRef<{
    name: { kind: 'create' | 'rename'; sessionId: string | null } | null
    delete: boolean
  }>({ name: null, delete: false })
  const setNameDialog = useCallback(
    (value: 'create' | 'rename' | null) => {
      dialogs.current.name = value
        ? { kind: value, sessionId: read().workspace?.session.id ?? null }
        : null
      setNameDialogState(value)
    },
    [read]
  )
  const setDeleteConfirm = useCallback((value: boolean) => {
    dialogs.current.delete = value
    setDeleteConfirmState(value)
  }, [])

  const execute = useCallback(
    async (
      target: SessionPlannerAuthority,
      command: SessionPlannerCommand['command'],
      accepted?: () => void
    ): Promise<SessionPlannerWorkspace | null> => {
      const input: SessionPlannerCommand = {
        commandId: crypto.randomUUID(),
        command: structuredClone(command)
      }
      let published = false
      const entityKey = target.workspace
        ? `session:${target.workspace.session.id}`
        : 'catalog'
      const outcome = await coordinator.run({
        scope: 'planner.session-command',
        entityKey,
        mode: 'queue',
        execute: () => planner.executeCommand(input),
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
      if (outcome.status === 'failure')
        failed?.(outcome.cause, async () => {
          const status = await planner.commandStatus(input)
          if (status.receipt && sameAuthority(read(), target)) {
            applyWorkspace(status.workspace)
            accepted?.()
          } else if (
            !status.receipt &&
            !read().dirty &&
            sameAuthority(read(), target)
          ) {
            applyWorkspace(status.workspace)
          } else {
            mergeCatalog(status.workspace.sessions)
          }
          return true
        })
      reportCommandFailure(outcome, onError)
      return outcome.status === 'success' && published ? outcome.value : null
    },
    [applyWorkspace, coordinator, failed, mergeCatalog, onError, planner, read]
  )

  const saveDraft =
    useCallback(async (): Promise<SessionPlannerWorkspace | null> => {
      const target = read()
      if (!target.draft) return target.workspace
      return execute(target, { kind: 'save', input: target.draft })
    }, [execute, read])

  const openSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const target = read()
      if (!target.workspace || sessionId === target.workspace.session.id) return
      const opened = await execute(
        target,
        target.dirty && target.draft
          ? {
              kind: 'switch',
              input: { targetSessionId: sessionId, source: target.draft }
            }
          : { kind: 'open', input: { sessionId } },
        resetEncounterQuery
      )
      void opened
    },
    [execute, read, resetEncounterQuery]
  )

  const submitName = useCallback(async (): Promise<void> => {
    const operation = dialogs.current.name
    const requestedName = nameValue.current
    if (!operation || !requestedName.trim()) return
    let target = read()
    if (!target.workspace) return
    if (target.workspace.session.id !== operation.sessionId) {
      onError(
        'Die Sitzung des Namensdialogs hat sich geändert. Bitte den Dialog schließen und erneut öffnen.'
      )
      return
    }
    if (target.dirty) {
      const saved = await saveDraft()
      if (!saved) return
      target = read()
    }
    const current = target.workspace
    if (!current) return
    await execute(
      target,
      operation.kind === 'create'
        ? { kind: 'create', input: { name: requestedName } }
        : {
            kind: 'rename',
            input: {
              sessionId: current.session.id,
              expectedRevision: current.session.revision,
              name: requestedName
            }
          },
      () => {
        if (dialogs.current.name === operation) setNameDialog(null)
      }
    )
  }, [execute, onError, read, saveDraft, setNameDialog])

  const deleteSession = useCallback(async (): Promise<void> => {
    const target = read()
    const current = target.workspace
    if (!current) return
    await execute(
      target,
      {
        kind: 'delete',
        input: {
          sessionId: current.session.id,
          expectedRevision: current.session.revision
        }
      },
      () => setDeleteConfirm(false)
    )
  }, [execute, read, setDeleteConfirm])

  const settleDialogs = async (
    choice: 'save' | 'discard'
  ): Promise<boolean> => {
    if (choice === 'discard') setNameDialog(null)
    else if (dialogs.current.name) {
      if (!nameValue.current.trim())
        throw new Error(
          'Bitte einen Sitzungsnamen eingeben oder die offenen Änderungen verwerfen.'
        )
      await submitName()
      if (dialogs.current.name) return false
    }
    // A general maintenance decision never confirms a pending destructive action.
    setDeleteConfirm(false)
    return true
  }

  return {
    hasOpenDialog: () =>
      Boolean(dialogs.current.name) || dialogs.current.delete,
    settleDialogs,
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
    current.workspace?.session.id === target.workspace?.session.id &&
    Boolean(current.workspace) === Boolean(target.workspace)
  )
}

function reportCommandFailure(
  outcome: AsyncCommandOutcome<unknown>,
  onError: (message: string) => void
): void {
  if (outcome.status === 'failure') onError(capabilityErrorText(outcome.cause))
}
