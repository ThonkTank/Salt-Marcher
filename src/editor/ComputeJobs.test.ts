import { expect, it, vi } from "vitest";
import { ComputeJobs, type ComputeRun } from "./ComputeJobs";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const ended = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  const cancel = vi.fn();
  const start = vi.fn((): ComputeRun<T> => ({ ended, cancel }));
  return { start, resolve, reject, cancel };
}

it("keeps cancelled computation in its slot until an actual completion ACK", async () => {
  const jobs = new ComputeJobs();
  const first = deferred<number>();
  const second = deferred<number>();
  const a = jobs.request("projection", "local", 100, first.start);
  const b = jobs.request("projection", "local", 200, second.start);
  a.cancel();
  expect(await a.result).toBeNull();
  expect(first.cancel).toHaveBeenCalledOnce();
  expect(second.start).not.toHaveBeenCalled();
  expect(jobs.metrics()).toMatchObject({
    active: 1,
    pending: 1,
    cancelling: 1,
    activeBytes: 100,
    pendingBytes: 200,
  });
  // Even a late successful result belongs to invalidated work.
  first.resolve(42);
  await Promise.resolve();
  expect(second.start).toHaveBeenCalledOnce();
  expect(jobs.metrics()).toMatchObject({
    active: 1,
    pending: 0,
    cancelling: 0,
  });
  second.resolve(7);
  expect(await b.result).toBe(7);
  expect(jobs.metrics().active).toBe(0);
});

it("retains a needed older projection while replacing only its latest waiting request", async () => {
  const jobs = new ComputeJobs();
  const old = deferred<string>();
  const superseded = deferred<string>();
  const newest = deferred<string>();
  const a = jobs.request("projection", "local", 100, old.start);
  const b = jobs.request("projection", "local", 150, superseded.start);
  const c = jobs.request("projection", "local", 200, newest.start);
  expect(await b.result).toBeNull();
  expect(old.cancel).not.toHaveBeenCalled();
  expect(superseded.start).not.toHaveBeenCalled();
  expect(jobs.metrics()).toMatchObject({
    active: 1,
    pending: 1,
    pendingBytes: 200,
  });
  old.resolve("R");
  expect(await a.result).toBe("R");
  expect(newest.start).toHaveBeenCalledOnce();
  newest.resolve("R+2");
  expect(await c.result).toBe("R+2");
});

it("prioritizes local work over background while never exceeding two active jobs", async () => {
  const jobs = new ComputeJobs();
  const a = deferred<number>();
  const b = deferred<number>();
  const c = deferred<number>();
  const local = deferred<number>();
  const backgroundA = jobs.request("background", "background", 10, a.start);
  jobs.request("background", "background", 20, b.start);
  jobs.request("background", "background", 30, c.start);
  const projection = jobs.request("projection", "local", 40, local.start);
  expect(a.cancel).toHaveBeenCalledOnce();
  expect(await backgroundA.result).toBeNull();
  expect(jobs.metrics()).toMatchObject({
    active: 2,
    pending: 2,
    cancelling: 1,
  });
  expect(local.start).not.toHaveBeenCalled();
  a.resolve(1);
  await Promise.resolve();
  expect(local.start).toHaveBeenCalledOnce();
  expect(c.start).not.toHaveBeenCalled();
  expect(jobs.metrics().active).toBe(2);
  local.resolve(4);
  expect(await projection.result).toBe(4);
  expect(c.start).toHaveBeenCalledOnce();
  expect(jobs.metrics().active).toBe(2);
  b.resolve(2);
  c.resolve(3);
});

it("propagates calculation failure and admits the next valid job", async () => {
  const jobs = new ComputeJobs();
  const failed = deferred<number>();
  const next = deferred<number>();
  const a = jobs.request("projection", "local", 10, failed.start);
  const b = jobs.request("projection", "local", 20, next.start);
  const rejection = expect(a.result).rejects.toThrow("bad projection");
  failed.reject(new Error("bad projection"));
  await rejection;
  expect(next.start).toHaveBeenCalledOnce();
  next.resolve(2);
  expect(await b.result).toBe(2);
});

it("disposal invalidates results immediately and releases reservations only on end", async () => {
  const jobs = new ComputeJobs();
  const active = deferred<number>();
  const queued = deferred<number>();
  const a = jobs.request("projection", "local", 10, active.start);
  const b = jobs.request("projection", "local", 20, queued.start);
  jobs.dispose();
  expect(await a.result).toBeNull();
  expect(await b.result).toBeNull();
  expect(jobs.metrics()).toMatchObject({
    active: 1,
    pending: 0,
    activeBytes: 10,
  });
  const impossible = jobs.request("background", "background", 30, queued.start);
  expect(await impossible.result).toBeNull();
  expect(queued.start).not.toHaveBeenCalled();
  active.resolve(1);
  await Promise.resolve();
  expect(jobs.metrics()).toMatchObject({ active: 0, activeBytes: 0 });
});

it("does not let newer background work replace a waiting local projection", async () => {
  const jobs = new ComputeJobs();
  const active = deferred<number>();
  const local = deferred<number>();
  const remote = deferred<number>();
  const a = jobs.request("projection", "background", 10, active.start);
  const b = jobs.request("projection", "local", 20, local.start);
  const c = jobs.request("projection", "background", 30, remote.start);
  expect(await c.result).toBeNull();
  expect(jobs.metrics()).toMatchObject({
    active: 1,
    pending: 1,
    pendingBytes: 20,
  });
  active.resolve(1);
  expect(await a.result).toBe(1);
  expect(local.start).toHaveBeenCalledOnce();
  expect(remote.start).not.toHaveBeenCalled();
  local.resolve(2);
  expect(await b.result).toBe(2);
});
