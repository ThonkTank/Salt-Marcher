import { createHash } from 'node:crypto'
import {
  applyHexBrushStrokeInputSchema,
  createHexMapInputSchema,
  editHexLocationInputSchema,
  hexBrushStrokeResultSchema,
  mutateHexHistoryInputSchema,
  unplaceHexLocationInputSchema,
  updateHexMapInputSchema,
  type AxialCoordinate,
  type HexEraseImpact
} from '../../shared/contracts/hex.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { PartyStore } from '../party/party-store.js'
import type { CampaignUnitOfWork } from './campaign-unit-of-work.js'
import {
  type HexMapStore,
  type HexMapTruthCell,
  tileId
} from '../hex/hex-map-store.js'
import type { HexTravelStore } from '../hex/hex-travel.js'
import type { HexEditJournalStore } from '../hex/hex-edit-journal-store.js'
import {
  expandHexStroke,
  hexChunkKeyFor,
  MAX_HEX_STROKE_CHUNKS
} from '../../shared/hex/axial-geometry.js'

type HexEditingMapPort = Pick<
  HexMapStore,
  | 'summary'
  | 'catalog'
  | 'create'
  | 'updateMetadata'
  | 'changedBrushTargets'
  | 'captureTruth'
  | 'applyBrushTargets'
  | 'locationImpacts'
  | 'locateLocation'
  | 'tileExists'
  | 'locationAt'
  | 'placeLocation'
  | 'removeLocation'
  | 'readChunk'
  | 'restoreTruth'
>
type HexEditingPartyPort = Pick<
  PartyStore,
  'hexTravelImpacts' | 'clearHexTravelPositions'
>
type HexEditingTravelPort = Pick<
  HexTravelStore,
  'journeyImpacts' | 'abortJourneys'
>

export type HexEditingCommandContext = Readonly<{
  unitOfWork: Pick<CampaignUnitOfWork, 'run'>
  maps: HexEditingMapPort
  party: HexEditingPartyPort
  travel: HexEditingTravelPort
  journal: Pick<
    HexEditJournalStore,
    'history' | 'step' | 'advance' | 'record' | 'receipt' | 'storeReceipt'
  >
}>

export class HexMapEditingCommandHandler {
  constructor(private readonly createContext: () => HexEditingCommandContext) {}

  createMap(raw: unknown) {
    const input = createHexMapInputSchema.parse(raw)
    const { unitOfWork, maps, journal } = this.createContext()
    const receipt = journal.receipt(input.commandId)
    if (receipt) return receipt
    return unitOfWork.run(() => {
      const map = maps.create(input)
      const result = hexBrushStrokeResultSchema.parse({
        status: 'applied',
        commandId: input.commandId,
        catalogRevision: maps.catalog().revision,
        maps: [map],
        changedChunks: [],
        history: journal.history(map.id),
        changed: true,
        affectedTileCount: 0,
        impact: emptyImpact(),
        warnings: []
      })
      journal.storeReceipt(input.commandId, map.id, result)
      return result
    })
  }

  updateMap(raw: unknown) {
    const input = updateHexMapInputSchema.parse(raw)
    const { unitOfWork, maps, journal } = this.createContext()
    const receipt = journal.receipt(input.commandId)
    if (receipt) return receipt
    return unitOfWork.run(() => {
      const map = maps.updateMetadata(input)
      const result = hexBrushStrokeResultSchema.parse({
        status: 'applied',
        commandId: input.commandId,
        catalogRevision: maps.catalog().revision,
        maps: [map],
        changedChunks: [],
        history: journal.history(map.id),
        changed: true,
        affectedTileCount: 0,
        impact: emptyImpact(),
        warnings: []
      })
      journal.storeReceipt(input.commandId, map.id, result)
      return result
    })
  }

