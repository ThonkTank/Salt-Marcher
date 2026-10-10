import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ALL_FAULTS, runMatrix, validateAggregate } from "../../tools/adr-prototypes/p02/matrix.mjs";
import { canonical, reconciliationFor, sha256 } from "../../tools/adr-prototypes/contracts/p02-v1/contract.mjs";
import { request } from "../../tools/adr-prototypes/p02/fixture.mjs";
import { createBackup, createProfile, reconcile } from "../../tools/adr-prototypes/p02/store.mjs";

test("P02 real child-process fault matrix preserves old-or-new truth and verified backup restore", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p02-focused-"));
  try {
    const result = await runMatrix({ runs: 1, root });
    assert.equal(result.profiles, 8);
    assert.deepEqual(result.faultPoints, [...ALL_FAULTS]);
    assert.deepEqual(result.outcomes, {
      mixedTruth: 0,
      duplicateHistory: 0,
      sentinelMutations: 0,
      blindRetries: 0,
    });
    assert.equal(result.cases.filter((item) => item.oldBackupPreserved).length, 1);
    // The focused regression run has one sample per measured path. Keep timing
    // budgets observable here, but qualify them with the dedicated 80-profile
    // matrix rather than a single load-sensitive CI sample.
    assert.equal(result.measurements.safeWriteBudgetMs, 1000);
    assert.equal(result.measurements.resumeBudgetMs, 5000);
    assert.ok(Number.isFinite(result.measurements.safeWriteP95Ms));
    assert.ok(Number.isFinite(result.measurements.crashResumeP95Ms));
    assert.match(result.aggregateDigest, /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P02 committed 80-profile evidence is complete, digest-bound and within budget", async () => {
  const evidence = JSON.parse(await readFile(
    new URL("../../tools/adr-prototypes/evidence/p02-aggregate.json", import.meta.url),
    "utf8",
  ));
  assert.equal(validateAggregate(evidence), true);
});

test("P02 evidence verifier rejects internally consistent attempts to weaken qualification", async () => {
  const baseline = JSON.parse(await readFile(
    new URL("../../tools/adr-prototypes/evidence/p02-aggregate.json", import.meta.url),
    "utf8",
  ));
  const resigned = (mutate) => {
    const value = structuredClone(baseline);
    mutate(value);
    const { aggregateDigest: ignored, ...aggregate } = value;
    value.aggregateDigest = sha256(canonical(aggregate));
    return value;
  };
  const invalid = [
    resigned((value) => { value.measurements.safeWriteBudgetMs = 1_000_000_000; }),
    resigned((value) => { value.measurements.resumeBudgetMs = 1_000_000_000; }),
    resigned((value) => { value.cases[0].observed.mixedTruth = true; }),
    resigned((value) => { value.cases[1].iteration = value.cases[0].iteration; value.cases[1].point = value.cases[0].point; }),
    resigned((value) => { value.cases.find((item) => item.point === "during_backup").oldBackupPreserved = false; }),
    resigned((value) => { value.measurements.safeWriteP95Ms = 0; }),
    resigned((value) => { value.cases.find((item) => item.safeWriteMs !== undefined).safeWriteMs = Number.NaN; }),
    resigned((value) => {
      const item = value.cases[0].inventoryBeforeRecovery.find((entry) => entry.name === "campaign.sqlite");
      Object.assign(item, { kind: "directory", bytes: null, sha256: null });
    }),
    resigned((value) => {
      value.cases[0].inventoryBeforeRecovery.push(structuredClone(
        value.cases.find((item) => item.point === "during_backup").inventoryBeforeRecovery
          .find((entry) => entry.name === "backup.sqlite"),
      ));
    }),
  ];
  for (const value of invalid) assert.throws(() => validateAggregate(value));
});

test("P02 lock recovery distinguishes a reused PID from the live process incarnation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p02-incarnation-lock-"));
  try {
    await createProfile(root);
    const lock = path.join(root, ".p02-authority.lock"), ownerFile = path.join(lock, "owner.json");
    const stat = await readFile(`/proc/${process.pid}/stat`, "utf8");
    const startTime = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u)[19];
    const bootId = (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
    await mkdir(lock);
    await writeFile(ownerFile, `${JSON.stringify({ pid: process.pid, startTime: `${BigInt(startTime) + 1n}`, bootId })}\n`);
    await new Promise((resolve) => setTimeout(resolve, 125));
    assert.equal((await reconcile(root, reconciliationFor(request(1)))).outcome, "not_applied");

    await mkdir(lock);
    await writeFile(ownerFile, `${JSON.stringify({ pid: process.pid, startTime, bootId })}\n`);
    const pending = reconcile(root, reconciliationFor(request(1)));
    await new Promise((resolve) => setTimeout(resolve, 150));
    await access(ownerFile);
    await rm(lock, { recursive: true, force: true });
    assert.equal((await pending).outcome, "not_applied");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P02 same-process reconcile yields while an asynchronous backup owns authority", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "p02-same-process-"));
  try {
    await createProfile(root);
    const backup = createBackup(root, path.join(root, "backup.sqlite"));
    const reconciliation = reconcile(root, reconciliationFor(request(1)));
    const [receipt, result] = await Promise.all([backup, reconciliation]);
    assert.match(receipt.backupSha256, /^[a-f0-9]{64}$/);
    assert.equal(result.outcome, "not_applied");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P02 recovery reclaims crashed locks with absent or incomplete owner records", async () => {
  for (const [label, owner] of [["absent", null], ["empty", ""], ["truncated", '{"pid":']]) {
    const root = await mkdtemp(path.join(tmpdir(), `p02-${label}-lock-`));
    try {
      await createProfile(root);
      const lock = path.join(root, ".p02-authority.lock");
      await mkdir(lock);
      if (owner !== null) await writeFile(path.join(lock, "owner.json"), owner);
      await new Promise((resolve) => setTimeout(resolve, 125));
      const started = performance.now();
      const result = await reconcile(root, reconciliationFor(request(1)));
      assert.equal(result.outcome, "not_applied");
      assert.ok(performance.now() - started < 5000);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
