import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore
} from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import type { CampaignWorkspaceReadOutcome } from '../../capabilities/campaign-workspace-projection.js'
import type { WorkspaceId } from './workspace-definition.js'

export function useCampaignSessionCoordinator(
  reportError: (message: string) => void,
  enabled = true
) {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  const projection = context.campaignWorkspace
  const root = useSyncExternalStore(
    projection.subscribe,
    projection.snapshot,
    projection.snapshot
  )
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceId>('session')
  const [readbackKey, setReadbackKey] = useState(0)

  const reportRead = useCallback(
    (outcome: CampaignWorkspaceReadOutcome) => {
      if (outcome.status === 'failure')
        reportError(capabilityErrorText(outcome.cause))
    },
    [reportError]
  )

  const load = useCallback(async () => {
    const outcome = await projection.load()
    reportRead(outcome)
    if (
      outcome.status === 'ready' &&
      outcome.value.campaigns.activeCampaignId === null
    )
      setCampaignMenuOpen(true)
  }, [projection, reportRead])

  useEffect(() => {
    if (enabled) void Promise.resolve().then(load)
  }, [enabled, load])

  useEffect(() => {
    const readback = () => {
      if (!enabled) return
      setReadbackKey((current) => current + 1)
      void load()
    }
    window.addEventListener('saltmarcher:readback', readback)
    return () => window.removeEventListener('saltmarcher:readback', readback)
  }, [enabled, load])

  async function run(operation: () => Promise<void>) {
    try {
      await operation()
    } catch (cause) {
      reportError(capabilityErrorText(cause))
    }
  }

  async function refreshAcceptedCampaignSession(): Promise<void> {
    reportRead(await projection.refreshActiveSession())
  }

  const activeCampaignId = root.campaigns.activeCampaignId

  return {
    campaigns: root.campaigns,
    session: root.session,
    setSession: (
      update:
        | LiveSessionSnapshot
        | ((current: LiveSessionSnapshot | null) => LiveSessionSnapshot | null)
    ) => {
      if (!activeCampaignId) return
      if (typeof update === 'function') {
        projection.publishSession(activeCampaignId, (current) => {
          const next = update(current)
          return next ?? current
        })
        return
      }
      projection.publishSession(activeCampaignId, update)
    },
    campaignMenuOpen,
    setCampaignMenuOpen,
    workspace,
    setWorkspace,
    readbackKey,
    createCampaign: (name: string) =>
      run(async () => {
        await projection.createCampaign(name)
        await refreshAcceptedCampaignSession()
        setWorkspace('session')
        setCampaignMenuOpen(false)
      }),
    switchCampaign: (id: string) =>
      run(async () => {
        await projection.activateCampaign(id)
        await refreshAcceptedCampaignSession()
        setWorkspace('session')
        setCampaignMenuOpen(false)
      }),
    renameCampaign: (id: string, name: string) =>
      run(async () => {
        await projection.renameCampaign(id, name)
      }),
    trashCampaign: (id: string) =>
      run(async () => {
        const next = await projection.trashCampaign(id)
        if (next.activeCampaignId === null) setCampaignMenuOpen(true)
      }),
    restoreCampaign: (id: string) =>
      run(async () => {
        await projection.restoreCampaign(id)
      }),
    deleteCampaignForever: (id: string, confirmationName: string) =>
      run(async () => {
        await projection.deleteCampaignForever(id, confirmationName)
      })
  }
}
