import { ShapeUtils, Vector2 } from 'three';
import type { AtlasRegionView } from './atlas-region-contracts';
import type { Point, Polygon, RoomGeometry } from './contracts';
import type { TerrainGrid } from './terrain-spatial-model';
import { gridHeight, validateTerrainView } from './terrain-spatial-model';
import { terrainGridLayout } from './terrain-grid-layout';
import { localToAtlas } from './campaign-atlas-model';
import { posedFootprint } from './city-model';
import { defaultTerrainBuilding, validateTerrainBuilding } from './terrain-objects';
export type AtlasSceneSelectionTarget =
  | { kind: 'terrain' }
  | { kind: 'room'; id: string; scopeId: string; floorId: string }
  | { kind: 'building'; id: string; cityId: string; scopeId?: string };

/** Root-free canonical mesh retained as Float64 world coordinates until each
 * renderer chooses its own local GPU origin and precision contract. */
export interface AtlasCanonicalSceneObject {
  id: string;
  target: AtlasSceneSelectionTarget;
  positions: Float64Array;
  indices: Uint32Array;
}
export interface AtlasCanonicalSceneModel {
  objects: AtlasCanonicalSceneObject[];
  targets: ReadonlyMap<string, AtlasSceneSelectionTarget>;
  coverage: {
    complete: boolean;
    supportedKinds: readonly ('terrain' | 'room' | 'building')[];
    unsupported: { code: string; detail: string }[];
  };
  verticalExaggeration: number;
}
export const unmodeledDrawingSourcesWarning = (count: number) => ({
  code: 'drawing-sources-not-modeled',
  detail: `${count} Dungeon-Zeichnungsquellen in der gesamten Kampagne (einschließlich archivierter oder ungeprüfter Quellen) sind nicht räumlich modelliert; keine Ausschnittzählung.`,
});
export type AtlasSceneView = Pick<AtlasRegionView, 'cities' | 'bindings' | 'region'> & {
  /** Source count for a core-only storage read; no fabricated drawing objects. */
  unmodeledDrawingSources?: number;
  geometry: Pick<AtlasRegionView['geometry'], 'floors' | 'drawing'>;
  workspace: Pick<AtlasRegionView['workspace'], 'rooms' | 'floors'>;
};
export interface AtlasSceneSurfaceSampler {
  contains(point: Point): boolean;
  heightAt(point: Point): number;
}
export interface BuildAtlasCanonicalSceneModelOptions {
  view: AtlasSceneView;
  terrain: TerrainGrid | null;
  surface?: AtlasSceneSurfaceSampler;
  display?: { metersPerPixel: number; roofs: boolean; scopeId: string | null };
}
const finite = (...values: number[]) => values.every(Number.isFinite);
const encode = (value: string) => encodeURIComponent(value);
function targetId(target: AtlasSceneSelectionTarget): string {
  if (target.kind === 'terrain') return 'terrain:surface';
  if (target.kind === 'room')
    return `room:${encode(target.scopeId)}:${encode(target.floorId)}:${encode(target.id)}`;
  return `building:${encode(target.cityId)}:${encode(target.id)}`;
}
function validRing(ring: Point[]): boolean {
  return ring.length >= 3 && ring.every((p) => finite(p.x, p.y));
}
function worldPosition(point: Point, z: number): [number, number, number] {
  const out: [number, number, number] = [point.x, point.y, z];
  if (!finite(...out)) throw new Error('Atlas canonical scene vertex is not finite');
  return out;
}
function inTerrain(grid: TerrainGrid, p: Point): boolean {
  const b = grid.view.box;
  return p.x >= b.x && p.y >= b.y && p.x <= b.x + b.width && p.y <= b.y + b.height;
}
function triangulatePolygon(
  polygon: Polygon,
  pointAt: (p: Point) => [number, number, number],
  positions: number[],
  indices: number[],
): void {
  if (!validRing(polygon.outer) || polygon.holes.some((h) => !validRing(h)))
    throw new Error('Atlas polygon ring is incomplete');
  // ShapeUtils triangulation mutates its input rings; clone every coordinate so
  // authored DTOs remain immutable.
  const rings = [polygon.outer, ...polygon.holes].map((r) => r.map((p) => new Vector2(p.x, p.y)));
  const triangles = ShapeUtils.triangulateShape(rings[0]!, rings.slice(1));
  const flat = rings.flat(),
    base = positions.length / 3;
  for (const p of flat) positions.push(...pointAt({ x: p.x, y: p.y }));
  for (const triangle of triangles) for (const index of triangle) indices.push(base + index);
}
function addObject(
  objects: AtlasCanonicalSceneObject[],
  targets: Map<string, AtlasSceneSelectionTarget>,
  target: AtlasSceneSelectionTarget,
  positions: number[],
  indices: number[],
): void {
  if (!indices.length) return;
  const id = targetId(target);
  if (targets.has(id)) throw new Error(`Duplicate Atlas scene target: ${id}`);
  const object = {
    id,
    target,
    positions: new Float64Array(positions),
    indices: new Uint32Array(indices),
  };
  objects.push(object);
  targets.set(id, target);
}

