import { generateSessionEncounters } from '../../core/session-generation/encounter-engine.js'
import type { EncounterEntropy } from '../../core/session-generation/deterministic-order.js'
import type {
  SessionGenerationEncounterResult,
  SessionGenerationEncounterInput
} from '../../shared/contracts/session-generation.js'
import {
  CatalogProviderError,
  type BundledEncounterCatalogProvider
} from './catalog-provider.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetConfigV3
} from '../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../shared/generator/system-generator-preset.js'

export class SessionGenerationService {
  constructor(
    private readonly catalogProvider: Pick<
      BundledEncounterCatalogProvider,
      'load'
    >,
    private readonly entropy: EncounterEntropy,
    private readonly preset: () => {
      id: string
      revision: number
      config: GeneratorPresetConfigV3
    } = () => ({
      id: systemGeneratorPresetId,
      revision: 0,
      config: defaultGeneratorConfig
    })
  ) {}

  generateEncounterIntents(
    input: SessionGenerationEncounterInput
  ): SessionGenerationEncounterResult {
    try {
      return generateSessionEncounters(
        input,
        this.catalogProvider.load(),
        this.entropy,
        this.preset()
      )
    } catch (error) {
      if (error instanceof CatalogProviderError)
        return deepFreeze({
          status: 'catalog_error',
          issues: [
            {
              code: error.code,
              message: error.message
            }
          ]
        })
      throw error
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
