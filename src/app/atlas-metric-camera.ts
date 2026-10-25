import { Matrix4 } from '@math.gl/core';
import { Viewport, View } from '@deck.gl/core';
import type { Point } from './contracts';
import { ATLAS_CAMERA_FOV, atlasCameraEye, atlasPlanePoint } from './atlas-camera';

/** Canonical Atlas camera: x east, y south, height above datum in metres. */
export interface AtlasMetricCamera {
  readonly focus: Readonly<Point>;
  readonly focusHeightM: number;
  readonly metersPerPixel: number;
  readonly rotation: number;
  readonly tilt: number;
  readonly exaggeration: number;
}

export interface AtlasMetricOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface AtlasMetricWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly heightM: number;
}
export interface AtlasMetricPixel {
  readonly x: number;
  readonly y: number;
}
export interface AtlasMetricFrameOptions {
  readonly near?: number;
  readonly far?: number;
  readonly crop?: { width: number; height: number; x: number; y: number };
}

export interface AtlasMetricFrame {
  readonly camera: AtlasMetricCamera;
  readonly width: number;
  readonly height: number;
  readonly origin: AtlasMetricOrigin;
  readonly viewMatrix: Matrix4;
  readonly projectionMatrix: Matrix4;
  readonly near: number;
  readonly far: number;
  readonly viewport: Viewport;
  /** Project a canonical physical point to top-left canvas pixels. */
  project(point: AtlasMetricWorldPoint): AtlasMetricProjectedPoint;
  /** Return the WebGL near/far segment in canonical physical world metres. */
  ray(
    pixel: AtlasMetricPixel,
  ): readonly [readonly [number, number, number], readonly [number, number, number]] | null;
  /** Subtract the double-precision render origin before geometry becomes Float32. */
  toLocal(point: AtlasMetricWorldPoint): readonly [number, number, number];
}

export interface AtlasMetricProjectedPoint extends AtlasMetricPixel {
  /** Positive camera distance in metres of the exaggerated render space. */
  readonly depthM: number;
  /** Deck viewport's projected clip depth. */
  readonly clipDepth: number;
  readonly visible: boolean;
}

const ORIGIN_GRID_METERS = 256;
const FOV_RADIANS = (ATLAS_CAMERA_FOV * Math.PI) / 180;
const DEFAULT_NEAR = 0.01;

function finite(...values: number[]): boolean {
  return values.every(Number.isFinite);
}

function validateCamera(camera: AtlasMetricCamera): void {
  if (
    !finite(
      camera.focus.x,
      camera.focus.y,
      camera.focusHeightM,
      camera.metersPerPixel,
      camera.rotation,
      camera.tilt,
      camera.exaggeration,
    ) ||
    camera.metersPerPixel <= 0 ||
    camera.exaggeration <= 0 ||
    camera.tilt < 0 ||
    camera.tilt > 75
  ) {
    throw new Error('Invalid Atlas metric camera');
  }
}

function snappedOrigin(camera: AtlasMetricCamera): AtlasMetricOrigin {
  return {
    x: Math.floor(camera.focus.x / ORIGIN_GRID_METERS) * ORIGIN_GRID_METERS,
    y: Math.floor(camera.focus.y / ORIGIN_GRID_METERS) * ORIGIN_GRID_METERS,
    z: Math.floor(camera.focusHeightM / ORIGIN_GRID_METERS) * ORIGIN_GRID_METERS,
  };
}

function cameraPose(camera: AtlasMetricCamera, width: number, height: number) {
  return {
    frame: {
      x: camera.focus.x - (width * camera.metersPerPixel) / 2,
      y: camera.focus.y - (height * camera.metersPerPixel) / 2,
      width: width * camera.metersPerPixel,
      height: height * camera.metersPerPixel,
    },
    focusM: camera.focusHeightM,
    tilt: camera.tilt,
    rotation: camera.rotation,
    exaggeration: camera.exaggeration,
    projection: 'perspective' as const,
  };
}

