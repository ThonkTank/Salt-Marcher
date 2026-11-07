export type { Axis } from "./atlas/generated/Axis";
export type { ConnectionKind } from "./atlas/generated/ConnectionKind";
export type { StairDirection } from "./atlas/generated/StairDirection";
export type { Room } from "./atlas/generated/Room";
export type { Cell } from "./atlas/generated/Cell";
export type { RoomIntent } from "./atlas/generated/RoomIntent";
export type { ConnectionIntent } from "./atlas/generated/ConnectionIntent";
import type { StairDirection } from "./atlas/generated/StairDirection";
import type { LocalPoint } from "./atlas/generated/LocalPoint";
export type { InteriorConnection as Connection } from "./atlas/generated/InteriorConnection";
export type Point = LocalPoint;
export function stairPlacement(
  floor: number,
  point: Point,
  travel: "up" | "down",
  direction: StairDirection,
  length: number,
) {
  const vectors: Record<StairDirection, Point> = {
    north: [0, -1],
    east: [1, 0],
    south: [0, 1],
    west: [-1, 0],
  };
  const opposite: Record<StairDirection, StairDirection> = {
    north: "south",
    east: "west",
    south: "north",
    west: "east",
  };
  const [dx, dy] = vectors[direction];
  return {
    action: "createStairs" as const,
    floor: travel === "up" ? floor : floor - 1,
    x: point[0] + (travel === "down" ? dx * (length - 1) : 0),
    y: point[1] + (travel === "down" ? dy * (length - 1) : 0),
    direction: travel === "up" ? direction : opposite[direction],
    length,
  };
}
