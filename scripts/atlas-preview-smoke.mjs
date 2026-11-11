import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { launchAtlasDesktop } from "./atlas-p0-desktop.mjs";
import { assetName, CHANNEL, REPOSITORY } from "./atlas-preview-release.mjs";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const args = process.argv.slice(2);
const executableIndex = args.indexOf("--executable");
const executablePath = args[executableIndex + 1];
if (executableIndex < 0 || !executablePath || executablePath.startsWith("--"))
  throw new Error(
    "Usage: node scripts/atlas-preview-smoke.mjs --executable <packaged app>",
  );
const output = resolve("artifacts/atlas-rebuild/ci-package/updater");
await mkdir(output, { recursive: true });
const build = JSON.parse(await readFile("desktop-dist/build.json", "utf8"));
const report = {
  purpose:
    "Packaged main/preload/renderer updater with fixture network bytes; no system installation",
  commit: build.commit,
  checks: [],
  passed: false,
};
function check(name, action) {
  action();
  report.checks.push({ name, passed: true });
}
let desktop;
try {
  desktop = await launchAtlasDesktop({
    executablePath,
    lab: true,
    env: { ATLAS_P0_DIALOG_UNSAVED: "discard" },
  });
  const { app, page } = desktop;
  await page.waitForFunction(() => Boolean(window.atlasUpdates));
  const state = await page.evaluate(() => window.atlasUpdates.status());
  check("packaged build identity reaches the renderer", () => {
    assert.equal(state.current.commit, build.commit);
    assert.equal(state.current.revision, build.preview?.revision ?? null);
    assert.notEqual(state.status, "unsupported");
    assert.equal(
      state.canInstall,
      false,
      "An unpacked test binary must not be treated as an installed RPM",
    );
  });
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);

  const revision = `${BigInt(state.current.revision?.split(".")[0] ?? "42940000000") + 1n}.1`;
  const payload = Buffer.from(
    "SaltMarcher preview updater checked download fixture\n",
  );
  const digest = createHash("sha256").update(payload).digest("hex");
  const candidate = {
    schema: 1,
    channel: CHANNEL,
    version: state.current.version,
    revision,
    commit: "c".repeat(40),
    publishedAt: "2026-11-11T12:00:00.000Z",
  };
  for (const kind of ["rpm", "zip"]) {
    const name = assetName(kind, candidate.version, revision);
    candidate[kind] = {
      name,
      url: `https://github.com/${REPOSITORY}/releases/download/${CHANNEL}/${name}`,
      sha256: digest,
      size: payload.length,
    };
  }

  // Only transport bytes are substituted. The shipped network adapter, updater,
  // filesystem, IPC sender checks, preload and React UI remain the real code.
  await app.evaluate(
    async ({ net }, fixture) => {
      const { EventEmitter } = process.getBuiltinModule("events");
      const { Readable } = process.getBuiltinModule("stream");
      const control = {
        original: net.request,
        corrupt: false,
        calls: [],
        fixture,
      };
      globalThis.__atlasPreviewSmoke = control;
      net.request = (options) => {
        const request = new EventEmitter();
        let aborted = false;
        let response;
        request.abort = () => {
          if (aborted) return;
          aborted = true;
          response?.destroy();
          request.emit("abort");
          request.emit("close");
        };
        request.end = () =>
          queueMicrotask(() => {
            if (aborted) return;
            const url = typeof options === "string" ? options : options.url;
            control.calls.push(url);
            let bytes;
            if (url.endsWith("/atlas-preview.json"))
              bytes = Buffer.from(JSON.stringify(control.fixture.manifest));
            else if (url === control.fixture.manifest.rpm.url) {
              bytes = Buffer.from(control.fixture.payload, "base64");
              if (control.corrupt) bytes[0] ^= 1;
            } else {
              request.emit(
                "error",
                new Error(`Unexpected fixture request: ${url}`),
              );
              return;
            }
            const middle = Math.floor(bytes.length / 2);
            response = Readable.from([
              bytes.subarray(0, middle),
              bytes.subarray(middle),
            ]);
            response.statusCode = 200;
            response.statusMessage = "OK";
            response.headers = { "content-length": String(bytes.length) };
            response.on("end", () => request.emit("close"));
            request.emit("response", response);
          });
        return request;
      };
    },
    { manifest: candidate, payload: payload.toString("base64") },
  );

  // Let the real one-shot startup check finish before manual operations, so it
  // cannot clear a completed fixture download halfway through this smoke.
  await page.waitForFunction(
    async () => (await window.atlasUpdates.status()).status === "available",
    undefined,
    { timeout: 25_000 },
  );
  await page
    .getByRole("button", { name: "Update verfügbar", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Updates", exact: true });
  await dialog.waitFor({ state: "visible" });
  const dialogText = await dialog.innerText();
  check("update dialog shows current and available commits", () => {
    assert.ok(dialogText.includes(state.current.commit.slice(0, 7)));
    assert.ok(dialogText.includes(candidate.commit.slice(0, 7)));
  });
  await dialog
    .getByRole("button", { name: "Nach Updates suchen", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Herunterladen", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    async () => (await window.atlasUpdates.status()).status === "available",
  );
  report.checks.push({
    name: "manual check selects newer preview through real IPC",
    passed: true,
  });

  await dialog
    .getByRole("button", { name: "Herunterladen", exact: true })
    .click();
  await page.waitForFunction(
    async () => (await window.atlasUpdates.status()).status === "ready",
  );
  const ready = await page.evaluate(() => window.atlasUpdates.status());
  check("verified download reaches ready with complete byte count", () => {
    assert.equal(ready.downloaded, true);
    assert.equal(ready.downloadedBytes, payload.length);
  });
  const saved = await app.evaluate(async ({ app }, filename) => {
    const fs = process.getBuiltinModule("fs/promises");
    const path = process.getBuiltinModule("path");
    const root = path.join(app.getPath("userData"), "preview-updates");
    for (const directory of await fs.readdir(root)) {
      try {
        return (
          await fs.readFile(path.join(root, directory, filename))
        ).toString("base64");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return null;
  }, candidate.rpm.name);
  check("downloaded file contains exactly the verified fixture bytes", () =>
    assert.equal(saved, payload.toString("base64")),
  );
  assert.equal(
    await dialog.getByRole("button", { name: /installieren/i }).count(),
    0,
  );
  report.checks.push({
    name: "non-RPM launch offers no system installation",
    passed: true,
  });
  await page.screenshot({ path: join(output, "ready.png") });

  const restartError = await page.evaluate(async () => {
    try {
      await window.atlasUpdates.restart();
      return null;
    } catch (error) {
      return error.message;
    }
  });
  check("restart before successful installation is rejected", () =>
    assert.match(restartError ?? "", /kein Update erfolgreich installiert/),
  );
  const untrusted = await app.evaluate(async ({ app, BrowserWindow }) => {
    const { join } = process.getBuiltinModule("path");
    const foreign = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(app.getAppPath(), "desktop-dist/preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    try {
      await foreign.loadURL(
        "data:text/html,<title>Untrusted updater check</title>",
      );
      return await foreign.webContents.executeJavaScript(
        "window.atlasUpdates.check().then(() => null, error => error.message)",
      );
    } finally {
      foreign.destroy();
    }
  });
  check("a foreign renderer cannot invoke the updater", () =>
    assert.match(untrusted ?? "", /nicht aus dem aktiven Atlas-Fenster/),
  );

  await app.evaluate(() => {
    globalThis.__atlasPreviewSmoke.corrupt = true;
  });
  await dialog
    .getByRole("button", { name: "Nach Updates suchen", exact: true })
    .click();
  await page.waitForFunction(
    async () => (await window.atlasUpdates.status()).status === "available",
  );
  await dialog
    .getByRole("button", { name: "Herunterladen", exact: true })
    .click();
  await page.waitForFunction(
    async () => (await window.atlasUpdates.status()).status === "error",
  );
  const rejected = await page.evaluate(() => window.atlasUpdates.status());
  check("same-size corrupt bytes cannot become an installable download", () => {
    assert.equal(rejected.downloaded, false);
    assert.equal(rejected.downloadedBytes, 0);
    assert.match(rejected.message, /Prüfsumme/);
  });
  // The main-process result can arrive before React renders its status event.
  await expect(dialog.getByRole("status")).toContainText("Prüfsumme");
  report.checks.push({
    name: "checksum failure is visible in the real dialog",
    passed: true,
  });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  assert.deepEqual(desktop.errors, []);
  await app.evaluate(({ net }) => {
    net.request = globalThis.__atlasPreviewSmoke.original;
    delete globalThis.__atlasPreviewSmoke;
  });
  const closed = app.waitForEvent("close", { timeout: 15_000 });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  await closed;
  report.checks.push({
    name: "normal window close completes after updater use",
    passed: true,
  });
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (desktop) {
    await desktop.close();
    await writeFile(join(output, "electron.log"), desktop.output.join(""));
  }
  await writeFile(
    join(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}
