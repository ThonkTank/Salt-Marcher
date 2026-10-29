export interface CanvasBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
type Point = Pick<CanvasBox, 'x' | 'y'>;

/** World metres: x east, y south, z up. Frame is the footprint at zero tilt.
 * CPU projection, author clipping and GPU adapters share this contract. */
export interface AtlasCameraPose {
  frame: CanvasBox;
  focusM: number;
  tilt: number;
  rotation: number;
  exaggeration: number;
  projection?: 'perspective';
}
export const ATLAS_CAMERA_FOV = 36.86989764584402;
const halfFovTan = Math.tan((ATLAS_CAMERA_FOV * Math.PI) / 360);

function atlasCameraBasis(pose: AtlasCameraPose) {
  const a = (pose.rotation * Math.PI) / 180,
    t = (pose.tilt * Math.PI) / 180;
  return {
    sin: Math.sin(a),
    cos: Math.cos(a),
    tiltSin: Math.sin(t),
    tiltCos: Math.cos(t),
    distance: pose.frame.height / (2 * halfFovTan),
  };
}

/** Relative eye avoids rounding away room details at far world coordinates. */
export function atlasCameraEye(pose: AtlasCameraPose) {
  const b = atlasCameraBasis(pose);
  return {
    x: b.sin * b.tiltSin * b.distance,
    y: b.cos * b.tiltSin * b.distance,
    z: b.tiltCos * b.distance,
  };
}

/** Normalized viewport coordinates. Depth <= 0 is behind the camera. */
export function atlasProject(pose: AtlasCameraPose, p: Point, heightM: number) {
  const b = atlasCameraBasis(pose),
    dx = p.x - pose.frame.x - pose.frame.width / 2,
    dy = p.y - pose.frame.y - pose.frame.height / 2,
    dz = (heightM - pose.focusM) * pose.exaggeration;
  const horizontal = dx * b.cos - dy * b.sin,
    down = (dx * b.sin + dy * b.cos) * b.tiltCos - dz * b.tiltSin;
  const depth = b.distance - (dx * b.sin + dy * b.cos) * b.tiltSin - dz * b.tiltCos;
  const scale = pose.projection === 'perspective' ? depth / b.distance : 1;
  return {
    x: 0.5 + horizontal / (pose.frame.width * scale),
    y: 0.5 + down / (pose.frame.height * scale),
    depth,
  };
}

/** Ray intersection with a world-height work plane; sky/behind hits are absent. */
export function atlasPlanePoint(
  pose: AtlasCameraPose,
  screen: Point,
  heightM = pose.focusM,
): Point | null {
  const b = atlasCameraBasis(pose),
    eye = atlasCameraEye(pose),
    sx = (screen.x - 0.5) * pose.frame.width,
    sy = (screen.y - 0.5) * pose.frame.height,
    z = (heightM - pose.focusM) * pose.exaggeration;
  const plane = {
    x: b.cos * sx + b.sin * b.tiltCos * sy,
    y: -b.sin * sx + b.cos * b.tiltCos * sy,
    z: -b.tiltSin * sy,
  };
  if (pose.projection !== 'perspective') {
    const advance = (z - plane.z) / b.tiltCos;
    return {
      x: pose.frame.x + pose.frame.width / 2 + plane.x + b.sin * b.tiltSin * advance,
      y: pose.frame.y + pose.frame.height / 2 + plane.y + b.cos * b.tiltSin * advance,
    };
  }
  const dz = plane.z - eye.z;
  if (Math.abs(dz) < 1e-12) return null;
  const u = (z - eye.z) / dz;
  if (u <= 0) return null;
  return {
    x: pose.frame.x + pose.frame.width / 2 + eye.x + (plane.x - eye.x) * u,
    y: pose.frame.y + pose.frame.height / 2 + eye.y + (plane.y - eye.y) * u,
  };
}

export interface AtlasCameraAnchor {
  point: Point & { heightM: number };
  /** Normalized CSS viewport position, independent of device scale. */
  screen: Point;
}

export function atlasNormalizeRotation(rotation: number) {
  return ((((rotation + 180) % 360) + 360) % 360) - 180;
}

