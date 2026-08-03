import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { z } from 'zod'
import {
  axialCoordinateSchema,
  evaluateHexRouteInputSchema,
  hexRouteEvaluationSchema,
  hexTravelSnapshotSchema,
  mutateHexTravelInputSchema,
  positionHexPartyInputSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema,
  type AxialCoordinate,
  type HexRouteEvaluation,
  type HexTravelSnapshot
} from '../../shared/contracts/hex.js'
import { PartyStore } from '../party/party-store.js'
import { SceneStore } from '../scene/scene-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { HexMapStore, parseTileId, tileId, tileLabel } from './hex-map-store.js'
import { terrainDefinition } from './terrain-catalog.js'

const hexDistanceMiles = 3
const speedToMphDivisor = 10
const maximumExpandedRouteSteps = 10_000

type JourneyStatus =
  'travelling' | 'paused' | 'blocked' | 'completed' | 'aborted'

interface JourneyRow {
  sceneId: string
  revision: number
  mapId: string
  status: JourneyStatus
  pathJson: string
  currentIndex: number
  partyMemberIdsJson: string
  multiplier: 1 | 2 | 5 | 10
  segmentStartedAt: number | null
  hint: string
}

export function axialDistance(a: AxialCoordinate, b: AxialCoordinate): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(-a.q - a.r + b.q + b.r)
  )
}

const neighbors: readonly AxialCoordinate[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
]

export function axialLine(
  start: AxialCoordinate,
  destination: AxialCoordinate
): readonly AxialCoordinate[] {
  const result: AxialCoordinate[] = [{ ...start }]
  let current = start
  while (axialDistance(current, destination) > 0) {
    const next = neighbors
      .map((delta, order) => ({
        q: current.q + delta.q,
        r: current.r + delta.r,
        order
      }))
      .sort(
        (left, right) =>
          axialDistance(left, destination) -
            axialDistance(right, destination) || left.order - right.order
      )[0]!
    current = { q: next.q, r: next.r }
    result.push(current)
  }
  return result
}

export function expandWaypoints(
  start: AxialCoordinate,
  waypoints: readonly AxialCoordinate[]
): readonly AxialCoordinate[] {
  const path: AxialCoordinate[] = [{ ...start }]
  for (const waypoint of waypoints) {
    const segment = axialLine(path[path.length - 1]!, waypoint)
    path.push(...segment.slice(1))
  }
  return path
}

export function travelGameSeconds(speedFeet: number, cost: number): number {
  if (speedFeet <= 0) return 0
  const mph = speedFeet / speedToMphDivisor
  return Math.round((hexDistanceMiles / mph) * 3600 * cost)
}

export class HexTravelService {
  constructor(
    private readonly campaignDatabase: () => Database.Database,
    private readonly now: () => number = Date.now
  ) {}

  read(sceneId?: string): HexTravelSnapshot {
    return this.withStore((store) => store.read(sceneId))
  }

  tick(): {
    changed: readonly HexTravelSnapshot[]
    active: boolean
  } {
    return this.withStore((store) => store.advanceActive())
  }

  nextBoundaryDelay(): number | null {
    return this.withStore((store) => store.nextBoundaryDelay())
  }

  evaluate(input: unknown): HexRouteEvaluation {
    const parsed = evaluateHexRouteInputSchema.parse(input)
    return this.withStore((store) => store.evaluate(parsed))
  }

  position(input: unknown): HexTravelSnapshot {
    const parsed = positionHexPartyInputSchema.parse(input)
    return this.withStore((store) => store.position(parsed))
  }

  start(input: unknown): HexTravelSnapshot {
    const parsed = startHexTravelInputSchema.parse(input)
    return this.withStore((store) => store.start(parsed))
  }

  pause(input: unknown): HexTravelSnapshot {
    const parsed = mutateHexTravelInputSchema.parse(input)
    return this.withStore((store) => store.pause(parsed))
  }

