import { useCallback, useEffect, useState } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type {
  CampaignCapability,
  SaltMarcherApi
} from '../../../shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { WorkspaceId } from './workspace-definition.js'

const emptyCampaigns: CampaignSnapshot = {
  activeCampaignId: null,
  campaigns: [],
  trashedCampaigns: []
}

export function useCampaignSessionCoordinator(
  api: SaltMarcherApi,
  reportError: (message: string) => void,
  enabled = true
) {
  const [campaigns, setCampaigns] = useState(emptyCampaigns)
  const [session, setSession] = useState<LiveSessionSnapshot | null>(null)
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceId>('session')
  const [readbackKey, setReadbackKey] = useState(0)

  const load = useCallback(async () => {
    const next = await api.campaigns.list()
    setCampaigns(next)
    if (next.activeCampaignId === null) setCampaignMenuOpen(true)
    setSession(next.activeCampaignId ? await api.session.read() : null)
  }, [api])

  useEffect(() => {
    if (!enabled) return
    void Promise.resolve()
      .then(load)
      .catch((cause: unknown) => reportError(capabilityErrorText(cause)))
  }, [enabled, load, reportError])

  useEffect(() => {
    const readback = () => {
      if (!enabled) return
      setReadbackKey((current) => current + 1)
      void load().catch((cause: unknown) =>
        reportError(capabilityErrorText(cause))
      )
    }
    window.addEventListener('saltmarcher:readback', readback)
    return () => window.removeEventListener('saltmarcher:readback', readback)
  }, [enabled, load, reportError])

  const campaignsWrite = api.campaigns as CampaignCapability
  async function run(operation: () => Promise<void>) {
    try {
      await operation()
    } catch (cause) {
      reportError(capabilityErrorText(cause))
    }
  }

  return {
    campaigns,
    session,
    setSession,
    campaignMenuOpen,
    setCampaignMenuOpen,
    workspace,
    setWorkspace,
    readbackKey,
    createCampaign: (name: string) =>
      run(async () => {
        setCampaigns(await campaignsWrite.create(name))
        setSession(await api.session.read())
        setWorkspace('session')
        setCampaignMenuOpen(false)
      }),
    switchCampaign: (id: string) =>
      run(async () => {
        setCampaigns(await campaignsWrite.activate(id))
        setSession(await api.session.read())
        setWorkspace('session')
        setCampaignMenuOpen(false)
      }),
    renameCampaign: (id: string, name: string) =>
      run(async () => setCampaigns(await campaignsWrite.rename(id, name))),
    trashCampaign: (id: string) =>
      run(async () => {
        const next = await campaignsWrite.trash(id)
        setCampaigns(next)
        if (next.activeCampaignId === null) {
          setSession(null)
          setCampaignMenuOpen(true)
        }
      }),
    restoreCampaign: (id: string) =>
      run(async () => setCampaigns(await campaignsWrite.restore(id))),
    deleteCampaignForever: (id: string, confirmationName: string) =>
      run(async () =>
        setCampaigns(await campaignsWrite.deleteForever(id, confirmationName))
      )
  }
}
