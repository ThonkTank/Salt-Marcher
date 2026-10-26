import { terrainCoverageBox, terrainCoverageLevel } from './terrain-coverage';
import type { AtlasDeckVegetation } from './atlas-deck-vegetation';
import { lengthLabel } from './atlas-units';
import { atlasSurfaceRequestKey } from './atlas-surface-request-key';
import { reuseAtlasSurfaceTile } from './atlas-surface-reuse';
import { terrainObjectSources, type TerrainObject } from './terrain-objects';
import { AtlasObjectGeometry } from './atlas-object-geometry';
import { atlasWorkplaneHeight } from './atlas-workplane';
import type { AtlasReadRequest } from './atlas-read-request';
import { terrainTraceMeasure } from './terrain-timing';
import type { AtlasPresentationHost } from './atlas-presentation-host';
import type { AtlasPresentation } from './atlas-presentation';
import type { AtlasCanvasScene } from './atlas-canvas-scene';
import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';
import type { AtlasRenderView } from './campaign-atlas-contracts';
import type { Point } from '../shared/contracts';
import type { AtlasDeckSurface } from './atlas-deck-surface';
import type { AtlasDeckDrawing } from './atlas-deck-drawing';
import {
  AtlasSurfaceTileStream,
  atlasSurfaceTileFetcher,
  type AtlasSurfaceTile,
} from './atlas-surface-tile-stream';
import { atlasTerrainTileModel, atlasTerrainRayIntersects } from './atlas-terrain-tile-model';
import { AtlasSurfaceDraft } from './atlas-surface-draft';
import { DEFAULT_TERRAIN_STYLE, type TerrainStyle } from './terrain-relief';
import { gridHeight, type TerrainView } from './terrain-spatial-model';
import { atlasTerrainRay } from './atlas-terrain-ray';
import type { HeightStroke } from './terrain-brush';
import type { AtlasMetricFrame } from './atlas-metric-camera';

