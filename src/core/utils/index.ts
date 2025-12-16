/**
 * Core Utilities - Public API
 *
 * Shared pure functions for all layers.
 */

// Hex Math
export {
  type HexCoord,
  type Point,
  hex,
  hexEquals,
  hexAdd,
  hexSubtract,
  hexScale,
  hexDistance,
  hexNeighbors,
  hexNeighbor,
  hexAdjacent,
  hexesInRadius,
  hexRing,
  coordToKey,
  keyToCoord,
  axialToPixel,
  pixelToAxial,
  axialRound,
  hexCorners,
  hexWidth,
  hexHeight,
  hexHorizontalSpacing,
  hexVerticalSpacing,
} from './hex-math';
