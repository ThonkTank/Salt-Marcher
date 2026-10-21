import {setBrushWorldRadius,setHeightDirection,setTerrainContours,openTerrainDisplay} from './atlas-brush-probe.mjs';
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, stat } from "node:fs/promises";
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
      "export * from './src/app/storage/store';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export {newLocation} from './src/features/location/location-schema';",
    resolveDir: root,
  },
  outfile: ".build/relief-native-store.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { CampaignStore } = require(root + "/.build/relief-native-store.cjs");
const profileRoot = path.join(homedir(), ".cache/saltmarcher/ui-profiles");
await mkdir(profileRoot, { recursive: true });
const dir = await mkdtemp(path.join(profileRoot, "landscape-")),
  out = path.resolve(
    process.env.QA_EVIDENCE_DIR ?? ".build/terrain-relief-native",
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
const cam = store.create("Reliefprobe R4", [room]),
  active = store.activate(cam.id);
store.tutorial("skipped");
const seedWrite=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
for(const stroke of RELIEF_STROKES)seedWrite({kind:'landscape-height-stroke',stroke});
for(const [kind,points,width]of [['river',[{x:-2600,y:1000},{x:-1000,y:1400},{x:500,y:700},{x:2300,y:400}],38],['road',[{x:-800,y:-1500},{x:-700,y:-700},{x:-500,y:100},{x:-100,y:900}],24]])seedWrite({kind:'landscape-put',expectedRevision:null,record:{id:randomUUID(),revision:0,kind,name:kind==='road'?'Passstraße':'Talfluss',points,polygons:[],width,resolution:1,values:{}}});
const {newLocation}=require(root+'/.build/relief-native-store.cjs');
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
  launches: [],
};
result.sourceHashes = {};
for (const file of [
  "src/app/terrain-height.ts",
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
  "tools/test-desktop-terrain-relief.mjs",
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
async function close(){
  const child=app.process(),pid=child.pid;await app.close();app=null;
  const exit={code:child.exitCode,signal:child.signalCode};assert.deepEqual(exit,{code:0,signal:null});
  await assert.rejects(stat('/proc/'+pid),{code:'ENOENT'});result.launches.push({pid,exit,pidAbsent:true});
}
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
  await page
    .locator(".campaign-card")
    .filter({ hasText: "Reliefprobe R4" })
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
  console.log("Atlas ready; finding the reference room");
  await page.locator("#atlas-search").fill("Referenzhaus");
  await page
    .locator("#atlas-search-results button")
    .filter({ hasText: "Referenzhaus" })
    .click();
  await atlasCanvasReady(page);
  await page.locator("#atlas-search").fill("");
  await page.locator("#atlas-units").selectOption("metric");
  await page.locator("#atlas-section").selectOption("terrain");
  await atlasCanvasReady(page);
}
const tool = async (value) => {
  await page.waitForFunction(
    () => !document.querySelector("#land-tool").disabled,
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
async function at(x, y) {
  const c = await camera();
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
  for(let i=0;i<17;i++)await page.getByRole('button',{name:'Verkleinern',exact:true}).click();
  await atlasCanvasReady(page);console.log('Region ready');await page.locator('#atlas-view').click();await page.locator('#land-grid').uncheck();await page.locator('#atlas-view').click();
  if(await page.locator('#atlas-secondary-close').isVisible())await page.locator('#atlas-secondary-close').click();await atlasCanvasReady(page);
  const baseline=maskBytes(),mode=()=>records().find(r=>r.terrainSettings)?.terrainSettings.style?.mode??'drawn';
  await openTerrainDisplay(page);
  const apply=async value=>{await openTerrainDisplay(page);console.log('Style',value);await page.locator('#land-relief-mode').selectOption(value);await page.locator('#land-relief-apply').click();await settled();assert.equal(mode(),value);assert.equal(maskBytes(),baseline);};
  await capture('01-region-drawn');await apply('shaded');await capture('02-region-shaded');
  await page.locator('#atlas-undo').click();await atlasCanvasReady(page);assert.equal(mode(),'drawn');
  await page.locator('#atlas-redo').click();await atlasCanvasReady(page);assert.equal(mode(),'shaded');
  await apply('height');await capture('03-region-analysis');
  await apply('drawn');await page.locator('#land-relief-light').fill('290');await page.locator('#land-relief-strength').fill('0.7');await page.locator('#land-relief-apply').click();await settled();
  assert.equal(records().find(r=>r.terrainSettings).terrainSettings.style.lightDegrees,290);assert.equal(maskBytes(),baseline);
  mark('Three land tools; shared style, analysis, lighting and undo preserve terrain and places');
  await page.keyboard.press('Escape');
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Verkleinern',exact:true}).click();await atlasCanvasReady(page);await capture('04-continent');
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Vergrößern',exact:true}).click();await atlasCanvasReady(page);await capture('05-place');
  const placeCamera=await camera();const center={x:placeCamera.view.x+placeCamera.view.width*.5,y:placeCamera.view.y+placeCamera.view.height*.5};
  await setHeightDirection(page,'raise');await setBrushWorldRadius(page,'land-radius','250');await page.locator('#land-height-strength').fill('350');
  await page.locator('#land-coast-roughness').fill('0.7');await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready');const revision=Number(await page.locator('#campaign-map').getAttribute('data-terrain-revision'));const p=await at(center.x,center.y);await page.mouse.move(p.x,p.y);await page.mouse.down();
  await page.waitForFunction(r=>Number(document.querySelector('#campaign-map').dataset.terrainRevision)>r,revision,{timeout:60000});assert.notEqual(maskBytes(),baseline,'height writes must be visible before release');await capture('06-live-brush');await page.mouse.up();await settled();assert.notEqual(maskBytes(),baseline);
  await page.locator('#atlas-undo').click();await atlasCanvasReady(page);assert.equal(maskBytes(),baseline);
  mark('Continent, region and local views; live saved brush and atomic undo');
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Verkleinern',exact:true}).click();await atlasCanvasReady(page);
  await setTerrainContours(page,'100');await atlasCanvasReady(page);await capture('07-contours');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},out+'/region.png');
  await page.locator('#atlas-output-open').click();await page.locator('#atlas-output summary').filter({hasText:'Bildoptionen'}).click();await page.locator('#atlas-export-size').fill('1024');await page.locator('#atlas-export-grid').uncheck();
  await page.locator('#atlas-export-png').click();await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Atlas-PNG gespeichert',null,{timeout:60000});
  const png=require('pngjs').PNG.sync.read(await readFile(out+'/region.png'));assert.equal(Math.max(png.width,png.height),1024);assert.equal(maskBytes(),baseline);
  mark('Relief, coast, labels, river and road survive native PNG export without height writes');
  const persisted=JSON.stringify(records());await close();await start();assert.equal(JSON.stringify(records()),persisted);
  assert.equal(await page.locator('#land-relief-light').inputValue(),'290');assert.equal(await page.locator('#land-relief-mode').inputValue(),'drawn');await capture('08-reopened');
  mark('Fresh process retains authored landscape, place positions and shared relief profile');
  assert.deepEqual(result.errors,[]);result.ok=true;
} catch (error) {
  result.error = error.stack ?? String(error);
  if (page) {
    // A crashed/closed renderer must not replace the original failure with a diagnostic timeout.
    result.landState=await page.evaluate(()=>({disabled:document.querySelector("#land-tool")?.disabled,status:document.querySelector("#land-status")?.textContent,saveStatus:document.querySelector("#atlas-save-status")?.textContent,region:document.querySelector("#campaign-atlas")?.dataset.regionState})).catch(error=>({diagnosticError:String(error)}));
    await capture("failure").catch(() => {});
  }
  throw error;
} finally {
  if (app) {
    if (result.ok) {
      await close();
      result.normalExit = true;
    } else await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
  db.close();
  await writeFile(out + "/result.json", JSON.stringify(result, null, 2));
}
