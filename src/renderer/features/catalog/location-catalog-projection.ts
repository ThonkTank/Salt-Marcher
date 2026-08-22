import { useMemo } from 'react'
import type { useLocationCatalogMutations } from './use-location-catalog-mutations.js'
import type { useLocationCatalogQueries } from './use-location-catalog-queries.js'

export function useLocationCatalogProjection(input: {
  queries: ReturnType<typeof useLocationCatalogQueries>
  mutations: ReturnType<typeof useLocationCatalogMutations>
}) {
  const { mutations, queries } = input
  const visible = useMemo(() => {
    const needle = queries.search.trim().toLocaleLowerCase()
    return queries.snapshot.locations
      .filter(
        (location) =>
          !needle ||
          location.displayName.toLocaleLowerCase().includes(needle) ||
          location.tags.some((tag) =>
            tag.toLocaleLowerCase().includes(needle)
          ) ||
          location.readAloud.toLocaleLowerCase().includes(needle) ||
          location.notes.toLocaleLowerCase().includes(needle)
      )
      .toSorted((left, right) => {
        const order = left.displayName.localeCompare(right.displayName)
        return queries.direction === 'asc' ? order : -order
      })
  }, [queries.direction, queries.search, queries.snapshot.locations])

  return {
    snapshot: queries.snapshot,
    loading: queries.loading,
    searchInput: queries.searchInput,
    direction: queries.direction,
    references: queries.references,
    visible,
    setSearchInput: queries.setSearchInput,
    commitSearch: queries.commitSearch,
    toggleDirection: queries.toggleDirection,
    ...mutations
  }
}
