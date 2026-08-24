import {
  activateCampaignInputSchema,
  activateCampaignReceiptSchema,
  campaignCommandReceiptInputSchema,
  campaignCommandReceiptSchema,
  campaignIdInputSchema,
  createCampaignInputSchema,
  createCampaignReceiptSchema,
  deleteCampaignReceiptSchema,
  permanentlyDeleteCampaignInputSchema,
  renameCampaignInputSchema,
  renameCampaignReceiptSchema,
  restoreCampaignReceiptSchema,
  trashCampaignReceiptSchema,
  campaignSnapshotSchema
} from '../campaign.js'
import { none, read, utilityOperationFragment, write } from './registry.js'

export const campaignOperationDefinitions = utilityOperationFragment({
  'campaign.list': read('campaign:list', none, campaignSnapshotSchema),
  'campaign.create': write(
    'campaign:create',
    createCampaignInputSchema,
    createCampaignReceiptSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.activate': write(
    'campaign:activate',
    activateCampaignInputSchema,
    activateCampaignReceiptSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.rename': write(
    'campaign:rename',
    renameCampaignInputSchema,
    renameCampaignReceiptSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.trash': write(
    'campaign:trash',
    campaignIdInputSchema,
    trashCampaignReceiptSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.restore': write(
    'campaign:restore',
    campaignIdInputSchema,
    restoreCampaignReceiptSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.deleteForever': write(
    'campaign:deleteForever',
    permanentlyDeleteCampaignInputSchema,
    deleteCampaignReceiptSchema,
    ['gm'],
    'campaign-reconcile'
  ),
  'campaign.commandReceipt': read(
    'campaign:command-receipt',
    campaignCommandReceiptInputSchema,
    campaignCommandReceiptSchema.nullable()
  )
})
