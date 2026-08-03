import { useEffect, useState } from 'react'
import type { HexTravelSnapshot } from '../../../shared/contracts/hex.js'

export function useTravelClock(travel: HexTravelSnapshot | null): number {
  const active =
    travel?.status === 'travelling' &&
    travel.segmentStartedAt !== null &&
    travel.segmentEndsAt !== null
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [active, travel?.segmentEndsAt, travel?.segmentStartedAt])

  return active ? now : 0
}

export function travelSegmentProgress(
  startedAt: number,
  endsAt: number,
  now: number
): number {
  if (endsAt <= startedAt) return 1
  return Math.max(0, Math.min(1, (now - startedAt) / (endsAt - startedAt)))
}
