import { ATLAS_UNLIT_MATERIAL } from './atlas-deck-material';
import { Ray, Vector3, Triangle } from 'three';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { AtlasPublicForestLayer } from './atlas-public-forest-layer';
import { cartographicPhase } from './atlas-cartographic-style';
import { COORDINATE_SYSTEM, type Layer } from '@deck.gl/core';
import { atlasDrawingGeometry, type AtlasDrawingMesh } from './atlas-drawing-geometry';
import type { AtlasCanvasScene, PaintHit } from './atlas-canvas-scene';
import type { AtlasSpatialSurface } from './atlas-spatial-surface';
import type { AtlasMetricFrame } from './atlas-metric-camera';
import type { Point } from './contracts';

/** Deck receives the same local buffers used by exact author hit testing. */
export class AtlasDeckDrawing {
  private entries: AtlasDrawingMesh[];
  private batches: ReturnType<typeof drawingBatches>;
  constructor(
    source: AtlasCanvasScene,
    origin: Point,
    images: ReadonlyMap<string, CanvasImageSource>,
    private surface: AtlasSpatialSurface & { closedObjectIds?: ReadonlySet<string> },
    objects: readonly AtlasDrawingMesh[] = [],
  ) {
    this.entries = atlasDrawingGeometry(source, origin, images, surface);
    this.entries.push(...objects);
    this.batches = drawingBatches(this.entries);
  }
  layers(frame: AtlasMetricFrame, prefix: string, styleScale = 1): Layer[] {
    const o = this.surface.origin;
    return this.batches.map((batch, i) => {
      const { entry: e, mesh, data } = batch;
      if (e.billboard) {
        const key = [frame.camera.rotation, frame.camera.tilt, frame.camera.exaggeration].join('/');
        if (key !== batch.key) {
          batch.key = key;
          batch.oriented = {
            ...mesh,
            attributes: {
              ...mesh.attributes,
              POSITION: { size: 3, value: billboardPositions(e, frame) },
            },
          };
        }
      }
      const MeshLayer = e.publicForestScale ? AtlasPublicForestLayer : SimpleMeshLayer;
      return new MeshLayer({
        id: `atlas-drawing:${prefix}:${i}`,
        data,
        mesh: batch.oriented ?? mesh,
        forestOrigin: [
          cartographicPhase(o.x * (e.publicForestScale ?? 1)),
          cartographicPhase(o.y * (e.publicForestScale ?? 1)),
        ],
        forestScale: e.publicForestScale ?? 1,
        forestPixelRatio:
          styleScale * (prefix === 'output' ? 1 : (globalThis.devicePixelRatio ?? 1)),
        ...(e.texture ? { texture: e.texture as HTMLCanvasElement } : {}),
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPosition: [
          o.x - frame.origin.x,
          o.y - frame.origin.y,
          (this.surface.focusM - frame.origin.z) * frame.camera.exaggeration,
        ],
        getScale: [1, 1, frame.camera.exaggeration],
        getColor: e.color,
        material: ATLAS_UNLIT_MATERIAL,
        pickable: false,
        updateTriggers: {
          getPosition: [frame.origin.x, frame.origin.y, frame.origin.z, frame.camera.exaggeration],
          getScale: frame.camera.exaggeration,
        },
        getPolygonOffset: () => [-1, -1],
        parameters: {
          depthWriteEnabled: !!e.solid,
          depthCompare: e.billboard ? 'always' : 'less-equal',
          cullMode: 'none',
        },
      });
    });
  }
  hit(
    frame: AtlasMetricFrame,
    pixel: Point,
    keys: string[],
    terrainDistance = Infinity,
  ): PaintHit | null {
    const segment = frame.ray(pixel);
    if (!segment) return null;
    const local = (p: readonly number[]) =>
      new Vector3(
        p[0]! - this.surface.origin.x,
        p[1]! - this.surface.origin.y,
        p[2]! - this.surface.focusM,
      );
    const a = local(segment[0]),
      direction = local(segment[1]).sub(a).normalize(),
      ray = new Ray(a, direction);
    const v0 = new Vector3(),
      v1 = new Vector3(),
      v2 = new Vector3(),
      point = new Vector3();
    let objectHit: { target: Record<string, string>; distance: number } | undefined;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i]!,
        owner =
          e.target && keys.includes('atlasObject')
            ? { data: e.target }
            : e.command?.pointer
              ? e.command.ancestry.find((n) => keys.some((k) => n.data[k] !== undefined))
              : undefined;
      if (!owner) continue;
      for (let t = 0; t < e.indices.length; t += 3) {
        const positions = e.billboard ? billboardPositions(e, frame) : e.positions;
        v0.fromArray(positions, e.indices[t]! * 3);
        v1.fromArray(positions, e.indices[t + 1]! * 3);
        v2.fromArray(positions, e.indices[t + 2]! * 3);
        if (!ray.intersectTriangle(v0, v1, v2, false, point)) continue;
        if (e.hitAlpha && e.uv) {
          const bary = Triangle.getBarycoord(point, v0, v1, v2, new Vector3());
          if (!bary) continue;
          const uv = [0, 1].map((axis) =>
            [bary.x, bary.y, bary.z].reduce(
              (sum, weight, j) => sum + weight * e.uv![e.indices[t + j]! * 2 + axis]!,
              0,
            ),
          );
          const { pixels, width, height } = e.hitAlpha,
            x = Math.max(0, Math.min(width - 1, Math.floor(uv[0]! * width))),
            y = Math.max(0, Math.min(height - 1, Math.floor(uv[1]! * height)));
          if (pixels[(y * width + x) * 4 + 3] === 0) continue;
        }
        const distance = a.distanceTo(point);
        if (distance > terrainDistance + Math.max(1e-6, terrainDistance * 1e-5)) continue;
        if (e.target) {
          if (!objectHit || distance < objectHit.distance)
            objectHit = { target: e.target, distance };
        } else if (!objectHit || distance <= objectHit.distance + 1e-6) return owner;
      }
    }
    return objectHit ? { data: objectHit.target } : null;
  }
  dispose() {
    this.entries = [];
    this.batches = [];
  }
}

