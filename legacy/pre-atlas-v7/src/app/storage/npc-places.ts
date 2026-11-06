import { createHash } from 'node:crypto';
import type {
  NpcBuildingChoices,
  NpcBuildingQuery,
  NpcPlaces,
  NpcPlaceSite,
} from '../campaign/npc-places-contracts';
import { validateRoom } from '../shared/room-validation';
import { readCityBuildingChoices, readCitySite } from './city';
import { npcPosition } from './npc-world';
import { readNpc } from './npc-read';
import { deskContent } from './scene-desk';
export function readNpcPlaces(db: any, cam: string, id: string, offset: number): NpcPlaces {
  if (
    typeof id !== 'string' ||
    !id ||
    id.length > 1000 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1000000
  )
    throw new Error('NSC-Schauplatzsuche prüfen.');
  const npc = readNpc(db, cam, id),
    pose = npcPosition(db, cam, id).dungeon,
    sites: NpcPlaceSite[] = [];
  const place = npc.locationId
    ? deskContent(db, cam, { kind: 'location', id: npc.locationId })
    : null;
  if (offset === 0 && pose) {
    if (
      !pose.roomId ||
      !pose.scopeId ||
      !pose.floorId ||
      !Number.isFinite(pose.x + pose.y + pose.z)
    )
      throw new Error('NSC-Raumposition beschädigt.');
    const room = db
      .prepare('SELECT * FROM room WHERE campaign_id=? AND id=?')
      .get(cam, pose.roomId);
    if (room) {
      if (createHash('sha256').update(room.payload).digest('hex') !== room.checksum)
        throw new Error('NSC-Raum beschädigt.');
      const body = JSON.parse(room.payload);
      validateRoom({ name: room.name, ...body });
    }
    const hidden =
        !!room &&
        !!db
          .prepare(
            "SELECT 1 FROM drawing_hidden WHERE campaign_id=? AND hidden=1 AND ((kind='room' AND id=?) OR (kind='floor' AND scope_id=? AND id=?))",
          )
          .get(cam, pose.roomId, pose.scopeId, pose.floorId),
      available =
        !!room && room.scope_id === pose.scopeId && room.floor_id === pose.floorId && !hidden;
    sites.push({
      kind: 'dungeon',
      id: 'room:' + pose.roomId,
      roomId: pose.roomId,
      scopeId: pose.scopeId,
      floorId: pose.floorId,
      title: room ? room.number + ' · ' + room.name : 'Raum nicht verfügbar',
      detail: 'Aktueller Dungeonraum · ' + pose.x + ', ' + pose.y + ', ' + pose.z + ' m',
      available,
    });
  }
  const limit = 40 - sites.length,
    rows = db
      .prepare(
        `SELECT id,city_id,role FROM (
 SELECT id,city_id,'home' role,json_extract(payload,'$.name') title FROM city_unit WHERE campaign_id=@cam AND kind='building' AND EXISTS(SELECT 1 FROM json_each(payload,'$.residentIds') WHERE value=@id)
 UNION ALL SELECT id,city_id,'work' role,json_extract(payload,'$.name') title FROM city_unit WHERE campaign_id=@cam AND kind='building' AND EXISTS(SELECT 1 FROM json_each(payload,'$.workerIds') WHERE value=@id)
 ) ORDER BY title COLLATE NOCASE,city_id,id,role LIMIT @count OFFSET @offset`,
      )
      .all({ cam, id, count: limit + 1, offset });
  for (const row of rows.slice(0, limit)) {
    const { header, unit } = readCitySite(db, cam, row.city_id, row.id),
      home = row.role === 'home',
      members = home ? unit.residentIds : unit.workerIds;
    if (!members?.includes(id)) throw new Error('NSC-Gebäudebindung geändert.');
    const location = deskContent(db, cam, { kind: 'location', id: header.locationId }),
      named = home
        ? (unit.households ?? []).filter((h) => h.memberIds.includes(id)).map((h) => h.name)
        : (unit.jobs ?? []).filter((j) => j.workerIds.includes(id)).map((j) => j.name);
    sites.push({
      kind: home ? 'home' : 'work',
      id: row.role + ':' + header.id + ':' + unit.id,
      cityId: header.id,
      unitId: unit.id,
      title: unit.name || 'Unbenanntes Haus',
      detail:
        (home ? 'Wohnt hier' : 'Arbeitet hier') +
        ' · ' +
        header.name +
        ' · ' +
        location.title +
        (named.length ? ' · ' + named.join(', ') : ''),
      available: !location.unavailable,
    });
  }
  return {
    npcId: id,
    name: npc.name,
    locationTitle: place?.title ?? 'Ohne Ortsbindung',
    sites,
    next: rows.length > limit ? offset + limit : null,
  };
}

export function readNpcBuildingChoices(
  db: any,
  cam: string,
  id: string,
  q: NpcBuildingQuery,
): NpcBuildingChoices {
  if (
    !q ||
    !['home', 'work'].includes(q.role) ||
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0 ||
    q.offset > 1000000
  )
    throw new Error('Gebäudesuche prüfen.');
  const npc = readNpc(db, cam, id),
    path = q.role === 'home' ? '$.residentIds' : '$.workerIds';
  const old = db
    .prepare(
      "SELECT id,city_id FROM city_unit WHERE campaign_id=? AND kind='building' AND EXISTS(SELECT 1 FROM json_each(payload,?) WHERE value=?) LIMIT 2",
    )
    .all(cam, path, id);
  if (old.length > 1)
    throw new Error('Mehrere gleichartige Gebäudebindungen vorhanden. Im Stadtbereich klären.');
  const current = old[0] ? readCitySite(db, cam, old[0].city_id, old[0].id) : null;
  const choices = readCityBuildingChoices(db, cam, q);
  return {
    npcId: id,
    name: npc.name,
    currentCityTitle: current?.header.name ?? null,
    currentBinding: current
      ? {
          fromCityId: current.header.id,
          fromUnitId: current.unit.id,
          expectedRevision: current.header.revision,
        }
      : null,
    ...choices,
  };
}
