import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { parseHTML } from "linkedom";

buildSync({
  stdin: {
    contents:
      "export * from './src/app/adventuring-day-ui';export {calculateDay} from './src/app/adventuring-day-model';",
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: ".build/adventuring-day-dom.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
const settled = () => new Promise((resolve) => setTimeout(resolve, 160));
function fixture(t) {
  const previous = { window: globalThis.window, document: globalThis.document },
    dom = parseHTML(readFileSync("src/app/index.html", "utf8"));
  Object.assign(globalThis, { window: dom.window, document: dom.document });
  delete require.cache[require.resolve("../.build/adventuring-day-dom.cjs")];
  const ui = require("../.build/adventuring-day-dom.cjs"),
    get = (id) => dom.document.getElementById("day-" + id),
    calls = [];
  let open = false;
  get("popover").matches = () => open;
  get("popover").showPopover = () => {
    open = true;
  };
  get("popover").hidePopover = () => {
    open = false;
  };
  dom.window.campaign = {
    adventuringDay: async (_token, request) => {
      calls.push(structuredClone(request));
      let calculation = null,
        problem = null;
      try {
        calculation = ui.calculateDay(
          request.source === "active" ? [{ level: 1, count: 1 }] : request.rows,
          request.totalXp,
          request.rewardXp,
        );
      } catch (error) {
        problem = error.message;
      }
      return {
        ok: true,
        value: {
          snapshot: {
            available: true,
            partySize: 1,
            averageLevel: 1,
            dailyBudget: 300,
            shortXp: 0,
            longXp: 0,
            reason: "Aktuelle Party",
            rows: [{ level: 1, count: 1 }],
            members: [],
          },
          calculation,
          problem,
        },
      };
    },
  };
  ui.initDayCalculator(
    () => {},
    () => {},
  );
  ui.activateDayCalculator({ token: "owner" });
  t.after(() => {
    ui.activateDayCalculator(null);
    Object.assign(globalThis, previous);
  });
  const input = (element, value) => {
    element.value = value;
    if (element.oninput) element.oninput();
    else element.dispatchEvent(new dom.window.Event("input"));
  };
  return {
    get,
    calls,
    input,
    open: async () => {
      await tick();
      get("trigger").onclick();
      await tick();
    },
  };
}
test("unfinished custom rows keep their exact text when another row is added or removed", async (t) => {
  const x = fixture(t);
  await x.open();
  const [level, count] = x.get("rows").querySelectorAll("input");
  x.input(level, "01");
  x.input(count, "");
  x.get("add").onclick();
  assert.deepEqual(
    [...x.get("rows").querySelectorAll("input")].map((e) => e.value),
    ["01", "", "1", "1"],
  );
  x.get("rows").lastElementChild.querySelector("button").onclick();
  assert.deepEqual(
    [...x.get("rows").querySelectorAll("input")].map((e) => e.value),
    ["01", ""],
  );
  await settled();
  assert.equal(x.get("summary").children.length, 0);
  assert.match(x.get("status").textContent, /Zeilen/);
  x.input(x.get("rows").querySelectorAll("input")[1], "2");
  await settled();
  assert.equal(x.calls.at(-1).rows[0].count, 2);
  assert.match(x.get("summary").textContent, /600 XP Tagesbudget/);
});
