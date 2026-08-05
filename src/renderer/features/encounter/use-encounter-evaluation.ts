import { useEffect, useState } from 'react'
import type { EncounterSelectionEvaluation } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { encounterCapabilities } from './encounter-capabilities.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'

export function useEncounterEvaluation(
  sceneId: string,
  selectedGroupIds: readonly string[],
  sceneRevision: number,
  onError: (message: string) => void
): EncounterSelectionEvaluation | null {
  const api = useCapabilityApi()
  const [evaluation, setEvaluation] =
    useState<EncounterSelectionEvaluation | null>(null)

  useEffect(() => {
    let current = true
    void encounterCapabilities(api)
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
  }, [api, sceneId, sceneRevision, selectedGroupIds, onError])

  return evaluation
}
