import type { AcceptGeneratedTreasureInput } from '../../../shared/contracts/loot.js'
import { useContext, useMemo, useSyncExternalStore } from 'react'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  SessionPlannerCommand,
  SaveSessionPlanInput
} from '../../../shared/contracts/session-planner.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'

type RawPlanner = SaltMarcherApi['sessionPlanner']
export type SessionPlannerPort = Omit<
  RawPlanner,
  | 'executeCommand'
  | 'commandStatus'
  | 'create'
  | 'open'
  | 'switch'
  | 'rename'
  | 'delete'
  | 'preparationMaintenanceStatus'
  | 'cancelPreparationForMaintenance'
> &
  Readonly<{
    executeCommand(
      input: SessionPlannerCommand
    ): ReturnType<RawPlanner['executeCommand']>
    commandStatus(
      input: SessionPlannerCommand
    ): ReturnType<RawPlanner['commandStatus']>
    preparationMaintenanceStatus(
      operationIds: readonly string[]
    ): ReturnType<RawPlanner['preparationMaintenanceStatus']>
    cancelPreparationForMaintenance(
      operationId: string
    ): ReturnType<RawPlanner['cancelPreparationForMaintenance']>
    create(name: string): ReturnType<RawPlanner['create']>
    open(sessionId: string): ReturnType<RawPlanner['open']>
    switch(
      targetSessionId: string,
      source: SaveSessionPlanInput
    ): ReturnType<RawPlanner['switch']>
    rename(
      sessionId: string,
      expectedRevision: number,
      name: string
    ): ReturnType<RawPlanner['rename']>
    delete(
      sessionId: string,
      expectedRevision: number
    ): ReturnType<RawPlanner['delete']>
  }>
export type EncounterSearchPort = Readonly<{
  search(query: string): ReturnType<SaltMarcherApi['encounterPlans']['search']>
  summaries(
    planIds: readonly string[]
  ): ReturnType<SaltMarcherApi['encounterPlans']['summaries']>
}>
export type PlannerLootPort = Readonly<{
  acceptGenerated(
    input: AcceptGeneratedTreasureInput
  ): ReturnType<SaltMarcherApi['loot']['acceptGeneratedForCampaign']>
  generatedAcceptanceStatus(
    input: AcceptGeneratedTreasureInput
  ): ReturnType<SaltMarcherApi['loot']['generatedAcceptanceStatus']>
}>

export function useSessionPlannerPorts(): Readonly<{
  planner: SessionPlannerPort
  encounters: EncounterSearchPort
  loot: PlannerLootPort
}> {
  const api = useCapabilityApi()
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability provider missing')
  const projection = context.campaignWorkspace
  const root = useSyncExternalStore(projection.subscribe, projection.snapshot)
  const campaignId = root.sessionCampaignId
  return useMemo(() => {
    const requireCampaign = () => {
      const current = projection.snapshot()
      if (
        !campaignId ||
        current.sessionCampaignId !== campaignId ||
        current.campaigns.activeCampaignId !== campaignId
      )
        throw new CapabilityError('stale', false)
      return campaignId
    }
    return {
      planner: {
        ...api.sessionPlanner,
        read: async () => {
          const result = await api.sessionPlanner.readForCampaign({
            campaignId: requireCampaign()
          })
          requireCampaign()
          return result
        },
        executeCommand: async (input: SessionPlannerCommand) => {
          const result = await api.sessionPlanner.executeCommand({
            ...input,
            campaignId: requireCampaign()
          })
          try {
            requireCampaign()
          } catch {
            throw new CapabilityError('outcome_unknown', true)
          }
          return result
        },
        commandStatus: async (input: SessionPlannerCommand) => {
          const result = await api.sessionPlanner.commandStatus({
            ...input,
            campaignId: requireCampaign()
          })
          requireCampaign()
          return result
        },
        preparationMaintenanceStatus: async (
          operationIds: readonly string[]
        ) => {
          const status = await api.sessionPlanner.preparationMaintenanceStatus({
            campaignId: requireCampaign(),
            operationIds: [...operationIds]
          })
          requireCampaign()
          return status
        },
        cancelPreparationForMaintenance: async (operationId: string) => {
          const result =
            await api.sessionPlanner.cancelPreparationForMaintenance({
              campaignId: requireCampaign(),
              operationId
            })
          requireCampaign()
          return result
        },
        create: (name) => api.sessionPlanner.create({ name }),
        open: (sessionId) => api.sessionPlanner.open({ sessionId }),
        switch: (targetSessionId, source) =>
          api.sessionPlanner.switch({ targetSessionId, source }),
        rename: (sessionId, expectedRevision, name) =>
          api.sessionPlanner.rename({ sessionId, expectedRevision, name }),
        delete: (sessionId, expectedRevision) =>
          api.sessionPlanner.delete({ sessionId, expectedRevision })
      },
      encounters: {
        search: (query) => api.encounterPlans.search({ query }),
        summaries: (planIds) =>
          api.encounterPlans.summaries({ planIds: [...planIds] })
      },
      loot: {
        acceptGenerated: async (input: AcceptGeneratedTreasureInput) => {
          const result = await api.loot.acceptGeneratedForCampaign({
            ...input,
            campaignId: requireCampaign()
          })
          try {
            requireCampaign()
          } catch {
            throw new CapabilityError('outcome_unknown', true)
          }
          return result
        },
        generatedAcceptanceStatus: async (
          input: AcceptGeneratedTreasureInput
        ) => {
          const result = await api.loot.generatedAcceptanceStatus({
            ...input,
            campaignId: requireCampaign()
          })
          requireCampaign()
          return result
        }
      }
    }
  }, [api.encounterPlans, api.loot, api.sessionPlanner, campaignId, projection])
}
