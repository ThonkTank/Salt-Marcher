import {
  coreRequestSchema,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { CampaignStore } from '../../core/persistence/sqlite/campaign-store.js'

const suppliedDataRoot = process.argv[2]

if (suppliedDataRoot === undefined || process.parentPort === undefined) {
  throw new Error('Utility process requires a data root and parent port')
}
const dataRoot: string = suppliedDataRoot

const campaigns = new CampaignStore(dataRoot)

process.parentPort.on('message', (event) => {
  const raw: unknown = event.data
  const parsed = coreRequestSchema.safeParse(raw)
  if (!parsed.success) {
    process.parentPort?.postMessage({
      requestId: crypto.randomUUID(),
      ok: false,
      error: 'Invalid command'
    })
    return
  }

  try {
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
    process.parentPort?.postMessage({
      requestId: parsed.data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : 'Utility process failure'
    })
  }
})

function respond(requestId: string, snapshot: CampaignSnapshot): void {
  process.parentPort?.postMessage({ requestId, ok: true, snapshot })
}
