import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeSubmissionTiming } from "../../../scripts/atlas-p0-timing.mjs";
import {
  collectGpuTimers,
  gpuWork,
  installGpuTimers,
} from "../../../scripts/atlas-p0-graphics-probe.mjs";
import {
  extractEditSamples,
  evaluateSubmissionDiagnostics,
  strokeEvidence,
} from "../../../scripts/atlas-p0-evaluate.mjs";

const journal = (): Record<string, any>[] => [
  { kind: "input", id: 1, inputKind: "edit", at: 12, createdAt: 10 },
  {
    kind: "brush-interval",
    inputIds: [1],
    intervalId: 1,
    gestureId: 1,
    changed: true,
    at: 14,
    projectedAt: 15,
    sessionId: "a",
    revision: 2,
    bounds: [0, 0, 10, 10],
    from: [0, 0],
    to: [1, 1],
    acceptedElapsedMs: 2,
    segments: [{ from: [0, 0], to: [1, 1], elapsedMs: 2 }],
  },
  {
    kind: "height-draw",
    renderId: 1,
    sessionId: "a",
    revision: 2,
    frame: 9,
    viewGeneration: 1,
    at: 39,
    uploadStart: 20,
    uploadedAt: 25,
    submittedAt: 39,
    sceneStart: 35,
    uploadedBytes: 4096,
    updatedTiles: 2,
    fallbackSamples: 0,
  },
  {
    kind: "submit",
    at: 39,
    frame: 9,
    viewGeneration: 1,
    sessionId: "a",
    revision: 2,
  },
  {
    kind: "brush-submit",
    intervalId: 1,
    gestureId: 1,
    viewGeneration: 1,
    at: 40,
    frame: 9,
    sessionId: "a",
    revision: 2,
  },
  {
    kind: "height-terrain",
    sessionId: "a",
    revision: 2,
    viewGeneration: 1,
    packet: 1,
    renderId: 1,
    uploadStart: 20,
    uploadedAt: 25,
    submittedAt: 35,
    uploadedBytes: 4096,
    updatedTiles: 2,
    compositionWork: 128,
    uploadSpans: [{ start: 20, end: 25, bytes: 4096 }],
    compositionSpans: [{ start: 25, end: 35, work: 128 }],
  },
];

describe("GPU timing coverage for the R4 terrain packet budget", () => {
  const evidence = () => {
    const events = journal();
    const composed = { ...events[5], composedSamples: 128 };
    const upload = {
      ...composed,
      packet: 2,
      uploadStart: 41,
      uploadedAt: 44,
      submittedAt: 45,
      uploadSpans: [{ start: 41, end: 44, bytes: 2048 }],
      compositionSpans: [],
      composedSamples: 0,
      compositionWork: 0,
      uploadedBytes: 2048,
    };
    const timers = {
      enabled: true,
      disjoint: false,
      truncated: false,
      droppedEvents: 0,
      startedAt: 0,
      stoppedAt: 50,
      samples: [
        { target: "offscreen", at: 30, available: true, gpuMs: 0.4 },
        { target: "canvas", at: 37, available: true, gpuMs: 0.2 },
      ],
    };
    return { packets: [composed, upload], draws: [events[2]], timers };
  };

  it("preserves upload-only work as unmeasured instead of inventing a zero-duration packet", () => {
    const { packets, draws, timers } = evidence();
    expect(gpuWork(packets, draws, timers)).toMatchObject({
      available: true,
      valid: true,
      coverage: "composition-draws-only",
      packetBudgetProven: false,
      terrainPacketMs: null,
      observedTerrainPackets: 2,
      measuredTerrainPackets: 1,
      unmeasuredTerrainPackets: 1,
      unmeasuredUploadOnlyPackets: 1,
      terrainPacketsWithoutFullTiming: 2,
      offscreenMsPerTerrainPacket: { count: 1, maximum: 0.4 },
    });
  });

  it("does not upgrade complete draw timing or a supplied claim into whole-packet coverage", () => {
    const { packets, draws, timers } = evidence();
    const measured = gpuWork(packets.slice(0, 1), draws, {
      ...timers,
      coverage: "whole-packet",
      packetBudgetProven: true,
    });
    expect(measured).toMatchObject({
      valid: true,
      unmeasuredTerrainPackets: 0,
      terrainPacketsWithoutFullTiming: 1,
      packetBudgetProven: false,
      terrainPacketMs: null,
    });
  });

  it.each([
    undefined,
    { enabled: false },
    { enabled: "true" },
    { disjoint: true },
    { disjoint: undefined },
    { truncated: true },
    { truncated: undefined },
    { samples: [] },
    { samples: [undefined] },
    { droppedEvents: 1 },
  ])(
    "keeps absent or invalid queries from proving the budget: %j",
    (override) => {
      const { packets, draws, timers } = evidence();
      const result = gpuWork(
        packets,
        draws,
        override === undefined ? undefined : { ...timers, ...override },
      );
      expect(result.valid).toBe(false);
      expect(result.packetBudgetProven).toBe(false);
      expect(result.terrainPacketMs).toBeNull();
    },
  );
});

