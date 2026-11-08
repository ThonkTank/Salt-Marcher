import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Graphics } from "pixi.js";
import { EditorController } from "../EditorController";
import { editorBudgets } from "../budgets";
import type {
  AtlasDesktop,
  CommitRequest,
  ProjectInfo,
  ReadPresentationRequest,
  ReadRegionRequest,
  RegionRead,
} from "../bridge";
import {
  EditorDocument,
  HEIGHT_TILE_BYTES,
  SourcesNotReadyError,
  createCoastFixture,
  heightTilesFromControls,
  prepareHeightSampler,
  prepareHeightGrid,
  heightOverviewKeys,
  heightOverviewKey,
  minimumCoarseHeightLevel,
  HEIGHT_SUM_SCALE,
  heightFromScaledSum,
  type Bounds,
  type HeightOverviewTile,
  type HeightTile,
} from "../model";
import { Observation } from "../observation";
import { WorldRenderer } from "./WorldRenderer";
import type {
  RasterBatch,
  RasterBatchResult,
  RasterMessage,
  RasterResult,
  RasterTask,
} from "./raster.worker";
import {
  MAX_RASTER_BATCH_PIXELS,
  MAX_RASTER_BATCH_TILES,
  colour,
  rasterize,
} from "./raster";

const renderedSources = vi.hoisted(() => [] as Uint8Array[]);

// This regression exercises source ownership and transfer, without a GL context.
vi.mock("pixi.js", () => ({
  BufferImageSource: class {
    constructor(options: { resource: Uint8Array }) {
      renderedSources.push(options.resource);
    }
    update() {}
  },
  Container: class {
    addChild() {}
  },
  Graphics: class {
    clear() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    circle() {
      return this;
    }
    stroke() {
      return this;
    }
  },
  Sprite: class {
    position = { set() {} };
    destroy() {}
  },
  Texture: class {},
  WebGLRenderer: class {
    canvas: HTMLCanvasElement | undefined;
    async init(options: { canvas: HTMLCanvasElement }) {
      this.canvas = options.canvas;
    }
    render() {}
    resize() {}
    destroy() {}
  },
}));
vi.mock("pixi.js/unsafe-eval", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  renderedSources.length = 0;
});

it("mirrors coarse Undo/Redo after unrelated fine sources were evicted", () => {
  const mirror = new Map<string, HeightTile>();
  vi.stubGlobal(
    "Worker",
    class {
      postMessage(message: RasterMessage, transfer: ArrayBuffer[] = []) {
        // Real transfer semantics catch accidental detachment of history/store data.
        const received = structuredClone(message, { transfer });
        if (received.kind !== "sources") return;
        if (received.reset) mirror.clear();
        for (const key of received.removed ?? []) mirror.delete(key);
        for (const tile of received.tiles) mirror.set(tile.key, tile);
      }
    },
  );
  const broad: Bounds = [-20_000, -20_000, 20_000, 20_000];
  const detail: Bounds = [-3000, -2000, 3000, 2000];
  const distant = heightTilesFromControls(0, [[2000, 0, 25]])[0];
  const document = new EditorDocument("history-source-transfer");
  document.acceptCoverage(broad, [...createCoastFixture(), distant]);
  const original = document.sampleHeight(320, 0);
  document.beginGesture({ level: 8, radius: 12_000, amount: 100 });
  document.applyPoint([0, 0], 1000);
  const edit = document.finishGesture()!;
  document.acceptPersistence(edit.sequence);
  const lifted = document.sampleHeight(320, 0);
  expect(lifted).toBeGreaterThan(original);

  expect(document.evictConfirmedOutside(detail)).toBeGreaterThan(0);
  expect(document.sourceState(distant.key)).toBe("unknown");
  const world = new WorldRenderer(new Observation());
  world.reset(document);
  world.updatePresentation(
    document.snapshot(detail).tiles,
    [],
    heightOverviewKeys(detail, world.presentationPower()),
    true,
  );
  const rendered = () => prepareHeightSampler([...mirror.values()])(320, 0);
  expect(rendered()).toBeCloseTo(lifted, 10);

  const undone = document.undo()!;
  // This is the old failure: history's full dirty region still has unknown data.
  expect(() => document.snapshot(undone.dirtyBounds[0])).toThrow(
    SourcesNotReadyError,
  );
  world.updateSourcePatches(undone.patches);
  expect(rendered()).toBeCloseTo(original, 10);
  expect(undone.patches.every((patch) => !mirror.has(patch.key))).toBe(true);

  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  expect(rendered()).toBeCloseTo(lifted, 10);
  expect(document.sampleHeight(320, 0)).toBeCloseTo(lifted, 10);
  expect(
    redone.patches.every(
      (patch) => patch.after?.values.byteLength === HEIGHT_TILE_BYTES,
    ),
  ).toBe(true);
  expect(document.sourceState(distant.key)).toBe("unknown");
  expect(document.isReady(redone.dirtyBounds[0])).toBe(false);
});

/** Worker computation is immediate; delivery waits so later input can overtake it. */
class RasterWorker {
  onmessage: ((event: MessageEvent<RasterBatchResult>) => void) | null = null;
  sources = new Map<string, HeightTile>();
  overviews = new Map<string, HeightOverviewTile>();
  completed: RasterBatchResult[] = [];
  batches: RasterBatch[] = [];
  tasks: RasterTask[] = [];

  postMessage(message: RasterMessage, transfer: ArrayBuffer[] = []) {
    const copy = structuredClone(message, { transfer });
    if (copy.kind === "sources") {
      if (copy.reset) {
        this.sources.clear();
        this.overviews.clear();
      }
      for (const key of copy.removed ?? []) this.sources.delete(key);
      for (const tile of copy.tiles) this.sources.set(tile.key, tile);
      for (const key of copy.overviewKeys ?? []) this.overviews.delete(key);
      for (const tile of copy.overviews ?? [])
        this.overviews.set(tile.key, tile);
      return;
    }
    this.batches.push(copy);
    const results = copy.tasks.map((task) => this.render(task));
    this.completed.push({
      kind: "raster-batch-result",
      id: copy.id,
      sessionId: copy.sessionId,
      results,
      cpuMs: results.length,
    });
  }

  private render(copy: RasterTask): RasterResult {
    this.tasks.push(copy);
    const span = copy.size * 2 ** copy.power;
    const key = heightOverviewKey(
      copy.power,
      copy.bounds[0] / span,
      copy.bounds[1] / span,
    );
    const grid = prepareHeightGrid(
      [...this.sources.values()].filter(
        (tile) => tile.level >= minimumCoarseHeightLevel(copy.power),
      ),
    );
    return {
      ...copy,
      kind: "raster-result",
      pixels: rasterize(
        grid(copy.bounds, copy.size, copy.rect),
        copy.bounds,
        copy.size,
        copy.rect,
        this.overviews.get(key)?.values,
      ),
      cpuMs: 1,
      samples: (copy.rect[2] - copy.rect[0]) * (copy.rect[3] - copy.rect[1]),
    };
  }

  deliver(): RasterBatchResult {
    const result = this.completed.shift();
    if (!result) throw new Error("No actual raster result to deliver");
    this.onmessage?.({ data: result } as MessageEvent<RasterBatchResult>);
    return result;
  }

  terminate() {}
}

