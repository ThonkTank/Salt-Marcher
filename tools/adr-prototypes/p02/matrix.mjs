import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, commandDigest, sha256 } from "../contracts/p02-v1/contract.mjs";
import { request } from "./fixture.mjs";
import { createProfile, DATABASE_FILE, fileInventory, FIXTURE, restoreBackup, snapshot } from "./store.mjs";

export const EXECUTE_FAULTS = Object.freeze([
  "before_begin",
  "after_begin",
  "after_object",
  "after_history",
  "after_receipt",
  "after_commit",
  "before_response",
]);
export const ALL_FAULTS = Object.freeze([...EXECUTE_FAULTS, "during_backup"]);
const committedFaults = new Set(["after_commit", "before_response"]);
const worker = fileURLToPath(new URL("./worker.mjs", import.meta.url));

const child = (mode, root, input, faultPoint = "") => {
  const started = performance.now();
  const value = spawnSync(process.execPath, [worker, mode, root, input, faultPoint], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return { ...value, elapsedMs: performance.now() - started };
};
const output = (run) => {
  assert.equal(run.status, 0, run.stderr || `worker failed with ${run.signal}`);
  return JSON.parse(run.stdout);
};
const killed = (run) => {
  assert.equal(run.status, null);
  assert.equal(run.signal, "SIGKILL");
  assert.equal(run.error, undefined);
};
const names = (state) => Object.fromEntries(state.objects.map((item) => [item.id, item.name]));
const truth = (state, revision, targetName, history, receipts) => {
  assert.equal(state.campaign.length, 1);
  assert.equal(state.campaign[0].revision, revision);
  assert.equal(names(state)[FIXTURE.targetId], targetName);
  assert.equal(names(state)[FIXTURE.sentinelId], FIXTURE.originalName);
  assert.equal(state.history.length, history);
  assert.equal(state.receipts.length, receipts);
};
const allowedInventory = (inventory) => {
  for (const item of inventory)
    assert.match(item.name, /^(campaign\.sqlite(?:-wal|-shm|-journal)?|backup\.sqlite(?:\.pending(?:-wal|-shm|-journal)?)?|\.p02-authority\.lock|restore-verified\.json)$/);
};
const percentile95 = (values) => values.slice().sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * 0.95) - 1)];
const roundedP95 = (values) => Number(percentile95(values).toFixed(3));
const finiteDuration = (value, label) => {
  assert.ok(Number.isFinite(value) && value >= 0, `${label} must be a finite non-negative duration`);
};
const validateInventory = (inventory, label, backupCase) => {
  assert.ok(Array.isArray(inventory) && inventory.length > 0, `${label} must be a non-empty inventory`);
  allowedInventory(inventory);
  const expectedNames = backupCase ? [
    ".p02-authority.lock",
    "backup.sqlite",
    "backup.sqlite.pending",
    "backup.sqlite.pending-journal",
    "backup.sqlite.pending-shm",
    "backup.sqlite.pending-wal",
    "campaign.sqlite",
    "campaign.sqlite-shm",
    "campaign.sqlite-wal",
  ] : ["campaign.sqlite", "campaign.sqlite-shm", "campaign.sqlite-wal"];
  assert.deepEqual(inventory.map((item) => item.name).sort(), expectedNames, `${label} has an incomplete or foreign inventory`);
  for (const item of inventory) {
    assert.deepEqual(Object.keys(item).sort(), ["bytes", "kind", "name", "sha256"]);
    if (item.name === ".p02-authority.lock") {
      assert.equal(item.kind, "directory");
      assert.equal(item.bytes, null);
      assert.equal(item.sha256, null);
    } else {
      assert.equal(item.kind, "file");
      assert.ok(Number.isSafeInteger(item.bytes) && item.bytes >= 0, `${label}.${item.name} has invalid bytes`);
      assert.match(item.sha256, /^[a-f0-9]{64}$/u);
    }
  }
};

