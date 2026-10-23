import * as maplibre from 'maplibre-gl';
import type {CRS, ErrorEvent, Map as MapLibreMap, MapOptions, StyleSpecification} from 'maplibre-gl';
import type {AtlasMetricPose, AtlasMetricRoot} from './atlas-metric-space';
import {expandMetricRoot, metricMapCamera} from './atlas-metric-space';
import {atlasMetricCRS} from './atlas-maplibre-projection';
import {AtlasMapLibreBridge, type AtlasMapLibreBridgeOptions} from './atlas-maplibre-bridge';
import {AtlasMapLibreScene} from './atlas-maplibre-scene';
import type {AtlasMapLibreSceneModel} from './atlas-maplibre-scene-model';
import {applyAtlasMapLibreCamera, readAtlasMapLibreCamera} from './atlas-maplibre-camera';
import {installAtlasMapLibreSymbols} from './atlas-maplibre-assets';
import type {LandscapeBox} from './atlas-landscape';

export interface AtlasMapLibrePrepared {model: AtlasMapLibreSceneModel; style: StyleSpecification}
export interface AtlasMapLibreSourceResolution {
  /** GeoJSON sources whose tile detail must be regenerated from canonical data. */
  sourceIds: readonly string[];
  baseRootSize: number;
  baseMaxZoom: number;
  /** Preserve tile quantization as root size grows: maxzoom rises by log2(root/base).
   * This is source resolution, independent of the user's live camera zoom. */
  /** MapLibre's pinned GeoJSON worker rejects maxzoom above 24. */
  maximumMaxZoom?: number;
}
type SurfaceMap = MapLibreMap & {
  isMoving(): boolean;
  setCenterClampedToGround(value: boolean): unknown;
  getCenterElevation(): number;
};
type SurfaceBridge = AtlasMapLibreBridge & {dispose(): void; attach(layers: never[]): Promise<unknown>; waitForStyleReconciliation(): Promise<void>};
type SurfaceScene = AtlasMapLibreScene & {dispose(): void; update(model: AtlasMapLibreSceneModel): void};
type ResourceState = {
  map: SurfaceMap | null;
  bridge: SurfaceBridge | null;
  scene: SurfaceScene | null;
  model: AtlasMapLibreSceneModel | null;
  root: AtlasMetricRoot;
  sceneOrigin: {x: number; y: number};
  crs: CRS | null;
  projectionRegistered: boolean;
  container: HTMLElement;
  styleListener: (() => void) | null;
  errorListener: ((event: ErrorEvent & {sourceId?: string}) => void) | null;
  sourceError: Error | null;
  sceneUpdated: boolean;
  disposed: boolean;
  cameraRevision?: number;
  styleSpec: StyleSpecification | null;
};

export interface AtlasMapLibreSurfaceHandle {
  readonly map: MapLibreMap;
  readonly bridge: AtlasMapLibreBridge;
  readonly scene: AtlasMapLibreScene;
  readonly model: AtlasMapLibreSceneModel;
  readonly root: Readonly<AtlasMetricRoot>;
  readonly sceneOrigin: Readonly<{x: number; y: number}>;
}

export interface AtlasMapLibreSurfaceOptions<T> {
  container: HTMLElement;
  root: AtlasMetricRoot;
  sceneOrigin: Readonly<{x: number; y: number}>;
  pose: AtlasMetricPose;
  /** Stable identity for one canonical view/source snapshot. */
  snapshot: () => T;
  /** Rebuild every CRS-dependent source from canonical coordinates for this root. */
  prepare: (snapshot: T, root: AtlasMetricRoot, sceneOrigin: Readonly<{x: number; y: number}>, signal: AbortSignal) => Promise<AtlasMapLibrePrepared>;
  sourceResolution?: AtlasMapLibreSourceResolution;
  timeoutMs?: number;
  maxZoom?: number;
  onError?: (error: unknown) => void;
  createMap?: (options: MapOptions) => MapLibreMap;
  createBridge?: (options: AtlasMapLibreBridgeOptions) => AtlasMapLibreBridge;
  createScene?: (bridge: AtlasMapLibreBridge) => AtlasMapLibreScene;
  registerProjection?: (crs: CRS) => void;
  removeProjection?: (name: string) => void;
}