  resume(input: unknown): HexTravelSnapshot {
    const parsed = mutateHexTravelInputSchema.parse(input)
    return this.withStore((store) => store.resume(parsed))
  }

  abort(input: unknown): HexTravelSnapshot {
    const parsed = mutateHexTravelInputSchema.parse(input)
    return this.withStore((store) => store.abort(parsed))
  }

  setMultiplier(input: unknown): HexTravelSnapshot {
    const parsed = setHexTravelMultiplierInputSchema.parse(input)
    return this.withStore((store) => store.setMultiplier(parsed))
  }

  private withStore<T>(work: (store: HexTravelStore) => T): T {
    const db = this.campaignDatabase()
    const locations = new WorldLocationStore(db)
    return work(
      new HexTravelStore(
        db,
        new HexMapStore(db, locations),
        new PartyStore(db),
        new SceneStore(db, () => locations.read().locations),
        this.now
      )
    )
  }
}

export class HexTravelStore {
  constructor(
    private readonly db: Database.Database,
    private readonly maps: HexMapStore,
    private readonly party: PartyStore,
    private readonly scenes: SceneStore,
    private readonly now: () => number = Date.now
  ) {}

  read(requestedSceneId?: string): HexTravelSnapshot {
    const sceneId = requestedSceneId ?? this.scenes.focusedSceneId()
    return this.snapshot(sceneId, this.journey(sceneId))
  }

  advanceActive(): {
    changed: readonly HexTravelSnapshot[]
    active: boolean
  } {
    const sceneIds = this.db
      .prepare(
        "SELECT scene_id AS sceneId FROM hex_journey WHERE status = 'travelling'"
      )
      .all() as { sceneId: string }[]
    const changed: HexTravelSnapshot[] = []
    for (const { sceneId } of sceneIds) {
      const before = this.journey(sceneId)
      if (before === null) continue
      this.advance(before)
      const after = this.journey(sceneId)
      if (after !== null && after.revision !== before.revision)
        changed.push(this.snapshot(sceneId, after))
    }
    const active =
      this.db
        .prepare(
          "SELECT 1 FROM hex_journey WHERE status = 'travelling' LIMIT 1"
        )
        .get() !== undefined
    return { changed, active }
  }

  nextBoundaryDelay(): number | null {
    const journeys = this.db
      .prepare(
        `SELECT scene_id AS sceneId, revision, map_id AS mapId, status,
                path_json AS pathJson, current_index AS currentIndex,
                party_member_ids_json AS partyMemberIdsJson,
                multiplier, segment_started_at AS segmentStartedAt, hint
         FROM hex_journey WHERE status = 'travelling'`
      )
      .all() as JourneyRow[]
    let next: number | null = null
    for (const journey of journeys) {
      const endsAt = this.segmentEndsAt(journey)
      if (endsAt === null) continue
      const delay = Math.max(0, endsAt - this.now())
      next = next === null ? delay : Math.min(next, delay)
    }
    return next
  }

  evaluate(input: z.infer<typeof evaluateHexRouteInputSchema>) {
    this.requireScene(input.sceneId)
    const result = this.route(input.sceneId, input.mapId, input.waypoints)
    return hexRouteEvaluationSchema.parse(result)
  }

  position(input: z.infer<typeof positionHexPartyInputSchema>) {
    if (this.scenes.revision() !== input.expectedSceneRevision)
      throw new CapabilityError('stale', true)
    this.maps.summary(input.mapId)
    const ids = this.scenes.partyMemberIds(input.sceneId)
    if (ids.length === 0) throw new CapabilityError('validation_failed', false)
    this.db.transaction(() => {
      this.party.setTravelPosition(ids, input.mapId, tileId(input.coordinate))
      this.setSceneLocation(input.sceneId, input.mapId, input.coordinate, 0)
      this.db
        .prepare('DELETE FROM hex_journey WHERE scene_id = ?')
        .run(input.sceneId)
    })()
    return this.snapshot(input.sceneId, null)
  }

