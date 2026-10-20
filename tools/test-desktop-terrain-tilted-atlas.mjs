import {setBrushWorldRadius,setHeightDirection} from './atlas-brush-probe.mjs';
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { RELIEF_STROKES } from "./terrain-relief-scene.mjs";
import {randomUUID} from "node:crypto";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { homedir } from "node:os";
import { atlasCanvasReady } from "./atlas-canvas-probe.mjs";
const root = process.cwd(),
  require = createRequire(root + "/package.json"),
  { _electron } = require("playwright-core");
require("esbuild").buildSync({
  stdin: {
    contents:
      "export * from './src/app/terrain-spatial-model';export * from './src/app/storage/store';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export {newLocation} from './src/features/location/location-schema';",
    resolveDir: root,
  },
  outfile: ".build/tilted-atlas-native-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore, TerrainSampler, terrainGrid, gridHeight, projectTerrain, terrainVisible } = require(root + "/.build/tilted-atlas-native-store.cjs");
const profileRoot = path.join(homedir(), ".cache/saltmarcher/ui-profiles");
await mkdir(profileRoot, { recursive: true });
const dir = await mkdtemp(path.join(profileRoot, "landscape-")),
  out = path.resolve(
    process.env.QA_EVIDENCE_DIR ?? ".build/terrain-tilted-atlas-native",
  );
await mkdir(out, { recursive: true });
const store = new CampaignStore(dir + "/workbench.sqlite"),
  room = {
    id: "watch",
    scopeId: "local",
    floorId: "ground",
    number: "1",
    name: "Referenzhaus",
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 12, y: 0 },
          { x: 12, y: 8 },
          { x: 0, y: 8 },
        ],
        holes: [],
      },
    ],
    sections: [],
  };
const cam = store.create("Geländeprobe R5", [room]),
  active = store.activate(cam.id);
store.tutorial("skipped");
const seedWrite=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
for(const stroke of RELIEF_STROKES)seedWrite({kind:'landscape-height-stroke',stroke});
for(const [kind,points,width]of [['river',[{x:-2600,y:1000},{x:-1000,y:1400},{x:500,y:700},{x:2300,y:400}],38],['road',[{x:-800,y:-1500},{x:-700,y:-700},{x:-500,y:100},{x:-100,y:900}],24]])seedWrite({kind:'landscape-put',expectedRevision:null,record:{id:randomUUID(),revision:0,kind,name:kind==='road'?'Passstraße':'Talfluss',points,polygons:[],width,resolution:1,values:{}}});
const {newLocation}=require(root+'/.build/tilted-atlas-native-store.cjs');
const village=newLocation(randomUUID(),'Bergdorf', 'poi',[randomUUID(),randomUUID()]);
seedWrite({kind:'landscape-place',expectedRevision:null,expectedLocationRevision:null,document:village,record:{id:randomUUID(),revision:0,kind:'place',name:village.name,locationId:village.id,points:[{x:-100,y:900}],polygons:[],width:0,resolution:1,values:{}}});

store.close();
const Database = require("better-sqlite3"),
  db = new Database(dir + "/workbench.sqlite", { readonly: true }),
  records = () =>
    db
      .prepare("SELECT payload FROM atlas_landscape")
      .all()
      .map((r) => JSON.parse(r.payload));
