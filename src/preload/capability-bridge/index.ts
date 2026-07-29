import { contextBridge, ipcRenderer } from 'electron'
import {
  createCampaignInputSchema,
  activateCampaignInputSchema,
  campaignSnapshotSchema
} from '../../shared/contracts/campaign.js'
import type {
  CampaignCapability,
  CampaignReadCapability,
  SaltMarcherApi
} from '../../shared/contracts/capability-api.js'

const readCampaigns: CampaignReadCapability = {
  async list() {
    return campaignSnapshotSchema.parse(
      await ipcRenderer.invoke('campaign:list')
    )
  }
}
const campaigns: CampaignCapability = {
  ...readCampaigns,
  async create(name) {
    return campaignSnapshotSchema.parse(
      await ipcRenderer.invoke(
        'campaign:create',
        createCampaignInputSchema.parse({ name })
      )
    )
  },
  async activate(id) {
    return campaignSnapshotSchema.parse(
      await ipcRenderer.invoke(
        'campaign:activate',
        activateCampaignInputSchema.parse({ id })
      )
    )
  }
}
const api: SaltMarcherApi = {
  campaigns: process.argv.includes('--salt-marcher-read-only')
    ? readCampaigns
    : campaigns
}

contextBridge.exposeInMainWorld('saltMarcher', Object.freeze(api))
