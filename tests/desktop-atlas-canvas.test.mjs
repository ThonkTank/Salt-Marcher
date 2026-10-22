import {atlasFixture} from './helpers/atlas-workbench.mjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas-canvas';export * from './src/app/atlas-canvas-scene';export * from './src/app/campaign-atlas-export';export * from './src/app/atlas-landscape-export';export {atlasRegionPaint} from './src/app/atlas-region-export';export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-canvas-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const { AtlasCanvas, AtlasCanvasScene, atlasPaint, atlasImage, dungeonExportBox, atlasExportScale, atlasExportTiles, atlasRegionPaint, CampaignAtlasWorkbench } = createRequire(
  import.meta.url,
)("../.build/atlas-canvas-test.cjs");
class Matrix {
  constructor(v) {
    Object.assign(
      this,
      Array.isArray(v)
        ? { a: v[0], b: v[1], c: v[2], d: v[3], e: v[4], f: v[5] }
        : (v ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    );
  }
  static fromMatrix(m) {
    return new Matrix(m);
  }
  multiply(m) {
    const n = this;
    return new Matrix({
      a: n.a * m.a + n.c * m.b,
      b: n.b * m.a + n.d * m.b,
      c: n.a * m.c + n.c * m.d,
      d: n.b * m.c + n.d * m.d,
      e: n.a * m.e + n.c * m.f + n.e,
      f: n.b * m.e + n.d * m.f + n.f,
    });
  }
  multiplySelf(m) {
    Object.assign(this, this.multiply(m));
    return this;
  }
  translate(x, y) {
    return this.multiply(new Matrix([1, 0, 0, 1, x, y]));
  }
  translateSelf(x, y) {
    Object.assign(this, this.translate(x, y));
    return this;
  }
  scale(x, y = x) {
    return this.multiply(new Matrix([x, 0, 0, y, 0, 0]));
  }
  scaleSelf(x, y = x) {
    Object.assign(this, this.scale(x, y));
    return this;
  }
  rotateSelf(a) {
    const r = (a * Math.PI) / 180;
    return this.multiplySelf(
      new Matrix([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]),
    );
  }
  inverse() {
    const n = this,
      k = n.a * n.d - n.b * n.c;
    return new Matrix([
      n.d / k,
      -n.b / k,
      -n.c / k,
      n.a / k,
      (n.c * n.f - n.d * n.e) / k,
      (n.b * n.e - n.a * n.f) / k,
    ]);
  }
}
class Point {
  constructor(x, y) {
    Object.assign(this, { x, y });
  }
  matrixTransform(m) {
    return new Point(
      this.x * m.a + this.y * m.c + m.e,
      this.x * m.b + this.y * m.d + m.f,
    );
  }
}
// Geometry/raster fidelity is checked separately with native Canvas2D pixels; this double checks lifecycle and API wiring.
class Path {
  constructor(d) {
    this.commands = d ? [["path", d]] : [];
  }
  rect(...a) {
    this.commands.push(["rect", ...a]);
  }
  roundRect(...a) {
    this.commands.push(["rect", ...a]);
  }
  arc(...a) {
    this.commands.push(["arc", ...a]);
  }
  ellipse(...a) {
    this.commands.push(["ellipse", ...a]);
  }
  moveTo(...a) {
    this.commands.push(["move", ...a]);
  }
  lineTo(...a) {
    this.commands.push(["line", ...a]);
  }
  closePath() { this.commands.push(["close"]); }
}
const settle = () => new Promise((r) => setImmediate(r));
function fixture(t, { available = true } = {}) {
  const prior = Object.fromEntries(
    [
      "window",
      "document",
      "DOMMatrix",
      "DOMPoint",
      "Path2D",
      "Image",
      "createImageBitmap",
      "requestAnimationFrame",
      "devicePixelRatio",
    ].map((k) => [k, global[k]]),
  );
  t.after(() => Object.assign(global, prior));
  const { window, document } = parseHTML(
    '<html><body><canvas id="atlas"></canvas></body></html>',
  );
  Object.defineProperty(window, "devicePixelRatio", {value:1, configurable:true, writable:true});
  const root = document.querySelector("canvas"),
    frames = [],
    calls = [],
    closed = [];
  let width = 320, height = 180;
  let contextAvailable = available,
    decodes = 0,
    maxDecodes = 0;
  const releases = new Map();
  const ctx = new Proxy(
    { canvas: root, isContextLost: () => false, isPointInPath: () => true, isPointInStroke: () => false },
    { get: (o, k) => (k in o ? o[k] : (...args) => calls.push([k, ...args])) },
  );
  window.HTMLCanvasElement.prototype.getContext = () => {
    if(contextAvailable==='throw')throw Error('Context acquisition failed');
    return contextAvailable ? ctx : null;
  };
  Object.defineProperties(root, {
    clientWidth: { get: () => width },
    clientHeight: { get: () => height },
    clientLeft: { value: 1 },
    clientTop: { value: 1 },
  });
  root.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: width + 2,
    height: height + 2,
  });
  let pointer;
  root.setPointerCapture = (id) => (pointer = id);
  root.hasPointerCapture = (id) => pointer === id;
  root.releasePointerCapture = () => (pointer = null);
  Object.assign(global, {
    window,
    document,
    DOMMatrix: Matrix,
    DOMPoint: Point,
    Path2D: Path,
    requestAnimationFrame: (fn) => (frames.push(fn), frames.length),
    Image: class {
      naturalWidth = 1024;
      naturalHeight = 512;
      async decode() {
        decodes++;
        maxDecodes = Math.max(maxDecodes, decodes);
        try {
          if (this.src === "bad") throw Error("decode failed");
          if (this.src.startsWith("wait:"))
            await new Promise((r) => releases.set(this.src, r));
        } finally {
          decodes--;
        }
      }
    },
    createImageBitmap: async (img, options) => ({
      width: options.resizeWidth,
      height: options.resizeHeight,
      close() {
        closed.push(img.src);
      },
    }),
  });
  const changes = [],
    canvas = new AtlasCanvas(root, {
      relative: true,
      initial: { x: 100, y: 200, width: 320, height: 180 },
      changed: (b, reason) => changes.push({ b, reason }),
    });
  return {
    canvas,
    root,
    ctx,
    window,
    document,
    calls,
    closed,
    releases,
    changes,
    frames,
    size(w,h) { width=w; height=h; },
    available(v) {
      contextAvailable = v;
    },
    get maxDecodes() {
      return maxDecodes;
    },
    flush() {
      for (const f of frames.splice(0)) f();
    },
    pointer(type, x, y, button = 1) {
      const e = new window.Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { clientX: x, clientY: y, pointerId: 7, button });
      root.dispatchEvent(e);
    },
  };
}
const rect = (id) => {
  const n = atlasPaint("rect", {width: 10, height: 10, style: {fill: "red"}});
  n.data.atlasObject = "true";
  n.data.id = id;
  return n;
};
test("retained commands inherit style and transforms, preserve painter order and explicit semantic ancestry", (t) => {
  fixture(t);
  const root = atlasPaint("group", {matrix:[0,1,-1,0,20,30], style: {stroke: "red", lineWidth: 3, lineCap: "round"}}),
    a = rect("first"),
    b = rect("second");
  root.append(a, b);
  const scene = new AtlasCanvasScene(root);
  assert.deepEqual(
    scene.commands.map((c) => c.node.data.id),
    ["first", "second"],
  );
  const c = scene.commands[0],
    p = new Point(1, 2).matrixTransform(c.matrix);
  assert(Math.abs(p.x - 18) < 1e-8);
  assert.equal(p.y, 31);
  assert.equal(c.style.stroke, "red");
  assert.equal(c.style.lineWidth, 3);
  assert.equal(c.style.lineCap, "round");
  assert.equal(scene.hit({save(){},restore(){},resetTransform(){},setLineDash(){},isPointInPath(){return true;}},{x:20,y:30},["atlasObject"]).data.id,"second");
});
test("Canvas publication has no per-object DOM and panning reuses paths and image buffers", async (t) => {
  const f = fixture(t);
  let builds = 0;
  f.canvas.render((root) => {
    builds++;
    root.append(rect("room"));
  });
  await settle();
  const path = f.canvas.compiled.commands[0].path;
  assert.equal(f.root.children.length, 0);
  assert.equal(f.root.dataset.renderer, "canvas2d");
  assert.equal(f.root.dataset.canvasState, "loaded");
  assert.equal(f.canvas.hitAt({ clientX: 15, clientY: 25 }).data.id, "room");
  f.pointer("pointerdown", 100, 100);
  f.pointer("pointermove", 120, 130);
  f.pointer("pointerup", 120, 130);
  f.flush();
  assert.equal(builds, 1);
  assert.equal(f.canvas.compiled.commands[0].path, path);
  assert.deepEqual(f.canvas.view, { x: 80, y: 170, width: 320, height: 180 });
  assert.equal(f.changes.length, 1);
  f.canvas.previous();
  assert.equal(f.canvas.view.x, 100);
  f.canvas.next();
  assert.equal(f.canvas.view.x, 80);
});
test("world conversion includes CSS border and independent backing resolution; zoom is anchored", (t) => {
  const f = fixture(t);
  assert.deepEqual(f.canvas.point({ clientX: 11, clientY: 21 }), {
    x: 100,
    y: 200,
  });
  const anchor = f.canvas.point({ clientX: 171, clientY: 111 });
  f.canvas.zoom(0.5, anchor);
  assert.deepEqual(f.canvas.point({ clientX: 171, clientY: 111 }), anchor);
  f.canvas.context("other", { x: 0, y: 0, width: 20, height: 20 });
  assert.equal(f.canvas.contextRestored, false);
});
test("one decoder and one replaceable successor discard superseded image frames and stale hits", async (t) => {
  const f = fixture(t),
    draw = (src) => (root) =>
      root.append(atlasPaint("image", {source: src, width: 10, height: 10}));
  f.canvas.render((root) => root.append(rect("old")));
  await settle();
  f.canvas.render(draw("wait:a"));
  await settle();
  assert.equal(f.canvas.ready, false);
  assert.equal(f.canvas.hitAt({ clientX: 15, clientY: 25 }), null);
  f.canvas.render(draw("wait:b"));
  f.canvas.render(draw("c"));
  assert.equal(f.releases.has("wait:b"), false);
  f.releases.get("wait:a")();
  await settle();
  await settle();
  assert.equal(f.maxDecodes, 1);
  assert.equal(f.canvas.ready, true);
  assert.equal(f.canvas.compiled.images.has("c"), true);
  assert.equal(f.canvas.compiled.images.has("wait:b"), false);
  assert(f.closed.includes("wait:a"));
  assert.equal(f.root.dataset.decodedBytes, String(512 * 256 * 4));
});
test("derived landscape images retain their 1024-pixel coast detail while reference previews stay bounded", async (t) => {
  const f=fixture(t);
  f.canvas.render(root=>root.append(atlasPaint("image",{source:"coast",width:10,height:10,data:{landscapeRaster:"true"}})));
  await settle();
  assert.equal(f.canvas.ready,true);
  assert.equal(f.root.dataset.decodedBytes,String(1024*512*4));
  f.canvas.render(root=>root.append(atlasPaint("image",{source:"reference",width:10,height:10,optionalImage:true})));
  await settle();
  assert.equal(f.root.dataset.decodedBytes,String(512*256*4));
});
test("decoding failure revokes hits and retry keeps the same surface, camera and listeners", async (t) => {
  const f = fixture(t);
  let bad = true;
  const draw = (root) => {
    root.append(rect("room"));
    if (bad)
      root.append(atlasPaint("image", {source: "bad", width: 2, height: 2}));
  };
  f.canvas.render(draw);
  await settle();
  assert.equal(f.root.dataset.canvasState, "unavailable");
  assert.equal(f.canvas.hitAt({ clientX: 12, clientY: 22 }), null);
  const view = f.canvas.view;
  bad = false;
  f.document.querySelector(".map-canvas-state button").click();
  await settle();
  assert.equal(f.canvas.ready, true);
  assert.deepEqual(f.canvas.view, view);
  f.pointer("pointerdown", 100, 100);
  f.pointer("pointermove", 120, 100);
  f.pointer("pointerup", 120, 100);
  assert.equal(f.changes.length, 1);
});
test("unavailable context shows recoverable initialization state instead of failing the workspace", async (t) => {
  const f = fixture(t, { available: false });
  f.canvas.render((root) => root.append(rect("room")));
  assert.equal(f.root.dataset.canvasState, "unavailable");
  f.available(true);
  f.document.querySelector(".map-canvas-state button").click();
  await settle();
  assert.equal(f.canvas.ready, true);
  assert.equal(f.root.dataset.canvasState, "loaded");
});
test("lost/restored context releases bitmaps and reuses the canonical scene builder", async (t) => {
  const f = fixture(t);
  f.canvas.render((root) =>
    root.append(atlasPaint("image", {source: "image", width: 5, height: 5})),
  );
  await settle();
  f.root.dispatchEvent(new f.window.Event("contextlost", { cancelable: true }));
  assert.equal(f.canvas.hitAt({ clientX: 12, clientY: 22 }), null);
  assert(f.closed.includes("image"));
  f.root.dispatchEvent(new f.window.Event("contextrestored"));
  await settle();
  assert.equal(f.canvas.ready, true);
});
test("backing stores respect the pixel budget at high DPI and repeated paint preserves allocations", async (t) => {
  const f = fixture(t);
  Object.defineProperty(f.window, "devicePixelRatio", { value: 4 });
  f.canvas.render((root) => root.append(rect("room")));
  await settle();
  assert.equal(f.root.width, 640);
  assert.equal(f.root.height, 360);
  assert(f.root.width * f.root.height <= 4194304);
  const compiled = f.canvas.compiled;
  f.canvas.pan(1, 1);
  f.flush();
  assert.equal(f.canvas.compiled, compiled);
});

