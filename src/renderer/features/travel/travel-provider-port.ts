import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'

export type TravelMultiplier = 1 | 2 | 5 | 10
export type TravelMode = 'inspect' | 'position' | 'plan'

export type TravelProviderDescriptor<P> = Readonly<{
  revision: number
  status: string
  mapOptions: readonly Readonly<{ id: string; label: string }>[]
  currentMapId: string | null
  currentPosition: P | null
  multiplier: TravelMultiplier
}>

export type TravelProviderInvalidation =
  | Readonly<{ kind: 'context'; sceneId: string }>
  | Readonly<{ kind: 'catalog' }>
  | Readonly<{ kind: 'map'; mapId: string }>
  | Readonly<{ kind: 'supporting-data' }>

export type TravelProviderCommand<P> =
  | Readonly<{
      kind: 'position'
      sceneId: string
      mapId: string
      position: P
      expectedSceneRevision: number
    }>
  | Readonly<{
      kind: 'start'
      sceneId: string
      mapId: string
      waypoints: readonly P[]
      multiplier: TravelMultiplier
      expectedRevision: number
    }>
  | Readonly<{
      kind: 'pause' | 'resume' | 'abort'
      sceneId: string
      expectedRevision: number
    }>
  | Readonly<{
      kind: 'set-multiplier'
      sceneId: string
      multiplier: TravelMultiplier
      expectedRevision: number
    }>

export type TravelProviderReadResult<S> = Readonly<{
  providerState: S
  session: LiveSessionSnapshot
}>

export type TravelProviderPort<P, S, M, E> = Readonly<{
  kind: 'hex' | 'dungeon'
  read: (input: { sceneId: string }) => Promise<TravelProviderReadResult<S>>
  readMap: (input: { mapId: string; center?: P; force?: boolean }) => Promise<M>
  evaluate: (input: {
    sceneId: string
    mapId: string
    waypoints: readonly P[]
  }) => Promise<E>
  execute: (
    command: TravelProviderCommand<P>
  ) => Promise<TravelProviderReadResult<S>>
  describe: (state: S) => TravelProviderDescriptor<P>
  isAuthoredPosition: (map: M, position: P) => boolean
  canStart: (evaluation: E) => boolean
  subscribe: (
    listener: (event: TravelProviderInvalidation) => void
  ) => () => void
  dispose: () => void
}>
