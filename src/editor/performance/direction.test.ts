import { describe, expect, it } from "vitest";
import {
  R4_REQUIREMENTS,
  evaluateDirection,
  evaluateDirectionContent,
  evaluateDirectionGpu,
  evaluateRun,
} from "../../../scripts/atlas-p0-evaluate.mjs";
import { referenceC1Stroke } from "../../../scripts/atlas-p0-brush-reference.mjs";

type Fact = Record<string, any>;

/** Analytic stationary exposure; no production brush/account implementation. */
function heldContent(duration = 3000, interval = 20) {
  const probes = [-5, 0, 5, 10].flatMap((y) =>
    [-5, 0, 5, 10].map((x) => [x, y]),
  );
  const clocks = [0];
  for (let clock = interval; clock < duration; clock += interval)
    clocks.push(clock);
  clocks.push(duration);
  const input = {
    brush: { level: 0, radius: 80, amount: 100 },
    start: { point: [0, 0], at: 0, input: 1 },
    windows: clocks.slice(1).map((at) => ({
      at,
      points: at === duration ? [{ point: [0, 0], at, input: 2 }] : [],
      end: at === duration,
    })),
  };
  const weights = probes.map(
    ([x, y]) => Math.max(0, 1 - (x * x + y * y) / 80 ** 2) ** 2,
  );
  const admissions = clocks.map((clock, index) => ({
    kind: "brush-accepted",
    cause: index === 0 ? "press" : clock === duration ? "terminal" : "hold",
    admissionId: index + 1,
    toAt: clock,
    at: clock + 0.1,
  }));
  const checkpoints = clocks.map((clock, index) => ({
    phase: "admission",
    admissionId: index + 1,
    clock,
    at: clock + 0.2,
    minimum: weights.map((weight) => (weight * 100) / 60),
    timeAccount: weights.map((weight) => (weight * clock) / 10),
    authors: weights.map(
      (weight) =>
        weight * Math.max(100 / 60, (clocks[Math.max(0, index - 1)] ?? 0) / 10),
    ),
  }));
  return {
    content: {
      input,
      probes,
      centerline: [[0, 0]],
      regions: [{ id: "center", indices: probes.map((_, index) => index) }],
      before: probes.map(() => 0),
      after: weights.map(
        (weight) => weight * Math.max(100 / 60, duration / 10),
      ),
      undone: probes.map(() => 0),
      checkpoints,
    },
    admissions,
  };
}

function packetEvidence() {
  const events: Fact[] = [
    {
      kind: "height-terrain",
      packet: 1,
      fenceId: 1,
      uploadStart: 1,
      submittedAt: 3,
      compositionWork: 0,
      compositionSpans: [],
    },
    {
      kind: "height-terrain",
      packet: 2,
      fenceId: 2,
      uploadStart: 4,
      submittedAt: 6,
      compositionWork: 100,
      compositionSpans: [{ start: 5, end: 5.8 }],
    },
    {
      kind: "height-draw",
      frame: 1,
      fenceId: 3,
      sceneStart: 7,
      submittedAt: 9,
    },
  ];
  const sample = (
    fenceId: number,
    fenceKind: string,
    at: number,
    endAt: number,
    gpuMs: number,
  ) => ({
    target: "packet",
    fenceId,
    fenceKind,
    at,
    endAt,
    commands: 4,
    fenced: true,
    available: true,
    gpuMs,
  });
  const timers: Fact = {
    enabled: true,
    available: true,
    coverage: "terrain-packets",
    boundary: "first-command-to-product-fence",
    identity: "product-webgl-sync",
    wrappedCommands: [
      "texSubImage2D",
      "drawArrays",
      "drawElements",
      "bufferData",
    ],
    contextLost: false,
    boundaryErrors: [],
    disjoint: false,
    truncated: false,
    droppedEvents: 0,
    startedAt: 0,
    stoppedAt: 10,
    samples: [
      sample(1, "terrain", 1.1, 2.9, 1),
      sample(2, "terrain", 4.1, 5.9, 2),
      sample(3, "scene", 7.1, 8.9, 0.5),
    ],
  };
  return { events, timers };
}

