import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export {terrainHorizon} from './src/app/terrain-coverage';export * from './src/app/atlas-camera';export {zoomBox} from './src/app/atlas-navigation-scale';export * from './src/app/terrain-spatial-model';export * from './src/app/terrain-spatial-view';export * from './src/app/terrain-ring';export * from './src/app/terrain-route-visibility';export {TerrainHexGrid} from './src/app/terrain-hex-grid';export {AtlasSpatialLabels} from './src/app/atlas-spatial-labels';export * as THREE from 'three';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-perspective-camera-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const {
  zoomBox,
  atlasProject,
  atlasPlanePoint,
  terrainVisible,
  terrainHorizon,
  gridHeight,
  validateTerrainView,
  TerrainSpatialView,
  TerrainRing,
  TerrainRouteVisibility,
  TerrainHexGrid,
  AtlasSpatialLabels,
  THREE,
  ATLAS_CAMERA_FOV,
} = require("../.build/atlas-perspective-camera-test.cjs");
function pose(offset = 0, width = 400) {
  return {
    projection: "perspective",
    frame: {
      x: offset - width / 2,
      y: -offset - width * 0.4,
      width,
      height: width * 0.8,
    },
    box: {
      x: offset - width * 1.5,
      y: -offset - width * 1.2,
      width: width * 3,
      height: width * 2.4,
    },
    columns: 33,
    rows: 33,
    focusM: 60,
    tilt: 0,
    rotation: 0,
    exaggeration: 1,
  };
}
function viewFor(v, heights = new Float32Array(v.columns * v.rows).fill(60)) {
  const view = Object.create(TerrainSpatialView.prototype);
  Object.assign(view, {
    labels: new AtlasSpatialLabels(),
    hexGrid: new TerrainHexGrid(),
    camera: new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV),
    scene: new THREE.Scene(),
    canvas: {
      clientWidth: 1000,
      clientHeight: 800,
      getBoundingClientRect: () => ({
        left: 17,
        top: 23,
        width: 1000,
        height: 800,
      }),
    },
    renderer: {
      getPixelRatio(){return 1;},
      setSize() {},
      render(scene) {
        scene.updateMatrixWorld(true);
      },
    },
    mesh: null,
    picker: null,
    grid: null,
    base: null,
    routes: [],
    cursor: new TerrainRing('#a65f30'),
    selection: new TerrainRing('#e68a28'),
    routeVisibility: new TerrainRouteVisibility(),
    origin: { x: 0, y: 0 },
  });
  view.scene.add(view.cursor.line,view.selection.line);
  view.setData({
    grid: { view: v, heights, seaLevelM: 0 },
    width: 2,
    height: 2,
    pixels: new Uint8Array(16),
    draft: false,
  });
  return view;
}
const close = (a, b, tolerance = 1e-7) =>
  assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
