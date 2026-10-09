import { METERS_PER_MILE, MIN_HEX_MILES, type OverworldDocument, type WorldPoint } from "./overworld";
export interface HexAddress { readonly worldId: string; readonly level: number; readonly q: number; readonly r: number }
export function hexDistanceMeters(level: number): number {
  if (!Number.isSafeInteger(level) || level < 0 || level > 32) throw new Error("Ungültige Hex-Stufe.");
  return MIN_HEX_MILES * METERS_PER_MILE * 3 ** level;
}
function checked(address: HexAddress, world: OverworldDocument): void {
  if (address.worldId !== world.id || !Number.isSafeInteger(address.q) || !Number.isSafeInteger(address.r)) throw new Error("Ungültige Hex-Adresse.");
  hexDistanceMeters(address.level);
}
export function hexAddressKey(a: HexAddress): string {
  return `${a.worldId}/${a.level}/${a.q}/${a.r}`;
}
export function hexCenter(world: OverworldDocument, address: HexAddress): WorldPoint {
  checked(address, world); const d = hexDistanceMeters(address.level), { q, r } = address;
  return world.orientation === "pointy"
    ? { x: world.origin.x + d * (q + r / 2), y: world.origin.y + d * Math.sqrt(3) / 2 * r }
    : { x: world.origin.x + d * Math.sqrt(3) / 2 * q, y: world.origin.y + d * (r + q / 2) };
}
export function fractionalHex(world: OverworldDocument, p: WorldPoint, level: number): { q: number; r: number } {
  if (![p.x, p.y].every(Number.isFinite)) throw new Error("Ungültige Weltposition.");
  const d = hexDistanceMeters(level), x = (p.x - world.origin.x) / d, y = (p.y - world.origin.y) / d;
  return world.orientation === "pointy" ? { q: x - y / Math.sqrt(3), r: 2 * y / Math.sqrt(3) }
    : { q: 2 * x / Math.sqrt(3), r: y - x / Math.sqrt(3) };
}
export function hexAt(world: OverworldDocument, point: WorldPoint, level = 0): HexAddress {
  const f = fractionalHex(world, point, level), s = -f.q - f.r;
  let q = Math.round(f.q), r = Math.round(f.r); const t = Math.round(s);
  const qe = Math.abs(q - f.q), re = Math.abs(r - f.r), se = Math.abs(t - s);
  if (qe >= re && qe >= se) q = -r - t; else if (re >= se) r = -q - t;
  const a = { worldId: world.id, level, q: q || 0, r: r || 0 }; checked(a, world); return a;
}
export function hexCorners(world: OverworldDocument, address: HexAddress): readonly WorldPoint[] {
  const center = hexCenter(world, address), radius = hexDistanceMeters(address.level) / Math.sqrt(3);
  const angle = world.orientation === "pointy" ? Math.PI / 6 : 0;
  return Array.from({ length: 6 }, (_, i) => ({ x: center.x + radius * Math.cos(angle + i * Math.PI / 3), y: center.y + radius * Math.sin(angle + i * Math.PI / 3) }));
}
/** Grid display alone never allocates terrain. Hysteresis preserves the level near transitions. */
export function displayHexLevel(metersPerPixel: number, previous = 0): number {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0 || !Number.isSafeInteger(previous) || previous < 0 || previous > 32)
    throw new Error("Ungültiger Rastermaßstab.");
  let level = previous;
  while (hexDistanceMeters(level) / metersPerPixel < 42 && level < 32) level++;
  while (hexDistanceMeters(level) / metersPerPixel > 180 && level > 0) level--;
  return level;
}
