import { afterEach, expect, it, vi } from "vitest";
import { BufferImageSource, type GlTexture, type WebGLRenderer } from "pixi.js";
import { heightTilesFromControls } from "../model/fixtures";
import { createHeightOverviewTile } from "../model/overview";
import { heightTileKey, type HeightTile } from "../model/types";
import {
  HeightField,
  MAX_HEIGHT_ANCHOR_PROMOTIONS,
  supportsHeightNumericTargets,
} from "./HeightField";
import type { HeightAtlasSource } from "./height-atlas-upload";

interface Uploader {
  id: string;
  upload(
    source: BufferImageSource,
    texture: GlTexture,
    gl: WebGLRenderingContext,
  ): void;
}
const uploaders = vi.hoisted(() => new Map<string, Uploader>());

vi.mock("pixi.js", async (original) => {
  const actual = await original<typeof import("pixi.js")>();
  return {
    // Keep Pixi's real source events, resize and update semantics. Only the
    // scene objects and WebGL driver are replaced in these transfer tests.
    BufferImageSource: actual.BufferImageSource,
    ExtensionType: actual.ExtensionType,
    extensions: {
      add: (uploader: Uploader) => uploaders.set(uploader.id, uploader),
    },
    GlProgram: { from: () => ({}) },
    MeshGeometry: class {
      destroy = vi.fn();
    },
    Mesh: class {
      scale = { set() {} };
      destroy = vi.fn();
      geometry: { destroy(): void };
      shader: { resources: Record<string, unknown> };
      constructor(options: {
        geometry: { destroy(): void };
        shader: { resources: Record<string, unknown> };
      }) {
        this.geometry = options.geometry;
        this.shader = options.shader;
      }
    },
    Shader: class {
      resources: Record<string, unknown>;
      destroy = vi.fn();
      constructor(options: {
        resources: Record<string, unknown> & {
          heightUniforms: Record<string, { value: unknown }>;
        };
      }) {
        this.resources = {
          ...options.resources,
          heightUniforms: {
            uniforms: Object.fromEntries(
              Object.entries(options.resources.heightUniforms).map(
                ([key, uniform]) => [key, uniform.value],
              ),
            ),
          },
        };
      }
    },
    RenderTexture: { create: () => ({ destroy: vi.fn() }) },
    Sprite: class {
      destroy = vi.fn();
    },
  };
});

type NumericData = Float32Array | Uint8Array;
const resourceBytes = (source: BufferImageSource) => {
  const values = source.resource as NumericData;
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
};

/** The relevant Pixi contract: registration adds listeners, then allocates;
 * updates before registration do not reach GL. Drawing lazily binds sources. */