describe("fixed R4 direction scope", () => {
  it("covers the required finite matrix without reducing full P0", () => {
    expect(R4_REQUIREMENTS.independentRuns).toBe(2);
    const cases = R4_REQUIREMENTS.scenarios;
    expect(new Set(cases.map((entry) => entry.id)).size).toBe(cases.length);
    expect(
      [...new Set(cases.map((entry) => entry.level))].sort((a, b) => a - b),
    ).toEqual([0, 4, 9, 21]);
    expect(
      [...new Set(cases.map((entry) => entry.diameter))].sort((a, b) => a - b),
    ).toEqual([16, 512]);
    expect(
      cases
        .filter((entry) => entry.fixture === "scaling")
        .map((entry: Fact) => entry.sourceTiles),
    ).toEqual([32, 1024, 9000]);
    expect(
      cases.some((entry) => entry.scale < 0.01 && entry.scale > 0.009),
    ).toBe(true);
    expect(
      cases.some((entry) => entry.scale > 0.01 && entry.scale < 0.011),
    ).toBe(true);
    expect(
      cases
        .filter((entry) => entry.gesture === "swipe")
        .every((entry) => entry.minGestures === 30),
    ).toBe(true);
    expect(
      cases
        .filter((entry) => ["curve", "hold"].includes(entry.gesture))
        .every((entry) => entry.minDurationMs === 10000),
    ).toBe(true);
    for (const transition of ["navigation", "level", "undo", "save"])
      expect(cases.some((entry) => entry.transition === transition)).toBe(true);
  });

  it("stops a hardware preflight as blocked, without inventing measured failures", () => {
    const result = evaluateRun({
      purpose: "direction",
      mode: "native",
      collectionStarted: false,
      preflight: { errors: [], blockers: [{ code: "NO_NATIVE_DISPLAY" }] },
      planned: R4_REQUIREMENTS.scenarios.map((entry) => ({
        id: entry.id,
        state: "blocked-before-collection",
      })),
    });
    expect(result).toMatchObject({
      status: "BLOCKED",
      allowNextPhase: false,
      passed: false,
      missing: [],
      failures: [],
      nativeAcceptance: { passed: false, evaluated: false },
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([{ code: "NO_NATIVE_DISPLAY" }]),
    );
  });

  it("never accepts report booleans, software, or submitted frames as displayed terrain cadence", () => {
    const result = evaluateDirection({
      purpose: "direction",
      mode: "native",
      collectionStarted: false,
      reference: {
        qualified: true,
        softwareRendering: false,
        displayHz: 60,
        viewport: { width: 1440, height: 960, dpr: 1 },
        hardware: { cpu: "x", gpu: "real", os: "linux", ramBytes: 1e9 },
      },
      visibleCadence: { qualified: true, p95: 10, method: "capturePage" },
      passed: true,
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.allowNextPhase).toBe(false);
    expect(
      result.blockers.some(
        (entry) => entry.code === "R4_VISIBLE_CADENCE_UNPROVEN",
      ),
    ).toBe(true);
  });

  it("keeps a real error above simultaneous hardware and presentation blockers", () => {
    const result = evaluateDirection({
      purpose: "direction",
      mode: "lab",
      collectionStarted: false,
      errors: [{ code: "PRODUCT_FAILURE", error: "Lost end point" }],
    });
    expect(result).toMatchObject({
      status: "FAIL",
      passed: false,
      allowNextPhase: false,
    });
    expect(result.failures).toEqual(
      expect.arrayContaining([
        { code: "PRODUCT_FAILURE", error: "Lost end point" },
      ]),
    );
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("does not remove unexecuted cases or empty independent groups", () => {
    const result = evaluateDirection({
      purpose: "direction",
      mode: "lab",
      collectionStarted: true,
      runs: [],
      planned: [],
    });
    expect(result.status).toBe("INCOMPLETE");
    expect(
      result.missing.filter(
        (entry) => entry.code === "R4_REQUIRED_SCENARIO_MISSING",
      ),
    ).toHaveLength(R4_REQUIREMENTS.scenarios.length * 2);
    expect(result.allowNextPhase).toBe(false);
  });

  it.each(["missing", "duplicate"])(
    "rejects %s process PID evidence even with different declared UUIDs",
    (fault) => {
      const runs = [1, 2].map((index) => ({
        id: `process-${index}`,
        instanceId: `uuid-${index}`,
        pid: index,
        independentRunId: `direction-${index}`,
        scenarios: [],
        events: [],
        renderDroppedEvents: 0,
      }));
      if (fault === "missing") delete (runs[1] as Fact).pid;
      else runs[1].pid = runs[0].pid;
      const result = evaluateDirection({
        purpose: "direction",
        mode: "lab",
        collectionStarted: true,
        runs,
      });
      expect(result.status).toBe("FAIL");
      expect(
        result.failures.some(
          (entry) => entry.code === "R4_PROCESSES_NOT_INDEPENDENT",
        ),
      ).toBe(true);
      expect(result.allowNextPhase).toBe(false);
    },
  );

  it("checks the actual process GPU and focus after a qualified reference preflight", () => {
    const report = {
      purpose: "direction",
      mode: "native",
      collectionStarted: true,
      reference: {
        qualified: true,
        softwareRendering: false,
        displayHz: 60,
        viewport: { width: 1440, height: 960, dpr: 1 },
        hardware: { cpu: "cpu", gpu: "real", os: "linux", ramBytes: 1e9 },
      },
      runs: [
        {
          id: "one",
          instanceId: "uuid",
          pid: 50,
          independentRunId: "direction-1",
          scenarios: [],
          events: [],
          renderDroppedEvents: 0,
          gpu: { available: true, renderer: "SwiftShader" },
          view: {
            width: 1440,
            height: 960,
            dpr: 1,
            visible: "visible",
            focused: false,
          },
          metadata: {
            displays: [{ id: 1, displayFrequency: 60 }],
            gpuFeatures: { webgl: "enabled", gpu_compositing: "enabled" },
          },
        },
      ],
    };
    const result = evaluateDirection(report);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "R4_PROCESS_HARDWARE_MISMATCH" }),
        expect.objectContaining({ code: "R4_PROCESS_DISPLAY_UNQUALIFIED" }),
      ]),
    );
    expect(result.allowNextPhase).toBe(false);
  });
});

