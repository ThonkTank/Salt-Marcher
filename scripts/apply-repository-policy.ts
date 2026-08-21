import { applyLiveRepositoryPolicy } from './repository-policy.js'

const arguments_ = process.argv.slice(2).filter((value) => value !== '--')
const knownArguments = new Set(['--apply', '--include-probe'])
const unknownArguments = arguments_.filter(
  (value) => !knownArguments.has(value)
)
if (unknownArguments.length > 0)
  throw new Error(
    `Unknown repository policy arguments: ${unknownArguments.join(', ')}`
  )

const result = applyLiveRepositoryPolicy({
  apply: arguments_.includes('--apply'),
  includeProbe: arguments_.includes('--include-probe')
})
console.info(
  JSON.stringify({
    component: 'repository-policy',
    event: result.applied ? 'policy-applied' : 'policy-dry-run',
    ...result
  })
)
