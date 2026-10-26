import { atlasPaint } from './atlas-paint';
import { appendPaint, type PaintTarget } from './atlas-paint-dom';
import type { RoomGeometry } from '../shared/contracts';
import { centerInRoom } from './dungeon-model';
/** A passive key to the room list, readable at every camera scale. */
export function appendRoomNumber(scene: PaintTarget, room: RoomGeometry, unitsPerPixel: number) {
  if (!Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) return;
  let at;
  try {
    at = centerInRoom(room);
  } catch {
    return;
  }
  appendPaint(
    scene,
    atlasPaint(
      'text',
      {
        x: at.x,
        y: at.y,
        pointer: false,
        data: { roomNumber: room.id },
        style: {
          textAlign: 'center',
          textBaseline: 'middle',
          fontSize: 13 * unitsPerPixel,
          fontWeight: 600,
          fill: '#203648',
          stroke: '#fff',
          lineWidth: 3 * unitsPerPixel,
          lineJoin: 'round',
        },
      },
      room.number,
    ),
  );
}
