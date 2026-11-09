// Diagnose the real numeric-source/draw path. A GL submission is not native
// presentation; this report never upgrades that separate acceptance gate.
import {
  distribution as summarizeDistribution,
  extractSubmissionEvidence,
} from "./atlas-p0-evaluate.mjs";

const stages = ["inputToModelMs", "modelToUploadMs", "uploadMs", "drawMs"];
function distribution(values) {
  const value = summarizeDistribution(values);
  return {
    count: value.count,
    invalid: value.invalid,
    median: value.p50,
    p95: value.p95,
    max: value.maximum,
  };
}
export function summarizeSubmissionTiming(events) {
  const evidence = extractSubmissionEvidence(events);
  const { inputs, doses: intervals } = evidence;
  const draws = events.filter((event) => event.kind === "height-draw");
  const samples = [],
    brushIntervals = [],
    pointerups = [];
  const submissionLatencies = [],
    incomplete = [];
  const ordered = (clock) =>
    clock.every(
      (value, i) =>
        Number.isFinite(value) && (i === 0 || value >= clock[i - 1]),
    );
  const matchingDraw = (frame) =>
    draws.find(
      (draw) =>
        draw.sessionId === frame.sessionId &&
        draw.frame === frame.frame &&
        draw.viewGeneration === frame.viewGeneration &&
        draw.revision === frame.revision,
    );

  function diagnose(model, input, published, identity) {
    if (!published) {
      incomplete.push({ ...identity, reason: "missing-matching-submission" });
      return null;
    }
    const { receipt: receipt, frame } = published;
    if (
      !ordered([input?.createdAt ?? model.at, model.at, frame.at, receipt.at])
    ) {
      incomplete.push({ ...identity, reason: "invalid-renderer-clock-order" });
      return null;
    }
    const latency = {
      ...identity,
      revision: model.revision,
      frame: frame.frame,
      inputToSubmitMs: input ? frame.at - input.createdAt : null,
      modelToSubmitMs: frame.at - model.at,
    };
    submissionLatencies.push(latency);
    const draw = matchingDraw(frame);
    if (!draw) {
      incomplete.push({ ...identity, reason: "missing-causal-draw" });
      return null;
    }
    const clock = [
      input?.createdAt ?? model.at,
      model.at,
      draw.uploadStart,
      draw.uploadedAt,
      draw.submittedAt,
    ];
    if (!ordered(clock) || draw.submittedAt !== frame.at) {
      incomplete.push({ ...identity, reason: "invalid-clock-order", clock });
      return null;
    }
    if (
      ![draw.uploadedBytes, draw.updatedTiles, draw.fallbackSamples].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
    ) {
      incomplete.push({ ...identity, reason: "missing-resource-evidence" });
      return null;
    }
    return {
      ...latency,
      ...Object.fromEntries(
        stages.map((name, i) => [name, clock[i + 1] - clock[i]]),
      ),
      uploadedBytes: draw.uploadedBytes,
      updatedTiles: draw.updatedTiles,
      fallbackSamples: draw.fallbackSamples,
    };
  }
  const modelEvents = intervals.flatMap((interval) =>
    (interval.inputIds ?? []).map((input) => ({
      ...interval,
      input,
      at: interval.projectedAt,
      appliedAt: interval.at,
    })),
  );
  for (const model of modelEvents) {
    const input = inputs.get(model.input);
    if (!input) {
      incomplete.push({
        kind: "input",
        input: model.input,
        reason: "missing-input",
      });
      continue;
    }
    const value = diagnose(
      model,
      input,
      evidence.publication(evidence.changesByInput.get(model.input)),
      { input: model.input, kind: "input" },
    );
    if (value)
      samples.push({
        ...value,
        appliedToProjectedMs: model.at - model.appliedAt,
      });
  }
  for (const interval of intervals) {
    const value = diagnose(
      interval,
      inputs.get(interval.inputIds?.[0]),
      evidence.publication(interval),
      {
        intervalId: interval.intervalId,
        gestureId: interval.gestureId,
        cause: interval.cause,
        kind: "brush-interval",
      },
    );
    if (value) brushIntervals.push(value);
  }
  const commits = new Map(
    evidence.commits.map((commit) => [commit.input, commit]),
  );
  let pointerupCount = 0;
  for (const end of events.filter(
    (event) =>
      event.kind === "brush-end" &&
      event.reason === "pointerup" &&
      event.input !== null,
  )) {
    const gesture = intervals.filter(
      (interval) =>
        interval.sessionId === end.sessionId &&
        interval.gestureId === end.gestureId,
    );
    if (!gesture.length) continue;
    pointerupCount++;
    const input = inputs.get(end.input);
    const commit = commits.get(end.input);
    const published = evidence.publication(commit);
    const frame = published?.frame;
    if (
      !input ||
      !frame ||
      !ordered([input.createdAt, end.endAt, end.at, frame.at])
    ) {
      incomplete.push({
        kind: "pointerup",
        input: end.input,
        reason: "missing-matching-submission",
      });
      continue;
    }
    const latency = {
      kind: "pointerup",
      input: end.input,
      gestureId: end.gestureId,
      revision: commit.revision,
      frame: frame.frame,
      inputToSubmitMs: frame.at - input.createdAt,
      inputToHandledMs: end.endAt - input.createdAt,
      handledToSubmitMs: frame.at - end.endAt,
    };
    submissionLatencies.push(latency);
    const draw = matchingDraw(frame);
    if (
      !draw ||
      !ordered([draw.uploadStart, draw.uploadedAt, draw.submittedAt]) ||
      draw.submittedAt !== frame.at
    ) {
      incomplete.push({
        kind: "pointerup",
        input: end.input,
        reason: "missing-causal-draw",
      });
      continue;
    }
    pointerups.push({
      ...latency,
      uploadedBytes: draw.uploadedBytes,
      interpretation:
        "Pointerup confirms accepted data; it never creates a further dose.",
    });
  }
  return {
    kind: "renderer-submission-diagnostic",
    nativePresentation: false,
    path: "accepted numeric sources -> resource upload -> actual terrain draw",
    scope:
      "accepted input IDs, every changed interval including holds, and pointerup",
    clock:
      "renderer performance.now; GPU execution and native presentation are not measured",
    samples,
    brushIntervals,
    pointerups,
    submissionLatencies,
    incomplete,
    latencyPolicy:
      "Endpoint durations retain otherwise valid evidence when detailed draw timing is missing.",
    coverage: {
      inputs: {
        expected: modelEvents.length,
        complete: samples.length,
        incomplete: modelEvents.length - samples.length,
      },
      brushIntervals: {
        expected: intervals.length,
        complete: brushIntervals.length,
        incomplete: intervals.length - brushIntervals.length,
      },
      pointerups: {
        expected: pointerupCount,
        complete: pointerups.length,
        incomplete: pointerupCount - pointerups.length,
      },
    },
    distributions: Object.fromEntries(
      [...stages, "inputToSubmitMs"].map((stage) => [
        stage,
        distribution(
          stage === "inputToSubmitMs"
            ? submissionLatencies
                .filter((value) => value.kind === "input")
                .map((value) => value.inputToSubmitMs)
            : samples.map((value) => value[stage]),
        ),
      ]),
    ),
    brushModelToSubmitMs: distribution(
      submissionLatencies
        .filter((value) => value.kind === "brush-interval")
        .map((value) => value.modelToSubmitMs),
    ),
    pointerupToSubmitMs: distribution(
      submissionLatencies
        .filter((value) => value.kind === "pointerup")
        .map((value) => value.inputToSubmitMs),
    ),
  };
}