  start(input: z.infer<typeof startHexTravelInputSchema>) {
    const current = this.journey(input.sceneId)
    if ((current?.revision ?? 0) !== input.expectedRevision)
      throw new CapabilityError('stale', true)
    const evaluation = this.route(input.sceneId, input.mapId, input.waypoints)
    if (!evaluation.canStart)
      throw new CapabilityError('validation_failed', false)
    const partyMemberIds = this.scenes.partyMemberIds(input.sceneId)
    const status: JourneyStatus =
      evaluation.path.length <= 1 ? 'completed' : 'travelling'
    this.db.transaction(() => {
      this.party.setTravelPosition(
        partyMemberIds,
        input.mapId,
        tileId(evaluation.path[0]!)
      )
      this.setSceneLocation(input.sceneId, input.mapId, evaluation.path[0]!, 0)
      this.db
        .prepare(
          `INSERT INTO hex_journey (
             scene_id, revision, map_id, status, path_json, current_index,
             party_member_ids_json, multiplier, segment_started_at, hint
           ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
           ON CONFLICT(scene_id) DO UPDATE SET
             revision = excluded.revision, map_id = excluded.map_id,
             status = excluded.status, path_json = excluded.path_json,
             current_index = 0,
             party_member_ids_json = excluded.party_member_ids_json,
             multiplier = excluded.multiplier,
             segment_started_at = excluded.segment_started_at,
             hint = excluded.hint`
        )
        .run(
          input.sceneId,
          (current?.revision ?? -1) + 1,
          input.mapId,
          status,
          JSON.stringify(evaluation.path),
          JSON.stringify(partyMemberIds),
          input.multiplier,
          status === 'travelling' ? this.now() : null,
          status === 'travelling' ? 'Reise läuft.' : 'Ziel erreicht.'
        )
    })()
    return this.snapshot(input.sceneId, this.journey(input.sceneId))
  }

  pause(input: z.infer<typeof mutateHexTravelInputSchema>) {
    return this.mutate(input, 'paused', 'Reise pausiert.')
  }

  resume(input: z.infer<typeof mutateHexTravelInputSchema>) {
    const journey = this.requireJourney(input.sceneId, input.expectedRevision)
    const path = this.path(journey)
    if (journey.currentIndex >= path.length - 1)
      throw new CapabilityError('validation_failed', false)
    const currentMembers = this.scenes.partyMemberIds(input.sceneId)
    this.db
      .prepare(
        `UPDATE hex_journey SET status = 'travelling', revision = revision + 1,
         party_member_ids_json = ?, segment_started_at = ?, hint = 'Reise läuft.'
         WHERE scene_id = ?`
      )
      .run(JSON.stringify(currentMembers), this.now(), input.sceneId)
    return this.snapshot(input.sceneId, this.journey(input.sceneId))
  }

  abort(input: z.infer<typeof mutateHexTravelInputSchema>) {
    return this.mutate(input, 'aborted', 'Reise abgebrochen.')
  }

  setMultiplier(input: z.infer<typeof setHexTravelMultiplierInputSchema>) {
    this.requireJourney(input.sceneId, input.expectedRevision)
    this.db
      .prepare(
        `UPDATE hex_journey SET multiplier = ?, revision = revision + 1,
         segment_started_at = CASE WHEN status = 'travelling' THEN ? ELSE segment_started_at END
         WHERE scene_id = ?`
      )
      .run(input.multiplier, this.now(), input.sceneId)
    return this.snapshot(input.sceneId, this.journey(input.sceneId))
  }

  private mutate(
    input: z.infer<typeof mutateHexTravelInputSchema>,
    status: JourneyStatus,
    hint: string
  ) {
    this.requireJourney(input.sceneId, input.expectedRevision)
    this.db
      .prepare(
        'UPDATE hex_journey SET status = ?, revision = revision + 1, segment_started_at = NULL, hint = ? WHERE scene_id = ?'
      )
      .run(status, hint, input.sceneId)
    return this.snapshot(input.sceneId, this.journey(input.sceneId))
  }

