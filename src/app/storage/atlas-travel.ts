import { type SqliteDatabase, checkedQuery, checkedRow } from './sqlite-connection';
import { validateTerrainAnchor } from '../atlas/terrain-objects';
import { effectiveLandscape } from '../atlas/atlas-landscape';
import { atlasPartyPoint } from '../atlas/atlas-runtime-model';
import { createHash } from 'node:crypto';
import type { Point } from '../shared/contracts';
import type { CampaignAtlas } from '../atlas/campaign-atlas-view-contracts';
import type {
  AtlasEntrance,
  AtlasLocalJourney,
  AtlasLocalPreview,
} from '../atlas/atlas-journey-contracts';
import type { AtlasTravelCommand } from '../atlas/atlas-travel-contracts';
import { atlasFrame } from '../atlas/campaign-atlas-model';
import { atlasHexAt, atlasToLocal, localToAtlas } from '../atlas/atlas-coordinates';
import { cellAt } from '../runtime/world-model';
import { hexAccessProblem } from '../runtime/hex-access';
import { posed, roadPoints } from '../atlas/city-model';
import { inside } from '../atlas/drawing-model';
import { atlasLocalRoute } from '../atlas/atlas-local-route';
import { position } from './scene-position';
import { savePosition } from './world-state';
import { dungeonGeometry } from './dungeon-geometry-read';
import { createTriggerEvents } from './triggers';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function installAtlasTravel(db: SqliteDatabase) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS atlas_entrance(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;CREATE TABLE IF NOT EXISTS atlas_local_journey(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id)) STRICT;CREATE TABLE IF NOT EXISTS atlas_travel_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,fingerprint TEXT NOT NULL) STRICT;`,
  );
}
export function atlasEntrances(db: SqliteDatabase, cam: string): AtlasEntrance[] {
  return db
    .prepare('SELECT payload,checksum FROM atlas_entrance WHERE campaign_id=?')
    .all(cam)
    .map(decode);
}
/** Display projection only. Canonical travel commands still read all entrances. */
export function atlasDisplayEntrances(
  db: SqliteDatabase,
  cam: string,
  scopeIds: string[],
  selectedId?: string,
): AtlasEntrance[] {
  if (!scopeIds.length)
    return selectedId
      ? db
          .prepare('SELECT payload,checksum FROM atlas_entrance WHERE campaign_id=? AND id=?')
          .all(cam, selectedId)
          .map(decode)
      : [];
  return db
    .prepare(
      `SELECT payload,checksum FROM atlas_entrance WHERE campaign_id=?
    AND (id=? OR json_extract(payload,'$.scopeId') IN (SELECT value FROM json_each(?)))`,
    )
    .all(cam, selectedId ?? null, JSON.stringify([...new Set(scopeIds)]))
    .map(decode);
}
function decode(value: unknown) {
  const row = checkedRow(value, { payload: 'text', checksum: 'text' });
  if (!row || hash(JSON.parse(row.payload)) !== row.checksum)
    throw new Error('Atlaslaufstand beschädigt.');
  return JSON.parse(row.payload);
}
export function atlasLocalJourney(
  db: SqliteDatabase,
  cam: string,
  sceneId: string,
): AtlasLocalJourney | null {
  const r = db
    .prepare('SELECT payload,checksum FROM atlas_local_journey WHERE campaign_id=? AND scene_id=?')
    .get(cam, sceneId);
  return r ? decode(r) : null;
}
function saveJourney(db: SqliteDatabase, cam: string, j: AtlasLocalJourney) {
  db.prepare(
    'INSERT INTO atlas_local_journey VALUES(?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, j.sceneId, JSON.stringify(j), hash(j));
}
export function putAtlasEntrance(db: SqliteDatabase, a: CampaignAtlas, e: AtlasEntrance) {
  validateTerrainAnchor(e.terrain);
  const room = a.workspace.rooms.find(
      (r) => r.id === e.roomId && r.scopeId === e.scopeId && r.floorId === e.floorId,
    ),
    binding = a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === e.scopeId);
  if (
    !room ||
    !binding ||
    ![e.inside?.x, e.inside?.y, e.outside?.x, e.outside?.y].every(Number.isFinite) ||
    !inside(e.inside, room.polygons)
  )
    throw new Error('Eingang benötigt einen verorteten Raum und gültige Innen-/Außenpunkte.');
  const old = atlasEntrances(db, a.campaignId).find((x) => x.id === e.id);
  if ((old?.revision ?? 0) !== e.revision) throw new Error('Eingang inzwischen geändert.');
  const next = { ...e, revision: e.revision + 1 };
  db.prepare(
    'INSERT INTO atlas_entrance VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(a.campaignId, e.id, JSON.stringify(next), hash(next));
}

export function atlasLocalGeometryBasis(a: Pick<CampaignAtlas, 'terrain' | 'bindings' | 'cities'>) {
  return hash({
    terrain: a.terrain.revision,
    bindings: a.bindings,
    cities: a.cities.map((c) => ({
      header: c.header,
      units: c.units.filter((u) => ['building', 'water', 'wall'].includes(u.kind)),
    })),
  });
}
function obstacles(a: CampaignAtlas, start: Point, end: Point) {
  const margin = 30,
    minX = Math.min(start.x, end.x) - margin,
    maxX = Math.max(start.x, end.x) + margin,
    minY = Math.min(start.y, end.y) - margin,
    maxY = Math.max(start.y, end.y) + margin,
    out: Point[][] = [];
  for (const c of a.cities) {
    const b = a.bindings.find((b) => b.kind === 'city' && b.ownerId === c.header.id);
    if (!b) continue;
    const f = atlasFrame(a, b);
    for (const u of c.units) {
      if (u.kind === 'wall') {
        const points = roadPoints(u, c.units),
          radius = (u.width ?? 1) / 2;
        for (let i = 1; i < points.length; i++) {
          const from = points[i - 1]!,
            to = points[i]!,
            length = Math.hypot(to.x - from.x, to.y - from.y);
          if (!length) continue;
          const dx = ((to.y - from.y) / length) * radius,
            dy = (-(to.x - from.x) / length) * radius;
          out.push(
            [
              { x: from.x + dx, y: from.y + dy },
              { x: to.x + dx, y: to.y + dy },
              { x: to.x - dx, y: to.y - dy },
              { x: from.x - dx, y: from.y - dy },
            ].map((p) => localToAtlas(p, f)),
          );
        }
        continue;
      }
      if (!['building', 'water'].includes(u.kind)) continue;
      const p = (u.kind === 'building' ? posed(u) : (u.outline ?? [])).map((p) =>
        localToAtlas(p, f),
      );
      if (
        p.length &&
        Math.max(...p.map((p) => p.x)) >= minX &&
        Math.min(...p.map((p) => p.x)) <= maxX &&
        Math.max(...p.map((p) => p.y)) >= minY &&
        Math.min(...p.map((p) => p.y)) <= maxY
      )
        out.push(p);
    }
  }
  return out;
}
function localTravelContext(a: CampaignAtlas) {
  if (a.geometry.position)
    throw new Error('Dungeon zuerst über einen verbundenen Eingang verlassen.');
  if (a.scene?.journey && ['active', 'paused', 'interrupted'].includes(a.scene.journey.status))
    throw new Error('Laufende Weltreise zuerst abschließen oder beenden.');
}
export function previewAtlasLocal(a: CampaignAtlas, end: Point): AtlasLocalPreview {
  if (
    a.geometry.triggerEvents?.some(
      (e) => e.status === 'open' && e.mode === 'interrupt' && !e.activated,
    )
  )
    throw new Error('Offenen Fallenhinweis zuerst klären.');
  if (!a.scene || !a.geometry.sceneId) throw new Error('Eine Gruppe fokussieren.');
  localTravelContext(a);
  if (!end || ![end.x, end.y].every(Number.isFinite)) throw new Error('Gültiges Reiseziel wählen.');
  const start = atlasPartyPoint(a)!;
  if (Math.hypot(end.x - start.x, end.y - start.y) > 5000)
    throw new Error('Für diesen Weg die Weltreise verwenden oder ein näheres Zwischenziel wählen.');
  const speed = a.geometry.travelPace?.pace.metersPerMinute;
  if (!speed || speed <= 0)
    throw new Error(a.geometry.travelPace?.pace.reason ?? 'Gruppentempo fehlt.');
  const accessible = (p: Point) => {
    const cell = {
      ...cellAt(a.terrain, atlasHexAt(p, a.terrain.hexMeters), 0),
      ...effectiveLandscape(a.terrain.landscape ?? [], p),
    };
    return !hexAccessProblem(cell) && cell.terrain !== 'water';
  };
  if (!accessible(end))
    throw new Error(
      'Zielhex ist für diesen Fußweg gesperrt oder benötigt eine bestätigte Weltreise.',
    );
  const route = atlasLocalRoute(start, end, obstacles(a, start, end), accessible);
  let distance = 0;
  for (let i = 1; i < route.length; i++)
    distance += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.y - route[i - 1]!.y);
  return {
    sceneId: a.scene.scene.id,
    basis: atlasLocalGeometryBasis(a),
    positionRevision: a.scene.position.revision,
    clockRevision: a.scene.scene.clock.revision,
    membershipRevision: a.scene.scene.membershipRevision,
    actorIds: [...a.scene.scene.members],
    route,
    distanceMeters: distance,
    seconds: Math.ceil((distance / speed) * 60),
    speedMetersPerMinute: speed,
    destination: end,
  };
}
function saveOutdoor(
  db: SqliteDatabase,
  a: CampaignAtlas,
  p: Point,
  changeLocation: (id: string | null) => void,
) {
  const cam = a.campaignId,
    sceneId = a.scene!.scene.id,
    h = atlasHexAt(p, a.terrain.hexMeters);
  const city = a.cities.find((c) => {
    const b = a.bindings.find((b) => b.kind === 'city' && b.ownerId === c.header.id);
    if (!b) return false;
    const q = atlasToLocal(p, atlasFrame(a, b));
    return q.x >= 0 && q.y >= 0 && q.x <= c.header.width && q.y <= c.header.height;
  });
  const binding = city
      ? a.bindings.find((b) => b.kind === 'city' && b.ownerId === city.header.id)
      : null,
    local = binding ? atlasToLocal(p, atlasFrame(a, binding)) : null;
  changeLocation(city?.header.locationId ?? null);
  savePosition(db, cam, sceneId, {
    revision: position(db, cam, sceneId).revision + 1,
    mapId: a.terrain.id,
    ...h,
    locationId: city?.header.locationId ?? null,
    dungeon: null,
    ...(city && local ? { city: { cityId: city.header.id, ...local, z: 0 } } : { outdoor: p }),
  });
}
export interface AtlasTravelPorts {
  crossing: (
    from: import('../atlas/dungeon-position-contracts').DungeonPose,
    to: import('../atlas/dungeon-position-contracts').DungeonPose,
  ) => void;
  read: () => CampaignAtlas;
  advance: (seconds: number, revision: number) => void;
  location: (id: string | null) => void;
  dungeon: (pose: import('../atlas/dungeon-position-contracts').DungeonPose | null) => void;
}
export function executeAtlasTravel(
  db: SqliteDatabase,
  c: AtlasTravelCommand,
  ports: AtlasTravelPorts,
) {
  return db
    .transaction(() => {
      let a = ports.read();
      if (!a.scene || a.scene.scene.id !== c.sceneId || !a.scene.scene.members.length)
        throw new Error('Fokusgruppe geändert oder leer.');
      const fingerprint = hash(c.action),
        prior = checkedQuery(db, 'SELECT * FROM atlas_travel_receipt WHERE command_id=?', {
          campaign_id: 'text',
          fingerprint: 'text',
        }).get(c.commandId);
      if (prior) {
        if (prior.campaign_id !== c.campaignId || prior.fingerprint !== fingerprint)
          throw new Error('Reisebefehlskennung anders verwendet.');
        return;
      }
      const op = c.action;
      if (op.kind === 'place') {
        if (
          a.scene.position.revision !== op.expectedPositionRevision ||
          a.scene.scene.membershipRevision !== op.expectedMembershipRevision ||
          ![op.point.x, op.point.y].every(Number.isFinite)
        )
          throw new Error('Gruppenstand geändert.');
        saveOutdoor(db, a, op.point, ports.location);
        const j = atlasLocalJourney(db, c.campaignId, c.sceneId);
        if (j)
          saveJourney(db, c.campaignId, {
            ...j,
            revision: j.revision + 1,
            status: 'ended',
            reason: 'GM hat die Gruppe platziert.',
          });
      } else if (op.kind === 'entrance') {
        if (
          a.geometry.triggerEvents?.some(
            (e) => e.status === 'open' && e.mode === 'interrupt' && !e.activated,
          )
        )
          throw new Error('Offenen Fallenhinweis zuerst klären.');
        const e = atlasEntrances(db, c.campaignId).find((e) => e.id === op.id),
          b = e ? a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === e.scopeId) : null;
        if (
          !e ||
          !b ||
          e.revision !== op.revision ||
          a.scene.position.revision !== op.expectedPositionRevision ||
          a.scene.scene.membershipRevision !== op.expectedMembershipRevision
        )
          throw new Error('Eingang oder Gruppenstand geändert.');
        if (
          (a.scene.journey &&
            ['active', 'paused', 'interrupted'].includes(a.scene.journey.status)) ||
          (a.localJourney && ['active', 'paused'].includes(a.localJourney.status))
        )
          throw new Error('Laufenden Reiseabschnitt zuerst abschließen oder beenden.');
        if (
          (op.direction === 'enter' && a.geometry.position) ||
          (op.direction === 'exit' &&
            (!a.geometry.position ||
              a.geometry.position.scopeId !== e.scopeId ||
              a.geometry.position.floorId !== e.floorId ||
              a.geometry.position.roomId !== e.roomId))
        )
          throw new Error('Gruppe befindet sich nicht auf dieser Seite des Eingangs.');
        const from = localToAtlas(
            op.direction === 'enter' ? e.outside : e.inside,
            atlasFrame(a, b),
          ),
          party = atlasPartyPoint(a);
        if (!party || Math.hypot(from.x - party.x, from.y - party.y) > 3.048)
          throw new Error('Gruppe zuerst an diesen Eingang bringen.');
        const speed = a.geometry.travelPace?.pace.metersPerMinute;
        if (!speed) throw new Error('Gruppentempo fehlt.');
        const seconds = Math.ceil(
          (Math.hypot(e.outside.x - e.inside.x, e.outside.y - e.inside.y) / speed) * 60,
        );
        if (seconds) ports.advance(seconds, a.scene.scene.clock.revision);
        const z =
            a.geometry.floors.find((f) => f.id === e.floorId && f.scopeId === e.scopeId)
              ?.elevation ?? 0,
          inside = {
            scopeId: e.scopeId,
            floorId: e.floorId,
            roomId: e.roomId,
            ...e.inside,
            z,
          },
          outside = { ...inside, ...e.outside };
        if (op.direction === 'enter') {
          ports.dungeon(inside);
          ports.crossing(outside, inside);
        } else {
          ports.crossing(inside, outside);
          ports.dungeon(null);
          a = ports.read();
          saveOutdoor(db, a, localToAtlas(e.outside, atlasFrame(a, b)), ports.location);
        }
      } else if (op.kind === 'start') {
        const check = previewAtlasLocal(a, op.preview.destination);
        if (hash(check) !== hash(op.preview))
          throw new Error('Reisebasis inzwischen geändert. Vorschau erneut berechnen.');
        const existing = atlasLocalJourney(db, c.campaignId, c.sceneId);
        if (existing && ['active', 'paused'].includes(existing.status))
          throw new Error('Lokale Reise zuerst beenden.');
        saveJourney(db, c.campaignId, {
          ...check,
          id: c.commandId,
          revision: 1,
          nextIndex: 1,
          status: 'active',
          elapsedSeconds: 0,
          travelledMeters: 0,
          reason: '',
        });
      } else {
        let j = atlasLocalJourney(db, c.campaignId, c.sceneId);
        if (!j || j.id !== op.id || j.revision !== op.expectedRevision)
          throw new Error('Reise inzwischen geändert.');
        if (['pause', 'resume', 'end'].includes(op.kind)) {
          if (!['active', 'paused'].includes(j.status))
            throw new Error('Lokale Reise bereits abgeschlossen oder beendet.');
          if (op.kind === 'resume') localTravelContext(a);
          j = {
            ...j,
            revision: j.revision + 1,
            status: op.kind === 'pause' ? 'paused' : op.kind === 'resume' ? 'active' : 'ended',
          };
          saveJourney(db, c.campaignId, j);
        } else {
          if (j.status !== 'active') throw new Error('Reise ist angehalten.');
          if (
            j.basis !== atlasLocalGeometryBasis(a) ||
            j.positionRevision !== a.scene.position.revision ||
            j.clockRevision !== a.scene.scene.clock.revision ||
            j.membershipRevision !== a.scene.scene.membershipRevision ||
            JSON.stringify(j.actorIds) !== JSON.stringify(a.scene.scene.members)
          ) {
            saveJourney(db, c.campaignId, {
              ...j,
              revision: j.revision + 1,
              status: 'paused',
              reason: 'Geometrie, Gruppe, Ort oder Zeit geändert. Neu planen.',
            });
          } else {
            let checkpoint = 0;
            for (let i = 1; i <= j.nextIndex && i < j.route.length; i++)
              checkpoint += Math.hypot(
                j.route[i]!.x - j.route[i - 1]!.x,
                j.route[i]!.y - j.route[i - 1]!.y,
              );
            const seconds =
              op.kind === 'round'
                ? (a.geometry.travelPace?.settings.explorationRoundSeconds ?? 600)
                : Math.max(
                    0,
                    Math.ceil((checkpoint / Math.max(j.distanceMeters, 1e-9)) * j.seconds) -
                      j.elapsedSeconds,
                  );
            const elapsed = Math.min(j.seconds, j.elapsedSeconds + seconds),
              distance = j.seconds ? (elapsed / j.seconds) * j.distanceMeters : j.distanceMeters;
            let covered = 0,
              point = j.route[0]!,
              nextIndex = j.route.length;
            for (let i = 1; i < j.route.length; i++) {
              const from = j.route[i - 1]!,
                to = j.route[i]!,
                length = Math.hypot(to.x - from.x, to.y - from.y);
              if (covered + length >= distance && length) {
                const t = (distance - covered) / length;
                point = {
                  x: from.x + (to.x - from.x) * t,
                  y: from.y + (to.y - from.y) * t,
                };
                nextIndex = i;
                break;
              }
              covered += length;
              point = to;
            }
            if (elapsed > j.elapsedSeconds)
              ports.advance(elapsed - j.elapsedSeconds, a.scene.scene.clock.revision);
            saveOutdoor(db, a, point, ports.location);
            a = ports.read();
            saveJourney(db, c.campaignId, {
              ...j,
              revision: j.revision + 1,
              elapsedSeconds: elapsed,
              travelledMeters: distance,
              nextIndex,
              status: elapsed >= j.seconds ? 'arrived' : 'active',
              clockRevision: a.scene!.scene.clock.revision,
              positionRevision: a.scene!.position.revision,
            });
          }
        }
      }
      db.prepare('INSERT INTO atlas_travel_receipt VALUES(?,?,?)').run(
        c.commandId,
        c.campaignId,
        fingerprint,
      );
    })
    .immediate();
}

interface ApplyAtlasTravelContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  travelAtlas: (
    token: string,
  ) => import('../atlas/campaign-atlas-view-contracts').CampaignAtlas<
    import('./../shared/contracts').Room,
    import('../atlas/drawing-element-contracts').DrawingElement,
    import('../atlas/city-data-contracts').CityView
  >;
  executeLive: (command: import('../runtime/live-contracts').LiveCommand) => void;
  liveScene: (token: string, id: string) => import('../runtime/live-scene-contracts').LiveScene;
  dungeon: (
    token: string,
  ) => import('./../atlas/dungeon-contracts').DungeonView<
    import('./../shared/contracts').Room,
    import('../atlas/drawing-element-contracts').DrawingElement
  >;
  executeDungeon: (c: import('../atlas/dungeon-contracts').DungeonCommand) => void;
}
export function storedApplyAtlasTravel(
  db: SqliteDatabase,
  context: ApplyAtlasTravelContext,
  c: import('../atlas/atlas-travel-contracts').AtlasTravelCommand,
): void {
  context.guard(c.token, c.campaignId);
  executeAtlasTravel(db, c, {
    read: () => context.travelAtlas(c.token),
    advance: (seconds, revision) => {
      context.executeLive({
        commandId: c.commandId + ':clock',
        token: c.token,
        campaignId: c.campaignId,
        action: {
          kind: 'advance-clock',
          sceneId: c.sceneId,
          expectedRevision: revision,
          amount: seconds,
          unit: 'seconds',
          calendarVersion: 'relative-v1',
          reason: 'Bestätigte lokale Atlasbewegung',
        },
      });
    },
    location: (id) => {
      const s = context.liveScene(c.token, c.sceneId);
      if (s.locationId !== id)
        context.executeLive({
          commandId: c.commandId + ':location',
          token: c.token,
          campaignId: c.campaignId,
          action: {
            kind: 'scene-content',
            sceneId: c.sceneId,
            expectedRevision: s.revision,
            title: s.title,
            notes: s.notes,
            readAloud: s.readAloud ?? '',
            locationId: id,
          },
        });
    },
    crossing: (from, to) => {
      const g = dungeonGeometry(db, c.campaignId),
        scene = context.liveScene(c.token, c.sceneId);
      createTriggerEvents(
        db,
        c.campaignId,
        g,
        { id: 'atlas:' + c.commandId, nextIndex: 1, request: { sceneId: c.sceneId } },
        from,
        to,
        scene.clock.instantMs,
      );
    },
    dungeon: (pose) => {
      const d = context.dungeon(c.token);
      context.executeDungeon({
        commandId: c.commandId + ':dungeon',
        token: c.token,
        campaignId: c.campaignId,
        action: {
          kind: 'place',
          sceneId: c.sceneId,
          expectedPositionRevision: d.positionRevision,
          pose,
        },
      });
    },
  });
}
