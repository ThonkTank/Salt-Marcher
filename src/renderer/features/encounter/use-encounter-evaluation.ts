import { useEffect, useState } from 'react'
import type { EncounterSelectionEvaluation } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { encounterCapabilities } from './encounter-capabilities.js'

export function useEncounterEvaluation(
  sceneId: string,
  selectedGroupIds: readonly string[],
  sceneRevision: number,
  onError: (message: string) => void
): EncounterSelectionEvaluation | null {
  const [evaluation, setEvaluation] =
    useState<EncounterSelectionEvaluation | null>(null)

  useEffect(() => {
    let current = true
    void encounterCapabilities()
      .encounter.evaluate(sceneId, selectedGroupIds, sceneRevision)
      .then((value) => {
        if (current) setEvaluation(value)
      })
      .catch((cause) => {
        if (current) onError(capabilityErrorText(cause))
      })
    return () => {
      current = false
    }
  }, [sceneId, sceneRevision, selectedGroupIds, onError])

  return evaluation
}