  private route(
    sceneId: string,
    mapId: string,
    waypoints: readonly AxialCoordinate[]
  ): z.infer<typeof hexRouteEvaluationSchema> {
    this.maps.summary(mapId)
    const position = this.scenePosition(sceneId, mapId)
    const speed = this.speed(sceneId)
    if (!position)
      return {
        canStart: false,
        message: 'Party zuerst auf der Karte platzieren.',
        path: [],
        totalGameSeconds: 0,
        ...speed
      }
    if (waypoints.length === 0)
      return {
        canStart: false,
        message: 'Mindestens ein Reiseziel wählen.',
        path: [position],
        totalGameSeconds: 0,
        ...speed
      }
    const stepCount = waypoints.reduce(
      (total, waypoint, index) =>
        total +
        axialDistance(index === 0 ? position : waypoints[index - 1]!, waypoint),
      0
    )
    if (stepCount > maximumExpandedRouteSteps)
      return {
        canStart: false,
        message: 'Die Route ist für einen einzelnen Reiseauftrag zu lang.',
        path: [position],
        totalGameSeconds: 0,
        ...speed
      }
    const path = expandWaypoints(position, waypoints)
    if (speed.effectiveSpeedFeet <= 0)
      return {
        canStart: false,
        message: 'Die Reisegruppe besitzt keine positive Bewegungsrate.',
        path: [...path],
        totalGameSeconds: 0,
        ...speed
      }
    let totalGameSeconds = 0
    for (const coordinate of path.slice(1)) {
      const terrain = terrainDefinition(this.maps.terrainAt(mapId, coordinate))
      if (!terrain.passable)
        return {
          canStart: false,
          message: `${tileLabel(coordinate)} ist unpassierbar.`,
          path: [...path],
          totalGameSeconds: 0,
          ...speed
        }
      totalGameSeconds += travelGameSeconds(
        speed.effectiveSpeedFeet,
        terrain.travelCost
      )
    }
    return {
      canStart: path.length > 1,
      message:
        path.length > 1 ? 'Route bereit.' : 'Das Ziel entspricht dem Start.',
      path: [...path],
      totalGameSeconds,
      ...speed
    }
  }

  private advance(journey: JourneyRow): void {
    const storedMembers = this.memberIds(journey)
    const currentMembers = this.scenes.partyMemberIds(journey.sceneId)
    if (JSON.stringify(storedMembers) !== JSON.stringify(currentMembers)) {
      this.db
        .prepare(
          `UPDATE hex_journey SET status = 'paused', revision = revision + 1,
           segment_started_at = NULL, hint = 'Reisegruppe geändert; Fortsetzung bestätigen.'
           WHERE scene_id = ?`
        )
        .run(journey.sceneId)
      return
    }
    const path = this.path(journey)
    let index = journey.currentIndex
    let startedAt = journey.segmentStartedAt ?? this.now()
    this.maps.summary(journey.mapId)
    const speed = this.speed(journey.sceneId).effectiveSpeedFeet
    while (index < path.length - 1) {
      const next = path[index + 1]!
      const terrain = terrainDefinition(
        this.maps.terrainAt(journey.mapId, next)
      )
      if (!terrain.passable || speed <= 0) {
        this.db
          .prepare(
            `UPDATE hex_journey SET status = 'blocked', revision = revision + 1,
             segment_started_at = NULL, hint = ? WHERE scene_id = ?`
          )
          .run(
            !terrain.passable
              ? `${tileLabel(next)} ist nicht mehr passierbar.`
              : 'Die Reisegruppe besitzt keine positive Bewegungsrate.',
            journey.sceneId
          )
        return
      }
      const gameSeconds = travelGameSeconds(speed, terrain.travelCost)
      const realMilliseconds = (gameSeconds * 1000) / 3600 / journey.multiplier
      if (this.now() - startedAt < realMilliseconds) break
      index += 1
      startedAt += realMilliseconds
      this.db.transaction(() => {
        this.party.setTravelPosition(storedMembers, journey.mapId, tileId(next))
        this.setSceneLocation(journey.sceneId, journey.mapId, next, gameSeconds)
        const complete = index >= path.length - 1
        this.db
          .prepare(
            `UPDATE hex_journey SET current_index = ?, revision = revision + 1,
             status = ?, segment_started_at = ?, hint = ? WHERE scene_id = ?`
          )
          .run(
            index,
            complete ? 'completed' : 'travelling',
            complete ? null : Math.round(startedAt),
            complete ? 'Ziel erreicht.' : 'Reise läuft.',
            journey.sceneId
          )
      })()
      if (index >= path.length - 1) break
    }
  }

