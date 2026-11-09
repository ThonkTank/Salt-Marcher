import { expect, it, vi } from "vitest";
import { ComputeJobs } from "../ComputeJobs";
import { heightTilesFromControls, type HeightTile } from "../model";
import {
  WorkerHeightProjectionService,
  type ProjectionWorkerPort,
} from "./HeightProjectionService";
import type {
  HeightProjectionRequest,
  HeightProjectionResponse,
} from "./height-projection";

class WorkerPort implements ProjectionWorkerPort {
  onmessage: ProjectionWorkerPort["onmessage"] = null;
  onerror: ProjectionWorkerPort["onerror"] = null;
  sent: HeightProjectionRequest[] = [];
  terminate = vi.fn();
  postMessage(message: HeightProjectionRequest, transfer?: Transferable[]) {
    this.sent.push(structuredClone(message, { transfer }));
  }
  ready(id: number, sessionId = "") {
    this.onmessage?.({
      data: { kind: "ready", id, sessionId },
    } as MessageEvent<HeightProjectionResponse>);
  }
  hydrate(id: number, sessionId = "") {
    for (let step = 0; step < 100; step++) {
      const last = this.sent.filter((request) => request.id === id).at(-1);
      if (last?.kind === "project" || last?.kind === "cancel") return;
      this.ready(id, sessionId);
    }
    throw new Error("Worker hydration did not finish.");
  }
  complete(id: number, value = 12, sessionId = "") {
    if (this.sent.some((request) => request.id === id))
      this.hydrate(id, sessionId);
    this.onmessage?.({
      data: {
        kind: "finished",
        id,
        sessionId,
        pixels: new Uint8Array(4 * 4 * 4).fill(value),
        samples: 16,
        maxChunkMs: 1.2,
      },
    } as MessageEvent<HeightProjectionResponse>);
  }
}

const input = (sources: HeightTile[] = []) => ({
  sources,
  bounds: [0, 0, 320, 320] as [number, number, number, number],
  size: 4,
});

it("runs only one exception, accepts its older frozen content, and keeps only latest pending", async () => {
  const jobs = new ComputeJobs();
  const port = new WorkerPort();
  const service = new WorkerHeightProjectionService(jobs, () => port);
  const source = heightTilesFromControls(0, [[0, 0, 600]]);
  const first = service.request(input(source));
  const second = service.request(input());
  const third = service.request(input());
  expect(await second.promise).toBeNull();
  expect(port.sent.filter((request) => request.kind === "begin")).toHaveLength(
    1,
  );
  expect(source[0].values.byteLength).toBe(64 * 64 * 8);
  expect(service.metrics()).toMatchObject({ active: 1, pending: 1 });
  const originalBytes = service.metrics().bytes;
  expect(originalBytes).toBeGreaterThan(source[0].values.byteLength);
  port.complete(1);
  expect(await first.promise).toEqual(new Uint8Array(64).fill(12));
  expect(port.sent.filter((request) => request.kind === "begin")).toHaveLength(
    2,
  );
  expect(service.metrics().bytes).toBeLessThan(originalBytes);
  port.complete(3, 24);
  expect(await third.promise).toEqual(new Uint8Array(64).fill(24));
  expect(service.metrics()).toMatchObject({
    active: 0,
    pending: 0,
    bytes: 0,
    completed: 2,
  });
});

it("cancellation invalidates output now but keeps slot and buffers until the worker ends", async () => {
  const jobs = new ComputeJobs();
  const port = new WorkerPort();
  const service = new WorkerHeightProjectionService(jobs, () => port);
  const first = service.request(input());
  first.cancel();
  expect(await first.promise).toBeNull();
  expect(port.sent.at(-1)).toEqual({ kind: "cancel", id: 1, sessionId: "" });
  const second = service.request(input());
  expect(jobs.metrics()).toMatchObject({
    active: 1,
    pending: 1,
    cancelling: 1,
  });
  expect(service.metrics()).toMatchObject({
    active: 1,
    pending: 1,
    cancelling: 1,
  });
  const retained = service.metrics().bytes;
  port.complete(1);
  await Promise.resolve();
  expect(service.metrics().bytes).toBeLessThan(retained);
  expect(port.sent.at(-1)).toMatchObject({ kind: "begin", id: 2 });
  port.complete(2);
  expect(await second.promise).not.toBeNull();
});

