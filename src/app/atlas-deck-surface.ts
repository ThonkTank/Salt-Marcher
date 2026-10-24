import {terrainContourStep} from './terrain-contour-style';
import {AtlasTerrainMaterialLayer} from './atlas-terrain-material-layer';
import type {AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import {DEFAULT_TERRAIN_STYLE,type TerrainStyle} from './terrain-relief';
import {Deck, COORDINATE_SYSTEM, type Color, type DeckProps, type Layer} from '@deck.gl/core';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {atlasMetricFrame, AtlasMetricView, atlasMetricZoomAt, atlasMetricPanAt,
  type AtlasMetricCamera} from './atlas-metric-camera';
import {ensureAtlasDeckPickingDepth} from './atlas-deck-picking';
import type {AtlasDeckSceneModel, AtlasDeckSceneObject, AtlasDeckSelectionTarget} from './atlas-deck-scene-model';
import type {AtlasGeometryOverviewMesh} from './atlas-geometry-overview';
import {refineAtlasDeckRayHit} from './atlas-deck-ray';
import {createAtlasDeckLabels, type AtlasDeckLabel, type AtlasDeckLabels} from './atlas-deck-labels';

export interface AtlasDeckHit {
  id: string;
  target: AtlasDeckSelectionTarget;
  point: {x: number; y: number; heightM: number} | null;
}
export interface AtlasDeckSurfaceOptions {
  container: HTMLElement;
  camera: AtlasMetricCamera;
  model: AtlasDeckSceneModel;
  labels?: readonly AtlasDeckLabel[];
  onCamera?: (camera: AtlasMetricCamera) => void;
  onError?: (error: Error) => void;
  timeoutMs?: number;
  /** Existing Workbench owns input when used through AtlasPresentation. */
  externalInput?:boolean;
  /** Unit-test seam; production always uses the pinned Deck runtime. */
  createDeck?: (props: DeckProps<AtlasMetricView[]>) => Deck<AtlasMetricView[]>;
}
type Frame = ReturnType<typeof atlasMetricFrame>;
const colors: Record<AtlasDeckSelectionTarget['kind'], Color> = {
  terrain: [112, 142, 94, 255], building: [180, 125, 82, 255], room: [213, 180, 117, 255]
};
type SceneMesh = {attributes: {POSITION: {size: number; value: Float32Array}}; indices: {size: number; value: Uint32Array}};
const meshes = new WeakMap<AtlasDeckSceneObject, {mesh: SceneMesh; data: AtlasDeckSceneObject[]}>();
const overviewMeshes = new WeakMap<AtlasGeometryOverviewMesh, {mesh: SceneMesh; data: AtlasGeometryOverviewMesh[]}>();
const overviewColors: Record<AtlasGeometryOverviewMesh['kind'], Color> = {
  building: [153, 117, 89, 255], room: [189, 164, 123, 255]
};

/** Camera/origin changes only update instance transforms. Mesh and instance-data
 * identities survive; Deck retains the expensive geometry buffers. */
export function atlasDeckSceneLayers(model: AtlasDeckSceneModel, frame: Frame): Layer[] {
  const semanticLayers = model.objects.map(object => {
    let cached = meshes.get(object);
    if (!cached) {
      cached = {mesh: {attributes: {POSITION: {size: 3, value: object.positions}},
        indices: {size: 1, value: object.indices}}, data: [object]};
      meshes.set(object, cached);
    }
    return new SimpleMeshLayer<AtlasDeckSceneObject>({
      id: `atlas-scene:${object.id}`, data: cached.data, mesh: cached.mesh,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: [object.origin.x - frame.origin.x, object.origin.y - frame.origin.y,
        (object.origin.heightM - frame.origin.z) * frame.camera.exaggeration],
      getScale: [1, 1, frame.camera.exaggeration],
      // Retained instance data does not invalidate multi-accessor transform
      // attributes. Explicit triggers update only those small attributes.
      updateTriggers: {
        getPosition: [frame.origin.x, frame.origin.y, frame.origin.z, frame.camera.exaggeration],
        getScale: frame.camera.exaggeration
      },
      getColor: colors[object.target.kind], material: false, pickable: '3d',
      getPolygonOffset: () => [0, 0],
      parameters: {depthWriteEnabled: true, depthCompare: 'less-equal', cullMode: 'none'}
    });
  });
  const overviewLayers = (model.overviews ?? []).flatMap(overview => overview.meshes.map(object => {
    let cached = overviewMeshes.get(object);
    if (!cached) {
      cached = {mesh: {attributes: {POSITION: {size: 3, value: object.positions}},
        indices: {size: 1, value: object.indices}}, data: [object]};
      overviewMeshes.set(object, cached);
    }
    const {lod, x, y} = overview.tile;
    return new SimpleMeshLayer<AtlasGeometryOverviewMesh>({
      id: `atlas-overview:${lod}/${x}/${y}:${overview.resolution}:${object.id}`,
      data: cached.data, mesh: cached.mesh,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: [object.origin.x - frame.origin.x, object.origin.y - frame.origin.y,
        (object.origin.heightM - frame.origin.z) * frame.camera.exaggeration],
      getScale: [1, 1, frame.camera.exaggeration],
      updateTriggers: {
        getPosition: [frame.origin.x, frame.origin.y, frame.origin.z, frame.camera.exaggeration],
        getScale: frame.camera.exaggeration
      },
      getColor: overviewColors[object.kind], material: false, pickable: false,
      getPolygonOffset: () => [0, 0],
      parameters: {depthWriteEnabled: true, depthCompare: 'less-equal', cullMode: 'none'}
    });
  }));
  return [...overviewLayers, ...semanticLayers];
}

/** Standalone metric scene. Main/preload owns snapshots; this surface never
 * writes canonical data and never normalizes a world into a finite map root. */
export class AtlasDeckSurface {
  private canvasValue: HTMLCanvasElement;
  private deckValue: Deck<AtlasMetricView[]> | null = null;
  private cameraValue: AtlasMetricCamera;
  private modelValue: AtlasDeckSceneModel;
  private frameValue: Frame;
  private labels: readonly AtlasDeckLabel[];
  private terrain:readonly AtlasTerrainTileModel[]=[];
  private terrainStyle:Readonly<TerrainStyle>=DEFAULT_TERRAIN_STYLE;
  private terrainDisplay={contours:0,seaLevelM:0};
  private labelLayout: AtlasDeckLabels | null = null;
  private disposed = false;
  private loaded = false;
  private lost = false;
  private failure:Error|null=null;
  private generation = 0;
  private revision = 0;
  private renderedRevision = -1;
  private recovery: Promise<void> | null = null;
  private observer: ResizeObserver;
  private listeners: (() => void)[] = [];
  private waiters = new Set<{resolve: () => void; reject: (error: Error) => void}>();
  private drag: {id: number; pixel: {x: number; y: number}; camera: AtlasMetricCamera; rotate: boolean} | null = null;

  private constructor(private readonly options: AtlasDeckSurfaceOptions) {
    this.cameraValue = {...options.camera, focus: {...options.camera.focus}};
    this.modelValue = options.model;
    this.labels = options.labels ?? [];
    this.frameValue = atlasMetricFrame(this.cameraValue, Math.max(1, options.container.clientWidth), Math.max(1, options.container.clientHeight));
    this.canvasValue = this.makeCanvas();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(options.container);
  }
  static async create(options: AtlasDeckSurfaceOptions): Promise<AtlasDeckSurface> {
    const surface = new AtlasDeckSurface(options);
    try { await surface.start(); return surface; }
    catch (error) { surface.dispose(); throw error; }
  }
  get canvas(): HTMLCanvasElement { return this.canvasValue; }
  get camera(): AtlasMetricCamera { return {...this.cameraValue, focus: {...this.cameraValue.focus}}; }
  get model(): AtlasDeckSceneModel { return this.modelValue; }
  get frame(): Frame { return this.frameValue; }
  get frameUsable(): boolean { return !this.disposed && !this.lost && this.loaded && this.renderedRevision === this.revision; }

  private makeCanvas(): HTMLCanvasElement {
    const canvas = this.options.container.ownerDocument.createElement('canvas');
    // Deck can emit its first afterRender before its ResizeObserver runs. Give
    // the recreated context the real framebuffer dimensions before that frame.
    const ratio=globalThis.devicePixelRatio??1;
    canvas.width=Math.max(1,Math.round(this.frameValue.viewport.width*ratio));
    canvas.height=Math.max(1,Math.round(this.frameValue.viewport.height*ratio));
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Atlas');
    Object.assign(canvas.style, {width: '100%', height: '100%', display: 'block', touchAction: 'none'});
    this.options.container.append(canvas);
    return canvas;
  }
  private guard(): void { if (this.disposed) throw new Error('Atlas surface disposed'); }
  private publish(): void {
    this.guard();
    this.frameValue = atlasMetricFrame(this.cameraValue, Math.max(1, this.options.container.clientWidth), Math.max(1, this.options.container.clientHeight));
    this.revision++;
    if (!this.loaded || this.lost) return;
    this.deckValue!.setProps({width: this.frameValue.viewport.width, height: this.frameValue.viewport.height,
      views: [new AtlasMetricView({id: 'atlas-metric', frame: this.frameValue})],
      viewState: {}, layers: [...this.terrainLayers(), ...atlasDeckSceneLayers(this.modelValue, this.frameValue), ...this.labelLayers()]});
  }
  setCamera(camera: AtlasMetricCamera): void {
    this.guard();
    // Validate before changing the live camera.
    atlasMetricFrame(camera, this.frameValue.viewport.width, this.frameValue.viewport.height);
    this.cameraValue = {...camera, focus: {...camera.focus}};
    this.publish(); this.options.onCamera?.(this.camera);
  }
  setScene(model: AtlasDeckSceneModel): void {
    this.guard();
    if (model === this.modelValue) return;
    this.modelValue = model; this.publish();
  }
  setTerrain(tiles:readonly AtlasTerrainTileModel[],style:Readonly<TerrainStyle>=this.terrainStyle,display=this.terrainDisplay):void {
    this.guard();this.terrain=tiles;this.terrainStyle=style;this.terrainDisplay=display;this.publish();
  }
  private terrainLayers():Layer[]{
    const frame=this.frameValue;
    return this.terrain.map(tile=>new AtlasTerrainMaterialLayer({
      id:`atlas-scene:${tile.object.id}`,data:tile.data,mesh:tile.mesh,baseColor:tile.texture,
      masks:tile.masks,terrainStyle:this.terrainStyle,heightOrigin:tile.object.origin.heightM,
      ...this.terrainDisplay,automaticStep:terrainContourStep(frame.camera.metersPerPixel),pixelRatio:globalThis.devicePixelRatio??1,
      coordinateSystem:COORDINATE_SYSTEM.CARTESIAN,
      getPosition:[tile.object.origin.x-frame.origin.x,tile.object.origin.y-frame.origin.y,(tile.object.origin.heightM-frame.origin.z)*frame.camera.exaggeration],
      getScale:[1,1,frame.camera.exaggeration],getColor:[255,255,255,255],material:false,pickable:'3d',
      textureParameters:{minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'},
      updateTriggers:{getPosition:[frame.origin.x,frame.origin.y,frame.origin.z,frame.camera.exaggeration],getScale:frame.camera.exaggeration},
      getPolygonOffset:()=>[0,0],parameters:{depthWriteEnabled:true,depthCompare:'less-equal',cullMode:'none'}
    }));
  }
  setLabels(labels: readonly AtlasDeckLabel[]): void {
    this.guard(); this.labels = labels; this.publish();
  }
  private labelLayers(): Layer[] {
    if (!this.labels.length) return [];
    this.labelLayout ??= createAtlasDeckLabels(this.options.container.ownerDocument);
    return [this.labelLayout.layer(this.frameValue, this.labels)];
  }
  resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.options.container.clientWidth), height = Math.max(1, this.options.container.clientHeight);
    if (width === this.frameValue.viewport.width && height === this.frameValue.viewport.height) return;
    // A resize changes the pointer-to-world transform; begin another drag only
    // after release rather than reusing an anchor in an obsolete viewport.
    this.drag = null; this.publish();
  }
  pick(x: number, y: number): AtlasDeckHit | null {
    this.guard();
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Atlas pick requires finite coordinates');
    if (!this.frameUsable) return null;
    ensureAtlasDeckPickingDepth(this.deckValue!);
    const info = this.deckValue!.pickObject({x, y, radius: 0});
    const object = info?.object as AtlasDeckSceneObject | undefined;
    // Treat renderer output as untrusted: overview layers are non-pickable, and
    // only the exact canonical scene object instances have semantic targets.
    const terrainHit=object&&this.terrain.some(tile=>tile.object===object);
    if (!info?.picked || info.index !== 0 || !object || (!terrainHit&&(!this.modelValue.objects.some(candidate => candidate === object)||this.modelValue.targets.get(object.id)!==object.target)) ||
      info.layer?.id !== `atlas-scene:${object.id}`) return null;
    const segment = this.frameValue.ray({x, y});
    const point = segment ? refineAtlasDeckRayHit({object, segment})?.point ?? null : null;
    return {id: object.id, target: object.target, point};
  }
  waitForFrame(): Promise<void> {
    this.guard();
    if(this.failure)return Promise.reject(this.failure);
    if (this.frameUsable) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = {resolve: () => { clearTimeout(timer); this.waiters.delete(waiter); resolve(); },
        reject: (error: Error) => { clearTimeout(timer); this.waiters.delete(waiter); reject(error); }};
      const timer = setTimeout(() => waiter.reject(new Error(`Atlas frame readiness timeout (loaded=${this.loaded}, lost=${this.lost}, revision=${this.revision}, rendered=${this.renderedRevision})`)), this.options.timeoutMs ?? 15000);
      this.waiters.add(waiter);
    });
  }
  private async start(): Promise<void> {
    const generation = ++this.generation;
    this.loaded = false; this.lost = false; this.failure=null; this.renderedRevision = -1;
    this.bindInput();
    const ready = this.waitForFrame();
    try {
      this.deckValue = (this.options.createDeck ?? (props => new Deck<AtlasMetricView[]>(props)))({
        canvas: this.canvasValue, width: this.frameValue.viewport.width, height: this.frameValue.viewport.height,
        useDevicePixels: true, controller: false, viewState: {},
        views: [new AtlasMetricView({id: 'atlas-metric', frame: this.frameValue})], layers: [],
        deviceProps: {type: 'webgl', webgl: {antialias: true, preserveDrawingBuffer: true}},
        onLoad: () => {
          if (this.disposed || generation !== this.generation) return;
          this.loaded = true;
          try { ensureAtlasDeckPickingDepth(this.deckValue!); this.publish(); }
          catch (error) { this.fail(error); }
        },
        onAfterRender: () => {
          if (this.disposed || !this.loaded || this.lost || generation !== this.generation) return;
          if((this.deckValue?.props.layers??[]).some(layer=>layer&&'isLoaded' in layer&&layer.isLoaded===false))return;
          this.renderedRevision = this.revision;
          for (const waiter of [...this.waiters]) waiter.resolve();
        },
        onError: error => { if (!this.lost && !this.disposed && generation === this.generation) this.fail(error); }
      });
    } catch (error) { this.fail(error); }
    await ready;
  }
  private fail(value: unknown): void {
    const error = value instanceof Error ? value : new Error(String(value));
    this.failure=error;
    ++this.generation; // Fence even a delayed onLoad after a failed GPU initialization.
    this.renderedRevision = -1; this.loaded = false;
    for (const waiter of [...this.waiters]) waiter.reject(error);
    this.options.onError?.(error);
  }
  private bindInput(): void {
    const canvas = this.canvasValue;
    type Events = HTMLElementEventMap & {webglcontextlost: Event};
    const listen = <K extends keyof Events>(type: K, callback: (event: Events[K]) => void, options?: AddEventListenerOptions) => {
      if(this.options.externalInput&&type!=='webglcontextlost')return;
      canvas.addEventListener(type, callback as EventListener, options); this.listeners.push(() => canvas.removeEventListener(type, callback as EventListener, options));
    };
    const pixel = (event: MouseEvent) => { const r = canvas.getBoundingClientRect(); return {x: event.clientX - r.left, y: event.clientY - r.top}; };
    listen('pointerdown', event => {
      if (this.lost || event.button !== 0 && event.button !== 2) return;
      canvas.focus(); canvas.setPointerCapture(event.pointerId); event.preventDefault();
      this.drag = {id: event.pointerId, pixel: pixel(event), camera: this.camera, rotate: event.button === 2 || event.shiftKey};
    });
    listen('pointermove', event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId || this.lost) return;
      const now = pixel(event);
      if (drag.rotate) this.setCamera({...drag.camera,
        rotation: drag.camera.rotation + (now.x - drag.pixel.x) * .3,
        tilt: Math.max(0, Math.min(75, drag.camera.tilt + (now.y - drag.pixel.y) * .3))});
      else this.setCamera(atlasMetricPanAt(drag.camera, this.frameValue.viewport.width, this.frameValue.viewport.height, drag.pixel, now));
    });
    const release = (event: PointerEvent) => {
      if (this.drag?.id === event.pointerId) this.drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', () => { this.drag = null; });
    listen('contextmenu', event => event.preventDefault());
    listen('wheel', event => {
      if (this.lost) return;
      event.preventDefault(); this.drag = null;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.frameValue.viewport.height : 1);
      this.setCamera(atlasMetricZoomAt(this.cameraValue, this.frameValue.viewport.width, this.frameValue.viewport.height, pixel(event), Math.exp(Math.max(-2, Math.min(2, delta * .002)))));
    }, {passive: false});
    listen('keydown', event => {
      if (this.lost) return;
      const moves: Record<string, [number, number]> = {ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40]};
      const move = moves[event.key], center = {x: this.frameValue.viewport.width / 2, y: this.frameValue.viewport.height / 2};
      if (move) { event.preventDefault(); this.setCamera(atlasMetricPanAt(this.cameraValue, this.frameValue.viewport.width, this.frameValue.viewport.height, center, {x: center.x + move[0], y: center.y + move[1]})); }
      else if (event.key === '+' || event.key === '-') { event.preventDefault(); this.setCamera(atlasMetricZoomAt(this.cameraValue, this.frameValue.viewport.width, this.frameValue.viewport.height, center, event.key === '+' ? .8 : 1.25)); }
    });
    listen('webglcontextlost', event => {
      event.preventDefault(); this.lost = true; this.renderedRevision = -1; this.drag = null;
      // No persistence operation is retried. Only disposable GPU state is rebuilt.
      queueMicrotask(() => { if (!this.disposed) void this.recover().catch(error => this.fail(error)); });
    });
  }
  /** Recreate only GPU resources after context loss; canonical snapshots and
   * camera survive. Generation fencing prevents late callbacks reviving old GPU state. */
  recover(): Promise<void> {
    this.guard();
    if (this.recovery) return this.recovery;
    this.recovery = (async () => {
      const focused = this.canvasValue.ownerDocument.activeElement === this.canvasValue;
      ++this.generation;
      for (const off of this.listeners.splice(0)) off();
      this.deckValue?.finalize(); this.deckValue = null;
      this.canvasValue.remove(); this.canvasValue = this.makeCanvas();
      if (focused) this.canvasValue.focus();
      await this.start();
    })().finally(() => { this.recovery = null; });
    return this.recovery;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.generation; this.drag = null;
    this.observer.disconnect();
    for (const off of this.listeners.splice(0)) off();
    for (const waiter of [...this.waiters]) waiter.reject(new Error('Atlas surface disposed'));
    this.deckValue?.finalize(); this.deckValue = null; this.canvasValue.remove();
  }
}
