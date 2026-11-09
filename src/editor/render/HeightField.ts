import {
  GlProgram,
  Mesh,
  MeshGeometry,
  RenderTexture,
  Shader,
  Sprite,
  type WebGLRenderer,
} from "pixi.js";
import { prepareHeightGrid, type RasterRect } from "../model/height-grid";
import {
  HEIGHT_OVERVIEW_SIZE,
  minimumCoarseHeightLevel,
  type HeightOverviewTile,
} from "../model/overview";
import {
  heightTileSupport,
  intersectsBounds,
  type Bounds,
  type HeightTile,
} from "../model/types";
import {
  HEIGHT_ATLAS_WIDTH,
  HEIGHT_DESCRIPTOR_HEIGHT,
  HeightSourceAtlas,
  createHeightAxes,
  encodeHeightOverview,
  type HeightDescriptor,
} from "./height-field-data";
import {
  heightColourFragment,
  heightFragment,
  heightVertex,
} from "./height-shader";
import { HeightAtlasSource } from "./height-atlas-upload";
import { DISPLAY_HEIGHT_BOUNDARY_EPSILON, rasterize } from "./raster";

const SIZE = HEIGHT_OVERVIEW_SIZE;
const WHOLE: RasterRect = [0, 0, SIZE, SIZE];
/** Bound derived anchor chains; rebase from authors, never from clamped colours. */
export const MAX_HEIGHT_ANCHOR_PROMOTIONS = 32;
// Guard only the new anchor shortcut, not the established canonical GPU path.
// A projected level has twenty pair products and twenty pair additions. Reserve
// 256 unit-roundoff-squared units against its absolute coefficient magnitude,
// and eight for each anchor addition. This is an admission policy, not a proof
// about a driver's GLSL optimizer: adversarial CPU/GPU boundary references remain
// the acceptance test. Severe cancellation stays on the canonical GPU path.
const PAIR_PROJECTION_ERROR = 256 * 2 ** -48;
const PAIR_ADD_ERROR = 8 * 2 ** -48;
const ANCHOR_ERROR_BUDGET = DISPLAY_HEIGHT_BOUNDARY_EPSILON / 4;

export interface HeightCompositionStats {
  canonicalSamples: number;
  deltaSamples: number;
  colourSamples: number;
  anchorCopySamples: number;
}

/** Check the actual RG32F target and restore all touched GL bindings. */
export function supportsHeightNumericTargets(
  gl: WebGL2RenderingContext,
): boolean {
  if (!gl.getExtension("EXT_color_buffer_float")) return false;
  const textureBinding = gl.getParameter(
    gl.TEXTURE_BINDING_2D,
  ) as WebGLTexture | null;
  const drawBinding = gl.getParameter(
    gl.DRAW_FRAMEBUFFER_BINDING,
  ) as WebGLFramebuffer | null;
  const readBinding = gl.getParameter(
    gl.READ_FRAMEBUFFER_BINDING,
  ) as WebGLFramebuffer | null;
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  try {
    if (!texture || !framebuffer) return false;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 1, 1, 0, gl.RG, gl.FLOAT, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    return (
      gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    );
  } catch {
    return false;
  } finally {
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawBinding);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readBinding);
    gl.bindTexture(gl.TEXTURE_2D, textureBinding);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    if (texture) gl.deleteTexture(texture);
  }
}

export interface HeightGestureContext {
  id: number | string;
  level: number;
  /** Borrowed immutable document before-images; never mutate or transfer them. */
  before: ReadonlyMap<string, HeightTile | null>;
}

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
function geometry(): MeshGeometry {
  return new MeshGeometry({
    positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
}
function setRect(mesh: Mesh<MeshGeometry, Shader>, rect: RasterRect): void {
  const [x0, y0, x1, y1] = rect.map((value) => value / SIZE);
  const points = new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]);
  mesh.geometry.positions = points;
  mesh.geometry.uvs = points.slice();
}
function area(rect: RasterRect): number {
  return (rect[2] - rect[0]) * (rect[3] - rect[1]);
}

