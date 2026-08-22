import {
  evaluateCheckPreflight,
  readCheckPreflightSnapshot
} from './check-preflight.js'

const result = evaluateCheckPreflight(readCheckPreflightSnapshot())
console.info(
  JSON.stringify({ component: 'local-check', event: 'preflight', ...result })
)
if (result.status === 'failed') {
  console.error(`Local check preflight failed: ${result.reasons.join('; ')}`)
  process.exitCode = 1
}
