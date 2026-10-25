import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readObjectArgb,
  writeObjectArgb,
} from "../../../src/features/objekte/color-alpha";
import { parseDocument, type MapObject } from "../../../src/model";
import { newDocument } from "./fixtures";

test("DD-028 object alpha survives a fresh document parse and rejects invalid bytes", () => {
  const document = newDocument("Objektfarbe", 8, 8);
  const native = readObjectArgb("804080c0");
  const object: MapObject = {
    id: "colored-object",
    kind: "object",
    floorId: document.floors[0]!.id,
    x: 3,
    y: 3,
    rotation: 0,
    width: 1,
    height: 1,
    color: native.rgb,
    alpha: native.alphaByte,
    label: "",
    assetId:
      "pack:QAObjASl:object:textures%2Fobjects%2FQA%20Object%20Color.png",
  };
  for (const alpha of [128, 0]) {
    const saved = parseDocument(
      JSON.stringify({ ...document, entities: [{ ...object, alpha }] }),
    );
    const reopened = saved.entities[0] as MapObject;
    assert.equal(
      writeObjectArgb({ rgb: reopened.color, alphaByte: reopened.alpha! }),
      alpha === 128 ? "804080c0" : "004080c0",
    );
  }
  assert.throws(
    () =>
      parseDocument(
        JSON.stringify({ ...document, entities: [{ ...object, alpha: 256 }] }),
      ),
    /Kartenobjekt/,
  );
});
