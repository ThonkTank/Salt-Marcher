import {
  activateCampaignInputSchema,
  campaignIdInputSchema,
  campaignSnapshotSchema,
  createCampaignInputSchema,
  permanentlyDeleteCampaignInputSchema,
  renameCampaignInputSchema
} from '../campaign.js'
import { none, read, write } from './registry.js'

export const campaignOperationDefinitions = {
  'campaign.list': read('campaign:list', none, campaignSnapshotSchema),
  'campaign.create': write(
    'campaign:create',
    createCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.activate': write(
    'campaign:activate',
    activateCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.rename': write(
    'campaign:rename',
    renameCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.trash': write(
    'campaign:trash',
    campaignIdInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.restore': write(
    'campaign:restore',
    campaignIdInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.deleteForever': write(
    'campaign:deleteForever',
    permanentlyDeleteCampaignInputSchema,
    campaignSnapshotSchema
  )
} as const
