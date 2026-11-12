import { describe, expect, it } from "vitest";
import {
  beginTimedBrush,
  planTimedBrushWindow,
  type BrushPoint,
  type TimedBrushWindow,
} from "../brush";
import { PrepaidBrush, prepaidMinimumAt } from "./PrepaidBrush";
import {
  HEIGHT_BASE,
  heightControlAddress,
  heightSpacing,
  heightTilesFromControls,
  prepareHeightSampler,
  quarticBrushSegmentIntegral,
  WORLD_LIMIT,
  type HeightBrush,
  type HeightSegment,
  type Point,
} from "./index";
import {
  referenceC0Stroke,
  referenceC1Stroke,
  reconstructReferenceC1Stroke,
} from "../../../scripts/atlas-p0-brush-reference.mjs";
import { evaluateC1StrokeContent } from "../../../scripts/atlas-p0-evaluate.mjs";

interface Input {
  brush: HeightBrush;
  start: BrushPoint;
  windows: TimedBrushWindow[];
}
const sample = (point: Point, at: number, input: number): BrushPoint => ({
  point,
  at,
  input,
});
const brush: HeightBrush = { level: 0, radius: 20, amount: 1 };
const context = {
  sessionId: "r1-c1",
  gestureId: 1,
  viewId: 1,
  preparationId: 1,
};
const components = [
  "initial",
  "spatial",
  "time",
  "total",
  "floor",
  "timeAccount",
] as const;
type Values = Record<(typeof components)[number], number[]>;

function path(points: Point[], times = points.map(() => 0)): Input {
  return {
    brush,
    start: sample(points[0], times[0], 0),
    windows: [
      {
        at: times.at(-1)!,
        points: points.slice(1).map((p, i) => sample(p, times[i + 1], i + 1)),
        end: true,
      },
    ],
  };
}

function temporalAt(
  brush: HeightBrush,
  segments: HeightSegment[],
  control: Point,
) {
  let total = 0;
  for (const segment of segments) {
    const dx = segment.to[0] - segment.from[0];
    const dy = segment.to[1] - segment.from[1];
    const length = Math.hypot(dx, dy);
    const qx = control[0] - segment.from[0];
    const qy = control[1] - segment.from[1];
    const d2 = (qx / brush.radius) ** 2 + (qy / brush.radius) ** 2;
    const weight = length
      ? quarticBrushSegmentIntegral(
          (qx * dx + qy * dy) / length,
          (qx * dy - qy * dx) / length,
          length,
          brush.radius,
        ) / length
      : d2 < 1
        ? (1 - d2) ** 2
        : 0;
    total += Math.abs(brush.amount) * (segment.elapsedMs / 1000) * weight;
  }
  return total;
}

