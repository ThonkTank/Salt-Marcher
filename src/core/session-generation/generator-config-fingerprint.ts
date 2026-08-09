import { createHash } from 'node:crypto'
import type { GeneratorPresetConfigV3 } from '../../shared/contracts/generator-presets.js'
import { canonicalGeneratorConfigJson } from '../../shared/generator/generator-config-model.js'

export function fingerprintGeneratorConfig(
  config: GeneratorPresetConfigV3
): string {
  return createHash('sha256')
    .update(canonicalGeneratorConfigJson(config))
    .digest('hex')
}
