import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// FrameSubscriber consumes FrameSinkVideoCapture, not display presentation
// feedback: https://github.com/electron/electron/blob/v44.10.2/shell/browser/api/frame_subscriber.cc
export const nativePresentationCapability = Object.freeze({
  status: "unsupported",
  code: "NATIVE_PRESENTATION_MAPPING_UNPROVEN",
  method: null,
  reason:
    "The pinned CDP probe captures terrain pixels and matches begin-frame IDs to presentation reporters, but cannot bind each bitmap to its CopyOutput/capture trigger or certify an arbitrary exact Atlas generation's first presentation. Screenshot predicates, estimated display time, callback/RAF time and the first matching captured frame are not an acceptance-grade mapping.",
  clock: Object.freeze({ calibrated: false }),
});

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

export function analyzeTrace(text, { rendererPid } = {}) {
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
  const rendererPids =
    rendererPid === undefined
      ? [...new Set(exactMarks.map((mark) => mark.pid))]
      : [rendererPid];
  // Chromium 152.0.7977.169's ChromeFrameReporter2 uses uint64 for
  // frame_source/frame_sequence, but int64 for surface/display trace IDs:
  // https://github.com/chromium/chromium/blob/152.0.7977.169/base/tracing/protos/chrome_track_event.proto
  const id = (value, signed = false) => {
    if (Number.isSafeInteger(value)) value = String(value);
    if (typeof value !== "string" || !/^(?:-?\d+|0x[0-9a-f]+)$/i.test(value))
      return null;
    const integer = BigInt(value);
    const minimum = signed ? -9223372036854775808n : 0n;
    const maximum = signed ? 9223372036854775807n : 18446744073709551615n;
    return integer >= minimum && integer <= maximum ? String(integer) : null;
  };
  const traceId = (value) => {
    const result = id(value, true);
    // BeginFrameArgs/BeginFrameAck initialize their unknown trace_id to -1.
    return result === "-1" ? null : result;
  };
  const screenshots = events
    .filter((event) => event.name === "Screenshot")
    .map((event, index) => {
      const source = id(event.args?.source_id);
      const sequence = id(event.args?.frame_sequence);
      const matching = reporters.filter(
        (reporter) =>
          source !== null &&
          sequence !== null &&
          rendererPids.length === 1 &&
          reporter.pid === rendererPids[0] &&
          id(reporter.frame_source) === source &&
          id(reporter.frame_sequence) === sequence &&
          reporter.state === "STATE_PRESENTED_ALL",
      );
      const complete = matching.filter(
        (reporter) =>
          reporter.has_missing_content === false &&
          Number.isSafeInteger(reporter.layer_tree_host_id) &&
          reporter.layer_tree_host_id > 0 &&
          traceId(reporter.surface_frame_trace_id) !== null &&
          traceId(reporter.display_trace_id) !== null &&
          Number.isFinite(reporter.endTs),
      );
      const snapshot = event.args?.snapshot;
      return {
        index,
        captureTs: event.ts,
        sourceId: source,
        frameSequence: sequence,
        snapshotSha256:
          typeof snapshot === "string" && snapshot.length > 0
            ? createHash("sha256")
                .update(Buffer.from(snapshot, "base64"))
                .digest("hex")
            : null,
        imageStatus:
          typeof snapshot === "string" && snapshot.length > 0
            ? "encoded-image-unverified"
            : "missing",
        // This estimated field is retained solely to expose its difference
        // from actual reporter end times. It never becomes a presentation time.
        expectedDisplayTime: event.args?.expected_display_time ?? null,
        reporterCandidates: matching,
        frameIdentityStatus:
          matching.length === 1 && complete.length === 1
            ? "unique-reporter-candidate"
            : matching.length > 1
              ? "ambiguous"
              : "unmapped",
        presentationAt: null,
      };
    });
  const captureEvents = events
    .filter((event) => event.cat?.split(",").includes("gpu.capture"))
    .map(({ name, ph, ts, dur, pid, tid, id, id2, args }) => ({
      name,
      ph,
      ts,
      dur,
      pid,
      tid,
      id,
      id2,
      args,
    }));
  const captureStarts = captureEvents.filter(
    (event) => event.name === "Capture" && event.ph === "b",
  );
  return {
    sha256: createHash("sha256").update(text).digest("hex"),
    events: events.length,
    selectedEventCounts: Object.fromEntries(
      Object.entries(counts).filter(([name]) =>
        /atlas\.|Screenshot|EventLatency|PipelineReporter|Graphics\.Pipeline|Presentation|SwapBuffers|DrawFrame/.test(
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
    screenshots,
    captureEvents,
    copyOutputEvents: events.filter((event) =>
      /::CopyOutput$/.test(event.name),
    ),
    screenshotMapping: {
      rendererPids,
      captured: screenshots.length,
      uniqueReporterCandidates: screenshots.filter(
        (frame) => frame.frameIdentityStatus === "unique-reporter-candidate",
      ).length,
      ambiguous: screenshots.filter(
        (frame) => frame.frameIdentityStatus === "ambiguous",
      ).length,
      unmapped: screenshots.filter(
        (frame) => frame.frameIdentityStatus === "unmapped",
      ).length,
      mappedPresentations: 0,
      captureTriggers: Object.fromEntries(
        [...new Set(captureStarts.map((event) => event.args?.trigger))]
          .filter(Boolean)
          .map((trigger) => [
            trigger,
            captureStarts.filter((event) => event.args?.trigger === trigger)
              .length,
          ]),
      ),
      screenshotsWithCaptureNumber: events.filter(
        (event) =>
          event.name === "Screenshot" && event.args?.frame_number !== undefined,
      ).length,
      capturesWithCompositorIdentity: captureStarts.filter(
        (event) =>
          event.args?.source_id !== undefined &&
          event.args?.frame_sequence !== undefined,
      ).length,
      explanation:
        "Frame IDs are diagnostic candidates only. The screenshot must certify the exact terrain generation, its copy/refresh provenance, and the first successful presentation before a timestamp can be accepted.",
    },
    clockObservation: {
      markerCount: offsets.length,
      minimumOffsetMs: offsets.length ? Math.min(...offsets) : null,
      maximumOffsetMs: offsets.length ? Math.max(...offsets) : null,
      calibrated: false,
      explanation:
        "Observed user-timing startTime to trace-ts offsets; no acceptance-grade clock calibration is inferred.",
    },
    mappingStatus: nativePresentationCapability.status,
    missingEdge: screenshots.length
      ? "Screenshot bitmap -> its actual CopyOutput/capture identity and trigger (compositor vs demand/refresh), then exact terrain generation -> first successful presentation. Begin-frame IDs and a unique reporter alone do not establish these edges."
      : "Atlas semantic render generation -> the actual Canvas/shared-image resource consumed by this compositor frame. Mark containment and first subsequent draw are insufficient.",
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
