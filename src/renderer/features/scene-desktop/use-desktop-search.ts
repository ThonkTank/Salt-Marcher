import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReferenceCandidate } from '../../../shared/contracts/reference.js'
import type { ReferenceContextValue } from '../reference/reference-context.js'
import {
  referenceTargetKey,
  searchReferenceIndices
} from '../reference/reference-matcher.js'

type State = Readonly<{
  key: string
  candidates: readonly ReferenceCandidate[]
  total: number
  failed: boolean
  loadingMore: boolean
}>
const empty: State = {
  key: '',
  candidates: [],
  total: 0,
  failed: false,
  loadingMore: false
}

/** Notes stay in Core; only matching identities cross the capability bridge. */
export function useDesktopSearch(
  reference: ReferenceContextValue,
  query: string
) {
  const normalized = query.trim()
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<State>(empty)
  const [visible, setVisible] = useState({ key: '', count: 100 })
  const generation = useRef(0)
  const key = JSON.stringify([
    reference.campaignId,
    normalized,
    reference.cacheRevision,
    retry
  ])
  const searchCampaign = reference.searchCampaign
  const campaignId = reference.campaignId
  useEffect(() => {
    const token = ++generation.current
    if (!campaignId || !normalized) return
    const timer = window.setTimeout(() => {
      void searchCampaign(normalized, 0)
        .then((page) => {
          if (generation.current === token)
            setState({
              key,
              candidates: page.candidates,
              total: page.total,
              failed: false,
              loadingMore: false
            })
        })
        .catch(() => {
          if (generation.current === token)
            setState({ ...empty, key, failed: true })
        })
    }, 150)
    return () => {
      window.clearTimeout(timer)
      generation.current += 1
    }
  }, [key, campaignId, normalized, searchCampaign])
  const current = state.key === key ? state : empty
  const loading = Boolean(campaignId && normalized && state.key !== key)
  const count = visible.key === key ? visible.count : 100
  const candidates = useMemo(() => {
    const found = new Map<string, ReferenceCandidate>()
    for (const candidate of searchReferenceIndices(
      reference.compiled ?? [],
      normalized
    ))
      found.set(referenceTargetKey(candidate.target), candidate)
    for (const candidate of current.candidates)
      found.set(referenceTargetKey(candidate.target), candidate)
    return [...found.values()].sort((a, b) => a.title.localeCompare(b.title))
  }, [reference.compiled, normalized, current.candidates])
  function loadMore() {
    if (loading || current.loadingMore || current.failed) return
    setVisible({ key, count: count + 100 })
    if (current.candidates.length >= current.total) return
    const token = generation.current
    setState({ ...current, loadingMore: true })
    void searchCampaign(normalized, current.candidates.length)
      .then((page) => {
        if (generation.current === token)
          setState({
            key,
            candidates: [...current.candidates, ...page.candidates],
            total: page.total,
            failed: false,
            loadingMore: false
          })
      })
      .catch(() => {
        if (generation.current === token)
          setState({ ...current, failed: true, loadingMore: false })
      })
  }
  return {
    results: candidates.slice(0, count),
    loading: loading || current.loadingMore,
    failed: current.failed,
    more:
      candidates.length > count || current.candidates.length < current.total,
    loadMore,
    retry: () => setRetry((value) => value + 1)
  }
}
