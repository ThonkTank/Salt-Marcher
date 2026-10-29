import type { HeightStroke } from './terrain-brush-contracts';
import { coupleRouteEdits } from './terrain-route-planner';
import type { LakeStroke } from './landscape-action-contracts';
import type { LandscapeRecord, LakeBed } from './landscape-contracts';
import {
  brushFootprint,
  intersectPolygons,
  subtractPolygons,
  unionPolygons,
} from './landscape-brush';
import { contains } from './landscape-geometry';
import { prepareLakeScatter } from './terrain-lake-scatter';
import { strokeBox } from './land-mask';
import { terrainGrid, terrainVisibility } from './terrain-spatial-model';
import type { TerrainGrid } from './terrain-grid-contracts';
import {
  applyTerrainBrush,
  heightBrushPixel,
  prepareHeightBrush,
  validateHeightStroke,
} from './terrain-brush';
import { decodeHeights, editHeight, encodeHeights, TerrainSampler } from './terrain-height';

export interface LakeBrushChanges {
  records: LandscapeRecord[];
  remove: string[];
}
export const lakeHeightStroke = (s: LakeStroke): HeightStroke => ({
  mode: 'lower',
  radius: s.radius,
  strength: s.strength,
  feather: s.feather,
  samples: s.samples,
  visibility: s.visibility,
  screenInput: s.screenInput,
});
/** Author bounds, independent of the camera. The source reader additionally
 * includes each existing tile's own Hermite support. */
