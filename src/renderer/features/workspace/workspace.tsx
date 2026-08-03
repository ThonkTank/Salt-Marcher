import { message } from '../../i18n/messages.de.js'
import { useEffect, lazy, useState, type FormEvent } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CoreProcessStatus } from '../../../shared/contracts/runtime.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { CreatureInspector } from '../catalog/creature-inspector.js'
import {
  AdventuringDayDropdown,
  PartyDropdown
} from '../party/party-controls.js'
import { useInstallationPreferences } from '../../shell/use-installation-preferences.js'
import campaignIcon from '../../assets/icons/campaign.svg?url'
import sessionIcon from '../../assets/icons/session.svg?url'
import hexIcon from '../../assets/icons/hex.svg?url'
import catalogIcon from '../../assets/icons/catalog.svg?url'
import SessionWorkspace from '../session/session-workspace.js'

type FantasyIconName = 'campaign' | 'session' | 'hex' | 'catalog'

const LazyHexEditor = lazy(async () => {
  return import('../hex/hex-editor.js')
})

const fantasyIconAssets: Record<FantasyIconName, string> = {
  campaign: campaignIcon,
  session: sessionIcon,
  hex: hexIcon,
  catalog: catalogIcon
}

function FantasyIcon(props: { name: FantasyIconName }) {
  return <img src={fantasyIconAssets[props.name]} alt="" aria-hidden="true" />
}

declare global {
  interface Window {
    saltMarcher: import('../../../shared/contracts/capability-api.js').SaltMarcherApi
  }
}

const emptyCampaigns: CampaignSnapshot = {
  activeCampaignId: null,
  campaigns: []
}

