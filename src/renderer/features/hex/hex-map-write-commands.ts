import type {
  AxialCoordinate,
  HexMapSummary
} from '../../../shared/contracts/hex.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { brushLevelToRadius } from './hex-brush.js'
import {
  queueHexCommand,
  requireHexCommandValue
} from './hex-command-outcome.js'
import type { HexCommandProjectionContext } from './hex-command-projection.js'
import type { HexCommandTransport } from './hex-command-transport.js'

type Dependencies = Readonly<{
  campaignId: string
  coordinator: AsyncCommandCoordinator
  transport: HexCommandTransport
  read: () => HexCommandProjectionContext
  project: HexCommandProjector
}>

type HexCommandProjector = (
  result: Awaited<ReturnType<HexCommandTransport['applyBrushStroke']>>,
  reportRejected?: boolean
) => Promise<unknown>

export function createHexMapWriteCommands(dependencies: Dependencies) {
  const { campaignId, coordinator, transport, read, project } = dependencies
  const acceptedOffscreenMaps = new Map<string, HexMapSummary>()
  const acceptResult = async (
    result: Awaited<ReturnType<HexCommandTransport['applyBrushStroke']>>
  ) => {
    await project(result)
    if (result.status === 'applied')
      for (const map of result.maps) acceptedOffscreenMaps.set(map.id, map)
  }

  const create = async (displayName: string): Promise<HexMapSummary> => {
    const outcome = await queueHexCommand(
      coordinator,
      `campaign:${campaignId}`,
      () => transport.createMap(displayName),
      async (receipt) => {
        await acceptResult(receipt.commandResult)
        await read().maps.refreshCatalog(receipt.saved.id)
      }
    )
    return requireHexCommandValue(outcome).saved
  }

  const saveMetadata = async (): Promise<void> => {
    const context = read()
    const current = context.maps.mapRef.current
    if (!current) return
    const mapId = current.map.id
    const displayName = context.editor.name
    const commandId = crypto.randomUUID()
    const outcome = await queueHexCommand(
      coordinator,
      `map:${mapId}`,
      () => {
        const map = mapSummary(read(), acceptedOffscreenMaps, mapId)
        return transport.updateMetadata({
          commandId,
          mapId,
          displayName,
          expectedMetadataRevision: map.metadataRevision
        })
      },
      acceptResult
    )
    reportFailure(outcome, read)
  }

  const changeHistory = async (
    direction: 'undo' | 'redo',
    confirmationToken: string | null = null,
    commandId: string = crypto.randomUUID()
  ): Promise<void> => {
    const current = read().maps.mapRef.current
    if (!current) return
    const mapId = current.map.id
    const outcome = await queueHexCommand(
      coordinator,
      `map:${mapId}`,
      () => {
        const map = mapSummary(read(), acceptedOffscreenMaps, mapId)
        return transport.changeHistory(direction, {
          commandId,
          mapId,
          expectedContentRevision: map.contentRevision,
          confirmationToken
        })
      },
      async (result) => {
        const latest = read()
        if (result.status === 'confirmation_required') {
          if (latest.maps.mapRef.current?.map.id === mapId)
            latest.editor.setPendingHistory({
              direction,
              commandId,
              confirmationToken: result.confirmationToken,
              impact: result.impact
            })
          return
        }
        if (latest.maps.mapRef.current?.map.id === mapId)
          latest.editor.setPendingHistory(null)
        await acceptResult(result)
      }
    )
    reportFailure(outcome, read)
  }

  const applyCoordinates = async (
    path: readonly AxialCoordinate[],
    confirmationToken: string | null = null,
    requestedRadius?: number,
    commandId: string = crypto.randomUUID()
  ): Promise<void> => {
    const context = read()
    const current = context.maps.mapRef.current
    if (!current) return
    const mapId = current.map.id
    const mode = confirmationToken ? 'erase' : context.editor.biomeMode
    if (context.editor.tool !== 'biome' && !confirmationToken) return
    const radius =
      requestedRadius ?? brushLevelToRadius(context.editor.brushLevel)
    const biomeId = mode === 'paint' ? context.editor.biomeId : null
    const outcome = await queueHexCommand(
      coordinator,
      `map:${mapId}`,
      () => {
        const map = mapSummary(read(), acceptedOffscreenMaps, mapId)
        return transport.applyBrushStroke({
          commandId,
          mapId,
          mode,
          biomeId,
          path: [...path],
          radius,
          expectedContentRevision: map.contentRevision,
          confirmationToken
        })
      },
      async (result) => {
        const latest = read()
        if (result.status === 'confirmation_required') {
          if (latest.maps.mapRef.current?.map.id === mapId)
            latest.editor.setPendingErase({
              path,
              radius,
              commandId,
              confirmationToken: result.confirmationToken,
              impact: result.impact
            })
          return
        }
        await acceptResult(result)
        const overlays = await latest.maps.readOverlays(mapId)
        if (latest.maps.mapRef.current?.map.id === mapId)
          latest.editor.setOverlays(overlays)
      }
    )
    reportFailure(outcome, read)
  }

  return Object.freeze({
    create,
    saveMetadata,
    changeHistory,
    applyCoordinates,
    applyStroke: (path: readonly AxialCoordinate[]) => applyCoordinates(path)
  })
}

function reportFailure(
  outcome: Awaited<ReturnType<typeof queueHexCommand>>,
  read: () => HexCommandProjectionContext
): void {
  if (outcome.status === 'failure')
    read().onError(capabilityErrorText(outcome.cause))
}

function mapSummary(
  context: HexCommandProjectionContext,
  acceptedOffscreenMaps: ReadonlyMap<string, HexMapSummary>,
  mapId: string
): HexMapSummary {
  const current = context.maps.mapRef.current?.map
  const summary =
    current?.id === mapId
      ? current
      : (acceptedOffscreenMaps.get(mapId) ??
        context.editor.catalog?.maps.find((entry) => entry.id === mapId))
  if (!summary) throw new Error(`Unknown hex map ${mapId}.`)
  return summary
}
