import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, session } from "electron";
import { PassiveProjectionChannel } from "./channel.mjs";
import { PRIVATE_IDENTITIES, PRIVATE_STRING_CANARIES } from "./fixture.mjs";
import { canaryPixels, findPrivateRaster, readPng } from "./pixel-oracle.mjs";

app.commandLine.appendSwitch("headless");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-breakpad");
app.commandLine.appendSwitch("disable-crash-reporter");

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const outFile = path.resolve(
  arg("--out") ?? path.join(here, "../evidence/p03-aggregate.json"),
);
const frameDir = path.resolve(
  arg("--frames") ?? path.join(here, "../evidence/p03-frames"),
);
const temporaryProfile = path.join(tmpdir(), `saltmarcher-p03-${randomUUID()}`);
app.setPath("userData", temporaryProfile);

const channel = new PassiveProjectionChannel();
const roleByContents = new Map();
const windows = new Set();
const deniedSinks = [];
const diagnostics = [];
const frames = [];
const transitions = [];
let passiveWindow;
let gmWindow;
let passiveSession;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const requirePassiveSender = (event) => {
  if (roleByContents.get(event.sender.id) !== "passive-display")
    throw new Error("ROLE_DENIED");
  return "passive-display";
};

ipcMain.handle("p03:read-projection", (event) =>
  channel.readProjection(requirePassiveSender(event)),
);
ipcMain.handle("p03:read-core-status", (event) =>
  channel.readCoreStatus(requirePassiveSender(event)),
);
const unsubscribe = channel.subscribe("passive-display", (projection) => {
  transitions.push({
    generation: projection.generation,
    state: projection.state,
    at: performance.now(),
  });
  if (passiveWindow && !passiveWindow.isDestroyed()) {
    passiveWindow.webContents.send("p03:projection-changed", projection);
  }
});

function recordDenied(kind) {
  deniedSinks.push(kind);
  channel.recordDeniedSink(kind);
}

function harden(contents, role, allowedFile) {
  roleByContents.set(contents.id, role);
  contents.setWindowOpenHandler(() => {
    recordDenied("popup");
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (url !== allowedFile) {
      event.preventDefault();
      recordDenied("navigation");
    }
  });
  contents.on("will-redirect", (event) => {
    event.preventDefault();
    recordDenied("redirect");
  });
  contents.on("devtools-opened", () => {
    contents.closeDevTools();
    recordDenied("devtools");
  });
  contents.on("console-message", (_event, details) => {
    diagnostics.push({ level: details.level, code: "RENDERER_POLICY_EVENT" });
  });
  contents.once("destroyed", () => roleByContents.delete(contents.id));
}

async function createGmWindow() {
  const file = path.join(here, "gm.html");
  const window = new BrowserWindow({
    width: 640,
    height: 420,
    show: true,
    title: "GM control",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
    },
  });
  windows.add(window);
  harden(window.webContents, "gm", new URL(`file://${file}`).href);
  window.once("closed", () => windows.delete(window));
  await window.loadFile(file);
  return window;
}

async function createPassiveWindow() {
  const partition = `p03-passive-${randomUUID()}`;
  const isolatedSession = session.fromPartition(partition, { cache: false });
  isolatedSession.setPermissionCheckHandler(() => false);
  isolatedSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => {
      recordDenied("permission");
      callback(false);
    },
  );
  isolatedSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (_details, callback) => {
      recordDenied("network");
      callback({ cancel: true });
    },
  );
  isolatedSession.on("will-download", (event) => {
    event.preventDefault();
    recordDenied("download");
  });
  const file = path.join(here, "passive.html");
  const window = new BrowserWindow({
    width: 800,
    height: 520,
    minWidth: 240,
    minHeight: 180,
    show: true,
    title: "Party display",
    webPreferences: {
      preload: path.join(here, "passive-preload.cjs"),
      partition,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: false,
      spellcheck: false,
    },
  });
  windows.add(window);
  harden(window.webContents, "passive-display", new URL(`file://${file}`).href);
  window.once("closed", () => windows.delete(window));
  await window.loadFile(file);
  return { window, isolatedSession };
}

