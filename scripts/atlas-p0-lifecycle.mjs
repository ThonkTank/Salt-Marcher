import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const observation = (page) =>
  page.evaluate(() => window.atlasObserve([[0, 0]], { events: false }));
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

async function nativeClose(session, shouldClose) {
  let closed = false;
  const exited = new Promise((resolve) =>
    session.app.once("close", () => {
      closed = true;
      resolve();
    }),
  );
  await session.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  if (!shouldClose) {
    await settledFileAction(session.app);
    if (closed) throw new Error("Native close discarded the local document");
    return;
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
}

function inspectSaved(file) {
  // Existing fixture inspector, in Electron's actual SQLite ABI. Its shifted
  // first sample is exactly the centre painted by these ordinary inputs.
  const inspected = spawnSync(
    require("electron"),
    [join(root, "scripts/atlas-p0-fixture.mjs"), "inspect", file, "400", "0"],
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
  for (const mode of ["active", "pending", "failed"])
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
                  window.atlasObserve([[0, 0]], { events: false }),
                ),
            );
          }),
        );
        await paint(session.page, mode !== "active");
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
        evidence.before = await observation(session.page);
        evidence.storeBefore = await session.page.evaluate(() =>
          window.atlasDesktop.status(),
        );
        recordCheck(
          `${label}: local unsaved change exists`,
          evidence.before.samples[0] > -100 && !evidence.before.state.saved,
        );
        recordCheck(
          `${label}: exercises intended boundary`,
          mode === "active"
            ? evidence.before.document.active &&
                evidence.storeBefore.sequence === 0
            : mode === "pending"
              ? evidence.before.state.writing &&
                evidence.storeBefore.sequence === 0
              : Boolean(evidence.before.state.persistenceError) &&
                evidence.storeBefore.sequence === 0,
        );
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
