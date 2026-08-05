import { useEffect } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { message } from '../../i18n/messages.de.js'
import {
  AdventuringDayDropdown,
  PartyDropdown
} from '../party/party-controls.js'
import { CampaignMenu } from './campaign-menu.js'
import {
  workspaceDefinition,
  type WorkspaceId
} from './workspace-definition.js'

type CampaignActions = Readonly<{
  create: (name: string) => Promise<void>
  activate: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  trash: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
  deleteForever: (id: string, confirmationName: string) => Promise<void>
}>

export function WorkspaceTopBar(props: {
  campaigns: CampaignSnapshot
  campaignMenuOpen: boolean
  setCampaignMenuOpen: (open: boolean | ((current: boolean) => boolean)) => void
  campaignActions: CampaignActions
  workspace: WorkspaceId
  session: LiveSessionSnapshot | null
  partyOpen: boolean
  setPartyOpen: (open: boolean | ((current: boolean) => boolean)) => void
  dayOpen: boolean
  setDayOpen: (open: boolean) => void
  setSession: (snapshot: LiveSessionSnapshot) => void
  startTravel: () => void
  onError: (message: string) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}) {
  const active = props.campaigns.activeCampaignId !== null
  const activeCampaign = props.campaigns.campaigns.find(
    (campaign) => campaign.id === props.campaigns.activeCampaignId
  )
  const focusedScene = props.session?.scene.scenes.find(
    (scene) => scene.id === props.session?.scene.focusedSceneId
  )
  const definition = workspaceDefinition(props.workspace)
  const setPartyOpen = props.setPartyOpen

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'p' && active) {
        event.preventDefault()
        setPartyOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active, setPartyOpen])

  return (
    <header
      className={`top-bar${props.workspace === 'session' ? ' session-context' : ''}`}
    >
      <button
        className="menu-button"
        aria-label={message('app.menu')}
        title={message('app.menu')}
        aria-expanded={props.campaignMenuOpen}
        aria-controls="campaign-menu"
        onClick={() =>
          props.setCampaignMenuOpen((current) => (active ? !current : true))
        }
      >
        <span aria-hidden="true">☰</span>
      </button>
      <CampaignMenu
        snapshot={props.campaigns}
        open={props.campaignMenuOpen}
        forced={!active}
        dismiss={() => props.setCampaignMenuOpen(false)}
        {...props.campaignActions}
      />
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
            triggerLabel={message('quick.rest')}
          />
          <button onClick={props.startTravel}>{message('ui.reise')}</button>
          <PartyDropdown
            party={props.session.party}
            open={props.partyOpen}
            setOpen={props.setPartyOpen}
            changed={(party) => props.setSession({ ...props.session!, party })}
            onError={props.onError}
            triggerLabel={message('ui.party')}
          />
        </nav>
      )}
      <div className="workspace-heading">
        <p className="eyebrow">{message('ui.saltmarcher')}</p>
        <h1>
          {props.workspace === 'session' && activeCampaign
            ? `${message('nav.session')} · ${activeCampaign.name}`
            : active
              ? message(definition.label)
              : message('nav.campaigns')}
        </h1>
      </div>
      <p className="top-bar-status">
        {props.workspace === 'session' && focusedScene
          ? formatSessionStatus(
              focusedScene.gameTimeSeconds,
              props.session?.party.adventuringDay
            )
          : active
            ? message('campaign.statusActive')
            : message('campaign.statusChoose')}
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

function formatSessionStatus(
  gameTimeSeconds: number,
  dayBudget: LiveSessionSnapshot['party']['adventuringDay'] | undefined
) {
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
  const progress =
    dayBudget?.available && dayBudget.dailyBudget > 0
      ? Math.min(
          100,
          Math.round((dayBudget.longRestXp / dayBudget.dailyBudget) * 100)
        )
      : null
  return `Tag ${day} · ${period}${progress === null ? '' : ` · ${progress} % Tagesbudget`}`
}
