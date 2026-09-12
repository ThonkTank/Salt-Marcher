import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { acquireComparison } from './release/acquire-comparison.js'
import { inspectReleaseFile } from './release/bundle.js'
import { digestReleaseDocument } from './release/qualification.js'
import {
  assertRequestedTarget,
  releaseRequestSchema,
  type ComparisonArtifact
} from './release/request.js'

const { values } = parseArgs({
  options: {
    request: { type: 'string' },
    output: { type: 'string' },
    'target-manifest': { type: 'string' }
  }
})
if (!values.request || !values.output || !values['target-manifest'])
  throw new Error(
    'Provide --request <immutable request.json> --target-manifest <manifest.json> --output <comparison directory>. No implicit baseline is supported.'
  )
const requestBytes = inspectReleaseFile(
  resolve(values.request),
  4 * 1024 * 1024,
  true
).content
const request = releaseRequestSchema.parse(
  JSON.parse(requestBytes.toString('utf8'))
)
assertRequestedTarget(
  request,
  JSON.parse(
    inspectReleaseFile(
      resolve(values['target-manifest']),
      4 * 1024 * 1024,
      true
    ).content.toString('utf8')
  )
)
const root = resolve(values.output)
mkdirSync(root, { recursive: true })
const acquired = new Map<string, ReturnType<typeof acquireComparison>>()
const acquire = (artifact: ComparisonArtifact) => {
  const key = digestReleaseDocument(Buffer.from(JSON.stringify(artifact)))
  const found =
    acquired.get(key) ?? acquireComparison(artifact, join(root, key))
  acquired.set(key, found)
  return { ...found, artifact }
}
const comparisons = request.comparisons.map((comparison) => ({
  id: comparison.id,
  scenario: comparison.scenario,
  baseline: acquire(comparison.baseline),
  intermediate: comparison.intermediate.map(acquire)
}))
const index =
  JSON.stringify(
    {
      formatVersion: 1,
      requestSha256: digestReleaseDocument(requestBytes),
      comparisons
    },
    null,
    2
  ) + '\n'
const indexPath = join(root, 'comparisons.json')
if (existsSync(indexPath)) {
  if (readFileSync(indexPath, 'utf8') !== index)
    throw new Error(
      'Existing comparison index belongs to another request or source.'
    )
} else writeFileSync(indexPath, index, { flag: 'wx' })
console.info(
  `Verified ${acquired.size} explicitly requested comparison artifacts: ${indexPath}`
)
