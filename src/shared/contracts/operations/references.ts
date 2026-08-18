import {
  referenceCampaignIndexInputSchema,
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema
} from '../reference.js'
import { none, read } from './registry.js'

export const referencesOperationDefinitions = {
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
} as const