function recordingRenderer() {
  const sources = new Map<
    BufferImageSource,
    { texture: GlTexture; memory: Uint8Array }
  >();
  const allocations: { source: BufferImageSource; bytes: number }[] = [];
  const transfers: { source: BufferImageSource; bytes: number }[] = [];
  let active: BufferImageSource;
  let failure: ((source: BufferImageSource) => boolean) | undefined;
  const gl = {
    texImage2D: (...args: unknown[]) => {
      const values = args[8] as ArrayBufferView | null;
      allocations.push({ source: active, bytes: values?.byteLength ?? 0 });
      sources.get(active)!.memory = new Uint8Array(
        resourceBytes(active).byteLength,
      );
    },
    texSubImage2D: (...args: unknown[]) => {
      if (failure?.(active)) {
        failure = undefined;
        throw new Error("Injected numeric transfer failure");
      }
      const x = args[2] as number;
      const y = args[3] as number;
      const width = args[4] as number;
      const height = args[5] as number;
      const values = args[8] as NumericData;
      const bytes = new Uint8Array(
        values.buffer,
        values.byteOffset,
        values.byteLength,
      );
      const bytesPerTexel = bytes.byteLength / (width * height);
      for (let row = 0; row < height; row++)
        sources
          .get(active)!
          .memory.set(
            bytes.subarray(
              row * width * bytesPerTexel,
              (row + 1) * width * bytesPerTexel,
            ),
            ((y + row) * active.width + x) * bytesPerTexel,
          );
      transfers.push({ source: active, bytes: bytes.byteLength });
    },
  } as unknown as WebGLRenderingContext;
  const upload = (source: BufferImageSource) => {
    active = source;
    uploaders
      .get(source.uploadMethodId)!
      .upload(source, sources.get(source)!.texture, gl);
  };
  const release = (source: BufferImageSource) => {
    source.off("update", upload);
    source.off("resize", upload);
    source.off("destroy", release);
    sources.delete(source);
  };
  const initSource = (source: BufferImageSource) => {
    if (sources.has(source)) return;
    sources.set(source, {
      texture: { width: 0, height: 0 } as GlTexture,
      memory: new Uint8Array(),
    });
    source.on("update", upload);
    source.on("resize", upload);
    source.on("destroy", release);
    upload(source);
  };
  const render = vi.fn(
    ({ container }: { container: { shader: { resources: object } } }) => {
      for (const source of Object.values(container.shader.resources))
        if (source instanceof BufferImageSource) initSource(source);
    },
  );
  const renderer = {
    atlasTestDriver: true,
    texture: { initSource },
    render,
  } as unknown as WebGLRenderer;
  return {
    renderer,
    sources,
    allocations,
    transfers,
    render,
    loseContext: () => {
      for (const source of [...sources.keys()]) release(source);
    },
    bytes: () => transfers.reduce((sum, transfer) => sum + transfer.bytes, 0),
    failNext: (predicate: (source: BufferImageSource) => boolean) => {
      failure = predicate;
    },
  };
}

const fields: HeightField[] = [];
afterEach(() => {
  for (const field of fields.splice(0)) field.destroy();
});

function setup() {
  const field = new HeightField();
  fields.push(field);
  const gpu = recordingRenderer();
  field.init(gpu.renderer);
  return { field, gpu };
}

function drain(
  field: HeightField,
  gpu: ReturnType<typeof recordingRenderer>,
  budget = 256 * 1024,
) {
  let frames = 0;
  while (field.metrics().pendingUploadBytes && frames++ < 100) {
    const before = gpu.bytes();
    const reported = field.flush(budget);
    expect(gpu.bytes() - before).toBe(reported);
    expect(reported).toBeGreaterThan(0);
    expect(reported).toBeLessThanOrEqual(budget);
  }
  expect(field.metrics().pendingUploadBytes).toBe(0);
  return frames;
}

function expectUploaded(
  gpu: ReturnType<typeof recordingRenderer>,
  source: BufferImageSource,
) {
  const expected = resourceBytes(source);
  const actual = gpu.sources.get(source)!.memory;
  expect(actual.byteLength).toBe(expected.byteLength);
  expect(actual.every((value, index) => value === expected[index])).toBe(true);
}

function author(level: number, value: number, tileX = 0): HeightTile {
  return {
    key: heightTileKey(level, tileX, 0),
    level,
    tileX,
    tileY: 0,
    revision: 1,
    values: new Float64Array(64 ** 2).fill(value),
  };
}

it("registers cold resources without payload and transfers each frame's actual bytes within its budget", () => {
  const { field, gpu } = setup();
  field.updateSources(heightTilesFromControls(4, [[0, 0, 120]]));
  for (let x = 0; x < 40; x++) {
    const overview = createHeightOverviewTile(6, x, 0);
    overview.values.fill((x + 1) / 32);
    field.createTile([x * 8192, 0, (x + 1) * 8192, 8192], 6, overview);
  }
  expect(gpu.allocations.length).toBeGreaterThan(40);
  expect(gpu.allocations.every((allocation) => allocation.bytes === 0)).toBe(
    true,
  );
  expect(gpu.bytes()).toBe(0);
  expect(field.metrics().pendingUploadBytes).toBeGreaterThan(4 * 1024 * 1024);
  expect(() => field.drawDirty(gpu.renderer)).toThrow(/GPU-Daten/);
  expect(drain(field, gpu, 4 * 1024 * 1024)).toBeGreaterThan(1);
  for (const source of gpu.sources.keys()) expectUploaded(gpu, source);
  const transferred = gpu.bytes();
  expect(field.drawDirty(gpu.renderer)).toBe(40 * 128 * 128);
  expect(gpu.bytes()).toBe(transferred);
  // A numeric total and its colour projection are separate retained passes.
  expect(gpu.render).toHaveBeenCalledTimes(80);
  expect(field.drawDirty(gpu.renderer)).toBe(0);
  expect(gpu.render).toHaveBeenCalledTimes(80);
});

