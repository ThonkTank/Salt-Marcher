import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createScalingFixtures,
  finePayloadDigest,
  inspectScalingFixture,
  SCALING_EXPECTED,
  SCALING_REGION,
} from "./atlas-p0-scaling.mjs";

const require = createRequire(import.meta.url);
const { ProjectStore } = require("../desktop-dist/project-store.cjs");
const {
  EditorDocument,
  prepareHeightSampler,
} = require("../desktop-dist/model.cjs");
let directory;
let fixture;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "atlas-p0-scaling-test-"));
  fixture = (
    await createScalingFixtures(join(directory, "first"), {
      ids: ["baseline"],
    })
  ).fixtures[0];
});

after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("saved sources contain the protected trench and real varied detail at the same fixed region", async () => {
  assert.equal(fixture.sourceTiles, 32);
  assert.equal(fixture.regionSourceTiles, 32);
  assert.equal(fixture.fineTiles, 28);
  assert.equal(fixture.fineDigest.denseTiles, 24);
  assert.equal(fixture.decodedBytes, 1024 * 1024);
  assert.ok(fixture.ridgeSamples.some((height) => height < 0));
  assert.ok(fixture.ridgeSamples.some((height) => height > 0));
  assert.ok(fixture.ridgePixelSample > 12);
  assert.ok(
    Math.abs(fixture.ridgePixelSample - SCALING_EXPECTED.ridgePixelBefore) <
      1e-7,
  );
  const [x, y] = SCALING_REGION.ridgePixelProbe;
  const [minX, minY, maxX, maxY] = SCALING_REGION.protectedBounds;
  assert.ok(x < minX || x > maxX || y < minY || y > maxY);
  const original = await readFile(fixture.file);
  const inspected = await inspectScalingFixture(fixture.file);
  assert.equal(inspected.fineSha256, fixture.fineSha256);
  assert.deepEqual(
    await readFile(fixture.file),
    original,
    "Inspection changed the project.",
  );
});

test("recreating the fixture keeps source contents deterministic despite new project IDs", async () => {
  const repeated = (
    await createScalingFixtures(join(directory, "repeat"), {
      ids: ["baseline"],
    })
  ).fixtures[0];
  assert.equal(repeated.fineSha256, fixture.fineSha256);
  assert.deepEqual(repeated.samples, fixture.samples);
  assert.deepEqual(repeated.ridgeSamples, fixture.ridgeSamples);
  assert.equal(repeated.ridgePixelSample, fixture.ridgePixelSample);
});

test("the independent coarse-dab oracle holds after a real save and fine digest detects a wrong fine write", async () => {
  const store = new ProjectStore(join(directory, "editing-work"));
  try {
    const info = await store.openProject(fixture.file);
    const doc = new EditorDocument(info.sessionId, { sequence: info.sequence });
    // This small case can be completely loaded. Larger fixtures deliberately
    // cannot use this as a product bypass; the browser scenario reads normally.
    const bounds = [-60000, -60000, 60000, 60000];
    const sources = store.readRegion({
      sessionId: info.sessionId,
      bounds,
      minLevel: 0,
    });
    doc.acceptCoverage(bounds, sources.tiles, info.sequence);
    doc.beginPrepaidGesture(SCALING_REGION.brush, {
      sessionId: doc.sessionId,
      gestureId: 1,
      viewId: 1,
      preparationId: 1,
    });
    const point = SCALING_REGION.brush.center;
    let change = null;
    // Twenty explicit, acknowledged 50-ms windows retain the independent
    // one-second stationary oracle. No long interval bypasses the C1 limit.
    for (let window = 0; window < 20; window++) {
      doc.admitBrushBatch({
        admissionId: window + 1,
        path: { from: point, points: [point], end: window === 19 },
        time: [{ from: point, to: point, elapsedMs: 50 }],
        pointCount: 1,
      });
      let steps = 0;
      while (doc.brushWork?.pendingCells || doc.finishing) {
        const advanced = doc.advanceBrushGesture({
          maxCells: 256,
          maxMs: 1000,
        });
        if (advanced.change) change = advanced.change;
        assert.ok(++steps < 1000, "The C1 continuation must finish.");
      }
      if (window < 19) {
        const receipt = doc.freezeBrushEffect();
        assert.ok(receipt);
        assert.equal(doc.acknowledgeBrushEffect(receipt), true);
      }
    }
    assert.ok(change);
    assert.equal(doc.metrics.historyActions, 1);
    store.commit(change);
    const raised = join(directory, "raised.saltatlas");
    await store.saveProject(
      { sessionId: info.sessionId, sequence: change.sequence },
      raised,
    );
    const after = await inspectScalingFixture(raised);
    assert.equal(after.fineSha256, fixture.fineSha256);
    after.samples.forEach((value, i) =>
      assert.ok(Math.abs(value - SCALING_EXPECTED.afterCoarseDab[i]) < 1e-7),
    );
    after.ridgeSamples.forEach((value, i) =>
      assert.ok(
        Math.abs(value - SCALING_EXPECTED.ridgeAfterCoarseDab[i]) < 1e-7,
      ),
    );
    assert.ok(
      Math.abs(
        after.ridgePixelSample - SCALING_EXPECTED.ridgePixelAfterCoarseDab,
      ) < 1e-7,
    );
    // Counts, the coastal probes and unchanged file payloads cannot establish
    // that the coarse renderer used the distant fine relief. This land probe
    // becomes water if those residuals are omitted, even after the coarse dab.
    const missingFine = prepareHeightSampler(
      doc.snapshot(bounds).tiles.filter((tile) => tile.level !== 0),
    )(...SCALING_REGION.ridgePixelProbe);
    assert.ok(after.ridgePixelSample > 12);
    assert.ok(missingFine < 0);
    assert.ok(
      Math.abs(
        missingFine - SCALING_EXPECTED.ridgePixelWithoutFineAfterCoarseDab,
      ) < 1e-7,
    );

    // An adversarial fine-source mutation must be observable even when counts,
    // the coarse change, and the native file format all remain valid.
    const fine = sources.tiles.find((tile) => tile.level === 0);
    fine.values[100] += 7;
    fine.revision++;
    store.commit({
      sessionId: info.sessionId,
      sequence: change.sequence + 1,
      transactionId: "deliberately-wrong-fine-source",
      patches: [{ key: fine.key, after: fine }],
    });
    const wrong = join(directory, "wrong-fine.saltatlas");
    await store.saveProject(
      { sessionId: info.sessionId, sequence: change.sequence + 1 },
      wrong,
    );
    const incorrect = finePayloadDigest(wrong);
    assert.equal(incorrect.fineTiles, fixture.fineTiles);
    assert.notEqual(incorrect.sha256, fixture.fineSha256);
    // A fresh inspection of the normal saved result still recovers the good case.
    assert.equal(finePayloadDigest(raised).sha256, fixture.fineSha256);
  } finally {
    store.close();
  }
});