/** Candidate's real coefficient effects, separately from the offline oracle. */
function execute(input: Input, feedback = true, split = false) {
  const step = heightSpacing(input.brush.level);
  const vertices = [
    input.start.point,
    ...input.windows.flatMap((window) =>
      window.points.map((point) => point.point),
    ),
  ];
  const controls: {
    point: Point;
    key: string;
    index: number;
    x: number;
    y: number;
    initial: number;
    source: number;
  }[] = [];
  const low = [0, 1].map((axis) =>
    Math.ceil(
      Math.max(
        -WORLD_LIMIT,
        Math.min(...vertices.map((p) => p[axis])) -
          input.brush.radius -
          2 * step,
      ) / step,
    ),
  );
  const high = [0, 1].map((axis) =>
    Math.floor(
      Math.min(
        WORLD_LIMIT,
        Math.max(...vertices.map((p) => p[axis])) +
          input.brush.radius +
          2 * step,
      ) / step,
    ),
  );
  for (let y = low[1]; y <= high[1]; y++)
    for (let x = low[0]; x <= high[0]; x++) {
      const point: Point = [x * step, y * step];
      controls.push({
        point,
        ...heightControlAddress(input.brush.level, x, y),
        x,
        y,
        initial: prepaidMinimumAt(
          input.brush,
          input.start.point,
          input.start.point,
          point,
        ),
        source: 0,
      });
    }
  const candidate = new PrepaidBrush({
    rate: input.brush.amount,
    level: input.brush.level,
    context,
  });
  const byAddress = new Map(
    controls.map((control) => [`${control.key}/${control.index}`, control]),
  );
  const sign = Math.sign(input.brush.amount) || 1;
  const read = (selected = controls): Values => ({
    initial: selected.map((c) => sign * c.initial),
    floor: selected.map(
      (c) => sign * candidate.valueAt(c.key, c.index).minimum,
    ),
    spatial: selected.map(
      (c) => sign * (candidate.valueAt(c.key, c.index).minimum - c.initial),
    ),
    time: selected.map((c) => {
      const v = candidate.valueAt(c.key, c.index);
      return sign * Math.max(0, v.timeAccount - v.minimum);
    }),
    timeAccount: selected.map(
      (c) => sign * candidate.valueAt(c.key, c.index).timeAccount,
    ),
    total: selected.map((c) => c.source),
  });
  let discardedTime = 0;
  let peakEffect = 0;
  const apply = (
    effects: { key: string; index: number; minimum: number; time: number }[],
  ) => {
    const chunks = split ? effects.map((effect) => [effect]) : [effects];
    for (const chunk of chunks) {
      const offered = candidate.offer(chunk);
      expect(offered.accepted).toBe(true);
      if (!offered.accepted) throw new Error(`C1 admission: ${offered.reason}`);
      expect(candidate.materialize(offered.reservation)).toBe(true);
      for (const change of offered.changes) {
        byAddress.get(`${change.key}/${change.index}`)!.source += change.delta;
        discardedTime += change.discardedTime;
      }
    }
    for (const control of controls) {
      // The actual source value equals the total admitted effect of this gesture.
      const value = candidate.valueAt(control.key, control.index);
      expect(control.source).toBeCloseTo(sign * value.total, 12);
    }
    peakEffect = Math.max(
      peakEffect,
      ...controls.map((c) => Math.abs(c.source)),
    );
    if (feedback) {
      const receipt = candidate.freeze();
      expect(receipt).not.toBeNull();
      expect(candidate.acknowledge(receipt!)).toBe(true);
    }
  };
  apply(
    controls.map((control) => ({
      ...control,
      minimum: control.initial,
      time: 0,
    })),
  );
  const checkpoints = new Map<number, Values>();
  let stroke = beginTimedBrush(input.brush, input.start);
  for (const window of input.windows) {
    const batch = planTimedBrushWindow(stroke, window);
    const geometry = [batch.path.from, ...batch.path.points];
    apply(
      controls.map((control) => ({
        key: control.key,
        index: control.index,
        minimum: geometry.reduce(
          (max, point, i) =>
            Math.max(
              max,
              prepaidMinimumAt(
                input.brush,
                geometry[i - 1] ?? point,
                point,
                control.point,
              ),
            ),
          0,
        ),
        time: temporalAt(input.brush, batch.time, control.point),
      })),
    );
    stroke = batch.stroke;
    const duration = stroke.clock - input.start.at;
    if (duration > 0 && duration % 1000 === 0)
      checkpoints.set(duration, read());
  }
  candidate.seal();
  const probeValues = (probes: Point[], values = read()): Values => {
    const indices = probes.map(([x, y]) =>
      controls.findIndex((c) => c.point[0] === x && c.point[1] === y),
    );
    // The finite source field covers the entire swept support. Exterior probes
    // are confirmed zero, not missing measurements.
    return Object.fromEntries(
      components.map((key) => [
        key,
        indices.map((index) => (index < 0 ? 0 : values[key][index])),
      ]),
    ) as Values;
  };
  const surface = (field: "minimum" | "total", probes: Point[]) => {
    const tiles = heightTilesFromControls(
      input.brush.level,
      controls.map(
        (c) =>
          [
            c.x,
            c.y,
            field === "total"
              ? c.source
              : sign * candidate.valueAt(c.key, c.index).minimum,
          ] as const,
      ),
    );
    const sampler = prepareHeightSampler(tiles);
    return probes.map(([x, y]) => sampler(x, y) - HEIGHT_BASE);
  };
  return {
    candidate,
    probeValues,
    surface,
    checkpoints,
    peakEffect,
    discardedTime,
    stroke,
  };
}

