import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { BiomePage } from '../../../shared/contracts/biome.js'
import type { CreatureFilterOptions } from '../../../shared/contracts/encounter.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

export function useBiomeOptionSearch(
  biomes: Pick<SaltMarcherApi['biomes'], 'search'> | undefined,
  setOptions: Dispatch<SetStateAction<CreatureFilterOptions>>,
  selectedIds: readonly string[] = [],
  onError?: (message: string) => void
) {
  const callback = useCallback(
    async (query: string): Promise<readonly SearchableSelectOption[]> => {
      if (!biomes) return []
      let page: BiomePage
      try {
        page = await biomes.search(query, 0, 60)
      } catch (cause) {
        onError?.(capabilityErrorText(cause))
        return []
      }
      const found = page.biomes.map((biome) => ({
        id: biome.id,
        label: biome.displayName
      }))
      setOptions((current) => {
        const selected = new Set(selectedIds)
        const retained = current.biomes.filter(
          (option) => !isUuid(option.id) || selected.has(option.id)
        )
        const biomes = new Map(retained.map((option) => [option.id, option]))
        for (const option of found) biomes.set(option.id, option)
        return { ...current, biomes: [...biomes.values()] }
      })
      return found
    },
    [biomes, onError, selectedIds, setOptions]
  )
  return biomes ? callback : undefined
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
