import type { CampaignSnapshot } from './campaign.js'
import type { RuntimeGpuObservation } from '../qualification/runtime-observation.js'

export interface CampaignReadCapability {
  list(): Promise<CampaignSnapshot>
}

export interface CampaignCapability extends CampaignReadCapability {
  create(name: string): Promise<CampaignSnapshot>
  activate(id: string): Promise<CampaignSnapshot>
}

export interface SaltMarcherApi {
  campaigns: CampaignReadCapability | CampaignCapability
  runtime: Readonly<{
    readOnly: boolean
    e2e: boolean
    processMemoryBytes(): Promise<number>
    gpuObservation(): Promise<RuntimeGpuObservation>
  }>
}
