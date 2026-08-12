import type { ReactNode } from 'react'

/** Session-owned layout seam; travel providers remain workspace integrations. */
export type SessionTravelSlots = Readonly<{
  renderMap: () => ReactNode
  renderScenario: (props: {
    openMap: () => void
    mapActive: boolean
  }) => ReactNode
}>
