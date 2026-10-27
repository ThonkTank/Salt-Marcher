import type { AtlasCanvasScene, PaintHit } from './atlas-canvas-scene';
import type { AtlasCameraAnchor, CanvasBox } from './atlas-camera';
import type { Point } from '../shared/contracts';

/** Presentation boundary shared by the Atlas camera, existing tools and GPU scene.
 * Neither the renderer nor a visual hit may write canonical campaign data. */
export interface AtlasPresentation {
  readonly ready: boolean;
  /** Publish map and transient overlay as one completed frame. */
  batch?(paint: () => void): void;
  cameraFrame?(
    box: CanvasBox,
    anchor?: AtlasCameraAnchor,
    angles?: { tilt: number; rotation: number },
  ): CanvasBox;
  navigationAnchor?(event: { clientX: number; clientY: number }): AtlasCameraAnchor | null;
  navigationGesture?(active: boolean): void;
  readonly cameraAngles?: { tilt: number; rotation: number };
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