function boundsUnion(a: LandscapeBox, b: LandscapeBox): LandscapeBox {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y};
}

function sameRoot(a: AtlasMetricRoot, b: AtlasMetricRoot): boolean {
  return a.x === b.x && a.y === b.y && a.size === b.size;
}

function abortError(): Error { return new DOMException('Atlas surface operation was superseded', 'AbortError'); }

/** Owns a MapLibre map, unique planar CRS, interleaved bridge and Deck scene.
 * Root changes are prepared in a hidden map and published only after it renders. */
export class AtlasMapLibreSurface<T> {
  private readonly host: HTMLElement;
  private readonly layer: HTMLElement;
  private readonly restoreHostPosition: (() => void) | null;
  private readonly snapshot: () => T;
  private readonly prepare: AtlasMapLibreSurfaceOptions<T>['prepare'];
  private readonly timeoutMs: number;
  private readonly maxZoom: number;
  private readonly sourceResolution?: AtlasMapLibreSourceResolution;
  private readonly onError: (error: unknown) => void;
  private readonly createMap: (options: MapOptions) => MapLibreMap;
  private readonly createBridge: NonNullable<AtlasMapLibreSurfaceOptions<T>['createBridge']>;
  private readonly createScene: NonNullable<AtlasMapLibreSurfaceOptions<T>['createScene']>;
  private readonly registerProjection: (crs: CRS) => void;
  private readonly removeProjection: (name: string) => void;
  private currentResources: ResourceState;
  private currentHandle: AtlasMapLibreSurfaceHandle | null = null;
  private disposed = false;
  private generation = 0;
  private pendingBounds: LandscapeBox | null = null;
  private pendingController: AbortController | null = null;
  private readonly activePointers = new Set<number>();
  private readonly resources = new Set<ResourceState>();
  private cameraRevision = 0;
  private pointerMap: SurfaceMap | null = null;
  private pointerDownListener: ((event: PointerEvent) => void) | null = null;
  private readonly pointerReleaseListener = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
  };

  private constructor(options: AtlasMapLibreSurfaceOptions<T>, layer: HTMLElement, restoreHostPosition: (() => void) | null,
    initial: ResourceState) {
    this.host = options.container;
    this.layer = layer;
    this.restoreHostPosition = restoreHostPosition;
    this.snapshot = options.snapshot;
    this.prepare = options.prepare;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxZoom = options.maxZoom ?? 32;
    this.sourceResolution = options.sourceResolution && {...options.sourceResolution, sourceIds: [...options.sourceResolution.sourceIds]};
    this.onError = options.onError ?? (error => console.error('Atlas MapLibre surface error', error));
    this.createMap = options.createMap ?? (mapOptions => new maplibre.Map(mapOptions));
    this.createBridge = options.createBridge ?? (bridgeOptions => new AtlasMapLibreBridge(bridgeOptions));
    this.createScene = options.createScene ?? (bridge => new AtlasMapLibreScene(bridge));
    this.registerProjection = options.registerProjection ?? maplibre.addProjection;
    this.removeProjection = options.removeProjection ?? maplibre.removeProjection;
    this.currentResources = initial;
  }

  static async create<T>(options: AtlasMapLibreSurfaceOptions<T>): Promise<AtlasMapLibreSurface<T>> {
    if (!Number.isFinite(options.timeoutMs ?? 15_000) || (options.timeoutMs ?? 15_000) <= 0 ||
      !Number.isFinite(options.maxZoom ?? 32) || (options.maxZoom ?? 32) <= 0) throw new Error('Invalid Atlas surface limits');
    if (options.sourceResolution) {
      const {baseRootSize, baseMaxZoom, sourceIds} = options.sourceResolution;
      const maximum = options.sourceResolution.maximumMaxZoom ?? 24;
      if (!Number.isFinite(baseRootSize) || baseRootSize <= 0 || !Number.isInteger(baseMaxZoom) || baseMaxZoom < 0 ||
        !Number.isInteger(maximum) || maximum > 24 || maximum < baseMaxZoom ||
        !sourceIds.length || new Set(sourceIds).size !== sourceIds.length) throw new Error('Invalid Atlas source resolution contract');
    }
    const host = options.container;
    const originalPosition = host.style.position;
    const computedPosition = host.ownerDocument.defaultView?.getComputedStyle(host).position;
    let restoreHostPosition: (() => void) | null = null;
    if (!computedPosition || computedPosition === 'static') {
      host.style.position = 'relative';
      restoreHostPosition = () => { if (host.style.position === 'relative') host.style.position = originalPosition; };
    }
    const layer = host.ownerDocument.createElement('div');
    Object.assign(layer.style, {position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none'});
    host.append(layer);
    const initialContainer = host.ownerDocument.createElement('div');
    Object.assign(initialContainer.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '1', opacity: '1', pointerEvents: 'auto'});
    layer.append(initialContainer);

    const surface = new AtlasMapLibreSurface(options, layer, restoreHostPosition, {
      map: null, bridge: null, scene: null, model: null,
      root: Object.freeze({...options.root}), sceneOrigin: Object.freeze({...options.sceneOrigin}),
      crs: null, projectionRegistered: false, container: initialContainer, styleListener: null, errorListener: null,
      sourceError: null, sceneUpdated: false, disposed: false, styleSpec: null
    });
    surface.resources.add(surface.currentResources);
    const controller = new AbortController();
    try {
      const snapshot = options.snapshot();
      const work = surface.createOwned(surface.currentResources, snapshot, surface.currentResources.root,
        surface.currentResources.sceneOrigin, {...options.pose, focus: {...options.pose.focus}}, controller.signal);
      await surface.runBounded(work, controller, initialContainer);
      if (options.snapshot() !== snapshot) throw new Error('Atlas snapshot changed during initial surface creation');
      surface.currentHandle = surface.makeHandle(surface.currentResources);
      surface.installPointerTracking(surface.currentResources.map!);
      return surface;
    } catch (error) {
      controller.abort();
      surface.cleanup(surface.currentResources);
      layer.remove();
      restoreHostPosition?.();
      throw error;
    }
  }

  get current(): AtlasMapLibreSurfaceHandle {
    if (this.disposed || !this.currentHandle) throw new Error('Atlas MapLibre surface is disposed or not ready');
    return this.currentHandle;
  }

  async expand(bounds: LandscapeBox): Promise<boolean> {
    this.assertLive();
    const from = this.currentResources.root;
    if (sameRoot(expandMetricRoot(from, bounds), from)) return false;
    const union = this.pendingBounds ? boundsUnion(this.pendingBounds, bounds) : {...bounds};
    const targetRoot = Object.freeze(expandMetricRoot(from, union));
    if (sameRoot(targetRoot, from)) return false;

    const generation = ++this.generation;
    this.pendingController?.abort(abortError());
    const controller = new AbortController();
    this.pendingController = controller;
    this.pendingBounds = union;
    const source = this.currentResources;
    const container = this.host.ownerDocument.createElement('div');
    Object.assign(container.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '2', opacity: '0', pointerEvents: 'none'});
    this.layer.append(container);
    const candidate: ResourceState = {map: null, bridge: null, scene: null, model: null, root: targetRoot,
      sceneOrigin: Object.freeze({...source.sceneOrigin}), crs: null, projectionRegistered: false, container,
      styleListener: null, errorListener: null, sourceError: null, sceneUpdated: false, disposed: false, styleSpec: null};
    this.resources.add(candidate);
    let stopCameraSync = (): void => {};
    try {
      const sourceSnapshot = this.snapshot();
      stopCameraSync = this.startCameraSync(source, candidate);
      const pose = readAtlasMapLibreCamera(source.map!, source.root, source.model!.verticalExaggeration);
      const work = this.createOwned(candidate, sourceSnapshot, targetRoot, candidate.sceneOrigin, pose, controller.signal, source)
        .then(() => this.publishWhenCurrent(candidate, source, sourceSnapshot, generation, controller.signal));
      const published = await this.runBounded(work, controller, container);
      if (!published) return false;
      return true;
    } catch (error) {
      if ((error as Error | undefined)?.name === 'AbortError' ||
        (controller.signal.aborted && (controller.signal.reason as Error | undefined)?.name === 'AbortError')) return false;
      this.reportError(error);
      throw error;
    } finally {
      stopCameraSync();
      if (!candidate.disposed && this.currentResources !== candidate) this.cleanup(candidate);
      if (this.generation === generation) {
        this.pendingBounds = null;
        this.pendingController = null;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.pendingController?.abort(abortError());
    this.pendingController = null;
    this.removePointerTracking();
    for (const resources of [...this.resources]) this.cleanup(resources);
    this.currentHandle = null;
    this.layer.remove();
    this.restoreHostPosition?.();
  }

  private async runBounded<R>(work: Promise<R>, controller: AbortController, container: HTMLElement): Promise<R> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(new Error('Atlas candidate surface timed out')); reject(new Error('Atlas candidate surface timed out')); }, this.timeoutMs);
    });
    const aborted = new Promise<never>((_resolve, reject) => {
      abortListener = () => reject(controller.signal.reason ?? abortError());
      if (controller.signal.aborted) abortListener();
      else controller.signal.addEventListener('abort', abortListener, {once: true});
    });
    try { return await Promise.race([work, timeout, aborted]); }
    catch (error) {
      controller.abort(error);
      const resource = [...this.knownResources()].find(item => item.container === container);
      if (resource) this.cleanup(resource);
      void work.catch(() => undefined);
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (abortListener) controller.signal.removeEventListener('abort', abortListener);
    }
  }

  private *knownResources(): Iterable<ResourceState> {
    yield* this.resources;
  }

  private async createOwned(resources: ResourceState, snapshot: T, root: AtlasMetricRoot,
    sceneOrigin: Readonly<{x: number; y: number}>, pose: AtlasMetricPose, signal: AbortSignal, previous?: ResourceState): Promise<void> {
    this.checkSignal(signal);
    const prepared = await this.prepare(snapshot, root, sceneOrigin, signal);
    this.checkSignal(signal);
    if (this.snapshot() !== snapshot) throw abortError();
    if (!prepared || !prepared.model || !prepared.style) throw new Error('Atlas preparation returned no scene or style');
    if (!sameRoot(prepared.model.root, root) || prepared.model.sceneOrigin.x !== sceneOrigin.x || prepared.model.sceneOrigin.y !== sceneOrigin.y)
      throw new Error('Prepared Atlas scene uses a different root or local origin');
    if (previous?.styleSpec === prepared.style) throw new Error('Atlas root expansion reused the previous root-encoded style');
    this.validateSourceResolution(prepared.style, root, previous?.styleSpec ?? null, previous?.root);
    resources.model = prepared.model;
    resources.styleSpec = prepared.style;
    resources.crs = atlasMetricCRS(`saltmarcher:atlas-${globalThis.crypto.randomUUID()}`, root);
    this.registerProjection(resources.crs);
    resources.projectionRegistered = true;
    const style = {...prepared.style, projection: {type: resources.crs.name}} as StyleSpecification;
    const sourceIds = Object.keys(style.sources ?? {});
    const camera = metricMapCamera(root, pose, prepared.model.verticalExaggeration);
    if (camera.zoom < -2 || camera.zoom > this.maxZoom) throw new Error('Requested Atlas camera zoom exceeds the configured MapLibre camera range');
    const options: MapOptions = {
      container: resources.container,
      style,
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
      elevation: camera.elevation,
      maxZoom: this.maxZoom,
      maxPitch: 75,
      renderWorldCopies: false
    };
    resources.map = this.createMap(options) as SurfaceMap;
    applyAtlasMapLibreCamera(resources.map, root, pose, prepared.model.verticalExaggeration);
    this.assertPosePreserved(resources.map, root, pose, prepared.model.verticalExaggeration);
    resources.styleListener = () => {
      try { installAtlasMapLibreSymbols(resources.map!); }
      catch (error) { resources.sourceError = error instanceof Error ? error : new Error(String(error)); }
    };
    resources.errorListener = event => {
      const relevant = !event.sourceId || sourceIds.includes(event.sourceId);
      if (relevant && !resources.sourceError) resources.sourceError = event.error instanceof Error
        ? event.error : new Error(event.error?.message ?? 'MapLibre candidate style/source failed');
    };
    resources.map.on('style.load', resources.styleListener);
    resources.map.on('error', resources.errorListener);
    if (resources.map.isStyleLoaded()) resources.styleListener();
    resources.bridge = this.createBridge({map: resources.map, root, sceneOrigin, sourceIds,
      onError: error => { resources.sourceError = error instanceof Error ? error : new Error(String(error)); this.reportError(error); }} ) as SurfaceBridge;
    await resources.bridge.attach([]);
    this.checkSignal(signal);
    if (resources.sourceError) throw resources.sourceError;
    resources.scene = this.createScene(resources.bridge) as SurfaceScene;
    const frameAfterScene = this.waitForFrame(resources, snapshot, signal);
    void frameAfterScene.catch(() => undefined);
    resources.scene.update(prepared.model);
    resources.sceneUpdated = true;
    resources.map.triggerRepaint();
    await resources.bridge.waitForStyleReconciliation();
    await frameAfterScene;
    this.checkSignal(signal);
  }

  private async waitForFrame(resources: ResourceState, snapshot: T, signal: AbortSignal): Promise<void> {
    const map = resources.map!;
    let renderedAfterSceneUpdate = false;
    const markRendered = (): void => { if (resources.sceneUpdated) renderedAfterSceneUpdate = true; };
    map.on('render', markRendered);
    try {
      while (true) {
        this.checkSignal(signal);
        if (resources.sourceError) throw resources.sourceError;
        if (resources.bridge?.error) throw resources.bridge.error;
        if (this.snapshot() !== snapshot) throw abortError();
        if (renderedAfterSceneUpdate && resources.bridge?.frameUsable && map.isStyleLoaded() && !map.isMoving()) return;
        map.triggerRepaint();
        await new Promise<void>(resolve => setTimeout(resolve, 16));
      }
    } finally { map.off('render', markRendered); }
  }

  private async publishWhenCurrent(candidate: ResourceState, source: ResourceState, snapshot: T,
    generation: number, signal: AbortSignal): Promise<boolean> {
    while (true) {
      this.checkSignal(signal);
      if (generation !== this.generation || this.disposed || this.currentResources !== source) return false;
      if (this.snapshot() !== snapshot) return false;
      if (candidate.sourceError) throw candidate.sourceError;
      if (candidate.cameraRevision !== this.cameraRevision) this.syncCandidateCamera(source, candidate);
      candidate.map!.triggerRepaint();
      if (!source.map!.isMoving() && this.activePointers.size === 0 && candidate.cameraRevision === this.cameraRevision && candidate.bridge!.frameUsable) {
        if (this.snapshot() !== snapshot || generation !== this.generation) return false;
        const sourceMap = source.map!;
        const focused = sourceMap.getContainer().contains(sourceMap.getCanvas().ownerDocument.activeElement);
        const old = source;
        candidate.container.style.opacity = '1';
        candidate.container.style.pointerEvents = 'auto';
        source.container.style.opacity = '0';
        source.container.style.pointerEvents = 'none';
        this.currentResources = candidate;
        this.currentHandle = this.makeHandle(candidate);
        this.installPointerTracking(candidate.map!);
        if (focused) candidate.map!.getCanvas().focus({preventScroll: true});
        this.cleanup(old);
        return true;
      }
      await new Promise<void>(resolve => setTimeout(resolve, 16));
    }
  }

  private startCameraSync(source: ResourceState, candidate: ResourceState): () => void {
    const sourceMap = source.map!;
    const sync = (): void => {
      this.cameraRevision++;
      if (!candidate.map || !candidate.model) return;
      try { this.syncCandidateCamera(source, candidate); }
      catch (error) { candidate.sourceError = error instanceof Error ? error : new Error(String(error)); }
      candidate.map.triggerRepaint();
    };
    const resize = (): void => { candidate.map?.resize(); sync(); };
    sourceMap.on('move', sync);
    sourceMap.on('moveend', sync);
    sourceMap.on('resize', resize);
    const stop = (): void => {
      sourceMap.off('move', sync);
      sourceMap.off('moveend', sync);
      sourceMap.off('resize', resize);
    };
    return stop;
  }

  private syncCandidateCamera(source: ResourceState, candidate: ResourceState): void {
    const pose = readAtlasMapLibreCamera(source.map!, source.root, source.model!.verticalExaggeration);
    applyAtlasMapLibreCamera(candidate.map!, candidate.root, pose, candidate.model!.verticalExaggeration);
    this.assertPosePreserved(candidate.map!, candidate.root, pose, candidate.model!.verticalExaggeration);
    candidate.cameraRevision = this.cameraRevision;
  }

  private validateSourceResolution(style: StyleSpecification, root: AtlasMetricRoot,
    previousStyle: StyleSpecification | null, previousRoot?: AtlasMetricRoot): number | null {
    const sources = style.sources ?? {};
    const geojsonIds = Object.keys(sources).filter(id => sources[id]?.type === 'geojson');
    const contract = this.sourceResolution;
    if (geojsonIds.length && !contract) throw new Error('Root-dependent GeoJSON sources require an Atlas source-resolution contract');
    const levels = contract ? Math.log2(root.size / contract.baseRootSize) : 0;
    let requiredMaxZoom: number | null = null;
    if (contract) {
      const maximum = contract.maximumMaxZoom ?? 24;
      if (!Number.isInteger(maximum) || maximum < 0 || maximum > 24) throw new Error('Atlas source maxzoom must be in MapLibre GeoJSON range 0..24');
      if (!Number.isInteger(levels) || levels < 0) throw new Error('Atlas root is not a dyadic expansion of the source-detail baseline');
      requiredMaxZoom = contract.baseMaxZoom + levels;
      if (!Number.isInteger(requiredMaxZoom) || requiredMaxZoom > maximum) {
        throw new Error(`Atlas root requires GeoJSON maxzoom ${requiredMaxZoom}, above the supported cap ${maximum}`);
      }
      const ids = new Set(contract.sourceIds);
      if (geojsonIds.some(id => !ids.has(id)) || contract.sourceIds.some(id => sources[id]?.type !== 'geojson')) {
        throw new Error('Atlas source-resolution contract must cover every root-dependent GeoJSON source');
      }
      for (const id of contract.sourceIds) {
        const nextSource = sources[id] as {type?: string; maxzoom?: number; data?: unknown} | undefined;
        if (!nextSource || nextSource.maxzoom !== requiredMaxZoom) {
          throw new Error(`Atlas GeoJSON source ${id} must be rebuilt with maxzoom ${requiredMaxZoom}`);
        }
        const previousSource = previousStyle?.sources?.[id] as {data?: unknown} | undefined;
        if (previousStyle && Object.is(previousSource?.data, nextSource.data)) {
          throw new Error(`Atlas GeoJSON source ${id} reused data encoded for the previous root`);
        }
      }
    }

    // Style layer thresholds use the same root-relative zoom space as MapLibre
    // sources. A root doubling therefore shifts explicit thresholds by one.
    const layers = style.layers as Array<{id: string; minzoom?: number; maxzoom?: number}>;
    const previousLayers = previousStyle?.layers as Array<{id: string; minzoom?: number; maxzoom?: number}> | undefined;
    const previousById = new Map(previousLayers?.map(layer => [layer.id, layer]) ?? []);
    const shift = previousRoot ? Math.log2(root.size / previousRoot.size) : 0;
    if (!Number.isInteger(shift) || shift < 0) throw new Error('Atlas style zoom thresholds require a dyadic root expansion');
    if (previousStyle && (layers.length !== previousLayers!.length || layers.some(layer => !previousById.has(layer.id)))) {
      throw new Error('Atlas root expansion must preserve the prepared style layer set');
    }
    for (const layer of layers) {
      for (const [field, value] of [['minzoom', layer.minzoom], ['maxzoom', layer.maxzoom]] as const) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 24)) {
          throw new Error(`Atlas style layer ${layer.id} ${field} must stay within MapLibre zoom 0..24`);
        }
        if (previousStyle) {
          const oldValue = previousById.get(layer.id)?.[field];
          if (oldValue === undefined ? value !== undefined : value !== oldValue + shift) {
            throw new Error(`Atlas style layer ${layer.id} ${field} must shift by ${shift} with the expanded root`);
          }
        }
      }
    }
    return requiredMaxZoom;
  }

  private assertPosePreserved(map: SurfaceMap, root: AtlasMetricRoot, expected: AtlasMetricPose, exaggeration: number): void {
    const actual = readAtlasMapLibreCamera(map, root, exaggeration);
    const wrappedAngle = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
    const near = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance;
    const relative = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));
    const matches = Math.hypot(actual.focus.x - expected.focus.x, actual.focus.y - expected.focus.y) <= 1e-3 &&
      near(actual.focusHeightM ?? 0, expected.focusHeightM ?? 0, 1e-3) &&
      relative(actual.metersPerPixel, expected.metersPerPixel, 1e-8) &&
      wrappedAngle(actual.rotation, expected.rotation) <= 1e-5 && near(actual.tilt, expected.tilt, 1e-5);
    if (!matches) throw new Error('MapLibre constrained the requested physical Atlas camera pose');
  }

  private installPointerTracking(map: SurfaceMap): void {
    this.removePointerTracking();
    this.pointerMap = map;
    this.pointerDownListener = event => { this.activePointers.add(event.pointerId); };
    map.getContainer().addEventListener('pointerdown', this.pointerDownListener);
    map.getContainer().ownerDocument.addEventListener('pointerup', this.pointerReleaseListener, true);
    map.getContainer().ownerDocument.addEventListener('pointercancel', this.pointerReleaseListener, true);
    map.getContainer().ownerDocument.addEventListener('lostpointercapture', this.pointerReleaseListener, true);
  }

  private removePointerTracking(): void {
    const doc = this.pointerMap?.getContainer().ownerDocument;
    if (this.pointerMap && this.pointerDownListener) this.pointerMap.getContainer().removeEventListener('pointerdown', this.pointerDownListener);
    if (doc) {
      doc.removeEventListener('pointerup', this.pointerReleaseListener, true);
      doc.removeEventListener('pointercancel', this.pointerReleaseListener, true);
      doc.removeEventListener('lostpointercapture', this.pointerReleaseListener, true);
    }
    this.pointerMap = null;
    this.pointerDownListener = null;
    this.activePointers.clear();
  }

  private makeHandle(resources: ResourceState): AtlasMapLibreSurfaceHandle {
    return Object.freeze({map: resources.map!, bridge: resources.bridge!, scene: resources.scene!, model: resources.model!,
      root: Object.freeze({...resources.root}), sceneOrigin: Object.freeze({...resources.sceneOrigin})});
  }

  private cleanup(resources: ResourceState): void {
    if (resources.disposed) return;
    resources.disposed = true;
    if (resources.map && resources.styleListener) resources.map.off('style.load', resources.styleListener);
    if (resources.map && resources.errorListener) resources.map.off('error', resources.errorListener);
    if (resources.scene) {
      try { resources.scene.dispose(); } catch (error) { this.reportError(error); }
    }
    if (resources.bridge) {
      try { resources.bridge.dispose(); } catch (error) { this.reportError(error); }
    }
    if (resources.map) {
      try { resources.map.remove(); } catch (error) { this.reportError(error); }
      resources.map = null;
    }
    if (resources.projectionRegistered && resources.crs) {
      try { this.removeProjection(resources.crs.name); } catch (error) { this.reportError(error); }
      resources.projectionRegistered = false;
    }
    resources.container.remove();
    this.resources.delete(resources);
  }

  private checkSignal(signal: AbortSignal): void {
    if (signal.aborted) throw signal.reason ?? abortError();
  }

  private reportError(error: unknown): void {
    try { this.onError(error); } catch { /* Reporting must not interrupt resource cleanup. */ }
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('Atlas MapLibre surface is disposed');
  }
}
