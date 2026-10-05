import { test } from "node:test";
import assert from "node:assert/strict";
import { Session } from "../src/session";
import { newDocument } from "../src/model";
import { ObjectColorPicker } from "../src/features/objekte/rgba-picker";
import {
  ObjectLibraryTilePreview,
  type LibraryTilePixels,
} from "../src/features/objekte/library-tile-preview";
import { DEFAULT_COLORABLE_OBJECT_SETTINGS } from "../src/features/objekte/colorable-pixels";

const source: LibraryTilePixels = {
  width: 2,
  height: 1,
  rgba: new Uint8Array([200, 0, 0, 255, 200, 176, 176, 255]),
};

test("DD-028.06 library tile previews only colorable pixels before Accept", async () => {
  const image = { src: "original" };
  const encoded: Uint8Array[] = [];
  const tile = new ObjectLibraryTilePreview(
    image,
    Promise.resolve(source),
    DEFAULT_COLORABLE_OBJECT_SETTINGS,
    (_width, _height, rgba) => {
      encoded.push(rgba);
      return `preview-${encoded.length}`;
    },
  );
  const session = new Session(newDocument("Tile preview", 8, 8));
  const before = JSON.stringify(session.document());
  const history = session.historySize;
  let defaults = { color: 0xffffff, alpha: 255 };
  const picker = new ObjectColorPicker(defaults.color, defaults.alpha, {
    onPreview: (color, alpha) => {
      void tile.set(color, alpha);
    },
    onCommit: (color, alpha) => {
      defaults = { color, alpha };
    },
  });
  picker.setHex("4080c0");
  picker.setChannel("a", 128);
  await tile.set(0x4080c0, 128);
  assert.equal(image.src, "preview-1");
  assert.equal(encoded.length, 1);
  assert.equal(encoded[0]![3], 128);
  assert.deepEqual([...encoded[0]!.subarray(4)], [200, 176, 176, 255]);
  assert.notDeepEqual([...encoded[0]!.subarray(0, 3)], [200, 0, 0]);
  assert.equal(JSON.stringify(session.document()), before);
  assert.equal(session.historySize, history);
  picker.close("accept");
  assert.deepEqual(defaults, { color: 0x4080c0, alpha: 128 });
  assert.equal(session.historySize, history);
});

test("DD-028.06 Escape retains A0 tile/default; old requests cannot replace it", async () => {
  let resolve!: (value: LibraryTilePixels) => void;
  const deferred = new Promise<LibraryTilePixels>((done) => {
    resolve = done;
  });
  const image = { src: "original" };
  const pixels: Uint8Array[] = [];
  const tile = new ObjectLibraryTilePreview(
    image,
    deferred,
    DEFAULT_COLORABLE_OBJECT_SETTINGS,
    (_width, _height, rgba) => {
      pixels.push(rgba);
      return `preview-${pixels.length}`;
    },
  );
  const old = tile.set(0x4080c0, 128);
  const latest = tile.set(0x4080c0, 0);
  resolve(source);
  assert.equal(await old, false);
  assert.equal(await latest, true);
  assert.equal(image.src, "preview-1");
  assert.equal(pixels[0]![3], 0);
  assert.equal(pixels[0]![7], 255);
  const session = new Session(newDocument("Escape preview", 8, 8));
  let defaults = { color: 0x4080c0, alpha: 128 };
  const picker = new ObjectColorPicker(defaults.color, defaults.alpha, {
    onPreview: (color, alpha) => {
      void tile.set(color, alpha);
    },
    onCommit: (color, alpha) => {
      defaults = { color, alpha };
    },
  });
  picker.setChannel("a", 0);
  picker.close("escape");
  assert.deepEqual(defaults, { color: 0x4080c0, alpha: 0 });
  assert.equal(session.historySize, 0);
  tile.dispose();
  assert.equal(await tile.set(0xff0000, 255), false);
  assert.equal(image.src, "preview-1");
});

test("DD-028.06 a rebuilt tile keeps the chosen color and rejects the old result", async () => {
  let resolve!: (value: LibraryTilePixels) => void;
  const delayed = new Promise<LibraryTilePixels>((done) => { resolve = done; });
  const oldImage = { src: "raw-old" };
  const newImage = { src: "raw-new" };
  const encoded: Uint8Array[] = [];
  const encode = (_width: number, _height: number, rgba: Uint8Array) => {
    encoded.push(rgba);
    return `preview-${encoded.length}`;
  };
  const oldTile = new ObjectLibraryTilePreview(
    oldImage, delayed, DEFAULT_COLORABLE_OBJECT_SETTINGS, encode,
  );
  const oldRequest = oldTile.set(0xff0000, 255);
  oldTile.dispose();
  const rebuilt = new ObjectLibraryTilePreview(
    newImage, delayed, DEFAULT_COLORABLE_OBJECT_SETTINGS, encode,
  );
  const newRequest = rebuilt.set(0x4080c0, 128);
  resolve(source);
  assert.equal(await oldRequest, false);
  assert.equal(await newRequest, true);
  assert.equal(oldImage.src, "raw-old");
  assert.equal(newImage.src, "preview-1");
  assert.equal(encoded.length, 1);
  assert.equal(encoded[0]![3], 128);
  assert.deepEqual([...encoded[0]!.subarray(4)], [200, 176, 176, 255]);
});