async function readyRenderer({
  width = 64,
  height = 64,
  x = 256,
  y = 256,
  rendered = true,
} = {}) {
  let worker!: RasterWorker;
  let callback!: FrameRequestCallback;
  vi.stubGlobal(
    "Worker",
    class extends RasterWorker {
      constructor() {
        super();
        worker = this;
      }
    },
  );
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
    callback = next;
    return 1;
  });
  const document = new EditorDocument("render-progress", { empty: true });
  const observation = new Observation(true);
  const world = new WorldRenderer(observation);
  world.width = width;
  world.height = height;
  world.grid = false;
  await world.init({} as HTMLCanvasElement);
  world.reset(document);
  world.moveCamera({ x, y, scale: 0.25 });
  world.updatePresentation(
    [],
    [],
    heightOverviewKeys(world.sourceBounds(), 2),
    true,
  );
  world.refresh();
  const frame = () => callback(performance.now());
  if (rendered) {
    for (
      let step = 0;
      step < 100 && !world.regionExact(world.bounds());
      step++
    ) {
      if (worker.completed.length) worker.deliver();
      frame();
    }
    expect(world.regionExact(world.bounds())).toBe(true);
  }
  const change = (
    point: [number, number],
    brush = { level: 0, radius: 20, amount: 400 },
  ) => {
    document.beginGesture(brush);
    const update = document.applyPoint(point, 1000)!;
    world.updateSourcePatches(update.patches);
    world.invalidate(update.bounds);
    document.finishGesture();
    return update;
  };
  return { document, observation, world, worker, frame, change };
}

it("confirms a current edited region while another part of its tile still renders", async () => {
  const { world, worker, frame, change, document } = await readyRenderer();
  const first = change([160, 160]);
  frame();
  const second = change([352, 352]);
  expect(world.regionExact(first.bounds)).toBe(false);
  worker.deliver();
  frame();
  expect(world.regionExact(first.bounds)).toBe(true);
  expect(world.regionExact(second.bounds)).toBe(false);
  const offset = (39 * 128 + 39) * 4;
  expect([...renderedSources[0].slice(offset, offset + 4)]).toEqual([
    ...colour(document.sampleHeight(158, 158)),
    255,
  ]);
  worker.deliver();
  frame();
  expect(world.regionExact(second.bounds)).toBe(true);
  expect(world.state().submittedViewGeneration).toBe(
    world.state().viewGeneration,
  );
});

it("requires an actual local submission, not only source readiness or uploaded pixels", async () => {
  const { world, worker, frame } = await readyRenderer({ rendered: false });
  const area: Bounds = [200, 200, 240, 240];
  expect(world.isPresentationReady(area)).toBe(true);
  expect(world.regionDisplayed(area, false)).toBe(false);
  expect(world.regionDisplayed(area)).toBe(false);
  frame();
  const render = vi
    .spyOn(world.renderer, "render")
    .mockImplementationOnce(() => {
      // The upload is complete, but this call has not submitted it yet.
      expect(world.regionExact(area)).toBe(true);
      expect(world.regionDisplayed(area, false)).toBe(false);
      expect(world.regionDisplayed(area)).toBe(false);
    });
  worker.deliver();
  expect(render).toHaveBeenCalledOnce();
  expect(world.regionDisplayed(area, false)).toBe(true);
  expect(world.regionDisplayed(area)).toBe(true);
  expect(world.submission()).toEqual({
    frame: world.state().lastSubmittedFrame,
    viewGeneration: world.state().viewGeneration,
  });
});

it("publishes arriving terrain before another RAF without admitting a dose or dispatching more work", async () => {
  const { world, worker, frame, change, observation, document } =
    await readyRenderer();
  const update = change([200, 200]);
  frame();
  const advance = vi.fn(() => change([200, 200]));
  world.advanceFrame = advance;
  const priorSubmission = world.submission().frame;
  const priorBatches = worker.batches.length;
  const priorRevision = document.revision;
  worker.deliver();
  expect(world.regionDisplayed(update.bounds)).toBe(true);
  expect(world.submission().frame).toBeGreaterThan(priorSubmission);
  expect(
    observation
      .read()
      .filter((event) => event.kind === "submit")
      .at(-1)?.exactRevision,
  ).toBe(priorRevision);
  expect(advance).not.toHaveBeenCalled();
  expect(document.revision).toBe(priorRevision);
  expect(worker.batches).toHaveLength(priorBatches);
  frame();
  expect(advance).toHaveBeenCalledOnce();
  expect(document.revision).toBe(priorRevision + 1);
  expect(worker.batches).toHaveLength(priorBatches + 1);
});

it("requires a new submitted view after camera changes, resize and session replacement", async () => {
  const { world, frame } = await readyRenderer();
  const area: Bounds = [200, 200, 240, 240];
  const first = world.submission();
  world.moveCamera({ ...world.camera, x: world.camera.x + 4 });
  world.refresh();
  expect(world.regionExact(area)).toBe(true);
  expect(world.submission()).toEqual(first);
  expect(world.regionDisplayed(area, false)).toBe(false);
  frame();
  expect(world.regionDisplayed(area)).toBe(true);
  expect(world.submission().frame).toBeGreaterThan(first.frame);
  world.resize(68, 68);
  world.refresh();
  expect(world.regionDisplayed(area, false)).toBe(false);
  frame();
  expect(world.regionDisplayed(area)).toBe(true);
  world.reset(new EditorDocument("replacement", { empty: true }));
  expect(world.submission()).toEqual({ frame: 0, viewGeneration: -1 });
  expect(world.regionDisplayed(area, false)).toBe(false);
});

it("marks a still-unprepared view as loading even without a pointer or terrain tiles", async () => {
  const { world, frame } = await readyRenderer();
  const lines = vi.spyOn(Graphics.prototype, "lineTo");
  const camera = { ...world.camera };
  world.moveCamera({ ...camera, x: 50_000 });
  frame();
  expect(world.cursor).toBeNull();
  expect(lines).toHaveBeenCalled();
  lines.mockClear();
  world.moveCamera(camera);
  world.refresh();
  frame();
  expect(lines).not.toHaveBeenCalled();
});

it("preserves a readiness overlay redraw requested by a submit callback", async () => {
  const { world, frame } = await readyRenderer();
  const render = vi.spyOn(world.renderer, "render");
  world.onSubmit = () => {
    world.onSubmit = () => {};
    world.redraw();
  };
  world.redraw();
  frame();
  expect(render).toHaveBeenCalledTimes(1);
  frame();
  expect(render).toHaveBeenCalledTimes(2);
  frame();
  expect(render).toHaveBeenCalledTimes(2);
});

it("keeps a drawn foundation during its own pending edit without confirming the new content", async () => {
  const { world, worker, frame, change } = await readyRenderer();
  const update = change([200, 200]);
  expect(world.regionDisplayed(update.bounds, false)).toBe(true);
  expect(world.regionDisplayed(update.bounds)).toBe(false);
  frame();
  expect(world.regionDisplayed(update.bounds)).toBe(false);
  worker.deliver();
  expect(world.regionDisplayed(update.bounds)).toBe(true);
});