function makeMatrices(
  camera: AtlasMetricCamera,
  width: number,
  height: number,
  origin: AtlasMetricOrigin,
  near: number,
  far: number,
): { view: Matrix4; projection: Matrix4 } {
  const pose = cameraPose(camera, width, height);
  const radians = (camera.rotation * Math.PI) / 180;
  const tilt = (camera.tilt * Math.PI) / 180;
  const sin = Math.sin(radians),
    cos = Math.cos(radians);
  const sinTilt = Math.sin(tilt),
    cosTilt = Math.cos(tilt);
  const right = [cos, -sin, 0];
  const up = [-sin * cosTilt, -cos * cosTilt, sinTilt];
  const back = [sin * sinTilt, cos * sinTilt, cosTilt];
  const focus = [
    camera.focus.x - origin.x,
    camera.focus.y - origin.y,
    (camera.focusHeightM - origin.z) * camera.exaggeration,
  ];
  const eyeOffset = atlasCameraEye(pose);
  const eye = [focus[0]! + eyeOffset.x, focus[1]! + eyeOffset.y, focus[2]! + eyeOffset.z];
  // Explicit camera basis preserves the Atlas x-east/y-south handedness.
  const view = new Matrix4([
    right[0]!,
    up[0]!,
    back[0]!,
    0,
    right[1]!,
    up[1]!,
    back[1]!,
    0,
    right[2]!,
    up[2]!,
    back[2]!,
    0,
    -(right[0]! * eye[0]! + right[1]! * eye[1]! + right[2]! * eye[2]!),
    -(up[0]! * eye[0]! + up[1]! * eye[1]! + up[2]! * eye[2]!),
    -(back[0]! * eye[0]! + back[1]! * eye[1]! + back[2]! * eye[2]!),
    1,
  ]);
  const projection = new Matrix4().perspective({
    fovy: FOV_RADIANS,
    aspect: width / height,
    near,
    far,
  });
  return { view, projection };
}

/** Build a local, right-handed-clip Deck viewport without projecting through a geographic world. */
export function atlasMetricFrame(
  camera: AtlasMetricCamera,
  width: number,
  height: number,
  renderOrigin: AtlasMetricOrigin = snappedOrigin(camera),
  options: AtlasMetricFrameOptions = {},
): AtlasMetricFrame {
  validateCamera(camera);
  if (
    !finite(width, height) ||
    width <= 0 ||
    height <= 0 ||
    !finite(renderOrigin.x, renderOrigin.y, renderOrigin.z)
  )
    throw new Error('Invalid Atlas metric frame dimensions or render origin');
  const crop = options.crop;
  if (
    crop &&
    (!finite(crop.width, crop.height, crop.x, crop.y) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.x + width > crop.width ||
      crop.y + height > crop.height)
  )
    throw Error('Invalid Atlas output crop');
  const fullWidth = crop?.width ?? width,
    fullHeight = crop?.height ?? height;
  const cameraDistance = (fullHeight * camera.metersPerPixel) / (2 * Math.tan(FOV_RADIANS / 2));
  const near = options.near ?? Math.max(DEFAULT_NEAR, cameraDistance / 1000);
  const far = options.far ?? Math.max(100_000, cameraDistance * 1000, near * 10_000);
  if (!finite(near, far) || near <= 0 || far <= near)
    throw new Error('Invalid Atlas metric clip range');
  const origin = Object.freeze({ ...renderOrigin });
  const matrices = makeMatrices(camera, fullWidth, fullHeight, origin, near, far);
  // Unproject through the full camera to avoid crop-dependent matrix inversion error.
  const rayProjection = matrices.projection.clone();
  if (crop) {
    const p = matrices.projection,
      sx = fullWidth / width,
      sy = fullHeight / height,
      tx = (fullWidth - 2 * crop.x - width) / width,
      ty = (2 * crop.y + height - fullHeight) / height;
    for (let c = 0; c < 4; c++) {
      const at = c * 4;
      p[at] = p[at]! * sx + p[at + 3]! * tx;
      p[at + 1] = p[at + 1]! * sy + p[at + 3]! * ty;
    }
  }
  const viewport = new Viewport({
    id: 'atlas-metric',
    width,
    height,
    position: [0, 0, 0],
    focalDistance: cameraDistance,
    viewMatrix: Array.from(matrices.view),
    projectionMatrix: Array.from(matrices.projection),
    near,
    far,
  });
  const frozenCamera = Object.freeze({ ...camera, focus: Object.freeze({ ...camera.focus }) });
  const clipMatrix = rayProjection.multiplyRight(matrices.view);
  const determinant = clipMatrix.determinant();
  const inverseClip =
    Number.isFinite(determinant) && determinant !== 0 ? clipMatrix.clone().invert() : null;
  return Object.freeze({
    camera: frozenCamera,
    width,
    height,
    origin,
    viewMatrix: matrices.view,
    projectionMatrix: matrices.projection,
    near,
    far,
    viewport,
    toLocal(point: AtlasMetricWorldPoint): readonly [number, number, number] {
      if (!finite(point.x, point.y, point.heightM))
        throw new Error('Atlas metric point must be finite');
      return [
        point.x - origin.x,
        point.y - origin.y,
        (point.heightM - origin.z) * frozenCamera.exaggeration,
      ];
    },
    project(point: AtlasMetricWorldPoint): AtlasMetricProjectedPoint {
      const local = this.toLocal(point);
      const projected = viewport.project([...local]);
      const cameraPoint = matrices.view.transformPoint([...local]);
      const depthM = -cameraPoint[2]!;
      const clipDepth = projected[2]!;
      const visible =
        finite(projected[0]!, projected[1]!, clipDepth, depthM) &&
        depthM >= near &&
        depthM <= far &&
        projected[0]! >= 0 &&
        projected[0]! <= width &&
        projected[1]! >= 0 &&
        projected[1]! <= height &&
        clipDepth >= 0 &&
        clipDepth <= 1;
      return { x: projected[0]!, y: projected[1]!, depthM, clipDepth, visible };
    },
    ray(pixel: AtlasMetricPixel) {
      if (
        !inverseClip ||
        !finite(pixel.x, pixel.y) ||
        pixel.x < 0 ||
        pixel.x > width ||
        pixel.y < 0 ||
        pixel.y > height
      )
        return null;
      const x = ((pixel.x + (crop?.x ?? 0)) / fullWidth) * 2 - 1;
      const y = 1 - ((pixel.y + (crop?.y ?? 0)) / fullHeight) * 2;
      const unproject = (z: number): readonly [number, number, number] | null => {
        const local = inverseClip.transformPoint([x, y, z]);
        const canonical: [number, number, number] = [
          local[0]! + origin.x,
          local[1]! + origin.y,
          local[2]! / frozenCamera.exaggeration + origin.z,
        ];
        return finite(...canonical) ? canonical : null;
      };
      const nearPoint = unproject(-1),
        farPoint = unproject(1);
      return nearPoint && farPoint ? ([nearPoint, farPoint] as const) : null;
    },
  });
}

