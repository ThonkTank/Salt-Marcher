import {
  Application,
  Container,
  Graphics,
  GraphicsContext,
  Text,
  Matrix,
  Rectangle,
  Texture,
  FillGradient,
  Sprite,
  Mesh,
  MeshGeometry,
} from "pixi.js";
import {
  type Entity,
  type Id,
  type Point,
  type Polygon,
  type Room,
  type Door,
  type Settings,
  type Light,
  type MapObject,
  type ReferenceImage,
  isRoom,
} from "./model";
import { Session } from "./session";
import { selectionFrame, type SelectionFrame, type TransformSelection } from "./selection";
import {
  hit,
  wallSegments,
  polygonSegments,
  entityBounds,
  overlaps,
  boundarySegments,
  portalPose,
  smoothPath,
  pathPoints,
  objectPoints,
  inside,
  type Bounds,
} from "./geometry";
import { TexturePool } from "./textures";
import { objectAlphaOpacity } from "./features/objekte/color-alpha";
import { type ColorableObjectSettings } from "./features/objekte/colorable-pixels";
import { buildPathTextureBand } from "./features/material/path-texture-band";
import { isNativePathAssetId } from "./features/material/native-path-catalog";
import { ComputeClient } from "./worker-client";
import {
  compactObjectVisible,
  gridStep,
  objectNearViewport,
  fieldMeasurementLabel,
  pathRenderGroup,
  roomMeasurement,
} from "./rendering";

interface Visual {
  entity: Entity;
  container: Container;
  label?: Text;
  labelPoint?: Point;
  featureBadge?: Container;
  featureMarker?: string;
  bounds: Bounds;
  assets?: string[];
  gradient?: FillGradient;
  request?: number;
  shadow?: Graphics;
  pathMesh?: Mesh;
  pathGeometry?: MeshGeometry;
}
export interface ColorableObjectSource {
  readonly image: Blob;
  readonly settings: ColorableObjectSettings;
}
type ObjectPreviewSettings = Pick<
  MapObject,
  "rotation" | "width" | "height" | "color" | "alpha" | "assetId" | "flip" | "shadow"
