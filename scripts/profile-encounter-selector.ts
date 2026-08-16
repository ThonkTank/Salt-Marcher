import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  catalogManifestSchema,
  parseEncounterCatalog
} from '../src/core/session-generation/catalog.js'
import {
  buildSelectionIndex,
  sessionCompositionCatalog,
  selectEncounter
} from '../src/core/session-generation/encounter-selection-policy.js'
import { maximumCompositionComplexity } from '../src/shared/generator/generator-config-model.js'
import { defaultGeneratorConfig } from '../src/shared/generator/system-generator-preset.js'

const catalogRoot = resolve('resources/sessiongeneration/catalog-2026-08-16')
const read = (name: string) => readFileSync(join(catalogRoot, name), 'utf8')
const catalog = parseEncounterCatalog({
  manifest: catalogManifestSchema.parse(JSON.parse(read('manifest.json'))),
  tables: {
    progression: read('DB_Progression.tsv'),
    challengeRatings: read('DB_CR.tsv'),
    roleBands: read('DB_EncounterRoleBands.tsv'),
    patterns: read('DB_EncounterPatterns.tsv')
  }
})
const maximum = maximumCompositionComplexity(defaultGeneratorConfig.composition)
if (maximum.count !== 97_985)
  throw new Error(`Unexpected default worst-case size: ${maximum.count}`)
const index = buildSelectionIndex(
  sessionCompositionCatalog(catalog),
  maximum.partyLevel,
  defaultGeneratorConfig
)
const entropy = { modulo: () => 0, unit: () => 0 }
const sample = (seed: number): number => {
  const started = performance.now()
  const result = selectEncounter(
    seed,
    1,
    10_000,
    index,
    entropy,
    defaultGeneratorConfig,
    5
  )
  if (result.candidateCount !== maximum.count)
    throw new Error(
      `Incomplete enumeration: ${result.candidateCount}/${maximum.count}`
    )
  return performance.now() - started
}

for (let warmup = 0; warmup < 5; warmup += 1) sample(warmup)
const durations = Array.from({ length: 20 }, (_, index) =>
  sample(index + 5)
).sort((left, right) => left - right)
const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!
const report = {
  profile: 'encounter-selector-low-reference',
  candidatesPerRun: maximum.count,
  samples: durations.length,
  p95Milliseconds: Number(p95.toFixed(2)),
  limitMilliseconds: 100
}
console.log(JSON.stringify(report))
if (p95 >= report.limitMilliseconds)
  throw new Error(
    `Encounter selector p95 ${p95.toFixed(2)} ms exceeds ${report.limitMilliseconds} ms.`
  )
