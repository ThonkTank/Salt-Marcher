import {
  activateCampaignInputSchema,
  campaignIdInputSchema,
  campaignSnapshotSchema,
  createCampaignInputSchema,
  permanentlyDeleteCampaignInputSchema,
  renameCampaignInputSchema
} from '../campaign.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const campaignOperationDefinitions = utilityOperationFragment({
  'campaign.list': read('campaign:list', none, campaignSnapshotSchema),
  'campaign.create': write(
    'campaign:create',
    createCampaignInputSchema,
    campaignSnapshotSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.activate': write(
    'campaign:activate',
    activateCampaignInputSchema,
    campaignSnapshotSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.rename': write(
    'campaign:rename',
    renameCampaignInputSchema,
    campaignSnapshotSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.trash': write(
    'campaign:trash',
    campaignIdInputSchema,
    campaignSnapshotSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.restore': write(
    'campaign:restore',
    campaignIdInputSchema,
    campaignSnapshotSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.deleteForever': write(
    'campaign:deleteForever',
    permanentlyDeleteCampaignInputSchema,
    campaignSnapshotSchema,
    ['gm'],
    'campaign-reconcile'
  )
})
