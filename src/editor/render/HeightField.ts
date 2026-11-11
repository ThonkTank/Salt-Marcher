import {
  GlProgram,
  Mesh,
  MeshGeometry,
  RenderTexture,
  Shader,
  Sprite,
  type WebGLRenderer,
} from "pixi.js";
import type { RasterRect } from "../model/height-grid";
import { editorBudgets } from "../budgets";
import type { ComputePriority } from "../ComputeJobs";
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
  type Point,
  type LandscapeWeights,
} from "../model/types";
import {
  HEIGHT_ATLAS_WIDTH,
  HEIGHT_DESCRIPTOR_HEIGHT,
  HEIGHT_DESCRIPTOR_WIDTH,
  HEIGHT_GPU_MAX_SCALED_VALUE,
  HEIGHT_GPU_PROJECTION_ZERO_ERROR,
  HEIGHT_GPU_VALUE_ZERO_ERROR,
  HeightSourceAtlas,
  createHeightAxesSteps,
  createHeightProjection,
  encodeHeightValue,
  heightGpuValueSafe,
  type HeightDescriptor,
} from "./height-field-data";
import {
  heightColourFragment,
  heightFragment,
  heightHorizontalFragment,
  heightVertex,
} from "./height-shader";
import type { LandscapeFrame } from "./LandscapeView";
import type { SurfaceFrame } from "./DerivedSurfaceView";
import { HeightAtlasSource } from "./height-atlas-upload";
import { DISPLAY_HEIGHT_BOUNDARY_EPSILON } from "./raster";
import {
  estimateHeightProjectionBytes,
  type HeightProjectionInput,
  type HeightProjectionService,
  type HeightProjectionTask,
} from "./HeightProjectionService";

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
const MAX_SURFACE_BYTES = SIZE * SIZE * 16 * 8 + (512 + 64) * 12 * 4;

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
function intersectRect(a: RasterRect, b: RasterRect): RasterRect {
  const x0 = Math.max(a[0], b[0]),
    y0 = Math.max(a[1], b[1]);
  return [
    x0,
    y0,
    Math.max(x0, Math.min(a[2], b[2])),
    Math.max(y0, Math.min(a[3], b[3])),
  ];
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
  lastFlushHadWork = false;
  get bytes(): number {
    return (
      this.atlas.data.byteLength +
      (this.source.resource === this.atlas.data
        ? 0
        : this.source.resource.byteLength)
    );
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
    this.lastFlushHadWork = false;
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
    if (
      this.source.width !== HEIGHT_ATLAS_WIDTH ||
      this.source.height !== this.atlas.height
    )
      this.lastFlushHadWork = true;
    this.source.resize(HEIGHT_ATLAS_WIDTH, this.atlas.height);
    let bytes = 0;
    while (this.pending.length && bytes + 8 <= maxBytes) {
      const range = this.pending[0];
      const end = Math.min(
        range[1],
        range[0] + Math.floor((maxBytes - bytes) / 8),
      );
      this.source.uploadRange(range[0], end);
      this.lastFlushHadWork = true;
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
    this.source.resource = this.atlas.data;
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
  private allocatedHorizontalRows = 1;
  private horizontalSamples = 0;
  private horizontalCompletedRows: number[] = [];
  private horizontalPlannedRows: number[] = [];
  private peakGeometryBytes = 0;
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
  private landscapeSource = new HeightAtlasSource({
    resource: new Uint8Array(4),
    width: 1,
    height: 1,
    format: "rgba8unorm",
    scaleMode: "nearest",
    alphaMode: "no-premultiply-alpha",
    autoGarbageCollect: false,
  });
  private fallbackLandSource = new HeightAtlasSource({
    resource: new Uint8Array(1),
    width: 1,
    height: 1,
    format: "r8unorm",
    scaleMode: "nearest",
    alphaMode: "no-premultiply-alpha",
    autoGarbageCollect: false,
  });
  private fallbackHeightSource = numericSource(new Float32Array(2), 1, 1);
  private surfaceLakeSource = numericSource(new Float32Array(4), 1, 1, true);
  private surfaceRiverSource = numericSource(new Float32Array(4), 1, 1, true);
  private surfaceFoundationSource = numericSource(
    new Float32Array(4),
    1,
    1,
    true,
  );
  private surfaceFrame: SurfaceFrame | null = null;
  private surfaceEncoded: SurfaceFrame | null = null;
  private surfaceLakeDirty = true;
  private surfaceRiverDirty = true;
  private surfaceFoundationDirty = true;
  private surfaceColourDirty = false;
  private fallbackHeightDirty = true;
  private lakeLayers = 0;
  private riverCount = 0;
  private foundationCount = 0;
  private landscapeFrame: LandscapeFrame | null = null;
  private landscapeEncoded: LandscapeFrame | null = null;
  private landscapeDirty = true;
  /** Texture encoding/upload does not prove that the colour target was drawn. */
  private landscapeColourDirty = false;
  private fallbackLandDirty = true;
  private shader: Shader;
  private horizontalShader: Shader;
  private colourShader: Shader;
  private overview?: HeightOverviewTile;
  private overviewEncoded?: HeightOverviewTile;
  private overviewFallback = false;
  private overviewMagnitude = 0;
  private weightsKey = "";
  private dirty = true;
  private overviewDirty = true;
  private weightsDirty = true;
  private fallbackDirty = false;
  private compositionDirty = true;
  private disposed = false;
  private rect: RasterRect = [...WHOLE];
  private operationRect: RasterRect = [...WHOLE];
  private stepRect: RasterRect = [...WHOLE];
  private projectionRect: RasterRect = [...WHOLE];
  private nextRow = 0;
  private stepReady = false;
  private drawStarted = false;
  private preparation: Generator<void, void, void> | null = null;
  private preparationPhase = "queued";
  private preparationSteps = 0;
  private restartPreparation = false;
  private preparationReservedBytes = 0;
  private generation = 0;
  private projectionTask: HeightProjectionTask | null = null;
  private projectionInput: HeightProjectionInput | null = null;
  private projectionPriority: ComputePriority = "background";
  private fallbackReady = false;
  private fallbackError: Error | null = null;
  private sourceSizes = new Map<HeightAtlasSource, readonly [number, number]>();
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
        uFallbackLand: this.fallbackLandSource,
        uLandscape: this.landscapeSource,
        uFallbackHeights: this.fallbackHeightSource,
        uSurfaceLake: this.surfaceLakeSource,
        uSurfaceRivers: this.surfaceRiverSource,
        uSurfaceFoundations: this.surfaceFoundationSource,
        heightUniforms: {
          uHasLandscape: { value: 0, type: "i32" },
          uFallback: { value: 0, type: "i32" },
          uHasSurface: { value: 0, type: "i32" },
          uLakeLayers: { value: 0, type: "i32" },
          uRiverCount: { value: 0, type: "i32" },
          uFoundationCount: { value: 0, type: "i32" },
          uTileSpan: { value: bounds[2] - bounds[0], type: "f32" },
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
  }

  setLandscape(frame: LandscapeFrame | null): void {
    this.landscapeFrame = frame;
  }

  setSurface(frame: SurfaceFrame | null): void {
    if (
      frame &&
      (!Number.isSafeInteger(frame.bytes) ||
        frame.bytes < 0 ||
        frame.bytes > MAX_SURFACE_BYTES)
    )
      throw new Error(
        "Ungültiges Speicherbudget für die lokale Gewässer- und Fundamentdarstellung.",
      );
    this.surfaceFrame = frame;
  }

  private get surfacePreparationBytes(): number {
    // Encoded frame plus the optional worker's absolute-pair image and small
    // dummy textures. Existing resources remain independently accounted below.
    return this.surfaceFrame
      ? this.surfaceFrame.bytes + SIZE * SIZE * 8 + 4096
      : 0;
  }

  sampleLandscape(point: Point): LandscapeWeights {
    if (!this.landscapeEncoded) return [0, 0, 0, 0];
    const spacing = 2 ** this.power;
    const x = Math.max(
      0,
      Math.min(SIZE - 1, Math.floor((point[0] - this.bounds[0]) / spacing)),
    );
    const y = Math.max(
      0,
      Math.min(SIZE - 1, Math.floor((point[1] - this.bounds[1]) / spacing)),
    );
    const offset = (y * SIZE + x) * 4;
    const values = this.landscapeSource.resource as Uint8Array;
    return [
      values[offset],
      values[offset + 1],
      values[offset + 2],
      values[offset + 3],
    ];
  }

  /** A changed strategy needs its own completed frame, even at the same revision. */
  invalidateBasis(totalChanged = false): void {
    this.cancelPreparation();
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
      2 * HEIGHT_GPU_VALUE_ZERO_ERROR +
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

  /** Queue intent only. Descriptor pages, weights and raster jobs start after selection. */
  update(
    overview?: HeightOverviewTile | null,
    rect: RasterRect = WHOLE,
    priority: ComputePriority = "background",
  ): void {
    if (this.disposed) return;
    this.cancelPreparation();
    this.projectionPriority = priority;
    if (overview !== undefined) this.overview = overview ?? undefined;
    this.compositionDirty = true;
    this.preparation = this.prepare(overview !== undefined, [...rect]);
    this.preparationPhase = "queued";
    this.preparationSteps = 0;
    this.restartPreparation = false;
  }

  /** An obsolete partial target never becomes a new numerical basis. */
  cancelPreparation(): void {
    this.generation++;
    this.preparation?.return();
    this.preparation = null;
    this.restartPreparation = true;
    this.preparationPhase = "cancelled";
    this.preparationReservedBytes = 0;
    this.projectionTask?.cancel();
    this.projectionTask = null;
    this.projectionInput = null;
    this.fallbackReady = false;
    this.fallbackError = null;
    this.stepReady = false;
    if (this.drawStarted && this.compositionDirty) {
      this.numericValid = false;
      this.numericCurrent = false;
      this.basisValid = false;
    }
    this.drawStarted = false;
  }

  /** One bounded CPU unit. False means no CPU progress, including an awaited job. */
  prepareStep(): boolean {
    if (this.disposed || !this.compositionDirty) return false;
    this.preparationSteps++;
    if (this.fallbackError) throw this.fallbackError;
    if (!this.preparation && (!this.descriptor || this.restartPreparation)) {
      this.preparation = this.prepare(false, [...WHOLE]);
      this.restartPreparation = false;
    }
    if (this.preparation) {
      this.preparationReservedBytes =
        (512 + (this.landscapeFrame ? 256 : 0)) * 1024 +
        this.surfacePreparationBytes;
      if (!this.preparation.next().done) return true;
      this.preparation = null;
      this.preparationReservedBytes = 0;
    }
    if (this.fallback && !this.fallbackReady) {
      this.preparationPhase = "projection-wait";
      if (!this.projectionTask) this.requestFallback();
      return false;
    }
    if (this.stepReady) return false;
    this.prepareStrip();
    return true;
  }

  get waitingProjection(): boolean {
    return this.fallback && !this.fallbackReady && !this.preparation;
  }
  get hasProjectionTask(): boolean {
    return this.projectionTask !== null;
  }
  /** Read-only facts for the current selected target, never a readiness signal. */
  preparationState() {
    return {
      phase: this.preparationPhase,
      steps: this.preparationSteps,
      generation: this.generation,
      generator: Boolean(this.preparation),
      restart: this.restartPreparation,
      descriptor: this.descriptor?.levelCount ?? null,
      descriptorPages: this.descriptor?.pages.length ?? 0,
      weightsKey: this.weightsKey,
      nextRow: this.nextRow,
      stepReady: this.stepReady,
      mode: this.mode,
      compositionDirty: this.compositionDirty,
      fallback: this.fallback,
      fallbackReady: this.fallbackReady,
      projection: this.hasProjectionTask,
      projectionInput: Boolean(this.projectionInput),
      sourceResizes: this.sourceSizes.size,
      preparedVersion: this.preparedVersion,
      preparationVersion: this.preparationVersion,
      currentIsBasis: this.currentIsBasis,
      basisValid: this.basisValid,
      numericCurrent: this.numericCurrent,
      plannedBasis: this.plannedBasis,
      plannedError: this.plannedError,
      plannedDepth: this.plannedDepth,
      numericDepth: this.numericDepth,
      next: this.nextPreparationBytes,
    };
  }
  retainedSourceBuffers(): readonly ArrayBufferLike[] {
    return [
      ...(this.landscapeFrame?.buffers ?? []),
      ...(this.landscapeEncoded?.buffers ?? []),
      ...(this.surfaceFrame?.buffers ?? []),
      ...(this.surfaceEncoded?.buffers ?? []),
      ...(this.overview ? [this.overview.values.buffer] : []),
      ...(this.projectionInput?.sources.map((source) => source.values.buffer) ??
        []),
      ...(this.projectionInput?.overview
        ? [this.projectionInput.overview.buffer]
        : []),
    ];
  }

  /** Peak reserves precede allocation; buffers already held are counted in bytes. */
  get nextPreparationBytes(): { cpuBytes: number; gpuBytes: number } {
    if (!this.needsPreparation) return { cpuBytes: 0, gpuBytes: 0 };
    // At most 22 axes, one descriptor, overview and worker image. The finest
    // admitted contribution spans <=16 source pages per axis; coarser levels
    // form a geometric series of horizontal rows plus their cubic halos.
    const workerBytes =
      this.fallback &&
      !this.fallbackReady &&
      !this.projectionTask &&
      this.projectionInput
        ? estimateHeightProjectionBytes(this.projectionInput)
        : 0;
    const dataBytes =
      (512 + (this.landscapeFrame ? 256 : 0)) * 1024 +
      this.surfacePreparationBytes +
      this.field.atlas.nextPageAllocationBytes;
    const cpuBytes = dataBytes - this.preparationReservedBytes + workerBytes;
    const horizontalBytes = SIZE * (2 * 16 * 64 + 22 * 4) * 8;
    return { cpuBytes, gpuBytes: dataBytes + horizontalBytes };
  }

  private stageSource(
    source: HeightAtlasSource,
    width: number,
    height: number,
  ): void {
    this.sourceSizes.set(source, [width, height]);
  }

  private *prepare(
    forceOverview: boolean,
    rect: RasterRect,
  ): Generator<void, void, void> {
    if (this.surfaceFrame !== this.surfaceEncoded) {
      this.preparationPhase = "surface";
      const frame = this.surfaceFrame;
      const data = frame ? yield* frame.prepare() : null;
      if (
        data &&
        (!Number.isInteger(data.lakeLayers) ||
          data.lakeLayers < 0 ||
          data.lakeLayers > 8 ||
          (data.lakeLayers === 0
            ? data.lake !== null
            : !(data.lake instanceof Float32Array) ||
              data.lake.length !== SIZE * SIZE * 4 * data.lakeLayers) ||
          !(data.rivers instanceof Float32Array) ||
          data.rivers.length % 12 !== 0 ||
          data.rivers.length > 512 * 12 ||
          !(data.foundations instanceof Float32Array) ||
          data.foundations.length % 12 !== 0 ||
          data.foundations.length > 64 * 12)
      )
        throw new Error(
          "Ungültige oder zu große lokale Gewässer- und Fundamentdarstellung.",
        );
      if (
        data &&
        (data.lake?.byteLength ?? 0) +
          data.rivers.byteLength +
          data.foundations.byteLength >
          frame!.bytes
      )
        throw new Error(
          "Die lokale Gewässerdarstellung überschreitet ihr reserviertes Speicherbudget.",
        );
      for (const values of [data?.lake, data?.rivers, data?.foundations])
        if (values) {
          for (let from = 0; from < values.length; from += 4096) {
            for (let i = from; i < Math.min(values.length, from + 4096); i++)
              if (!Number.isFinite(values[i]))
                throw new Error(
                  "Nichtendliche lokale Gewässer- oder Fundamentdarstellung.",
                );
            yield;
          }
        }
      this.lakeLayers = data?.lakeLayers ?? 0;
      this.riverCount = (data?.rivers.length ?? 0) / 12;
      this.foundationCount = (data?.foundations.length ?? 0) / 12;
      this.surfaceLakeSource.resource = data?.lake ?? new Float32Array(4);
      this.surfaceRiverSource.resource = this.riverCount
        ? data!.rivers
        : new Float32Array(4);
      this.surfaceFoundationSource.resource = this.foundationCount
        ? data!.foundations
        : new Float32Array(4);
      this.stageSource(
        this.surfaceLakeSource,
        data?.lake ? SIZE : 1,
        data?.lake ? SIZE * data.lakeLayers : 1,
      );
      this.stageSource(
        this.surfaceRiverSource,
        this.riverCount ? 3 : 1,
        this.riverCount || 1,
      );
      this.stageSource(
        this.surfaceFoundationSource,
        this.foundationCount ? 3 : 1,
        this.foundationCount || 1,
      );
      const uniforms = this.colourShader.resources.heightUniforms.uniforms;
      uniforms.uHasSurface = Number(frame !== null);
      uniforms.uLakeLayers = this.lakeLayers;
      uniforms.uRiverCount = this.riverCount;
      uniforms.uFoundationCount = this.foundationCount;
      this.surfaceLakeDirty =
        this.surfaceRiverDirty =
        this.surfaceFoundationDirty =
          true;
      this.surfaceColourDirty = true;
      this.surfaceEncoded = frame;
      if (!frame) {
        this.fallbackHeightSource.resource = new Float32Array(2);
        this.stageSource(this.fallbackHeightSource, 1, 1);
        this.fallbackHeightDirty = true;
      }
    }
    if (this.landscapeFrame !== this.landscapeEncoded) {
      this.preparationPhase = "landscape";
      const frame = this.landscapeFrame;
      const values = new Uint8Array(frame ? SIZE * SIZE * 4 : 4);
      if (frame) {
        const sample = yield* frame.prepare();
        const spacing = 2 ** this.power;
        for (let y = 0; y < SIZE; y++) {
          const worldY = this.bounds[1] + (y + 0.5) * spacing;
          for (let x = 0; x < SIZE; x++) {
            const worldX = this.bounds[0] + (x + 0.5) * spacing;
            if (
              Math.abs(worldX) <= 100_000_000 &&
              Math.abs(worldY) <= 100_000_000
            )
              values.set(sample(worldX, worldY), (y * SIZE + x) * 4);
          }
          if (y % 2 === 1) yield;
        }
      }
      this.landscapeSource.resource = values;
      this.stageSource(
        this.landscapeSource,
        frame ? SIZE : 1,
        frame ? SIZE : 1,
      );
      this.colourShader.resources.heightUniforms.uniforms.uHasLandscape =
        Number(frame !== null);
      this.landscapeDirty = true;
      this.landscapeColourDirty = true;
      this.landscapeEncoded = frame;
    }
    this.preparationPhase = "overview";
    if (forceOverview || this.overviewEncoded !== this.overview) {
      const values = this.overview?.values;
      const data = new Float32Array(values ? SIZE * SIZE * 2 : 2);
      let fallback = false;
      let magnitude = 0;
      if (values) {
        for (
          let from = 0;
          from < values.length;
          from += editorBudgets.heightOverviewSamplesPerStep
        ) {
          const to = Math.min(
            values.length,
            from + editorBudgets.heightOverviewSamplesPerStep,
          );
          for (let i = from; i < to; i++) {
            const value = values[i];
            magnitude = Math.max(magnitude, Math.abs(value) * 32);
            if (!heightGpuValueSafe(value)) fallback = true;
            else data.set(encodeHeightValue(value), i * 2);
          }
          yield;
        }
      }
      this.overviewSource.resource = data;
      this.stageSource(
        this.overviewSource,
        values ? SIZE : 1,
        values ? SIZE : 1,
      );
      this.overviewFallback = fallback;
      this.overviewMagnitude = magnitude;
      this.overviewEncoded = this.overview;
      this.overviewDirty = true;
      yield;
    }
    this.preparationPhase = "strategy";
    const level = this.field.toolLevel;
    const minimum = minimumCoarseHeightLevel(this.power);
    const activeMagnitude = this.field.atlas.magnitudeIn(
      this.bounds,
      level,
      level,
    );
    const activeSafe = this.field.atlas.safeIn(this.bounds, level, level);
    const canonicalMagnitude =
      100 +
      this.field.atlas.magnitudeIn(this.bounds, minimum) +
      this.overviewMagnitude;
    const canonicalError =
      canonicalMagnitude * PAIR_PROJECTION_ERROR +
      HEIGHT_GPU_PROJECTION_ZERO_ERROR;
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
        !this.landscapeColourDirty &&
        !this.surfaceColourDirty &&
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
    this.preparationPhase = "descriptor";
    try {
      next = yield* this.field.atlas.descriptorSteps(
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
      next = yield* this.field.atlas.descriptorSteps(this.bounds, this.power);
    }
    this.fallback =
      !this.field.numericSupported ||
      next.fallback ||
      (this.mode === "canonical" && this.overviewFallback);
    if (this.fallback && (this.mode !== "canonical" || this.plannedBasis)) {
      this.field.atlas.release(next.pages);
      planCanonical();
      this.plannedBasis = false;
      next = yield* this.field.atlas.descriptorSteps(this.bounds, this.power);
      this.fallback =
        !this.field.numericSupported || next.fallback || this.overviewFallback;
    }

    let published = false;
    try {
      const weightsKey = next.levels.join(",");
      this.preparationPhase = "axes";
      if (weightsKey !== this.weightsKey || this.weightSource.width === 1) {
        this.axes = yield* createHeightAxesSteps(
          this.bounds,
          this.power,
          next.levels,
        );
        this.weightSource.resource = this.axes.data;
        this.stageSource(this.weightSource, this.axes.width, this.axes.height);
        this.weightsKey = weightsKey;
        this.weightsDirty = true;
      }
      this.releaseDescriptor();
      this.preparationPhase = "publish";
      this.descriptor = next;
      published = true;
      this.descriptorSource.resource = next.data;
      this.stageSource(
        this.descriptorSource,
        next.width,
        HEIGHT_DESCRIPTOR_HEIGHT,
      );
      this.rect =
        this.mode === "live" && !this.surfaceColourDirty
          ? [...rect]
          : [...WHOLE];
      this.operationRect =
        this.mode === "live" && !this.currentIsBasis
          ? [...this.rect]
          : [...WHOLE];
      this.nextRow = this.operationRect[1];
      this.horizontalRows = Math.max(1, next.horizontalRows);
      this.horizontalCompletedRows = [];
      this.horizontalPlannedRows = [];
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
      uniforms.uHasOverview =
        this.mode === "canonical" && this.overview ? 1 : 0;
      uniforms.uClip = new Float32Array(next.clip);
      uniforms.uDirty = new Float32Array(this.rect);
      this.colourShader.resources.heightUniforms.uniforms.uFallback = this
        .fallback
        ? 1
        : 0;
      this.colourShader.resources.heightUniforms.uniforms.uClip =
        new Float32Array(next.clip);
      this.dirty = true;
      if (this.fallback) {
        this.plannedBasis = false;
        this.projectionInput = {
          sources: this.field.atlas.sourcesIn(
            this.bounds,
            minimumCoarseHeightLevel(this.power),
          ),
          overview: this.overview?.values,
          bounds: this.bounds,
          size: SIZE,
          ...(this.surfaceEncoded ? { includeHeights: true } : {}),
        };
        // The next selected step reserves this exact worker snapshot and output.
        yield;
      }
    } finally {
      if (!published) this.field.atlas.release(next.pages);
    }
  }

  private prepareStrip(): void {
    if (!this.descriptor) return;
    this.stepRect = [
      this.operationRect[0],
      this.nextRow,
      this.operationRect[2],
      Math.min(
        this.operationRect[3],
        this.nextRow + editorBudgets.heightCompositionRowsPerStep,
      ),
    ];
    this.projectionRect = intersectRect(this.stepRect, this.rect);
    const projection = createHeightProjection(
      this.descriptor,
      this.axes,
      this.projectionRect,
    );
    this.horizontalPlannedRows = [...this.horizontalCompletedRows];
    if (area(this.projectionRect)) {
      for (let level = 0; level < this.descriptor.levelCount; level++) {
        const rows = this.descriptor.rows[level];
        const axis = (level * 2 + 1) * this.axes.width * 2;
        const from =
          this.axes.data[axis + this.projectionRect[1] * 10] - 1 - rows.first;
        const to =
          this.axes.data[axis + (this.projectionRect[3] - 1) * 10] +
          3 -
          rows.first;
        const next = Math.min(
          to,
          Math.max(from, this.horizontalCompletedRows[level] ?? from),
        );
        this.horizontalPlannedRows[level] = to;
        projection.samples -=
          (this.projectionRect[2] - this.projectionRect[0]) * (next - from);
        projection.positions[level * 8 + 1] = projection.positions[
          level * 8 + 3
        ] = (rows.offset + next) / this.descriptor.horizontalRows;
        projection.uvs[level * 8 + 1] = projection.uvs[level * 8 + 3] =
          level + next / rows.count;
      }
    }
    this.horizontalSamples = this.fallback ? 0 : projection.samples;
    this.horizontalMesh.geometry.positions = projection.positions;
    this.horizontalMesh.geometry.uvs = projection.uvs;
    this.horizontalMesh.geometry.indices = projection.indices;
    this.peakGeometryBytes = Math.max(
      this.peakGeometryBytes,
      this.geometryBytes,
    );
    this.stepReady = true;
    this.preparationPhase = "strip-ready";
  }

  private requestFallback(): void {
    if (
      !this.field.projections ||
      !this.projectionInput ||
      this.projectionTask ||
      this.disposed
    )
      return;
    const generation = this.generation;
    const task = this.field.projections.request(
      this.projectionInput,
      this.projectionPriority,
    );
    this.projectionTask = task;
    task.promise.then(
      (image) => {
        if (
          this.disposed ||
          generation !== this.generation ||
          this.projectionTask !== task
        )
          return;
        this.projectionTask = null;
        if (image) {
          this.projectionInput = null;
          if (this.surfaceEncoded && !image.heights) {
            this.fallbackError = new Error(
              "Numerische Höhenpaare für die Gewässerdarstellung fehlen.",
            );
            this.field.wake();
            return;
          }
          if (image.heights) {
            this.fallbackHeightSource.resource = image.heights;
            this.stageSource(this.fallbackHeightSource, SIZE, SIZE);
            this.fallbackHeightDirty = true;
          }
          this.fallbackSource.resource = image.pixels;
          this.stageSource(this.fallbackSource, SIZE, SIZE);
          this.fallbackLandSource.resource = image.land;
          this.stageSource(this.fallbackLandSource, SIZE, SIZE);
          this.fallbackLandDirty = true;
          this.fallbackSamples += SIZE * SIZE;
          this.fallbackDirty = true;
          this.fallbackReady = true;
        }
        this.field.wake();
      },
      (error: unknown) => {
        if (
          this.disposed ||
          generation !== this.generation ||
          this.projectionTask !== task
        )
          return;
        this.projectionTask = null;
        this.projectionInput = null;
        this.fallbackError =
          error instanceof Error ? error : new Error(String(error));
        this.field.wake();
      },
    );
  }

  flush(maxBytes = Infinity): number {
    if (
      this.disposed ||
      this.preparation ||
      (this.fallback && !this.fallbackReady)
    )
      return 0;
    let bytes = 0;
    const upload = (
      source: HeightAtlasSource,
      needed: boolean,
      done: () => void,
    ) => {
      const values = source.resource as Float32Array | Uint8Array;
      if (!needed || bytes + values.byteLength > maxBytes) return;
      const size = this.sourceSizes.get(source);
      if (size) {
        if (source.width !== size[0] || source.height !== size[1])
          this.field.markGpuWork();
        source.resize(size[0], size[1]);
        this.sourceSizes.delete(source);
      }
      this.field.initSource(source);
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
    upload(this.fallbackLandSource, this.fallbackLandDirty, () => {
      this.fallbackLandDirty = false;
    });
    upload(this.landscapeSource, this.landscapeDirty, () => {
      this.landscapeDirty = false;
    });
    upload(this.fallbackHeightSource, this.fallbackHeightDirty, () => {
      this.fallbackHeightDirty = false;
    });
    upload(this.surfaceLakeSource, this.surfaceLakeDirty, () => {
      this.surfaceLakeDirty = false;
    });
    upload(this.surfaceRiverSource, this.surfaceRiverDirty, () => {
      this.surfaceRiverDirty = false;
    });
    upload(this.surfaceFoundationSource, this.surfaceFoundationDirty, () => {
      this.surfaceFoundationDirty = false;
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
      this.fallbackLandDirty =
      this.landscapeDirty =
      this.fallbackHeightDirty =
      this.surfaceLakeDirty =
      this.surfaceRiverDirty =
      this.surfaceFoundationDirty =
        true;
    this.update(undefined, WHOLE);
  }
  get uploadReady(): boolean {
    return (
      this.descriptor !== null &&
      this.stepReady &&
      !this.pendingUploadBytes &&
      (this.fallback || this.field.authors.ready(this.descriptor.pages))
    );
  }
  get needsPreparation(): boolean {
    return this.compositionDirty && !this.stepReady;
  }
  get compositionWork(): number {
    if (!this.compositionDirty || !this.stepReady) return 0;
    const projected = area(this.projectionRect);
    const copied =
      this.mode === "live" && this.currentIsBasis
        ? area(this.stepRect) - projected
        : 0;
    const colour = this.mode === "capture" ? 0 : projected;
    const capture = this.mode === "capture" ? area(this.stepRect) : 0;
    const basisAdds =
      this.mode === "live"
        ? 2 * projected
        : this.mode === "canonical" &&
            this.field.toolLevel >= minimumCoarseHeightLevel(this.power) &&
            this.descriptor?.levels.includes(this.field.toolLevel)
          ? 4 * projected
          : 0;
    // A completed worker image needs only its bounded colour pass on the GPU.
    return (
      (this.fallback
        ? 0
        : Math.ceil((this.projectionProducts + basisAdds) / 20)) +
      Math.ceil((colour + copied + capture) / 16) +
      Math.ceil(
        (colour *
          (this.lakeLayers + this.riverCount * 4 + this.foundationCount * 2)) /
          16,
      )
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
            area(this.projectionRect) * (this.descriptor?.levelCount ?? 0));
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

  /** Submit one complete horizontal → numeric → colour strip. */
  drawDirty(renderer: WebGLRenderer): number {
    if (!this.compositionDirty || this.disposed) return 0;
    if (!this.uploadReady)
      throw new Error(
        "Unvollständiger numerischer Höhenstand vor GPU-Zeichnung.",
      );
    const samples = area(this.projectionRect);
    const firstLive = this.mode === "live" && this.currentIsBasis;
    const complete = this.stepRect[3] === this.operationRect[3];
    const stats: HeightCompositionStats = {
      canonicalSamples:
        !this.fallback && this.mode === "canonical" ? samples : 0,
      deltaSamples: !this.fallback && this.mode === "live" ? samples : 0,
      colourSamples: this.mode === "capture" ? 0 : samples,
      anchorCopySamples:
        !this.fallback && firstLive ? area(this.stepRect) - samples : 0,
      basisCaptureSamples: this.mode === "capture" ? area(this.stepRect) : 0,
      canonicalBasisBuilds:
        complete &&
        !this.fallback &&
        this.mode === "canonical" &&
        this.plannedBasis
          ? 1
          : 0,
      horizontalSamples: this.horizontalSamples,
      projectionProducts: this.projectionProducts,
    };
    this.drawStarted = true;
    if (!this.fallback) {
      // Resizing an existing GPU target is itself terrain work, never preparation.
      this.horizontal.resize(SIZE, this.horizontalRows);
      this.allocatedHorizontalRows = this.horizontalRows;
      this.horizontalMesh.scale.set(SIZE, this.horizontalRows);
      if (this.horizontalSamples)
        renderer.render({
          container: this.horizontalMesh,
          target: this.horizontal,
          clear: false,
        });
      const swapAfterCapture = this.mode === "capture" && this.currentIsBasis;
      const target =
        this.mode === "live" || swapAfterCapture ? this.numeric : this.basis;
      this.shader.resources.uReference =
        this.mode === "live" || swapAfterCapture
          ? this.basis.source
          : this.numeric.source;
      setRect(this.numericMesh, this.stepRect);
      renderer.render({ container: this.numericMesh, target, clear: false });
      this.colourShader.resources.uHeights = target.source;
      // A capture target becomes the basis only after all of its strips exist.
      if (complete && swapAfterCapture)
        [this.basis, this.numeric] = [this.numeric, this.basis];
    }
    if (this.mode !== "capture" && samples) {
      setRect(this.colourMesh, this.projectionRect);
      renderer.render({
        container: this.colourMesh,
        target: this.colour,
        clear: false,
      });
    }
    this.drawStarted = true;
    this.nextRow = this.stepRect[3];
    this.horizontalCompletedRows = this.horizontalPlannedRows;
    this.stepReady = false;
    this.preparationPhase = complete ? "complete" : "next-strip";
    this.compositionStats = stats;
    if (!complete) return samples;
    if (this.mode !== "capture") {
      this.landscapeColourDirty = false;
      this.surfaceColourDirty = false;
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
    this.drawStarted = false;
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
      (this.fallbackDirty ? this.fallbackSource.resource.byteLength : 0) +
      (this.fallbackLandDirty
        ? this.fallbackLandSource.resource.byteLength
        : 0) +
      (this.landscapeDirty ? this.landscapeSource.resource.byteLength : 0) +
      (this.fallbackHeightDirty
        ? this.fallbackHeightSource.resource.byteLength
        : 0) +
      (this.surfaceLakeDirty ? this.surfaceLakeSource.resource.byteLength : 0) +
      (this.surfaceRiverDirty
        ? this.surfaceRiverSource.resource.byteLength
        : 0) +
      (this.surfaceFoundationDirty
        ? this.surfaceFoundationSource.resource.byteLength
        : 0)
    );
  }
  get bytes(): number {
    return (
      this.preparationReservedBytes +
      this.geometryBytes +
      this.descriptorSource.resource.byteLength +
      this.overviewSource.resource.byteLength +
      this.weightSource.resource.byteLength +
      this.fallbackSource.resource.byteLength +
      this.fallbackLandSource.resource.byteLength +
      this.landscapeSource.resource.byteLength +
      this.fallbackHeightSource.resource.byteLength +
      this.surfaceLakeSource.resource.byteLength +
      this.surfaceRiverSource.resource.byteLength +
      this.surfaceFoundationSource.resource.byteLength
    );
  }
  private get geometryBytes(): number {
    return [this.numericMesh, this.horizontalMesh, this.colourMesh].reduce(
      (sum, mesh) =>
        sum +
        mesh.geometry.positions.byteLength +
        mesh.geometry.uvs.byteLength +
        mesh.geometry.indices.byteLength,
      0,
    );
  }
  get gpuSourceBytes(): number {
    return (
      Math.max(this.geometryBytes, this.peakGeometryBytes) +
      [
        this.descriptorSource,
        this.overviewSource,
        this.weightSource,
        this.fallbackSource,
        this.fallbackLandSource,
        this.landscapeSource,
        this.fallbackHeightSource,
        this.surfaceLakeSource,
        this.surfaceRiverSource,
        this.surfaceFoundationSource,
      ].reduce(
        (sum, source) =>
          sum +
          Math.max(
            source.resource.byteLength,
            source.width *
              source.height *
              (source === this.descriptorSource ||
              source === this.surfaceLakeSource ||
              source === this.surfaceRiverSource ||
              source === this.surfaceFoundationSource
                ? 16
                : source === this.fallbackLandSource
                  ? 1
                  : source === this.fallbackSource ||
                      source === this.landscapeSource
                    ? 4
                    : 8),
          ),
        0,
      )
    );
  }
  get numericBytes(): number {
    return (
      SIZE * SIZE * 16 * 2 +
      SIZE * Math.max(this.horizontalRows, this.allocatedHorizontalRows) * 8
    );
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPreparation();
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
      this.fallbackLandSource,
      this.landscapeSource,
      this.fallbackHeightSource,
      this.surfaceLakeSource,
      this.surfaceRiverSource,
      this.surfaceFoundationSource,
    ]) {
      source.destroy();
      this.field.forgetSource(source);
    }
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
  private initializedSources = new Set<HeightAtlasSource>();
  lastFlushHadWork = false;

  constructor(
    readonly projections?: HeightProjectionService,
    readonly wake: () => void = () => {},
  ) {}

  init(renderer: WebGLRenderer, numericSupported?: boolean): void {
    this.renderer = renderer;
    this.numericSupported =
      numericSupported ??
      (renderer.gl
        ? supportsHeightNumericTargets(renderer.gl as WebGL2RenderingContext)
        : (renderer as WebGLRenderer & { atlasTestDriver?: boolean })
            .atlasTestDriver === true);
  }
  initSource(source: HeightAtlasSource): void {
    if (!this.renderer || this.initializedSources.has(source)) return;
    this.renderer.texture.initSource(source);
    this.initializedSources.add(source);
    this.markGpuWork();
  }
  markGpuWork(): void {
    this.lastFlushHadWork = true;
  }
  retainedSourceBuffers(): readonly ArrayBufferLike[] {
    return [
      ...new Set(
        [...this.tiles].flatMap((tile) => [...tile.retainedSourceBuffers()]),
      ),
    ];
  }
  forgetSource(source: HeightAtlasSource): void {
    this.initializedSources.delete(source);
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
    this.initializedSources.clear();
    for (const tile of this.tiles) tile.invalidateGPU();
  }

  /** Immutable renderer source used to coalesce updates while a draw is frozen. */
  readSource(key: string): HeightTile | undefined {
    return this.atlas.sources.get(key);
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
  flush(
    maxBytes = Infinity,
    selected: Iterable<HeightFieldTile> = this.tiles,
  ): number {
    this.lastFlushHadWork = false;
    let bytes = 0;
    for (const tile of selected) bytes += tile.flush(maxBytes - bytes);
    this.initSource(this.source);
    bytes += this.authors.flush(maxBytes - bytes);
    this.lastFlushHadWork ||= this.authors.lastFlushHadWork || bytes > 0;
    return bytes;
  }
  metrics() {
    const derived =
      this.authors.bytes +
      [...this.tiles].reduce((sum, tile) => sum + tile.bytes, 0);
    const sourceBytes = this.atlas.sourceBytes;
    return {
      sourceBytes,
      gpuBytes:
        Math.max(
          this.atlas.data.byteLength,
          this.source.width * this.source.height * 8,
        ) +
        [...this.tiles].reduce(
          (sum, tile) =>
            sum + tile.gpuSourceBytes + tile.numericBytes + SIZE * SIZE * 4,
          0,
        ),
      cpuBytes: sourceBytes + derived + this.atlas.preparationBytes,
      projectionBytes: this.projections?.metrics().bytes ?? 0,
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
