import {
  campaignImportApplyInputSchema,
  campaignImportApplyResultSchema,
  campaignImportReportSchema,
  campaignImportValidateInputSchema
} from '../campaign-import.js'
import { read, utilityOperationFragment, write } from './registry.js'

export const campaignImportOperationDefinitions = utilityOperationFragment({
  'campaignImport.validate': read(
    'campaign-import:validate',
    campaignImportValidateInputSchema,
    campaignImportReportSchema
  ),
  'campaignImport.preview': read(
    'campaign-import:preview',
    campaignImportValidateInputSchema,
    campaignImportReportSchema
  ),
  'campaignImport.apply': write(
    'campaign-import:apply',
    campaignImportApplyInputSchema,
    campaignImportApplyResultSchema
  )
})
