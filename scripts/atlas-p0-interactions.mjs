import { captureCanvas } from "./atlas-p0-desktop.mjs";
import {
  extractEditSamples,
  strokeEvidence,
  evaluateBrushTime,
  evaluateSubmissionDiagnostics,
} from "./atlas-p0-evaluate.mjs";

export const snapshot = (page, points = [], options = {}) =>
  page.evaluate(({ points, options }) => window.atlasObserve(points, options), {
    points,
    options,
  });
export const stateSnapshot = (page, points = []) =>
  snapshot(page, points, { events: false });
export const button = (page, name) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).click();

export const storeActivityPosition = (session) =>
  session.app.evaluate(() => {
    const observed = globalThis.__atlasHost.storeActivity({
      sinceEvent: Number.MAX_SAFE_INTEGER,
    });
    if (observed.droppedEvents)
      throw new Error("Store activity events were dropped");
    return observed.eventCount;
  });

export const storeIntervalReference = ({ start, end, ...details }) => ({
  token: start.token,
  kind: start.kind,
  sessionId: start.sessionId,
  startEvent: start.index,
  endEvent: end.index,
  ...details,
});

/** Observe successful publication before starting another ordinary file action. */
export async function waitForSaveCompletion(session, start) {
  return session.app.evaluate(async (_electron, start) => {
    if (!start) throw new Error("No actual save start was observed");
    const deadline = performance.now() + 10_000;
    let cursor = start.index;
    const activity = [];
    while (performance.now() < deadline) {
      const observed = globalThis.__atlasHost.storeActivity({
        sinceEvent: cursor,
      });
      if (observed.droppedEvents)
        throw new Error("Store activity events were dropped");
      activity.push(...observed.events);
      cursor = observed.eventCount;
      const failed = activity.find(
        (event) =>
          event.token === start.token &&
          event.phase === "end" &&
          event.success !== true,
      );
      if (failed) throw new Error(`Observed save ${failed.kind} failed`);
      const published = activity.find(
        (event) =>
          event.token === start.token &&
          event.kind === "publish" &&
          event.phase === "end" &&
          event.success === true,
      );
      if (published && globalThis.__atlasHost.fileActionPending() === false)
        return activity;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    throw new Error("Observed save did not finish successful publication");
  }, start);
}

export async function brush(page, diameter, rateFeetPerSecond) {
  await page.getByLabel("Pinselgröße", { exact: true }).fill(String(diameter));
  await page
    .getByLabel("Pinselstärke", { exact: true })
    .fill(String(rateFeetPerSecond * 0.3048));
  await button(page, /Anheben/);
}
export async function exact(page, timeout = 20_000) {
  await page.waitForFunction(
    () => {
      const o = window.atlasObserve([], { events: false });
      const error =
        o.state.error ??
        document.querySelector('[role="alert"]')?.textContent?.trim();
      if (error) throw new Error(error);
      return (
        !o.state.loading &&
        o.renderer.submittedRevision === o.document.revision &&
        o.renderer.submittedViewGeneration === o.renderer.viewGeneration
      );
    },
    null,
    { timeout },
  );
}
export async function position(page, point = [0, 0]) {
  const o = await stateSnapshot(page);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas has no bounding box");
  return {
    x: box.x + box.width / 2 + (point[0] - o.camera.x) * o.camera.scale,
    y: box.y + box.height / 2 + (point[1] - o.camera.y) * o.camera.scale,
  };
}

/** Actual canvas pixels, outside timed intervals. No rendering completion is inferred. */
export async function capture(session, name, points = [], fixedPixels) {
  const state = await stateSnapshot(session.page);
  const box = await session.page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas unavailable for image check");
  const samples =
    fixedPixels ??
    points.map(([x, y]) => ({
      x: Math.round(box.width / 2 + (x - state.camera.x) * state.camera.scale),
      y: Math.round(box.height / 2 + (y - state.camera.y) * state.camera.scale),
    }));
  return {
    ...(await captureCanvas(session, name, samples)),
    points,
    camera: state.camera,
    revision: state.document.revision,
  };
}
export const waterPixel = (p) => Boolean(p && p[2] > p[0] + 20);
export const landPixel = (p) => Boolean(p && p[0] > p[2] + 15);
const near = (a, b, tolerance = 1e-5) =>
  Number.isFinite(a) && Math.abs(a - b) <= tolerance;
const inputCutoff = (o) =>
  o.lastInputId ??
  Math.max(
    0,
    ...(o.events ?? []).filter((e) => e.kind === "input").map((e) => e.id),
  );

/** Wheel success is checked independently of pan, at a fixed coastal pixel. */
export async function zoomAndPan(session, prefix = "navigation") {
  const { page } = session;
  await button(page, "Nahansicht");
  await page.getByLabel("Raster anzeigen").uncheck();
  await exact(page);
  const before = await stateSnapshot(page);
  // Integer screen coordinates avoid native pointer rounding changing the anchor.
  const anchor = [160, 200];
  const at = await position(page, anchor);
  const beforeImage = await capture(session, `${prefix}-zoom-before`, [
    [-800, -150],
  ]);
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, -500);
  let changed = true;
  try {
    await page.waitForFunction(
      (scale) =>
        window.atlasObserve([], { events: false }).camera.scale > scale * 1.5,
      before.camera.scale,
      { timeout: 2000 },
    );
    await exact(page);
  } catch {
    changed = false;
  }
  const after = await stateSnapshot(page);
  const afterImage = await capture(
    session,
    `${prefix}-zoom-after`,
    [],
    beforeImage.screenPoints,
  );
  const anchorAfter = [
    after.camera.x +
      ((anchor[0] - before.camera.x) * before.camera.scale) /
        after.camera.scale,
    after.camera.y +
      ((anchor[1] - before.camera.y) * before.camera.scale) /
        after.camera.scale,
  ];
  const zoom = {
    passed:
      changed &&
      near(anchorAfter[0], anchor[0]) &&
      near(anchorAfter[1], anchor[1]) &&
      waterPixel(beforeImage.pixels[0]) &&
      landPixel(afterImage.pixels[0]),
    beforeCamera: before.camera,
    afterCamera: after.camera,
    anchor,
    anchorAfter,
    beforeImage,
    afterImage,
  };
  zoom.failureCode = zoom.passed
    ? null
    : near(after.camera.scale, before.camera.scale)
      ? "ZOOM_DID_NOT_CHANGE_SCALE"
      : "ZOOM_ANCHOR_OR_TERRAIN_MISMATCH";
  if (after.state.error) zoom.error = after.state.error;
  if (!zoom.passed)
    return { zoom, pan: { passed: false, reason: "zoom prerequisite failed" } };
  const panBefore = await capture(session, `${prefix}-pan-before`, [
    [-300, -200],
  ]);
  const p = await position(page, [500, 500]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(p.x + 120, p.y, { steps: 12 });
  await page.mouse.up({ button: "middle" });
  await exact(page);
  const panned = await stateSnapshot(page);
  const panAfter = await capture(
    session,
    `${prefix}-pan-after`,
    [],
    panBefore.screenPoints,
  );
  const pan = {
    passed:
      near(panned.camera.x, after.camera.x - 120 / after.camera.scale) &&
      near(panned.camera.y, after.camera.y) &&
      near(panned.camera.scale, after.camera.scale) &&
      landPixel(panBefore.pixels[0]) &&
      waterPixel(panAfter.pixels[0]),
    beforeCamera: after.camera,
    afterCamera: panned.camera,
    beforeImage: panBefore,
    afterImage: panAfter,
  };
  return { zoom, pan };
}

/** Two genuine terrain changes must be visible while the same button remains held. */
export async function heldStroke(session, prefix = "held-stroke") {
  const { page } = session;
  await button(page, "Nahansicht");
  await page.getByLabel("Raster anzeigen").uncheck();
  // Functional land/water oracle, separate from the unchanged timed M03 path.
  // The explicit 10000 ft/s press dose already crosses the fixture's -100-ft
  // water baseline; each probe also receives a declared 300-ms held phase.
  await brush(page, 128, 10000);
  await exact(page);
  // Successive probes are farther apart than the complete brush support. A
  // first live dab cannot also satisfy the later moving-stroke pixel check.
  const points = [
    [-800, -600],
    [-800, 0],
    [-800, 400],
    [-800, 800],
  ];
  const probes = points.slice(0, 2);
  const before = await stateSnapshot(page, probes);
  const beforeImage = await capture(session, `${prefix}-before`, probes);
  const checkpoints = [];
  let failure;
  const start = await position(page, points[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    for (let i = 0; i < points.length; i++) {
      if (i) {
        const p = await position(page, points[i]);
        await page.mouse.move(p.x, p.y, { steps: 4 });
      }
      if (i < 2) {
        await page.waitForTimeout(300);
        const expected = await stateSnapshot(page, probes);
        let submitted = true;
        try {
          await page.waitForFunction(
            ({ revision, sinceEvent }) => {
              const o = window.atlasObserve([], { sinceEvent });
              if (o.state.error) throw new Error(o.state.error);
              return (
                o.document.active &&
                o.gesture &&
                o.events.some(
                  (e) => e.kind === "brush-submit" && e.revision >= revision,
                )
              );
            },
            {
              sinceEvent: before.eventCount ?? 0,
              revision: expected.document.revision,
            },
            { timeout: 1500 },
          );
        } catch {
          submitted = false;
        }
        const state = await stateSnapshot(page, probes);
        const image = await capture(session, `${prefix}-held-${i + 1}`, probes);
        checkpoints.push({ state, image, submitted });
      } else await page.waitForTimeout(40);
    }
  } catch (error) {
    failure = String(error);
  } finally {
    await page.mouse.up();
  }
  const completed = await observeStroke(session, before);
  if (completed.timedOut)
    failure ??= "Held stroke has no complete pointerup commit/submission";
  const after = await snapshot(page, probes, {
    sinceEvent: before.eventCount ?? 0,
  });
  const newInputs = after.events.filter(
    (e) =>
      e.kind === "input" &&
      e.id > inputCutoff(before) &&
      ["edit", "pointerup"].includes(e.inputKind),
  );
  const release = newInputs.find((e) => e.inputKind === "pointerup");
  const live = after.events.filter(
    (e) =>
      e.kind === "brush-submit" &&
      e.gestureId === completed.time.gestureId &&
      e.at < (release?.createdAt ?? -Infinity),
  );
  const samples = completed.samples;
  const exactLive = strokeEvidence(completed);
  const passed =
    !failure &&
    checkpoints.length === 2 &&
    waterPixel(checkpoints[0]?.image.pixels[1]) &&
    checkpoints.every(
      (c, i) =>
        c.submitted &&
        c.state.document.active &&
        c.state.gesture &&
        c.state.document.sequence === before.document.sequence &&
        c.state.samples[i] > 0 &&
        waterPixel(beforeImage.pixels[i]) &&
        landPixel(c.image.pixels[i]),
    ) &&
    newInputs.filter((e) => e.inputKind === "edit").length >= 4 &&
    new Set(live.map((event) => event.frame)).size >= 2 &&
    completed.time.passed &&
    completed.time.maximumFeedbackGapMs <= 100;
  const liveEvidence = {
    passed,
    failureCode: passed
      ? null
      : checkpoints.some(
            (c, i) =>
              c.state.document.active &&
              c.state.samples[i] > 0 &&
              waterPixel(c.image.pixels[i]),
          )
        ? "LIVE_TERRAIN_NOT_VISIBLE_BEFORE_RELEASE"
        : "LIVE_STROKE_EVIDENCE_INCOMPLETE",
    liveBeforeRelease: passed,
    firstLiveAt: live[0]?.at ?? null,
    releasedAt: release?.createdAt ?? null,
    checkedIntermediateStates: checkpoints.length,
    exactLive,
    time: completed.time,
    rateFtPerSecond: 10000,
    heldMsPerProbe: 300,
    checkpoints: checkpoints.map(({ state, image, submitted }) => ({
      submitted,
      image,
      height: state.samples,
      document: state.document,
      gesture: state.gesture,
    })),
    beforeImage,
    failure,
  };
  await button(page, /Rückgängig/);
  await exact(page);
  const undone = await stateSnapshot(page, probes);
  await button(page, /Wiederholen/);
  await exact(page);
  const redone = await stateSnapshot(page, probes);
  const undo = {
    passed:
      after.document.sequence === before.document.sequence + 1 &&
      after.document.historyActions === before.document.historyActions + 1 &&
      before.samples.every((v, i) => near(undone.samples[i], v, 1e-7)) &&
      after.samples.every((v, i) => near(redone.samples[i], v, 1e-7)),
    before: before.samples,
    after: after.samples,
    undone: undone.samples,
    redone: redone.samples,
  };
  // Return to the analytic fixture for the independent coarse-lift check.
  await button(page, /Rückgängig/);
  await exact(page);
  return {
    live: liveEvidence,
    undo,
    samples,
    actualFault: after.renderer.fault,
  };
}

/** Functional rate behavior; fixed native gestures, actual dose, images after Up. */
export async function brushDoseBehavior(session) {
  const { page } = session;
  await button(page, "Nahansicht");
  await page.getByLabel("Raster anzeigen").uncheck();
  const rateFtPerSecond = 1000;
  async function run(label, points, intervalMs) {
    await brush(page, 128, rateFtPerSecond);
    await exact(page);
    const edit = await movingStroke(session, points, { intervalMs });
    await exact(page);
    const after = await stateSnapshot(page, points);
    const probes = points.length === 1 ? points : [points[0], points.at(-1)];
    const changedImage = await capture(session, `${label}-changed`, probes);
    await button(page, /Rückgängig/);
    await exact(page);
    await page.waitForFunction(
      () => !window.atlasObserve([], { events: false }).state.writing,
    );
    const undone = await stateSnapshot(page, points);
    const undoneImage = await capture(session, `${label}-undone`, probes);
    const deltas = after.samples.map(
      (height, i) => height - edit.before.samples[i],
    );
    const pixelsChanged = changedImage.pixels.every(
      (pixel, i) =>
        pixel &&
        undoneImage.pixels[i] &&
        pixel
          .slice(0, 3)
          .some((channel, c) => channel !== undoneImage.pixels[i][c]),
    );
    return {
      label,
      requestedIntervalMs: intervalMs,
      rateFtPerSecond,
      points,
      before: edit.before.samples,
      after: after.samples,
      undone: undone.samples,
      deltas,
      time: edit.time,
      inputIds: edit.inputIds,
      samples: edit.samples,
      inputDiagnostics: evaluateSubmissionDiagnostics(edit.samples),
      changedImage,
      undoneImage,
      passed:
        !edit.timedOut &&
        edit.time.passed &&
        deltas.every((delta) => Number.isFinite(delta) && delta > 0) &&
        edit.before.samples.every((height, i) =>
          near(height, undone.samples[i], 1e-7),
        ) &&
        pixelsChanged,
      presentationProven: false,
    };
  }
  const point = [[-800, -600]];
  const short = await run("held-dose-500", point, 500);
  const long = await run("held-dose-1000", point, 1000);
  const doseRatio = long.time.acceptedDoseFt / short.time.acceptedDoseFt;
  const effectRatio = long.deltas[0] / short.deltas[0];
  const held = {
    passed:
      short.passed &&
      long.passed &&
      short.time.stationary &&
      long.time.stationary &&
      doseRatio > 1 &&
      effectRatio > 1 &&
      near(
        short.deltas[0] / short.time.acceptedDoseFt,
        long.deltas[0] / long.time.acceptedDoseFt,
        1e-7,
      ),
    requestedDurationRatio: 2,
    doseRatio,
    effectRatio,
    short,
    long,
    interpretation:
      "Longer responsive holding deepens terrain. Dose includes one declared nominal press; skipped feedback/capped time is not recovered.",
  };
  const path = [
    [-800, -600],
    [-680, -600],
    [-560, -600],
    [-440, -600],
  ];
  const fast = await run("move-dose-fast", path, 24);
  const slow = await run("move-dose-slow", path, 48);
  const total = (values) => values.reduce((sum, value) => sum + value, 0);
  const movement = {
    passed:
      fast.passed &&
      slow.passed &&
      slow.time.acceptedDoseFt > fast.time.acceptedDoseFt &&
      total(slow.deltas) > total(fast.deltas),
    fast,
    slow,
    interpretation:
      "The same path takes twice the nominal time; compare actual accepted dose and terrain effect, never a fabricated event-rate invariant.",
  };
  return { held, movement };
}

/** Ordinary native UI navigation; readiness is observed, never assigned by tests. */
export async function navigateTo(page, point) {
  const details = page.locator("details");
  if ((await details.getAttribute("open")) === null)
    await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page
    .getByLabel("Ziel X", { exact: true })
    .fill(String(point[0] * 0.3048));
  await page
    .getByLabel("Ziel Y", { exact: true })
    .fill(String(point[1] * 0.3048));
  const before = await stateSnapshot(page);
  await button(page, "Zum Ziel");
  const after = await snapshot(page, [], {
    sinceEvent: before.eventCount ?? 0,
  });
  const input = after.events.find(
    (e) =>
      e.kind === "input" &&
      e.inputKind === "navigation" &&
      e.id > inputCutoff(before),
  );
  if (!input) throw new Error("No genuine target-navigation input observed");
  return input;
}

/** Observe a complete real gesture, including its final commit submission. */
export async function observeStroke(session, before, timeout = 5000) {
  const { page } = session;
  const cutoff = inputCutoff(before);
  const sinceEvent = before.eventCount ?? 0;
  const deadline = performance.now() + timeout;
  const remaining = () => Math.max(1, deadline - performance.now());
  let timedOut = false;
  try {
    await page.waitForFunction(
      ({ cutoff, sinceEvent }) => {
        const o = window.atlasObserve([], { sinceEvent });
        if (o.state.error) throw new Error(o.state.error);
        // Inspect IDs locally until the gesture is fully submitted. Sending
        // the growing journal through Playwright before its last RAF blocks
        // that publication and measures observer serialization as brush work.
        const inputs = o.events.filter(
          (e) =>
            e.kind === "input" &&
            e.id > cutoff &&
            ["edit", "pointerup"].includes(e.inputKind),
        );
        return (
          ["edit", "pointerup"].every((kind) =>
            inputs.some((input) => input.inputKind === kind),
          ) &&
          inputs.every((input) => {
            const id = input.id;
            // Retain a processed input without inventing an edit or waiting five
            // seconds. Its reason, gesture context and live result decide validity.
            if (
              input &&
              o.events.some(
                (event) =>
                  event.kind === "noop" &&
                  event.input === id &&
                  (event.sessionId === undefined ||
                    event.sessionId === o.sessionId) &&
                  [input.createdAt, input.at, event.at].every(
                    Number.isFinite,
                  ) &&
                  input.createdAt <= input.at &&
                  input.at <= event.at,
              )
            )
              return true;
            const model = o.events.find(
              (e) =>
                e.sessionId === o.sessionId &&
                (input?.inputKind === "pointerup"
                  ? e.kind === "commit" && e.input === id
                  : e.kind === "brush-interval" &&
                    e.changed === true &&
                    e.inputIds.includes(id)),
            );
            return (
              model &&
              o.events.some(
                (edit) =>
                  (input?.inputKind === "pointerup"
                    ? edit.kind === "edit-submit" &&
                      edit.input === id &&
                      edit.sequence === model.sequence
                    : edit.kind === "brush-submit" &&
                      edit.intervalId === model.intervalId &&
                      edit.gestureId === model.gestureId) &&
                  edit.sessionId === o.sessionId &&
                  edit.revision === model.revision &&
                  o.events.some(
                    (frame) =>
                      frame.kind === "submit" &&
                      frame.frame === edit.frame &&
                      frame.sessionId === o.sessionId &&
                      frame.viewGeneration === edit.viewGeneration &&
                      frame.revision >= model.revision &&
                      frame.at >= (model.projectedAt ?? model.at),
                  ),
              )
            );
          })
        );
      },
      { cutoff, sinceEvent },
      { timeout: remaining() },
    );
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    timedOut = true;
  }
  const after = await snapshot(page, [], { sinceEvent });
  const inputs = after.events.filter(
    (e) =>
      e.kind === "input" &&
      e.id > cutoff &&
      ["edit", "pointerup"].includes(e.inputKind),
  );
  const inputIds = inputs.map((e) => e.id);
  return {
    before,
    after,
    inputIds,
    timedOut,
    missingInputKinds: ["edit", "pointerup"].filter(
      (kind) => !inputs.some((input) => input.inputKind === kind),
    ),
    // A processed no-op or missing result stays explicit. D10 discards are
    // evaluated as such; old exact frames or pointerup alone prove no progress.
    samples: extractEditSamples(after.events, inputIds, after.sessionId).map(
      (sample) => ({ ...sample, timeout: timedOut }),
    ),
    time: evaluateBrushTime(after.events, inputIds, after.sessionId),
  };
}

/** A measured multi-point stroke, retaining no-op and missing input results. */
export async function prepareStroke(session, points) {
  const { page } = session;
  const before = await stateSnapshot(page, points);
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Stroke canvas unavailable");
  // The camera is fixed throughout this gesture. Resolve coordinates before
  // input starts so reading a growing event log cannot pace the measured moves.
  const positions = points.map(([x, y]) => ({
    x:
      canvas.x + canvas.width / 2 + (x - before.camera.x) * before.camera.scale,
    y:
      canvas.y +
      canvas.height / 2 +
      (y - before.camera.y) * before.camera.scale,
  }));
  return { before, positions };
}

/** One fixed native gesture program, also dispatched inside observed save intervals. */
export function strokeInputs(positions, intervalMs = 24) {
  const points = positions.map(({ x, y }) => ({
    x: Math.round(x),
    y: Math.round(y),
  }));
  return [
    { delayMs: 0, event: { type: "mouseMove", ...points[0] } },
    {
      delayMs: 0,
      event: { type: "mouseDown", button: "left", clickCount: 1, ...points[0] },
    },
    ...points.slice(1).map((point) => ({
      delayMs: intervalMs,
      event: { type: "mouseMove", modifiers: ["leftButtonDown"], ...point },
    })),
    {
      delayMs: intervalMs,
      event: {
        type: "mouseUp",
        button: "left",
        clickCount: 1,
        ...points.at(-1),
      },
    },
  ];
}

export async function movingStroke(
  session,
  points,
  { intervalMs = 24, timeout = 5000 } = {},
) {
  const { before, positions } = await prepareStroke(session, points);
  await session.app.evaluate(
    async ({ BrowserWindow }, inputs) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      let released = false;
      try {
        for (const input of inputs) {
          if (input.delayMs)
            await new Promise((resolve) => setTimeout(resolve, input.delayMs));
          contents.sendInputEvent(input.event);
          if (input.event.type === "mouseUp") released = true;
        }
      } finally {
        if (!released) contents.sendInputEvent(inputs.at(-1).event);
      }
    },
    strokeInputs(positions, intervalMs),
  );
  return observeStroke(session, before, timeout);
}