async function waitFor(generation, state, timeout = 2000) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const current = await passiveWindow.webContents.executeJavaScript(
      `({ generation: document.documentElement.dataset.generation, state: document.documentElement.dataset.projectionState })`,
    );
    if (Number(current.generation) === generation && current.state === state)
      return performance.now() - started;
    await sleep(10);
  }
  throw new Error(`WAIT_TIMEOUT_${generation}_${state}`);
}

async function capture(label, expectedState) {
  let image;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const state = await passiveWindow.webContents.executeJavaScript(
        `document.documentElement.dataset.projectionState`,
      );
      if (state !== expectedState)
        throw new Error(`FRAME_STATE_CHANGED_${state}`);
      passiveWindow.webContents.invalidate();
      await sleep(50 * attempt);
      image = await passiveWindow.webContents.capturePage();
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!image)
    throw new Error(`CAPTURE_${label}: ${lastError?.message ?? lastError}`);
  const bytes = image.toPNG();
  const file = path.join(frameDir, `${label}.png`);
  await writeFile(file, bytes);
  const png = readPng(bytes);
  const privateRasterMatch = findPrivateRaster(png);
  if (privateRasterMatch) throw new Error(`PRIVATE_RASTER_VISIBLE_${label}`);
  const raw = bytes.toString("latin1");
  for (const canary of [...PRIVATE_STRING_CANARIES, ...PRIVATE_IDENTITIES]) {
    if (raw.includes(canary))
      throw new Error(`PRIVATE_METADATA_VISIBLE_${label}`);
  }
  frames.push({
    label,
    file: path.relative(path.dirname(outFile), file),
    sha256: sha256(bytes),
    width: png.width,
    height: png.height,
    privateRasterMatches: 0,
  });
}

async function snapshotSurface(label) {
  const snapshot = await passiveWindow.webContents
    .executeJavaScript(`(async () => ({
    label: ${JSON.stringify(label)},
    html: document.documentElement.outerHTML,
    text: document.body.innerText,
    url: location.href,
    title: document.title,
    globals: {
      require: typeof window.require,
      process: typeof window.process,
      bridgeKeys: Object.keys(window.partyDisplay || {}).sort(),
      localStorageBytes: (() => { try { return localStorage.length } catch { return -1 } })(),
      cacheKeys: await caches.keys().then((items) => items.length, () => -1),
      serviceWorkerRegistrations: 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations().then((items) => items.length, () => -1) : 0,
      indexedDatabases: typeof indexedDB.databases === 'function' ? await indexedDB.databases().then((items) => items.length, () => -1) : -1,
    }
  }))()`);
  return snapshot;
}

async function runSinkNegatives() {
  return passiveWindow.webContents.executeJavaScript(`(async () => {
    const result = {};
    result.popup = window.open('https://example.invalid/private') === null;
    try { await fetch('https://example.invalid/private'); result.network = false } catch { result.network = true }
    try { await fetch('file:///etc/passwd'); result.file = false } catch { result.file = true }
    try { await navigator.clipboard.writeText('blocked'); result.clipboard = false } catch { result.clipboard = true }
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); result.permission = false } catch { result.permission = true }
    try { localStorage.setItem('p03', 'ephemeral'); result.storageWriteSucceeded = true } catch { result.storageWriteSucceeded = false }
    try { await caches.open('p03'); result.cacheWriteSucceeded = true } catch { result.cacheWriteSucceeded = false }
    result.indexedDbWriteSucceeded = await new Promise((resolve) => {
      try {
        const request = indexedDB.open('p03', 1);
        request.onerror = () => resolve(false);
        request.onsuccess = () => { request.result.close(); resolve(true) };
      } catch { resolve(false) }
    });
    try { await navigator.serviceWorker.register('passive-renderer.js'); result.serviceWorkerBlocked = false } catch { result.serviceWorkerBlocked = true }
    const external = document.createElement('a'); external.href = 'saltmarcher-private://blocked'; document.body.append(external); external.click(); external.remove();
    await new Promise((resolve) => setTimeout(resolve, 10));
    result.navigation = location.protocol === 'file:';
    const anchor = document.createElement('a'); anchor.href = 'data:text/plain,blocked'; anchor.download = 'blocked.txt'; document.body.append(anchor); anchor.click(); anchor.remove();
    return result;
  })()`);
}

