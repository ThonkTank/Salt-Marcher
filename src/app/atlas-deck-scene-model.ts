import {
  buildAtlasCanonicalSceneModel,
  type AtlasSceneSelectionTarget,
  type AtlasCanonicalSceneObject,
  type AtlasCanonicalSceneModel,
} from './atlas-scene-geometry';
import type { AtlasSceneView } from './atlas-scene-geometry';
import type { TerrainGrid } from './terrain-spatial-model';
import type { AtlasGeometryOverview } from './atlas-geometry-overview';

const ORIGIN_STEP_M = 256;
const FLOAT32_MAX = 3.4028234663852886e38;
export type AtlasDeckSelectionTarget = AtlasSceneSelectionTarget;

export interface AtlasDeckSceneObject {
  /** Stable semantic identity shared by rendering, picking and author routing. */
  readonly id: string;
  readonly target: AtlasDeckSelectionTarget;
  /** Canonical metre origin snapped near this object's own bounds. */
  readonly origin: Readonly<{ x: number; y: number; heightM: number }>;
  /** Immutable snapshot buffers, in local physical metres relative to origin. */
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}
export interface AtlasDeckSceneModel {
  readonly objects: readonly AtlasDeckSceneObject[];
  /** Coarse visual-only geometry. These meshes do not create selection targets. */
  readonly overviews?: readonly AtlasGeometryOverview[];
  readonly targets: ReadonlyMap<string, AtlasSceneSelectionTarget>;
  readonly coverage: Readonly<{
    complete: boolean;
    supportedKinds: AtlasCanonicalSceneModel['coverage']['supportedKinds'];
    unsupported: readonly Readonly<AtlasCanonicalSceneModel['coverage']['unsupported'][number]>[];
  }>;
  /** Renderer transforms local vertical offsets; model buffers stay physical. */
  readonly verticalExaggeration: number;
}
export interface BuildAtlasDeckSceneModelOptions {
  view: AtlasSceneView;
  terrain: TerrainGrid | null;
  display?: { metersPerPixel: number; roofs: boolean; scopeId: string | null };
}

function snap256(value: number): number {
  const snapped = Math.round(value / ORIGIN_STEP_M) * ORIGIN_STEP_M;
  if (!Number.isFinite(snapped))
    throw new Error('Atlas Deck local origin cannot be snapped to 256 metres');
  return snapped;
}

export function localizeAtlasCanonicalSceneObject(
  object: AtlasCanonicalSceneObject,
): AtlasDeckSceneObject {
  if (
    object.positions.length === 0 ||
    object.positions.length % 3 !== 0 ||
    object.indices.length % 3 !== 0
  )
    throw new Error(`Atlas Deck mesh ${object.id} has incomplete geometry`);
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < object.positions.length; i += 3) {
    const x = object.positions[i]!,
      y = object.positions[i + 1]!,
      z = object.positions[i + 2]!;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
      throw new Error(`Atlas Deck mesh ${object.id} contains non-finite world coordinates`);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const origin = Object.freeze({
    x: snap256(minX / 2 + maxX / 2),
    y: snap256(minY / 2 + maxY / 2),
    heightM: snap256(minZ / 2 + maxZ / 2),
  });
  const positions = new Float32Array(object.positions.length);
  for (let i = 0; i < object.positions.length; i += 3) {
    const localX = object.positions[i]! - origin.x,
      localY = object.positions[i + 1]! - origin.y,
      localZ = object.positions[i + 2]! - origin.heightM;
    if (
      !Number.isFinite(localX) ||
      !Number.isFinite(localY) ||
      !Number.isFinite(localZ) ||
      Math.max(Math.abs(localX), Math.abs(localY), Math.abs(localZ)) > FLOAT32_MAX
    )
      throw new Error(`Atlas Deck mesh ${object.id} exceeds local Float32 coordinates`);
    const fx = Math.fround(localX),
      fy = Math.fround(localY),
      fz = Math.fround(localZ);
    if ((localX !== 0 && fx === 0) || (localY !== 0 && fy === 0) || (localZ !== 0 && fz === 0))
      throw new Error(`Atlas Deck mesh ${object.id} underflows local Float32 coordinates`);
    positions[i] = fx;
    positions[i + 1] = fy;
    positions[i + 2] = fz;
  }
  for (const index of object.indices)
    if (index >= object.positions.length / 3)
      throw new Error(`Atlas Deck mesh ${object.id} has an invalid index`);
  return Object.freeze({
    id: object.id,
    target: object.target,
    origin,
    positions,
    indices: object.indices,
  });
}

/** Builds canonical terrain, room and building geometry without a MapLibre
 * root. World-space doubles are localized per mesh before Float32 upload. */
export function buildAtlasDeckSceneModel(
  options: BuildAtlasDeckSceneModelOptions,
): AtlasDeckSceneModel {
  const canonical = buildAtlasCanonicalSceneModel(options);
  const objects = canonical.objects.map(localizeAtlasCanonicalSceneObject);
  return Object.freeze({
    objects: Object.freeze(objects),
    targets: canonical.targets,
    coverage: Object.freeze({
      complete: canonical.coverage.complete,
      supportedKinds: canonical.coverage.supportedKinds,
      unsupported: Object.freeze(
        canonical.coverage.unsupported.map((item) => Object.freeze({ ...item })),
      ),
    }),
    verticalExaggeration: canonical.verticalExaggeration,
  });
}
