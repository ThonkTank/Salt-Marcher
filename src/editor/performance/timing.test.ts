import { describe, expect, it } from "vitest";
import { summarizeSubmissionTiming } from "../../../scripts/atlas-p0-timing.mjs";

const journal = () => [
  { kind: "input", id: 1, at: 12, createdAt: 10 },
  {
    kind: "model",
    input: 1,
    at: 15,
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
  { kind: "submit", at: 39, frame: 9, sessionId: "a", revision: 2 },
  {
    kind: "edit-submit",
    input: 1,
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
    expect(result.samples).toEqual([
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
});