/** One numeric atlas and its bounded transfers, shared by dependent tiles only. */
class AtlasTransport {
  atlas = new HeightSourceAtlas();
  readonly source = numericSource(
    this.atlas.data,
    HEIGHT_ATLAS_WIDTH,
    this.atlas.height,
  );
  private pending: [number, number][] = [];
  get bytes(): number {
    return this.atlas.data.byteLength;
  }
  get pendingBytes(): number {
    return (
      this.atlas.pendingTexels * 8 +
      this.pending.reduce((sum, [from, to]) => sum + (to - from) * 8, 0)
    );
  }
  ready(pages: readonly string[]): boolean {
    if (!pages.length) return true;
    return (
      !this.atlas.pagesPending(pages) &&
      !this.atlas
        .pageRanges(pages)
        .some(([from, to]) => this.pending.some(([a, b]) => a < to && b > from))
    );
  }
  flush(maxBytes: number): number {
    const update = this.atlas.takeUpdates();
    this.source.resource = this.atlas.data;
    if (update.allocation) this.pending = update.ranges;
    else {
      const ranges = [...this.pending, ...update.ranges].sort(
        (a, b) => a[0] - b[0],
      );
      this.pending = [];
      for (const range of ranges) {
        const previous = this.pending.at(-1);
        if (previous && previous[1] >= range[0])
          previous[1] = Math.max(previous[1], range[1]);
        else this.pending.push([...range]);
      }
    }
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
    return bytes;
  }
  invalidate(): void {
    this.atlas.invalidateUploads();
    this.pending = [];
  }
  reset(): void {
    this.atlas = new HeightSourceAtlas();
    this.pending = [];
  }
}

/** Retained numeric sum plus a document-anchored, nonrecursive live delta. */
export class HeightFieldTile {
  readonly mesh: Sprite;
  private numericMesh: Mesh<MeshGeometry, Shader>;
  private colourMesh: Mesh<MeshGeometry, Shader>;
  private colour: RenderTexture;
  private numeric: RenderTexture;
  private anchor: RenderTexture;
  private descriptor: HeightDescriptor | null = null;
  private transport: AtlasTransport;
  private descriptorSource = numericSource(new Float32Array(4), 1, 1, true);
  private overviewSource = numericSource(new Float32Array(2), 1, 1);
  private weightSource = numericSource(new Float32Array(2), 1, 1);
  private fallbackSource = new HeightAtlasSource({
    resource: new Uint8Array(4),
    width: 1,
    height: 1,
    format: "rgba8unorm",
    scaleMode: "nearest",
    alphaMode: "no-premultiply-alpha",
    autoGarbageCollect: false,
  });
  private shader: Shader;
  private colourShader: Shader;
  private overview?: HeightOverviewTile;
  private overviewEncoded?: HeightOverviewTile;
  private overviewFallback = false;
  private weightsKey = "";
  private dirty = true;
  private overviewDirty = true;
  private weightsDirty = true;
  private fallbackDirty = false;
  private compositionDirty = true;
  private disposed = false;
  private rect: RasterRect = [...WHOLE];
  private numericValid = false;
  private anchorId: HeightGestureContext["id"] | null = null;
  private delta = false;
  private copyAnchor = false;
  private pendingFreeze = false;
  private promotions = 0;
  private numericMagnitude = 0;
  private numericError = 0;
  private anchorMagnitude = 0;
  private anchorError = 0;
  rebaseCount = 0;
  compositionStats: HeightCompositionStats = {
    canonicalSamples: 0,
    deltaSamples: 0,
    colourSamples: 0,
    anchorCopySamples: 0,
  };
  fallback = false;
  fallbackSamples = 0;