  private snapshot(sceneId: string, journey: JourneyRow | null) {
    const scene = this.requireScene(sceneId)
    const position = journey
      ? this.path(journey)[journey.currentIndex]!
      : this.scenePosition(sceneId)
    const mapId = journey?.mapId ?? this.positionMapId(sceneId)
    const map = mapId ? this.maps.summary(mapId) : null
    const placement =
      map && position ? this.maps.locationAt(map.id, position) : null
    const speed = this.speed(sceneId)
    const path = journey ? this.path(journey) : []
    let remainingGameSeconds = 0
    if (journey && map) {
      for (const coordinate of path.slice(journey.currentIndex + 1)) {
        const terrain = terrainDefinition(
          this.maps.terrainAt(map.id, coordinate)
        )
        if (terrain.passable && speed.effectiveSpeedFeet > 0)
          remainingGameSeconds += travelGameSeconds(
            speed.effectiveSpeedFeet,
            terrain.travelCost
          )
      }
    }
    return hexTravelSnapshotSchema.parse({
      revision: journey?.revision ?? 0,
      sceneId,
      status: journey?.status ?? (position ? 'ready' : 'unpositioned'),
      mapId: mapId ?? null,
      mapName: map?.displayName ?? '',
      current: position ?? null,
      currentLabel: position ? tileLabel(position) : '',
      locationId: placement?.locationId ?? null,
      locationName: placement?.displayName ?? '',
      path,
      currentIndex: journey?.currentIndex ?? 0,
      segmentStartedAt: journey?.segmentStartedAt ?? null,
      segmentEndsAt: journey ? this.segmentEndsAt(journey) : null,
      progress:
        path.length <= 1
          ? position
            ? 1
            : 0
          : (journey?.currentIndex ?? 0) / (path.length - 1),
      remainingGameSeconds,
      gameTimeSeconds: scene.gameTimeSeconds,
      ...speed,
      multiplier: journey?.multiplier ?? 1,
      hint:
        journey?.hint ??
        (position
          ? 'Reise planen oder Party neu platzieren.'
          : 'Party zuerst auf einer Hex-Karte platzieren.')
    })
  }

  private scenePosition(sceneId: string, requiredMapId?: string) {
    const members = this.scenes.partyMemberIds(sceneId)
    const party = this.party
      .read()
      .members.filter((member) => members.includes(member.id))
    const positions = party
      .filter((member) => member.attachedToPartyToken)
      .map((member) => member.travelPosition)
      .filter((position) => position !== null)
    if (
      positions.length === party.length &&
      positions.length > 0 &&
      positions.every(
        (position) =>
          position.mapId === positions[0]!.mapId &&
          position.tileId === positions[0]!.tileId
      ) &&
      (!requiredMapId || positions[0]!.mapId === requiredMapId)
    )
      return parseTileId(positions[0]!.tileId)

    const scene = this.requireScene(sceneId)
    if (!scene.locationId) return null
    const placement = this.db
      .prepare(
        'SELECT map_id AS mapId, q, r FROM hex_location_placement WHERE location_id = ?'
      )
      .get(scene.locationId) as
      { mapId: string; q: number; r: number } | undefined
    if (!placement || (requiredMapId && placement.mapId !== requiredMapId))
      return null
    return axialCoordinateSchema.parse({ q: placement.q, r: placement.r })
  }

