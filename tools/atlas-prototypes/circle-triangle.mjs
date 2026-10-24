/** Analytic area fraction of a disk inside a triangle.
 *
 * Coordinates are translated to the disk center and scaled before any cross
 * products are formed. The returned `error` is an absolute fraction error
 * allowance based on floating point operation magnitudes (including the
 * cancellation in the edge integral and the triangle normalization). It is a
 * conservative numerical estimate, not a formal bound on the host libm.
 */
const EPS = Number.EPSILON;

function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function insideTriangle(points) {
  const p = [0, 0];
  let sign = 0;
  for (let i = 0; i < 3; i++) {
    const value = cross([points[(i + 1) % 3][0] - points[i][0], points[(i + 1) % 3][1] - points[i][1]],
      [p[0] - points[i][0], p[1] - points[i][1]]);
    if (value !== 0) {
      const next = Math.sign(value);
      if (sign && sign !== next) return false;
      sign = next;
    }
  }
  return true;
}

function pointSegmentDistanceSquared(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  if (!length2) return dot(a, a);
  const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length2));
  const x = a[0] + t * dx, y = a[1] + t * dy;
  return x * x + y * y;
}

function edgeIntegral(a, b, radius) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const A = dx * dx + dy * dy;
  const B = 2 * (a[0] * dx + a[1] * dy);
  const C = a[0] * a[0] + a[1] * a[1] - radius * radius;
  const cuts = [0, 1];
  if (A > 0) {
    const discriminant = B * B - 4 * A * C;
    // A slightly negative discriminant can be a rounded tangent. Omitting
    // that cut is harmless for area, but retaining it avoids a branch jump.
    const discGuard = 16 * EPS * (Math.abs(B * B) + Math.abs(4 * A * C));
    if (discriminant >= -discGuard) {
      const root = Math.sqrt(Math.max(0, discriminant));
      const q = -0.5 * (B + (B < 0 ? -root : root));
      const roots = q === 0 ? [-B / (2 * A)] : [q / A, C / q];
      for (const t of roots) if (t > 0 && t < 1 && Number.isFinite(t)) cuts.push(t);
    }
  }
  cuts.sort((x, y) => x - y);
  const unique = cuts.filter((t, i) => !i || t !== cuts[i - 1]);
  let sum = 0, magnitude = 0;
  for (let i = 0; i + 1 < unique.length; i++) {
    const t0 = unique[i], t1 = unique[i + 1];
    const p = [a[0] + dx * t0, a[1] + dy * t0];
    const q = [a[0] + dx * t1, a[1] + dy * t1];
    const mid = [a[0] + dx * ((t0 + t1) / 2), a[1] + dy * ((t0 + t1) / 2)];
    let term;
    if (dot(mid, mid) <= radius * radius) term = cross(p, q) / 2;
    else term = radius * radius * Math.atan2(cross(p, q), dot(p, q)) / 2;
    sum += term;
    magnitude += Math.abs(term);
  }
  return {sum, magnitude};
}

