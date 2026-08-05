import { formatMessage, message } from '../../i18n/messages.de.js'
import { useCallback, useEffect, lazy, useState } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type { CampaignCapability } from '../../../shared/contracts/capability-api.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CoreProcessStatus } from '../../../shared/contracts/runtime.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { CreatureInspector } from '../reference/creature-inspector.js'
import {
  AdventuringDayDropdown,
  PartyDropdown
} from '../party/party-controls.js'
import { useInstallationPreferences } from '../../shell/use-installation-preferences.js'
import sessionIcon from '../../assets/icons/session.svg?url'
import hexIcon from '../../assets/icons/hex.svg?url'
import catalogIcon from '../../assets/icons/catalog.svg?url'
import saltMarcherLogo from '../../assets/icons/salt-marcher.svg?url'
import SessionWorkspace from '../session/session-workspace.js'
import { CampaignMenu } from './campaign-menu.js'
import './workspace.css'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { ReferenceProvider } from '../reference/reference-provider.js'
import { WorkspaceLoadBoundary } from './workspace-load-boundary.js'

type FantasyIconName = 'session' | 'hex' | 'catalog'

const LazyHexEditor = lazy(async () => {
  return import('../hex/hex-editor.js')
})

const fantasyIconAssets: Record<FantasyIconName, string> = {
  session: sessionIcon,
  hex: hexIcon,
  catalog: catalogIcon
}

function FantasyIcon(props: { name: FantasyIconName }) {
  return <img src={fantasyIconAssets[props.name]} alt="" aria-hidden="true" />
}

const emptyCampaigns: CampaignSnapshot = {
  activeCampaignId: null,
  campaigns: [],
  trashedCampaigns: []
}

