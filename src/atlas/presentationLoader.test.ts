import { expect, it, vi } from "vitest";
import { AtlasClient } from "./client";
import type { Scene, Status } from "./model";
import {
  PresentationLoader,
  type PresentationInput,
} from "./presentationLoader";

const status: Status = {
  sessionId: "test",
  revision: 1,
  path: null,
  dirty: false,
  canUndo: false,
  canRedo: false,
  changes: null,
};
const scene = (version = status): Scene => ({
  status: version,
  objects: [],
  contextState: { exists: true, parcelId: null, houseId: null },
  selectionState: { exists: false, parcelId: null, houseId: null },
});
function harness() {
  const requests: Array<{
    resolve: (scene: Scene) => void;
    reject: (error: Error) => void;
  }> = [];
  const client = new AtlasClient(
    () =>
      new Promise<Scene>((resolve, reject) =>
        requests.push({ resolve, reject }),
      ),
  );
  const input: PresentationInput = {
    client,
    status,
    bounds: [0, 0, 100, 100],
    editorContext: { kind: "exterior" },
    selectedId: "",
    floor: 0,
    detailEnabled: true,
    includeLower: true,
  };
  return { loader: new PresentationLoader(), input, requests };
}

it("keeps one request for equivalent renders and reuses a complete scene inside its margin", async () => {
  const { loader, input, requests } = harness();
  loader.update(input);
  loader.update({ ...input, bounds: [...input.bounds] });
  expect(requests).toHaveLength(1);
  requests[0].resolve(scene());
  await vi.waitFor(() => expect(loader.fresh(input)).toBe(true));
  const moved: PresentationInput = { ...input, bounds: [20, 20, 80, 80] };
  loader.update(moved);
  expect(loader.fresh(moved)).toBe(true);
  expect(requests).toHaveLength(1);
  loader.dispose();
});

