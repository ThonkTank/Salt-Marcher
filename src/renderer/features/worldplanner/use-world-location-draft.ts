import { useMemo, useReducer, useState } from 'react'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import { validateWorldLocationDraft } from './location-draft-validation.js'
import {
  canonicalWorldLocationDraft,
  reduceWorldLocationDraft,
  worldLocationDraftFrom,
  type WorldLocationFormDraft
} from './world-location-draft.js'

export function useWorldLocationDraft(
  location: WorldLocation | null,
  externalDirty = false
) {
  const baseline = useMemo(() => worldLocationDraftFrom(location), [location])
  const [draft, dispatch] = useReducer(reduceWorldLocationDraft, baseline)
  const [tagInput, setTagInput] = useState('')
  const validation = useMemo(() => validateWorldLocationDraft(draft), [draft])
  const dirty =
    canonicalWorldLocationDraft(draft) !==
      canonicalWorldLocationDraft(baseline) ||
    externalDirty ||
    tagInput.trim().length > 0

  const change = <Key extends keyof WorldLocationFormDraft>(
    key: Key,
    value: WorldLocationFormDraft[Key]
  ) => dispatch({ type: 'change', key, value })

  return {
    draft,
    change,
    tagInput,
    setTagInput,
    dirty,
    validation
  }
}
