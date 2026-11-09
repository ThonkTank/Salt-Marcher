import { editorBudgets } from "./budgets";

export type ComputeKind = "projection" | "background";
export type ComputePriority = "local" | "background";

export interface ComputeRun<T> {
  /** Settles only when the calculation ended, including a cancellation ACK. */
  ended: Promise<T>;
  cancel(): void;
}

export interface ComputeHandle<T> {
  readonly result: Promise<T | null>;
  cancel(): void;
}

interface Job {
  id: number;
  kind: ComputeKind;
  priority: ComputePriority;
  bytes: number;
  valid: boolean;
  start(): ComputeRun<unknown>;
  resolve(value: unknown | null): void;
  reject(reason: unknown): void;
  run?: ComputeRun<unknown>;
}

/**
 * Controller-owned admission for the two existing expensive job kinds. Each
 * kind has at most one latest waiting request; this holds no document state.
 */
export class ComputeJobs {
  private nextId = 0;
  private running = new Map<number, Job>();
  private waiting = new Map<ComputeKind, Job>();
  private closed = false;

  request<T>(
    kind: ComputeKind,
    priority: ComputePriority,
    bytes: number,
    start: () => ComputeRun<T>,
  ): ComputeHandle<T> {
    if (!Number.isSafeInteger(bytes) || bytes < 0)
      throw new RangeError("Ungültige Rechenjob-Reservierung.");
    let resolve!: (value: T | null) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<T | null>((accept, fail) => {
      resolve = accept;
      reject = fail;
    });
    const job: Job = {
      id: ++this.nextId,
      kind,
      priority,
      bytes,
      valid: !this.closed,
      start,
      resolve: (value) => resolve(value as T | null),
      reject,
    };
    const previous = this.waiting.get(kind);
    if (previous?.priority === "local" && priority === "background") {
      job.valid = false;
      resolve(null);
      return { result, cancel() {} };
    }
    if (previous) this.cancel(previous);
    if (this.closed) resolve(null);
    else {
      this.waiting.set(kind, job);
      // A local calculation may ask one lower-priority job to yield. Its slot
      // remains occupied until ended settles, never merely until this request.
      if (
        priority === "local" &&
        this.running.size >= editorBudgets.computeWorkers
      ) {
        const background = [...this.running.values()].find(
          (active) => active.valid && active.priority === "background",
        );
        if (background) this.cancel(background);
      }
      this.drain();
    }
    return { result, cancel: () => this.cancel(job) };
  }

  private cancel(job: Job): void {
    if (!job.valid) return;
    job.valid = false;
    job.resolve(null);
    if (this.waiting.get(job.kind) === job) this.waiting.delete(job.kind);
    job.run?.cancel();
  }

  private drain(): void {
    if (this.closed) return;
    while (this.running.size < editorBudgets.computeWorkers) {
      const next = [...this.waiting.values()]
        .filter(
          (job) =>
            job.kind !== "projection" ||
            ![...this.running.values()].some(
              (active) => active.kind === "projection",
            ),
        )
        .sort(
          (a, b) =>
            Number(a.priority === "background") -
              Number(b.priority === "background") || a.id - b.id,
        )[0];
      if (!next) return;
      this.waiting.delete(next.kind);
      this.running.set(next.id, next);
      try {
        const run = next.start();
        next.run = run;
        void run.ended.then(
          (value) => this.end(next, value),
          (error) => this.end(next, null, error),
        );
      } catch (error) {
        this.end(next, null, error);
      }
    }
  }

  private end(job: Job, value: unknown, error?: unknown): void {
    if (!this.running.delete(job.id)) return;
    if (job.valid) {
      job.valid = false;
      if (error !== undefined) job.reject(error);
      else job.resolve(value);
    }
    this.drain();
  }

  cancelAll(): void {
    for (const job of this.waiting.values()) this.cancel(job);
    for (const job of this.running.values()) this.cancel(job);
  }

  dispose(): void {
    this.closed = true;
    this.cancelAll();
  }

  metrics() {
    const active = [...this.running.values()];
    const pending = [...this.waiting.values()];
    return {
      active: active.length,
      pending: pending.length,
      cancelling: active.filter((job) => !job.valid).length,
      projections: active.filter((job) => job.kind === "projection").length,
      activeBytes: active.reduce((sum, job) => sum + job.bytes, 0),
      pendingBytes: pending.reduce((sum, job) => sum + job.bytes, 0),
    };
  }
}
