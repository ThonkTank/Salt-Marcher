import { useEffect, useRef } from 'react'
import type {
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import type { CreatureCapabilityPort } from './creatures-capabilities.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'

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
  onError: (message: string) => void,
  port: CreatureCapabilityPort
): void {
  const request = useRef(0)
  useEffect(() => {
    const token = ++request.current
    const timer = window.setTimeout(() => {
      void port
        .search(query)
        .then((page) => {
          if (request.current === token) setPage(page)
        })
        .catch((cause) => {
          if (request.current === token) onError(capabilityErrorText(cause))
        })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [onError, port, query, setPage])
}
