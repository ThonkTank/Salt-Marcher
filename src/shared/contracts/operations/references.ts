import {
  referenceCampaignIndexInputSchema,
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema
} from '../reference.js'
import { none, read, utilityOperationFragment } from './registry.js'

export const referencesOperationDefinitions = utilityOperationFragment({
  'references.staticIndex': read(
    'references:static-index',
    none,
    referenceIndexSchema
  ),
  'references.campaignIndex': read(
    'references:campaign-index',
    referenceCampaignIndexInputSchema,
    referenceIndexSchema
  ),
  'references.detail': read(
    'references:detail',
    referenceTargetSchema,
    referenceDocumentSchema
  )
})
