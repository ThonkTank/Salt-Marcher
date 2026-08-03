import { useEffect, useRef } from 'react'
import type {
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { capabilityErrorMessage } from '../../i18n/messages.de.js'

export const emptyQuery: CreatureCatalogQuery = {
  name: '',
  sizes: [],
  types: [],
  subtypes: [],
  biomes: [],
  alignments: [],
  encounterTableIds: [],
  factionIds: [],
  locationId: null,
  sort: 'name',
  direction: 'asc',
  offset: 0,
  limit: 50
}

export const emptyCreatureOptions: CreatureFilterOptions = {
  challengeRatings: [],
  sizes: [],
  types: [],
  subtypes: [],
  biomes: [],
  alignments: [],
  encounterTables: [],
  factions: [],
  locations: []
}

export function useCreatureSearch(
  query: CreatureCatalogQuery,
  setPage: (page: CreatureCatalogPage) => void,
  onError: (message: string) => void
): void {
  const request = useRef(0)
  useEffect(() => {
    const token = ++request.current
    const timer = window.setTimeout(() => {
      void window.saltMarcher.creatures
        .search(query)
        .then((page) => {
          if (request.current === token) setPage(page)
        })
        .catch((cause) => {
          if (request.current === token) onError(errorText(cause))
        })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, setPage, onError])
}

export function errorText(cause: unknown): string {
  if (capabilityErrorCode(cause) === 'outcome_unknown')
    window.dispatchEvent(new Event('saltmarcher:readback'))
  return capabilityErrorMessage(cause)
}

export function showError(setError: (message: string) => void) {
  return (cause: unknown) => setError(errorText(cause))
}