export function lakeBrushSourceBounds(s: Pick<LakeStroke, 'samples' | 'radius'>) {
  const area = strokeBox(s),
    pad = 3 * heightBrushPixel(s.radius);
  return {
    x: area.x - pad,
    y: area.y - pad,
    width: area.width + 2 * pad,
    height: area.height + 2 * pad,
  };
}
export function validateLakeStroke(s: LakeStroke) {
  if (
    !s ||
    !['dig', 'erase', 'scatter'].includes(s.mode) ||
    typeof s.id !== 'string' ||
    !s.id ||
    s.id.length > 128 ||
    (s.waterLevelM === null
      ? s.mode !== 'scatter'
      : !Number.isFinite(s.waterLevelM) || Math.abs(s.waterLevelM) > 1e6) ||
    (s.mode === 'scatter' &&
      (!Number.isFinite(s.noise) ||
        s.noise < 0 ||
        s.noise > 1 ||
        !Number.isInteger(s.seed) ||
        s.seed < 0 ||
        s.seed > 0xffffffff)) ||
    Object.keys(s).some(
      (k) =>
        ![
          'mode',
          'id',
          'radius',
          'strength',
          'feather',
          'waterLevelM',
          'samples',
          'visibility',
          'screenInput',
          ...(s.mode === 'scatter' ? ['noise', 'seed'] : []),
        ].includes(k),
    )
  )
    throw Error('Seebeckenpinsel prüfen.');
  validateHeightStroke(lakeHeightStroke(s));
}
export function validateLakeBed(r: LandscapeRecord) {
  if (!r.lakeBed) return;
  if (r.surface !== 'freshwater' || !Array.isArray(r.lakeBed) || r.lakeBed.length > 256)
    throw Error('Seeabtrag prüfen.');
  const seen = new Set<string>();
  for (const bed of r.lakeBed) {
    if (
      !bed ||
      typeof bed.tileId !== 'string' ||
      !bed.tileId ||
      seen.has(bed.tileId) ||
      bed.tile.version !== 2
    )
      throw Error('Seeabtragskachel prüfen.');
    seen.add(bed.tileId);
    for (const value of decodeHeights(bed.tile))
      if (!Number.isFinite(value) || value > 0) throw Error('Seeabtragswert prüfen.');
  }
}
/** The water level is picked once, before any excavation, including over a dry authored lake. */
export function lakeBrushLevel(records: LandscapeRecord[], point: { x: number; y: number }) {
  const lakes = records.filter((r) => r.surface === 'freshwater' && contains(point, r.polygons));
  return lakes.length
    ? Math.max(...lakes.map((r) => r.waterLevelM ?? 1))
    : new TerrainSampler(records).sample(point).heightM;
}
export function mergeLakeBrush(records: LandscapeRecord[], changes: LakeBrushChanges) {
  const removed = new Set([...changes.remove, ...changes.records.map((r) => r.id)]);
  return [...records.filter((r) => !removed.has(r.id)), ...changes.records];
}
/** Immutable gesture source; shared by immediate draft and canonical worker. */
export function applyLakeBrush(
  records: LandscapeRecord[],
  s: LakeStroke,
  visibility?: TerrainGrid,
  prepared?: ReturnType<typeof prepareHeightBrush>,
): LakeBrushChanges {
  validateLakeStroke(s);
  if (s.screenInput && !visibility) throw Error('Gebundene Geländeoberfläche fehlt. Erneut laden.');
  const grid = s.visibility ? (visibility ?? terrainGrid(records, s.visibility)) : undefined,
    plan = prepared ?? (s.screenInput ? prepareHeightBrush(lakeHeightStroke(s), grid) : undefined),
    footprint =
      s.mode === 'scatter'
        ? []
        : plan
          ? plan.centrelines.reduce<import('../shared/contracts').Polygon[]>(
              (all, line) => unionPolygons(all, brushFootprint(line, s.radius)),
              [],
            )
          : brushFootprint(s.samples, s.radius),
    changes = new Map<string, LandscapeRecord>(),
    remove: string[] = [];
  if (s.mode === 'scatter') {
    const scatter = prepareLakeScatter(s, grid, plan),
      box = strokeBox({ ...s, samples: scatter.samples }),
      pixel = heightBrushPixel(s.radius),
      visible = grid ? terrainVisibility(grid, s.screenInput ? 'clip' : 'reject') : undefined,
      ownership = new Map<string, Map<number, Float32Array>>();
    const edited = editHeight(
      records,
      box,
      pixel,
      (p, prior) => {
        if (visible && !visible(p)) return undefined;
        const { owner, profile } = scatter.owner(p);
        if (owner < 0) return undefined;
        const amount = s.strength * scatter.dose(p) * profile;
        return amount ? prior - amount : undefined;
      },
      2,
      scatter.tiles,
    );
    for (const r of edited) {
      const t = r.height!,
        before = records.find((old) => old.id === r.id)?.height,
        prior = before ? decodeHeights(before) : undefined,
        after = decodeHeights(t),
        beds = new Map<number, Float32Array>();
      for (let i = 0; i < after.length; i++) {
        const delta = Number.isNaN(after[i])
          ? 0
          : after[i]! - (prior && !Number.isNaN(prior[i]) ? prior[i]! : 0);
        if (!delta) continue;
        const p = { x: t.x + (i % 64) * pixel, y: t.y + Math.floor(i / 64) * pixel },
          owner = scatter.owner(p).owner;
        if (owner < 0) throw Error('Seeabtrag ohne Beckenbesitzer.');
        let bed = beds.get(owner);
        if (!bed) beds.set(owner, (bed = new Float32Array(4096)));
        bed[i] = delta;
      }
      ownership.set(r.id, beds);
      changes.set(r.id, r);
    }
    for (let i = 0; i < scatter.basins.length; i++) {
      const basin = scatter.basins[i]!,
        id = `${s.id}:${basin.key}`,
        bed: LakeBed[] = [];
      for (const r of edited) {
        const amounts = ownership.get(r.id)!.get(i);
        if (amounts)
          bed.push({ tileId: r.id, tile: { ...r.height!, data: encodeHeights(amounts) } });
      }
      if (!bed.length) continue;
      if (records.some((r) => r.id === id)) throw Error('Seezugkennung bereits gespeichert.');
      changes.set(id, {
        id,
        revision: 0,
        kind: 'patch',
        name: 'See',
        points: [],
        polygons: basin.polygons,
        resolution: pixel,
        width: 0,
        values: {},
        surface: 'freshwater',
        waterLevelM: s.waterLevelM ?? lakeBrushLevel(records, basin.anchor),
        lakeBed: bed,
      });
    }
  } else if (s.mode === 'dig') {
    const stroke = lakeHeightStroke(s),
      edited = applyTerrainBrush(records, stroke, undefined, visibility, undefined, true, plan),
      bed: LakeBed[] = [];
    for (const r of edited) {
      const t = r.height!,
        previous = records.find((old) => old.id === r.id),
        before = previous?.height ? decodeHeights(previous.height) : null,
        after = decodeHeights(t).slice(),
        amounts = new Float32Array(4096);
      for (let i = 0; i < amounts.length; i++) {
        const prior = before?.[i];
        const p = { x: t.x + (i % 64) * t.pixel, y: t.y + Math.floor(i / 64) * t.pixel };
        if (!contains(p, footprint)) after[i] = prior ?? NaN;
        amounts[i] = Number.isNaN(after[i])
          ? 0
          : after[i]! - (prior === undefined || Number.isNaN(prior) ? 0 : prior);
      }
      if (!amounts.some((v) => v !== 0)) continue;
      bed.push({ tileId: r.id, tile: { ...t, data: encodeHeights(amounts) } });
      changes.set(r.id, { ...r, height: { ...t, data: encodeHeights(after) } });
    }
    if (bed.length) {
      if (records.some((r) => r.id === s.id)) throw Error('Seezugkennung bereits gespeichert.');
      changes.set(s.id, {
        id: s.id,
        revision: 0,
        kind: 'patch',
        name: 'See',
        points: [],
        polygons: footprint,
        resolution: s.radius / 32,
        width: 0,
        values: {},
        surface: 'freshwater',
        waterLevelM: s.waterLevelM,
        lakeBed: bed,
      });
    }
  } else {
    const heights = new Map<string, Float32Array>();
    for (const lake of records) {
      if (lake.surface !== 'freshwater' || !intersectPolygons(lake.polygons, footprint).length)
        continue;
      validateLakeBed(lake);
      const bed: LakeBed[] = [];
      for (const origin of lake.lakeBed ?? []) {
        const t = origin.tile,
          amounts = decodeHeights(t).slice();
        let dirty = false;
        for (let i = 0; i < amounts.length; i++) {
          if (amounts[i] === 0) continue;
          const p = { x: t.x + (i % 64) * t.pixel, y: t.y + Math.floor(i / 64) * t.pixel };
          if (!contains(p, footprint)) continue;
          let tile = changes.get(origin.tileId) ?? records.find((r) => r.id === origin.tileId);
          if (
            !tile?.height ||
            tile.height.version !== 2 ||
            tile.height.x !== t.x ||
            tile.height.y !== t.y ||
            tile.height.pixel !== t.pixel
          )
            throw Error('Zugeordnete Seehöhe fehlt. Ausschnitt erneut laden.');
          let values = heights.get(tile.id);
          if (!values) heights.set(tile.id, (values = decodeHeights(tile.height).slice()));
          values[i] = (Number.isNaN(values[i]) ? 0 : values[i]!) - amounts[i]!;
          changes.set(tile.id, tile);
          amounts[i] = 0;
          dirty = true;
        }
        if (amounts.some((v) => v !== 0))
          bed.push(dirty ? { ...origin, tile: { ...t, data: encodeHeights(amounts) } } : origin);
      }
      // Water and ownership shrink in the same operation. The footprint is an
      // explicit author boundary; the sampler still clips wetness against ground.
      const polygons = subtractPolygons(lake.polygons, footprint);
      if (polygons.length || bed.length)
        changes.set(lake.id, { ...lake, polygons, ...(lake.lakeBed ? { lakeBed: bed } : {}) });
      else remove.push(lake.id);
    }
    for (const [id, values] of heights) {
      const r = changes.get(id)!;
      changes.set(id, { ...r, height: { ...r.height!, data: encodeHeights(values) } });
    }
  }
  // Empty additive bands have no authored effect. Retain a zero tile only
  // while another lake still owns a contribution there (independent terrain
  // could currently cancel it). This also releases newly dug tiles on full erase.
  if (s.mode === 'erase') {
    const retained = mergeLakeBrush(records, { records: [...changes.values()], remove });
    const owned = new Set(retained.flatMap((r) => r.lakeBed?.map((b) => b.tileId) ?? []));
    for (const [id, r] of changes)
      if (
        r.height?.version === 2 &&
        !owned.has(id) &&
        decodeHeights(r.height).every((v) => Number.isNaN(v) || v === 0)
      ) {
        changes.delete(id);
        remove.push(id);
      }
  }
  const result = [...changes.values()];
  return {
    records: coupleRouteEdits(
      records.filter((r) => !remove.includes(r.id)),
      result,
      () => {
        throw Error(
          'Seebecken würde einen geschützten Verlauf verletzen. Kleineren Bereich bearbeiten.',
        );
      },
    ),
    remove,
  };
}
