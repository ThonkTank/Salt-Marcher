import {
  GlProgram,
  Mesh,
  MeshGeometry,
  RenderTexture,
  Shader,
  Sprite,
  type WebGLRenderer,
} from "pixi.js";
import { prepareHeightGrid } from "../model/height-grid";
import {
  HEIGHT_OVERVIEW_SIZE,
  minimumCoarseHeightLevel,
  type HeightOverviewTile,
} from "../model/overview";
import type { Bounds, HeightTile } from "../model/types";
import {
  HEIGHT_ATLAS_WIDTH,
  HEIGHT_DESCRIPTOR_HEIGHT,
  HEIGHT_DESCRIPTOR_WIDTH,
  HeightSourceAtlas,
  createHeightAxes,
  encodeHeightOverview,
  type HeightDescriptor,
} from "./height-field-data";
import { heightFragment, heightVertex } from "./height-shader";
import { HeightAtlasSource } from "./height-atlas-upload";
import { rasterize } from "./raster";

const SIZE = HEIGHT_OVERVIEW_SIZE;
const WHOLE: [number, number, number, number] = [0, 0, SIZE, SIZE];

function numericSource(
  data: Float32Array,
  width: number,
  height: number,
  rgba = false,
): HeightAtlasSource {
  return new HeightAtlasSource({
    resource: data,
    width,
    height,
    format: rgba ? "rgba32float" : "rg32float",
    scaleMode: "nearest",
    alphaMode: "no-premultiply-alpha",
    autoGarbageCollect: false,
  });
}

/** One regular 128² sample lattice, transformed by the ordinary Pixi scene. */
export class HeightFieldTile {
  readonly mesh: Sprite;
  private numericMesh: Mesh<MeshGeometry, Shader>;
  private colour: RenderTexture;
  private descriptor: HeightDescriptor;
  private descriptorSource: HeightAtlasSource;
  private overviewSource: HeightAtlasSource;
  private fallbackSource: HeightAtlasSource;
  private weightSource: HeightAtlasSource;
  private shader: Shader;
  private overview?: HeightOverviewTile;
  private overviewFallback = false;
  fallback = false;
  fallbackSamples = 0;
  private dirty = true;
  private overviewDirty = true;
  private weightsDirty = true;
  private fallbackDirty = false;
  private compositionDirty = true;
  private disposed = false;

  constructor(
    private field: HeightField,
    readonly bounds: Bounds,
    readonly power: number,
    overview?: HeightOverviewTile,
  ) {
    this.descriptor = field.atlas.descriptor(bounds, power);
    this.descriptorSource = numericSource(
      this.descriptor.data,
      HEIGHT_DESCRIPTOR_WIDTH,
      HEIGHT_DESCRIPTOR_HEIGHT,
      true,
    );
    this.overviewSource = numericSource(new Float32Array(2), 1, 1);
    const axes = createHeightAxes(bounds, power, this.descriptor.levels);
    this.weightSource = numericSource(axes.data, axes.width, axes.height);
    this.fallbackSource = new HeightAtlasSource({
      resource: new Uint8Array(4),
      width: 1,
      height: 1,
      format: "rgba8unorm",
      scaleMode: "nearest",
      alphaMode: "no-premultiply-alpha",
      autoGarbageCollect: false,
    });
    this.shader = new Shader({
      glProgram: GlProgram.from({
        name: "atlas-height-field",
        vertex: heightVertex,
        fragment: heightFragment,
        preferredFragmentPrecision: "highp",
      }),
      resources: {
        uAuthors: field.source,
        uDescriptor: this.descriptorSource,
        uOverview: this.overviewSource,
        uWeights: this.weightSource,
        uFallbackPixels: this.fallbackSource,
        heightUniforms: {
          uLevelCount: { value: this.descriptor.levelCount, type: "i32" },
          uFallback: { value: 0, type: "i32" },
          uHasOverview: { value: 0, type: "i32" },
          uClip: {
            value: new Float32Array(this.descriptor.clip),
            type: "vec4<f32>",
          },
        },
      },
    });
    this.numericMesh = new Mesh({
      geometry: new MeshGeometry({
        positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
      }),
      shader: this.shader,
    });
    this.numericMesh.scale.set(SIZE);
    this.colour = RenderTexture.create({
      width: SIZE,
      height: SIZE,
      resolution: 1,
      scaleMode: "nearest",
      antialias: false,
    });
    this.mesh = new Sprite(this.colour);
    this.updateOverview(overview);
    this.updateFallback();
    this.initSources();
  }

