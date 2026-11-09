import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const observation = (page) =>
  page.evaluate(() =>
    window.atlasObserve(window.__atlasLifecycleProbes ?? [[0, 0]], {
      events: false,
    }),
  );
const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

async function ready(page) {
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).readiness.ready,
  );
}

async function paint(page, release) {
  await ready(page);
  const revision = (await observation(page)).document.revision;
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(
    (before) =>
      window.atlasObserve([], { events: false }).document.revision >=
      before + 2,
    revision,
  );
  if (release) await page.mouse.up();
}

async function settledFileAction(app) {
  const deadline = Date.now() + 10_000;
  while (await app.evaluate(() => globalThis.__atlasHost.fileActionPending())) {
    if (Date.now() > deadline) throw new Error("File action did not settle");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** The terminal path and boundary command run in one turn, before any RAF drain. */
async function beginFinishingPaint(page) {
  await page.evaluate(() => {
    document.querySelector("canvas").addEventListener(
      "pointerdown",
      (event) => {
        window.__atlasLifecyclePointerId = event.pointerId;
      },
      { once: true },
    );
  });
  await paint(page, false);
}

async function sealAndAct(page, action) {
  return page.evaluate((action) => {
    const canvas = document.querySelector("canvas"),
      box = canvas.getBoundingClientRect();
    const current = window.atlasObserve([], { events: false });
    const cx = box.left + box.width / 2,
      cy = box.top + box.height / 2;
    const points = [
      [current.camera.x, current.camera.y],
      [
        current.camera.x + 80 / current.camera.scale,
        current.camera.y + 80 / current.camera.scale,
      ],
      [current.camera.x + 160 / current.camera.scale, current.camera.y],
    ];
    window.__atlasLifecycleProbes = points;
    for (const [type, x, y, buttons] of [
      ["pointermove", cx + 80, cy + 80, 1],
      ["pointerup", cx + 160, cy, 0],
    ])
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: window.__atlasLifecyclePointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    const before = window.atlasObserve(points, { events: false });
    if (
      !before.document.finishing ||
      !(before.document.brushWork?.pendingCells > 0)
    )
      throw new Error(
        "Finishing lifecycle control has no accepted unapplied coefficients",
      );
    if (action === "close") console.info("atlas-lifecycle-close-request");
    else if (action === "undo")
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
        }),
      );
    else {
      const button = [...document.querySelectorAll("button")].find(
        (button) => button.textContent.trim() === action,
      );
      if (!button || button.disabled)
        throw new Error("Unavailable finishing file action: " + action);
      button.click();
    }
    return { before, points };
  }, action);
}

