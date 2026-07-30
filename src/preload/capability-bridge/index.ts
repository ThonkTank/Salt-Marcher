import { contextBridge, ipcRenderer } from 'electron'
import {
  createCampaignInputSchema,
  activateCampaignInputSchema,
  campaignCapabilityResponseSchema,
  freezeCampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  CampaignCapability,
  CampaignReadCapability,
  SaltMarcherApi
} from '../../shared/contracts/capability-api.js'

const readCampaigns: CampaignReadCapability = {
  async list() {
    return invokeCampaign('campaign:list')
  }
}
const campaigns: CampaignCapability = {
  ...readCampaigns,
  async create(name) {
    const input = createCampaignInputSchema.safeParse({ name })
    if (!input.success) throw new CapabilityError('validation_failed', false)
    return invokeCampaign('campaign:create', input.data)
  },
  async activate(id) {
    const input = activateCampaignInputSchema.safeParse({ id })
    if (!input.success) throw new CapabilityError('validation_failed', false)
    return invokeCampaign('campaign:activate', input.data)
  }
}
const api: SaltMarcherApi = {
  campaigns: process.argv.includes('--salt-marcher-read-only')
    ? readCampaigns
    : campaigns,
  runtime: Object.freeze({
    readOnly: process.argv.includes('--salt-marcher-read-only'),
    e2e: process.argv.includes('--salt-marcher-e2e'),
    async processMemoryBytes() {
      const value: unknown = await ipcRenderer.invoke('runtime:memory')
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
      )
        throw new Error('Invalid runtime memory response')
      return value
    }
  })
}

contextBridge.exposeInMainWorld('saltMarcher', Object.freeze(api))

async function invokeCampaign(
  channel: 'campaign:list' | 'campaign:create' | 'campaign:activate',
  input?: unknown
) {
  try {
    const response = campaignCapabilityResponseSchema.safeParse(
      await ipcRenderer.invoke(channel, input)
    )
    if (!response.success)
      throw new CapabilityError('protocol_violation', false)
    if (!response.data.ok)
      throw new CapabilityError(
        response.data.error.code,
        response.data.error.retryable
      )
    return freezeCampaignSnapshot(response.data.snapshot)
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}
