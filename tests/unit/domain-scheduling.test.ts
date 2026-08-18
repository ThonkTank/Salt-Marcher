import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HexTravelService } from '../../src/core/hex/hex-travel.js'
import {
  PreparationWorkScheduler,
  TravelBoundaryScheduler
} from '../../src/utility/domain-scheduling.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('utility domain scheduling', () => {
  it('accounts for delayed preparation work until execution', () => {
    vi.useFakeTimers()
    const wakeup = vi.fn()
    const work = vi.fn()
    const scheduler = new PreparationWorkScheduler(wakeup, {
      SALT_MARCHER_E2E: 'true',
      SALT_MARCHER_E2E_PREPARATION_STAGE_DELAY_MS: '25'
    })
    scheduler.schedule(work)
    expect(scheduler.activeWakeups()).toBe(1)
    vi.advanceTimersByTime(25)
    expect(scheduler.activeWakeups()).toBe(0)
    expect(wakeup).toHaveBeenCalledOnce()
    expect(work).toHaveBeenCalledOnce()
  })

  it('owns travel boundary rescheduling and cancellation', () => {
    vi.useFakeTimers()
    const snapshot = { sceneId: 'scene' }
    const delays = [10, null]
    const travel = {
      tick: vi
        .fn()
        .mockReturnValueOnce({ changed: [snapshot] })
        .mockReturnValueOnce({ changed: [] }),
      nextBoundaryDelay: vi.fn(() => delays.shift() ?? null)
    } as unknown as HexTravelService
    const publish = vi.fn()
    const wakeup = vi.fn()
    const scheduler = new TravelBoundaryScheduler(travel, publish, wakeup)

    scheduler.reconcile('campaign-reconcile')
    expect(publish).toHaveBeenCalledWith(snapshot, 'campaign-reconcile')
    expect(scheduler.activeTimers()).toBe(1)
    vi.advanceTimersByTime(10)
    expect(wakeup).toHaveBeenCalledOnce()
    expect(scheduler.activeTimers()).toBe(0)
    scheduler.close()
  })
})