it("uploads changed author windows while retaining unchanged axes and fine overview data", () => {
  const { field, gpu } = setup();
  field.updateSources(heightTilesFromControls(4, [[0, 0, 120]]));
  const overview = createHeightOverviewTile(6, 0, 0);
  overview.values.fill(0.5);
  const tile = field.createTile([0, 0, 8192, 8192], 6, overview);
  drain(field, gpu);
  field.drawDirty(gpu.renderer);
  const initial = gpu.bytes();
  const retained = [...gpu.sources.keys()].filter(
    (source) => source !== field.source && source.format === "rg32float",
  );
  const transferCounts = retained.map(
    (source) =>
      gpu.transfers.filter((transfer) => transfer.source === source).length,
  );
  for (const value of [240, 360]) {
    field.updateSources(heightTilesFromControls(4, [[0, 0, value]]));
    tile.update();
    drain(field, gpu);
    expectUploaded(gpu, field.source);
    expect(field.drawDirty(gpu.renderer)).toBe(128 * 128);
    expect(field.drawDirty(gpu.renderer)).toBe(0);
  }
  expect(gpu.bytes() - initial).toBeLessThan(field.atlas.data.byteLength);
  expect(
    retained.map(
      (source) =>
        gpu.transfers.filter((transfer) => transfer.source === source).length,
    ),
  ).toEqual(transferCounts);
});

it.each(["author", "overview"] as const)(
  "preserves pending %s transfer intent after failure and retries the latest values",
  (kind) => {
    const { field, gpu } = setup();
    field.updateSources(heightTilesFromControls(4, [[0, 0, 120]]));
    const overview = createHeightOverviewTile(6, 0, 0);
    overview.values.fill(0.5);
    const tile = field.createTile([0, 0, 8192, 8192], 6, overview);
    drain(field, gpu);
    const target =
      kind === "author"
        ? field.source
        : [...gpu.sources.keys()].find((source) => source.width === 128)!;
    if (kind === "author") {
      field.updateSources(heightTilesFromControls(4, [[0, 0, 240]]));
      tile.update();
    } else {
      overview.values.fill(0.75);
      tile.update(overview);
    }
    gpu.failNext((source) => source === target);
    expect(() => field.flush()).toThrow("Injected numeric transfer failure");
    expect((target as HeightAtlasSource).range).toBeNull();
    expect(field.metrics().pendingUploadBytes).toBeGreaterThan(0);
    expect(() => field.drawDirty(gpu.renderer)).toThrow(/GPU-Daten/);
    // A newer accepted revision may arrive before retrying the failed range.
    if (kind === "author") {
      field.updateSources(heightTilesFromControls(4, [[0, 0, 360]]));
      tile.update();
    } else {
      overview.values.fill(1.25);
      tile.update(overview);
    }
    drain(field, gpu);
    expectUploaded(gpu, target);
    expect(field.drawDirty(gpu.renderer)).toBe(128 * 128);
  },
);

it("destroys cached tile resources and overwrites old source payload after reset", () => {
  const { field, gpu } = setup();
  field.updateSources(heightTilesFromControls(4, [[0, 0, 120]]));
  const tile = field.createTile([0, 0, 8192, 8192], 6);
  drain(field, gpu);
  field.drawDirty(gpu.renderer);
  const released = [...gpu.sources.keys()].filter(
    (source) => source !== field.source && source !== field.deltas.source,
  );
  field.reset();
  expect(tile.mesh.destroy).toHaveBeenCalledOnce();
  expect(field.metrics()).toMatchObject({
    sourceBytes: 0,
    sourceCount: 0,
    pages: 0,
  });
  expect(released.every((source) => !gpu.sources.has(source))).toBe(true);
  const empty = field.createTile([0, 0, 8192, 8192], 6);
  drain(field, gpu);
  expect(
    gpu.sources.get(field.source)!.memory.every((value) => value === 0),
  ).toBe(true);
  expect(empty.drawDirty(gpu.renderer)).toBe(128 * 128);
  expect(empty.drawDirty(gpu.renderer)).toBe(0);
});

