import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  extractEditSamples,
  evaluateAttempt,
  evaluateScenario,
  evaluateStrokeContent,
  extractColdSamples,
  evaluateDirectionContent,
  R4_REQUIREMENTS,
  directionPoints,
  directionProbes,
  STANDARD_HEIGHT_CASE,
} from "./atlas-p0-evaluate.mjs";
import { referenceHeightControls } from "./atlas-p0-brush-reference.mjs";
import {
  collectGpuTimers,
  installGpuTimers,
} from "./atlas-p0-graphics-probe.mjs";
import {
  snapshot,
  stateSnapshot,
  button,
  brush,
  exact,
  capture,
  landPixel,
  navigateTo,
  movingStroke,
  observeStroke,
  waitForSaveCompletion,
  storeActivityPosition,
  storeIntervalReference,
  strokeInputs,
  prepareStroke,
  sendStrokeInputs,
} from "./atlas-p0-interactions.mjs";

export { directionPoints, directionProbes };

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const near = (a, b) => finite(a) && finite(b) && Math.abs(a - b) < 1e-7;
const cutoff = (state) =>
  state.lastInputId ??
  Math.max(
    0,
    ...(state.events ?? []).filter((e) => e.kind === "input").map((e) => e.id),
  );
// Fixed 4000 ft/s (1219.2 m/s) makes endpoint changes visible above the
// actual raster/color quantization under bounded time-based painting. Geometry,
// existing input programs, latency gates and pixel checks stay unchanged; no warmup.
const specs = [
  {
    id: STANDARD_HEIGHT_CASE.id,
    kind: "edit",
    diameter: 512,
    amount: 20,
    standardHeight: true,
  },
  { id: "M03-height-small", kind: "edit", diameter: 16, amount: 4000 },
  { id: "M03-height-large", kind: "edit", diameter: 256, amount: 4000 },
  { id: "M03-height-max", kind: "edit", diameter: 512, amount: 4000 },
  {
    id: "M04-coarse-fine",
    kind: "edit",
    diameter: 64,
    amount: 4000,
    coarse: true,
  },
  {
    id: "M06-height-busy",
    kind: "edit",
    diameter: 16,
    amount: 4000,
    busy: true,
  },
  { id: "M10-height-cold", kind: "cold", diameter: 128, amount: 4000 },
  {
    id: "M10-height-cold-busy",
    kind: "cold",
    diameter: 128,
    amount: 4000,
    busy: true,
  },
];

async function waitForWrites(page) {
  await page.waitForFunction(
    () => {
      const state = window.atlasObserve([], { events: false }).state;
      if (state.error) throw new Error(state.error);
      return !state.writing;
    },
    null,
    { timeout: 5000 },
  );
}

async function background(session) {
  const before = await stateSnapshot(session.page);
  if (
    before.background.sessionId !== before.sessionId ||
    before.background.active !== true
  )
    await button(session.page, "Hintergrundarbeit starten");
  await session.page.waitForFunction(
    () => {
      const observed = window.atlasObserve([], { events: false });
      return (
        observed.background.sessionId === observed.sessionId &&
        observed.background.active === true &&
        Number.isFinite(observed.background.samples) &&
        observed.background.samples > 0
      );
    },
    null,
    { timeout: 5000 },
  );
}

function retainSamples(scenario, samples) {
  const known = new Set(
    scenario.samples.map((s) => `${s.sessionId}:${s.inputId}`),
  );
  for (const sample of samples) {
    const identity = `${sample.sessionId}:${sample.inputId}`;
    if (!known.has(identity)) {
      scenario.samples.push(sample);
      known.add(identity);
    }
  }
}

/** One post-stroke content/Undo check for warm and newly released cold edits. */
async function verifyStrokeContent(
  session,
  spec,
  record,
  points,
  before,
  after,
) {
  record.beforeHeight = before[0];
  record.afterHeight = after.samples[0];
  record.content = { points, before, after: after.samples };
  const probes = [points[0], points.at(-1)];
  // These observations occur only after the measured stroke has ended.
  record.changedImage = await capture(
    session,
    `${spec.id}-${record.attempt + 1}-changed`,
    probes,
  );
  await button(session.page, /Rückgängig/);
  await exact(session.page, 5000);
  await waitForWrites(session.page);
  const undone = await stateSnapshot(session.page, points);
  record.undoneHeight = undone.samples[0];
  if (!before.every((height, index) => near(undone.samples[index], height)))
    throw new Error("Undo did not restore the repeated stroke's source");
  record.undoneImage = await capture(
    session,
    `${spec.id}-${record.attempt + 1}-undone`,
    probes,
  );
  record.content.undone = undone.samples;
  const content = evaluateStrokeContent({
    ...record.content,
    changedPixels: record.changedImage.pixels,
    restoredPixels: record.undoneImage.pixels,
  });
  if (!content.passed)
    throw new Error(
      "Moving stroke did not change terrain pixels at both endpoints",
    );
}