test("switching map context revokes old commands and decoded media before new source data arrives", async (t) => {
  const f = fixture(t);
  f.canvas.context("a", f.canvas.view);
  f.canvas.render((root) =>
    root.append(
      rect("room"),
      atlasPaint("image", {source: "a", width: 2, height: 2}),
    ),
  );
  await settle();
  assert.equal(f.canvas.ready, true);
  f.canvas.context("b", { x: 0, y: 0, width: 50, height: 50 });
  assert.equal(f.canvas.ready, false);
  assert.equal(f.canvas.hitAt({ clientX: 15, clientY: 25 }), null);
  assert(f.closed.includes("a"));
  assert.equal(f.root.dataset.canvasState, "empty");
  assert.equal(f.root.dataset.decodedBytes, "0");
  assert.equal(f.root.dataset.imageErrors, "0");
  f.root.dispatchEvent(new f.window.Event('contextrestored'));await settle();
  assert.equal(f.canvas.ready,false,'Restoration must not resurrect the previous campaign builder');
});

test("marker titles survive outside semantic selection and the surface clears hover on a new gesture", async (t) => {
  const f = fixture(t),
    marker = atlasPaint("circle", {radius: 3, style: {fill: "red"}});
  marker.title="Isobel · bekannt und sichtbar";
  f.canvas.render((root) => root.append(marker));
  await settle();
  assert.equal(
    f.canvas.compiled.tooltip(f.ctx, { x: 0, y: 0 }),
    "Isobel · bekannt und sichtbar",
  );
  assert.equal(
    f.canvas.hitAt({ clientX: 11, clientY: 21 }),
    null,
    "a tooltip does not invent an author selection",
  );
  f.pointer("pointermove", 11, 21, 0);
  f.flush();
  assert.equal(f.root.title, "Isobel · bekannt und sichtbar");
  f.pointer("pointerdown", 11, 21, 1);
  assert.equal(f.root.title, "");
  f.pointer("pointerup", 11, 21, 1);
});


test("camera changes revoke hits and hover until the matching bitmap is actually painted", async t => {
  const f=fixture(t),marker=rect("room");marker.title="Room";
  f.canvas.render(root=>root.append(marker));await settle();f.flush();
  f.pointer("pointermove",15,25,0);f.flush();assert.equal(f.root.title,"Room");
  const scene=f.canvas.compiled;
  f.canvas.pan(10,0);
  assert.equal(f.canvas.ready,false,"new camera coordinates must not hit the old displayed bitmap");
  assert.equal(f.canvas.hitAt({clientX:15,clientY:25}),null);
  assert.equal(f.root.title,"");assert.equal(f.root.dataset.canvasState,"loading");
  f.flush();assert.equal(f.canvas.ready,true);assert.equal(f.canvas.compiled,scene);
  assert.equal(f.canvas.hitAt({clientX:15,clientY:25}).data.id,"room");
  f.canvas.zoom(.5);assert.equal(f.canvas.ready,false);f.flush();assert.equal(f.canvas.ready,true);
  f.canvas.previous();assert.equal(f.canvas.ready,false);f.flush();assert.equal(f.canvas.ready,true);
});
test("a resized surface cannot use old pixels with its new client-coordinate transform", async t => {
  const f=fixture(t);f.canvas.render(root=>root.append(rect("room")));await settle();f.flush();
  f.size(640,360);assert.equal(f.canvas.ready,false);assert.equal(f.canvas.hitAt({clientX:15,clientY:25}),null);
  f.canvas.set(f.canvas.view);f.flush();assert.equal(f.canvas.ready,true);assert.equal(f.root.width,640);
});
test("a scene compiled while hidden is not ready after showing until that scene is painted", async t => {
  const f=fixture(t);f.canvas.render(root=>root.append(rect("old")));await settle();f.flush();
  f.size(0,0);f.canvas.render(root=>root.append(rect("new")));await settle();
  assert.equal(f.canvas.ready,false);f.size(320,180);
  assert.equal(f.canvas.ready,false,"the previous bitmap may match the size, but belongs to an older scene");
  f.canvas.set(f.canvas.view);f.flush();assert.equal(f.canvas.ready,true);
  assert.equal(f.canvas.hitAt({clientX:15,clientY:25}).data.id,"new");
});

test("a pending frame is not interpreted as empty space for left-drag navigation", async t => {
  const f=fixture(t);f.canvas.options.pan=()=>true;
  f.canvas.render(root=>root.append(rect("room")));await settle();f.flush();
  f.canvas.pan(10,0);f.pointer("pointerdown",15,25,0);
  assert.equal(f.canvas.panning,false,"absence of a current hit does not prove empty space while a frame is pending");
  f.pointer("pointerdown",15,25,1);assert.equal(f.canvas.panning,true,"explicit middle-button navigation remains available");
  f.pointer("pointerup",15,25,1);f.flush();assert.equal(f.canvas.ready,true);
});