async function nativeClose(session, shouldClose, requestClose) {
  let closed = false;
  const exited = new Promise((resolve) =>
    session.app.once("close", () => {
      closed = true;
      resolve();
    }),
  );
  let result;
  if (requestClose) {
    // Calling window.close() bypasses the ordinary BrowserWindow close route.
    // Relay only the test's marker into that same native close event instead.
    await session.app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      globalThis.__atlasLifecycleCloseObserved = false;
      window.once("close", () => {
        globalThis.__atlasLifecycleCloseObserved = true;
      });
      const request = (event) => {
        if (event.message !== "atlas-lifecycle-close-request") return;
        window.webContents.removeListener("console-message", request);
        window.close();
      };
      window.webContents.on("console-message", request);
    });
    result = await requestClose();
  } else
    await session.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
  if (!shouldClose) {
    if (requestClose) {
      const deadline = Date.now() + 10_000;
      while (
        !(await session.app.evaluate(
          () => globalThis.__atlasLifecycleCloseObserved,
        ))
      ) {
        if (closed)
          throw new Error("Native close discarded the local document");
        if (Date.now() > deadline)
          throw new Error("Native close marker was not received");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    await settledFileAction(session.app);
    if (closed) throw new Error("Native close discarded the local document");
    return result;
  }
  let timer;
  try {
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Native close did not finish")),
          10_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return result;
}

function inspectSaved(file, point = [0, 0]) {
  // Existing fixture inspector, in Electron's actual SQLite ABI. Its shifted
  // first sample is exactly the centre painted by these ordinary inputs.
  const inspected = spawnSync(
    require("electron"),
    [
      join(root, "scripts/atlas-p0-fixture.mjs"),
      "inspect",
      file,
      String(point[0] + 400),
      String(point[1]),
    ],
    {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  if (inspected.error || inspected.status !== 0)
    throw new Error(
      `Saved lifecycle file failed inspection: ${inspected.error ?? inspected.stderr}`,
    );
  return JSON.parse(inspected.stdout);
}

/** Real GUI edits and native close; the shared smoke owns launch/results/cleanup. */
export async function runLifecycleScenarios({ launch, out, recordCheck }) {
  for (const mode of ["active", "pending", "failed", "finishing"])
    for (const decision of ["cancel", "save", "discard"]) {
      const label = `close-${mode}-${decision}`;
      const file = join(out, `${label}.saltatlas`);
      const session = await launch({
        label,
        diagnostics: true,
        env: {
          ATLAS_P0_DIALOG_UNSAVED: decision,
          ATLAS_P0_DIALOG_SAVE: file,
          ...(mode === "pending" ? { ATLAS_P0_COMMIT_DELAY_MS: "1000" } : {}),
          ...(mode === "failed"
            ? { ATLAS_P0_COMMIT_FAULT: "before-once" }
            : {}),
        },
      });
      const evidence = { label, decision };
      let final;
      session.page.on("console", (message) => {
        const text = message.text();
        if (text.startsWith("atlas-lifecycle-final:"))
          final = JSON.parse(text.slice("atlas-lifecycle-final:".length));
      });
      try {
        await session.page.evaluate(() =>
          window.addEventListener("beforeunload", () => {
            console.info(
              "atlas-lifecycle-final:" +
                JSON.stringify(
                  window.atlasObserve(
                    window.__atlasLifecycleProbes ?? [[0, 0]],
                    { events: false },
                  ),
                ),
            );
          }),
        );
        if (mode === "finishing") await beginFinishingPaint(session.page);
        else await paint(session.page, mode !== "active");
        if (mode === "pending") await paint(session.page, true);
        if (mode === "pending")
          await session.page.waitForFunction(
            () => window.atlasObserve([], { events: false }).state.writing,
          );
        if (mode === "failed")
          await session.page.waitForFunction(
            () =>
              window.atlasObserve([], { events: false }).state.persistenceError,
          );
        evidence.storeBefore = await session.page.evaluate(() =>
          window.atlasDesktop.status(),
        );
        if (mode === "finishing") {
          const terminal = await nativeClose(
            session,
            decision !== "cancel",
            () => sealAndAct(session.page, "close"),
          );
          evidence.before = terminal.before;
          evidence.points = terminal.points;
        } else evidence.before = await observation(session.page);
        recordCheck(
          `${label}: local unsaved change exists`,
          evidence.before.samples[0] > -100 && !evidence.before.state.saved,
        );
        recordCheck(
          `${label}: exercises intended boundary`,
          mode === "finishing"
            ? evidence.before.document.finishing &&
                evidence.before.document.brushWork.pendingCells > 0 &&
                evidence.before.document.sequence === 0 &&
                evidence.storeBefore.sequence === 0
            : mode === "active"
              ? evidence.before.document.active &&
                evidence.storeBefore.sequence === 0
              : mode === "pending"
                ? evidence.before.state.writing &&
                  evidence.storeBefore.sequence === 0
                : Boolean(evidence.before.state.persistenceError) &&
                  evidence.storeBefore.sequence === 0,
        );
        if (mode !== "finishing")
          await nativeClose(session, decision !== "cancel");
        if (decision === "cancel") {
          evidence.after = await observation(session.page);
          recordCheck(
            `${label}: cancellation retains complete local action`,
            !evidence.after.document.active &&
              evidence.after.document.sequence ===
                (mode === "pending" ? 2 : 1) &&
              evidence.after.samples[0] >= evidence.before.samples[0] &&
              !evidence.after.state.fileAction,
          );
          if (mode === "finishing") {
            await session.page.mouse.up();
            recordCheck(
              `${label}: terminal path survives cancellation`,
              evidence.before.samples.at(-1) === -100 &&
                evidence.after.samples.every((height) => height > -100) &&
                evidence.after.document.historyActions === 1,
            );
          }
          if (mode === "failed") {
            await session.page.getByLabel("Raster anzeigen").uncheck();
            const afterToggle = await observation(session.page);
            recordCheck(
              `${label}: unrelated controls cannot erase the persistence error`,
              Boolean(afterToggle.state.persistenceError) &&
                afterToggle.state.message.includes("Speicherfehler") &&
                (await session.page.getByRole("alert").isVisible()),
            );
            await session.page
              .getByRole("button", {
                name: "Speicherstand prüfen",
                exact: true,
              })
              .click();
            await session.page.waitForFunction(
              () =>
                !window.atlasObserve([], { events: false }).state
                  .persistenceError,
            );
            const recovered = await session.page.evaluate(() =>
              window.atlasDesktop.status(),
            );
            recordCheck(
              `${label}: explicit recovery retains the action`,
              recovered.sequence === 1 &&
                (await observation(session.page)).samples[0] ===
                  evidence.after.samples[0],
            );
          }
          recordCheck(`${label}: no save was implied`, !(await exists(file)));
        } else if (decision === "save") {
          evidence.final = final;
          evidence.saved = inspectSaved(file);
          recordCheck(
            `${label}: exact completed local state was saved`,
            Boolean(final) &&
              !final.document.active &&
              evidence.saved.sequence === final.document.sequence &&
              Math.abs(evidence.saved.samples[0] - final.samples[0]) < 1e-8 &&
              final.samples[0] >= evidence.before.samples[0],
          );
          if (mode === "finishing") {
            evidence.savedProbes = evidence.points.map((point) =>
              inspectSaved(file, point),
            );
            recordCheck(
              `${label}: saved terminal geometry is complete`,
              evidence.before.samples.at(-1) === -100 &&
                evidence.savedProbes.every(
                  (saved, index) =>
                    saved.sequence === 1 &&
                    saved.samples[0] > -100 &&
                    Math.abs(saved.samples[0] - final.samples[index]) < 1e-8,
                ),
            );
          }
        } else
          recordCheck(
            `${label}: discard never publishes a file`,
            !(await exists(file)),
          );
        recordCheck(
          `${label}: no renderer exception`,
          session.errors.length === 0,
          session.errors,
        );
      } finally {
        await writeFile(
          join(session.directory, "lifecycle.json"),
          JSON.stringify(evidence, null, 2),
        );
        await session.close();
      }
    }

  for (const operation of [
    "undo",
    "save",
    "cancel-open",
    "failed-open",
    "replace",
  ]) {
    const label = `finishing-${operation}`,
      file = join(out, `${label}.saltatlas`),
      invalid = join(out, `${label}-invalid.saltatlas`);
    if (operation === "failed-open")
      await writeFile(invalid, "not a SaltMarcher SQLite file");
    const session = await launch({
      label,
      diagnostics: true,
      env: {
        ATLAS_P0_DIALOG_UNSAVED:
          operation === "cancel-open" ? "cancel" : "discard",
        ATLAS_P0_DIALOG_SAVE: file,
        ATLAS_P0_DIALOG_OPEN: operation === "failed-open" ? invalid : file,
      },
    });
    const evidence = { label, operation };
    try {
      await beginFinishingPaint(session.page);
      const command =
        operation === "undo"
          ? "undo"
          : operation === "save"
            ? "Speichern"
            : operation === "replace"
              ? "Neu"
              : "Öffnen";
      const terminal = await sealAndAct(session.page, command);
      evidence.before = terminal.before;
      evidence.points = terminal.points;
      recordCheck(
        `${label}: boundary contains real reserved unapplied work`,
        evidence.before.document.finishing &&
          evidence.before.document.brushWork.pendingCells > 0 &&
          evidence.before.document.sequence === 0 &&
          evidence.before.samples.at(-1) === -100,
      );
      await session.page.mouse.up();
      await session.page.waitForFunction(
        ({ operation, sessionId }) => {
          const o = window.atlasObserve([], { events: false });
          if (
            o.document.active ||
            o.document.finishing ||
            o.state.fileAction ||
            o.state.writing
          )
            return false;
          return operation === "replace"
            ? o.sessionId !== sessionId && o.readiness.ready
            : operation === "undo"
              ? o.document.sequence === 2
              : operation === "save"
                ? o.state.saved
                : operation === "failed-open"
                  ? Boolean(o.state.error)
                  : o.document.sequence === 1;
        },
        { operation, sessionId: evidence.before.sessionId },
      );
      evidence.after = await observation(session.page);
      if (operation === "undo")
        recordCheck(
          `${label}: one undo removes the whole accepted action`,
          evidence.after.samples.every((height) => height === -100) &&
            evidence.after.document.canRedo &&
            evidence.after.document.historyActions === 1,
        );
      else if (operation === "replace")
        recordCheck(
          `${label}: successful replacement establishes the next session`,
          evidence.after.sessionId !== evidence.before.sessionId &&
            evidence.after.document.sequence === 0 &&
            evidence.after.document.historyActions === 0,
        );
      else
        recordCheck(
          `${label}: complete local geometry survives the file boundary`,
          evidence.after.sessionId === evidence.before.sessionId &&
            evidence.after.document.sequence === 1 &&
            evidence.after.document.historyActions === 1 &&
            evidence.after.samples.every((height) => height > -100),
        );
      if (operation === "save") {
        evidence.saved = terminal.points.map((point) =>
          inspectSaved(file, point),
        );
        recordCheck(
          `${label}: file contains every terminal probe`,
          evidence.saved.every(
            (saved, index) =>
              saved.sequence === 1 &&
              Math.abs(saved.samples[0] - evidence.after.samples[index]) < 1e-8,
          ),
        );
        await session.page
          .getByRole("button", { name: "Öffnen", exact: true })
          .click();
        await session.page.waitForFunction((sessionId) => {
          const o = window.atlasObserve([], { events: false });
          return (
            o.sessionId !== sessionId &&
            o.readiness.ready &&
            !o.state.fileAction
          );
        }, evidence.after.sessionId);
        evidence.reopened = await observation(session.page);
        recordCheck(
          `${label}: reopening restores the complete accepted action`,
          evidence.reopened.document.sequence === 1 &&
            evidence.reopened.samples.every(
              (height, index) =>
                Math.abs(height - evidence.after.samples[index]) < 1e-8,
            ),
        );
      }
      const completed = await observation(session.page);
      await session.page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          ),
      );
      evidence.settled = await observation(session.page);
      recordCheck(
        `${label}: no late author work after completion or replacement`,
        evidence.settled.document.revision === completed.document.revision &&
          evidence.settled.document.sequence === completed.document.sequence &&
          evidence.settled.samples.every(
            (height, index) => height === completed.samples[index],
          ),
      );
      recordCheck(
        `${label}: no renderer exception`,
        session.errors.length === 0,
        session.errors,
      );
    } finally {
      await writeFile(
        join(session.directory, "lifecycle.json"),
        JSON.stringify(evidence, null, 2),
      );
      await session.close();
    }
  }

  for (const fault of ["after-once", "always-before"]) {
    const label = `recovery-${fault}`;
    const session = await launch({
      label,
      diagnostics: true,
      env: {
        ATLAS_P0_COMMIT_FAULT: fault,
        ATLAS_P0_DIALOG_UNSAVED: fault === "always-before" ? "save" : "cancel",
        ATLAS_P0_DIALOG_SAVE: join(out, `${label}.saltatlas`),
      },
    });
    try {
      await paint(session.page, true);
      await session.page.waitForFunction(
        () => window.atlasObserve([], { events: false }).state.persistenceError,
      );
      const before = await observation(session.page);
      const actual = await session.page.evaluate(() =>
        window.atlasDesktop.status(),
      );
      recordCheck(
        `${label}: fault affects its stated boundary`,
        actual.sequence === (fault === "after-once" ? 1 : 0),
      );
      if (fault === "after-once") {
        await session.page
          .getByRole("button", { name: "Speicherstand prüfen", exact: true })
          .click();
        await session.page.waitForFunction(
          () =>
            !window.atlasObserve([], { events: false }).state.persistenceError,
        );
        const metrics = await session.page.evaluate(() =>
          window.atlasDesktop.metrics(),
        );
        recordCheck(
          `${label}: ambiguous acknowledgement never applies an action twice`,
          metrics.commits === 1 &&
            (await observation(session.page)).samples[0] === before.samples[0],
        );
      } else {
        await nativeClose(session, false);
        const after = await observation(session.page);
        recordCheck(
          `${label}: failed recovery cannot save or close`,
          Boolean(after.state.persistenceError) &&
            !after.state.fileAction &&
            after.samples[0] === before.samples[0] &&
            !(await exists(join(out, `${label}.saltatlas`))),
        );
      }
      // Change only the automated native dialog's answer, never application data.
      await session.app.evaluate(() => {
        process.env.ATLAS_P0_DIALOG_UNSAVED = "discard";
      });
      await nativeClose(session, true);
      recordCheck(`${label}: explicit discard remains possible`, true);
    } finally {
      await session.close();
    }
  }

  const reopenFile = join(out, "close-active-save.saltatlas");
  for (const command of ["Neu", "Öffnen"]) {
    const session = await launch({
      label: `replace-${command === "Neu" ? "new" : "open"}`,
      diagnostics: true,
      env: {
        ATLAS_P0_COMMIT_FAULT: "before-once",
        ATLAS_P0_DIALOG_UNSAVED: "cancel",
        ATLAS_P0_DIALOG_OPEN: reopenFile,
      },
    });
    try {
      await paint(session.page, true);
      await session.page.waitForFunction(
        () => window.atlasObserve([], { events: false }).state.persistenceError,
      );
      const before = await observation(session.page);
      await session.page
        .getByRole("button", { name: command, exact: true })
        .click();
      await session.page.waitForFunction(
        () => !window.atlasObserve([], { events: false }).state.fileAction,
      );
      const cancelled = await observation(session.page);
      recordCheck(
        `${command}: cancel retains the failed local action`,
        cancelled.sessionId === before.sessionId &&
          cancelled.samples[0] === before.samples[0] &&
          Boolean(cancelled.state.persistenceError),
      );
      await session.app.evaluate(() => {
        process.env.ATLAS_P0_DIALOG_UNSAVED = "discard";
      });
      await session.page
        .getByRole("button", { name: command, exact: true })
        .click();
      await session.page.waitForFunction((sessionId) => {
        const state = window.atlasObserve([], { events: false });
        return (
          state.sessionId !== sessionId &&
          !state.state.fileAction &&
          state.readiness.ready
        );
      }, before.sessionId);
      const replaced = await observation(session.page);
      recordCheck(
        `${command}: explicit discard establishes a usable next project`,
        !replaced.state.persistenceError &&
          replaced.document.sequence === (command === "Neu" ? 0 : 1),
      );
    } finally {
      await session.close();
    }
  }
}
