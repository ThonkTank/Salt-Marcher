import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Chromium's uint64 frame IDs must not be rounded into JavaScript doubles. */
export function parseTrace(text) {
  return JSON.parse(text, (_key, value, context) => {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      !Number.isSafeInteger(value)
    ) {
      if (!context?.source)
        throw new Error(
          "This Node runtime cannot preserve Chromium uint64 trace IDs.",
        );
      return context.source;
    }
    return value;
  });
}

export function analyzeTrace(text) {
  const parsed = parseTrace(text);
  const events = (
    Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? [])
  ).sort((a, b) => a.ts - b.ts);
  const counts = {};
  for (const event of events)
    counts[event.name] = (counts[event.name] ?? 0) + 1;
  const marks = events
    .filter((e) => e.name?.startsWith("atlas."))
    .map((e) => ({
      name: e.name,
      pid: e.pid,
      tid: e.tid,
      ts: e.ts,
      rendererStartTimeMs: e.args?.data?.startTime,
      sampleTraceId: e.args?.data?.sampleTraceId,
    }));
  const offsets = marks
    .filter((e) => Number.isFinite(e.rendererStartTimeMs))
    .map((e) => e.ts / 1000 - e.rendererStartTimeMs);
  const pipelines = events
    .filter((e) => e.args?.chrome_graphics_pipeline)
    .map((e) => ({
      ts: e.ts,
      duration: e.dur ?? null,
      pid: e.pid,
      tid: e.tid,
      ...e.args.chrome_graphics_pipeline,
    }));
  const mainFrames = events
    .filter((e) => e.args?.main_frame_pipeline)
    .map((e) => ({
      name: e.name,
      ts: e.ts,
      duration: e.dur ?? null,
      pid: e.pid,
      tid: e.tid,
      ...e.args.main_frame_pipeline,
    }));
  const reporters = [],
    latencies = [],
    pending = new Map();
  for (const e of events) {
    if (!["PipelineReporter", "EventLatency"].includes(e.name)) continue;
    const key = `${e.pid}:${e.cat}:${e.name}:${JSON.stringify(e.id2 ?? e.id)}`;
    if (e.ph === "b") pending.set(key, e);
    if (e.ph === "e" && pending.has(key)) {
      const start = pending.get(key);
      pending.delete(key);
      const entry = {
        pid: e.pid,
        startTs: start.ts,
        endTs: e.ts,
        ...start.args?.frame_reporter,
        ...start.args?.event_latency,
      };
      (e.name === "PipelineReporter" ? reporters : latencies).push(entry);
    }
  }
  const exactMarks = marks.filter((e) =>
    /^atlas\.submit\..+\.\d+\.\d+\.[0-9]+$/.test(e.name),
  );
  const candidates = exactMarks.map((mark) => {
    const enclosing = mainFrames.filter(
      (frame) =>
        frame.step === "BEGIN_MAIN_FRAME" &&
        frame.pid === mark.pid &&
        frame.tid === mark.tid &&
        frame.ts <= mark.ts &&
        frame.ts + (frame.duration ?? 0) >= mark.ts,
    );
    return {
      mark,
      enclosingMainFrameIds: enclosing.map((e) => e.main_frame_id),
      drawSteps: mainFrames.filter(
        (frame) =>
          frame.step === "DRAW" &&
          enclosing.some((e) => e.main_frame_id === frame.main_frame_id),
      ),
      confidence:
        "diagnostic containment only; Canvas resource ownership unproven",
    };
  });
  return {
    sha256: createHash("sha256").update(text).digest("hex"),
    events: events.length,
    selectedEventCounts: Object.fromEntries(
      Object.entries(counts).filter(([name]) =>
        /atlas\.|EventLatency|PipelineReporter|Graphics\.Pipeline|Presentation|SwapBuffers|DrawFrame/.test(
          name,
        ),
      ),
    ),
    marks,
    mainFrames,
    graphicsPipeline: pipelines,
    reporters,
    eventLatencies: latencies,
    exactSubmissionCandidates: candidates,
    clockObservation: {
      markerCount: offsets.length,
      minimumOffsetMs: offsets.length ? Math.min(...offsets) : null,
      maximumOffsetMs: offsets.length ? Math.max(...offsets) : null,
      calibrated: false,
      explanation:
        "Observed user-timing startTime to trace-ts offsets; no acceptance-grade clock calibration is inferred.",
    },
    mappingStatus: "unsupported",
    missingEdge:
      "Atlas semantic render generation -> the actual Canvas/shared-image resource consumed by this compositor frame. Mark containment and first subsequent draw are insufficient.",
    cautions: [
      "EventLatency may end at a cursor/partial frame before the exact terrain revision.",
      "A reported nominal vsync interval in headless traces does not establish a real reference display.",
      "Trace tails must include completed presentation reporters; stopping at submission can truncate them.",
      "No presentation timestamp is fabricated or exported as an accepted Atlas sample.",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2]) {
    console.error(
      "Usage: node scripts/atlas-p0-trace.mjs <trace.json> [analysis.json]",
    );
    process.exitCode = 2;
  } else {
    const analysis = analyzeTrace(await readFile(process.argv[2], "utf8"));
    if (process.argv[3])
      await writeFile(process.argv[3], JSON.stringify(analysis, null, 2));
    console.log(
      JSON.stringify(
        {
          events: analysis.events,
          mappingStatus: analysis.mappingStatus,
          missingEdge: analysis.missingEdge,
          clockObservation: analysis.clockObservation,
          selectedEventCounts: analysis.selectedEventCounts,
        },
        null,
        2,
      ),
    );
  }
}