test('explicit primary-button navigation works during loading without granting author hits',async t=>{
 const f=fixture(t);f.canvas.options.pan=()=>"explicit";
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();
 f.canvas.pan(10,0);assert.equal(f.canvas.ready,false);
 assert.equal(f.canvas.hitAt({clientX:15,clientY:25}),null);
 f.pointer('pointerdown',15,25,0);assert.equal(f.canvas.panning,true);
 f.pointer('pointermove',40,25,0);assert.equal(f.canvas.ready,false);
 assert.equal(f.canvas.hitAt({clientX:40,clientY:25}),null);
 f.pointer('pointerup',40,25,0);f.flush();assert.equal(f.canvas.ready,true);
 f.canvas.options.locked=()=>true;f.canvas.pan(10,0);
 f.pointer('pointerdown',15,25,0);assert.equal(f.canvas.panning,false,'active author input still owns the camera');
});

test('an unreadable optional reference stays local while required terrain and exact hits remain usable',async t=>{
 const f=fixture(t);let broken=true;
 const draw=root=>root.append(rect('room'),atlasPaint('image',{source:broken?'bad':'reference-ok',width:2,height:2,optionalImage:true}),atlasPaint('image',{source:'terrain',width:10,height:10}));
 f.canvas.render(draw);await settle();assert.equal(f.canvas.ready,true);assert.equal(f.root.dataset.canvasState,'loaded');assert.equal(f.root.dataset.imageErrors,'1');assert.equal(f.canvas.hitAt({clientX:12,clientY:22})?.data.id,'room');assert.equal(f.document.querySelector('.map-canvas-state').hidden,false);assert.equal(f.document.querySelector('.map-canvas-state button').hidden,false);assert.match(f.document.querySelector('.map-canvas-state').textContent,/Bildvorlage/);
 const view=f.canvas.view;broken=false;f.document.querySelector('.map-canvas-state button').click();await settle();assert.equal(f.canvas.ready,true);assert.equal(f.root.dataset.imageErrors,'0');assert.deepEqual(f.canvas.view,view);assert.equal(f.document.querySelector('.map-canvas-state').hidden,true);
});

test('hits resolve the nearest semantic owner without a DOM or selector parser',t=>{
 const f=fixture(t),root=atlasPaint('group',{data:{atlasObject:'true',id:'outer'}}),inner=atlasPaint('group',{data:{atlasObject:'true',id:'inner'}});
 inner.append(atlasPaint('rect',{width:5,height:5,style:{fill:'red'}}));root.append(inner);
 const scene=new AtlasCanvasScene(root);
 assert.equal(scene.hit(f.canvas.ctx,{x:1,y:1},['atlasObject']).data.id,'inner');
 assert.equal(scene.hit(f.canvas.ctx,{x:1,y:1},['landVertex']),null);
 assert.equal(root.attrs,undefined);assert.equal(root.closest,undefined);
});

test('PNG and JPEG exports execute native commands without SVG serialization, and release the surface',async t=>{
 const f=fixture(t),created=[],create=f.document.createElement.bind(f.document);
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas'){created.push(n);n.toBlob=(done,type)=>done(new Blob([type]));}return n;};
 f.document.createElementNS=()=>{throw Error('SVG must never be created for raster export');};
 const box={x:100,y:200,width:20,height:10},scene=atlasPaint('group');scene.append(atlasPaint('rect',{width:20,height:10,style:{fill:'#123456'}}));
 for(const format of ['png','jpeg']){
  assert.equal(Buffer.from(await atlasImage(scene,200,100,box,format)).toString(),'image/'+format);
  assert(f.calls.some(([name,m])=>name==='setTransform'&&m.a===10&&m.d===10));
  assert.equal(created.at(-1).width,0);assert.equal(created.at(-1).height,0);
 }
 await assert.rejects(atlasImage(scene,8193,100,box),/Bildgröße/);
 const bad=atlasPaint('image',{source:'bad',width:2,height:2});
 const Original=global.Image;global.Image=class{async decode(){throw Error('decode failed');}};t.after(()=>global.Image=Original);
 await assert.rejects(atlasImage(bad,100,100,box),/decode failed/);
 assert.equal(created.at(-1).width,0);
});

test('drawing failure clears incomplete pixels and revokes hits before retry',async t=>{
 const f=fixture(t),fill=f.ctx.fill;f.ctx.fill=()=>{throw Error('drawing failed');};
 f.canvas.render(root=>root.append(rect('room')));await settle();
 assert.equal(f.canvas.ready,false);assert.equal(f.canvas.hitAt({clientX:15,clientY:25}),null);
 assert.equal(f.root.dataset.canvasState,'unavailable');assert(f.calls.some(c=>c[0]==='clearRect'));
 f.ctx.fill=fill;f.document.querySelector('.map-canvas-state button').click();await settle();
 assert.equal(f.canvas.ready,true);assert.equal(f.canvas.hitAt({clientX:15,clientY:25}).data.id,'room');
});


test('tiled export reuses one tile canvas, composites exact pixel rectangles and encodes only the result',async t=>{
 const f=fixture(t),created=[],copies=[],encoded=[],create=f.document.createElement.bind(f.document);
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas'){created.push(n);n.toBlob=(done,type)=>{encoded.push({canvas:n,type});done(new Blob([type]));};}return n;};
 f.ctx.drawImage=(image,x,y)=>copies.push({image,x,y,width:image.width,height:image.height});
 global.Image=class{constructor(){throw Error('Renderer tiles must never be encoded and decoded as images');}};
 const box={x:20,y:-40,width:2050,height:1026},calls=[];
 const read=async(part,width,height)=>{calls.push(part);return{ok:true,value:{campaignId:'c',revision:7,box:part,width,height,scene:atlasPaint('rect',{width:part.width,height:part.height,style:{fill:'red'}})}};};
 for(const format of ['png','jpeg']){
  copies.length=0;encoded.length=0;created.length=0;
  const bytes=await atlasImage(atlasExportTiles(box,1025,513,'c',7,read,()=>true),1025,513,box,format);
  assert(bytes instanceof Uint8Array);assert.equal(Buffer.from(bytes).toString(),'image/'+format);assert.equal(created.length,2);assert.equal(encoded.length,1);assert.equal(encoded[0].canvas,created[0]);
  assert.deepEqual(copies.map(c=>[c.x,c.y,c.width,c.height]),[[0,0,512,512],[512,0,512,512],[1024,0,1,512],[0,512,512,1],[512,512,512,1],[1024,512,1,1]]);
  assert(copies.every(c=>c.image===created[1]));assert(created.every(c=>c.width===0&&c.height===0));
 }
});

test('export cancellation during image decode or encoding discards pixels, releases surfaces and reads no successor',async t=>{
 const f=fixture(t),created=[],create=f.document.createElement.bind(f.document);let encodes=0,running=true,reads=0;
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas'){created.push(n);n.toBlob=done=>{encodes++;running=false;done(new Blob(['png']));};}return n;};
 const box={x:0,y:0,width:1024,height:512};
 const read=async(part,width,height)=>{reads++;return{ok:true,value:{campaignId:'c',revision:7,box:part,width,height,scene:atlasPaint('image',{width:part.width,height:part.height,source:'wait:cancel'})}};};
 const pending=atlasImage(atlasExportTiles(box,1024,512,'c',7,read,()=>running),1024,512,box,'png',()=>running);
 await settle();running=false;f.releases.get('wait:cancel')();await assert.rejects(pending,/abgebrochen/);assert.equal(reads,1);assert.equal(encodes,0);assert(created.every(c=>c.width===0&&c.height===0));
 running=true;await assert.rejects(atlasImage(atlasPaint('rect',{width:1,height:1}),1,1,box,'png',()=>running),/abgebrochen/);assert.equal(encodes,1);assert(created.every(c=>c.width===0&&c.height===0));
});

test('oversized encoded output is rejected before reading or sending bytes',async t=>{
 const f=fixture(t),create=f.document.createElement.bind(f.document);let expanded=false;
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas')n.toBlob=done=>done({size:64*1024*1024+1,arrayBuffer(){expanded=true;throw Error('Must not expand oversized output');}});return n;};
 await assert.rejects(atlasImage(atlasPaint('rect',{width:1,height:1}),1,1,{x:0,y:0,width:1,height:1}),/64 MiB/);assert.equal(expanded,false);
});