/** Return {fraction,error}, or undefined for invalid/degenerate input. */
export function circleTriangleFraction(triangle3, center, radius) {
  if (!Array.isArray(triangle3) || triangle3.length !== 3 || !Array.isArray(center) || center.length < 2 ||
      !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(center[0]) || !Number.isFinite(center[1]) ||
      triangle3.some(p => !Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return undefined;

  const raw = triangle3.map(p => [p[0] - center[0], p[1] - center[1]]);
  if (raw.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return undefined;
  const worldMagnitude = Math.max(Math.abs(center[0]), Math.abs(center[1]),
    ...triangle3.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]), radius);
  const scale = Math.max(radius, ...raw.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]));
  if (!(scale > 0) || !Number.isFinite(scale)) return undefined;
  const points = raw.map(p => [p[0] / scale, p[1] / scale]);
  const r = radius / scale;
  const area2 = cross([points[1][0] - points[0][0], points[1][1] - points[0][1]],
    [points[2][0] - points[0][0], points[2][1] - points[0][1]]);
  const denominator = Math.abs(area2) / 2;
  if (!(denominator > 0) || !Number.isFinite(denominator)) return undefined;
  const denominatorMagnitude = (Math.abs(points[1][0] - points[0][0]) * Math.abs(points[2][1] - points[0][1]) +
    Math.abs(points[1][1] - points[0][1]) * Math.abs(points[2][0] - points[0][0])) / 2;
  // Account for subtraction and normalization uncertainty in the input
  // coordinates, plus radius scaling. The disk uncertainty is a radial band;
  // triangle coordinate uncertainty is bounded by strips along its edges.
  // Large world offsets can make the geometry genuinely unresolved at the
  // requested radius.
  const pointMagnitude = Math.max(...points.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]));
  const radialUncertainty = 32 * EPS * (worldMagnitude / scale + pointMagnitude + r + 1) + Number.MIN_VALUE / scale;
  if (!Number.isFinite(radialUncertainty) || radialUncertainty >= r) return undefined;
  const edgeLengths = points.map((p, i) => Math.hypot(points[(i + 1) % 3][0] - p[0], points[(i + 1) % 3][1] - p[1]));
  const perimeter = edgeLengths.reduce((sum, length) => sum + length, 0);
  const triangleBoundaryArea = perimeter * radialUncertainty + 3 * Math.PI * radialUncertainty * radialUncertainty;
  if (!Number.isFinite(triangleBoundaryArea)) return undefined;
  const denominatorError = 8 * EPS * denominatorMagnitude + triangleBoundaryArea + Number.MIN_VALUE;
  const denominatorRelativeError = denominatorError / denominator;
  if (!Number.isFinite(denominatorRelativeError) || denominatorRelativeError >= 1) return undefined;
  const guard = radialUncertainty + 64 * EPS * Math.max(1, r, pointMagnitude);
  const outerRadius = r + radialUncertainty;
  const innerRadius = Math.max(0, r - radialUncertainty);
  const annulusArea = Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius);
  if (!Number.isFinite(annulusArea)) return undefined;
  const boundedError = (numeratorAbsoluteError, fraction) => {
    const numeratorRelativeError = numeratorAbsoluteError / denominator;
    const total = (numeratorRelativeError + fraction * denominatorRelativeError) /
      (1 - denominatorRelativeError) + 32 * EPS;
    if (!Number.isFinite(total)) return undefined;
    return Math.min(1, total);
  };

  // Safe geometric shortcuts avoid sector cancellation in common cases.
  if (points.every(p => Math.hypot(...p) <= r - guard)) {
    return {fraction: 1, error: Math.min(1, denominatorRelativeError + 32 * EPS)};
  }
  const originInside = insideTriangle(points);
  const nearest2 = Math.min(...points.map((p, i) => pointSegmentDistanceSquared(p, points[(i + 1) % 3])));
  if (!originInside && nearest2 > (r + guard) * (r + guard)) return {fraction: 0, error: 0};
  if (originInside && nearest2 > (r + guard) * (r + guard)) {
    const diskArea = Math.PI * r * r;
    const fraction = Math.max(0, Math.min(1, diskArea / denominator));
    const error = boundedError(annulusArea + triangleBoundaryArea + 64 * EPS * (fraction + 1) * denominator, fraction);
    return error === undefined ? undefined : {fraction, error};
  }

  let signedArea = 0, magnitude = 0;
  for (let i = 0; i < 3; i++) {
    const part = edgeIntegral(points[i], points[(i + 1) % 3], r);
    signedArea += part.sum;
    magnitude += part.magnitude;
  }
  const numerator = Math.abs(signedArea);
  const fraction = Math.max(0, Math.min(1, numerator / denominator));
  // Covers edge arithmetic, root splitting, atan2, sum cancellation, and
  // division. Scaling by integral magnitude is essential for a tiny triangle
  // whose oriented boundary terms nearly cancel.
  const numeratorError = 128 * EPS * (magnitude + Math.abs(signedArea) + r * r) + Number.MIN_VALUE;
  // Use ratios instead of denominator squared: the latter underflows for
  // legitimate, very thin triangles even when their area ratio is finite.
  const error = boundedError(numeratorError + annulusArea + triangleBoundaryArea, fraction);
  return error === undefined ? undefined : {fraction, error};
}
