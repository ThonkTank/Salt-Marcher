import {atlasFixture} from './helpers/atlas-workbench.mjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "./helpers/build.mjs";
import { createRequire } from "node:module";
import { parseHTML } from "./helpers/dom.mjs";
buildSync({
  stdin: {
    contents:
      "export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/independent-building.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const { CampaignAtlasWorkbench } = createRequire(import.meta.url)(
  "../.build/independent-building.cjs",
);
function fixture(t, cityId = null) {
  const saved = { window: global.window, document: global.document },
    { window, document } = parseHTML(
      '<html><body><select id="city-tool"><option value="building" selected>Haus</option></select><input id="atlas-new-name" value=""></body></html>',
    );
  Object.assign(global, { window, document });
  const selects = new WeakMap(),
    selectProto = window.HTMLSelectElement.prototype,
    oldValue = Object.getOwnPropertyDescriptor(selectProto, "value");
  Object.defineProperty(selectProto, "value", {
    configurable: true,
    get() {
      return selects.get(this) ?? this.querySelector("option")?.value ?? "";
    },
    set(v) {
      selects.set(this, v);
    },
  });
  t.after(() => Object.defineProperty(selectProto, "value", oldValue));
  const proto = window.HTMLElement.prototype,
    show = proto.showModal;
  proto.showModal = function () {
    this.open = true;
  };
  t.after(() => {
    proto.showModal = show;
    Object.assign(global, saved);
  });
  const writes = [],
    point = { x: 12345678.25, y: -3456789.5 },
    owner = { token: "current" };
  const ui = Object.assign(atlasFixture(CampaignAtlasWorkbench), {
    owner,
    cityId,
    scopeId: null,
    family: "city",
    entranceDraft: null,
    root: { dataset: {} },
    camera: { ready: true, hitAt: () => null },
    point: () => ({ ...point }),
    geometryCurrent: () => true,
    render() {},
    error(e) {
      throw e;
    },
    write: async (action, workspace) => {
      writes.push({ action, workspace });
      return { result: { id: "house-" + writes.length } };
    },
  });
  const close = (value) => {
    const dialog = document.querySelector("dialog");
    assert(dialog);
    dialog.returnValue = value;
    dialog.dispatchEvent(new window.Event("close"));
  };
  return { ui, writes, point, document, close };
}
for (const cityId of [null, "legacy-city"])
  test(
    "single house is placed as independent world geometry: " + cityId,
    async (t) => {
      const x = fixture(t, cityId);
      for (let i = 0; i < 2; i++) {
        x.document.getElementById("atlas-new-name").value = i
          ? "Mein Haus"
          : "";
        const task = x.ui.click({ button: 0, altKey: false });
        assert.equal(x.document.querySelector("dialog [value=empty]"), null);
        x.close("accept");
        await task;
        const { action, workspace } = x.writes[i];
        assert.equal(action.kind, "group-generate");
        assert.equal(action.name, i ? "Mein Haus" : "Wohnhaus");
        assert.equal(action.x, x.point.x);
        assert.equal(action.y, x.point.y);
        assert.equal(workspace, true);
        assert.equal(x.ui.family, "city");
        assert.equal(x.ui.scopeId, null);
        assert.equal(x.ui.cityId, cityId);
      }
      assert.equal(x.writes.length, 2);
    },
  );
test("cancel and campaign switch during the building preview cannot write", async (t) => {
  const x = fixture(t);
  let task = x.ui.click({ button: 0, altKey: false });
  x.close("cancel");
  await task;
  assert.equal(x.writes.length, 0);
  task = x.ui.click({ button: 0, altKey: false });
  x.ui.owner = { token: "replacement" };
  x.close("accept");
  await task;
  assert.equal(x.writes.length, 0);
});
