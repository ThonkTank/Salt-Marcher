import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import electron from "electron";
import { digest, receiptRecord } from "../contracts/p01-v2/node.mjs";

const require = createRequire(import.meta.url);
const { prepareLargeV4 } = require("../../large-fixture.cjs");
const evidenceBase = process.env.SMR_ADR_EVIDENCE_ROOT;
const allowedEvidenceRoot = "/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes";
const resolvedEvidenceBase = evidenceBase ? resolve(evidenceBase) : "";
if (!resolvedEvidenceBase || (resolvedEvidenceBase !== allowedEvidenceRoot &&
    !resolvedEvidenceBase.startsWith(`${allowedEvidenceRoot}/`)))
  throw new Error("SMR_ADR_EVIDENCE_ROOT must be the external native QA root");
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const dirty = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout.trim().length > 0;
if (dirty && process.env.SMR_ADR_DIAGNOSTIC_DIRTY !== "1")
  throw new Error("H02 evidence requires a clean source commit");
const receiptId = `h02-${Date.now()}-${crypto.randomUUID()}`;
const packageEvidenceRoot = join(resolvedEvidenceBase, "ADR-P01-H02");
const evidenceRoot = join(packageEvidenceRoot, receiptId);
const buildRoot = resolve(".build/adr-prototypes/ADR-P01-H02", sourceCommit);
await mkdir(packageEvidenceRoot, { recursive: true });
await mkdir(evidenceRoot, { recursive: false });
await mkdir(buildRoot, { recursive: true });

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
async function fileIdentity(path) {
  const bytes = await readFile(path);
  return { path, sha256: sha256(bytes), bytes: bytes.byteLength };
}
const productPaths = ["main.js", "manifest.json", "styles.css"];
const productBefore = Object.fromEntries(await Promise.all(productPaths.map(async (path) =>
  [path, await fileIdentity(resolve(path))])));
const lockfile = await fileIdentity(resolve("package-lock.json"));
const nativeSource = await fileIdentity(resolve("tools/adr-prototypes/p01/native-helper.c"));

const helper = join(buildRoot, "native-helper");
const compiled = spawnSync("gcc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
  resolve("tools/adr-prototypes/p01/native-helper.c"), "-o", helper], { encoding: "utf8" });
if (compiled.status !== 0) throw new Error(compiled.stderr);
const loadedLibraries = spawnSync("ldd", [helper], { encoding: "utf8" });
if (loadedLibraries.status !== 0) throw new Error(loadedLibraries.stderr);
const utility = join(buildRoot, "utility.cjs");
const preload = join(buildRoot, "preload.cjs");
await build({ entryPoints: [resolve("tools/adr-prototypes/p01/utility-entry.ts")], outfile: utility,
  bundle: true, platform: "node", format: "cjs", target: "node22", external: ["electron"] });
await build({ entryPoints: [resolve("tools/adr-prototypes/p01/preload-entry.mjs")], outfile: preload,
  bundle: true, platform: "node", format: "cjs", target: "node22", external: ["electron"] });

const fixtureSource = await mkdtemp(join(evidenceRoot, "fixture-source-"));
const prepared = prepareLargeV4(fixtureSource);
const largeSource = join(fixtureSource, prepared.path);
const largeBytes = await readFile(largeSource);
const largeDocument = JSON.parse(largeBytes);
const floorId = largeDocument.floors[0].id;
const movable = largeDocument.entities.find((entity) => entity.floorId === floorId &&
  typeof entity.x === "number" && typeof entity.y === "number");
const smallDocument = { ...structuredClone(largeDocument), id: "h02-small-v4",
  settings: { ...largeDocument.settings, name: "H02 small", width: 30, height: 30 },
  floors: [largeDocument.floors[0]], entities: [movable],
  content: { definitions: [], occurrences: [], routes: [], archive: [] } };