  private positionMapId(sceneId: string): string | null {
    const members = this.scenes.partyMemberIds(sceneId)
    const member = this.party
      .read()
      .members.find(
        (candidate) =>
          members.includes(candidate.id) &&
          candidate.attachedToPartyToken &&
          candidate.travelPosition
      )
    if (member?.travelPosition) return member.travelPosition.mapId
    const scene = this.requireScene(sceneId)
    if (!scene.locationId) return null
    const placement = this.db
      .prepare(
        'SELECT map_id AS mapId FROM hex_location_placement WHERE location_id = ?'
      )
      .get(scene.locationId) as { mapId: string } | undefined
    return placement?.mapId ?? null
  }

  private speed(sceneId: string) {
    const ids = this.scenes.partyMemberIds(sceneId)
    const members = this.party
      .read()
      .members.filter((member) => ids.includes(member.id))
    const assumedSpeedMemberNames = members
      .filter((member) => member.movementSpeedFeet === null)
      .map((member) => member.name)
    return {
      effectiveSpeedFeet:
        members.length === 0
          ? 0
          : Math.min(
              ...members.map((member) => member.movementSpeedFeet ?? 30)
            ),
      assumedSpeedMemberNames
    }
  }

  private setSceneLocation(
    sceneId: string,
    mapId: string,
    coordinate: AxialCoordinate,
    gameSeconds: number
  ) {
    const placement = this.maps.locationAt(mapId, coordinate)
    this.scenes.advanceTravel(
      sceneId,
      gameSeconds,
      placement?.locationId ?? null,
      placement?.displayName ?? ''
    )
  }

  private requireScene(sceneId: string) {
    const scene = this.scenes
      .snapshot(this.party.read().members)
      .scenes.find((candidate) => candidate.id === sceneId)
    if (!scene) throw new CapabilityError('not_found', false)
    return scene
  }

  private journey(sceneId: string): JourneyRow | null {
    return (
      (this.db
        .prepare(
          `SELECT scene_id AS sceneId, revision, map_id AS mapId, status,
                  path_json AS pathJson, current_index AS currentIndex,
                  party_member_ids_json AS partyMemberIdsJson,
                  multiplier, segment_started_at AS segmentStartedAt, hint
           FROM hex_journey WHERE scene_id = ?`
        )
        .get(sceneId) as JourneyRow | undefined) ?? null
    )
  }

  private segmentEndsAt(journey: JourneyRow): number | null {
    if (journey.status !== 'travelling' || journey.segmentStartedAt === null)
      return null
    const path = this.path(journey)
    const next = path[journey.currentIndex + 1]
    if (next === undefined) return null
    const speed = this.speed(journey.sceneId).effectiveSpeedFeet
    const terrain = terrainDefinition(this.maps.terrainAt(journey.mapId, next))
    if (speed <= 0 || !terrain.passable) return this.now()
    const gameSeconds = travelGameSeconds(speed, terrain.travelCost)
    return Math.round(
      journey.segmentStartedAt +
        (gameSeconds * 1000) / 3600 / journey.multiplier
    )
  }

  private requireJourney(sceneId: string, expectedRevision: number) {
    const journey = this.journey(sceneId)
    if (!journey) throw new CapabilityError('not_found', false)
    if (journey.revision !== expectedRevision)
      throw new CapabilityError('stale', true)
    return journey
  }

  private path(journey: JourneyRow): readonly AxialCoordinate[] {
    return axialCoordinateSchema.array().parse(JSON.parse(journey.pathJson))
  }

  private memberIds(journey: JourneyRow): readonly string[] {
    return z.array(z.uuid()).parse(JSON.parse(journey.partyMemberIdsJson))
  }
}
