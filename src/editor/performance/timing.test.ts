import { describe, expect, it } from "vitest";
import { summarizeSubmissionTiming } from "../../../scripts/atlas-p0-timing.mjs";
import {
  extractEditSamples,
  evaluateSubmissionDiagnostics,
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
  },
  {
    kind: "height-draw",
    sessionId: "a",
    revision: 2,
    frame: 9,
    viewGeneration: 1,
    at: 39,
    uploadStart: 20,
    uploadedAt: 25,
    submittedAt: 39,
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
];

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
    events[2].uploadedAt = 19;
    expect(summarizeSubmissionTiming(events).incomplete[0].reason).toBe(
      "invalid-clock-order",
    );
    const resources = journal();
    resources[2].fallbackSamples = undefined;
    expect(summarizeSubmissionTiming(resources).incomplete[0].reason).toBe(
      "missing-resource-evidence",
    );
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
        inputToSubmitMs: 7,
        inputToHandledMs: 1,
        handledToSubmitMs: 6,
      },
    ]);
    expect(result.coverage).toEqual({
      inputs: { expected: 0, complete: 0, incomplete: 0 },
      brushIntervals: { expected: 1, complete: 1, incomplete: 0 },
      pointerups: { expected: 1, complete: 1, incomplete: 0 },
    });
  });
});
