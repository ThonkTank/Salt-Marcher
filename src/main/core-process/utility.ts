import {
  capabilityFailureSchema,
  coreReadySchema,
  coreRequestSchema,
  type CapabilityErrorCode,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { CampaignStore } from '../../core/persistence/sqlite/campaign-store.js'
import { z } from 'zod'

const suppliedDataRoot = process.argv[2]

if (suppliedDataRoot === undefined || process.parentPort === undefined) {
  throw new Error('Utility process requires a data root and parent port')
}
const dataRoot: string = suppliedDataRoot

const campaigns = new CampaignStore(dataRoot)

process.parentPort.postMessage(coreReadySchema.parse({ kind: 'core.ready' }))

process.parentPort.on('message', (event) => {
  const raw: unknown = event.data
  const parsed = coreRequestSchema.safeParse(raw)
  if (!parsed.success) {
    const envelope = requestEnvelopeSchema.safeParse(raw)
    if (envelope.success)
      respondFailure(
        envelope.data.requestId,
        envelope.data.kind.startsWith('campaign.')
          ? 'validation_failed'
          : 'protocol_violation',
        false
      )
    return
  }

  try {
    if (parsed.data.kind === 'core.shutdown') {
      respond(parsed.data.requestId, campaigns.list())
      campaigns.close()
      process.exit(0)
      return
    }
    if (parsed.data.kind === 'campaign.create') {
      const snapshot = campaigns.create(parsed.data.input.name)
      respond(parsed.data.requestId, snapshot)
      return
    }
    if (parsed.data.kind === 'campaign.activate') {
      const snapshot = campaigns.activate(parsed.data.input.id)
      respond(parsed.data.requestId, snapshot)
      return
    }
    respond(parsed.data.requestId, campaigns.list())
  } catch (error) {
    respondFailure(parsed.data.requestId, toCapabilityCode(error), false)
  }
})

function respond(requestId: string, snapshot: CampaignSnapshot): void {
  process.parentPort?.postMessage({ requestId, ok: true, snapshot })
}

const requestEnvelopeSchema = capabilityFailureSchema
  .pick({})
  .extend({ requestId: z.uuid(), kind: z.string() })

function respondFailure(
  requestId: string,
  code: CapabilityErrorCode,
  retryable: boolean
): void {
  process.parentPort?.postMessage({
    requestId,
    ok: false,
    error: capabilityFailureSchema.parse({ code, retryable })
  })
}

function toCapabilityCode(error: unknown): CapabilityErrorCode {
  return error instanceof Error && error.message === 'Campaign not found'
    ? 'not_found'
    : 'internal'
}