test('one GM export freezes floor, grid, scale, reference, box, size and format before asynchronous reads',async t=>{
 const f=fixture(t),controls=f.document.createElement('div');
 controls.innerHTML='<input id="atlas-export-size" value="1025"><input id="atlas-export-audience" value="gm"><input id="atlas-export-format" value="png"><input id="atlas-export-grid"><input id="atlas-hex-level" value="0"><input id="atlas-export-reference"><button id="atlas-export-png"></button><button id="atlas-export-cancel"></button><button id="atlas-output-save-campaign"></button><p id="atlas-save-status"></p><p id="atlas-output-area"></p>';
 f.document.body.append(controls);f.document.querySelector('#atlas-export-grid').checked=true;f.document.querySelector('#atlas-export-reference').checked=false;
 const box={x:0,y:0,width:1025,height:2},created=[],copies=[],queries=[],errors=[],encodings=[],create=f.document.createElement.bind(f.document);let strokes=0,saved=0;
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas'){
  created.push(n);const ctx=new Proxy({canvas:n,stroke(){strokes++;},drawImage(){copies.push(strokes);strokes=0;}},{get(o,k){return k in o?o[k]:()=>{};}});
  n.getContext=()=>ctx;n.toBlob=(done,type)=>{encodings.push({width:n.width,height:n.height,type});done(new Blob(['png']));};
 }return n;};
 const frame=q=>({campaignId:'c',revision:7,region:{box:q.box,fence:'f',scopeId:null,floorId:q.floorId,landscape:{state:'ready',coverage:{complete:true,mode:'detail'},records:[],tiles:[]}},cities:[],bindings:[],workspace:{rooms:[]},geometry:{drawing:{elements:[]}}});
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:{},owner:{token:'t'},outputRun:null,floorId:'ground',landscape:{exportBox:null},camera:{view:box},opts:{flush:async()=>true,status(){}},regionQuery:()=>({box,width:100,height:100,scopeId:null,floorId:'ground',slice:null,roofs:true}),error:e=>errors.push(e.message)});
 f.window.campaign={atlasRegion:async(token,q)=>{
  queries.push(q);
  if(queries.length===1){f.document.querySelector('#atlas-export-grid').checked=false;f.document.querySelector('#atlas-hex-level').value='10';f.document.querySelector('#atlas-export-reference').checked=true;f.document.querySelector('#atlas-export-size').value='2048';f.document.querySelector('#atlas-export-format').value='jpeg';ui.floorId='upper';box.x=20000;}
  return{ok:true,value:frame(q)};
 },exportAtlasPNG:async(token,bytes,audience,format,fence)=>{assert(bytes instanceof Uint8Array);assert.equal(format,'png');assert.equal(fence,'f');saved++;return{ok:true,value:{cancelled:false}};}};
 await ui.exportPNG();assert.deepEqual(errors,[]);assert.equal(saved,1);assert.equal(queries.length,4);assert(queries.slice(1).every(q=>q.references===false));assert.deepEqual(encodings,[{width:1025,height:2,type:'image/png'}]);assert.equal(copies.length,3);assert(copies.every(n=>n>0),'All tiles use the originally selected grid/level');assert(queries.every(q=>q.floorId==='ground'));assert.deepEqual(queries.slice(1).map(q=>q.box.x),[0,512,1024]);assert.equal(f.document.querySelector('#atlas-save-status').textContent,'Atlas-PNG gespeichert');assert(created.every(c=>c.width===0&&c.height===0));
});


test('GM image resolution preserves label composition and scales text across tiles in both orientations',async t=>{
 const f=fixture(t),controls=f.document.createElement('div');
 controls.innerHTML='<input id="atlas-export-size"><input id="atlas-export-audience" value="gm"><input id="atlas-export-format" value="png"><input id="atlas-export-grid"><input id="atlas-hex-level" value="0"><input id="atlas-export-reference"><button id="atlas-export-png"></button><button id="atlas-export-cancel"></button><button id="atlas-output-save-campaign"></button><p id="atlas-save-status"></p><p id="atlas-output-area"></p>';
 f.document.body.append(controls);
 const painted=[],errors=[],create=f.document.createElement.bind(f.document);let matrix=new Matrix(),saves=0;
 f.ctx.measureText=text=>({width:text.length*Number(f.ctx.font.match(/([\d.]+)px/)[1])*0.6});
 f.ctx.setTransform=m=>{matrix=m;};
 f.ctx.fillText=text=>painted.push({text,pixels:Number(f.ctx.font.match(/([\d.]+)px/)[1])*Math.hypot(matrix.a,matrix.b)});
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas')n.toBlob=done=>done(new Blob(['png']));return n;};
 for(const [width,height]of [[1024,512],[512,1024]]){
  const box={x:0,y:0,width,height},labels=[{id:'a',kind:'room',rank:0,text:'Torhalle',point:{x:250,y:250}},{id:'b',kind:'room',rank:0,text:'Wachstube',point:{x:295,y:250}}];
  const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:{},owner:{token:'t'},outputRun:null,landscape:{exportBox:null},camera:{view:box},opts:{flush:async()=>true,status(){}},regionQuery:()=>({box,width:100,height:100,scopeId:null,floorId:'ground',slice:null,roofs:true}),error:e=>errors.push(e.message)});
  f.window.campaign={atlasRegion:async(token,q)=>({ok:true,value:{campaignId:'c',revision:7,region:{box:q.box,fence:'f',labels,scopeId:null,floorId:'ground',landscape:{state:'ready',coverage:{complete:true,mode:'detail'},records:[],tiles:[]}},cities:[],bindings:[],workspace:{rooms:[]},geometry:{drawing:{elements:[]}}}}),exportAtlasPNG:async()=>{saves++;return{ok:true,value:{cancelled:false}};}};
  for(const size of [1024,2048]){
   painted.length=0;f.document.querySelector('#atlas-export-size').value=String(size);await ui.exportPNG();assert.deepEqual(errors,[]);
   assert.deepEqual([...new Set(painted.map(p=>p.text))],['Torhalle'],'Resolution must not change collision decisions');
   assert(painted.length>1,'The label is composed through multiple export tiles');
   assert(painted.every(p=>Math.abs(p.pixels-12*size/1024)<1e-6),'Text scales with the exported map');
  }
 }
 assert.equal(saves,4);
});


test('explicitly retained local paths survive rebase; dynamic paths and context caches remain independent',t=>{
 fixture(t);const cache=new WeakMap(),base=atlasPaint('group',{retainGeometry:true}),fixed=atlasPaint('polygons',{polygons:[{outer:[{x:0,y:0},{x:10,y:0},{x:10,y:10}],holes:[]}]}),dynamic=atlasPaint('polyline',{points:[{x:1,y:1},{x:2,y:2}]}),wrap=atlasPaint('group');base.append(fixed);wrap.append(base,dynamic);
 const first=new AtlasCanvasScene(wrap,cache);base.geometry.matrix=[1,0,0,1,20,-10];dynamic.geometry.points=[{x:3,y:3},{x:4,y:4}];const next=new AtlasCanvasScene(wrap,cache);
 assert.equal(next.commands[0].path,first.commands[0].path);assert.equal(next.commands[0].matrix.e,20);assert.equal(next.commands[0].matrix.f,-10);assert.notEqual(next.commands[1].path,first.commands[1].path);assert.equal(next.pathReuses,1);assert.equal(next.pathBuilds,1);
 assert.notEqual(new AtlasCanvasScene(wrap,new WeakMap()).commands[0].path,first.commands[0].path,'a different presentation context owns a different path cache');
});

test('numeric contours and mask holes compile once into reusable native paths without path text',t=>{
 const f=fixture(t),NativePath=global.Path2D;
 global.Path2D=class extends NativePath{constructor(value){assert.equal(value,undefined,'Generated geometry must never serialize SVG path text');super();}};
 const outer=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],hole=[{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}],polygons=[{outer,holes:[hole]}];
 const root=atlasPaint('group'),room=atlasPaint('polygons',{polygons,matrix:[1,0,0,1,20,30],style:{fill:'red',fillRule:'evenodd'},data:{atlasObject:'true',id:'room'}});
 root.append(room,atlasPaint('rect',{width:20,height:20,pointer:false,maskCuts:[{polygons,alpha:1}],style:{fill:'black'}}));
 const scene=new AtlasCanvasScene(root),expected=[['move',0,0],['line',10,0],['line',10,10],['line',0,10],['close'],['move',2,2],['line',8,2],['line',8,8],['line',2,8],['close']];
 assert.deepEqual(scene.commands[0].path.commands,expected);assert.deepEqual(scene.commands[1].cuts[0].path.commands,expected);
 const path=scene.commands[0].path,queries=[];f.ctx.isPointInPath=(p,x,y,rule)=>{queries.push({p,x,y,rule});return true;};
 scene.draw(f.ctx,new Matrix(),new Map(),{x:0,y:0});scene.draw(f.ctx,new Matrix(),new Map(),{x:0,y:0});
 assert.equal(scene.hit(f.ctx,{x:21,y:31},['atlasObject']).data.id,'room');assert.deepEqual(queries,[{p:path,x:1,y:1,rule:'evenodd'}]);assert.equal(scene.commands[0].path,path,'Drawing and hit testing retain the same compiled path');scene.dispose();

});

test('host recovery waits for its current confirmed frame instead of replaying a stale builder',async t=>{
 const f=fixture(t);f.canvas.render(root=>root.append(rect('old')));await settle();let confirmed=false,calls=0;
 f.canvas.options.redraw=()=>{calls++;if(confirmed)f.canvas.render(root=>root.append(rect('current')));};
 f.root.dispatchEvent(new f.window.Event('contextlost',{cancelable:true}));f.root.dispatchEvent(new f.window.Event('contextrestored'));await settle();assert.equal(calls,1);assert.equal(f.canvas.ready,false);
 confirmed=true;f.canvas.options.redraw();await settle();assert.equal(f.canvas.hitAt({clientX:15,clientY:25}).data.id,'current');
});


test('a new source recovers from the previous scene failure without hiding an unavailable-device retry',async t=>{
 const f=fixture(t),fill=f.ctx.fill;f.ctx.fill=()=>{throw Error('old source failed');};f.canvas.render(root=>root.append(rect('old')));await settle();assert.equal(f.canvas.failed,true);
 f.ctx.fill=fill;f.canvas.context('new',f.canvas.view);f.canvas.render(root=>root.append(rect('new')));await settle();assert.equal(f.canvas.ready,true);assert.equal(f.canvas.hitAt({clientX:15,clientY:25}).data.id,'new');
});
test('changing source with no Canvas context preserves a visible working retry',async t=>{
 const f=fixture(t,{available:false});f.canvas.context('new',f.canvas.view);assert.equal(f.document.querySelector('.map-canvas-state').hidden,false);assert.equal(f.root.dataset.canvasState,'unavailable');
 f.canvas.render(root=>root.append(rect('new')));f.available(true);f.document.querySelector('.map-canvas-state button').click();await settle();assert.equal(f.canvas.ready,true);
});


