import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import {
  atlasNativeDigest,
  projectAtlasNativeCapture,
} from "../../src/features/atlas/atlas-campaign-source";
import { parseSpatialWorld } from "../../src/features/atlas/spatial-schema";
import { TerrainStroke } from "../../src/features/atlas/terrain-source";
import {
  parseLocationDocument,
  serializeLocationDocument,
} from "../../src/features/location/location-schema";
import { FileConflict, type FileStore } from "../../src/persistence";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fixtureRoot = "tests/fixtures/atlas-e2e-spatial-v2/";
const manifest: {
  input: { path: string; fixtureFile: string; sha256: string }[];
} = JSON.parse(readFileSync(fixtureRoot + "manifest.json", "utf8"));
const path = manifest.input[0]!.path;
const locPath = `Orte/${id(11)}.location`;
const world = parseSpatialWorld(
  readFileSync(fixtureRoot + manifest.input[0]!.fixtureFile, "utf8"),
);
const chunkPath = `Atlasdaten/${world.id}/${world.chunks[0]!.file}`;
const sha = (bytes: string) =>
  "sha256:" + createHash("sha256").update(bytes, "utf8").digest("hex");
class Store implements FileStore {
  files = new Map<string, string>();
  writes = 0;
  block?: { path: string; entered: () => void; resume: Promise<void> };
  constructor() {
    for (const file of manifest.input) {
      const bytes = readFileSync(fixtureRoot + file.fixtureFile, "utf8");
      assert.equal(sha(bytes), "sha256:" + file.sha256);
      this.files.set(file.path, bytes);
    }
  }
  async read(p: string) {
    if (this.block?.path === p) {
      const block = this.block;
      this.block = undefined;
      block.entered();
      await block.resume;
    }
    return this.files.get(p) ?? null;
  }
  async compareAndWrite(
    p: string,
    before: string | null,
    after: string | null,
  ) {
    if ((await this.read(p)) !== before) throw new FileConflict(p);
    this.writes++;
    if (after === null) this.files.delete(p);
    else this.files.set(p, after);
  }
}
function blocked(store: Store, path: string) {
  let enter!: () => void, resume!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    resume = resolve;
  });
  store.block = { path, entered: enter, resume: wait };
  return { entered, resume };
}
async function opened(store = new Store()) {
  const repository = new AtlasRepository(store, path, store, {
    locations: true,
    details: true,
    resolveDetail: async (_worldId, kind, nativeId) =>
      [...store.files]
        .filter(
          ([path, bytes]) =>
            path.endsWith("." + kind) && JSON.parse(bytes).id === nativeId,
        )
        .map(([path]) => path),
  });
  const source = await repository.open();
  return { repository, source, store };
}
const request = { worldId: world.id };

test("native Atlas capture: exact spatial-v2 bytes, owned records, dependencies, immutable and read-only", async () => {
  const { repository, source, store } = await opened();
  const files = [...store.files],
    historyEpoch = source.history.epoch;
  assert.equal(source.loadedChunks().length, 0);
  const capture = await repository.captureNative(request);
  assert.equal(capture.coverage, "spatial-closure");
  assert.equal(capture.world.version, 2);
  assert.equal(capture.files.length, 7);
  assert.equal(capture.records.filter((r) => r.kind === "location").length, 2);
  assert.deepEqual(
    capture.records
      .filter((r) => r.kind === "location-section")
      .map((r) => r.id),
    [id(15), id(16), id(17), id(18)],
  );
  assert.deepEqual(
    capture.dependencies.map((d) => d.id),
    [id(30), id(100)],
  );
  assert.equal(
    capture.records.some((r) => r.id === id(31) || r.id === id(105)),
    false,
  );
  assert.ok(
    capture.records
      .flatMap((r) => r.references)
      .every((r) => r.scope === "unclassified"),
  );
  for (const file of capture.files) {
    assert.equal(file.before, store.files.get(file.path));
    assert.equal(file.beforeDigest, sha(file.before!));
    assert.equal(file.afterDigest, sha(file.after!));
  }
  assert.throws(() => {
    (capture.world.placements as unknown as unknown[]).pop();
  }, TypeError);
  assert.throws(() => {
    (capture.records[0]!.references as unknown as unknown[]).push({});
  }, TypeError);
  await repository.verifyNativeCapture(capture);
  assert.equal(source.history.epoch, historyEpoch);
  assert.equal(source.loadedChunks().length, 0);
  assert.deepEqual([...store.files], files);
  assert.equal(store.writes, 0);
});

test("native Atlas capture: loaded/unloaded terrain has identical content digest; hydration invalidates old basis", async () => {
  const { repository, source } = await opened();
  const capture = await repository.captureNative(request);
  await source.ensure(world.chunks.map((r) => ({ q: r.q * 32, r: r.r * 32 })));
  await assert.rejects(repository.verifyNativeCapture(capture), /veraltet/);
  const hydrated = await repository.captureNative(request);
  assert.equal(hydrated.sourceDigest, capture.sourceDigest);
  assert.ok(hydrated.basis.historyEpoch > capture.basis.historyEpoch);
});