  initSources(): void {
    for (const source of [
      this.descriptorSource,
      this.overviewSource,
      this.weightSource,
      this.fallbackSource,
    ])
      this.field.initSource(source);
  }

  update(overview?: HeightOverviewTile | null): void {
    if (this.disposed) return;
    const next = this.field.atlas.descriptor(this.bounds, this.power);
    if (next.levels.join(",") !== this.descriptor.levels.join(",")) {
      const axes = createHeightAxes(this.bounds, this.power, next.levels);
      this.weightSource.resource = axes.data;
      this.weightSource.resize(axes.width, axes.height);
      this.weightsDirty = true;
    }
    this.field.atlas.release(this.descriptor.pages);
    this.descriptor = next;
    this.descriptorSource.resource = next.data;
    this.shader.resources.heightUniforms.uniforms.uLevelCount = next.levelCount;
    this.shader.resources.heightUniforms.uniforms.uClip = new Float32Array(
      next.clip,
    );
    if (overview !== undefined) this.updateOverview(overview ?? undefined);
    this.fallback = this.descriptor.fallback || this.overviewFallback;
    this.updateFallback();
    this.dirty = true;
    this.compositionDirty = true;
  }

  private updateOverview(overview?: HeightOverviewTile): void {
    this.overview = overview;
    const encoded = overview
      ? encodeHeightOverview(overview.values)
      : { data: new Float32Array(2), fallback: false };
    this.overviewSource.resource = encoded.data;
    this.overviewSource.resize(overview ? SIZE : 1, overview ? SIZE : 1);
    this.shader.resources.heightUniforms.uniforms.uHasOverview = overview
      ? 1
      : 0;
    this.overviewFallback = encoded.fallback;
    this.overviewDirty = true;
    this.fallback = this.descriptor.fallback || this.overviewFallback;
  }

  private updateFallback(): void {
    this.shader.resources.heightUniforms.uniforms.uFallback = this.fallback
      ? 1
      : 0;
    if (!this.fallback) return;
    const grid = prepareHeightGrid(
      [...this.field.atlas.sources.values()].filter(
        (tile) => tile.level >= minimumCoarseHeightLevel(this.power),
      ),
    );
    const pixels = rasterize(
      grid(this.bounds, SIZE, WHOLE),
      this.bounds,
      SIZE,
      WHOLE,
      this.overview?.values,
    );
    this.fallbackSamples += SIZE * SIZE;
    this.fallbackSource.resource = pixels;
    this.fallbackSource.resize(SIZE, SIZE);
    this.fallbackDirty = true;
  }

