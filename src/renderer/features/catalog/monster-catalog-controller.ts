import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import {
  emptyCreatureOptions,
  emptyQuery
} from '../creatures/creature-state.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import type { BiomeChangeNotice } from '../../../shared/contracts/biome.js'
import type { EncounterTableChangeNotice } from '../../../shared/contracts/encounter-source.js'
import type { BiomePage } from '../../../shared/contracts/biome.js'
import type { BiomeOptionSearchPort } from '../creatures/biome-option-search-port.js'

export function useMonsterCatalogController(
  active: boolean,
  onError: (message: string) => void,
  inspect: (creature: Creature) => void,
  port: CreatureCapabilityPort,
  biomePort?: BiomeOptionSearchPort,
  onBiomesChanged?: (
    listener: (notice: BiomeChangeNotice) => void
  ) => () => void,
  onEncounterTablesChanged?: (
    listener: (notice: EncounterTableChangeNotice) => void
  ) => () => void
) {
  const [query, setQuery] = useState<CreatureCatalogQuery>(emptyQuery)
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [loading, setLoading] = useState(false)
  const [biomeRevision, setBiomeRevision] = useState(0)
  const [encounterRevision, setEncounterRevision] = useState(0)
  const request = useRef(0)
  const searchBiomeOptions = useCallback(
    async (searchQuery: string) => {
      if (!biomePort) return options.biomes
      let page: BiomePage
      try {
        page = await biomePort.search(searchQuery, 0, 60)
      } catch (cause) {
        onError(capabilityErrorText(cause))
        return []
      }
      const found = page.biomes.map((biome) => ({
        id: biome.id,
        label: biome.displayName
      }))
      setOptions((current) => ({
        ...current,
        biomes: mergeBiomeOptions(current.biomes, found, query.biomes)
      }))
      return found
    },
    [biomePort, onError, options.biomes, query.biomes]
  )

  useEffect(() => {
    if (!active) return
    void port
      .filterOptions()
      .then(setOptions)
      .catch(reportCapabilityError(onError))
  }, [active, onError, port])

  useEffect(() => {
    if (!active || !onBiomesChanged) return
    return onBiomesChanged((notice) => {
      setBiomeRevision(notice.revision)
      void port
        .filterOptions()
        .then((next) => {
          const deleted = new Set(
            notice.reason === 'deleted' ? notice.changedBiomeIds : []
          )
          setOptions((current) => ({
            ...next,
            biomes: mergeOptions(
              current.biomes.filter((biome) => !deleted.has(biome.id)),
              next.biomes
            )
          }))
          if (deleted.size > 0)
            setQuery((current) => ({
              ...current,
              biomes: current.biomes.filter((id) => !deleted.has(id)),
              offset: 0
            }))
        })
        .catch(reportCapabilityError(onError))
    })
  }, [active, onBiomesChanged, onError, port])

  useEffect(() => {
    if (!active || !onEncounterTablesChanged) return
    return onEncounterTablesChanged((notice) => {
      setEncounterRevision(
        notice.installationRevision + notice.campaignRevision
      )
      void port
        .filterOptions()
        .then((next) =>
          setOptions((current) => ({
            ...next,
            biomes: mergeOptions(current.biomes, next.biomes)
          }))
        )
        .catch(reportCapabilityError(onError))
    })
  }, [active, onEncounterTablesChanged, onError, port])

  useEffect(() => {
    if (!active) return
    const token = ++request.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const result = await port.search(query)
        if (request.current === token) setPage(result)
      } catch (cause) {
        if (request.current === token) onError(capabilityErrorText(cause))
      } finally {
        if (request.current === token) setLoading(false)
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [active, biomeRevision, encounterRevision, onError, port, query])

  async function open(creature: Creature) {
    try {
      inspect(await port.detail(creature.id))
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  return {
    query,
    page,
    options,
    loading,
    setQuery,
    open,
    searchBiomeOptions: biomePort ? searchBiomeOptions : undefined
  }
}

function mergeOptions(
  current: readonly { id: string; label: string }[],
  incoming: readonly { id: string; label: string }[]
) {
  const merged = new Map(current.map((option) => [option.id, option]))
  for (const option of incoming) merged.set(option.id, option)
  return [...merged.values()]
}

function mergeBiomeOptions(
  current: readonly { id: string; label: string }[],
  incoming: readonly { id: string; label: string }[],
  selectedIds: readonly string[]
) {
  const selected = new Set(selectedIds)
  return mergeOptions(
    current.filter((option) => !isUuid(option.id) || selected.has(option.id)),
    incoming
  )
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

export type MonsterCatalogController = ReturnType<
  typeof useMonsterCatalogController
>
