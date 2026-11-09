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
  type HeightPatch,
  type HeightTile,
} from "../model/types";
import {
  HEIGHT_ATLAS_WIDTH,
  HEIGHT_DESCRIPTOR_HEIGHT,
  HEIGHT_DESCRIPTOR_WIDTH,
  HEIGHT_GPU_MAX_SCALED_VALUE,
  HeightSourceAtlas,
  createHeightAxes,
  createHeightProjection,
  encodeHeightOverview,
  type HeightDescriptor,
} from "./height-field-data";
import {
  heightColourFragment,
  heightFragment,
  heightHorizontalFragment,
  heightVertex,
} from "./height-shader";
import { HeightAtlasSource } from "./height-atlas-upload";
import { DISPLAY_HEIGHT_BOUNDARY_EPSILON, rasterize } from "./raster";

const SIZE = HEIGHT_OVERVIEW_SIZE;
const WHOLE: RasterRect = [0, 0, SIZE, SIZE];
/** Only actual derived basis transfers count, never same-level gestures. */
export const MAX_HEIGHT_BASIS_TRANSFERS = 32;
// Guard only the fixed-basis shortcut, not the established canonical GPU path.
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
  basisCaptureSamples: number;
  canonicalBasisBuilds: number;
  horizontalSamples: number;
  /** Scheduled pair products; absent source pages may skip their zero products. */
  projectionProducts: number;
}

/** Check both actual float targets and restore all touched GL bindings. */
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
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
    for (const [internal, format] of [
      [gl.RG32F, gl.RG],
      [gl.RGBA32F, gl.RGBA],
    ]) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internal,
        1,
        1,
        0,
        format,
        gl.FLOAT,
        null,
      );
      gl.framebufferTexture2D(
        gl.DRAW_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      if (
        gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) !==
        gl.FRAMEBUFFER_COMPLETE
      )
        return false;
    }
    return true;
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

/** Retained unclamped total and one fixed active-level projection basis. */
export class HeightFieldTile {
  readonly mesh: Sprite;
  private numericMesh: Mesh<MeshGeometry, Shader>;
  private horizontalMesh: Mesh<MeshGeometry, Shader>;
  private colourMesh: Mesh<MeshGeometry, Shader>;
  private colour: RenderTexture;
  private numeric: RenderTexture;
  private basis: RenderTexture;
  private horizontal: RenderTexture;
  private horizontalRows = 1;
  private horizontalSamples = 0;
  private axes = { data: new Float32Array(2), width: 1, height: 1 };
  private descriptor: HeightDescriptor | null = null;
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
  private horizontalShader: Shader;
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
  private mode: "canonical" | "live" | "capture" = "canonical";
  private numericValid = false;
  // Source changes may leave a perfectly displayed preceding state, but that H
  // must not be paired with C from the new state during a cheap basis capture.
  private numericCurrent = false;
  private currentIsBasis = true;
  private basisValid = false;
  private basisLevel = -1;
  private numericMagnitude = 0;
  private numericError = 0;
  private numericDepth = 0;
  private basisMagnitude = 0;
  private basisError = 0;
  private basisContribution = 0;
  private basisDepth = 0;
  private plannedMagnitude = 0;
  private plannedError = 0;
  private plannedContribution = 0;
  private plannedBasis = false;
  private plannedDepth = 0;
  private plannedRebase = false;
  /** These versions identify preparation independently of document revisions. */
  preparationVersion = 0;
  preparedVersion = -1;
  rebaseCount = 0;
  compositionStats: HeightCompositionStats = {
    canonicalSamples: 0,
    deltaSamples: 0,
    colourSamples: 0,
    anchorCopySamples: 0,
    basisCaptureSamples: 0,
    canonicalBasisBuilds: 0,
    horizontalSamples: 0,
    projectionProducts: 0,
  };
  fallback = false;
  fallbackSamples = 0;

