import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { extractEditSamples } from "./atlas-p0-evaluate.mjs";
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
} from "./atlas-p0-interactions.mjs";

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const near = (a, b) => finite(a) && finite(b) && Math.abs(a - b) < 1e-7;
const cutoff = (state) =>
  state.lastInputId ??
  Math.max(
    0,
    ...(state.events ?? []).filter((e) => e.kind === "input").map((e) => e.id),
  );
const specs = [
  { id: "M03-height-small", kind: "edit", diameter: 16, amount: 10 },
  { id: "M03-height-large", kind: "edit", diameter: 256, amount: 40 },
  {
    id: "M04-coarse-fine",
    kind: "edit",
    diameter: 64,
    amount: 100,
    coarse: true,
  },
  { id: "M06-height-busy", kind: "edit", diameter: 16, amount: 10, busy: true },
  { id: "M10-height-cold", kind: "cold", diameter: 128, amount: 120 },
  {
    id: "M10-height-cold-busy",
    kind: "cold",
    diameter: 128,
    amount: 120,
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

function strokeEvidence(edit, requireBeforeRelease = true) {
  const live = edit.samples.filter((s) => s.inputKind === "edit");
  const up = edit.samples.filter((s) => s.inputKind === "pointerup");
  const releasedAt = up[0]?.createdAt;
  const beforeRelease = live.filter(
    (s) => finite(s.submissionAt) && s.submissionAt < releasedAt,
  );
  const complete =
    !edit.timedOut &&
    live.length >= 3 &&
    up.length === 1 &&
    edit.samples.every(
      (s) => finite(s.createdAt) && finite(s.modelAt) && finite(s.submissionAt),
    );
  return {
    complete,
    passed: complete && (!requireBeforeRelease || beforeRelease.length >= 2),
    liveInputs: live.length,
    pointerups: up.length,
    liveSubmissionsBeforeRelease: beforeRelease.length,
    releasedAt,
    timedOut: edit.timedOut,
  };
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
  for (let attempt = 0; attempt < 100; attempt++) {
    const record = { attempt, passed: false };
    scenario.attempts.push(record);
    let before;
    try {
      await waitForWrites(page);
      before = await stateSnapshot(page, [points[0]]);
      if (!finite(before.samples[0])) throw new Error("Warm source is unknown");
      let edit;
      if (spec.busy) {
        await background(session);
        const overlap = await context.editDuringActualSave(session, points[0]);
        record.saveAttempts = overlap.attempts;
        // Keep all dispatched attempts, including a failed overlap before a retry.
        for (const actual of overlap.attempts)
          retainSamples(scenario, actual.samples ?? []);
        if (!overlap.passed || !overlap.edit)
          throw new Error("No proven edit overlap with real worker and save");
        if (overlap.attempts.some((a) => a.samples?.length && !a.overlapProven))
          throw new Error(
            "A dispatched busy stroke lacked the required overlap",
          );
        edit = overlap.edit;
      } else edit = await movingStroke(session, points);
      retainSamples(scenario, edit.samples);
      record.stroke = strokeEvidence(edit);
      const after = await stateSnapshot(page, [points[0]]);
      scenario.droppedEvents = after.droppedEvents;
      record.beforeHeight = before.samples[0];
      record.afterHeight = after.samples[0];
      if (!record.stroke.complete || !(after.samples[0] > before.samples[0]))
        throw new Error(
          "Moving stroke lacks complete input/submission evidence or changed content",
        );
      if (after.document.sequence !== before.document.sequence + 1)
        throw new Error("Moving stroke did not commit exactly one action");
      // Undo is outside the measured stroke and prevents saturation/drifting fixtures.
      await button(page, /Rückgängig/);
      await exact(page, 5000);
      await waitForWrites(page);
      const undone = await stateSnapshot(page, [points[0]]);
      record.undoneHeight = undone.samples[0];
      if (!near(undone.samples[0], before.samples[0]))
        throw new Error("Undo did not restore the repeated stroke's source");
      record.passed = record.stroke.passed;
      if (!record.passed)
        record.error =
          "Exact terrain was not submitted at two intermediate points before release";
      if ((attempt + 1) % 10 === 0)
        console.log(
          `[atlas-p0] ${session.instance.id}: ${attempt + 1}/100 strokes`,
        );
    } catch (error) {
      record.error = String(error);
      if (before) {
        try {
          const after = await snapshot(page, [], {
            sinceEvent: before.eventCount ?? 0,
          });
          record.events = after.events;
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
  const previous = await session.app.evaluate(() =>
    globalThis.__atlasHost.storeActivity(),
  );
  const known = [...new Set(previous.map((e) => e.token))];
  const monitor = session.app.evaluate(
    async ({ BrowserWindow }, { at, known }) => {
      const deadline = performance.now() + 1000;
      while (performance.now() < deadline) {
        const activity = globalThis.__atlasHost.storeActivity();
        const active = activity.find(
          (event) =>
            event.phase === "start" &&
            !known.includes(event.token) &&
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
          return { dispatched: true, active, known };
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      return { dispatched: false, known };
    },
    { at, known },
  );
  await button(session.page, "Speichern");
  return monitor;
}

/** Poll only observations; dispatch ordinary native inputs at the first ready state. */
export function startReadyStrokeMonitor(
  session,
  { afterInputId, screenPoint, sessionId, point, sinceEvent = 0 },
) {
  return session.app.evaluate(
    async (
      { BrowserWindow },
      { sessionId, cutoff, center, point, sinceEvent },
    ) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      const deadline = performance.now() + 5000;
      const read = `(() => {
      const o = window.atlasObserve(${JSON.stringify(point ? [point] : [])}, ${JSON.stringify({ sinceEvent })});
      const navigation = o.events.find(e => e.kind === 'input' && e.inputKind === 'navigation' && e.id > ${cutoff});
      const ready = navigation && o.events.find(e => (e.kind === 'ready' || e.kind === 'input-ready') && e.input === navigation.id);
      return { sessionId:o.sessionId, error:o.state.error, navigation, ready, background:o.background,
        beforeHeight:o.samples[0] ?? null };
    })()`;
      while (performance.now() < deadline) {
        const observed = await contents.executeJavaScript(read);
        if (observed.error)
          return { dispatched: false, error: observed.error, observed };
        sessionId ??= observed.sessionId;
        if (observed.sessionId === sessionId && observed.ready) {
          contents.sendInputEvent({ type: "mouseMove", ...center });
          contents.sendInputEvent({
            type: "mouseDown",
            button: "left",
            clickCount: 1,
            ...center,
          });
          try {
            for (let step = 1; step <= 4; step++) {
              await new Promise((resolve) => setTimeout(resolve, 24));
              contents.sendInputEvent({
                type: "mouseMove",
                x: center.x + step * 32,
                y: center.y + (step % 2) * 4,
                modifiers: ["leftButtonDown"],
              });
            }
          } finally {
            contents.sendInputEvent({
              type: "mouseUp",
              button: "left",
              clickCount: 1,
              x: center.x + 128,
              y: center.y,
            });
          }
          return {
            dispatched: true,
            navigation: observed.navigation,
            ready: observed.ready,
            observed,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      return { dispatched: false, timedOut: true };
    },
    { sessionId, cutoff: afterInputId, center: screenPoint, point, sinceEvent },
  );
}

function matchingIntervals(activity, sessionId, timeOrigin, at, known) {
  const epoch = timeOrigin + at;
  return activity
    .filter(
      (start) =>
        start.phase === "start" &&
        start.sessionId === sessionId &&
        !known.includes(start.token),
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
        ? [{ start, end, epoch }]
        : [];
    });
}

async function collectCold(context, session, spec, scenario) {
  const { page } = session;
  const target = [79_200, 0];
  for (let attempt = 0; attempt < 34; attempt++) {
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
      record.coldBeforeNavigation = before.samples[0] === null;
      if (!record.coldBeforeNavigation)
        throw new Error("Target is already warm before navigation");
      monitor = startReadyStrokeMonitor(session, {
        sessionId: before.sessionId,
        afterInputId: cutoff(before),
        sinceEvent: before.eventCount ?? 0,
        screenPoint: center,
        point: target,
      });
      const navigationTrigger = spec.busy
        ? await navigateDuringSave(session, targetButton)
        : { dispatched: true, navigation: await navigateTo(page, target) };
      record.navigationTrigger = navigationTrigger;
      const trigger = await monitor;
      record.readyTrigger = trigger;
      if (!trigger.dispatched)
        throw new Error(
          `Cold first stroke was not dispatched: ${JSON.stringify(trigger)}`,
        );
      const observedStroke = await observeStroke(session, before, 5000);
      const { samples, timedOut } = observedStroke;
      record.samples = samples;
      const after = await stateSnapshot(page, [target]);
      scenario.droppedEvents = after.droppedEvents;
      const first = samples.find((s) => s.inputKind === "edit");
      const navigation = trigger.observed?.navigation;
      const ready = trigger.observed?.ready;
      if (first) {
        const coldSample = {
          ...first,
          navigationId: navigation?.id,
          navigationAt: navigation?.createdAt ?? null,
          readyAt: ready?.at ?? null,
          coldBeforeNavigation: record.coldBeforeNavigation,
          timeout: timedOut,
        };
        retainSamples(scenario, [coldSample]);
        record.readyToInputMs = finite(ready?.at)
          ? first.createdAt - ready.at
          : null;
      }
      // A cold first render is governed by M10's navigation budget, not the
      // warmed-up requirement to redraw each ordinary live stroke immediately.
      record.stroke = strokeEvidence({ samples, timedOut }, false);
      record.beforeHeightExpected = -20;
      record.beforeHeightObserved = trigger.observed?.beforeHeight ?? null;
      record.afterHeight = after.samples[0];
      if (
        !navigationTrigger.dispatched ||
        !trigger.dispatched ||
        !first ||
        !record.stroke.passed
      )
        throw new Error(
          "Cold target did not produce the required first moving stroke",
        );
      if (!near(record.beforeHeightObserved, -20) || !(after.samples[0] > 0))
        throw new Error(
          "Cold edit did not raise the expected sea point to land",
        );
      record.image = await capture(session, `${spec.id}-${attempt + 1}`, [
        target,
      ]);
      if (!landPixel(record.image.pixels[0]))
        throw new Error("Cold edited terrain is not visibly land");
      if (spec.busy) {
        // The overlap is decided from the original input timestamps. Waiting
        // here only establishes that the already observed save interval ended
        // successfully; a large real snapshot may outlast the first stroke.
        const activity = await waitForSaveCompletion(
          session,
          navigationTrigger.active,
        );
        record.activity = activity;
        record.navigationSaveIntervals = matchingIntervals(
          activity,
          after.sessionId,
          after.timeOrigin,
          navigation.createdAt,
          navigationTrigger.known,
        );
        record.editSaveIntervals = matchingIntervals(
          activity,
          after.sessionId,
          after.timeOrigin,
          first.createdAt,
          navigationTrigger.known,
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
      record.passed = true;
      if ((attempt + 1) % 10 === 0 || attempt === 33)
        console.log(
          `[atlas-p0] ${session.instance.id}: ${attempt + 1}/34 cold switches`,
        );
    } catch (error) {
      if (monitor) await monitor.catch(() => {});
      record.error = String(error);
      if (before) {
        try {
          const after = await snapshot(page, [], {
            sinceEvent: before.eventCount ?? 0,
          });
          record.events = after.events;
          const inputs = after.events.filter(
            (e) =>
              e.kind === "input" &&
              e.id > cutoff(before) &&
              ["edit", "pointerup"].includes(e.inputKind),
          );
          // Preserve the first observation, including any timeout/missing
          // submission. A later error snapshot must not heal that failed trial.
          record.samples ??= extractEditSamples(
            after.events,
            inputs.map((e) => e.id),
            after.sessionId,
          );
          const first = record.samples.find((s) => s.inputKind === "edit");
          const navigation = after.events.find(
            (e) =>
              e.kind === "input" &&
              e.id > cutoff(before) &&
              e.inputKind === "navigation",
          );
          const ready =
            navigation &&
            after.events.find(
              (e) =>
                ["ready", "input-ready"].includes(e.kind) &&
                e.input === navigation.id,
            );
          if (first)
            retainSamples(scenario, [
              {
                ...first,
                navigationId: navigation?.id,
                navigationAt: navigation?.createdAt ?? null,
                readyAt: ready?.at ?? null,
                coldBeforeNavigation: record.coldBeforeNavigation,
              },
            ]);
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
    scenarios: [],
    errors: [],
  };
  for (const spec of selectedSpecs) {
    const scenario = {
      id: spec.id,
      kind: spec.kind,
      samples: [],
      droppedEvents: 0,
      requestedAttempts: spec.kind === "cold" ? 34 : 100,
      attempts: [],
      aborted: false,
    };
    result.scenarios.push(scenario);
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
      session = await context.launch(file, label);
      session.instance.independentRunId = context.independentRunId;
      session.instance.role = "scenario";
      session.instance.scenarios.push(scenario);
      await exact(session.page, 5000);
      await session.page.getByLabel("Raster anzeigen").uncheck();
      if (spec.kind === "cold")
        await collectCold(context, session, spec, scenario);
      else await collectWarm(context, session, spec, scenario);
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
      scenario.attempts.every((a) => a.passed);
    if (!scenario.collectionPassed)
      result.errors.push({
        scenario: spec.id,
        requested: scenario.requestedAttempts,
        attempted: scenario.attempts.length,
        error:
          scenario.error ??
          (scenario.aborted
            ? scenario.attempts.at(-1)?.error
            : scenario.attempts.find((a) => !a.passed)?.error) ??
          "Collection incomplete",
        failedAttempts: scenario.attempts
          .filter((attempt) => !attempt.passed)
          .map(({ attempt, error }) => ({ attempt, error })),
      });
  }
  result.passed = result.errors.length === 0;
  return result;
}
