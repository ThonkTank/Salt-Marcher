import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import {
  initialTravelControllerState,
  sameTravelScope,
  travelControllerReducer,
  type TravelControllerEvent,
  type TravelRequestChannel,
  type TravelScope
} from './travel-controller.js'
import type {
  TravelProviderDescriptor,
  TravelProviderReadResult
} from './travel-provider-port.js'

export type TravelAuthorityTarget = Readonly<{
  scope: TravelScope
  intentRevision: number
  mapRevision: number
  routeRevision: number
  publicationRevision: number
  mapId: string | null
}>

type AuthorityKind = 'scope' | 'intent' | 'map' | 'route'
type LocalKind = 'intent' | 'map' | 'route' | 'transient'

/** Owns the synchronous view state and the authority for publishing remote work. */
export function useTravelViewProjection<P, S, M, E>(options: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
}) {
  const [state, setState] = useState(() =>
    initialTravelControllerState<P, S, M, E>()
  )
  const stateRef = useRef(state)
  const snapshotRef = useRef(options.snapshot)
  const setSnapshotRef = useRef(options.setSnapshot)
  const revisions = useRef({ intent: 0, map: 0, route: 0, publication: 0 })
  useEffect(() => {
    if (
      options.snapshot.scene.focusedSceneId !==
        snapshotRef.current.scene.focusedSceneId ||
      options.snapshot.scene.revision >= snapshotRef.current.scene.revision
    )
      snapshotRef.current = options.snapshot
    setSnapshotRef.current = options.setSnapshot
  }, [options.setSnapshot, options.snapshot])

  const publish = useCallback((event: TravelControllerEvent<P, S, M, E>) => {
    const next = travelControllerReducer(stateRef.current, event)
    stateRef.current = next
    setState(next)
  }, [])

  const capture = useCallback(
    (mapId = stateRef.current.mapId): TravelAuthorityTarget | null => {
      const scope = stateRef.current.scope
      if (!scope || stateRef.current.lifecycle === 'inactive') return null
      return Object.freeze({
        scope,
        intentRevision: revisions.current.intent,
        mapRevision: revisions.current.map,
        routeRevision: revisions.current.route,
        publicationRevision: revisions.current.publication,
        mapId
      })
    },
    []
  )

  const read = useCallback(() => stateRef.current, [])
  const sceneRevision = useCallback(
    () => snapshotRef.current.scene.revision,
    []
  )

  const isCurrent = useCallback(
    (target: TravelAuthorityTarget, kind: AuthorityKind = 'scope') => {
      const current = stateRef.current
      if (
        current.lifecycle === 'inactive' ||
        !sameTravelScope(current.scope, target.scope)
      )
        return false
      if (kind === 'intent')
        return target.intentRevision === revisions.current.intent
      if (kind === 'map')
        return (
          target.mapRevision === revisions.current.map &&
          target.mapId === current.mapId
        )
      if (kind === 'route')
        return (
          target.routeRevision === revisions.current.route &&
          target.mapId === current.mapId
        )
      return true
    },
    []
  )

  const local = useCallback(
    (event: TravelControllerEvent<P, S, M, E>, kind: LocalKind) => {
      if (kind !== 'transient') revisions.current.intent += 1
      if (kind === 'map') {
        revisions.current.map += 1
        revisions.current.route += 1
      } else if (kind === 'route') revisions.current.route += 1
      publish(event)
    },
    [publish]
  )

  const activate = useCallback(
    (scope: TravelScope) => {
      if (!sameTravelScope(stateRef.current.scope, scope)) {
        revisions.current.intent += 1
        revisions.current.map += 1
        revisions.current.route += 1
      }
      publish({ type: 'activated', scope })
    },
    [publish]
  )

  const deactivate = useCallback(() => {
    revisions.current.intent += 1
    revisions.current.map += 1
    revisions.current.route += 1
    publish({ type: 'deactivated' })
  }, [publish])

  const beginMapIntent = useCallback(() => {
    revisions.current.intent += 1
    revisions.current.map += 1
    revisions.current.route += 1
  }, [])

  const beginIntent = useCallback(() => {
    revisions.current.intent += 1
  }, [])

  const failed = useCallback(
    (
      target: TravelAuthorityTarget,
      kind: AuthorityKind,
      channel: TravelRequestChannel,
      message: string
    ): boolean => {
      if (!isCurrent(target, kind)) return false
      publish({ type: 'request-failed', channel, message })
      return true
    },
    [isCurrent, publish]
  )

  const acceptContext = useCallback(
    (input: {
      target: TravelAuthorityTarget
      result: TravelProviderReadResult<S>
      descriptor: TravelProviderDescriptor<P>
      mapId: string | null
      map: M | null
      describe: (state: S) => TravelProviderDescriptor<P>
    }): boolean => {
      if (!isCurrent(input.target)) return false
      const intentIsCurrent = isCurrent(input.target, 'intent')
      const publicationIsCurrent =
        input.target.publicationRevision === revisions.current.publication
      if (
        remoteVersionIsOlder(
          stateRef.current.providerState,
          input.result.providerState,
          snapshotRef.current,
          input.result.session,
          input.describe,
          !intentIsCurrent || !publicationIsCurrent
        )
      )
        return false
      publishSessionIfCurrent(input.result.session, snapshotRef, setSnapshotRef)
      if (intentIsCurrent)
        publish({
          type: 'projection-loaded',
          providerState: input.result.providerState,
          mapId: input.mapId,
          map: input.map,
          multiplier: input.descriptor.multiplier
        })
      else
        publish({
          type: 'provider-reconciled',
          providerState: input.result.providerState,
          multiplier: input.descriptor.multiplier,
          preserveLocal: true
        })
      revisions.current.publication += 1
      return true
    },
    [isCurrent, publish]
  )

  const acceptCommand = useCallback(
    (input: {
      target: TravelAuthorityTarget
      result: TravelProviderReadResult<S>
      descriptor: TravelProviderDescriptor<P>
      clearDraft: boolean
      describe: (state: S) => TravelProviderDescriptor<P>
    }): boolean => {
      if (!isCurrent(input.target)) return false
      if (
        remoteVersionIsOlder(
          stateRef.current.providerState,
          input.result.providerState,
          snapshotRef.current,
          input.result.session,
          input.describe,
          false
        )
      )
        return false
      publishSessionIfCurrent(input.result.session, snapshotRef, setSnapshotRef)
      publish({
        type: 'command-applied',
        providerState: input.result.providerState,
        multiplier: input.descriptor.multiplier,
        clearDraft: input.clearDraft,
        preserveLocal: !isCurrent(input.target, 'intent')
      })
      revisions.current.publication += 1
      return true
    },
    [isCurrent, publish]
  )

  const started = useCallback(
    (channel: TravelRequestChannel) =>
      publish({ type: 'request-started', channel }),
    [publish]
  )

  const acceptMap = useCallback(
    (target: TravelAuthorityTarget, map: M, selected: boolean) => {
      const kind = selected ? 'intent' : 'map'
      if (!isCurrent(target, kind)) return false
      publish(
        selected
          ? { type: 'map-selected', mapId: target.mapId!, map }
          : { type: 'map-refreshed', map }
      )
      return true
    },
    [isCurrent, publish]
  )

  const acceptEvaluation = useCallback(
    (target: TravelAuthorityTarget, evaluation: E) => {
      if (!isCurrent(target, 'route')) return false
      publish({ type: 'evaluated', evaluation })
      return true
    },
    [isCurrent, publish]
  )

  return {
    state,
    read,
    sceneRevision,
    capture,
    isCurrent,
    activate,
    deactivate,
    beginIntent,
    beginMapIntent,
    started,
    failed,
    acceptContext,
    acceptCommand,
    acceptMap,
    acceptEvaluation,
    local
  }
}

