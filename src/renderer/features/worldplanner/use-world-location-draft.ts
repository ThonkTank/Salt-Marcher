import { useMemo, useReducer, useRef, useState } from 'react'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { canonicalWorldLocationTag } from '../../../shared/values/world-location-values.js'
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
  externalDirty = false,
  inputDisabled: () => boolean = () => false
) {
  const baseline = useMemo(() => worldLocationDraftFrom(location), [location])
  const [draft, dispatch] = useReducer(reduceWorldLocationDraft, baseline)
  const [tagInput, rawSetTagInput] = useState('')
  const current = useRef(draft)
  const pendingTag = useRef(tagInput)
  const validation = useMemo(() => validateWorldLocationDraft(draft), [draft])
  const isDirty = () =>
    canonicalWorldLocationDraft(current.current) !==
      canonicalWorldLocationDraft(baseline) ||
    externalDirty ||
    pendingTag.current.trim().length > 0
  const blocked = () =>
    maintenanceDraftCoordinator.isLocked() || inputDisabled()
  const apply = <Key extends keyof WorldLocationFormDraft>(
    key: Key,
    value: WorldLocationFormDraft[Key]
  ) => {
    current.current = reduceWorldLocationDraft(current.current, {
      type: 'change',
      key,
      value
    })
    dispatch({ type: 'change', key, value })
  }
  const change = <Key extends keyof WorldLocationFormDraft>(
    key: Key,
    value: WorldLocationFormDraft[Key]
  ) => {
    if (!blocked()) apply(key, value)
  }
  const setTagInput = (value: string) => {
    if (blocked()) return
    pendingTag.current = value
    rawSetTagInput(value)
  }
  const acceptRelated = (
    key: 'factionIds' | 'encounterTableIds',
    id: string
  ) => {
    if (inputDisabled())
      throw new Error(
        'Der Ort wurde bereits gespeichert oder wird gerade gespeichert. Bitte erneut öffnen.'
      )
    const ids = current.current[key]
    if (!ids.includes(id)) apply(key, [...ids, id])
  }
  const prepareSave = () => {
    const tag = pendingTag.current.trim()
    if (tag) {
      const canonical = canonicalWorldLocationTag(tag)
      const duplicate = current.current.tags.some(
        (entry) => canonicalWorldLocationTag(entry) === canonical
      )
      if (
        !canonical ||
        tag.length > 40 ||
        (!duplicate && current.current.tags.length >= 20)
      )
        return null
      if (!duplicate) apply('tags', [...current.current.tags, tag])
      pendingTag.current = ''
      rawSetTagInput('')
    }
    return validateWorldLocationDraft(current.current).draft
  }
  return {
    draft,
    change,
    tagInput,
    setTagInput,
    dirty:
      canonicalWorldLocationDraft(draft) !==
        canonicalWorldLocationDraft(baseline) ||
      externalDirty ||
      tagInput.trim().length > 0,
    isDirty,
    validation,
    acceptRelated,
    prepareSave
  }
}
