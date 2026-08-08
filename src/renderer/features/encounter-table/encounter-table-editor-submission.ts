import { encounterTableDraftSchema } from '../../../shared/contracts/encounter-source.js'

/** UI-only validation; persisted legacy tables may intentionally remain empty. */
export const encounterTableEditorSubmissionSchema =
  encounterTableDraftSchema.refine((draft) => draft.entries.length > 0, {
    message: 'Encounter table editor submissions require one entry.',
    path: ['entries']
  })
