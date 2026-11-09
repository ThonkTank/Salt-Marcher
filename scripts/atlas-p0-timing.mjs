// Explains renderer submission latency. These clocks do not prove display
// presentation and this diagnostic cannot turn a native acceptance gate green.
import {
  distribution as summarizeDistribution,
  extractSubmissionEvidence,
} from "./atlas-p0-evaluate.mjs";
const stages = [
  "inputToModelMs",
  "modelToDispatchMs",
  "dispatchToWorkerMs",
  "workerMs",
  "workerToMainMs",
  "mainToUploadMs",
  "uploadToSubmitMs",
];
const overlaps = (a, b) =>
  a?.length === 4 &&
  b?.length === 4 &&
  a[0] < b[2] &&
  a[2] > b[0] &&
  a[1] < b[3] &&
  a[3] > b[1];

function rasterBounds(task) {
  if (task.bounds?.length !== 4 || task.rect?.length !== 4 || !(task.size > 0))
    return null;
  const [x0, y0, x1, y1] = task.bounds;
  const stepX = (x1 - x0) / task.size;
  const stepY = (y1 - y0) / task.size;
  return [
    x0 + task.rect[0] * stepX,
    y0 + task.rect[1] * stepY,
    x0 + task.rect[2] * stepX,
    y0 + task.rect[3] * stepY,
  ];
}

function distribution(values) {
  const result = summarizeDistribution(values);
  return {
    count: result.count,
    invalid: result.invalid,
    median: result.p50,
    p95: result.p95,
    max: result.maximum,
  };
}

