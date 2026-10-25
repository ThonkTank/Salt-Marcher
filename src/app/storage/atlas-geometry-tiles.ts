import { createHash } from 'node:crypto';
import {
  atlasGeometryTileBox,
  type AtlasGeometryTile,
  type AtlasGeometryTileRequest,
} from '../atlas/atlas-geometry-tile';
import { AtlasGeometryOverviewBuilder } from '../atlas/atlas-geometry-overview';
import {
  buildAtlasCanonicalSceneModel,
  unmodeledDrawingSourcesWarning,
} from '../atlas/atlas-scene-geometry';
import { buildAtlasGeometryMesh } from '../atlas/atlas-geometry-mesh';
import type { AtlasSceneView } from '../atlas/atlas-scene-geometry';
import type { AtlasDeckSceneModel } from '../atlas/atlas-deck-scene-model';
import type { AtlasRegionSource } from '../atlas/atlas-region-contracts';
import type { Point } from '../contracts';
import type { AtlasRegionReader } from './atlas-region';
import { AtlasCacheScope } from './atlas-cache-scope';

// Bump for mesh, sampling or physical-floor semantics, not only SQL schema.
const FORMAT = 'geometry-tiles-v3';
type Sample = { point: Point; heightM: number };
interface StoredOverview {
  shapeVersion: string;
  geometryVersion: string;
  input: string;
  samples: Sample[];
  samplesComplete: boolean;
  model: AtlasDeckSceneModel;
}
interface StoredGeometry {
  shapeVersion: string;
  geometryVersion: string;
  input: string;
  samples: Sample[];
  model: AtlasDeckSceneModel;
}
/** Geometry-only identity: names, labels and author revision counters do not
 * alter triangles. Frames, hidden floors/rooms and anchor data do. */
function inputFingerprint(view: AtlasSceneView): string {
  const input = {
    cities: view.cities.map((c) => ({ id: c.header.id, units: c.units })),
    bindings: view.bindings,
    frames: view.region.frames,
    interiors: view.region.interiors,
    rooms: view.workspace.rooms,
    floors: view.geometry.floors,
    drawing: view.geometry.drawing,
  };
  return createHash('sha256')
    .update(
      JSON.stringify(input, (key, value) =>
        ['name', 'label', 'revision', 'number', 'protected'].includes(key) ? undefined : value,
      ),
    )
    .digest('hex');
}
function sourceCoverage(model: AtlasDeckSceneModel, view: AtlasSceneView): AtlasDeckSceneModel {
  // Broken sources whose bounds cannot be recovered remain an explicit global
  // uncertainty. Updating that warning alone must not retriangulate good tiles.
  const unsupported = model.coverage.unsupported.filter(
    (x) => x.code !== 'region-coverage-incomplete' && x.code !== 'drawing-sources-not-modeled',
  );
  if (view.unmodeledDrawingSources)
    unsupported.push(unmodeledDrawingSourcesWarning(view.unmodeledDrawingSources));
  if (!view.region.coverage.complete)
    unsupported.push({
      code: 'region-coverage-incomplete',
      detail: `Atlasregion meldet ${view.region.coverage.unreadable} nicht lesbare Geometrien.`,
    });
  return {
    ...model,
    coverage: { ...model.coverage, complete: unsupported.length === 0, unsupported },
  };
}
function valid(value: StoredGeometry | undefined): value is StoredGeometry {
  return (
    !!value &&
    typeof value.shapeVersion === 'string' &&
    typeof value.geometryVersion === 'string' &&
    typeof value.input === 'string' &&
    Array.isArray(value.samples) &&
    value.samples.every(
      (s) => s && s.point && [s.point.x, s.point.y, s.heightM].every(Number.isFinite),
    ) &&
    !!value.model &&
    Array.isArray(value.model.objects) &&
    value.model.targets instanceof Map &&
    !!value.model.coverage &&
    value.model.objects.every(
      (o) => o.positions instanceof Float32Array && o.indices instanceof Uint32Array,
    )
  );
}
function validOverview(value: StoredOverview | undefined): value is StoredOverview {
  return (
    valid(value) &&
    typeof value.samplesComplete === 'boolean' &&
    value.model.overviews?.length === 1 &&
    value.model.overviews[0]!.meshes.every(
      (m) => m.positions instanceof Float32Array && m.indices instanceof Uint32Array,
    )
  );
}
function reply(
  source: AtlasRegionSource,
  request: AtlasGeometryTileRequest,
  model: AtlasDeckSceneModel,
  status: AtlasGeometryTile['cache'],
): AtlasGeometryTile {
  const { targets: _, ...dto } = model;
  return {
    tile: { ...request.tile },
    revision: source.revision,
    fence: source.fence,
    cache: status,
    model: dto,
  };
}
/** Persistent clipped meshes, independent of camera pose, floors and roof UI.
 * Tile geometry is derived in the pinned read-only worker snapshot. */
