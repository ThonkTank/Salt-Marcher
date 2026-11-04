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
  expect(loader.getSnapshot().display).toBeNull();
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
