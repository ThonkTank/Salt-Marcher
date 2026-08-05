import { useEffect, useRef, useState } from 'react'
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

export function useMonsterCatalogController(
  active: boolean,
  onError: (message: string) => void,
  inspect: (creature: Creature) => void,
  port: CreatureCapabilityPort
) {
  const [query, setQuery] = useState<CreatureCatalogQuery>(emptyQuery)
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  useEffect(() => {
    if (!active) return
    void port
      .filterOptions()
      .then(setOptions)
      .catch(reportCapabilityError(onError))
  }, [active, onError, port])

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
  }, [active, onError, port, query])

  async function open(creature: Creature) {
    try {
      inspect(await port.detail(creature.id))
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  return { query, page, options, loading, setQuery, open }
}

export type MonsterCatalogController = ReturnType<
  typeof useMonsterCatalogController
>