/** Build disposable Deck geometry from a canonical regional snapshot.
 * This pure adapter does not change authored records and does not claim raster
 * coverage can be reconstructed into semantic objects. */
export function buildAtlasCanonicalSceneModel(
  options: BuildAtlasCanonicalSceneModelOptions,
): AtlasCanonicalSceneModel {
  const { view, terrain, display } = options;
  const surface =
    options.surface ??
    (terrain
      ? {
          contains: (p: Point) => inTerrain(terrain, p),
          heightAt: (p: Point) => gridHeight(terrain, p),
        }
      : undefined);
  if (!view) throw new Error('Invalid Atlas canonical scene input');
  if (
    display &&
    (!finite(display.metersPerPixel) ||
      display.metersPerPixel < 0 ||
      typeof display.roofs !== 'boolean' ||
      (display.scopeId !== null && typeof display.scopeId !== 'string'))
  )
    throw new Error('Invalid Atlas scene display state');
  const unsupported: { code: string; detail: string }[] = [],
    objects: AtlasCanonicalSceneObject[] = [],
    targets = new Map<string, AtlasSceneSelectionTarget>();
  const unsupportedKinds: Record<string, string> = {
    'city-units': 'Stadtlinien und Stadtflächen',
    'drawing-elements': 'Dungeon-Zeichnungselemente',
    landscape: 'Landschaftsobjekte und Vegetation',
    labels: 'Kartografische Beschriftungen',
    'raster-images': 'Rasterbilder und Rastermasken',
    territories: 'Gebietsmasken',
  };
  if (view.unmodeledDrawingSources)
    unsupported.push(unmodeledDrawingSourcesWarning(view.unmodeledDrawingSources));
  const unsupportedPresent: string[] = [];
  if (view.cities.some((city) => city.units.some((unit) => unit.kind !== 'building')))
    unsupportedPresent.push('city-units');
  if (view.geometry.drawing.elements?.length) unsupportedPresent.push('drawing-elements');
  if (
    view.region?.landscape &&
    (view.region.landscape.records.length ||
      view.region.landscape.tiles.length ||
      view.region.landscape.coverage.objects ||
      view.region.landscape.state === 'error')
  )
    unsupportedPresent.push('landscape');
  if (view.region?.labels?.length) unsupportedPresent.push('labels');
  if (view.region?.raster) unsupportedPresent.push('raster-images');
  if (view.region?.territoryRaster) unsupportedPresent.push('raster-images');
  if (view.region?.territories) unsupportedPresent.push('territories');
  if (unsupportedPresent.length)
    unsupported.push({
      code: 'scene-feature-kinds-not-modeled',
      detail:
        unsupportedPresent.map((kind) => unsupportedKinds[kind]).join(', ') +
        ' sind in dieser M1-Szene noch nicht abgebildet.',
    });
  if (view.region?.coverage.mode === 'raster')
    unsupported.push({
      code: 'region-raster-only',
      detail:
        'Die Atlasregion enthält nur Rastergeometrie; Räume und Gebäude bleiben semantisch nicht verfügbar.',
    });
  if (view.region?.coverage.mode === 'detail' && !view.region.coverage.complete)
    unsupported.push({
      code: 'region-coverage-incomplete',
      detail: `Atlasregion meldet ${view.region.coverage.unreadable} nicht lesbare Geometrien.`,
    });
  if (view.region?.landscape?.coverage.complete === false)
    unsupported.push({
      code: 'landscape-coverage-incomplete',
      detail:
        'Landschaftscoverage ist unvollständig und wird von diesem Szenenmodell nicht rekonstruiert.',
    });
  if (!surface)
    unsupported.push({
      code: 'terrain-grid-missing',
      detail:
        'Ohne TerrainGrid oder Oberflächenabtastung können Workplane- und Gebäudeanker nicht aus dem sichtbaren Terrain abgeleitet werden.',
    });
  const verticalExaggeration = terrain?.view.exaggeration ?? 1;
  if (terrain) {
    const { view: v, heights } = terrain;
    validateTerrainView(v);
    if (heights.length !== v.columns * v.rows || !Array.from(heights).every(Number.isFinite))
      throw new Error('TerrainGrid samples are incomplete');
    const layout = terrainGridLayout(v),
      positions: number[] = [],
      indices = new Uint32Array((v.columns - 1) * (v.rows - 1) * 6);
    for (let y = 0; y < v.rows; y++)
      for (let x = 0; x < v.columns; x++) {
        const i = y * v.columns + x,
          p = { x: layout.x.values[x]!, y: layout.y.values[y]! };
        positions.push(...worldPosition(p, heights[i]!));
      }
    let at = 0;
    for (let y = 0; y < v.rows - 1; y++)
      for (let x = 0; x < v.columns - 1; x++) {
        const i = y * v.columns + x;
        indices[at++] = i;
        indices[at++] = i + v.columns;
        indices[at++] = i + 1;
        indices[at++] = i + 1;
        indices[at++] = i + v.columns;
        indices[at++] = i + v.columns + 1;
      }
    addObject(objects, targets, { kind: 'terrain' }, positions, Array.from(indices));
  }
  // A raster response has intentionally dropped vector DTOs; do not invent
  // geometry from a painted image. The terrain mesh above remains usable.
  if (view.region?.coverage.mode !== 'raster' && surface) {
    const frameForScope = (scopeId: string) => {
      const binding = view.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === scopeId);
      const frame = binding && view.region?.frames[binding.id];
      return frame && finite(frame.x, frame.y, frame.angle) ? frame : null;
    };
    const floorElevation = (room: RoomGeometry) =>
      view.geometry.floors.find((f) => f.scopeId === room.scopeId && f.id === room.floorId)
        ?.elevation ??
      view.workspace.floors.find((f) => f.scopeId === room.scopeId && f.id === room.floorId)
        ?.sourceElevation;
    const buildingBases = new Map<string, { scopeId?: string; baseM: number }>();
    for (const city of view.cities) {
      const cityBinding = view.bindings.find(
          (b) => b.kind === 'city' && b.ownerId === city.header.id,
        ),
        cityFrame = cityBinding && view.region?.frames[cityBinding.id];
      if (!cityFrame || !finite(cityFrame.x, cityFrame.y, cityFrame.angle)) {
        if (city.units.some((u) => u.kind === 'building'))
          unsupported.push({
            code: 'city-frame-missing',
            detail: `City ${city.header.id} hat keinen verfügbaren Atlas-Frame.`,
          });
        continue;
      }
      for (const unit of city.units) {
        if (unit.kind !== 'building') continue;
        const interiorScope =
          view.region?.interiors[unit.id] ??
          view.bindings.find((b) => b.parent === 'building' && b.parentId === unit.id)?.ownerId;
        const target: AtlasSceneSelectionTarget = {
          kind: 'building',
          id: unit.id,
          cityId: city.header.id,
          ...(interiorScope ? { scopeId: interiorScope } : {}),
        };
        const terrainBinding = unit.terrain ?? defaultTerrainBuilding();
        try {
          validateTerrainBuilding(terrainBinding);
        } catch (error) {
          unsupported.push({
            code: 'building-height-invalid',
            detail: `Gebäude ${unit.id}: ${(error as Error).message}`,
          });
          continue;
        }
        if (!unit.position || !finite(unit.position.x, unit.position.y)) {
          unsupported.push({
            code: 'building-anchor-missing',
            detail: `Gebäude ${unit.id} hat keinen gültigen Anker.`,
          });
          continue;
        }
        const anchorLocal = unit.position,
          anchor = localToAtlas(anchorLocal, cityFrame);
        const footprint = posedFootprint(unit).map((poly) => ({
          outer: poly.outer.map((p) => localToAtlas(p, cityFrame)),
          holes: poly.holes.map((r) => r.map((p) => localToAtlas(p, cityFrame))),
        }));
        if (
          !footprint.length ||
          footprint.some((p) => !validRing(p.outer) || p.holes.some((h) => !validRing(h)))
        ) {
          unsupported.push({
            code: 'building-footprint-incomplete',
            detail: `Gebäude ${unit.id} besitzt keine vollständige Flächengeometrie.`,
          });
          continue;
        }
        if (
          !surface.contains(anchor) ||
          footprint.some((poly) =>
            [poly.outer, ...poly.holes].some((r) => r.some((p) => !surface.contains(p))),
          )
        ) {
          unsupported.push({
            code: 'building-outside-terrain',
            detail: `Terrain deckt Anker oder Umriss von Gebäude ${unit.id} nicht vollständig ab.`,
          });
          continue;
        }
        const baseM =
          (terrainBinding.mode === 'fixed' ? 0 : surface.heightAt(anchor)) + terrainBinding.offsetM;
        const floorElevations =
          unit.floorElevations ??
          (target.scopeId
            ? view.geometry.floors
                .filter((f) => f.scopeId === target.scopeId)
                .map((f) => f.elevation)
            : []);
        if (!floorElevations.every(Number.isFinite)) {
          unsupported.push({
            code: 'building-floors-invalid',
            detail: `Geschosshöhen von Gebäude ${unit.id} sind ungültig.`,
          });
          continue;
        }
        const topM = baseM + Math.max(0, ...floorElevations) + terrainBinding.wallM,
          roofM = terrainBinding.roofM;
        if (!finite(baseM, topM, roofM) || roofM < 0) {
          unsupported.push({
            code: 'building-height-invalid',
            detail: `Höhenmodell von Gebäude ${unit.id} ist ungültig.`,
          });
          continue;
        }
        if (target.scopeId) buildingBases.set(target.scopeId, { scopeId: target.scopeId, baseM });
        const closed =
          !display ||
          !target.scopeId ||
          (display.roofs && display.metersPerPixel > 0.4 && display.scopeId !== target.scopeId);
        if (!closed) continue;
        const positions: number[] = [],
          indices: number[] = [];
        for (const poly of footprint) {
          const rings = [poly.outer, ...poly.holes];
          const sampledGround = rings.map((r) => r.map((p) => surface.heightAt(p)));
          // Side walls preserve every disconnected component and courtyard edge.
          for (const ring of rings)
            for (let i = 0; i < ring.length; i++) {
              const a = ring[i]!,
                b = ring[(i + 1) % ring.length]!,
                base = positions.length / 3,
                groundA = Math.min(baseM, sampledGround[rings.indexOf(ring)]![i]!),
                groundB = Math.min(
                  baseM,
                  sampledGround[rings.indexOf(ring)]![(i + 1) % ring.length]!,
                );
              positions.push(
                ...worldPosition(a, groundA),
                ...worldPosition(b, groundB),
                ...worldPosition(a, baseM),
                ...worldPosition(b, baseM),
              );
              indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
              const wallBase = positions.length / 3;
              positions.push(
                ...worldPosition(a, baseM),
                ...worldPosition(b, baseM),
                ...worldPosition(a, topM),
                ...worldPosition(b, topM),
              );
              indices.push(
                wallBase,
                wallBase + 1,
                wallBase + 2,
                wallBase + 2,
                wallBase + 1,
                wallBase + 3,
              );
            }
          const points = [poly.outer, ...poly.holes].map((r) =>
              r.map((p) => new Vector2(p.x, p.y)),
            ),
            outer = points[0]!,
            triangles = ShapeUtils.triangulateShape(
              outer.map((p) => p.clone()),
              points.slice(1).map((r) => r.map((p) => p.clone())),
            ),
            flat = points.flat(),
            base = positions.length / 3;
          let convex = points.length === 1,
            sign = 0;
          if (convex)
            for (let i = 0; i < outer.length; i++) {
              const a = outer[i]!,
                b = outer[(i + 1) % outer.length]!,
                c = outer[(i + 2) % outer.length]!,
                cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
              if (Math.abs(cross) < 1e-8) continue;
              if (sign && sign * Math.sign(cross) < 0) {
                convex = false;
                break;
              }
              sign = Math.sign(cross);
            }
          if (roofM > 0 && convex) {
            const centre = {
              x: outer.reduce((sum, p) => sum + p.x, 0) / outer.length,
              y: outer.reduce((sum, p) => sum + p.y, 0) / outer.length,
            };
            for (let i = 0; i < outer.length; i++) {
              const a = outer[i]!,
                b = outer[(i + 1) % outer.length]!,
                triangleBase = positions.length / 3;
              positions.push(
                ...worldPosition({ x: a.x, y: a.y }, topM),
                ...worldPosition({ x: b.x, y: b.y }, topM),
                ...worldPosition(centre, topM + roofM),
              );
              indices.push(triangleBase, triangleBase + 1, triangleBase + 2);
            }
          } else {
            for (const p of flat)
              positions.push(...worldPosition({ x: p.x, y: p.y }, topM + roofM));
            for (const triangle of triangles)
              for (const index of triangle) indices.push(base + index);
            if (roofM > 0)
              for (const ring of rings)
                for (let i = 0; i < ring.length; i++) {
                  const a = ring[i]!,
                    b = ring[(i + 1) % ring.length]!,
                    wallBase = positions.length / 3;
                  positions.push(
                    ...worldPosition(a, topM),
                    ...worldPosition(b, topM),
                    ...worldPosition(a, topM + roofM),
                    ...worldPosition(b, topM + roofM),
                  );
                  indices.push(
                    wallBase,
                    wallBase + 1,
                    wallBase + 2,
                    wallBase + 2,
                    wallBase + 1,
                    wallBase + 3,
                  );
                }
          }
        }
        addObject(objects, targets, target, positions, indices);
      }
    }
    for (const room of view.workspace.rooms) {
      const frame = frameForScope(room.scopeId);
      if (!frame) {
        unsupported.push({
          code: 'room-frame-missing',
          detail: `Raum ${room.id} hat keinen verfügbaren Scope-Frame.`,
        });
        continue;
      }
      if (!room.polygons.length) {
        unsupported.push({
          code: 'room-polygon-missing',
          detail: `Für Raum ${room.id} fehlt die Vektorfläche.`,
        });
        continue;
      }
      const anchor = { x: frame.x, y: frame.y };
      if (!surface.contains(anchor)) {
        unsupported.push({
          code: 'room-anchor-outside-terrain',
          detail: `Terrain deckt den Workplane-Anker von Raum ${room.id} nicht ab.`,
        });
        continue;
      }
      const elevation = floorElevation(room);
      if (elevation === undefined || !Number.isFinite(elevation)) {
        unsupported.push({
          code: 'room-floor-elevation-missing',
          detail: `Für Raum ${room.id} fehlt die kanonische Geschosshöhe.`,
        });
        continue;
      }
      const base = buildingBases.get(room.scopeId)?.baseM ?? surface.heightAt(anchor),
        z = base + elevation,
        positions: number[] = [],
        indices: number[] = [];
      try {
        for (const polygon of room.polygons)
          triangulatePolygon(
            polygon,
            (p) => worldPosition(localToAtlas(p, frame), z),
            positions,
            indices,
          );
      } catch (error) {
        unsupported.push({
          code: 'room-polygon-invalid',
          detail: `Raum ${room.id}: ${(error as Error).message}`,
        });
        continue;
      }
      if (!indices.length) {
        unsupported.push({
          code: 'room-triangulation-empty',
          detail: `Die Raumfläche von ${room.id} konnte nicht trianguliert werden.`,
        });
        continue;
      }
      addObject(
        objects,
        targets,
        { kind: 'room', id: room.id, scopeId: room.scopeId, floorId: room.floorId },
        positions,
        indices,
      );
    }
  }
  return {
    objects,
    targets,
    coverage: {
      complete: unsupported.length === 0,
      supportedKinds: ['terrain', 'room', 'building'],
      unsupported,
    },
    verticalExaggeration,
  };
}