export function validateAggregate(value, { expectedRuns = 10, qualifyBudgets = true } = {}) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "aggregate must be an object");
  assert.equal(value.schemaVersion, "p02-aggregate-v1");
  assert.equal(value.platform, "linux");
  assert.ok(Number.isSafeInteger(expectedRuns) && expectedRuns > 0);
  assert.equal(value.runsPerFault, expectedRuns);
  assert.deepEqual(value.faultPoints, [...ALL_FAULTS]);
  assert.ok(Array.isArray(value.cases));
  assert.equal(value.profiles, ALL_FAULTS.length * expectedRuns);
  assert.equal(value.cases.length, value.profiles);

  const pairs = new Set(), elapsed = [], safeWrites = [], resumes = [];
  const rawOutcomes = { mixedTruth: 0, duplicateHistory: 0, sentinelMutations: 0, blindRetries: 0 };
  for (const item of value.cases) {
    assert.ok(item && typeof item === "object" && !Array.isArray(item), "case must be an object");
    assert.ok(ALL_FAULTS.includes(item.point), `unknown fault point: ${item.point}`);
    assert.ok(Number.isSafeInteger(item.iteration) && item.iteration >= 1 && item.iteration <= expectedRuns,
      `invalid iteration for ${item.point}`);
    const pair = `${item.point}:${item.iteration}`;
    assert.ok(!pairs.has(pair), `duplicate matrix case: ${pair}`);
    pairs.add(pair);
    finiteDuration(item.faultElapsedMs, `${pair}.faultElapsedMs`);
    elapsed.push(item.faultElapsedMs);
    validateInventory(item.inventoryBeforeRecovery, `${pair}.inventoryBeforeRecovery`, item.point === "during_backup");
    assert.deepEqual(Object.keys(item.observed).sort(), ["blindRetry", "duplicateHistory", "mixedTruth", "sentinelMutation"]);
    for (const [rawKey, aggregateKey] of [
      ["mixedTruth", "mixedTruth"],
      ["duplicateHistory", "duplicateHistory"],
      ["sentinelMutation", "sentinelMutations"],
      ["blindRetry", "blindRetries"],
    ]) {
      assert.equal(typeof item.observed[rawKey], "boolean", `${pair}.observed.${rawKey} must be boolean`);
      if (item.observed[rawKey]) rawOutcomes[aggregateKey] += 1;
    }
    if (item.point === "during_backup") {
      assert.deepEqual(Object.keys(item).sort(), [
        "faultElapsedMs", "inventoryBeforeRecovery", "iteration", "observed", "oldBackupPreserved",
        "point", "restoredNew", "restoredOld",
      ]);
      assert.ok(!("safeWriteMs" in item) && !("resumeMs" in item), `${pair} has execute-only timing fields`);
      assert.equal(item.oldBackupPreserved, true, `${pair} did not preserve the old backup`);
      assert.equal(item.restoredOld, true, `${pair} did not restore the old backup`);
      assert.equal(item.restoredNew, true, `${pair} did not restore the new backup`);
    } else {
      assert.deepEqual(Object.keys(item).sort(), [
        "faultElapsedMs", "inventoryBeforeRecovery", "iteration", "observed", "point", "resumeMs", "safeWriteMs",
      ]);
      for (const key of ["oldBackupPreserved", "restoredOld", "restoredNew"])
        assert.ok(!(key in item), `${pair} has backup-only field ${key}`);
      finiteDuration(item.safeWriteMs, `${pair}.safeWriteMs`);
      finiteDuration(item.resumeMs, `${pair}.resumeMs`);
      safeWrites.push(item.safeWriteMs);
      resumes.push(item.resumeMs);
    }
  }
  assert.equal(pairs.size, ALL_FAULTS.length * expectedRuns);
  assert.deepEqual(value.outcomes, rawOutcomes);
  assert.deepEqual(value.outcomes, {
    mixedTruth: 0,
    duplicateHistory: 0,
    sentinelMutations: 0,
    blindRetries: 0,
  });

  assert.ok(value.measurements && typeof value.measurements === "object");
  for (const key of ["hardFaultP95Ms", "safeWriteP95Ms", "crashResumeP95Ms"])
    finiteDuration(value.measurements[key], `measurements.${key}`);
  assert.equal(value.measurements.safeWriteBudgetMs, 1000);
  assert.equal(value.measurements.resumeBudgetMs, 5000);
  assert.equal(value.measurements.hardFaultP95Ms, roundedP95(elapsed));
  assert.equal(value.measurements.safeWriteP95Ms, roundedP95(safeWrites));
  assert.equal(value.measurements.crashResumeP95Ms, roundedP95(resumes));
  if (qualifyBudgets) {
    assert.ok(value.measurements.safeWriteP95Ms <= 1000, "safe-write p95 exceeds the fixed 1000 ms budget");
    assert.ok(value.measurements.crashResumeP95Ms <= 5000, "crash-resume p95 exceeds the fixed 5000 ms budget");
  }
  const { aggregateDigest, ...aggregate } = value;
  assert.equal(aggregateDigest, sha256(canonical(aggregate)), "aggregate digest does not bind the evidence");
  return true;
}