it("checks the entire visible swept area without waiting for unrelated screen tiles", async () => {
  const { world, worker, frame } = await readyRenderer({
    width: 320,
    x: 768,
    rendered: false,
  });
  const left: Bounds = [240, 240, 272, 272];
  const right: Bounds = [1264, 240, 1296, 272];
  world.setPriorityAreas(left);
  frame();
  worker.deliver();
  world.setPriorityAreas(right);
  frame();
  expect(world.regionDisplayed(left)).toBe(true);
  expect(world.regionDisplayed(right, false)).toBe(false);
  worker.deliver();
  frame();
  expect(world.regionDisplayed(left)).toBe(true);
  expect(world.regionDisplayed(right)).toBe(true);
  expect(world.regionExact(world.bounds())).toBe(false);
  // Both endpoints are drawn; the unpainted middle still prohibits this sweep.
  expect(world.regionDisplayed([240, 240, 1296, 272], false)).toBe(false);
});

it("does not require offscreen brush or halo pixels even inside a partially visible tile", async () => {
  const { world } = await readyRenderer();
  const offscreen: Bounds = [400, 160, 420, 180];
  world.invalidate(offscreen);
  expect(world.regionExact([160, 160, 420, 180])).toBe(false);
  expect(world.regionDisplayed([160, 160, 420, 180])).toBe(true);
  expect(world.regionDisplayed(offscreen)).toBe(true);
});

it("loads the current local focus before unrelated cold tiles without queueing old focus areas", async () => {
  const { world, worker, frame } = await readyRenderer({
    width: 320,
    height: 320,
    x: 0,
    y: 0,
    rendered: false,
  });
  const focus: Bounds = [560, 560, 600, 600];
  world.setPriorityAreas([-600, -600, -560, -560]);
  world.setPriorityAreas(focus);
  frame();
  expect(worker.batches[0].tasks.map((task) => task.key)).toEqual(["2:1:1"]);
  expect(worker.batches[0].tasks[0].rect).toEqual([0, 0, 128, 128]);
  expect(world.regionDisplayed(focus, false)).toBe(false);
  worker.deliver();
  frame();
  expect(world.regionDisplayed(focus)).toBe(true);
  expect(world.regionExact(world.bounds())).toBe(false);
});

it("returns an accepted local edit before loading a newly requested cold focus", async () => {
  const { world, worker, frame, change } = await readyRenderer({
    width: 320,
    height: 320,
    x: 0,
    y: 0,
    rendered: false,
  });
  const first: Bounds = [-600, -600, -560, -560];
  const next: Bounds = [560, 560, 600, 600];
  world.setPriorityAreas(first);
  frame();
  worker.deliver();
  let changed: Bounds | null = null;
  world.advanceFrame = () => {
    changed = change([-580, -580]).bounds;
    world.setPriorityAreas(next, changed);
    world.advanceFrame = () => {};
  };
  frame();
  expect(world.regionDisplayed(first, false)).toBe(true);
  expect(world.regionDisplayed(changed!)).toBe(false);
  expect(worker.batches[1].tasks.map((task) => task.key)).toEqual(["2:-2:-2"]);
  worker.deliver();
  frame();
  expect(world.regionDisplayed(changed!)).toBe(true);
  expect(world.regionDisplayed(next, false)).toBe(false);
  expect(worker.batches[2].tasks.map((task) => task.key)).toEqual(["2:1:1"]);
});

it("continues loading the rest of the view during sustained local edits", async () => {
  const { world, worker, frame, change, observation } = await readyRenderer({
    width: 320,
    height: 320,
    x: 0,
    y: 0,
    rendered: false,
  });
  const focus: Bounds = [-600, -600, -560, -560];
  let previous: Bounds | null = null;
  let accepted = 0;
  world.setPriorityAreas(focus);
  world.advanceFrame = () => {
    if (!world.regionDisplayed(previous ?? focus)) return;
    previous = change([-580, -580]).bounds;
    world.setPriorityAreas(focus, previous);
    accepted++;
  };
  frame();
  for (let step = 0; step < 20; step++) {
    if (worker.completed.length) worker.deliver();
    frame();
  }
  expect(accepted).toBeGreaterThan(4);
  expect(
    observation
      .read()
      .some(
        (event) => event.kind === "raster-upload" && event.key !== "2:-2:-2",
      ),
  ).toBe(true);
});

it("finishes a large brush batch without main-thread redispatch and coalesces newer inputs", async () => {
  const { world, worker, frame, change, document } = await readyRenderer({
    width: 320,
    height: 320,
    x: -800,
    y: -300,
  });
  // Initial full tiles must also obey the total pixel cap, not only tile count.
  expect(worker.batches[0].tasks).toHaveLength(1);
  expect(worker.batches.some((batch) => batch.tasks.length === 8)).toBe(true);
  const before = worker.batches.length;
  const brush = { level: 3, radius: 512, amount: 40 };
  const first = change([-800, -300], brush);
  frame();
  const firstSample = prepareHeightSampler(
    document.snapshot(world.sourceBounds()),
  );
  const batch = worker.batches.at(-1)!;
  expect(batch.tasks).toHaveLength(9);
  expect(
    batch.tasks.reduce(
      (sum, task) =>
        sum + (task.rect[2] - task.rect[0]) * (task.rect[3] - task.rect[1]),
      0,
    ),
  ).toBe(81200);
  // All nine real computations finish without returning control to the main
  // renderer. Withholding delivery models the previously observed 42 ms gap.
  expect(worker.completed).toHaveLength(1);
  expect(worker.completed[0].results).toHaveLength(9);
  change([-520, -300], brush);
  change([-240, -300], brush);
  expect(worker.batches).toHaveLength(before + 1);
  for (const result of worker.completed[0].results) {
    const x = result.bounds[0] + (result.rect[0] + 0.5) * 4;
    const y = result.bounds[1] + (result.rect[1] + 0.5) * 4;
    expect([...result.pixels.slice(0, 4)]).toEqual([
      ...colour(firstSample(x, y)),
      255,
    ]);
  }
  worker.deliver();
  frame();
  expect(world.regionExact(first.bounds)).toBe(false);
  expect(worker.batches).toHaveLength(before + 2);
  worker.deliver();
  frame();
  expect(world.regionExact(world.bounds())).toBe(true);
  expect(worker.batches).toHaveLength(before + 2);
  for (const batch of worker.batches) {
    expect(batch.tasks.length).toBeLessThanOrEqual(MAX_RASTER_BATCH_TILES);
    expect(
      batch.tasks.reduce(
        (sum, task) =>
          sum + (task.rect[2] - task.rect[0]) * (task.rect[3] - task.rect[1]),
        0,
      ),
    ).toBeLessThanOrEqual(MAX_RASTER_BATCH_PIXELS);
  }
});

it("paints an older overlapping result completely without confirming the current region", async () => {
  const { world, worker, frame, change, observation, document } =
    await readyRenderer();
  const first = change([160, 160]);
  const firstSample = prepareHeightSampler(
    document.snapshot(world.sourceBounds()),
  );
  frame();
  change([172, 160]);
  const result = worker.deliver().results[0];
  frame();
  const upload = observation
    .read()
    .filter((event) => event.kind === "raster-upload")
    .at(-1)!;
  expect(upload.acceptedPixels).toBe(result.samples);
  expect(upload.supersededPixels).toBe(0);
  expect(upload.paintedRevision).toBe(1);
  expect(upload.requiredRevision).toBe(2);
  const offset = (39 * 128 + 39) * 4;
  expect([...renderedSources[0].slice(offset, offset + 4)]).toEqual([
    ...colour(firstSample(158, 158)),
    255,
  ]);
  expect(world.regionCoverage(first.bounds, 1)).toEqual({
    minPaintedRevision: 1,
    maxPaintedRevision: 1,
  });
  expect(world.regionCoverage(first.bounds, 2)).toBeNull();
  expect(world.regionExact(first.bounds)).toBe(false);
  expect(world.state().submittedRevision).toBe(0);
  expect(
    observation
      .read()
      .filter((event) => event.kind === "submit")
      .at(-1)!.exactRevision,
  ).toBe(-1);
  worker.deliver();
  frame();
  expect(world.regionExact(first.bounds)).toBe(true);
  expect(world.state().submittedRevision).toBe(2);
  expect([...renderedSources[0].slice(offset, offset + 4)]).toEqual([
    ...colour(document.sampleHeight(158, 158)),
    255,
  ]);
});

