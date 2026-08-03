import { useEffect, useState } from 'react'
import type { AdventuringDayCalculation } from '../../../shared/contracts/party.js'
import { partyCapabilities } from './party-capabilities.js'

export function useAdventuringDayCalculation(
  open: boolean,
  rows: readonly { level: number; count: number }[],
  mode: 'budget' | 'progress',
  totalXp: number
): AdventuringDayCalculation | null {
  const [calculation, setCalculation] =
    useState<AdventuringDayCalculation | null>(null)

  useEffect(() => {
    if (!open) return
    let current = true
    void partyCapabilities()
      .party.calculateAdventuringDay(rows, mode === 'progress' ? totalXp : 0)
      .then((next) => {
        if (current) setCalculation(next)
      })
    return () => {
      current = false
    }
  }, [open, rows, totalXp, mode])

  return calculation
}
