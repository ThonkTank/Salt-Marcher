import { type Light, type MapObject, type Point, type Room, isRoom, uid } from "../model";
import { inside } from "../geometry";
import { Session } from "../session";

function roomAt(
  session: Session,
  floorId: string,
  point: Point,
  preferredId?: string,
): Room | undefined {
  const rooms = [...session.entities.values()].filter(
    (entity): entity is Room => isRoom(entity) && entity.floorId === floorId,
  );
  const contains = (room: Room) => room.polygons.some(
    (polygon) => inside(point, polygon.outer) &&
      !polygon.holes.some((hole) => inside(point, hole)),
  );
  return rooms.find((room) => room.id === preferredId && contains(room)) ??
    rooms.find(contains);
}

export function objectAtPoint(
  session: Session,
  object: MapObject,
  point: Point,
): MapObject {
  const { roomId: _previousRoomId, ...rest } = object;
  const room = roomAt(session, object.floorId, point, object.roomId);
  return room
    ? { ...rest, x: point.x, y: point.y, roomId: room.id }
    : { ...rest, x: point.x, y: point.y };
}

export function createObject(
  session: Session,
  floorId: string,
  point: Point,
  settings: Pick<
    MapObject,
    "rotation" | "width" | "height" | "color" | "alpha" | "label" | "assetId"
  > = {
    rotation: 0,
    width: 1.6,
    height: 0.9,
    color: 0x795438,
    label: "",
  },
): MapObject {
  const room = roomAt(session, floorId, point);
  const object: MapObject = {
    id: uid(),
    kind: "object",
    floorId,
    x: point.x,
    y: point.y,
    ...settings,
    ...(room ? { roomId: room.id } : {}),
  };
  session.execute({
    label: "Möbel platzieren",
    entities: [{ id: object.id, before: null, after: object }],
  });
  return object;
}
export interface ScatterSettings {
  object: Pick<
    MapObject,
    "rotation" | "width" | "height" | "color" | "alpha" | "label" | "assetId"
  >;
  spacing: number;
  spread: number;
  rotationJitter: number;
  scaleJitter: number;
  seed: number;
}
export function scatterObjects(
  session: Session,
  floorId: string,
  points: readonly Point[],
  settings: ScatterSettings,
): MapObject[] {
  if (
    !Number.isFinite(settings.spacing) ||
    settings.spacing <= 0 ||
    !Number.isFinite(settings.spread) ||
    settings.spread < 0 ||
    !Number.isFinite(settings.rotationJitter) ||
    settings.rotationJitter < 0 ||
    !Number.isFinite(settings.scaleJitter) ||
    settings.scaleJitter < 0 ||
    settings.scaleJitter >= 1
  )
    throw new Error("Ungültige Streueinstellungen.");
  let randomState = settings.seed >>> 0;
  const random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0x100000000;
    },
    samples: Point[] = [];
  if (points.length <= 1) samples.push(points[0] ?? { x: 0, y: 0 });
  else {
    let remaining = 0;
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index]!,
        b = points[index + 1]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy);
      for (
        let distance = remaining;
        distance <= length;
        distance += settings.spacing
      )
        samples.push({
          x: a.x + (dx * distance) / (length || 1),
          y: a.y + (dy * distance) / (length || 1),
        });
      remaining = (remaining - length) % settings.spacing;
      if (remaining < 0) remaining += settings.spacing;
    }
  }
  const rooms = [...session.entities.values()].filter(
      (entity): entity is Room => isRoom(entity) && entity.floorId === floorId,
    ),
    objects = samples.map((sample) => {
      const angle = random() * Math.PI * 2,
        distance = Math.sqrt(random()) * settings.spread,
        point = {
          x: sample.x + Math.cos(angle) * distance,
          y: sample.y + Math.sin(angle) * distance,
        },
        scale = 1 + (random() * 2 - 1) * settings.scaleJitter,
        room = rooms.find((candidate) =>
          candidate.polygons.some(
            (polygon) =>
              inside(point, polygon.outer) &&
              !polygon.holes.some((hole) => inside(point, hole)),
          ),
        );
      return {
        id: uid(),
        kind: "object" as const,
        floorId,
        x: point.x,
        y: point.y,
        ...settings.object,
        rotation:
          settings.object.rotation +
          (random() * 2 - 1) * settings.rotationJitter,
        width: settings.object.width * scale,
        height: settings.object.height * scale,
        ...(room ? { roomId: room.id } : {}),
      };
    });
  if (objects.length)
    session.execute({
      label: "Möbel streuen",
      entities: objects.map((object) => ({
        id: object.id,
        before: null,
        after: object,
      })),
    });
  return objects;
}
export function createLight(
  session: Session,
  floorId: string,
  point: Point,
  settings: Pick<
    Light,
    "radius" | "intensity" | "color" | "shadows" | "assetId"
  >,
): Light {
  const light: Light = {
    id: uid(),
    kind: "light",
    floorId,
    x: point.x,
    y: point.y,
    ...settings,
  };
  session.execute({
    label: "Licht platzieren",
    entities: [{ id: light.id, before: null, after: light }],
  });
  return light;
}
