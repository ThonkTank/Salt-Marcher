import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type {
  HexBrushStrokeResult,
  HexMapCatalogSnapshot,
  HexMapSummary
} from '../../../shared/contracts/hex.js'
import { executeRecoverableHexCommand } from './hex-command-executor.js'
import type { HexCapabilities } from './hex-capabilities.js'

export type HexMapCreationResult = Readonly<{
  snapshot: HexMapCatalogSnapshot
  saved: HexMapSummary
  commandResult: Extract<HexBrushStrokeResult, { status: 'applied' }>
}>

export type HexMapApplicationPort = Readonly<{
  createMap: (displayName: string) => Promise<HexMapCreationResult>
}>

export function createHexMapApplicationPort(
  api: Pick<SaltMarcherApi, 'hex'> | Pick<HexCapabilities, 'hex'>
): HexMapApplicationPort {
  return {
    createMap: async (displayName) => {
      const before = await api.hex.catalog()
      const commandId = crypto.randomUUID()
      const result = await executeRecoverableHexCommand(
        commandId,
        () =>
          api.hex.create({
            commandId,
            displayName,
            expectedCatalogRevision: before.revision
          }),
        (receiptId) =>
          'updateMetadata' in api.hex
            ? api.hex.commandReceipt(receiptId)
            : api.hex.commandReceipt({ commandId: receiptId })
      )
      if (result.status !== 'applied')
        throw new Error('hex_map_create_rejected')
      const saved = result.maps.length === 1 ? result.maps[0] : undefined
      if (!saved || before.maps.some((entry) => entry.id === saved.id))
        throw new Error('hex_map_create_result_not_exactly_one')
      const maps = before.maps.map((entry) =>
        entry.id === saved.id ? saved : entry
      )
      if (!maps.some((entry) => entry.id === saved.id)) maps.push(saved)
      return {
        snapshot: { revision: result.catalogRevision, maps },
        saved,
        commandResult: result
      }
    }
  }
}
