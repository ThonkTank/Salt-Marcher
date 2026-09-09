import { describe, expect, it, vi } from 'vitest'
import { settlePlannerPreparations } from '../../src/renderer/features/session-planner/settle-planner-preparations.js'
import type {
  PlannerPreparationMaintenanceStatus,
  SessionPreparationReceipt
} from '../../src/shared/contracts/session-planner.js'
import type { SessionPlannerPort } from '../../src/renderer/features/session-planner/use-session-planner-ports.js'
const workspace: PlannerPreparationMaintenanceStatus['workspace'] = {
  currentSessionId: 'session',
  sessions: [],
  session: {
    id: 'session',
    revision: 2,
    name: 'Fresh',
    participantIds: [],
    adventureDayFraction: '1',
    encounterCount: 1,
    selectedSceneId: null,
    scenes: []
  },
  availableParticipants: [],
  availableLocations: [],
  preparation: null,
  budget: {
    xpBudget: 0,
    plannedXp: 0,
    remainingXp: 0,
    recommendedShortRests: 0,
    recommendedLongRests: 0
  }
}
function status(
  ...rows: [string, SessionPreparationReceipt['status'] | null][]
): PlannerPreparationMaintenanceStatus {
  return {
    workspace,
    operations: rows.map(([operationId, state]) => ({
      operationId,
      receipt: state
        ? {
            operationId,
            sessionId: 'session',
            status: state,
            seed: 17,
            runId: null,
            encounterBatchFingerprint: null,
            cancelRequested: false,
            committedPlannerRevision: null,
            failure: null,
            updatedAt: '2026-09-08T00:00:00.000Z'
          }
        : null
    }))
  }
}
function ports() {
  return {
    preparationMaintenanceStatus:
      vi.fn<SessionPlannerPort['preparationMaintenanceStatus']>(),
    cancelPreparationForMaintenance:
      vi.fn<SessionPlannerPort['cancelPreparationForMaintenance']>()
  }
}
describe('Planner preparation maintenance settlement', () => {
  it('waits on save, discovers other sessions, and returns the final workspace without canceling', async () => {
    const planner = ports()
    planner.preparationMaintenanceStatus
      .mockResolvedValueOnce(status(['a', 'queued'], ['b', 'saving']))
      .mockResolvedValue(status(['a', 'succeeded'], ['b', 'succeeded']))
    const observed = vi.fn()
    const pause = vi.fn().mockResolvedValue(undefined)
    expect(
      await settlePlannerPreparations({
        planner,
        choice: 'save',
        operationIds: ['a'],
        observed,
        pause
      })
    ).toBe(workspace)
    expect(planner.preparationMaintenanceStatus.mock.calls).toEqual([
      [['a']],
      [['a', 'b']]
    ])
    expect(planner.cancelPreparationForMaintenance).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalledOnce()
    expect(observed).toHaveBeenCalledTimes(2)
  })
  it('waits beyond a cancel acknowledgement in saving and never undoes a completed result', async () => {
    const planner = ports()
    planner.preparationMaintenanceStatus
      .mockResolvedValueOnce(status(['a', 'queued'], ['b', 'saving']))
      .mockResolvedValueOnce(status(['a', 'canceled'], ['b', 'saving']))
      .mockResolvedValue(status(['a', 'canceled'], ['b', 'succeeded']))
    planner.cancelPreparationForMaintenance.mockResolvedValue({
      receipt: status(['b', 'saving']).operations[0]!.receipt!
    })
    const pause = vi.fn().mockResolvedValue(undefined)
    expect(
      await settlePlannerPreparations({
        planner,
        choice: 'discard',
        operationIds: [],
        observed: vi.fn(),
        pause
      })
    ).toBe(workspace)
    expect(planner.cancelPreparationForMaintenance.mock.calls).toEqual([
      ['a'],
      ['b']
    ])
    expect(pause).toHaveBeenCalledTimes(2)
  })
  it('requires an explicit absent receipt rather than treating an omitted row as settled', async () => {
    const planner = ports()
    planner.preparationMaintenanceStatus
      .mockResolvedValueOnce(status())
      .mockResolvedValue(status(['missing', null]))
    const options = {
      planner,
      choice: 'save' as const,
      operationIds: ['missing'],
      observed: vi.fn()
    }
    await expect(settlePlannerPreparations(options)).rejects.toThrow(
      'unvollständig'
    )
    expect(options.observed).not.toHaveBeenCalled()
    expect(await settlePlannerPreparations(options)).toBe(workspace)
  })
  it('bounds waiting and permits a later attempt to read a completed job', async () => {
    const planner = ports()
    planner.preparationMaintenanceStatus.mockResolvedValue(
      status(['a', 'saving'])
    )
    let time = 0
    const options = {
      planner,
      choice: 'save' as const,
      operationIds: ['a'],
      observed: vi.fn(),
      now: () => time,
      pause: () => {
        time += 30_000
        return Promise.resolve()
      }
    }
    await expect(settlePlannerPreparations(options)).rejects.toThrow(
      'noch nicht abgeschlossen'
    )
    planner.preparationMaintenanceStatus.mockResolvedValue(
      status(['a', 'succeeded'])
    )
    expect(await settlePlannerPreparations(options)).toBe(workspace)
  })
  it.each(['read', 'cancel'] as const)(
    'retains failure on %s and re-reads before a later retry',
    async (failure) => {
      const planner = ports()
      planner.preparationMaintenanceStatus.mockResolvedValue(
        status(['a', 'queued'])
      )
      if (failure === 'read')
        planner.preparationMaintenanceStatus.mockRejectedValueOnce(
          new Error('failed')
        )
      else
        planner.cancelPreparationForMaintenance.mockRejectedValueOnce(
          new Error('failed')
        )
      const options = {
        planner,
        choice: 'discard' as const,
        operationIds: ['a'],
        observed: vi.fn()
      }
      await expect(settlePlannerPreparations(options)).rejects.toThrow('failed')
      planner.preparationMaintenanceStatus.mockResolvedValue(
        status(['a', 'canceled'])
      )
      expect(await settlePlannerPreparations(options)).toBe(workspace)
      expect(planner.cancelPreparationForMaintenance).toHaveBeenCalledTimes(
        failure === 'cancel' ? 1 : 0
      )
    }
  )
})