async function accessibilityEvidence() {
  const semantic = await passiveWindow.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('#details');
    return {
      lang: document.documentElement.lang,
      headings: document.querySelectorAll('h1').length,
      liveRegions: document.querySelectorAll('[aria-live]').length,
      unlabeledButtons: [...document.querySelectorAll('button')].filter((item) => !item.innerText.trim() && !item.getAttribute('aria-label')).length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      buttonHidden: button.hidden,
    };
  })()`);
  passiveWindow.webContents.debugger.attach("1.3");
  try {
    await passiveWindow.webContents.debugger.sendCommand(
      "Accessibility.enable",
    );
    const tree = await passiveWindow.webContents.debugger.sendCommand(
      "Accessibility.getFullAXTree",
    );
    const names = tree.nodes.map((node) => node.name?.value).filter(Boolean);
    return { semantic, nodeCount: tree.nodes.length, names };
  } finally {
    passiveWindow.webContents.debugger.detach();
  }
}

function assertNoPrivate(value, label) {
  const bytes = JSON.stringify(value);
  for (const canary of [
    ...PRIVATE_STRING_CANARIES,
    ...PRIVATE_IDENTITIES,
    "private-save-dc-23",
    "/vault/scene-b/unknown-room.png",
  ]) {
    if (bytes.includes(canary)) throw new Error(`PRIVATE_STRING_IN_${label}`);
  }
}

async function run() {
  await mkdir(path.dirname(outFile), { recursive: true });
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  gmWindow = await createGmWindow();
  ({ window: passiveWindow, isolatedSession: passiveSession } =
    await createPassiveWindow());
  await sleep(300);

  const surfaces = [];
  const timings = [];
  const focusA0Started = performance.now();
  const focusA0 = channel.focus({
    sceneId: "scene_a",
    knowledgePercent: 0,
    delayMs: 180,
  });
  timings.push({ step: "a0-blank", milliseconds: await waitFor(1, "blank") });
  surfaces.push(await snapshotSurface("a0-blank"));
  await capture("01-a0-blank", "blank");
  await focusA0;
  await waitFor(1, "ready");
  timings.push({
    step: "a0-ready",
    milliseconds: performance.now() - focusA0Started,
  });
  surfaces.push(await snapshotSurface("a0-ready"));
  await capture("02-a0-ready", "ready");

  const staleB = channel.focus({
    sceneId: "scene_b",
    knowledgePercent: 50,
    delayMs: 500,
  });
  await waitFor(2, "blank");
  await sleep(15);
  const focusA100Started = performance.now();
  const focusA100 = channel.focus({
    sceneId: "scene_a",
    knowledgePercent: 100,
    delayMs: 250,
  });
  timings.push({ step: "aba-blank", milliseconds: await waitFor(3, "blank") });
  surfaces.push(await snapshotSurface("aba-blank"));
  await capture("03-aba-blank", "blank");
  await focusA100;
  await waitFor(3, "ready");
  timings.push({
    step: "aba-ready",
    milliseconds: performance.now() - focusA100Started,
  });
  if ((await staleB) !== false)
    throw new Error("STALE_REPLY_WAS_NOT_DISCARDED");
  surfaces.push(await snapshotSurface("aba-ready"));
  await capture("04-aba-ready", "ready");

  const missing = channel.focus({
    sceneId: "scene_b",
    knowledgePercent: 50,
    delayMs: 20,
    failure: "PRIVATE_ASSET_MISSING",
  });
  await waitFor(4, "blank");
  await missing;
  await waitFor(4, "error");
  surfaces.push(await snapshotSurface("asset-missing"));
  await capture("05-asset-missing", "error");

  const corrupt = channel.focus({
    sceneId: "scene_a",
    knowledgePercent: 100,
    delayMs: 20,
    failure: "PRIVATE_ASSET_CORRUPT",
  });
  await waitFor(5, "blank");
  await corrupt;
  await waitFor(5, "error");
  surfaces.push(await snapshotSurface("asset-corrupt"));
  await capture("06-asset-corrupt", "error");

  await channel.focus({ sceneId: "scene_b", knowledgePercent: 50, delayMs: 0 });
  await waitFor(6, "ready");
  const gmBefore = await gmWindow.webContents.executeJavaScript(
    `({ ticks: Number(document.querySelector('#ticks').value), note: document.querySelector('#gm-note').value })`,
  );
  const sinks = await runSinkNegatives();
  await sleep(80);
  const gmAfter = await gmWindow.webContents.executeJavaScript(
    `({ ticks: Number(document.querySelector('#ticks').value), note: document.querySelector('#gm-note').value })`,
  );
  if (gmAfter.ticks <= gmBefore.ticks || gmAfter.note !== gmBefore.note)
    throw new Error("GM_WINDOW_AFFECTED");

  passiveWindow.webContents.setZoomFactor(1);
  passiveWindow.setBounds({ x: 0, y: 0, width: 360, height: 240 });
  await sleep(50);
  passiveWindow.webContents.focus();
  await passiveWindow.webContents.executeJavaScript(
    `document.querySelector('#details').focus()`,
  );
  passiveWindow.webContents.sendInputEvent({
    type: "keyDown",
    keyCode: "Enter",
  });
  passiveWindow.webContents.sendInputEvent({ type: "char", keyCode: "Enter" });
  passiveWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
  await sleep(30);
  const keyboard = await passiveWindow.webContents.executeJavaScript(
    `({ active: document.activeElement?.id, expanded: document.querySelector('#details').getAttribute('aria-expanded') })`,
  );
  const accessibility = await accessibilityEvidence();
  surfaces.push(await snapshotSurface("small-100-percent"));
  await capture("07-small-100-percent", "ready");

  const previousSession = passiveSession;
  passiveWindow.destroy();
  await previousSession.clearStorageData({
    storages: [
      "cookies",
      "localstorage",
      "indexdb",
      "cachestorage",
      "serviceworkers",
    ],
  });
  await previousSession.clearCache();
  ({ window: passiveWindow, isolatedSession: passiveSession } =
    await createPassiveWindow());
  await waitFor(6, "ready");
  const restart = await snapshotSurface("restart-current-only");
  surfaces.push(restart);
  await capture("08-restart-current-only", "ready");

  for (const [scale, transform] of [
    [1, (value) => value],
    [2, (value) => Math.max(0, value - 10)],
  ]) {
    if (!findPrivateRaster(canaryPixels(scale, transform)))
      throw new Error(`PIXEL_ORACLE_FALSE_NEGATIVE_${scale}`);
  }

  const channelEvidence = channel.evidence();
  const allEvidence = {
    channelEvidence,
    surfaces,
    diagnostics,
    frames,
    accessibility,
  };
  assertNoPrivate(allEvidence, "EVIDENCE");
  if (
    JSON.stringify(restart.globals.bridgeKeys) !==
    JSON.stringify([
      "readCoreStatus",
      "readProjection",
      "subscribeProjectionChanged",
    ])
  )
    throw new Error("PASSIVE_BRIDGE_NOT_EXACT");
  if (
    restart.globals.require !== "undefined" ||
    restart.globals.process !== "undefined"
  )
    throw new Error("NODE_REACHED_PASSIVE_RENDERER");
  if (keyboard.active !== "details" || keyboard.expanded !== "true")
    throw new Error("KEYBOARD_PATH_FAILED");
  if (
    accessibility.semantic.lang !== "en" ||
    accessibility.semantic.headings !== 1 ||
    accessibility.semantic.liveRegions !== 1 ||
    accessibility.semantic.unlabeledButtons !== 0 ||
    accessibility.semantic.horizontalOverflow
  )
    throw new Error("ACCESSIBILITY_AUDIT_FAILED");
  if (
    Object.values(sinks).some((value) => typeof value !== "boolean") ||
    !sinks.popup ||
    !sinks.network ||
    !sinks.file ||
    !sinks.clipboard ||
    !sinks.permission ||
    !sinks.navigation ||
    !sinks.serviceWorkerBlocked
  )
    throw new Error("PROTECTED_SINK_REACHED");
  if (
    restart.globals.localStorageBytes !== 0 ||
    restart.globals.cacheKeys !== 0 ||
    restart.globals.serviceWorkerRegistrations !== 0 ||
    restart.globals.indexedDatabases !== 0
  )
    throw new Error("EPHEMERAL_STORAGE_SURVIVED_RESTART");
  const readyTimes = timings
    .filter((item) => item.step.endsWith("ready"))
    .map((item) => item.milliseconds)
    .sort((a, b) => a - b);
  const blankTimes = timings
    .filter((item) => item.step.endsWith("blank"))
    .map((item) => item.milliseconds)
    .sort((a, b) => a - b);
  const evidence = {
    schemaVersion: "p03-evidence-v1",
    platform: process.platform,
    architecture: process.arch,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    windowRoles: ["gm", "passive-display"],
    passiveBridgeKeys: restart.globals.bridgeKeys,
    passiveWebPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      ephemeralPartition: true,
    },
    sequence:
      "scene_a:0/scene_b:50(stale)/scene_a:100/error/error/scene_b:50/restart",
    transitions: transitions.map(({ generation, state }) => ({
      generation,
      state,
    })),
    staleRepliesPublished: 0,
    privateStringMatches: 0,
    privateIdentityMatches: 0,
    privateRasterMatches: 0,
    pixelOraclePositiveControls: 2,
    messageCount: channelEvidence.messages.length,
    messageBytes: channelEvidence.messages.reduce(
      (sum, item) => sum + item.bytes,
      0,
    ),
    timings: {
      samples: timings,
      blankP95Ms: blankTimes.at(-1),
      readyP95Ms: readyTimes.at(-1),
      budgetsMs: { blank: 100, ready: 1000 },
    },
    deniedSinks: {
      attempts: sinks,
      observedMainDenials: [...new Set(deniedSinks)].sort(),
      protectedSinkTouches: 0,
    },
    passiveCapabilities: {
      mutation: 0,
      arbitraryIpc: 0,
      file: 0,
      database: 0,
      gmBridge: 0,
    },
    gmWindow: { before: gmBefore, after: gmAfter, unaffected: true },
    keyboard,
    accessibility,
    persistenceAfterRestart: {
      webStorageEntries: restart.globals.localStorageBytes,
      cacheKeys: restart.globals.cacheKeys,
      serviceWorkerRegistrations: restart.globals.serviceWorkerRegistrations,
      indexedDatabases: restart.globals.indexedDatabases,
      currentGeneration: 6,
      currentScene: "scene_b",
    },
    frames,
    openGates: [
      "windows",
      "macos",
      "heterogeneous-displays",
      "screenreader-smoke",
    ],
  };
  assertNoPrivate(evidence, "AGGREGATE");
  await writeFile(outFile, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

app
  .whenReady()
  .then(run)
  .then(async () => {
    unsubscribe();
    channel.close();
    for (const window of windows) if (!window.isDestroyed()) window.destroy();
    if (passiveSession) {
      await passiveSession.clearStorageData({
        storages: [
          "cookies",
          "localstorage",
          "indexdb",
          "cachestorage",
          "serviceworkers",
        ],
      });
      await passiveSession.clearCache();
    }
    await rm(temporaryProfile, { recursive: true, force: true });
    app.quit();
  })
  .catch(async (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    await rm(temporaryProfile, { recursive: true, force: true }).catch(
      () => {},
    );
    app.exit(1);
  });
