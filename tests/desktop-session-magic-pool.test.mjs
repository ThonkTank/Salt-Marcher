import test from "node:test";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { parseHTML } from "linkedom";

buildSync({
  entryPoints: ["src/app/session-magic-pool-ui.ts"],
  outfile: ".build/session-magic-pool.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
const page = (id) => ({
  ok: true,
  value: {
    items: [{ id, revision: 1, name: id, rarity: "Common" }],
    next: null,
    total: 1,
    sourceStatus: { message: "Ready" },
    problems: [],
  },
});
function fixture(t) {
  const previous = {
      window: globalThis.window,
      document: globalThis.document,
      CSS: globalThis.CSS,
    },
    dom = parseHTML(readFileSync("src/app/index.html","utf8"));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    CSS: { escape: (value) => value },
  });
  t.after(() => Object.assign(globalThis, previous));
  const waiting = [],
    messages = [];
  let enabled = 0;
  dom.window.campaign = {
    itemDefinitions: () => new Promise((resolve) => waiting.push(resolve)),
  };
  delete require.cache[require.resolve("../.build/session-magic-pool.cjs")];
  const picker = require("../.build/session-magic-pool.cjs").magicPoolPicker(
      (text) => messages.push(text),
      () => enabled++,
    ),
    get = (id) => dom.document.getElementById("session-magic-pool-" + id);
  Object.defineProperty(get("rarity"), "value", { value: "", writable: true });
  picker.context("owner");
  return { picker, get, waiting, messages, enabled: () => enabled };
}
test("changing context during a pool search immediately permits the next search and ignores the old reply", async (t) => {
  const x = fixture(t);
  x.get("find").onclick();
  assert.equal(x.get("find").disabled, true);
  x.picker.context("new owner");
  assert.equal(x.get("find").disabled, false);
  x.get("find").onclick();
  x.waiting[0](page("Old"));
  await tick();
  assert.equal(x.get("find").disabled, true);
  assert.equal(x.get("results").children.length, 0);
  x.waiting[1](page("New"));
  await tick();
  const box = x.get("results").querySelector("input");
  box.checked = true;
  box.onchange();
  assert.deepEqual(x.picker.selection(), [
    { definitionId: "New", revision: 1 },
  ]);
  assert.deepEqual(x.messages, []);
});
test("a checkbox from a previous plan cannot select an item after reopening under the same token", async (t) => {
  const x = fixture(t);
  x.get("find").onclick();
  x.waiting[0](page("Old"));
  await tick();
  const old = x.get("results").querySelector("input");
  x.picker.context("owner");
  old.checked = true;
  old.onchange();
  assert.equal(x.picker.selection(), undefined);
  assert.equal(x.enabled(), 0);
  assert.equal(x.get("selected").textContent, "0 Gegenstände gewählt");
});