  constructor(
    private field: HeightField,
    readonly bounds: Bounds,
    readonly power: number,
    overview?: HeightOverviewTile,
  ) {
    this.transport = field.authors;
    const target = (numeric = false) =>
      RenderTexture.create({
        width: SIZE,
        height: SIZE,
        resolution: 1,
        format: numeric ? "rg32float" : "rgba8unorm",
        scaleMode: "nearest",
        antialias: false,
      });
    this.numeric = target(true);
    this.anchor = target(true);
    this.colour = target();
    this.shader = new Shader({
      glProgram: GlProgram.from({
        name: "atlas-height-sum",
        vertex: heightVertex,
        fragment: heightFragment,
        preferredFragmentPrecision: "highp",
      }),
      resources: {
        uAuthors: field.source,
        uDescriptor: this.descriptorSource,
        uOverview: this.overviewSource,
        uWeights: this.weightSource,
        uAnchor: this.anchor.source,
        heightUniforms: {
          uLevelCount: { value: 0, type: "i32" },
          uHasOverview: { value: 0, type: "i32" },
          uDelta: { value: 0, type: "i32" },
          uPageStride: { value: 3, type: "i32" },
          uDirty: { value: new Float32Array(WHOLE), type: "vec4<f32>" },
          uClip: { value: new Float32Array(WHOLE), type: "vec4<f32>" },
        },
      },
    });
    this.colourShader = new Shader({
      glProgram: GlProgram.from({
        name: "atlas-height-colour",
        vertex: heightVertex,
        fragment: heightColourFragment,
        preferredFragmentPrecision: "highp",
      }),
      resources: {
        uHeights: this.numeric.source,
        uFallbackPixels: this.fallbackSource,
        heightUniforms: {
          uFallback: { value: 0, type: "i32" },
          uClip: { value: new Float32Array(WHOLE), type: "vec4<f32>" },
        },
      },
    });
    this.numericMesh = new Mesh({ geometry: geometry(), shader: this.shader });
    this.colourMesh = new Mesh({
      geometry: geometry(),
      shader: this.colourShader,
    });
    this.numericMesh.scale.set(SIZE);
    this.colourMesh.scale.set(SIZE);
    // Numeric values are data; blending would destroy the signed low component.
    this.numericMesh.blendMode = "none";
    this.colourMesh.blendMode = "none";
    this.mesh = new Sprite(this.colour);
    this.update(overview ?? null);
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

  /** Only a fully composed preceding state can anchor the next document action. */
  beginGesture(id: HeightGestureContext["id"]): void {
    const usable =
      this.numericValid &&
      !this.compositionDirty &&
      !this.fallback &&
      this.promotions < MAX_HEIGHT_ANCHOR_PROMOTIONS &&
      this.numericError <= ANCHOR_ERROR_BUDGET;
    if (this.numericValid && this.promotions >= MAX_HEIGHT_ANCHOR_PROMOTIONS)
      this.rebaseCount++;
    this.anchorId = usable ? id : null;
    // Freeze lazily: an untouched tile must not promote its unused scratch
    // target when the user starts a gesture somewhere else.
    this.pendingFreeze = usable;
    this.releaseDescriptor();
  }

  invalidateAnchor(): void {
    this.anchorId = null;
    this.pendingFreeze = false;
    // A queued delta still binds the old baseline/source pages. Finished colour
    // tiles remain usable; unfinished work must be prepared canonically again.
    if (this.delta && this.compositionDirty) this.releaseDescriptor();
  }

  dependsOnAuthorLevel(level: number): boolean {
    return (
      level >= minimumCoarseHeightLevel(this.power) ||
      (this.delta && level === this.field.gesture?.level)
    );
  }

  private releaseDescriptor(): void {
    if (this.descriptor) this.transport.atlas.release(this.descriptor.pages);
    this.descriptor = null;
  }

  update(overview?: HeightOverviewTile | null, rect: RasterRect = WHOLE): void {
    if (this.disposed) return;
    if (overview !== undefined) this.overview = overview ?? undefined;
    this.rect = [...rect];
    const gesture = this.field.gesture;
    this.delta =
      this.field.numericSupported &&
      this.anchorId !== null &&
      this.anchorId === gesture?.id &&
      this.field.atlas.safeIn(this.bounds) &&
      this.field.deltaSafe(this.bounds);
    if (this.delta && this.pendingFreeze) {
      [this.anchor, this.numeric] = [this.numeric, this.anchor];
      this.shader.resources.uAnchor = this.anchor.source;
      this.colourShader.resources.uHeights = this.numeric.source;
      this.copyAnchor = true;
      this.anchorMagnitude = this.numericMagnitude;
      this.anchorError = this.numericError;
      this.pendingFreeze = false;
      this.promotions++;
    }
    if (this.delta) {
      const deltaMagnitude = this.field.deltas.atlas.magnitudeIn(this.bounds);
      this.numericMagnitude = this.anchorMagnitude + deltaMagnitude;
      this.numericError =
        this.anchorError +
        deltaMagnitude * PAIR_PROJECTION_ERROR +
        this.numericMagnitude * PAIR_ADD_ERROR;
      if (this.numericError > ANCHOR_ERROR_BUDGET) {
        this.delta = false;
        this.rebaseCount++;
      }
    }
    if (!this.delta) {
      const overviewMagnitude =
        this.overview?.values.reduce(
          (maximum, value) => Math.max(maximum, Math.abs(value) * 32),
          0,
        ) ?? 0;
      this.numericMagnitude =
        100 +
        this.field.atlas.magnitudeIn(
          this.bounds,
          minimumCoarseHeightLevel(this.power),
        ) +
        overviewMagnitude;
      this.numericError = this.numericMagnitude * PAIR_PROJECTION_ERROR;
    }
    const nextTransport = this.delta ? this.field.deltas : this.field.authors;
    let next: HeightDescriptor;
    try {
      next = nextTransport.atlas.descriptor(
        this.bounds,
        this.power,
        this.delta ? gesture!.level : undefined,
      );
    } catch (error) {
      if (!this.delta || !(error instanceof RangeError)) throw error;
      // An unusual tiny-author/coarse-display combination still renders the
      // canonical overview; do not change its display level or omit sources.
      this.delta = false;
      next = this.field.atlas.descriptor(this.bounds, this.power);
    }
    this.releaseDescriptor();
    this.transport = this.delta ? this.field.deltas : this.field.authors;
    this.descriptor = next;
    this.descriptorSource.resource = next.data;
    this.descriptorSource.resize(next.width, HEIGHT_DESCRIPTOR_HEIGHT);
    const weightsKey = next.levels.join(",");
    if (weightsKey !== this.weightsKey || this.weightSource.width === 1) {
      const axes = createHeightAxes(this.bounds, this.power, next.levels);
      this.weightSource.resource = axes.data;
      this.weightSource.resize(axes.width, axes.height);
      this.weightsKey = weightsKey;
      this.weightsDirty = true;
    }
    if (
      !this.delta &&
      (overview !== undefined || this.overviewEncoded !== this.overview)
    )
      this.encodeOverview();
    this.fallback =
      !this.field.numericSupported ||
      next.fallback ||
      (!this.delta && this.overviewFallback);
    if (!this.delta) this.invalidateAnchor();
    // Delta/anchor unsafe ranges retain the canonical path, including the
    // Float64 order of large cancelling values. Never clamp transport values.
    if (this.fallback && this.delta) {
      this.anchorId = null;
      this.update(undefined, rect);
      return;
    }
    if (this.fallback) this.updateFallback();
    if (!this.numericValid || !this.delta) this.rect = [...WHOLE];
    this.shader.resources.uAuthors = this.transport.source;
    const uniforms = this.shader.resources.heightUniforms.uniforms;
    uniforms.uLevelCount = next.levelCount;
    uniforms.uPageStride = next.pageStride;
    uniforms.uDelta = this.delta ? 1 : 0;
    uniforms.uHasOverview = !this.delta && this.overview ? 1 : 0;
    uniforms.uClip = new Float32Array(next.clip);
    uniforms.uDirty = new Float32Array(this.rect);
    this.colourShader.resources.heightUniforms.uniforms.uFallback = this
      .fallback
      ? 1
      : 0;
    this.colourShader.resources.heightUniforms.uniforms.uClip =
      new Float32Array(next.clip);
    this.dirty = true;
    this.compositionDirty = true;
  }

  private encodeOverview(): void {
    const encoded = this.overview
      ? encodeHeightOverview(this.overview.values)
      : { data: new Float32Array(2), fallback: false };
    this.overviewSource.resource = encoded.data;
    this.overviewSource.resize(
      this.overview ? SIZE : 1,
      this.overview ? SIZE : 1,
    );
    this.overviewFallback = encoded.fallback;
    this.overviewEncoded = this.overview;
    this.overviewDirty = true;
  }

  private updateFallback(): void {
    // The exceptional path recomputes canonical authors rather than applying a
    // mathematically equivalent but numerically different extreme-value delta.
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
    this.numericValid = false;
    this.anchorId = null;
  }

  flush(maxBytes = Infinity): number {
    if (this.disposed) return 0;
    let bytes = 0;
    const upload = (
      source: HeightAtlasSource,
      needed: boolean,
      done: () => void,
    ) => {
      const values = source.resource as Float32Array | Uint8Array;
      if (!needed || bytes + values.byteLength > maxBytes) return;
      source.uploadRange(0, source.width * source.height);
      bytes += values.byteLength;
      done();
    };
    upload(this.descriptorSource, this.dirty, () => {
      this.dirty = false;
    });
    upload(this.overviewSource, this.overviewDirty, () => {
      this.overviewDirty = false;
    });
    upload(this.weightSource, this.weightsDirty, () => {
      this.weightsDirty = false;
    });
    upload(this.fallbackSource, this.fallbackDirty, () => {
      this.fallbackDirty = false;
    });
    return bytes;
  }

  invalidateGPU(): void {
    this.numericValid = false;
    this.anchorId = null;
    this.copyAnchor = false;
    this.promotions = 0;
    this.dirty = true;
    this.overviewDirty = true;
    this.weightsDirty = true;
    this.fallbackDirty = true;
    this.compositionDirty = true;
    this.update(undefined, WHOLE);
  }

  get uploadReady(): boolean {
    return (
      this.descriptor !== null &&
      !this.pendingUploadBytes &&
      (this.fallback || this.transport.ready(this.descriptor.pages))
    );
  }
  /** A new gesture can release the sources of already queued composition. */
  get needsPreparation(): boolean {
    return this.descriptor === null;
  }
  get compositionWork(): number {
    return this.compositionDirty
      ? area(this.rect) * Math.max(1, this.descriptor?.levelCount ?? 1) +
          Math.ceil(
            (area(this.rect) +
              (this.delta && this.copyAnchor
                ? SIZE * SIZE - area(this.rect)
                : 0)) /
              16,
          )
      : 0;
  }
  get compositionLevels(): number {
    return this.descriptor?.levelCount ?? 0;
  }
  get usesAnchor(): boolean {
    return this.delta;
  }

  drawDirty(renderer: WebGLRenderer): number {
    if (!this.compositionDirty || this.disposed) return 0;
    if (!this.uploadReady)
      throw new Error(
        "Unvollständiger numerischer Höhenstand vor GPU-Zeichnung.",
      );
    const samples = area(this.rect);
    const stats = {
      canonicalSamples: !this.fallback && !this.delta ? samples : 0,
      deltaSamples: !this.fallback && this.delta ? samples : 0,
      colourSamples: samples,
      anchorCopySamples:
        !this.fallback && this.delta && this.copyAnchor
          ? SIZE * SIZE - samples
          : 0,
    };
    if (!this.fallback) {
      setRect(
        this.numericMesh,
        this.delta && !this.copyAnchor ? this.rect : WHOLE,
      );
      renderer.render({
        container: this.numericMesh,
        target: this.numeric,
        clear: !this.delta,
      });
    }
    setRect(this.colourMesh, this.rect);
    renderer.render({
      container: this.colourMesh,
      target: this.colour,
      clear: area(this.rect) === SIZE * SIZE,
    });
    this.numericValid = !this.fallback;
    if (!this.delta) this.promotions = 0;
    this.copyAnchor = false;
    this.compositionDirty = false;
    this.compositionStats = stats;
    return area(this.rect);
  }
  get needsComposition(): boolean {
    return this.compositionDirty;
  }
  get pendingUploadBytes(): number {
    return (
      (this.dirty ? this.descriptorSource.resource.byteLength : 0) +
      (this.overviewDirty ? this.overviewSource.resource.byteLength : 0) +
      (this.weightsDirty ? this.weightSource.resource.byteLength : 0) +
      (this.fallbackDirty ? this.fallbackSource.resource.byteLength : 0)
    );
  }
  get bytes(): number {
    return (
      this.descriptorSource.resource.byteLength +
      this.overviewSource.resource.byteLength +
      this.weightSource.resource.byteLength +
      this.fallbackSource.resource.byteLength
    );
  }
  get numericBytes(): number {
    return SIZE * SIZE * 8 * 2;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseDescriptor();
    this.mesh.destroy();
    this.numericMesh.geometry.destroy(true);
    this.numericMesh.destroy();
    this.colourMesh.geometry.destroy(true);
    this.colourMesh.destroy();
    this.colour.destroy(true);
    this.numeric.destroy(true);
    this.anchor.destroy(true);
    this.shader.destroy();
    this.colourShader.destroy();
    for (const source of [
      this.descriptorSource,
      this.overviewSource,
      this.weightSource,
      this.fallbackSource,
    ])
      source.destroy();
    this.field.tiles.delete(this);
  }
}

/** GPU data are a replaceable projection; document authors remain authoritative. */
export class HeightField {
  readonly authors = new AtlasTransport();
  readonly deltas = new AtlasTransport();
  get atlas(): HeightSourceAtlas {
    return this.authors.atlas;
  }
  get source(): HeightAtlasSource {
    return this.authors.source;
  }
  readonly tiles = new Set<HeightFieldTile>();
  gesture: HeightGestureContext | null = null;
  numericSupported = false;
  private localUpdate = false;
  private unsafeDelta = new Map<string, Bounds>();
  private renderer?: WebGLRenderer;

