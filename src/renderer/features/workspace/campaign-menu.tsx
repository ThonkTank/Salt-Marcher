import { lazy, Suspense, useCallback, useState } from 'react'
import type {
  CampaignCommandReceipt,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/campaign-menu-runtime.de.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import type { GeneratorPresetApplicationLoader } from './generator-preset-application.js'
import type { CampaignRewardRulesPort } from './campaign-reward-rules-port.js'

const EncounterGeneratorSettingsRoute = lazy(() =>
  import('./encounter-generator-settings-route.js').then((module) => ({
    default: module.EncounterGeneratorSettingsRoute
  }))
)
const CampaignManagementDialog = lazy(() =>
  import('./campaign-management-dialog.js').then((module) => ({
    default: module.CampaignManagementDialog
  }))
)

interface CampaignMenuProps {
  snapshot: CampaignSnapshot
  open: boolean
  anchor: HTMLElement | null
  forced: boolean
  partySize: number
  dismiss: () => void
  create: (name: string) => Promise<boolean>
  activate: (id: string) => Promise<boolean>
  rename: (id: string, name: string) => Promise<boolean>
  trash: (id: string) => Promise<boolean>
  restore: (id: string) => Promise<boolean>
  deleteForever: (id: string, confirmationName: string) => Promise<boolean>
  reconciliationPending: boolean
  reconcile: () => Promise<CampaignCommandReceipt | null>
  loadGeneratorPresetApplication: GeneratorPresetApplicationLoader
  campaignRules?: CampaignRewardRulesPort
  onError: (message: string) => void
}

export function CampaignMenu(props: CampaignMenuProps) {
  return props.open ? <OpenCampaignMenu {...props} /> : null
}

function OpenCampaignMenu(props: CampaignMenuProps) {
  const { dismiss, forced, snapshot } = props
  const [view, setView] = useState<'menu' | 'campaigns' | 'settings'>(
    forced ? 'campaigns' : 'menu'
  )
  const closeMenu = useCallback(() => {
    setView('menu')
    dismiss()
  }, [dismiss])

  const effectiveView = forced ? 'campaigns' : view
  if (effectiveView === 'settings')
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
  if (effectiveView === 'campaigns')
    return (
      <Suspense fallback={null}>
        <CampaignManagementDialog
          snapshot={snapshot}
          forced={forced}
          dismiss={closeMenu}
          create={props.create}
          activate={props.activate}
          rename={props.rename}
          trash={props.trash}
          restore={props.restore}
          deleteForever={props.deleteForever}
          reconciliationPending={props.reconciliationPending}
          reconcile={props.reconcile}
          completed={() => setView('menu')}
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
        <button type="button" onClick={() => setView('campaigns')}>
          {message('nav.campaigns')}
        </button>
        <button type="button" onClick={() => setView('settings')}>
          {message('menu.settings')}
        </button>
      </nav>
    </AnchoredPopup>
  )
}
