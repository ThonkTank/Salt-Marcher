import { parseArgs } from 'node:util'
import { z } from 'zod'
import { runHistoricalArtifact } from './qualification/historical-artifact-runner.js'
import { historicalOperationSchema } from './qualification/historical-runtime/contract.js'

const { values } = parseArgs({
  options: {
    artifact: { type: 'string' },
    'data-home': { type: 'string' },
    operation: { type: 'string' }
  }
})
const evidence = await runHistoricalArtifact(
  z.string().min(1).parse(values.artifact),
  z.string().min(1).parse(values['data-home']),
  historicalOperationSchema.parse(values.operation)
)
console.info(JSON.stringify(evidence))
if (!evidence.result.response.ok) process.exitCode = 1
