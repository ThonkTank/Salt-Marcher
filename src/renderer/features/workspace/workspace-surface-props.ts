import type { CatalogNavigation } from '../catalog/catalog-section-selector.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { Dispatch, SetStateAction } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'

export type WorkspaceSurfaceProps = Readonly<{
  catalogNavigation?: CatalogNavigation
  navigateCatalog?: (navigation: CatalogNavigation) => void
  openCharacter?: (id: string) => void
  campaignId: string
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  returnToSession: () => void
}>
