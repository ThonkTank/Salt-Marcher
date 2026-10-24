// Continuous surrogate state for the authored-material adapter.  Each
// channel carries point value plus scalar bounds on its first derivative,
// second derivative, and source approximation error over the current face.
const BASE = 0, FOREST = 4, PIGMENT = 5, PIGMENT_ALPHA = 8, FINAL = 9, SCRATCH = 13;

const finite = x => Number.isFinite(x) && x >= 0;
const validState = s => s && Array.isArray(s.value) && Array.isArray(s.gradient) &&
  Array.isArray(s.hessian) && Array.isArray(s.error) &&
  s.value.length === s.gradient.length && s.value.length === s.hessian.length &&
  s.value.length === s.error.length;
const zero = (s, i) => s.gradient[i] === 0 && s.hessian[i] === 0 && s.error[i] === 0;

export function makeSmoothState(background) {
  if (!Array.isArray(background) || background.some(x => !Number.isFinite(x)))
    throw new Error('Invalid smooth material background');
  return { value: [...background], gradient: background.map(() => 0),
    hessian: background.map(() => 0), error: background.map(() => 0) };
}

// For z = x(1-a) + ya, the channel values are evaluated at `point` while
// the remaining fields conservatively compose their bounds over the face.
function blendChannel(s, i, y, gy, hy, ey, alpha) {
  const x = s.value[i], gx = s.gradient[i], hx = s.hessian[i], ex = s.error[i];
  const { value: a, gradient: ga, hessian: ha, error: ea, range } = alpha;
  const [lo, hi] = range;
  const value = x * (1 - a) + y * a;
  const gradient = gx + gy + ga;
  const hessian = hx + hy + ha + 2 * (gx + gy) * ga;
  const error = Math.max((1 - lo) * ex + lo * ey, (1 - hi) * ex + hi * ey) + ea;
  if (![value, gradient, hessian, error].every(Number.isFinite) || gradient < 0 || hessian < 0 || error < 0)
    return undefined;
  return { value, gradient, hessian, error };
}

function constantAlpha(value) {
  return { value, gradient: 0, hessian: 0, error: 0, range: [value, value] };
}

function setExact(s, i, value) {
  if (!Number.isFinite(value) || i < 0 || i >= s.value.length) return false;
  s.value[i] = value; s.gradient[i] = 0; s.hessian[i] = 0; s.error[i] = 0;
  return true;
}

export function baseSmooth(color, forest) {
  if (!Array.isArray(color) || color.length < 3 || color.slice(0, 3).some(x => !Number.isFinite(x)) || !Number.isFinite(forest))
    throw new Error('Invalid smooth base material');
  return state => {
    if (!validState(state) || state.value.length <= FINAL + 2) return false;
    for (let c = 0; c < 3; c++) {
      setExact(state, BASE + c, color[c]);
      setExact(state, FINAL + c, color[c]);
    }
    if (state.value.length > 3) setExact(state, 3, 1);
    setExact(state, FOREST, forest);
    return true;
  };
}

export function scratchSmooth(value) {
  if (!Number.isFinite(value)) throw new Error('Invalid smooth scratch value');
  return state => validState(state) && setExact(state, SCRATCH, value);
}

export function editSmooth(mode) {
  if (!['clear', 'thin', 'dense'].includes(mode)) throw new Error('Unknown smooth density edit');
  return state => {
    if (!validState(state) || state.value.length <= SCRATCH || !zero(state, SCRATCH)) return false;
    const x = state.value[SCRATCH];
    const y = mode === 'clear' ? 0 : mode === 'thin' ? x * .3 : Math.min(1, x + .5);
    return setExact(state, SCRATCH, y);
  };
}

export function legacyPartSmooth(opacity) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error('Invalid legacy opacity');
  return state => {
    if (!validState(state) || state.value.length <= SCRATCH || !zero(state, SCRATCH)) return false;
    return setExact(state, SCRATCH, Math.round((opacity + state.value[SCRATCH] * (1 - opacity)) * 255) / 255);
  };
}

function featureFor(region, triangle) {
  if (!region?.varying) return { kind: 'constant' };
  const feature = typeof region.featureOnTriangle === 'function' ? region.featureOnTriangle(triangle) : undefined;
  if (feature && ['constant', 'affine', 'point'].includes(feature.kind)) return feature;
  if (region.polynomialDegreeOnTriangle?.(triangle) === 1 || region.polynomialDegree === 1)
    return { kind: 'affine' };
  return undefined;
}

