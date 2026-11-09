import { afterEach, expect, it, vi } from "vitest";
import { BufferImageSource, type GlTexture, type WebGLRenderer } from "pixi.js";
import { heightTilesFromControls } from "../model/fixtures";
import { editorBudgets } from "../budgets";
import { createHeightOverviewTile } from "../model/overview";
import { heightTileKey, type HeightTile } from "../model/types";
import {
  HeightField,
  MAX_HEIGHT_BASIS_TRANSFERS,
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
    MeshGeometry: actual.MeshGeometry,
    Mesh: actual.Mesh,
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
    RenderTexture: {
      create: () => ({ source: {}, destroy: vi.fn(), resize: vi.fn() }),
    },
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
    ({
      container,
    }: {
      container: { shader: { resources: object } };
      target?: { source: unknown };
    }) => {
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

it("disables actual Pixi blend state for directly rendered numeric meshes even when root groupBlendMode stays normal", async () => {
  const actual = await vi.importActual<typeof import("pixi.js")>("pixi.js");
  const { field, gpu } = setup();
  field.updateSources([author(0, 100)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const checked: boolean[] = [];
  const pipe = new actual.MeshPipe(gpu.renderer, {
    init() {},
    destroy() {},
    execute(_pipe, mesh) {
      checked.push(mesh.state.blend);
    },
  });
  for (const [request] of gpu.render.mock.calls) {
    const mesh = request.container as unknown as Parameters<
      typeof pipe.execute
    >[0];
    mesh.enableRenderGroup();
    mesh.updateLocalTransform();
    actual.updateRenderGroupTransforms(mesh.renderGroup!);
    expect(mesh.groupBlendMode).toBe("normal");
    pipe.execute(mesh);
  }
  expect(checked).toEqual([false, false, false]);
});

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
  expect(gpu.render).toHaveBeenCalledTimes(81);
  expect(field.drawDirty(gpu.renderer)).toBe(0);
  expect(gpu.render).toHaveBeenCalledTimes(81);
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
    (source) => source !== field.source,
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

function change(
  field: HeightField,
  before: HeightTile | null,
  after: HeightTile | null,
) {
  field.applySourcePatches([{ key: (after ?? before)!.key, before, after }]);
  // These fixtures replace whole arrays. Product dirty rectangles come from
  // the actual model update and are forwarded by WorldRenderer.invalidate.
  for (const tile of field.tiles) tile.markHeightChanged();
}

it("reconstructs only the active level and dirty pixels against a fixed total-and-contribution basis", () => {
  const { field, gpu } = setup();
  const sources = Array.from({ length: 22 }, (_, level) => author(level, 10));
  field.updateSources(sources);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionLevels).toBe(22);
  expect(tile.compositionStats.canonicalBasisBuilds).toBe(1);
  change(field, sources[0], author(0, 11));
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
    basisCaptureSamples: 0,
    canonicalBasisBuilds: 0,
    horizontalSamples: 28,
    projectionProducts: 192,
  });
  change(field, author(0, 11), author(0, 12.5));
  tile.update(undefined, [8, 10, 12, 15]);
  drain(field, gpu);
  expect(field.atlas.sources.get(sources[0].key)!.values[0]).toBe(12.5);
  expect(sources[0].values[0]).toBe(10);
  expect(tile.drawDirty(gpu.renderer)).toBe(20);
  expect(tile.compositionStats.anchorCopySamples).toBe(0);
});

it("captures H and active C at the same cold state, then reuses that state within the ongoing action", () => {
  const { field, gpu } = setup();
  const before = author(0, 100);
  field.updateSources([before]);
  change(field, before, author(0, 101));
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats.canonicalBasisBuilds).toBe(1);
  change(field, author(0, 101), author(0, 102));
  tile.update(undefined, [0, 0, 8, 8]);
  drain(field, gpu);
  expect(tile.usesAnchor).toBe(true);
  expect(tile.drawDirty(gpu.renderer)).toBe(64);
  expect(tile.basisTransfers).toBe(0);
});

