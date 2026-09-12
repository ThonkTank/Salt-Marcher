import type Database from 'better-sqlite3'
import { HexMapStore } from '@historical/hex-maps'
import { HexTravelService } from '@historical/hex-travel'
import { WorldLocationStore } from '@historical/locations'
import { LivePlayService } from '@historical/live-play'
import { fixedSqliteDatabaseAccess } from '@historical/database-access'

export function seedHistoricalTravel(
  database: Database.Database,
  locationId: string
) {
  const access = fixedSqliteDatabaseAccess(database)
  const maps = new HexMapStore(database, new WorldLocationStore(database))
  const map = maps.create({
    displayName: 'Küstenpfad',
    expectedCatalogRevision: maps.catalog().revision
  })
  maps.applyBrushTargets({
    mapId: map.id,
    mode: 'paint',
    biomeId: 'grassland',
    coordinates: Array.from({ length: 5 }, (_, q) => ({ q, r: 0 })),
    expectedContentRevision: map.contentRevision
  })
  maps.placeLocation({
    mapId: map.id,
    locationId,
    coordinate: { q: 0, r: 0 },
    expectedContentRevision: maps.summary(map.id).contentRevision
  })
  const play = new LivePlayService(access)
  let session = play.readSession()
  const sceneId = session.scene.focusedSceneId
  session = play.assignScenePartyMember(
    sceneId,
    session.party.members[0]!.id,
    true,
    session.scene.revision
  )
  play.setSceneLocation(sceneId, locationId, session.scene.revision)
  let now = 1000
  const travel = new HexTravelService(access, () => now)
  travel.start({
    sceneId,
    mapId: map.id,
    waypoints: [{ q: 4, r: 0 }],
    multiplier: 1,
    expectedRevision: travel.read(sceneId).revision
  })
  now += 1001
  travel.tick()
  travel.pause({ sceneId, expectedRevision: travel.read(sceneId).revision })
}

export function readHistoricalTravel(database: Database.Database) {
  const access = fixedSqliteDatabaseAccess(database)
  const maps = new HexMapStore(database, new WorldLocationStore(database))
  const catalog = maps.catalog()
  return {
    catalog,
    chunks: catalog.maps.map(({ id }) => maps.readChunks(id, [{ q: 0, r: 0 }])),
    journey: new HexTravelService(access).read(
      new LivePlayService(access).readSession().scene.focusedSceneId
    )
  }
}

export function advanceHistoricalTravel(database: Database.Database) {
  const access = fixedSqliteDatabaseAccess(database)
  const sceneId = new LivePlayService(access).readSession().scene.focusedSceneId
  let now = 10000
  const travel = new HexTravelService(access, () => now)
  if (travel.read(sceneId).status !== 'paused')
    throw new Error('Expected paused historical journey')
  travel.resume({ sceneId, expectedRevision: travel.read(sceneId).revision })
  now += 1001
  travel.tick()
  travel.pause({ sceneId, expectedRevision: travel.read(sceneId).revision })
}
