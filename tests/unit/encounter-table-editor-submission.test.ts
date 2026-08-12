import { describe, expect, it } from 'vitest'
import { encounterTableDraftSchema } from '../../src/shared/contracts/encounter-source.js'
import { parseEncounterTableEditorSubmission } from '../../src/renderer/features/encounter-table/encounter-table-editor-submission.js'

describe('Encounter Table editor submission', () => {
  it('keeps the persisted legacy draft schema compatible with empty tables', () => {
    const draft = { displayName: 'Legacy', description: '', entries: [] }
    expect(encounterTableDraftSchema.safeParse(draft).success).toBe(true)
    expect(parseEncounterTableEditorSubmission(draft).success).toBe(false)
  })

  it('accepts an editor submission with at least one entry', () => {
    expect(
      parseEncounterTableEditorSubmission({
        displayName: 'Patrouille',
        description: '',
        entries: [{ creatureId: 'wolf', weight: 1 }]
      }).success
    ).toBe(true)
  })
})
