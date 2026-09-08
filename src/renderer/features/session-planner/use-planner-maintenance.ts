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
  read: () => SessionPlannerAuthority
  applyWorkspace: (workspace: SessionPlannerWorkspace) => void
  saveDraft: () => Promise<SessionPlannerWorkspace | null>
  readUnresolved: () => string | null
}) {
  const {
    runtime,
    coordinator,
    read,
    applyWorkspace,
    saveDraft,
    readUnresolved
  } = options
  const settle = async () => {
    await runtime.drain()
    await coordinator.whenIdle()
    if (runtime.uncertain()) await runtime.drain()
    const unresolved = readUnresolved()
    if (unresolved) throw new Error(unresolved)
  }
  const maintenanceBlocked = useMaintenanceDraft({
    label: 'Sitzungsplanung',
    isDirty: () =>
      read().dirty ||
      runtime.pending() ||
      runtime.uncertain() ||
      coordinator.hasPending() ||
      Boolean(readUnresolved()),
    save: async () => {
      await settle()
      if (!read().dirty) return true
      return Boolean(await saveDraft()) && !read().dirty && !runtime.uncertain()
    },
    discard: async () => {
      await settle()
      const workspace = read().workspace
      if (workspace) applyWorkspace(workspace)
      return !read().dirty
    }
  })
  const blocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    runtime.pending() ||
    runtime.uncertain()
  return {
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