/** Only adjacent untextured commands can be coalesced without changing painter order. */
function drawingBatches(entries: AtlasDrawingMesh[]) {
  const groups: AtlasDrawingMesh[][] = [];
  for (const entry of entries) {
    const group = groups.at(-1),
      last = group?.[0];
    if (
      last &&
      !last.texture &&
      !entry.texture &&
      !last.colors &&
      !entry.colors &&
      last.publicForestScale === entry.publicForestScale &&
      last.solid === entry.solid &&
      last.color.every((v, i) => v === entry.color[i])
    )
      group!.push(entry);
    else groups.push([entry]);
  }
  return groups.map((group) => {
    let entry = group[0]!;
    if (group.length > 1) {
      const positions = new Float32Array(group.reduce((n, e) => n + e.positions.length, 0)),
        indices = new Uint32Array(group.reduce((n, e) => n + e.indices.length, 0));
      let vertex = 0,
        index = 0;
      for (const e of group) {
        positions.set(e.positions, vertex);
        for (const i of e.indices) indices[index++] = i + vertex / 3;
        vertex += e.positions.length;
      }
      entry = { ...entry, positions, indices, uv: undefined };
    }
    return {
      entry,
      data: [entry],
      key: '',
      oriented: undefined as
        | {
            attributes: Record<string, { size: number; value: Float32Array }>;
            indices: { size: number; value: Uint32Array };
          }
        | undefined,
      mesh: {
        attributes: {
          POSITION: { size: 3, value: entry.positions },
          ...(entry.colors ? { COLOR_0: { size: 3, value: entry.colors } } : {}),
          ...(entry.uv ? { TEXCOORD_0: { size: 2, value: entry.uv } } : {}),
        },
        indices: { size: 1, value: entry.indices },
      },
    };
  });
}

/** Camera-facing glyphs retain their metric size and canonical anchor at every tilt. */
function billboardPositions(entry: AtlasDrawingMesh, frame: AtlasMetricFrame) {
  const { anchor, offsets } = entry.billboard!,
    r = (frame.camera.rotation * Math.PI) / 180,
    t = (frame.camera.tilt * Math.PI) / 180;
  const right = [Math.cos(r), -Math.sin(r), 0],
    down = [
      Math.sin(r) * Math.cos(t),
      Math.cos(r) * Math.cos(t),
      -Math.sin(t) / frame.camera.exaggeration,
    ];
  const positions = new Float32Array(offsets.length);
  for (let i = 0; i < offsets.length; i += 3)
    for (let a = 0; a < 3; a++)
      positions[i + a] = anchor[a]! + offsets[i]! * right[a]! + offsets[i + 1]! * down[a]!;
  return positions;
}