export function WorkspaceApp() {
  const [campaigns, setCampaigns] = useState(emptyCampaigns)
  const [session, setSession] = useState<LiveSessionSnapshot | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [workspace, setWorkspace] = useState<'session' | 'catalog' | 'hex'>(
    'session'
  )
  const [partyOpen, setPartyOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [scenarios, setScenarios] = useState<
    Record<string, '' | 'encounter' | 'travel'>
  >({})
  const [inspected, setInspected] = useState<Creature | null>(null)
  const [error, setError] = useState('')
  const { theme, toggleTheme, sessionLayout, setSessionLayout } =
    useInstallationPreferences(setError)
  const [coreStatus, setCoreStatus] = useState<CoreProcessStatus>('starting')
  const [readbackKey, setReadbackKey] = useState(0)
  const active = campaigns.activeCampaignId !== null

  const load = async () => {
    const nextCampaigns = await window.saltMarcher.campaigns.list()
    setCampaigns(nextCampaigns)
    setSession(
      nextCampaigns.activeCampaignId
        ? await window.saltMarcher.session.read()
        : null
    )
  }

  useEffect(() => {
    void Promise.resolve().then(load).catch(reportCapabilityError(setError))
  }, [])

  useEffect(() => {
    void window.saltMarcher.runtime.coreStatus().then(setCoreStatus)
    return window.saltMarcher.runtime.onCoreStatus(setCoreStatus)
  }, [])

  useEffect(() => {
    const readback = () => {
      setReadbackKey((current) => current + 1)
      void load().catch(reportCapabilityError(setError))
    }
    window.addEventListener('saltmarcher:readback', readback)
    return () => window.removeEventListener('saltmarcher:readback', readback)
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'p' && active) {
        event.preventDefault()
        setPartyOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active])

  async function createCampaign(event: FormEvent) {
    event.preventDefault()
    try {
      const capability = window.saltMarcher
        .campaigns as import('../../../shared/contracts/capability-api.js').CampaignCapability
      setCampaigns(await capability.create(campaignName))
      setCampaignName('')
      setSession(await window.saltMarcher.session.read())
      setWorkspace('session')
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  async function switchCampaign(id: string) {
    try {
      const capability = window.saltMarcher
        .campaigns as import('../../../shared/contracts/capability-api.js').CampaignCapability
      setCampaigns(await capability.activate(id))
      setSession(await window.saltMarcher.session.read())
      setWorkspace('session')
      setScenarios({})
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  const heading = active
    ? workspace === 'catalog'
      ? message('nav.catalog')
      : workspace === 'hex'
        ? message('nav.hex')
        : message('nav.session')
    : message('nav.campaigns')

  return (
    <main className="app-shell">
      {coreStatus !== 'ready' && (
        <div className="core-status-banner" role="status">
          <span>
            {coreStatus === 'unavailable'
              ? message('core.unavailable')
              : message('core.recovering')}
          </span>
          {coreStatus === 'unavailable' && (
            <button
              type="button"
              onClick={() => void window.saltMarcher.runtime.retryCore()}
            >
              {message('core.retry')}
            </button>
          )}
        </div>
      )}
      <header className="top-bar">
        <button
          className="menu-button"
          aria-label={message('app.menu')}
          title={message('app.menu')}
        >
          <span aria-hidden="true">☰</span>
        </button>
        {active && session && (
          <>
            <nav
              className="shell-quick-actions"
              aria-label={message('app.sessionControls')}
            >
              <button>{message('quick.time')}</button>
              <button>{message('quick.weather')}</button>
              <button>{message('quick.music')}</button>
            </nav>
            <AdventuringDayDropdown
              party={session.party}
              open={dayOpen}
              setOpen={setDayOpen}
            />
            <PartyDropdown
              party={session.party}
              open={partyOpen}
              setOpen={setPartyOpen}
              changed={(party) => {
                setSession({ ...session, party })
                void window.saltMarcher.session.read().then(setSession)
              }}
              onError={setError}
            />
          </>
        )}
        <div className="workspace-heading">
          <p className="eyebrow">{message('ui.saltmarcher')}</p>
          <h1>{heading}</h1>
        </div>
        <p className="top-bar-status">
          {active
            ? message('campaign.statusActive')
            : message('campaign.statusChoose')}
        </p>
        <button
          className="theme-toggle"
          aria-label={
            theme === 'dark'
              ? message('theme.toLight')
              : message('theme.toDark')
          }
          title={
            theme === 'dark' ? message('theme.light') : message('theme.dark')
          }
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? message('theme.light') : message('theme.dark')}
        </button>
      </header>
      <div className="shell-body">
        <nav className="icon-bar" aria-label={message('app.workspaces')}>
          <button
            className="icon-button"
            aria-label={message('nav.campaigns')}
            title={message('nav.campaigns')}
            aria-pressed={!active}
            onClick={() => {
              setCampaigns({ ...campaigns, activeCampaignId: null })
              setSession(null)
            }}
          >
            <FantasyIcon name="campaign" />
          </button>
          {active && (
            <>
              <button
                className="icon-button"
                aria-label={message('nav.session')}
                title={message('nav.session')}
                aria-pressed={workspace === 'session'}
                onClick={() => setWorkspace('session')}
              >
                <FantasyIcon name="session" />
              </button>
              <button
                className="icon-button"
                aria-label={message('nav.hex')}
                title={message('nav.hex')}
                aria-pressed={workspace === 'hex'}
                onClick={() => setWorkspace('hex')}
              >
                <FantasyIcon name="hex" />
              </button>
              <button
                className="icon-button"
                aria-label={message('nav.catalog')}
                title={message('nav.catalog')}
                aria-pressed={workspace === 'catalog'}
                onClick={() => setWorkspace('catalog')}
              >
                <FantasyIcon name="catalog" />
              </button>
            </>
          )}
        </nav>
        <div className={`work-area${active ? ' session-work-area' : ''}`}>
          {error && (
            <p className="error-message" role="alert">
              {error}{' '}
              <button className="compact" onClick={() => setError('')}>
                {message('action.close')}
              </button>
            </p>
          )}
          {!active && (
            <CampaignChooser
              campaigns={campaigns}
              name={campaignName}
              setName={setCampaignName}
              createCampaign={createCampaign}
              switchCampaign={switchCampaign}
            />
          )}
          {active && session && workspace === 'session' && (
            <SessionWorkspace
              key={`session-${readbackKey}`}
              snapshot={session}
              setSnapshot={setSession}
              groupDialogOpen={groupDialogOpen}
              setGroupDialogOpen={setGroupDialogOpen}
              scenario={
                session.combat
                  ? 'encounter'
                  : (scenarios[session.scene.focusedSceneId] ?? '')
              }
              setScenario={(scenario) =>
                setScenarios((current) => ({
                  ...current,
                  [session.scene.focusedSceneId]: scenario
                }))
              }
              layout={sessionLayout}
              setLayout={setSessionLayout}
              onError={setError}
            />
          )}
          {active && session && workspace === 'catalog' && (
            <LazyCatalogWorkspace
              key={`catalog-${readbackKey}`}
              snapshot={session}
              setSnapshot={setSession}
              close={() => setWorkspace('session')}
              inspect={setInspected}
              onError={setError}
            />
          )}
          {active && session && workspace === 'hex' && (
            <LazyHexEditor key={`hex-${readbackKey}`} onError={setError} />
          )}
        </div>
      </div>
      {inspected && (
        <CreatureInspector
          creature={inspected}
          close={() => setInspected(null)}
        />
      )}
    </main>
  )
}

function CampaignChooser(props: {
  campaigns: CampaignSnapshot
  name: string
  setName: (value: string) => void
  createCampaign: (event: FormEvent) => Promise<void>
  switchCampaign: (id: string) => Promise<void>
}) {
  return (
    <section className="workspace-panel campaign-panel">
      <div>
        <p className="section-kicker">{message('campaign.archive')}</p>
        <h2>{message('campaign.choose')}</h2>
        <p>{message('campaign.intro')}</p>
      </div>
      <form
        onSubmit={(event) => void props.createCampaign(event)}
        className="inline-form"
      >
        <input
          id="campaign-name"
          aria-label={message('campaign.name')}
          placeholder={message('campaign.name')}
          required
          value={props.name}
          onChange={(event) => props.setName(event.target.value)}
        />
        <button>{message('action.createCampaign')}</button>
      </form>
      <div className="campaigns">
        {props.campaigns.campaigns.map((campaign) => (
          <button
            key={campaign.id}
            onClick={() => void props.switchCampaign(campaign.id)}
          >
            {campaign.name}
          </button>
        ))}
      </div>
    </section>
  )
}

const LazyCatalogWorkspace = lazy(
  () => import('../catalog/catalog-workspace.js')
)