test('a cropped room keeps its complete key centered, independently of polygon winding and export tile boundaries',()=>{
 const outer=[{x:12,y:6},{x:0,y:6},{x:0,y:0},{x:12,y:0}],options={grid:false,level:0,references:false,floorId:'ground',roofs:false};
 for(const points of [outer,[...outer].reverse()]){
  const data={cities:[],bindings:[{id:'b',kind:'dungeon',ownerId:'local',parent:'world',x:0,y:0,angle:0}],workspace:{rooms:[{id:'r',scopeId:'local',floorId:'ground',number:'1',name:'Zollhaus',polygons:[{outer:points,holes:[]}]}]},geometry:{floors:[],drawing:{elements:[]}}};
  for(const box of [{x:-1,y:-1,width:14,height:8},{x:5,y:-1,width:7,height:8}]){
   const scene=atlasRegionPaint(data,[],box,512,new Map(),options),labels=scene.children.flatMap(n=>n.children).filter(n=>n.kind==='text');
   assert.equal(labels.length,1);assert.equal(labels[0].text,'1 · Zollhaus');
   assert.deepEqual({x:labels[0].geometry.x,y:labels[0].geometry.y},{x:6,y:3});
   assert.equal(labels[0].style.textAlign,'center');assert.equal(labels[0].style.textBaseline,'middle');assert(labels[0].style.fontSize>=16*box.width/512);
  }
 }
});

test('output range commits on release, preserves author data, supports two corners and cancels only its unfinished selection',async t=>{
 const f=fixture(t),area=f.document.createElement('p');area.id='atlas-output-area';f.document.body.append(area);
 // This range probe bypasses the constructor; provide its export-mode controls.
 f.document.body.insertAdjacentHTML('beforeend','<select id="atlas-export-kind"><option value="image" selected>Bild</option><option value="campaign">Bearbeitbare Kampagne</option></select><section id="atlas-output-editable"></section><div id="atlas-output-image"></div><button id="atlas-output-save-campaign"></button><button id="atlas-export-png"></button>');
 const initial={x:-2,y:-3,width:30,height:20};let draws=0;
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{root:{dataset:{}},svg:f.root,camera:{view:initial,ready:true,stopZoom(){}},reference:{active:false},exportOpen:true,exportChoosing:true,outputRun:null,exportBox:null,exportCorner:null,exportDrag:null,point:e=>({x:e.clientX,y:e.clientY}),geometryCurrent:()=>true,render:()=>draws++,suppressClick(){},opts:{status(){throw Error('Unexpected write or navigation');}},family:'interior',draft:[{x:99,y:88}]});
 const event=(x,y)=>({button:0,pointerId:7,clientX:x,clientY:y});
 ui.down(event(12,6));ui.move(event(-1,-1));await ui.up(event(-1,-1));
 assert.deepEqual(ui.exportBox,{x:-1,y:-1,width:13,height:7});assert.equal(ui.exportChoosing,false);assert.match(area.textContent,/Gewählter Bereich/);
 const confirmed=ui.exportBox;ui.exportChoosing=true;ui.down(event(100,100));await ui.up(event(100,100));assert.deepEqual(ui.exportCorner,{x:100,y:100});
 ui.cancel();assert.equal(ui.exportBox,confirmed);assert.equal(ui.exportChoosing,false);assert.deepEqual(ui.draft,[{x:99,y:88}]);
 ui.exportChoosing=true;ui.down(event(0,0));await ui.up(event(0,0));ui.down(event(4,2));await ui.up(event(4,2));assert.deepEqual(ui.exportBox,{x:0,y:0,width:4,height:2});assert.equal(ui.exportCorner,null);assert(draws>0);
});

test('Canvas2D context loss must allow browser restoration and retry cannot authorize a still-lost context',async t=>{
 const f=fixture(t);let lost=false;f.ctx.isContextLost=()=>lost;
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();const before=f.canvas.view;
 lost=true;const loss=new f.window.Event('contextlost',{cancelable:true});f.root.dispatchEvent(loss);
 assert.equal(loss.defaultPrevented,false,'canceling Canvas2D loss aborts browser restoration');
 f.document.querySelector('.map-canvas-state button').click();await settle();assert.equal(f.canvas.ready,false);assert.equal(f.root.dataset.canvasState,'unavailable');assert.deepEqual(f.canvas.view,before);
 lost=false;f.root.dispatchEvent(new f.window.Event('contextrestored'));await settle();assert.equal(f.canvas.ready,true);assert.deepEqual(f.canvas.view,before);
});
test('a context lost before its event is delivered cannot publish pixels or authorize hits',async t=>{
 const f=fixture(t);let lost=false;f.ctx.isContextLost=()=>lost;
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();lost=true;
 assert.equal(f.canvas.ready,false);assert.equal(f.canvas.hitAt({clientX:15,clientY:25}),null);
 f.canvas.pan(1,0);f.flush();assert.equal(f.root.dataset.canvasState,'unavailable');
});

for(const initial of [true,false])test('context acquisition exceptions remain locally recoverable '+(initial?'at startup':'during retry/restoration'),async t=>{
 const f=fixture(t,{available:initial?'throw':true});
 if(!initial){f.canvas.render(root=>root.append(rect('room')));await settle();f.available('throw');f.root.dispatchEvent(new f.window.Event('contextlost',{cancelable:true}));assert.doesNotThrow(()=>f.document.querySelector('.map-canvas-state button').click());assert.doesNotThrow(()=>f.root.dispatchEvent(new f.window.Event('contextrestored')));}
 f.canvas.render(root=>root.append(rect('new')));assert.equal(f.canvas.ready,false);assert.equal(f.root.dataset.canvasState,'unavailable');f.available(true);f.document.querySelector('.map-canvas-state button').click();await settle();assert.equal(f.canvas.ready,true);assert.equal(f.canvas.hitAt({clientX:15,clientY:25}).data.id,'new');
});

test('loss during a draw cannot publish a successful frame before the loss event arrives',async t=>{
 const f=fixture(t);let lost=false;f.ctx.isContextLost=()=>lost;f.ctx.fill=()=>{lost=true;};
 f.canvas.render(root=>root.append(rect('room')));await settle();assert.equal(f.canvas.ready,false);assert.equal(f.root.dataset.canvasState,'unavailable');assert.equal(f.canvas.hitAt({clientX:15,clientY:25}),null);
 lost=false;f.ctx.fill=()=>{};f.root.dispatchEvent(new f.window.Event('contextrestored'));await settle();assert.equal(f.canvas.ready,true);
});

test('detailed Atlas and PNG surfaces use the saved room colors and the same canonical contour',()=>{
 const room={id:'r',scopeId:'local',floorId:'ground',number:'1',name:'Zollhaus',polygons:[{outer:[{x:0,y:0},{x:12,y:0},{x:12,y:6},{x:0,y:6}],holes:[]}]},style={id:'r',fill:'#3f7c9e',wall:'#8b2e4b'};
 for(const styles of [[],[style]])for(const selected of [false,true]){
  const data={cities:[],bindings:[{id:'b',kind:'dungeon',ownerId:'local',parent:'world',x:0,y:0,angle:0}],workspace:{rooms:[room]},geometry:{floors:[],drawing:{elements:[],styles}}};
  const live=atlasPaint('group'),ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:data,selection:selected?{id:'r'}:null,label(){}});ui.drawRoomFace(live,room,0.1);
  const output=atlasRegionPaint(data,[],{x:0,y:0,width:12,height:6},120,new Map(),{grid:false,level:0,references:false,floorId:'ground',roofs:false}),face=output.children.flatMap(n=>n.children).find(n=>n.kind==='polygons');
  assert.deepEqual(live.children[0].geometry.polygons,room.polygons);assert.deepEqual(face.geometry.polygons,room.polygons);
  assert.deepEqual(output.children.find(n=>n.data.spatialScope==='local').data,{spatialScope:'local',spatialFloor:'0',spatialAnchorX:'0',spatialAnchorY:'0'});
  assert.equal(live.children[0].style.fill,styles.length?style.fill:selected?'#e8d8ac':'#e2dac4');assert.equal(face.style.fill,styles.length?style.fill:'#e2dac4');
  assert.equal(live.children[0].style.stroke,styles.length?style.wall:'#3d4b45');assert.equal(face.style.stroke,live.children[0].style.stroke);assert.equal(face.style.lineWidth,live.children[0].style.lineWidth);
 }
});

test('export scale uses world meters and is drawn once after streamed tiles without clearing their pixels',async t=>{
 const f=fixture(t),events=[],create=f.document.createElement.bind(f.document);
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas')n.toBlob=done=>done(new Blob(['png']));return n;};
 f.ctx.drawImage=()=>events.push('tile');f.ctx.clearRect=()=>events.push('clear');f.ctx.fillText=text=>events.push(text);
 const box={x:-15000,y:-9000,width:30000,height:18000},overlay=atlasExportScale(box,1024,614);
 const group=overlay.children[0],bar=group.children.find(n=>n.kind==='polyline');assert(Math.abs((bar.geometry.points[5].x-bar.geometry.points[1].x)*group.geometry.matrix[0]-2*1609.344)<1e-8,'nice 2-mile bar spans the actual world distance');
 const read=async(part,width,height)=>({ok:true,value:{campaignId:'c',revision:1,box:part,width,height,scene:atlasPaint('rect',{width:part.width,height:part.height,style:{fill:'green'}})}});
 await atlasImage(atlasExportTiles(box,1024,614,'c',1,read,()=>true),1024,614,box,'png',()=>true,overlay);
 assert.equal(events.filter(e=>e==='2 Meilen').length,1);assert.equal(events.at(-1),'2 Meilen');assert(events.lastIndexOf('clear')<events.lastIndexOf('tile'),'legend composition must preserve the completed map');
 const world=atlasExportScale({x:0,y:0,width:20000000,height:12000000},2048,1229),label=world.children[0].children.find(n=>n.kind==='text');
 assert.equal(label.style.fontSize,11,'world-scale labels use browser-safe glyph metrics');
 assert.equal(world.children[0].geometry.matrix[0],20000000/1024,'the transform preserves printed label size');
 assert.equal(atlasExportScale(box,8192,50),undefined,'an extremely shallow output has no space for a legible scale');
});