it("rebinds queued composition after a tool change even at the same document revision", () => {
  const { field, gpu } = setup();
  field.updateSources([author(0, 100), author(1, 200)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  const version = tile.preparationVersion;
  field.setToolLevel(1);
  expect(tile.preparationVersion).toBe(version + 1);
  expect(tile.needsPreparation).toBe(true);
  expect(tile.uploadReady).toBe(false);
  expect(() => tile.drawDirty(gpu.renderer)).toThrow(/Unvollständiger/);
  tile.update();
  drain(field, gpu);
  expect(tile.preparedVersion).toBe(-1);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats.canonicalBasisBuilds).toBe(1);
  expect(tile.compositionStats.basisCaptureSamples).toBe(0);
  expect(tile.preparedVersion).toBe(tile.preparationVersion);
});

it("keeps overview-contained active authors on the same lattice and captures their contribution separately", () => {
  const { field, gpu } = setup();
  const fine = author(0, 100);
  field.updateSources([fine, author(1, 20)]);
  const overview = createHeightOverviewTile(3, 0, 0);
  overview.values.fill(100 / 32);
  const tile = field.createTile([0, 0, 1024, 1024], 3, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  // The canonical descriptor contains active L0 for C, while H still starts at L1.
  expect(tile.compositionLevels).toBe(2);
  expect(tile.compositionStats.canonicalBasisBuilds).toBe(1);
  change(field, fine, author(0, 101));
  const updated = {
    ...overview,
    values: overview.values.slice().fill(101 / 32),
  };
  tile.update(updated, [0, 0, 16, 16]);
  drain(field, gpu);
  expect(tile.power).toBe(3);
  expect(tile.usesAnchor).toBe(true);
  expect(tile.compositionLevels).toBe(1);
  expect(tile.drawDirty(gpu.renderer)).toBe(256);
});

it("keeps one basis through 100 same-level changes and undo without periodic work or extra author copies", () => {
  const { field, gpu } = setup();
  let current = author(0, 100);
  field.updateSources([
    current,
    ...Array.from({ length: 21 }, (_, i) => author(i + 1, 10)),
  ]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const bytes = field.metrics().gpuBytes;
  for (let action = 0; action < 100; action++) {
    const next = author(0, action % 2 ? 100 : 100.1);
    change(field, current, next);
    current = next;
    expect(field.setToolLevel(0)).toBe(false);
    tile.update(undefined, [4, 4, 8, 8]);
    drain(field, gpu);
    tile.drawDirty(gpu.renderer);
    expect(tile.compositionStats).toMatchObject({
      canonicalSamples: 0,
      deltaSamples: 16,
      basisCaptureSamples: 0,
      canonicalBasisBuilds: 0,
    });
    expect(tile.basisTransfers).toBe(0);
    expect(field.metrics().gpuBytes).toBeLessThanOrEqual(bytes);
    expect(field.metrics().sourceBytes).toBe(22 * 64 ** 2 * 8);
  }
  expect(field.metrics().anchorRebases).toBe(0);
});

it("captures only one new level from valid H before editing, and bounds actual derived transfers", () => {
  const { field, gpu } = setup();
  field.updateSources([author(0, 100), author(1, 10), author(20, 10)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  for (
    let transfer = 1;
    transfer <= MAX_HEIGHT_BASIS_TRANSFERS + 1;
    transfer++
  ) {
    field.setToolLevel(transfer % 2);
    tile.update();
    drain(field, gpu);
    tile.drawDirty(gpu.renderer);
    const rebase = transfer > MAX_HEIGHT_BASIS_TRANSFERS;
    expect(tile.compositionStats).toMatchObject({
      basisCaptureSamples: rebase ? 0 : 128 ** 2,
      canonicalSamples: rebase ? 128 ** 2 : 0,
      colourSamples: rebase ? 128 ** 2 : 0,
      canonicalBasisBuilds: rebase ? 1 : 0,
    });
    expect(tile.compositionLevels).toBe(rebase ? 3 : 1);
    expect(tile.basisTransfers).toBe(rebase ? 0 : transfer);
    const level = transfer % 2;
    const before = field.atlas.sources.get(heightTileKey(level, 0, 0))!;
    change(field, before, author(level, before.values[0] + 0.001));
    tile.update(undefined, [4, 4, 8, 8]);
    drain(field, gpu);
    tile.drawDirty(gpu.renderer);
    expect(tile.compositionStats.deltaSamples).toBe(16);
  }
  expect(field.metrics().anchorRebases).toBe(1);
});

it("does not pair an old numeric total with new authors when a level change overtakes a queued edit", () => {
  const { field, gpu } = setup();
  field.updateSources([author(0, 100), author(1, 10)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  change(field, author(0, 100), author(0, 101));
  tile.update(undefined, [4, 4, 8, 8]);
  field.setToolLevel(1);
  tile.update();
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats).toMatchObject({
    canonicalSamples: 128 ** 2,
    basisCaptureSamples: 0,
    canonicalBasisBuilds: 1,
  });
});

it("retains current H outside the actual dirty rectangle of a broad author page", () => {
  const { field, gpu } = setup();
  field.setToolLevel(4);
  field.updateSources(
    Array.from({ length: 22 }, (_, level) => author(level, 10)),
  );
  const changed = field.createTile([0, 0, 512, 512], 2);
  const unchanged = field.createTile([2048, 0, 2560, 512], 2);
  drain(field, gpu);
  field.drawDirty(gpu.renderer);
  const before = field.atlas.sources.get(heightTileKey(4, 0, 0))!;
  const after = { ...before, values: before.values.slice() };
  after.values[0] += 1;
  field.applySourcePatches([{ key: before.key, before, after }]);
  // Only the first control's real spline support changed. Both displays are
  // inside this source page's broad support, but the remote H is still current.
  changed.markHeightChanged();
  changed.update(undefined, [0, 0, 60, 60]);
  drain(field, gpu);
  changed.drawDirty(gpu.renderer);
  field.setToolLevel(5);
  unchanged.update();
  drain(field, gpu);
  unchanged.drawDirty(gpu.renderer);
  expect(unchanged.compositionStats).toMatchObject({
    canonicalSamples: 0,
    basisCaptureSamples: 128 ** 2,
    colourSamples: 0,
  });
  expect(unchanged.compositionLevels).toBe(1);
});

it("captures from the last complete H into a distinct target and can retry an interrupted capture", () => {
  const { field, gpu } = setup();
  field.updateSources([author(0, 100), author(1, 10)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const initialTarget = gpu.render.mock.calls[1][0].target!;
  field.setToolLevel(1);
  tile.update();
  drain(field, gpu);
  const original = gpu.render.getMockImplementation()!;
  const references: unknown[] = [],
    targets: unknown[] = [];
  let failed = false;
  gpu.render.mockImplementation((request) => {
    const resources = request.container.shader.resources as {
      uReference?: unknown;
    };
    if (resources.uReference !== undefined) {
      references.push(resources.uReference);
      targets.push(request.target);
      expect(resources.uReference).not.toBe(request.target!.source);
      if (!failed) {
        failed = true;
        throw new Error("Interrupted capture");
      }
    }
    original(request);
  });
  expect(() => tile.drawDirty(gpu.renderer)).toThrow("Interrupted capture");
  expect(tile.preparedVersion).not.toBe(tile.preparationVersion);
  tile.drawDirty(gpu.renderer);
  expect(references).toEqual([initialTarget.source, initialTarget.source]);
  expect(targets[0]).toBe(targets[1]);
  expect(targets[0]).not.toBe(initialTarget);
  expect(tile.compositionStats.basisCaptureSamples).toBe(128 ** 2);
});

it("fits a complete ordinary 25-tile canonical build inside the unchanged product budget", () => {
  const { field, gpu } = setup();
  field.setToolLevel(4);
  const sources: HeightTile[] = [];
  for (const tileY of [-1, 0])
    for (const tileX of [-1, 0])
      sources.push({
        ...author(4, 100, tileX),
        key: heightTileKey(4, tileX, tileY),
        tileY,
      });
  field.updateSources(sources);
  const tiles = [];
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++)
      tiles.push(
        field.createTile([x * 512, y * 512, (x + 1) * 512, (y + 1) * 512], 2),
      );
  expect(
    tiles.every((tile) => tile.compositionLevels === 1 && !tile.usesAnchor),
  ).toBe(true);
  expect(
    tiles.reduce((sum, tile) => sum + tile.compositionWork, 0),
  ).toBeLessThanOrEqual(editorBudgets.compositionWorkPerFrame);
  drain(field, gpu);
  for (const tile of tiles) tile.drawDirty(gpu.renderer);
  const pixels = tiles.length * 128 ** 2;
  expect(
    tiles.reduce(
      (sum, tile) => sum + tile.compositionStats.projectionProducts,
      0,
    ),
  ).toBeLessThan((pixels * 20) / 4);
  expect(
    tiles.reduce(
      (sum, tile) => sum + tile.compositionStats.canonicalSamples,
      0,
    ),
  ).toBe(pixels);
});

it("retains a warm overview basis when unrelated fine residency is forgotten", () => {
  const { field, gpu } = setup();
  field.setToolLevel(2);
  const fine = author(0, 10),
    coarse = author(2, 100);
  field.updateSources([fine, coarse]);
  const overview = createHeightOverviewTile(4, 0, 0);
  overview.values.fill(10 / 32);
  const tile = field.createTile([0, 0, 2048, 2048], 4, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  change(field, coarse, author(2, 101));
  tile.update(undefined, [0, 0, 8, 8]);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const version = tile.preparationVersion;
  field.updateSources([], [fine.key]);
  expect(tile.preparationVersion).toBe(version);
  change(field, author(2, 101), author(2, 102));
  tile.update(undefined, [0, 0, 8, 8]);
  expect(tile.usesAnchor).toBe(true);
  field.updateSources([author(3, 5)]);
  tile.update();
  expect(tile.usesAnchor).toBe(false);
});

it("reprepares an unfinished fine live update after a change to its resident subset", () => {
  const { field, gpu } = setup();
  const fine = author(0, 100);
  field.updateSources([fine, author(1, 20)]);
  const overview = createHeightOverviewTile(3, 0, 0);
  overview.values.fill(100 / 32);
  const tile = field.createTile([0, 0, 1024, 1024], 3, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  change(field, fine, author(0, 101));
  tile.update(
    { ...overview, values: overview.values.slice().fill(101 / 32) },
    [0, 0, 16, 16],
  );
  expect(tile.usesAnchor).toBe(true);
  field.updateSources([], [fine.key]);
  expect(tile.needsPreparation).toBe(true);
  expect(tile.uploadReady).toBe(false);
  tile.update();
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats).toMatchObject({
    canonicalSamples: 128 ** 2,
    basisCaptureSamples: 0,
  });
});

it.each(["restore", "delete"] as const)(
  "invalidates a nonresident history %s even when the fine overview already holds its old contribution",
  (kind) => {
    const { field, gpu } = setup();
    const fine = author(0, 100);
    const overview = createHeightOverviewTile(3, 0, 0);
    overview.values.fill(100 / 32);
    const tile = field.createTile([0, 0, 1024, 1024], 3, overview);
    drain(field, gpu);
    tile.drawDirty(gpu.renderer);
    const version = tile.preparationVersion;
    change(field, fine, kind === "restore" ? author(0, 101) : null);
    expect(tile.preparationVersion).toBeGreaterThan(version);
    tile.update(
      {
        ...overview,
        values: overview.values.slice().fill(kind === "restore" ? 101 / 32 : 0),
      },
      [0, 0, 16, 16],
    );
    drain(field, gpu);
    tile.drawDirty(gpu.renderer);
    expect(tile.compositionStats).toMatchObject({
      canonicalSamples: 128 ** 2,
      deltaSamples: 0,
      basisCaptureSamples: 0,
    });
  },
);

it("recaptures a changed fine resident subset cheaply only when the total is still current", () => {
  const { field, gpu } = setup();
  const fine = author(0, 100);
  const overview = createHeightOverviewTile(3, 0, 0);
  overview.values.fill(100 / 32);
  const tile = field.createTile([0, 0, 1024, 1024], 3, overview);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  field.updateSources([fine]);
  tile.update();
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats).toMatchObject({
    basisCaptureSamples: 128 ** 2,
    canonicalSamples: 0,
    colourSamples: 0,
  });
  expect(tile.basisTransfers).toBe(1);
  change(field, fine, author(0, 101));
  tile.update(undefined, [0, 0, 8, 8]);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats.deltaSamples).toBe(64);
});

it("keeps ordinary large cancellation on the canonical GPU path and marks the strategy prepared", () => {
  const { field, gpu } = setup();
  const sources = Array.from({ length: 22 }, (_, level) =>
    author(level, level % 2 ? 900_000 : -900_000),
  );
  field.updateSources(sources);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  change(field, sources[0], author(0, -899_999));
  tile.update(undefined, [0, 0, 8, 8]);
  expect(tile.usesAnchor).toBe(false);
  expect(tile.fallback).toBe(false);
  expect(tile.compositionLevels).toBe(22);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.preparedVersion).toBe(tile.preparationVersion);
  expect(tile.hasBasis).toBe(false);
  expect(tile.needsComposition).toBe(false);
});

it("admits finite endpoints only with an independent difference bound and retains extreme Float64 authors", () => {
  const { field, gpu } = setup();
  const before = author(0, -1_000_000);
  field.updateSources([before]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  change(field, before, author(0, 1_000_000));
  tile.update();
  expect(tile.usesAnchor).toBe(false);
  expect(tile.fallback).toBe(false);
  change(field, author(0, 1_000_000), author(0, Number.MAX_VALUE));
  tile.update();
  expect(tile.fallback).toBe(true);
  expect(field.atlas.sources.get(before.key)!.values[0]).toBe(Number.MAX_VALUE);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.preparedVersion).toBe(tile.preparationVersion);
});

it("allows a prepared Float64 strategy without numeric framebuffer support", () => {
  const { field, gpu } = setup();
  field.numericSupported = false;
  field.updateSources([author(0, 100)]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.fallback).toBe(true);
  expect(tile.preparedVersion).toBe(tile.preparationVersion);
  expect(tile.needsPreparation).toBe(false);
  expect(field.setToolLevel(0)).toBe(false);
  expect(tile.needsComposition).toBe(false);
  change(field, author(0, 100), author(0, 101));
  tile.update();
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  expect(tile.compositionStats.colourSamples).toBe(128 ** 2);
});

it("does not upload or invalidate identical author content", () => {
  const { field, gpu } = setup();
  const before = author(0, 100);
  field.updateSources([before]);
  const tile = field.createTile([0, 0, 512, 512], 2);
  drain(field, gpu);
  tile.drawDirty(gpu.renderer);
  const copy = field.atlas.sources.get(before.key),
    version = tile.preparationVersion;
  expect(field.updateSources([{ ...author(0, 100), revision: 20 }])).toEqual(
    [],
  );
  expect(field.atlas.sources.get(before.key)).toBe(copy);
  expect(field.metrics().pendingUploadBytes).toBe(0);
  expect(tile.preparationVersion).toBe(version);
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

it.each(["both", "neither", "rg-only"] as const)(
  "probes both actual RG32F and RGBA32F completeness and restores GL bindings (complete=%s)",
  (complete) => {
    const oldTexture = {},
      oldDraw = {},
      oldRead = {};
    const probeTexture = {},
      probeFramebuffer = {};
    let probes = 0;
    const gl = {
      TEXTURE_BINDING_2D: 1,
      DRAW_FRAMEBUFFER_BINDING: 2,
      READ_FRAMEBUFFER_BINDING: 3,
      TEXTURE_2D: 4,
      DRAW_FRAMEBUFFER: 5,
      READ_FRAMEBUFFER: 6,
      RG32F: 7,
      RG: 8,
      RGBA32F: 12,
      RGBA: 13,
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
      checkFramebufferStatus: () =>
        (++probes === 1 && complete === "rg-only") || complete === "both"
          ? 11
          : 12,
      deleteTexture: vi.fn(),
      deleteFramebuffer: vi.fn(),
    };
    expect(
      supportsHeightNumericTargets(gl as unknown as WebGL2RenderingContext),
    ).toBe(complete === "both");
    expect(gl.texImage2D.mock.calls.map((call) => call[2])).toEqual(
      complete === "neither" ? [gl.RG32F] : [gl.RG32F, gl.RGBA32F],
    );
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
