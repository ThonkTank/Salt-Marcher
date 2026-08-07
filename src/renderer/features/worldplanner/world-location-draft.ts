import type { WorldLocation } from '../../../shared/contracts/world-location.js'

export type WorldLocationFormDraft = {
  displayName: string
  tags: string[]
  readAloud: string
  notes: string
  factionIds: string[]
  encounterTableIds: string[]
}

export type WorldLocationDraftAction =
  | Readonly<{ type: 'reset'; draft: WorldLocationFormDraft }>
  | Readonly<{
      type: 'change'
      key: keyof WorldLocationFormDraft
      value: WorldLocationFormDraft[keyof WorldLocationFormDraft]
    }>

export function worldLocationDraftFrom(
  location: WorldLocation | null
): WorldLocationFormDraft {
  return {
    displayName: location?.displayName ?? '',
    tags: [...(location?.tags ?? [])],
    readAloud: location?.readAloud ?? '',
    notes: location?.notes ?? '',
    factionIds: [...(location?.factionIds ?? [])],
    encounterTableIds: [...(location?.encounterTableIds ?? [])]
  }
}

export function reduceWorldLocationDraft(
  draft: WorldLocationFormDraft,
  action: WorldLocationDraftAction
): WorldLocationFormDraft {
  return action.type === 'reset'
    ? action.draft
    : { ...draft, [action.key]: action.value }
}

export function canonicalWorldLocationDraft(
  draft: WorldLocationFormDraft
): string {
  return JSON.stringify({
    ...draft,
    factionIds: [...draft.factionIds].sort(),
    encounterTableIds: [...draft.encounterTableIds].sort()
  })
}
