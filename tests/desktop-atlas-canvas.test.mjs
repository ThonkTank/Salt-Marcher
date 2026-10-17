import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { parseHTML } from "linkedom";
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas-canvas';export * from './src/app/atlas-canvas-scene';export * from './src/app/campaign-atlas-export';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-canvas-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const { AtlasCanvas, AtlasCanvasScene, atlasPaint, atlasImage } = createRequire(
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
  closePath() {}
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
    { canvas: root, isPointInPath: () => true, isPointInStroke: () => false },
    { get: (o, k) => (k in o ? o[k] : (...args) => calls.push([k, ...args])) },
  );
  window.HTMLCanvasElement.prototype.getContext = () =>
    contextAvailable ? ctx : null;
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