export class AtlasGeometryTiles {
  private readonly cache: AtlasCacheScope;
  constructor(directory?: string) {
    this.cache = new AtlasCacheScope(directory);
  }
  private open(source: AtlasRegionSource) {
    if (!source.geometryVersion) return undefined;
    return this.cache.open(source);
  }
  /** Exact-stamp warm lookup for worker callers that already validated the pinned
   * source. Unlike read(), this never asks the reader to fingerprint source rows. */
  cached(
    source: AtlasRegionSource,
    request: AtlasGeometryTileRequest,
  ): AtlasGeometryTile | undefined {
    atlasGeometryTileBox(request);
    if (source.revision !== request.revision) throw Error('Geometriekachel inzwischen geändert.');
    if (!source.shapeVersion || !source.geometryVersion || source.shadow) return undefined;
    const cache = this.open(source);
    if (!cache) return undefined;
    if (request.tile.lod >= 1) {
      const key = JSON.stringify([
        'geometry-overview',
        request.tile.lod,
        request.tile.x,
        request.tile.y,
      ]);
      const value = cache.get<StoredOverview>(key, 'geometry-overview-v3');
      if (
        !validOverview(value) ||
        value.shapeVersion !== source.shapeVersion ||
        value.geometryVersion !== source.geometryVersion
      )
        return undefined;
      return reply(source, request, value.model, 'hit');
    }
    const key = JSON.stringify(['geometry', request.tile.lod, request.tile.x, request.tile.y]);
    const value = cache.get<StoredGeometry>(key, FORMAT);
    if (
      !valid(value) ||
      value.shapeVersion !== source.shapeVersion ||
      value.geometryVersion !== source.geometryVersion
    )
      return undefined;
    return reply(source, request, value.model, 'hit');
  }
  *read(
    source: AtlasRegionSource,
    request: AtlasGeometryTileRequest,
    reader: AtlasRegionReader,
  ): Generator<void, AtlasGeometryTile> {
    const box = atlasGeometryTileBox(request);
    if (source.revision !== request.revision) throw Error('Geometriekachel inzwischen geändert.');
    if (request.tile.lod >= 1) return yield* this.readOverview(source, request, reader);
    const cache = this.open(source),
      key = JSON.stringify(['geometry', request.tile.lod, request.tile.x, request.tile.y]);
    const previous = cache?.get<StoredGeometry>(key, FORMAT),
      old = valid(previous) ? previous : undefined;
    if (
      old &&
      old.shapeVersion === source.shapeVersion &&
      old.geometryVersion === source.geometryVersion
    )
      return reply(source, request, old.model, 'hit');
    let view: AtlasSceneView | undefined,
      input = old?.input;
    if (!old || old.geometryVersion !== source.geometryVersion) {
      view = reader.geometryTileSource(source, box, true);
      input = inputFingerprint(view);
    }
    yield;
    const samples = new Map<string, Sample>();
    const heightAt = (point: Point) => {
      const key = JSON.stringify([point.x, point.y]);
      let sample = samples.get(key);
      if (!sample) {
        const heightM = reader.geometryHeight(source, point);
        if (!Number.isFinite(heightM)) throw Error('Geometriehöhe ungültig.');
        sample = { point: { ...point }, heightM };
        samples.set(key, sample);
      }
      return sample.heightM;
    };
    if (old && input === old.input) {
      let same = true,
        count = 0;
      for (const sample of old.samples) {
        if (heightAt(sample.point) !== sample.heightM) same = false;
        if (++count % 32 === 0) yield;
      }
      if (same) {
        const model = view ? sourceCoverage(old.model, view) : old.model;
        cache?.put(key, FORMAT, {
          ...old,
          model,
          shapeVersion: source.shapeVersion!,
          geometryVersion: source.geometryVersion!,
        });
        return reply(source, request, model, 'hit');
      }
    }
    view ??= reader.geometryTileSource(source, box, true);
    input ??= inputFingerprint(view);
    // Replayed old samples outside the new topology are not dependencies of it.
    const used = new Map<string, Sample>();
    const model = buildAtlasGeometryMesh(view, request.tile, {
      contains: (p) =>
        [p.x, p.y].every(Number.isFinite) && Math.max(Math.abs(p.x), Math.abs(p.y)) < 1e12,
      heightAt: (p) => {
        const heightM = heightAt(p);
        used.set(JSON.stringify([p.x, p.y]), { point: { ...p }, heightM });
        return heightM;
      },
    });
    if (cache)
      cache.put(key, FORMAT, {
        shapeVersion: source.shapeVersion!,
        geometryVersion: source.geometryVersion!,
        input,
        samples: [...used.values()],
        model,
      } satisfies StoredGeometry);
    return reply(source, request, model, cache ? 'built' : 'disabled');
  }
  /** Coarse geometry is a bounded physical envelope, never a semantic pick
   * mesh. Exact unchanged stamps bypass all source work after worker restart. */
  private *readOverview(
    source: AtlasRegionSource,
    request: AtlasGeometryTileRequest,
    reader: AtlasRegionReader,
  ): Generator<void, AtlasGeometryTile> {
    const box = atlasGeometryTileBox(request),
      cache = this.open(source),
      format = 'geometry-overview-v3';
    const key = JSON.stringify([
      'geometry-overview',
      request.tile.lod,
      request.tile.x,
      request.tile.y,
    ]);
    const previous = cache?.get<StoredOverview>(key, format);
    const old = validOverview(previous) ? previous : undefined;
    if (
      old &&
      old.shapeVersion === source.shapeVersion &&
      old.geometryVersion === source.geometryVersion
    )
      return reply(source, request, old.model, 'hit');
    let input: string | undefined,
      unreadable = 0,
      unsupportedElements = 0,
      nextYield = performance.now() + 8;
    const sourceInput = function* (
      build?: (
        chunk: ReturnType<AtlasRegionReader['geometryTileSourceBatches']> extends Generator<infer T>
          ? T
          : never,
      ) => void,
    ): Generator<void, string> {
      const hash = createHash('sha256');
      unsupportedElements = 0;
      unreadable = 0;
      for (const chunk of reader.geometryTileSourceBatches(source, box)) {
        hash
          .update(chunk.anchorBuildings ? 'anchor' : 'visible')
          .update(inputFingerprint(chunk.view));
        unsupportedElements += chunk.unsupportedElements;
        unreadable = chunk.view.region.coverage.unreadable;
        build?.(chunk);
        if (performance.now() >= nextYield) {
          yield;
          nextYield = performance.now() + 8;
        }
      }
      return hash.digest('hex');
    };
    const unsupportedWarning = () => unmodeledDrawingSourcesWarning(unsupportedElements);
    // Bounded dependency retention. Exceptionally large anchor sets still render
    // completely and hit unchanged stamps; after edits they rebuild conservatively.
    const limit = 32768,
      heights = new Map<string, Sample>(),
      used = new Map<string, Sample>();
    let samplesComplete = true;
    const heightAt = (point: Point) => {
      const address = JSON.stringify([point.x, point.y]);
      let sample = heights.get(address);
      if (!sample) {
        const heightM = reader.geometryHeight(source, point);
        if (!Number.isFinite(heightM)) throw Error('Geometriehöhe ungültig.');
        sample = { point: { ...point }, heightM };
        heights.set(address, sample);
        if (heights.size > limit) heights.delete(heights.keys().next().value!);
      }
      return sample;
    };
    if (old) {
      input = yield* sourceInput();
      if (input === old.input && old.samplesComplete) {
        let same = true;
        for (const sample of old.samples) {
          if (heightAt(sample.point).heightM !== sample.heightM) same = false;
          if (performance.now() >= nextYield) {
            yield;
            nextYield = performance.now() + 8;
          }
        }
        if (same) {
          const model = {
            ...old.model,
            coverage: {
              ...old.model.coverage,
              unsupported: old.model.coverage.unsupported.filter(
                (w) =>
                  w.code !== 'region-coverage-incomplete' &&
                  w.code !== 'drawing-sources-not-modeled',
              ),
            },
          };
          if (unsupportedElements) model.coverage.unsupported.push(unsupportedWarning());
          if (unreadable)
            model.coverage.unsupported.push({
              code: 'region-coverage-incomplete',
              detail: `Atlasregion meldet ${unreadable} nicht lesbare Geometrien.`,
            });
          cache?.put(key, format, {
            ...old,
            model,
            shapeVersion: source.shapeVersion!,
            geometryVersion: source.geometryVersion!,
          });
          return reply(source, request, model, 'hit');
        }
      }
    }
    const builder = new AtlasGeometryOverviewBuilder(request.tile),
      warnings = new Map<string, { detail: string; count: number }>();
    input = yield* sourceInput((chunk) => {
      const canonical = buildAtlasCanonicalSceneModel({
        view: chunk.view,
        terrain: null,
        surface: {
          contains: (p) =>
            [p.x, p.y].every(Number.isFinite) && Math.max(Math.abs(p.x), Math.abs(p.y)) < 1e12,
          heightAt: (p) => {
            const sample = heightAt(p);
            if (used.size < limit) used.set(JSON.stringify([p.x, p.y]), sample);
            else if (!used.has(JSON.stringify([p.x, p.y]))) samplesComplete = false;
            return sample.heightM;
          },
        },
      });
      for (const object of canonical.objects)
        if (!chunk.anchorBuildings || object.target.kind !== 'building') builder.append(object);
      for (const warning of canonical.coverage.unsupported) {
        if (warning.code === 'region-coverage-incomplete') continue;
        const previous = warnings.get(warning.code);
        warnings.set(warning.code, {
          detail: previous?.detail ?? warning.detail,
          count: (previous?.count ?? 0) + 1,
        });
      }
    });
    const overview = builder.finish(),
      unsupported = [
        {
          code: 'geometry-overview',
          detail: `Vereinfachte Höhenhülle mit ${overview.resolution}-m-Abtastung und adaptiv zusammengefassten Zellen; Auswahl und einzelne Geschosse benötigen Detailgeometrie.`,
        },
        ...[...warnings].map(([code, w]) => ({
          code,
          detail: `${w.detail} (${w.count} Quellenabschnitte)`,
        })),
      ];
    if (unsupportedElements) unsupported.push(unsupportedWarning());
    if (unreadable)
      unsupported.push({
        code: 'region-coverage-incomplete',
        detail: `Atlasregion meldet ${unreadable} nicht lesbare Geometrien.`,
      });
    const model: AtlasDeckSceneModel = {
      objects: [],
      targets: new Map(),
      overviews: [overview],
      coverage: { complete: false, supportedKinds: ['room', 'building'], unsupported },
      verticalExaggeration: 1,
    };
    if (cache)
      cache.put(key, format, {
        shapeVersion: source.shapeVersion!,
        geometryVersion: source.geometryVersion!,
        input,
        samples: [...used.values()],
        samplesComplete,
        model,
      } satisfies StoredOverview);
    return reply(source, request, model, cache ? 'built' : 'disabled');
  }
  close() {
    this.cache.close();
  }
}