  flush(maxBytes = Infinity): number {
    if (this.disposed) return 0;
    let bytes = 0;
    if (this.dirty && this.descriptor.data.byteLength <= maxBytes) {
      this.descriptorSource.uploadRange(
        0,
        this.descriptorSource.width * this.descriptorSource.height,
      );
      this.dirty = false;
      bytes += this.descriptor.data.byteLength;
    }
    const overviewBytes =
      this.overviewSource.width * this.overviewSource.height * 8;
    if (this.overviewDirty && bytes + overviewBytes <= maxBytes) {
      this.overviewSource.uploadRange(
        0,
        this.overviewSource.width * this.overviewSource.height,
      );
      this.overviewDirty = false;
      bytes += overviewBytes;
    }
    const weightsBytes = this.weightSource.width * this.weightSource.height * 8;
    if (this.weightsDirty && bytes + weightsBytes <= maxBytes) {
      this.weightSource.uploadRange(
        0,
        this.weightSource.width * this.weightSource.height,
      );
      this.weightsDirty = false;
      bytes += weightsBytes;
    }
    const fallbackPixels =
      this.fallbackSource.width * this.fallbackSource.height;
    if (this.fallbackDirty && bytes + fallbackPixels * 4 <= maxBytes) {
      this.fallbackSource.uploadRange(0, fallbackPixels);
      this.fallbackDirty = false;
      bytes += fallbackPixels * 4;
    }
    return bytes;
  }

  /** Context loss invalidates derived GPU storage, never document sources. */
  invalidateGPU(): void {
    this.dirty = true;
    this.overviewDirty = true;
    this.weightsDirty = true;
    this.fallbackDirty = true;
    this.compositionDirty = true;
  }

  /** Numeric sources are shaded only when their retained display tile changes. */
  drawDirty(renderer: WebGLRenderer): number {
    if (!this.compositionDirty || this.disposed) return 0;
    if (this.pendingUploadBytes)
      throw new Error(
        "Unvollständiger numerischer Höhenstand vor GPU-Zeichnung.",
      );
    renderer.render({
      container: this.numericMesh,
      target: this.colour,
      clear: true,
    });
    this.compositionDirty = false;
    return SIZE * SIZE;
  }

  get needsComposition(): boolean {
    return this.compositionDirty;
  }

  get pendingUploadBytes(): number {
    return (
      (this.dirty ? this.descriptor.data.byteLength : 0) +
      (this.overviewDirty
        ? this.overviewSource.width * this.overviewSource.height * 8
        : 0) +
      (this.weightsDirty
        ? this.weightSource.width * this.weightSource.height * 8
        : 0) +
      (this.fallbackDirty
        ? this.fallbackSource.width * this.fallbackSource.height * 4
        : 0)
    );
  }

  get bytes(): number {
    return (
      this.descriptor.data.byteLength +
      this.overviewSource.width * this.overviewSource.height * 8 +
      this.weightSource.width * this.weightSource.height * 8 +
      this.fallbackSource.width * this.fallbackSource.height * 4
    );
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.field.atlas.release(this.descriptor.pages);
    this.mesh.destroy();
    this.numericMesh.geometry.destroy(true);
    this.numericMesh.destroy();
    this.colour.destroy(true);
    this.shader.destroy();
    this.descriptorSource.destroy();
    this.overviewSource.destroy();
    this.weightSource.destroy();
    this.fallbackSource.destroy();
    this.field.tiles.delete(this);
  }
}

/** Derived numeric GPU mirror; the CPU document remains the only author. */
export class HeightField {
  atlas = new HeightSourceAtlas();
  readonly source = new HeightAtlasSource({
    resource: this.atlas.data,
    width: HEIGHT_ATLAS_WIDTH,
    height: this.atlas.height,
    format: "rg32float",
    scaleMode: "nearest",
    alphaMode: "no-premultiply-alpha",
    autoGarbageCollect: false,
  });
  readonly tiles = new Set<HeightFieldTile>();
  private pending: [number, number][] = [];
  private renderer?: WebGLRenderer;

  /** Allocate/bind before the first bounded upload, never implicitly at draw. */
  init(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    this.initSource(this.source);
    for (const tile of this.tiles) tile.initSources();
  }

  initSource(source: HeightAtlasSource): void {
    this.renderer?.texture.initSource(source);
  }

  rebuildAfterContextRestore(): void {
    this.atlas.invalidateUploads();
    this.pending = [];
    this.source.resource = this.atlas.data;
    for (const tile of this.tiles) tile.invalidateGPU();
    // All invalidation precedes registration, so even a failed registration
    // retains complete retry intent. Actual transfers stay in bounded flush().
    this.initSource(this.source);
    for (const tile of this.tiles) tile.initSources();
  }