export interface AtlasMetricViewProps {
  readonly id?: string;
  readonly frame: AtlasMetricFrame;
}

/** Public Deck View that installs the already-built Cartesian metric viewport. */
export class AtlasMetricView extends View<any, AtlasMetricViewProps> {
  constructor(props: AtlasMetricViewProps) {
    super({ ...props, id: props.id ?? 'atlas-metric' });
  }
  getViewportType(): typeof Viewport {
    return Viewport;
  }
  protected get ControllerType(): never {
    return class NoController {} as never;
  }
  makeViewport({ width, height }: { width: number; height: number }): Viewport | null {
    if (!width || !height) return null;
    const frame = this.props.frame;
    if (width === frame.width && height === frame.height) return frame.viewport;
    return atlasMetricFrame(frame.camera, width, height, frame.origin, {
      near: frame.near,
      far: frame.far,
    }).viewport;
  }
}

function planeOffset(
  camera: AtlasMetricCamera,
  width: number,
  height: number,
  pixel: AtlasMetricPixel,
): Point | null {
  const pose = cameraPose({ ...camera, focus: { x: 0, y: 0 } }, width, height);
  const offset = atlasPlanePoint(
    pose,
    { x: pixel.x / width, y: pixel.y / height },
    camera.focusHeightM,
  );
  return offset;
}

/** Zoom while keeping the physical point under the cursor fixed in screen space. */
export function atlasMetricZoomAt(
  camera: AtlasMetricCamera,
  width: number,
  height: number,
  pixel: AtlasMetricPixel,
  factor: number,
): AtlasMetricCamera {
  validateCamera(camera);
  if (!finite(width, height, pixel.x, pixel.y, factor) || width <= 0 || height <= 0 || factor <= 0)
    throw new Error('Invalid Atlas zoom-at request');
  const before = atlasPlanePoint(
    cameraPose(camera, width, height),
    { x: pixel.x / width, y: pixel.y / height },
    camera.focusHeightM,
  );
  const next = { ...camera, metersPerPixel: camera.metersPerPixel * factor };
  validateCamera(next);
  // Above the horizon there is no focus-plane anchor. Zoom around the focus
  // instead of inventing an intersection at infinity or throwing from input.
  if (!before) return { ...next, focus: { ...camera.focus } };
  const afterOffset = planeOffset(next, width, height, pixel);
  if (!afterOffset) return { ...next, focus: { ...camera.focus } };
  return { ...next, focus: { x: before.x - afterOffset.x, y: before.y - afterOffset.y } };
}

/** Pan the camera so the point under `fromPixel` moves to `toPixel`. */
export function atlasMetricPanAt(
  camera: AtlasMetricCamera,
  width: number,
  height: number,
  fromPixel: AtlasMetricPixel,
  toPixel: AtlasMetricPixel,
): AtlasMetricCamera {
  validateCamera(camera);
  if (
    !finite(width, height, fromPixel.x, fromPixel.y, toPixel.x, toPixel.y) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error('Invalid Atlas pan request');
  const anchor = atlasPlanePoint(
    cameraPose(camera, width, height),
    { x: fromPixel.x / width, y: fromPixel.y / height },
    camera.focusHeightM,
  );
  if (!anchor) return camera;
  const targetOffset = planeOffset(camera, width, height, toPixel);
  if (!targetOffset) return camera;
  return { ...camera, focus: { x: anchor.x - targetOffset.x, y: anchor.y - targetOffset.y } };
}
