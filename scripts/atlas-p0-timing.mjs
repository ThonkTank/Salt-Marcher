// Diagnose the real numeric-source/draw path. A GL submission is not native
// presentation; this report never upgrades that separate acceptance gate.
import {
  distribution as summarizeDistribution,
  extractSubmissionEvidence,
} from "./atlas-p0-evaluate.mjs";

const stages = [
  "inputToModelMs",
  "modelToUploadMs",
  "uploadMs",
  "drawMs",
  "betweenWorkMs",
];
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
  const packets = events.filter((event) => event.kind === "height-terrain");
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

  const integer = (value) => Number.isSafeInteger(value) && value >= 0;
  function terrainFor(draw) {
    if (!Number.isSafeInteger(draw.renderId) || draw.renderId <= 0) return null;
    const own = packets
      .filter(
        (packet) =>
          packet.sessionId === draw.sessionId &&
          packet.viewGeneration === draw.viewGeneration &&
          packet.revision === draw.revision &&
          packet.renderId === draw.renderId &&
          packet.submittedAt <= draw.sceneStart,
      )
      .sort((a, b) => a.packet - b.packet);
    if (
      !own.length ||
      new Set(own.map((packet) => packet.packet)).size !== own.length
    )
      return null;
    for (const packet of own) {
      if (
        !Number.isSafeInteger(packet.packet) ||
        packet.packet <= 0 ||
        !ordered([
          packet.uploadStart,
          packet.uploadedAt,
          packet.submittedAt,
          draw.sceneStart,
        ]) ||
        ![
          packet.uploadedBytes,
          packet.updatedTiles,
          packet.compositionWork,
        ].every(integer) ||
        !Array.isArray(packet.uploadSpans) ||
        !packet.uploadSpans.length ||
        !Array.isArray(packet.compositionSpans)
      )
        return null;
      for (const [spans, field] of [
        [packet.uploadSpans, "bytes"],
        [packet.compositionSpans, "work"],
      ])
        if (
          spans.some(
            (span) =>
              !ordered([
                packet.uploadStart,
                span?.start,
                span?.end,
                packet.submittedAt,
              ]) || !integer(span?.[field]),
          )
        )
          return null;
      const all = [...packet.uploadSpans, ...packet.compositionSpans].sort(
        (a, b) => a.start - b.start,
      );
      if (
        all.some((span, i) => i > 0 && span.start < all[i - 1].end) ||
        packet.uploadSpans[0].start !== packet.uploadStart ||
        packet.uploadSpans.at(-1).end !== packet.uploadedAt ||
        packet.uploadSpans.reduce((sum, span) => sum + span.bytes, 0) !==
          packet.uploadedBytes ||
        packet.compositionSpans.reduce((sum, span) => sum + span.work, 0) !==
          packet.compositionWork
      )
        return null;
    }
    if (
      own.some(
        (packet, i) => i > 0 && packet.uploadStart < own[i - 1].submittedAt,
      )
    )
      return null;
    return {
      packetIds: own.map((packet) => packet.packet),
      uploadStart: own[0].uploadStart,
      uploadedBytes: own.reduce((sum, packet) => sum + packet.uploadedBytes, 0),
      updatedTiles: own.reduce((sum, packet) => sum + packet.updatedTiles, 0),
      uploadMs: own.reduce(
        (sum, packet) =>
          sum +
          packet.uploadSpans.reduce((n, span) => n + span.end - span.start, 0),
        0,
      ),
      compositionMs: own.reduce(
        (sum, packet) =>
          sum +
          packet.compositionSpans.reduce(
            (n, span) => n + span.end - span.start,
            0,
          ),
        0,
      ),
    };
  }

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
    if (
      !ordered([draw.sceneStart, draw.submittedAt]) ||
      draw.submittedAt !== frame.at
    ) {
      incomplete.push({ ...identity, reason: "invalid-clock-order" });
      return null;
    }
    const terrain = terrainFor(draw);
    if (!terrain) {
      incomplete.push({
        ...identity,
        reason: "missing-or-invalid-terrain-packets",
      });
      return null;
    }
    if (
      !ordered([
        input?.createdAt ?? model.at,
        model.at,
        terrain.uploadStart,
        draw.sceneStart,
        draw.submittedAt,
      ])
    ) {
      incomplete.push({ ...identity, reason: "invalid-clock-order" });
      return null;
    }
    if (!integer(draw.fallbackSamples)) {
      incomplete.push({ ...identity, reason: "missing-resource-evidence" });
      return null;
    }
    const sceneMs = draw.submittedAt - draw.sceneStart;
    const drawMs = terrain.compositionMs + sceneMs;
    return {
      ...latency,
      inputToModelMs: input ? model.at - input.createdAt : 0,
      modelToUploadMs: terrain.uploadStart - model.at,
      uploadMs: terrain.uploadMs,
      drawMs,
      compositionMs: terrain.compositionMs,
      sceneMs,
      betweenWorkMs:
        draw.submittedAt - terrain.uploadStart - terrain.uploadMs - drawMs,
      packetIds: terrain.packetIds,
      uploadedBytes: terrain.uploadedBytes,
      updatedTiles: terrain.updatedTiles,
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
    const completedAt = published?.completedAt ?? frame?.at;
    if (
      !input ||
      !frame ||
      !ordered([input.createdAt, end.endAt, end.at, commit?.at, completedAt])
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
      submittedAt: frame.at,
      completedAt,
      inputToCompletionMs: completedAt - input.createdAt,
      inputToHandledMs: end.endAt - input.createdAt,
      handledToCompletionMs: completedAt - end.endAt,
      reusedSubmission: frame.at < commit.at,
    };
    submissionLatencies.push(latency);
    const draw = matchingDraw(frame);
    if (
      !draw ||
      !ordered([draw.sceneStart, draw.submittedAt]) ||
      draw.submittedAt !== frame.at
    ) {
      incomplete.push({
        kind: "pointerup",
        input: end.input,
        reason: "missing-causal-draw",
      });
      continue;
    }
    const terrain = terrainFor(draw);
    if (!terrain) {
      incomplete.push({
        kind: "pointerup",
        input: end.input,
        reason: "missing-or-invalid-terrain-packets",
      });
      continue;
    }
    pointerups.push({
      ...latency,
      packetIds: terrain.packetIds,
      uploadedBytes: terrain.uploadedBytes,
      interpretation:
        "Completion uses the actual current terrain draw and commit time; the original submission may precede pointerup. Neither is native presentation.",
    });
  }
  return {
    kind: "renderer-submission-diagnostic",
    nativePresentation: false,
    path: "accepted numeric sources -> frozen terrain packets -> actual canvas submission",
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
      "Endpoint durations retain otherwise valid evidence when detailed packet timing is missing. uploadMs sums actual upload spans; drawMs sums composition spans and canvas work. betweenWorkMs contains the remaining scheduling, preparation and fence/flush gaps, not GPU duration. Terrain work is scoped to the scene’s actual frozen renderId.",
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
    pointerupToCompletionMs: distribution(
      submissionLatencies
        .filter((value) => value.kind === "pointerup")
        .map((value) => value.inputToCompletionMs),
    ),
  };
}
