import { lazy, Suspense, useEffect, useState } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { message } from '../../i18n/workspace-runtime.de.js'
import { AdventuringDayDropdown } from '../party/party-controls.js'
import {
  workspaceDefinition,
  type WorkspaceId
} from './workspace-definition.js'
import type { GeneratorPresetApplicationLoader } from './generator-preset-application.js'
import type { CampaignRewardRulesPort } from './campaign-reward-rules-port.js'

const CampaignMenu = lazy(() =>
  import('./campaign-menu.js').then((module) => ({
    default: module.CampaignMenu
  }))
)

export function WorkspaceTopBar(props: {
  campaigns: CampaignSnapshot
  campaignMenuOpen: boolean
  setCampaignMenuOpen: (open: boolean | ((current: boolean) => boolean)) => void
  screen: 'campaigns' | 'workspace'
  showCampaigns: () => void
  workspace: WorkspaceId
  session: LiveSessionSnapshot | null
  openCharacters: () => void
  dayOpen: boolean
  setDayOpen: (open: boolean) => void
  startTravel: () => void
  onError: (message: string) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  loadGeneratorPresetApplication: GeneratorPresetApplicationLoader
  campaignRules?: CampaignRewardRulesPort
}) {
  const active =
    props.screen === 'workspace' && props.campaigns.activeCampaignId !== null
  const activeCampaign = props.campaigns.campaigns.find(
    (campaign) => campaign.id === props.campaigns.activeCampaignId
  )
  const focusedScene = props.session?.scene.scenes.find(
    (scene) => scene.id === props.session?.scene.focusedSceneId
  )
  const definition = workspaceDefinition(props.workspace)
  const openCharacters = props.openCharacters
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null)

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'p' && active) {
        event.preventDefault()
        openCharacters()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active, openCharacters])

  return (
    <header
      className={`top-bar${props.workspace === 'session' ? ' session-context' : ''}`}
    >
      <button
        ref={setMenuAnchor}
        className="menu-button"
        aria-label={message('app.menu')}
        aria-expanded={props.campaignMenuOpen}
        aria-controls="campaign-menu"
        onClick={() => props.setCampaignMenuOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {props.campaignMenuOpen && (
        <Suspense fallback={null}>
          <CampaignMenu
            anchor={menuAnchor}
            snapshot={props.campaigns}
            open
            showCampaigns={props.showCampaigns}
            dismiss={() => props.setCampaignMenuOpen(false)}
            loadGeneratorPresetApplication={
              props.loadGeneratorPresetApplication
            }
            {...(props.campaignRules
              ? { campaignRules: props.campaignRules }
              : {})}
            partySize={
              props.session?.party.members.filter((member) => member.active)
                .length ?? 0
            }
            onError={props.onError}
          />
        </Suspense>
      )}
      {active && props.session && (
        <nav
          className="shell-quick-actions"
          aria-label={message('app.sessionControls')}
        >
          <button>{message('quick.weather')}</button>
          <AdventuringDayDropdown
            party={props.session.party}
            open={props.dayOpen}
            setOpen={props.setDayOpen}
            triggerLabel={message('quick.dayBudget')}
          />
          <button onClick={props.startTravel}>{message('ui.reise')}</button>
          <button
            onClick={props.openCharacters}
            title={message('desktop.charactersShortcut')}
          >
            {message('character.characters')}
          </button>
        </nav>
      )}
      <div className="workspace-heading">
        <p className="eyebrow">{message('ui.saltmarcher')}</p>
        <h1>
          {active && props.workspace === 'session' && activeCampaign
            ? `${message('nav.session')} · ${activeCampaign.name}`
            : active
              ? message(definition.label)
              : message('nav.campaigns')}
        </h1>
      </div>
      <p className="top-bar-status">
        {active && props.workspace === 'session' && focusedScene
          ? formatSessionStatus(focusedScene.gameTimeSeconds)
          : active
            ? message('campaign.statusActive')
            : message('campaign.choose')}
      </p>
      <button
        className="theme-toggle"
        aria-label={
          props.theme === 'dark'
            ? message('theme.toLight')
            : message('theme.toDark')
        }
        title={
          props.theme === 'dark'
            ? message('theme.light')
            : message('theme.dark')
        }
        aria-pressed={props.theme === 'dark'}
        onClick={props.toggleTheme}
      >
        {props.theme === 'dark'
          ? message('theme.light')
          : message('theme.dark')}
      </button>
    </header>
  )
}

function formatSessionStatus(gameTimeSeconds: number) {
  const day = Math.floor(gameTimeSeconds / 86_400) + 1
  const secondsInDay = gameTimeSeconds % 86_400
  const hour = Math.floor(secondsInDay / 3_600)
  const period =
    hour < 6
      ? 'Nacht'
      : hour < 12
        ? 'Vormittag'
        : hour < 18
          ? 'Nachmittag'
          : 'Abend'
  return `Tag ${day} · ${period}`
}
