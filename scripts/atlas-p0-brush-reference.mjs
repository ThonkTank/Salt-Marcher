/**
 * Independent, offline R1 content oracle. No editor/model imports: the expected
 * swept floor is evaluated over complete captured segments and time is
 * integrated by clipped Gauss–Legendre quadrature, independently of the
 * streaming product candidate. The rejected C0 spatial counterreference alone
 * enumerates its dabs by global arclength.
 * This is a content reference, not an admission policy or a performance runner.
 */

/** @typedef {readonly number[]} Point */
/** @typedef {{point: Point, at: number, input: number}} Sample */
/** @typedef {{at: number, points: readonly Sample[], end?: boolean}} Window */
/** @typedef {{brush: {level: number, radius: number, amount: number}, start: Sample, windows: readonly Window[]}} Manifest */
/** @typedef {{point: Point, seconds: number}} Dab */
/** @typedef {{from: Point, to: Point, fromAt: number, toAt: number, factor: number}} Exposure */

const PULSE_SECONDS = 1 / 60;
const WORLD_LIMIT = 100_000_000;
const MAX_REFERENCE_ELEMENTS = 1_000_000;

function requireReference(condition, message) {
  if (!condition) throw new RangeError(`Invalid brush reference: ${message}`);
}

function validPoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    point.every(
      (value) => Number.isFinite(value) && Math.abs(value) <= WORLD_LIMIT,
    )
  );
}

function validSample(sample) {
  return (
    sample &&
    validPoint(sample.point) &&
    Number.isFinite(sample.at) &&
    sample.at >= 0 &&
    Number.isSafeInteger(sample.input) &&
    sample.input >= 0
  );
}

