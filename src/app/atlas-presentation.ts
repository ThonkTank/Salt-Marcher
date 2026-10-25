import type { AtlasCanvasScene, PaintHit } from "./atlas-canvas-scene";
import type { Point } from "./contracts";

/** Presentation boundary shared by the Atlas camera, existing tools and GPU scene.
 * Neither the renderer nor a visual hit may write canonical campaign data. */
export interface AtlasPresentation {
  readonly ready: boolean;
  /** Publish map and transient overlay together. Async renderers resolve only
   * after their matching GPU frame; Canvas must await this before authorizing input. */
  batch?(paint: () => void): void | Promise<void>;
  navigationPoint(event:{clientX:number;clientY:number}):Point|null;
  paint(
    scene: AtlasCanvasScene,
    origin: Point,
    images: ReadonlyMap<string, CanvasImageSource>,
  ): void;
  overlay(scene: AtlasCanvasScene, origin: Point): void;
  point(event: { clientX: number; clientY: number }): Point;
  hitAt(
    event: { clientX: number; clientY: number },
    keys: string[],
  ): PaintHit | null;
}
