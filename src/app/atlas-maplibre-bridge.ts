import * as maplibre from 'maplibre-gl';
import type {CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap} from 'maplibre-gl';
import {MapLibreOverlay} from '@deck.gl/maplibre';
import {VERSION as DECK_VERSION, Layer, View, Viewport} from '@deck.gl/core';
import {atlasMapLibreViewMatrices} from './atlas-maplibre-matrices';
import type {AtlasMetricRoot} from './atlas-metric-space';
import {metricProjectionParameters} from './atlas-metric-space';

export const ATLAS_MAPLIBRE_BRIDGE_MAPLIBRE_VERSION = '6.15.0';
export const ATLAS_MAPLIBRE_BRIDGE_DECK_VERSION = '9.4.0';
export const ATLAS_MAPLIBRE_BRIDGE_VIEW_ID = 'maplibre';

export interface AtlasMapLibreFrame {
  readonly mvp: readonly number[];
  readonly projection: readonly number[];
  readonly mainMatrix: readonly number[];
  readonly nearZ: number;
  readonly farZ: number;
  readonly revision: number;
}

export interface AtlasMapLibreBridgeOptions {
  map: MapLibreMap;
  root: AtlasMetricRoot;
  /** Canonical metres represented by the local Deck coordinate origin. */
  sceneOrigin: Readonly<{x: number; y: number}>;
  /** Sources that must be ready before Deck layer groups are reconciled. */
  sourceIds?: readonly string[];
  layerId?: string;
  onError?: (error: unknown) => void;
  /** Maximum wait for Deck's public onLoad readiness callback. Defaults to 15 seconds. */
  deckReadyTimeoutMs?: number;
  /** A narrow seam for deterministic lifecycle tests. Production uses the pinned overlay. */
  createOverlay?: (props: OverlayProps) => MapLibreOverlay;
}

type AtlasView = View<any, any>;
type BridgeLayer = Layer<any>;
type OverlayProps = {
  interleaved: true;
  layers: BridgeLayer[];
  views: AtlasView;
  onLoad: () => void;
  onError: (error: Error) => void;
};

interface OverlayRuntime {
  setProps(props: {layers?: BridgeLayer[]; views?: AtlasView}): void;
  _handleStyleChange?: (this: OverlayRuntime) => void;
  _map?: MapLibreMap;
  _deck?: unknown;
  _props?: {layers?: BridgeLayer[]; views?: AtlasView};
}

interface PendingWait {
  cancel(reason: Error): void;
}

interface DeckReadyWait extends PendingWait {
  promise: Promise<void>;
  resolve(): void;
}