it("does not let a stale acknowledgement or incomplete result certify another projection", async () => {
  const jobs = new ComputeJobs();
  const port = new WorkerPort();
  const service = new WorkerHeightProjectionService(jobs, () => port);
  const first = service.request(input());
  port.complete(888);
  expect(service.metrics().active).toBe(1);
  const rejection = expect(first.promise).rejects.toThrow("Unvollständiges");
  port.onmessage?.({
    data: {
      kind: "finished",
      id: 1,
      sessionId: "",
      pixels: new Uint8Array(4),
      samples: 1,
      maxChunkMs: 1,
    },
  } as MessageEvent<HeightProjectionResponse>);
  await rejection;
  expect(service.metrics()).toMatchObject({
    active: 0,
    bytes: 0,
    completed: 0,
  });
});

it("disposal cooperatively ends active work before terminating the worker", async () => {
  const jobs = new ComputeJobs();
  const port = new WorkerPort();
  const service = new WorkerHeightProjectionService(jobs, () => port);
  const first = service.request(input());
  service.dispose();
  expect(await first.promise).toBeNull();
  expect(port.terminate).not.toHaveBeenCalled();
  expect(service.metrics().active).toBe(1);
  port.onmessage?.({
    data: { kind: "cancelled", id: 1, sessionId: "" },
  } as MessageEvent<HeightProjectionResponse>);
  await Promise.resolve();
  expect(port.terminate).toHaveBeenCalledOnce();
  expect(jobs.metrics().active).toBe(0);
  expect(service.metrics().bytes).toBe(0);
});

it("hydrates one 32 KiB source or overview chunk per ACK without detaching authors", async () => {
  const jobs = new ComputeJobs();
  const port = new WorkerPort();
  const service = new WorkerHeightProjectionService(jobs, () => port);
  service.setSession("R3");
  const sources = [
    ...heightTilesFromControls(0, [[0, 0, 300]]),
    ...heightTilesFromControls(1, [[0, 0, 600]]),
  ];
  const overview = new Float64Array(128 * 128).fill(1);
  const task = service.request({ ...input(sources), size: 128, overview });
  expect(port.sent).toHaveLength(1);
  expect(port.sent[0]).toMatchObject({
    kind: "begin",
    sessionId: "R3",
    sourceCount: 2,
  });
  port.ready(1, "old-session");
  expect(port.sent).toHaveLength(1);
  port.ready(1, "R3");
  expect(port.sent.at(-1)).toMatchObject({
    kind: "source",
    source: { level: 0 },
  });
  expect(port.sent).toHaveLength(2);
  port.ready(1, "R3");
  expect(port.sent.at(-1)).toMatchObject({
    kind: "source",
    source: { level: 1 },
  });
  for (let chunk = 0; chunk < 4; chunk++) {
    port.ready(1, "R3");
    const request = port.sent.at(-1);
    expect(request).toMatchObject({ kind: "overview", offset: chunk * 4096 });
    if (request?.kind === "overview")
      expect(request.values.byteLength).toBe(32768);
  }
  port.ready(1, "R3");
  expect(port.sent.at(-1)).toEqual({ kind: "project", id: 1, sessionId: "R3" });
  expect(overview.byteLength).toBe(128 * 128 * 8);
  expect(sources.map((source) => source.values.byteLength)).toEqual([
    32768, 32768,
  ]);
  task.cancel();
  expect(await task.promise).toBeNull();
  expect(jobs.metrics().active).toBe(1);
  port.onmessage?.({
    data: { kind: "cancelled", id: 1, sessionId: "R3" },
  } as MessageEvent<HeightProjectionResponse>);
  await Promise.resolve();
  expect(jobs.metrics().active).toBe(0);
});

it("keeps a waiting local request when a newer background exception arrives", async () => {
  const jobs = new ComputeJobs();
  const port = new WorkerPort();
  const service = new WorkerHeightProjectionService(jobs, () => port);
  const active = service.request(input(), "background");
  const local = service.request(input(), "local");
  const remote = service.request(input(), "background");
  expect(await remote.promise).toBeNull();
  expect(service.metrics()).toMatchObject({ active: 1, pending: 1 });
  port.complete(1);
  expect(await active.promise).not.toBeNull();
  expect(port.sent.at(-1)).toMatchObject({ kind: "begin", id: 2 });
  port.complete(2);
  expect(await local.promise).not.toBeNull();
});