  replaceSources(tiles: readonly HeightTile[]): void {
    this.atlas.replaceSources(tiles);
  }

  updateSources(
    tiles: readonly HeightTile[],
    removed: readonly string[] = [],
  ): void {
    this.atlas.updateSources(tiles, removed);
  }

  createTile(
    bounds: Bounds,
    power: number,
    overview?: HeightOverviewTile,
  ): HeightFieldTile {
    const tile = new HeightFieldTile(this, bounds, power, overview);
    this.tiles.add(tile);
    return tile;
  }

  flush(maxBytes = Infinity): number {
    const update = this.atlas.takeUpdates();
    this.source.resource = this.atlas.data;
    if (update.allocation) this.pending = update.ranges;
    else {
      const all = [...this.pending, ...update.ranges].sort(
        (a, b) => a[0] - b[0],
      );
      this.pending = [];
      for (const range of all) {
        const previous = this.pending.at(-1);
        if (previous && previous[1] >= range[0])
          previous[1] = Math.max(previous[1], range[1]);
        else this.pending.push([...range]);
      }
    }
    // Keep the complete upload intent if allocation or an individual transfer
    // fails. Retrying the same immutable values is safe.
    this.source.resize(HEIGHT_ATLAS_WIDTH, this.atlas.height);
    let bytes = 0;
    while (this.pending.length && bytes + 8 <= maxBytes) {
      const range = this.pending[0];
      const end = Math.min(
        range[1],
        range[0] + Math.floor((maxBytes - bytes) / 8),
      );
      this.source.uploadRange(range[0], end);
      bytes += (end - range[0]) * 8;
      if (end === range[1]) this.pending.shift();
      else range[0] = end;
    }
    for (const tile of this.tiles) bytes += tile.flush(maxBytes - bytes);
    return bytes;
  }

  drawDirty(renderer: WebGLRenderer): number {
    if (this.metrics().pendingUploadBytes)
      throw new Error("Höhenbild wartet noch auf numerische GPU-Daten.");
    let pixels = 0;
    for (const tile of this.tiles) pixels += tile.drawDirty(renderer);
    return pixels;
  }

  metrics(): {
    sourceBytes: number;
    gpuBytes: number;
    cpuBytes: number;
    sourceCount: number;
    pages: number;
    fallbackTiles: number;
    fallbackSamples: number;
    pendingUploadBytes: number;
    pendingCompositionTiles: number;
  } {
    const derived =
      this.atlas.data.byteLength +
      [...this.tiles].reduce((sum, tile) => sum + tile.bytes, 0);
    return {
      sourceBytes: this.atlas.sourceBytes,
      gpuBytes: derived + this.tiles.size * SIZE * SIZE * 4,
      cpuBytes: this.atlas.sourceBytes + derived,
      sourceCount: this.atlas.sources.size,
      pages: this.atlas.pageCount,
      fallbackTiles: [...this.tiles].filter((tile) => tile.fallback).length,
      fallbackSamples: [...this.tiles].reduce(
        (sum, tile) => sum + tile.fallbackSamples,
        0,
      ),
      pendingUploadBytes:
        this.atlas.pendingTexels * 8 +
        this.pending.reduce(
          (sum, range) => sum + (range[1] - range[0]) * 8,
          0,
        ) +
        [...this.tiles].reduce((sum, tile) => sum + tile.pendingUploadBytes, 0),
      pendingCompositionTiles: [...this.tiles].filter(
        (tile) => tile.needsComposition,
      ).length,
    };
  }

  reset(): void {
    for (const tile of [...this.tiles]) tile.destroy();
    this.atlas = new HeightSourceAtlas();
    this.pending = [];
  }

  destroy(): void {
    this.reset();
    this.source.destroy();
  }
}
