import { lazy, Suspense, useCallback, useState } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/campaign-menu-runtime.de.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import type { GeneratorPresetApplicationLoader } from './generator-preset-application.js'
import type { CampaignRewardRulesPort } from './campaign-reward-rules-port.js'

const EncounterGeneratorSettingsRoute = lazy(() =>
  import('./encounter-generator-settings-route.js').then((module) => ({
    default: module.EncounterGeneratorSettingsRoute
  }))
)
interface CampaignMenuProps {
  snapshot: CampaignSnapshot
  open: boolean
  anchor: HTMLElement | null
  showCampaigns: () => void
  partySize: number
  dismiss: () => void
  loadGeneratorPresetApplication: GeneratorPresetApplicationLoader
  campaignRules?: CampaignRewardRulesPort
  onError: (message: string) => void
}

export function CampaignMenu(props: CampaignMenuProps) {
  return props.open ? <OpenCampaignMenu {...props} /> : null
}

function OpenCampaignMenu(props: CampaignMenuProps) {
  const { dismiss, snapshot } = props
  const [view, setView] = useState<'menu' | 'settings'>('menu')
  const closeMenu = useCallback(() => {
    setView('menu')
    dismiss()
  }, [dismiss])

  if (view === 'settings')
    return (
      <Suspense
        fallback={
          <p role="status">
            {formatMessage('workspace.loading', {
              name: message('menu.settings')
            })}
          </p>
        }
      >
        <EncounterGeneratorSettingsRoute
          loadApplication={props.loadGeneratorPresetApplication}
          {...(props.campaignRules
            ? { campaignRules: props.campaignRules }
            : {})}
          activeCampaignId={snapshot.activeCampaignId}
          partySize={props.partySize}
          onClose={closeMenu}
          onError={props.onError}
        />
      </Suspense>
    )
  return (
    <AnchoredPopup
      open
      anchor={props.anchor}
      onDismiss={closeMenu}
      className="campaign-menu"
      placement="bottom-start"
      minWidth={176}
    >
      <nav id="campaign-menu" aria-label={message('app.menu')}>
        <button type="button" onClick={props.showCampaigns}>
          {message('nav.campaigns')}
        </button>
        <button type="button" onClick={() => setView('settings')}>
          {message('menu.settings')}
        </button>
      </nav>
    </AnchoredPopup>
  )
}
