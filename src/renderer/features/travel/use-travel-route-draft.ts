import { useLayoutEffect, useSyncExternalStore } from 'react'
import type { TravelRoutePlanSnapshot } from './travel-provider-port.js'
import type { TravelViewProjection } from './travel-view-projection.js'
import type { TravelProviderPort } from './travel-provider-port.js'

export interface TravelRouteDraft<P> {
  readonly snapshot: () => Readonly<{
    plan: TravelRoutePlanSnapshot<P>['plan']
    dirty: boolean
    busy: boolean
    error: string | null
  }>
  readonly subscribe: (listener: () => void) => () => void
  observe(snapshot: TravelRoutePlanSnapshot<P>): void
  edit(plan: TravelRoutePlanSnapshot<P>['plan']): boolean
  isDirty(): boolean
  save(): Promise<boolean>
}
const empty = { plan: null, dirty: false, busy: false, error: null } as const
const readEmpty = () => empty
const subscribeEmpty = () => () => undefined

/** Projects the independently owned route only on its map, never the active journey. */
export function useTravelRouteDraft<P, S, M, E>(
  draft: TravelRouteDraft<P> | undefined,
  port: TravelProviderPort<P, S, M, E> | null,
  projection: TravelViewProjection<P, S, M, E>
) {
  const snapshot = useSyncExternalStore(
    draft?.subscribe ?? subscribeEmpty,
    draft?.snapshot ?? readEmpty
  )
  const { local, state } = projection
  const providerState = state.providerState
  useLayoutEffect(() => {
    if (draft && port && providerState)
      draft.observe(port.describe(providerState).routePlan)
  }, [draft, port, providerState])
  useLayoutEffect(() => {
    if (!draft) return
    const plan = snapshot.plan?.mapId === state.mapId ? snapshot.plan : null
    const waypoints = state.mode === 'plan' ? (plan?.waypoints ?? []) : []
    const multiplier =
      state.mode === 'plan' && plan ? plan.multiplier : state.multiplier
    if (
      JSON.stringify(state.waypoints) !== JSON.stringify(waypoints) ||
      multiplier !== state.multiplier
    )
      local({ type: 'route-loaded', waypoints, multiplier }, 'route')
  }, [
    draft,
    local,
    snapshot.plan,
    state.mapId,
    state.mode,
    state.multiplier,
    state.waypoints
  ])
  return snapshot
}