/** @param {Point} from @param {Point} to @param {number} t @returns {Point} */
function interpolate(from, to, t) {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/** @param {Point} from @param {Point} to */
function distance(from, to) {
  return Math.hypot(to[0] - from[0], to[1] - from[1]);
}

/** @param {Point} probe @param {Point} center @param {number} radius */
function kernel(probe, center, radius) {
  const u = distance(probe, center) / radius;
  return u >= 1 ? 0 : (1 - u * u) ** 2;
}

/**
 * Average quartic profile along a segment. The circle intersection restricts
 * the integration interval before a three-node Gaussian rule integrates its
 * degree-four polynomial exactly (apart from ordinary floating-point rounding).
 * This deliberately does not use the production antiderivative.
 * @param {Point} probe @param {Point} from @param {Point} to @param {number} radius
 */
function averageKernel(probe, from, to, radius) {
  const length = distance(from, to);
  if (length === 0) return kernel(probe, from, radius);
  const dx = (to[0] - from[0]) / length;
  const dy = (to[1] - from[1]) / length;
  const qx = probe[0] - from[0];
  const qy = probe[1] - from[1];
  const along = qx * dx + qy * dy;
  const perpendicular = (qx * dy - qy * dx) / radius;
  if (Math.abs(perpendicular) >= 1) return 0;
  const halfChord = radius * Math.sqrt(1 - perpendicular * perpendicular);
  const lower = Math.max(0, (along - halfChord) / length);
  const upper = Math.min(1, (along + halfChord) / length);
  if (lower >= upper) return 0;
  const middle = (lower + upper) / 2;
  const half = (upper - lower) / 2;
  const node = Math.sqrt(3 / 5);
  return (
    half *
    ((5 / 9) *
      kernel(probe, interpolate(from, to, middle - node * half), radius) +
      (8 / 9) * kernel(probe, interpolate(from, to, middle), radius) +
      (5 / 9) *
        kernel(probe, interpolate(from, to, middle + node * half), radius))
  );
}

/** @param {Manifest} manifest */
function compileReference(manifest, includeDabs = true) {
  requireReference(manifest && typeof manifest === "object", "missing input");
  const { brush, start, windows } = manifest;
  requireReference(
    brush &&
      Number.isInteger(brush.level) &&
      brush.level >= 0 &&
      brush.level <= 21 &&
      Number.isFinite(brush.radius) &&
      brush.radius > 0 &&
      Number.isFinite(brush.amount),
    "invalid fixed brush parameters",
  );
  requireReference(validSample(start), "invalid initial sample");
  requireReference(
    Array.isArray(windows) &&
      windows.length > 0 &&
      windows.length <= MAX_REFERENCE_ELEMENTS,
    "missing or excessive windows",
  );
  /** @type {Sample[]} */
  const vertices = [start];
  /** @type {Exposure[]} */
  const exposures = [];
  /** @type {{at:number, from:Point, points:Point[]}[]} */
  const geometryWindows = [];
  let previous = start;
  let arrival = start.at;
  let clock = start.at;
  let offeredTimeMs = 0;
  let acceptedTimeMs = 0;

  for (let index = 0; index < windows.length; index++) {
    const window = windows[index];
    requireReference(
      window &&
        Number.isFinite(window.at) &&
        window.at >= arrival &&
        Array.isArray(window.points) &&
        (window.end === undefined || typeof window.end === "boolean") &&
        (index === windows.length - 1
          ? window.end === true
          : window.end !== true),
      "unordered window or missing final release",
    );
    // A nonterminal pending batch retains one place for its future endpoint.
    requireReference(
      window.points.length <= (window.end ? 128 : 127),
      "pending geometry exceeds the 128-point limit including endpoint reserve",
    );
    requireReference(
      !window.end || window.points.length > 0,
      "release requires its captured Up sample",
    );
    arrival = window.at;
    const windowFrom = previous.point;
    for (const sample of window.points) {
      requireReference(
        validSample(sample) &&
          sample.at >= previous.at &&
          sample.at <= window.at &&
          sample.input > previous.input,
        "unorderable, duplicated, or future geometry sample",
      );
      vertices.push(sample);
      previous = sample;
    }
    requireReference(
      vertices.length <= MAX_REFERENCE_ELEMENTS,
      "excessive reference samples",
    );
    const beforeClock = clock;
    /** @type {Exposure[]} */
    const pending = [];
    let point = vertices[vertices.length - window.points.length - 1].point;
    for (let first = 0; first < window.points.length;) {
      let last = first + 1;
      const groupAt = window.points[first].at;
      while (last < window.points.length && window.points[last].at === groupAt)
        last++;
      const duration = Math.max(0, groupAt - clock);
      const group = window.points.slice(first, last);
      const groupPoints = [point, ...group.map((sample) => sample.point)];
      const lengths = group.map((_, n) =>
        distance(groupPoints[n], groupPoints[n + 1]),
      );
      const length = lengths.reduce((sum, value) => sum + value, 0);
      if (duration > 0 && length > 0) {
        let offset = 0;
        for (let n = 0; n < lengths.length; n++) {
          const nextOffset = offset + lengths[n];
          if (lengths[n] > 0)
            pending.push({
              from: groupPoints[n],
              to: groupPoints[n + 1],
              fromAt: clock + (duration * offset) / length,
              toAt: clock + (duration * nextOffset) / length,
              factor: 1,
            });
          offset = nextOffset;
        }
      } else if (duration > 0) {
        const endpoint = group[group.length - 1].point;
        pending.push({
          from: endpoint,
          to: endpoint,
          fromAt: clock,
          toAt: groupAt,
          factor: 1,
        });
      }
      clock = Math.max(clock, groupAt);
      point = group[group.length - 1].point;
      first = last;
    }
    // Up is an input timestamp, not the arrival time of a delayed handler.
    const stopAt = window.end ? previous.at : window.at;
    const toAt = Math.max(clock, stopAt);
    if (toAt > clock)
      pending.push({ from: point, to: point, fromAt: clock, toAt, factor: 1 });
    clock = toAt;
    // C1 checkpoint geometry becomes known as a complete captured batch. Its
    // original event times remain in the temporal rule; they must not make a
    // late point or a future edge appear in an earlier spatial checkpoint.
    if (window.points.length)
      geometryWindows.push({
        at: clock,
        from: windowFrom,
        points: window.points.map((sample) => sample.point),
      });
    const offered = clock - beforeClock;
    const factor = offered > 50 ? 50 / offered : 1;
    for (const exposure of pending) exposures.push({ ...exposure, factor });
    offeredTimeMs += offered;
    acceptedTimeMs += Math.min(50, offered);
  }

  // Offline global distances avoid sharing the streaming candidate's remainder.
  const cumulative = [0];
  for (let index = 1; index < vertices.length; index++)
    cumulative.push(
      cumulative[index - 1] +
        distance(vertices[index - 1].point, vertices[index].point),
    );
  const pathLength = cumulative[cumulative.length - 1];
  const spacing = brush.radius / 4;
  const quotient = includeDabs ? pathLength / spacing : 0;
  requireReference(
    Number.isFinite(quotient) && quotient <= MAX_REFERENCE_ELEMENTS,
    "excessive reference dabs",
  );
  const rounded = Math.round(quotient);
  const integralLength =
    Math.abs(quotient - rounded) <= Number.EPSILON * 16 * Math.max(1, quotient);
  const whole = integralLength ? rounded : Math.floor(quotient);
  const terminalResidual = integralLength
    ? 0
    : Math.max(0, pathLength - whole * spacing);
  /** @type {Dab[]} */
  const dabs = [];
  let edge = 1;
  for (let number = 1; includeDabs && number <= whole; number++) {
    const target = Math.min(pathLength, number * spacing);
    while (edge < vertices.length - 1 && cumulative[edge] < target) edge++;
    const span = cumulative[edge] - cumulative[edge - 1];
    const u = span ? (target - cumulative[edge - 1]) / span : 1;
    dabs.push({
      point: interpolate(vertices[edge - 1].point, vertices[edge].point, u),
      seconds: PULSE_SECONDS / 4,
    });
  }
  if (includeDabs && terminalResidual > 0)
    dabs.push({
      point: previous.point,
      seconds: (PULSE_SECONDS * terminalResidual) / brush.radius,
    });
  return {
    brush,
    start,
    geometryWindows,
    dabs,
    exposures,
    durationMs: clock - start.at,
    offeredTimeMs,
    acceptedTimeMs,
    pathLength,
    endPoint: previous.point,
  };
}

/** @param {ReturnType<typeof compileReference>} reference @param {Point} probe @param {{fromAt:number,toAt:number}|null} range */
function temporalReference(reference, probe, range = null) {
  const { brush, exposures } = reference;
  let time = 0;
  let uncappedTime = 0;
  for (const exposure of exposures) {
    const fromAt = Math.max(exposure.fromAt, range?.fromAt ?? exposure.fromAt);
    const toAt = Math.min(exposure.toAt, range?.toAt ?? exposure.toAt);
    if (fromAt >= toAt) continue;
    const duration = exposure.toAt - exposure.fromAt;
    const from = interpolate(
      exposure.from,
      exposure.to,
      (fromAt - exposure.fromAt) / duration,
    );
    const to = interpolate(
      exposure.from,
      exposure.to,
      (toAt - exposure.fromAt) / duration,
    );
    const value =
      brush.amount *
      (((toAt - fromAt) / 1000) * averageKernel(probe, from, to, brush.radius));
    uncappedTime += value;
    time += value * exposure.factor;
  }
  requireReference(
    Number.isFinite(time) && Number.isFinite(uncappedTime),
    "nonfinite reference effect",
  );
  return { time, uncappedTime };
}

/** Explicit cardinal cubic B-spline, independent of the editor's basis helper. */
function cubicWeight(x) {
  const u = Math.abs(x);
  return u < 1
    ? (4 - 6 * u * u + 3 * u * u * u) / 6
    : u < 2
      ? (2 - u) ** 3 / 6
      : 0;
}

/** @param {Point} point @param {number} level */
function reconstructionStencil(point, level) {
  const step = 5 * 2 ** level;
  const gx = point[0] / step;
  const gy = point[1] / step;
  /** @type {{point:Point, weight:number}[]} */
  const stencil = [];
  for (let y = Math.floor(gy) - 1; y <= Math.floor(gy) + 2; y++)
    for (let x = Math.floor(gx) - 1; x <= Math.floor(gx) + 2; x++) {
      const control = /** @type {Point} */ ([x * step, y * step]);
      if (
        Math.abs(control[0]) > WORLD_LIMIT ||
        Math.abs(control[1]) > WORLD_LIMIT
      )
        continue;
      const weight = cubicWeight(gx - x) * cubicWeight(gy - y);
      if (weight > 0) stencil.push({ point: control, weight });
    }
  return stencil;
}

/**
 * Reconstruct independently observed author coefficients on the canonical mesh.
 * This uses only the offline reference basis, never renderer/model helpers.
 * Missing controls fail instead of inheriting a fabricated zero.
 * @param {number} level
 * @param {readonly Point[]} points
 * @param {readonly Point[]} controls
 * @param {readonly number[]} values
 * @param {number} base
 */
export function reconstructObservedHeight(
  level,
  points,
  controls,
  values,
  base = -100,
) {
  requireReference(
    Number.isInteger(level) && level >= 0 && level <= 21,
    "invalid observed level",
  );
  requireReference(
    points.length > 0 && points.every(validPoint),
    "invalid observed points",
  );
  requireReference(
    controls.length === values.length &&
      controls.every(validPoint) &&
      values.every(Number.isFinite),
    "invalid observed controls",
  );
  requireReference(Number.isFinite(base), "invalid observed base");
  const byPoint = new Map(
    controls.map((point, index) => [point.join(","), values[index]]),
  );
  requireReference(
    byPoint.size === controls.length,
    "duplicate observed control",
  );
  return points.map((point) => {
    let value = base;
    for (const item of reconstructionStencil(point, level)) {
      const coefficient = byPoint.get(item.point.join(","));
      requireReference(
        coefficient !== undefined,
        "missing observed reconstruction control",
      );
      if (coefficient === undefined)
        throw new RangeError("Missing observed reconstruction control");
      value += coefficient * item.weight;
    }
    return value;
  });
}

/** @param {readonly Point[]} points @param {number} level */
export function referenceHeightControls(points, level) {
  requireReference(
    Number.isInteger(level) && level >= 0 && level <= 21,
    "invalid control level",
  );
  requireReference(
    points.length > 0 && points.every(validPoint),
    "invalid control points",
  );
  const controls = new Map();
  for (const point of points)
    for (const item of reconstructionStencil(point, level))
      controls.set(item.point.join(","), [...item.point]);
  return [...controls.values()];
}

/**
 * Retained negative C0 counterreference: signed initial and spatial coefficient
 * changes only. Its full spatial effect already exceeds the local bound, so
 * temporal channels, reconstructed surfaces and window evidence are unnecessary.
 * @param {Manifest} manifest @param {readonly Point[]} probes
 */
export function referenceC0Stroke(manifest, probes) {
  requireReference(
    Array.isArray(probes) &&
      probes.length > 0 &&
      probes.length <= MAX_REFERENCE_ELEMENTS &&
      probes.every(validPoint),
    "missing or invalid probes",
  );
  const reference = compileReference(manifest);
  const { brush, start, dabs } = reference;
  const result = {
    initial: probes.map(
      (probe) =>
        brush.amount * PULSE_SECONDS * kernel(probe, start.point, brush.radius),
    ),
    spatial: probes.map((probe) =>
      dabs.reduce(
        (total, dab) =>
          total +
          brush.amount * dab.seconds * kernel(probe, dab.point, brush.radius),
        0,
      ),
    ),
  };
  requireReference(
    Object.values(result).every((values) => values.every(Number.isFinite)),
    "nonfinite C0 spatial counterreference",
  );
  return result;
}

const C1_COMPONENTS = /** @type {const} */ ([
  "initial",
  "spatial",
  "time",
  "uncappedTime",
  "total",
  "uncappedTotal",
  "floor",
  "timeAccount",
  "uncappedTimeAccount",
]);
/** @typedef {typeof C1_COMPONENTS[number]} C1Component */

/**
 * Peak profile on an entire supplied segment, rather than a sum of dabs.
 * Projection is performed in local coordinates to avoid constructing a distant
 * world point merely to subtract it again.
 * @param {Point} probe @param {Point} from @param {Point} to @param {number} radius
 */
function maximumKernel(probe, from, to, radius) {
  const length = distance(from, to);
  if (length === 0) return kernel(probe, from, radius);
  const dx = (to[0] - from[0]) / length;
  const dy = (to[1] - from[1]) / length;
  const qx = probe[0] - from[0];
  const qy = probe[1] - from[1];
  const projection = Math.max(0, Math.min(length, qx * dx + qy * dy));
  const u = Math.hypot(qx - projection * dx, qy - projection * dy) / radius;
  return u >= 1 ? 0 : (1 - u * u) ** 2;
}

/**
 * C1 is the one countercandidate: max(one swept minimum, cumulative time).
 * The final channel decomposition is canonical, not an attribution of each
 * mutation: raising the floor later can reclassify an earlier extra-time part.
 * timeAccount retains ALL admitted time, including its already prepaid credit.
 * @param {ReturnType<typeof compileReference>} reference @param {Point} probe
 * @param {number} until
 */
function sampleC1Reference(reference, probe, until) {
  const { brush, start, geometryWindows } = reference;
  const initialWeight = kernel(probe, start.point, brush.radius);
  let peak = initialWeight;
  for (const window of geometryWindows) {
    if (window.at > until) break;
    let from = window.from;
    for (const to of window.points) {
      peak = Math.max(peak, maximumKernel(probe, from, to, brush.radius));
      from = to;
    }
  }
  const sign = Math.sign(brush.amount);
  const initial = Math.abs(brush.amount) * PULSE_SECONDS * initialWeight;
  const floor = Math.abs(brush.amount) * PULSE_SECONDS * peak;
  const temporal = temporalReference(reference, probe, {
    fromAt: start.at,
    toAt: until,
  });
  const timeAccount = Math.abs(temporal.time);
  const uncappedTimeAccount = Math.abs(temporal.uncappedTime);
  const result = {
    initial: sign * initial,
    spatial: sign * (floor - initial),
    time: sign * Math.max(0, timeAccount - floor),
    uncappedTime: sign * Math.max(0, uncappedTimeAccount - floor),
    total: sign * Math.max(floor, timeAccount),
    uncappedTotal: sign * Math.max(floor, uncappedTimeAccount),
    floor: sign * floor,
    timeAccount: sign * timeAccount,
    uncappedTimeAccount: sign * uncappedTimeAccount,
  };
  requireReference(
    Object.values(result).every(Number.isFinite),
    "nonfinite C1 reference effect",
  );
  return result;
}

/** @param {Manifest} manifest @param {readonly Point[]} probes @param {boolean} reconstruct */
function evaluateC1Reference(manifest, probes, reconstruct) {
  requireReference(
    Array.isArray(probes) &&
      probes.length > 0 &&
      probes.length <= MAX_REFERENCE_ELEMENTS &&
      probes.every(validPoint),
    "missing or invalid probes",
  );
  const reference = compileReference(manifest, false);
  const stencils = probes.map((point) =>
    reconstruct
      ? reconstructionStencil(point, reference.brush.level)
      : [{ point, weight: 1 }],
  );
  /** @returns {Record<C1Component, number[]>} */
  const zero = () =>
    /** @type {Record<C1Component, number[]>} */ (
      Object.fromEntries(C1_COMPONENTS.map((key) => [key, probes.map(() => 0)]))
    );
  /** @param {number} until */
  const cumulative = (until) => {
    const result = zero();
    for (let index = 0; index < stencils.length; index++)
      for (const { point, weight } of stencils[index]) {
        // The max is applied to coefficients BEFORE spline reconstruction.
        const sample = sampleC1Reference(reference, point, until);
        for (const key of C1_COMPONENTS)
          result[key][index] += sample[key] * weight;
      }
    requireReference(
      Object.values(result).every((values) => values.every(Number.isFinite)),
      "nonfinite C1 reconstructed effect",
    );
    return result;
  };
  const click = stencils.map((stencil, index) =>
    stencil.reduce(
      (sum, item) =>
        sum +
        item.weight *
          reference.brush.amount *
          PULSE_SECONDS *
          kernel(item.point, probes[index], reference.brush.radius),
      0,
    ),
  );
  const timeWindows = [];
  const fullWindows = Math.floor(reference.durationMs / 1000);
  requireReference(
    fullWindows <= MAX_REFERENCE_ELEMENTS,
    "excessive time horizon",
  );
  for (let index = 0; index < fullWindows; index++) {
    const fromAt = reference.start.at + index * 1000;
    const toAt = fromAt + 1000;
    const before = index === 0 ? zero() : cumulative(fromAt);
    const after = cumulative(toAt);
    const delta = zero();
    for (const key of C1_COMPONENTS)
      delta[key] = after[key].map((value, probe) => value - before[key][probe]);
    timeWindows.push({ fromAt, toAt, ...delta, before, after });
  }
  return {
    ...cumulative(Number.POSITIVE_INFINITY),
    click,
    points: probes.map((point) => [...point]),
    timeWindows,
    durationMs: reference.durationMs,
    offeredTimeMs: reference.offeredTimeMs,
    acceptedTimeMs: reference.acceptedTimeMs,
    pathLength: reference.pathLength,
    endPoint: [...reference.endPoint],
  };
}

/**
 * C1 author-coefficient reference. Spatial revisits do not stack the swept
 * minimum. `timeAccount` includes prepaid time; `time` is only the excess above
 * the final floor. Every full-second window has cumulative `before`/`after`
 * checkpoints and their differences. The first `before` is zero, so its window
 * includes the initial click. Window `time` can be negative due to canonical
 * reattribution; normal time coverage uses `timeAccount`, not that difference.
 * Spatial prefixes include complete captured batches at their post-normalizing
 * accounting clock, never interpolated future vertices. A late terminal batch
 * can replace a checkpoint at the same booked clock (max(old T, Up time)); this
 * is logical accounting order, not a physical presentation timestamp.
 * @param {Manifest} manifest @param {readonly Point[]} probes
 */
export function referenceC1Stroke(manifest, probes) {
  return evaluateC1Reference(manifest, probes, false);
}

/**
 * Physical C1 changes with max applied per coefficient before reconstruction.
 * Consequently max(reconstructed floor, reconstructed time) is NOT generally
 * the reconstructed total. Use coefficient checkpoints for that invariant.
 * @param {Manifest} manifest @param {readonly Point[]} probes
 */
export function reconstructReferenceC1Stroke(manifest, probes) {
  return evaluateC1Reference(manifest, probes, true);
}