test('smooth wheel gestures preserve anchors, coalesce history and cancel on navigation',async t=>{
 const f=fixture(t),oldCancel=global.cancelAnimationFrame;t.after(()=>global.cancelAnimationFrame=oldCancel);global.cancelAnimationFrame=()=>{};
 f.canvas.options.smoothZoom=true;f.window.matchMedia=()=>({matches:false});
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();
 const before=f.canvas.view,anchor={x:180,y:250},start=performance.now();
 f.canvas.zoom(.8,anchor);assert.deepEqual(f.canvas.view,before,'animation starts from current frame');
 for(const callback of f.frames.splice(0))callback(start+80);
 const midway=f.canvas.view;assert(midway.width<before.width&&midway.width>before.width*.8);
 f.canvas.zoom(.8,anchor,true);
 for(const callback of f.frames.splice(0))callback(performance.now()+200);
 assert(Math.abs(f.canvas.view.width-before.width*.64)<1e-8);
 assert(Math.abs((anchor.x-f.canvas.view.x)/f.canvas.view.width-(anchor.x-before.x)/before.width)<1e-12);
 f.canvas.previous();assert.deepEqual(f.canvas.view,before,'one back action undoes entire burst');
 f.canvas.zoom(.5,anchor);f.canvas.set({x:1,y:2,width:100,height:50});
 for(const callback of f.frames.splice(0))callback(performance.now()+300);
 assert.deepEqual(f.canvas.view,{x:1,y:2,width:100,height:50},'old animation cannot overwrite another navigation');
 f.window.matchMedia=()=>({matches:true});f.canvas.zoom(.5);assert.equal(f.canvas.view.width,50,'reduced motion applies immediately');
});

for(const queuedOverlay of [false,true])test(`smooth zoom advances and paints in the same frame (queued overlay: ${queuedOverlay})`,async t=>{
 const f=fixture(t);f.canvas.options.smoothZoom=true;f.window.matchMedia=()=>({matches:false});
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();
 const painted=[],paint=f.canvas.paint.bind(f.canvas);
 f.canvas.paint=()=>{paint();painted.push(f.canvas.view);};
 if(queuedOverlay)f.canvas.redrawOverlay();
 f.canvas.zoom(.5);const start=f.canvas.zoomUpdatedAt;
 for(const elapsed of [16,32,64,120,200]){
  painted.length=0;
  for(const callback of f.frames.splice(0))callback(start+elapsed);
  assert.equal(painted.length,1,'one camera paint per frame, including the first');
  assert.deepEqual(painted[0],f.canvas.view,'the displayed camera must be the current frame, not its predecessor');
  assert.equal(f.canvas.ready,true,'the displayed camera and author hits agree after the frame');
 }
 assert.equal(f.frames.length,0,'a completed zoom must not schedule another paint');
});

test('a camera replacement during a zoom frame survives and owns the next frame',async t=>{
 const f=fixture(t);f.canvas.options.smoothZoom=true;f.window.matchMedia=()=>({matches:false});
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();let redirected=false;
 f.canvas.options.changed=()=>{if(!redirected){redirected=true;f.canvas.set({x:0,y:0,width:100,height:50});f.canvas.zoom(.5);}};
 f.canvas.zoom(.8);for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+200);
 assert.equal(f.canvas.view.width,100);assert.equal(f.canvas.destination.width,50);assert.equal(f.frames.length,1);
 for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+200);
 assert.equal(f.canvas.view.width,50);assert.equal(f.canvas.ready,true);assert.equal(f.frames.length,0);
});

test('a failed animated camera paint retires the zoom without scheduling a busy loop',async t=>{
 const f=fixture(t);f.canvas.options.smoothZoom=true;f.window.matchMedia=()=>({matches:false});
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();
 f.canvas.zoom(.5);f.ctx.isContextLost=()=>true;
 for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+16);
 assert.equal(f.root.dataset.canvasState,'unavailable');assert.equal(f.canvas.zoomTarget,null);assert.equal(f.frames.length,0);
});

test('camera overlay repaints the current metric view while new scene images are still loading',async t=>{
 const f=fixture(t),overlays=[];
 f.canvas.options.overlay=(_root,box,mpp)=>overlays.push({box,mpp})&&false;
 f.canvas.render(root=>root.append(rect('old')));await settle();f.flush();
 f.canvas.render(root=>root.append(atlasPaint('image',{source:'wait:overlay',width:20,height:20})));
 await settle();f.canvas.zoom(.5);f.flush();
 assert.equal(overlays.at(-1).box.width,160);assert.equal(overlays.at(-1).mpp,.5);
 assert.equal(f.canvas.ready,false,'loading geometry must not authorize stale hits');
 f.releases.get('wait:overlay')();await settle();f.flush();
 assert.equal(overlays.at(-1).box.width,160);
});


test('panel resizing preserves world centre and CSS-pixel scale without adding history',t=>{
 const f=fixture(t),before=f.canvas.view;
 f.canvas.resizeViewport({width:800,height:450},{width:460,height:450});
 const narrow=f.canvas.view;
 assert.equal(narrow.width/460,before.width/800);
 assert.equal(narrow.x+narrow.width/2,before.x+before.width/2);
 assert.equal(narrow.y+narrow.height/2,before.y+before.height/2);
 f.canvas.previous();assert.deepEqual(f.canvas.view,narrow);
 f.canvas.resizeViewport({width:460,height:450},{width:800,height:450});
 assert.deepEqual(f.canvas.view,before);
});

for(const pinch of [false,true])test(`touchpad ${pinch?'pinch':'scroll'} stays monotonic with early frame timestamps and moving input`,async t=>{
 const f=fixture(t),cancel=global.cancelAnimationFrame;t.after(()=>global.cancelAnimationFrame=cancel);global.cancelAnimationFrame=()=>{};
 f.canvas.options.smoothZoom=true;f.window.matchMedia=()=>({matches:false});
 f.canvas.render(root=>root.append(rect('room')));await settle();f.flush();
 const start=f.canvas.view;let previous=start.width;
 const wheel=delta=>{const e=new f.window.Event('wheel',{cancelable:true});Object.assign(e,{deltaY:delta,deltaMode:0,ctrlKey:pinch,clientX:107,clientY:75});f.root.dispatchEvent(e);assert(e.defaultPrevented);};
 for(const delta of [12,8,6,3,1,.25]){
  wheel(delta);
  for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt-2);
  assert(f.canvas.view.width>=previous,'an early animation timestamp must never reverse zoom');
  for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+16);
  assert(f.canvas.view.width>=previous);previous=f.canvas.view.width;
 }
 assert(f.canvas.destination.width>f.canvas.view.width,'loading can anticipate the target');
 for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+200);
 assert(f.canvas.view.width>=previous);const out=f.canvas.view;
 wheel(-10);for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+16);
 assert(f.canvas.view.width<out.width,'intentional reversal responds immediately');
 f.canvas.stopZoom();f.canvas.previous();assert.deepEqual(f.canvas.view,start,'one continuous gesture has one history entry');
});

test('a direction reversal does not finish an outstanding zoom in the old direction',t=>{
 const f=fixture(t),cancel=global.cancelAnimationFrame;t.after(()=>global.cancelAnimationFrame=cancel);global.cancelAnimationFrame=()=>{};
 f.canvas.options.smoothZoom=true;f.window.matchMedia=()=>({matches:false});
 f.canvas.zoom(2);const displayed=f.canvas.view;
 f.canvas.zoom(.9,undefined,true);
 for(const callback of f.frames.splice(0))callback(f.canvas.zoomUpdatedAt+200);
 assert.equal(f.canvas.view.width,displayed.width*.9);
});


test('dungeon export frames source-indexed whole-floor geometry, not visible rooms, through the resolved rotated binding',()=>{
 const binding={id:'binding',kind:'dungeon',ownerId:'s',parent:'building',parentId:'house',x:0,y:0,angle:0};
 const data={bindings:[binding],cities:[],workspace:{rooms:[]},region:{scopeId:'s',floorId:'upper',scopeBounds:{s:{x:-10,y:-5,width:40,height:10}},frames:{binding:{x:100,y:-200,angle:Math.PI/2}},coverage:{mode:'raster'}}};
 const before=JSON.stringify(data),box=dungeonExportBox(data,'s','upper');
 for(const [key,value] of Object.entries({x:93,y:-212,width:14,height:44}))assert(Math.abs(box[key]-value)<1e-9,key);
 assert.equal(JSON.stringify(data),before,'Framing changes no geometry or binding');
 assert.equal(dungeonExportBox(data,'s','ground'),null,'Old-floor bounds are never silently reused');
 assert.equal(dungeonExportBox(data,'other','upper'),null);
 data.region.scopeBounds={};assert.equal(dungeonExportBox(data,'s','upper'),null,'No viewport fallback for missing whole-floor metadata');
});