  init(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    // Tests retain the actual texture event boundary with a fake GL driver.
    this.numericSupported = renderer.gl
      ? supportsHeightNumericTargets(renderer.gl as WebGL2RenderingContext)
      : (renderer as WebGLRenderer & { atlasTestDriver?: boolean })
          .atlasTestDriver === true;
    this.initSource(this.source);
    this.initSource(this.deltas.source);
    for (const tile of this.tiles) tile.initSources();
  }
  initSource(source: HeightAtlasSource): void {
    this.renderer?.texture.initSource(source);
  }

  beginGesture(context: HeightGestureContext): void {
    this.localUpdate = true;
    if (this.gesture?.id === context.id) {
      this.gesture = context;
      return;
    }
    for (const tile of this.tiles) tile.beginGesture(context.id);
    this.gesture = context;
    this.deltas.reset();
    this.unsafeDelta.clear();
  }

  rebuildAfterContextRestore(): void {
    if (this.renderer?.gl)
      this.numericSupported = supportsHeightNumericTargets(
        this.renderer.gl as WebGL2RenderingContext,
      );
    this.authors.invalidate();
    this.deltas.invalidate();
    for (const tile of this.tiles) tile.invalidateGPU();
    this.initSource(this.source);
    this.initSource(this.deltas.source);
    for (const tile of this.tiles) tile.initSources();
  }