test("perspective projection round trips work planes at every pose and far, fine coordinates", () => {
  for (const offset of [0, -1e10, 1e10])
    for (const width of [0.1, 400, 4e7])
      for (const tilt of [0, 45, 75])
        for (const rotation of [-180, -45, 0, 90, 180]) {
          const v = { ...pose(offset, width), tilt, rotation };
          for (const screen of [
            { x: 0.5, y: 0.5 },
            { x: 0.35, y: 0.7 },
            { x: 0.7, y: 0.8 },
          ]) {
            const point = atlasPlanePoint(v, screen);
            assert(point);
            const result = atlasProject(v, point, 60);
            close(
              result.x,
              screen.x,
              Math.max(
                1e-7,
                ((Math.abs(offset) * Number.EPSILON) / width) * 12,
              ),
            );
            close(
              result.y,
              screen.y,
              Math.max(
                1e-7,
                ((Math.abs(offset) * Number.EPSILON) / width) * 12,
              ),
            );
          }
        }
  const v = { ...pose(), tilt: 75 };
  assert.equal(
    atlasPlanePoint(v, { x: 0.5, y: 0 }),
    null,
    "sky is not an editable plane",
  );
});
test("CPU projection agrees with the actual Three camera and raycast", () => {
  for (const offset of [0, 1e10])
    for (const tilt of [0, 45, 75])
      for (const rotation of [-120, 0, 90]) {
        const v = { ...pose(offset), tilt, rotation },
          view = viewFor(v),
          p = { x: offset + 30, y: -offset + 20 },
          screen = atlasProject(v, p, 60);
        const gpu = new THREE.Vector3(30, -20, 0).project(view.camera);
        close((gpu.x + 1) / 2, screen.x);
        close((1 - gpu.y) / 2, screen.y);
        const hit = view.hit(17 + 1000 * screen.x, 23 + 800 * screen.y);
        assert(hit);
        close(hit.x, p.x, 0.00001);
        close(hit.y, p.y, 0.00001);
      }
});
test("reframing reuses uploaded buffers and moves both projection and picking immediately", () => {
  const v = pose(),
    view = viewFor(v),
    mesh = view.mesh,
    geometry = mesh.geometry,
    texture = mesh.material.map,
    picker = view.picker;
  const frame = { ...v.frame, x: v.frame.x + 40, width: 200, height: 160 };
  view.reframe(frame, 65, 90);
  assert.equal(view.mesh, mesh);
  assert.equal(mesh.geometry, geometry);
  assert.equal(mesh.material.map, texture);
  assert.equal(view.picker, picker);
  const target = { x: frame.x + 100, y: frame.y + 80 },
    screen = view.project(target);
  close(screen.x, 0.5);
  close(screen.y, 0.5);
  const hit = view.hit(517, 423);
  assert(hit);
  close(hit.x, target.x);
  close(hit.y, target.y);
  assert.deepEqual(view.base.view.frame, frame);
  let renders=0;view.renderer.render=()=>renders++;
  view.reframe({...frame},65,90);assert.equal(renders,0,'host sync must not draw the identical pose again');
  view.reframe({...frame,x:frame.x+1},65,90);assert.equal(renders,1);
});
test("canonical visibility agrees with first GPU triangle along perspective rays, including top view", () => {
  for (const tilt of [0, 45, 75])
    for (const rotation of [-90, 0, 90]) {
      const v = { ...pose(), tilt, rotation },
        heights = Float32Array.from(
          { length: 33 * 33 },
          (_, i) => 60 + 180 * Math.exp(-((Math.floor(i / 33) - 17) ** 2) / 2),
        );
      const view = viewFor(v, heights),
        ray = new THREE.Raycaster();
      for (let y = -120; y <= 120; y += 20)
        for (let x = -150; x <= 150; x += 30) {
          const p = { x, y },
            z = gridHeight(view.base, p),
            screen = atlasProject(v, p, z);
          if (
            screen.depth <= 0 ||
            screen.x < 0 ||
            screen.x > 1 ||
            screen.y < 0 ||
            screen.y > 1
          )
            continue;
          ray.setFromCamera(
            new THREE.Vector2(screen.x * 2 - 1, 1 - screen.y * 2),
            view.camera,
          );
          const hit = ray.intersectObject(view.picker, false)[0];
          assert(hit);
          // The picker can intersect triangles beyond the rendered atmospheric
          // horizon; these must not be available to canonical authoring.
          const visible = screen.depth < terrainHorizon(v).far &&
            Math.hypot(
              hit.point.x - x,
              hit.point.y + y,
              hit.point.z - (z - 60),
            ) < 0.001;
          assert.equal(
            terrainVisible(view.base, p),
            visible,
            JSON.stringify({ tilt, rotation, p, hit: hit.point }),
          );
        }
    }
});
test('deferred navigation prepares current camera rays without submitting a partial GPU frame',()=>{
 const v=pose(),view=viewFor(v),draws=[];
 view.renderer.render=()=>draws.push({...view.grid.view.frame});
 const frame={...v.frame,x:v.frame.x+70,y:v.frame.y-25,width:200,height:160};
 view.reframe(frame,45,25,false);
 assert.equal(draws.length,0);
 const hit=view.hit(517,423);assert(hit);close(hit.x,frame.x+100);close(hit.y,frame.y+80);
 const plane=view.planePoint(517,423);assert(plane);close(plane.x,frame.x+100);close(plane.y,frame.y+80);
 view.batch(()=>{view.render();view.render();});
 assert.deepEqual(draws,[frame],'map and overlay share one completed draw');
});
test('one publication draws the latest surface, camera, contours and selection once',()=>{
 const v=pose(),view=viewFor(v),draws=[];
 view.renderer.render=()=>draws.push({frame:{...view.grid.view.frame},interval:view.contours.terrainContourInterval.value,selection:!!view.selection});
 const frame={...v.frame,x:v.frame.x+40,width:200,height:160};
 view.batch(()=>{
  view.reframe(frame,45,25);
  view.batch(()=>{view.setContours(50);view.showSelection({x:frame.x+100,y:frame.y+80});});
  assert.equal(draws.length,0,'intermediate states do not submit GPU work');
 });
 assert.deepEqual(draws,[{frame,interval:50,selection:true}]);
 const hit=view.hit(517,423);assert(hit);close(hit.x,frame.x+100);close(hit.y,frame.y+80);
 view.batch(()=>{});assert.equal(draws.length,1,'empty publication has no redraw');
 assert.throws(()=>view.batch(()=>{view.setContours(100);throw Error('publication failed');}),/publication failed/);
 assert.equal(draws.length,1,'failed intermediate publication is not painted');
 view.setContours(25);assert.equal(draws.length,2,'subsequent ordinary updates still draw synchronously');
 view.batch(()=>{view.setContours(20);view.renderTile(1000,800,0,0,500,800);assert.equal(draws.length,3,'image output remains synchronous');});
 assert.equal(draws.length,4,'editor view returns after explicit image output');
});
test("legacy orthographic brush snapshots stay valid; malformed projection is rejected", () => {
  const v = pose();
  delete v.projection;
  validateTerrainView(v);
  validateTerrainView({ ...v, projection: "perspective", tilt: 75 });
  assert.throws(() => validateTerrainView({ ...v, projection: "spherical" }));
  assert.throws(() => validateTerrainView({ ...v, tilt: 76 }));
  const p = { x: 20, y: -30 },
    screen = atlasProject(v, p, 60),
    roundTrip = atlasPlanePoint(v, screen);
  close(roundTrip.x, p.x);
  close(roundTrip.y, p.y);
});