>;
function samplePolyline(
  points: readonly Point[],
  closed: boolean,
  spacing: number,
): Point[] {
  const result: Point[] = [];
  let carry = 0;
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index++) {
    const a = points[index]!,
      b = points[(index + 1) % points.length]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    for (let distance = carry; distance <= length; distance += spacing)
      result.push({
        x: a.x + (dx * distance) / (length || 1),
        y: a.y + (dy * distance) / (length || 1),
      });
    carry = (carry - length) % spacing;
    if (carry < 0) carry += spacing;
  }
  if (!closed && result.at(-1) !== points.at(-1)) result.push(points.at(-1)!);
  return result;
}
function samplePolylineWithAngle(
  points: readonly Point[],
  closed: boolean,
  spacing: number,
): { point: Point; angle: number }[] {
  const result: { point: Point; angle: number }[] = [];
  let carry = 0;
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index++) {
    const a = points[index]!,
      b = points[(index + 1) % points.length]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy),
      angle = Math.atan2(dy, dx);
    for (let distance = carry; distance <= length; distance += spacing)
      result.push({
        point: {
          x: a.x + (dx * distance) / (length || 1),
          y: a.y + (dy * distance) / (length || 1),
        },
        angle,
      });
    carry = (carry - length) % spacing;
    if (carry < 0) carry += spacing;
  }
  return result;
}
function lineSegments(points: readonly Point[], closed: boolean) {
  const count = closed ? points.length : points.length - 1;
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    a: points[index]!,
    b: points[(index + 1) % points.length]!,
  }));
}
export class MapRenderer {
  readonly app = new Application();
  private world = new Container();
  private mapBackground = new Graphics();
  private grid = new Graphics();
  private referenceLayer = new Container();
  private areaShadowLayer = new Container();
  private groundPathLayer = new Container();
  private labels = new Container();
  private roomLayer = new Container();
  private detailLayer = new Container();
  private lightLayer = new Container();
  private dimensions = new Graphics();
  private dimensionLabels = new Container();
  private horizontalDimension?: Text;
  private verticalDimension?: Text;
  private selection = new Graphics();
  private preview = new Graphics();
  private objectPreview = new Container();
  private objectPreviewShadow = new Graphics();
  private objectPreviewFallback: Graphics;
  private objectPreviewSprite?: Sprite;
  private objectPreviewSettings?: ObjectPreviewSettings;
  private objectPreviewSignature?: string;
  private objectPreviewResource?: string;
  private objectPreviewRevision = 0;
  private objectColorPreview?: { id: Id; color: number; alpha: number };
  private mapMask = new Graphics();
  private textures: TexturePool;
  private compute = new ComputeClient();
  private furniture = new GraphicsContext();
  private lightRequests = 0;
  private pendingLights = new Set<Promise<void>>();
  private compareFloor?: Id;
  private compareAlpha = 0.2;
  private currentAlpha = 1;
  private visuals = new Map<Id, Visual>();
  private resize?: ResizeObserver;
  private unsub?: () => void;
  private frame = 0;
  private closed = false;
  private exporting = false;
  private capturing = false;
  private captureViewport?: { width: number; height: number };
  private initialized = false;
  private selected = new Set<Id>();
  private groupFrame?: SelectionFrame;
  private lightFrame?: SelectionFrame;
  private focusedRoom?: Id;
  private settings: Settings;
  floorId: string;
  camera = { x: 20, y: 20, scale: 24 };
  renderCount = 0;
  lastRenderMs = 0;
  constructor(
    readonly host: HTMLElement,
    readonly session: Session,
    private assetUrl: (path: string) => string = (path) => path,
    private onError: (message: string) => void = console.error,
    private appearance: {
      background?: number;
      mapFill?: number;
      grid?: boolean;
      labels?: boolean;
      compactDetails?: boolean;
      preserveViewOnResize?: boolean;
      preserveZoomOnResize?: boolean;
    } = {},
    private colorableObject?: (id: Id) => ColorableObjectSource | undefined,
  ) {
    this.settings = session.settings;
    this.floorId = session.floors.keys().next().value!;
    this.textures = new TexturePool(this.assetUrl);
    this.furniture
      .roundRect(-0.5, -0.5, 1, 1, 0.07)
      .fill(0xffffff)
      .stroke({ width: 0.045, color: 0x32271e });
    this.objectPreviewFallback = new Graphics(this.furniture);
    this.objectPreview.addChild(this.objectPreviewShadow, this.objectPreviewFallback);
    this.objectPreview.visible = false;
    this.objectPreview.eventMode = "none";
  }
  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }
  async captureMap(options: {
    pixelsPerField: number;
    grid: boolean;
    lighting?: boolean;
  }): Promise<HTMLCanvasElement> {
    if (!this.initialized || this.closed || this.capturing)
      throw new Error("Kartenexport ist gerade nicht verfügbar.");
    const pixelsPerField = options.pixelsPerField;
    if (!Number.isInteger(pixelsPerField) || pixelsPerField < 1)
      throw new RangeError("Exportauflösung muss eine positive Ganzzahl sein.");
    const width = this.settings.width * pixelsPerField,
      height = this.settings.height * pixelsPerField;
    if (width > 16384 || height > 16384 || width * height > 64_000_000)
      throw new RangeError("Exportbild überschreitet das aktuelle Bildlimit.");
    const revision = this.session.revision,
      floorId = this.floorId;
    this.capturing = true;
    try {
      // Interactive culling may omit objects outside the current viewport.
      this.exporting = true;
      this.reconcileObjects();
      this.exporting = false;
      await this.textures.ready();
      await Promise.all([...this.pendingLights]);
      if (this.closed || revision !== this.session.revision || floorId !== this.floorId)
        throw new Error("Die Kartenansicht hat sich während des Exports geändert.");
      const previousCamera = { ...this.camera },
        previousGrid = this.appearance.grid,
        previousSelection = this.selection.visible,
        previousPreview = this.preview.visible,
        previousObjectPreview = this.objectPreview.visible,
        previousLights = this.lightLayer.visible,
        previousDimensions = this.dimensions.visible,
        previousDimensionLabels = this.dimensionLabels.visible;
      this.exporting = true;
      try {
        this.captureViewport = { width, height };
        this.camera = { x: 0, y: 0, scale: pixelsPerField };
        this.appearance.grid = options.grid;
        this.selection.visible = false;
        this.preview.visible = false;
        this.objectPreview.visible = false;
        this.lightLayer.visible = options.lighting !== false;
        this.dimensions.visible = false;
        this.dimensionLabels.visible = false;
        this.cameraChanged();
        const canvas = this.app.renderer.extract.canvas({
          target: this.app.stage,
          frame: new Rectangle(0, 0, width, height),
          resolution: 1,
          antialias: true,
        });
        if (!(canvas instanceof HTMLCanvasElement))
          throw new Error("Kartenexport lieferte keine Bildfläche.");
        return canvas;
      } finally {
        this.exporting = false;
        this.captureViewport = undefined;
        this.camera = previousCamera;
        this.appearance.grid = previousGrid;
        this.selection.visible = previousSelection;
        this.preview.visible = previousPreview;
        this.objectPreview.visible = previousObjectPreview;
        this.lightLayer.visible = previousLights;
        this.dimensions.visible = previousDimensions;
        this.dimensionLabels.visible = previousDimensionLabels;
        this.cameraChanged();
      }
    } finally {
      this.exporting = false;
      this.capturing = false;
      if (!this.closed) this.reconcileObjects();
    }
  }
  async init(): Promise<void> {
    await this.app.init({
      width: Math.max(1, this.host.clientWidth),
      height: Math.max(1, this.host.clientHeight),
      preference: "webgl",
      antialias: true,
      autoStart: false,
      sharedTicker: false,
      resolution: Math.min(devicePixelRatio || 1, 2),
      autoDensity: true,
      background: this.appearance.background ?? 0x222829,
    });
    this.initialized = true;
    if (this.closed) {
      this.destroyResources();
      return;
    }
    this.app.stop();
    this.host.append(this.canvas);
    this.canvas.setAttribute("aria-label", "Dungeon-Karte");
    this.canvas.tabIndex = 0;
    this.world.eventMode = "none";
    this.labels.eventMode = "none";
    this.groundPathLayer.sortableChildren = true;
    this.roomLayer.sortableChildren = true;
    this.detailLayer.sortableChildren = true;
    this.world.addChild(
      this.mapBackground,
      this.referenceLayer,
      this.areaShadowLayer,
      this.groundPathLayer,
      this.roomLayer,
      this.grid,
      this.detailLayer,
      this.lightLayer,
      this.selection,
      this.preview,
      this.objectPreview,
    );
    this.world.mask = this.mapMask;
    this.app.stage.addChild(
      this.world,
      this.mapMask,
      this.dimensions,
      this.labels,
      this.dimensionLabels,
    );
    let previousWidth = this.host.clientWidth,
      previousHeight = this.host.clientHeight;
    this.resize = new ResizeObserver(() => {
      if (this.closed) return;
      const width = this.host.clientWidth,
        height = this.host.clientHeight;
      if (width < 2 || height < 2) return;
      const center = this.toWorld({
          x: previousWidth / 2,
          y: previousHeight / 2,
        }),
        viewWidth = previousWidth / this.camera.scale,
        viewHeight = previousHeight / this.camera.scale;
      this.app.renderer.resize(width, height);
      if (
        this.appearance.preserveViewOnResize &&
        previousWidth > 1 &&
        previousHeight > 1
      ) {
        if (!this.appearance.preserveZoomOnResize)
          this.camera.scale = Math.max(
            0.25,
            Math.min(width / viewWidth, height / viewHeight, 200),
          );
        this.camera.x = width / 2 - center.x * this.camera.scale;
        this.camera.y = height / 2 - center.y * this.camera.scale;
      }
      previousWidth = width;
      previousHeight = height;
      this.cameraChanged();
    });
    this.resize.observe(this.host);
    this.unsub = this.session.subscribe((event) => {
      if (event.floors && !this.session.floors.has(this.floorId))
        this.floorId = this.session.floors.keys().next().value!;
      const blockers = [...event.ids].some((id) => {
        const e = this.session.entities.get(id) ?? this.visuals.get(id)?.entity;
        return (
          e?.kind === "building" ||
          e?.kind === "wall" ||
          e?.kind === "door" ||
          (e?.kind === "surface" && e.category === "cave")
        );
      });
      if (event.floors) this.rebuild();
      else {
        let rebuiltVisual = false;
        if (event.content && this.session.version === 4)
          for (const visual of [...this.visuals.values()])
            if (visual.entity.kind === "object") {
              this.sync(visual.entity.id);
              if (visual !== this.visuals.get(visual.entity.id)) rebuiltVisual = true;
            }
        for (const id of event.ids) {
          const before = this.visuals.get(id);
          this.sync(id);
          if (before !== this.visuals.get(id)) rebuiltVisual = true;
        }
        if (event.entityOrder || rebuiltVisual) this.syncVisualOrder();
        if (blockers)
          for (const v of this.visuals.values())
            if (v.entity.kind === "light") this.updateLight(v);
      }
      if (this.settings !== this.session.settings) {
        this.settings = this.session.settings;
        this.rebuild();
        this.drawMapMask();
      }
      this.drawDimensions();
      this.drawSelection();
      this.invalidate();
    });
    this.setFitCamera(32);
    this.rebuild();
    this.drawMapMask();
    this.cameraChanged();
  }
  private clearVisual(id: Id): void {
    const v = this.visuals.get(id);
    if (v) {
      v.shadow?.destroy();
      v.container.destroy({ children: true });
      v.pathGeometry?.destroy();
      v.label?.destroy();
      v.featureBadge?.destroy({ children: true });
      v.gradient?.destroy();
      for (const asset of v.assets ?? []) this.textures.release(asset);
      this.visuals.delete(id);
    }
  }
  private acquireAsset(visual: Visual, reference: string): Promise<Texture> {
    (visual.assets ??= []).push(reference);
    return this.textures.acquire(reference);
  }
  private rebuild(): void {
    for (const id of this.visuals.keys()) this.clearVisual(id);
    for (const e of this.session.entities.values())
      if (e.floorId === this.floorId || e.floorId === this.compareFloor)
        this.sync(e.id);
    this.syncVisualOrder();
    this.drawGrid();
    this.drawSelection();
    this.invalidate();
  }
  private syncVisualOrder(): void {
    const parents = [
      this.referenceLayer, this.groundPathLayer, this.roomLayer,
      this.detailLayer, this.lightLayer,
    ];
    const ordered = new Map(parents.map((parent) => [parent, [] as Container[]]));
    for (const entity of this.session.entities.values()) {
      const container = this.visuals.get(entity.id)?.container;
      const siblings = container?.parent && ordered.get(container.parent);
      if (siblings && container) siblings.push(container);
    }
    for (const [parent, siblings] of ordered)
      siblings.forEach((container, index) => {
        if (parent.children[index] !== container)
          parent.setChildIndex(container, index);
      });
  }
  private shouldBuildObject(object: MapObject): boolean {
    return (
      this.exporting ||
      !this.appearance.compactDetails ||
      ((this.selected.has(object.id) ||
        compactObjectVisible(object, this.camera.scale)) &&
        objectNearViewport(object, this.camera, {
          width: this.host.clientWidth,
          height: this.host.clientHeight,
        }))
    );
  }
  private reconcileObjects(): void {
    if (!this.appearance.compactDetails) return;
    for (const entity of this.session.entities.values()) {
      if (
        entity.kind !== "object" ||
        (entity.floorId !== this.floorId &&
          entity.floorId !== this.compareFloor)
      )
        continue;
      const present = this.visuals.has(entity.id);
      if (this.shouldBuildObject(entity)) {
        if (!present) this.sync(entity.id);
      } else if (present) this.clearVisual(entity.id);
    }
  }
  private drawMapMask(): void {
    this.mapMask
      .clear()
      .rect(0, 0, this.settings.width, this.settings.height)
      .fill(0xffffff);
  }
  setFloor(id: Id): void {
    if (!this.session.floors.has(id) || id === this.floorId) return;
    const focused = this.focusedRoom
      ? this.session.entities.get(this.focusedRoom)
      : undefined;
    if (focused?.floorId !== id) this.focusedRoom = undefined;
    this.floorId = id;
    this.selected.clear();
    this.rebuild();
    this.cameraChanged();
  }
  reloadAssets(): void {
    this.clearObjectPreview();
    for (const id of this.visuals.keys()) this.clearVisual(id);
    this.textures.destroy();
    this.textures = new TexturePool(this.assetUrl);
    this.rebuild();
  }
  previewObjectColor(id: Id, color: number, alpha: number): void {
    this.objectColorPreview = { id, color, alpha };
    this.sync(id);
    this.invalidate();
  }
  clearObjectColorPreview(id: Id): void {
    if (this.objectColorPreview?.id !== id) return;
    this.objectColorPreview = undefined;
    this.sync(id);
    this.invalidate();
  }
  setComparison(
    id: Id | undefined,
    referenceAlpha = 0.2,
    currentAlpha = 1,
  ): void {
    this.compareFloor = id === this.floorId ? undefined : id;
    this.compareAlpha = Math.min(1, Math.max(0, referenceAlpha));
    this.currentAlpha = Math.min(1, Math.max(0, currentAlpha));
    this.rebuild();
    this.cameraChanged();
  }
  private sync(id: Id): void {
    const stored = this.session.entities.get(id),
      e = stored?.kind === "object" && this.objectColorPreview?.id === id
        ? { ...stored, color: this.objectColorPreview.color,
          alpha: this.objectColorPreview.alpha }
        : stored,
      old = this.visuals.get(id),
      featureMarker = this.session.version === 4 && e?.kind === "object"
        ? this.session.content.occurrences.find((item) => item.entityId === id)?.marker
        : undefined;
    if (!e || (e.floorId !== this.floorId && e.floorId !== this.compareFloor)) {
      this.clearVisual(id);
      return;
    }
    if (e.kind === "object" && !this.shouldBuildObject(e)) {
      this.clearVisual(id);
      return;
    }
    // Movement updates transforms, retaining the already prepared graphic and text.
    if (
      e.kind === "object" &&
      old?.entity.kind === "object" &&
      e.width === old.entity.width &&
      e.height === old.entity.height &&
      e.color === old.entity.color &&
      e.alpha === old.entity.alpha &&
      e.label === old.entity.label &&
      featureMarker === old.featureMarker &&
      e.assetId === old.entity.assetId &&
      e.layer === old.entity.layer &&
      e.shadow === old.entity.shadow &&
      e.blocksLight === old.entity.blocksLight &&
      e.flip === old.entity.flip
    ) {
      old.container.position.set(e.x, e.y);
      old.container.rotation = e.rotation;
      old.entity = e;
      old.bounds = entityBounds(e, (id) => this.session.entities.get(id));
      old.labelPoint = { x: e.x, y: e.y };
      this.positionLabel(old);
      return;
    }
    this.clearVisual(id);
    const container = new Container(),
      g = new Graphics(e.kind === "object" ? this.furniture : undefined);
    container.addChild(g);
    const visual: Visual = {
      entity: e,
      container,
      bounds: entityBounds(e, (id) => this.session.entities.get(id)),
    };
    this.visuals.set(id, visual);
    container.alpha =
      e.floorId === this.floorId ? this.currentAlpha : this.compareAlpha;
    if (e.kind === "surface") container.alpha *= e.opacity ?? 1;
    if (e.kind === "reference") container.alpha *= e.opacity;
    const ambient = this.session.floors.get(e.floorId)?.ambient ?? 1,
      tone = Math.round(255 * ambient);
    container.tint = (tone << 16) | (tone << 8) | tone;
    if (e.kind === "building") {
      this.roomLayer.addChild(container);
      container.zIndex = e.layer;
      if (this.settings.wallShadows) {
        const shadow = new Graphics();
        for (const polygon of e.polygons) {
          shadow
            .poly(
              polygon.outer.flatMap((point) => [
                point.x + 0.22,
                point.y + 0.22,
              ]),
              true,
            )
            .fill({ color: 0x17191a, alpha: 0.22 });
          for (const hole of polygon.holes)
            shadow
              .poly(
                hole.flatMap((point) => [
                  point.x + 0.22,
                  point.y + 0.22,
                ]),
                true,
              )
              .cut();
        }
        shadow.alpha = container.alpha;
        shadow.tint = container.tint;
        this.areaShadowLayer.addChild(shadow);
        visual.shadow = shadow;
      }
      this.drawSurface(visual, g);
      if (isRoom(e)) {
        const points = e.polygons.flatMap((polygon) => polygon.outer),
          p = points.reduce(
            (sum, point) => ({
              x: sum.x + point.x / points.length,
              y: sum.y + point.y / points.length,
            }),
            { x: 0, y: 0 },
          );
        this.addLabel(visual, e.number, p);
      }
      if (e.wallAssetId) {
        const doors = [...this.session.dependents(e.id)]
          .map((dependent) => this.session.entities.get(dependent))
          .filter((door): door is Door => door?.kind === "door");
        this.drawTexturedBoundary(
          visual,
          wallSegments(e, doors),
          e.wallWidth,
          e.wallAssetId + "\0image",
        );
      }
    } else if (e.kind === "wall") {
      this.detailLayer.addChild(container);
      container.zIndex = e.layer ?? 700;
      const doors = [...this.session.dependents(e.id)]
        .map((id) => this.session.entities.get(id))
        .filter((door): door is Door => door?.kind === "door");
      if (this.settings.wallShadows && e.shadow !== false) {
        for (const segment of boundarySegments(e, doors))
          g.moveTo(segment.a.x + 0.18, segment.a.y + 0.18).lineTo(
            segment.b.x + 0.18,
            segment.b.y + 0.18,
          );
        g.stroke({
          color: 0x17191a,
          width: e.width + 0.18,
          alpha: 0.24,
          cap: "round",
          join: "round",
        });
      }
      for (const segment of boundarySegments(e, doors))
        g.moveTo(segment.a.x, segment.a.y).lineTo(segment.b.x, segment.b.y);
      g.stroke({ color: e.color, width: e.width, cap: "round", join: "round" });
      if (e.assetId)
        this.drawTexturedBoundary(
          visual,
          boundarySegments(e, doors),
          e.width,
          e.assetId + "\0image",
        );
    } else if (e.kind === "door") {
      this.detailLayer.addChild(container);
      const p = portalPose(e, (id) => this.session.entities.get(id));
      container.position.set(p.x, p.y);
      container.rotation = p.angle + (e.flip ? Math.PI : 0);
      if (e.variant === "door")
        g.rect(-e.width / 2, -0.14, e.width, 0.28)
          .fill(0x9e7047)
          .stroke({ width: 0.065, color: 0x262829 });
      if (e.variant === "window")
        g.rect(-e.width / 2, -0.12, e.width, 0.24)
          .fill(0x9ddbea)
          .stroke({ width: 0.055, color: 0x324b55 });
      if (e.variant === "bars") {
        for (let x = -e.width / 2; x <= e.width / 2; x += 0.2)
          g.moveTo(x, -0.18).lineTo(x, 0.18);
        g.stroke({ width: 0.07, color: 0x283335 });
      }
      if (e.variant === "opening")
        g.moveTo(-e.width / 2, -0.15)
          .lineTo(-e.width / 2, 0.15)
          .moveTo(e.width / 2, -0.15)
          .lineTo(e.width / 2, 0.15)
          .stroke({ width: 0.08, color: 0x403e39 });
      if (e.assetId) {
        const reference = e.assetId + "\0image";
        void this.acquireAsset(visual, reference)
          .then((texture) => {
            if (this.visuals.get(id) !== visual || this.closed) return;
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.width = e.width;
            sprite.height = Math.max(
              0.22,
              Math.min(e.width, (e.width * texture.height) / texture.width),
            );
            container.addChild(sprite);
            this.invalidate();
          })
          .catch((error) => {
            if (!this.closed) this.onError(String(error));
          });
      }
    } else if (e.kind === "surface") {
      this.roomLayer.addChild(container);
      container.zIndex = e.layer;
      this.drawSurface(visual, g);
    } else if (e.kind === "path") {
      if (pathRenderGroup(e) === "ground")
        this.groundPathLayer.addChild(container);
      else this.detailLayer.addChild(container);
      container.zIndex = e.layer;
      this.drawPath(visual, g);
    } else if (e.kind === "roof") {
      this.roomLayer.addChild(container);
      container.zIndex = e.layer;
      this.drawRoof(visual, g);
    } else if (e.kind === "reference") {
      container.tint = 0xffffff;
      this.referenceLayer.addChild(container);
      container.position.set(e.x, e.y);
      container.rotation = e.rotation;
      void this.acquireAsset(visual, e.asset)
        .then((texture) => {
          if (this.visuals.get(id) !== visual || this.closed) return;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.width = e.width;
          sprite.height = e.height;
          container.addChildAt(sprite, 0);
          this.positionLabel(visual);
          this.invalidate();
        })
        .catch((error) => {
          if (!this.closed) this.onError(String(error));
        });
    } else if (e.kind === "light") {
      container.tint = 0xffffff;
      this.lightLayer.addChild(container);
      container.blendMode = "add";
      this.updateLight(visual);
      if (e.assetId) {
        const reference = e.assetId + "\0image";
        void this.acquireAsset(visual, reference)
          .then((texture) => {
            if (this.visuals.get(id) !== visual || this.closed) return;
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.position.set(e.x, e.y);
            sprite.rotation = e.rotation ?? 0;
            sprite.width = e.radius * 2;
            sprite.height = e.radius * 2;
            sprite.alpha = Math.min(1, e.intensity * 0.35);
            container.addChild(sprite);
            this.invalidate();
          })
          .catch((error) => {
            if (!this.closed) this.onError(String(error));
          });
      }
    } else {
      this.detailLayer.addChild(container);
      container.zIndex = e.layer ?? 500;
      container.position.set(e.x, e.y);
      container.rotation = e.rotation;
      container.scale.x = e.flip ? -1 : 1;
      if (this.settings.objectShadows && e.shadow !== false) {
        const shadow = new Graphics();
        shadow
          .roundRect(
            -e.width / 2 + 0.13,
            -e.height / 2 + 0.13,
            e.width,
            e.height,
            Math.min(e.width, e.height) * 0.08,
          )
          .fill({ color: 0x111314, alpha: 0.26 });
        shadow.alpha = objectAlphaOpacity(e.alpha ?? 255);
        container.addChildAt(shadow, 0);
      }
      g.scale.set(e.width, e.height);
      g.tint = e.color;
      g.alpha = objectAlphaOpacity(e.alpha ?? 255);
      if (e.label) this.addLabel(visual, e.label, { x: e.x, y: e.y });
      if (featureMarker) this.addFeatureBadge(visual, featureMarker, { x: e.x, y: e.y });
      if (e.assetId) {
        const reference = e.assetId + "\0image";
        const colorable = this.colorableObject?.(e.assetId);
        const variant = colorable
          ? this.textures.acquireColorableObject(
              reference, colorable.image, e.color, e.alpha ?? 255,
              colorable.settings,
            )
          : undefined;
        if (variant) (visual.assets ??= []).push(variant.key);
        void (variant?.texture ?? this.acquireAsset(visual, reference))
          .then((texture) => {
            if (this.visuals.get(id) !== visual || this.closed) return;
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.width = e.width;
            sprite.height = e.height;
            sprite.tint = variant ? 0xffffff : e.color;
            sprite.alpha = variant ? 1 : objectAlphaOpacity(e.alpha ?? 255);
            g.visible = false;
            container.addChildAt(sprite, 0);
            this.invalidate();
          })
          .catch((error) => {
            if (!this.closed) this.onError(String(error));
          });
      }
    }
    this.visuals.set(id, visual);
    this.positionLabel(visual);
    if (
      (e.kind === "building" ||
        e.kind === "surface" ||
        e.kind === "path" ||
        e.kind === "roof") &&
      e.material
    ) {
      const reference = e.material.assetId
        ? e.material.assetId + "\0" + (e.material.assetPart ?? "image")
        : e.material.asset!;
      void this.acquireAsset(visual, reference)
        .then((texture) => {
          if (this.visuals.get(id) !== visual || this.closed) return;
          if (e.kind === "path") this.drawPath(visual, g, texture);
          else if (e.kind === "roof") this.drawRoof(visual, g, texture);
          else this.drawSurface(visual, g, texture);
          this.invalidate();
        })
        .catch((error) => {
          if (!this.closed) this.onError(String(error));
        });
    }
  }
  private drawTexturedBoundary(
    visual: Visual,
    segments: readonly { a: Point; b: Point }[],
    width: number,
    reference: string,
  ): void {
    void this.acquireAsset(visual, reference)
      .then((texture) => {
        if (this.visuals.get(visual.entity.id) !== visual || this.closed)
          return;
        const layer = new Container();
        for (const segment of segments) {
          const dx = segment.b.x - segment.a.x,
            dy = segment.b.y - segment.a.y,
            length = Math.hypot(dx, dy);
          if (!length) continue;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0, 0.5);
          sprite.position.set(segment.a.x, segment.a.y);
          sprite.rotation = Math.atan2(dy, dx);
          sprite.width = length + 0.02;
          sprite.height = width;
          layer.addChild(sprite);
        }
        visual.container.addChild(layer);
        this.invalidate();
      })
      .catch((error) => {
        if (!this.closed) this.onError(String(error));
      });
  }
  private drawSurface(v: Visual, g: Graphics, texture?: Texture): void {
    const e = v.entity;
    if (e.kind !== "building" && e.kind !== "surface") return;
    g.clear();
    const fill =
      texture && e.material
        ? {
            texture,
            color: e.material.tint,
            textureSpace: "global" as const,
            matrix: new Matrix()
              .scale(
                e.material.tileSize / texture.width,
                e.material.tileSize / texture.height,
              )
              .rotate(e.material.rotation),
          }
        : { color: e.kind === "building" ? e.fill : e.color };
    const polygons = e.polygons;
    for (const p of polygons) {
      g.poly(
        p.outer.flatMap((q) => [q.x, q.y]),
        true,
      ).fill(fill);
      for (const hole of p.holes)
        g.poly(
          hole.flatMap((q) => [q.x, q.y]),
          true,
        ).cut();
    }
    if (e.kind === "building") {
      if (this.settings.buildingWear > 0) {
        const outerPoints = e.polygons.flatMap((polygon) => polygon.outer),
          xs = outerPoints.map((point) => point.x),
          ys = outerPoints.map((point) => point.y),
          minX = Math.min(...xs),
          maxX = Math.max(...xs),
          minY = Math.min(...ys),
          maxY = Math.max(...ys);
        let seed = [...e.id].reduce(
          (value, character) =>
            (Math.imul(value, 33) + character.charCodeAt(0)) >>> 0,
          5381,
        );
        for (
          let index = 0;
          index < Math.ceil(this.settings.buildingWear * 10);
          index++
        ) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const x = minX + (seed / 0x100000000) * (maxX - minX);
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const y = minY + (seed / 0x100000000) * (maxY - minY);
          if (
            e.polygons.some(
              (polygon) =>
                inside({ x, y }, polygon.outer) &&
                !polygon.holes.some((hole) => inside({ x, y }, hole)),
            )
          )
            g.circle(x, y, 0.18 + ((seed >>> 8) % 100) / 180).fill({
              color: 0x4d4336,
              alpha: 0.06 + this.settings.buildingWear * 0.08,
            });
        }
      }
      const doors = [...this.session.dependents(e.id)]
        .map((id) => this.session.entities.get(id))
        .filter(
          (d): d is Door =>
            d?.kind === "door" && d.anchor?.boundaryId === e.id,
        );
      for (const s of wallSegments(e, doors))
        g.moveTo(s.a.x, s.a.y).lineTo(s.b.x, s.b.y);
      g.stroke({
        color: e.wall,
        width: e.wallWidth,
        cap: "round",
        join: "round",
      });
    } else if (e.wallWidth > 0) {
      for (const s of polygonSegments(e.polygons))
        g.moveTo(s.a.x, s.a.y).lineTo(s.b.x, s.b.y);
      g.stroke({
        color: e.wallColor,
        width: e.wallWidth,
        cap: "round",
        join: "round",
      });
    }
    if (
      e.kind === "surface" &&
      e.category === "water" &&
      e.effect === "ripples"
    ) {
      for (const polygon of e.polygons) {
        const xs = polygon.outer.map((point) => point.x),
          ys = polygon.outer.map((point) => point.y),
          minX = Math.min(...xs),
          maxX = Math.max(...xs),
          minY = Math.min(...ys),
          maxY = Math.max(...ys),
          step = Math.max(0.25, (maxX - minX) / 160);
        for (let y = minY + 0.6; y < maxY; y += 1.1) {
          let drawing = false;
          for (let x = minX; x <= maxX; x += step) {
            const visible =
              inside({ x, y }, polygon.outer) &&
              !polygon.holes.some((hole) => inside({ x, y }, hole));
            if (!visible) {
              drawing = false;
              continue;
            }
            const wave = y + Math.sin(x * 2.2) * 0.08;
            if (!drawing) g.moveTo(x, wave);
            else g.lineTo(x, wave);
            drawing = true;
          }
        }
      }
      g.stroke({ color: 0xd8f0f3, width: 0.06, alpha: 0.6 });
    }
  }
  private drawPath(v: Visual, g: Graphics, texture?: Texture): void {
    const e = v.entity;
    if (e.kind !== "path") return;
    v.pathMesh?.destroy();
    v.pathGeometry?.destroy();
    v.pathMesh = undefined;
    v.pathGeometry = undefined;
    g.clear();
    const points = pathPoints(e);
    if (points.length < 2) return;
    const line = (graphics: Graphics) => {
      graphics.moveTo(points[0]!.x, points[0]!.y);
      for (let index = 1; index < points.length; index++)
        graphics.lineTo(points[index]!.x, points[index]!.y);
      if (e.closed) graphics.closePath();
    };
    if (e.style === "stones" || e.style === "hedge") {
      const spacing = Math.max(
        0.35,
        e.width * (e.style === "hedge" ? 0.42 : 0.8),
      );
      for (const point of samplePolyline(points, e.closed, spacing))
        g.circle(
          point.x,
          point.y,
          e.width * (e.style === "hedge" ? 0.46 : 0.38),
        )
          .fill(e.color)
          .stroke({ color: e.outlineColor, width: e.outlineWidth });
      return;
    }
    if (texture && e.style === "road" &&
        isNativePathAssetId(e.material?.assetId) && e.material) {
      try {
        const band = buildPathTextureBand({
          points,
          width: e.width,
          textureWidth: texture.width,
          textureHeight: texture.height,
          closed: e.closed,
          repeatLength: e.material.tileSize,
        });
        const geometry = new MeshGeometry({
          positions: new Float32Array(band.positions),
          uvs: new Float32Array(band.uvs),
          indices: new Uint32Array(band.indices),
        });
        const mesh = new Mesh({ geometry, texture });
        mesh.tint = e.material.tint;
        v.container.addChild(mesh);
        v.pathMesh = mesh;
        v.pathGeometry = geometry;
      } catch {
        line(g);
        g.stroke({ texture, color: 0xffffff, width: e.width, join: "round" });
      }
      return;
    }
    line(g);
    g.stroke({
      color: e.outlineColor,
      width: e.width + e.outlineWidth * 2,
      cap: e.start === "round" || e.end === "round" ? "round" : "square",
      join: "round",
    });
    line(g);
    g.stroke({
      ...(texture ? { texture, color: 0xffffff } : { color: e.color }),
      width: e.width,
      cap: e.start === "round" || e.end === "round" ? "round" : "square",
      join: "round",
    });
    if (e.style === "rail") {
      for (const { point, angle } of samplePolylineWithAngle(
        points,
        e.closed,
        Math.max(0.32, e.width * 0.48),
      )) {
        const nx = Math.cos(angle + Math.PI / 2) * e.width * 0.48,
          ny = Math.sin(angle + Math.PI / 2) * e.width * 0.48;
        g.moveTo(point.x - nx, point.y - ny).lineTo(point.x + nx, point.y + ny);
      }
      g.stroke({ color: 0x654b36, width: Math.max(0.06, e.width * 0.1) });
      const count = e.closed ? points.length : points.length - 1;
      for (let index = 0; index < count; index++) {
        const a = points[index]!,
          b = points[(index + 1) % points.length]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy) || 1,
          nx = (-dy / length) * e.width * 0.28,
          ny = (dx / length) * e.width * 0.28;
        g.moveTo(a.x + nx, a.y + ny)
          .lineTo(b.x + nx, b.y + ny)
          .moveTo(a.x - nx, a.y - ny)
          .lineTo(b.x - nx, b.y - ny);
      }
      g.stroke({
        color: 0xc7ced0,
        width: Math.max(0.07, e.width * 0.1),
        cap: "round",
        join: "round",
      });
    } else if (e.style === "rope")
      for (const point of samplePolyline(
        points,
        e.closed,
        Math.max(0.2, e.width * 0.35),
      ))
        g.circle(point.x, point.y, Math.max(0.04, e.width * 0.08)).fill(
          e.outlineColor,
        );
    if (!e.closed && e.end === "taper") {
      const a = points.at(-2)!,
        b = points.at(-1)!;
      g.moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({
          color: e.color,
          width: Math.max(0.08, e.width * 0.35),
          cap: "round",
        });
    }
  }
  private drawRoof(v: Visual, g: Graphics, texture?: Texture): void {
    const e = v.entity;
    if (e.kind !== "roof") return;
    g.clear()
      .poly(
        e.points.flatMap((point) => [point.x, point.y]),
        true,
      )
      .fill(texture ? { texture, color: 0xffffff } : { color: e.color })
      .stroke({ color: e.outlineColor, width: 0.18, join: "round" });
    if (e.roofType === "flat") return;
    if (e.ridge.length >= 2) {
      g.moveTo(e.ridge[0]!.x, e.ridge[0]!.y);
      for (let index = 1; index < e.ridge.length; index++)
        g.lineTo(e.ridge[index]!.x, e.ridge[index]!.y);
      g.stroke({ color: e.outlineColor, width: 0.1, cap: "round" });
      if (e.roofType === "hip")
        for (const corner of e.points) {
          const target = e.ridge.reduce((nearest, point) =>
            Math.hypot(point.x - corner.x, point.y - corner.y) <
            Math.hypot(nearest.x - corner.x, nearest.y - corner.y)
              ? point
              : nearest,
          );
          g.moveTo(corner.x, corner.y).lineTo(target.x, target.y);
        }
      g.stroke({ color: e.outlineColor, width: 0.06, alpha: 0.75 });
    }
  }
  private updateLight(v: Visual): void {
    const e = v.entity;
    if (e.kind !== "light") return;
    const token = ++this.lightRequests;
    v.request = token;
    const segments = [];
    if (e.shadows)
      for (const source of this.session.entities.values())
        if (
          source.floorId === e.floorId &&
          overlaps(
            v.bounds,
            entityBounds(source, (id) => this.session.entities.get(id)),
          )
        ) {
          if (source.kind === "building")
            segments.push(
              ...wallSegments(
                source,
                [...this.session.dependents(source.id)]
                  .map((id) => this.session.entities.get(id))
                  .filter(
                    (d): d is Door =>
                      d?.kind === "door" &&
                      d.anchor?.boundaryId === source.id &&
                      !(d.blocksLight ?? d.variant === "door"),
                  ),
              ),
            );
          if (source.kind === "wall")
            segments.push(
              ...boundarySegments(
                source,
                [...this.session.dependents(source.id)]
                  .map((id) => this.session.entities.get(id))
                  .filter(
                    (d): d is Door =>
                      d?.kind === "door" &&
                      d.anchor?.boundaryId === source.id &&
                      !d.blocksLight,
                  ),
              ),
            );
          if (source.kind === "surface" && source.category === "cave")
            segments.push(...polygonSegments(source.polygons));
          if (source.kind === "path" && source.blocksLight)
            segments.push(...lineSegments(pathPoints(source), source.closed));
          if (source.kind === "object" && source.blocksLight)
            segments.push(...lineSegments(objectPoints(source), true));
        }
    const request = this.compute
      .request<Point[]>({ kind: "visibility", light: e, segments })
      .then((points) => {
        if (this.closed || this.visuals.get(e.id) !== v || v.request !== token)
          return;
        v.gradient?.destroy();
        v.gradient = new FillGradient({
          type: "radial",
          center: { x: e.x, y: e.y },
          outerCenter: { x: e.x, y: e.y },
          innerRadius: 0,
          outerRadius: e.radius,
          textureSpace: "global",
          textureSize: 128,
          colorStops: [
            { offset: 0, color: e.color },
            { offset: 0.65, color: e.color },
            { offset: 1, color: 0x000000 },
          ],
        });
        const g = v.container.children[0] as Graphics;
        g.clear()
          .poly(
            points.flatMap((p) => [p.x, p.y]),
            true,
          )
          .fill(v.gradient);
        g.alpha = Math.min(1, e.intensity * 0.35);
        this.invalidate();
      })
      .catch((error) => {
        if (!this.closed) this.onError(String(error));
      });
    this.pendingLights.add(request);
    void request.finally(() => this.pendingLights.delete(request));
  }
  private addLabel(visual: Visual, label: string, p: Point): void {
    if (this.appearance.labels === false) return;
    const text = new Text({
      text: label,
      style: {
        fontFamily: "sans-serif",
        fontSize: 15,
        fontWeight: "bold",
        fill: 0xffffff,
        stroke: { color: 0x262626, width: 4 },
        align: "center",
      },
      resolution: 2,
    });
    text.anchor.set(0.5);
    this.labels.addChild(text);
    visual.label = text;
    visual.labelPoint = p;
  }
  private addFeatureBadge(visual: Visual, marker: string, p: Point): void {
    if (this.appearance.labels === false) return;
    const badge = new Container(), text = new Text({
      text: marker,
      style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", fill: 0xffffff },
      resolution: 2,
    });
    text.anchor.set(0.5);
    const background = new Graphics();
    background.rect(-Math.max(11, text.width / 2 + 5), -10,
      Math.max(22, text.width + 10), 20).fill(0x383838);
    badge.addChild(background, text);
    this.labels.addChild(badge);
    visual.featureBadge = badge;
    visual.featureMarker = marker;
    visual.labelPoint = p;
  }
  private positionLabel(v: Visual): void {
    const viewportWidth = this.captureViewport?.width ?? this.host.clientWidth,
      viewportHeight = this.captureViewport?.height ?? this.host.clientHeight;
    const view = {
      x: -this.camera.x / this.camera.scale,
      y: -this.camera.y / this.camera.scale,
      width: viewportWidth / this.camera.scale,
      height: viewportHeight / this.camera.scale,
    };
    v.container.visible =
      overlaps(v.bounds, view) &&
      (v.entity.kind !== "reference" || v.entity.visible) &&
      (!this.appearance.compactDetails || this.exporting ||
        v.entity.kind !== "object" ||
        this.selected.has(v.entity.id) ||
        compactObjectVisible(v.entity, this.camera.scale));
    if (v.label && v.labelPoint) {
      const roomNumberOffset =
        isRoom(v.entity) && this.camera.scale >= 11.25 ? -22 : 0;
      v.label.position.set(
        v.labelPoint.x * this.camera.scale + this.camera.x,
        v.labelPoint.y * this.camera.scale + this.camera.y + roomNumberOffset,
      );
      const hasLabelSpace =
        isRoom(v.entity)
          ? this.camera.scale >= 1.5
          : v.entity.kind !== "object" ||
            this.camera.scale * Math.min(v.entity.width, v.entity.height) >=
              9 ||
            this.selected.has(v.entity.id);
      v.label.visible =
        v.container.visible &&
        hasLabelSpace &&
        v.entity.floorId === this.floorId &&
        v.label.x >= -30 &&
        v.label.y >= -30 &&
        v.label.x <= viewportWidth + 30 &&
        v.label.y <= viewportHeight + 30;
    }
    if (v.featureBadge && v.labelPoint) {
      v.featureBadge.position.set(
        v.labelPoint.x * this.camera.scale + this.camera.x,
        v.labelPoint.y * this.camera.scale + this.camera.y - (v.label ? 22 : 0),
      );
      v.featureBadge.visible = v.container.visible && v.entity.floorId === this.floorId &&
        (this.camera.scale >= 9 || this.selected.has(v.entity.id)) &&
        v.featureBadge.x >= -30 && v.featureBadge.y >= -30 &&
        v.featureBadge.x <= viewportWidth + 30 && v.featureBadge.y <= viewportHeight + 30;
    }
  }
  private dimensionText(): Text {
    const text = new Text({
      text: "",
      style: {
        fontFamily: "sans-serif",
        fontSize: 13,
        fontWeight: "600",
        fill: 0x242424,
        stroke: { color: 0xffffff, width: 4 },
        align: "center",
      },
      resolution: 2,
    });
    text.anchor.set(0.5);
    this.dimensionLabels.addChild(text);
    return text;
  }
  private drawDimensions(): void {
    const g = this.dimensions,
      room = this.focusedRoom
        ? this.session.entities.get(this.focusedRoom)
        : undefined;
    g.clear();
    if (!isRoom(room) || room.floorId !== this.floorId) {
      if (this.horizontalDimension) this.horizontalDimension.visible = false;
      if (this.verticalDimension) this.verticalDimension.visible = false;
      return;
    }
    const measure = roomMeasurement(room),
      c = this.camera,
      offset = 18 / c.scale,
      tick = 5 / c.scale,
      horizontalY = measure.y - offset,
      verticalX = measure.x - offset,
      right = measure.x + measure.width,
      bottom = measure.y + measure.height;
    g.moveTo(measure.x, horizontalY)
      .lineTo(right, horizontalY)
      .moveTo(measure.x, horizontalY - tick)
      .lineTo(measure.x, horizontalY + tick)
      .moveTo(right, horizontalY - tick)
      .lineTo(right, horizontalY + tick)
      .moveTo(verticalX, measure.y)
      .lineTo(verticalX, bottom)
      .moveTo(verticalX - tick, measure.y)
      .lineTo(verticalX + tick, measure.y)
      .moveTo(verticalX - tick, bottom)
      .lineTo(verticalX + tick, bottom)
      .stroke({ color: 0x31363a, width: 1.5 / c.scale, alpha: 0.9 });
    const horizontal = (this.horizontalDimension ??= this.dimensionText()),
      vertical = (this.verticalDimension ??= this.dimensionText());
    horizontal.text = fieldMeasurementLabel(measure.width);
    horizontal.rotation = 0;
    horizontal.position.set(
      (measure.x + measure.width / 2) * c.scale + c.x,
      horizontalY * c.scale + c.y - 11,
    );
    horizontal.visible = true;
    vertical.text = fieldMeasurementLabel(measure.height);
    vertical.rotation = -Math.PI / 2;
    vertical.position.set(
      verticalX * c.scale + c.x - 12,
      (measure.y + measure.height / 2) * c.scale + c.y,
    );
    vertical.visible = true;
  }
  private drawGrid(): void {
    const background = this.mapBackground,
      g = this.grid,
      c = this.camera,
      { width, height } = this.session.settings;
    const viewportWidth = this.captureViewport?.width ?? this.host.clientWidth,
      viewportHeight = this.captureViewport?.height ?? this.host.clientHeight;
    background
      .clear()
      .rect(0, 0, width, height)
      .fill(this.appearance.mapFill ?? 0xebe4d6);
    g.clear();
    if (this.appearance.grid === false) return;
    const step = gridStep(c.scale);
    const left = Math.max(0, Math.floor(-c.x / c.scale / step) * step),
      right = Math.min(width, (viewportWidth - c.x) / c.scale);
    const top = Math.max(0, Math.floor(-c.y / c.scale / step) * step),
      bottom = Math.min(height, (viewportHeight - c.y) / c.scale);
    for (let x = left; x <= right; x += step)
      g.moveTo(x, Math.max(0, top)).lineTo(x, Math.min(height, bottom));
    for (let y = top; y <= bottom; y += step)
      g.moveTo(Math.max(0, left), y).lineTo(Math.min(width, right), y);
    g.stroke({ color: 0x5b5a51, width: 1 / c.scale, alpha: 0.15 });
    g.rect(0, 0, width, height).stroke({ color: 0x777565, width: 1 / c.scale });
  }
  setGridVisible(visible: boolean): void {
    this.appearance.grid = visible;
    this.drawGrid();
    this.invalidate();
  }
  private cameraChanged(): void {
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.scale);
    this.mapMask.position.set(this.camera.x, this.camera.y);
    this.mapMask.scale.set(this.camera.scale);
    this.dimensions.position.set(this.camera.x, this.camera.y);
    this.dimensions.scale.set(this.camera.scale);
    this.drawGrid();
    this.reconcileObjects();
    for (const v of this.visuals.values()) this.positionLabel(v);
    this.drawDimensions();
    this.drawSelection();
    this.invalidate();
  }
  private setFitCamera(screenPadding: number): void {
    const { width, height } = this.session.settings;
    this.camera.scale = Math.max(
      0.25,
      Math.min(
        Math.max(1, this.host.clientWidth - screenPadding * 2) / width,
        Math.max(1, this.host.clientHeight - screenPadding * 2) / height,
        64,
      ),
    );
    this.camera.x = (this.host.clientWidth - width * this.camera.scale) / 2;
    this.camera.y = (this.host.clientHeight - height * this.camera.scale) / 2;
  }
  fit(screenPadding = 32): void {
    this.focusedRoom = undefined;
    this.setFitCamera(screenPadding);
    this.cameraChanged();
  }
  focus(id: Id, padding = 2, screenPadding = 24): boolean {
    const entity = this.session.entities.get(id);
    if (!entity) return false;
    this.focusedRoom = isRoom(entity) ? entity.id : undefined;
    if (entity.floorId !== this.floorId) this.setFloor(entity.floorId);
    const bounds =
        isRoom(entity)
          ? roomMeasurement(entity)
          : entityBounds(entity, (candidate) =>
              this.session.entities.get(candidate),
            ),
      width = Math.max(1, bounds.width + padding * 2),
      height = Math.max(1, bounds.height + padding * 2),
      dimensionMargin = isRoom(entity) ? 44 : 0,
      availableWidth = Math.max(
        1,
        this.host.clientWidth - screenPadding * 2 - dimensionMargin,
      ),
      availableHeight = Math.max(
        1,
        this.host.clientHeight - screenPadding * 2 - dimensionMargin,
      );
    this.camera.scale = Math.max(
      0.25,
      Math.min(availableWidth / width, availableHeight / height, 64),
    );
    this.camera.x =
      screenPadding +
      dimensionMargin +
      (availableWidth - width * this.camera.scale) / 2 -
      (bounds.x - padding) * this.camera.scale;
    this.camera.y =
      screenPadding +
      dimensionMargin +
      (availableHeight - height * this.camera.scale) / 2 -
      (bounds.y - padding) * this.camera.scale;
    this.cameraChanged();
    return true;
  }
  pan(dx: number, dy: number): void {
    this.camera.x += dx;
    this.camera.y += dy;
    this.cameraChanged();
  }
  zoom(
    factor: number,
    at: Point = { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2 },
  ): void {
    const p = this.toWorld(at);
    this.camera.scale = Math.max(
      0.25,
      Math.min(200, this.camera.scale * factor),
    );
    this.camera.x = at.x - p.x * this.camera.scale;
    this.camera.y = at.y - p.y * this.camera.scale;
    this.cameraChanged();
  }
  zoomView(factor: number): void {
    const currentWidth = this.host.clientWidth / this.camera.scale,
      targetWidth = Math.min(
        this.session.settings.width * 3,
        Math.max(8, currentWidth * factor),
      );
    this.zoom(currentWidth / targetWidth);
  }
  toWorld(p: Point): Point {
    return {
      x: (p.x - this.camera.x) / this.camera.scale,
      y: (p.y - this.camera.y) / this.camera.scale,
    };
  }
  local(event: MouseEvent): Point {
    const r = this.canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  roomLabelAt(p: Point, padding = 5): Room | undefined {
    const visuals = [...this.session.entities.keys()]
      .map((id) => this.visuals.get(id))
      .filter((visual): visual is Visual => !!visual);
    for (let index = visuals.length - 1; index >= 0; index--) {
      const visual = visuals[index]!,
        label = visual.label;
      if (
        !isRoom(visual.entity) ||
        visual.entity.floorId !== this.floorId ||
        !label?.visible
      )
        continue;
      if (
        Math.abs(p.x - label.x) <= label.width / 2 + padding &&
        Math.abs(p.y - label.y) <= label.height / 2 + padding
      )
        return visual.entity;
    }
    return undefined;
  }
  hitTest(
    p: Point,
    accept: (entity: Entity) => boolean = () => true,
  ): Entity | undefined {
    const all = [...this.session.entities.keys()]
      .map((id) => this.visuals.get(id))
      .filter((visual): visual is Visual => !!visual);
    for (const kind of [
      "light",
      "object",
      "door",
      "path",
      "wall",
      "roof",
      "building",
      "surface",
      "reference",
    ]) {
      const matching = all.filter((visual) => visual.entity.kind === kind)
        .sort((a, b) => a.container.zIndex - b.container.zIndex);
      for (let i = matching.length - 1; i >= 0; i--) {
        const visual = matching[i]!;
        const e = visual.entity;
        if (
          visual.container.visible &&
          e.floorId === this.floorId &&
          e.kind === kind &&
          accept(e) &&
          hit(
            p,
            e,
            (id) => this.session.entities.get(id),
            5 / this.camera.scale,
          )
        )
          return e;
      }
    }
    return undefined;
  }
  visibleForSelection(id: Id): boolean {
    return this.visuals.get(id)?.container.visible ?? false;
  }
  select(ids?: Iterable<Id>): void {
    this.selected = new Set(ids ?? []);
    const entities = [...this.selected].map((id) => this.session.entities.get(id));
    this.groupFrame = entities.length > 1 && entities.every((entity): entity is TransformSelection =>
      !!entity && (entity.kind === "object" || entity.kind === "light" || entity.kind === "reference"))
      ? selectionFrame(entities) : undefined;
    const single = entities.length === 1 ? entities[0] : undefined;
    this.lightFrame = single?.kind === "light"
      ? { x: single.x, y: single.y, width: 1, height: 1,
        rotation: single.rotation ?? 0 }
      : undefined;
    this.reconcileObjects();
    if (this.appearance.compactDetails)
      for (const visual of this.visuals.values())
        if (visual.entity.kind === "object") this.positionLabel(visual);
    this.drawSelection();
    this.invalidate();
  }
  get selectionGroupFrame(): SelectionFrame | undefined {
    return this.groupFrame;
  }
  setSelectionGroupFrame(frame: SelectionFrame): void {
    this.groupFrame = frame;
    this.drawSelection();
    this.invalidate();
  }
  get selectionLightFrame(): SelectionFrame | undefined {
    const id = this.selected.size === 1 ? [...this.selected][0] : undefined,
      light = id ? this.session.entities.get(id) : undefined;
    return this.lightFrame && light?.kind === "light"
      ? { ...this.lightFrame, x: light.x, y: light.y,
        rotation: light.rotation ?? 0 }
      : undefined;
  }
  setSelectionLightFrame(frame: SelectionFrame): void {
    this.lightFrame = frame;
    this.drawSelection();
    this.invalidate();
  }
  private drawSelectionFrame(g: Graphics, frame: SelectionFrame): void {
    const c = Math.cos(frame.rotation), s = Math.sin(frame.rotation),
      corners = [
        { x: -frame.width / 2, y: -frame.height / 2 },
        { x: frame.width / 2, y: -frame.height / 2 },
        { x: frame.width / 2, y: frame.height / 2 },
        { x: -frame.width / 2, y: frame.height / 2 },
      ].map((point) => ({
        x: frame.x + point.x * c - point.y * s,
        y: frame.y + point.x * s + point.y * c,
      }));
    g.poly(corners.flatMap((point) => [point.x, point.y]), true)
      .stroke({ color: 0x008da8, width: 2 / this.camera.scale });
    for (const point of corners)
      g.rect(point.x - 5 / this.camera.scale, point.y - 5 / this.camera.scale,
        10 / this.camera.scale, 10 / this.camera.scale)
        .fill(0xffffff)
        .stroke({ color: 0x62666b, width: 1 / this.camera.scale });
  }
  private drawSelection(): void {
    const g = this.selection;
    g.clear();
    g.position.set(0, 0);
    g.rotation = 0;
    if (this.groupFrame) {
      this.drawSelectionFrame(g, this.groupFrame);
      return;
    }
    for (const id of this.selected) {
      const e = this.session.entities.get(id);
      if (e) this.drawEntitySelection(g, e,
        e.kind === "light" ? this.selectionLightFrame : undefined);
    }
  }
  private drawEntitySelection(g: Graphics, e: Entity, frame?: SelectionFrame): void {
    if (e.kind === "building") {
      for (const polygon of e.polygons)
        for (const ring of [polygon.outer, ...polygon.holes]) {
          g.poly(
            ring.flatMap((point) => [point.x, point.y]),
            true,
          ).stroke({ color: 0x008da8, width: 2 / this.camera.scale });
          for (const point of ring)
            g.circle(point.x, point.y, 4 / this.camera.scale).fill(0x008da8);
        }
    } else if (e.kind === "object" || e.kind === "reference") {
      const c = Math.cos(e.rotation),
        s = Math.sin(e.rotation),
        corners = [
          { x: -e.width / 2 - 0.12, y: -e.height / 2 - 0.12 },
          { x: e.width / 2 + 0.12, y: -e.height / 2 - 0.12 },
          { x: e.width / 2 + 0.12, y: e.height / 2 + 0.12 },
          { x: -e.width / 2 - 0.12, y: e.height / 2 + 0.12 },
        ].map((point) => ({
          x: e.x + point.x * c - point.y * s,
          y: e.y + point.x * s + point.y * c,
        }));
      g.poly(
        corners.flatMap((point) => [point.x, point.y]),
        true,
      ).stroke({ color: 0x008da8, width: 2 / this.camera.scale });
      this.drawSelectionFrame(g, selectionFrame([e])!);
    } else if (e.kind === "door") {
      const p = portalPose(e, (id) => this.session.entities.get(id));
      g.circle(p.x, p.y, 0.7).stroke({
        color: 0x008da8,
        width: 2 / this.camera.scale,
      });
    } else if (e.kind === "wall") {
      g.moveTo(e.points[0]!.x, e.points[0]!.y);
      for (let index = 1; index < e.points.length; index++)
        g.lineTo(e.points[index]!.x, e.points[index]!.y);
      if (e.closed) g.closePath();
      g.stroke({ color: 0x008da8, width: 2 / this.camera.scale });
      for (const point of e.points)
        g.circle(point.x, point.y, 4 / this.camera.scale).fill(0x008da8);
    } else if (e.kind === "path") {
      g.moveTo(e.points[0]!.x, e.points[0]!.y);
      for (let index = 1; index < e.points.length; index++)
        g.lineTo(e.points[index]!.x, e.points[index]!.y);
      if (e.closed) g.closePath();
      g.stroke({ color: 0x008da8, width: 2 / this.camera.scale });
      for (const point of e.points)
        g.circle(point.x, point.y, 4 / this.camera.scale).fill(0x008da8);
    } else if (e.kind === "roof") {
      g.poly(
        e.points.flatMap((point) => [point.x, point.y]),
        true,
      ).stroke({ color: 0x008da8, width: 2 / this.camera.scale });
      for (const point of e.points)
        g.circle(point.x, point.y, 4 / this.camera.scale).fill(0x008da8);
      for (const point of e.ridge)
        g.circle(point.x, point.y, 4 / this.camera.scale)
          .fill(0xf1ae2b)
          .stroke({ color: 0x6b4511, width: 1 / this.camera.scale });
    } else if (e.kind === "light") {
      g.circle(e.x, e.y, e.radius).stroke({
        color: 0x008da8,
        width: 2 / this.camera.scale,
      });
      const c = Math.cos(e.rotation ?? 0),
        s = Math.sin(e.rotation ?? 0);
      this.drawSelectionFrame(g, frame ?? {
        x: e.x, y: e.y, width: 1, height: 1,
        rotation: e.rotation ?? 0,
      });
      g.moveTo(e.x, e.y)
        .lineTo(e.x + 0.42 * s, e.y - 0.42 * c)
        .stroke({ color: 0x18394a, width: 3 / this.camera.scale });
      g.circle(e.x + 0.42 * s, e.y - 0.42 * c, 3 / this.camera.scale)
        .fill(0x18394a);
    } else if (e.kind === "surface")
      for (const p of e.polygons)
        for (const ring of [p.outer, ...p.holes])
          g.poly(
            ring.flatMap((p) => [p.x, p.y]),
            true,
          ).stroke({ color: 0x008da8, width: 2 / this.camera.scale });
    if (
      e.kind === "surface" &&
      e.polygons.length === 1 &&
      e.polygons[0]!.holes.length === 0
    )
      for (const point of e.polygons[0]!.outer)
        g.circle(point.x, point.y, 4 / this.camera.scale).fill(0x008da8);
  }
  previewBuilding(
    polygons: readonly Polygon[],
    activeContour: number,
  ): void {
    const g = this.preview;
    g.clear();
    let contour = 0;
    for (const polygon of polygons)
      for (const ring of [polygon.outer, ...polygon.holes]) {
        const active = contour === activeContour;
        g.poly(
          ring.flatMap((point) => [point.x, point.y]),
          true,
        ).stroke({
          color: active ? 0x008da8 : 0x62666b,
          width: (active ? 2.5 : 1.25) / this.camera.scale,
          alpha: active ? 1 : 0.65,
        });
        if (active)
          for (const point of ring)
            g.circle(point.x, point.y, 3 / this.camera.scale).fill(0x008da8);
        contour++;
      }
    this.invalidate();
  }
  previewRoom(points: readonly Point[] | null, erase = false): void {
    this.preview.clear();
    if (points) {
      const color = erase ? 0xc93c3c : 0x008da8;
      this.preview
        .poly(
          points.flatMap((p) => [p.x, p.y]),
          true,
        )
        .fill({ color, alpha: 0.15 })
        .stroke({ color, width: 2 / this.camera.scale });
    }
    this.invalidate();
  }
  previewMarquee(a: Point, b: Point): void {
    this.preview
      .clear()
      .rect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
      )
      .fill({ color: 0x5b93bd, alpha: 0.12 })
      .stroke({
        color: 0x8ec8ef,
        width: 1.5 / this.camera.scale,
        alpha: 0.9,
      });
    this.invalidate();
  }
  previewPath(
    points: readonly Point[],
    closed: boolean,
    smooth: boolean,
    fill = false,
    erase = false,
  ): void {
    const g = this.preview;
    g.clear();
    if (!points.length) return;
    const path = smooth ? smoothPath(points, closed) : points;
    g.moveTo(path[0]!.x, path[0]!.y);
    for (let index = 1; index < path.length; index++)
      g.lineTo(path[index]!.x, path[index]!.y);
    if (closed) g.closePath();
    const color = erase ? 0xc93c3c : 0x008da8;
    if (fill && closed) g.fill({ color, alpha: 0.15 });
    g.stroke({ color, width: 2 / this.camera.scale });
    for (const point of points)
      g.circle(point.x, point.y, 3 / this.camera.scale).fill(color);
    this.invalidate();
  }
  previewBrush(points: readonly Point[], radius: number, erase: boolean): void {
    const g = this.preview;
    g.clear();
    if (!points.length) return;
    if (points.length === 1)
      g.circle(points[0]!.x, points[0]!.y, radius).fill({
        color: erase ? 0xd55757 : 0x00a6bb,
        alpha: 0.28,
      });
    else {
      g.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++)
        g.lineTo(points[i]!.x, points[i]!.y);
      g.stroke({
        color: erase ? 0xd55757 : 0x00a6bb,
        width: radius * 2,
        cap: "round",
        join: "round",
        alpha: 0.28,
      });
    }
    this.invalidate();
  }
  previewObject(point: Point, settings: ObjectPreviewSettings): void {
    if (this.closed) return;
    this.objectPreviewSettings = { ...settings };
    this.objectPreview.visible = !this.capturing;
    this.objectPreview.position.set(point.x, point.y);
    this.objectPreview.rotation = settings.rotation;
    this.objectPreview.scale.x = settings.flip ? -1 : 1;
    this.objectPreview.alpha = 0.72;
    this.objectPreviewFallback.scale.set(settings.width, settings.height);
    this.objectPreviewFallback.tint = settings.color;
    this.objectPreviewFallback.alpha = objectAlphaOpacity(settings.alpha ?? 255);
    this.objectPreviewShadow.clear();
    if (this.settings.objectShadows && settings.shadow !== false)
      this.objectPreviewShadow
        .roundRect(
          -settings.width / 2 + 0.13,
          -settings.height / 2 + 0.13,
          settings.width,
          settings.height,
          Math.min(settings.width, settings.height) * 0.08,
        )
        .fill({ color: 0x111314, alpha: 0.26 * objectAlphaOpacity(settings.alpha ?? 255) });
    if (this.objectPreviewSprite) {
      this.objectPreviewSprite.width = settings.width;
      this.objectPreviewSprite.height = settings.height;
      const colorable = !!settings.assetId && !!this.colorableObject?.(settings.assetId);
      this.objectPreviewSprite.tint = colorable ? 0xffffff : settings.color;
      this.objectPreviewSprite.alpha = colorable ? 1 : objectAlphaOpacity(settings.alpha ?? 255);
    }
    const signature = settings.assetId
      ? [settings.assetId, settings.color, settings.alpha ?? 255].join("\0")
      : "";
    if (signature !== this.objectPreviewSignature) {
      this.objectPreviewRevision++;
      this.objectPreviewSprite?.destroy();
      this.objectPreviewSprite = undefined;
      if (this.objectPreviewResource) this.textures.release(this.objectPreviewResource);
      this.objectPreviewResource = undefined;
      this.objectPreviewSignature = signature;
      this.objectPreviewFallback.visible = true;
      if (settings.assetId) {
        const reference = settings.assetId + "\0image",
          colorable = this.colorableObject?.(settings.assetId),
          variant = colorable
            ? this.textures.acquireColorableObject(
                reference, colorable.image, settings.color, settings.alpha ?? 255,
                colorable.settings,
              )
            : undefined,
          revision = this.objectPreviewRevision;
        this.objectPreviewResource = variant?.key ?? reference;
        void (variant?.texture ?? this.textures.acquire(reference))
          .then((texture) => {
            if (this.closed || revision !== this.objectPreviewRevision) return;
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            this.objectPreviewSprite = sprite;
            this.objectPreview.addChild(sprite);
            this.objectPreviewFallback.visible = false;
            this.previewObject(
              { x: this.objectPreview.position.x, y: this.objectPreview.position.y },
              this.objectPreviewSettings!,
            );
          })
          .catch((error) => {
            if (!this.closed && revision === this.objectPreviewRevision)
              this.onError(String(error));
          });
      }
    }
    this.invalidate();
  }
  clearObjectPreview(): void {
    this.objectPreviewRevision++;
    this.objectPreview.visible = false;
    this.objectPreviewSettings = undefined;
    this.objectPreviewSignature = undefined;
    this.objectPreviewSprite?.destroy();
    this.objectPreviewSprite = undefined;
    this.objectPreviewFallback.visible = true;
    if (this.objectPreviewResource) this.textures.release(this.objectPreviewResource);
    this.objectPreviewResource = undefined;
    this.invalidate();
  }
  previewMove(ids: Iterable<Id>, dx: number, dy: number): void {
    for (const id of ids) {
      const v = this.visuals.get(id);
      if (!v) continue;
      const e = v.entity;
      if (e.kind === "object" || e.kind === "reference")
        v.container.position.set(e.x + dx, e.y + dy);
      else if (e.kind === "light") v.container.position.set(dx, dy);
      else if (e.kind === "door") {
        const pose = portalPose(e, (id) => this.session.entities.get(id));
        v.container.position.set(pose.x + dx, pose.y + dy);
      } else v.container.position.set(dx, dy);
    }
    this.invalidate();
  }
  previewTransform(
    before: MapObject | ReferenceImage | Light,
    after: MapObject | ReferenceImage | Light,
    frame?: SelectionFrame,
  ): void {
    const visual = this.visuals.get(before.id);
    if (!visual) return;
    if (before.kind === "light" && after.kind === "light") {
      visual.container.position.set(after.x - before.x, after.y - before.y);
      const sprite = visual.container.children.find((child) => child instanceof Sprite);
      if (sprite) sprite.rotation = after.rotation ?? 0;
    } else if (before.kind !== "light" && after.kind !== "light") {
      visual.container.position.set(after.x, after.y);
      visual.container.rotation = after.rotation;
      visual.container.scale.set(
        (before.kind === "object" && before.flip ? -1 : 1) * after.width / before.width,
        after.height / before.height,
      );
    }
    this.selection.visible = false;
    this.preview.clear();
    this.drawEntitySelection(this.preview, after, frame);
    this.invalidate();
  }
  previewGroupTransform(
    changes: readonly { before: TransformSelection; after: TransformSelection }[],
    frame: SelectionFrame,
  ): void {
    for (const { before, after } of changes) {
      const visual = this.visuals.get(before.id);
      if (!visual) continue;
      if (before.kind === "light" && after.kind === "light") {
        visual.container.position.set(after.x - before.x, after.y - before.y);
        const sprite = visual.container.children.find((child) => child instanceof Sprite);
        if (sprite) sprite.rotation = after.rotation ?? 0;
      } else if (before.kind !== "light" && after.kind !== "light") {
        visual.container.position.set(after.x, after.y);
        visual.container.rotation = after.rotation;
        visual.container.scale.set(
          (before.kind === "object" && before.flip ? -1 : 1) * after.width / before.width,
          after.height / before.height,
        );
      }
    }
    this.selection.visible = false;
    this.preview.clear();
    this.drawSelectionFrame(this.preview, frame);
    this.invalidate();
  }
  cancelPreview(ids?: Iterable<Id>): void {
    this.preview.clear();
    this.selection.visible = true;
    for (const id of ids ?? []) {
      const v = this.visuals.get(id);
      if (v) {
        if (v.entity.kind === "object" || v.entity.kind === "reference") {
          v.container.position.set(v.entity.x, v.entity.y);
          v.container.rotation = v.entity.rotation;
          v.container.scale.set(
            v.entity.kind === "object" && v.entity.flip ? -1 : 1,
            1,
          );
        } else if (v.entity.kind === "light") {
          v.container.position.set(0, 0);
          const sprite = v.container.children.find((child) => child instanceof Sprite);
          if (sprite) sprite.rotation = v.entity.rotation ?? 0;
        } else if (v.entity.kind === "door") {
          const pose = portalPose(v.entity, (source) =>
            this.session.entities.get(source),
          );
          v.container.position.set(pose.x, pose.y);
        } else v.container.position.set(0, 0);
      }
    }
    this.invalidate();
  }
  invalidate(): void {
    if (this.frame || this.closed || !this.initialized) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.closed) return;
      const started = performance.now();
      this.app.render();
      this.lastRenderMs = performance.now() - started;
      this.renderCount++;
    });
  }
  destroy(): void {
    this.closed = true;
    this.clearObjectPreview();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.unsub?.();
    this.compute.destroy();
    if (this.initialized) this.destroyResources();
  }
  private destroyResources(): void {
    for (const id of this.visuals.keys()) this.clearVisual(id);
    this.textures.destroy();
    this.furniture.destroy();
    this.app.destroy(
      { removeView: true },
      { children: true, texture: true, textureSource: true },
    );
  }
}
