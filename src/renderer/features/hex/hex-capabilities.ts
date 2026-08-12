import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'

/**
 * Ergonomic positional calls are deliberately confined to this renderer
 * adapter. The preload API itself remains the object-input registry contract.
 */
export function hexCapabilities(api: SaltMarcherApi) {
  return {
    hex: {
      ...api.hex,
      updateMetadata: api.hex.update,
      readChunks: (
        mapId: string,
        keys: Parameters<typeof api.hex.readChunks>[0]['keys']
      ) => api.hex.readChunks({ mapId, keys: [...keys] }),
      locateLocation: (locationId: string) =>
        api.hex.locateLocation({ locationId }),
      history: (mapId: string) => api.hex.history({ mapId }),
      commandReceipt: (commandId: string) =>
        api.hex.commandReceipt({ commandId }),
      runtimeOverlays: (mapId: string) => api.hex.runtimeOverlays({ mapId })
    },
    hexTravel: api.hexTravel,
    session: api.session,
    locations: api.locations,
    locationSymbols: {
      ...api.locationSymbols,
      search: (query = '', offset = 0, limit = 24) =>
        api.locationSymbols.search({ query, offset, limit }),
      detail: (id: string) => api.locationSymbols.detail({ id }),
      update: (id: string, displayName: string, expectedRevision: number) =>
        api.locationSymbols.update({ id, displayName, expectedRevision }),
      deleteImpact: (id: string) => api.locationSymbols.deleteImpact({ id }),
      delete: (commandId: string, id: string, expectedRevision: number) =>
        api.locationSymbols.delete({ commandId, id, expectedRevision })
    },
    biomes: api.biomes,
    runtime: { pickLocationSymbolFile: api.runtime.pickLocationSymbolFile }
  }
}

export type HexCapabilities = ReturnType<typeof hexCapabilities>
