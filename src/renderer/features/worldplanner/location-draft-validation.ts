import {
  worldLocationDraftSchema,
  type WorldLocationDraft
} from '../../../shared/contracts/world-location.js'
import type { WorldLocationFormDraft } from './world-location-draft.js'

export type WorldLocationDraftValidation = Readonly<{
  nameMissing: boolean
  tagsMissing: boolean
  draft: WorldLocationDraft | null
}>

/** The single conversion boundary from permissive UI state to IPC contract. */
export function validateWorldLocationDraft(
  form: WorldLocationFormDraft
): WorldLocationDraftValidation {
  const nameMissing = form.displayName.trim().length === 0
  const tagsMissing = form.tags.length === 0
  const parsed = worldLocationDraftSchema.safeParse({
    ...form,
    factionIds: [...form.factionIds].sort(),
    encounterTableIds: [...form.encounterTableIds].sort()
  })
  return {
    nameMissing,
    tagsMissing,
    draft: parsed.success ? parsed.data : null
  }
}