function close(actual: number[], expected: readonly number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < actual.length; i++)
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(
      1e-10 + 1e-9 * Math.abs(expected[i]),
    );
}

/** Freeze the captured fixture so candidate execution cannot rewrite its oracle. */
function freezeFixture<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeFixture(child);
    Object.freeze(value);
  }
  return value;
}

function verify(
  suppliedInput: Input,
  suppliedProbes: Point[],
  options: { feedback?: boolean; overload?: boolean; split?: boolean } = {},
) {
  const { input, probes } = freezeFixture(
    structuredClone({ input: suppliedInput, probes: suppliedProbes }),
  );
  const centerline = [
    input.start.point,
    ...input.windows.flatMap((window) =>
      window.points.map((sample) => sample.point),
    ),
  ];
  const reference = referenceC1Stroke(input, probes);
  const surface = reconstructReferenceC1Stroke(input, centerline);
  const result = execute(
    input,
    options.feedback ?? true,
    options.split ?? false,
  );
  const values = result.probeValues(probes);
  if (!options.overload)
    for (const channel of components)
      close(values[channel], reference[channel]);
  close(result.surface("minimum", centerline), surface.floor);
  if (!options.overload)
    close(result.surface("total", centerline), surface.total);
  let previous = Object.fromEntries(
    components.map((channel) => [channel, probes.map(() => 0)]),
  ) as Values;
  const windows = reference.timeWindows.map((window) => {
    const checkpoint = result.checkpoints.get(window.toAt - input.start.at);
    expect(
      checkpoint,
      "candidate checkpoint at each complete1s boundary",
    ).toBeDefined();
    const after = result.probeValues(probes, checkpoint!);
    const delta = Object.fromEntries(
      components.map((channel) => [
        channel,
        after[channel].map((value, index) => value - previous[channel][index]),
      ]),
    ) as Values;
    const observed = {
      fromAt: window.fromAt,
      toAt: window.toAt,
      ...delta,
      before: previous,
      after,
    };
    previous = after;
    return observed;
  });
  const verdict = evaluateC1StrokeContent(
    {
      input,
      mode: options.overload ? "overload" : "normal",
      probes,
      regions: probes.map((_, index) => ({
        id: `region-${index}`,
        indices: [index],
      })),
      centerline,
    },
    {
      ...values,
      centerlineSpatial: result.surface("minimum", centerline),
      windows,
    },
  );
  expect(verdict.failures).toEqual([]);
  expect(verdict.passed).toBe(true);
  return result;
}

