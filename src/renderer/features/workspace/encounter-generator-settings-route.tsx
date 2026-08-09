import { useEffect, useState } from 'react'
import { EncounterGeneratorSettings } from './encounter-generator-settings.js'
import type {
  GeneratorPresetApplicationLoader,
  GeneratorPresetApplicationPort
} from './generator-preset-application.js'
import { message } from '../../i18n/generator-runtime.de.js'

type EncounterGeneratorSettingsRouteProps = {
  loadApplication: GeneratorPresetApplicationLoader
  activeCampaignId: string | null
  partySize: number
  onClose: () => void
  onError: (message: string) => void
}

export function EncounterGeneratorSettingsRoute({
  loadApplication,
  ...props
}: EncounterGeneratorSettingsRouteProps) {
  const { activeCampaignId, onError } = props
  const [application, setApplication] =
    useState<GeneratorPresetApplicationPort | null>(null)
  useEffect(() => {
    let active = true
    void loadApplication(activeCampaignId)
      .then((next) => active && setApplication(next))
      .catch((error: unknown) => {
        if (!active) return
        onError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      active = false
    }
  }, [activeCampaignId, loadApplication, onError])
  if (!application) return <p role="status">{message('g.loading')}</p>
  return <EncounterGeneratorSettings {...props} application={application} />
}
