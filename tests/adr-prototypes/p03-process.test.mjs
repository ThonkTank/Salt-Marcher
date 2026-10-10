import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PRIVATE_IDENTITIES,
  PRIVATE_STRING_CANARIES,
} from "../../tools/adr-prototypes/p03/fixture.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const electron = path.join(root, "node_modules", ".bin", "electron");
const main = path.join(
  root,
  "tools",
  "adr-prototypes",
  "p03",
  "probe-main.mjs",
);

test(
  "P03 real Linux two-window probe is fail-closed through restart",
  { timeout: 30000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "p03-process-"));
    try {
      const output = path.join(directory, "aggregate.json"),
        frames = path.join(directory, "frames");
      const result = await new Promise((resolve, reject) => {
        // GitHub runners cannot install Electron's root-owned SUID helper.
        // Disable only that helper; Chromium's user-namespace sandbox remains.
        const child = spawn(
          electron,
          [
            "--disable-setuid-sandbox",
            main,
            "--out",
            output,
            "--frames",
            frames,
          ],
          { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0
            ? resolve({
                evidence: JSON.parse(stdout.trim().split("\n").at(-1)),
                stdout,
                stderr,
              })
            : reject(new Error(stderr || `electron exited ${code}`)),
        );
      });
      const { evidence, stdout, stderr } = result;
      for (const forbidden of [
        ...PRIVATE_STRING_CANARIES,
        ...PRIVATE_IDENTITIES,
      ]) {
        assert.equal(
          `${stdout}\n${stderr}`.includes(forbidden),
          false,
          `process diagnostics leaked ${forbidden}`,
        );
      }
      assert.equal(evidence.platform, "linux");
      assert.deepEqual(evidence.passiveBridgeKeys, [
        "readCoreStatus",
        "readProjection",
        "subscribeProjectionChanged",
      ]);
      assert.equal(evidence.staleRepliesPublished, 0);
      assert.equal(evidence.privateStringMatches, 0);
      assert.equal(evidence.privateRasterMatches, 0);
      assert.ok(
        evidence.timings.blankP95Ms <= evidence.timings.budgetsMs.blank,
      );
      assert.ok(
        evidence.timings.readyP95Ms <= evidence.timings.budgetsMs.ready,
      );
      assert.equal(evidence.deniedSinks.protectedSinkTouches, 0);
      assert.equal(evidence.gmWindow.unaffected, true);
      assert.equal(evidence.keyboard.expanded, "true");
      assert.equal(evidence.accessibility.semantic.horizontalOverflow, false);
      assert.equal(evidence.persistenceAfterRestart.webStorageEntries, 0);
      assert.equal(evidence.persistenceAfterRestart.cacheKeys, 0);
      assert.equal(
        evidence.persistenceAfterRestart.serviceWorkerRegistrations,
        0,
      );
      assert.equal(evidence.persistenceAfterRestart.indexedDatabases, 0);
      assert.equal(evidence.frames.length, 8);
      assert.notEqual(
        evidence.frames[2].sha256,
        evidence.frames[3].sha256,
        "blank and ready frames must differ",
      );
      assert.deepEqual(JSON.parse(await readFile(output, "utf8")), evidence);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