export function WorkspaceApp() {
  const capabilityApi = useCapabilityApi()
  const [campaigns, setCampaigns] = useState(emptyCampaigns)
  const [session, setSession] = useState<LiveSessionSnapshot | null>(null)
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false)
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

  const load = useCallback(async () => {
    const nextCampaigns = await capabilityApi.campaigns.list()
    setCampaigns(nextCampaigns)
    if (nextCampaigns.activeCampaignId === null) setCampaignMenuOpen(true)
    setSession(
      nextCampaigns.activeCampaignId ? await capabilityApi.session.read() : null
    )
  }, [capabilityApi])

  useEffect(() => {
    void Promise.resolve().then(load).catch(reportCapabilityError(setError))
  }, [load])

  useEffect(() => {
    void capabilityApi.runtime.coreStatus().then(setCoreStatus)
    return capabilityApi.runtime.onCoreStatus(setCoreStatus)
  }, [capabilityApi])

  useEffect(() => {
    const readback = () => {
      setReadbackKey((current) => current + 1)
      void load().catch(reportCapabilityError(setError))
    }
    window.addEventListener('saltmarcher:readback', readback)
    return () => window.removeEventListener('saltmarcher:readback', readback)
  }, [load])

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

  const campaignCapability = () => capabilityApi.campaigns as CampaignCapability

  async function createCampaign(name: string) {
    try {
      setCampaigns(await campaignCapability().create(name))
      setSession(await capabilityApi.session.read())
      setWorkspace('session')
      setCampaignMenuOpen(false)
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  async function switchCampaign(id: string) {
    try {
      setCampaigns(await campaignCapability().activate(id))
      setSession(await capabilityApi.session.read())
      setWorkspace('session')
      setScenarios({})
      setCampaignMenuOpen(false)
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  async function renameCampaign(id: string, name: string) {
    try {
      setCampaigns(await campaignCapability().rename(id, name))
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  async function trashCampaign(id: string) {
    try {
      const next = await campaignCapability().trash(id)
      setCampaigns(next)
      if (next.activeCampaignId === null) {
        setSession(null)
        setCampaignMenuOpen(true)
      }
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  async function restoreCampaign(id: string) {
    try {
      setCampaigns(await campaignCapability().restore(id))
    } catch (cause) {
      setError(capabilityErrorText(cause))
    }
  }

  async function deleteCampaignForever(id: string, confirmationName: string) {
    try {
      setCampaigns(
        await campaignCapability().deleteForever(id, confirmationName)
      )
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
  const activeCampaign = campaigns.campaigns.find(
    (campaign) => campaign.id === campaigns.activeCampaignId
  )
  const focusedScene = session?.scene.scenes.find(
    (scene) => scene.id === session.scene.focusedSceneId
  )

  return (
    <ReferenceProvider
      capability={capabilityApi.references}
      campaignId={campaigns.activeCampaignId}
      sceneId={session?.scene.focusedSceneId ?? null}
      activateReference={() => {
        setWorkspace('session')
        setSessionLayout({ ...sessionLayout, centerTab: 'details' })
      }}
      onError={setError}
    >
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
                onClick={() => void capabilityApi.runtime.retryCore()}
              >
                {message('core.retry')}
              </button>
            )}
          </div>
        )}
        <header
          className={`top-bar${workspace === 'session' ? ' session-context' : ''}`}
        >
          <button
            className="menu-button"
            aria-label={message('app.menu')}
            title={message('app.menu')}
            aria-expanded={campaignMenuOpen}
            aria-controls="campaign-menu"
            onClick={() =>
              setCampaignMenuOpen((current) => (active ? !current : true))
            }
          >
            <span aria-hidden="true">☰</span>
          </button>
          <CampaignMenu
            snapshot={campaigns}
            open={campaignMenuOpen}
            forced={!active}
            dismiss={() => setCampaignMenuOpen(false)}
            create={createCampaign}
            activate={switchCampaign}
            rename={renameCampaign}
            trash={trashCampaign}
            restore={restoreCampaign}
            deleteForever={deleteCampaignForever}
          />
          {active && session && (
            <nav
              className="shell-quick-actions"
              aria-label={message('app.sessionControls')}
            >
              <button>{message('quick.weather')}</button>
              <AdventuringDayDropdown
                party={session.party}
                open={dayOpen}
                setOpen={setDayOpen}
                triggerLabel={message('quick.rest')}
              />
              <button
                onClick={() => {
                  if (!focusedScene) return
                  setScenarios((current) => ({
                    ...current,
                    [focusedScene.id]: 'travel'
                  }))
                }}
              >
                {message('ui.reise')}
              </button>
              <PartyDropdown
                party={session.party}
                open={partyOpen}
                setOpen={setPartyOpen}
                changed={(party) => {
                  setSession({ ...session, party })
                  void capabilityApi.session.read().then(setSession)
                }}
                onError={setError}
                triggerLabel={message('ui.party')}
              />
            </nav>
          )}
          <div className="workspace-heading">
            <p className="eyebrow">{message('ui.saltmarcher')}</p>
            <h1>
              {workspace === 'session' && activeCampaign
                ? `${message('nav.session')} · ${activeCampaign.name}`
                : heading}
            </h1>
          </div>
          <p className="top-bar-status">
            {workspace === 'session' && focusedScene
              ? formatSessionStatus(
                  focusedScene.gameTimeSeconds,
                  session?.party.adventuringDay
                )
              : active
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
            <img
              className="rail-logo"
              src={saltMarcherLogo}
              alt={message('ui.saltmarcher')}
            />
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
              <section className="campaign-idle" aria-live="polite">
                <p className="section-kicker">{message('campaign.archive')}</p>
                <h2>{message('campaign.choose')}</h2>
                <p>{message('campaign.menuHint')}</p>
              </section>
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
              <WorkspaceLoadBoundary
                key={`catalog-boundary-${readbackKey}`}
                loadingMessage={formatMessage('workspace.loading', {
                  name: message('nav.catalog')
                })}
                failureMessage={formatMessage('workspace.loadFailed', {
                  name: message('nav.catalog')
                })}
                recoveryMessage={message('workspace.reloadHint')}
                reloadLabel={message('action.reloadApplication')}
              >
                <LazyCatalogWorkspace
                  snapshot={session}
                  setSnapshot={setSession}
                  close={() => setWorkspace('session')}
                  inspect={setInspected}
                  onError={setError}
                />
              </WorkspaceLoadBoundary>
            )}
            {active && session && workspace === 'hex' && (
              <WorkspaceLoadBoundary
                key={`hex-boundary-${readbackKey}`}
                loadingMessage={formatMessage('workspace.loading', {
                  name: message('nav.hex')
                })}
                failureMessage={formatMessage('workspace.loadFailed', {
                  name: message('nav.hex')
                })}
                recoveryMessage={message('workspace.reloadHint')}
                reloadLabel={message('action.reloadApplication')}
              >
                <LazyHexEditor onError={setError} />
              </WorkspaceLoadBoundary>
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
    </ReferenceProvider>
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

const LazyCatalogWorkspace = lazy(
  () => import('../catalog/catalog-workspace.js')
)
