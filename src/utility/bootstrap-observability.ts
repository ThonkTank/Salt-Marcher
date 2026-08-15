import { performance } from 'node:perf_hooks'

const bootstrapStartedAt = performance.now()
const phaseDurations = new Map<string, number>()
let totalDurationMs = 0

export function bootstrapPhase<T>(phase: string, operation: () => T): T {
  const startedAt = performance.now()
  try {
    const result = operation()
    const durationMs = performance.now() - startedAt
    phaseDurations.set(phase, durationMs)
    log('phase-completed', phase, durationMs)
    return result
  } catch (error) {
    log('phase-failed', phase, performance.now() - startedAt)
    throw error
  }
}

export function bootstrapReady(): void {
  totalDurationMs = performance.now() - bootstrapStartedAt
  log('ready', 'total', totalDurationMs)
}

export function bootstrapMetrics(): Readonly<{
  totalMs: number
  phases: Readonly<Record<string, number>>
}> {
  return Object.freeze({
    totalMs: rounded(totalDurationMs),
    phases: Object.freeze(
      Object.fromEntries(
        [...phaseDurations].map(([phase, duration]) => [
          phase,
          rounded(duration)
        ])
      )
    )
  })
}

function log(event: string, phase: string, durationMs: number): void {
  console.info(
    JSON.stringify({
      component: 'utility-bootstrap',
      event,
      phase,
      durationMs: rounded(durationMs)
    })
  )
}

function rounded(durationMs: number): number {
  return Math.round(durationMs * 100) / 100
}
