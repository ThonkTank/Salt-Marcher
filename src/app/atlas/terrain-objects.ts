import type { Point, Polygon } from '../shared/contracts';
import type { AtlasRenderView } from './campaign-atlas-contracts';
import { atlasFrame, localToAtlas } from './campaign-atlas-model';
import { posedFootprint } from './city-model';
import { TerrainSampler } from './terrain-height';
import type { LandscapeRecord } from './atlas-landscape';

/** Values are metres. A ground anchor moves the complete object, never its footprint or floors. */
export interface TerrainAnchor {
  mode: 'ground' | 'fixed';
  offsetM: number;
}
export interface TerrainBuilding extends TerrainAnchor {
  wallM: number;
  roofM: number;
}
export const defaultTerrainBuilding = (): TerrainBuilding => ({
  mode: 'ground',
  offsetM: 0,
  wallM: 3,
  roofM: 2,
});
export function validateTerrainAnchor(a: TerrainAnchor | undefined) {
  if (
    a !== undefined &&
    (!a ||
      !['ground', 'fixed'].includes(a.mode) ||
      !Number.isFinite(a.offsetM) ||
      Math.abs(a.offsetM) > 100000)
  )
    throw Error('Höhenbindung benötigt Gelände oder feste Höhe und einen gültigen Meterwert.');
}
export function validateTerrainBuilding(b: TerrainBuilding | undefined) {
  validateTerrainAnchor(b);
  if (
    b !== undefined &&
    (!Number.isFinite(b.wallM) ||
      b.wallM < 0.1 ||
      b.wallM > 1000 ||
      !Number.isFinite(b.roofM) ||
      b.roofM < 0 ||
      b.roofM > 1000)
  )
    throw Error('Wandhöhe (0,1–1000 m) und Dachhöhe (0–1000 m) prüfen.');
}
export interface TerrainObjectSource {
  kind: 'building' | 'entrance' | 'scope';
  id: string;
  name: string;
  cityId?: string;
  roomId?: string;
  scopeId?: string;
  closed?: boolean;
  footprint?: Polygon[];
  anchor: Point;
  outline: Point[];
  binding: TerrainAnchor;
  wallM: number;
  roofM: number;
  floorElevations: number[];
  color: string;
}
export interface TerrainObject extends TerrainObjectSource {
  baseM: number;
  topM: number;
  groundM: number[];
  floorsM: number[];
  footprintGroundM?: number[][][];
}
export function terrainObjectSources(
  a: AtlasRenderView,
  display?: { mpp: number; roofs: boolean; scopeId: string | null },
): TerrainObjectSource[] {
  const objects: TerrainObjectSource[] = [];
  for (const city of a.cities) {
    const binding = a.bindings.find((b) => b.kind === 'city' && b.ownerId === city.header.id);
    if (!binding) continue;
    const frame = atlasFrame(a, binding);
    for (const unit of city.units) {
      if (unit.kind !== 'building' || !unit.position || !unit.outline?.length) continue;
      const settings = unit.terrain ?? defaultTerrainBuilding();
      const scope =
        a.region?.interiors[unit.id] ??
        a.bindings.find((b) => b.parent === 'building' && b.parentId === unit.id)?.ownerId;
      const floorElevations =
        unit.floorElevations ??
        a.geometry.floors.filter((f) => f.scopeId === scope).map((f) => f.elevation);
      const footprint = posedFootprint(unit).map((p) => ({
        outer: p.outer.map((p) => localToAtlas(p, frame)),
        holes: p.holes.map((r) => r.map((p) => localToAtlas(p, frame))),
      }));
      objects.push({
        scopeId: scope,
        closed:
          !display || !scope || (display.roofs && display.mpp > 0.4 && display.scopeId !== scope),
        footprint,
        kind: 'building',
        id: unit.id,
        cityId: city.header.id,
        name: unit.name || 'Haus',
        anchor: localToAtlas(unit.position, frame),
        outline: footprint[0]!.outer,
        binding: settings,
        wallM: settings.wallM,
        roofM: settings.roofM,
        floorElevations,
        color: city.header.roof,
      });
    }
  }
  // Free room groups need the canonical ground at their frame origin even when
  // that origin is outside the viewport's terrain tiles. These are height-only
  // references: they never create a footprint, marker or hit target.
  for (const binding of a.bindings) {
    if (binding.kind !== 'dungeon' || binding.parent !== 'world') continue;
    const frame = atlasFrame(a, binding);
    objects.push({
      kind: 'scope',
      id: binding.id,
      scopeId: binding.ownerId,
      name: '',
      closed: false,
      anchor: { x: frame.x, y: frame.y },
      outline: [],
      binding: { mode: 'ground', offsetM: 0 },
      wallM: 0,
      roofM: 0,
      floorElevations: [],
      color: '#000000',
    });
  }
  for (const e of a.entrances) {
    const binding = a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === e.scopeId);
    if (!binding) continue;
    const anchor = localToAtlas(e.outside, atlasFrame(a, binding));
    objects.push({
      kind: 'entrance',
      id: e.id,
      roomId: e.roomId,
      name: 'Eingang · ' + (a.workspace.rooms.find((r) => r.id === e.roomId)?.name ?? 'Dungeon'),
      // The ordinary Atlas already draws and picks an entrance marker. Keep its
      // height anchor without inventing a building footprint or lifting it to a roof.
      anchor,
      outline: [],
      binding: e.terrain ?? { mode: 'ground', offsetM: 0 },
      wallM: 0,
      roofM: 0,
      floorElevations: [],
      color: '#6c6255',
    });
  }
  return objects;
}
export function resolveTerrainObjects(
  sources: TerrainObjectSource[],
  records: LandscapeRecord[],
): TerrainObject[] {
  const sampler = new TerrainSampler(records);
  return sources.map((o) => {
    const baseM =
      (o.binding.mode === 'fixed' ? 0 : sampler.sample(o.anchor).heightM) + o.binding.offsetM;
    const floorsM = o.floorElevations.map((z) => baseM + z);
    return {
      ...o,
      baseM,
      topM: baseM + Math.max(0, ...o.floorElevations) + o.wallM,
      floorsM,
      groundM: o.outline.map((p) => sampler.sample(p).heightM),
      footprintGroundM: o.footprint?.map((p) =>
        [p.outer, ...p.holes].map((r) => r.map((p) => sampler.sample(p).heightM)),
      ),
    };
  });
}

/** Includes every disconnected room footprint and courtyard boundary. */
export function terrainObjectPoints(o: TerrainObjectSource) {
  return [
    o.anchor,
    ...(o.footprint ? o.footprint.flatMap((p) => [...p.outer, ...p.holes.flat()]) : o.outline),
  ];
}
