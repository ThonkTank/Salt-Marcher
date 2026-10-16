import { mkdir, readdir, rename, rm, copyFile, writeFile, lstat, readFile, open as openFile } from "node:fs/promises";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  SCHEMA_VERSION,
  canonical,
  commandDigest,
  reconciliationFor,
  receiptDigest,
  sha256,
  validateReceipt,
  validateCommand,
  validateExecuteResult,
  validateReconcileRequest,
  validateReconcileResult,
  validateRequest,
} from "../contracts/p02-v1/contract.mjs";

export const DATABASE_FILE = "campaign.sqlite";
export const FIXTURE = Object.freeze({
  campaignId: "campaign_minimal_v1_seed",
  targetId: "same_name_object_target_01",
  sentinelId: "same_name_object_sentinel_01",
  campaignName: "P02 Minimal Campaign",
  originalName: "Same Name",
});

const fault = (selected, point) => {
  if (selected === point) process.kill(process.pid, "SIGKILL");
};
const databasePath = (root) => path.join(root, DATABASE_FILE);

function open(root, readonly = false) {
  const db = new Database(databasePath(root), readonly ? { readonly: true, fileMustExist: true } : undefined);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  if (!readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");
  }
  return db;
}

export async function createProfile(root) {
  await mkdir(root, { recursive: true });
  const db = open(root);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS campaign (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS campaign_object (
        id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaign(id), name TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS campaign_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id TEXT NOT NULL REFERENCES campaign(id),
        command_id TEXT NOT NULL UNIQUE, object_id TEXT NOT NULL, fact TEXT NOT NULL,
        committed_revision INTEGER NOT NULL,
        UNIQUE(campaign_id, committed_revision)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS command_receipt (
        command_id TEXT PRIMARY KEY, command_digest TEXT NOT NULL, expected_revision INTEGER NOT NULL,
        command_json TEXT NOT NULL, receipt_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS command_authority (
        command_id TEXT PRIMARY KEY, command_digest TEXT NOT NULL, expected_revision INTEGER NOT NULL
      ) STRICT;
    `);
    const count = db.prepare("SELECT count(*) AS n FROM campaign").get().n;
    if (count === 0) {
      const seed = db.transaction(() => {
        db.prepare("INSERT INTO campaign(id,name,revision) VALUES(?,?,0)").run(FIXTURE.campaignId, FIXTURE.campaignName);
        const insert = db.prepare("INSERT INTO campaign_object(id,campaign_id,name) VALUES(?,?,?)");
        insert.run(FIXTURE.targetId, FIXTURE.campaignId, FIXTURE.originalName);
        insert.run(FIXTURE.sentinelId, FIXTURE.campaignId, FIXTURE.originalName);
      });
      seed();
    }
  } finally {
    db.close();
  }
  return snapshot(root);
}

const parseReceipt = (row, request = null) => {
  if (!row) return null;
  const receipt = validateReceipt(JSON.parse(row.receipt_json));
  if (canonical(receipt) !== row.receipt_json) throw new Error("receipt row is not canonical");
  for (const [column, key] of [["command_id", "commandId"], ["command_digest", "commandDigest"], ["expected_revision", "expectedRevision"]]) {
    if (row[column] !== receipt[key]) throw new Error(`receipt row does not bind ${key}`);
    if (request && request[key] !== receipt[key]) throw new Error(`receipt request does not bind ${key}`);
  }
  const command = validateCommand(JSON.parse(row.command_json));
  if (canonical(command) !== row.command_json || commandDigest(command) !== receipt.commandDigest)
    throw new Error("receipt command bytes do not bind digest");
  if (command.campaignId !== receipt.campaignId || command.objectId !== receipt.objectId ||
      command.newName !== receipt.afterName || command.historyFact !== receipt.historyFact)
    throw new Error("receipt does not bind command payload");
  return receipt;
};
const resultValue = (request, outcome, currentRevision, receipt = null, reason = null) => ({
  schemaVersion: SCHEMA_VERSION,
  outcome,
  commandId: request.commandId,
  commandDigest: request.commandDigest,
  expectedRevision: request.expectedRevision,
  currentRevision,
  receipt,
  reason,
});
const executeResult = (...args) => validateExecuteResult(resultValue(...args));
const reconcileResult = (...args) => validateReconcileResult(resultValue(...args));

const uncertaintyDirectory = (root) => path.join(root, ".p02-uncertain");
const authorityLock = (root) => path.join(root, ".p02-authority.lock");
const uncertaintyPath = (root, request) => path.join(
  uncertaintyDirectory(root),
  `${sha256(request.commandId)}.json`,
);
const syncDirectory = (directory) => {
  const fd = openSync(directory, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
};
const processIdentity = (pid) => {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8"), afterCommand = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u);
  const startTime = afterCommand[19], bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  if (!/^\d+$/u.test(startTime) || !/^[a-f0-9-]{36}$/u.test(bootId)) throw new Error("process identity is unavailable");
  return { pid, startTime, bootId };
};
const acquireAuthorityLock = async (root) => {
  const lock = authorityLock(root), deadline = Date.now() + 10_000;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(path.join(lock, "owner.json"), `${JSON.stringify(processIdentity(process.pid))}\n`, { flag: "wx", mode: 0o600 });
      return () => rmSync(lock, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const owner = JSON.parse(readFileSync(path.join(lock, "owner.json"), "utf8"));
        if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !/^\d+$/u.test(owner.startTime) || !/^[a-f0-9-]{36}$/u.test(owner.bootId)) {
          const invalid = new Error("authority lock owner is invalid");
          invalid.code = "EBADOWNER";
          throw invalid;
        }
        try {
          const live = processIdentity(owner.pid);
          if (live.startTime !== owner.startTime || live.bootId !== owner.bootId) {
            rmSync(lock, { recursive: true, force: true });
            continue;
          }
        } catch (probe) {
          if (probe.code === "ENOENT" || probe.code === "ESRCH") { rmSync(lock, { recursive: true, force: true }); continue; }
          throw probe;
        }
      } catch (readError) {
        if (readError.code === "ENOENT" || readError.code === "EBADOWNER" || readError instanceof SyntaxError) {
          try {
            if (Date.now() - lstatSync(lock).mtimeMs > 100) {
              rmSync(lock, { recursive: true, force: true });
              continue;
            }
          } catch (statError) { if (statError.code !== "ENOENT") throw statError; }
        } else throw readError;
      }
      if (Date.now() >= deadline) throw new Error("authority lock timed out");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
};
const readAuthority = (root, request) => {
  const target = uncertaintyPath(root, request);
  return existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
};
const writeAuthority = (root, request, state, reason) => {
  const directory = uncertaintyDirectory(root), target = uncertaintyPath(root, request), temporary = `${target}.${process.pid}.pending`;
  mkdirSync(directory, { recursive: true });
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, `${canonical({ schemaVersion: SCHEMA_VERSION, commandId: request.commandId, commandDigest: request.commandDigest, expectedRevision: request.expectedRevision, state, reason })}\n`);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(temporary, target);
  syncDirectory(directory);
};
const markUncertainUnlocked = (root, request, reason) => {
  const existing = readAuthority(root, request);
  if (existing && (existing.commandDigest !== request.commandDigest || existing.expectedRevision !== request.expectedRevision)) return;
  writeAuthority(root, request, "outcome_unknown", reason);
};
const markUncertain = async (root, request, reason) => {
  const release = await acquireAuthorityLock(root);
  try { markUncertainUnlocked(root, request, reason); } finally { release(); }
};
const clearUncertain = (root, request) => {
  const target = uncertaintyPath(root, request);
  if (!existsSync(target)) return;
  rmSync(target);
  const directory = uncertaintyDirectory(root);
  syncDirectory(directory);
  try { rmdirSync(directory); syncDirectory(root); }
  catch (error) { if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error; }
};

function campaignRevision(db, campaignId) {
  const row = db.prepare("SELECT revision FROM campaign WHERE id=?").get(campaignId);
  if (!row) throw new Error("campaign is unavailable");
  return row.revision;
}

export async function execute(root, rawRequest, faultPoint = null) {
  const request = validateRequest(rawRequest);
  const authority = readAuthority(root, request);
  if (authority && authority.commandDigest === request.commandDigest && authority.expectedRevision === request.expectedRevision && authority.state === "outcome_unknown")
    return executeResult(request, "outcome_unknown", null, null, "retry blocked until a reliable reconciliation succeeds");
  let db;
  try {
    db = open(root);
    if (authority && (authority.commandDigest !== request.commandDigest || authority.expectedRevision !== request.expectedRevision)) {
      const current = db.prepare("SELECT revision FROM campaign ORDER BY id LIMIT 1").get()?.revision;
      return executeResult(request, "rejected", current, null, "commandId is reserved for a different uncertain request");
    }
    if (authority?.state === "revision_conflict") {
      const current = db.prepare("SELECT revision FROM campaign ORDER BY id LIMIT 1").get()?.revision;
      return executeResult(request, "revision_conflict", current, null, "reconciled request is stale");
    }
    fault(faultPoint, "before_begin");
    db.exec("BEGIN IMMEDIATE");
    let committed = false;
    try {
      fault(faultPoint, "after_begin");
      const insideRevision = campaignRevision(db, request.command.campaignId);
      const insidePrior = db.prepare("SELECT * FROM command_receipt WHERE command_id=?").get(request.commandId);
      const durableAuthority = db.prepare("SELECT * FROM command_authority WHERE command_id=?").get(request.commandId);
      if (durableAuthority && (durableAuthority.command_digest !== request.commandDigest || durableAuthority.expected_revision !== request.expectedRevision)) {
        db.exec("ROLLBACK");
        return executeResult(request, "rejected", insideRevision, null, "commandId is durably reserved for a different request");
      }
      if (insidePrior) {
        db.exec("ROLLBACK");
        if (insidePrior.command_digest !== request.commandDigest || insidePrior.expected_revision !== request.expectedRevision)
          return executeResult(request, "rejected", insideRevision, null, "commandId was already bound to a different request");
        return executeResult(request, "already_applied", insideRevision, parseReceipt(insidePrior, request));
      }
      if (insideRevision !== request.expectedRevision) {
        db.exec("ROLLBACK");
        return executeResult(request, "revision_conflict", insideRevision, null, "expected revision is stale");
      }
      const before = db.prepare("SELECT name FROM campaign_object WHERE id=? AND campaign_id=?").get(
        request.command.objectId, request.command.campaignId,
      );
      if (!before) {
        db.exec("ROLLBACK");
        return executeResult(request, "rejected", insideRevision, null, "target object is unavailable");
      }
      const objectWrite = db.prepare("UPDATE campaign_object SET name=? WHERE id=? AND campaign_id=?").run(
        request.command.newName, request.command.objectId, request.command.campaignId,
      );
      if (objectWrite.changes !== 1) throw new Error("object mutation did not affect exactly one row");
      fault(faultPoint, "after_object");
      const committedRevision = request.expectedRevision + 1;
      db.prepare("INSERT INTO campaign_history(campaign_id,command_id,object_id,fact,committed_revision) VALUES(?,?,?,?,?)").run(
        request.command.campaignId, request.commandId, request.command.objectId, request.command.historyFact, committedRevision,
      );
      fault(faultPoint, "after_history");
      const revisionWrite = db.prepare("UPDATE campaign SET revision=? WHERE id=? AND revision=?").run(
        committedRevision, request.command.campaignId, request.expectedRevision,
      );
      if (revisionWrite.changes !== 1) throw new Error("revision mutation lost authority");
      const baseReceipt = {
        schemaVersion: SCHEMA_VERSION,
        commandId: request.commandId,
        commandDigest: request.commandDigest,
        expectedRevision: request.expectedRevision,
        committedRevision,
        campaignId: request.command.campaignId,
        objectId: request.command.objectId,
        beforeName: before.name,
        afterName: request.command.newName,
        historyFact: request.command.historyFact,
      };
      const receipt = validateReceipt({ ...baseReceipt, receiptDigest: receiptDigest(baseReceipt) });
      db.prepare("INSERT INTO command_receipt(command_id,command_digest,expected_revision,command_json,receipt_json) VALUES(?,?,?,?,?)").run(
        request.commandId, request.commandDigest, request.expectedRevision, canonical(request.command), canonical(receipt),
      );
      fault(faultPoint, "after_receipt");
      db.exec("COMMIT");
      committed = true;
      clearUncertain(root, request);
      fault(faultPoint, "after_commit");
      const durable = parseReceipt(db.prepare("SELECT * FROM command_receipt WHERE command_id=?").get(request.commandId), request);
      fault(faultPoint, "before_response");
      return executeResult(request, "applied", committedRevision, durable);
    } finally {
      if (!committed && db.inTransaction) db.exec("ROLLBACK");
    }
  } catch (error) {
    if (db?.inTransaction) db.exec("ROLLBACK");
    await markUncertain(root, request, "transaction store failed");
    return executeResult(request, "outcome_unknown", null, null, `transaction store failed: ${String(error)}`);
  } finally {
    db?.close();
  }
}

export async function reconcile(root, rawRequest) {
  const request = validateReconcileRequest(rawRequest);
  const release = await acquireAuthorityLock(root);
  let db;
  try {
    db = open(root);
    db.exec("BEGIN");
    const campaigns = db.prepare("SELECT revision FROM campaign ORDER BY id LIMIT 2").all();
    if (campaigns.length !== 1) throw new Error("P02 reconcile root must contain exactly one campaign");
    const current = campaigns[0].revision;
    const row = db.prepare("SELECT * FROM command_receipt WHERE command_id=?").get(request.commandId);
    const authority = readAuthority(root, request);
    const durableAuthority = db.prepare("SELECT * FROM command_authority WHERE command_id=?").get(request.commandId);
    if ((authority && (authority.commandDigest !== request.commandDigest || authority.expectedRevision !== request.expectedRevision)) ||
        (durableAuthority && (durableAuthority.command_digest !== request.commandDigest || durableAuthority.expected_revision !== request.expectedRevision))) {
      db.exec("ROLLBACK");
      return reconcileResult(request, "rejected", current, null, "commandId is reserved for a different uncertain request");
    }
    if (row) {
      db.exec("COMMIT");
      if (row.command_digest !== request.commandDigest || row.expected_revision !== request.expectedRevision)
        return reconcileResult(request, "rejected", current, null, "commandId was already bound to a different request");
      const applied = reconcileResult(request, "applied", current, parseReceipt(row, request));
      clearUncertain(root, request);
      return applied;
    }
    if (authority) db.prepare("INSERT OR IGNORE INTO command_authority(command_id,command_digest,expected_revision) VALUES(?,?,?)").run(
      request.commandId, request.commandDigest, request.expectedRevision,
    );
    db.exec("COMMIT");
    const reconciled = current === request.expectedRevision
      ? reconcileResult(request, "not_applied", current)
      : reconcileResult(request, "revision_conflict", current, null, "receipt absent at a different revision");
    if (authority) clearUncertain(root, request);
    return reconciled;
  } catch (error) {
    if (db?.inTransaction) db.exec("ROLLBACK");
    markUncertainUnlocked(root, request, "receipt snapshot failed");
    return reconcileResult(request, "outcome_unknown", null, null, `receipt snapshot failed: ${String(error)}`);
  } finally {
    db?.close();
    release();
  }
}

export async function guardedRetry(root, rawRequest) {
  const request = validateRequest(rawRequest), reconciliation = await reconcile(root, reconciliationFor(request));
  if (reconciliation.outcome !== "not_applied")
    return Object.freeze({ mutationHandlerEntered: false, blockedAfter: reconciliation.outcome, result: null });
  return Object.freeze({ mutationHandlerEntered: true, blockedAfter: null, result: await execute(root, request) });
}

export function snapshot(root) {
  const db = open(root, true);
  try {
    const integrity = db.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error(`SQLite integrity failure: ${integrity}`);
    const rawReceipts = db.prepare("SELECT command_id,command_digest,expected_revision,command_json,receipt_json FROM command_receipt ORDER BY command_id").all();
    const authorities = db.prepare("SELECT command_id AS commandId,command_digest AS commandDigest,expected_revision AS expectedRevision FROM command_authority ORDER BY command_id").all();
    const receipts = rawReceipts.map((row) => ({
      commandId: row.command_id,
      commandDigest: row.command_digest,
      expectedRevision: row.expected_revision,
      commandJson: row.command_json,
      receiptJson: canonical(parseReceipt(row)),
    }));
    for (const row of rawReceipts) {
      const receipt = parseReceipt(row);
      const history = db.prepare("SELECT 1 FROM campaign_history WHERE campaign_id=? AND command_id=? AND object_id=? AND fact=? AND committed_revision=?").get(
        receipt.campaignId, receipt.commandId, receipt.objectId, receipt.historyFact, receipt.committedRevision,
      );
      if (!history) throw new Error("receipt has no matching history row");
      if (campaignRevision(db, receipt.campaignId) < receipt.committedRevision)
        throw new Error("campaign revision predates receipt");
    }
    const historyCount = db.prepare("SELECT count(*) AS n FROM campaign_history").get().n;
    if (historyCount !== rawReceipts.length) throw new Error("history and receipt cardinality differ");
    for (const campaign of db.prepare("SELECT id,revision FROM campaign").all()) {
      const revisions = rawReceipts.map((row) => parseReceipt(row)).filter((item) => item.campaignId === campaign.id)
        .map((item) => item.committedRevision).sort((a, b) => a - b);
      if (revisions.length !== campaign.revision || revisions.some((value, index) => value !== index + 1))
        throw new Error("campaign revision chain is not closed");
    }
    for (const authority of authorities) {
      const receipt = rawReceipts.find((row) => row.command_id === authority.commandId);
      if (receipt && (receipt.command_digest !== authority.commandDigest || receipt.expected_revision !== authority.expectedRevision))
        throw new Error("durable authority conflicts with receipt");
    }
    const value = {
      campaign: db.prepare("SELECT id,name,revision FROM campaign ORDER BY id").all(),
      objects: db.prepare("SELECT id,campaign_id AS campaignId,name FROM campaign_object ORDER BY id").all(),
      history: db.prepare("SELECT campaign_id AS campaignId,command_id AS commandId,object_id AS objectId,fact,committed_revision AS committedRevision FROM campaign_history ORDER BY id").all(),
      receipts,
      authorities,
    };
    return Object.freeze({ ...value, semanticDigest: sha256(canonical(value)) });
  } finally {
    db.close();
  }
}

export async function fileInventory(root) {
  const entries = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name), info = await lstat(target);
    if (info.isSymbolicLink()) throw new Error(`symlink is forbidden in P02 inventory: ${entry.name}`);
    entries.push(entry.isFile()
      ? { name: entry.name, kind: "file", bytes: info.size, sha256: sha256(await readFile(target)) }
      : { name: entry.name, kind: entry.isDirectory() ? "directory" : "other", bytes: null, sha256: null });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createBackup(root, destination, faultPoint = null) {
  const release = await acquireAuthorityLock(root);
  try {
    try {
      if ((await readdir(uncertaintyDirectory(root))).length > 0)
        throw new Error("backup is blocked while command outcomes remain unknown");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const temporary = `${destination}.pending`;
    await mkdir(path.dirname(destination), { recursive: true });
    await rm(temporary, { force: true });
    const sourceBefore = snapshot(root), db = open(root, true);
    try {
      await db.backup(temporary, {
        progress() {
          fault(faultPoint, "during_backup");
          return 1;
        },
      });
    } finally {
      db.close();
    }
    const tempRoot = path.dirname(temporary), tempName = path.basename(temporary);
    const verification = new Database(path.join(tempRoot, tempName), { readonly: true, fileMustExist: true });
    try {
      if (verification.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("backup integrity check failed");
    } finally {
      verification.close();
    }
    const verifyRoot = `${destination}.verify-root`;
    await rm(verifyRoot, { recursive: true, force: true });
    await mkdir(verifyRoot, { recursive: true });
    await copyFile(temporary, databasePath(verifyRoot));
    const backupSnapshot = snapshot(verifyRoot);
    await rm(verifyRoot, { recursive: true, force: true });
    if (backupSnapshot.semanticDigest !== sourceBefore.semanticDigest) throw new Error("backup semantic digest mismatch");
    const backupSha256 = sha256(await readFile(temporary));
    const candidateHandle = await openFile(temporary, "r");
    try { await candidateHandle.sync(); } finally { await candidateHandle.close(); }
    await rename(temporary, destination);
    const destinationDirectory = await openFile(path.dirname(destination), "r");
    try { await destinationDirectory.sync(); } finally { await destinationDirectory.close(); }
    return Object.freeze({ semanticDigest: backupSnapshot.semanticDigest, backupSha256, sourceUnchanged: snapshot(root).semanticDigest === sourceBefore.semanticDigest });
  } finally {
    release();
  }
}

export async function restoreBackup(backup, destinationRoot, expected) {
  if (!expected || sha256(await readFile(backup)) !== expected.backupSha256)
    throw new Error("backup bytes do not match verified receipt");
  try { await lstat(destinationRoot); throw new Error("restore destination already exists"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const staged = `${destinationRoot}.pending`;
  await rm(staged, { recursive: true, force: true });
  await mkdir(staged, { recursive: true });
  try {
    await copyFile(backup, databasePath(staged));
    const restored = snapshot(staged);
    if (restored.semanticDigest !== expected.semanticDigest) throw new Error("restored semantics do not match verified receipt");
    await writeFile(path.join(staged, "restore-verified.json"), `${JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      semanticDigest: restored.semanticDigest,
      backupSha256: expected.backupSha256,
    }, null, 2)}\n`);
    await rename(staged, destinationRoot);
    return restored;
  } catch (error) {
    await rm(staged, { recursive: true, force: true });
    throw error;
  }
}
