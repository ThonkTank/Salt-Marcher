import type { HexTravelService } from '../core/hex/hex-travel.js'

export class PreparationWorkScheduler {
  private pendingWakeups = 0

  constructor(
    private readonly onWakeup: () => void,
    private readonly environment: NodeJS.ProcessEnv = process.env
  ) {}

  readonly schedule = (work: () => void): void => {
    const configured = Number(
      this.environment['SALT_MARCHER_E2E_PREPARATION_STAGE_DELAY_MS'] ?? 0
    )
    const delay =
      this.environment['SALT_MARCHER_E2E'] === 'true' &&
      Number.isInteger(configured) &&
      configured >= 0 &&
      configured <= 5_000
        ? configured
        : 0
    this.pendingWakeups += 1
    const execute = () => {
      this.pendingWakeups -= 1
      this.onWakeup()
      work()
    }
    if (delay > 0) {
      setTimeout(execute, delay)
      return
    }
    setImmediate(execute)
  }

  activeWakeups(): number {
    return this.pendingWakeups
  }
}

export type TravelReconciliationReason =
  'travel-boundary' | 'travel-command' | 'campaign-reconcile'

export class TravelBoundaryScheduler {
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly travel: HexTravelService,
    private readonly publishChange: (
      snapshot: ReturnType<HexTravelService['read']>,
      reason: TravelReconciliationReason
    ) => void,
    private readonly onWakeup: () => void
  ) {}

  reconcile(reason: TravelReconciliationReason): void {
    try {
      const tick = this.travel.tick()
      for (const snapshot of tick.changed) this.publishChange(snapshot, reason)
    } catch {
      // No active campaign is a normal idle state for the installation.
    }
    this.scheduleNextBoundary()
  }

  activeTimers(): number {
    return this.timer === undefined ? 0 : 1
  }

  close(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  private scheduleNextBoundary(): void {
    this.close()
    try {
      const delay = this.travel.nextBoundaryDelay()
      if (delay === null) return
      this.timer = setTimeout(() => {
        this.timer = undefined
        this.onWakeup()
        this.reconcile('travel-boundary')
      }, delay)
      this.timer.unref()
    } catch {
      // No active campaign is a normal idle state for the installation.
    }
  }
}
