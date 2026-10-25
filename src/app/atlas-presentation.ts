import type { AtlasCanvasScene, PaintHit } from "./atlas-canvas-scene";
import type { Point } from "./contracts";

/** The presentation owns this frame failure and its retry UI. A healthy Canvas
 * must revoke its acknowledgement without retiring its own scene or bitmaps. */
export class AtlasPresentationFrameError extends Error {
  constructor(readonly presentation: AtlasPresentation, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), {cause});
    this.name = 'AtlasPresentationFrameError';
  }
}

/** Presentation boundary shared by the Atlas camera, existing tools and GPU scene.
 * Neither the renderer nor a visual hit may write canonical campaign data. */
export interface AtlasPresentation {
  readonly ready: boolean;
  /** Publish map and transient overlay together. Async renderers resolve only
   * after their matching GPU frame; Canvas must await this before authorizing input.
   * Owned asynchronous failures are reported by the presentation and rejected as
   * AtlasPresentationFrameError; synchronous paint/Canvas failures remain local. */
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
