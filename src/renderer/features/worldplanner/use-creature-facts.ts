import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { CreatureFactsPort } from './world-faction-editor-types.js'

export type CreatureFactResource =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; value: Creature }>
  | Readonly<{ status: 'failed'; cause: unknown }>

const maximumConcurrentFactRequests = 8

export function useCreatureFacts(
  ids: readonly string[],
  port: CreatureFactsPort
) {
  const [resources, setResources] = useState<
    Readonly<Record<string, CreatureFactResource>>
  >({})
  const [retryVersion, setRetryVersion] = useState(0)
  const resourcesRef = useRef(resources)
  const portRef = useRef(port)
  const mounted = useRef(true)
  const queue = useRef<string[]>([])
  const queued = useRef(new Set<string>())
  const active = useRef(0)
  const drainRef = useRef<() => void>(() => undefined)
  const key = useMemo(() => [...new Set(ids)].toSorted().join('\u0000'), [ids])

  useEffect(() => {
    resourcesRef.current = resources
  }, [resources])
  useEffect(() => {
    portRef.current = port
  }, [port])

  const update = useCallback((id: string, resource: CreatureFactResource) => {
    if (!mounted.current) return
    setResources((known) => {
      const next = { ...known, [id]: resource }
      resourcesRef.current = next
      return next
    })
  }, [])

  const drain = useCallback(() => {
    while (
      active.current < maximumConcurrentFactRequests &&
      queue.current.length > 0
    ) {
      const id = queue.current.shift()!
      queued.current.delete(id)
      active.current += 1
      void portRef.current
        .detail(id)
        .then(
          (value) => update(id, { status: 'ready', value }),
          (cause: unknown) => update(id, { status: 'failed', cause })
        )
        .finally(() => {
          active.current -= 1
          drainRef.current()
        })
    }
  }, [update])
  useEffect(() => {
    drainRef.current = drain
  }, [drain])

  useEffect(() => {
    const requested = key.split('\u0000').filter(Boolean)
    const requestedSet = new Set(requested)
    const dropped = queue.current.filter((id) => !requestedSet.has(id))
    queue.current = queue.current.filter((id) => requestedSet.has(id))
    queued.current = new Set(queue.current)
    if (dropped.length > 0) {
      const next = { ...resourcesRef.current }
      for (const id of dropped) next[id] = { status: 'idle' }
      resourcesRef.current = next
      setResources(next)
    }
    const missing = requested.filter(
      (id) =>
        (resourcesRef.current[id]?.status ?? 'idle') === 'idle' &&
        !queued.current.has(id)
    )
    if (missing.length === 0) return
    setResources((known) => {
      const next = {
        ...known,
        ...Object.fromEntries(
          missing.map((id) => [id, { status: 'loading' as const }])
        )
      }
      resourcesRef.current = next
      return next
    })
    for (const id of missing) {
      queued.current.add(id)
      queue.current.push(id)
    }
    drain()
  }, [drain, key, retryVersion])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const retry = useCallback((id: string) => {
    setResources((known) => {
      const next = { ...known, [id]: { status: 'idle' as const } }
      resourcesRef.current = next
      return next
    })
    setRetryVersion((version) => version + 1)
  }, [])

  return { resources, retry }
}
