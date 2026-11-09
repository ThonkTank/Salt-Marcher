import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  extractEditSamples,
  strokeEvidence,
  evaluateScenario,
  evaluateStrokeContent,
  extractColdSamples,
  evaluateBlockedInput,
} from "./atlas-p0-evaluate.mjs";
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
} from "./atlas-p0-interactions.mjs";

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
  record.content.evaluation = evaluateStrokeContent({
    ...record.content,
    changedPixels: record.changedImage.pixels,
    restoredPixels: record.undoneImage.pixels,
  });
  if (!record.content.evaluation.passed)
    throw new Error(
      "Moving stroke did not change terrain pixels at both endpoints",
    );
}

async function collectWarm(context, session, spec, scenario) {
  const { page } = session;
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
    const record = { attempt, passed: false };
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
      record.stroke = strokeEvidence(edit);
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
      record.passed =
        record.stroke.passed &&
        record.time.passed &&
        (!spec.busy || record.overlapProven);
      if (!record.passed)
        record.error =
          spec.busy && !record.overlapProven
            ? "Input/model did not overlap a successful save and active worker"
            : !record.time.passed
              ? record.time.issues.map((issue) => issue.code).join(", ")
              : !record.stroke.complete
                ? "Moving stroke lacks complete input/submission evidence"
                : !record.stroke.continuity.passed
                  ? `Exact regional submission paused for ${record.stroke.continuity.maximumMovingStallMs} ms while movement continued`
                  : record.stroke.processedNoops
                    ? `${record.stroke.processedNoops} expected terrain edits were processed without a change`
                    : "Minimum live control failed: fewer than two distinct exact frames before release";
      if (!record.passed) {
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
  if ((await page.locator("details").getAttribute("open")) === null)
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
    point,
    probes = point ? [point] : [],
    sinceEvent = 0,
  },
) {
  const inputs = strokeInputs(
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
      passed: false,
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
      record.stroke = strokeEvidence({ samples, timedOut });
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
      }
      record.passed = record.stroke.passed && record.time.passed;
      if (!record.passed) {
        record.error = !record.time.passed
          ? record.time.issues.map((issue) => issue.code).join(", ")
          : "Cold released stroke failed the ordinary live criterion";
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
          [
            "brush-start",
            "brush-interval",
            "model",
            "commit",
            "persisted",
          ].includes(event.kind),
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
      record.evaluation = evaluateBlockedInput(record);
      record.passed = record.evaluation.passed;
    } catch (error) {
      record.error = String(error);
      record.passed = false;
    }
  }
  return { cases, passed: cases.every((record) => record.passed) };
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
      requestedAttempts:
        context.purpose === "acceptance"
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
      if (spec.kind === "cold") {
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
    scenario.collectionPassed =
      !scenario.aborted &&
      scenario.attempts.length === scenario.requestedAttempts &&
      scenario.attempts.every((a) => a.passed) &&
      (spec.kind !== "cold" || scenario.blockedInputs?.passed === true);
    scenario.evaluation = evaluateScenario(scenario);
    scenario.collectionPassed &&= scenario.evaluation.status !== "FAIL";
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
    if (!scenario.collectionPassed || scenario.evaluation.status === "FAIL")
      result.errors.push({
        scenario: spec.id,
        requested: scenario.requestedAttempts,
        attempted: scenario.attempts.length,
        error:
          scenario.error ??
          (scenario.aborted
            ? scenario.attempts.at(-1)?.error
            : scenario.attempts.find((a) => !a.passed)?.error) ??
          scenario.evaluation.failures[0]?.code ??
          "Collection incomplete",
        failedAttempts: scenario.attempts
          .filter((attempt) => !attempt.passed)
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
