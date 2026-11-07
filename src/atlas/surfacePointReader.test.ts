import { expect, it } from "vitest";
import { SurfacePointReader } from "./surfacePointReader";
import { AtlasClient } from "./client";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
it("coalesces movement, rejects obsolete revisions and stops after unmount", async () => {
  const calls: {
    args: Record<string, unknown>;
    resolve: (v: unknown) => void;
  }[] = [];
  const reader = new SurfacePointReader(
    new AtlasClient(
      (_, args) => new Promise((resolve) => calls.push({ args, resolve })),
    ),
  );
  const version = { sessionId: "one", revision: 1 };
  reader.update(version, [0, 0]);
  reader.update(version, [1, 1]);
  reader.update(version, [2, 2]);
  expect(calls).toHaveLength(1);
  calls[0].resolve({ status: version, heights: [10] });
  await tick();
  expect(reader.getSnapshot()).toBeNull();
  expect(calls).toHaveLength(2);
  expect(calls[1].args.points).toEqual([[2, 2]]);
  calls[1].resolve({ status: version, heights: [20] });
  await tick();
  expect(reader.getSnapshot()?.height).toBe(20);
  reader.update({ ...version, revision: 2 }, [2, 2]);
  expect(reader.getSnapshot()).toBeNull();
  calls[2].resolve({ status: version, heights: [30] });
  await tick();
  expect(reader.getSnapshot()).toBeNull();
  reader.update({ sessionId: "two", revision: 0 }, [2, 2]);
  reader.update(null, null);
  calls[3].resolve({
    status: { sessionId: "two", revision: 0 },
    heights: [40],
  });
  await tick();
  expect(reader.getSnapshot()).toBeNull();
  expect(calls).toHaveLength(4);
});
