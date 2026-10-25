import type { AtlasCanvasScene, PaintHit } from './atlas-canvas-scene';
import type { Point } from '../contracts';

/** Presentation boundary shared by the Atlas camera, existing tools and GPU scene.
 * Neither the renderer nor a visual hit may write canonical campaign data. */
export interface AtlasPresentation {
  readonly ready: boolean;
  /** Publish map and transient overlay as one completed frame. */
  batch?(paint: () => void): void;
  navigationPoint(event: { clientX: number; clientY: number }): Point | null;
  paint(
    scene: AtlasCanvasScene,
    origin: Point,
    images: ReadonlyMap<string, CanvasImageSource>,
  ): void;
  overlay(scene: AtlasCanvasScene, origin: Point): void;
  point(event: { clientX: number; clientY: number }): Point;
  hitAt(event: { clientX: number; clientY: number }, keys: string[]): PaintHit | null;
}