describe("R4 actual source and independent normal effect", () => {
  it("accepts analytically correct actual sources, prepaid accounts and exact full seconds", () => {
    const { content, admissions } = heldContent();
    expect(evaluateDirectionContent(content, admissions)).toMatchObject({
      passed: true,
      status: "PASS",
      failures: [],
      blockers: [],
      fullSeconds: 3,
    });
  });

  it.each(["time", "authors", "undo", "minimum", "binding"])(
    "rejects a corrupted %s rather than relying on endpoint positivity",
    (fault) => {
      const { content, admissions } = heldContent();
      if (fault === "time") {
        content.checkpoints.forEach((entry) => {
          entry.timeAccount = entry.timeAccount.map((value) => value * 0.5);
          entry.authors = entry.authors.map((_, i) =>
            Math.max(entry.minimum[i], entry.timeAccount[i]),
          );
        });
        const last = content.checkpoints.at(-1)!;
        content.after = last.minimum.map((value, i) =>
          Math.max(value, last.timeAccount[i]),
        );
      }
      if (fault === "authors")
        content.after = content.after.map((value) => value * 0.5);
      if (fault === "undo") content.undone[0] = 1;
      if (fault === "minimum") content.checkpoints.at(-1)!.minimum[0] *= 0.5;
      if (fault === "binding") content.checkpoints[3].admissionId = 999;
      const evaluated = evaluateDirectionContent(content, admissions);
      expect(evaluated.status).toBe("FAIL");
      expect(evaluated.failures.length).toBeGreaterThan(0);
    },
  );

  it("rejects one weak full second even when the full-stroke total remains above90%", () => {
    const { content, admissions } = heldContent(10000);
    for (const checkpoint of content.checkpoints) {
      const lost = Math.max(0, Math.min(checkpoint.clock - 4000, 1000)) * 0.2;
      checkpoint.timeAccount = checkpoint.timeAccount.map(
        (value) => value * (checkpoint.clock ? 1 - lost / checkpoint.clock : 1),
      );
      checkpoint.authors = checkpoint.minimum.map((value, i) =>
        Math.max(value, checkpoint.timeAccount[i]),
      );
    }
    content.after = [...content.checkpoints.at(-1)!.timeAccount];
    const evaluated = evaluateDirectionContent(content, admissions);
    expect(evaluated.status).toBe("FAIL");
    expect(
      evaluated.failures.some(
        (entry) =>
          entry.code === "R4_CONTENT_SECOND_OUTSIDE_REFERENCE" &&
          entry.fromAt === 4000,
      ),
    ).toBe(true);
  });

  it("keeps uncertain second boundaries blocked rather than calling a healthy result incorrect", () => {
    const { content, admissions } = heldContent(3000, 48);
    const result = evaluateDirectionContent(content, admissions);
    expect(result.failures).toEqual([]);
    expect(result.status).toBe("BLOCKED");
    expect(
      result.blockers.some(
        (entry) => entry.code === "R4_CONTENT_SECOND_INTERVAL_UNQUALIFIED",
      ),
    ).toBe(true);
  });

  it("does not misdiagnose a valid moving curve whose local exposure crosses the1s boundary", () => {
    const { content, admissions } = heldContent(3000, 48);
    let id = 1;
    content.input.start.point = [-240, 0];
    const pathPoint = (at: number) => [
      240 * Math.sin((at - 1000) / 1000),
      10 * Math.sin(at / 1000),
    ];
    content.input.start.point = pathPoint(0);
    for (const window of content.input.windows)
      window.points = [
        { point: pathPoint(window.at), at: window.at, input: ++id },
      ];
    for (const [index, checkpoint] of content.checkpoints.entries()) {
      const windows = structuredClone(content.input.windows.slice(0, index));
      if (!windows.length)
        windows.push({
          at: 0,
          points: [{ point: content.input.start.point, at: 0, input: 2 }],
          end: true,
        });
      else windows[windows.length - 1].end = true;
      const expected = referenceC1Stroke(
        { ...content.input, windows },
        content.probes,
      );
      checkpoint.minimum = expected.floor;
      checkpoint.timeAccount = expected.timeAccount;
      checkpoint.authors = expected.total;
    }
    content.after = referenceC1Stroke(content.input, content.probes).total;
    const result = evaluateDirectionContent(content, admissions);
    expect(result.failures).toEqual([]);
    expect(result.status).toBe("BLOCKED");
  });
});

