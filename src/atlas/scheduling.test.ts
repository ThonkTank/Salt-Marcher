import { deferred } from "../../tests/support/deferred";
import type { AtlasClient } from "./client";
import type { Bounds, Scene } from "./model";
import { scheduledRead } from "./readScheduler";
import { describe, expect, it, vi } from "vitest";
import { PreviewScheduler } from "./previewScheduler";

describe("preview scheduling", () => {
  it("runs the first and last request, and settles replaced jobs", async () => {
    const scheduler = new PreviewScheduler<number>();
    const gate = deferred<number>();
    const called: number[] = [];
    const promises = Array.from({ length: 10 }, (_, n) =>
      scheduler.schedule(
        () => true,
        () => {
          called.push(n);
          return n === 0 ? gate.promise : Promise.resolve(n);
        },
      ),
    );
    expect(called).toEqual([0]);
    expect(await Promise.all(promises.slice(1, 9))).toEqual(
      Array(8).fill(null),
    );
    gate.resolve(0);
    expect(await Promise.all([promises[0], promises[9]])).toEqual([0, 9]);
    expect(called).toEqual([0, 9]);
  });
  it("retains the running slot through cancellation and checks before sending", async () => {
    const scheduler = new PreviewScheduler<number>();
    const gate = deferred<number>();
    const first = scheduler.schedule(
      () => true,
      () => gate.promise,
    );
    const cancelled = scheduler.schedule(
      () => true,
      async () => 1,
    );
    scheduler.cancelWaiting();
    expect(await cancelled).toBeNull();
    let valid = true;
    const last = scheduler.schedule(
      () => valid,
      async () => 2,
    );
    valid = false;
    gate.resolve(0);
    expect(await first).toBe(0);
    expect(await last).toBeNull();
  });
});

it("drops an obsolete read waiting behind the four physical slots", async () => {
  const held = deferred<Scene>();
  const read = vi.fn(() => held.promise);
  const client = { read } as unknown as AtlasClient;
  const args = {
    bounds: [0, 0, 1, 1] as Bounds,
    context: { kind: "exterior" as const },
    selectedId: "",
  };
  const active = Array.from({ length: 4 }, () =>
    scheduledRead(client, "scene", args),
  );
  let wanted = true;
  const waiting = scheduledRead(client, "scene", args, () => wanted);
  expect(read).toHaveBeenCalledTimes(4);
  wanted = false;
  held.resolve({} as Scene);
  await Promise.all(active);
  expect(await waiting).toBeUndefined();
  expect(read).toHaveBeenCalledTimes(4);
});
