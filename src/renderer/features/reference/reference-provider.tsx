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
  type PinnedReference,
  type ReferenceNavigation,
  type ReferenceNavigationEntry,
  type ReferenceOverlayCard
} from './reference-context.js'
import {
  compileReferenceIndex,
  referenceTargetKey,
  type ReferenceMatch
} from './reference-matcher.js'
import { message } from '../../i18n/messages.de.js'
import './reference.css'

const edge = 12
const loadReferenceRuntime = () => import('./reference-runtime.js')
const LazyReferenceRuntime = lazy(loadReferenceRuntime)
const emptyNavigation: ReferenceNavigation = {
  entries: [],
  index: -1,
  document: null,
  loading: false
}
const emptyPins: readonly PinnedReference[] = []

export function ReferenceProvider(props: {
  children: ReactNode
  capability: SaltMarcherApi['references']
  campaignId: string | null
  sceneId: string | null
  activateReference: () => void
  onError: (message: string) => void
}) {
  const { capability, onError, sceneId, activateReference } = props
  const [staticIndex, setStaticIndex] = useState<ReferenceIndex | null>(null)
  const [campaignIndices, setCampaignIndices] = useState<
    Readonly<Record<string, ReferenceIndex>>
  >({})
  const [pinsByCampaign, setPinsByCampaign] = useState<
    Readonly<Record<string, readonly PinnedReference[]>>
  >({})
  const [navigationByScope, setNavigationByScope] = useState<
    Readonly<Record<string, ReferenceNavigation>>
  >({})
  const [overlays, setOverlays] = useState<readonly ReferenceOverlayCard[]>([])
  const [cacheRevision, setCacheRevision] = useState(0)
  const staticRequest = useRef(0)
  const campaignRequest = useRef(0)
  const staticDetails = useRef(new Map<string, Promise<ReferenceDocument>>())
  const campaignDetails = useRef(
    new Map<string, Map<string, Promise<ReferenceDocument>>>()
  )
  const zCounter = useRef(1)
  const navigationRequest = useRef(0)
  const overlayCloseTimer = useRef<number | null>(null)
  const campaignId = props.campaignId
  const campaignIndex = campaignId
    ? (campaignIndices[campaignId] ?? null)
    : null
  const navigationKey =
    campaignId && sceneId ? `${campaignId}:${sceneId}` : null

  useEffect(() => {
    const token = ++staticRequest.current
    void capability
      .staticIndex()
      .then((next) => {
        if (staticRequest.current === token) setStaticIndex(next)
      })
      .catch(() => {
        if (staticRequest.current === token)
          onError(message('reference.indexFailed'))
      })
  }, [capability, onError])

  useEffect(() => {
    const token = ++campaignRequest.current
    if (!campaignId) return
    const refresh = () => {
      void capability
        .campaignIndex(campaignId)
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

  const storeNavigation = useCallback(
    (
      key: string,
      entry: ReferenceNavigationEntry,
      document: ReferenceDocument
    ) => {
      setNavigationByScope((current) => {
        const previous = current[key] ?? emptyNavigation
        const active = previous.entries[previous.index]
        if (
          active &&
          referenceTargetKey(active.target) ===
            referenceTargetKey(entry.target) &&
          active.breadcrumb === entry.breadcrumb
        )
          return {
            ...current,
            [key]: { ...previous, document, loading: false }
          }
        const appended = [
          ...previous.entries.slice(0, previous.index + 1),
          entry
        ]
        const entries = appended.slice(-100)
        return {
          ...current,
          [key]: {
            entries,
            index: entries.length - 1,
            document,
            loading: false
          }
        }
      })
    },
    []
  )

  const openReference = useCallback(
    (target: ReferenceTarget, breadcrumb: string) => {
      if (!navigationKey) return
      const token = ++navigationRequest.current
      activateReference()
      setNavigationByScope((current) => ({
        ...current,
        [navigationKey]: {
          ...(current[navigationKey] ?? emptyNavigation),
          loading: true
        }
      }))
      void loadDetail(target)
        .then((document) => {
          if (navigationRequest.current === token)
            storeNavigation(navigationKey, { target, breadcrumb }, document)
        })
        .catch(() => {
          if (navigationRequest.current === token) {
            setNavigationByScope((current) => ({
              ...current,
              [navigationKey]: {
                ...(current[navigationKey] ?? emptyNavigation),
                loading: false
              }
            }))
            onError(message('reference.unavailable'))
          }
        })
    },
    [activateReference, loadDetail, navigationKey, onError, storeNavigation]
  )

  const moveNavigation = useCallback(
    (offset: number) => {
      if (!navigationKey) return
      const current = navigationByScope[navigationKey] ?? emptyNavigation
      const index = Math.max(
        -1,
        Math.min(current.entries.length - 1, current.index + offset)
      )
      if (index === current.index) return
      const entry = current.entries[index]
      setNavigationByScope((state) => ({
        ...state,
        [navigationKey]: { ...current, index, document: null, loading: !!entry }
      }))
      if (!entry) return
      const token = ++navigationRequest.current
      void loadDetail(entry.target)
        .then((document) => {
          if (navigationRequest.current !== token) return
          setNavigationByScope((state) => ({
            ...state,
            [navigationKey]: {
              ...(state[navigationKey] ?? current),
              document,
              loading: false
            }
          }))
        })
        .catch(() => onError(message('reference.unavailable')))
    },
    [loadDetail, navigationByScope, navigationKey, onError]
  )

  const closeNavigation = useCallback(() => {
    if (!navigationKey) return
    setNavigationByScope((current) => ({
      ...current,
      [navigationKey]: emptyNavigation
    }))
  }, [navigationKey])

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

  const updateCurrentPins = useCallback(
    (
      update: (pins: readonly PinnedReference[]) => readonly PinnedReference[]
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
    (id: string) =>
      updateCurrentPins((current) =>
        current.map((pin) =>
          pin.id === id ? { ...pin, z: ++zCounter.current } : pin
        )
      ),
    [updateCurrentPins]
  )
  const movePin = useCallback(
    (id: string, x: number, y: number) =>
      updateCurrentPins((current) =>
        current.map((pin) =>
          pin.id === id
            ? {
                ...pin,
                x: clamp(x, edge, Math.max(edge, window.innerWidth - edge)),
                y: clamp(y, edge, Math.max(edge, window.innerHeight - edge))
              }
            : pin
        )
      ),
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
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            target,
            x: anchor ? anchor.right + 10 : 80 + cascade * 24,
            y: anchor ? anchor.top : 96 + cascade * 24,
            z: ++zCounter.current
          }
        ]
      })
    },
    [updateCurrentPins]
  )

  useEffect(() => {
    if (!staticIndex) return
    const idle = window.requestIdleCallback?.(() => void loadReferenceRuntime())
    if (idle !== undefined) return () => window.cancelIdleCallback?.(idle)
    const timer = window.setTimeout(() => void loadReferenceRuntime(), 1_500)
    return () => window.clearTimeout(timer)
  }, [staticIndex])

  const pins = campaignId
    ? (pinsByCampaign[campaignId] ?? emptyPins)
    : emptyPins
  const visibleOverlays = useMemo(
    () =>
      overlays.filter((card) => card.scopeKey === (navigationKey ?? 'none')),
    [navigationKey, overlays]
  )
  const navigation = navigationKey
    ? (navigationByScope[navigationKey] ?? emptyNavigation)
    : emptyNavigation
  const currentNavigationTarget = navigation.entries[navigation.index]?.target
  const currentNavigationTargetKey = currentNavigationTarget
    ? referenceTargetKey(currentNavigationTarget)
    : null
  useEffect(() => {
    if (!navigationKey || !currentNavigationTarget || cacheRevision === 0)
      return
    let current = true
    void loadDetail(currentNavigationTarget)
      .then((document) => {
        if (!current) return
        setNavigationByScope((state) => {
          const navigationState = state[navigationKey]
          const target = navigationState?.entries[navigationState.index]?.target
          if (
            !target ||
            referenceTargetKey(target) !== currentNavigationTargetKey
          )
            return state
          return {
            ...state,
            [navigationKey]: {
              ...navigationState,
              document,
              loading: false
            }
          }
        })
      })
      .catch(() => {
        if (!current) return
        setNavigationByScope((state) => ({
          ...state,
          [navigationKey]: {
            ...(state[navigationKey] ?? emptyNavigation),
            document: null,
            loading: false
          }
        }))
      })
    return () => {
      current = false
    }
  }, [
    cacheRevision,
    currentNavigationTarget,
    currentNavigationTargetKey,
    loadDetail,
    navigationKey
  ])
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
      pinReference,
      closePin,
      movePin,
      raisePin,
      pins,
      navigation,
      moveNavigation,
      closeNavigation,
      cacheRevision
    }),
    [
      cacheRevision,
      campaignId,
      cancelOverlayClose,
      closeNavigation,
      closeOverlayBranch,
      closePin,
      compiled,
      loadDetail,
      moveNavigation,
      movePin,
      navigation,
      openOverlay,
      openReference,
      visibleOverlays,
      pinReference,
      pins,
      raisePin,
      scheduleOverlayClose
    ]
  )

  return (
    <ReferenceContext.Provider value={value}>
      {props.children}
      {(visibleOverlays.length > 0 || pins.length > 0) && (
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
