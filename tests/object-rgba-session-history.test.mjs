import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `
      export { ObjectColorPicker } from "./src/features/objekte/rgba-picker.ts";
      export { Session } from "./src/session.ts";
      export { newDocument } from "./src/model.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "object-rgba-history-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { ObjectColorPicker, Session, newDocument } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64"),
);

function fixture(alpha = 128) {
  const session = new Session(newDocument("RGBA history QA", 8, 8));
  const object = {
    id: "qa-colorable", floorId: session.floors.keys().next().value,
    kind: "object", x: 3, y: 3, rotation: 0, width: 1, height: 1,
    color: 0x4080c0, alpha, label: "",
  };
  session.execute({ label: "QA-Objekt", entities: [
    { id: object.id, before: null, after: object },
  ] });
  return { session, object };
}

function openForSelected(session, object, previews, commits) {
  return new ObjectColorPicker(object.color, object.alpha, {
    onPreview: (rgb, alpha) => {
      previews.push([rgb, alpha]);
      assert.equal(session.entities.get(object.id)?.alpha, object.alpha);
    },
    onCommit: (rgb, alpha) => {
      const before = session.entities.get(object.id);
      session.execute({
        label: "Eigenschaften ändern",
        entities: [{ id: object.id, before, after: { ...before, color: rgb, alpha } }],
      });
      commits.push([rgb, alpha]);
    },
  });
}

test("DD-028.06 selected A128→A0: live preview has no history, Escape commits one undoable change", () => {
  const { session, object } = fixture();
  const previews = [], commits = [];
  const before = session.historySize;
  const picker = openForSelected(session, object, previews, commits);
  assert(picker.setChannel("a", 255));
  assert(picker.setChannel("a", 0));
  assert.equal(session.historySize, before);
  assert.equal(session.entities.get(object.id)?.alpha, 128);
  picker.close("escape");
  picker.close("accept");
  assert.deepEqual(previews, [[0x4080c0, 255], [0x4080c0, 0]]);
  assert.deepEqual(commits, [[0x4080c0, 0]]);
  assert.equal(session.historySize, before + 1);
  assert.equal(session.entities.get(object.id)?.alpha, 0);
  session.undo();
  assert.equal(session.entities.get(object.id)?.alpha, 128);
  session.redo();
  assert.equal(session.entities.get(object.id)?.alpha, 0);
});

test("DD-028.06 selected A0→A128: ARGB fields and Accept create one history command", () => {
  const { session, object } = fixture(0);
  const previews = [], commits = [];
  const before = session.historySize;
  const picker = openForSelected(session, object, previews, commits);
  assert.equal(picker.argb, "004080c0");
  assert(picker.setHex("804080c0"));
  assert.equal(picker.value.a, 128);
  assert.equal(picker.hexDisplay, "804080c0");
  assert.equal(session.historySize, before);
  picker.close("accept");
  assert.deepEqual(previews, [[0x4080c0, 128]]);
  assert.deepEqual(commits, [[0x4080c0, 128]]);
  assert.equal(session.historySize, before + 1);
  session.undo();
  assert.equal(session.entities.get(object.id)?.alpha, 0);
  session.redo();
  assert.equal(session.entities.get(object.id)?.alpha, 128);
});
