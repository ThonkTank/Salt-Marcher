import type { EncounterTableDraft } from '../../../shared/contracts/encounter-source.js'

export type EncounterTableEditorSubmissionResult =
  | Readonly<{ success: true; data: EncounterTableDraft }>
  | Readonly<{ success: false }>

/** UI-only conversion; the preload remains the authoritative schema boundary. */
export function parseEncounterTableEditorSubmission(
  draft: EncounterTableDraft
): EncounterTableEditorSubmissionResult {
  const displayName = draft.displayName.trim()
  const description = draft.description.trim()
  const creatureIds = draft.entries.map((entry) => entry.creatureId)
  if (
    displayName.length < 1 ||
    displayName.length > 100 ||
    description.length > 20_000 ||
    draft.entries.length < 1 ||
    new Set(creatureIds).size !== creatureIds.length ||
    draft.entries.some(
      (entry) =>
        entry.creatureId.length < 1 ||
        !Number.isInteger(entry.weight) ||
        entry.weight < 1 ||
        entry.weight > 10
    )
  )
    return { success: false }
  return {
    success: true,
    data: { displayName, description, entries: [...draft.entries] }
  }
}
