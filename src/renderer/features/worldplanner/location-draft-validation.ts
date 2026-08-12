import type { WorldLocationDraft } from '../../../shared/contracts/world-location.js'
import { canonicalWorldLocationTag } from '../../../shared/values/world-location-values.js'
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
  const displayName = form.displayName.trim()
  const tags = form.tags.map((tag) => tag.trim())
  const canonicalTags = tags.map(canonicalWorldLocationTag)
  const valid =
    displayName.length >= 1 &&
    displayName.length <= 100 &&
    tags.length >= 1 &&
    tags.length <= 20 &&
    tags.every((tag) => tag.length >= 1 && tag.length <= 40) &&
    new Set(canonicalTags).size === canonicalTags.length &&
    form.readAloud.length <= 20_000 &&
    form.notes.trim().length <= 20_000 &&
    form.factionIds.every(isUuid) &&
    form.encounterTableIds.every(isUuid)
  const draft: WorldLocationDraft = {
    displayName,
    tags,
    readAloud: form.readAloud,
    notes: form.notes.trim(),
    factionIds: [...form.factionIds].sort(),
    encounterTableIds: [...form.encounterTableIds].sort()
  }
  return {
    nameMissing,
    tagsMissing,
    draft: valid ? draft : null
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
