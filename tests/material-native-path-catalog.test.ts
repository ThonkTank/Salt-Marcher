import { test } from "node:test";
import assert from "node:assert/strict";
import { openAsBlob } from "node:fs";
import {
  NATIVE_PATH_PACK_ID,
  readNativePathCatalog,
} from "../src/features/material/native-path-catalog";

function stex(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const mark = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      bytes[offset + index] = value.charCodeAt(index);
  };
  mark(0, "GDST");
  view.setUint32(4, width, true);
  view.setUint32(8, height, true);
  view.setUint32(20, 1, true);
  view.setUint32(24, 16, true);
  mark(28, "WEBP");
  mark(32, "RIFF");
  view.setUint32(36, 4, true);
  mark(40, "WEBP");
  return bytes;
}

function pck(files: Readonly<Record<string, Uint8Array>>): Blob {
  const encoder = new TextEncoder();
  const rows = Object.entries(files).map(([path, data]) => ({
    path: encoder.encode(path + "\0"),
    data,
  }));
  const directoryLength = rows.reduce(
    (length, row) => length + 36 + row.path.length,
    88,
  );
  const bytes = new Uint8Array(
    directoryLength + rows.reduce((n, row) => n + row.data.length, 0),
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x43504447, true);
  view.setUint32(4, 1, true);
  view.setUint32(84, rows.length, true);
  let cursor = 88,
    payload = directoryLength;
  for (const row of rows) {
    view.setUint32(cursor, row.path.length, true);
    cursor += 4;
    bytes.set(row.path, cursor);
    cursor += row.path.length;
    view.setBigUint64(cursor, BigInt(payload), true);
    cursor += 8;
    view.setBigUint64(cursor, BigInt(row.data.length), true);
    cursor += 8;
    cursor += 16;
    bytes.set(row.data, payload);
    payload += row.data.length;
  }
  return new Blob([bytes]);
}

function fixture(changes: Readonly<Record<string, Uint8Array>> = {}): Blob {
  const encoder = new TextEncoder();
  return pck({
    "res://textures/paths/battlements.png.import": encoder.encode(
      '[remap]\npath="res://.import/battlements.stex"\n',
    ),
    "res://.import/battlements.stex": stex(1024, 69),
    "res://textures/paths/bone_fence_01.png.import": encoder.encode(
      '[remap]\npath="res://.import/bone_fence_01.stex"\n',
    ),
    "res://.import/bone_fence_01.stex": stex(512, 40),
    "res://scenes/main.tscn": encoder.encode("irrelevant"),
    ...changes,
  });
}

test("DD-021.15 native path catalog maps source names and returns a WebP slice", async () => {
  const catalog = await readNativePathCatalog(fixture());
  assert.deepEqual(
    catalog.textures.map((texture) => texture.asset.name),
    ["Battlements", "Bone Fence 01"],
  );
  const battlements = catalog.textures[0]!;
  assert.equal(battlements.asset.packId, NATIVE_PATH_PACK_ID);
  assert.equal(battlements.asset.kind, "path");
  assert.equal(
    battlements.asset.files.image,
    "res://textures/paths/battlements.png",
  );
  assert.deepEqual([battlements.width, battlements.height], [1024, 69]);
  assert.match(battlements.asset.id, /^pack:/);
  const image = catalog.image(battlements.asset.id);
  assert.equal(image?.type, "image/webp");
  assert.equal(await image?.text(), "RIFF\u0004\u0000\u0000\u0000WEBP");
  assert.equal(catalog.image("pack:other:path:foreign"), undefined);
});

test("DD-021.15 rejects missing or unsupported texture remaps", async () => {
  const encoder = new TextEncoder();
  await assert.rejects(
    readNativePathCatalog(
      fixture({
        "res://textures/paths/battlements.png.import": encoder.encode(
          '[remap]\npath="res://.import/missing.stex"\n',
        ),
      }),
    ),
    /Pfadtextur fehlt/,
  );
  const invalidTexture = stex(1024, 69);
  invalidTexture[28] = 0;
  await assert.rejects(
    readNativePathCatalog(
      fixture({
        "res://.import/battlements.stex": invalidTexture,
      }),
    ),
    /Nicht unterstützte Pfadtextur/,
  );
});

test("DD-021.15 local Dungeondraft 1.2.0.1 archive has usable path sources", async (context) => {
  const archive = process.env.DUNGEONDRAFT_1201_PCK;
  if (!archive)
    return context.skip(
      "Set DUNGEONDRAFT_1201_PCK for the local licensed archive",
    );
  const catalog = await readNativePathCatalog(await openAsBlob(archive));
  assert.equal(catalog.textures.length, 44);
  const battlements = catalog.textures.find(
    (texture) => texture.asset.name === "Battlements",
  );
  assert.deepEqual([battlements?.width, battlements?.height], [1024, 69]);
  for (const texture of catalog.textures) {
    const image = catalog.image(texture.asset.id)!;
    const bytes = new Uint8Array(await image.slice(0, 12).arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
    assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WEBP");
  }
});