async function executeCase(parent, point, iteration) {
  const caseRoot = path.join(parent, `${point}-${String(iteration).padStart(2, "0")}`), source = path.join(caseRoot, "source");
  await createProfile(source);
  const first = request(1), firstFile = path.join(caseRoot, "request-1.json");
  await writeFile(firstFile, `${JSON.stringify(first)}\n`);
  const faultRun = child("execute", source, firstFile, point);
  killed(faultRun);
  const resumeStarted = performance.now();
  const inventoryBeforeRecovery = await fileInventory(source);
  allowedInventory(inventoryBeforeRecovery);
  const recovered = output(child("snapshot", source, firstFile));
  if (committedFaults.has(point)) truth(recovered, 1, first.command.newName, 1, 1);
  else truth(recovered, 0, FIXTURE.originalName, 0, 0);

  const reconciliation = output(child("reconcile", source, firstFile));
  assert.equal(reconciliation.outcome, committedFaults.has(point) ? "applied" : "not_applied");
  let retry;
  if (reconciliation.outcome === "not_applied") {
    const retryFile = path.join(caseRoot, "retry-not-applied.json");
    await writeFile(retryFile, `${JSON.stringify(first)}\n`);
    const guarded = output(child("guarded-retry", source, retryFile));
    assert.equal(guarded.mutationHandlerEntered, true);
    retry = guarded.result;
  } else retry = output(child("execute", source, firstFile));
  assert.equal(retry.outcome, committedFaults.has(point) ? "already_applied" : "applied");
  const duplicate = output(child("execute", source, firstFile));
  assert.equal(duplicate.outcome, "already_applied");
  truth(output(child("snapshot", source, firstFile)), 1, first.command.newName, 1, 1);

  const follow = request(2, 1), followFile = path.join(caseRoot, "request-2.json");
  await writeFile(followFile, `${JSON.stringify(follow)}\n`);
  const followRun = child("execute", source, followFile);
  assert.equal(output(followRun).outcome, "applied");
  const resumeMs = performance.now() - resumeStarted;
  truth(output(child("snapshot", source, followFile)), 2, follow.command.newName, 2, 2);

  const conflicting = structuredClone(first);
  conflicting.command.newName = "Different payload under reused commandId";
  conflicting.commandDigest = commandDigest(conflicting.command);
  const conflictingFile = path.join(caseRoot, "conflicting.json");
  await writeFile(conflictingFile, `${JSON.stringify(conflicting)}\n`);
  assert.equal(output(child("execute", source, conflictingFile)).outcome, "rejected");

  const stale = request(99, 1), staleFile = path.join(caseRoot, "stale.json");
  await writeFile(staleFile, `${JSON.stringify(stale)}\n`);
  const conflict = output(child("execute", source, staleFile));
  assert.equal(conflict.outcome, "revision_conflict");
  const conflictRetryFile = path.join(caseRoot, "retry-conflict.json");
  await writeFile(conflictRetryFile, `${JSON.stringify(stale)}\n`);
  const conflictRetry = output(child("guarded-retry", source, conflictRetryFile));
  assert.deepEqual(conflictRetry, { mutationHandlerEntered: false, blockedAfter: "revision_conflict", result: null });

  const unknownRequest = request(100, 2), unknownFile = path.join(caseRoot, "unknown.json");
  await writeFile(unknownFile, `${JSON.stringify(unknownRequest)}\n`);
  const database = path.join(source, DATABASE_FILE), unavailable = `${database}.temporarily-unavailable`;
  await rename(database, unavailable);
  let unknown;
  try { unknown = output(child("reconcile", source, unknownFile)); }
  finally { await rename(unavailable, database); }
  assert.equal(unknown.outcome, "outcome_unknown");
  const unknownRetry = output(child("execute", source, unknownFile));
  assert.equal(unknownRetry.outcome, "outcome_unknown");
  const unknownCollision = structuredClone(unknownRequest);
  unknownCollision.command.newName = "Collision while original outcome is unknown";
  unknownCollision.commandDigest = commandDigest(unknownCollision.command);
  const unknownCollisionFile = path.join(caseRoot, "unknown-collision.json");
  await writeFile(unknownCollisionFile, `${JSON.stringify(unknownCollision)}\n`);
  assert.equal(output(child("execute", source, unknownCollisionFile)).outcome, "rejected");
  assert.equal(output(child("reconcile", source, unknownFile)).outcome, "not_applied");
  assert.equal(output(child("execute", source, unknownCollisionFile)).outcome, "rejected");
  truth(output(child("snapshot", source, followFile)), 2, follow.command.newName, 2, 2);
  return {
    point, iteration, faultElapsedMs: faultRun.elapsedMs, safeWriteMs: followRun.elapsedMs, resumeMs, inventoryBeforeRecovery,
    observed: { mixedTruth: false, duplicateHistory: false, sentinelMutation: false, blindRetry: false },
  };
}