describe("C1 selection from a demonstrated C0 contradiction (R1)", () => {
  it("fixes the bounded200ms delayed-GPU revisit failure with unchanged anchors", () => {
    const input = path(
      [
        [20, 20],
        [60, 20],
        [20, 20],
        [60, 20],
      ],
      [0, 20, 40, 70],
    );
    const c0 = referenceC0Stroke(input, [[40, 20]]);
    expect(c0.initial[0]).toBe(0);
    expect(c0.spatial[0]).toBeCloseTo(0.0533203125, 14);
    expect(c0.spatial[0]).toBeGreaterThan(0.05);
    const result = verify(
      input,
      [
        [20, 20],
        [40, 20],
        [60, 20],
        [40, 40],
      ],
      { feedback: false, overload: true },
    );
    expect(result.peakEffect).toBeLessThanOrEqual(0.05 + 1e-12);
    expect(result.surface("minimum", [[60, 20]])[0]).toBeGreaterThan(0);
    expect(result.candidate.usage.bufferBytes).toBeLessThanOrEqual(
      32 * 1024 * 1024,
    );
  });

  it.each([250, 2250])(
    "maintains the fixed holding rate for%ims with credited click and complete1s checks",
    (duration) => {
      const input = path([
        [20, 20],
        [20, 20],
      ]);
      input.windows = Array.from({ length: duration / 25 }, (_, i) => ({
        at: (i + 1) * 25,
        points:
          (i + 1) * 25 === duration ? [sample([20, 20], duration, 1)] : [],
        end: (i + 1) * 25 === duration,
      }));
      const result = verify(input, [
        [20, 20],
        [25, 20],
        [30, 20],
        [35, 20],
        [40, 20],
      ]);
      expect(result.probeValues([[20, 20]]).timeAccount[0]).toBeCloseTo(
        duration / 1000,
        12,
      );
      expect(result.probeValues([[20, 20]]).total[0]).toBeCloseTo(
        duration / 1000,
        12,
      );
      expect(Math.abs(result.discardedTime)).toBeLessThanOrEqual(1e-10);
    },
  );

  it("makes the initial click a one-time floor rather than charging it again as time", () => {
    for (const duration of [0, 5, 10, 50]) {
      const input = path(
        [
          [20, 20],
          [20, 20],
        ],
        [0, duration],
      );
      const result = verify(input, [
        [20, 20],
        [30, 20],
        [40, 20],
      ]);
      expect(result.probeValues([[20, 20]]).total[0]).toBeCloseTo(
        Math.max(1 / 60, duration / 1000),
        12,
      );
    }
  });

  it.each([
    {
      points: [
        [20, 20],
        [20, 100],
        [100, 100],
      ] as Point[],
    },
    {
      points: [
        [20, 20],
        [60, 100],
        [20, 180],
        [60, 260],
      ] as Point[],
    },
    {
      points: [
        [20, 20],
        [100, 20],
        [100, 100],
        [20, 100],
        [20, 20],
      ] as Point[],
    },
    {
      points: [
        [20, 20],
        [100, 20],
        [20, 20],
        [100, 20],
      ] as Point[],
    },
  ])(
    "covers the full zero-time path and outside probes: $points",
    ({ points }) => {
      verify(path(points), [...points, [60, 60], [20, 60], [60, 100], [0, 0]]);
    },
  );

  it("caps a500ms bent UI window while retaining all spatial floor and endpoint", () => {
    const input = path(
      [
        [20, 20],
        [20, 100],
        [100, 100],
      ],
      [0, 250, 500],
    );
    const result = verify(
      input,
      [
        [20, 20],
        [20, 60],
        [20, 100],
        [60, 100],
        [100, 100],
        [60, 60],
      ],
      { feedback: false, overload: true },
    );
    expect(result.peakEffect).toBeLessThanOrEqual(0.05 + 1e-12);
    expect(result.probeValues([[60, 60]]).total[0]).toBe(0);
  });

  it("does not accrue delayed-handler time after Up or late points after booked holding", () => {
    const input: Input = {
      brush,
      start: sample([20, 20], 0, 0),
      windows: [
        ...[30, 60, 90, 120].map((at) => ({ at, points: [] })),
        {
          at: 140,
          points: [sample([20, 100], 110, 1), sample([100, 100], 115, 2)],
          end: true,
        },
      ],
    };
    const result = verify(input, [
      [20, 20],
      [20, 60],
      [20, 100],
      [60, 100],
      [100, 100],
    ]);
    expect(result.stroke.clock).toBe(120);
    expect(result.probeValues([[100, 100]]).timeAccount[0]).toBe(0);
    expect(result.probeValues([[100, 100]]).total[0]).toBeCloseTo(1 / 60, 12);
  });

  it("is invariant to materialization batches and receipts when no effect is limited", () => {
    const input = path(
      [
        [20, 20],
        [20, 100],
        [100, 100],
      ],
      [0, 10, 20],
    );
    const probes: Point[] = [
      [20, 20],
      [20, 60],
      [20, 100],
      [60, 100],
      [100, 100],
    ];
    const batch = verify(input, probes);
    const divided = verify(input, probes, { split: true });
    const delayed = verify(input, probes, { feedback: false });
    for (const channel of components) {
      close(
        batch.probeValues(probes)[channel],
        divided.probeValues(probes)[channel],
      );
      close(
        batch.probeValues(probes)[channel],
        delayed.probeValues(probes)[channel],
      );
    }
  });

  it("does not give an earlier1s checkpoint geometry that arrived after it", () => {
    const input: Input = {
      brush,
      start: sample([20, 20], 0, 0),
      windows: [
        ...Array.from({ length: 40 }, (_, i) => ({
          at: (i + 1) * 25,
          points: [],
        })),
        { at: 1010, points: [sample([100, 20], 900, 1)] },
        ...Array.from({ length: 40 }, (_, i) => ({
          at: 1000 + (i + 1) * 25,
          points: i === 39 ? [sample([100, 20], 2000, 2)] : [],
          end: i === 39,
        })),
      ],
    };
    const probes: Point[] = [
      [20, 20],
      [60, 20],
      [100, 20],
    ];
    const result = verify(input, probes);
    const first = result.probeValues(probes, result.checkpoints.get(1000));
    expect(first.floor[2]).toBe(0);
    expect(first.timeAccount[2]).toBe(0);
    expect(result.probeValues(probes).floor[2]).toBeCloseTo(1 / 60, 12);
  });

  it("retains the same spatial floor at30/60/120Hz with causal RAF-phase time", () => {
    const probes: Point[] = [
      [20, 20],
      [40, 20],
      [60, 20],
      [80, 20],
      [100, 20],
    ];
    let baseline: number[] | undefined;
    for (const hz of [30, 60, 120])
      for (const phase of [0, 3]) {
        const input = path([
          [20, 20],
          [100, 20],
        ]);
        input.windows = Array.from({ length: hz / 2 }, (_, i) => {
          const at = ((i + 1) * 1000) / hz;
          return {
            at: at + phase,
            points: [sample([20 + (80 * at) / 500, 20], at, i + 1)],
            end: i === hz / 2 - 1,
          };
        });
        const result = verify(input, probes);
        const spatial = result.probeValues(probes).spatial;
        if (baseline) close(spatial, baseline);
        else baseline = spatial;
        expect(Math.abs(result.discardedTime)).toBeLessThanOrEqual(1e-10);
      }
  });

  it("gives stronger slower motion in the time-dominated range", () => {
    const probes: Point[] = [
      [20, 20],
      [40, 20],
      [60, 20],
      [80, 20],
      [100, 20],
    ];
    const results = [200, 600].map((duration) => {
      const input = path([
        [20, 20],
        [100, 20],
      ]);
      input.windows = Array.from({ length: duration / 20 }, (_, i) => ({
        at: (i + 1) * 20,
        points: [
          sample(
            [20 + (80 * (i + 1) * 20) / duration, 20],
            (i + 1) * 20,
            i + 1,
          ),
        ],
        end: (i + 1) * 20 === duration,
      }));
      return verify(input, probes).probeValues(probes);
    });
    close(
      results[1].timeAccount,
      results[0].timeAccount.map((value) => value * 3),
    );
    expect(results[1].total[2]).toBeGreaterThan(results[0].total[2]);
  });

  it("keeps zero and negative rates and reconstructs the same math at all22 levels", () => {
    for (const amount of [0, -1]) {
      const input = path(
        [
          [20, 20],
          [20, 60],
        ],
        [0, 20],
      );
      input.brush = { ...brush, amount };
      verify(input, [
        [20, 20],
        [20, 40],
        [20, 60],
      ]);
    }
    for (let level = 0; level <= 21; level++) {
      const spacing = heightSpacing(level);
      const input = path(
        [
          [0, 0],
          [spacing * 2, 0],
        ],
        [0, 20],
      );
      input.brush = { level, radius: spacing * 8, amount: 1 };
      verify(input, [
        [0, 0],
        [spacing, 0],
        [spacing * 2, 0],
        [spacing * 2, spacing * 2],
      ]);
    }
  });
});
