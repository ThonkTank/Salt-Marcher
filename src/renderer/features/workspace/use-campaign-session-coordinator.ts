import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { CampaignCommandReceipt } from '../../../shared/contracts/campaign.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { CampaignReconciliationPendingError } from '../../capabilities/campaign-workspace-projection.js'
import { hasMaintenanceDrafts } from '../../shell/maintenance-drafts.js'
import { message } from '../../i18n/campaign-menu-runtime.de.js'
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
  const [screen, setScreen] = useState<'campaigns' | 'workspace'>('campaigns')
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceId>('session')
  const [catalogStatus, setCatalogStatus] = useState<
    'loading' | 'ready' | 'failure'
  >('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [sessionRetry, setSessionRetry] = useState(false)

  const load = useCallback(async () => {
    setCatalogStatus('loading')
    setError('')
    const outcome = await projection.load(false)
    if (outcome.status === 'ready') setCatalogStatus('ready')
    else if (outcome.status === 'failure') {
      setCatalogStatus('failure')
      setError(capabilityErrorText(outcome.cause))
    }
  }, [projection])

  useEffect(() => {
    if (enabled) void Promise.resolve().then(load)
  }, [enabled, load])

  async function run(operation: () => Promise<void>): Promise<boolean> {
    if (running.current) return false
    running.current = true
    setBusy(true)
    setError('')
    try {
      await operation()
      return true
    } catch (cause) {
      if (!(cause instanceof CampaignReconciliationPendingError))
        setError(capabilityErrorText(cause))
      return false
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  async function enterSession(): Promise<void> {
    const outcome = await projection.refreshActiveSession()
    if (outcome.status !== 'ready') {
      setSessionRetry(true)
      setError(
        outcome.status === 'failure'
          ? capabilityErrorText(outcome.cause)
          : message('campaign.sessionRetry')
      )
      return
    }
    setSessionRetry(false)
    setWorkspace('session')
    setScreen('workspace')
    setCampaignMenuOpen(false)
  }

  async function reconcile(): Promise<CampaignCommandReceipt | null> {
    let accepted: CampaignCommandReceipt | null = null
    await run(async () => {
      accepted = await projection.reconcilePendingCommand()
      if (accepted.kind === 'created' || accepted.kind === 'activated')
        await enterSession()
    })
    return accepted
  }

  const activeCampaignId = root.campaigns.activeCampaignId
  return {
    campaigns: root.campaigns,
    sessionCampaignId: root.sessionCampaignId,
    session: root.session,
    screen,
    catalogStatus,
    error,
    busy,
    sessionRetry,
    retryCatalog: load,
    retrySession: () => run(enterSession),
    showCampaigns: () => {
      if (screen === 'workspace' && hasMaintenanceDrafts()) {
        reportError(message('campaign.unsavedWorkspace'))
        return
      }
      setScreen('campaigns')
      setCampaignMenuOpen(false)
    },
    setSession: (
      update:
        | LiveSessionSnapshot
        | ((current: LiveSessionSnapshot | null) => LiveSessionSnapshot | null)
    ) => {
      if (!activeCampaignId) return
      if (typeof update === 'function') {
        projection.publishSession(
          activeCampaignId,
          (current) => update(current) ?? current
        )
        return
      }
      projection.publishSession(activeCampaignId, update)
    },
    campaignMenuOpen,
    setCampaignMenuOpen,
    workspace,
    setWorkspace,
    campaignReconciliationPending: root.reconciliationCommandId !== null,
    reconcileCampaign: reconcile,
    createCampaign: (name: string) =>
      run(async () => {
        await projection.createCampaign(name.trim())
        await enterSession()
      }),
    switchCampaign: (id: string) =>
      run(async () => {
        await projection.activateCampaign(id)
        await enterSession()
      }),
    renameCampaign: (id: string, name: string) =>
      run(async () => {
        await projection.renameCampaign(id, name.trim())
      }),
    trashCampaign: (id: string) =>
      run(async () => {
        const next = await projection.trashCampaign(id)
        if (next.activeCampaignId === null) {
          setScreen('campaigns')
          setSessionRetry(false)
        }
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