async function backupCase(parent, iteration) {
  const point = "during_backup", caseRoot = path.join(parent, `${point}-${String(iteration).padStart(2, "0")}`),
    source = path.join(caseRoot, "source"), backups = path.join(caseRoot, "backups"), backup = path.join(backups, "backup.sqlite");
  await createProfile(source); await mkdir(backups, { recursive: true });
  const dummy = path.join(caseRoot, "unused.json"); await writeFile(dummy, "{}\n");
  const publishedReceipt = output(child("backup", source, backup));
  const publishedBytes = await readFile(backup), publishedHash = sha256(publishedBytes), publishedOld = snapshot(source);
  const first = request(1), firstFile = path.join(caseRoot, "request-1.json"); await writeFile(firstFile, `${JSON.stringify(first)}\n`);
  assert.equal(output(child("execute", source, firstFile)).outcome, "applied");
  const reserved = request(100, 1), reservedFile = path.join(caseRoot, "reserved.json");
  await writeFile(reservedFile, `${JSON.stringify(reserved)}\n`);
  const sourceDatabase = path.join(source, DATABASE_FILE), unavailable = `${sourceDatabase}.temporarily-unavailable`;
  await rename(sourceDatabase, unavailable);
  try { assert.equal(output(child("reconcile", source, reservedFile)).outcome, "outcome_unknown"); }
  finally { await rename(unavailable, sourceDatabase); }
  const blockedBackup = child("backup", source, backup);
  assert.equal(blockedBackup.status, 1);
  assert.match(blockedBackup.stderr, /backup is blocked while command outcomes remain unknown/);
  assert.equal(sha256(await readFile(backup)), publishedHash);
  assert.equal(output(child("reconcile", source, reservedFile)).outcome, "not_applied");
  const reservedCollision = structuredClone(reserved);
  reservedCollision.command.newName = "Reserved command collision after restore";
  reservedCollision.commandDigest = commandDigest(reservedCollision.command);
  const reservedCollisionFile = path.join(caseRoot, "reserved-collision.json");
  await writeFile(reservedCollisionFile, `${JSON.stringify(reservedCollision)}\n`);
  assert.equal(output(child("execute", source, reservedCollisionFile)).outcome, "rejected");
  const sourceNew = snapshot(source); assert.notEqual(sourceNew.semanticDigest, publishedOld.semanticDigest);
  const faultRun = child("backup", source, backup, point); killed(faultRun);
  assert.equal(sha256(await readFile(backup)), publishedHash);
  assert.equal(snapshot(source).semanticDigest, sourceNew.semanticDigest);
  const inventoryBeforeRecovery = [...await fileInventory(source), ...await fileInventory(backups)];
  allowedInventory(inventoryBeforeRecovery);
  const restoreOld = path.join(caseRoot, "restore-old");
  assert.equal((await restoreBackup(backup, restoreOld, publishedReceipt)).semanticDigest, publishedOld.semanticDigest);
  const newReceipt = output(child("backup", source, backup));
  const restoreNew = path.join(caseRoot, "restore-new");
  assert.equal((await restoreBackup(backup, restoreNew, newReceipt)).semanticDigest, sourceNew.semanticDigest);
  assert.equal(output(child("execute", restoreNew, reservedCollisionFile)).outcome, "rejected");
  assert.equal(output(child("execute", restoreNew, reservedFile)).outcome, "applied");
  const follow = request(2, 1), followFile = path.join(caseRoot, "request-2.json"); await writeFile(followFile, `${JSON.stringify(follow)}\n`);
  assert.equal(output(child("execute", source, followFile)).outcome, "applied");
  truth(snapshot(source), 2, follow.command.newName, 2, 2);
  return {
    point, iteration, faultElapsedMs: faultRun.elapsedMs, inventoryBeforeRecovery,
    oldBackupPreserved: true, restoredOld: true, restoredNew: true,
    observed: { mixedTruth: false, duplicateHistory: false, sentinelMutation: false, blindRetry: false },
  };
}