export type TravelViewProjection<P, S, M, E> = ReturnType<
  typeof useTravelViewProjection<P, S, M, E>
>

function remoteVersionIsOlder<P, S>(
  current: S | null,
  next: S,
  currentSession: LiveSessionSnapshot,
  nextSession: LiveSessionSnapshot,
  describe: (state: S) => TravelProviderDescriptor<P>,
  requireNewer = false
): boolean {
  if (current === null) return false
  const currentRevision = describe(current).revision
  const nextRevision = describe(next).revision
  if (nextRevision !== currentRevision) return nextRevision < currentRevision
  if (nextSession.scene.focusedSceneId !== currentSession.scene.focusedSceneId)
    return true
  return requireNewer
    ? nextSession.scene.revision <= currentSession.scene.revision
    : nextSession.scene.revision < currentSession.scene.revision
}

function publishSessionIfCurrent(
  next: LiveSessionSnapshot,
  snapshotRef: React.RefObject<LiveSessionSnapshot>,
  setSnapshotRef: React.RefObject<(snapshot: LiveSessionSnapshot) => void>
): void {
  const current = snapshotRef.current
  if (
    next.scene.focusedSceneId !== current.scene.focusedSceneId ||
    next.scene.revision < current.scene.revision
  )
    return
  snapshotRef.current = next
  setSnapshotRef.current(next)
}