it("does not call mixed tile prefixes a current exact region", async () => {
  const { world, worker, frame, change, observation } = await readyRenderer({
    width: 128,
    x: 0,
  });
  const first = change([0, 160]);
  frame();
  expect(worker.completed[0].results).toHaveLength(2);
  change([4, 160]);
  worker.deliver();
  frame();
  expect(world.regionCoverage(first.bounds, 1)).toEqual({
    minPaintedRevision: 1,
    maxPaintedRevision: 1,
  });
  // Model the real result CPU cap: one tile uploads on arrival, one next RAF.
  let now = performance.now();
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const originalEvent = observation.event.bind(observation);
  const events = vi
    .spyOn(observation, "event")
    .mockImplementation((kind, details) => {
      originalEvent(kind, details);
      if (kind === "raster-upload") now += 3;
    });
  const batch = worker.deliver();
  // Another reply before RAF cannot replenish the same result CPU budget.
  worker.onmessage!({ data: batch } as MessageEvent<RasterBatchResult>);
  expect(world.regionCoverage(first.bounds, 1)).toEqual({
    minPaintedRevision: 1,
    maxPaintedRevision: 2,
  });
  expect(world.regionCoverage(first.bounds, 2)).toBeNull();
  expect(world.regionExact(first.bounds)).toBe(false);
  expect(world.state().submittedRevision).toBe(0);
  expect(world.frameCpuMax).toBeGreaterThanOrEqual(3);
  frame();
  events.mockRestore();
  clock.mockRestore();
  expect(world.regionExact(first.bounds)).toBe(true);
  expect(world.regionCoverage(first.bounds, 2)).toEqual({
    minPaintedRevision: 2,
    maxPaintedRevision: 2,
  });
  expect(
    observation
      .read()
      .filter((event) => event.kind === "frame")
      .at(-1)?.cpuMs,
  ).toBeGreaterThanOrEqual(6);
});

it("keeps painted execution revisions monotone through Undo, Redo and late duplicate replies", async () => {
  const { world, worker, frame, change, document, observation } =
    await readyRenderer();
  const first = change([160, 160]);
  const firstSample = prepareHeightSampler(
    document.snapshot(world.sourceBounds()),
  );
  frame();
  change([172, 160]);
  const undone = document.undo()!;
  world.updateSourcePatches(undone.patches);
  for (const bounds of undone.dirtyBounds) world.invalidate(bounds);
  const older = worker.deliver();
  frame();
  expect(world.regionCoverage(first.bounds, 1)).not.toBeNull();
  expect(world.regionExact(first.bounds)).toBe(false);
  const undoResult = worker.deliver();
  frame();
  expect(world.state().submittedRevision).toBe(3);
  const offset = (39 * 128 + 39) * 4;
  const paintedUndo = [...renderedSources[0].slice(offset, offset + 4)];
  expect(paintedUndo).toEqual([...colour(firstSample(158, 158)), 255]);
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  for (const bounds of redone.dirtyBounds) world.invalidate(bounds);
  frame();
  worker.onmessage!({ data: older } as MessageEvent<RasterBatchResult>);
  worker.onmessage!({ data: undoResult } as MessageEvent<RasterBatchResult>);
  worker.onmessage!({
    data: { ...older, sessionId: "foreign-session" },
  } as MessageEvent<RasterBatchResult>);
  frame();
  expect([...renderedSources[0].slice(offset, offset + 4)]).toEqual(
    paintedUndo,
  );
  expect(world.regionCoverage(first.bounds, 3)).toEqual({
    minPaintedRevision: 3,
    maxPaintedRevision: 3,
  });
  expect(world.regionCoverage(first.bounds, 4)).toBeNull();
  expect(world.regionExact(first.bounds)).toBe(false);
  expect(world.state().submittedRevision).toBe(3);
  worker.deliver();
  frame();
  expect(world.regionExact(first.bounds)).toBe(true);
  expect(world.state().submittedRevision).toBe(4);
  expect([...renderedSources[0].slice(offset, offset + 4)]).toEqual([
    ...colour(document.sampleHeight(158, 158)),
    255,
  ]);
  expect(
    observation
      .read()
      .filter((event) => event.kind === "raster-upload")
      .map((event) => event.paintedRevision),
  ).toEqual([0, 1, 3, 4]);
});

it("keeps drop-render negative control and recovers through the same real raster path", async () => {
  const { world, worker, frame, change } = await readyRenderer();
  world.fault = "drop-render";
  const update = change([160, 160]);
  frame();
  worker.deliver();
  frame();
  expect(world.regionExact(update.bounds)).toBe(false);
  world.fault = "none";
  frame();
  expect(world.regionExact(update.bounds)).toBe(true);
});

it("keeps one upload budget across delayed arrivals and publishes them without another RAF", async () => {
  const { world, worker, frame, observation } = await readyRenderer({
    width: 1152,
    height: 896,
    rendered: false,
  });
  const timers: (() => void)[] = [];
  vi.stubGlobal("window", {
    setTimeout: (callback: () => void) => timers.push(callback),
  });
  // Isolate the byte limit from the independent CPU limit in this test.
  vi.spyOn(performance, "now").mockReturnValue(1000);
  world.fault = "delay-render";
  world.invalidate(world.bounds());
  frame();
  for (let step = 0; step < 100 && worker.completed.length; step++) {
    worker.deliver();
    frame();
  }
  const totalTiles = worker.tasks.length;
  const tileBytes = 128 * 128 * 4;
  expect(totalTiles * tileBytes).toBeGreaterThan(
    editorBudgets.uploadBytesPerFrame,
  );
  expect(world.regionDisplayed(world.bounds(), false)).toBe(false);
  const advance = vi.fn();
  world.advanceFrame = advance;
  const before = world.submission().frame;
  for (const callback of timers) callback();
  const uploads = () =>
    observation.read().filter((event) => event.kind === "raster-upload");
  expect(uploads().length * tileBytes).toBe(editorBudgets.uploadBytesPerFrame);
  expect(world.submission().frame).toBeGreaterThan(before);
  expect(world.regionDisplayed(world.bounds())).toBe(false);
  expect(advance).not.toHaveBeenCalled();
  frame();
  expect(advance).toHaveBeenCalledOnce();
  expect(uploads()).toHaveLength(totalTiles);
  expect(world.regionDisplayed(world.bounds())).toBe(true);
});

it("does not publish an arriving result during a pointerup-render fault's active gesture", async () => {
  const { world, worker, frame, change, document } = await readyRenderer();
  world.fault = "pointerup-render";
  const update = change([200, 200]);
  frame();
  document.beginGesture({ level: 0, radius: 20, amount: 400 });
  worker.deliver();
  expect(world.regionDisplayed(update.bounds)).toBe(false);
  document.finishGesture();
  frame();
  expect(world.regionDisplayed(update.bounds)).toBe(true);
});

