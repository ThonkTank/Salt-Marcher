import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { parseHTML } from "linkedom";

buildSync({
  entryPoints: ["src/app/party-topbar-ui.ts"],
  outfile: ".build/party-topbar-dom.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
test("setting XP requires an explicit number; blank input never becomes a zero-XP preview or write", async (t) => {
  const previous = { window: globalThis.window, document: globalThis.document },
    dom = parseHTML(readFileSync("src/app/index.html", "utf8"));
  Object.assign(globalThis, { window: dom.window, document: dom.document });
  delete require.cache[require.resolve("../.build/party-topbar-dom.cjs")];
  const ui = require("../.build/party-topbar-dom.cjs"),
    get = (id) => dom.document.getElementById("party-" + id);
  dom.window.innerWidth=1000;dom.window.innerHeight=800;get("shortcut").getBoundingClientRect=()=>({left:700,right:800,top:20,bottom:60,width:100,height:40});
  let open = false;
  get("popover").matches = () => open;
  get("popover").showPopover = () => {
    open = true;
  };
  get("popover").hidePopover = () => {
    open = false;
  };
  Object.defineProperty(get("xp-mode"), "value", {
    value: "set",
    writable: true,
  });
  Object.defineProperty(get("level"), "value", { value: "", writable: true });
  const character = {
    id: "ada",
    profile: { name: "Ada" },
    active: true,
    sceneId: null,
    profileRevision: 0,
    membershipRevision: 0,
  };
  dom.window.campaign = {
    live: async () => ({
      ok: true,
      value: { roster: [character], focusId: null, scene: null },
    }),
    progress: async () => ({
      ok: true,
      value: {
        characters: [
          {
            characterId: "ada",
            xp: 290,
            revision: 1,
            rest: { known: false },
            health: null,
          },
        ],
      },
    }),
  };
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar({ token: "owner" });
  t.after(() => {
    ui.activatePartyTopbar(null);
    Object.assign(globalThis, previous);
  });
  get("shortcut").onclick();
  await tick();
  get("active").querySelector(".party-level-meter").onclick();
  get("xp-mode").value = "set";
  get("xp-amount").value = "";
  get("xp-amount").oninput();
  assert.match(get("xp-preview").textContent, /ganze XP eintragen/);
  get("xp-form").onsubmit({ preventDefault() {} });
  assert.match(get("xp-status").textContent, /ganze XP eintragen/);
  assert.equal(get("xp-editor").hidden, false);
  get("xp-amount").value = "0";
  get("xp-amount").oninput();
  assert.match(get("xp-preview").textContent, /Danach 0 XP/);
});
