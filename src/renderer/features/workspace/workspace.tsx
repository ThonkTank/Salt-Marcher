import type { CatalogNavigation } from '../catalog/catalog-section-selector.js'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction
} from 'react'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CoreProcessStatus } from '../../../shared/contracts/runtime.js'
import { message } from '../../i18n/workspace-runtime.de.js'
import { message as campaignMessage } from '../../i18n/campaign-menu-runtime.de.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { useInstallationPreferences } from '../../shell/use-installation-preferences.js'
import { CreatureInspector } from '../reference/creature-inspector.js'
import { ReferenceProvider } from '../reference/reference-provider.js'
import { useCampaignSessionCoordinator } from './use-campaign-session-coordinator.js'
import { useWorkspaceErrors } from './use-workspace-errors.js'
import { WorkspaceErrors } from './workspace-errors.js'
import { WorkspaceRail } from './workspace-rail.js'
import { WorkspaceRouteHost } from './workspace-route-host.js'
import { WorkspaceTopBar } from './workspace-top-bar.js'
import { workspaceDefinition } from './workspace-definition.js'
import './workspace.css'
import type {
  GeneratorPresetApplicationLoader,
  GeneratorPresetApplicationOwner
} from './generator-preset-application.js'
import { createCampaignRewardRulesPort } from './campaign-reward-rules-port.js'

const CampaignScreen = lazy(() =>
  import('./campaign-screen.js').then((module) => ({
    default: module.CampaignScreen
  }))
)

