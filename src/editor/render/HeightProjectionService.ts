import { editorBudgets } from "../budgets";
import {
  ComputeJobs,
  type ComputeHandle,
  type ComputePriority,
} from "../ComputeJobs";
import type {
  HeightProjectionInput,
  HeightProjectionRequest,
  HeightProjectionResponse,
} from "./height-projection";

export type { HeightProjectionInput } from "./height-projection";

export interface HeightProjectionTask {
  readonly promise: Promise<Uint8Array | null>;
  readonly bytes: number;
  cancel(): void;
}

export interface HeightProjectionMetrics {
  active: number;
  pending: number;
  cancelling: number;
  /** Reserved worker copies, result and maximum bounded raster scratch. */
  bytes: number;
  retainedInputBuffers: readonly ArrayBufferLike[];
  completed: number;
  maxChunkMs: number;
}

export interface HeightProjectionService {
  request(
    input: HeightProjectionInput,
    priority?: ComputePriority,
  ): HeightProjectionTask;
  metrics(): HeightProjectionMetrics;
  cancelAll(): void;
  dispose(): void;
}

export interface ProjectionWorkerPort {
  onmessage: ((event: MessageEvent<HeightProjectionResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(
    message: HeightProjectionRequest,
    transfer?: Transferable[],
  ): void;
  terminate(): void;
}

interface Task {
  id: number;
  sessionId: string;
  priority: ComputePriority;
  bytes: number;
  input: HeightProjectionInput;
  started: boolean;
  cancelled: boolean;
  sourceOffset: number;
  overviewOffset: number;
  calculating: boolean;
  deliveryError?: unknown;
  handle?: ComputeHandle<Uint8Array | null>;
  resolve?: (pixels: Uint8Array | null) => void;
  reject?: (error: unknown) => void;
}

function inputBuffers(input: HeightProjectionInput): ArrayBufferLike[] {
  return [
    ...new Set([
      ...input.sources.map((tile) => tile.values.buffer),
      ...(input.overview ? [input.overview.buffer] : []),
    ]),
  ];
}

/** Includes the worker copy and simultaneous output, grid row and colour scratch. */
export function estimateHeightProjectionBytes(
  input: HeightProjectionInput,
): number {
  return (
    inputBuffers(input).reduce((sum, buffer) => sum + buffer.byteLength, 0) +
    input.size * input.size * 4 +
    input.size * 96 +
    32 * 1024
  );
}

/** One exception worker shares the controller's two-job admission boundary. */
export class WorkerHeightProjectionService implements HeightProjectionService {
  private worker: ProjectionWorkerPort | null = null;
  private tasks = new Set<Task>();
  private nextId = 0;
  private sessionId = "";
  private closed = false;
  private completed = 0;
  private maxChunkMs = 0;

  constructor(
    private jobs: ComputeJobs,
    private createWorker: () => ProjectionWorkerPort = () =>
      new Worker(new URL("./height-projection.worker.ts", import.meta.url), {
        type: "module",
      }),
  ) {}

  setSession(sessionId: string): void {
    if (sessionId === this.sessionId) return;
    this.cancelAll();
    this.sessionId = sessionId;
  }

  request(
    input: HeightProjectionInput,
    priority: ComputePriority = "local",
  ): HeightProjectionTask {
    if (!Number.isInteger(input.size) || input.size < 1 || input.size > 128)
      throw new RangeError("Ungültige Größe der lokalen Höhenprojektion.");
    if (
      this.closed ||
      (priority === "background" &&
        [...this.tasks].some(
          (task) => !task.started && task.priority === "local",
        ))
    )
      return { promise: Promise.resolve(null), bytes: 0, cancel() {} };
    // No author buffer is transferred/detached. postMessage clones only this
    // local immutable snapshot; those physical copies and scratch are reserved.
    const bytes = estimateHeightProjectionBytes(input);
    const activeBytes = [...this.tasks]
      .filter((task) => task.started)
      .reduce((sum, task) => sum + task.bytes, 0);
    if (!Number.isSafeInteger(bytes) || bytes > editorBudgets.presentationBytes)
      throw new RangeError(
        "Lokale Höhenprojektion überschreitet ihr Speicherbudget.",
      );
    if (activeBytes + bytes > editorBudgets.presentationBytes)
      throw new RangeError(
        "Höhenprojektion wartet auf freien Darstellungsspeicher.",
      );
    // Replaced waiting work has no physical worker and releases immediately.
    for (const waiting of [...this.tasks]) {
      if (waiting.started) continue;
      waiting.handle?.cancel();
      this.tasks.delete(waiting);
    }
    const task: Task = {
      id: ++this.nextId,
      sessionId: this.sessionId,
      priority,
      bytes,
      input: {
        ...input,
        sources: [...input.sources],
        bounds: [...input.bounds],
      },
      started: false,
      cancelled: false,
      sourceOffset: 0,
      overviewOffset: 0,
      calculating: false,
    };
    this.tasks.add(task);
    const handle = this.jobs.request("projection", priority, bytes, () => {
      task.started = true;
      const worker = this.ensureWorker();
      const ended = new Promise<Uint8Array | null>((resolve, reject) => {
        task.resolve = resolve;
        task.reject = reject;
      });
      try {
        worker.postMessage({
          kind: "begin",
          id: task.id,
          sessionId: task.sessionId,
          bounds: task.input.bounds,
          size: task.input.size,
          sourceCount: task.input.sources.length,
          hasOverview: Boolean(task.input.overview),
        });
      } catch (error) {
        this.tasks.delete(task);
        task.reject!(error);
      }
      return {
        ended,
        cancel: () => {
          task.cancelled = true;
          worker.postMessage({
            kind: "cancel",
            id: task.id,
            sessionId: task.sessionId,
          });
        },
      };
    });
    task.handle = handle;
    const promise = handle.result.then(
      (pixels) => {
        if (!task.started) this.tasks.delete(task);
        return pixels;
      },
      (error) => {
        this.tasks.delete(task);
        throw error;
      },
    );
    return {
      promise,
      bytes,
      cancel: () => {
        task.cancelled = true;
        handle.cancel();
        if (!task.started) this.tasks.delete(task);
      },
    };
  }

  /** One bounded input is sent per worker ACK; no unbounded UI clone/queue. */
  private hydrate(task: Task, worker: ProjectionWorkerPort): void {
    if (task.cancelled || task.calculating) return;
    const identity = { id: task.id, sessionId: task.sessionId };
    try {
      const source = task.input.sources[task.sourceOffset];
      if (source) {
        // One 64×64 Float64 source: exactly 32 KiB, without detaching authors.
        worker.postMessage({ kind: "source", ...identity, source });
        task.sourceOffset++;
        return;
      }
      const overview = task.input.overview;
      if (overview && task.overviewOffset < overview.length) {
        const values = overview.slice(
          task.overviewOffset,
          task.overviewOffset + 4096,
        );
        const length = values.length;
        worker.postMessage(
          {
            kind: "overview",
            ...identity,
            offset: task.overviewOffset,
            values,
          },
          [values.buffer],
        );
        task.overviewOffset += length;
        return;
      }
      worker.postMessage({ kind: "project", ...identity });
      task.calculating = true;
    } catch (error) {
      task.deliveryError = error;
      task.cancelled = true;
      // The worker may already own preceding chunks. Retain its reservation
      // until it acknowledges that those buffered inputs are no longer used.
      worker.postMessage({ kind: "cancel", ...identity });
    }
  }

  private ensureWorker(): ProjectionWorkerPort {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => {
      const response = event.data;
      const task = [...this.tasks].find(
        (candidate) =>
          candidate.started &&
          candidate.id === response.id &&
          candidate.sessionId === response.sessionId,
      );
      if (!task) return;
      if (response.kind === "ready") {
        this.hydrate(task, worker);
        return;
      }
      this.tasks.delete(task);
      if (task.deliveryError !== undefined) task.reject?.(task.deliveryError);
      else if (response.kind === "failed")
        task.reject?.(new Error(response.error));
      else if (response.kind === "cancelled") task.resolve?.(null);
      else if (
        !task.calculating ||
        !(response.pixels instanceof Uint8Array) ||
        response.pixels.length !== task.input.size * task.input.size * 4 ||
        response.samples !== task.input.size * task.input.size ||
        !Number.isFinite(response.maxChunkMs) ||
        response.maxChunkMs < 0
      )
        task.reject?.(new Error("Unvollständiges Höhenprojektionsresultat."));
      else {
        this.completed++;
        this.maxChunkMs = Math.max(this.maxChunkMs, response.maxChunkMs);
        task.resolve?.(task.cancelled ? null : response.pixels);
      }
      if (this.closed) {
        worker.terminate();
        this.worker = null;
      }
    };
    worker.onerror = (event) => {
      // A failed worker is terminated before its slot can be reused. Cancellation
      // itself never uses this error path or frees the slot optimistically.
      worker.terminate();
      this.worker = null;
      for (const task of [...this.tasks]) {
        if (!task.started) continue;
        this.tasks.delete(task);
        task.reject?.(new Error(event.message));
      }
    };
    this.worker = worker;
    return worker;
  }

  cancelAll(): void {
    for (const task of [...this.tasks]) {
      task.cancelled = true;
      task.handle?.cancel();
      if (!task.started) this.tasks.delete(task);
    }
  }

  dispose(): void {
    this.closed = true;
    this.cancelAll();
    if (![...this.tasks].some((task) => task.started)) {
      this.worker?.terminate();
      this.worker = null;
    }
  }

  metrics(): HeightProjectionMetrics {
    const tasks = [...this.tasks];
    return {
      active: tasks.filter((task) => task.started).length,
      pending: tasks.filter((task) => !task.started).length,
      cancelling: tasks.filter((task) => task.started && task.cancelled).length,
      bytes: tasks.reduce((sum, task) => sum + task.bytes, 0),
      retainedInputBuffers: [
        ...new Set(tasks.flatMap((task) => inputBuffers(task.input))),
      ],
      completed: this.completed,
      maxChunkMs: this.maxChunkMs,
    };
  }
}