/** Translate a pose so a physical terrain point retains its screen position. */
export function atlasAnchorCamera(
  pose: AtlasCameraPose,
  anchor: AtlasCameraAnchor,
): AtlasCameraPose {
  const at = atlasPlanePoint(pose, anchor.screen, anchor.point.heightM);
  if (!at) return pose;
  return {
    ...pose,
    frame: {
      ...pose.frame,
      x: pose.frame.x + anchor.point.x - at.x,
      y: pose.frame.y + anchor.point.y - at.y,
    },
  };
}

export function atlasCameraWorldEye(pose: AtlasCameraPose) {
  const offset = atlasCameraEye(pose);
  return {
    x: pose.frame.x + pose.frame.width / 2 + offset.x,
    y: pose.frame.y + pose.frame.height / 2 + offset.y,
    heightM: pose.focusM + offset.z / pose.exaggeration,
  };
}

/** Follow the eye's path, including intermediate orbit/zoom poses. Unknown
 * terrain retains the last known ground plane; it never certifies free flight. */
export function atlasSafeCameraMove(
  before: AtlasCameraPose,
  requested: AtlasCameraPose,
  height: (point: Point) => number | null,
  intersects: (
    from: ReturnType<typeof atlasCameraWorldEye>,
    to: ReturnType<typeof atlasCameraWorldEye>,
  ) => boolean,
): AtlasCameraPose {
  const rotation = atlasNormalizeRotation(requested.rotation - before.rotation);
  const steps = Math.max(
    1,
    Math.ceil(Math.abs(rotation) / 2),
    Math.ceil(Math.abs(requested.tilt - before.tilt) / 2),
    Math.ceil(Math.abs(Math.log(requested.frame.width / before.frame.width)) / 0.04),
  );
  let safe = before;
  let eye = atlasCameraWorldEye(before);
  let ground = height(eye) ?? before.focusM;
  const clearance = (p: AtlasCameraPose) => Math.max(0.02, Math.min(2, p.frame.height * 1e-5));
  const poseAt = (t: number): AtlasCameraPose => {
    const mix = (a: number, b: number) => a + (b - a) * t;
    return {
      ...requested,
      frame: {
        x: mix(before.frame.x, requested.frame.x),
        y: mix(before.frame.y, requested.frame.y),
        width: mix(before.frame.width, requested.frame.width),
        height: mix(before.frame.height, requested.frame.height),
      },
      focusM: mix(before.focusM, requested.focusM),
      tilt: mix(before.tilt, requested.tilt),
      rotation: atlasNormalizeRotation(before.rotation + rotation * t),
      exaggeration: mix(before.exaggeration, requested.exaggeration),
    };
  };
  for (let step = 1; step <= steps; step++) {
    const next = poseAt(step / steps),
      nextEye = atlasCameraWorldEye(next);
    const nextGround = height(nextEye) ?? ground;
    const margin = clearance(next);
    if (
      nextEye.heightM <= nextGround + margin ||
      intersects(
        { ...eye, heightM: eye.heightM - clearance(safe) },
        { ...nextEye, heightM: nextEye.heightM - margin },
      )
    )
      return safe;
    safe = next;
    eye = nextEye;
    ground = nextGround;
  }
  return safe;
}

/** Rebase the focus-height plane without moving the eye, orientation or any
 * projected world point. This keeps close zoom useful after crossing relief. */
export function atlasRefocusCamera(pose: AtlasCameraPose, focusM: number): AtlasCameraPose {
  const eye = atlasCameraWorldEye(pose);
  const distance =
    ((eye.heightM - focusM) * pose.exaggeration) / Math.cos((pose.tilt * Math.PI) / 180);
  const oldDistance = pose.frame.height / (2 * halfFovTan);
  if (!Number.isFinite(distance) || distance <= 0 || Math.abs(focusM - pose.focusM) < 1e-8)
    return pose;
  const ratio = distance / oldDistance;
  const offset = atlasCameraEye(pose);
  const width = pose.frame.width * ratio,
    height = pose.frame.height * ratio;
  return {
    ...pose,
    focusM,
    frame: {
      x: eye.x - offset.x * ratio - width / 2,
      y: eye.y - offset.y * ratio - height / 2,
      width,
      height,
    },
  };
}

/** The shared near/far planes of the native metric view and author rays. */
export function atlasCameraClipRange(pose: AtlasCameraPose) {
  const distance = pose.frame.height / (2 * halfFovTan);
  const near = Math.max(0.01, distance / 1000);
  return { near, far: Math.max(100_000, distance * 1000, near * 10_000) };
}
