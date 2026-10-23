import {COORDINATE_SYSTEM, type Color, type PickingInfo} from '@deck.gl/core';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import type {AtlasMapLibreBridge} from './atlas-maplibre-bridge';
import type {AtlasMapLibreSceneModel, AtlasMapLibreSceneObject, AtlasMapLibreSelectionTarget} from './atlas-maplibre-scene-model';
import {ensureAtlasPickingDepth} from './atlas-maplibre-picking';
import {refineAtlasMapLibreRayHit, type AtlasMapLibreRayQuery} from './atlas-maplibre-ray';

export interface AtlasMapLibreSceneHit {
  id: string;
  target: AtlasMapLibreSelectionTarget;
  /** Exact shared-camera ray intersection with the selected mesh, in canonical
   * metres. Null when the requested subpixel misses that GPU-selected mesh. */
  point: {x: number; y: number; heightM: number} | null;
}

const colors: Record<AtlasMapLibreSelectionTarget['kind'], Color> = {
  terrain: [112, 142, 94, 255], building: [180, 125, 82, 255], room: [213, 180, 117, 255]
};

/** M1 uses a mesh per semantic object. Spatial batching and material styling are
 * separate M4/M5 work; camera movement never rebuilds these meshes. */
export function atlasMapLibreSceneLayers(model: AtlasMapLibreSceneModel): SimpleMeshLayer<AtlasMapLibreSceneObject>[] {
  return model.objects.map(object => new SimpleMeshLayer<AtlasMapLibreSceneObject>({
    id: `atlas-scene:${object.id}`,
    data: [object],
    mesh: {attributes: {POSITION: {size: 3, value: object.positions}},
      indices: {size: 1, value: object.indices}},
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getPosition: [0, 0, 0],
    getColor: colors[object.target.kind],
    material: false,
    pickable: '3d',
    // Deck's default -layerIndex*100 depth bias orders flat map overlays. It
    // would pull a buried room through terrain in this physical 3D scene.
    getPolygonOffset: () => [0, 0],
    // Picking must include the same opaque terrain as rendering; otherwise a
    // room behind a hill becomes selectable through the ground.
    parameters: {depthWriteEnabled: true, depthCompare: 'less-equal', cullMode: 'none'}
  }));
}

/** Reject picks from other layer groups or an older scene snapshot. */
export function atlasMapLibreSceneHit(model: AtlasMapLibreSceneModel, info: PickingInfo | null,
  ray?: Pick<AtlasMapLibreRayQuery, 'frame' | 'viewport' | 'pixel'>): AtlasMapLibreSceneHit | null {
  if (!info?.picked || info.index !== 0) return null;
  const object = info.object as AtlasMapLibreSceneObject | undefined;
  if (!object || !model.objects.includes(object) || info.layer?.id !== `atlas-scene:${object.id}`) return null;
  const target = model.targets.get(object.id);
  if (!target || target !== object.target) return null;
  // GPU depth identifies visibility but its quantized position is too coarse
  // for room authoring. Never substitute that approximation for a missing ray.
  const point = ray ? refineAtlasMapLibreRayHit({...ray, object, root: model.root,
    sceneOrigin: model.sceneOrigin, verticalOriginM: model.verticalOriginM,
    verticalExaggeration: model.verticalExaggeration})?.point ?? null : null;
  return {id: object.id, target, point};
}

/** Owns the canonical scene snapshot and its Deck layers on one attached bridge.
 * Bridge lifetime belongs to the caller, which must dispose it before map.remove(). */
export class AtlasMapLibreScene {
  private model: AtlasMapLibreSceneModel | null = null;
  private disposed = false;

  constructor(private readonly bridge: AtlasMapLibreBridge) {}

  update(model: AtlasMapLibreSceneModel): void {
    if (this.disposed) throw new Error('Atlas scene disposed');
    if (model.root.x !== this.bridge.root.x || model.root.y !== this.bridge.root.y || model.root.size !== this.bridge.root.size ||
      model.sceneOrigin.x !== this.bridge.sceneOrigin.x || model.sceneOrigin.y !== this.bridge.sceneOrigin.y)
      throw new Error('Atlas scene and map bridge use different coordinate domains');
    if (model === this.model) return;
    if (!this.bridge.overlay) throw new Error('Atlas scene requires an attached map bridge');
    ensureAtlasPickingDepth(this.bridge.overlay);
    const layers = atlasMapLibreSceneLayers(model);
    this.bridge.setLayers(layers);
    this.model = model;
  }

  pick(x: number, y: number): AtlasMapLibreSceneHit | null {
    if (this.disposed) throw new Error('Atlas scene disposed');
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Atlas pick requires finite canvas coordinates');
    if (!this.model || !this.bridge.overlay || !this.bridge.frameUsable) return null;
    ensureAtlasPickingDepth(this.bridge.overlay);
    // Do not filter out opaque terrain or ask for all overlapping objects.
    // The first shared-depth hit is the visible semantic object.
    // No second GPU pass/readback for approximate Z: the selected mesh and
    // shared camera already provide the precise author point below.
    const info = this.bridge.overlay.pickObject({x, y, radius: 0});
    const frame = this.bridge.frame, viewport = info?.viewport;
    return atlasMapLibreSceneHit(this.model, info,
      frame && viewport ? {frame, viewport, pixel: {x, y}} : undefined);
  }

  dispose(): void {
    if (this.disposed) return;
    this.bridge.setLayers([]);
    this.model = null;
    this.disposed = true;
  }
}