type Host = AtlasPresentationHost;
/** Owns the GPU presentation; author input and canonical writes remain in the controller. */
export class AtlasRasterPresentation implements AtlasPresentation {
  active = false;
  ready = false;
  private firstSurface = new Set<(ready: boolean) => void>();
  private settleFirst(ready: boolean) {
    for (const resolve of this.firstSurface) resolve(ready);
    this.firstSurface.clear();
  }
  private container: HTMLDivElement | null = null;
  private surface: AtlasDeckSurface | null = null;
  private Drawing: typeof AtlasDeckDrawing | null = null;
  private creating: Promise<void> | null = null;
  private stream = new AtlasSurfaceTileStream({
    maxTiles: 32,
    maxRetainedTiles: 64,
    maxBytes: 64 * 1024 * 1024,
  });
  private tiles: readonly AtlasSurfaceTile[] = [];
  private draft: AtlasSurfaceDraft | null = null;
  private dirty = false;
  private draftWasDirty = false;
  private preferDetail = false;
  private gesturing = false;
  private frozen: AtlasMetricFrame | null = null;
  private pickTiles: readonly AtlasSurfaceTile[] | null = null;
  private frame: LandscapeBox = { x: 0, y: 0, width: 256, height: 256 };
  private focusHeightM = 0;
  private perception = false;
  private tilt = 0;
  private rotation = 0;
  private exaggeration = 1;
  private contours = 0;
  private refreshFence = '';
  private token = '';
  private revision = -1;
  private fence = '';
  private request = '';
  private generation = 0;
  private displayedFrame = 0;
  private style: Readonly<TerrainStyle> = DEFAULT_TERRAIN_STYLE;
  private map: AtlasDeckDrawing | null = null;
  private transient: AtlasDeckDrawing | null = null;
  private scene: {
    scene: AtlasCanvasScene;
    origin: Point;
    images: ReadonlyMap<string, CanvasImageSource>;
  } | null = null;
  private lastPoint: Point = { x: 0, y: 0 };
  private failed = false;
  private Vegetation: typeof AtlasDeckVegetation | null = null;
  private vegetation: AtlasDeckVegetation | null = null;
  private vegetationRecords: LandscapeRecord[] | undefined;
  private objectLayer = new AtlasObjectGeometry();
  private objects: TerrainObject[] = [];
  private objectKey = '';
  private objectRead: { token: string; control: AtlasReadRequest } | null = null;
  private controls: HTMLDivElement;
  private toggle: HTMLButtonElement;
  private retry: HTMLButtonElement;
  constructor(
    private input: HTMLCanvasElement,
    private host: Host,
  ) {
    this.controls = document.createElement('div');
    this.controls.id = 'atlas-terrain-view';
    this.controls.innerHTML =
      '<label>Neigung<input id="terrain-tilt" type="range" min="0" max="75" value="0"></label><label>Drehung<input id="terrain-rotation" type="range" min="-180" max="180" value="0"></label><label>Höhenüberhöhung<input id="terrain-exaggeration" type="range" min="0.25" max="8" step="0.25" value="1"></label><button id="terrain-top" type="button">Zur Draufsicht</button>';
    this.toggle = document.createElement('button');
    this.toggle.id = 'atlas-terrain-tilt';
    this.toggle.textContent = 'Atlas kippen';
    this.toggle.onclick = () => this.setPose(this.tilt ? 0 : 45);
    this.retry = document.createElement('button');
    this.retry.id = 'atlas-camera-retry';
    this.retry.type = 'button';
    this.retry.textContent = 'Atlaskamera erneut laden';
    this.retry.hidden = true;
    this.retry.onclick = () => void this.recover();
    document.getElementById('atlas-view-popup')!.append(this.toggle, this.controls, this.retry);
    this.controls.querySelector<HTMLButtonElement>('#terrain-top')!.onclick = () =>
      this.setPose(0, 0);
    for (const [kind, label] of [
      ['road', 'Straße planen'],
      ['river', 'Fluss planen'],
    ] as const) {
      const button = document.createElement('button');
      button.id = 'terrain-plan-' + kind;
      button.textContent = label;
      button.onclick = () => {
        if (this.host.hasDraft()) {
          this.host.error(Error('Zuerst den Pinselzug abschließen oder verwerfen.'));
          return;
        }
        void this.host.route?.(kind).catch(this.host.error);
      };
      this.controls.append(button);
    }
    for (const name of ['tilt', 'rotation', 'exaggeration'] as const)
      this.controls.querySelector<HTMLInputElement>('#terrain-' + name)!.oninput = (e) => {
        if (this.gesturing || this.host.hasDraft()) return;
        this[name] = Number((e.target as HTMLInputElement).value);
        this.reframe(this.frame);
        this.host.redraw();
      };
    input.parentElement!.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target !== input || !this.active || this.host.navigation(e)) return;
        if (!this.ready || !this.authorPoint(e.clientX, e.clientY)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    new ResizeObserver(() => {
      this.place();
      this.reframe(this.frame);
    }).observe(input);
  }
  get needsTerrainRaster() {
    return (document.getElementById('atlas-perception') as HTMLInputElement).checked;
  }
  get localDraft() {
    return this.dirty;
  }
  private pose() {
    return {
      focus: { x: this.frame.x + this.frame.width / 2, y: this.frame.y + this.frame.height / 2 },
      focusHeightM: this.focusHeightM,
      metersPerPixel: this.frame.width / Math.max(1, this.input.clientWidth),
      tilt: this.tilt,
      rotation: this.rotation,
      exaggeration: this.exaggeration,
    };
  }
  private place() {
    if (this.container)
      Object.assign(this.container.style, {
        left: this.input.offsetLeft + 'px',
        top: this.input.offsetTop + 'px',
        width: this.input.clientWidth + 'px',
        height: this.input.clientHeight + 'px',
      });
  }
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    this.generation++;
    if (!active) {
      this.pauseReads();
      this.objects = [];
      this.pickTiles = null;
      this.frozen = null;
      this.gesturing = false;
      this.objectKey = '';
      this.objectLayer.dispose();
      this.vegetation?.dispose();
      this.vegetationRecords = undefined;
      this.settleFirst(false);
      this.ready = false;
      this.stream.dispose();
      this.stream = new AtlasSurfaceTileStream({
        maxTiles: 32,
        maxRetainedTiles: 64,
        maxBytes: 64 * 1024 * 1024,
      });
      this.surface?.dispose();
      this.surface = null;
      this.container?.remove();
      this.container = null;
      this.tiles = [];
      this.draft = null;
      this.dirty = false;
      this.preferDetail = false;
      this.scene = null;
      this.map?.dispose();
      this.map = null;
      this.transient?.dispose();
      this.transient = null;
      this.request = '';
      this.revision = -1;
      this.fence = '';
      this.input.style.background = '';
      delete this.input.dataset.terrainReady;
      delete this.input.dataset.terrainDraft;
      return;
    }
    this.failed = false;
    this.container = document.createElement('div');
    this.container.id = 'atlas-terrain-spatial';
    this.container.style.cssText = 'position:absolute;pointer-events:none;z-index:0';
    this.input.parentElement!.append(this.container);
    this.place();
    this.input.style.background = 'transparent';
    this.input.style.position = 'relative';
    this.input.style.zIndex = '1';
    this.input.dataset.renderer = 'deck';
    this.input.dataset.terrainView = 'raster';
    this.input.dataset.terrainReady = 'loading';
    const container = this.container;
    this.creating = import('./atlas-deck-runtime')
      .then(async (runtime) => {
        this.Drawing = runtime.AtlasDeckDrawing;
        this.Vegetation = runtime.AtlasDeckVegetation;
        this.vegetation = new this.Vegetation(this.vegetationRecords ?? []);
        return runtime.AtlasDeckSurface.create({
          container,
          camera: this.pose(),
          model: {
            objects: [],
            targets: new Map(),
            coverage: { complete: true, supportedKinds: ['terrain'], unsupported: [] },
            verticalExaggeration: 1,
          },
          externalInput: true,
          onError: (e) => this.fail(e),
        });
      })
      .then((surface) => {
        if (!this.active || this.container !== container) {
          surface.dispose();
          return;
        }
        this.surface = surface;
        this.show();
        this.repaint();
      })
      .catch((e) => {
        if (this.container === container) this.fail(e);
      });
  }
  private fail(error: unknown) {
    this.retry.hidden = false;
    this.pauseReads();
    if (this.gesturing) this.host.cancel();
    this.settleFirst(false);
    console.error(error);
    this.failed = true;
    this.ready = false;
    this.input.dataset.terrainReady = 'failed';
    this.host.error(error);
  }
  private async recover() {
    const surface = this.surface;
    if (!surface) return;
    this.retry.disabled = true;
    try {
      await surface.recover();
      if (this.surface !== surface) return;
      this.failed = false;
      this.ready = true;
      this.retry.hidden = true;
      this.input.dataset.terrainReady = 'ready';
      this.show();
      this.request = '';
      this.objectKey = '';
      this.refreshFence = '';
      void this.load();
      this.host.redraw();
    } catch (error) {
      if (this.surface === surface) this.fail(error);
    } finally {
      this.retry.disabled = false;
    }
  }
  async openSurface(
    token: string,
    frame: LandscapeBox,
    revision: number,
    contours: number,
    fence?: string,
  ) {
    this.token = token;
    this.revision = revision;
    this.fence = fence ?? '';
    this.frame = { ...frame };
    this.contours = contours;
    this.setActive(true);
    await this.creating;
    if (!this.fence) return false;
    const ready = new Promise<boolean>((resolve) => this.firstSurface.add(resolve));
    void this.load();
    if (this.ready) this.settleFirst(true);
    return ready;
  }
  sync(
    token: string,
    frame: LandscapeBox,
    revision: number,
    _objects: LandscapeRecord[],
    contours: number,
    atlas?: AtlasRenderView,
    display?: { mpp: number; roofs: boolean; scopeId: string | null },
  ) {
    const perception = this.needsTerrainRaster;
    if ((this.token && token !== this.token) || perception !== this.perception)
      this.setActive(false);
    this.perception = perception;
    if (perception) {
      this.token = token;
      this.revision = revision;
      this.frame = { ...frame };
      this.tilt = 0;
      this.rotation = 0;
      this.focusHeightM = 0;
      const starting = !this.active;
      this.setActive(true);
      this.reframe(frame);
      if (starting)
        void this.creating
          ?.then(async () => {
            const surface = this.surface;
            if (!surface) return;
            this.show();
            this.repaint();
            await surface.waitForFrame();
            if (this.surface !== surface || !this.perception || this.failed) return;
            this.ready = true;
            this.input.dataset.terrainReady = 'ready';
            this.settleFirst(true);
            this.host.redraw();
          })
          .catch((e) => this.fail(e));
      return;
    }
    if (this.token && token !== this.token) this.setActive(false);
    this.token = token;
    this.contours = contours;
    if (!this.active) this.setActive(true);
    if (this.gesturing || this.dirty || this.host.writing() || revision < this.revision) {
      if (!this.gesturing) this.reframe(frame);
      return;
    }
    this.revision = revision;
    this.fence = atlas?.region?.fence ?? this.fence;
    this.reframe(frame);
    const style =
      atlas?.region?.landscape?.terrainStyle ??
      _objects.find((r) => r.terrainSettings?.style)?.terrainSettings?.style;
    if (style && style !== this.style) {
      this.style = style;
      this.show();
    }
    if (this.vegetationRecords !== _objects) {
      this.vegetationRecords = _objects;
      this.vegetation?.dispose();
      this.vegetation = this.Vegetation ? new this.Vegetation(_objects) : null;
      this.drawings();
    }
    if (atlas) void this.loadObjects(atlas, display);
    void this.load();
  }
  reframe(frame: LandscapeBox, _draw = true) {
    if (
      frame.x !== this.frame.x ||
      frame.y !== this.frame.y ||
      frame.width !== this.frame.width ||
      frame.height !== this.frame.height
    )
      this.preferDetail = false;
    if (
      !this.gesturing &&
      (frame.x + frame.width / 2 !== this.frame.x + this.frame.width / 2 ||
        frame.y + frame.height / 2 !== this.frame.y + this.frame.height / 2)
    )
      this.focusHeightM = this.height({
        x: frame.x + frame.width / 2,
        y: frame.y + frame.height / 2,
      });
    this.frame = { ...frame };
    this.place();
    if (this.surface) {
      this.surface.setCamera(this.pose());
      if (!this.gesturing && !this.dirty && !this.host.writing()) void this.load();
    }
  }
  private async load() {
    if (
      this.needsTerrainRaster ||
      !this.active ||
      !this.fence ||
      this.refreshFence === this.fence ||
      this.failed ||
      this.gesturing ||
      this.dirty ||
      this.host.writing()
    )
      return;
    const pose = this.pose(),
      box = this.tilt
        ? terrainCoverageBox(this.frame, terrainCoverageLevel(this.tilt))
        : this.frame;
    const preload = this.tilt
      ? undefined
      : {
          x: this.frame.x - this.frame.width / 2,
          y: this.frame.y - this.frame.height / 2,
          width: this.frame.width * 2,
          height: this.frame.height * 2,
        };
    const key = atlasSurfaceRequestKey(
      this.token,
      this.revision,
      this.fence,
      box,
      pose.metersPerPixel,
      32,
      this.tilt ? this.frame : undefined,
      preload,
    );
    if (key === this.request) return;
    this.request = key;
    const generation = ++this.generation;
    // Retain the useful old image, but its detail flag cannot qualify the new camera.
    this.input.dataset.terrainQuality = 'overview';
    delete this.input.dataset.terrainRendered;
    try {
      await this.creating;
      if (generation !== this.generation) return;
      await this.stream.load(
        {
          box,
          preload,
          maxTiles: 32,
          focus: this.tilt ? this.frame : undefined,
          metersPerPixel: pose.metersPerPixel,
          revision: this.revision,
          source: this.fence,
        },
        atlasSurfaceTileFetcher(window.campaign, this.token, 'workbench-surface'),
        (frame) => {
          if (generation !== this.generation || this.gesturing || this.dirty || this.host.writing())
            return;
          // Keep the useful old image during source reconciliation, never publish
          // an empty frame between a local gesture and its canonical tiles.
          if (
            !frame.tiles.length ||
            this.failed ||
            (!frame.overviewComplete && this.ready) ||
            (this.preferDetail && !frame.complete)
          )
            return;
          if (frame.complete) this.preferDetail = false;
          const previous = new Map(this.tiles.map((t) => [JSON.stringify(t.tile), t]));
          this.tiles = frame.tiles.map((t) =>
            reuseAtlasSurfaceTile(previous.get(JSON.stringify(t.tile)), t),
          );
          if (!this.ready) {
            this.focusHeightM = this.height({
              x: this.frame.x + this.frame.width / 2,
              y: this.frame.y + this.frame.height / 2,
            });
            this.surface?.setCamera(this.pose());
          }
          this.input.dataset.terrainQuality = frame.complete ? 'detail' : 'overview';
          this.show();
          if (frame.complete && this.scene) {
            const scene = this.scene;
            this.scene = null;
            this.paint(scene.scene, scene.origin, scene.images);
          }
          this.input.dataset.terrainCache = JSON.stringify(this.stream.statistics);
          this.input.dataset.terrainGpu = JSON.stringify(this.surface?.gpuMemory);
          if (!this.ready && frame.overviewComplete)
            void this.surface
              ?.waitForFrame()
              .then(() => {
                if (generation === this.generation && !this.failed) {
                  this.ready = true;
                  this.settleFirst(true);
                  this.input.dataset.terrainReady = 'ready';
                  this.host.redraw();
                }
              })
              .catch((e) => {
                if (generation === this.generation) this.fail(e);
              });
        },
      );
      if (generation === this.generation)
        this.input.dataset.terrainCache = JSON.stringify(this.stream.statistics);
    } catch (e) {
      if (generation !== this.generation) return;
      if (String(e).includes('durch neuere Anfrage ersetzt')) {
        this.request = '';
        return;
      }
      if (
        String(e).includes('inzwischen geändert') &&
        this.refreshFence !== this.fence &&
        this.host.refresh
      ) {
        this.refreshFence = this.fence;
        this.pauseReads();
        this.settleFirst(false);
        try {
          await this.host.refresh();
        } catch (error) {
          this.fail(error);
        }
        return;
      }
      this.fail(e);
    }
  }
  private async loadObjects(
    atlas: AtlasRenderView,
    display?: { mpp: number; roofs: boolean; scopeId: string | null },
  ) {
    // A pending geometry read owns recovery of this obsolete source.
    if (this.failed || this.refreshFence === this.fence) return;
    const sources = terrainObjectSources(atlas, display);
    const key = JSON.stringify([this.fence, sources]);
    if (key === this.objectKey) return;
    this.objectKey = key;
    if (this.objectRead)
      void window.campaign
        .atlasCancelRead(this.objectRead.token, this.objectRead.control)
        .catch(() => {});
    const read = {
      token: this.token,
      fence: this.fence,
      revision: this.revision,
      control: { owner: 'workbench-objects', id: crypto.randomUUID() },
    };
    this.objectRead = read;
    if (!sources.length) {
      this.objects = [];
      this.objectLayer.dispose();
      this.repaint();
      this.objectRead = null;
      return;
    }
    try {
      const view = {
        box: { ...this.frame },
        frame: { ...this.frame },
        focusM: this.focusHeightM,
        tilt: this.tilt,
        rotation: this.rotation,
        exaggeration: this.exaggeration,
        columns: 2,
        rows: 2,
      };
      const reply = await window.campaign.atlasTerrainProjection(
        this.token,
        {
          product: 'height',
          revision: this.revision,
          fence: this.fence,
          view,
          objects: sources,
          width: 16,
          height: 16,
          displayMpp: this.pose().metersPerPixel,
          contours: 0,
        },
        'view',
        read.control,
      );
      if (this.objectRead !== read || read.fence !== this.fence || read.revision !== this.revision)
        return;
      if (!reply.ok) throw Error(reply.error);
      if (reply.value.revision !== this.revision || reply.value.fence !== this.fence) return;
      this.objects = reply.value.objects ?? [];
      this.repaint();
      this.host.redraw();
    } catch (error) {
      if (this.objectRead === read) {
        if (String(error).includes('durch neuere Anfrage ersetzt')) this.objectKey = '';
        else if (
          String(error).includes('inzwischen geändert') &&
          this.refreshFence !== this.fence &&
          this.host.refresh
        ) {
          this.refreshFence = this.fence;
          this.pauseReads();
          await this.host.refresh();
        } else this.fail(error);
      }
    } finally {
      if (this.objectRead === read) this.objectRead = null;
    }
  }
  private repaint() {
    if (this.scene) {
      const { scene, origin, images } = this.scene;
      this.scene = null;
      this.paint(scene, origin, images);
    }
  }
  private show() {
    if (!this.surface) return;
    this.surface.setTerrain(
      terrainTraceMeasure('draft.models', () =>
        this.tiles.map((t) => atlasTerrainTileModel(t.terrain, t.material)),
      ),
      this.style,
      { contours: this.contours, seaLevelM: this.tiles[0]?.terrain.projection.grid.seaLevelM ?? 0 },
    );
    this.input.dataset.terrainRevision = String(this.revision);
    // Data arrival is not a rendered frame. Bind native capture/readiness to
    // the actual GPU completion of this exact publication and source request.
    const frame = ++this.displayedFrame,
      request = this.request,
      generation = this.generation;
    const identity = JSON.stringify({
      frame,
      revision: this.revision,
      fence: this.fence,
      quality: this.input.dataset.terrainQuality,
    });
    delete this.input.dataset.terrainRendered;
    void this.surface
      .waitForFrame()
      .then(() => {
        if (
          frame === this.displayedFrame &&
          request === this.request &&
          generation === this.generation
        )
          this.input.dataset.terrainRendered = identity;
      })
      .catch((error) => {
        if (generation === this.generation && this.active) this.fail(error);
      });
  }
  private height(p: Point) {
    const tile = this.tiles.find((t) => {
      const b = t.terrain.projection.grid.view.box;
      return p.x >= b.x && p.y >= b.y && p.x <= b.x + b.width && p.y <= b.y + b.height;
    });
    return tile ? gridHeight(tile.terrain.projection.grid, p) : 0;
  }
  visibility(): TerrainView | undefined {
    return this.tiles.length
      ? {
          box: { ...this.frame },
          frame: { ...this.frame },
          columns: 65,
          rows: 65,
          focusM: this.surface?.camera.focusHeightM ?? 0,
          tilt: this.tilt,
          rotation: this.rotation,
          exaggeration: this.exaggeration,
          projection: 'perspective',
        }
      : undefined;
  }
  private pixel(x: number, y: number) {
    const b = this.input.getBoundingClientRect();
    return { x: x - b.left, y: y - b.top };
  }
  private terrainHit(x: number, y: number) {
    const frame = this.frozen ?? this.surface?.frame,
      segment = frame?.ray(this.pixel(x, y));
    if (!segment) return null;
    let nearest: ReturnType<typeof atlasTerrainRay> = null;
    for (const t of this.pickTiles ?? this.tiles) {
      const model = atlasTerrainTileModel(t.terrain, t.material);
      if (!atlasTerrainRayIntersects(model, segment)) continue;
      const hit = atlasTerrainRay(t.terrain.projection.grid, segment);
      if (hit && (!nearest || hit.segmentFraction < nearest.segmentFraction)) nearest = hit;
    }
    return nearest;
  }
  private planePoint(x: number, y: number, height: number, occlude: boolean) {
    const segment = (this.frozen ?? this.surface?.frame)?.ray(this.pixel(x, y));
    if (!segment) return null;
    const dz = segment[1][2] - segment[0][2];
    if (Math.abs(dz) < 1e-12) return null;
    const t = (height - segment[0][2]) / dz;
    if (
      t < 0 ||
      t > 1 ||
      (occlude && (this.terrainHit(x, y)?.segmentFraction ?? Infinity) < t - 1e-7)
    )
      return null;
    return {
      x: segment[0][0] + t * (segment[1][0] - segment[0][0]),
      y: segment[0][1] + t * (segment[1][1] - segment[0][1]),
    };
  }
  private authorPoint(x: number, y: number) {
    if (this.needsTerrainRaster) return this.planePoint(x, y, 0, false);
    const plane = this.host.workplane?.();
    return plane
      ? this.planePoint(x, y, atlasWorkplaneHeight(plane, this.drawingSurface()), true)
      : (this.terrainHit(x, y)?.point ?? null);
  }
  point(e: { clientX: number; clientY: number }) {
    const p = terrainTraceMeasure('draft.pick', () => this.authorPoint(e.clientX, e.clientY));
    if (p) this.lastPoint = { x: p.x, y: p.y };
    return this.lastPoint;
  }
  navigationPoint(e: { clientX: number; clientY: number }) {
    const plane = this.host.workplane?.();
    return this.planePoint(
      e.clientX,
      e.clientY,
      plane ? atlasWorkplaneHeight(plane, this.drawingSurface()) : this.focusHeightM,
      false,
    );
  }
  screenAnchor(p: Point) {
    const projected = this.surface?.frame.project({
      ...p,
      heightM: this.host.workplane?.()
        ? atlasWorkplaneHeight(this.host.workplane()!, this.drawingSurface())
        : this.height(p),
    });
    return projected
      ? {
          x: this.frame.x + (projected.x / this.input.clientWidth) * this.frame.width,
          y: this.frame.y + (projected.y / this.input.clientHeight) * this.frame.height,
        }
      : null;
  }
  pauseReads() {
    this.generation++;
    this.stream.cancel();
    this.request = '';
    if (this.objectRead) {
      void window.campaign
        .atlasCancelRead(this.objectRead.token, this.objectRead.control)
        .catch(() => {});
      this.objectRead = null;
      this.objectKey = '';
    }
  }
  gesture(active: boolean) {
    this.gesturing = active;
    if (active) {
      this.draftWasDirty = this.dirty;
      this.frozen = this.surface?.frame ?? null;
      this.pickTiles = this.tiles;
      this.draft = new AtlasSurfaceDraft(this.tiles, this.visibility()!, this.style.land);
      this.pauseReads();
    } else {
      this.frozen = null;
      this.pickTiles = null;
      this.draft = null;
    }
  }
  cancelDraft() {
    if (this.draft) {
      this.tiles = this.draft.baseTiles;
      this.dirty = this.draftWasDirty;
      if (!this.dirty) delete this.input.dataset.terrainDraft;
      this.show();
    }
  }
  previewHeight(stroke: HeightStroke) {
    const draft = this.draft;
    if (draft && terrainTraceMeasure('draft.height', () => draft.height(stroke))) {
      this.tiles = draft.tiles;
      this.dirty = true;
      this.input.dataset.terrainDraft = 'height';
      this.show();
    }
  }
  previewColor(record: LandscapeRecord) {
    const draft = this.draft;
    if (draft && terrainTraceMeasure('draft.color', () => draft.color(record))) {
      this.tiles = draft.tiles;
      this.dirty = true;
      this.input.dataset.terrainDraft = 'color';
      this.show();
    }
  }
  /** Called only after the write queue is empty and no gesture is open. */
  reconcile(revision: number, fence: string) {
    if (this.gesturing) return;
    this.preferDetail ||= this.dirty;
    this.dirty = false;
    delete this.input.dataset.terrainDraft;
    this.revision = revision;
    this.fence = fence;
    this.request = '';
    void this.load();
  }
  setContours(interval: number) {
    this.contours = interval;
    this.show();
  }
  setPose(tilt: number, rotation = this.rotation) {
    if (this.gesturing || this.host.hasDraft()) return;
    this.tilt = tilt;
    this.rotation = rotation;
    this.toggle.textContent = tilt ? 'Senkrecht ausrichten' : 'Atlas kippen';
    for (const name of ['tilt', 'rotation'] as const)
      (this.controls.querySelector('#terrain-' + name) as HTMLInputElement).value = String(
        this[name],
      );
    this.reframe(this.frame);
    this.host.redraw();
  }
  private drawingSurface() {
    this.objectLayer.update(this.objects, { x: this.frame.x, y: this.frame.y, z: 0 }, 1);
    return {
      displayMpp: this.frame.width / Math.max(1, this.input.clientWidth),
      routes: new Map(
        [...(this.vegetationRecords ?? []), ...(this.host.draft()?.routeRecords ?? [])]
          .filter((r) => r.route)
          .map((r) => [r.id, r]),
      ),
      objectHeights: this.objectLayer.heights,
      scopeBases: this.objectLayer.scopeBases,
      closedObjectIds: this.objectLayer.closedIds,
      origin: { x: this.frame.x, y: this.frame.y },
      focusM: 0,
      exaggeration: 1,
      height: (p: Point) => this.height(p),
      segment: this.frame.width / 64,
      bounds: this.frame,
    };
  }
  private drawings() {
    this.surface?.setDrawing((frame) => [
      ...(this.map?.layers(frame, 'map') ?? []),
      ...(this.vegetation?.layers(frame, 'map') ?? []),
      ...(this.transient?.layers(frame, 'overlay') ?? []),
    ]);
  }
  paint(scene: AtlasCanvasScene, origin: Point, images: ReadonlyMap<string, CanvasImageSource>) {
    if (this.scene?.scene === scene) return;
    this.scene = { scene, origin, images };
    if (!this.Drawing) return;
    try {
      const next = new this.Drawing(
        scene,
        origin,
        images,
        this.drawingSurface(),
        this.objectLayer.meshes,
      );
      this.map?.dispose();
      this.map = next;
      this.drawings();
    } catch (e) {
      this.fail(e);
    }
  }
  overlay(scene: AtlasCanvasScene, origin: Point) {
    if (!this.Drawing) return;
    try {
      const next = new this.Drawing(scene, origin, new Map(), this.drawingSurface());
      this.transient?.dispose();
      this.transient = next;
      this.drawings();
    } catch (e) {
      this.fail(e);
    }
  }
  hitAt(e: { clientX: number; clientY: number }, keys: string[]) {
    const frame = this.surface?.frame;
    if (!frame) return null;
    const p = this.pixel(e.clientX, e.clientY),
      segment = frame.ray(p),
      hit = this.terrainHit(e.clientX, e.clientY);
    const distance =
      segment && hit
        ? Math.hypot(...segment[1].map((v, i) => v - segment[0][i]!)) * hit.segmentFraction
        : Infinity;
    return (
      this.transient?.hit(frame, p, keys, distance) ??
      this.vegetation?.hit(frame, p, keys, distance) ??
      this.map?.hit(frame, p, keys, distance) ??
      null
    );
  }
  batch(paint: () => void) {
    paint();
  }
  refreshBrushCursor(x: number, y: number) {
    const point = this.authorPoint(x, y),
      label = document.getElementById('land-cursor-height');
    if (label) label.textContent = point ? 'Höhe: ' + lengthLabel(this.height(point)) : 'Höhe: –';
  }
}