describe("whole-packet GPU observation at the existing product fence", () => {
  afterEach(() => vi.unstubAllGlobals());
  function context() {
    const calls: string[] = [];
    const events: Record<string, any>[] = [];
    const listeners: Record<string, () => void> = {};
    let query: { elapsed: number } | null = null;
    let lost = false;
    let nextFenceId = 0;
    const costs = {
      createTexture: 0.1,
      deleteTexture: 0.1,
      texImage2D: 1.1,
      texSubImage2D: 0.4,
      texStorage2D: 0.8,
      bufferData: 0.2,
      bufferSubData: 0.1,
      copyTexSubImage2D: 0.5,
      blitFramebuffer: 0.6,
      clear: 0.3,
      drawArrays: 1.2,
      drawElements: 1.4,
    };
    const gl: Record<string, any> = {
      DRAW_FRAMEBUFFER_BINDING: 1,
      GPU_DISJOINT_EXT: 2,
      QUERY_RESULT_AVAILABLE: 3,
      getExtension: () => ({ TIME_ELAPSED_EXT: 4, GPU_DISJOINT_EXT: 2 }),
      getParameter: () => false,
      isContextLost: () => lost,
      createQuery: () => ({ elapsed: 0 }),
      beginQuery: (_target: unknown, value: { elapsed: number }) => {
        calls.push("query-begin");
        query = value;
      },
      endQuery: () => {
        calls.push("query-end");
        query = null;
      },
      fenceSync: () => {
        calls.push("product-fence");
        return {};
      },
      flush: () => {
        calls.push("flush");
      },
      getQueryParameter: (value: { elapsed: number }, flag: number) =>
        flag === 3 ? true : value.elapsed * 1e6,
      deleteQuery: () => {
        calls.push("query-deleted");
      },
      ...Object.fromEntries(
        Object.entries(costs).map(([name, elapsed]) => [
          name,
          () => {
            calls.push(name);
            if (query) query.elapsed += elapsed;
            return {};
          },
        ]),
      ),
    };
    const originals = { ...gl };
    const canvas = {
      getContext: () => gl,
      addEventListener: (name: string, listener: () => void) => {
        listeners[name] = listener;
      },
      removeEventListener: (name: string) => {
        delete listeners[name];
      },
    };
    vi.stubGlobal("document", { querySelector: () => canvas });
    vi.stubGlobal("window", {
      atlasObserve: () => ({
        eventCount: events.length,
        droppedEvents: 0,
        events,
      }),
    });
    const page = {
      evaluate: (callback: (argument: any) => any, argument?: any) =>
        callback(argument),
    };
    const packet = (commands: string[], kind = "terrain", bindFence = true) => {
      const start = performance.now();
      for (const command of commands) gl[command]();
      const sync = gl.fenceSync();
      const fenceId = ++nextFenceId;
      if (bindFence)
        (globalThis as any).window.atlasGraphicsFence?.(sync, fenceId, kind);
      gl.flush();
      const end = performance.now();
      const identity = events.length + 1;
      events.push(
        kind === "terrain"
          ? {
              kind: "height-terrain",
              packet: identity,
              fenceId,
              uploadStart: start,
              submittedAt: end,
            }
          : {
              kind: "height-draw",
              frame: identity,
              fenceId,
              sceneStart: start,
              submittedAt: end,
            },
      );
      return { sync, fenceId, kind };
    };
    return {
      gl,
      page,
      calls,
      originals,
      packet,
      events,
      loseContext: () => {
        lost = true;
        listeners.webglcontextlost();
        lost = false;
      },
    };
  }

  it.each([
    ["createTexture", "texImage2D", "texSubImage2D"],
    ["texStorage2D", "bufferData", "bufferSubData"],
    ["copyTexSubImage2D", "blitFramebuffer", "clear"],
    ["texSubImage2D", "drawArrays", "drawElements"],
  ])(
    "includes allocation, transfers and drawing in one existing packet: %j",
    async (...commands) => {
      const state = context();
      await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
      state.packet(commands);
      state.packet(["clear", "drawArrays"], "scene");
      const measured = await collectGpuTimers(state.page);
      expect(state.calls.slice(0, commands.length + 4)).toEqual([
        "query-begin",
        ...commands,
        "query-end",
        "product-fence",
        "flush",
      ]);
      expect(measured.samples).toHaveLength(2);
      expect(measured.samples[0]).toMatchObject({
        target: "packet",
        fenceId: state.events[0].fenceId,
        fenceKind: "terrain",
        commands: commands.length,
        available: true,
        fenced: true,
      });
      expect(measured.boundaryErrors).toEqual([]);
      expect(
        gpuWork([state.events[0]], [state.events[1]], measured),
      ).toMatchObject({
        valid: true,
        packetBudgetProven: true,
        terrainPacketMs: { count: 1 },
      });
      for (const [name, original] of Object.entries(state.originals))
        expect(state.gl[name]).toBe(original);
    },
  );

  it("detects a total packet over budget even when every separate draw is cheap", async () => {
    const state = context();
    await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
    state.gl.texImage2D();
    state.gl.texImage2D();
    state.gl.texImage2D();
    state.packet(["drawArrays"]);
    const measured = await collectGpuTimers(state.page);
    expect(gpuWork(state.events, [], measured)).toMatchObject({
      valid: true,
      packetBudgetProven: false,
      terrainPacketMs: { maximum: 4.5 },
    });
  });

  it.each(["observation", "readback"])(
    "releases every query and the global hook when %s fails",
    async (fault) => {
      const state = context();
      await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
      state.packet(["texImage2D"]);
      state.packet(["drawArrays"], "scene");
      const browserWindow = (globalThis as any).window;
      const originalObserve = browserWindow.atlasObserve;
      if (fault === "observation")
        browserWindow.atlasObserve = () => {
          throw new Error("Injected observer failure");
        };
      else
        state.gl.getQueryParameter = () => {
          throw new Error("Injected query read failure");
        };
      await expect(collectGpuTimers(state.page)).rejects.toThrow("Injected");
      expect(
        state.calls.filter((call) => call === "query-deleted"),
      ).toHaveLength(2);
      expect(browserWindow.atlasGraphicsProbe).toBeUndefined();
      expect(state.gl.texImage2D).toBe(state.originals.texImage2D);
      expect(state.gl.fenceSync).toBe(state.originals.fenceSync);
      browserWindow.atlasObserve = originalObserve;
      state.gl.getQueryParameter = state.originals.getQueryParameter;
      await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
      state.packet(["texSubImage2D"]);
      expect((await collectGpuTimers(state.page)).boundaryErrors).toEqual([]);
    },
  );

  it("includes cleanup before the product marker through the same real fence", async () => {
    const state = context();
    await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
    state.gl.deleteTexture();
    state.packet(["drawArrays"]);
    const measured = await collectGpuTimers(state.page);
    expect(measured.samples[0].at).toBeLessThan(state.events[0].uploadStart);
    expect(gpuWork(state.events, [], measured)).toMatchObject({
      valid: true,
      packetBudgetProven: true,
      unmatchedCalls: 0,
      terrainPacketMs: { count: 1, maximum: 1.3 },
    });
  });

  it.each(["missing", "repeated", "foreign-sync", "forged-id", "forged-kind"])(
    "rejects invalid actual WebGLSync binding: %s",
    async (fault) => {
      const state = context();
      await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
      const fence = state.packet(["texImage2D"], "terrain", false);
      const bind = (globalThis as any).window.atlasGraphicsFence;
      if (fault === "repeated") {
        bind(fence.sync, fence.fenceId, fence.kind);
        bind(fence.sync, fence.fenceId, fence.kind);
      }
      if (fault === "foreign-sync") bind({}, fence.fenceId, fence.kind);
      if (fault === "forged-id")
        bind(fence.sync, fence.fenceId + 1, fence.kind);
      if (fault === "forged-kind") bind(fence.sync, fence.fenceId, "scene");
      const measured = await collectGpuTimers(state.page);
      expect(gpuWork(state.events, [], measured)).toMatchObject({
        valid: false,
        packetBudgetProven: false,
        terrainPacketMs: null,
      });
      expect((globalThis as any).window.atlasGraphicsFence).toBeUndefined();
    },
  );

  it.each([
    "missing-packet",
    "duplicate-query",
    "missing-coverage",
    "query-unavailable",
    "missing-fence",
    "disjoint",
    "missing-boundary-state",
  ])("rejects incomplete whole-packet evidence: %s", async (fault) => {
    const state = context();
    await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
    state.packet(["texImage2D", "drawArrays"]);
    const measured = await collectGpuTimers(state.page);
    if (fault === "missing-packet") state.events.length = 0;
    if (fault === "duplicate-query")
      measured.samples.push({ ...measured.samples[0] });
    if (fault === "missing-coverage") delete measured.wrappedCommands;
    if (fault === "query-unavailable") measured.samples[0].available = false;
    if (fault === "missing-fence") measured.samples[0].fenced = false;
    if (fault === "disjoint") measured.disjoint = true;
    if (fault === "missing-boundary-state") delete measured.boundaryErrors;
    expect(gpuWork(state.events, [], measured)).toMatchObject({
      valid: false,
      packetBudgetProven: false,
      terrainPacketMs: null,
    });
  });

  it.each(["unfenced", "empty-fence", "context-loss", "wrapper-replaced"])(
    "retains %s as invalid timing evidence",
    async (fault) => {
      const state = context();
      await installGpuTimers(state.page, true, { coverage: "terrain-packets" });
      state.packet(["texSubImage2D"]);
      if (fault === "unfenced") state.gl.texImage2D();
      if (fault === "empty-fence") state.gl.fenceSync();
      if (fault === "context-loss") state.loseContext();
      if (fault === "wrapper-replaced") state.gl.texImage2D = () => {};
      const measured = await collectGpuTimers(state.page);
      expect(gpuWork(state.events, [], measured)).toMatchObject({
        valid: false,
        packetBudgetProven: false,
        terrainPacketMs: null,
      });
      if (fault === "context-loss") expect(measured.contextLost).toBe(true);
      else expect(measured.boundaryErrors.length).toBeGreaterThan(0);
    },
  );
});

