import {Matrix4} from '@math.gl/core';
import type {AtlasMetricRoot} from './atlas-metric-space';

/** One numerical matrix path for Deck's viewport and author-ray unprojection.
 * Algebraic shortcuts change rounding at triangle boundaries in large roots. */
export function atlasMapLibreViewMatrices(
  frame: {projection: readonly number[]; mainMatrix: readonly number[]},
  root: Readonly<AtlasMetricRoot>, sceneOrigin: Readonly<{x: number; y: number}>
): {projectionMatrix: Matrix4; viewMatrix: Matrix4} | null {
  if (frame.projection.length !== 16 || frame.mainMatrix.length !== 16
    || ![...frame.projection, ...frame.mainMatrix, root.x, root.y, root.size,
      sceneOrigin.x, sceneOrigin.y].every(Number.isFinite) || root.size <= 0) return null;
  const localToGlobal = new Matrix4();
  localToGlobal[12] = (sceneOrigin.x - root.x) / root.size;
  localToGlobal[13] = (sceneOrigin.y - root.y) / root.size;
  const projectionMatrix = new Matrix4(frame.projection);
  const determinant = projectionMatrix.determinant();
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const viewMatrix = projectionMatrix.clone().invert()
    .multiplyRight(frame.mainMatrix).multiplyRight(localToGlobal);
  return viewMatrix.every(Number.isFinite) ? {projectionMatrix, viewMatrix} : null;
}