test("zoom stays anchored on elevated terrain using the corresponding work-plane ray", () => {
  for (const tilt of [0, 45, 75])
    for (const rotation of [0, 90, 160])
      for (const factor of [0.4, 1.8]) {
        const v = { ...pose(), tilt, rotation },
          point = { x: 15, y: 20 },
          heightM = 80,
          screen = atlasProject(v, point, heightM),
          anchor = atlasPlanePoint(v, screen);
        assert(anchor);
        const next = {
            ...v,
            frame: zoomBox(v.frame, v.frame.width * factor, anchor),
          },
          projected = atlasProject(next, point, heightM);
        close(projected.x, screen.x);
        close(projected.y, screen.y);
      }
});

test('contour changes retain uploaded geometry, texture and picker and use unexaggerated metre heights',()=>{
  const v={...pose(),exaggeration:4},heights=new Float32Array(v.columns*v.rows).fill(175),view=viewFor(v,heights);
  const geometry=view.mesh.geometry,texture=view.mesh.material.map,picker=view.picker;
  view.setContours(100);assert.equal(view.mesh.geometry,geometry);assert.equal(view.mesh.material.map,texture);assert.equal(view.picker,picker);
  assert.equal(geometry.getAttribute('terrainElevation').getX(0),175);
  assert.equal(geometry.getAttribute('position').getZ(0),(175-v.focusM)*4);
  view.setContours(0);assert.equal(view.mesh.geometry,geometry);
});

test('a village at a distant world coordinate remains pickable after the inspector narrows the viewport',()=>{
 const v={projection:'perspective',box:{x:-8482891.601510288,y:-942153.0598735651,width:625.5642291648526,height:625.5642291648526},frame:{x:-8482678.185231794,y:-941944.5384638435,width:198.7316721760017,height:208.52140972161752},refinement:{x:-8482727.868149837,y:-941996.6688162739,width:298.09750826400256,height:312.7821145824263},columns:257,rows:257,focusM:129.79577636718778,tilt:0,rotation:0,exaggeration:1};
 const view=viewFor(v,new Float32Array(v.columns*v.rows).fill(129.7957763671875));
 view.canvas.clientWidth=812;view.canvas.clientHeight=852;
 view.canvas.getBoundingClientRect=()=>({left:288,top:48,width:812,height:852});view.render();
 for(const [x,y]of [[.55,.35],[.61,.6],[.43,.44]])assert(view.hit(288+812*x,48+852*y),`visible ground at ${x},${y}`);
});