const result = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty: !!execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { encoding: "utf8" },
  ).trim(),
  profile: dir,
  errors: [],
  checks: [],
};
result.sourceHashes = {};
for (const file of [
  "src/app/terrain-height.ts",
  "src/app/landscape-brush.ts",
  "tests/terrain-tilted-atlas.test.mjs",
  "tests/terrain-tilted-atlas-storage.test.mjs",
  "tools/build-desktop.mjs",
  "src/app/terrain-spatial-ui.ts",
  "src/app/terrain-spatial-view.ts",
  "src/app/terrain-spatial-worker.ts",
  "src/app/terrain-spatial-model.ts",
  "src/app/terrain-color-visibility.ts",
  ".build/desktop/ui/terrain-spatial-worker.js",

  "src/app/terrain-brush.ts",
  "src/app/atlas-tool-catalog.ts",
  "src/app/atlas-workspace-layout.ts",
  "src/app/atlas-units.ts",
  "tests/desktop-atlas-tool-hierarchy.test.mjs",
  "src/app/campaign-atlas-ui.ts",
  "tests/terrain-brush.test.mjs",
  "src/app/landscape-color-surface.ts",
  "src/app/landscape-tool-settings.ts",
  "src/app/storage/campaign-atlas.ts",
  "src/app/campaign-atlas-contracts.ts",
  "src/app/atlas-region-contracts.ts",
  "src/app/atlas-landscape-view.ts",
  "tests/terrain-height.test.mjs",
  "src/app/atlas-landscape.ts",
  "src/app/atlas-brush-worker.ts",
  "src/app/landscape-raster.ts",
  "src/app/storage/atlas-landscape.ts",
  "src/app/storage/landscape-brush-edit.ts",
  "src/app/storage/atlas-landscape-region.ts",
  "src/app/storage/store.ts",
  "src/app/atlas-landscape-ui.ts",
  "desktop/main.ts",
  "desktop/preload.ts",
  ".build/desktop/main.cjs",
  ".build/desktop/ui/atlas-brush-worker.js",
  ".build/desktop/ui/renderer.js",
  ".build/desktop/atlas-region-worker.cjs",
  "tools/test-desktop-terrain-tilted-atlas.mjs",
  "tools/terrain-relief-scene.mjs",
  "src/app/terrain-relief.ts",
])
  result.sourceHashes[file] = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const mark = (text) => {
  result.checks.push(text);
  console.log(text);
};
let app, page;
async function start() {
  const executable = process.env.ATLAS_PACKAGE
    ? path.join(process.env.ATLAS_PACKAGE, "electron")
    : root + "/node_modules/electron/dist/electron";
  app = await _electron.launch({
    executablePath: executable,
    args: [
      ...(process.env.ATLAS_PACKAGE ? [] : [root + "/.build/desktop/main.cjs"]),
      "--data-dir",
      dir,
      "--ozone-platform=x11",
    ],
    timeout: 60000,
  });
  if (process.env.ATLAS_PACKAGE)
    assert.equal(
      await app.evaluate(({ app }) => app.getVersion()),
      JSON.parse(await readFile(root + "/package.json", "utf8")).version,
    );
  page = await app.firstWindow();
  console.log("Native window opened");
  page.on("pageerror", (e) => result.errors.push(e.stack ?? e.message));
  await page.waitForFunction(
    () => document.body.dataset.tutorialReady === "true",
  );
  // Fixture setup uses the application's saved camera, avoiding unrelated room-scale raster work.
  await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-5000,y:-4700,width:10000,height:9400})),cam.id);
  await page
    .locator(".campaign-card")
    .filter({ hasText: "Geländeprobe R5" })
    .getByRole("button", { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains("has-workspace") &&
      !document.querySelector("main").inert,
  );
  if (await page.locator("#campaign-atlas").isHidden()) {
    if (!(await page.locator("#atlas-tab").isVisible()))
      await page.locator("#workspace-nav-summary").click();
    await page.locator("#atlas-tab").click();
  }
  await atlasCanvasReady(page);
  console.log("Reference region ready");
  assert.equal(await page.locator('#atlas-group-tools').getAttribute('data-group'),'land','Opening global navigation must not remember vegetation selection as a chosen tool group');
  await page.locator("#atlas-units").selectOption("metric");
  await page.locator("#atlas-section").selectOption("terrain");
  await atlasCanvasReady(page);
  assert.equal(await page.locator('#atlas-group-tools').getAttribute('data-group'),'land');
  assert.equal(await page.locator('#land-tool').inputValue(),'height');
  await capture('00-land-entry');
}
const tool = async (value) => {
  await page.waitForFunction(
    () => !document.querySelector("#land-tool").disabled && !document.querySelector("#atlas-undo").disabled,
  );
  await page
    .locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`)
    .first()
    .click();
  await page.waitForFunction(
    (value) => document.querySelector("#land-tool").value === value,
    value,
  );
  await atlasCanvasReady(page);
};
const camera = () =>
  page.locator("#campaign-map").evaluate((n) => ({
    view: JSON.parse(n.dataset.atlasView),
    left: n.getBoundingClientRect().left,
    top: n.getBoundingClientRect().top,
    width: n.getBoundingClientRect().width,
    height: n.getBoundingClientRect().height,
  }));
async function spatialReady(){
 await page.waitForFunction(()=>{const d=document.querySelector('#campaign-map').dataset;if(d.terrainReady==='error'||!d.terrainView)return true;if(d.terrainReady!=='ready'||!d.terrainProjection)return false;const v=JSON.parse(d.terrainProjection);const pad=document.querySelector('#land-tool').value==='smooth'?Number(document.querySelector('#land-radius').value)/2:0;return Number(d.terrainSamplePad)===pad&&['tilt','rotation','exaggeration'].every(k=>v[k]===Number(document.querySelector('#terrain-'+k).value));},null,{timeout:60000});
 assert.equal(await page.locator('#campaign-map').getAttribute('data-terrain-ready'),'ready',await page.locator('#atlas-save-status').textContent());
}
async function history(kind){
 const previous=await page.locator('#campaign-map').getAttribute('data-scene-version');await page.locator('#atlas-'+kind).click();
 await page.waitForFunction(previous=>!document.querySelector('#atlas-undo').disabled&&document.querySelector('#campaign-map').dataset.sceneVersion!==previous,previous,{timeout:60000});
 await atlasCanvasReady(page);if(await page.locator('#campaign-map').getAttribute('data-terrain-view'))await spatialReady();
}

async function at(x, y) {
  if(await page.locator('#campaign-map').getAttribute('data-terrain-view'))await spatialReady();
  const c = await camera();
  const v=await page.locator('#campaign-map').evaluate(n=>n.dataset.terrainView?JSON.parse(n.dataset.terrainProjection):null);
  if(v){const g=terrainGrid(records(),v),p={x,y};assert(terrainVisible(g,p),'Test point must be visible');const q=projectTerrain(v,p,gridHeight(g,p));return {x:c.left+q.x*c.width,y:c.top+q.y*c.height};}
  return {
    x: c.left + ((x - c.view.x) / c.view.width) * c.width,
    y: c.top + ((y - c.view.y) / c.view.height) * c.height,
  };
}
async function capture(name) {
  await page.screenshot({ path: out + "/" + name + ".png" });
}
async function visibleColor(x, y) {
  const p = await at(x, y),
    png = require("pngjs").PNG.sync.read(await page.screenshot()),
    i = (Math.round(p.y) * png.width + Math.round(p.x)) * 4;
  return [...png.data.subarray(i, i + 3)];
}
async function stroke(points) {
  const screen = await Promise.all(points.map((p) => at(...p)));
  await page.mouse.move(screen[0].x, screen[0].y);
  await page.mouse.down();
  for (let i = 1; i < screen.length; i++) {
    await page.mouse.move(screen[i].x, screen[i].y, { steps: 12 });
    await page.waitForTimeout(80);
  }
  await page.mouse.up();
}

const maskBytes = () =>
  require("node:crypto")
    .createHash("sha256")
    .update(
      JSON.stringify(
        records()
          .filter((r) => r.height)
          .map((r) => [r.id, r.height.data])
          .sort(),
      ),
    )
    .digest("hex");
async function settled() {
  await page.waitForFunction(
    () =>
      !document.querySelector("#land-tool").disabled &&
      document.querySelector("#land-status").textContent === "Gespeichert",
    null,
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
  if(await page.locator('#campaign-map').getAttribute('data-terrain-view'))await spatialReady();
}
async function hold(x, y, ms) {
  const p = await at(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  const started=Date.now();await settled();result.commitWaitMs??=[];result.commitWaitMs.push(Date.now()-started);
}
try {
  await start();await tool('height');
  assert.equal(await page.locator('[data-atlas-tool]').count(),3);
  await atlasCanvasReady(page);
  if(await page.locator('#atlas-secondary-close').isVisible())await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-view').click();await page.locator('#land-grid').uncheck();await page.locator('#atlas-terrain-tilt').click();await page.keyboard.press('Escape');
  await spatialReady();await page.locator('#atlas-view').click();for(let i=0;i<4;i++)await page.locator('#terrain-exaggeration').press('ArrowLeft');await page.keyboard.press('Escape');await page.waitForFunction(()=>JSON.parse(document.querySelector('#campaign-map').dataset.terrainProjection).exaggeration===1&&document.querySelector('#campaign-map').dataset.terrainReady==='ready');await capture('01-tilted');
  const initialCamera=(await camera()).view,baseline=maskBytes(),sample=p=>new TerrainSampler(records()).query(p);
  result.gpu=await page.locator('#atlas-terrain-spatial').evaluate(c=>{const gl=c.getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
  // Use a visible pass on the seeded reference landscape, in world metres.
  const projection=await page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.terrainProjection)),grid=terrainGrid(records(),projection);result.initialProjection=projection;
  const p=[{x:-700,y:-700},{x:-500,y:100},{x:-900,y:-1500}].find(p=>terrainVisible(grid,p));assert(p,'A portion of the reference pass is visible');result.pass=p;const before=sample(p);result.before=before;
  await setHeightDirection(page,'lower');await setBrushWorldRadius(page,'land-radius','450');await page.locator('#land-height-strength').fill('900');await page.locator('#land-height-feather').fill('0.7');
  await page.locator('#land-height-target-enabled').check();await page.locator('#land-height-target').fill('-20');
  const screen=await at(p.x,p.y);await page.mouse.move(screen.x,screen.y);await page.mouse.down();
  const previewStart=Date.now();await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainPreview==='true',null,{timeout:60000});result.previewWaitMs=Date.now()-previewStart;
  await capture('02-lower-preview');await page.waitForTimeout(500);await page.mouse.up();await settled();
  const after=sample(p),lowered=maskBytes();result.after=after;assert(after.heightM<before.heightM);assert(after.water);assert.notEqual(lowered,baseline);await capture('03-lowered');
  await page.locator('#atlas-view').click();await page.locator('#terrain-top').click();await page.keyboard.press('Escape');await atlasCanvasReady(page);
  assert.deepEqual((await camera()).view,initialCamera);assert.equal(maskBytes(),lowered);assert.deepEqual(sample(p),after);await capture('04-top-same-pass');
  await history('undo');assert.equal(maskBytes(),baseline);
  await history('redo');assert.equal(maskBytes(),lowered);
  mark('Lower a visible pass with a true world hit, shared coast and one undo/redo; return to the identical top-view camera');
  await history('undo');
  await page.locator('#atlas-view').click();await page.locator('#atlas-terrain-tilt').click();await spatialReady();
  await page.locator('#terrain-exaggeration').press('Home');await spatialReady();assert.equal(maskBytes(),baseline);
  await page.locator('#terrain-rotation').press('End');await spatialReady();assert.equal(maskBytes(),baseline);
  await page.locator('#terrain-tilt').press('End');await spatialReady();await capture('05-rotated');
  assert.equal(maskBytes(),baseline);
  await page.keyboard.press('Escape');
  await page.locator('#land-height-target-enabled').uncheck();
  await setHeightDirection(page,'raise');
  const rotated=await at(p.x,p.y);await page.mouse.move(rotated.x,rotated.y);await page.mouse.down();await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainPreview==='true');await page.keyboard.press('Escape');await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainPreview==='false');assert.equal(maskBytes(),baseline);
  mark('Rotation, tilt and exaggeration preserve canonical metres; Escape restores the displayed base mesh');
  // Return to the normal oblique view with real range-key input.
  await page.locator('#atlas-view').click();
  for(const [id,fraction]of [['rotation',.5],['tilt',30/65],['exaggeration',.75/7.75]]){const input=page.locator('#terrain-'+id),r=await input.boundingBox();await input.click({position:{x:8+(r.width-16)*fraction,y:r.height/2}});}
  await page.keyboard.press('Escape');await spatialReady();
  await tool('smooth');await setBrushWorldRadius(page,'land-radius','600');await page.locator('#land-height-strength').fill('1000');
  await hold(p.x,p.y,600);assert.notEqual(maskBytes(),baseline);await history('undo');await spatialReady();assert.equal(maskBytes(),baseline);
  mark('Smooth the same spatial surface with the shared third tool and undo');
  await tool('color');await setBrushWorldRadius(page,'land-radius','220');await page.locator('#land-paint-color').fill('#d644aa');await page.locator('#land-tip').selectOption('round');
  const pigmentPoint={x:p.x+100,y:p.y+100},pigmentBefore=await visibleColor(pigmentPoint.x,pigmentPoint.y);await stroke([[p.x-20,p.y],[p.x+20,p.y]]);await settled();await page.mouse.move(20,20);
  const painted=await visibleColor(pigmentPoint.x,pigmentPoint.y);assert.notDeepEqual(painted,pigmentBefore);assert.equal(maskBytes(),baseline);assert(records().filter(r=>r.paint).every(r=>!r.paint.visibility));await capture('06-painted');
  await page.locator('#land-color-operation').selectOption('erase');await stroke([[p.x-20,p.y],[p.x+20,p.y]]);await settled();await page.mouse.move(20,20);assert.deepEqual(await visibleColor(pigmentPoint.x,pigmentPoint.y),pigmentBefore);assert.equal(maskBytes(),baseline);
  mark('Paint and erase visible land in the tilted view; pigment is frozen in world space and preserves every height');
  // Shared navigation stays bounded and releases the GPU canvas on return.
  const nav=await camera();await page.mouse.move(nav.left+nav.width*.5,nav.top+nav.height*.5);await page.mouse.wheel(0,-120);await spatialReady();assert((await camera()).view.width<nav.view.width);
  await page.mouse.down({button:'middle'});await page.mouse.move(nav.left+nav.width*.55,nav.top+nav.height*.55,{steps:6});await page.mouse.up({button:'middle'});await spatialReady();const panCamera=(await camera()).view;
  await page.locator('#atlas-view').click();await page.locator('#terrain-top').click();await page.keyboard.press('Escape');await atlasCanvasReady(page);assert.deepEqual((await camera()).view,panCamera);assert.equal(await page.locator('#atlas-terrain-spatial').count(),0);assert.equal(maskBytes(),baseline);
  mark('Wheel zoom and middle-button pan share the Atlas camera; returning disposes the spatial canvas');
  await page.locator('#atlas-search').fill('Bergdorf');await page.locator('#atlas-search-results button').filter({hasText:'Bergdorf'}).click();await atlasCanvasReady(page);await page.locator('#atlas-search').fill('');
  assert.equal(await page.locator('#land-name').inputValue(),'Bergdorf');
  await page.locator('#atlas-view').click();await page.locator('#atlas-terrain-tilt').click();await page.keyboard.press('Escape');await spatialReady();assert.equal(await page.locator('#land-name').inputValue(),'Bergdorf');
  await page.locator('#atlas-view').click();await page.locator('#terrain-top').click();await page.keyboard.press('Escape');await atlasCanvasReady(page);assert.equal(await page.locator('#land-name').inputValue(),'Bergdorf');
  mark('Selecting the same place survives both projection switches');
  await page.locator('#atlas-view').click();await page.locator('#atlas-terrain-tilt').click();await page.keyboard.press('Escape');await spatialReady();
  // Exercise the existing knowledge-mask change handler (the checkbox lives in the parked context panel).
  await page.locator('#atlas-perception').evaluate(n=>{n.checked=true;n.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>!document.querySelector('#atlas-terrain-spatial'));assert(await page.locator('#atlas-terrain-tilt').isDisabled());
  await page.locator('#atlas-perception').evaluate(n=>{n.checked=false;n.dispatchEvent(new Event('change',{bubbles:true}));});await atlasCanvasReady(page);assert.equal(maskBytes(),baseline);
  mark('Knowledge-mask change returns to the filtered top view and disables the unqualified spatial player view');
  const persisted=JSON.stringify(records());await app.close();app=null;await start();assert.equal(JSON.stringify(records()),persisted);await capture('07-reopened');
  mark('Fresh native process retains the exact authored terrain and pigment');
  assert.deepEqual(result.errors,[]);result.ok=true;
} catch (error) {
  result.error = error.stack ?? String(error);
  if (page) {
    // A crashed/closed renderer must not replace the original failure with a diagnostic timeout.
    result.landState=await page.evaluate(()=>({disabled:document.querySelector("#land-tool")?.disabled,status:document.querySelector("#land-status")?.textContent,saveStatus:document.querySelector("#atlas-save-status")?.textContent,region:document.querySelector("#campaign-atlas")?.dataset.regionState,canvas:document.querySelector("#campaign-map")?.dataset,popover:document.querySelector("#atlas-view-popup")?.matches(":popover-open")})).catch(error=>({diagnosticError:String(error)}));
    await capture("failure").catch(() => {});
  }
  throw error;
} finally {
  if (app) {
    if (result.ok) {
      await app.close();
      result.normalExit = true;
    } else await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
  db.close();
  await writeFile(out + "/result.json", JSON.stringify(result, null, 2));
}