it("keeps the same certified source area during a small camera move", async () => {
  const { world, frame } = await readyRenderer();
  const bounds = world.sourceBounds();
  world.moveCamera({ ...world.camera, x: world.camera.x + 4 });
  expect(world.sourceBounds()).toEqual(bounds);
  expect(world.isPresentationReady(bounds)).toBe(true);
  expect(world.regionExact(world.bounds())).toBe(false);
  world.refresh();
  frame();
  expect(world.regionExact(world.bounds())).toBe(true);
});

it("keeps result progress and the main loop after a slow or failed input hook", async () => {
  const { world, worker, frame, change } = await readyRenderer();
  const update = change([160, 160]);
  world.onError = vi.fn();
  world.advanceFrame = vi.fn().mockImplementationOnce(() => {
    throw new Error("input failed");
  });
  frame();
  expect(world.onError).toHaveBeenCalledOnce();
  worker.deliver();
  let now = performance.now();
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  // Input work exceeding the separate 2 ms result budget must not suppress
  // every completed upload while the pointer keeps moving.
  world.advanceFrame = () => {
    now += 5;
  };
  frame();
  expect(world.regionExact(update.bounds)).toBe(true);
  clock.mockRestore();
});

async function readyController(
  sourceTiles = 0,
  options: {
    diagnostics?: boolean;
    ready?: boolean;
    readFailure?: boolean;
    width?: number;
    height?: number;
  } = {},
) {
  let worker!: RasterWorker;
  let nextFrame = 0;
  let now = 1000;
  let width = options.width ?? 64;
  let height = options.height ?? 64;
  let resized!: () => void;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal("HTMLInputElement", class {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "Worker",
    class extends RasterWorker {
      constructor(url: URL) {
        super();
        if (url.pathname.endsWith("/raster.worker.ts")) worker = this;
      }
      postMessage(message: RasterMessage, transfer: ArrayBuffer[] = []) {
        if ("kind" in message) super.postMessage(message, transfer);
      }
    },
  );
  class Canvas extends EventTarget {
    getBoundingClientRect() {
      return { left: 0, top: 0, width, height };
    }
    focus() {}
    setPointerCapture() {}
  }
  const canvas = new Canvas();
  const info: ProjectInfo = {
    sessionId: "shared-frame",
    projectId: "frame-test",
    format: 24,
    title: "Frame test",
    sequence: 0,
    savedSequence: 0,
    path: null,
    activeLevels: [],
    sourceTiles,
  };
  const bridge = {
    diagnostics: options.diagnostics ?? true,
    status: async () => info,
    readPresentation: vi.fn(async (request: ReadPresentationRequest) => ({
      ...request,
      sequence: info.sequence,
      tiles: [],
      overviews: [],
      overviewKeys: heightOverviewKeys(request.bounds, request.power),
    })),
    readRegion: vi.fn(
      async (request: ReadRegionRequest): Promise<RegionRead> => ({
        ...request,
        sequence: info.sequence,
        tiles: [],
      }),
    ),
    commit: vi.fn(async (request: CommitRequest) => {
      info.sequence = request.sequence;
      return {
        sessionId: request.sessionId,
        sequence: request.sequence,
        transactionId: request.transactionId,
      };
    }),
    newProject: vi.fn(),
    openProject: vi.fn(),
    saveProject: vi.fn(),
    metrics: vi.fn(),
  } satisfies AtlasDesktop;
  const controller = new EditorController(
    canvas as unknown as HTMLCanvasElement,
    bridge,
  );
  if (options.readFailure)
    bridge.readPresentation.mockRejectedValueOnce(
      new Error("Lokaler Lesefehler"),
    );
  const frame = (elapsedMs = 16) => {
    now += elapsedMs;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(performance.now());
  };
  const drainView = async () => {
    for (let step = 0; step < 100; step++) {
      await Promise.resolve();
      if (worker.completed.length) worker.deliver();
      frame();
      if (
        !controller.state.loading &&
        controller.world.regionExact(controller.world.bounds())
      )
        return;
    }
    throw new Error("Actual raster view did not finish");
  };
  const pointer = (type: string, x = 32, y = 32, at = now) => {
    const event = new Event(type);
    Object.assign(event, {
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      getCoalescedEvents: () => [],
    });
    Object.defineProperty(event, "timeStamp", { value: at });
    canvas.dispatchEvent(event);
  };
  await controller.init();
  controller.setGrid(false);
  if (options.ready !== false) await drainView();
  const advance = (elapsedMs: number) => {
    now += elapsedMs;
  };
  const resize = (nextWidth: number, nextHeight = height) => {
    width = nextWidth;
    height = nextHeight;
    resized();
  };
  return {
    controller,
    bridge,
    worker,
    callbacks,
    frame,
    pointer,
    drainView,
    advance,
    resize,
  };
}

it("keeps a short click and prevents invisible impulses from stacking across gestures", async () => {
  const { controller, bridge, worker, frame, pointer } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  expect(controller.observe().document!.revision).toBe(1);
  pointer("pointerup", 20, 20);
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  expect(controller.observe().document!.revision).toBe(1);
  await Promise.resolve();
  expect(bridge.commit).toHaveBeenCalledOnce();
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(1);
  expect(intervals[0]).toMatchObject({
    cause: "press",
    nominalDose: true,
    acceptedElapsedMs: 1000 / 60,
    rawElapsedMs: 0,
  });
  expect(intervals[0].fromAt).toBe(intervals[0].toAt);
  frame();
  worker.deliver();
  frame();
  for (let step = 0; step < 3; step++) frame(50);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-submit"),
  ).toHaveLength(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "edit-submit")
      .map((event) => event.input),
  ).toEqual([1, 2]);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "noop")
      .map((event) => event.input),
  ).toEqual([3, 4]);
  controller.destroy();
});

it("ends without evaluating an unaccepted queued path", async () => {
  const { controller, frame, pointer } = await readyController();
  pointer("pointerdown", 20, 20);
  pointer("pointermove", 30_000_000, 20);
  pointer("pointerup", 30_000_000, 20);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(1);
  frame(1000);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  controller.destroy();
});

it("deepens while held only after each actual current frame, without synthetic pointer inputs or repeated UI state", async () => {
  const { controller, worker, frame, pointer, drainView } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  const pressHeight = controller.observe([[-48, -48]]).samples[0]!;
  controller.onChange = vi.fn();
  for (let step = 0; step < 8; step++) {
    if (worker.completed.length) worker.deliver();
    frame(16);
  }
  expect(controller.onChange).not.toHaveBeenCalled();
  expect(controller.observe([[-48, -48]]).samples[0]).toBeGreaterThan(
    pressHeight,
  );
  const events = controller.observation.read();
  const intervals = events.filter((event) => event.kind === "brush-interval");
  expect(intervals.length).toBeGreaterThanOrEqual(6);
  expect(
    intervals
      .slice(1)
      .every(
        (event) =>
          event.cause === "hold" &&
          event.acceptedElapsedMs === 16 &&
          (event.inputIds as number[]).length === 0,
      ),
  ).toBe(true);
  expect(
    events.filter(
      (event) => event.kind === "input" && event.inputKind === "edit",
    ),
  ).toHaveLength(1);
  for (let index = 1; index < intervals.length; index++) {
    const previous = events.findIndex(
      (event) =>
        event.kind === "brush-submit" &&
        event.intervalId === intervals[index - 1].intervalId,
    );
    expect(previous).toBeGreaterThan(-1);
    expect(previous).toBeLessThan(events.indexOf(intervals[index]));
  }
  pointer("pointerup", 20, 20);
  const revision = controller.observe().document!.revision;
  await drainView();
  expect(controller.observe().document!.revision).toBe(revision);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(intervals.length);
  controller.undo();
  await drainView();
  expect(controller.observe([[-48, -48]]).samples[0]).toBeCloseTo(-100, 10);
  controller.destroy();
});

