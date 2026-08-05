import { useEffect, useRef } from 'react'
import type {
  WorldLocationMapPresentation,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import type { HexCapabilities } from './hex-capabilities.js'

const debounceMilliseconds = 180

/** Owns optimistic presentation drafts, coalescing, flush and conflict recovery. */
export function useLocationPresentationController(props: {
  locations: WorldLocationSnapshot | null
  setLocations: (snapshot: WorldLocationSnapshot) => void
  capabilities: HexCapabilities['locations']
  onError: (cause: unknown) => void
}) {
  const locationsRef = useRef(props.locations)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const versions = useRef(new Map<string, number>())
  const writes = useRef(new Set<string>())
  useEffect(() => {
    locationsRef.current = props.locations
  }, [props.locations])
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer)
    },
    []
  )

  const setSnapshot = (snapshot: WorldLocationSnapshot) => {
    locationsRef.current = snapshot
    props.setLocations(snapshot)
  }

  const mergeExternal = (snapshot: WorldLocationSnapshot) => {
    const local = locationsRef.current
    if (!local) return setSnapshot(snapshot)
    setSnapshot({
      ...snapshot,
      locations: snapshot.locations.map((location) =>
        timers.current.has(location.id) || writes.current.has(location.id)
          ? {
              ...location,
              mapPresentation:
                local.locations.find((entry) => entry.id === location.id)
                  ?.mapPresentation ?? location.mapPresentation
            }
          : location
      )
    })
  }

  const persist = async (id: string, requestedVersion: number) => {
    const snapshot = locationsRef.current
    const presentation = snapshot?.locations.find(
      (location) => location.id === id
    )?.mapPresentation
    if (!snapshot || !presentation) return
    writes.current.add(id)
    try {
      const result = await props.capabilities.updateMapPresentation(
        id,
        {
          titleOverride: presentation.titleOverride,
          symbolId: presentation.symbolId,
          symbolSize: presentation.symbolSize,
          labelCurve: presentation.labelCurve,
          labelPosition: presentation.labelPosition
        },
        presentation.revision
      )
      const superseded = versions.current.get(id) !== requestedVersion
      const current = locationsRef.current
      if (!current) return
      setSnapshot({
        ...current,
        locations: current.locations.map((location) =>
          location.id === id
            ? {
                ...location,
                mapPresentation: superseded
                  ? { ...location.mapPresentation, revision: result.revision }
                  : result
              }
            : location
        )
      })
      if (superseded) {
        const latest = versions.current.get(id)!
        timers.current.set(
          id,
          setTimeout(() => void persist(id, latest), 0)
        )
      } else timers.current.delete(id)
    } catch (cause) {
      timers.current.delete(id)
      versions.current.delete(id)
      try {
        setSnapshot(await props.capabilities.read())
      } catch (recoveryCause) {
        props.onError(recoveryCause)
      }
      props.onError(cause)
      if (capabilityErrorCode(cause) === 'stale') return
    } finally {
      writes.current.delete(id)
    }
  }

  const update = (id: string, presentation: WorldLocationMapPresentation) => {
    const current = locationsRef.current
    if (!current) return
    setSnapshot({
      ...current,
      locations: current.locations.map((location) =>
        location.id === id
          ? { ...location, mapPresentation: presentation }
          : location
      )
    })
    const version = (versions.current.get(id) ?? 0) + 1
    versions.current.set(id, version)
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.set(
      id,
      setTimeout(() => void persist(id, version), debounceMilliseconds)
    )
  }

  const flush = (id: string) => {
    const timer = timers.current.get(id)
    if (!timer) return
    clearTimeout(timer)
    timers.current.delete(id)
    void persist(id, versions.current.get(id) ?? 0)
  }

  return { locationsRef, setSnapshot, mergeExternal, update, flush }
}
