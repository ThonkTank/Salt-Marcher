import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  parseOverworld,
  serializeOverworld,
} from "../../../src/features/atlas/overworld";
import {
  parseTerrainChunk,
  serializeTerrainChunk,
} from "../../../src/features/atlas/terrain-schema";
import {
  parseCityDocument,
  serializeCityDocument,
} from "../../../src/features/city/codec";
import {
  parseLocationDocument,
  serializeLocationDocument,
} from "../../../src/features/location/location-schema";
import { parseDocument, serializeDocument } from "../../../src/model";

interface FileReceipt {
  path: string;
  fixtureFile: string;
  sha256: string;
  bytes: number;
}
interface Composition {
  kind: string;
  fixtureVersion: string;
  components: { owner: string; manifest: string; sha256: string }[];
  input: FileReceipt[];
  expected: FileReceipt[];
  identities: {
    id: string;
    path: string;
    inputPointer: string;
    expectedPointer: string;
  }[];
  persistedReferences: { path: string; pointer: string; targetId: string }[];
  pendingSpatialBindings: { state: string }[];
  campaignRef: { id: string; state: string };
}
const root = "tests/fixtures/atlas-e2e-components-v1",
  manifest = JSON.parse(
    readFileSync(`${root}/manifest.json`, "utf8"),
  ) as Composition,
  worldPath = "Atlanten/Gemeinsamer-Testatlas.overworld",
  bytes = (file: FileReceipt) =>
    readFileSync(resolve(root, file.fixtureFile), "utf8"),
  nativeFiles = (state: "input" | "expected") =>
    new Map(manifest[state].map((f) => [f.path, bytes(f)])),
  sha256 = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");

function fields(value: unknown, key: string, pointer = ""): [string, string][] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([name, child]) => {
    const next = `${pointer}/${name}`;
    return [
      ...(name === key && typeof child === "string"
        ? [[next, child] as [string, string]]
        : []),
      ...fields(child, key, next),
    ];
  });
}
function at(value: unknown, pointer: string): unknown {
  return pointer
    .split("/")
    .slice(1)
    .reduce<unknown>((v, k) => {
      assert.ok(v && typeof v === "object");
      return (v as Record<string, unknown>)[k];
    }, value);
}

test("E2E-01 composition pins seven native payloads, 21 identities and actual local references without inventing spatial bindings", () => {
  assert.equal(manifest.kind, "atlas-e2e-component-composition");
  assert.equal(manifest.fixtureVersion, "e2e01-component-closure-v1");
  const delivered: Record<"input" | "expected", FileReceipt[]> = {
    input: [],
    expected: [],
  };
  for (const component of manifest.components) {
    const raw = readFileSync(resolve(root, component.manifest));
    assert.equal(sha256(raw), component.sha256);
    const owner = JSON.parse(raw.toString("utf8"));
    const prefix = "../atlas-e2e-v1/";
    for (const state of ["input", "expected"] as const) {
      const files: FileReceipt[] =
        component.owner === "Hex"
          ? owner[state]
          : component.owner === "Dungeon"
            ? [owner[state]]
            : owner.files.filter((f: FileReceipt) =>
                f.fixtureFile.startsWith(state + "/"),
              );
      delivered[state].push(
        ...files.map((f) => ({
          path: f.path ?? f.fixtureFile.split("/").slice(1).join("/"),
          fixtureFile: prefix + f.fixtureFile,
          sha256: f.sha256,
          bytes: f.bytes,
        })),
      );
    }
  }
  const identities = new Set(manifest.identities.map((i) => i.id));
  assert.equal(identities.size, 21);
  assert.equal(manifest.identities.length, 21);
  assert.equal(identities.has(manifest.campaignRef.id), false);
  assert.equal(
    manifest.campaignRef.state,
    "reserved_reference_no_native_campaign_fixture",
  );
  assert.deepEqual(
    manifest.pendingSpatialBindings.map((b) => b.state),
    ["not_persisted", "not_persisted"],
  );
  for (const state of ["input", "expected"] as const) {
    assert.deepEqual(manifest[state], delivered[state]);
    assert.equal(manifest[state].length, 7);
    assert.equal(new Set(manifest[state].map((f) => f.path)).size, 7);
    const files = nativeFiles(state),
      world = parseOverworld(files.get(worldPath)!, true),
      actualIds: string[] = [],
      actualRefs: Composition["persistedReferences"] = [];
    for (const file of manifest[state]) {
      const raw = bytes(file),
        payload = JSON.parse(raw);
      assert.equal(Buffer.byteLength(raw), file.bytes);
      assert.equal(sha256(raw), file.sha256);
      let canonical: string;
      if (file.path === worldPath) canonical = serializeOverworld(world, true);
      else if (file.path.endsWith(".location"))
        canonical = serializeLocationDocument(parseLocationDocument(raw));
      else if (file.path.endsWith(".city"))
        canonical = serializeCityDocument(parseCityDocument(raw));
      else if (file.path.endsWith(".dungeon"))
        canonical = serializeDocument(parseDocument(raw));
      else {
        const ref = world.chunks.find(
          (r) => file.path === `Atlasdaten/${world.id}/${r.file}`,
        );
        assert.ok(ref);
        canonical = serializeTerrainChunk(
          parseTerrainChunk(raw, world.id, ref),
        );
      }
      assert.equal(canonical, raw);
      actualIds.push(...fields(payload, "id").map(([, value]) => value));
      for (const key of [
        "worldId",
        "locationId",
        "startNodeId",
        "endNodeId",
        "floorId",
        "toRoomId",
      ]) {
        actualRefs.push(
          ...fields(payload, key).map(([pointer, targetId]) => ({
            path: file.path,
            pointer,
            targetId,
          })),
        );
      }
    }
    assert.equal(actualIds.length, 21);
    assert.deepEqual(new Set(actualIds), identities);
    assert.deepEqual(actualRefs, manifest.persistedReferences);
    assert.equal(actualRefs.length, 8);
    for (const ref of actualRefs) assert.ok(identities.has(ref.targetId));
    for (const identity of manifest.identities) {
      assert.equal(
        at(
          JSON.parse(files.get(identity.path)!),
          identity[state === "input" ? "inputPointer" : "expectedPointer"],
        ),
        identity.id,
      );
    }
  }
});
