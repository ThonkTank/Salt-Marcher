import source from "dungeon-compute-worker";
import { type ComputeRequest } from "./compute";

export class ComputeClient {
  private worker?: Worker;
  private url?: string;
  private sequence = 0;
  private closed = false;
  private pending = new Map<
    number,
    { resolve: (data: unknown) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.start();
  }

  private start(): Worker {
    if (this.closed) throw new Error("Berechnung abgebrochen.");
    this.url = URL.createObjectURL(
      new Blob([source], { type: "text/javascript" }),
    );
    const worker = new Worker(this.url);
    this.worker = worker;
    worker.onmessage = (event) => {
      const task = this.pending.get(event.data.id);
      if (!task) return;
      this.pending.delete(event.data.id);
      if (event.data.error) task.reject(new Error(event.data.error));
      else task.resolve(event.data.result);
    };
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      for (const task of this.pending.values())
        task.reject(new Error(event.message));
      this.pending.clear();
      worker.terminate();
      if (this.url) URL.revokeObjectURL(this.url);
      this.worker = undefined;
      this.url = undefined;
    };
    return worker;
  }

  request<T>(request: ComputeRequest): Promise<T> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (data) => resolve(data as T), reject });
      (this.worker ?? this.start()).postMessage({ id, request });
    });
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.worker?.terminate();
    if (this.url) URL.revokeObjectURL(this.url);
    this.worker = undefined;
    this.url = undefined;
    for (const task of this.pending.values())
      task.reject(new Error("Berechnung abgebrochen."));
    this.pending.clear();
  }
}
