import { useEffect, lazy, useState, type FormEvent } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CoreProcessStatus } from '../../../shared/contracts/runtime.js'
import { errorText, showError } from '../catalog/catalog-state.js'
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
import { message } from '../../i18n/messages.de.js'
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
    void Promise.resolve().then(load).catch(showError(setError))
  }, [])

  useEffect(() => {
    void window.saltMarcher.runtime.coreStatus().then(setCoreStatus)
    return window.saltMarcher.runtime.onCoreStatus(setCoreStatus)
  }, [])

  useEffect(() => {
    const readback = () => {
      setReadbackKey((current) => current + 1)
      void load().catch(showError(setError))
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
      setError(errorText(cause))
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
      setError(errorText(cause))
    }
  }

  const heading = active
    ? workspace === 'catalog'
      ? 'Katalog'
      : workspace === 'hex'
        ? 'Hex-Editor'
        : 'Session'
    : 'Kampagnen'

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
        <button className="menu-button" aria-label="Menü" title="Menü">
          <span aria-hidden="true">☰</span>
        </button>
        {active && session && (
          <>
            <nav className="shell-quick-actions" aria-label="Sitzungssteuerung">
              <button>Zeit</button>
              <button>Wetter</button>
              <button>Musik</button>
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
          <p className="eyebrow">SaltMarcher</p>
          <h1>{heading}</h1>
        </div>
        <p className="top-bar-status">
          {active ? 'Live-Session' : 'Kampagne auswählen oder erstellen'}
        </p>
        <button
          className="theme-toggle"
          aria-label={
            theme === 'dark'
              ? 'Zum Pergamentmodus wechseln'
              : 'Zum Kerzenlichtmodus wechseln'
          }
          title={theme === 'dark' ? 'Tageslicht' : 'Kerzenlicht'}
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? 'Tageslicht' : 'Kerzenlicht'}
        </button>
      </header>
      <div className="shell-body">
        <nav className="icon-bar" aria-label="Arbeitsbereiche">
          <button
            className="icon-button"
            aria-label="Kampagnen"
            title="Kampagnen"
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
                aria-label="Session"
                title="Session"
                aria-pressed={workspace === 'session'}
                onClick={() => setWorkspace('session')}
              >
                <FantasyIcon name="session" />
              </button>
              <button
                className="icon-button"
                aria-label="Hex-Editor"
                title="Hex-Editor"
                aria-pressed={workspace === 'hex'}
                onClick={() => setWorkspace('hex')}
              >
                <FantasyIcon name="hex" />
              </button>
              <button
                className="icon-button"
                aria-label="Katalog"
                title="Katalog"
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
        <p className="section-kicker">Kampagnenarchiv</p>
        <h2>Kampagne auswählen</h2>
        <p>Eine neue Kampagne beginnen oder eine bestehende fortsetzen.</p>
      </div>
      <form
        onSubmit={(event) => void props.createCampaign(event)}
        className="inline-form"
      >
        <input
          id="campaign-name"
          aria-label="Kampagnenname"
          placeholder="Kampagnenname"
          required
          value={props.name}
          onChange={(event) => props.setName(event.target.value)}
        />
        <button>Kampagne erstellen</button>
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
