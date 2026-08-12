import { useMemo } from 'react'
import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { SaveSessionPlanInput } from '../../../shared/contracts/session-planner.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'

type RawPlanner = SaltMarcherApi['sessionPlanner']
export type SessionPlannerPort = Omit<
  RawPlanner,
  'create' | 'open' | 'switch' | 'rename' | 'delete'
> &
  Readonly<{
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
export type PlannerLootPort = Pick<SaltMarcherApi['loot'], 'acceptGenerated'>

export function useSessionPlannerPorts(): Readonly<{
  planner: SessionPlannerPort
  encounters: EncounterSearchPort
  loot: PlannerLootPort
}> {
  const api = useCapabilityApi()
  return useMemo(
    () => ({
      planner: {
        ...api.sessionPlanner,
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
      loot: { acceptGenerated: api.loot.acceptGenerated }
    }),
    [api.encounterPlans, api.loot, api.sessionPlanner]
  )
}