describe("R4 total terrain GPU packets", () => {
  it("counts uploads and composition through real fences with all scene queries assigned", () => {
    const { events, timers } = packetEvidence();
    expect(evaluateDirectionGpu(events, [timers])).toMatchObject({
      failures: [],
      blockers: [],
      terrainPacketMs: { count: 2, p95: 2, maximum: 2 },
    });
  });
  it("retains all pre-marker cleanup time when the exact product fence is bound", () => {
    const { events, timers } = packetEvidence();
    timers.samples[0].at = 0.5;
    timers.samples[1].at = 3.5;
    timers.samples[2].at = 6.5;
    expect(evaluateDirectionGpu(events, [timers])).toMatchObject({
      failures: [],
      blockers: [],
      terrainPacketMs: { count: 2, p95: 2, maximum: 2 },
    });
    timers.samples[0].gpuMs = 4.25;
    expect(evaluateDirectionGpu(events, [timers])).toMatchObject({
      failures: [
        {
          code: "R4_GPU_PACKET_BUDGET_EXCEEDED",
          milliseconds: 4.25,
        },
      ],
      blockers: [],
      terrainPacketMs: { count: 2, maximum: 4.25 },
    });
  });
  it.each([
    "legacy-unbound",
    "missing-query-fence",
    "missing-product-fence",
    "duplicate-query-fence",
    "duplicate-product-fence",
    "forged-query-fence",
    "forged-fence-kind",
    "reversed-fence-order",
    "reversed-query-records",
    "fence-before-product-start",
    "fence-after-product-end",
    "overlapping-queries",
  ])("rejects missing or inconsistent product fence identity: %s", (fault) => {
    const { events, timers } = packetEvidence();
    if (fault === "legacy-unbound") delete timers.identity;
    if (fault === "missing-query-fence") delete timers.samples[0].fenceId;
    if (fault === "missing-product-fence") delete events[0].fenceId;
    if (fault === "duplicate-query-fence") timers.samples[1].fenceId = 1;
    if (fault === "duplicate-product-fence") events[1].fenceId = 1;
    if (fault === "forged-query-fence") timers.samples[0].fenceId = 99;
    if (fault === "forged-fence-kind") timers.samples[0].fenceKind = "scene";
    if (fault === "reversed-fence-order") {
      events[0].fenceId = timers.samples[0].fenceId = 2;
      events[1].fenceId = timers.samples[1].fenceId = 1;
    }
    if (fault === "reversed-query-records") timers.samples.reverse();
    if (fault === "fence-before-product-start") {
      timers.samples[0].at = 0.25;
      timers.samples[0].endAt = 0.75;
    }
    if (fault === "fence-after-product-end") timers.samples[0].endAt = 3.5;
    if (fault === "overlapping-queries") timers.samples[1].at = 2.5;
    expect(evaluateDirectionGpu(events, [timers])).toMatchObject({
      failures: [{ code: "R4_GPU_QUERY_EVIDENCE_INVALID" }],
      terrainPacketMs: { count: 0 },
    });
  });
  it.each([
    "upload-missing",
    "slow",
    "unfenced",
    "disjoint",
    "outside",
    "boundary",
  ])("rejects %s in the same combined GPU requirement", (fault) => {
    const { events, timers } = packetEvidence();
    if (fault === "upload-missing") timers.samples.shift();
    if (fault === "slow") timers.samples[0].gpuMs = 4.1;
    if (fault === "unfenced") timers.samples[0].fenced = false;
    if (fault === "disjoint") timers.disjoint = true;
    if (fault === "outside") timers.samples[0].at = -0.5;
    if (fault === "boundary") timers.boundaryErrors = ["UNFENCED_COMMANDS"];
    expect(
      evaluateDirectionGpu(events, [timers]).failures.length,
    ).toBeGreaterThan(0);
  });
  it("keeps draw-only timing blocked and still rejects an already-slow draw", () => {
    const { events, timers } = packetEvidence();
    timers.coverage = "composition-draws-only";
    timers.samples = [
      { target: "offscreen", at: 5.5, gpuMs: 2, available: true },
      { target: "canvas", at: 8, gpuMs: 0.5, available: true },
    ];
    const good = evaluateDirectionGpu(events, [timers]);
    expect(good.failures).toEqual([]);
    expect(
      good.blockers.some(
        (entry) => entry.code === "R4_TERRAIN_PACKET_TIMING_UNPROVEN",
      ),
    ).toBe(true);
    timers.samples[0].gpuMs = 5;
    expect(
      evaluateDirectionGpu(events, [timers]).failures.some(
        (entry) => entry.code === "R4_GPU_PACKET_BUDGET_EXCEEDED",
      ),
    ).toBe(true);
  });
});
