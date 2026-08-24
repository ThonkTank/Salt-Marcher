import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import {
  createWorldLocationApplicationPort,
  type WorldLocationApplicationPort
} from '../worldplanner/world-location-application.js'

export type LocationCatalogPort = WorldLocationApplicationPort & {
  readSession: () => Promise<LiveSessionSnapshot>
}

export function createLocationCatalogPort(
  api: Pick<
    SaltMarcherApi,
    'locations' | 'encounterTables' | 'factions' | 'session'
  >,
  campaignId: string
): LocationCatalogPort {
  const locations = createWorldLocationApplicationPort(api)
  return {
    ...locations,
    readSession: () => api.session.read({ campaignId })
  }
}