test("native Atlas capture: unsaved Key preserves Markdown bytes; new terrain chunk is a World subpayload", async () => {
  const { repository, source, store } = await opened();
  const loc = repository.location(id(11)).read()!;
  const markdown = "  **Tür**\r\n\n  Ende  \n";
  repository.editLocation({
    ...loc,
    sections: loc.sections.map((s, i) => (i ? s : { ...s, markdown })),
  });
  await source.ensure([{ q: 96, r: 96 }]);
  const stroke = new TerrainStroke(source, "forest");
  stroke.add({ q: 96, r: 96 });
  stroke.finish();
  const capture = await repository.captureNative(request);
  const capturedLoc = capture.files.find((file) => file.id === id(11))!;
  assert.equal(
    parseLocationDocument(capturedLoc.after!).sections[0]!.markdown,
    markdown,
  );
  assert.equal(capturedLoc.before, store.files.get(locPath));
  assert.notEqual(capturedLoc.beforeDigest, capturedLoc.afterDigest);
  const chunk = capture.files.find((file) => file.path.endsWith("0_3_3.json"))!;
  assert.equal(chunk.kind, "terrain");
  assert.equal(chunk.id, null);
  assert.equal(chunk.before, null);
  assert.equal(JSON.parse(chunk.after!).cells[0].terrain, "forest");
  assert.equal(store.writes, 0);
});

test("native Atlas capture: Source A→B→A during read rejects despite identical final values", async () => {
  const { repository, source, store } = await opened();
  const before = repository.spatialGraph.world();
  const b = blocked(store, locPath),
    pending = repository.captureNative(request);
  await b.entered;
  repository.moveLocation(id(11), { x: 99, y: 10 });
  source.history.undo();
  assert.deepEqual(repository.spatialGraph.world(), before);
  b.resume();
  await assert.rejects(pending, /veraltet/);
  assert.equal(store.writes, 0);
});

test("native Atlas capture: verification also rejects Source ABA during asynchronous byte read", async () => {
  const { repository, source, store } = await opened();
  const capture = await repository.captureNative(request);
  const b = blocked(store, chunkPath),
    pending = repository.verifyNativeCapture(capture);
  await b.entered;
  repository.moveLocation(id(11), { x: 55, y: 10 });
  source.history.undo();
  b.resume();
  await assert.rejects(pending, /veraltet/);
});

test("native Atlas capture: original consumer lifetime guard rejects external Context ABA", async () => {
  const { repository, store } = await opened();
  let activation = "a1";
  const guard = () => {
    if (activation !== "a1") throw new Error("stale context");
  };
  const capture = await repository.captureNative({
    ...request,
    assertCurrent: guard,
  });
  activation = "b";
  activation = "a2";
  await assert.rejects(
    repository.verifyNativeCapture(capture),
    /stale context/,
  );
  const b = blocked(store, locPath);
  activation = "a1";
  const pending = repository.captureNative({
    ...request,
    assertCurrent: guard,
  });
  await b.entered;
  activation = "a3";
  b.resume();
  await assert.rejects(pending, /stale context/);
});

test("native Atlas capture: async guards are rejected instead of silently granting freshness", async () => {
  const { repository } = await opened();
  assert.throws(
    () =>
      repository.captureNative({ ...request, assertCurrent: async () => {} }),
    /synchron/,
  );
});

test("native Atlas capture: external byte change, duplicate native detail and missing/unknown terrain fail closed", async () => {
  for (const corrupt of [
    "changed",
    "duplicate",
    "missing",
    "unknown",
  ] as const) {
    const { repository, store } = await opened();
    const capture = await repository.captureNative(request);
    if (corrupt === "duplicate") {
      const file = capture.files.find((f) => f.kind === "city")!;
      store.files.set("Städte/Doppel.city", store.files.get(file.path)!);
    } else if (corrupt === "missing") store.files.delete(chunkPath);
    else {
      const chunk = JSON.parse(store.files.get(chunkPath)!);
      if (corrupt === "unknown") chunk.version = 999;
      else chunk.cells[0].color = "#123456";
      store.files.set(chunkPath, JSON.stringify(chunk));
    }
    await assert.rejects(repository.verifyNativeCapture(capture));
    if (corrupt !== "changed")
      await assert.rejects(repository.captureNative(request));
    assert.equal(store.writes, 0);
  }
});

test("native Atlas capture: local saved baseline detects external Location identity drift", async () => {
  const { repository, store } = await opened();
  const doc = parseLocationDocument(store.files.get(locPath)!);
  store.files.set(locPath, serializeLocationDocument({ ...doc, id: id(998) }));
  await assert.rejects(repository.captureNative(request));
  assert.equal(store.writes, 0);
});