test('chosen dungeon framing follows later confirmed enlargement and refuses stale scope or floor metadata',t=>{
 fixture(t);
 const data={bindings:[{id:'b',kind:'dungeon',ownerId:'s',parent:'world',x:0,y:0,angle:0}],cities:[],region:{scopeId:'s',floorId:'ground',scopeBounds:{s:{x:0,y:0,width:10,height:10}}}};
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:data,scopeId:'s',floorId:'ground',exportDungeon:true,exportBox:{x:800,y:800,width:1,height:1},camera:{view:{x:10,y:10,width:5,height:5}}});
 const first=ui.outputBox();assert(first.width>10);
 data.region.scopeBounds.s.width=30;assert(ui.outputBox().width>first.width,'An earlier export must not retain the old rectangle');
 ui.floorId='upper';assert.equal(ui.outputBox(),null,'No old custom box or camera fallback');
 ui.exportDungeon=false;assert.deepEqual(ui.outputBox(),ui.exportBox,'Explicit free framing still works');
 ui.exportBox=null;assert.deepEqual(ui.outputBox(),ui.camera.view);
});


test('automatic ground-plan framing reserves a scale strip even at small output sizes',()=>{
 const data={bindings:[{id:'b',kind:'dungeon',ownerId:'s',parent:'world',x:0,y:0,angle:0}],cities:[],region:{scopeId:'s',floorId:'ground',scopeBounds:{s:{x:0,y:0,width:10,height:20}}}};
 for(const size of [256,1024,2048]){
  const plain=dungeonExportBox(data,'s','ground'),scaled=dungeonExportBox(data,'s','ground',true,size);
  const mpp=Math.max(scaled.width,scaled.height)/Math.min(1024,size);
  assert(scaled.height-plain.height>=62*mpp,'Scale must stay in its own footer');
 }
});

test('ground-plan preview fits the unobscured canvas when the export panel overlays it',t=>{
 const f=fixture(t),panel=f.document.createElement('aside');panel.id='atlas-secondary';panel.getBoundingClientRect=()=>({left:700});f.document.body.append(panel);
 let view;const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{svg:{getBoundingClientRect:()=>({left:300,right:1000,width:700,height:600})},camera:{set:v=>view=v}}),box={x:10,y:20,width:60,height:30};
 ui.frameOutput(box);const mpp=view.width/700;
 const left=(box.x-view.x)/mpp,right=(box.x+box.width-view.x)/mpp;
 assert(left>=12&&right<=400-12,'The entire frame remains left of the overlay');
 assert((box.y-view.y)/mpp>=12);assert((box.y+box.height-view.y)/mpp<=600-12);
});

for(const sameToken of [false,true])for(const heldStage of ['read','save'])test(`a retired PNG export cannot block or finish the current campaign export (${heldStage}, same token=${sameToken})`,async t=>{
 const f=fixture(t),controls=f.document.createElement('div');
 controls.innerHTML='<section id="atlas-output"></section><button id="atlas-output-open"></button><input id="atlas-export-size" value="256"><input id="atlas-export-audience" value="gm"><input id="atlas-export-format" value="png"><input id="atlas-export-grid"><input id="atlas-hex-level" value="0"><input id="atlas-export-reference"><button id="atlas-export-png"></button><button id="atlas-export-cancel"></button><button id="atlas-output-save-campaign"></button><p id="atlas-save-status"></p><p id="atlas-output-area"></p><div id="atlas-search-results"></div>';
 f.document.body.append(controls);const get=id=>f.document.getElementById(id),create=f.document.createElement.bind(f.document),messages=[],errors=[],saved=[],held=[];
 f.document.createElement=tag=>{const n=create(tag);if(tag==='canvas')n.toBlob=done=>done(new Blob(['png']));return n;};
 const box={x:0,y:0,width:10,height:10},owner={token:'first',campaign:{id:'campaign'}},next=sameToken?owner:{token:'second',campaign:{id:'other'}},frame=(token,q)=>({campaignId:token==='second'?'other':'campaign',revision:7,region:{box:q.box,fence:'f-'+token,scopeId:null,floorId:q.floorId,landscape:{state:'ready',coverage:{complete:true,mode:'detail'},records:[],tiles:[]}},cities:[],bindings:[],workspace:{rooms:[]},geometry:{drawing:{elements:[]}}});
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{root:f.root,svg:f.root,hitVersion:0,previewRequest:0,searchRequest:0,request:0,hitDialog:{close(){}},playback:{stop(){}},reference:{close(){}},projection:{},owner,outputRun:null,floorId:'ground',landscape:{context(){}},camera:{view:box,context(){}},opts:{flush:async()=>true,status:s=>messages.push(s)},regionQuery:()=>({box,width:256,height:256,scopeId:null,floorId:'ground',slice:null,roofs:true}),error:e=>errors.push(e.message)});
 let initial=0;
 f.window.campaign={cancelAtlasRegion:async()=>{},atlasRegion:async(token,q)=>{if(q.revision===undefined){initial++;if((initial===1&&heldStage==='read')||initial===2)return new Promise(resolve=>held.push(()=>resolve({ok:true,value:frame(token,q)})));}return{ok:true,value:frame(token,q)};},exportAtlasPNG:async token=>{saved.push(token);if(saved.length===1&&heldStage==='save')return new Promise(resolve=>held.push(()=>resolve({ok:true,value:{cancelled:false}})));return{ok:true,value:{cancelled:false}};}};
 const until=async check=>{for(let i=0;i<50&&!check();i++)await settle();assert(check(),'Expected held export stage');};
 const old=ui.exportPNG();let current;
 try{
  await until(()=>held.length===1);ui.activate(next);ui.projection={};ui.floorId='ground';
  assert.equal(ui.exporting,false,'a new activation owns fresh export controls');assert.equal(get('atlas-export-png').disabled,false);assert.equal(get('atlas-export-cancel').hidden,true);
  current=ui.exportPNG();await until(()=>held.length===2);held.shift()();await old;
  assert.equal(ui.exporting,true,'the retired finalizer must not unlock the current run');assert.equal(get('atlas-export-png').disabled,true);assert.equal(get('atlas-export-cancel').hidden,false);assert.deepEqual(messages,[],'a retired save reply must not announce success in the new context');assert.deepEqual(errors,[]);
  held.shift()();await current;assert.equal(ui.exporting,false);assert.equal(get('atlas-export-png').disabled,false);assert.equal(get('atlas-export-cancel').hidden,true);assert.deepEqual(saved,heldStage==='read'?[next.token]:[owner.token,next.token]);assert.deepEqual(messages,['Atlas-PNG gespeichert.']);
 }finally{for(const release of held.splice(0))release();await Promise.allSettled([old,current].filter(Boolean));}
});

function editableExportFixture(t){
 const f=fixture(t),controls=f.document.createElement('div');
 controls.innerHTML='<section id="atlas-output"></section><button id="atlas-output-open"></button><input id="atlas-export-kind" value="campaign"><div id="atlas-output-editable"></div><div id="atlas-output-image"></div><button id="atlas-output-save-campaign"></button><p id="atlas-output-save-status"></p><button id="atlas-export-png"></button><button id="atlas-export-cancel"></button><p id="atlas-save-status"></p><p id="atlas-output-area"></p><div id="atlas-search-results"></div><input id="atlas-export-size" value="256"><input id="atlas-export-audience" value="gm"><input id="atlas-export-format" value="png"><input id="atlas-export-grid"><input id="atlas-hex-level" value="0"><input id="atlas-export-reference">';
 f.document.body.append(controls);const get=id=>f.document.getElementById(id),messages=[],errors=[],held=[],saved=[],box={x:0,y:0,width:10,height:10},owner={token:'first',campaign:{id:'first'}};
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{root:f.root,svg:f.root,hitVersion:0,previewRequest:0,searchRequest:0,request:0,hitDialog:{close(){}},playback:{stop(){}},reference:{close(){}},projection:{workspace:{floors:[]}},owner,outputRun:null,floorId:'ground',landscape:{context(){}},camera:{view:box,context(){}},flush:async()=>true,opts:{flush:async()=>true,status:s=>messages.push(s)},regionQuery:()=>({box,width:256,height:256,scopeId:null,floorId:'ground',slice:null,roofs:true}),error:e=>errors.push(e.message)});
 f.window.campaign={cancelAtlasRegion:async()=>{},exportCampaign:token=>{saved.push(token);return new Promise(resolve=>held.push(resolve));}};
 const until=async check=>{for(let i=0;i<50&&!check();i++)await settle();assert(check(),'Expected held campaign export');};
 return{...f,ui,get,messages,errors,held,saved,owner,until};
}
for(const sameOwner of [false,true])for(const failedReply of [false,true])test(`a retired editable campaign export cannot block or finish the current export (same owner=${sameOwner}, failed reply=${failedReply})`,async t=>{
 const f=editableExportFixture(t),old=f.ui.saveEditableCampaign().catch(e=>f.errors.push(e.message));let current;
 try{
  await f.until(()=>f.held.length===1);f.ui.activate(sameOwner?f.owner:{token:'second',campaign:{id:'second'}});
  assert.equal(f.get('atlas-output-save-campaign').disabled,false,'new activation retires the old campaign export');assert.equal(f.ui.exportOpen,false);assert.equal(f.get('atlas-output').hidden,true);assert.equal(f.get('atlas-output-open').getAttribute('aria-pressed'),'false');
  current=f.ui.saveEditableCampaign();await f.until(()=>f.held.length===2);
  f.held.shift()(failedReply?{ok:false,error:'Retired save failed'}:{ok:true,value:{cancelled:false}});await old;
  assert.equal(f.get('atlas-output-save-campaign').disabled,true,'the retired finalizer must not unlock the current save');assert.deepEqual(f.messages,[]);assert.deepEqual(f.errors,[]);assert.equal(f.get('atlas-output-save-status').textContent,'Kampagne wird gesichert…');
  f.held.shift()({ok:true,value:{cancelled:false}});await current;assert.equal(f.get('atlas-output-save-campaign').disabled,false);assert.deepEqual(f.saved,['first',sameOwner?'first':'second']);assert.deepEqual(f.messages,['Bearbeitbare Kampagne gesichert.']);
 }finally{for(const release of f.held.splice(0))release({ok:true,value:{cancelled:true}});await Promise.allSettled([old,current].filter(Boolean));}
});
test('an editable campaign export and an image export share one output slot',async t=>{
 const f=editableExportFixture(t);let reads=0;f.window.campaign.atlasRegion=async()=>{reads++;return{ok:false,error:'Concurrent image read'};};
 const saving=f.ui.saveEditableCampaign();try{await f.until(()=>f.held.length===1);await f.ui.exportPNG();assert.equal(reads,0);assert.equal(f.get('atlas-export-png').disabled,true);}finally{for(const release of f.held.splice(0))release({ok:true,value:{cancelled:true}});await saving;}
});
test('an editable campaign export retires before flushing inputs in a new activation',async t=>{
 const f=editableExportFixture(t);let release,flushed=0;f.ui.flush=()=>new Promise(resolve=>release=resolve);f.ui.opts.flush=async()=>{flushed++;return true;};
 const old=f.ui.saveEditableCampaign();f.ui.activate(f.owner);release(true);await old;assert.equal(flushed,0);assert.deepEqual(f.saved,[]);assert.deepEqual(f.errors,[]);
});
test('a current editable campaign export reports failure and releases both output controls',async t=>{
 const f=editableExportFixture(t),saving=f.ui.saveEditableCampaign();await f.until(()=>f.held.length===1);f.held.shift()({ok:false,error:'No disk space'});await saving;
 assert.equal(f.get('atlas-output-save-status').textContent,'Sicherung fehlgeschlagen: No disk space');assert.deepEqual(f.errors,['No disk space']);assert.equal(f.get('atlas-export-png').disabled,false);assert.equal(f.get('atlas-output-save-campaign').disabled,false);
});

