import { describe, expect, it } from "vitest";
import { summarizeSubmissionTiming } from "../../../scripts/atlas-p0-timing.mjs";
import {
  extractEditSamples,
  evaluateSubmissionDiagnostics,
} from "../../../scripts/atlas-p0-evaluate.mjs";

const journal = () => [
  { kind: "input", id: 1, inputKind: "edit", at: 12, createdAt: 10 },
  {
    kind: "brush-interval",
    inputIds: [1],
    intervalId: 1,
    gestureId: 1,
    changed: true,
    at: 15,
    projectedAt: 15,
    sessionId: "a",
    revision: 2,
    bounds: [0, 0, 10, 10],
  },
  {
    kind: "raster-start",
    id: 7,
    batchId: 7,
    at: 16,
    sessionId: "a",
    revision: 2,
    bounds: [0, 0, 20, 20],
    size: 20,
    rect: [0, 0, 8, 8],
  },
  {
    kind: "raster-batch-result",
    id: 7,
    at: 31,
    timing: {
      timeOrigin: 1000,
      sentAt: 1020,
      startedAt: 1022,
      finishedAt: 1027,
      receivedAt: 1030,
    },
  },
  { kind: "raster-upload", id: 7, at: 36, sessionId: "a", paintedRevision: 2 },
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
];

