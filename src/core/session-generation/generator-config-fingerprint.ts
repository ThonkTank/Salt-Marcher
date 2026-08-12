import type { GeneratorPresetConfigV3 } from '../../shared/contracts/generator-presets.js'
import { fingerprint } from '../fingerprint.js'

export function fingerprintGeneratorConfig(
  config: GeneratorPresetConfigV3
): string {
  return fingerprint(config)
}