export function summarizeSubmissionTiming(events) {
  const evidence = extractSubmissionEvidence(events);
  const { inputs, doses: intervals } = evidence;
  const batches = new Map();
  const batchStarts = new Map();
  const tasks = new Map();
  const taskResults = new Map();
  const discardedTasks = new Set();
  const uploads = new Map();
  const commits = new Map(
    evidence.commits.map((commit) => [commit.input, commit]),
  );
  for (const event of events) {
    if (event.kind === "raster-batch-start") batchStarts.set(event.id, event);
    if (event.kind === "raster-batch-result" && event.timing)
      batches.set(event.id, event.timing);
    if (event.kind === "raster-start") tasks.set(event.id, event);
    if (event.kind === "raster-result") taskResults.set(event.id, event);
    if (event.kind === "raster-discard") discardedTasks.add(event.id);
    if (event.kind === "raster-upload") uploads.set(event.id, event);
  }
  const samples = [];
  const brushIntervals = [];
  const pointerups = [];
  const submissionLatencies = [];
  const incomplete = [];
  let pointerupCount = 0;
  const invalidBatchClock = (batch) => {
    const clock = [
      batch.dispatchAt,
      batch.startedAt,
      batch.finishedAt,
      batch.receivedAt,
      batch.lastUploadAt,
    ];
    return clock.some(
      (value, i) => !Number.isFinite(value) || (i > 0 && value < clock[i - 1]),
    );
  };
  const batchPath = (candidates, stepAt) => {
    const ids = [...new Set(candidates.map((task) => task.batchId))];
    let previousReceived = null;
    return ids
      .sort(
        (a, b) =>
          (batches.get(a)?.sentAt ?? Infinity) -
          (batches.get(b)?.sentAt ?? Infinity),
      )
      .map((id, order) => {
        const start = batchStarts.get(id);
        const timing = batches.get(id);
        const required = candidates.filter((task) => task.batchId === id);
        const pixels = (task) =>
          task.pixels ??
          (task.rect[2] - task.rect[0]) * (task.rect[3] - task.rect[1]);
        const dispatchAt = timing && timing.sentAt - timing.timeOrigin;
        const receivedAt = timing && timing.receivedAt - timing.timeOrigin;
        const result = {
          id,
          order,
          priority: start?.priority ?? null,
          viewProgress: start?.viewProgress ?? null,
          batchPixels: start?.pixels ?? null,
          requiredPixels: required.reduce((sum, task) => sum + pixels(task), 0),
          tasks: required.map((task) => ({
            id: task.id,
            key: task.key,
            rect: task.rect,
            pixels: pixels(task),
            stages: taskResults.get(task.id)?.stages ?? null,
          })),
          dispatchAt: dispatchAt ?? null,
          startedAt: timing ? timing.startedAt - timing.timeOrigin : null,
          finishedAt: timing ? timing.finishedAt - timing.timeOrigin : null,
          receivedAt: receivedAt ?? null,
          lastUploadAt: Math.max(
            ...required.map((task) => uploads.get(task.id).at),
          ),
          gapBeforeDispatchMs:
            dispatchAt === undefined
              ? null
              : dispatchAt - (previousReceived ?? stepAt),
          workerMs: timing ? timing.finishedAt - timing.startedAt : null,
          workerToMainMs: timing ? timing.receivedAt - timing.finishedAt : null,
        };
        previousReceived = receivedAt ?? previousReceived;
        return result;
      });
  };
  const diagnose = (model, input, published, identity) => {
    if (!published) {
      incomplete.push({
        ...identity,
        reason: "missing-matching-submission",
      });
      return null;
    }
    const { receipt: submit, frame } = published;
    if (
      !Array.isArray(model.bounds) ||
      model.bounds.length !== 4 ||
      !model.bounds.every(Number.isFinite)
    ) {
      incomplete.push({ ...identity, reason: "missing-changed-bounds" });
      return null;
    }
    // These endpoints share the renderer clock. Keep them even if worker/main
    // clock disagreement later makes the causal stage split incomplete.
    const rendererClock = [
      input?.createdAt ?? model.at,
      model.at,
      frame.at,
      submit.at,
    ];
    if (
      rendererClock.some(
        (value, i) =>
          !Number.isFinite(value) || (i > 0 && value < rendererClock[i - 1]),
      )
    ) {
      incomplete.push({
        ...identity,
        reason: "invalid-renderer-clock-order",
        clock: rendererClock,
      });
      return null;
    }
    submissionLatencies.push({
      ...identity,
      revision: model.revision,
      frame: submit.frame,
      inputToSubmitMs: input ? submit.at - input.createdAt : null,
      modelToSubmitMs: submit.at - model.at,
    });
    // The final required uploaded tile is this input's limiting raster path.
    // Earlier batches are included in its model-to-dispatch wait, not hidden.
    const required = [...tasks.values()].filter(
      (task) =>
        task.sessionId === model.sessionId &&
        task.revision === model.revision &&
        task.at >= model.at &&
        task.at <= frame.at &&
        !discardedTasks.has(task.id) &&
        overlaps(rasterBounds(task), model.bounds),
    );
    if (
      required.some((task) => {
        const upload = uploads.get(task.id);
        return (
          !upload ||
          upload.sessionId !== model.sessionId ||
          upload.paintedRevision !== task.revision ||
          upload.at > frame.at
        );
      })
    ) {
      incomplete.push({ ...identity, reason: "missing-causal-upload" });
      return null;
    }
    const candidates = required.sort(
      (a, b) => uploads.get(b.id).at - uploads.get(a.id).at,
    );
    const task = candidates[0];
    const timing = task && batches.get(task.batchId);
    const upload = task && uploads.get(task.id);
    if (
      !submit ||
      !timing ||
      !upload ||
      candidates.some((task) => !batches.has(task.batchId))
    ) {
      incomplete.push({ ...identity, reason: "missing-causal-timing" });
      return null;
    }
    const clock = [
      input?.createdAt ?? model.at,
      model.at,
      timing.sentAt - timing.timeOrigin,
      timing.startedAt - timing.timeOrigin,
      timing.finishedAt - timing.timeOrigin,
      timing.receivedAt - timing.timeOrigin,
      upload.at,
      submit.at,
    ];
    if (
      clock.some(
        (value, i) =>
          !Number.isFinite(value) || (i > 0 && value < clock[i - 1]),
      )
    ) {
      incomplete.push({
        ...identity,
        reason: "invalid-clock-order",
        clock,
      });
      return null;
    }
    const rasterBatches = batchPath(candidates, model.at);
    if (rasterBatches.some(invalidBatchClock)) {
      incomplete.push({
        ...identity,
        reason: "invalid-batch-clock-order",
        rasterBatches,
      });
      return null;
    }
    return {
      ...identity,
      revision: model.revision,
      task: task.id,
      batch: task.batchId,
      frame: submit.frame,
      ...Object.fromEntries(
        stages.map((name, i) => [name, clock[i + 1] - clock[i]]),
      ),
      inputToSubmitMs: input ? submit.at - input.createdAt : null,
      modelToSubmitMs: submit.at - model.at,
      rasterBatches,
    };
  };
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
    const sample = diagnose(
      model,
      input,
      evidence.publication(evidence.changesByInput.get(model.input)),
      {
        input: model.input,
        kind: "input",
      },
    );
    if (sample)
      samples.push({
        ...sample,
        appliedToProjectedMs: model.at - model.appliedAt,
      });
  }
  for (const interval of intervals) {
    const sample = diagnose(
      interval,
      inputs.get(interval.inputIds?.[0]),
      evidence.publication(interval),
      {
        intervalId: interval.intervalId,
        gestureId: interval.gestureId,
        cause: interval.cause,
        kind: "brush-interval",
        boundsSource: "changed-source-bounds",
      },
    );
    if (sample) brushIntervals.push(sample);
  }
  for (const end of events.filter(
    (event) =>
      event.kind === "brush-end" &&
      event.reason === "pointerup" &&
      event.input !== null,
  )) {
    const input = inputs.get(end.input);
    const commit = commits.get(end.input);
    const published = evidence.publication(commit);
    const submit = published?.receipt;
    const gestureIntervals = intervals.filter(
      (interval) =>
        interval.sessionId === end.sessionId &&
        interval.gestureId === end.gestureId,
    );
    if (!gestureIntervals.length) continue; // Deliberately rejected/no-op gesture.
    pointerupCount++;
    const latest = gestureIntervals.at(-1);
    const frame = published?.frame;
    if (
      !input ||
      !frame ||
      submit.sessionId !== end.sessionId ||
      submit.revision !== latest.revision ||
      frame.at < end.at ||
      frame.at > submit.at ||
      frame.revision < latest.revision
    ) {
      incomplete.push({
        input: end.input,
        kind: "pointerup",
        reason: "missing-matching-submission",
      });
      continue;
    }
    const clock = [input.createdAt, end.endAt, end.at, frame.at, submit.at];
    if (
      clock.some(
        (value, i) =>
          !Number.isFinite(value) || (i > 0 && value < clock[i - 1]),
      )
    ) {
      incomplete.push({
        input: end.input,
        kind: "pointerup",
        reason: "invalid-clock-order",
        clock,
      });
      continue;
    }
    submissionLatencies.push({
      kind: "pointerup",
      input: end.input,
      gestureId: end.gestureId,
      revision: latest.revision,
      frame: submit.frame,
      inputToSubmitMs: submit.at - input.createdAt,
    });
    // Pointerup creates no new dose. Only still outstanding work for its last
    // accepted revision belongs here, including batches started before release.
    const dirtyBounds = commit?.bounds;
    if (!Array.isArray(dirtyBounds) || !dirtyBounds.length) {
      incomplete.push({
        input: end.input,
        kind: "pointerup",
        reason: "missing-changed-bounds",
      });
      continue;
    }
    const outstanding = [...tasks.values()].filter((task) => {
      const upload = uploads.get(task.id);
      return (
        task.sessionId === end.sessionId &&
        task.revision === latest.revision &&
        task.at >= latest.at &&
        task.at <= frame.at &&
        !discardedTasks.has(task.id) &&
        dirtyBounds.some((bounds) => overlaps(rasterBounds(task), bounds)) &&
        (!upload || upload.at >= input.createdAt)
      );
    });
    if (
      outstanding.some((task) => {
        const upload = uploads.get(task.id);
        return (
          !upload ||
          upload.sessionId !== end.sessionId ||
          upload.paintedRevision !== latest.revision ||
          upload.at > frame.at
        );
      })
    ) {
      incomplete.push({
        input: end.input,
        kind: "pointerup",
        reason: "missing-causal-upload",
      });
      continue;
    }
    if (outstanding.some((task) => !batches.has(task.batchId))) {
      incomplete.push({
        input: end.input,
        kind: "pointerup",
        reason: "missing-causal-timing",
      });
      continue;
    }
    const rasterBatches = batchPath(outstanding, input.createdAt);
    if (rasterBatches.some(invalidBatchClock)) {
      incomplete.push({
        input: end.input,
        kind: "pointerup",
        reason: "invalid-batch-clock-order",
        rasterBatches,
      });
      continue;
    }
    pointerups.push({
      input: end.input,
      gestureId: end.gestureId,
      revision: latest.revision,
      frame: submit.frame,
      inputToSubmitMs: submit.at - input.createdAt,
      inputToHandledMs: end.endAt - input.createdAt,
      handledToSubmitMs: submit.at - end.endAt,
      rasterBatches,
      interpretation:
        "Work still awaiting upload at release may have started before pointerup; no new brush dose.",
    });
  }
  return {
    kind: "renderer-submission-diagnostic",
    scope:
      "accepted input IDs, every changed brush interval including holds, and pointerup; distributions remain separate",
    nativePresentation: false,
    clock:
      "performance.timeOrigin + performance.now across renderer and worker",
    path: "all required raster batches with priority, pixels and dispatch gaps; limiting uploaded tile for the causal stage split",
    samples,
    brushIntervals,
    pointerups,
    submissionLatencies,
    incomplete,
    latencyPolicy:
      "Renderer-only endpoint durations include paths with incomplete worker timing; missing/invalid causal clocks remain reported without correction.",
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
                .filter((sample) => sample.kind === "input")
                .map((sample) => sample.inputToSubmitMs)
            : samples.map((sample) => sample[stage]),
        ),
      ]),
    ),
    brushModelToSubmitMs: distribution(
      submissionLatencies
        .filter((sample) => sample.kind === "brush-interval")
        .map((sample) => sample.modelToSubmitMs),
    ),
    pointerupToSubmitMs: distribution(
      submissionLatencies
        .filter((sample) => sample.kind === "pointerup")
        .map((sample) => sample.inputToSubmitMs),
    ),
  };
}
