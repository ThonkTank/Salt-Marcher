import {
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useSyncExternalStore
} from 'react'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraft
} from './maintenance-draft-coordinator.js'

/** Transitional guard; owner save/discard registration is required for resolution. */
export function useMaintenanceDraftGuard(dirty: boolean): void {
  const id = useId()
  useEffect(
    () =>
      maintenanceDraftCoordinator.register(id, {
        label: 'Offener Editor',
        isDirty: () => dirty
      }),
    [dirty, id]
  )
}
export function hasMaintenanceDrafts(): boolean {
  return maintenanceDraftCoordinator.hasDirty()
}
export function useMaintenanceEditingBlocked(): boolean {
  return useSyncExternalStore(
    maintenanceDraftCoordinator.subscribe,
    maintenanceDraftCoordinator.isLocked
  )
}

/** Stable registration; save/discard stay with the committed editor instance. */
export function useMaintenanceDraft(owner: MaintenanceDraft): boolean {
  const id = useId()
  const current = useRef(owner)
  useLayoutEffect(() => {
    current.current = owner
  })
  useLayoutEffect(
    () =>
      maintenanceDraftCoordinator.register(id, {
        get label() {
          return current.current.label
        },
        isDirty: () => current.current.isDirty(),
        save: () => current.current.save?.() ?? Promise.resolve(false),
        discard: () => current.current.discard?.() ?? Promise.resolve(false)
      }),
    [id]
  )
  return useMaintenanceEditingBlocked()
}