  constructor(
    private field: HeightField,
    readonly bounds: Bounds,
    readonly power: number,
    overview?: HeightOverviewTile,
  ) {
    const target = (
      format: "rg32float" | "rgba32float" | "rgba8unorm",
      height = SIZE,
    ) =>
      RenderTexture.create({
        width: SIZE,
        height,
        resolution: 1,
        format,
        scaleMode: "nearest",
        antialias: false,
        alphaMode: "no-premultiply-alpha",
      });
    this.numeric = target("rgba32float");
    this.basis = target("rgba32float");
    this.horizontal = target("rg32float", 1);
    this.colour = target("rgba8unorm");
    this.shader = new Shader({
      glProgram: GlProgram.from({
        name: "atlas-height-sum",
        vertex: heightVertex,
        fragment: heightFragment,
        preferredFragmentPrecision: "highp",
      }),
      resources: {
        uHorizontal: this.horizontal.source,
        uDescriptor: this.descriptorSource,
        uOverview: this.overviewSource,
        uWeights: this.weightSource,
        uReference: this.numeric.source,
        heightUniforms: {
          uLevelCount: { value: 0, type: "i32" },
          uHasOverview: { value: 0, type: "i32" },
          uMode: { value: 0, type: "i32" },
          uActiveLevel: { value: 0, type: "i32" },
          uMinimumLevel: { value: 0, type: "i32" },
          uPageStride: { value: 3, type: "i32" },
          uPageColumns: { value: HEIGHT_DESCRIPTOR_WIDTH - 1, type: "i32" },
          uDirty: { value: new Float32Array(WHOLE), type: "vec4<f32>" },
          uClip: { value: new Float32Array(WHOLE), type: "vec4<f32>" },
        },
      },
    });
    this.horizontalShader = new Shader({
      glProgram: GlProgram.from({
        name: "atlas-height-horizontal",
        vertex: heightVertex,
        fragment: heightHorizontalFragment,
        preferredFragmentPrecision: "highp",
      }),
      resources: {
        uAuthors: field.source,
        uDescriptor: this.descriptorSource,
        uWeights: this.weightSource,
        heightUniforms: {
          uPageStride: { value: 3, type: "i32" },
          uPageColumns: { value: HEIGHT_DESCRIPTOR_WIDTH - 1, type: "i32" },
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
        uHeights: this.basis.source,
        uFallbackPixels: this.fallbackSource,
        heightUniforms: {
          uFallback: { value: 0, type: "i32" },
          uClip: { value: new Float32Array(WHOLE), type: "vec4<f32>" },
        },
      },
    });
    this.numericMesh = new Mesh({ geometry: geometry(), shader: this.shader });
    this.horizontalMesh = new Mesh({
      geometry: geometry(),
      shader: this.horizontalShader,
    });
    this.colourMesh = new Mesh({
      geometry: geometry(),
      shader: this.colourShader,
    });
    this.numericMesh.scale.set(SIZE);
    this.colourMesh.scale.set(SIZE);
    // A directly rendered root keeps groupBlendMode="normal" in Pixi. Its
    // Container.blendMode alone therefore does not disable MeshPipe blending.
    // Alpha is a signed residual in the numeric targets: enforce actual state.
    this.numericMesh.state.blend = false;
    this.horizontalMesh.state.blend = false;
    this.colourMesh.state.blend = false;
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

  /** A changed strategy needs its own completed frame, even at the same revision. */
  invalidateBasis(totalChanged = false): void {
    if (totalChanged) this.numericCurrent = false;
    this.basisValid = false;
    this.preparationVersion++;
    this.compositionDirty = true;
    this.releaseDescriptor();
  }
  invalidateTotal(): void {
    this.invalidateBasis(true);
  }
  /** WorldRenderer owns the actual changed pixel area, not whole author pages. */
  markHeightChanged(): void {
    this.numericCurrent = false;
  }
  dependsOnAuthorLevel(level: number): boolean {
    return (
      level >= minimumCoarseHeightLevel(this.power) ||
      level === this.field.toolLevel
    );
  }
  /** Local authors retain their fixed resident subset, including new zero-based sources. */
  acceptLocalChanges(
    changes: readonly { level: number; missingBefore: boolean }[],
  ): void {
    if (
      changes.some(
        ({ level, missingBefore }) =>
          missingBefore || (this.basisValid && level !== this.basisLevel),
      )
    )
      this.invalidateTotal();
  }
  private releaseDescriptor(): void {
    if (this.descriptor) this.field.atlas.release(this.descriptor.pages);
    this.descriptor = null;
  }

  private liveError(
    heightMagnitude: number,
    heightError: number,
    before: number,
    current: number,
  ): number {
    // Independently projected C_before and C_current, their subtraction, then H+delta.
    // This error is always measured against the fixed basis, never the last dose.
    return (
      heightError +
      (before + current) * PAIR_PROJECTION_ERROR +
      (before + current) * PAIR_ADD_ERROR +
      (heightMagnitude + before + current) * PAIR_ADD_ERROR
    );
  }
  private admitsBasis(
    heightMagnitude: number,
    heightError: number,
    before: number,
    current: number,
  ): boolean {
    return (
      before + current <= HEIGHT_GPU_MAX_SCALED_VALUE * 32 &&
      this.liveError(heightMagnitude, heightError, before, current) <=
        ANCHOR_ERROR_BUDGET
    );
  }

  update(overview?: HeightOverviewTile | null, rect: RasterRect = WHOLE): void {
    if (this.disposed) return;
    if (overview !== undefined) this.overview = overview ?? undefined;
    if (overview !== undefined || this.overviewEncoded !== this.overview)
      this.encodeOverview();
    const level = this.field.toolLevel;
    const minimum = minimumCoarseHeightLevel(this.power);
    const activeMagnitude = this.field.atlas.magnitudeIn(
      this.bounds,
      level,
      level,
    );
    const activeSafe = this.field.atlas.safeIn(this.bounds, level, level);
    const overviewMagnitude =
      this.overview?.values.reduce(
        (maximum, value) => Math.max(maximum, Math.abs(value) * 32),
        0,
      ) ?? 0;
    const canonicalMagnitude =
      100 +
      this.field.atlas.magnitudeIn(this.bounds, minimum) +
      overviewMagnitude;
    const canonicalError = canonicalMagnitude * PAIR_PROJECTION_ERROR;
    this.mode = "canonical";
    this.plannedRebase = false;
    if (this.field.numericSupported && activeSafe) {
      if (
        this.basisValid &&
        this.basisLevel === level &&
        this.admitsBasis(
          this.basisMagnitude,
          this.basisError,
          this.basisContribution,
          activeMagnitude,
        )
      ) {
        this.mode = "live";
      } else if (
        !this.basisValid &&
        this.numericValid &&
        this.numericCurrent &&
        this.numericDepth < MAX_HEIGHT_BASIS_TRANSFERS &&
        this.admitsBasis(
          this.numericMagnitude,
          this.numericError,
          activeMagnitude,
          activeMagnitude,
        )
      ) {
        this.mode = "capture";
      }
    }
    const planCanonical = () => {
      this.mode = "canonical";
      this.plannedMagnitude = canonicalMagnitude;
      this.plannedError = canonicalError;
      this.plannedDepth = 0;
      this.plannedBasis =
        this.field.numericSupported &&
        activeSafe &&
        this.admitsBasis(
          canonicalMagnitude,
          canonicalError,
          activeMagnitude,
          activeMagnitude,
        );
      this.plannedRebase =
        this.numericValid &&
        this.numericCurrent &&
        this.numericDepth >= MAX_HEIGHT_BASIS_TRANSFERS;
    };
    if (this.mode === "canonical") planCanonical();
    else if (this.mode === "capture") {
      this.plannedMagnitude = this.numericMagnitude;
      this.plannedError = this.numericError;
      this.plannedDepth = this.numericDepth + 1;
      this.plannedBasis = true;
    } else {
      this.plannedMagnitude =
        this.basisMagnitude + this.basisContribution + activeMagnitude;
      this.plannedError = this.liveError(
        this.basisMagnitude,
        this.basisError,
        this.basisContribution,
        activeMagnitude,
      );
      this.plannedDepth = this.basisDepth;
      this.plannedBasis = true;
    }
    this.plannedContribution = activeMagnitude;
    let next: HeightDescriptor;
    try {
      next = this.field.atlas.descriptor(
        this.bounds,
        this.power,
        this.mode === "canonical"
          ? { include: this.plannedBasis ? level : undefined }
          : { minimum: level, maximum: level },
      );
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      // A very fine tool on a coarse display keeps its canonical overview path.
      planCanonical();
      this.plannedBasis = false;
      next = this.field.atlas.descriptor(this.bounds, this.power);
    }
    this.fallback =
      !this.field.numericSupported ||
      next.fallback ||
      (this.mode === "canonical" && this.overviewFallback);
    if (this.fallback && (this.mode !== "canonical" || this.plannedBasis)) {
      this.field.atlas.release(next.pages);
      planCanonical();
      this.plannedBasis = false;
      next = this.field.atlas.descriptor(this.bounds, this.power);
      this.fallback =
        !this.field.numericSupported || next.fallback || this.overviewFallback;
    }
    this.releaseDescriptor();
    this.descriptor = next;
    this.descriptorSource.resource = next.data;
    this.descriptorSource.resize(next.width, HEIGHT_DESCRIPTOR_HEIGHT);
    const weightsKey = next.levels.join(",");
    if (weightsKey !== this.weightsKey || this.weightSource.width === 1) {
      this.axes = createHeightAxes(this.bounds, this.power, next.levels);
      this.weightSource.resource = this.axes.data;
      this.weightSource.resize(this.axes.width, this.axes.height);
      this.weightsKey = weightsKey;
      this.weightsDirty = true;
    }
    if (this.fallback) {
      this.plannedBasis = false;
      this.updateFallback();
    }
    this.rect = this.mode === "live" ? [...rect] : [...WHOLE];
    // Fallback decisions precede the scratch layout: no canonical whole draw
    // may read horizontal rows prepared only for the original dirty rectangle.
    const projection = createHeightProjection(next, this.axes, this.rect);
    this.horizontalRows = Math.max(1, next.horizontalRows);
    this.horizontalSamples = this.fallback ? 0 : projection.samples;
    this.horizontal.resize(SIZE, this.horizontalRows);
    this.horizontalMesh.scale.set(SIZE, this.horizontalRows);
    this.horizontalMesh.geometry.positions = projection.positions;
    this.horizontalMesh.geometry.uvs = projection.uvs;
    this.horizontalMesh.geometry.indices = projection.indices;
    const horizontalUniforms =
      this.horizontalShader.resources.heightUniforms.uniforms;
    horizontalUniforms.uPageStride = next.pageStride;
    horizontalUniforms.uPageColumns = next.width - 1;
    const uniforms = this.shader.resources.heightUniforms.uniforms;
    uniforms.uLevelCount = next.levelCount;
    uniforms.uPageStride = next.pageStride;
    uniforms.uPageColumns = next.width - 1;
    uniforms.uMode =
      this.mode === "canonical" ? 0 : this.mode === "live" ? 1 : 2;
    uniforms.uActiveLevel = level;
    uniforms.uMinimumLevel = minimum;
    uniforms.uHasOverview = this.mode === "canonical" && this.overview ? 1 : 0;
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
    // Preserve the canonical Float64 reconstruction and summation order.
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
    this.currentIsBasis = true;
    this.numericDepth = 0;
    this.invalidateTotal();
    this.dirty =
      this.overviewDirty =
      this.weightsDirty =
      this.fallbackDirty =
        true;
    this.update(undefined, WHOLE);
  }
  get uploadReady(): boolean {
    return (
      this.descriptor !== null &&
      !this.pendingUploadBytes &&
      (this.fallback || this.field.authors.ready(this.descriptor.pages))
    );
  }
  get needsPreparation(): boolean {
    return this.descriptor === null;
  }
  get compositionWork(): number {
    if (!this.compositionDirty) return 0;
    const copy =
      this.mode === "live" && this.currentIsBasis
        ? SIZE * SIZE - area(this.rect)
        : 0;
    const colour = this.mode === "capture" ? 0 : area(this.rect);
    // Same twenty-pair-product unit as the original cubic budget. Capture
    // reads and first-live copies are real work, separately included and counted.
    const capture = this.mode === "capture" ? SIZE * SIZE : 0;
    // Extra pair additions have no matching product: live subtracts C_basis
    // and adds H_basis; canonical coarse capture also accumulates C separately.
    // Charge each conservatively as another product-and-add work unit.
    const basisAdds =
      this.mode === "live"
        ? 2 * area(this.rect)
        : this.mode === "canonical" &&
            this.field.toolLevel >= minimumCoarseHeightLevel(this.power) &&
            this.descriptor?.levels.includes(this.field.toolLevel)
          ? 4 * area(this.rect)
          : 0;
    return (
      (this.fallback
        ? area(this.rect) * Math.max(1, this.descriptor?.levelCount ?? 1)
        : Math.ceil((this.projectionProducts + basisAdds) / 20)) +
      Math.ceil((colour + copy + capture) / 16)
    );
  }
  get compositionLevels(): number {
    return this.descriptor?.levelCount ?? 0;
  }
  private get projectionProducts(): number {
    return this.fallback
      ? 0
      : 4 *
          (this.horizontalSamples +
            area(this.rect) * (this.descriptor?.levelCount ?? 0));
  }
  get usesAnchor(): boolean {
    return this.mode === "live";
  }
  get hasBasis(): boolean {
    return this.basisValid;
  }
  get basisTransfers(): number {
    return this.numericDepth;
  }

  drawDirty(renderer: WebGLRenderer): number {
    if (!this.compositionDirty || this.disposed) return 0;
    if (!this.uploadReady)
      throw new Error(
        "Unvollständiger numerischer Höhenstand vor GPU-Zeichnung.",
      );
    const samples = area(this.rect);
    const firstLive = this.mode === "live" && this.currentIsBasis;
    const stats: HeightCompositionStats = {
      canonicalSamples:
        !this.fallback && this.mode === "canonical" ? samples : 0,
      deltaSamples: !this.fallback && this.mode === "live" ? samples : 0,
      colourSamples: this.mode === "capture" ? 0 : samples,
      anchorCopySamples:
        !this.fallback && firstLive ? SIZE * SIZE - samples : 0,
      basisCaptureSamples: this.mode === "capture" ? samples : 0,
      canonicalBasisBuilds:
        !this.fallback && this.mode === "canonical" && this.plannedBasis
          ? 1
          : 0,
      horizontalSamples: this.horizontalSamples,
      projectionProducts: this.projectionProducts,
    };
    if (!this.fallback) {
      if (this.horizontalSamples)
        renderer.render({
          container: this.horizontalMesh,
          target: this.horizontal,
          clear: false,
        });
      // The sampled texture is always distinct from this pass's attachment.
      const swapAfterCapture = this.mode === "capture" && this.currentIsBasis;
      const target =
        this.mode === "live" || swapAfterCapture ? this.numeric : this.basis;
      this.shader.resources.uReference =
        this.mode === "live" || swapAfterCapture
          ? this.basis.source
          : this.numeric.source;
      setRect(
        this.numericMesh,
        this.mode === "live" && !firstLive ? this.rect : WHOLE,
      );
      renderer.render({
        container: this.numericMesh,
        target,
        clear: this.mode !== "live",
      });
      this.colourShader.resources.uHeights = target.source;
      // Do not promote an unwritten target if the GL submission throws.
      if (swapAfterCapture)
        [this.basis, this.numeric] = [this.numeric, this.basis];
    }
    if (this.mode !== "capture") {
      setRect(this.colourMesh, this.rect);
      renderer.render({
        container: this.colourMesh,
        target: this.colour,
        clear: samples === SIZE * SIZE,
      });
    }
    this.numericValid = !this.fallback;
    this.numericCurrent = true;
    this.numericMagnitude = this.plannedMagnitude;
    this.numericError = this.plannedError;
    this.numericDepth = this.plannedDepth;
    if (this.mode !== "live") {
      this.basisValid = this.plannedBasis && !this.fallback;
      this.basisLevel = this.field.toolLevel;
      this.basisMagnitude = this.plannedMagnitude;
      this.basisError = this.plannedError;
      this.basisContribution = this.plannedContribution;
      this.basisDepth = this.plannedDepth;
    }
    this.currentIsBasis = this.mode !== "live";
    if (this.plannedRebase) this.rebaseCount++;
    this.preparedVersion = this.preparationVersion;
    this.compositionDirty = false;
    this.compositionStats = stats;
    return samples;
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
    return SIZE * SIZE * 16 * 2 + SIZE * this.horizontalRows * 8;
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseDescriptor();
    this.mesh.destroy();
    for (const mesh of [
      this.numericMesh,
      this.horizontalMesh,
      this.colourMesh,
    ]) {
      mesh.geometry.destroy(true);
      mesh.destroy();
    }
    for (const target of [
      this.colour,
      this.numeric,
      this.horizontal,
      this.basis,
    ])
      target.destroy(true);
    this.shader.destroy();
    this.horizontalShader.destroy();
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
  get atlas(): HeightSourceAtlas {
    return this.authors.atlas;
  }
  get source(): HeightAtlasSource {
    return this.authors.source;
  }
  readonly tiles = new Set<HeightFieldTile>();
  toolLevel = 0;
  numericSupported = false;
  private renderer?: WebGLRenderer;

  init(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    this.numericSupported = renderer.gl
      ? supportsHeightNumericTargets(renderer.gl as WebGL2RenderingContext)
      : (renderer as WebGLRenderer & { atlasTestDriver?: boolean })
          .atlasTestDriver === true;
    this.initSource(this.source);
    for (const tile of this.tiles) tile.initSources();
  }
  initSource(source: HeightAtlasSource): void {
    this.renderer?.texture.initSource(source);
  }
  setToolLevel(level: number): boolean {
    if (!Number.isInteger(level) || level < 0 || level > 21)
      throw new Error("Ungültige Werkzeugstufe.");
    if (level === this.toolLevel) return false;
    this.toolLevel = level;
    for (const tile of this.tiles) tile.invalidateBasis();
    return true;
  }
  rebuildAfterContextRestore(): void {
    if (this.renderer?.gl)
      this.numericSupported = supportsHeightNumericTargets(
        this.renderer.gl as WebGL2RenderingContext,
      );
    this.authors.invalidate();
    for (const tile of this.tiles) tile.invalidateGPU();
    this.initSource(this.source);
    for (const tile of this.tiles) tile.initSources();
  }

  /** Imports/evictions alter the resident subset used by a fixed contribution. */
  updateSources(
    tiles: readonly HeightTile[],
    removed: readonly string[] = [],
  ): Bounds[] {
    return this.mergeSources(tiles, removed);
  }
  /** Before-images are consulted synchronously only to distinguish history from new zero authors. */
  applySourcePatches(patches: readonly HeightPatch[]): Bounds[] {
    return this.mergeSources(
      patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
      patches.filter((patch) => !patch.after).map((patch) => patch.key),
      new Map(patches.map((patch) => [patch.key, patch])),
    );
  }
  private mergeSources(
    tiles: readonly HeightTile[],
    removed: readonly string[],
    patches?: ReadonlyMap<string, HeightPatch>,
  ): Bounds[] {
    const previous = new Map(
      [...tiles.map((tile) => tile.key), ...removed].map((key) => [
        key,
        this.atlas.sources.get(key),
      ]),
    );
    const bounds = this.atlas.updateSources(tiles, removed);
    const changes = [...previous].flatMap(([key, before]) => {
      const after = this.atlas.sources.get(key);
      const patchBefore = patches?.get(key)?.before;
      const missingBefore = Boolean(patchBefore && !before);
      // Undo may delete a fine author that only the overview represents. Its
      // absent atlas entry is not evidence that its actual contribution was zero.
      return before === after && !missingBefore
        ? []
        : [{ source: after ?? before ?? patchBefore!, missingBefore }];
    });
    for (const tile of this.tiles) {
      const relevant = changes.filter(({ source }) =>
        intersectsBounds(heightTileSupport(source), tile.bounds),
      );
      if (patches) {
        if (relevant.length)
          tile.acceptLocalChanges(
            relevant.map(({ source, missingBefore }) => ({
              level: source.level,
              missingBefore,
            })),
          );
      } else {
        const dependencies = relevant.filter(({ source }) =>
          tile.dependsOnAuthorLevel(source.level),
        );
        if (dependencies.length)
          tile.invalidateBasis(
            dependencies.some(
              ({ source }) =>
                source.level >= minimumCoarseHeightLevel(tile.power),
            ),
          );
      }
    }
    return bounds;
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
      [...this.tiles].reduce((sum, tile) => sum + tile.bytes, 0);
    const sourceBytes = this.atlas.sourceBytes;
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
      pages: this.atlas.pageCount,
      fallbackTiles: [...this.tiles].filter((tile) => tile.fallback).length,
      fallbackSamples: [...this.tiles].reduce(
        (sum, tile) => sum + tile.fallbackSamples,
        0,
      ),
      pendingUploadBytes:
        this.authors.pendingBytes +
        [...this.tiles].reduce((sum, tile) => sum + tile.pendingUploadBytes, 0),
      pendingCompositionTiles: [...this.tiles].filter(
        (tile) => tile.needsComposition,
      ).length,
      anchoredTiles: [...this.tiles].filter((tile) => tile.hasBasis).length,
      anchorRebases: [...this.tiles].reduce(
        (sum, tile) => sum + tile.rebaseCount,
        0,
      ),
      basisTransfers: Math.max(
        0,
        ...[...this.tiles].map((tile) => tile.basisTransfers),
      ),
    };
  }
  reset(): void {
    for (const tile of [...this.tiles]) tile.destroy();
    this.authors.reset();
  }
  destroy(): void {
    this.reset();
    this.source.destroy();
  }
}