describe("renderer latency diagnosis", () => {
  it("accounts for the full causal path without claiming display presentation", () => {
    const result = summarizeSubmissionTiming(journal());
    expect(result.nativePresentation).toBe(false);
    expect(result.incomplete).toEqual([]);
    expect(result.samples).toMatchObject([
      {
        input: 1,
        revision: 2,
        task: 7,
        batch: 7,
        frame: 9,
        inputToModelMs: 5,
        modelToDispatchMs: 5,
        dispatchToWorkerMs: 2,
        workerMs: 5,
        workerToMainMs: 3,
        mainToUploadMs: 6,
        uploadToSubmitMs: 4,
        inputToSubmitMs: 30,
        modelToSubmitMs: 25,
      },
    ]);
    expect(result.samples[0].rasterBatches).toMatchObject([
      {
        id: 7,
        requiredPixels: 64,
        dispatchAt: 20,
        workerMs: 5,
        lastUploadAt: 36,
      },
    ]);
  });

  it("ignores a later upload in another part of the same tile", () => {
    const result = summarizeSubmissionTiming([
      ...journal(),
      {
        kind: "raster-start",
        id: 8,
        batchId: 8,
        at: 17,
        sessionId: "a",
        revision: 2,
        bounds: [0, 0, 20, 20],
        size: 20,
        rect: [12, 12, 20, 20],
      },
      {
        kind: "raster-upload",
        id: 8,
        at: 38,
        sessionId: "a",
        paintedRevision: 2,
      },
    ]);
    expect(result.samples[0].task).toBe(7);
  });

  it("does not replace the claimed frame with the first following render", () => {
    const events = journal();
    events.find((event) => event.kind === "submit")!.frame = 10;
    const result = summarizeSubmissionTiming(events);
    expect(result.samples).toEqual([]);
    expect(result.incomplete[0].reason).toBe("missing-matching-submission");
  });

  it("shares the same rejected view and missing projection evidence with acceptance diagnostics", () => {
    for (const invalidate of [
      (events: ReturnType<typeof journal>) => {
        events[6].viewGeneration = 2;
      },
      (events: ReturnType<typeof journal>) => {
        events[1].projectedAt = undefined;
      },
    ]) {
      const events = journal();
      invalidate(events);
      const samples = extractEditSamples(events, [1], "a");
      expect(samples[0].submissionAt).toBeNull();
      expect(evaluateSubmissionDiagnostics(samples).status).toBe("FAIL");
      expect(summarizeSubmissionTiming(events).samples).toEqual([]);
    }
  });

  it("preserves model application separately from completed source projection", () => {
    const events = journal();
    events[1].at = 14;
    const samples = extractEditSamples(events, [1], "a");
    expect(samples[0]).toMatchObject({ appliedAt: 14, modelAt: 15 });
    const timing = summarizeSubmissionTiming(events);
    expect(timing.samples[0]).toMatchObject({
      appliedToProjectedMs: 1,
      modelToSubmitMs: 25,
    });
    expect(timing.brushIntervals[0].modelToSubmitMs).toBe(26);
  });

  it("keeps superseded revisions and another session out of the causal path", () => {
    const superseded = journal();
    superseded[2].revision = 3;
    expect(summarizeSubmissionTiming(superseded).samples).toEqual([]);
    const foreign = journal();
    foreign[2].sessionId = "another-document";
    expect(summarizeSubmissionTiming(foreign).samples).toEqual([]);
  });

  it("keeps missing worker evidence and invalid clocks visible", () => {
    const missing = summarizeSubmissionTiming(
      journal().filter((event) => event.kind !== "raster-batch-result"),
    );
    expect(missing.samples).toEqual([]);
    expect(missing.incomplete[0].reason).toBe("missing-causal-timing");
    expect(missing.distributions.workerMs.count).toBe(0);
    const events = journal();
    events[3].timing!.startedAt = 999;
    const invalid = summarizeSubmissionTiming(events);
    expect(invalid.samples).toEqual([]);
    expect(invalid.incomplete[0].reason).toBe("invalid-clock-order");
  });

  it("explains every batch of a hold interval and outstanding work at pointerup", () => {
    const events: Record<string, any>[] = journal().filter(
      (event) =>
        !["input", "brush-interval", "brush-submit"].includes(event.kind),
    );
    events[1].timing = {
      timeOrigin: 1000,
      sentAt: 1020,
      startedAt: 1022,
      finishedAt: 1025,
      receivedAt: 1026,
    };
    events[2].at = 28;
    events.push(
      {
        kind: "brush-interval",
        at: 15,
        projectedAt: 15,
        intervalId: 4,
        gestureId: 3,
        cause: "hold",
        changed: true,
        sessionId: "a",
        revision: 2,
        bounds: [0, 0, 10, 10],
        inputIds: [],
      },
      {
        kind: "raster-batch-start",
        id: 7,
        at: 20,
        priority: 0,
        pixels: 64,
        viewProgress: false,
      },
      {
        kind: "raster-start",
        id: 8,
        batchId: 8,
        at: 29,
        sessionId: "a",
        revision: 2,
        bounds: [0, 0, 20, 20],
        size: 20,
        rect: [8, 0, 10, 8],
      },
      {
        kind: "raster-batch-start",
        id: 8,
        at: 30,
        priority: 0,
        pixels: 16,
        viewProgress: false,
      },
      {
        kind: "raster-batch-result",
        id: 8,
        at: 34,
        timing: {
          timeOrigin: 1000,
          sentAt: 1030,
          startedAt: 1031,
          finishedAt: 1033,
          receivedAt: 1034,
        },
      },
      {
        kind: "raster-upload",
        id: 8,
        at: 36,
        sessionId: "a",
        paintedRevision: 2,
      },
      {
        kind: "brush-submit",
        viewGeneration: 1,
        intervalId: 4,
        gestureId: 3,
        at: 40,
        frame: 9,
        sessionId: "a",
        revision: 2,
      },
      { kind: "input", id: 9, inputKind: "pointerup", createdAt: 32, at: 33 },
      {
        kind: "brush-end",
        gestureId: 3,
        input: 9,
        sessionId: "a",
        reason: "pointerup",
        endAt: 33,
        at: 33,
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
      {
        kind: "commit",
        sequence: 1,
        input: 9,
        at: 33.1,
        sessionId: "a",
        gestureId: 3,
        revision: 2,
        bounds: [[0, 0, 10, 10]],
      },
      {
        // Unrelated visible loading must not become required local work.
        kind: "raster-start",
        id: 10,
        batchId: 10,
        at: 34,
        sessionId: "a",
        revision: 2,
        bounds: [100, 100, 120, 120],
        size: 20,
        rect: [0, 0, 20, 20],
      },
    );
    const result = summarizeSubmissionTiming(events);
    expect(result.incomplete).toEqual([]);
    expect(result.samples).toEqual([]);
    expect(result.brushIntervals).toHaveLength(1);
    expect(result.brushIntervals[0]).toMatchObject({
      intervalId: 4,
      cause: "hold",
      inputToSubmitMs: null,
      modelToSubmitMs: 25,
    });
    expect(result.brushIntervals[0].rasterBatches).toMatchObject([
      {
        id: 7,
        priority: 0,
        requiredPixels: 64,
        workerMs: 3,
        gapBeforeDispatchMs: 5,
      },
      {
        id: 8,
        priority: 0,
        requiredPixels: 16,
        workerMs: 2,
        gapBeforeDispatchMs: 4,
      },
    ]);
    expect(result.pointerups).toHaveLength(1);
    expect(result.pointerups[0]).toMatchObject({
      input: 9,
      inputToSubmitMs: 8,
      inputToHandledMs: 1,
      handledToSubmitMs: 7,
    });
    expect(result.pointerups[0].rasterBatches).toMatchObject([
      { id: 8, gapBeforeDispatchMs: -2 },
    ]);
    expect(result.coverage).toEqual({
      inputs: { expected: 0, complete: 0, incomplete: 0 },
      brushIntervals: { expected: 1, complete: 1, incomplete: 0 },
      pointerups: { expected: 1, complete: 1, incomplete: 0 },
    });
    const missing = summarizeSubmissionTiming(
      events.filter(
        (event) => !(event.kind === "raster-batch-result" && event.id === 7),
      ),
    );
    expect(missing.brushIntervals).toEqual([]);
    expect(missing.incomplete).toContainEqual(
      expect.objectContaining({
        intervalId: 4,
        reason: "missing-causal-timing",
      }),
    );
    const missingLast = summarizeSubmissionTiming(
      events.filter(
        (event) => !(event.kind === "raster-batch-result" && event.id === 8),
      ),
    );
    expect(missingLast.coverage.brushIntervals).toEqual({
      expected: 1,
      complete: 0,
      incomplete: 1,
    });
    expect(missingLast.coverage.pointerups).toEqual({
      expected: 1,
      complete: 0,
      incomplete: 1,
    });
    expect(missingLast.pointerupToSubmitMs.count).toBe(1);
    expect(missingLast.brushModelToSubmitMs.count).toBe(1);
    const missingUpload = summarizeSubmissionTiming(
      events.filter(
        (event) => !(event.kind === "raster-upload" && event.id === 7),
      ),
    );
    expect(missingUpload.brushIntervals).toEqual([]);
    expect(missingUpload.incomplete).toContainEqual(
      expect.objectContaining({
        intervalId: 4,
        reason: "missing-causal-upload",
      }),
    );
    const invalidEvents = structuredClone(events);
    invalidEvents.find(
      (event) => event.kind === "raster-batch-result" && event.id === 8,
    )!.timing.startedAt = 1029.999755859375;
    const invalid = summarizeSubmissionTiming(invalidEvents);
    expect(invalid.coverage.brushIntervals.incomplete).toBe(1);
    expect(invalid.coverage.pointerups.incomplete).toBe(1);
    expect(invalid.pointerupToSubmitMs.count).toBe(1);
    expect(invalid.brushModelToSubmitMs).toMatchObject({ count: 1, max: 25 });
  });
});