it("caps a stalled frame once and discards late movement without restoring an older anchor", async () => {
  const { controller, worker, frame, pointer } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  const oldAt = Number(
    controller.observation.read().find((event) => event.kind === "brush-start")!
      .inputAt,
  );
  frame(16);
  worker.deliver();
  frame(1000);
  let intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(2);
  expect(intervals[1]).toMatchObject({
    acceptedElapsedMs: 50,
    rawElapsedMs: 1000,
  });
  expect(Number(intervals[1].toAt) - Number(intervals[1].fromAt)).toBe(50);
  expect(
    controller.observation
      .read()
      .some(
        (event) =>
          event.kind === "brush-discard" &&
          event.reason === "cap" &&
          Number(event.toAt) - Number(event.fromAt) === 950,
      ),
  ).toBe(true);
  // A fresh position is tracked during feedback wait; an older event cannot undo it.
  pointer("pointermove", 44, 20);
  frame();
  pointer("pointermove", 10, 20, oldAt);
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(2);
  worker.deliver();
  frame();
  intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals.at(-1)).toMatchObject({
    from: [48, -48],
    to: [48, -48],
    acceptedElapsedMs: 16,
  });
  // The same late event after result receipt is rejected by the consumed window.
  pointer("pointermove", 10, 20, oldAt);
  worker.deliver();
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(3);
  expect(
    controller.observation
      .read()
      .some(
        (event) =>
          event.kind === "noop" &&
          event.reason === "stale" &&
          event.accepted === false,
      ),
  ).toBe(true);
  pointer("pointermove", 52, 20);
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval")
      .at(-1),
  ).toMatchObject({ from: [48, -48], to: [80, -48], acceptedElapsedMs: 16 });
  pointer("pointerup");
  controller.destroy();
});

it("accepts at most one bounded dose from many queued moves", async () => {
  const { controller, worker, frame, pointer } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  frame();
  for (let x = 21; x <= 40; x++) pointer("pointermove", x, 20);
  worker.deliver();
  frame(500);
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(2);
  expect(intervals[1]).toMatchObject({
    from: [32, -48],
    to: [32, -48],
    acceptedElapsedMs: 50,
  });
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "noop" && event.reason === "coalesced"),
  ).toHaveLength(19);
  pointer("pointerup");
  controller.destroy();
});

it("ends obsolete feedback only after navigating completely away, then waits for the new displayed basis", async () => {
  const { controller, frame, pointer, drainView } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  controller.goTo(new Event("navigate"), 4, 0, 0.25);
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .some((event) => event.kind === "brush-feedback-obsolete"),
  ).toBe(false);
  controller.goTo(new Event("navigate"), 10_000, 0, 0.25);
  pointer("pointerdown", 20, 20);
  expect(controller.observe().document!.revision).toBe(1);
  const obsolete = controller.observation
    .read()
    .filter((event) => event.kind === "brush-feedback-obsolete");
  expect(obsolete).toHaveLength(1);
  expect(obsolete[0]).toMatchObject({
    intervalId: 1,
    gestureId: 1,
    reason: "outside-view",
  });
  pointer("pointerup", 20, 20);
  await drainView();
  pointer("pointerdown", 20, 20);
  expect(controller.observe().document!.revision).toBe(2);
  pointer("pointerup", 20, 20);
  frame();
  controller.destroy();
});

it("releases offscreen feedback on resize without accepting the not-yet-drawn view", async () => {
  const { controller, pointer, resize, drainView } = await readyController();
  controller.setBrush(8, 400);
  pointer("pointerdown", 2, 32);
  pointer("pointerup", 2, 32);
  resize(8);
  pointer("pointerdown", 4, 32);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-feedback-obsolete"),
  ).toHaveLength(1);
  pointer("pointerup", 4, 32);
  await drainView();
  pointer("pointerdown", 4, 32);
  expect(controller.observe().document!.revision).toBe(2);
  pointer("pointerup", 4, 32);
  controller.destroy();
});

