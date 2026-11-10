import { Graphics } from "pixi.js";
import {
  houseCorners,
  type EditorDocument,
  type Point,
  type Bounds,
} from "../model";
import type { Camera } from "./WorldRenderer";

/** Bounded header projection. Terrain and interiors never become house authors. */
export class HouseView {
  readonly graphics = new Graphics();
  private key = "";
  /** Conservative reservation for paths, tessellation and in-flight buffers. */
  bytes = 0;
  selectedId: string | null = null;

  reset(): void {
    this.key = "";
    this.selectedId = null;
    this.graphics.clear();
  }

  draw(
    document: EditorDocument,
    camera: Camera,
    bounds: Bounds,
    width: number,
    height: number,
    reserve: (additionalBytes: number) => boolean,
  ): void {
    const ready = document.isHouseRegionReady(bounds);
    const key = [
      document.sessionId,
      document.houseGeneration,
      ready,
      this.selectedId,
      camera.x,
      camera.y,
      camera.scale,
      width,
      height,
    ].join(":");
    if (this.key === key) return;
    const headers = ready ? document.housesInBounds(bounds) : [];
    const bytes = headers.length * 4096;
    if (!reserve(Math.max(0, bytes - this.bytes)))
      throw new Error(
        "Die Hausdarstellung überschreitet das gemeinsame Darstellungsbudget.",
      );
    this.key = key;
    // Pixi may retain tessellation/buffer capacity after clear(), so retain the
    // high-water reservation across smaller views and document replacement.
    this.bytes = Math.max(this.bytes, bytes);
    const graphics = this.graphics.clear();
    if (!ready) return;
    const screen = ([x, y]: Point): Point => [
      (x - camera.x) * camera.scale + width / 2,
      (y - camera.y) * camera.scale + height / 2,
    ];
    for (const house of headers) {
      const corners = houseCorners(house).map(screen);
      const selected = house.id === this.selectedId;
      graphics.poly(corners.flat()).fill({ color: 0x9e634d });
      graphics.stroke({
        color: selected ? 0xf6d984 : 0x352e2c,
        width: selected ? 2.5 : 1,
      });
      if (Math.min(house.width, house.depth) * camera.scale >= 5) {
        const ridgeStart: Point = [
          (corners[0][0] + corners[3][0]) / 2,
          (corners[0][1] + corners[3][1]) / 2,
        ];
        const ridgeEnd: Point = [
          (corners[1][0] + corners[2][0]) / 2,
          (corners[1][1] + corners[2][1]) / 2,
        ];
        graphics
          .moveTo(...ridgeStart)
          .lineTo(...ridgeEnd)
          .stroke({ color: 0x563c32, width: 1 });
      }
    }
  }
}
