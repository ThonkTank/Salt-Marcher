import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/features/objekte/scatter-picker-dismiss.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const {
  attachScatterPickerOutsideDismiss,
  dismissScatterPickerOnOutside,
  scatterPointerSource,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64")
);
const pickerBundle = await build({
  entryPoints: ["src/features/objekte/rgba-picker.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { ObjectColorPicker } = await import(
  "data:text/javascript;base64," +
    Buffer.from(pickerBundle.outputFiles[0].contents).toString("base64")
);

function fixture() {
  let listener;
  const source = {
    addEventListener(type, callback, capture) {
      assert.equal(type, "pointerdown");
      assert.equal(capture, true);
      assert.equal(listener, undefined);
      listener = callback;
    },
    removeEventListener(type, callback, capture) {
      assert.equal(type, "pointerdown");
      assert.equal(capture, true);
      assert.equal(listener, callback);
      listener = undefined;
    },
    press(target) {
      listener?.({ target });
    },
    get listening() {
      return !!listener;
    },
  };
  const inside = {},
    openerButton = {},
    elsewhere = {};
  const picker = { contains: (target) => target === inside };
  const opener = { contains: (target) => target === openerButton };
  return { source, picker, opener, inside, openerButton, elsewhere };
}

test("DD-028.16 Scatter picker dismisses once on outside pointer press", () => {
  const f = fixture();
  let dismissals = 0;
  const dispose = attachScatterPickerOutsideDismiss(
    f.source,
    f.picker,
    f.opener,
    () => {
      dismissals++;
      return true;
    },
  );
  f.source.press(f.inside);
  f.source.press(f.openerButton);
  f.source.press(null);
  assert.equal(dismissals, 0);
  assert.equal(f.source.listening, true);
  f.source.press(f.elsewhere);
  assert.equal(dismissals, 1);
  assert.equal(f.source.listening, false);
  f.source.press(f.elsewhere);
  dispose();
  assert.equal(dismissals, 1);
});

test("DD-028.16 explicit teardown leaves no outside listener", () => {
  const f = fixture();
  let dismissals = 0;
  const dispose = attachScatterPickerOutsideDismiss(
    f.source,
    f.picker,
    f.opener,
    () => {
      dismissals++;
      return true;
    },
  );
  dispose();
  assert.equal(f.source.listening, false);
  f.source.press(f.elsewhere);
  assert.equal(dismissals, 0);
});

test("DD-028.16 a failed dismissal keeps the listener", () => {
  const f = fixture();
  let resolved = false;
  const dispose = attachScatterPickerOutsideDismiss(
    f.source,
    f.picker,
    f.opener,
    () => resolved,
  );
  f.source.press(f.elsewhere);
  assert.equal(f.source.listening, true);
  resolved = true;
  f.source.press(f.elsewhere);
  assert.equal(f.source.listening, false);
  dispose();
});

test("DD-028.16 changed color closes on outside press through common commit path", () => {
  const f = fixture();
  const commits = [];
  const closeReasons = [];
  const controller = new ObjectColorPicker(0x6b3834, 255, {
    onPreview() {},
    onCommit(rgb, alpha) { commits.push({ rgb, alpha }); },
    onClose(reason) { closeReasons.push(reason); },
  });
  assert.equal(controller.setHex("7292b2"), true);
  const mounted = { close(reason) { controller.close(reason); } };
  attachScatterPickerOutsideDismiss(
    f.source, f.picker, f.opener,
    () => dismissScatterPickerOnOutside(mounted),
  );
  f.source.press(f.elsewhere);
  assert.deepEqual(closeReasons, ["escape"]);
  assert.deepEqual(commits, [{ rgb: 0x7292b2, alpha: 255 }]);
  assert.equal(f.source.listening, false);
  f.source.press(f.elsewhere);
  assert.deepEqual(closeReasons, ["escape"]);
  assert.deepEqual(commits, [{ rgb: 0x7292b2, alpha: 255 }]);
});

test("DD-028.16 outside listener uses the host popout document", () => {
  const f = fixture();
  assert.equal(scatterPointerSource({ ownerDocument: f.source }), f.source);
});
