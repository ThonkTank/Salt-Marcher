import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AtlasRepository } from "../../../src/features/atlas/atlas-repository";
import { parseSpatialWorld } from "../../../src/features/atlas/spatial-schema";
import { parseTerrainChunk } from "../../../src/features/atlas/terrain-schema";
import {
  campaignDomainOwnerPolicyDigest,
  campaignOwnershipDigestValue,
} from "../../../src/features/campaign/campaign-ownership";
import { parseCampaignRuntimeManifest } from "../../../src/features/campaign/campaign-runtime-source";
import { parseCityDocument } from "../../../src/features/city/codec";
import { parseLocationDocument } from "../../../src/features/location/location-schema";
import { parseDocument } from "../../../src/model";
import { FileConflict, type FileStore } from "../../../src/persistence";

const aRoot = "tests/fixtures/atlas-e2e-spatial-v2/";
const bRoot = "tests/fixtures/atlas-e2e-campaign-b-v1/";
const aManifest = JSON.parse(readFileSync(aRoot + "manifest.json", "utf8"));
const bManifest = JSON.parse(readFileSync(bRoot + "manifest.json", "utf8"));
const sha = (bytes: string) =>
  `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
const bytes = (root: string, file: { fixtureFile: string }) =>
  readFileSync(root + file.fixtureFile, "utf8");
const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const ids = (values: readonly string[]) =>
  new Set(values.flatMap((value) => value.match(uuidPattern) ?? []));

class Store implements FileStore {
  readonly files = new Map<string, string>();
  constructor() {
    for (const file of bManifest.input)
      this.files.set(file.path, bytes(bRoot, file));
  }
  async read(path: string) {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ) {
    if ((this.files.get(path) ?? null) !== before) throw new FileConflict(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
  }
}

test("Campaign B fixture is an independent native, hashed and parseable closure", async () => {
  assert.equal(bManifest.fixtureVersion, "e2e01-campaign-b-v1");
  assert.equal(bManifest.steward, "Campaign/Data");
  assert.equal(
    bManifest.baseCommit,
    "9ff11e8e515f162272eab3edf59f5a823349c7aa",
  );
  assert.equal(Object.hasOwn(bManifest, "sourceCommit"), false);
  assert.match(bManifest.materialization, /reads no Campaign-A fixture/);

  const bFiles = [...bManifest.input, bManifest.campaign];
  for (const file of bFiles) {
    const raw = bytes(bRoot, file);
    assert.equal(Buffer.byteLength(raw), file.bytes, file.path);
    assert.equal(sha(raw), `sha256:${file.sha256}`, file.path);
  }
  const aFiles = [...aManifest.input, aManifest.campaign.input];
  assert.deepEqual(
    [...new Set(bFiles.map((file) => file.path))].length,
    bFiles.length,
  );
  assert.deepEqual(
    bFiles
      .map((file) => file.path)
      .filter((path) => aFiles.some((file) => file.path === path)),
    [],
  );
  assert.deepEqual(
    bFiles
      .map((file) => file.sha256)
      .filter((digest) => aFiles.some((file) => file.sha256 === digest)),
    [],
  );
  const aIds = ids(aFiles.map((file) => bytes(aRoot, file)));
  const bIds = ids(bFiles.map((file) => bytes(bRoot, file)));
  assert.deepEqual(
    [...bIds].filter((value) => aIds.has(value)),
    [],
  );

  const worldFile = bManifest.input.find(
    (file: { kind: string }) => file.kind === "world",
  )!;
  const world = parseSpatialWorld(bytes(bRoot, worldFile));
  assert.equal(world.version, 2);
  if (world.version !== 2)
    throw new Error("Campaign B requires a spatial-v2 world.");
  assert.equal(world.id, bManifest.initialOracle.worldId);
  assert.equal(world.name, bManifest.initialOracle.worldName);
  for (const reference of world.chunks) {
    const path = `Atlasdaten/${world.id}/${reference.file}`;
    const file = bManifest.input.find(
      (candidate: { path: string }) => candidate.path === path,
    )!;
    assert.ok(file, path);
    parseTerrainChunk(bytes(bRoot, file), world.id, reference);
  }
  for (const file of bManifest.input) {
    const raw = bytes(bRoot, file);
    if (file.kind === "city") parseCityDocument(raw);
    if (file.kind === "location") parseLocationDocument(raw);
    if (file.kind === "dungeon") parseDocument(raw);
  }

  const runtimeBytes = bytes(bRoot, bManifest.campaign);
  const runtime = parseCampaignRuntimeManifest(runtimeBytes, sha);
  assert.equal(runtime.snapshot.campaignId, bManifest.initialOracle.campaignId);
  assert.equal(runtime.snapshot.namespace, bManifest.initialOracle.namespace);
  assert.equal(runtime.registry.registryId, bManifest.initialOracle.registryId);
  assert.equal(runtime.atlas.worldId, world.id);
  assert.equal(runtime.atlas.files.length, bManifest.input.length);
  assert.equal(
    runtime.atlas.records.length,
    bManifest.initialOracle.inventoryRecordCount,
  );
  for (const file of runtime.atlas.files) {
    const fixture = bManifest.input.find(
      (candidate: { path: string }) => candidate.path === file.path,
    )!;
    assert.ok(fixture, file.path);
    assert.equal(file.savedDigest, sha(bytes(bRoot, fixture)), file.path);
  }

  const saved = new Map(
    runtime.atlas.files.map((file) => [file.path, file.savedDigest]!),
  );
  const worldClosureDigest = campaignOwnershipDigestValue(
    {
      schema: "campaign-runtime-world-file-closure-v1",
      world: saved.get(worldFile.path),
      terrain: runtime.atlas.files
        .filter((file) => file.kind === "terrain")
        .map((file) => ({ path: file.path, savedDigest: file.savedDigest }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    },
    sha,
  );
  assert.equal(bManifest.provenance.worldClosureDigest, worldClosureDigest);
  const atlasPayloads = new Map<string, string>([
    [world.id, worldClosureDigest],
  ]);
  for (const file of bManifest.input.filter(
    (value: { kind: string }) => value.kind === "location",
  )) {
    const raw = bytes(bRoot, file),
      location = parseLocationDocument(raw),
      digest = sha(raw);
    atlasPayloads.set(location.id, digest);
    for (const section of location.sections)
      atlasPayloads.set(section.id, digest);
  }
  const rawWorldDigest = saved.get(worldFile.path)!;
  for (const placement of [...world.placements, ...world.detailPlacements])
    atlasPayloads.set(placement.id, rawWorldDigest);
  const cityDigest = saved.get(
    bManifest.input.find((file: { kind: string }) => file.kind === "city")!
      .path,
  )!;
  const dungeonDigest = saved.get(
    bManifest.input.find((file: { kind: string }) => file.kind === "dungeon")!
      .path,
  )!;
  for (const owner of runtime.registry.owners) {
    for (const record of owner.records) {
      const expected =
        owner.ownerId === "atlas"
          ? atlasPayloads.get(record.id)
          : owner.ownerId === "city"
            ? cityDigest
            : dungeonDigest;
      assert.equal(
        record.payloadDigest,
        expected,
        `${owner.ownerId}:${record.recordType}:${record.id}`,
      );
    }
    const suffix = campaignOwnershipDigestValue(
      {
        schema: "campaign-runtime-owner-fixture-v1",
        ownerId: owner.ownerId,
        records: owner.records.map(({ id, payloadDigest }) => ({
          id,
          payloadDigest,
        })),
      },
      sha,
    ).slice("sha256:".length);
    assert.equal(owner.ownerRevision, `owner:${suffix}`);
    assert.equal(owner.snapshotRevision, `snapshot:${suffix}`);
    assert.equal(owner.source.generation, `source:${suffix}`);
    assert.equal(
      owner.policyDigest,
      campaignDomainOwnerPolicyDigest(owner, sha),
    );
    const declared = bManifest.provenance.owners.find(
      (value: { ownerId: string }) => value.ownerId === owner.ownerId,
    );
    assert.deepEqual(declared, {
      ownerId: owner.ownerId,
      ownerRevision: owner.ownerRevision,
      snapshotRevision: owner.snapshotRevision,
      policyRevision: owner.policyRevision,
      policyDigest: owner.policyDigest,
      adapterType: owner.source.adapterType,
      generation: owner.source.generation,
    });
  }
  const { registryContentDigest, ...registryContent } = runtime.registry;
  assert.equal(
    registryContentDigest,
    campaignOwnershipDigestValue(registryContent, sha),
  );

  const store = new Store();
  const repository = new AtlasRepository(store, worldFile.path, store, {
    locations: true,
    details: true,
    resolveDetail: async (_worldId, kind, nativeId) =>
      [...store.files]
        .filter(
          ([path, raw]) =>
            path.endsWith(`.${kind}`) &&
            (kind === "city" ? parseCityDocument(raw) : parseDocument(raw))
              .id === nativeId,
        )
        .map(([path]) => path),
  });
  await repository.open();
  const capture = await repository.captureNative({ worldId: world.id });
  await repository.verifyNativeCapture(capture);
  assert.deepEqual(
    capture.files.map((file) => file.path).sort(),
    bManifest.input.map((file: { path: string }) => file.path).sort(),
  );
  for (const file of capture.files)
    assert.equal(
      file.beforeDigest,
      sha(store.files.get(file.path)!),
      file.path,
    );
});
