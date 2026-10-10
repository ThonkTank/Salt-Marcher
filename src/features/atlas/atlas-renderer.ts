import { Application, Container, Graphics, Text } from "pixi.js";
import {
  initialAtlasCamera,
  type AtlasCamera,
  type ViewportSize,
} from "./camera";
import {
  relativeCamera,
  panRelativeAtlas,
  zoomRelativeAtlas,
  projectLocal,
  unprojectLocal,
  type RelativeAtlasCamera,
  type RigidFrame,
} from "./relative-frame";
import {
  displayHexLevel,
  fractionalHex,
  hexCenter,
  hexCorners,
  hexDistanceMeters,
  type HexAddress,
} from "./hex";
import type { OverworldDocument, WorldPoint } from "./overworld";
import type { AtlasChange } from "./atlas-history";
import { checkedTerrainCell, terrainTarget } from "./terrain-schema";
import type { TerrainSource } from "./terrain-source";
import type { LocationDocument } from "../location/location-schema";

export class AtlasRenderer {
  readonly application = new Application();
  /** Future local card scenes attach here; all share this camera and viewport. */
  readonly detailLayer = new Container();
  private readonly grid = new Graphics();
  private readonly landscape = new Graphics();
  private readonly overlay = new Graphics();
  private readonly markers = new Graphics();
  private readonly names = new Container();
  private readonly locations = new Map<string, LocationDocument>();
  private readonly labels = new Map<string, Text>();
  selectedLocation?: string;
  locationPreview?: { id: string; position: WorldPoint };
  private observer?: ResizeObserver;
  private frame?: number;
  private initialized = false;
  private closed = false;
  private currentCamera: RelativeAtlasCamera;
  beforeRender?: () => void;
  level = 0;
  selected?: HexAddress;
  preview: readonly AtlasChange[] = [];
  hover?: HexAddress;
  private terrainSource?: TerrainSource;
  constructor(
    readonly host: HTMLElement,
    readonly world: OverworldDocument,
    private changed: () => void,
    terrain?: TerrainSource,
  ) {
    this.terrainSource = terrain;
    this.currentCamera = relativeCamera(
      world.origin,
      { x: 0, y: 0 },
      initialAtlasCamera(world.origin).metersPerPixel,
    );
  }
  get terrain(): TerrainSource | undefined {
    return this.terrainSource;
  }
  useTerrain(source: TerrainSource): void {
    if (source.world.id !== this.world.id)
      throw new Error("Landschaft gehört zu einer anderen Welt.");
    this.terrainSource = source;
    this.preview = [];
    this.locationPreview = undefined;
    this.locations.clear();
    this.schedule();
  }
  get camera(): AtlasCamera {
    return {
      center: {
        x: this.currentCamera.anchor.x + this.currentCamera.offsetMeters.x,
        y: this.currentCamera.anchor.y + this.currentCamera.offsetMeters.y,
      },
      metersPerPixel: this.currentCamera.metersPerPixel,
    };
  }
  get relativeCamera(): RelativeAtlasCamera {
    return this.currentCamera;
  }
  private worldFrame(point: WorldPoint): RigidFrame {
    return {
      anchor: point,
      offsetsMeters: [],
      rotationRadians: 0,
      metersPerUnit: 1,
      originUnits: { x: 0, y: 0 },
      precisionMeters: 0,
    };
  }
  screenPoint(point: WorldPoint): WorldPoint {
    return projectLocal(
      this.worldFrame(point),
      this.currentCamera,
      this.viewport,
      { x: 0, y: 0 },
    );
  }
  get viewport(): ViewportSize {
    return {
      width: Math.max(1, this.host.clientWidth),
      height: Math.max(1, this.host.clientHeight),
    };
  }
  async init(): Promise<void> {
    await this.application.init({
      width: this.viewport.width,
      height: this.viewport.height,
      background: 0xeef4f1,
      antialias: true,
      autoStart: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: "webgl",
    });
    this.initialized = true;
    if (this.closed) {
      this.application.destroy(true, { children: true });
      return;
    }
    this.host.append(this.application.canvas);
    this.application.canvas.setAttribute("aria-hidden", "true");
    this.application.stage.addChild(
      this.landscape,
      this.grid,
      this.overlay,
      this.detailLayer,
      this.markers,
      this.names,
    );
    this.observer = new ResizeObserver(() => {
      this.application.renderer.resize(
        this.viewport.width,
        this.viewport.height,
      );
      this.schedule();
    });
    this.observer.observe(this.host);
    this.schedule();
  }
  worldPoint(p: WorldPoint): WorldPoint {
    return unprojectLocal(
      this.worldFrame({ x: 0, y: 0 }),
      this.currentCamera,
      this.viewport,
      p,
    );
  }
  pan(dx: number, dy: number): void {
    this.currentCamera = panRelativeAtlas(this.currentCamera, dx, dy);
    this.schedule();
  }
  zoom(anchor: WorldPoint, factor: number): void {
    this.currentCamera = zoomRelativeAtlas(
      this.currentCamera,
      this.viewport,
      anchor,
      factor,
    );
    this.schedule();
  }
  location(document: LocationDocument | null, id: string): void {
    if (document) this.locations.set(id, document);
    else this.locations.delete(id);
  }
  private markerPoints() {
    return (this.terrain?.placements() ?? []).map((p) => ({
      id: p.locationId,
      point: this.screenPoint(
        this.locationPreview?.id === p.locationId
          ? this.locationPreview.position
          : p.position,
      ),
    }));
  }
  visibleLocationIds(): string[] {
    const size = this.viewport;
    return this.markerPoints()
      .filter(
        ({ point: p }) =>
          p.x >= -20 &&
          p.y >= -20 &&
          p.x <= size.width + 20 &&
          p.y <= size.height + 20,
      )
      .map((p) => p.id);
  }
  locationAt(screen: WorldPoint): string | undefined {
    return this.markerPoints()
      .reverse()
      .find(({ point: p }) => Math.hypot(screen.x - p.x, screen.y - p.y) <= 14)
      ?.id;
  }
  fit(): void {
    const refs = this.terrain?.references() ?? [];
    const points = refs.flatMap((ref) =>
      [
        [ref.extent.minQ, ref.extent.minR],
        [ref.extent.minQ, ref.extent.maxR],
        [ref.extent.maxQ, ref.extent.minR],
        [ref.extent.maxQ, ref.extent.maxR],
      ].map(([q, r]) =>
        hexCenter(this.world, {
          worldId: this.world.id,
          level: 0,
          q: q!,
          r: r!,
        }),
      ),
    );
    points.push(...(this.terrain?.placements() ?? []).map((p) => p.position));
    if (!points.length)
      this.currentCamera = relativeCamera(
        this.world.origin,
        { x: 0, y: 0 },
        initialAtlasCamera(this.world.origin).metersPerPixel,
      );
    else {
      const minX = Math.min(...points.map((p) => p.x)),
        maxX = Math.max(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y)),
        maxY = Math.max(...points.map((p) => p.y));
      const padding = hexDistanceMeters(0) * 2;
      this.currentCamera = relativeCamera(
        { x: minX / 2 + maxX / 2, y: minY / 2 + maxY / 2 },
        { x: 0, y: 0 },
        Math.max(
          (maxX - minX + padding) / Math.max(1, this.viewport.width - 64),
          (maxY - minY + padding) / Math.max(1, this.viewport.height - 64),
        ),
      );
    }
    this.schedule();
  }
  visibleTerrainBounds() {
    const size = this.viewport;
    const points = [
      { x: 0, y: 0 },
      { x: size.width, y: 0 },
      { x: 0, y: size.height },
      { x: size.width, y: size.height },
    ].map((p) => fractionalHex(this.world, this.worldPoint(p), 0));
    return {
      minQ: Math.floor(Math.min(...points.map((p) => p.q))) - 2,
      maxQ: Math.ceil(Math.max(...points.map((p) => p.q))) + 2,
      minR: Math.floor(Math.min(...points.map((p) => p.r))) - 2,
      maxR: Math.ceil(Math.max(...points.map((p) => p.r))) + 2,
    };
  }
  schedule(): void {
    if (!this.initialized || this.closed || this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.closed) this.draw();
    });
  }
  private draw(): void {
    const size = this.viewport;
    this.level = displayHexLevel(this.camera.metersPerPixel, this.level);
    const bounds = (level: number) => {
      const corners = [
        { x: 0, y: 0 },
        { x: size.width, y: 0 },
        { x: 0, y: size.height },
        { x: size.width, y: size.height },
      ].map((p) => fractionalHex(this.world, this.worldPoint(p), level));
      return {
        q0: Math.floor(Math.min(...corners.map((p) => p.q))) - 2,
        q1: Math.ceil(Math.max(...corners.map((p) => p.q))) + 2,
        r0: Math.floor(Math.min(...corners.map((p) => p.r))) - 2,
        r1: Math.ceil(Math.max(...corners.map((p) => p.r))) + 2,
      };
    };
    let b = bounds(this.level);
    while ((b.q1 - b.q0 + 1) * (b.r1 - b.r0 + 1) > 6000 && this.level < 32)
      b = bounds(++this.level);
    this.grid.clear();
    this.landscape.clear();
    this.overlay.clear();
    const cells = new Map(
      (this.terrain?.cells() ?? []).map((c) => [terrainTarget(c), c]),
    );
    for (const change of this.preview) {
      if (change.after === null) cells.delete(change.target);
      else cells.set(change.target, checkedTerrainCell(change.after));
    }
    const radius =
      hexDistanceMeters(0) / Math.sqrt(3) / this.camera.metersPerPixel;
    let visibleCells = 0;
    for (const cell of cells.values()) {
      const address = {
        worldId: this.world.id,
        level: 0,
        q: cell.q,
        r: cell.r,
      };
      const center = this.screenPoint(hexCenter(this.world, address));
      if (
        center.x + radius < 0 ||
        center.y + radius < 0 ||
        center.x - radius > size.width ||
        center.y - radius > size.height
      )
        continue;
      const points = hexCorners(this.world, address)
        .map((p) => this.screenPoint(p))
        .flatMap((p) => [p.x, p.y]);
      this.landscape
        .poly(points, true)
        .fill({ color: Number.parseInt(cell.color.slice(1), 16), alpha: 0.96 });
      if (cell.terrain === "forest" && radius > 14) {
        const s = Math.min(16, radius * 0.28);
        for (const [dx, dy] of [
          [-s * 0.75, s * 0.25],
          [s * 0.75, s * 0.25],
          [0, -s * 0.65],
        ]) {
          const x = center.x + dx!,
            y = center.y + dy!;
          this.landscape
            .poly(
              [x, y - s, x + s * 0.55, y + s * 0.5, x - s * 0.55, y + s * 0.5],
              true,
            )
            .fill({ color: 0x304d3a, alpha: 0.8 });
        }
      }
      visibleCells++;
    }
    for (let q = b.q0; q <= b.q1; q++)
      for (let r = b.r0; r <= b.r1; r++) {
        const points = hexCorners(this.world, {
          worldId: this.world.id,
          level: this.level,
          q,
          r,
        })
          .map((p) => this.screenPoint(p))
          .flatMap((p) => [p.x, p.y]);
        this.grid
          .poly(points, true)
          .stroke({ color: 0x809c9a, width: 1, alpha: 0.7 });
      }
    const origin = this.screenPoint(this.world.origin);
    this.overlay
      .moveTo(origin.x - 5, origin.y)
      .lineTo(origin.x + 5, origin.y)
      .moveTo(origin.x, origin.y - 5)
      .lineTo(origin.x, origin.y + 5)
      .stroke({ color: 0x4c6177, width: 1.5 });
    if (this.selected) {
      const points = hexCorners(this.world, this.selected)
        .map((p) => this.screenPoint(p))
        .flatMap((p) => [p.x, p.y]);
      this.overlay
        .poly(points, true)
        .fill({ color: 0xd4eadd, alpha: 0.7 })
        .stroke({ color: 0x258a76, width: 2 });
    }
    if (this.hover)
      this.overlay
        .poly(
          hexCorners(this.world, this.hover)
            .map((p) => this.screenPoint(p))
            .flatMap((p) => [p.x, p.y]),
          true,
        )
        .stroke({ color: 0x345c4d, width: 2, alpha: 0.8 });
    this.host.dataset.hexLevel = String(this.level);
    this.host.dataset.metersPerPixel = String(this.camera.metersPerPixel);
    this.host.dataset.centerX = String(this.camera.center.x);
    this.host.dataset.centerY = String(this.camera.center.y);
    this.host.dataset.hexMiles = String(
      hexDistanceMeters(this.level) / this.world.metersPerMile,
    );
    this.host.dataset.terrainCells = String(this.terrain?.cells().length ?? 0);
    this.host.dataset.visibleTerrainCells = String(visibleCells);
    this.host.dataset.previewCells = String(this.preview.length);
    this.drawLocations();
    this.beforeRender?.();
    this.application.render();
    this.changed();
  }
  private drawLocations(): void {
    this.markers.clear();
    const placed = new Set(
      (this.terrain?.placements() ?? []).map((p) => p.locationId),
    );
    for (const [id, label] of this.labels) {
      label.visible = false;
      if (!placed.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
    const visible = new Set(this.visibleLocationIds());
    for (const { id, point: p } of this.markerPoints()) {
      if (!visible.has(id)) continue;
      const document = this.locations.get(id),
        color = document?.type === "city" ? 0x704d29 : 0x27565c;
      if (document?.type === "city")
        this.markers.rect(p.x - 7, p.y - 7, 14, 14);
      else
        this.markers.poly(
          [p.x, p.y - 8, p.x + 8, p.y, p.x, p.y + 8, p.x - 8, p.y],
          true,
        );
      this.markers.fill(color).stroke({ color: 0xffffff, width: 2 });
      if (id === this.selectedLocation)
        this.markers.circle(p.x, p.y, 12).stroke({ color: 0x258a76, width: 2 });
      let label = this.labels.get(id);
      if (!label) {
        label = new Text({
          text: "",
          style: { fontFamily: "sans-serif", fontSize: 12, fill: 0x26372e },
        });
        this.labels.set(id, label);
        this.names.addChild(label);
      }
      label.text = document?.name ?? "Ort";
      label.position.set(p.x + 15, p.y - 8);
      label.visible = true;
    }
    this.host.dataset.visibleLocations = String(visible.size);
    this.host.dataset.locations = String(placed.size);
  }
  destroy(): void {
    this.closed = true;
    this.observer?.disconnect();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    if (this.initialized) this.application.destroy(true, { children: true });
  }
}
