import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PRIVATE_IDENTITIES,
  PRIVATE_STRING_CANARIES,
} from "../../tools/adr-prototypes/p03/fixture.mjs";
import {
  findPrivateRaster,
  readPng,
} from "../../tools/adr-prototypes/p03/pixel-oracle.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const evidenceFile = path.join(
  root,
  "tools",
  "adr-prototypes",
  "evidence",
  "p03-aggregate.json",
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("P03 committed Linux evidence binds every real frame and remains fail-closed", async () => {
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  assert.equal(evidence.schemaVersion, "p03-evidence-v1");
  assert.equal(evidence.platform, "linux");
  assert.deepEqual(evidence.windowRoles, ["gm", "passive-display"]);
  assert.deepEqual(evidence.passiveBridgeKeys, [
    "readCoreStatus",
    "readProjection",
    "subscribeProjectionChanged",
  ]);
  assert.deepEqual(
    [
      evidence.staleRepliesPublished,
      evidence.privateStringMatches,
      evidence.privateIdentityMatches,
      evidence.privateRasterMatches,
      evidence.deniedSinks.protectedSinkTouches,
    ],
    [0, 0, 0, 0, 0],
  );
  assert.equal(evidence.pixelOraclePositiveControls, 2);
  assert.ok(evidence.timings.blankP95Ms <= evidence.timings.budgetsMs.blank);
  assert.ok(evidence.timings.readyP95Ms <= evidence.timings.budgetsMs.ready);
  assert.equal(evidence.gmWindow.unaffected, true);
  assert.equal(evidence.keyboard.expanded, "true");
  assert.equal(evidence.accessibility.semantic.horizontalOverflow, false);
  assert.deepEqual(evidence.persistenceAfterRestart, {
    webStorageEntries: 0,
    cacheKeys: 0,
    serviceWorkerRegistrations: 0,
    indexedDatabases: 0,
    currentGeneration: 6,
    currentScene: "scene_b",
  });
  assert.equal(evidence.frames.length, 8);
  assert.notEqual(evidence.frames[2].sha256, evidence.frames[3].sha256);

  const aggregateBytes = await readFile(evidenceFile);
  for (const forbidden of [...PRIVATE_STRING_CANARIES, ...PRIVATE_IDENTITIES]) {
    assert.equal(aggregateBytes.includes(forbidden), false, forbidden);
  }
  for (const frame of evidence.frames) {
    const file = path.resolve(path.dirname(evidenceFile), frame.file);
    assert.ok(file.startsWith(path.dirname(evidenceFile) + path.sep));
    const bytes = await readFile(file);
    assert.equal(sha256(bytes), frame.sha256, frame.label);
    assert.equal(findPrivateRaster(readPng(bytes)), null, frame.label);
    for (const forbidden of [
      ...PRIVATE_STRING_CANARIES,
      ...PRIVATE_IDENTITIES,
    ]) {
      assert.equal(
        bytes.includes(forbidden),
        false,
        `${frame.label}: ${forbidden}`,
      );
    }
  }
});
