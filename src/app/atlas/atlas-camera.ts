import type { Point } from '../contracts';
import type { CanvasBox } from '../passive-map-canvas';

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