  applyBrushStroke(raw: unknown) {
    const input = applyHexBrushStrokeInputSchema.parse(raw)
    const coordinates = expandHexStroke(input.path, input.radius)
    if (coordinates === null)
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'stroke_too_large'
      })
    const chunkCount = new Set(
      coordinates.map((coordinate) => {
        const key = hexChunkKeyFor(coordinate)
        return `${key.q}:${key.r}`
      })
    ).size
    if (chunkCount > MAX_HEX_STROKE_CHUNKS)
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'stroke_too_large'
      })

    const { unitOfWork, maps, party, travel, journal } = this.createContext()
    const receipt = journal.receipt(input.commandId)
    if (receipt) return receipt
    const map = maps.summary(input.mapId)
    if (map.contentRevision !== input.expectedContentRevision)
      throw new CapabilityError('stale', true)

    const existing = maps.changedBrushTargets({
      mapId: input.mapId,
      mode: input.mode,
      biomeId: input.biomeId,
      coordinates
    })
    const coordinateIds = new Set(existing.map(tileId))
    const impact: HexEraseImpact =
      input.mode === 'erase'
        ? eraseImpact(maps, party, travel, input.mapId, coordinateIds)
        : emptyImpact()
    const confirmationToken = tokenFor(
      input.mapId,
      map.contentRevision,
      existing,
      impact
    )
    if (hasImpact(impact) && input.confirmationToken !== confirmationToken)
      return hexBrushStrokeResultSchema.parse({
        status: 'confirmation_required',
        commandId: input.commandId,
        confirmationToken,
        impact
      })

    const before = maps.captureTruth(input.mapId, existing)
    const result = unitOfWork.run(() => {
      if (input.mode === 'erase') {
        const currentImpact = eraseImpact(
          maps,
          party,
          travel,
          input.mapId,
          coordinateIds
        )
        const currentToken = tokenFor(
          input.mapId,
          map.contentRevision,
          existing,
          currentImpact
        )
        if (
          hasImpact(currentImpact) &&
          input.confirmationToken !== currentToken
        )
          return hexBrushStrokeResultSchema.parse({
            status: 'confirmation_required',
            commandId: input.commandId,
            confirmationToken: currentToken,
            impact: currentImpact
          })
        travel.abortJourneys(
          currentImpact.journeys.map((journey) => journey.sceneId)
        )
        party.clearHexTravelPositions(input.mapId, coordinateIds)
      }
      const patch = maps.applyBrushTargets({
        mapId: input.mapId,
        mode: input.mode,
        biomeId: input.biomeId,
        coordinates: existing,
        expectedContentRevision: input.expectedContentRevision
      })
      const after = maps.captureTruth(input.mapId, existing)
      if (existing.length > 0)
        journal.record(input.mapId, input.commandId, input.mode, before, after)
      const applied = hexBrushStrokeResultSchema.parse({
        status: 'applied',
        commandId: input.commandId,
        catalogRevision: patch.catalogRevision,
        maps: [patch.map],
        changedChunks: patch.chunks.map((chunk) => ({
          mapId: input.mapId,
          key: chunk.key,
          revision: chunk.revision
        })),
        history: journal.history(input.mapId),
        changed: existing.length > 0,
        affectedTileCount: existing.length,
        impact,
        warnings: []
      })
      journal.storeReceipt(input.commandId, input.mapId, applied)
      return applied
    })
    return result
  }

  history(mapId: string) {
    return this.createContext().journal.history(mapId)
  }

  undo(raw: unknown) {
    return this.mutateHistory(raw, 'undo')
  }

  redo(raw: unknown) {
    return this.mutateHistory(raw, 'redo')
  }

  commandReceipt(commandId: string) {
    return this.createContext().journal.receipt(commandId)
  }

  placeLocation(raw: unknown) {
    const input = editHexLocationInputSchema.parse(raw)
    return this.mutateLocation(input, 'place')
  }

  removeLocation(raw: unknown) {
    const input = unplaceHexLocationInputSchema.parse(raw)
    return this.mutateLocation(input, 'remove')
  }

  private mutateLocation(
    input:
      | ReturnType<typeof editHexLocationInputSchema.parse>
      | ReturnType<typeof unplaceHexLocationInputSchema.parse>,
    mode: 'place' | 'remove'
  ) {
    const { unitOfWork, maps, journal } = this.createContext()
    const previousReceipt = journal.receipt(input.commandId)
    if (previousReceipt) return previousReceipt
    const owner = maps.summary(input.mapId)
    if (owner.contentRevision !== input.expectedContentRevision)
      throw new CapabilityError('stale', true)
    const previous = maps.locateLocation(input.locationId)
    const target = 'coordinate' in input ? input.coordinate : null
    if (mode === 'place' && target && !maps.tileExists(input.mapId, target))
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'tile_missing'
      })
    const occupied = target ? maps.locationAt(input.mapId, target) : null
    if (occupied && occupied.locationId !== input.locationId)
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'location_occupied'
      })
    if (mode === 'remove' && (!previous || previous.mapId !== input.mapId))
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'location_not_placed'
      })
    if (
      previous &&
      target &&
      previous.mapId === input.mapId &&
      previous.coordinate.q === target.q &&
      previous.coordinate.r === target.r
    ) {
      const result = hexBrushStrokeResultSchema.parse({
        status: 'applied',
        commandId: input.commandId,
        catalogRevision: maps.catalog().revision,
        maps: [owner],
        changedChunks: [],
        history: journal.history(input.mapId),
        changed: false,
        affectedTileCount: 0,
        impact: emptyImpact(),
        warnings: []
      })
      journal.storeReceipt(input.commandId, input.mapId, result)
      return result
    }
    const scopes = new Map<string, AxialCoordinate[]>()
    if (previous) scopes.set(previous.mapId, [previous.coordinate])
    if (target) {
      const values = scopes.get(input.mapId) ?? []
      if (!values.some((cell) => tileId(cell) === tileId(target)))
        values.push(target)
      scopes.set(input.mapId, values)
    }
    const before = [...scopes].flatMap(([mapId, coordinates]) =>
      maps.captureTruth(mapId, coordinates)
    )
    return unitOfWork.run(() => {
      if (mode === 'place' && 'coordinate' in input) maps.placeLocation(input)
      else maps.removeLocation(input)
      const after = [...scopes].flatMap(([mapId, coordinates]) =>
        maps.captureTruth(mapId, coordinates)
      )
      journal.record(
        input.mapId,
        input.commandId,
        mode === 'place'
          ? previous
            ? 'location_move'
            : 'location_place'
          : 'location_remove',
        before,
        after
      )
      const changedChunks = [...scopes].flatMap(([mapId, coordinates]) =>
        [
          ...new Map(
            coordinates.map((coordinate) => {
              const key = hexChunkKeyFor(coordinate)
              return [`${key.q}:${key.r}`, key] as const
            })
          ).values()
        ].map((key) => ({ mapId, key }))
      )
      const result = hexBrushStrokeResultSchema.parse({
        status: 'applied',
        commandId: input.commandId,
        catalogRevision: maps.catalog().revision,
        maps: [...scopes.keys()].map((mapId) => maps.summary(mapId)),
        changedChunks: materializeChangedChunks(maps, changedChunks),
        history: journal.history(input.mapId),
        changed: true,
        affectedTileCount: before.length,
        impact: emptyImpact(),
        warnings: []
      })
      journal.storeReceipt(input.commandId, input.mapId, result)
      return result
    })
  }

  private mutateHistory(raw: unknown, direction: 'undo' | 'redo') {
    const input = mutateHexHistoryInputSchema.parse(raw)
    const { unitOfWork, maps, party, travel, journal } = this.createContext()
    const previousReceipt = journal.receipt(input.commandId)
    if (previousReceipt) return previousReceipt
    const map = maps.summary(input.mapId)
    if (map.contentRevision !== input.expectedContentRevision)
      throw new CapabilityError('stale', true)
    const row = journal.step(input.mapId, direction)
    if (!row)
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'history_empty'
      })
    const beforeCells = row.before
    const afterCells = row.after
    const cells = direction === 'undo' ? beforeCells : afterCells
    const expectedCells = direction === 'undo' ? afterCells : beforeCells
    const groupedExpected = new Map<string, HexMapTruthCell[]>()
    for (const cell of expectedCells) {
      const scoped = groupedExpected.get(cell.mapId) ?? []
      scoped.push(cell)
      groupedExpected.set(cell.mapId, scoped)
    }
    const currentCells = [...groupedExpected].flatMap(([mapId, scoped]) =>
      maps.captureTruth(mapId, scoped)
    )
    if (!sameTruth(currentCells, expectedCells))
      return hexBrushStrokeResultSchema.parse({
        status: 'rejected',
        commandId: input.commandId,
        reason: 'history_conflict'
      })
    const deleting = cells
      .filter((cell) => cell.biomeId === null)
      .filter((cell) => maps.tileExists(input.mapId, cell))
    const coordinateIds = new Set(deleting.map(tileId))
    const impact = eraseImpact(maps, party, travel, input.mapId, coordinateIds)
    const confirmationToken = tokenFor(
      input.mapId,
      map.contentRevision,
      deleting,
      impact
    )
    if (hasImpact(impact) && input.confirmationToken !== confirmationToken)
      return hexBrushStrokeResultSchema.parse({
        status: 'confirmation_required',
        commandId: input.commandId,
        confirmationToken,
        impact
      })
    try {
      return unitOfWork.run(() => {
        if (deleting.length > 0) {
          const currentImpact = eraseImpact(
            maps,
            party,
            travel,
            input.mapId,
            coordinateIds
          )
          const currentToken = tokenFor(
            input.mapId,
            map.contentRevision,
            deleting,
            currentImpact
          )
          if (
            hasImpact(currentImpact) &&
            input.confirmationToken !== currentToken
          )
            return hexBrushStrokeResultSchema.parse({
              status: 'confirmation_required',
              commandId: input.commandId,
              confirmationToken: currentToken,
              impact: currentImpact
            })
          travel.abortJourneys(
            currentImpact.journeys.map((journey) => journey.sceneId)
          )
          party.clearHexTravelPositions(input.mapId, coordinateIds)
        }
        const restored = maps.restoreTruth(
          input.mapId,
          cells,
          input.expectedContentRevision
        )
        journal.advance(input.mapId, row.sequence, direction)
        const result = hexBrushStrokeResultSchema.parse({
          status: 'applied',
          commandId: input.commandId,
          catalogRevision: restored.patch.catalogRevision,
          maps: [...new Set(cells.map((cell) => cell.mapId))].map((mapId) =>
            maps.summary(mapId)
          ),
          changedChunks: materializeChangedChunks(maps, restored.changedChunks),
          history: journal.history(input.mapId),
          changed: true,
          affectedTileCount: cells.length,
          impact,
          warnings: restored.skippedLocationIds.map((locationId) => ({
            code: 'deleted_location_skipped' as const,
            locationId
          }))
        })
        journal.storeReceipt(input.commandId, input.mapId, result)
        return result
      })
    } catch (cause) {
      if (cause instanceof CapabilityError && cause.code === 'stale')
        return hexBrushStrokeResultSchema.parse({
          status: 'rejected',
          commandId: input.commandId,
          reason: 'history_conflict'
        })
      throw cause
    }
  }
}