export function WorkspaceApp() {
  const api = useCapabilityApi()
  const { errors, report, dismiss } = useWorkspaceErrors()
  const campaignError = useCallback(
    (text: string) => report('campaign', 'campaign.operation', text),
    [report]
  )
  const featureError = useCallback(
    (text: string) => report('workspace', 'feature.operation', text),
    [report]
  )
  const settingsError = useCallback(
    (text: string) => report('settings', 'settings.operation', text),
    [report]
  )
  const [coreStatus, setCoreStatus] = useState<CoreProcessStatus>('starting')
  const [reachedReady, setReachedReady] = useState(false)
  const acceptCoreStatus = useCallback((status: CoreProcessStatus) => {
    setCoreStatus(status)
    if (status === 'ready') setReachedReady(true)
  }, [])
  const coordinator = useCampaignSessionCoordinator(
    campaignError,
    coreStatus === 'ready'
  )
  const { theme, toggleTheme } = useInstallationPreferences(
    settingsError,
    coreStatus === 'ready'
  )
  const [catalogNavigation, setCatalogNavigation] = useState<
    Record<string, CatalogNavigation>
  >({})
  const [dayOpen, setDayOpen] = useState(false)
  const [inspected, setInspected] = useState<Creature | null>(null)
  const active = coordinator.campaigns.activeCampaignId !== null
  const generatorPresetOwner =
    useRef<Promise<GeneratorPresetApplicationOwner> | null>(null)
  const loadGeneratorPresetApplication =
    useCallback<GeneratorPresetApplicationLoader>(
      async (campaignId) => {
        const pending =
          generatorPresetOwner.current ??
          import('./generator-preset-application.js').then((module) =>
            module.createGeneratorPresetApplicationOwner(api.generatorPresets)
          )
        generatorPresetOwner.current = pending
        try {
          return (await pending).port(campaignId)
        } catch (error) {
          if (generatorPresetOwner.current === pending)
            generatorPresetOwner.current = null
          throw error
        }
      },
      [api.generatorPresets]
    )

  useEffect(
    () => () => {
      const pending = generatorPresetOwner.current
      generatorPresetOwner.current = null
      void pending?.then((owner) => owner.dispose())
    },
    [api.generatorPresets]
  )

  useEffect(() => {
    void api.runtime.coreStatus().then(acceptCoreStatus)
    return api.runtime.onCoreStatus(acceptCoreStatus)
  }, [acceptCoreStatus, api.runtime])

  const focusedSceneId = coordinator.session?.scene.focusedSceneId ?? ''
  const setWorkspace = coordinator.setWorkspace
  const routeDesktopReference = useCallback(
    (target: ReferenceTarget, title: string | undefined, separate: boolean) => {
      const campaignId = coordinator.campaigns.activeCampaignId
      const sceneId = focusedSceneId
      if (!campaignId || !sceneId) return
      setWorkspace('session')
      void import('../scene-desktop/desktop-projection.js')
        .then(async ({ desktopProjection }) => {
          const projection = desktopProjection(api.sceneDesktop, {
            campaignId,
            sceneId
          })
          await projection.load()
          projection.dispatch({
            type: 'open-reference',
            entry: {
              target,
              title: title?.slice(0, 300) || message('desktop.reference'),
              scrollTop: 0
            },
            ...(separate ? { separateId: crypto.randomUUID() } : {})
          })
        })
        .catch(() => featureError(message('desktop.referenceOpenFailed')))
    },
    [
      api.sceneDesktop,
      coordinator.campaigns.activeCampaignId,
      setWorkspace,
      focusedSceneId,
      featureError
    ]
  )
  const setCoordinatorSession = coordinator.setSession
  const setSnapshot = useCallback(
    (update: SetStateAction<LiveSessionSnapshot>) =>
      setCoordinatorSession((current) => {
        if (current === null) return null
        return typeof update === 'function' ? update(current) : update
      }),
    [setCoordinatorSession]
  )
  const activeCampaignId = coordinator.campaigns.activeCampaignId
  const openSceneWindow = (type: 'open-map' | 'open-characters') => {
    if (!activeCampaignId || !focusedSceneId) return
    coordinator.setWorkspace('session')
    const scope = { campaignId: activeCampaignId, sceneId: focusedSceneId }
    void import('../scene-desktop/desktop-projection.js')
      .then(async ({ desktopProjection }) => {
        const projection = desktopProjection(api.sceneDesktop, scope)
        await projection.load()
        projection.dispatch({ type })
        if (type === 'open-map')
          projection.dispatch({ type: 'map-controls', value: true })
        projection.requestFocus(type === 'open-map' ? 'map' : 'characters')
      })
      .catch(() => featureError(message('desktop.referenceOpenFailed')))
  }
  const surfaceProps =
    coordinator.session && activeCampaignId
      ? {
          campaignId: activeCampaignId,
          catalogNavigation: catalogNavigation[activeCampaignId] ?? {
            section: 'monsters' as const,
            characterId: null
          },
          navigateCatalog: (navigation: CatalogNavigation) =>
            setCatalogNavigation((current) => ({
              ...current,
              [activeCampaignId]: navigation
            })),
          openCharacter: (characterId: string) => {
            setCatalogNavigation((current) => ({
              ...current,
              [activeCampaignId]: { section: 'characters', characterId }
            }))
            coordinator.setWorkspace('catalog')
          },
          snapshot: coordinator.session,
          setSnapshot,
          inspect: setInspected,
          onError: featureError,
          returnToSession: () => coordinator.setWorkspace('session')
        }
      : null
  const definition = workspaceDefinition(coordinator.workspace)

  if (!reachedReady)
    return (
      <main className="app-shell">
        <CoreStatusBanner
          status={coreStatus}
          retry={() => void api.runtime.retryCore()}
        />
      </main>
    )

  return (
    <ReferenceProvider
      routeReference={routeDesktopReference}
      enabled={coordinator.screen === 'workspace'}
      capability={api.references}
      campaignId={coordinator.campaigns.activeCampaignId}
      sceneId={coordinator.session?.scene.focusedSceneId ?? null}
      onError={featureError}
    >
      <main
        className="app-shell"
        data-renderer-ready="gm"
        data-active-campaign-id={activeCampaignId ?? ''}
        data-session-campaign-id={coordinator.sessionCampaignId ?? ''}
        data-session-revision={coordinator.session?.revision ?? ''}
        data-active-workspace={
          coordinator.screen === 'campaigns'
            ? 'campaigns'
            : coordinator.workspace
        }
        data-screen={coordinator.screen}
        aria-busy={coreStatus !== 'ready' || undefined}
      >
        {coreStatus !== 'ready' && (
          <CoreStatusBanner
            status={coreStatus}
            retry={() => void api.runtime.retryCore()}
          />
        )}
        <WorkspaceTopBar
          campaigns={coordinator.campaigns}
          campaignMenuOpen={coordinator.campaignMenuOpen}
          setCampaignMenuOpen={coordinator.setCampaignMenuOpen}
          screen={coordinator.screen}
          showCampaigns={coordinator.showCampaigns}
          workspace={coordinator.workspace}
          session={coordinator.session}
          dayOpen={dayOpen}
          setDayOpen={setDayOpen}
          openCharacters={() => openSceneWindow('open-characters')}
          startTravel={() => openSceneWindow('open-map')}
          onError={featureError}
          theme={theme}
          toggleTheme={toggleTheme}
          loadGeneratorPresetApplication={loadGeneratorPresetApplication}
          campaignRules={createCampaignRewardRulesPort(api)}
        />
        {coordinator.screen === 'campaigns' ? (
          <Suspense
            fallback={
              <p role="status">{campaignMessage('campaign.loading')}</p>
            }
          >
            <CampaignScreen
              snapshot={coordinator.campaigns}
              status={coordinator.catalogStatus}
              error={coordinator.error}
              busy={coordinator.busy || coreStatus !== 'ready'}
              sessionRetry={coordinator.sessionRetry}
              retryCatalog={coordinator.retryCatalog}
              retrySession={coordinator.retrySession}
              create={coordinator.createCampaign}
              activate={coordinator.switchCampaign}
              rename={coordinator.renameCampaign}
              trash={coordinator.trashCampaign}
              restore={coordinator.restoreCampaign}
              deleteForever={coordinator.deleteCampaignForever}
              reconciliationPending={coordinator.campaignReconciliationPending}
              reconcile={coordinator.reconcileCampaign}
            />
          </Suspense>
        ) : (
          <div className="shell-body">
            <WorkspaceRail
              active={active}
              workspace={coordinator.workspace}
              select={coordinator.setWorkspace}
            />
            <div
              className={`work-area layout-${active ? definition.layout : 'scroll'}`}
            >
              <WorkspaceRouteHost
                active={active}
                workspace={coordinator.workspace}
                surfaceProps={surfaceProps}
                runtime={api.runtime}
              />
            </div>
          </div>
        )}
        <WorkspaceErrors errors={errors} dismiss={dismiss} />
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

function CoreStatusBanner(props: {
  status: CoreProcessStatus
  retry: () => void
}) {
  return (
    <div className="core-status-banner" role="status">
      <span>{coreStatusMessage(props.status)}</span>
      {props.status === 'unavailable' && (
        <button type="button" onClick={props.retry}>
          {message('core.retry')}
        </button>
      )}
    </div>
  )
}

function coreStatusMessage(status: CoreProcessStatus): string {
  switch (status) {
    case 'unavailable':
      return message('core.unavailable')
    case 'incompatible-data':
      return message('core.incompatibleData')
    case 'corrupt-data':
      return message('core.corruptData')
    case 'access-denied':
      return message('core.accessDenied')
    case 'resource-missing':
      return message('core.resourceMissing')
    case 'invalid-configuration':
      return message('core.invalidConfiguration')
    default:
      return message('core.recovering')
  }
}
