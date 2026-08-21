import { applyLiveRepositoryPolicy } from './repository-policy.js'

const knownArguments = new Set(['--apply', '--include-probe'])
const unknownArguments = process.argv
  .slice(2)
  .filter((value) => !knownArguments.has(value))
if (unknownArguments.length > 0)
  throw new Error(
    `Unknown repository policy arguments: ${unknownArguments.join(', ')}`
  )

const result = applyLiveRepositoryPolicy({
  apply: process.argv.includes('--apply'),
  includeProbe: process.argv.includes('--include-probe')
})
console.info(
  JSON.stringify({
    component: 'repository-policy',
    event: result.applied ? 'policy-applied' : 'policy-dry-run',
    ...result
  })
)
