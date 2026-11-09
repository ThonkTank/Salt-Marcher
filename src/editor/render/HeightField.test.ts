import { afterEach, expect, it, vi } from "vitest";
import { BufferImageSource, type GlTexture, type WebGLRenderer } from "pixi.js";
import { heightTilesFromControls } from "../model/fixtures";
import { createHeightOverviewTile } from "../model/overview";
import { HeightField } from "./HeightField";
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

it("registers cold resources without payload and transfers each frame's actual bytes within its budget", () => {
  const { field, gpu } = setup();
  field.replaceSources(heightTilesFromControls(4, [[0, 0, 120]]));
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
  expect(gpu.render).toHaveBeenCalledTimes(40);
  expect(field.drawDirty(gpu.renderer)).toBe(0);
  expect(gpu.render).toHaveBeenCalledTimes(40);
});

it("uploads changed author windows while retaining unchanged axes and fine overview data", () => {
  const { field, gpu } = setup();
  field.replaceSources(heightTilesFromControls(4, [[0, 0, 120]]));
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
    field.replaceSources(heightTilesFromControls(4, [[0, 0, 120]]));
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
  field.replaceSources(heightTilesFromControls(4, [[0, 0, 120]]));
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
    field.replaceSources([author]);
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
