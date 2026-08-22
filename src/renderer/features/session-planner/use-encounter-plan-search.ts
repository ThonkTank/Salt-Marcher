import { useEffect, useState } from 'react'
import type { SavedEncounterPlanSummary } from '../../../shared/contracts/encounter-plans.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import type { EncounterSearchState } from './scene-inspector.js'
import type { EncounterSearchPort } from './use-session-planner-ports.js'

const debounceMs = 180
const idleSearchState: EncounterSearchState = Object.freeze({ status: 'idle' })
type ScopedSearchState = Readonly<{
  scopeKey: string | null
  value: EncounterSearchState
}>

/** Owns debounced, latest-only Encounter lookup for one Planner scene scope. */
export function useEncounterPlanSearch(options: {
  coordinator: AsyncCommandCoordinator
  encounters: EncounterSearchPort
  sessionId: string | null
  sessionRevision: number | null
  selectedSceneId: string | null
  intentRevision: number
  cacheSummaries: (summaries: readonly SavedEncounterPlanSummary[]) => void
}) {
  const {
    cacheSummaries,
    coordinator,
    encounters,
    intentRevision,
    selectedSceneId,
    sessionId,
    sessionRevision
  } = options
  const [query, setQuery] = useState('')
  const [state, setState] = useState<ScopedSearchState>({
    scopeKey: null,
    value: idleSearchState
  })
  const normalized = query.trim()
  const eligible =
    normalized.length >= 2 &&
    Boolean(sessionId) &&
    sessionRevision !== null &&
    Boolean(selectedSceneId)
  const authorityKey = eligible
    ? JSON.stringify([
        sessionId,
        sessionRevision,
        selectedSceneId,
        intentRevision
      ])
    : null
  const scopeKey = authorityKey
    ? JSON.stringify([authorityKey, normalized])
    : null

  useEffect(() => {
    const abort = new AbortController()
    if (!scopeKey) {
      return () => abort.abort('search-scope-ended')
    }
    const timer = window.setTimeout(() => {
      if (abort.signal.aborted) return
      setState({ scopeKey, value: { status: 'searching' } })
      void coordinator
        .run({
          scope: 'planner.encounter-search',
          entityKey: authorityKey,
          mode: 'latest-only',
          signal: abort.signal,
          execute: async ({ signal }) => {
            const result = await encounters.search(normalized)
            if (signal.aborted)
              throw new DOMException('Search scope ended.', 'AbortError')
            const summaries =
              result.hits.length > 0
                ? await encounters.summaries(
                    result.hits.map((hit) => hit.planId)
                  )
                : { entries: [] }
            return Object.freeze({ result, summaries })
          },
          accept: ({ result, summaries }) => {
            const byId = new Map(
              summaries.entries.map((entry) => [entry.planId, entry])
            )
            cacheSummaries(
              summaries.entries.flatMap((entry) =>
                entry.status === 'READY' ? [entry.summary] : []
              )
            )
            setState({
              scopeKey,
              value: {
                status: 'ready',
                hits: result.hits.map((hit) => {
                  const entry = byId.get(hit.planId)
                  return {
                    ...hit,
                    summary: entry?.status === 'READY' ? entry.summary : null
                  }
                }),
                hasMore: result.hasMore
              }
            })
          }
        })
        .then((outcome) => {
          if (outcome.status === 'failure' && !abort.signal.aborted)
            setState({ scopeKey, value: { status: 'failed' } })
        })
    }, debounceMs)
    return () => {
      window.clearTimeout(timer)
      abort.abort('search-scope-ended')
    }
  }, [
    authorityKey,
    cacheSummaries,
    coordinator,
    encounters,
    normalized,
    scopeKey
  ])

  return {
    query,
    state:
      scopeKey && state.scopeKey === scopeKey ? state.value : idleSearchState,
    setQuery
  }
}