it.each([120, Number.MAX_VALUE])(
  "rebuilds lost GPU resources within the frame budget while retaining author value %s",
  (value) => {
    const { field, gpu } = setup();
    const author = heightTilesFromControls(4, [[0, 0, value]])[0];
    field.updateSources([author]);
    for (let x = 0; x < 40; x++) {
      const overview = createHeightOverviewTile(6, x, 0);
      overview.values.fill((x + 1) / 32);
      field.createTile([x * 8192, 0, (x + 1) * 8192, 8192], 6, overview);
    }
    drain(field, gpu, 4 * 1024 * 1024);
    field.drawDirty(gpu.renderer);
    expect(field.metrics().pendingCompositionTiles).toBe(0);
    const copied = field.atlas.sources.get(author.key)!.values.slice();
    const uploadedBeforeLoss = gpu.bytes();
    const allocationsBeforeLoss = gpu.allocations.length;
    gpu.loseContext();
    expect(gpu.sources.size).toBe(0);
    field.rebuildAfterContextRestore();
    expect(gpu.bytes()).toBe(uploadedBeforeLoss);
    expect(gpu.allocations.length).toBeGreaterThan(allocationsBeforeLoss);
    expect(
      gpu.allocations
        .slice(allocationsBeforeLoss)
        .every((allocation) => allocation.bytes === 0),
    ).toBe(true);
    expect(field.metrics().pendingUploadBytes).toBeGreaterThan(4 * 1024 * 1024);
    expect(field.metrics().pendingCompositionTiles).toBe(40);
    expect(() => field.drawDirty(gpu.renderer)).toThrow(/GPU-Daten/);
    expect(drain(field, gpu, 4 * 1024 * 1024)).toBeGreaterThan(1);
    for (const source of gpu.sources.keys()) expectUploaded(gpu, source);
    const uploadedBeforeDraw = gpu.bytes();
    expect(field.drawDirty(gpu.renderer)).toBe(40 * 128 * 128);
    expect(gpu.bytes()).toBe(uploadedBeforeDraw);
    expect(field.drawDirty(gpu.renderer)).toBe(0);
    expect(
      field.atlas.sources
        .get(author.key)!
        .values.every((current, index) => current === copied[index]),
    ).toBe(true);
    expect(
      author.values.every((current, index) => current === copied[index]),
    ).toBe(true);
  },
);

it("reconstructs only the active level and dirty pixels against an unchanged gesture anchor", () => {
  const { field, gpu } = setup();
  const sources = Array.from({ length: 22 }, (_, level) => author(level, 10));
  field.updateSources(sources);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionLevels).toBe(22);
  const context = {
    id: 1,
    level: 0,
    before: new Map([[sources[0].key, sources[0]]]),
  };
  field.beginGesture(context);
  field.updateSources([author(0, 11)]);
  tile.update(undefined, [8, 10, 12, 15]);
  drain(field, gpu);
  expect(tile.usesAnchor).toBe(true);
  expect(tile.compositionLevels).toBe(1);
  expect(tile.drawDirty(gpu.renderer)).toBe(20);
  expect(tile.compositionStats).toEqual({
    canonicalSamples: 0,
    deltaSamples: 20,
    colourSamples: 20,
    anchorCopySamples: 128 ** 2 - 20,
  });
  field.beginGesture(context);
  field.updateSources([author(0, 12.5)]);
  tile.update(undefined, [8, 10, 12, 15]);
  drain(field, gpu);
  expect(field.deltas.atlas.sources.get(sources[0].key)!.values[0]).toBe(2.5);
  expect(sources[0].values[0]).toBe(10);
  expect(tile.drawDirty(gpu.renderer)).toBe(20);
  expect(tile.compositionStats.anchorCopySamples).toBe(0);
});

