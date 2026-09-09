import type { DesktopMapView } from '../../../shared/contracts/scene-desktop.js'
import type { ReactNode } from 'react'

/** Session-owned layout seam; travel providers remain workspace integrations. */
export type SessionTravelSlots = Readonly<{
  notice?: ReactNode
  renderMap: (presentation?: {
    view: DesktopMapView
    changed: (view: DesktopMapView) => void
    renderActive: boolean
  }) => ReactNode
  renderScenario: (props: {
    openMap: () => void
    mapActive: boolean
  }) => ReactNode
}>