it.each(["pointerup", "cancel", "blur", "visibility", "escape", "destroy"])(
  "never applies a deferred source impulse after %s",
  async (ending) => {
    const { controller, bridge, frame, pointer, drainView, advance } =
      await readyController(1);
    controller.goTo(new Event("navigate"), 10_000, 0, 1 / 64);
    await drainView();
    controller.setBrush(8, 400);
    let resume!: (reply: RegionRead) => void;
    bridge.readRegion.mockImplementationOnce(
      () =>
        new Promise<RegionRead>((resolve) => {
          resume = resolve;
        }),
    );
    pointer("pointerdown");
    expect(controller.observe().gesture).toBeNull();
    expect(controller.observe().document!.revision).toBe(0);
    frame();
    for (let step = 0; step < 5; step++) await Promise.resolve();
    advance(200);
    if (ending === "pointerup") pointer("pointerup");
    else if (ending === "cancel") pointer("pointercancel");
    else if (ending === "blur") window.dispatchEvent(new Event("blur"));
    else if (ending === "visibility") {
      Object.assign(document, { visibilityState: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    } else if (ending === "escape") {
      const event = new Event("keydown");
      Object.assign(event, { key: "Escape" });
      window.dispatchEvent(event);
    } else controller.destroy();
    expect(controller.observe().gesture).toBeNull();
    const request = bridge.readRegion.mock.calls.at(-1)![0];
    resume({ ...request, sequence: 0, tiles: [] });
    for (let step = 0; step < 5; step++) await Promise.resolve();
    frame(500);
    expect(controller.observe().document!.revision).toBe(0);
    expect(bridge.commit).not.toHaveBeenCalled();
    expect(
      controller.observation
        .read()
        .some((event) => event.kind === "brush-interval"),
    ).toBe(false);
    if (ending !== "destroy") controller.destroy();
  },
);

it("never resumes a held early press; release and a new press are required after sources arrive", async () => {
  const { controller, bridge, worker, frame, pointer, drainView, advance } =
    await readyController(1);
  controller.goTo(new Event("navigate"), 10_000, 0, 1 / 64);
  await drainView();
  controller.setBrush(8, 400);
  let resume!: (reply: RegionRead) => void;
  bridge.readRegion.mockImplementationOnce(
    () =>
      new Promise<RegionRead>((resolve) => {
        resume = resolve;
      }),
  );
  pointer("pointerdown");
  frame(200);
  for (let step = 0; step < 5; step++) await Promise.resolve();
  advance(500);
  const request = bridge.readRegion.mock.calls.at(-1)![0];
  resume({ ...request, sequence: 0, tiles: [] });
  for (let step = 0; step < 5; step++) await Promise.resolve();
  expect(controller.observe().document!.revision).toBe(0);
  frame();
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(0);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.state.needsPress).toBe(true);
  expect(controller.state.message).toBe(
    "Zum Bearbeiten loslassen und erneut drücken",
  );
  pointer("pointerdown");
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(0);
  pointer("pointermove", 36, 32);
  frame(200);
  expect(controller.observe().document!.revision).toBe(0);
  expect(bridge.commit).not.toHaveBeenCalled();
  pointer("pointerup");
  pointer("pointerdown");
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  expect(
    controller.observation
      .read()
      .find((event) => event.kind === "brush-interval"),
  ).toMatchObject({
    cause: "press",
    acceptedElapsedMs: 1000 / 60,
    rawElapsedMs: 0,
  });
  pointer("pointerup");
  if (worker.completed.length) worker.deliver();
  frame(200);
  expect(controller.observe().document!.revision).toBe(1);
  controller.destroy();
});

it("uses the displayed-terrain gate in normal startup without diagnostic callbacks", async () => {
  const { controller, bridge, pointer, frame, drainView } =
    await readyController(0, {
      diagnostics: false,
      ready: false,
    });
  controller.setBrush(16, 400);
  expect(controller.observe().readiness.reason).toBe("terrain");
  expect(controller.state.loading).toBe(true);
  pointer("pointerdown", 20, 20);
  pointer("pointermove", 24, 20);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(0);
  expect(controller.state.canUndo).toBe(false);
  await drainView();
  frame(500);
  expect(controller.state.loading).toBe(false);
  expect(controller.state.needsPress).toBe(true);
  expect(controller.state.message).toBe(
    "Zum Bearbeiten loslassen und erneut drücken",
  );
  expect(controller.observe().document!.revision).toBe(0);
  expect(bridge.commit).not.toHaveBeenCalled();
  pointer("pointerup", 24, 20);
  pointer("pointerdown", 24, 20);
  pointer("pointerup", 24, 20);
  expect(controller.observe().document!.revision).toBe(1);
  await drainView();
  expect(bridge.commit).toHaveBeenCalledOnce();
  expect(controller.state.canUndo).toBe(true);
  expect(controller.observation.read()).toEqual([]);
  controller.undo();
  await drainView();
  expect(controller.observe([[-32, -48]]).samples[0]).toBe(-100);
  controller.destroy();
});

it("prepares an off-center finer tool on hover and size change without a gesture", async () => {
  const { controller, bridge, pointer, drainView } = await readyController(1, {
    width: 512,
  });
  controller.goTo(new Event("navigate"), 100_000, 0, 1 / 64);
  await drainView();
  controller.setBrush(8, 400);
  pointer("pointermove", 450, 32);
  expect(controller.observe().readiness.reason).toBe("sources");
  await drainView();
  const { point, bounds, ready } = controller.observe().readiness;
  expect(point).toEqual([112_416, 0]);
  expect(bounds[0]).toBeGreaterThan(100_000);
  expect(bridge.readRegion.mock.calls.at(-1)![0]).toMatchObject({
    bounds,
    minLevel: 2,
  });
  expect(ready).toBe(true);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.state.canUndo).toBe(false);
  pointer("pointerdown", 450, 32);
  pointer("pointerup", 450, 32);
  expect(controller.observe().document!.revision).toBe(1);
  controller.destroy();
});

it("marks navigation ready only after the actual matching local submit", async () => {
  const { controller, frame, pointer, drainView } = await readyController(1);
  controller.goTo(new Event("navigate"), 20_000, 0, 0.25);
  expect(controller.observe().readiness.ready).toBe(false);
  frame();
  for (let step = 0; step < 8; step++) await Promise.resolve();
  let events = controller.observation.read();
  expect(events.some((event) => event.kind === "sources-ready")).toBe(true);
  expect(events.some((event) => event.kind === "input-ready")).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(0);
  await drainView();
  events = controller.observation.read();
  const ready = events.find((event) => event.kind === "input-ready")!;
  const submit = events.find(
    (event) => event.kind === "submit" && event.frame === ready.frame,
  )!;
  expect(ready).toMatchObject({
    sessionId: "shared-frame",
    ready: true,
    reason: null,
    revision: 0,
  });
  expect(submit.cameraGeneration).toBe(ready.viewGeneration);
  expect(events.indexOf(submit)).toBeLessThan(events.indexOf(ready));
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(1);
  controller.destroy();
});

it("ends a stroke before an unseen gap even when its two endpoints are visible", async () => {
  const { controller, bridge, frame, pointer, drainView } =
    await readyController(0, { width: 512 });
  controller.setBrush(16, 400);
  const displayed = controller.world.regionDisplayed.bind(controller.world);
  const gap = vi
    .spyOn(controller.world, "regionDisplayed")
    .mockImplementation((bounds, current) =>
      bounds[0] < 0 && bounds[2] > 0 ? false : displayed(bounds, current),
    );
  pointer("pointerdown", 64, 32);
  const accepted = controller.observe().document!.revision;
  pointer("pointermove", 448, 32);
  frame();
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(accepted);
  expect(controller.state.needsPress).toBe(true);
  for (let step = 0; step < 4; step++) await Promise.resolve();
  expect(bridge.commit).toHaveBeenCalledOnce();
  gap.mockRestore();
  await drainView();
  frame(500);
  expect(controller.observe().document!.revision).toBe(accepted);
  pointer("pointerup", 448, 32);
  controller.undo();
  await drainView();
  expect(
    controller.observe([
      [-768, 0],
      [0, 0],
      [768, 0],
    ]).samples,
  ).toEqual([-100, -100, -100]);
  controller.destroy();
});

it("permits a partial edge footprint but ends before a captured pointer paints wholly outside the viewport", async () => {
  const { controller, bridge, pointer, frame, drainView } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 1, 32);
  expect(controller.observe().document!.revision).toBe(1);
  pointer("pointermove", 1000, 32);
  frame();
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(1);
  expect(controller.observe().readiness.reason).toBe("outside");
  expect(controller.state.loading).toBe(false);
  pointer("pointermove", 32, 32);
  await drainView();
  frame(500);
  expect(controller.state.needsPress).toBe(true);
  expect(controller.observe().document!.revision).toBe(1);
  expect(bridge.commit).toHaveBeenCalledOnce();
  pointer("pointerup");
  controller.undo();
  await drainView();
  expect(
    controller.observe([
      [-124, 0],
      [0, 0],
      [1000, 0],
    ]).samples,
  ).toEqual([-100, -100, -100]);
  controller.destroy();
});

it("rereads both source paths when an acknowledgement has already overtaken their sequence", async () => {
  const { controller, bridge, pointer, drainView } = await readyController(1);
  controller.setBrush(16, 400);
  pointer("pointerdown");
  pointer("pointerup");
  await drainView();
  expect(controller.observe().document!.sequence).toBe(1);
  bridge.readPresentation.mockImplementationOnce(async (request) => ({
    ...request,
    sequence: 0,
    tiles: [],
    overviews: [],
    overviewKeys: heightOverviewKeys(request.bounds, request.power),
  }));
  const previous = bridge.readPresentation.mock.calls.length;
  controller.setBrush(80, 400);
  controller.goTo(new Event("navigate"), 100_000, 0, 1 / 64);
  await drainView();
  expect(bridge.readPresentation.mock.calls.length - previous).toBe(2);
  bridge.readRegion.mockImplementationOnce(async (request) => ({
    ...request,
    sequence: 0,
    tiles: [],
  }));
  const regions = bridge.readRegion.mock.calls.length;
  controller.setBrush(8, 400);
  await drainView();
  expect(bridge.readRegion.mock.calls.length - regions).toBe(2);
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.error).toBeNull();
  controller.destroy();
});

