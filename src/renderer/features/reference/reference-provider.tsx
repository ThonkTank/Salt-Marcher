import { FloatingTree } from '@floating-ui/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  ReferenceDocument,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import { ReferenceContext, type PinnedReference } from './reference-context.js'
import {
  compileReferenceIndex,
  referenceTargetKey
} from './reference-matcher.js'
import { ReferencePinnedWindow } from './reference-ui.js'
import { message } from '../../i18n/messages.de.js'
import './reference.css'

const pinWidth = 352
const pinHeight = 384
const edge = 12

export function ReferenceProvider(props: {
  children: ReactNode
  capability: SaltMarcherApi['references']
  campaignId: string | null
  refreshKey: string | number
  openReference: (target: ReferenceTarget, breadcrumb: string) => void
  onError: (message: string) => void
}) {
  const [index, setIndex] = useState<Awaited<
    ReturnType<SaltMarcherApi['references']['index']>
  > | null>(null)
  const [pinsByCampaign, setPinsByCampaign] = useState<
    Readonly<Record<string, readonly PinnedReference[]>>
  >({})
  const request = useRef(0)
  const cache = useRef(new Map<string, Promise<ReferenceDocument>>())
  const zCounter = useRef(1)
  const campaignId = props.campaignId
  const onError = props.onError

  useEffect(() => {
    const token = ++request.current
    // The external campaign index must be cleared before publishing the next one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(null)
    if (!campaignId) return
    void props.capability
      .index()
      .then((next) => {
        if (request.current === token) setIndex(next)
      })
      .catch(() => {
        if (request.current === token) onError(message('reference.indexFailed'))
      })
  }, [campaignId, onError, props.capability, props.refreshKey])

  const compiled = useMemo(
    () => (index ? compileReferenceIndex(index) : null),
    [index]
  )

  const loadDetail = useCallback(
    (target: ReferenceTarget) => {
      const key = `${campaignId ?? 'none'}:${index?.revision ?? 'loading'}:${referenceTargetKey(target)}`
      const existing = cache.current.get(key)
      if (existing) {
        cache.current.delete(key)
        cache.current.set(key, existing)
        return existing
      }
      const pending = props.capability.detail(target)
      cache.current.set(key, pending)
      void pending.catch(() => {
        if (cache.current.get(key) === pending) cache.current.delete(key)
      })
      while (cache.current.size > 128) {
        const oldest = cache.current.keys().next().value
        if (!oldest) break
        cache.current.delete(oldest)
      }
      return pending
    },
    [campaignId, index?.revision, props.capability]
  )

  const updateCurrentPins = useCallback(
    (
      update: (
        current: readonly PinnedReference[]
      ) => readonly PinnedReference[]
    ) => {
      if (!campaignId) return
      setPinsByCampaign((current) => ({
        ...current,
        [campaignId]: update(current[campaignId] ?? [])
      }))
    },
    [campaignId]
  )

  const raisePin = useCallback(
    (id: string) => {
      updateCurrentPins((current) =>
        current.map((pin) =>
          pin.id === id ? { ...pin, z: ++zCounter.current } : pin
        )
      )
    },
    [updateCurrentPins]
  )

  const movePin = useCallback(
    (id: string, x: number, y: number) => {
      updateCurrentPins((current) =>
        current.map((pin) =>
          pin.id === id
            ? {
                ...pin,
                x: clamp(
                  x,
                  edge,
                  Math.max(edge, window.innerWidth - pinWidth - edge)
                ),
                y: clamp(
                  y,
                  edge,
                  Math.max(edge, window.innerHeight - pinHeight - edge)
                )
              }
            : pin
        )
      )
    },
    [updateCurrentPins]
  )

  const closePin = useCallback(
    (id: string) =>
      updateCurrentPins((current) => current.filter((pin) => pin.id !== id)),
    [updateCurrentPins]
  )

  const pinReference = useCallback(
    (
      target: ReferenceTarget,
      title: string,
      anchor: Readonly<{ right: number; top: number }> | null
    ) => {
      updateCurrentPins((current) => {
        const existing = current.find(
          (pin) => referenceTargetKey(pin.target) === referenceTargetKey(target)
        )
        if (existing)
          return current.map((pin) =>
            pin.id === existing.id ? { ...pin, z: ++zCounter.current } : pin
          )
        const cascade = current.length % 7
        const desiredX = anchor ? anchor.right + 10 : 80 + cascade * 24
        const desiredY = anchor ? anchor.top : 96 + cascade * 24
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            target,
            title,
            x: clamp(
              desiredX,
              edge,
              Math.max(edge, window.innerWidth - pinWidth - edge)
            ),
            y: clamp(
              desiredY,
              edge,
              Math.max(edge, window.innerHeight - pinHeight - edge)
            ),
            z: ++zCounter.current
          }
        ]
      })
    },
    [updateCurrentPins]
  )

  useEffect(() => {
    const resized = () =>
      updateCurrentPins((current) =>
        current.map((pin) => ({
          ...pin,
          x: clamp(
            pin.x,
            edge,
            Math.max(edge, window.innerWidth - pinWidth - edge)
          ),
          y: clamp(
            pin.y,
            edge,
            Math.max(edge, window.innerHeight - pinHeight - edge)
          )
        }))
      )
    window.addEventListener('resize', resized)
    return () => window.removeEventListener('resize', resized)
  }, [updateCurrentPins])

  const pins = useMemo(
    () => (campaignId ? (pinsByCampaign[campaignId] ?? []) : []),
    [campaignId, pinsByCampaign]
  )
  const value = useMemo(
    () => ({
      compiled,
      campaignId,
      loadDetail,
      openReference: props.openReference,
      pinReference,
      closePin,
      movePin,
      raisePin,
      pins
    }),
    [
      campaignId,
      closePin,
      compiled,
      loadDetail,
      movePin,
      pinReference,
      pins,
      props.openReference,
      raisePin
    ]
  )

  return (
    <ReferenceContext.Provider value={value}>
      <FloatingTree>
        {props.children}
        <div className="reference-pin-layer" aria-live="polite">
          {pins.map((pin) => (
            <ReferencePinnedWindow key={pin.id} pin={pin} />
          ))}
        </div>
      </FloatingTree>
    </ReferenceContext.Provider>
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