function alphaRange(value, gradient, hessian, triangle, point, sourceError = 0) {
  if (!Array.isArray(triangle) || triangle.length !== 3 || triangle.some(p => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) return undefined;
  const reach = Math.max(...triangle.map(p => Math.hypot(p.x - point.x, p.y - point.y)));
  const spread = gradient * reach + sourceError;
  const lo = Math.max(0, value - spread), hi = Math.min(1, value + spread);
  return { value, gradient, hessian, error: sourceError, range: [lo, hi] };
}

export function coverSmooth(color, region, radius) {
  if (!Array.isArray(color) || color.length < 3 || color.slice(0, 3).some(x => !Number.isFinite(x)) ||
      !region || !Number.isFinite(radius) || radius < 0 || (region.varying && radius === 0)) throw new Error('Invalid smooth cover');
  return (state, triangle, point) => {
    if (!validState(state) || state.value.length <= SCRATCH || !Number.isFinite(state.value[FOREST]) || !zero(state, SCRATCH) ||
        typeof region.fade !== 'function' || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    const feature = featureFor(region, triangle);
    if (!feature) return false;
    const t = region.fade(point);
    if (!Number.isFinite(t) || t < 0 || t > 1) return false;
    const gt = feature.kind === 'constant' ? 0 : 1 / radius;
    const ht = feature.kind === 'point' ? 1 / (radius * feature.minDistance) : 0;
    if (!finite(gt) || !finite(ht)) return false;
    const a = .78 * t * t * (3 - 2 * t);
    const rgbAlpha = alphaRange(a, feature.kind === 'constant' ? 0 : 1.17 / radius,
      feature.kind === 'constant' ? 0 : 4.68 / (radius * radius), triangle, point);
    const forestTarget = Math.min(1, state.value[SCRATCH] / .8);
    const forestAlpha = alphaRange(t, gt, ht, triangle, point);
    if (!rgbAlpha || !forestAlpha) return false;
    const updates = [];
    for (let c = 0; c < 3; c++) {
      const next = blendChannel(state, BASE + c, color[c], 0, 0, 0, rgbAlpha);
      if (!next) return false;
      // Vegetation resets final RGB from the newly covered base channels.
      updates.push([BASE + c, next], [FINAL + c, next]);
    }
    const forest = blendChannel(state, FOREST, forestTarget, 0, 0, 0, forestAlpha);
    if (!forest) return false;
    updates.push([FOREST, forest]);
    for (const [i, next] of updates) {
      state.value[i] = next.value; state.gradient[i] = next.gradient;
      state.hessian[i] = next.hessian; state.error[i] = next.error;
    }
    return true;
  };
}

export function pigmentSmooth(color, operation, getAlpha) {
  if (!Array.isArray(color) || color.length < 3 || color.slice(0, 3).some(x => !Number.isFinite(x)) ||
      !['paint', 'erase'].includes(operation) || typeof getAlpha !== 'function') throw new Error('Invalid smooth pigment operation');
  return (state, triangle, point) => {
    if (!validState(state) || state.value.length <= FINAL + 2) return false;
    const a = getAlpha(state, triangle, point);
    if (!a || !Number.isFinite(a.value) || !finite(a.gradient) || !finite(a.hessian) || !finite(a.error) ||
        !Array.isArray(a.range) || a.range.length !== 2 || !a.range.every(Number.isFinite) ||
        a.range[0] < 0 || a.range[1] > 1 || a.range[0] > a.value || a.value > a.range[1]) return false;
    const alpha = { value: a.value, gradient: a.gradient, hessian: a.hessian, error: a.error, range: a.range };
    const updates = [];
    if (operation === 'paint') {
      for (let c = 0; c < 3; c++) {
        for (const i of [PIGMENT + c, FINAL + c]) {
          const next = blendChannel(state, i, color[c], 0, 0, 0, alpha);
          if (!next) return false;
          updates.push([i, next]);
        }
      }
      for (const [i, target] of [[PIGMENT_ALPHA, 1]]) {
        const next = blendChannel(state, i, target, 0, 0, 0, alpha);
        if (!next) return false;
        updates.push([i, next]);
      }
    } else {
      for (const i of [PIGMENT, PIGMENT + 1, PIGMENT + 2, PIGMENT_ALPHA]) {
        const next = blendChannel(state, i, 0, 0, 0, 0, alpha);
        if (!next) return false;
        updates.push([i, next]);
      }
      for (let c = 0; c < 3; c++) {
        const next = blendChannel(state, FINAL + c, state.value[BASE + c],
          state.gradient[BASE + c], state.hessian[BASE + c], state.error[BASE + c], alpha);
        if (!next) return false;
        updates.push([FINAL + c, next]);
      }
    }
    for (const [i, next] of updates) {
      state.value[i] = next.value; state.gradient[i] = next.gradient;
      state.hessian[i] = next.hessian; state.error[i] = next.error;
    }
    return true;
  };
}

export function getAlpha(state, triangle, point) {
  if (!validState(state) || state.value.length <= PIGMENT_ALPHA ||
      !Number.isFinite(state.value[PIGMENT_ALPHA]) || !finite(state.gradient[PIGMENT_ALPHA]) ||
      !finite(state.hessian[PIGMENT_ALPHA]) || !finite(state.error[PIGMENT_ALPHA])) return undefined;
  const value = state.value[PIGMENT_ALPHA], error = state.error[PIGMENT_ALPHA];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Array.isArray(triangle) || triangle.length !== 3 ||
      triangle.some(p => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) return undefined;
  const reach = Math.max(...triangle.map(p => Math.hypot(p.x - point.x, p.y - point.y)));
  const spread = state.gradient[PIGMENT_ALPHA] * reach + error;
  const range = [Math.max(0, value - spread), Math.min(1, value + spread)];
  return { value, gradient: state.gradient[PIGMENT_ALPHA], hessian: state.hessian[PIGMENT_ALPHA], error, range };
}