it("does not apply gesture-start deltas to a tile composed cold during that gesture", () => {
  const { field, gpu } = setup();
  const before = author(0, 100);
  field.updateSources([before]);
  field.beginGesture({
    id: 1,
    level: 0,
    before: new Map([[before.key, before]]),
  });
  field.updateSources([author(0, 101)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.beginGesture({
    id: 1,
    level: 0,
    before: new Map([[before.key, before]]),
  });
  field.updateSources([author(0, 102)]);
  tile.update(undefined, [0, 0, 8, 8]);
  expect(tile.usesAnchor).toBe(false);
  drain(field, gpu);
  expect(tile.drawDirty(gpu.renderer)).toBe(128 ** 2);
  const nextBefore = author(0, 102);
  field.beginGesture({
    id: 2,
    level: 0,
    before: new Map([[before.key, nextBefore]]),
  });
  field.updateSources([author(0, 103)]);
  tile.update(undefined, [0, 0, 8, 8]);
  expect(tile.usesAnchor).toBe(true);
});

it("requires queued composition to bind its sources again after another gesture starts", () => {
  const { field, gpu } = setup();
  const before = author(0, 100);
  field.updateSources([before, author(0, 200, 2)]);
  const ready = field.createTile([0, 0, 512, 512], 2);
  const queued = field.createTile([512, 0, 1024, 512], 2);
  drain(field, gpu);
  ready.drawDirty(gpu.renderer);
  expect(queued.needsPreparation).toBe(false);
  expect(queued.uploadReady).toBe(true);
  field.beginGesture({
    id: 1,
    level: 0,
    before: new Map([[before.key, before]]),
  });
  field.updateSources([author(0, 101)]);
  // The queued tile's document revision did not change. Its previous atlas
  // references did: no old descriptor may now authorize a draw.
  expect(queued.needsPreparation).toBe(true);
  expect(queued.uploadReady).toBe(false);
  expect(() => queued.drawDirty(gpu.renderer)).toThrow(/Unvollständiger/);
  queued.update();
  drain(field, gpu);
  expect(queued.needsPreparation).toBe(false);
  expect(queued.uploadReady).toBe(true);
  expect(queued.usesAnchor).toBe(false);
  expect(queued.drawDirty(gpu.renderer)).toBe(128 ** 2);
});

it("keeps overview-contained authors in the same display lattice without double counting", () => {
  const { field, gpu } = setup();
  const fine = author(0, 100);
  const coarse = author(1, 20);
  field.updateSources([fine, coarse]);
  const overview = createHeightOverviewTile(3, 0, 0);
  overview.values.fill(100 / 32);
  const tile = field.createTile([0, 0, 1024, 1024], 3, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.beginGesture({ id: 1, level: 0, before: new Map([[fine.key, fine]]) });
  field.updateSources([author(0, 101)]);
  tile.update(undefined, [0, 0, 16, 16]);
  expect(tile.power).toBe(3);
  expect(tile.usesAnchor).toBe(true);
  expect(tile.compositionLevels).toBe(1);
  expect(field.deltas.atlas.sources.get(fine.key)!.values[0]).toBe(1);
  drain(field, gpu);
  expect(tile.drawDirty(gpu.renderer)).toBe(256);
});

it("rebases bounded anchor chains without retaining per-gesture textures", () => {
  const { field, gpu } = setup();
  let current = author(0, 100);
  field.updateSources([current]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  let warmedBytes = 0;
  for (
    let gesture = 1;
    gesture <= MAX_HEIGHT_ANCHOR_PROMOTIONS + 2;
    gesture++
  ) {
    field.beginGesture({
      id: gesture,
      level: 0,
      before: new Map([[current.key, current]]),
    });
    current = author(0, 100 + (gesture % 2) * 0.1);
    field.updateSources([current]);
    tile.update(undefined, [4, 4, 8, 8]);
    drain(field, gpu);
    tile.drawDirty(gpu.renderer);
    if (gesture === 1) warmedBytes = field.metrics().gpuBytes;
    expect(field.metrics().gpuBytes).toBeLessThanOrEqual(warmedBytes);
    expect(tile.usesAnchor).toBe(gesture !== MAX_HEIGHT_ANCHOR_PROMOTIONS + 1);
  }
  expect(field.metrics().anchorRebases).toBe(1);
});

it("retains a warm overview anchor when unrelated fine residency is forgotten", () => {
  const { field, gpu } = setup();
  const fine = author(0, 10);
  const coarse = author(2, 100);
  field.updateSources([fine, coarse]);
  const overview = createHeightOverviewTile(4, 0, 0);
  overview.values.fill(10 / 32);
  const tile = field.createTile([0, 0, 2048, 2048], 4, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const context = { id: 1, level: 2, before: new Map([[coarse.key, coarse]]) };
  field.beginGesture(context);
  field.updateSources([author(2, 101)]);
  tile.update(undefined, [0, 0, 8, 8]);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.updateSources([], [fine.key]);
  field.beginGesture(context);
  field.updateSources([author(2, 102)]);
  tile.update(undefined, [0, 0, 8, 8]);
  expect(tile.usesAnchor).toBe(true);
  field.updateSources([author(3, 5)]);
  tile.update();
  expect(tile.usesAnchor).toBe(false);
});

it("reprepares an unfinished fine delta when its author residency is released", () => {
  const { field, gpu } = setup();
  const fine = author(0, 100);
  field.updateSources([fine, author(1, 20)]);
  const overview = createHeightOverviewTile(3, 0, 0);
  overview.values.fill(100 / 32);
  const tile = field.createTile([0, 0, 1024, 1024], 3, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.beginGesture({ id: 1, level: 0, before: new Map([[fine.key, fine]]) });
  field.updateSources([author(0, 101)]);
  const updatedOverview = {
    ...overview,
    values: overview.values.slice().fill(101 / 32),
  };
  tile.update(updatedOverview, [0, 0, 16, 16]);
  expect(tile.usesAnchor).toBe(true);
  // A persistence acknowledgement and navigation may release fine authors
  // after the gesture ends, while this already prepared draw is still queued.
  field.updateSources([], [fine.key]);
  expect(tile.needsPreparation).toBe(true);
  expect(tile.uploadReady).toBe(false);
  tile.update();
  expect(tile.usesAnchor).toBe(false);
  drain(field, gpu);
  expect(tile.drawDirty(gpu.renderer)).toBe(128 ** 2);
});

it("does not force ordinary large cancellation into the Float64 fallback", () => {
  const { field, gpu } = setup();
  const sources = Array.from({ length: 22 }, (_, level) =>
    author(level, level % 2 ? 900_000 : -900_000),
  );
  field.updateSources(sources);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.beginGesture({
    id: 1,
    level: 0,
    before: new Map([[sources[0].key, sources[0]]]),
  });
  field.updateSources([author(0, -899_999)]);
  tile.update(undefined, [0, 0, 8, 8]);
  expect(tile.usesAnchor).toBe(false);
  expect(tile.fallback).toBe(false);
  expect(tile.compositionLevels).toBe(22);
});

it("rejects unsafe deltas and keeps finite authoritative endpoints for canonical recomposition", () => {
  const { field, gpu } = setup();
  const before = author(0, -1_000_000);
  field.updateSources([before]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.beginGesture({
    id: 1,
    level: 0,
    before: new Map([[before.key, before]]),
  });
  field.updateSources([author(0, 1_000_000)]);
  tile.update();
  expect(field.deltas.atlas.sources.get(before.key)!.values[0]).toBe(2_000_000);
  expect(field.deltaSafe(tile.bounds)).toBe(false);
  expect(tile.usesAnchor).toBe(false);
  expect(tile.fallback).toBe(false);
  field.updateSources([author(0, Number.MAX_VALUE)]);
  tile.update();
  expect(tile.fallback).toBe(true);
  expect(field.atlas.sources.get(before.key)!.values[0]).toBe(Number.MAX_VALUE);
});

it("does not upload or invalidate identical author content", () => {
  const { field, gpu } = setup();
  const before = author(0, 100);
  field.updateSources([before]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const sourceCopy = field.atlas.sources.get(before.key);
  expect(field.updateSources([{ ...author(0, 100), revision: 20 }])).toEqual(
    [],
  );
  expect(field.atlas.sources.get(before.key)).toBe(sourceCopy);
  expect(field.metrics().pendingUploadBytes).toBe(0);
});

it("releases evicted gesture deltas and reconstructs them from document-owned before-images", () => {
  const { field, gpu } = setup();
  const before = author(0, 100);
  const context = { id: 1, level: 0, before: new Map([[before.key, before]]) };
  field.updateSources([before]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.beginGesture(context);
  field.updateSources([author(0, 101)]);
  tile.update();
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(field.deltas.atlas.sourceBytes).toBe(64 ** 2 * 8);
  field.updateSources([], [before.key]);
  expect(field.deltas.atlas.sourceBytes).toBe(0);
  expect(field.atlas.sourceBytes).toBe(0);
  expect(context.before.get(before.key)!.values[0]).toBe(100);
  field.beginGesture(context);
  field.updateSources([author(0, 102)]);
  expect(field.deltas.atlas.sources.get(before.key)!.values[0]).toBe(2);
  tile.update();
  // The removed input invalidated its old anchor; returning during the same
  // gesture cannot add a whole gesture's delta to an unrelated cold total.
  expect(tile.usesAnchor).toBe(false);
});

it("admits a locally ready tile while an unrelated numeric source still awaits transfer", () => {
  const { field, gpu } = setup();
  field.updateSources([author(0, 100), author(0, 200, 100)]);
  const ready = field.createTile([0, 0, 512, 512], 2);
  const pending = field.createTile([32000, 0, 32512, 512], 2);
  drain(field, gpu);
  field.drawDirty(gpu.renderer);
  field.updateSources([author(0, 201, 100)]);
  pending.update();
  ready.update();
  ready.flush();
  expect(field.metrics().pendingUploadBytes).toBeGreaterThan(0);
  expect(ready.uploadReady).toBe(true);
  expect(pending.uploadReady).toBe(false);
  expect(ready.drawDirty(gpu.renderer)).toBe(128 ** 2);
});

it.each([true, false])(
  "probes actual RG32F completeness and restores GL bindings (complete=%s)",
  (complete) => {
    const oldTexture = {},
      oldDraw = {},
      oldRead = {};
    const probeTexture = {},
      probeFramebuffer = {};
    const gl = {
      TEXTURE_BINDING_2D: 1,
      DRAW_FRAMEBUFFER_BINDING: 2,
      READ_FRAMEBUFFER_BINDING: 3,
      TEXTURE_2D: 4,
      DRAW_FRAMEBUFFER: 5,
      READ_FRAMEBUFFER: 6,
      RG32F: 7,
      RG: 8,
      FLOAT: 9,
      COLOR_ATTACHMENT0: 10,
      FRAMEBUFFER_COMPLETE: 11,
      getExtension: vi.fn(() => ({})),
      getParameter: (name: number) =>
        ({ 1: oldTexture, 2: oldDraw, 3: oldRead })[name],
      createTexture: () => probeTexture,
      createFramebuffer: () => probeFramebuffer,
      bindTexture: vi.fn(),
      bindFramebuffer: vi.fn(),
      texImage2D: vi.fn(),
      framebufferTexture2D: vi.fn(),
      checkFramebufferStatus: () => (complete ? 11 : 12),
      deleteTexture: vi.fn(),
      deleteFramebuffer: vi.fn(),
    };
    expect(
      supportsHeightNumericTargets(gl as unknown as WebGL2RenderingContext),
    ).toBe(complete);
    expect(gl.bindTexture).toHaveBeenLastCalledWith(gl.TEXTURE_2D, oldTexture);
    expect(gl.bindFramebuffer.mock.calls.slice(-2)).toEqual([
      [gl.DRAW_FRAMEBUFFER, oldDraw],
      [gl.READ_FRAMEBUFFER, oldRead],
    ]);
    expect(gl.deleteTexture).toHaveBeenCalledWith(probeTexture);
    expect(gl.deleteFramebuffer).toHaveBeenCalledWith(probeFramebuffer);
  },
);

it("does not assume RG32F support when the extension is absent", () => {
  expect(
    supportsHeightNumericTargets({
      getExtension: () => null,
    } as unknown as WebGL2RenderingContext),
  ).toBe(false);
});
