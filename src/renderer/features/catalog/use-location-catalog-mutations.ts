import { useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  WorldLocation,
  WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import {
  capabilityErrorText,
  presentCapabilityError
} from '../../capabilities/capability-errors.js'
import type {
  WorldLocationPlacementCommitResult,
  WorldLocationPlacementFailure,
  WorldLocationPlacementIntent
} from '../worldplanner/world-location-editor-types.js'
import type { LocationCatalogPort } from './location-catalog-port.js'
import type { useLocationCatalogQueries } from './use-location-catalog-queries.js'

export type LocationPlacementRecovery = Readonly<{
  locationId: string
  failure: WorldLocationPlacementFailure
  retry: () => Promise<WorldLocationPlacementCommitResult>
}>

export function useLocationCatalogMutations(input: {
  onError: (message: string) => void
  setSession: (snapshot: LiveSessionSnapshot) => void
  port: LocationCatalogPort
  coordinator: AsyncCommandCoordinator
  queries: ReturnType<typeof useLocationCatalogQueries>
}) {
  const { coordinator, onError, port, queries, setSession } = input
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<WorldLocation | null | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [placing, setPlacing] = useState<WorldLocation | null>(null)
  const [placementRecovery, setPlacementRecovery] =
    useState<LocationPlacementRecovery | null>(null)

  const selected =
    queries.snapshot.locations.find((entry) => entry.id === selectedId) ?? null

  async function refreshSession(): Promise<void> {
    const outcome = await coordinator.run({
      scope: 'location-catalog.session',
      mode: 'latest-only',
      execute: () => port.readSession()
    })
    if (outcome.status === 'success') setSession(outcome.value)
    else if (outcome.status === 'failure')
      onError(capabilityErrorText(outcome.cause))
  }

  async function save(
    draft: WorldLocationDraft,
    placement: WorldLocationPlacementIntent
  ) {
    const outcome = await coordinator.run({
      scope: 'location-catalog.mutation',
      entityKey: editing?.id ?? 'new',
      mode: 'latest-only',
      execute: () => port.save(editing ?? null, draft, placement)
    })
    if (outcome.status !== 'success') {
      return {
        status: 'failed',
        message:
          outcome.status === 'failure'
            ? presentCapabilityError(outcome.cause, onError)
            : capabilityErrorText(new Error('obsolete location save'))
      } as const
    }
    const result = outcome.value
    const next = result.receipt.snapshot
    const savedId = result.receipt.saved.id
    queries.setSnapshot(next)
    setSelectedId(savedId)
    if (result.receipt.status === 'partially-saved')
      setPlacementRecovery({
        locationId: savedId,
        failure: result.receipt.placementFailure,
        retry: result.retryPlacement
      })
    else {
      setPlacementRecovery(null)
      setEditing(undefined)
    }
    await refreshSession()
    return result.receipt.status === 'partially-saved'
      ? ({
          status: 'partially-saved',
          placementFailure: result.receipt.placementFailure,
          retry: async () => {
            const retried = await result.retryPlacement()
            if (retried.status === 'rejected')
              setPlacementRecovery({
                locationId: savedId,
                failure: retried.failure,
                retry: result.retryPlacement
              })
            else {
              setPlacementRecovery(null)
              setEditing(undefined)
            }
            return retried
          }
        } as const)
      : ({ status: 'saved' } as const)
  }

  async function retryPlacement(): Promise<void> {
    if (!placementRecovery) return
    const result = await placementRecovery.retry()
    if (result.status === 'rejected') {
      setPlacementRecovery({ ...placementRecovery, failure: result.failure })
      return
    }
    setPlacementRecovery(null)
    await refreshSession()
  }

  async function remove(): Promise<void> {
    if (!selected) return
    const outcome = await coordinator.run({
      scope: 'location-catalog.mutation',
      entityKey: selected.id,
      mode: 'latest-only',
      execute: () => port.remove(selected)
    })
    if (outcome.status === 'failure') {
      onError(capabilityErrorText(outcome.cause))
      return
    }
    if (outcome.status === 'stale') return
    queries.setSnapshot(outcome.value)
    setSelectedId(null)
    setDeleteConfirm(false)
    await refreshSession()
  }

  return {
    selected,
    setSelected: (location: WorldLocation | null) =>
      setSelectedId(location?.id ?? null),
    editing,
    setEditing,
    deleteConfirm,
    setDeleteConfirm,
    placing,
    setPlacing,
    placementRecovery,
    save,
    retryPlacement,
    remove,
    placed: refreshSession
  }
}
