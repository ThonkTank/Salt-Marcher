export type FloorMode = "draw" | "erase";

export function floorEraseActive(mode: FloorMode, altKey: boolean): boolean {
  return mode === "erase" || altKey;
}
