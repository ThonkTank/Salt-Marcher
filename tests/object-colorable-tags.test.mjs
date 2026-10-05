import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { discoverColorableObjectPaths } from
  "../src/features/objekte/colorable-tags.ts";

const fixture = "../dungeon-auswertung/tests/fixtures/" +
  "colorable-object-alpha-solid-probe/own-object-color.dungeondraft_pack";

test("QAObjASl Colorable tag identifies the real object image", async () => {
  const bytes = await readFile(fixture);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x43504447);
  const entries = [];
  let position = 88;
  for (let i = 0, count = view.getUint32(84, true); i < count; i++) {
    const length = view.getUint32(position, true);
    position += 4;
    const path = bytes.subarray(position, position + length)
      .toString("utf8").replace(/\0+$/, "");
    position += length;
    const offset = Number(view.getBigUint64(position, true));
    const size = Number(view.getBigUint64(position + 8, true));
    position += 32;
    entries.push({ path, offset, size });
  }
  const prefix = "res://packs/QAObjASl/";
  const pack = {
    metadata: { id: "QAObjASl" },
    entries,
    asset(relative) {
      const entry = entries.find((candidate) =>
        candidate.path === prefix + relative);
      assert.ok(entry, `missing fixture asset: ${relative}`);
      return new Blob([bytes.subarray(entry.offset, entry.offset + entry.size)]);
    },
  };
  const paths = await discoverColorableObjectPaths(pack);
  assert.deepEqual([...paths], ["textures/objects/QA Object Color.png"]);
  assert.equal(paths.has("textures/patterns/normal/QA Gray.png"), false);
});

test("Colorable tags accept own-pack paths and ignore unrelated entries", async () => {
  const tagFile = new Blob([JSON.stringify({ tags: {
    Colorable: [
      "textures/objects/Chair.png",
      "res://packs/QAObjASl/textures/objects/Table.png",
      "res://packs/Other/textures/objects/Foreign.png",
      "textures/patterns/colorable/Floor.png",
      17,
    ],
  } })]);
  const paths = await discoverColorableObjectPaths({
    metadata: { id: "QAObjASl" },
    entries: [{ path: "res://packs/QAObjASl/data/custom.dungeondraft_tags" }],
    asset: () => tagFile,
  });
  assert.deepEqual([...paths], [
    "textures/objects/Chair.png",
    "textures/objects/Table.png",
  ]);
});