  updateSources(
    tiles: readonly HeightTile[],
    removed: readonly string[] = [],
  ): Bounds[] {
    const local = this.localUpdate;
    this.localUpdate = false;
    const previous = new Map(
      [...tiles.map((tile) => tile.key), ...removed].map((key) => [
        key,
        this.atlas.sources.get(key),
      ]),
    );
    const changed = this.atlas.updateSources(tiles, removed);
    if (!local) {
      const changedSources = [...previous].flatMap(([key, before]) => {
        const after = this.atlas.sources.get(key);
        return before === after ? [] : [after ?? before!];
      });
      for (const tile of this.tiles)
        if (
          changedSources.some(
            (source) =>
              tile.dependsOnAuthorLevel(source.level) &&
              intersectsBounds(heightTileSupport(source), tile.bounds),
          )
        )
          tile.invalidateAnchor();
      // Navigation may evict authors during a long gesture. Their deltas are
      // replaceable projections too; the document still owns the before-images
      // needed if a later local edit brings this source back into residency.
      this.deltas.atlas.updateSources([], removed);
      for (const key of removed) this.unsafeDelta.delete(key);
      return changed;
    }
    const gesture = this.gesture!;
    for (const key of new Set([...tiles.map((tile) => tile.key), ...removed])) {
      const before = gesture.before.get(key);
      const after = this.atlas.sources.get(key);
      const template = after ?? before;
      if (!template) continue;
      const values = new Float64Array(template.values.length);
      let unsafe = !gesture.before.has(key) || template.level !== gesture.level;
      for (let i = 0; i < values.length; i++) {
        const value = (after?.values[i] ?? 0) - (before?.values[i] ?? 0);
        if (!Number.isFinite(value)) unsafe = true;
        else values[i] = value;
      }
      if (unsafe) this.unsafeDelta.set(key, heightTileSupport(template));
      else this.unsafeDelta.delete(key);
      this.deltas.atlas.updateSources([{ ...template, values }]);
    }
    return changed;
  }
  deltaSafe(bounds: Bounds): boolean {
    return (
      this.deltas.atlas.safeIn(bounds) &&
      ![...this.unsafeDelta.values()].some((value) =>
        intersectsBounds(value, bounds),
      )
    );
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
    let bytes = 0;
    // Local deltas and tile descriptors precede unrelated cold author uploads.
    bytes += this.deltas.flush(maxBytes);
    for (const tile of this.tiles) bytes += tile.flush(maxBytes - bytes);
    bytes += this.authors.flush(maxBytes - bytes);
    return bytes;
  }
  drawDirty(renderer: WebGLRenderer): number {
    if (
      [...this.tiles].some((tile) => tile.needsComposition && !tile.uploadReady)
    )
      throw new Error("Höhenbild wartet noch auf numerische GPU-Daten.");
    let pixels = 0;
    for (const tile of this.tiles) pixels += tile.drawDirty(renderer);
    return pixels;
  }
  metrics() {
    const derived =
      this.authors.bytes +
      this.deltas.bytes +
      [...this.tiles].reduce((sum, tile) => sum + tile.bytes, 0);
    const sourceBytes = this.atlas.sourceBytes + this.deltas.atlas.sourceBytes;
    return {
      sourceBytes,
      gpuBytes:
        derived +
        [...this.tiles].reduce(
          (sum, tile) => sum + tile.numericBytes + SIZE * SIZE * 4,
          0,
        ),
      cpuBytes: sourceBytes + derived,
      sourceCount: this.atlas.sources.size,
      pages: this.atlas.pageCount + this.deltas.atlas.pageCount,
      fallbackTiles: [...this.tiles].filter((tile) => tile.fallback).length,
      fallbackSamples: [...this.tiles].reduce(
        (sum, tile) => sum + tile.fallbackSamples,
        0,
      ),
      pendingUploadBytes:
        this.authors.pendingBytes +
        this.deltas.pendingBytes +
        [...this.tiles].reduce((sum, tile) => sum + tile.pendingUploadBytes, 0),
      pendingCompositionTiles: [...this.tiles].filter(
        (tile) => tile.needsComposition,
      ).length,
      anchoredTiles: [...this.tiles].filter((tile) => tile.usesAnchor).length,
      anchorRebases: [...this.tiles].reduce(
        (sum, tile) => sum + tile.rebaseCount,
        0,
      ),
    };
  }
  reset(): void {
    for (const tile of [...this.tiles]) tile.destroy();
    this.authors.reset();
    this.deltas.reset();
    this.gesture = null;
    this.localUpdate = false;
    this.unsafeDelta.clear();
  }
  destroy(): void {
    this.reset();
    this.source.destroy();
    this.deltas.source.destroy();
  }
}