it("rejects late A responses after A → B → A even when the document version matches", async () => {
  const { loader, input, requests } = harness();
  loader.update(input);
  loader.update({ ...input, selectedId: "other" });
  loader.update(input);
  const latest = scene();
  requests[2].resolve(latest);
  await vi.waitFor(() =>
    expect(loader.getSnapshot().display?.value.scene).toBe(latest),
  );
  requests[0].resolve(scene());
  requests[1].reject(Error("obsolete failure"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(loader.getSnapshot().display?.value.scene).toBe(latest);
  expect(loader.getSnapshot().error).toBe("");
  expect(loader.fresh(input)).toBe(true);
  loader.dispose();
});

it("allows a covering exterior response during a newer margin read without overwriting its later result", async () => {
  const { loader, input, requests } = harness();
  loader.update(input);
  const moved: PresentationInput = { ...input, bounds: [1, 0, 101, 100] };
  loader.update(moved);
  requests[0].resolve(scene());
  await vi.waitFor(() => expect(loader.fresh(moved)).toBe(true));
  expect(loader.getSnapshot().loading).toBe(true);
  expect(loader.getSnapshot().display?.value.bounds).toEqual([
    -20, -20, 120, 120,
  ]);
  const latest = scene();
  requests[1].resolve(latest);
  await vi.waitFor(() => expect(loader.getSnapshot().loading).toBe(false));
  expect(loader.getSnapshot().display?.value.scene).toBe(latest);
  expect(loader.getSnapshot().display?.value.bounds).toEqual([
    -20, -20, 140, 120,
  ]);
  loader.dispose();
});

it("invalidates disposed reads and starts a fresh request after remount", async () => {
  const { loader, input, requests } = harness();
  loader.update(input);
  loader.dispose();
  loader.update(input);
  requests[0].resolve(scene());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(loader.getSnapshot().display).toBeNull();
  requests[1].resolve(scene());
  await vi.waitFor(() => expect(loader.fresh(input)).toBe(true));
  loader.dispose();
});

it("keeps the previous complete view on failure and retries without reusing stale data", async () => {
  const { loader, input, requests } = harness();
  loader.update(input);
  const previous = scene();
  requests[0].resolve(previous);
  await vi.waitFor(() => expect(loader.fresh(input)).toBe(true));
  const moved: PresentationInput = { ...input, bounds: [200, 0, 300, 100] };
  loader.update(moved);
  requests[1].resolve(scene({ ...status, revision: 2 }));
  await vi.waitFor(() => expect(loader.getSnapshot().error).not.toBe(""));
  expect(loader.getSnapshot().display?.value.scene).toBe(previous);
  expect(loader.fresh(moved)).toBe(false);
  loader.retry();
  requests[2].resolve(scene());
  await vi.waitFor(() => expect(loader.fresh(moved)).toBe(true));
  expect(loader.getSnapshot().error).toBe("");
  loader.dispose();
});

it("never publishes late city tiles after a level A-B-A change", async () => {
  type Reply = {
    status: Status;
    level: number;
    tiles: Array<{
      x: number;
      y: number;
      density: [number, number, number][];
      features: [];
    }>;
  };
  const pending: Array<{
    level: number;
    tiles: [number, number][];
    resolve: (value: Reply) => void;
  }> = [];
  const client = new AtlasClient(
    (_cmd, args) =>
      new Promise<Reply>((resolve) =>
        pending.push({
          level: args.level as number,
          tiles: args.tiles as [number, number][],
          resolve,
        }),
      ),
  );
  const loader = new PresentationLoader();
  const input: PresentationInput = {
    client,
    status,
    bounds: [0, 0, 100, 100],
    editorContext: { kind: "exterior" },
    selectedId: "",
    floor: 0,
    detailEnabled: false,
    includeLower: false,
    cityLevel: 2,
  };
  loader.update(input);
  loader.update({ ...input, cityLevel: 3 });
  loader.update(input);
  expect(pending).toHaveLength(3);
  const reply = (i: number) =>
    pending[i].resolve({
      status,
      level: pending[i].level,
      tiles: pending[i].tiles.map(([x, y]) => ({
        x,
        y,
        density: [],
        features: [],
      })),
    });
  reply(0);
  reply(1);
  await Promise.resolve();
  await Promise.resolve();
  expect(loader.getSnapshot().display?.value.overview).toBeUndefined();
  expect(loader.fresh(input)).toBe(false);
  reply(2);
  await vi.waitFor(() => expect(loader.fresh(input)).toBe(true));
  expect(loader.getSnapshot().display?.value.overview?.level).toBe(2);
  loader.dispose();
});

it("overview resolves only road headers and discards late selection responses", async () => {
  const headers: Array<{ id: unknown; resolve: (value: Scene) => void }> = [];
  const requests: string[] = [];
  const client = new AtlasClient(async (cmd, args) => {
    requests.push(cmd);
    if (cmd === "mapTiles")
      return {
        status,
        level: args.level,
        tiles: (args.tiles as number[][]).map(([x, y]) => ({
          x,
          y,
          density: [],
          features: [],
        })),
      };
    if (cmd === "roadHeader")
      return new Promise<Scene>((resolve) =>
        headers.push({ id: args.roadId, resolve }),
      );
    throw Error(`Unexpected full-scene read: ${cmd}`);
  });
  const { loader, input } = harness();
  const base = { ...input, client, cityLevel: 1, detailEnabled: false };
  loader.update({ ...base, selectedId: "road-a" });
  await vi.waitFor(() => expect(headers).toHaveLength(1));
  loader.update({ ...base, selectedId: "road-b" });
  await vi.waitFor(() => expect(headers).toHaveLength(2));
  const latest = scene();
  latest.selectionState.exists = true;
  headers[1].resolve(latest);
  await vi.waitFor(() =>
    expect(loader.getSnapshot().display?.value.selectedId).toBe("road-b"),
  );
  headers[0].resolve(scene());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(loader.getSnapshot().display?.value.selectedId).toBe("road-b");
  expect(
    requests.every((cmd) => cmd === "mapTiles" || cmd === "roadHeader"),
  ).toBe(true);
  loader.dispose();
});

it("loads independent layers without waiting for a delayed river response", async () => {
  let release!: (value: unknown) => void;
  const client = new AtlasClient(async (cmd) =>
    cmd === "rivers"
      ? new Promise((resolve) => {
          release = resolve;
        })
      : {
          status,
          catalog: { categories: [], ranks: [] },
          summaries: [],
          regions: [],
          relations: [],
        },
  );
  const loader = new PresentationLoader();
  const river = loader.layer("rivers"),
    catalog = loader.layer("regionCatalog");
  river.update(client, {
    version: status,
    bounds: [0, 0, 100, 100],
    ids: [],
  });
  catalog.update(client, {
    version: status,
    bounds: null,
    rankIds: [],
    ids: [],
    detail: null,
    exact: false,
    scale: 1,
  });
  await vi.waitFor(() =>
    expect(catalog.snapshot.value?.status).toEqual(status),
  );
  expect(river.snapshot.loading).toBe(true);
  loader.dispose();
  release({ status, rivers: [] });
  await Promise.resolve();
  expect(river.snapshot.value).toBeNull();
});

it("rejects obsolete layer responses after A → B → A and retains the last complete view on errors", async () => {
  const pending: Array<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  const client = new AtlasClient(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  );
  const loader = new PresentationLoader(),
    layer = loader.layer("rivers");
  const a = {
    version: status,
    bounds: [0, 0, 100, 100] as [number, number, number, number],
    ids: [],
  };
  layer.update(client, a);
  pending[0].resolve({ status, rivers: [] });
  await vi.waitFor(() => expect(layer.snapshot.loading).toBe(false));
  const complete = layer.snapshot.value;
  layer.update(client, { ...a, ids: ["b"] });
  layer.update(client, a);
  pending[1].resolve({ status, rivers: [{ obsolete: true }] });
  await Promise.resolve();
  expect(pending).toHaveLength(2);
  expect(layer.snapshot.value).toBe(complete);
  layer.update(client, { ...a, ids: ["c"] });
  pending[2].reject(Error("read failed"));
  await vi.waitFor(() => expect(layer.snapshot.error).toContain("read failed"));
  expect(layer.snapshot.value).toBe(complete);
  loader.dispose();
});

it("invalidates layer freshness on client replacement and disposal even before the next read", async () => {
  const client = new AtlasClient(async () => ({ status, rivers: [] }));
  const replacement = new AtlasClient(async () => ({ status, rivers: [] }));
  const loader = new PresentationLoader(),
    layer = loader.layer("rivers");
  const args = {
    version: status,
    bounds: [0, 0, 100, 100] as [number, number, number, number],
    ids: [],
  };
  layer.update(client, args);
  await vi.waitFor(() => expect(layer.fresh(client, args)).toBe(true));
  expect(layer.fresh(replacement, args)).toBe(false);
  expect(layer.fresh(client, null)).toBe(false);
  loader.dispose();
  expect(layer.fresh(client, args)).toBe(false);
  layer.update(replacement, args);
  await vi.waitFor(() => expect(layer.fresh(replacement, args)).toBe(true));
  loader.dispose();
});

it("retains in-flight surface reads while zoom stays within the same raster bands", async () => {
  const { input, loader } = harness();
  const pending = new Promise<never>(() => {});
  const read = vi.fn(() => pending);
  const client = new AtlasClient(read);
  const initial = { ...input, client, terrainLevel: 0, groundLevel: 0 };
  loader.update(initial);
  loader.update({ ...initial, terrainLevel: 0, groundLevel: 0 });
  expect(read).toHaveBeenCalledTimes(3);
  loader.update({ ...initial, terrainLevel: 1, groundLevel: 0 });
  expect(read).toHaveBeenCalledTimes(4);
  loader.dispose();
});

it("publishes a ready scene and terrain while ground is held, then reports and retries its error", async () => {
  const pending: Array<{
    cmd: string;
    args: Record<string, unknown>;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  const client = new AtlasClient(
    (cmd, args) =>
      new Promise((resolve, reject) =>
        pending.push({ cmd, args, resolve, reject }),
      ),
  );
  const { input, loader } = harness();
  const current = { ...input, client, terrainLevel: 0, groundLevel: 0 };
  loader.update(current);
  const request = (name: string) => pending.find((p) => p.cmd === name)!;
  request("scene").resolve(scene());
  const terrain = request("terrainTiles");
  terrain.resolve({
    status,
    level: 0,
    tiles: (terrain.args.tiles as number[][]).map(([x, y]) => ({ x, y })),
  });
  await vi.waitFor(() =>
    expect(loader.getSnapshot().display?.value.terrain).toBeDefined(),
  );
  expect(loader.getSnapshot().display?.value.scene.status).toEqual(status);
  expect(loader.getSnapshot().display?.value.ground).toBeUndefined();
  expect(loader.fresh(current)).toBe(false);
  request("groundTiles").reject(Error("ground failed"));
  await vi.waitFor(() =>
    expect(loader.getSnapshot().error).toContain("ground failed"),
  );
  expect(loader.getSnapshot().display?.value.terrain).toBeDefined();
  loader.retry();
  await vi.waitFor(() =>
    expect(pending.filter((p) => p.cmd === "groundTiles")).toHaveLength(2),
  );
  const retryGround = pending.filter((p) => p.cmd === "groundTiles")[1];
  retryGround.resolve({
    status,
    level: 0,
    tiles: (retryGround.args.tiles as number[][]).map(([x, y]) => ({
      x,
      y,
      pixels: "",
    })),
  });
  const retryScene = pending.filter((p) => p.cmd === "scene")[1];
  retryScene.resolve(scene());
  await vi.waitFor(() => expect(loader.fresh(current)).toBe(true));
  expect(loader.getSnapshot().display?.value.ground).toBeDefined();
  loader.dispose();
});

it("never combines terrain and ground from different revisions", async () => {
  const pending: Array<{
    cmd: string;
    args: Record<string, unknown>;
    resolve: (value: unknown) => void;
  }> = [];
  const client = new AtlasClient(
    (cmd, args) =>
      new Promise((resolve) => pending.push({ cmd, args, resolve })),
  );
  const { input, loader } = harness();
  const initial = { ...input, client, terrainLevel: 0, groundLevel: 0 };
  const reply = (item: (typeof pending)[number], version: Status) =>
    item.resolve(
      item.cmd === "scene"
        ? scene(version)
        : {
            status: version,
            level: item.args.level,
            tiles: (item.args.tiles as number[][]).map(([x, y]) => ({
              x,
              y,
              pixels: "",
            })),
          },
    );
  loader.update(initial);
  pending.forEach((item) => reply(item, status));
  await vi.waitFor(() => expect(loader.fresh(initial)).toBe(true));
  const nextStatus = { ...status, revision: 2 };
  const next = { ...initial, status: nextStatus };
  loader.update(next);
  const terrain = pending.filter((p) => p.cmd === "terrainTiles").at(-1)!;
  reply(terrain, nextStatus);
  await vi.waitFor(() =>
    expect(loader.getSnapshot().display?.value.terrain?.status.revision).toBe(
      2,
    ),
  );
  expect(loader.getSnapshot().display?.value.ground).toBeUndefined();
  expect(loader.fresh(next)).toBe(false);
  const ground = pending.filter((p) => p.cmd === "groundTiles").at(-1)!;
  reply(ground, nextStatus);
  pending
    .filter((p) => p.cmd === "scene")
    .at(-1)!
    .resolve(scene(nextStatus));
  await vi.waitFor(() => expect(loader.fresh(next)).toBe(true));
  expect(loader.getSnapshot().display?.value.ground?.status.revision).toBe(2);
  loader.dispose();
});

it("coalesces rapid viewport changes and reuses a complete covering exact read", async () => {
  const calls: Array<{ bounds: [number, number, number, number] }> = [];
  const client = new AtlasClient(async (_cmd, args) => {
    calls.push(args as (typeof calls)[number]);
    return { status, rivers: [] };
  });
  const loader = new PresentationLoader(),
    layer = loader.layer("rivers");
  const a = {
    version: status,
    bounds: [0, 0, 100, 100] as [number, number, number, number],
    ids: [],
  };
  layer.update(client, a);
  await vi.waitFor(() => expect(layer.fresh(client, a)).toBe(true));
  const inside = { ...a, bounds: [10, 10, 90, 90] as typeof a.bounds };
  layer.update(client, inside);
  expect(layer.fresh(client, inside)).toBe(true);
  expect(calls).toHaveLength(1);
  for (let x = 1; x <= 20; x++)
    layer.update(client, { ...a, bounds: [x, 0, x + 100, 100] });
  await vi.waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1].bounds).toEqual([20, 0, 120, 100]);
  loader.dispose();
});

it("shows a completed terrain layer while the first scene is held without enabling editing", async () => {
  let releaseScene!: (value: Scene) => void;
  const client = new AtlasClient((cmd, args) => {
    if (cmd === "scene")
      return new Promise((resolve) => {
        releaseScene = resolve;
      });
    if (cmd === "terrainTiles")
      return Promise.resolve({
        status,
        level: args.level,
        tiles: (args.tiles as number[][]).map(([x, y]) => ({ x, y })),
      });
    throw Error(`Unexpected ${cmd}`);
  });
  const { input, loader } = harness();
  const current = { ...input, client, terrainLevel: 0 };
  loader.update(current);
  await vi.waitFor(() =>
    expect(loader.getSnapshot().display?.value.terrain).toBeDefined(),
  );
  expect(loader.fresh(current)).toBe(false);
  releaseScene(scene());
  await vi.waitFor(() => expect(loader.fresh(current)).toBe(true));
  loader.dispose();
});

it("drops retained layer data and late reads when sessions switch A → B → A", async () => {
  const pending: Array<{ resolve: (value: unknown) => void }> = [];
  const client = new AtlasClient(
    () => new Promise((resolve) => pending.push({ resolve })),
  );
  const loader = new PresentationLoader(),
    layer = loader.layer("rivers");
  const a = {
    version: status,
    bounds: [0, 0, 100, 100] as [number, number, number, number],
    ids: [],
  };
  const bStatus = { ...status, sessionId: "other" };
  layer.update(client, a);
  layer.update(client, { ...a, version: bStatus });
  layer.update(client, a);
  pending[0].resolve({ status, rivers: [{ obsolete: true }] });
  pending[1].resolve({ status: bStatus, rivers: [{ obsolete: true }] });
  await Promise.resolve();
  expect(layer.snapshot.value).toBeNull();
  expect(layer.fresh(client, a)).toBe(false);
  pending[2].resolve({ status, rivers: [] });
  await vi.waitFor(() => expect(layer.fresh(client, a)).toBe(true));
  expect(layer.snapshot.value?.rivers).toEqual([]);
  loader.dispose();
});