it.each(["presentation", "region"] as const)(
  "consumes a %s read atomically before an acknowledgement microtask releases its patches",
  async (purpose) => {
    const { controller, bridge, worker, pointer, drainView } =
      await readyController(1);
    const point: [number, number] = purpose === "region" ? [10_000, 0] : [0, 0];
    if (purpose === "region") {
      controller.goTo(new Event("navigate"), point[0], point[1], 1 / 16);
      await drainView();
    }
    controller.setBrush(purpose === "region" ? 80 : 32, 400);
    let acknowledge!: () => void;
    let written!: CommitRequest;
    bridge.commit.mockImplementationOnce(
      (request) =>
        new Promise((resolve) => {
          written = request;
          acknowledge = () =>
            resolve({
              sessionId: request.sessionId,
              sequence: request.sequence,
              transactionId: request.transactionId,
            });
        }),
    );
    pointer("pointerdown");
    pointer("pointerup");
    await drainView();
    expect(bridge.commit).toHaveBeenCalledOnce();
    expect(controller.state.writing).toBe(true);
    const expected = prepareHeightSampler(
      written.patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
    )(...point);
    const sinceEvent = controller.observation.read().length;
    // The store has reached S+1, but this response was captured at S. The ack
    // arrives in the exact microtask gap an async validation-only helper creates.
    bridge.readPresentation.mockImplementation(async (request) => ({
      ...request,
      sequence: 1,
      tiles: [],
      overviews: [],
      overviewKeys: heightOverviewKeys(request.bounds, request.power),
    }));
    bridge.readRegion.mockImplementation(async (request) => ({
      ...request,
      sequence: 1,
      tiles: [],
    }));
    const releaseAck = () => queueMicrotask(() => queueMicrotask(acknowledge));
    if (purpose === "presentation") {
      bridge.readPresentation.mockImplementationOnce((request) => {
        releaseAck();
        return Promise.resolve({
          ...request,
          sequence: 0,
          tiles: [],
          overviews: [],
          overviewKeys: heightOverviewKeys(request.bounds, request.power),
        });
      });
      controller.goTo(new Event("navigate"), 0, 0, 1 / 64);
    } else {
      bridge.readRegion.mockImplementationOnce((request) => {
        releaseAck();
        return Promise.resolve({ ...request, sequence: 0, tiles: [] });
      });
      controller.setBrush(8, 400);
    }
    await drainView();
    for (let step = 0; step < 8; step++) await Promise.resolve();
    const events = controller.observation.read().slice(sinceEvent);
    const consumed = events.findIndex(
      (event) =>
        event.kind === "sources" &&
        (purpose === "presentation"
          ? event.power !== undefined
          : event.power === undefined),
    );
    const acknowledged = events.findIndex(
      (event) => event.kind === "persisted" && event.sequence === 1,
    );
    expect(consumed).toBeGreaterThanOrEqual(0);
    expect(acknowledged).toBeGreaterThan(consumed);
    expect(controller.state.error).toBeNull();
    expect(controller.state.writing).toBe(false);
    expect(controller.observe().readiness.ready).toBe(true);
    expect(controller.state.canUndo).toBe(true);
    expect(controller.observe([point]).samples[0]).toBeCloseTo(expected, 10);
    if (purpose === "presentation")
      expect(
        [...worker.overviews.values()].some((tile) =>
          tile.values.some((value) => value !== 0),
        ),
      ).toBe(true);
    controller.destroy();
  },
);

it("edits a submitted warm local area while the outer presentation read is still pending", async () => {
  const { controller, bridge, worker, frame, pointer } =
    await readyController(1);
  controller.setBrush(16, 400);
  let resume!: (
    reply: Awaited<ReturnType<typeof bridge.readPresentation>>,
  ) => void;
  bridge.readPresentation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  );
  controller.goTo(new Event("navigate"), 400, 0, 0.25);
  expect(controller.observe().readiness.ready).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(0);
  frame();
  for (let step = 0; step < 8; step++) await Promise.resolve();
  expect(resume).toBeTypeOf("function");
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.loading).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(1);
  for (let step = 0; step < 6; step++) {
    if (worker.completed.length) worker.deliver();
    frame();
    await Promise.resolve();
  }
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.loading).toBe(false);
  expect(bridge.commit).toHaveBeenCalledOnce();
  controller.destroy();
  const request = bridge.readPresentation.mock.calls.at(-1)![0];
  resume({
    ...request,
    sequence: 0,
    tiles: [],
    overviews: [],
    overviewKeys: heightOverviewKeys(request.bounds, request.power),
  });
  for (let step = 0; step < 8; step++) await Promise.resolve();
});

it("shows an initial read failure and recovers through the ordinary retry without an early edit", async () => {
  const { controller, pointer, drainView } = await readyController(1, {
    ready: false,
    readFailure: true,
  });
  expect(controller.state.error).toBe("Lokaler Lesefehler");
  expect(controller.state.loading).toBe(true);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(0);
  controller.retryLoad();
  await drainView();
  expect(controller.state.error).toBeNull();
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.observe().document!.revision).toBe(0);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(1);
  controller.destroy();
});

it("ends a held stroke on resize instead of painting at a world point different from its cursor", async () => {
  const { controller, pointer, resize, frame, drainView } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 32, 32);
  expect(controller.observe().document!.revision).toBe(1);
  resize(128);
  expect(controller.observe().gesture).toBeNull();
  await drainView();
  frame(500);
  expect(controller.observe().document!.revision).toBe(1);
  expect(controller.state.needsPress).toBe(true);
  pointer("pointerup", 32, 32);
  pointer("pointerdown", 32, 32);
  pointer("pointerup", 32, 32);
  expect(controller.observe().document!.revision).toBe(2);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval")
      .at(-1),
  ).toMatchObject({ from: [-128, 0], to: [-128, 0] });
  controller.destroy();
});

it("projects fine source changes into a certified empty overview exactly once, including history", () => {
  let worker!: RasterWorker;
  vi.stubGlobal(
    "Worker",
    class extends RasterWorker {
      constructor() {
        super();
        worker = this;
      }
    },
  );
  const document = new EditorDocument("numeric-overview-transfer", {
    empty: true,
  });
  const world = new WorldRenderer(new Observation());
  world.reset(document);
  const key = heightOverviewKey(6, 0, 0);
  const bounds: Bounds = [0, 0, 8192, 8192];
  expect(world.isPresentationReady(bounds, 6)).toBe(false);
  world.updatePresentation([], [], [key], true);
  expect(world.isPresentationReady(bounds, 6)).toBe(true);
  const rendered = () =>
    heightFromScaledSum(
      -100 / HEIGHT_SUM_SCALE + (worker.overviews.get(key)?.values[0] ?? 0),
    );
  document.beginGesture({ level: 0, radius: 20, amount: 400 });
  const first = document.applyPoint([32, 32], 1000)!;
  world.updateSourcePatches(first.patches);
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
  document.applyPoint([48, 32], 0);
  const second = document.applyPoint([48, 32], 1000)!;
  world.updateSourcePatches(second.patches);
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
  expect(
    second.patches.every(
      (patch) => patch.after!.values.byteLength === HEIGHT_TILE_BYTES,
    ),
  ).toBe(true);
  document.finishGesture();
  const undone = document.undo()!;
  world.updateSourcePatches(undone.patches);
  expect(rendered()).toBeCloseTo(-100, 10);
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
});