test("native Atlas capture: explicit unplaced native Location is included without a complete inventory claim", async () => {
  const { repository, store } = await opened();
  const doc = parseLocationDocument(store.files.get(locPath)!);
  const extraPath = "Orte/Umbenannter-POI.location";
  const extra = {
    ...doc,
    id: id(900),
    name: "Unverortet",
    sections: [{ ...doc.sections[0]!, id: id(901) }],
  };
  store.files.set(extraPath, serializeLocationDocument(extra));
  const declared = [{ id: extra.id, path: extraPath }];
  const pending = repository.captureNative({
    ...request,
    additionalLocations: declared,
  });
  declared[0]!.path = "Orte/Falsch.location";
  const capture = await pending;
  assert.equal(capture.records.find((r) => r.id === id(900))!.kind, "location");
  assert.equal(
    capture.records.find((r) => r.id === id(901))!.kind,
    "location-section",
  );
  assert.equal(capture.coverage, "spatial-closure");
  assert.equal("emptyConfirmed" in capture, false);
  await repository.verifyNativeCapture(capture);
  assert.equal(store.writes, 0);
});

test("native Atlas capture: extra missing/foreign/aliased records and duplicate own record IDs reject", async () => {
  const { repository, store } = await opened();
  await assert.rejects(
    repository.captureNative({
      ...request,
      additionalLocations: [{ id: id(900), path: "Orte/Missing.location" }],
    }),
  );
  await assert.rejects(
    repository.captureNative({
      ...request,
      additionalLocations: [{ id: id(900), path: locPath }],
    }),
  );
  assert.throws(
    () =>
      repository.captureNative({
        ...request,
        additionalLocations: [
          { id: id(900), path: locPath },
          { id: id(901), path: locPath },
        ],
      }),
    /Mehrdeutig/,
  );
  const doc = parseLocationDocument(store.files.get(locPath)!);
  store.files.set(
    "Orte/Collision.location",
    serializeLocationDocument({
      ...doc,
      id: id(900),
      sections: [{ ...doc.sections[0]!, id: world.id }],
    }),
  );
  await assert.rejects(
    repository.captureNative({
      ...request,
      additionalLocations: [{ id: id(900), path: "Orte/Collision.location" }],
    }),
    /Mehrdeutig/,
  );
  assert.equal(store.writes, 0);
});

test("native Atlas capture: removed Location is a retained Before/tombstone, no fabricated empty document", async () => {
  const { repository, store } = await opened();
  await repository.ensureLocation(id(12));
  repository.removeLocation(id(12));
  const capture = await repository.captureNative(request);
  const removed = capture.files.find((file) => file.id === id(12))!;
  assert.equal(removed.before, store.files.get(removed.path));
  assert.equal(removed.after, null);
  assert.equal(
    capture.records.some((r) => r.id === id(12)),
    false,
  );
  await repository.verifyNativeCapture(capture);
});

test("native Atlas capture: save/draft/discard and replaced History invalidate the original lifetime", async () => {
  for (const op of ["save", "persistDraft", "discard"] as const) {
    const { repository } = await opened();
    const capture = await repository.captureNative(request);
    await repository[op]();
    await assert.rejects(repository.verifyNativeCapture(capture), /veraltet/);
    const fresh = await repository.captureNative(request);
    assert.equal(fresh.sourceDigest, capture.sourceDigest);
  }
});

test("native Atlas capture: pending draft/journal or foreign/forged capture cannot verify", async () => {
  const { repository, store } = await opened();
  const capture = await repository.captureNative(request);
  const foreign = await opened();
  await assert.rejects(
    foreign.repository.verifyNativeCapture(capture),
    /fremden/,
  );
  await assert.rejects(
    repository.verifyNativeCapture(JSON.parse(JSON.stringify(capture))),
    /fremden/,
  );
  for (const sidecar of [repository.draftPath, repository.journalPath]) {
    store.files.set(sidecar, "external pending work");
    await assert.rejects(
      repository.verifyNativeCapture(capture),
      /Dateigrenze/,
    );
    await assert.rejects(repository.captureNative(request));
    assert.equal(store.files.get(sidecar), "external pending work");
    store.files.delete(sidecar);
  }
  assert.throws(
    () => repository.captureNative({ worldId: id(999) }),
    /Weltkennung/,
  );
  assert.equal(store.writes, 0);
});

test("native Atlas capture: deterministic UTF8 digests and input copies; native array order remains meaningful", async () => {
  const { repository } = await opened();
  const capture = await repository.captureNative(request);
  assert.equal(await atlasNativeDigest("Ä\r\n  Tür"), sha("Ä\r\n  Tür"));
  const inputWorld = JSON.parse(JSON.stringify(capture.world)),
    files = capture.files.map((f) => ({ ...f }));
  const pending = projectAtlasNativeCapture(capture.basis, inputWorld, files);
  inputWorld.name = "Changed after call";
  files[0]!.after = "wrong";
  const projected = await pending;
  assert.equal(projected.sourceDigest, capture.sourceDigest);
  assert.equal(projected.world.name, capture.world.name);
  const reordered = {
    ...capture.world,
    placements: [...capture.world.placements].reverse(),
  };
  assert.notEqual(
    (await projectAtlasNativeCapture(capture.basis, reordered, capture.files))
      .sourceDigest,
    capture.sourceDigest,
  );
});
