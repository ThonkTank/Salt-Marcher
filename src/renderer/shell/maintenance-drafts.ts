import { useLayoutEffect, useRef, useId, useSyncExternalStore } from 'react'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraft
} from './maintenance-draft-coordinator.js'

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
export function useMaintenanceDraft(
  owner: MaintenanceDraft,
  ownerId?: string
): boolean {
  const generatedId = useId()
  const id = ownerId ?? generatedId
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
        get dependsOn() {
          return current.current.dependsOn ?? []
        },
        isDirty: () => current.current.isDirty(),
        save: () => current.current.save?.() ?? Promise.resolve(false),
        discard: () => current.current.discard?.() ?? Promise.resolve(false)
      }),
    [id]
  )
  return useMaintenanceEditingBlocked()
}