describe("numeric terrain submission diagnosis", () => {
  it("accounts for source upload and actual draw without claiming presentation", () => {
    const result = summarizeSubmissionTiming(journal());
    expect(result.nativePresentation).toBe(false);
    expect(result.incomplete).toEqual([]);
    expect(result.samples).toMatchObject([
      {
        input: 1,
        revision: 2,
        frame: 9,
        inputToModelMs: 5,
        modelToUploadMs: 5,
        uploadMs: 5,
        drawMs: 14,
        inputToSubmitMs: 29,
        modelToSubmitMs: 24,
        appliedToProjectedMs: 1,
        uploadedBytes: 4096,
        fallbackSamples: 0,
      },
    ]);
    expect(result.brushIntervals[0].modelToSubmitMs).toBe(25);
  });
  it("keeps each input's latency when one path dose reaches one real frame", () => {
    const events = journal();
    events[1].inputIds = [1, 2, 3];
    events.splice(
      1,
      0,
      { kind: "input", id: 2, inputKind: "edit", at: 13, createdAt: 11 },
      { kind: "input", id: 3, inputKind: "edit", at: 13.5, createdAt: 12 },
    );
    const samples = extractEditSamples(events, [1, 2, 3], "a");
    const report = summarizeSubmissionTiming(events);
    expect(report.samples.map((sample) => sample.inputToSubmitMs)).toEqual([
      29, 28, 27,
    ]);
    expect(report.brushIntervals).toHaveLength(1);
    expect(report.coverage.inputs).toEqual({
      expected: 3,
      complete: 3,
      incomplete: 0,
    });
    const live = strokeEvidence({
      samples: [
        ...samples,
        { inputId: 4, inputKind: "pointerup", createdAt: 60 },
      ],
    });
    expect(live.liveSubmissionsBeforeRelease).toBe(3);
    expect(live.liveFramesBeforeRelease).toBe(1);
    expect(live.minimumFrameControlPassed).toBe(false);
  });
  it.each(["frame", "viewGeneration", "sessionId", "revision"])(
    "rejects a draw from a different %s",
    (field) => {
      const events = journal();
      events[2][field] = field === "sessionId" ? "foreign" : 999;
      const result = summarizeSubmissionTiming(events);
      expect(result.samples).toEqual([]);
      expect(result.incomplete[0].reason).toBe("missing-causal-draw");
      expect(result.distributions.inputToSubmitMs.count).toBe(1);
    },
  );
  it("never substitutes a later frame for the receipt's actual frame", () => {
    const events = journal();
    events[3].frame = 10;
    const result = summarizeSubmissionTiming(events);
    expect(result.samples).toEqual([]);
    expect(result.incomplete[0].reason).toBe("missing-matching-submission");
  });
  it("shares missing projection and wrong-view rejection with acceptance", () => {
    for (const mutate of [
      (events: Record<string, any>[]) => {
        events[1].projectedAt = undefined;
      },
      (events: Record<string, any>[]) => {
        events[4].viewGeneration = 2;
      },
    ]) {
      const events = journal();
      mutate(events);
      const samples = extractEditSamples(events, [1], "a");
      expect(samples[0].submissionAt).toBeNull();
      expect(evaluateSubmissionDiagnostics(samples).status).toBe("FAIL");
      expect(summarizeSubmissionTiming(events).samples).toEqual([]);
    }
  });
  it("reports missing draw evidence, invalid clocks and missing resource metrics", () => {
    const missing = summarizeSubmissionTiming(
      journal().filter((e) => e.kind !== "height-draw"),
    );
    expect(missing.incomplete[0].reason).toBe("missing-causal-draw");
    expect(missing.brushModelToSubmitMs.count).toBe(1);
    const events = journal();
    events[2].sceneStart = 40;
    expect(summarizeSubmissionTiming(events).incomplete[0].reason).toBe(
      "invalid-clock-order",
    );
    const resources = journal();
    resources[2].fallbackSamples = undefined;
    expect(summarizeSubmissionTiming(resources).incomplete[0].reason).toBe(
      "missing-resource-evidence",
    );
  });
  it("includes earlier terrain-only strips and actual interleaved upload spans", () => {
    const events = journal();
    // The final scene carries only its same-RAF upload copy. The first packet
    // completed while another scene occupied the canvas slot.
    const first = events.find((event) => event.kind === "height-terrain")!;
    Object.assign(first, {
      uploadedAt: 22,
      submittedAt: 24,
      uploadedBytes: 1024,
      updatedTiles: 0,
      uploadSpans: [{ start: 20, end: 22, bytes: 1024 }],
      compositionSpans: [{ start: 22, end: 23, work: 128 }],
    });
    events.push({
      ...first,
      packet: 2,
      uploadStart: 27,
      uploadedAt: 31,
      submittedAt: 34,
      uploadedBytes: 3072,
      updatedTiles: 2,
      compositionWork: 256,
      uploadSpans: [
        { start: 27, end: 28, bytes: 1024 },
        { start: 30, end: 31, bytes: 2048 },
      ],
      compositionSpans: [
        { start: 28, end: 30, work: 128 },
        { start: 31, end: 33, work: 128 },
      ],
    });
    events[2].uploadedBytes = 3072;
    const result = summarizeSubmissionTiming(events);
    expect(result.incomplete).toEqual([]);
    expect(result.samples[0]).toMatchObject({
      packetIds: [1, 2],
      uploadedBytes: 4096,
      updatedTiles: 2,
      uploadMs: 4,
      compositionMs: 5,
      sceneMs: 4,
      drawMs: 9,
      betweenWorkMs: 6,
      inputToSubmitMs: 29,
    });
    const absent = events.filter((event) => event.kind !== "height-terrain");
    const missing = summarizeSubmissionTiming(absent);
    expect(missing.samples).toEqual([]);
    expect(missing.incomplete[0].reason).toBe(
      "missing-or-invalid-terrain-packets",
    );
    expect(missing.distributions.inputToSubmitMs.count).toBe(1);
  });
  it("includes stationary hold doses and pointerup without manufacturing another dose", () => {
    const events = journal().filter((e) => e.kind !== "input");
    events[0].inputIds = [];
    events[0].cause = "hold";
    events.push(
      { kind: "input", id: 9, inputKind: "pointerup", createdAt: 32, at: 33 },
      {
        kind: "brush-end",
        gestureId: 1,
        input: 9,
        sessionId: "a",
        reason: "pointerup",
        endAt: 33,
        at: 33,
      },
      {
        kind: "commit",
        sequence: 1,
        input: 9,
        at: 33.1,
        sessionId: "a",
        gestureId: 1,
        revision: 2,
        bounds: [[0, 0, 10, 10]],
      },
      {
        kind: "edit-submit",
        sequence: 1,
        viewGeneration: 1,
        input: 9,
        at: 40,
        frame: 9,
        sessionId: "a",
        revision: 2,
      },
    );
    const result = summarizeSubmissionTiming(events);
    expect(result.incomplete).toEqual([]);
    expect(result.samples).toEqual([]);
    expect(result.brushIntervals).toMatchObject([
      { cause: "hold", inputToSubmitMs: null },
    ]);
    expect(result.pointerups).toMatchObject([
      {
        input: 9,
        inputToCompletionMs: 7,
        inputToHandledMs: 1,
        handledToCompletionMs: 6,
      },
    ]);
    expect(result.coverage).toEqual({
      inputs: { expected: 0, complete: 0, incomplete: 0 },
      brushIntervals: { expected: 1, complete: 1, incomplete: 0 },
      pointerups: { expected: 1, complete: 1, incomplete: 0 },
    });
  });

  function alreadyDrawnCommit() {
    return [
      ...journal(),
      { kind: "input", id: 9, inputKind: "pointerup", createdAt: 60, at: 61 },
      {
        kind: "brush-end",
        gestureId: 1,
        input: 9,
        sessionId: "a",
        reason: "pointerup",
        endAt: 61,
        at: 61,
      },
      {
        kind: "commit",
        input: 9,
        sequence: 1,
        gestureId: 1,
        sessionId: "a",
        revision: 2,
        bounds: [[0, 0, 10, 10]],
        at: 62,
      },
      {
        kind: "edit-submit",
        input: 9,
        sequence: 1,
        gestureId: 1,
        sessionId: "a",
        revision: 2,
        frame: 9,
        viewGeneration: 1,
        submittedAt: 39,
        completedAt: 62,
        completionEvidence: "commit-current-terrain-v1",
        at: 62.1,
      },
    ] as Record<string, any>[];
  }

  it("retains the prior draw time and separately measures pointerup completion", () => {
    const events = alreadyDrawnCommit();
    const samples = extractEditSamples(events, [1, 9], "a");
    expect(samples[1]).toMatchObject({
      submissionAt: 39,
      modelAt: 62,
      completedAt: 62,
      frameId: 9,
      presentation: null,
    });
    const evaluated = evaluateSubmissionDiagnostics(samples);
    expect(evaluated.status).toBe("PROXY_ONLY");
    expect(evaluated.presentationProven).toBe(false);
    expect(evaluated.inputToSubmissionMs).toMatchObject({
      count: 1,
      maximum: 29,
    });
    expect(evaluated.pointerupToCompletionMs).toMatchObject({
      count: 1,
      maximum: 2,
    });
    const result = summarizeSubmissionTiming(events);
    expect(result.incomplete).toEqual([]);
    expect(result.pointerups).toMatchObject([
      {
        submittedAt: 39,
        completedAt: 62,
        reusedSubmission: true,
        inputToCompletionMs: 2,
        handledToCompletionMs: 1,
      },
    ]);
    expect(result.pointerupToCompletionMs).toMatchObject({ count: 1, max: 2 });
    expect(events.filter((event) => event.kind === "submit")).toHaveLength(1);
  });

  it.each([
    [
      "unproven prior draw",
      (events: Record<string, any>[]) => {
        delete events.at(-1)!.completionEvidence;
      },
    ],
    [
      "wrong original draw time",
      (events: Record<string, any>[]) => {
        events.at(-1)!.submittedAt = 38;
      },
    ],
    [
      "invented completion time",
      (events: Record<string, any>[]) => {
        events.at(-1)!.completedAt = 61;
      },
    ],
    [
      "receipt predates commit",
      (events: Record<string, any>[]) => {
        events.at(-1)!.at = 61;
      },
    ],
    [
      "wrong gesture",
      (events: Record<string, any>[]) => {
        events.at(-1)!.gestureId = 2;
      },
    ],
    [
      "wrong frame",
      (events: Record<string, any>[]) => {
        events.at(-1)!.frame = 10;
      },
    ],
    [
      "wrong view",
      (events: Record<string, any>[]) => {
        events.at(-1)!.viewGeneration = 2;
      },
    ],
    [
      "old terrain",
      (events: Record<string, any>[]) => {
        events[3].revision = 1;
      },
    ],
    [
      "missing draw",
      (events: Record<string, any>[]) => {
        events.splice(3, 1);
      },
    ],
  ] as const)(
    "rejects %s instead of acknowledging a pointerup",
    (_name, mutate) => {
      const events = alreadyDrawnCommit();
      mutate(events);
      const samples = extractEditSamples(events, [9], "a");
      expect(evaluateSubmissionDiagnostics(samples).status).toBe("FAIL");
      expect(summarizeSubmissionTiming(events).pointerups).toEqual([]);
    },
  );

  it("does not let a completion receipt turn a previous frame into a new edit", () => {
    const events = alreadyDrawnCommit();
    const samples = extractEditSamples(events, [9], "a");
    const invalidEdit = { ...samples[0], inputKind: "edit" };
    expect(evaluateSubmissionDiagnostics([invalidEdit]).status).toBe("FAIL");
  });
});
