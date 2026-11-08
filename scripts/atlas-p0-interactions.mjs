import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractEditSamples } from "./atlas-p0-evaluate.mjs";

export const snapshot = (page, points = [], options = {}) =>
  page.evaluate(({ points, options }) => window.atlasObserve(points, options), {
    points,
    options,
  });
export const stateSnapshot = (page, points = []) =>
  snapshot(page, points, { events: false });
export const button = (page, name) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).click();

/** Observe successful publication before starting another ordinary file action. */
export async function waitForSaveCompletion(session, start) {
  return session.app.evaluate(async (_electron, start) => {
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline) {
      const activity = globalThis.__atlasHost.storeActivity();
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

export async function brush(page, diameter, amountFeet) {
  await page.getByLabel("Pinselgröße", { exact: true }).fill(String(diameter));
  await page
    .getByLabel("Höhenänderung", { exact: true })
    .fill(String(amountFeet * 0.3048));
  await button(page, /Anheben/);
}
export async function exact(page, timeout = 20_000) {
  await page.waitForFunction(
    () => {
      const o = window.atlasObserve();
      const error =
        o.state.error ??
        document.querySelector('[role="alert"]')?.textContent?.trim();
      if (error) throw new Error(error);
      return (
        !o.state.loading &&
        o.events.some(
          (e) =>
            e.kind === "submit" &&
            e.sessionId === o.sessionId &&
            e.exactRevision === o.document.revision &&
            e.cameraGeneration === o.renderer.viewGeneration,
        )
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
  const rect = {
    x: Math.ceil(box.x),
    y: Math.ceil(box.y),
    width: Math.floor(box.width),
    height: Math.floor(box.height),
  };
  const samples =
    fixedPixels ??
    points.map(([x, y]) => ({
      x: Math.round(box.width / 2 + (x - state.camera.x) * state.camera.scale),
      y: Math.round(box.height / 2 + (y - state.camera.y) * state.camera.scale),
    }));
  const result = await session.app.evaluate(
    async ({ BrowserWindow }, { rect, samples }) => {
      const image =
        await BrowserWindow.getAllWindows()[0].webContents.capturePage(rect);
      const size = image.getSize(),
        bitmap = image.toBitmap();
      const pixels = samples.map(({ x, y }) => {
        if (x < 0 || y < 0 || x >= size.width || y >= size.height) return null;
        const i = (y * size.width + x) * 4;
        return [bitmap[i + 2], bitmap[i + 1], bitmap[i], bitmap[i + 3]];
      });
      return { size, pixels, png: image.toPNG().toString("base64") };
    },
    { rect, samples },
  );
  const bytes = Buffer.from(result.png, "base64");
  await writeFile(join(session.directory, `${name}.png`), bytes);
  return {
    file: `${session.instance.id}/${name}.png`,
    size: result.size,
    pixels: result.pixels,
    screenPoints: samples,
    points,
    camera: state.camera,
    revision: state.document.revision,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    method:
      "Electron capturePage outside timed interval; content evidence only",
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
  await brush(page, 128, 120);
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
        let submitted = true;
        try {
          await page.waitForFunction(
            ({ cutoff, revision, sinceEvent }) => {
              const o = window.atlasObserve([], { sinceEvent });
              if (o.state.error) throw new Error(o.state.error);
              return (
                o.document.active &&
                o.gesture &&
                !o.gesture.released &&
                o.events.some(
                  (e) =>
                    e.kind === "edit-submit" &&
                    e.input > cutoff &&
                    e.revision > revision,
                )
              );
            },
            {
              cutoff: inputCutoff(i ? checkpoints[i - 1].state : before),
              sinceEvent: before.eventCount ?? 0,
              revision: i
                ? checkpoints[i - 1].state.document.revision
                : before.document.revision,
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
  await exact(page);
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
      e.kind === "edit-submit" &&
      e.input > inputCutoff(before) &&
      e.at < (release?.createdAt ?? -Infinity),
  );
  const passed =
    !failure &&
    checkpoints.length === 2 &&
    waterPixel(checkpoints[0]?.image.pixels[1]) &&
    checkpoints.every(
      (c, i) =>
        c.submitted &&
        c.state.document.active &&
        c.state.gesture &&
        !c.state.gesture.released &&
        c.state.document.sequence === before.document.sequence &&
        c.state.samples[i] > 0 &&
        waterPixel(beforeImage.pixels[i]) &&
        landPixel(c.image.pixels[i]),
    ) &&
    newInputs.filter((e) => e.inputKind === "edit").length >= 4 &&
    live.length >= 2;
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
    samples: extractEditSamples(
      after.events,
      newInputs.map((e) => e.id),
      after.sessionId,
    ),
    actualFault: after.renderer.fault,
  };
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
        return ["edit", "pointerup"].every((kind) =>
          o.events.some(
            (e) => e.kind === "input" && e.id > cutoff && e.inputKind === kind,
          ),
        );
      },
      { cutoff, sinceEvent },
      { timeout: remaining() },
    );
    const early = await snapshot(page, [], { sinceEvent });
    const ids = early.events
      .filter(
        (e) =>
          e.kind === "input" &&
          e.id > cutoff &&
          ["edit", "pointerup"].includes(e.inputKind),
      )
      .map((e) => e.id);
    await page.waitForFunction(
      ({ ids, sinceEvent }) => {
        const o = window.atlasObserve([], { sinceEvent });
        if (o.state.error) throw new Error(o.state.error);
        return (
          ids.length > 0 &&
          ids.every((id) => {
            const model = o.events.find(
              (e) =>
                (e.kind === "model" || e.kind === "commit") && e.input === id,
            );
            return (
              model &&
              o.events.some(
                (edit) =>
                  edit.kind === "edit-submit" &&
                  edit.input === id &&
                  edit.sessionId === o.sessionId &&
                  edit.revision === model.revision &&
                  o.events.some(
                    (frame) =>
                      frame.kind === "submit" &&
                      frame.frame === edit.frame &&
                      frame.sessionId === o.sessionId &&
                      frame.at >= model.at,
                  ),
              )
            );
          })
        );
      },
      { ids, sinceEvent },
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
    // A no-op or missing submission stays in this set and fails the same gate;
    // neither a formerly exact frame nor pointerup alone completes the gesture.
    samples: extractEditSamples(after.events, inputIds, after.sessionId).map(
      (sample) => ({ ...sample, timeout: timedOut }),
    ),
  };
}

/** A measured multi-point stroke, retaining no-op and missing input results. */
export async function movingStroke(
  session,
  points,
  { intervalMs = 24, timeout = 5000 } = {},
) {
  const { page } = session;
  const before = await stateSnapshot(page);
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
  const p = positions[0];
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  try {
    for (const next of positions.slice(1)) {
      await page.waitForTimeout(intervalMs);
      await page.mouse.move(next.x, next.y);
    }
    await page.waitForTimeout(intervalMs);
  } finally {
    await page.mouse.up();
  }
  return observeStroke(session, before, timeout);
}
