import { useCallback, useEffect, useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { CoreProcessStatus } from '../../../shared/contracts/runtime.js'
import { message } from '../../i18n/workspace-runtime.de.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { useInstallationPreferences } from '../../shell/use-installation-preferences.js'
import { CreatureInspector } from '../reference/creature-inspector.js'
import { ReferenceProvider } from '../reference/reference-provider.js'
import { useCampaignSessionCoordinator } from './use-campaign-session-coordinator.js'
import { useWorkspaceErrors } from './use-workspace-errors.js'
import { WorkspaceErrors } from './workspace-errors.js'
import { WorkspaceRail } from './workspace-rail.js'
import { WorkspaceRouteHost } from './workspace-route-host.js'
import type { SessionScenario } from '../session/session-scenario.js'
import { WorkspaceTopBar } from './workspace-top-bar.js'
import { workspaceDefinition } from './workspace-definition.js'
import './workspace.css'
import type { GeneratorPresetApplicationLoader } from './generator-preset-application.js'
import { createCampaignRewardRulesPort } from './campaign-reward-rules-port.js'

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
  const coordinator = useCampaignSessionCoordinator(
    api,
    campaignError,
    coreStatus === 'ready'
  )
  const { theme, toggleTheme, sessionLayout, setSessionLayout } =
    useInstallationPreferences(settingsError, coreStatus === 'ready')
  const [partyOpen, setPartyOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [scenarios, setScenarios] = useState<Record<string, SessionScenario>>(
    {}
  )
  const [inspected, setInspected] = useState<Creature | null>(null)
  const active = coordinator.campaigns.activeCampaignId !== null
  const loadGeneratorPresetApplication =
    useCallback<GeneratorPresetApplicationLoader>(
      async (campaignId) => {
        const { createGeneratorPresetApplicationPort } =
          await import('./generator-preset-application.js')
        return createGeneratorPresetApplicationPort(
          api.generatorPresets,
          campaignId
        )
      },
      [api.generatorPresets]
    )

  useEffect(() => {
    void api.runtime.coreStatus().then(setCoreStatus)
    return api.runtime.onCoreStatus(setCoreStatus)
  }, [api.runtime])

  const focusedSceneId = coordinator.session?.scene.focusedSceneId ?? ''
  const surfaceProps = coordinator.session
    ? {
        snapshot: coordinator.session,
        setSnapshot: coordinator.setSession,
        scenario: coordinator.session.combat
          ? ('encounter' as const)
          : (scenarios[focusedSceneId] ?? 'encounter'),
        setScenario: (scenario: SessionScenario) =>
          setScenarios((current) => ({
            ...current,
            [focusedSceneId]: scenario
          })),
        layout: sessionLayout,
        setLayout: setSessionLayout,
        inspect: setInspected,
        onError: featureError,
        returnToSession: () => coordinator.setWorkspace('session')
      }
    : null
  const definition = workspaceDefinition(coordinator.workspace)

  if (coreStatus !== 'ready')
    return (
      <main className="app-shell">
        <div className="core-status-banner" role="status">
          <span>{coreStatusMessage(coreStatus)}</span>
          {coreStatus === 'unavailable' && (
            <button type="button" onClick={() => void api.runtime.retryCore()}>
              {message('core.retry')}
            </button>
          )}
        </div>
      </main>
    )

  return (
    <ReferenceProvider
      capability={api.references}
      campaignId={coordinator.campaigns.activeCampaignId}
      sceneId={coordinator.session?.scene.focusedSceneId ?? null}
      activateReference={() => {
        coordinator.setWorkspace('session')
        setSessionLayout({ ...sessionLayout, centerTab: 'details' })
      }}
      onError={featureError}
    >
      <main className="app-shell" data-renderer-ready="gm">
        <WorkspaceTopBar
          campaigns={coordinator.campaigns}
          campaignMenuOpen={coordinator.campaignMenuOpen}
          setCampaignMenuOpen={coordinator.setCampaignMenuOpen}
          campaignActions={{
            create: coordinator.createCampaign,
            activate: coordinator.switchCampaign,
            rename: coordinator.renameCampaign,
            trash: coordinator.trashCampaign,
            restore: coordinator.restoreCampaign,
            deleteForever: coordinator.deleteCampaignForever
          }}
          workspace={coordinator.workspace}
          session={coordinator.session}
          partyOpen={partyOpen}
          setPartyOpen={setPartyOpen}
          dayOpen={dayOpen}
          setDayOpen={setDayOpen}
          setSession={(snapshot) => {
            coordinator.setSession(snapshot)
            void api.session.read().then(coordinator.setSession)
          }}
          startTravel={() => {
            if (focusedSceneId)
              setScenarios((current) => ({
                ...current,
                [focusedSceneId]: 'travel'
              }))
          }}
          onError={featureError}
          theme={theme}
          toggleTheme={toggleTheme}
          loadGeneratorPresetApplication={loadGeneratorPresetApplication}
          campaignRules={createCampaignRewardRulesPort(api)}
        />
        <div className="shell-body">
          <WorkspaceRail
            active={active}
            workspace={coordinator.workspace}
            select={coordinator.setWorkspace}
          />
          <div
            className={`work-area layout-${active ? definition.layout : 'scroll'}`}
          >
            <WorkspaceErrors errors={errors} dismiss={dismiss} />
            <WorkspaceRouteHost
              active={active}
              workspace={coordinator.workspace}
              readbackKey={coordinator.readbackKey}
              surfaceProps={surfaceProps}
              runtime={api.runtime}
            />
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
