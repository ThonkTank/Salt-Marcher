// Explains renderer submission latency. These clocks do not prove display
// presentation and this diagnostic cannot turn a native acceptance gate green.
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
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, median: null, p95: null, max: null };
  const at = (fraction) =>
    sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return {
    count: sorted.length,
    median: at(0.5),
    p95: at(0.95),
    max: sorted.at(-1),
  };
}

export function summarizeSubmissionTiming(events) {
  const inputs = new Map();
  const batches = new Map();
  const tasks = new Map();
  const uploads = new Map();
  const submissions = new Map();
  const frames = new Map();
  for (const event of events) {
    if (event.kind === "input") inputs.set(event.id, event);
    if (event.kind === "raster-batch-result" && event.timing)
      batches.set(event.id, event.timing);
    if (event.kind === "raster-start") tasks.set(event.id, event);
    if (event.kind === "raster-upload") uploads.set(event.id, event);
    if (event.kind === "edit-submit" && !submissions.has(event.input))
      submissions.set(event.input, event);
    if (event.kind === "submit")
      frames.set(`${event.sessionId}/${event.frame}`, event);
  }
  const samples = [];
  const incomplete = [];
  for (const model of events.filter((event) => event.kind === "model")) {
    const input = inputs.get(model.input);
    const submit = submissions.get(model.input);
    const frame = submit && frames.get(`${submit.sessionId}/${submit.frame}`);
    if (
      !model.sessionId ||
      submit?.sessionId !== model.sessionId ||
      submit.revision !== model.revision ||
      !frame ||
      frame.revision < model.revision ||
      frame.at > submit.at
    ) {
      incomplete.push({
        input: model.input,
        reason: "missing-matching-submission",
      });
      continue;
    }
    // The final required uploaded tile is this input's limiting raster path.
    // Earlier batches are included in its model-to-dispatch wait, not hidden.
    const candidates = [...tasks.values()]
      .filter((task) => {
        const upload = uploads.get(task.id);
        return (
          upload &&
          submit &&
          task.sessionId === model.sessionId &&
          upload.sessionId === model.sessionId &&
          task.revision === model.revision &&
          upload.paintedRevision === task.revision &&
          task.at >= model.at &&
          upload.at <= frame.at &&
          overlaps(rasterBounds(task), model.bounds)
        );
      })
      .sort((a, b) => uploads.get(b.id).at - uploads.get(a.id).at);
    const task = candidates[0];
    const timing = task && batches.get(task.batchId);
    const upload = task && uploads.get(task.id);
    if (!input || !submit || !timing || !upload) {
      incomplete.push({ input: model.input, reason: "missing-causal-timing" });
      continue;
    }
    const clock = [
      input.createdAt,
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
        input: model.input,
        reason: "invalid-clock-order",
        clock,
      });
      continue;
    }
    samples.push({
      input: model.input,
      revision: model.revision,
      task: task.id,
      batch: task.batchId,
      frame: submit.frame,
      ...Object.fromEntries(
        stages.map((name, i) => [name, clock[i + 1] - clock[i]]),
      ),
      inputToSubmitMs: submit.at - input.createdAt,
    });
  }
  return {
    kind: "renderer-submission-diagnostic",
    scope: "accepted input IDs; hold-only doses have no separate input ID",
    nativePresentation: false,
    clock:
      "performance.timeOrigin + performance.now across renderer and worker",
    path: "final required uploaded tile; prior batch waits included before dispatch",
    samples,
    incomplete,
    distributions: Object.fromEntries(
      [...stages, "inputToSubmitMs"].map((stage) => [
        stage,
        distribution(samples.map((sample) => sample[stage])),
      ]),
    ),
  };
}
