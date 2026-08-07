import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WorldLocationMapPresentation,
  WorldLocationSaveReceipt,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import type { HexCapabilities } from './hex-capabilities.js'

const debounceMilliseconds = 180

/** Sole owner of the Hex workspace's World Location projection. */
export function useWorldLocationProjectionController(options: {
  capabilities: HexCapabilities['locations']
  onError: (cause: unknown) => void
}) {
  const optionsRef = useRef(options)
  const snapshotRef = useRef<WorldLocationSnapshot | null>(null)
  const [snapshot, setSnapshotState] = useState<WorldLocationSnapshot | null>(
    null
  )
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const versions = useRef(new Map<string, number>())
  const writes = useRef(new Set<string>())

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const replace = useCallback((next: WorldLocationSnapshot) => {
    snapshotRef.current = next
    setSnapshotState(next)
  }, [])

  const mergeExternal = useCallback(
    (incoming: WorldLocationSnapshot) => {
      const local = snapshotRef.current
      if (local && incoming.revision < local.revision) return
      if (!local) return replace(incoming)
      replace({
        ...incoming,
        locations: incoming.locations.map((location) => {
          if (
            !timers.current.has(location.id) &&
            !writes.current.has(location.id)
          )
            return location
          const localLocation = local.locations.find(
            (candidate) => candidate.id === location.id
          )
          return localLocation
            ? { ...location, mapPresentation: localLocation.mapPresentation }
            : location
        })
      })
    },
    [replace]
  )

  const applyCreated = useCallback(
    (result: WorldLocationSaveReceipt) => mergeExternal(result.snapshot),
    [mergeExternal]
  )

  async function persist(id: string, requestedVersion: number) {
    const current = snapshotRef.current
    const presentation = current?.locations.find(
      (location) => location.id === id
    )?.mapPresentation
    if (!current || !presentation) return
    writes.current.add(id)
    try {
      const result =
        await optionsRef.current.capabilities.updateMapPresentation(
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
      const latest = snapshotRef.current
      if (!latest) return
      replace({
        ...latest,
        locations: latest.locations.map((location) =>
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
        const version = versions.current.get(id)!
        timers.current.set(
          id,
          setTimeout(() => void persist(id, version), 0)
        )
      } else timers.current.delete(id)
    } catch (cause) {
      timers.current.delete(id)
      versions.current.delete(id)
      try {
        replace(await optionsRef.current.capabilities.read())
      } catch (recoveryCause) {
        optionsRef.current.onError(recoveryCause)
      }
      optionsRef.current.onError(cause)
    } finally {
      writes.current.delete(id)
    }
  }

  const updatePresentation = (
    id: string,
    presentation: WorldLocationMapPresentation
  ) => {
    const current = snapshotRef.current
    if (!current) return
    replace({
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

  const flushPresentation = (id: string) => {
    const timer = timers.current.get(id)
    if (!timer) return
    clearTimeout(timer)
    timers.current.delete(id)
    void persist(id, versions.current.get(id) ?? 0)
  }

  const applySymbolAssignment = (
    id: string,
    symbolId: string,
    revision: number
  ) => {
    const current = snapshotRef.current
    if (!current) return
    replace({
      ...current,
      locations: current.locations.map((location) =>
        location.id === id
          ? {
              ...location,
              mapPresentation: {
                ...location.mapPresentation,
                symbolId,
                revision
              }
            }
          : location
      )
    })
  }

  useEffect(
    () =>
      options.capabilities.onChanged(() => {
        void options.capabilities
          .read()
          .then(mergeExternal)
          .catch(optionsRef.current.onError)
      }),
    [mergeExternal, options.capabilities]
  )
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer)
    },
    []
  )

  return {
    snapshot,
    snapshotRef,
    replace,
    mergeExternal,
    applyCreated,
    updatePresentation,
    flushPresentation,
    applySymbolAssignment
  }
}
