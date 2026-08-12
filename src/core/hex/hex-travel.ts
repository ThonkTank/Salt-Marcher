import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { z } from 'zod'
import {
  axialCoordinateSchema,
  evaluateHexRouteInputSchema,
  hexRouteEvaluationSchema,
  hexRuntimeOverlayProjectionSchema,
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
import { HexMapStore, tileLabel } from './hex-map-store.js'
import { biomeDefinition as defaultBiomeDefinition } from './biome-catalog.js'
import type {
  HexBiomeDefinition,
  HexBiomeId
} from '../../shared/contracts/hex.js'

const hexDistanceMiles = 3
const speedToMphDivisor = 10
const maximumExpandedRouteSteps = 10_000

type JourneyStatus =
  'travelling' | 'paused' | 'blocked' | 'completed' | 'aborted'

function routeIsVisible(status: JourneyStatus): boolean {
  return status === 'travelling' || status === 'paused' || status === 'blocked'
}

interface JourneyRow {
  sceneId: string
  revision: number
  mapId: string
  status: JourneyStatus
  currentIndex: number
  partyMemberIdsJson: string
  multiplier: 1 | 2 | 5 | 10
  segmentStartedAt: number | null
  abortReason: 'user' | 'map-edit' | null
  hintCode: HexTravelSnapshot['hintCode']
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
    private readonly now: () => number = Date.now,
    private readonly biomeDefinition: (
      id: HexBiomeId
    ) => HexBiomeDefinition = defaultBiomeDefinition
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

  runtimeOverlays(mapId: string) {
    return this.withStore((store) => store.runtimeOverlays(mapId))
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
        this.now,
        this.biomeDefinition
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
    private readonly now: () => number = Date.now,
    private readonly biomeDefinition: (
      id: HexBiomeId
    ) => HexBiomeDefinition = defaultBiomeDefinition
  ) {}

  read(requestedSceneId?: string): HexTravelSnapshot {
    const sceneId = requestedSceneId ?? this.scenes.focusedSceneId()
    return this.snapshot(sceneId, this.journey(sceneId))
  }

  runtimeOverlays(mapId: string) {
    this.maps.summary(mapId)
    const party = this.party.read()
    const scenes = this.scenes.snapshot(party.members)
    const journeys = this.db
      .prepare(
        `SELECT scene_id AS sceneId, revision, map_id AS mapId, status,
                current_index AS currentIndex,
                party_member_ids_json AS partyMemberIdsJson,
                multiplier, segment_started_at AS segmentStartedAt,
                abort_reason AS abortReason, hint_code AS hintCode
         FROM hex_journey WHERE map_id = ?`
      )
      .all(mapId) as JourneyRow[]
    const journeyByScene = new Map(journeys.map((row) => [row.sceneId, row]))
    const pathByScene = new Map<string, AxialCoordinate[]>()
    const pathRows = this.db
      .prepare(
        `SELECT scene_id AS sceneId, q, r FROM hex_journey_path
         WHERE map_id = ? ORDER BY scene_id, position`
      )
      .all(mapId) as Array<{ sceneId: string; q: number; r: number }>
    for (const row of pathRows) {
      const path = pathByScene.get(row.sceneId) ?? []
      path.push({ q: row.q, r: row.r })
      pathByScene.set(row.sceneId, path)
    }
    const overlays = scenes.scenes.flatMap((scene) => {
      const journey = journeyByScene.get(scene.id)
      const storedRoute = pathByScene.get(scene.id) ?? []
      const route = journey && routeIsVisible(journey.status) ? storedRoute : []
      const attachedPositions = party.members
        .filter(
          (member) =>
            scene.partyMemberIds.includes(member.id) &&
            member.attachedToPartyToken &&
            member.travelPosition?.mapId === mapId
        )
        .map((member) => member.travelPosition!)
      const commonPosition =
        attachedPositions.length > 0 &&
        attachedPositions.every(
          (position) =>
            position.q === attachedPositions[0]!.q &&
            position.r === attachedPositions[0]!.r
        )
          ? { q: attachedPositions[0]!.q, r: attachedPositions[0]!.r }
          : null
      const journeyPosition =
        journey && journey.status !== 'aborted'
          ? (storedRoute[journey.currentIndex] ?? null)
          : null
      const token = journeyPosition ?? commonPosition
      if (!journey && !token) return []
      if (journey?.status === 'aborted' && !token) return []
      return [
        {
          sceneId: scene.id,
          label: scene.title,
          token,
          route,
          focused: scene.id === scenes.focusedSceneId
        }
      ]
    })
    return hexRuntimeOverlayProjectionSchema.parse({ mapId, overlays })
  }

  journeyImpacts(
    mapId: string,
    coordinateIds: ReadonlySet<string>
  ): Array<{ sceneId: string; status: HexTravelSnapshot['status'] }> {
    const targets = [...coordinateIds].map((id) => {
      const separator = id.indexOf(':')
      return {
        q: Number(id.slice(0, separator)),
        r: Number(id.slice(separator + 1))
      }
    })
    return this.db
      .prepare(
        `WITH targets(q, r) AS (
           SELECT CAST(json_extract(value, '$.q') AS INTEGER),
                  CAST(json_extract(value, '$.r') AS INTEGER)
           FROM json_each(?)
         )
         SELECT DISTINCT j.scene_id AS sceneId, j.status
         FROM targets
         JOIN hex_journey_path p
           ON p.map_id = ? AND p.q = targets.q AND p.r = targets.r
         JOIN hex_journey j ON j.scene_id = p.scene_id
         WHERE j.status <> 'aborted'
         ORDER BY j.scene_id`
      )
      .all(JSON.stringify(targets), mapId) as Array<{
      sceneId: string
      status: HexTravelSnapshot['status']
    }>
  }

  abortJourneys(sceneIds: readonly string[]): void {
    const abort = this.db.prepare(
      `UPDATE hex_journey
       SET status = 'aborted', revision = revision + 1,
           current_index = 0, segment_started_at = NULL,
           abort_reason = 'map-edit', hint_code = 'map-edit-aborted'
       WHERE scene_id = ?`
    )
    for (const sceneId of sceneIds) abort.run(sceneId)
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
                current_index AS currentIndex,
                party_member_ids_json AS partyMemberIdsJson,
                multiplier, segment_started_at AS segmentStartedAt,
                abort_reason AS abortReason, hint_code AS hintCode
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
    if (!this.maps.tileExists(input.mapId, input.coordinate))
      throw new CapabilityError('validation_failed', false)
    const ids = this.scenes.partyMemberIds(input.sceneId)
    if (ids.length === 0) throw new CapabilityError('validation_failed', false)
    this.db.transaction(() => {
      this.party.setTravelPosition(ids, input.mapId, input.coordinate)
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
    if (evaluation.status !== 'ready')
      throw new CapabilityError('validation_failed', false)
    const partyMemberIds = this.scenes.partyMemberIds(input.sceneId)
    const status: JourneyStatus =
      evaluation.path.length <= 1 ? 'completed' : 'travelling'
    this.db.transaction(() => {
      this.party.setTravelPosition(
        partyMemberIds,
        input.mapId,
        evaluation.path[0]!
      )
      this.setSceneLocation(input.sceneId, input.mapId, evaluation.path[0]!, 0)
      this.db
        .prepare(
          `INSERT INTO hex_journey (
             scene_id, revision, map_id, status, current_index,
             party_member_ids_json, multiplier, segment_started_at,
             abort_reason, hint_code
           ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?)
           ON CONFLICT(scene_id) DO UPDATE SET
             revision = excluded.revision, map_id = excluded.map_id,
             status = excluded.status,
             current_index = 0,
             party_member_ids_json = excluded.party_member_ids_json,
             multiplier = excluded.multiplier,
             segment_started_at = excluded.segment_started_at,
             abort_reason = NULL, hint_code = excluded.hint_code`
        )
        .run(
          input.sceneId,
          (current?.revision ?? -1) + 1,
          input.mapId,
          status,
          JSON.stringify(partyMemberIds),
          input.multiplier,
          status === 'travelling' ? this.now() : null,
          status === 'travelling' ? 'travelling' : 'completed'
        )
      this.replacePath(input.sceneId, input.mapId, evaluation.path)
    })()
    return this.snapshot(input.sceneId, this.journey(input.sceneId))
  }

  pause(input: z.infer<typeof mutateHexTravelInputSchema>) {
    return this.mutate(input, 'paused', 'paused', null)
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
         party_member_ids_json = ?, segment_started_at = ?,
         abort_reason = NULL, hint_code = 'travelling'
         WHERE scene_id = ?`
      )
      .run(JSON.stringify(currentMembers), this.now(), input.sceneId)
    return this.snapshot(input.sceneId, this.journey(input.sceneId))
  }

  abort(input: z.infer<typeof mutateHexTravelInputSchema>) {
    return this.mutate(input, 'aborted', 'aborted', 'user')
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
    hintCode: HexTravelSnapshot['hintCode'],
    abortReason: JourneyRow['abortReason']
  ) {
    this.requireJourney(input.sceneId, input.expectedRevision)
    this.db
      .prepare(
        `UPDATE hex_journey SET status = ?, revision = revision + 1,
         segment_started_at = NULL, abort_reason = ?, hint_code = ?
         WHERE scene_id = ?`
      )
      .run(status, abortReason, hintCode, input.sceneId)
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
        status: 'rejected',
        reason: 'party-unpositioned',
        blockingCoordinate: null,
        path: [],
        ...speed
      }
    if (waypoints.length === 0)
      return {
        status: 'rejected',
        reason: 'missing-waypoint',
        blockingCoordinate: null,
        path: [position],
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
        status: 'rejected',
        reason: 'route-too-long',
        blockingCoordinate: null,
        path: [position],
        ...speed
      }
    const path = expandWaypoints(position, waypoints)
    if (speed.effectiveSpeedFeet <= 0)
      return {
        status: 'rejected',
        reason: 'movement-speed-unavailable',
        blockingCoordinate: null,
        path: [...path],
        ...speed
      }
    let totalGameSeconds = 0
    let totalCost = 0
    for (const coordinate of path.slice(1)) {
      const biomeId = this.maps.biomeAt(mapId, coordinate)
      if (biomeId === null)
        return {
          status: 'rejected',
          reason: 'outside-map',
          blockingCoordinate: coordinate,
          path: [...path],
          ...speed
        }
      const biome = this.biomeDefinition(biomeId)
      if (!biome.passable)
        return {
          status: 'rejected',
          reason: 'impassable',
          blockingCoordinate: coordinate,
          path: [...path],
          ...speed
        }
      totalCost += biome.travelCost
      totalGameSeconds += travelGameSeconds(
        speed.effectiveSpeedFeet,
        biome.travelCost
      )
    }
    if (path.length <= 1)
      return {
        status: 'rejected',
        reason: 'same-as-start',
        blockingCoordinate: null,
        path: [...path],
        ...speed
      }
    return {
      status: 'ready',
      path: [...path],
      totalGameSeconds,
      totalTravelCost: totalCost,
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
           segment_started_at = NULL, hint_code = 'party-changed'
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
      const biomeId = this.maps.biomeAt(journey.mapId, next)
      const biome = biomeId === null ? null : this.biomeDefinition(biomeId)
      if (!biome?.passable || speed <= 0) {
        this.db
          .prepare(
            `UPDATE hex_journey SET status = 'blocked', revision = revision + 1,
             segment_started_at = NULL, hint_code = ? WHERE scene_id = ?`
          )
          .run(
            !biome
              ? 'route-left-map'
              : !biome.passable
                ? 'blocked-biome'
                : 'no-speed',
            journey.sceneId
          )
        return
      }
      const gameSeconds = travelGameSeconds(speed, biome.travelCost)
      const realMilliseconds = (gameSeconds * 1000) / 3600 / journey.multiplier
      if (this.now() - startedAt < realMilliseconds) break
      index += 1
      startedAt += realMilliseconds
      this.db.transaction(() => {
        this.party.setTravelPosition(storedMembers, journey.mapId, next)
        this.setSceneLocation(journey.sceneId, journey.mapId, next, gameSeconds)
        const complete = index >= path.length - 1
        this.db
          .prepare(
            `UPDATE hex_journey SET current_index = ?, revision = revision + 1,
             status = ?, segment_started_at = ?, abort_reason = NULL,
             hint_code = ? WHERE scene_id = ?`
          )
          .run(
            index,
            complete ? 'completed' : 'travelling',
            complete ? null : Math.round(startedAt),
            complete ? 'completed' : 'travelling',
            journey.sceneId
          )
      })()
      if (index >= path.length - 1) break
    }
  }

  private snapshot(sceneId: string, journey: JourneyRow | null) {
    const scene = this.requireScene(sceneId)
    const storedPath = journey ? this.path(journey) : []
    const path = journey && routeIsVisible(journey.status) ? storedPath : []
    const position =
      (journey && journey.status !== 'aborted'
        ? storedPath[journey.currentIndex]
        : null) ?? this.scenePosition(sceneId)
    const mapId = journey?.mapId ?? this.positionMapId(sceneId)
    const map = mapId ? this.maps.summary(mapId) : null
    const placement =
      map && position ? this.maps.locationAt(map.id, position) : null
    const speed = this.speed(sceneId)
    let remainingGameSeconds = 0
    if (journey && map) {
      for (const coordinate of path.slice(journey.currentIndex + 1)) {
        const biomeId = this.maps.biomeAt(map.id, coordinate)
        const biome = biomeId === null ? null : this.biomeDefinition(biomeId)
        if (biome?.passable && speed.effectiveSpeedFeet > 0)
          remainingGameSeconds += travelGameSeconds(
            speed.effectiveSpeedFeet,
            biome.travelCost
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
      hintCode: journey ? journey.hintCode : position ? 'ready' : 'unpositioned'
    })
  }

  private scenePosition(sceneId: string, requiredMapId?: string) {
    const members = this.scenes.partyMemberIds(sceneId)
    const party = this.party
      .read()
      .members.filter((member) => members.includes(member.id))
    const attached = party.filter((member) => member.attachedToPartyToken)
    const positions = attached
      .map((member) => member.travelPosition)
      .filter((position) => position !== null)
    if (
      positions.length === attached.length &&
      positions.length > 0 &&
      positions.every(
        (position) =>
          position.mapId === positions[0]!.mapId &&
          position.q === positions[0]!.q &&
          position.r === positions[0]!.r
      ) &&
      (!requiredMapId || positions[0]!.mapId === requiredMapId)
    )
      return { q: positions[0]!.q, r: positions[0]!.r }
    if (attached.length > 0) return null

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
    const attached = this.party
      .read()
      .members.filter(
        (candidate) =>
          members.includes(candidate.id) && candidate.attachedToPartyToken
      )
    const member = attached.find((candidate) => candidate.travelPosition)
    if (member?.travelPosition) return member.travelPosition.mapId
    if (attached.length > 0) return null
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
                  current_index AS currentIndex,
                  party_member_ids_json AS partyMemberIdsJson,
                  multiplier, segment_started_at AS segmentStartedAt,
                  abort_reason AS abortReason, hint_code AS hintCode
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
    const biomeId = this.maps.biomeAt(journey.mapId, next)
    const biome = biomeId === null ? null : this.biomeDefinition(biomeId)
    if (speed <= 0 || !biome?.passable) return this.now()
    const gameSeconds = travelGameSeconds(speed, biome.travelCost)
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
    return axialCoordinateSchema.array().parse(
      this.db
        .prepare(
          `SELECT q, r FROM hex_journey_path
           WHERE scene_id = ? ORDER BY position`
        )
        .all(journey.sceneId)
    )
  }

  private replacePath(
    sceneId: string,
    mapId: string,
    path: readonly AxialCoordinate[]
  ): void {
    this.db
      .prepare('DELETE FROM hex_journey_path WHERE scene_id = ?')
      .run(sceneId)
    const insert = this.db.prepare(
      `INSERT INTO hex_journey_path (scene_id, position, map_id, q, r)
       VALUES (?, ?, ?, ?, ?)`
    )
    path.forEach((coordinate, position) =>
      insert.run(sceneId, position, mapId, coordinate.q, coordinate.r)
    )
  }

  private memberIds(journey: JourneyRow): readonly string[] {
    return z.array(z.uuid()).parse(JSON.parse(journey.partyMemberIdsJson))
  }
}