function sameMatrix(left: readonly number[] | undefined, right: readonly number[]): boolean {
  return !!left && left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneFrame(frame: AtlasMapLibreFrame, revision: number): AtlasMapLibreFrame {
  return Object.freeze({
    mvp: Object.freeze([...frame.mvp]),
    projection: Object.freeze([...frame.projection]),
    mainMatrix: Object.freeze([...frame.mainMatrix]),
    nearZ: frame.nearZ,
    farZ: frame.farZ,
    revision
  });
}

/**
 * Owns one MapLibre/deck.gl interleaved bridge instance. Canonical geometry is
 * expressed relative to the immutable sceneOrigin in root-normalized metres;
 * the camera remains wholly owned by MapLibre.
 */
export class AtlasMapLibreBridge {
  readonly root: Readonly<AtlasMetricRoot>;
  readonly sceneOrigin: Readonly<{x: number; y: number}>;
  readonly layerId: string;

  private readonly map: MapLibreMap;
  private readonly sourceIds: readonly string[];
  private readonly onError: (error: unknown) => void;
  private readonly deckReadyTimeoutMs: number;
  private readonly createOverlay: NonNullable<AtlasMapLibreBridgeOptions['createOverlay']>;
  private readonly captureLayer: CustomLayerInterface;
  private readonly waits = new Set<PendingWait>();
  private overlayInstance: OverlayRuntime | null = null;
  private frameSnapshot: AtlasMapLibreFrame | null = null;
  private viewRevision = 0;
  private frameEpoch = 0;
  private capturedFrameEpoch = -1;
  private styleGeneration = 0;
  private disposed = false;
  private attached = false;
  private attaching = false;
  private controlInstalled = false;
  private deckLoaded = false;
  private captureLayerInstalled = false;
  private captureReady = false;
  private frameInvalidationListenersInstalled = false;
  private styleTask: Promise<void> = Promise.resolve();
  private latestError: unknown = null;

  constructor(options: AtlasMapLibreBridgeOptions) {
    const mapVersion = maplibre.getVersion();
    if (mapVersion !== ATLAS_MAPLIBRE_BRIDGE_MAPLIBRE_VERSION || DECK_VERSION !== ATLAS_MAPLIBRE_BRIDGE_DECK_VERSION) {
      throw new Error(`Unsupported Atlas map bridge versions: MapLibre ${mapVersion}, deck.gl ${DECK_VERSION}`);
    }
    this.map = options.map;
    metricProjectionParameters(options.root);
    const originX = (options.sceneOrigin.x - options.root.x) / options.root.size;
    const originY = (options.sceneOrigin.y - options.root.y) / options.root.size;
    if (!Number.isFinite(options.sceneOrigin.x) || !Number.isFinite(options.sceneOrigin.y)
      || !Number.isFinite(originX) || !Number.isFinite(originY)) {
      throw new Error('Atlas scene origin and root-relative offsets must be finite');
    }
    this.root = Object.freeze({...options.root});
    this.sceneOrigin = Object.freeze({...options.sceneOrigin});
    this.sourceIds = Object.freeze([...(options.sourceIds ?? [])]);
    this.layerId = options.layerId ?? 'atlas-projection-diagnostic';
    this.onError = options.onError ?? (error => console.error('Atlas MapLibre bridge error', error));
    this.deckReadyTimeoutMs = options.deckReadyTimeoutMs ?? 15_000;
    if (!Number.isFinite(this.deckReadyTimeoutMs) || this.deckReadyTimeoutMs <= 0) {
      throw new Error('Atlas Deck readiness timeout must be a positive finite duration');
    }
    this.createOverlay = options.createOverlay ?? (props => new MapLibreOverlay(props as unknown as ConstructorParameters<typeof MapLibreOverlay>[0]));
    this.captureLayer = {
      id: this.layerId,
      type: 'custom',
      renderingMode: '3d',
      render: (_gl, input) => this.captureFrame(input)
    };
  }

  get frame(): AtlasMapLibreFrame | null { return this.frameSnapshot; }
  /** True only after the capture layer rendered following the latest view/style invalidation. */
  get frameUsable(): boolean {
    return this.attached && this.latestError === null && this.frameSnapshot !== null
      && this.capturedFrameEpoch === this.frameEpoch;
  }
  get overlay(): MapLibreOverlay | null { return this.overlayInstance as unknown as MapLibreOverlay | null; }
  get error(): unknown { return this.latestError; }

  /** Install the matrix capture before Deck's MapLibre layer group. */
  async attach(layers: Layer[]): Promise<MapLibreOverlay> {
    this.assertUsable();
    if (this.attached || this.attaching || this.overlayInstance) throw new Error('Atlas MapLibre bridge is already attached or attaching');
    this.attaching = true;
    let overlay: OverlayRuntime | null = null;
    let deckReady: DeckReadyWait | null = null;
    try {
      this.installFrameInvalidationListeners();
      await this.waitForStyle();
      await this.waitForSources();
      this.assertUsable();
      if (this.map.getLayer(this.layerId)) throw new Error(`Atlas capture layer id is already owned by another layer: ${this.layerId}`);
      this.addCaptureLayer();
      this.map.triggerRepaint();
      await this.waitForFrame();
      this.assertUsable();

      deckReady = this.createDeckReadyWait();
      // Observe immediately because construction and addControl can fail synchronously.
      void deckReady.promise.catch(() => undefined);
      overlay = this.createOverlay({interleaved: true, layers, views: this.makeView(),
        onLoad: () => {
          if (this.disposed) return;
          this.deckLoaded = true;
          deckReady?.resolve();
        },
        onError: error => {
          const failure = error instanceof Error ? error : new Error(String(error));
          this.latestError = failure;
          try { this.onError(failure); } catch { /* Keep the Deck error authoritative. */ }
          deckReady?.cancel(failure);
        }}) as unknown as OverlayRuntime;
      this.installStyleAdapter(overlay);
      this.overlayInstance = overlay;
      this.map.on('style.load', this.onStyleLoad);
      this.map.addControl(overlay as unknown as MapLibreOverlay);
      this.controlInstalled = true;
      await deckReady.promise;
      this.assertUsable();
      if (this.latestError) throw this.latestError;
      await this.waitForStyleReconciliation();
      this.assertUsable();
      this.attached = true;
      // Reconcile through the package's public path once its private style hook
      // has been replaced; setProps retains resolveMapLibreLayerGroups behavior.
      overlay.setProps({layers, views: this.makeView()});
      return overlay as unknown as MapLibreOverlay;
    } catch (error) {
      deckReady?.cancel(error instanceof Error ? error : new Error(String(error)));
      this.map.off('style.load', this.onStyleLoad);
      this.removeFrameInvalidationListeners();
      if (overlay?._map === this.map) {
        try { this.map.removeControl(overlay as unknown as MapLibreOverlay); }
        catch (cleanupError) { this.onError(cleanupError); }
      }
      this.controlInstalled = false;
      this.attached = false;
      this.deckLoaded = false;
      this.overlayInstance = null;
      this.removeOwnedCaptureLayer();
      throw error;
    } finally {
      this.attaching = false;
    }
  }

  setLayers(layers: Layer[]): void {
    this.assertUsable();
    if (!this.overlayInstance || !this.attached) throw new Error('Atlas MapLibre bridge is not attached');
    this.overlayInstance.setProps({layers, views: this.makeView()});
  }

  /** Resolve when the latest full-style reload has rebuilt sources and layers. */
  async waitForStyleReconciliation(): Promise<void> {
    let task: Promise<void>;
    do {
      task = this.styleTask;
      await task;
    } while (task !== this.styleTask);
    if (this.latestError) throw this.latestError;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const reason = new Error('Atlas MapLibre bridge disposed');
    for (const wait of [...this.waits]) wait.cancel(reason);
    this.map.off('style.load', this.onStyleLoad);
    this.removeFrameInvalidationListeners();
    if (this.controlInstalled && this.overlayInstance) this.map.removeControl(this.overlayInstance as unknown as MapLibreOverlay);
    this.controlInstalled = false;
    this.attached = false;
    this.deckLoaded = false;
    this.overlayInstance = null;
    this.removeOwnedCaptureLayer();
    this.captureReady = false;
    this.capturedFrameEpoch = -1;
    this.frameSnapshot = null;
  }

  private readonly onStyleLoad = (): void => {
    if (this.disposed || !this.overlayInstance) return;
    this.invalidateFrame();
    const generation = ++this.styleGeneration;
    this.latestError = null;
    this.styleTask = this.reconcileStyle(generation).catch(error => {
      if (this.disposed || generation !== this.styleGeneration) return;
      this.latestError = error;
      this.onError(error);
    });
  };

  private async reconcileStyle(generation: number): Promise<void> {
    this.captureReady = false;
    await this.waitForSources();
    this.assertGeneration(generation);
    if (!this.map.getLayer(this.layerId)) {
      this.addCaptureLayer();
    }
    this.map.triggerRepaint();
    await this.waitForFrame();
    this.assertGeneration(generation);
    const overlay = this.overlayInstance;
    if (overlay && this.deckLoaded && overlay._map === this.map && overlay._deck) {
      // Public setProps re-runs deck.gl's layer-group resolver after style.load.
      overlay.setProps({layers: overlay._props?.layers ?? [], views: this.makeView()});
    }
  }

  private installStyleAdapter(overlay: OverlayRuntime): void {
    if (typeof overlay._handleStyleChange !== 'function') {
      throw new Error('Pinned MapLibreOverlay private style hook is unavailable');
    }
    overlay._handleStyleChange = (): void => {
      if (this.deckLoaded && overlay._map && overlay._deck) {
        overlay.setProps({layers: overlay._props?.layers ?? [], views: this.makeView()});
      }
    };
  }

  private captureFrame(input: CustomRenderMethodInput): void {
    if (this.disposed) return;
    this.captureReady = true;
    this.capturedFrameEpoch = this.frameEpoch;
    const next = {
      mvp: Array.from(input.modelViewProjectionMatrix),
      projection: Array.from(input.projectionMatrix),
      mainMatrix: Array.from(input.defaultProjectionData.mainMatrix),
      nearZ: input.nearZ,
      farZ: input.farZ,
      revision: 0
    };
    const previous = this.frameSnapshot;
    if (!previous || !sameMatrix(previous.projection, next.projection) || !sameMatrix(previous.mainMatrix, next.mainMatrix)) {
      this.frameSnapshot = cloneFrame(next, ++this.viewRevision);
      if (this.overlayInstance && this.attached) this.overlayInstance.setProps({views: this.makeView()});
    }
    this.resolveFrameWaiters();
  }

  /**
   * MapLibre emits `move` before its queued repaint, and `resize` synchronously
   * after updating the transform. Keep the old matrices available to Deck while
   * marking them unusable for picks until the custom layer captures a new frame.
   */
  private readonly invalidateFrame = (): void => { this.frameEpoch++; };

  private installFrameInvalidationListeners(): void {
    if (this.frameInvalidationListenersInstalled) return;
    this.map.on('move', this.invalidateFrame);
    this.map.on('resize', this.invalidateFrame);
    // MapLibre fires this synchronously from setStyle's full-style load path,
    // before style.load (which may arrive after JSON/workers finish).
    this.map.on('styledataloading', this.invalidateFrame);
    this.frameInvalidationListenersInstalled = true;
  }

  private removeFrameInvalidationListeners(): void {
    if (!this.frameInvalidationListenersInstalled) return;
    this.map.off('move', this.invalidateFrame);
    this.map.off('resize', this.invalidateFrame);
    this.map.off('styledataloading', this.invalidateFrame);
    this.frameInvalidationListenersInstalled = false;
  }

  private makeView(): AtlasView {
    const bridge = this;
    class AtlasMapLibreView extends View<any, any> {
      getViewportType(): typeof Viewport { return Viewport; }
      protected get ControllerType(): never { return class NoController {} as never; }

      makeViewport({width, height}: {width: number; height: number; viewState?: unknown}): Viewport {
        const frame = bridge.frameSnapshot;
        if (!frame) throw new Error('MapLibre custom-layer frame has not been captured');
        const matrices = atlasMapLibreViewMatrices(frame, bridge.root, bridge.sceneOrigin);
        if (!matrices) throw new Error('MapLibre captured an invalid Atlas camera matrix');
        const {projectionMatrix, viewMatrix} = matrices;
        return new Viewport({id: this.id, width, height, viewMatrix, projectionMatrix});
      }
    }
    return new AtlasMapLibreView({id: ATLAS_MAPLIBRE_BRIDGE_VIEW_ID, matrixRevision: this.viewRevision} as any);
  }

  private addCaptureLayer(): void {
    const existing = this.map.getLayer(this.layerId);
    if (existing) {
      if (this.isOwnedCaptureLayer(existing)) {
        this.captureLayerInstalled = true;
        return;
      }
      throw new Error(`Atlas capture layer id is already owned by another layer: ${this.layerId}`);
    }
    const firstDeckGroup = this.map.getLayersOrder().find(id => id.startsWith('deck-maplibre-layer-group'));
    this.map.addLayer(this.captureLayer, firstDeckGroup);
    const installed = this.map.getLayer(this.layerId);
    if (!installed || !this.isOwnedCaptureLayer(installed)) throw new Error(`MapLibre did not install the Atlas capture layer: ${this.layerId}`);
    this.captureLayerInstalled = true;
  }

  private isOwnedCaptureLayer(layer: unknown): boolean {
    if (layer === this.captureLayer) return true;
    return !!layer && typeof layer === 'object'
      && (layer as {implementation?: unknown}).implementation === this.captureLayer;
  }

  private removeOwnedCaptureLayer(): void {
    if (this.captureLayerInstalled && this.isOwnedCaptureLayer(this.map.getLayer(this.layerId))) {
      this.map.removeLayer(this.layerId);
    }
    this.captureLayerInstalled = false;
  }

  private async waitForStyle(): Promise<void> {
    if (this.map.isStyleLoaded()) return;
    await this.waitForEvent('style.load', 15_000, 'MapLibre style-load timeout');
  }

  private async waitForSources(): Promise<void> {
    const missing = () => this.sourceIds.filter(id => !this.map.getSource(id) || !this.map.isSourceLoaded(id));
    if (!missing().length) return;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.map.off('sourcedata', onSourceData);
        this.waits.delete(waiter);
        error ? reject(error) : resolve();
      };
      const onSourceData = (event: {dataType?: string; sourceId?: string}): void => {
        if (event.dataType === 'source' && this.sourceIds.includes(event.sourceId ?? '') && !missing().length) finish();
      };
      const timer = setTimeout(() => finish(new Error(`MapLibre source-ready timeout: ${missing().join(', ')}`)), 15_000);
      const waiter: PendingWait = {cancel: finish};
      this.waits.add(waiter);
      this.map.on('sourcedata', onSourceData);
    });
  }

  private waitForEvent(type: 'style.load', timeoutMs: number, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.map.off(type, onEvent);
        this.waits.delete(waiter);
        error ? reject(error) : resolve();
      };
      const onEvent = (): void => finish();
      const timer = setTimeout(() => finish(new Error(message)), timeoutMs);
      const waiter: PendingWait = {cancel: finish};
      this.waits.add(waiter);
      this.map.once(type, onEvent);
    });
  }

  private waitForFrame(): Promise<void> {
    if (this.captureReady) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let resolveWait: (() => void) | null = null;
      const timer = setTimeout(() => {
        if (resolveWait) this.frameWaiters.delete(resolveWait);
        this.waits.delete(waiter);
        reject(new Error('MapLibre custom-layer frame timeout'));
      }, 10_000);
      const waiter: PendingWait = {
        cancel: reason => {
          clearTimeout(timer);
          if (resolveWait) this.frameWaiters.delete(resolveWait);
          this.waits.delete(waiter);
          reject(reason);
        }
      };
      resolveWait = () => {
        clearTimeout(timer);
        this.frameWaiters.delete(resolveWait!);
        this.waits.delete(waiter);
        resolve();
      };
      this.frameWaiters.add(resolveWait);
      this.waits.add(waiter);
    });
  }

  private createDeckReadyWait(): DeckReadyWait {
    let resolvePromise!: () => void;
    let rejectPromise!: (error: Error) => void;
    let settled = false;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      this.waits.delete(waiter);
      if (error) rejectPromise(error);
      else resolvePromise();
    };
    const waiter: DeckReadyWait = {
      promise,
      resolve: () => finish(),
      cancel: error => finish(error)
    };
    timer = setTimeout(() => finish(new Error('Deck MapLibre overlay readiness timeout')), this.deckReadyTimeoutMs);
    this.waits.add(waiter);
    return waiter;
  }

  private readonly frameWaiters = new Set<() => void>();

  private resolveFrameWaiters(): void {
    for (const resolve of [...this.frameWaiters]) resolve();
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('Atlas MapLibre bridge is disposed');
  }

  private assertGeneration(generation: number): void {
    this.assertUsable();
    if (generation !== this.styleGeneration) throw new Error('Atlas MapLibre style reconciliation was superseded');
  }
}
