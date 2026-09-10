import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  useId,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraft,
  type MaintenanceDraftConcern
} from './maintenance-draft-coordinator.js'

const concernContext = createContext<readonly MaintenanceDraftConcern[]>([])

export function MaintenanceDraftConcernProvider(props: {
  concerns: readonly MaintenanceDraftConcern[]
  children: ReactNode
}) {
  const inherited = useContext(concernContext)
  return createElement(
    concernContext.Provider,
    { value: [...inherited, ...props.concerns] },
    props.children
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
export function useMaintenanceDraft(
  owner: MaintenanceDraft,
  ownerId?: string
): boolean {
  const generatedId = useId()
  const id = ownerId ?? generatedId
  const inherited = useContext(concernContext)
  const current = useRef({ owner, inherited })
  useLayoutEffect(() => {
    current.current = { owner, inherited }
  })
  useLayoutEffect(
    () =>
      maintenanceDraftCoordinator.register(id, {
        get label() {
          return current.current.owner.label
        },
        get dependsOn() {
          return current.current.owner.dependsOn ?? []
        },
        get concerns() {
          return [
            ...current.current.inherited,
            ...(current.current.owner.concerns ?? [])
          ]
        },
        isDirty: () => current.current.owner.isDirty(),
        settleBackgroundWrites: () =>
          current.current.owner.settleBackgroundWrites?.() ?? Promise.resolve(),
        save: () => current.current.owner.save?.() ?? Promise.resolve(false),
        discard: () =>
          current.current.owner.discard?.() ?? Promise.resolve(false)
      }),
    [id]
  )
  return useSyncExternalStore(maintenanceDraftCoordinator.subscribe, () =>
    maintenanceDraftCoordinator.isDraftLocked(id)
  )
}
