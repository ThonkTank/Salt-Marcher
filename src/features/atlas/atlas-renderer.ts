import { Application, Container, Graphics } from "pixi.js";
import {
  initialAtlasCamera,
  panAtlas,
  screenToWorld,
  worldToScreen,
  zoomAtlas,
  type AtlasCamera,
  type ViewportSize,
} from "./camera";
import {
  displayHexLevel,
  fractionalHex,
  hexCorners,
  hexDistanceMeters,
  type HexAddress,
} from "./hex";
import type { OverworldDocument, WorldPoint } from "./overworld";

export class AtlasRenderer {
  readonly application = new Application();
  /** Future local card scenes attach here; all share this camera and viewport. */
  readonly detailLayer = new Container();
  private readonly grid = new Graphics();
  private readonly overlay = new Graphics();
  private observer?: ResizeObserver;
  private frame?: number;
  private initialized = false;
  private closed = false;
  private currentCamera: AtlasCamera;
  level = 0;
  selected?: HexAddress;
  constructor(
    readonly host: HTMLElement,
    readonly world: OverworldDocument,
    private changed: () => void,
  ) {
    this.currentCamera = initialAtlasCamera(world.origin);
  }
  get camera(): AtlasCamera {
    return this.currentCamera;
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
    this.application.stage.addChild(this.grid, this.detailLayer, this.overlay);
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
    return screenToWorld(this.camera, this.viewport, p);
  }
  pan(dx: number, dy: number): void {
    this.currentCamera = panAtlas(this.camera, dx, dy);
    this.schedule();
  }
  zoom(anchor: WorldPoint, factor: number): void {
    this.currentCamera = zoomAtlas(this.camera, this.viewport, anchor, factor);
    this.schedule();
  }
  fit(): void {
    this.currentCamera = initialAtlasCamera(this.world.origin);
    this.schedule();
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
    this.overlay.clear();
    for (let q = b.q0; q <= b.q1; q++)
      for (let r = b.r0; r <= b.r1; r++) {
        const points = hexCorners(this.world, {
          worldId: this.world.id,
          level: this.level,
          q,
          r,
        })
          .map((p) => worldToScreen(this.camera, size, p))
          .flatMap((p) => [p.x, p.y]);
        this.grid
          .poly(points, true)
          .stroke({ color: 0x809c9a, width: 1, alpha: 0.7 });
      }
    const origin = worldToScreen(this.camera, size, this.world.origin);
    this.overlay
      .moveTo(origin.x - 5, origin.y)
      .lineTo(origin.x + 5, origin.y)
      .moveTo(origin.x, origin.y - 5)
      .lineTo(origin.x, origin.y + 5)
      .stroke({ color: 0x4c6177, width: 1.5 });
    if (this.selected) {
      const points = hexCorners(this.world, this.selected)
        .map((p) => worldToScreen(this.camera, size, p))
        .flatMap((p) => [p.x, p.y]);
      this.overlay
        .poly(points, true)
        .fill({ color: 0xd4eadd, alpha: 0.7 })
        .stroke({ color: 0x258a76, width: 2 });
    }
    this.host.dataset.hexLevel = String(this.level);
    this.host.dataset.metersPerPixel = String(this.camera.metersPerPixel);
    this.host.dataset.centerX = String(this.camera.center.x);
    this.host.dataset.centerY = String(this.camera.center.y);
    this.host.dataset.hexMiles = String(
      hexDistanceMeters(this.level) / this.world.metersPerMile,
    );
    this.application.render();
    this.changed();
  }
  destroy(): void {
    this.closed = true;
    this.observer?.disconnect();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    if (this.initialized) this.application.destroy(true, { children: true });
  }
}
