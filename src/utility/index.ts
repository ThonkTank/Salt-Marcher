import { coreStartupFailureSchema } from '../shared/contracts/core-protocol.js'
import { classifyStartupFailure } from './startup-failure.js'

void import('./application.js').catch((error: unknown) => {
  const failure = coreStartupFailureSchema.parse(classifyStartupFailure(error))
  process.parentPort?.postMessage(failure)
  console.error(
    JSON.stringify({
      component: 'utility-bootstrap',
      event: 'startup-failed',
      reason: failure.reason,
      errorName: error instanceof Error ? error.name : 'Error'
    })
  )
  setImmediate(() => process.exit(failure.retryable ? 70 : 78))
})
