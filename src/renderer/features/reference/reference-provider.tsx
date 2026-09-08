import {
  lazy,
  Suspense,
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
  ReferenceIndex,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import {
  ReferenceContext,
  type ReferenceOverlayCard
} from './reference-context.js'
import {
  compileReferenceIndex,
  referenceTargetKey,
  type ReferenceMatch
} from './reference-matcher.js'
import { message } from '../../i18n/reference-runtime.de.js'
import './reference.css'

const loadReferenceRuntime = () => import('./reference-runtime.js')
const LazyReferenceRuntime = lazy(loadReferenceRuntime)
export function ReferenceProvider(props: {
  children: ReactNode
  enabled?: boolean
  capability: SaltMarcherApi['references']
  campaignId: string | null
  sceneId: string | null
  routeReference: (
    target: ReferenceTarget,
    title: string | undefined,
    separate: boolean
  ) => void
  onError: (message: string) => void
}) {
  const { capability, onError, sceneId, routeReference } = props
  const enabled = props.enabled ?? true
  const [staticIndex, setStaticIndex] = useState<ReferenceIndex | null>(null)
  const [campaignIndices, setCampaignIndices] = useState<
    Readonly<Record<string, ReferenceIndex>>
  >({})
  const [overlays, setOverlays] = useState<readonly ReferenceOverlayCard[]>([])
  const [cacheRevision, setCacheRevision] = useState(0)
  const staticRequest = useRef(0)
  const campaignRequest = useRef(0)
  const staticDetails = useRef(new Map<string, Promise<ReferenceDocument>>())
  const campaignDetails = useRef(
    new Map<string, Map<string, Promise<ReferenceDocument>>>()
  )
  const overlayCloseTimer = useRef<number | null>(null)
  const campaignId = enabled ? props.campaignId : null
  const campaignIndex = campaignId
    ? (campaignIndices[campaignId] ?? null)
    : null
  const navigationKey =
    campaignId && sceneId ? `${campaignId}:${sceneId}` : null

  useEffect(() => {
    const token = ++staticRequest.current
    if (!enabled) return
    void capability
      .staticIndex()
      .then((next) => {
        if (staticRequest.current === token) setStaticIndex(next)
      })
      .catch(() => {
        if (staticRequest.current === token)
          onError(message('reference.indexFailed'))
      })
  }, [capability, enabled, onError])

  useEffect(() => {
    const token = ++campaignRequest.current
    if (!campaignId) return
    const refresh = () => {
      void capability
        .campaignIndex({ campaignId })
        .then((next) => {
          if (campaignRequest.current === token)
            setCampaignIndices((current) => ({
              ...current,
              [campaignId]: next
            }))
        })
        .catch(() => {
          if (campaignRequest.current === token)
            onError(message('reference.indexFailed'))
        })
    }
    refresh()
    return capability.onCampaignIndexChanged((notice) => {
      if (notice.campaignId !== campaignId) return
      const cache = campaignDetails.current.get(campaignId)
      for (const target of notice.changedTargets) {
        cache?.delete(referenceTargetKey(target))
      }
      if (notice.changedTargets.length > 0)
        setCacheRevision((current) => current + 1)
      refresh()
    })
  }, [campaignId, capability, onError])

  const compiledStatic = useMemo(
    () => (staticIndex ? compileReferenceIndex(staticIndex) : null),
    [staticIndex]
  )
  const compiledCampaign = useMemo(
    () => (campaignIndex ? compileReferenceIndex(campaignIndex) : null),
    [campaignIndex]
  )
  const compiled = useMemo(
    () =>
      compiledStatic
        ? compiledCampaign
          ? [compiledStatic, compiledCampaign]
          : [compiledStatic]
        : null,
    [compiledCampaign, compiledStatic]
  )

  const loadDetail = useCallback(
    (target: ReferenceTarget) => {
      const key = referenceTargetKey(target)
      const cache =
        target.scope === 'campaign'
          ? campaignCache(campaignDetails.current, target.campaignId)
          : staticDetails.current
      const existing = cache.get(key)
      if (existing) return existing
      const pending = capability.detail(target)
      cache.set(key, pending)
      void pending.catch(() => {
        if (cache.get(key) === pending) cache.delete(key)
      })
      trimCache(cache, 128)
      return pending
    },
    [capability]
  )

  const openReference = useCallback(
    (target: ReferenceTarget, breadcrumb: string) =>
      routeReference(target, breadcrumb, false),
    [routeReference]
  )

  const openOverlay = useCallback(
    (
      anchor: HTMLElement,
      match: ReferenceMatch,
      path: readonly ReferenceTarget[],
      parentId?: string
    ) => {
      setOverlays((current) => {
        const parentIndex = parentId
          ? current.findIndex((card) => card.id === parentId)
          : -1
        const retained = parentId ? current.slice(0, parentIndex + 1) : []
        return [
          ...retained,
          {
            id: crypto.randomUUID(),
            parentId: parentId ?? null,
            anchor,
            match,
            path,
            scopeKey: navigationKey ?? 'none'
          }
        ]
      })
    },
    [navigationKey]
  )
  const closeOverlayBranch = useCallback((parentId?: string) => {
    setOverlays((current) => {
      if (!parentId) return []
      const index = current.findIndex((card) => card.id === parentId)
      return index < 0 ? current : current.slice(0, index + 1)
    })
  }, [])
  const cancelOverlayClose = useCallback(() => {
    if (overlayCloseTimer.current !== null)
      window.clearTimeout(overlayCloseTimer.current)
    overlayCloseTimer.current = null
  }, [])
  const scheduleOverlayClose = useCallback(
    (parentId?: string) => {
      cancelOverlayClose()
      overlayCloseTimer.current = window.setTimeout(() => {
        overlayCloseTimer.current = null
        closeOverlayBranch(parentId)
      }, 150)
    },
    [cancelOverlayClose, closeOverlayBranch]
  )

  const openSeparateReference = useCallback(
    (target: ReferenceTarget) =>
      routeReference(
        target,
        compiled
          ?.flatMap((index) => index.terms)
          .flatMap((term) => term.candidates)
          .find(
            (candidate) =>
              referenceTargetKey(candidate.target) ===
              referenceTargetKey(target)
          )?.title,
        true
      ),
    [routeReference, compiled]
  )

  useEffect(() => {
    if (!enabled || !staticIndex) return
    const idle = window.requestIdleCallback?.(() => void loadReferenceRuntime())
    if (idle !== undefined) return () => window.cancelIdleCallback?.(idle)
    const timer = window.setTimeout(() => void loadReferenceRuntime(), 1_500)
    return () => window.clearTimeout(timer)
  }, [enabled, staticIndex])

  const visibleOverlays = useMemo(
    () =>
      overlays.filter((card) => card.scopeKey === (navigationKey ?? 'none')),
    [navigationKey, overlays]
  )
  const value = useMemo(
    () => ({
      compiled,
      campaignId,
      loadDetail,
      openReference,
      openOverlay,
      closeOverlayBranch,
      scheduleOverlayClose,
      cancelOverlayClose,
      overlays: visibleOverlays,
      openSeparateReference,
      cacheRevision
    }),
    [
      cacheRevision,
      campaignId,
      cancelOverlayClose,
      closeOverlayBranch,
      compiled,
      loadDetail,
      openOverlay,
      openReference,
      visibleOverlays,
      openSeparateReference,
      scheduleOverlayClose
    ]
  )

  return (
    <ReferenceContext.Provider value={value}>
      {props.children}
      {enabled && visibleOverlays.length > 0 && (
        <Suspense fallback={null}>
          <LazyReferenceRuntime />
        </Suspense>
      )}
    </ReferenceContext.Provider>
  )
}

function campaignCache(
  caches: Map<string, Map<string, Promise<ReferenceDocument>>>,
  campaignId: string
): Map<string, Promise<ReferenceDocument>> {
  const existing = caches.get(campaignId)
  if (existing) return existing
  const created = new Map<string, Promise<ReferenceDocument>>()
  caches.set(campaignId, created)
  return created
}

function trimCache(
  cache: Map<string, Promise<ReferenceDocument>>,
  maximum: number
): void {
  while (cache.size > maximum) {
    const oldest = cache.keys().next().value
    if (!oldest) return
    cache.delete(oldest)
  }
}