export async function runMatrix({ runs = 10, root } = {}) {
  const ownedRoot = !root, parent = root ?? await mkdtemp(path.join(tmpdir(), "p02-matrix-"));
  await mkdir(parent, { recursive: true });
  const cases = [];
  try {
    for (let iteration = 1; iteration <= runs; iteration++) {
      for (const point of EXECUTE_FAULTS) cases.push(await executeCase(parent, point, iteration));
      cases.push(await backupCase(parent, iteration));
    }
    const elapsed = cases.map((item) => item.faultElapsedMs);
    const safeWrites = cases.flatMap((item) => Number.isFinite(item.safeWriteMs) ? [item.safeWriteMs] : []);
    const resumes = cases.flatMap((item) => Number.isFinite(item.resumeMs) ? [item.resumeMs] : []);
    const count = (key) => cases.filter((item) => item.observed[key]).length;
    const aggregate = {
      schemaVersion: "p02-aggregate-v1",
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      runsPerFault: runs,
      faultPoints: [...ALL_FAULTS],
      profiles: cases.length,
      outcomes: {
        mixedTruth: count("mixedTruth"),
        duplicateHistory: count("duplicateHistory"),
        sentinelMutations: count("sentinelMutation"),
        blindRetries: count("blindRetry"),
      },
      measurements: {
        hardFaultP95Ms: roundedP95(elapsed),
        safeWriteP95Ms: roundedP95(safeWrites),
        safeWriteBudgetMs: 1000,
        crashResumeP95Ms: roundedP95(resumes),
        resumeBudgetMs: 5000,
      },
      cases,
    };
    return Object.freeze({ ...aggregate, aggregateDigest: sha256(canonical(aggregate)) });
  } finally {
    if (ownedRoot) await rm(parent, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), runsAt = args.indexOf("--runs"), outAt = args.indexOf("--out"), rootAt = args.indexOf("--root");
  const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 10;
  const root = rootAt >= 0 ? args[rootAt + 1] : undefined;
  const aggregate = await runMatrix({ runs, root });
  validateAggregate(aggregate, { expectedRuns: runs, qualifyBudgets: runs >= 10 });
  const rendered = `${JSON.stringify(aggregate, null, 2)}\n`;
  if (outAt >= 0) await writeFile(args[outAt + 1], rendered);
  else process.stdout.write(rendered);
}
