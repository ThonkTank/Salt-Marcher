import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { commandDigest } from "../../tools/adr-prototypes/contracts/p02-v1/contract.mjs";
import { request } from "../../tools/adr-prototypes/p02/fixture.mjs";
import { createProfile, snapshot } from "../../tools/adr-prototypes/p02/store.mjs";

const worker = fileURLToPath(new URL("../../tools/adr-prototypes/p02/worker.mjs", import.meta.url));

function run(root, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker, "execute", root, input], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr || `worker exited ${code}`)));
  });
}

async function race(requests) {
  const root = await mkdtemp(path.join(tmpdir(), "p02-race-"));
  try {
    await createProfile(root);
    const files = await Promise.all(requests.map(async (value, index) => {
      const file = path.join(root, `request-${index}.json`);
      await writeFile(file, `${JSON.stringify(value)}\n`);
      return file;
    }));
    const results = await Promise.all(files.map((file) => run(root, file)));
    return { results, state: snapshot(root) };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("P02 concurrent identical triplets apply exactly once", async () => {
  const value = request(1), { results, state } = await race([value, structuredClone(value)]);
  assert.deepEqual(results.map((item) => item.outcome).sort(), ["already_applied", "applied"]);
  assert.equal(state.campaign[0].revision, 1);
  assert.equal(state.history.length, 1);
  assert.equal(state.receipts.length, 1);
});

test("P02 concurrent commandId collision rejects one identity", async () => {
  const first = request(1), collision = structuredClone(first);
  collision.command.newName = "Conflicting concurrent payload";
  collision.commandDigest = commandDigest(collision.command);
  const { results, state } = await race([first, collision]);
  assert.deepEqual(results.map((item) => item.outcome).sort(), ["applied", "rejected"]);
  assert.equal(state.campaign[0].revision, 1);
  assert.equal(state.history.length, 1);
});

test("P02 concurrent distinct commands at one revision classify the loser", async () => {
  const first = request(1), second = request(2, 0);
  const { results, state } = await race([first, second]);
  assert.deepEqual(results.map((item) => item.outcome).sort(), ["applied", "revision_conflict"]);
  assert.equal(state.campaign[0].revision, 1);
  assert.equal(state.history.length, 1);
  assert.equal(state.receipts.length, 1);
});