async function collectWarm(context, session, spec, scenario) {
  const { page } = session;
  await navigateTo(page, [0, 0]);
  await page.getByText("Zu Koordinaten", { exact: true }).click();
  await button(page, spec.coarse ? "Regionsansicht" : "Nahansicht");
  await brush(page, spec.diameter, spec.amount);
  await exact(page, 5000);
  const points = spec.coarse
    ? [
        [-960, 0],
        [-320, 0],
        [320, 0],
        [960, 0],
      ]
    : spec.diameter === 512
      ? [
          [-1600, -300],
          [-1040, -300],
          [-480, -300],
          [80, -300],
        ]
      : spec.diameter === 256
        ? [
            [-800, -300],
            [-520, -300],
            [-240, -300],
            [40, -300],
          ]
        : [
            [-800, -300],
            [-680, -300],
            [-560, -300],
            [-440, -300],
          ];
  for (let attempt = 0; attempt < scenario.requestedAttempts; attempt++) {
    const record = { attempt, overlapRequired: Boolean(spec.busy) };
    scenario.attempts.push(record);
    let before;
    try {
      await waitForWrites(page);
      before = await stateSnapshot(page, points);
      if (!finite(before.samples[0])) throw new Error("Warm source is unknown");
      if (
        Math.hypot(
          points[0][0] - points.at(-1)[0],
          points[0][1] - points.at(-1)[1],
        ) <= before.brush.radius
      )
        throw new Error("Moving-stroke endpoint lies inside the initial brush");
      let edit;
      if (spec.busy) {
        await background(session);
        const overlap = await context.editDuringActualSave(session, points);
        record.saveAttempts = overlap.attempts.map(
          ({ samples, trigger, ...attempt }) => ({
            ...attempt,
            inputIds: (samples ?? []).map((sample) => sample.inputId),
            trigger: {
              dispatched: trigger.dispatched,
              reason: trigger.reason,
              startEvent: trigger.observedActive?.index,
            },
          }),
        );
        // Keep every dispatched input, even when the real overlap's stroke fails.
        for (const actual of overlap.attempts)
          retainSamples(scenario, actual.samples ?? []);
        record.overlapProven = overlap.passed;
        if (!overlap.edit)
          throw new Error("No stroke dispatched during real worker and save");
        edit = overlap.edit;
      } else edit = await movingStroke(session, points);
      retainSamples(scenario, edit.samples);
      record.inputIds = edit.samples.map((sample) => sample.inputId);
      record.sessionId = edit.after.sessionId;
      record.timedOut = edit.timedOut;
      record.time = edit.time;
      const after = await stateSnapshot(page, points);
      scenario.droppedEvents = after.droppedEvents;
      if (after.document.sequence !== before.document.sequence + 1)
        throw new Error("Moving stroke did not commit exactly one action");
      await verifyStrokeContent(
        session,
        spec,
        record,
        points,
        before.samples,
        after,
      );
      const evaluation = evaluateAttempt(record, edit.samples);
      if (!evaluation.passed) {
        record.error = evaluation.failures
          .map((issue) => issue.code)
          .join(", ");
        console.error(
          `[atlas-p0] ${session.instance.id}: attempt ${attempt + 1} FAIL: ${record.error}`,
        );
        if (context.purpose !== "acceptance") {
          scenario.aborted = true;
          break;
        }
      }
      if (
        (attempt + 1) % 10 === 0 ||
        attempt + 1 === scenario.requestedAttempts
      )
        console.log(
          `[atlas-p0] ${session.instance.id}: ${attempt + 1}/${scenario.requestedAttempts} strokes`,
        );
    } catch (error) {
      record.error = String(error);
      if (before) {
        try {
          const after = await snapshot(page, [], {
            sinceEvent: before.eventCount ?? 0,
          });
          record.observationRange = {
            from: before.eventCount ?? 0,
            to: after.eventCount,
          };
          const inputs = after.events.filter(
            (e) =>
              e.kind === "input" &&
              e.id > cutoff(before) &&
              ["edit", "pointerup"].includes(e.inputKind),
          );
          retainSamples(
            scenario,
            extractEditSamples(
              after.events,
              inputs.map((e) => e.id),
              after.sessionId,
            ),
          );
          scenario.droppedEvents = after.droppedEvents;
        } catch (observationError) {
          record.observationError = String(observationError);
        }
      }
      // An unsafe/incomplete path is not repeated until it looks green. Slow but
      // correct strokes above remain failed trials and still complete the series.
      scenario.aborted = true;
      break;
    }
  }
}

async function reopen(page) {
  const previous = (await stateSnapshot(page)).sessionId;
  await button(page, "Öffnen");
  await page.waitForFunction(
    (previous) =>
      window.atlasObserve([], { events: false }).sessionId !== previous,
    previous,
    { timeout: 5000 },
  );
  await exact(page, 5000);
}