function hasImpact(impact: HexEraseImpact) {
  return (
    impact.locations.length > 0 ||
    impact.journeys.length > 0 ||
    impact.partyMembers.length > 0
  )
}

function tokenFor(
  mapId: string,
  revision: number,
  coordinates: readonly AxialCoordinate[],
  impact: HexEraseImpact
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        mapId,
        revision,
        coordinates: coordinates.map(tileId).sort(),
        impact: {
          locations: impact.locations
            .map(({ locationId, q, r }) => ({ locationId, q, r }))
            .sort((a, b) => a.locationId.localeCompare(b.locationId)),
          journeys: impact.journeys
            .map(({ sceneId, status }) => ({ sceneId, status }))
            .sort((a, b) => a.sceneId.localeCompare(b.sceneId)),
          partyMembers: impact.partyMembers
            .map(({ memberId, q, r }) => ({ memberId, q, r }))
            .sort((a, b) => a.memberId.localeCompare(b.memberId))
        }
      })
    )
    .digest('hex')
}

function emptyImpact(): HexEraseImpact {
  return { locations: [], journeys: [], partyMembers: [] }
}

function materializeChangedChunks(
  maps: HexEditingMapPort,
  changes: readonly Readonly<{
    mapId: string
    key: Readonly<{ q: number; r: number }>
  }>[]
) {
  return changes.map((change) => ({
    ...change,
    revision: maps.readChunk(change.mapId, change.key).revision
  }))
}

function eraseImpact(
  maps: HexEditingMapPort,
  party: HexEditingPartyPort,
  travel: HexEditingTravelPort,
  mapId: string,
  coordinateIds: ReadonlySet<string>
): HexEraseImpact {
  return {
    locations: maps.locationImpacts(mapId, coordinateIds),
    journeys: travel.journeyImpacts(mapId, coordinateIds),
    partyMembers: party
      .hexTravelImpacts(mapId, coordinateIds)
      .map((member) => ({
        q: member.q,
        r: member.r,
        memberId: member.memberId,
        displayName: member.displayName
      }))
  }
}

function sameTruth(
  left: readonly HexMapTruthCell[],
  right: readonly HexMapTruthCell[]
) {
  const normalized = (cells: readonly HexMapTruthCell[]) =>
    [...cells]
      .sort((a, b) =>
        `${a.mapId}:${tileId(a)}`.localeCompare(`${b.mapId}:${tileId(b)}`)
      )
      .map((cell) => JSON.stringify(cell))
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right))
}
