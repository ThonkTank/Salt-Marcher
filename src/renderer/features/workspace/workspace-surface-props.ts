import type { CatalogNavigation } from '../catalog/catalog-section-selector.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { Dispatch, SetStateAction } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import type { SessionScenario } from '../session/session-scenario.js'

export type WorkspaceSurfaceProps = Readonly<{
  catalogNavigation?: CatalogNavigation
  navigateCatalog?: (navigation: CatalogNavigation) => void
  openCharacter?: (id: string) => void
  desktopPreview?: boolean
  campaignId: string
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  scenario: SessionScenario
  setScenario: (scenario: SessionScenario) => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  returnToSession: () => void
}>
