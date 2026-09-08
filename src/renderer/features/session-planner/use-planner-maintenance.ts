import { message } from '../../i18n/session-runtime.de.js'
import { useState, useSyncExternalStore } from 'react'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import type { SessionPlannerWorkspace } from '../../../shared/contracts/session-planner.js'
import type { SessionPlannerAuthority } from './use-session-planner-workspace.js'
import { PlannerMaintenanceRuntime } from './planner-maintenance-runtime.js'

export function usePlannerMaintenanceRuntime() {
  const [runtime] = useState(() => new PlannerMaintenanceRuntime())
  useSyncExternalStore(runtime.subscribe, runtime.snapshot)
  return runtime
}

export function usePlannerMaintenance(options: {
  runtime: PlannerMaintenanceRuntime
  coordinator: AsyncCommandCoordinator
  onError: (message: string) => void
  read: () => SessionPlannerAuthority
  applyWorkspace: (workspace: SessionPlannerWorkspace) => void
  saveDraft: () => Promise<SessionPlannerWorkspace | null>
  settlePreparations?: (
    choice: 'save' | 'discard'
  ) => Promise<SessionPlannerWorkspace>
  dialogs?: {
    isOpen: () => boolean
    settle: (choice: 'save' | 'discard') => Promise<boolean>
  }
  readUnresolved: () => string | null
}) {
  const {
    runtime,
    coordinator,
    read,
    applyWorkspace,
    saveDraft,
    settlePreparations,
    dialogs,
    readUnresolved
  } = options
  const settle = async (choice: 'save' | 'discard') => {
    await runtime.drain()
    await coordinator.whenIdle()
    if (runtime.uncertain()) await runtime.drain()
    const fresh = await settlePreparations?.(choice)
    const unresolved = readUnresolved()
    if (unresolved) throw new Error(unresolved)
    return fresh
  }
  const maintenanceBlocked = useMaintenanceDraft({
    label: 'Sitzungsplanung',
    isDirty: () =>
      read().dirty ||
      runtime.pending() ||
      runtime.uncertain() ||
      coordinator.hasPending() ||
      Boolean(readUnresolved()) ||
      Boolean(dialogs?.isOpen()),
    save: async () => {
      const fresh = await settle('save')
      const current = read()
      if (!current.dirty) {
        if (fresh) applyWorkspace(fresh)
      } else if (
        fresh &&
        (fresh.session.id !== current.workspace?.session.id ||
          fresh.session.revision !== current.workspace.session.revision)
      )
        throw new Error(
          'Die gespeicherte Sitzung hat sich während der Vorbereitung geändert. Dein Entwurf bleibt erhalten. Bitte Wartung abbrechen und die Änderungen prüfen.'
        )
      if (read().dirty && !(await saveDraft())) return false
      if (read().dirty || runtime.uncertain()) return false
      return (await dialogs?.settle('save')) ?? true
    },
    discard: async () => {
      const fresh = await settle('discard')
      const workspace = fresh ?? read().workspace
      if (workspace) applyWorkspace(workspace)
      return ((await dialogs?.settle('discard')) ?? true) && !read().dirty
    }
  })
  const blocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    runtime.pending() ||
    runtime.uncertain()
  return {
    uncertain: runtime.uncertain(),
    canReconcile: runtime.canReconcile(),
    reconciliationBlocked: maintenanceBlocked || runtime.pending(),
    retryUnknown: async () => {
      if (maintenanceDraftCoordinator.isLocked() || runtime.pending()) return
      try {
        if (!(await runtime.run(() => runtime.reconcileUnknown())))
          options.onError(message('planner.reconciliationUnavailable'))
      } catch {
        options.onError(message('planner.reconciliationFailed'))
      }
    },
    blocked: maintenanceBlocked || runtime.pending() || runtime.uncertain(),
    edit:
      <Args extends unknown[]>(operation: (...args: Args) => void) =>
      (...args: Args) => {
        if (!blocked()) operation(...args)
      },
    command:
      <Args extends unknown[], Result>(
        operation: (...args: Args) => Promise<Result>,
        fallback: Result
      ) =>
      (...args: Args): Promise<Result> =>
        blocked()
          ? Promise.resolve(fallback)
          : runtime.run(() => operation(...args))
  }
}