const fixtures = { small: smallDocument, large: largeDocument };
const renderer = resolve("tools/adr-prototypes/p01/renderer-script.js");
const main = resolve("tools/adr-prototypes/p01/electron-app");
const runs = [];
async function runElectron(root, mode, resultPath, expectedDigest) {
  const launchConfiguration = join(root, `launch-${mode}.json`);
  await writeFile(launchConfiguration, JSON.stringify({ root, helper, utility, preload, renderer,
    result: resultPath, mode, expectedDigest: expectedDigest ?? null }));
  const argumentsList = ["--ozone-platform=x11", main, launchConfiguration];
  const execution = spawnSync(electron, argumentsList, { encoding: "utf8", timeout: 45000,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" } });
  if (execution.status !== 0) throw new Error(`Electron ${mode} failed: ${execution.stderr}\n${execution.stdout}`);
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (result.status !== "passed") throw new Error(`Electron ${mode} result failed: ${result.error}`);
  return { ...result, processExitCode: execution.status };
}

for (const [fixtureName, document] of Object.entries(fixtures)) {
  const root = join(evidenceRoot, fixtureName);
  await mkdir(root);
  const baseline = JSON.stringify(document, null, 2) + "\n";
  await writeFile(join(root, "map.dungeon"), baseline);
  const editPath = join(root, "edit.json");
  const edit = await runElectron(root, "edit", editPath);
  const reopenPath = join(root, "reopen.json");
  const reopen = await runElectron(root, "reopen", reopenPath, edit.renderer.finalDigest);
  const finalBytes = await readFile(join(root, "map.dungeon"));
  runs.push({ fixtureName, baselineSha256: sha256(baseline), finalSha256: sha256(finalBytes),
    baselineDigest: digest(document), finalDigest: edit.renderer.finalDigest,
    editResult: editPath, reopenResult: reopenPath, edit, reopen });
}

const processBoundaryPassed = runs.every(({ edit, reopen }) => [edit, reopen].every((run) => {
  const processRecords = Object.values(run.processes);
  const pids = processRecords.map((entry) => entry?.pid).filter(Boolean);
  const tokens = processRecords.map((entry) => entry?.token).filter(Boolean);
  return new Set(pids).size === 4 && new Set(tokens).size === 4 &&
    run.processes.renderer.ancestors.includes(run.processes.main.pid) &&
    run.processes.utility.ppid === run.processes.main.pid &&
    run.processes.helper.ppid === run.processes.utility.pid &&
    processRecords.every((entry) => entry.startedAt) &&
    run.security.sandbox && run.security.contextIsolation &&
    !run.security.nodeIntegration && run.renderer.boundary.requireType === "undefined" &&
    run.renderer.boundary.processType === "undefined" &&
    run.renderer.boundary.ipcRendererType === "undefined" &&
    run.renderer.boundary.rawSendType === "undefined" && run.renderer.boundary.apiFrozen &&
    run.renderer.boundary.directFileDenied && run.renderer.asset.dataMatches &&
    run.lifecycle.helperExitCode === 0 &&
    run.lifecycle.utilityExitCode === 0;
}));
const restartPassed = runs.every((run) => run.edit.renderer.finalDigest === run.reopen.renderer.finalDigest &&
  run.edit.renderer.initialDigest !== run.edit.renderer.finalDigest && run.baselineSha256 !== run.finalSha256 &&
  run.edit.renderer.undoDigest === run.edit.renderer.initialDigest &&
  run.edit.renderer.redoDigest === run.edit.renderer.finalDigest);
const productAfter = Object.fromEntries(await Promise.all(productPaths.map(async (path) =>
  [path, await fileIdentity(resolve(path))])));
const productBytesUnchanged = productPaths.every((path) =>
  productBefore[path].sha256 === productAfter[path].sha256 &&
  productBefore[path].bytes === productAfter[path].bytes);
const receipt = receiptRecord({
  package: "ADR-P01-H02",
  receiptId,
  sourceCommit,
  dirty,
  platform: { os: process.platform, arch: process.arch, node: process.version,
    electron: require("electron/package.json").version,
    npm: spawnSync("npm", ["--version"], { encoding: "utf8" }).stdout.trim(),
    kernel: spawnSync("uname", ["-r"], { encoding: "utf8" }).stdout.trim(),
    compiler: spawnSync("gcc", ["--version"], { encoding: "utf8" }).stdout.split("\n")[0],
    libc: spawnSync("ldd", ["--version"], { encoding: "utf8" }).stdout.split("\n")[0] },
  reproducibility: {
    command: "SMR_ADR_EVIDENCE_ROOT=/home/aaron/.cache/dungeon-native-qa/smr-adr-prototypes/h02-runs npm run adr:p01-h02",
    nativeBuildCommand: `gcc -std=c11 -O2 -Wall -Wextra -Werror ${nativeSource.path} -o ${helper}`,
    lockfile,
    nativeSource,
    loadedLibraries: loadedLibraries.stdout.trim().split("\n"),
  },
  productInputs: { before: productBefore, after: productAfter },
  artifacts: { helper: { path: helper, sha256: sha256(await readFile(helper)), bytes: (await stat(helper)).size },
    utility: { sha256: sha256(await readFile(utility)), bytes: (await stat(utility)).size },
    preload: { sha256: sha256(await readFile(preload)), bytes: (await stat(preload)).size } },
  gates: { realProcessBoundary: processBoundaryPassed ? "passed" : "failed",
    mapSaveFreshRestart: restartPassed ? "passed" : "failed",
    contractAndNativePreflight: "passed",
    productBytesUnchanged: productBytesUnchanged ? "passed" : "failed",
    installedObsidianAdapterBytesUnchanged: "not-run",
    durableReceiptStateMachine: "not-run",
    completeFaultMatrix: "not-run",
    windows: "not-run", macos: "not-run", accessibility: "not-run" },
  runs,
  decision: dirty ? "Diagnostic only: dirty source cannot satisfy a gate"
    : processBoundaryPassed && restartPassed && productBytesUnchanged
    ? "No-Go: real Linux process boundary and fresh restart passed, but durable receipt and complete fault gates remain not-run"
    : "No-Go: real process boundary, restart, or product-byte gate failed",
});
await writeFile(join(evidenceRoot, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ evidenceRoot, receipt: join(evidenceRoot, "receipt.json"),
  receiptSha256: sha256(await readFile(join(evidenceRoot, "receipt.json"))), decision: receipt.decision }, null, 2));
