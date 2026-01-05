// Math Utils Index
// Siehe: docs/architecture/constants.md

// Vector operations (3D)
export {
  type Vector3,
  type WeightedVector,
  getDirectionVector,
  vectorMagnitude,
  normalizeVector,
  scaleVector,
  addVectors,
  subtractVectors,
  dotProduct,
  sumWeightedVectors,
  zeroVector,
} from './vector';

// Clamping utilities
export { clamp, clamp01 } from './clamp';
