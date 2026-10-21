import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";

buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export * from './src/app/atlas-spatial-color';export * from './src/app/atlas-spatial-scene';export * from './src/app/atlas-spatial-geometry';export * from './src/app/atlas-paint';export {drawLandscape} from './src/app/atlas-landscape-view';export {Raycaster,Vector2,Vector3} from 'three';`,
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".build/atlas-spatial-scene-test.cjs",
});
const {
  drawLandscape,
  atlasSpatialColor,
  AtlasSpatialScene,
  atlasSpatialPaths,
  atlasStrokeParts,
  atlasPaint,
  Raycaster,
  Vector2,
  Vector3,
} = createRequire(import.meta.url)("../.build/atlas-spatial-scene-test.cjs");
const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const command = (node, options = {}) => ({
  node,
  matrix,
  style: { fill: "#d8c59d", stroke: null, ...node.style },
  alpha: 1,
  pointer: true,
  hud: false,
  title: "",
  ancestry: [node],
  ...options,
});
const flat = {
  origin: { x: 0, y: 0 },
  focusM: 0,
  exaggeration: 1,
  segment: 10,
  height: () => 0,
};
const scene = (commands, surface = flat, origin = { x: 0, y: 0 }) =>
  new AtlasSpatialScene({ commands }, origin, new Map(), surface);
const ray = (x, y) =>
  new Raycaster(new Vector3(x, -y, 100), new Vector3(0, 0, -1));

test("Main Atlas room holes, transparent author contours and exact ancestry survive GPU selection", () => {
  const polygon = {
    outer: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ],
    holes: [
      [
        { x: 8, y: 8 },
        { x: 12, y: 8 },
        { x: 12, y: 12 },
        { x: 8, y: 12 },
      ],
    ],
  };
  const room = atlasPaint("polygons", {
    polygons: [polygon],
    data: { atlasObject: "true", id: "room" },
  });
  const handle = atlasPaint("circle", {
    x: 2,
    y: 2,
    radius: 1,
    style: { fill: "transparent" },
    data: { atlasVertex: "7" },
  });
  const gpu = scene([command(room), command(handle)]);
  gpu.group.updateMatrixWorld(true);
  try {
    assert.equal(gpu.hit(ray(3, 3), ["atlasObject"]).data.id, "room");
    assert.equal(
      gpu.hit(ray(10, 10), ["atlasObject"]),
      null,
      "a courtyard must remain empty",
    );
    assert.equal(gpu.hit(ray(2, 2), ["atlasVertex"]).data.atlasVertex, "7");
    assert.equal(
      gpu.hit(ray(3, 3), ["atlasObject"], 50),
      null,
      "foreground terrain must occlude a hidden object",
    );
  } finally {
    gpu.dispose();
  }
  assert.equal(gpu.group.children.length, 0);
});

test("Far-world local room detail retains transform precision and follows terrain elevation", () => {
  const origin = { x: 1e10, y: -1e10 },
    node = atlasPaint("rect", {
      x: 0,
      y: 0,
      width: 0.02,
      height: 0.03,
      data: { atlasObject: "true", id: "fine" },
    });
  const gpu = scene(
    [command(node, { matrix: { a: 0, b: 1, c: -1, d: 0, e: 2, f: 3 } })],
    { ...flat, origin, height: () => 12, focusM: 10, exaggeration: 2 },
    origin,
  );
  try {
    const positions = gpu.group.children[0].geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      assert(positions.getX(i) >= 1.9699 && positions.getX(i) <= 2.0001);
      assert.equal(positions.getZ(i), 4);
    }
    assert(
      Math.max(
        ...Array.from({ length: positions.count }, (_, i) => positions.getX(i)),
      ) -
        Math.min(
          ...Array.from({ length: positions.count }, (_, i) =>
            positions.getX(i),
          ),
        ) >
        0.029,
    );
  } finally {
    gpu.dispose();
  }
});

test("Draped areas sample interior terrain and preserve author IDs", () => {
  const node = atlasPaint("rect", {
      width: 100,
      height: 100,
      data: { atlasObject: "true", id: "region" },
    }),
    gpu = scene([command(node)], {
      ...flat,
      segment: 5,
      height: (p) => Math.max(0, 30 - Math.hypot(p.x - 50, p.y - 50)),
    });
  try {
    const positions = gpu.group.children[0].geometry.getAttribute("position");
    assert(
      Array.from({ length: positions.count }, (_, i) => positions.getZ(i)).some(
        (z) => z > 25,
      ),
    );
  } finally {
    gpu.dispose();
  }
});

test("HUD and terrain-owned rasters are not duplicated; masked content fails closed", () => {
  const node = atlasPaint("rect", { width: 20, height: 20 }),
    gpu = scene([
      command(node, { hud: true }),
      command(node, { ancestry: [{ data: { landscapeRaster: "true" } }] }),
    ]);
  assert.equal(gpu.group.children.length, 0);
  gpu.dispose();
  assert.throws(
    () => scene([command(node, { cuts: [{ alpha: 1 }] })]),
    /Maskierte/,
  );
});

test("Dash phase persists around a corner and zero gaps do not hang", () => {
  const points = [new Vector2(0, 0), new Vector2(3, 0), new Vector2(3, 7)],
    parts = atlasStrokeParts(points, [4, 2]);
  assert.deepEqual(
    parts.map((p) => p.map((v) => [v.x, v.y])),
    [
      [
        [0, 0],
        [3, 0],
        [3, 1],
      ],
      [
        [3, 3],
        [3, 7],
      ],
    ],
  );
  assert(atlasStrokeParts(points, [0, 2, 2, 0]).length > 0);
  const paths = atlasSpatialPaths(
    atlasPaint("ellipse", { radiusX: 2, radiusY: 1 }),
  );
  assert.equal(paths.shapes.length, 1);
  assert(paths.lines[0][0].equals(paths.lines[0].at(-1)));
});

test("Atlas alpha colors preserve translucent previews in GPU materials", () => {
  assert.deepEqual(atlasSpatialColor("#d98f5555", 0.6), {
    color: "#d98f55",
    opacity: 0.2,
  });
  assert.deepEqual(atlasSpatialColor("#f008", 1), {
    color: "#ff0000",
    opacity: 136 / 255,
  });
  assert.deepEqual(atlasSpatialColor("rgba(20, 30, 40, 0.25)", 0.8), {
    color: "rgb(20, 30, 40)",
    opacity: 0.2,
  });
  assert.deepEqual(atlasSpatialColor("transparent", 1), {
    color: "#ffffff",
    opacity: 0,
  });
});


test('dense landscape images are draped above terrain while duplicate full ground stays omitted',()=>{
 const root=atlasPaint('group'),box={x:0,y:0,width:20,height:20},tile={campaignId:'c',revision:1,box,width:16,height:16,data:'ground'};
 drawLandscape(root,[],box,1,new Map(),true,[tile,{...tile,data:'objects',content:'objects'}]);
 const images=root.children.filter(n=>n.kind==='image');assert.equal(images.length,2);
 const gpu=new AtlasSpatialScene({commands:images.map(n=>command(n))},{x:0,y:0},new Map([['ground',{width:16,height:16}],['objects',{width:16,height:16}]]),{...flat,height:p=>p.x/2});
 try{assert.equal(gpu.group.children.length,1);const mesh=gpu.group.children[0];assert.equal(mesh.material.map.image.width,16);assert(mesh.geometry.getAttribute('position').count>6,'overlay follows terrain subdivisions');assert(mesh.geometry.getAttribute('position').array.some((v,i)=>i%3===2&&v>0));}finally{gpu.dispose();}
});