async function prepareTarget(page, target) {
  if (
    (await page.locator("details.coordinate-menu").getAttribute("open")) ===
    null
  )
    await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page
    .getByLabel("Ziel X", { exact: true })
    .fill(String(target[0] * 0.3048));
  await page
    .getByLabel("Ziel Y", { exact: true })
    .fill(String(target[1] * 0.3048));
  const control = page.getByRole("button", { name: "Zum Ziel", exact: true });
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  if (!box) throw new Error("Target-navigation button is not visible");
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

async function navigateDuringSave(session, at) {
  const sinceEvent = await storeActivityPosition(session);
  const monitor = session.app.evaluate(
    async ({ BrowserWindow }, { at, sinceEvent }) => {
      let cursor = sinceEvent;
      const activity = [];
      const deadline = performance.now() + 1000;
      while (performance.now() < deadline) {
        const observed = globalThis.__atlasHost.storeActivity({
          sinceEvent: cursor,
        });
        if (observed.droppedEvents)
          throw new Error("Store activity events were dropped");
        activity.push(...observed.events);
        cursor = observed.eventCount;
        const active = activity.find(
          (event) =>
            event.phase === "start" &&
            !activity.some(
              (end) =>
                end.token === event.token &&
                end.kind === event.kind &&
                end.phase === "end",
            ),
        );
        if (active) {
          const contents = BrowserWindow.getAllWindows()[0].webContents;
          contents.sendInputEvent({ type: "mouseMove", ...at });
          contents.sendInputEvent({
            type: "mouseDown",
            button: "left",
            clickCount: 1,
            ...at,
          });
          contents.sendInputEvent({
            type: "mouseUp",
            button: "left",
            clickCount: 1,
            ...at,
          });
          return { dispatched: true, active, sinceEvent };
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      return { dispatched: false, sinceEvent };
    },
    { at, sinceEvent },
  );
  await button(session.page, "Speichern");
  return monitor;
}

/** Poll the real local gate; dispatch native input immediately, without a warmup. */
export function startReadyStrokeMonitor(
  session,
  {
    afterInputId,
    screenPoint,
    sessionId,
    point = /** @type {number[] | undefined} */ (undefined),
    probes = point ? [point] : [],
    sinceEvent = 0,
    inputProgram = /** @type {ReturnType<typeof strokeInputs> | undefined} */ (
      undefined
    ),
  },
) {
  const inputs =
    inputProgram ??
    strokeInputs(
      Array.from({ length: 5 }, (_, step) => ({
        x: screenPoint.x + step * 32,
        y: screenPoint.y + (step % 2) * 4,
      })),
    );
  return session.app.evaluate(
    async (
      { BrowserWindow },
      { sessionId, cutoff, inputs, probes, sinceEvent },
    ) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      const deadline = performance.now() + 5000;
      let cursor = sinceEvent,
        navigation,
        gate;
      while (performance.now() < deadline) {
        const read = `(() => {
          const o = window.atlasObserve(${JSON.stringify(probes)}, { sinceEvent: ${cursor} });
          return { sessionId:o.sessionId, error:o.state.error, events:o.events, eventCount:o.eventCount,
            droppedEvents:o.droppedEvents, background:o.background, readiness:o.readiness,
            beforeHeight:o.samples[0] ?? null, beforeHeights:o.samples };
        })()`;
        const { events, eventCount, ...observed } =
          await contents.executeJavaScript(read);
        cursor = eventCount;
        if (observed.droppedEvents)
          throw new Error("Observation events were dropped");
        navigation ??= events.find(
          (event) =>
            event.kind === "input" &&
            event.inputKind === "navigation" &&
            event.id > cutoff,
        );
        gate ??=
          navigation &&
          events.find(
            (event) =>
              event.kind === "input-ready" &&
              event.input === navigation.id &&
              event.sessionId === sessionId,
          );
        Object.assign(observed, { navigation, gate });
        if (observed.error)
          return { dispatched: false, error: observed.error, observed };
        sessionId ??= observed.sessionId;
        if (
          observed.sessionId === sessionId &&
          gate &&
          observed.readiness?.ready === true &&
          observed.readiness.viewGeneration === gate.viewGeneration &&
          observed.readiness.frame >= gate.frame
        ) {
          let released = false;
          try {
            for (const input of inputs) {
              if (input.delayMs)
                await new Promise((resolve) =>
                  setTimeout(resolve, input.delayMs),
                );
              contents.sendInputEvent(input.event);
              if (input.event.type === "mouseUp") released = true;
            }
          } finally {
            if (!released) contents.sendInputEvent(inputs.at(-1).event);
          }
          return { dispatched: true, navigation, gate, observed };
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      return { dispatched: false, timedOut: true };
    },
    { sessionId, cutoff: afterInputId, inputs, probes, sinceEvent },
  );
}

function matchingIntervals(activity, sessionId, timeOrigin, at, sinceEvent) {
  const epoch = timeOrigin + at;
  return activity
    .filter(
      (start) =>
        start.phase === "start" &&
        start.sessionId === sessionId &&
        start.index >= sinceEvent,
    )
    .flatMap((start) => {
      const end = activity.find(
        (e) =>
          e.phase === "end" &&
          e.token === start.token &&
          e.kind === start.kind &&
          e.success === true,
      );
      return end && epoch >= start.epochMs && epoch <= end.epochMs
        ? [storeIntervalReference({ start, end, epoch })]
        : [];
    });
}

async function collectCold(context, session, spec, scenario) {
  const { page } = session;
  const target = [79_200, 0];
  for (let attempt = 0; attempt < scenario.requestedAttempts; attempt++) {
    const record = {
      attempt,
      target,
      overlapRequired: Boolean(spec.busy),
      cacheReset: "ordinary-project-open",
    };
    scenario.attempts.push(record);
    let monitor, before;
    try {
      // Opening is not timed as navigation, and its initial origin is fully ready.
      // The stored target remains cold; no test API clears or declares cache state.
      await reopen(page);
      await brush(page, spec.diameter, spec.amount);
      await exact(page, 5000);
      // Starting the worker can scroll this sidebar. Resolve the native target
      // only after that setup, so its saved coordinates still hit the button.
      if (spec.busy) await background(session);
      const targetButton = await prepareTarget(page, target);
      record.navigationButton = targetButton;
      const box = await page.locator("canvas").boundingBox();
      if (!box) throw new Error("Canvas is not visible");
      const center = {
        x: Math.round(box.x + box.width / 2),
        y: Math.round(box.y + box.height / 2),
      };
      before = await stateSnapshot(page, [target]);
      const points = Array.from({ length: 5 }, (_, step) => [
        target[0] + (step * 32) / before.camera.scale,
        target[1] + ((step % 2) * 4) / before.camera.scale,
      ]);
      record.coldBeforeNavigation = before.samples[0] === null;
      if (!record.coldBeforeNavigation)
        throw new Error("Target is already warm before navigation");
      monitor = startReadyStrokeMonitor(session, {
        sessionId: before.sessionId,
        afterInputId: cutoff(before),
        sinceEvent: before.eventCount ?? 0,
        screenPoint: center,
        point: target,
        probes: points,
      });
      const navigationTrigger = spec.busy
        ? await navigateDuringSave(session, targetButton)
        : { dispatched: true, navigation: await navigateTo(page, target) };
      record.navigationTrigger = {
        dispatched: navigationTrigger.dispatched,
        startEvent: navigationTrigger.active?.index,
        sinceEvent: navigationTrigger.sinceEvent,
      };
      const trigger = await monitor;
      record.gateTrigger = {
        dispatched: trigger.dispatched,
        timedOut: trigger.timedOut,
        error: trigger.error,
        navigationId: trigger.navigation?.id,
      };
      if (!trigger.dispatched)
        throw new Error(
          `Cold first stroke was not dispatched: ${JSON.stringify(trigger)}`,
        );
      const observedStroke = await observeStroke(session, before, 5000);
      const { timedOut } = observedStroke;
      const samples = extractColdSamples(
        observedStroke.after.events,
        observedStroke.samples,
        {
          sessionId: before.sessionId,
          afterInputId: cutoff(before),
          coldBeforeNavigation: record.coldBeforeNavigation,
        },
      );
      retainSamples(scenario, samples);
      record.inputIds = samples.map((sample) => sample.inputId);
      record.sessionId = observedStroke.after.sessionId;
      const after = await stateSnapshot(page, points);
      scenario.droppedEvents = after.droppedEvents;
      const first = samples.find((s) => s.inputKind === "edit");
      const navigation = trigger.observed?.navigation;
      if (first) {
        record.gateToInputMs = finite(first.gateAt)
          ? first.createdAt - first.gateAt
          : null;
        record.readyToInputMs = null;
      }
      record.timedOut = timedOut;
      record.time = observedStroke.time;
      record.beforeHeightExpected = -20;
      record.beforeHeightObserved = trigger.observed?.beforeHeight ?? null;
      record.afterHeight = after.samples[0];
      if (!navigationTrigger.dispatched || !trigger.dispatched || !first)
        throw new Error(
          "Cold target did not produce the required first moving stroke",
        );
      if (!near(record.beforeHeightObserved, -20) || !(after.samples[0] > 0))
        throw new Error(
          "Cold edit did not raise the expected sea point to land",
        );
      if (after.document.sequence !== before.document.sequence + 1)
        throw new Error("Cold stroke did not commit exactly one action");
      await verifyStrokeContent(
        session,
        spec,
        record,
        points,
        trigger.observed.beforeHeights,
        after,
      );
      if (!landPixel(record.changedImage.pixels[0]))
        throw new Error("Cold edited terrain is not visibly land");
      if (spec.busy) {
        // The overlap is decided from the original input timestamps. Waiting
        // here only establishes that the already observed save interval ended
        // successfully; a large real snapshot may outlast the first stroke.
        const activity = await waitForSaveCompletion(
          session,
          navigationTrigger.active,
        );
        record.storeRange = {
          from: activity[0]?.index,
          to: (activity.at(-1)?.index ?? -1) + 1,
        };
        record.navigationSaveIntervals = matchingIntervals(
          activity,
          after.sessionId,
          after.timeOrigin,
          navigation.createdAt,
          navigationTrigger.sinceEvent,
        );
        record.editSaveIntervals = matchingIntervals(
          activity,
          after.sessionId,
          after.timeOrigin,
          first.createdAt,
          navigationTrigger.sinceEvent,
        );
        record.workerBefore = before.background;
        record.workerAtInput = trigger.observed.background;
        record.workerAfter = after.background;
        // Finishing naturally during the stroke is allowed. The current job
        // must be active at its start and must demonstrably make progress.
        if (
          !record.navigationSaveIntervals.length ||
          !record.editSaveIntervals.length ||
          before.background.sessionId !== after.sessionId ||
          trigger.observed.background.sessionId !== after.sessionId ||
          after.background.sessionId !== after.sessionId ||
          before.background.active !== true ||
          trigger.observed.background.active !== true ||
          !finite(before.background.samples) ||
          before.background.samples <= 0 ||
          !finite(after.background.samples) ||
          after.background.samples <= before.background.samples
        )
          throw new Error(
            "Cold navigation/first edit did not both overlap real save and active worker",
          );
        record.overlapProven = true;
      }
      const evaluation = evaluateAttempt(record, samples);
      if (!evaluation.passed) {
        record.error = evaluation.failures
          .map((issue) => issue.code)
          .join(", ");
        if (context.purpose !== "acceptance") {
          scenario.aborted = true;
          break;
        }
      }
      if (
        (attempt + 1) % 10 === 0 ||
        attempt + 1 === scenario.requestedAttempts
      )
        console.log(
          `[atlas-p0] ${session.instance.id}: ${attempt + 1}/${scenario.requestedAttempts} cold switches`,
        );
    } catch (error) {
      if (monitor) await monitor.catch(() => {});
      record.error = String(error);
      if (before) {
        try {
          const after = await snapshot(page, [], {
            sinceEvent: before.eventCount ?? 0,
          });
          record.observationRange = {
            from: before.eventCount ?? 0,
            to: after.eventCount,
          };
          const inputs = after.events.filter(
            (e) =>
              e.kind === "input" &&
              e.id > cutoff(before) &&
              ["edit", "pointerup"].includes(e.inputKind),
          );
          // Preserve the first observation, including any timeout/missing
          // submission. A later error snapshot must not heal that failed trial.
          const observedSamples = extractEditSamples(
            after.events,
            inputs.map((e) => e.id),
            after.sessionId,
          );
          record.inputIds ??= observedSamples.map((sample) => sample.inputId);
          record.sessionId ??= after.sessionId;
          retainSamples(
            scenario,
            extractColdSamples(after.events, observedSamples, {
              sessionId: after.sessionId,
              afterInputId: cutoff(before),
              coldBeforeNavigation: record.coldBeforeNavigation,
            }),
          );
          scenario.droppedEvents = after.droppedEvents;
        } catch (observationError) {
          record.observationError = String(observationError);
        }
      }
      scenario.aborted = true;
      break;
    }
  }
}

/** Separate, untimed D11 cases. They cannot rescue or warm a measured trial. */
async function collectBlockedInputs(session, spec) {
  const cases = [];
  const target = [79_200, 0];
  for (const holdUntilReady of [false, true]) {
    const record = { holdUntilReady };
    cases.push(record);
    try {
      await reopen(session.page);
      await brush(session.page, spec.diameter, spec.amount);
      await exact(session.page, 5000);
      const navigationPoint = await prepareTarget(session.page, target);
      const box = await session.page.locator("canvas").boundingBox();
      if (!box) throw new Error("Blocked-input canvas unavailable");
      const screen = {
        x: Math.round(box.x + box.width / 2),
        y: Math.round(box.y + box.height / 2),
      };
      const before = await stateSnapshot(session.page, [target]);
      if (before.samples[0] !== null)
        throw new Error("Blocked-input target is already warm");
      const observed = await session.app.evaluate(
        async ({ BrowserWindow }, args) => {
          const contents = BrowserWindow.getAllWindows()[0].webContents;
          const events = [];
          let cursor = args.sinceEvent;
          const read = async () => {
            const observed = await contents.executeJavaScript(`(() => {
              const o = window.atlasObserve(${JSON.stringify([args.target])}, { sinceEvent: ${cursor} });
              const status = document.querySelector('.map-status');
              const rect = status?.getBoundingClientRect();
              const style = status && getComputedStyle(status);
              return { observedAt:performance.now(), sessionId:o.sessionId, document:o.document, readiness:o.readiness,
                needsPress:o.state.needsPress, error:o.state.error, samples:o.samples,
                statusText:status?.textContent ?? '',
                statusVisible:!!rect && rect.width > 0 && rect.height > 0 &&
                  style.display !== 'none' && style.visibility !== 'hidden',
                events:o.events, eventCount:o.eventCount, droppedEvents:o.droppedEvents };
            })()`);
            if (observed.error) throw new Error(observed.error);
            if (observed.droppedEvents)
              throw new Error("Observation events were dropped");
            events.push(...observed.events);
            cursor = observed.eventCount;
            const { events: _events, ...state } = observed;
            return state;
          };
          const send = (type, point, extra = {}) =>
            contents.sendInputEvent({ type, ...point, ...extra });
          let released = false;
          try {
            send("mouseMove", args.navigationPoint);
            send("mouseDown", args.navigationPoint, {
              button: "left",
              clickCount: 1,
            });
            send("mouseUp", args.navigationPoint, {
              button: "left",
              clickCount: 1,
            });
            // The first press deliberately precedes local data/terrain. All
            // events still use the ordinary native path, including held moves.
            send("mouseMove", args.screen);
            send("mouseDown", args.screen, { button: "left", clickCount: 1 });
            send(
              "mouseMove",
              { x: args.screen.x + 1, y: args.screen.y },
              { modifiers: ["leftButtonDown"] },
            );
            send("mouseMove", args.screen, { modifiers: ["leftButtonDown"] });
            if (!args.holdUntilReady) {
              send("mouseUp", args.screen, { button: "left", clickCount: 1 });
              released = true;
            }
            const deadline = performance.now() + 5000;
            let waiting, gate, ready, heldHint, releasedAt;
            while (performance.now() < deadline) {
              const current = await read();
              const down = events.find(
                (event) =>
                  event.kind === "input" && event.eventType === "pointerdown",
              );
              if (
                down &&
                current.readiness?.ready === false &&
                current.statusVisible &&
                /geladen|lädt/i.test(current.statusText)
              )
                waiting ??= current;
              gate ??= events.find(
                (event) =>
                  event.kind === "input-ready" &&
                  event.sessionId === args.sessionId,
              );
              if (gate && current.readiness?.ready === true) {
                ready ??= current;
                // Readiness may precede React's status commit. Keep holding
                // until the actual visible recovery hint has been observed.
                if (
                  !released &&
                  current.needsPress === true &&
                  current.statusVisible &&
                  current.statusText.includes(
                    "Zum Bearbeiten loslassen und erneut drücken",
                  )
                )
                  heldHint ??= current;
                const afterGate = events.filter(
                  (event) => event.kind === "frame" && event.at > gate.at,
                ).length;
                if (afterGate >= 2 && !released && heldHint) {
                  send("mouseUp", args.screen, {
                    button: "left",
                    clickCount: 1,
                  });
                  released = true;
                  releasedAt = events.at(-1)?.at;
                }
                const release = events.find(
                  (event) =>
                    event.kind === "input" && event.inputKind === "pointerup",
                );
                if (
                  released &&
                  release &&
                  events.filter(
                    (event) =>
                      event.kind === "frame" &&
                      event.at > Math.max(gate.at, release.at, releasedAt ?? 0),
                  ).length >= 2
                )
                  return {
                    waiting,
                    ready,
                    heldHint,
                    settled: current,
                    gateAt: gate.at,
                    events,
                  };
              }
              await new Promise((resolve) => setTimeout(resolve, 1));
            }
            throw new Error("Blocked-input readiness/release timed out");
          } finally {
            if (!released)
              send("mouseUp", args.screen, { button: "left", clickCount: 1 });
          }
        },
        {
          navigationPoint,
          screen,
          target,
          holdUntilReady,
          sessionId: before.sessionId,
          sinceEvent: before.eventCount,
        },
      );
      const compact = (state) =>
        state && {
          observedAt: state.observedAt,
          sessionId: state.sessionId,
          document: Object.fromEntries(
            [
              "revision",
              "sequence",
              "historyActions",
              "canUndo",
              "canRedo",
              "active",
            ].map((key) => [key, state.document[key]]),
          ),
          readiness: state.readiness,
          needsPress: state.needsPress,
          statusText: state.statusText,
          statusVisible: state.statusVisible,
        };
      const inputIds = observed.events
        .filter(
          (event) =>
            event.kind === "input" &&
            ["edit", "pointerup"].includes(event.inputKind),
        )
        .map((event) => event.id);
      Object.assign(record, {
        before: compact(before),
        waiting: compact(observed.waiting),
        ready: compact(observed.ready),
        heldHint: compact(observed.heldHint),
        settled: compact(observed.settled),
        gateAt: observed.gateAt,
        samples: extractEditSamples(
          observed.events,
          inputIds,
          before.sessionId,
        ),
        mutationEvents: observed.events.filter((event) =>
          ["brush-start", "brush-interval", "commit", "persisted"].includes(
            event.kind,
          ),
        ),
      });
      // This new deliberate press belongs only to the rejection/recovery case.
      const recovery = await movingStroke(session, [target]);
      const after = await stateSnapshot(session.page, [target]);
      const first = recovery.samples.find(
        (sample) => sample.inputKind === "edit",
      );
      record.recovery = {
        timePassed: recovery.time.passed,
        eventType: first?.eventType,
        createdAt: first?.createdAt,
        modelAt: first?.modelAt,
        heightBefore: observed.settled.samples[0],
        heightAfter: after.samples[0],
        sequenceAfter: after.document.sequence,
        historyAfter: after.document.historyActions,
      };
    } catch (error) {
      record.error = String(error);
    }
  }
  return { cases };
}

/** The ordinary 512-pixel hold, exercised through real visible controls. */
export async function collectStandardHeight(session, scenario = {}) {
  const { page } = session;
  await button(page, "Neu");
  await exact(page);
  await brush(
    page,
    STANDARD_HEIGHT_CASE.diameter,
    STANDARD_HEIGHT_CASE.rateFtPerSecond,
  );
  await page.getByLabel("Raster anzeigen").uncheck();
  await exact(page);
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Standard-height canvas unavailable");
  await page.mouse.move(
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2,
  );
  await page.waitForFunction(() => {
    const o = window.atlasObserve([], { events: false });
    if (o.state.error) throw new Error(o.state.error);
    return o.readiness.ready && !o.document.active;
  });
  const pointer = (await stateSnapshot(page)).pointer;
  const points = [
    pointer,
    [pointer[0] - 512, pointer[1]],
    [pointer[0] + 512, pointer[1]],
    [pointer[0], pointer[1] - 512],
    [pointer[0], pointer[1] + 512],
  ];
  const controls = referenceHeightControls(points, 4);
  await page.evaluate(
    (points) => window.atlasContentProbes({ level: 4, points }),
    controls,
  );
  const before = await stateSnapshot(page, points);
  const evidence = {
    points,
    controls,
    before,
    softwareRendering:
      typeof session.instance?.gpu?.renderer === "string"
        ? /swiftshader|llvmpipe|software/i.test(session.instance.gpu.renderer)
        : null,
    input: null,
    events: [],
    droppedEvents: 0,
    sixSecondImage: null,
    finalImage: null,
    undone: null,
  };
  scenario.standardHeight = evidence;
  let pressed = false;
  let timer;
  try {
    timer = await installGpuTimers(page, true, { coverage: "terrain-packets" });
    await page.mouse.down();
    pressed = true;
    const press = await page.evaluate(
      (sinceEvent) =>
        window
          .atlasObserve([], { sinceEvent })
          .events.find((event) => event.kind === "brush-start"),
      before.eventCount,
    );
    if (!press) throw new Error("Standard-height pointerdown was not admitted");
    const waitUntil = async (elapsed) => {
      const now = await page.evaluate(() => performance.now());
      await page.waitForTimeout(Math.max(0, press.inputAt + elapsed - now));
    };
    // Begin early enough that the independent capture itself completes within
    // the six-second deadline. Content must already be visible, not fabricated
    // from document values or a later post-Up image.
    await waitUntil(5800);
    evidence.sixSecondImage = await capture(
      session,
      "standard-height-six-seconds",
      [points[0]],
    );
    evidence.sixSecondImage.capturedAt = await page.evaluate(() =>
      performance.now(),
    );
    await waitUntil(10_025);
    await page.mouse.up();
    pressed = false;
    await page.waitForFunction(
      () => {
        const o = window.atlasObserve([], { events: false });
        if (o.state.error) throw new Error(o.state.error);
        return (
          !o.document.active &&
          !o.document.finishing &&
          !o.state.loading &&
          o.renderer.submittedRevision === o.document.revision &&
          o.renderer.lastCompletedFrame === o.renderer.lastSubmittedFrame &&
          o.renderer.lastCompletedViewGeneration === o.renderer.viewGeneration
        );
      },
      null,
      { timeout: 30_000 },
    );
    evidence.finalImage = await capture(
      session,
      "standard-height-ten-seconds",
      points,
    );
    const after = await snapshot(page, points, {
      sinceEvent: before.eventCount,
    });
    const ends = after.events.filter(
      (event) =>
        event.kind === "brush-end" && event.gestureId === press.gestureId,
    );
    const end = ends[0];
    if (ends.length !== 1)
      throw new Error("Standard-height release evidence missing");
    scenario.durationMs = end.inputAt - press.inputAt;
    // A single physical Down -> Up program. Its uncapped reference is independent
    // of the candidate's RAF cadence, discarded time and admission accounting.
    evidence.input = {
      brush: { level: 4, radius: 1024, amount: 20 },
      start: { point: press.point, at: press.inputAt, input: press.input },
      windows: [
        {
          at: end.endAt,
          points: [{ point: press.point, at: end.inputAt, input: end.input }],
          end: true,
        },
      ],
    };
    evidence.after = {
      samples: after.samples,
      document: after.document,
      state: after.state,
    };
    evidence.events = after.events;
    evidence.droppedEvents = after.droppedEvents;
    scenario.samples = extractEditSamples(
      after.events,
      [press.input, end.input],
      before.sessionId,
    );
    scenario.droppedEvents = after.droppedEvents;
    if (timer.enabled) {
      const gpu = await collectGpuTimers(page);
      const { observation: _observation, ...gpuTimers } = gpu;
      evidence.gpuTimers = gpuTimers;
      timer = null;
    } else evidence.gpuTimers = timer;
    await button(page, /Rückgängig/);
    await exact(page);
    evidence.undone = (await stateSnapshot(page, points)).samples;
    scenario.attempts = [{ attempt: 0, inputIds: [press.input, end.input] }];
  } finally {
    if (pressed) await page.mouse.up().catch(() => {});
    if (!evidence.events.length) {
      const after = await snapshot(page, points, {
        sinceEvent: before.eventCount,
      });
      evidence.events = after.events;
      evidence.droppedEvents = after.droppedEvents;
    }
    // Timer instrumentation is ordinary diagnostic observation. Dispose through
    // its existing lifecycle, even if the measured gesture failed.
    if (timer?.enabled) await collectGpuTimers(page).catch(() => {});
  }
  return evidence;
}

/** Collect edit/cold cases, optionally one diagnostic case. M01 belongs to its runner. */
export async function collectRepeatedScenarios(context) {
  const selectedSpecs =
    context.scenarioId === undefined
      ? specs
      : specs.filter((spec) => spec.id === context.scenarioId);
  if (!selectedSpecs.length)
    throw new Error(
      `Unknown collection scenario: ${context.scenarioId}; expected one of ${specs.map((spec) => spec.id).join(", ")}`,
    );
  const result = {
    independentRunId: context.independentRunId,
    passed: false,
    completed: [],
    errors: [],
  };
  for (const spec of selectedSpecs) {
    await context.beforeScenario?.(spec.id);
    const scenario = {
      id: spec.id,
      kind: spec.kind,
      brush: {
        diameterPx: spec.diameter,
        rateFtPerSecond: spec.amount,
        rateMetersPerSecond: spec.amount * 0.3048,
      },
      samples: [],
      droppedEvents: 0,
      requestedAttempts: spec.standardHeight
        ? 1
        : context.purpose === "acceptance"
          ? spec.kind === "cold"
            ? 34
            : 100
          : 1,
      purpose: context.purpose ?? "probe",
      readinessContract: "D11-local-terrain-submit-v1",
      attempts: [],
      aborted: false,
    };
    let session;
    try {
      const label = `${context.independentRunId}-${spec.id}`;
      const file = join(context.out, `${label}.saltatlas`);
      const source =
        spec.busy && context.fixture.busy?.file
          ? context.fixture.busy
          : context.fixture.coast;
      scenario.fixture = source;
      await copyFile(source.file ?? context.fixture.files.coast, file);
      session = await context.launch(file, spec.id);
      session.instance.independentRunId = context.independentRunId;
      session.instance.role = "scenario";
      session.instance.scenarios.push(scenario);
      await exact(session.page, 5000);
      await session.page.getByLabel("Raster anzeigen").uncheck();
      if (spec.standardHeight) {
        await collectStandardHeight(session, scenario);
      } else if (spec.kind === "cold") {
        await collectCold(context, session, spec, scenario);
        scenario.blockedInputs = await collectBlockedInputs(session, spec);
      } else await collectWarm(context, session, spec, scenario);
    } catch (error) {
      scenario.error = String(error);
      scenario.aborted = true;
    } finally {
      if (session) {
        try {
          await session.close();
        } catch (error) {
          scenario.error = String(error);
          scenario.aborted = true;
        }
      }
    }
    scenario.evaluation = evaluateScenario(scenario);
    const resultFile = join(
      session?.directory ?? context.out,
      `${spec.id}-result.json`,
    );
    await writeFile(resultFile, JSON.stringify(scenario, null, 2));
    result.completed.push({
      id: spec.id,
      resultFile,
      status: scenario.evaluation.status,
    });
    await context.onScenario?.(scenario, resultFile);
    if (scenario.evaluation.status !== "PROXY_ONLY")
      result.errors.push({
        scenario: spec.id,
        requested: scenario.requestedAttempts,
        attempted: scenario.attempts.length,
        error:
          scenario.error ??
          (scenario.aborted
            ? scenario.attempts.at(-1)?.error
            : scenario.attempts.find((a) => a.error)?.error) ??
          scenario.evaluation.failures[0]?.code ??
          "Collection incomplete",
        failedAttempts: scenario.attempts
          .filter((attempt) =>
            scenario.evaluation.failures.some(
              (issue) => issue.attempt === attempt.attempt,
            ),
          )
          .map(({ attempt, error }) => ({ attempt, error })),
      });
    if (context.purpose !== "acceptance" && result.errors.length) break;
  }
  result.missing = selectedSpecs
    .filter((spec) => !result.completed.some((entry) => entry.id === spec.id))
    .map((spec) => spec.id);
  result.passed = result.errors.length === 0 && result.missing.length === 0;
  return result;
}

/** Convert observed raw C1 facts; no candidate effect is used as its own reference. */
export function directionContent(edit, manifest, before, after, undone) {
  const events = edit.after.events;
  const own = (event) =>
    event.sessionId === edit.after.sessionId &&
    event.gestureId === edit.time.gestureId;
  const admissions = events.filter(
    (event) => event.kind === "brush-accepted" && own(event),
  );
  const checkpoints = events.filter(
    (event) =>
      event.kind === "brush-content" &&
      event.phase === "admission" &&
      own(event),
  );
  const original = manifest.probes.map(
    (_, index) =>
      checkpoints.find((checkpoint) => finite(checkpoint.before?.[index]))
        ?.before[index] ??
      before?.authors[index] ??
      null,
  );
  const complete = events.findLast(
    (event) =>
      event.kind === "brush-content" &&
      event.phase === "complete" &&
      own(event),
  );
  const content = {
    input: edit.time.inputManifest,
    ...manifest,
    before: original,
    after: complete?.authors ?? after?.authors ?? [],
    undone: undone?.authors ?? [],
    checkpoints,
  };
  return { content, admissions };
}

async function directionCamera(page, scale) {
  await navigateTo(page, [0, 0]);
  await button(page, scale === 0.000002 ? "Weltansicht" : "Nahansicht");
  for (let step = 0; step < 20; step++) {
    const observed = await stateSnapshot(page);
    if (Math.abs(Math.log(observed.camera.scale / scale)) < 1e-8) return;
    const canvas = await page.locator("canvas").boundingBox();
    if (!canvas) throw new Error("R4 canvas unavailable");
    await page.mouse.move(
      canvas.x + canvas.width / 2,
      canvas.y + canvas.height / 2,
    );
    const delta = Math.max(
      -500,
      Math.min(500, -Math.log(scale / observed.camera.scale) / 0.0018),
    );
    await page.mouse.wheel(0, delta);
    await page.waitForFunction(
      (prior) =>
        window.atlasObserve([], { events: false }).camera.scale !== prior,
      observed.camera.scale,
    );
  }
  throw new Error("R4 scale did not reach its fixed target");
}

async function directionReady(page, point, path) {
  const prepared = await prepareStroke({ page }, [point]);
  await page.mouse.move(prepared.positions[0].x, prepared.positions[0].y);
  await page.waitForFunction(
    (path) => {
      const observed = window.atlasObserve([], {
        events: false,
        ...(path ? { readinessPath: path } : {}),
      });
      if (observed.state.error) throw new Error(observed.state.error);
      return (
        observed.readiness.ready &&
        !observed.document.active &&
        (!path || observed.pathReadiness.ready)
      );
    },
    path,
    { timeout: 5000 },
  );
}

async function directionGpuTimers(page) {
  // The process journal is retained once in run.events. Only query facts belong
  // in the per-gesture timer windows.
  const { observation: _observation, ...timers } = await collectGpuTimers(page);
  return timers;
}

/**
 * The R4 subset reuses the actual desktop/input/store paths, with fresh processes.
 * selectedSpecs only permits focused integration tests. The CLI always passes
 * the fixed matrix; omitted/undersampled cases still fail the central R4 gate.
 */
export async function collectDirectionScenarios(
  context,
  selectedSpecs = R4_REQUIREMENTS.scenarios,
) {
  const result = {
    independentRunId: context.independentRunId,
    passed: false,
    completed: [],
    errors: [],
    missing: [],
  };
  for (const spec of selectedSpecs) {
    await context.beforeScenario?.(spec.id);
    const scenario = {
      id: spec.id,
      kind: "edit",
      purpose: "direction",
      spec,
      requestedAttempts: spec.minGestures,
      attempts: [],
      samples: [],
      droppedEvents: 0,
      aborted: false,
    };
    let session;
    try {
      const fixture = await context.fixtureFor(spec);
      scenario.fixture = fixture;
      const file = join(
        context.out,
        `${context.independentRunId}-${spec.id}.saltatlas`,
      );
      await copyFile(fixture.file, file);
      session = await context.launch(file, spec.id);
      session.instance.scenarios.push(scenario);
      session.instance.gpuTimers = [];
      const { page } = session;
      await exact(page);
      await page.getByLabel("Raster anzeigen").uncheck();
      await directionCamera(page, spec.scale);
      await brush(page, spec.diameter, R4_REQUIREMENTS.rateFtPerSecond);
      const points = directionPoints(spec);
      await directionReady(page, points[0]);
      const selected = await stateSnapshot(page);
      if (
        selected.brush.level !== spec.level ||
        Math.abs(selected.camera.scale / spec.scale - 1) > 1e-6
      )
        throw new Error(
          "R4 actual author level/camera differs from fixed manifest",
        );
      scenario.observedBrush = selected.brush;
      scenario.observedCamera = selected.camera;
      for (let index = 0; index < spec.minGestures; index++) {
        const record = {
          attempt: index,
          overlapRequired: spec.transition === "save",
        };
        scenario.attempts.push(record);
        let timer;
        try {
          await waitForWrites(page);
          const firstReady = spec.transition === "navigation-first-ready";
          record.transition = { kind: spec.transition };
          if (firstReady) {
            await navigateTo(page, [40_000, 20_000]);
          } else if (spec.transition === "navigation") {
            await navigateTo(page, [4000, 2000]);
            record.transition.navigation = await navigateTo(page, [0, 0]);
          } else if (spec.transition === "level") {
            await brush(page, 16, R4_REQUIREMENTS.rateFtPerSecond);
            const previous = await stateSnapshot(page);
            record.transition.previousLevel = previous.brush.level;
            record.transition.before = previous;
            await brush(page, spec.diameter, R4_REQUIREMENTS.rateFtPerSecond);
          } else if (spec.transition === "undo") {
            await directionReady(page, points[0]);
            await movingStroke(session, points);
            record.transition.beforeUndo = (await stateSnapshot(page)).document;
            await button(page, /Rückgängig/);
          }
          if (!firstReady) await directionReady(page, points[0], points);
          const prepared = await prepareStroke(session, points);
          if (spec.transition === "level")
            record.transition.after = prepared.before;
          if (spec.transition === "undo")
            record.transition.afterUndo = prepared.before.document;
          const canvas = await page.locator("canvas").boundingBox();
          if (firstReady)
            prepared.positions = [
              {
                x: canvas.x + canvas.width / 2,
                y: canvas.y + canvas.height / 2,
              },
            ];
          const programCamera = firstReady
            ? { ...prepared.before.camera, x: 0, y: 0 }
            : prepared.before.camera;
          const actualPoints = prepared.positions.map(({ x, y }) => [
            programCamera.x +
              (Math.round(x) - canvas.x - canvas.width / 2) /
                prepared.before.camera.scale,
            programCamera.y +
              (Math.round(y) - canvas.y - canvas.height / 2) /
                prepared.before.camera.scale,
          ]);
          record.requestedPath = [...actualPoints, actualPoints.at(-1)];
          record.expectedInputCount = record.requestedPath.length;
          const manifest = directionProbes(actualPoints, spec.level);
          const before = await page.evaluate(
            ({ level, probes }) =>
              window.atlasContentProbes({ level, points: probes }),
            { level: spec.level, probes: manifest.probes },
          );
          record.observationRange = { from: prepared.before.eventCount };
          timer = await installGpuTimers(page, true, {
            coverage: "terrain-packets",
          });
          let edit;
          if (firstReady) {
            const measuredBefore = await stateSnapshot(page);
            const monitor = startReadyStrokeMonitor(session, {
              afterInputId: measuredBefore.lastInputId,
              sinceEvent: measuredBefore.eventCount,
              sessionId: measuredBefore.sessionId,
              screenPoint: prepared.positions[0],
              probes: [],
              inputProgram: strokeInputs(
                prepared.positions,
                R4_REQUIREMENTS.intervalMs,
              ),
            });
            record.transition.navigation = await navigateTo(page, [0, 0]);
            record.transition.readyTrigger = await monitor;
            if (!record.transition.readyTrigger.dispatched)
              throw new Error("R4 first ready local input was not dispatched");
            edit = await observeStroke(session, measuredBefore);
          } else if (spec.transition === "save") {
            const overlap = await context.editDuringActualSave(session, points);
            record.saveAttempts = overlap.attempts;
            record.overlapProven = overlap.passed;
            if (!overlap.edit)
              throw new Error("R4 could not dispatch during an actual save");
            edit = overlap.edit;
          } else {
            const intervalMs =
              spec.gesture === "hold"
                ? spec.minDurationMs
                : R4_REQUIREMENTS.intervalMs;
            const measuredBefore = await stateSnapshot(page);
            await sendStrokeInputs(
              session,
              strokeInputs(prepared.positions, intervalMs),
            );
            edit = await observeStroke(session, measuredBefore);
          }
          record.inputIds = edit.inputIds;
          record.sessionId = edit.after.sessionId;
          record.gestureId = edit.time.gestureId;
          record.time = edit.time;
          record.startedAt = edit.time.startAt;
          record.finishedAt = edit.time.completedAt;
          record.timedOut = edit.timedOut;
          record.observationRange.to = edit.after.eventCount;
          record.droppedEvents = edit.after.droppedEvents;
          retainSamples(scenario, edit.samples);
          scenario.droppedEvents = edit.after.droppedEvents;
          const after = await stateSnapshot(page);
          if (timer.enabled) {
            session.instance.gpuTimers.push(await directionGpuTimers(page));
            timer = null;
          } else session.instance.gpuTimers.push(timer);
          await button(page, /Rückgängig/);
          await directionReady(page, actualPoints[0]);
          await waitForWrites(page);
          const undone = await snapshot(page, [], {
            sinceEvent: edit.after.eventCount,
          });
          const undoSnapshot = undone.events.findLast(
            (event) =>
              event.kind === "brush-content" &&
              event.phase === "undo" &&
              event.sessionId === record.sessionId &&
              event.gestureId === record.gestureId,
          );
          const content = directionContent(
            edit,
            manifest,
            before,
            after.contentProbes,
            undoSnapshot ?? undone.contentProbes,
          );
          record.content = content.content;
          const evaluated = evaluateDirectionContent(
            record.content,
            content.admissions,
          );
          record.contentEvaluation = evaluated;
          if (
            evaluated.failures.length ||
            !edit.time.passed ||
            edit.timedOut ||
            (record.overlapRequired && !record.overlapProven)
          )
            throw new Error(
              `R4 stroke failed: ${[...new Set([...evaluated.failures.map((entry) => entry.code), ...edit.time.issues.map((entry) => entry.code), ...(edit.timedOut ? ["STROKE_TIMEOUT"] : []), ...(record.overlapRequired && !record.overlapProven ? ["SAVE_OVERLAP_UNPROVEN"] : [])])].join(", ")}`,
            );
          await page.evaluate(() => window.atlasContentProbes(null));
          console.log(
            `[atlas-p0] ${spec.id}: ${index + 1}/${spec.minGestures} R4 gestures`,
          );
        } catch (error) {
          record.error = String(error);
          scenario.aborted = true;
          throw error;
        } finally {
          if (timer?.enabled)
            session.instance.gpuTimers.push(
              await directionGpuTimers(page).catch((error) => ({
                enabled: true,
                error: String(error),
              })),
            );
        }
      }
    } catch (error) {
      scenario.error = String(error);
      scenario.aborted = true;
      result.errors.push({ scenario: spec.id, error: String(error) });
    } finally {
      if (session) {
        try {
          await session.close();
        } catch (error) {
          scenario.error = String(error);
          scenario.aborted = true;
          result.errors.push({ scenario: spec.id, error: String(error) });
        }
      }
    }
    scenario.evaluation = {
      status: scenario.aborted
        ? "FAIL"
        : scenario.attempts.some(
              (attempt) => attempt.contentEvaluation?.blockers?.length,
            )
          ? "BLOCKED"
          : "PROXY_ONLY",
      contentPassed:
        !scenario.aborted &&
        scenario.attempts.length === spec.minGestures &&
        scenario.attempts.every((attempt) => attempt.contentEvaluation?.passed),
    };
    const resultFile = join(
      session?.directory ?? context.out,
      `${spec.id}-result.json`,
    );
    await writeFile(resultFile, JSON.stringify(scenario, null, 2));
    result.completed.push({
      id: spec.id,
      resultFile,
      status: scenario.evaluation.status,
    });
    const continueCollection = await context.onScenario?.(scenario, resultFile);
    if (continueCollection === false) {
      result.decisiveFailure = spec.id;
      break;
    }
    if (result.errors.length) break;
  }
  result.missing = R4_REQUIREMENTS.scenarios
    .filter((spec) => !result.completed.some((entry) => entry.id === spec.id))
    .map((spec) => spec.id);
  result.passed = result.errors.length === 0 && result.missing.length === 0;
  return result;
}