test('spatial map and overlay finish their GPU batch before author hits are enabled',async t=>{
 const f=fixture(t),calls=[],spatial={ready:true,
  batch(paint){calls.push('begin');assert.equal(f.canvas.ready,false);paint();assert.equal(f.canvas.ready,false);calls.push('draw');},
  paint(){calls.push('map');},overlay(){calls.push('overlay');},
  point:()=>({x:0,y:0}),hitAt:()=>({data:{id:'mapped'}}),navigationPoint:()=>({x:0,y:0})};
 f.canvas.options.presentation=()=>spatial;f.canvas.options.overlay=()=>{};
 f.canvas.render(root=>root.append(rect('world')));await settle();
 assert.deepEqual(calls,['begin','map','overlay','draw']);assert.equal(f.canvas.ready,true);
 spatial.batch=paint=>{paint();throw Error('GPU frame failed');};
 f.canvas.set({...f.canvas.view,x:10});f.flush();
 assert.equal(f.canvas.ready,false);assert.equal(f.canvas.hitAt({clientX:5,clientY:5}),null);
});

test("spatial presentation shares normal input, scene publication, HUD and pan without a second navigation handler",async t=>{
 const f=fixture(t),calls=[],spatial={ready:true,
  paint:(scene,origin)=>calls.push({kind:'paint',scene,origin}),
  overlay:scene=>calls.push({kind:'overlay',scene}),
  point:()=>({x:17,y:23}),hitAt:(_e,keys)=>({data:{id:'spatial',key:keys[0]}}),
  navigationPoint:e=>({x:f.canvas.view.x+e.clientY*2,y:f.canvas.view.y-e.clientX*2})};
 f.canvas.options.presentation=()=>spatial;
 f.canvas.options.overlay=root=>{root.append(atlasPaint('rect',{width:10,height:10,hud:true,style:{fill:'green'}}));};
 f.canvas.render(root=>root.append(rect('world')));await settle();
 assert.equal(calls[0].scene.commands[0].node.data.id,'world');assert(calls.some(c=>c.kind==='overlay'));
 assert.deepEqual(f.canvas.point({clientX:9,clientY:8}),{x:17,y:23});
 assert.deepEqual(f.canvas.hitAt({clientX:9,clientY:8},['atlasVertex']),{data:{id:'spatial',key:'atlasVertex'}});
 const before=f.canvas.view;f.pointer('pointerdown',100,100);f.pointer('pointermove',120,130);f.pointer('pointerup',120,130);f.flush();
 assert.equal(f.canvas.view.x,before.x-60);assert.equal(f.canvas.view.y,before.y+40);assert.equal(f.changes.length,1);
 spatial.ready=false;assert.equal(f.canvas.ready,false);assert.equal(f.canvas.hitAt({clientX:9,clientY:8}),null);
});


test('initial spatial read and graphics fallback require different confirmed region sources',t=>{
 const f=fixture(t);for(const id of ['atlas-slice-enabled','atlas-roofs','atlas-perception']){const input=f.document.createElement('input');input.id=id;input.checked=false;f.document.body.append(input);}
 const box={x:0,y:0,width:40,height:20},ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{svg:f.root,camera:{view:box,destination:box},scopeId:null,floorId:'ground',landscape:{contours:()=>-1},spatial:{active:false,needsTerrainRaster:false}});
 const first=ui.regionQuery();assert.equal(first.terrainRaster,false,'do not wait for GPU activation to suppress ground work');assert.equal(first.contours,0);ui.loadedRegionQuery=first;assert(ui.geometryCoversView());
 ui.spatial.needsTerrainRaster=true;assert.equal(ui.regionQuery().contours,-1);assert.equal(ui.geometryCoversView(),false,'old groundless region cannot serve fallback');ui.loadedRegionQuery=ui.regionQuery();assert(ui.geometryCoversView());
 ui.spatial.needsTerrainRaster=false;assert.equal(ui.geometryCoversView(),false,'explicit camera retry replaces the fallback source');
});

for(const mode of ['surface','transport-error','source-error','hidden','new-owner','fallback'])test(`normal Atlas bootstrap yields to current object loading: ${mode}`,async t=>{
 const f=fixture(t),status=f.document.createElement('p');status.id='atlas-save-status';f.document.body.append(status);
 const owner={token:'bootstrap',campaign:{id:'world'}},calls=[];let release,reply;
 const source=new Promise(resolve=>reply=resolve),surface=new Promise(resolve=>release=resolve);
 f.window.campaign={atlasTerrainSource:async token=>{assert.equal(token,owner.token);if(mode==='transport-error')throw Error('IPC failed');return source;}};
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{root:f.root,owner,data:null,family:'terrain',layout:{setActive(){}},camera:{view:{x:0,y:0,width:10,height:10}},landscape:{contours:()=>-1},spatial:{needsTerrainRaster:mode==='fallback',openSurface:async(token,box,revision,contours)=>{calls.push('terrain');assert.equal(revision,9);assert.equal(contours,-1);return surface;}},refresh:async()=>calls.push('region'),setFamily:async()=>calls.push('tools')});
 const opening=ui.open();await new Promise(setImmediate);
 if(mode==='hidden')ui.root.hidden=true;if(mode==='new-owner')ui.owner={token:'new'};
 reply(mode==='source-error'?{ok:false,error:'unavailable'}:{ok:true,value:{revision:9}});await new Promise(setImmediate);
 if(mode==='surface'){assert.deepEqual(calls,['terrain']);assert(ui.openingSurface);}
 release(true);await opening;
 assert.deepEqual(calls,mode==='surface'?['terrain','region','tools']:['hidden','new-owner'].includes(mode)?[]:['region','tools']);
 assert.equal(ui.openingSurface??null,null);
});

test('PNG output applies the same subpixel group rule to a retained detailed frame',()=>{
 const room={id:'r',scopeId:'local',floorId:'ground',number:'1',name:'Zollhaus',polygons:[{outer:[{x:0,y:0},{x:12,y:0},{x:12,y:6},{x:0,y:6}],holes:[]}]},
  data={cities:[],bindings:[{id:'b',kind:'dungeon',ownerId:'local',parent:'world',x:0,y:0,angle:0}],workspace:{rooms:[room]},region:{scopeId:'local',floorId:'ground',scopeBounds:{local:{x:0,y:0,width:12,height:6}},frames:{b:{x:0,y:0,angle:0}}},geometry:{floors:[],drawing:{elements:[]}}},
  options={grid:false,level:0,references:false,floorId:'ground',roofs:false};
 const far=atlasRegionPaint(data,[],{x:0,y:0,width:100000,height:100000},1000,new Map(),options);
 assert(!far.children.some(n=>n.data.spatialScope==='local'));
 const near=atlasRegionPaint(data,[],{x:0,y:0,width:12,height:6},120,new Map(),options),face=near.children.flatMap(n=>n.children).find(n=>n.kind==='polygons');
 assert.deepEqual(face.geometry.polygons,room.polygons);assert.equal(data.workspace.rooms[0],room);
});
