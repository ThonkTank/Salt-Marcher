import assert from "node:assert/strict";
import test from "node:test";
import { DungeonPlayView, DungeonView } from "../src/ui/views";
import {
  dungeonViewState,
  withDungeonViewState,
} from "../src/features/verwaltung/dungeon-view-state";
import {
  TFile,
  dungeonViewTestDom,
} from "./fixtures/obsidian-dungeon-view-stub";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
}

async function turn(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function map() {
  return {
    session: { dirty: false, settings: { assetPacks: [], builtInAssets: true } },
    repository: {
      save: async () => {},
      persistDraft: async () => {},
    },
  };
}

class FakeEditor {
  activeFloorId = "floor-ground";
  readonly initial: Array<string | undefined> = [];
  readonly workspace: string[] = [];
  commits = 0;
  destroys = 0;
  maximizes = 0;
  constructor(
    readonly host: { floorState?: { changed(id: string): void } },
    private readonly initialized: Promise<void> = Promise.resolve(),
  ) {}
  init(): Promise<void> { return this.initialized; }
  restoreInitialFloor(id?: string): string {
    this.initial.push(id);
    this.activeFloorId = id ?? "floor-ground";
    this.host.floorState?.changed(this.activeFloorId);
    return this.activeFloorId;
  }
  restoreWorkspaceFloor(id: string): string {
    this.workspace.push(id);
    this.activeFloorId = id;
    this.host.floorState?.changed(id);
    return id;
  }
  commitNote(): void { this.commits++; }
  destroy(): void { this.destroys++; }
  maximize(): void { this.maximizes++; }
}

function harness(options: {
  acquire?: (path: string) => Promise<ReturnType<typeof map>>;
  ensureAssets?: () => Promise<void>;
  editorInit?: () => Promise<void>;
  registryFloor?: string;
} = {}) {
  const { root } = dungeonViewTestDom();
  const layout: number[] = [];
  const releases: string[] = [];
  const remembered: Array<{ token: object; path: string; floor: string }> = [];
  const setStateCalls: Array<{ state: unknown; result: unknown }> = [];
  const registry = new Map<string, string>();
  if (options.registryFloor) registry.set("Maps/Test.dungeon", options.registryFloor);
  const app = {
    workspace: {
      requestSaveLayout: () => layout.push(layout.length + 1),
      getLeavesOfType: () => [],
      setActiveLeaf: () => {},
      revealLeaf: () => {},
    },
  };
  const leaf = {
    app,
    contentEl: root,
    baseState: { file: "Maps/Test.dungeon", pinned: true },
    setStateCalls,
    parent: undefined,
    detach: () => {},
  };
  const plugin = {
    app,
    acquire: options.acquire ?? (async () => map()),
    ensureAssets: options.ensureAssets ?? (async () => {}),
    release: (path: string) => releases.push(path),
    resetObjectColorForMap: () => {},
    dungeonViewState: (path: string) => {
      const floor = registry.get(path);
      return floor ? dungeonViewState(path, floor) : undefined;
    },
    rememberDungeonViewState: (token: object, path: string, floor: string) => {
      remembered.push({ token, path, floor });
      registry.set(path, floor);
      return dungeonViewState(path, floor);
    },
  };
  const editors: FakeEditor[] = [];
  const view = new DungeonView(
    leaf as never,
    plugin as never,
    ((_root, _session, _repository, host) => {
      const editor = new FakeEditor(host, options.editorInit?.());
      editors.push(editor);
      return editor as never;
    }),
  );
  const file = new TFile("Maps/Test.dungeon");
  view.file = file as never;
  return { view, file, leaf, editors, layout, releases, remembered, registry };
}

test("DungeonView preserves FileView state/result and applies same-file state", async () => {
  const h = harness();
  await h.view.onLoadFile(h.file as never);
  const state = dungeonViewState("Maps/Test.dungeon", "floor-upper")!;
  const workspace = withDungeonViewState({ file: "Maps/Test.dungeon", pinned: true }, state);
  const result = { history: false };
  await h.view.setState(workspace, result);
  assert.equal(h.leaf.setStateCalls.length, 1);
  assert.equal(h.leaf.setStateCalls[0]!.state, workspace);
  assert.equal(h.leaf.setStateCalls[0]!.result, result);
  assert.deepEqual(h.editors[0]!.workspace, ["floor-upper"]);
  assert.deepEqual(h.view.getState(), workspace);
});

test("DungeonView own leaf state wins, then registry restores two tab reopens", async () => {
  const h = harness({ registryFloor: "floor-registry" });
  const own = dungeonViewState("Maps/Test.dungeon", "floor-own")!;
  await h.view.setState(withDungeonViewState({ file: h.file.path }, own), { history: false });
  await h.view.onLoadFile(h.file as never);
  assert.deepEqual(h.editors[0]!.initial, ["floor-own"]);
  await h.view.onUnloadFile();
  await h.view.onLoadFile(h.file as never);
  assert.deepEqual(h.editors[1]!.initial, ["floor-own"]);
  await h.view.onUnloadFile();
  await h.view.onLoadFile(h.file as never);
  assert.deepEqual(h.editors[2]!.initial, ["floor-own"]);
  assert.equal(h.releases.length, 2);
  assert.equal(h.remembered.length, 3);
});

test("DungeonView close during acquire releases once without late state", async () => {
  const acquired = deferred<ReturnType<typeof map>>();
  const h = harness({ acquire: () => acquired.promise });
  const opening = h.view.onLoadFile(h.file as never);
  await turn();
  await h.view.onUnloadFile();
  acquired.resolve(map());
  await opening;
  assert.deepEqual(h.releases, ["Maps/Test.dungeon"]);
  assert.equal(h.remembered.length, 0);
  assert.equal(h.layout.length, 0);
});

test("DungeonView close during assets and editor init has balanced cleanup", async () => {
  const assets = deferred<void>();
  const h1 = harness({ ensureAssets: () => assets.promise });
  const openingAssets = h1.view.onLoadFile(h1.file as never);
  await turn();
  await h1.view.onUnloadFile();
  assets.resolve();
  await openingAssets;
  assert.deepEqual(h1.releases, ["Maps/Test.dungeon"]);
  assert.equal(h1.remembered.length, 0);
  assert.equal(h1.layout.length, 0);

  const initialized = deferred<void>();
  const h2 = harness({ editorInit: () => initialized.promise });
  const openingEditor = h2.view.onLoadFile(h2.file as never);
  await turn();
  await h2.view.onUnloadFile();
  initialized.resolve();
  await openingEditor;
  assert.deepEqual(h2.releases, ["Maps/Test.dungeon"]);
  assert.equal(h2.editors[0]!.destroys, 1);
  assert.equal(h2.remembered.length, 0);
  assert.equal(h2.layout.length, 0);
});

test("DungeonView retarget releases the old acquire and only publishes the new path", async () => {
  const first = deferred<ReturnType<typeof map>>();
  const second = deferred<ReturnType<typeof map>>();
  const h = harness({
    acquire: (path) => path === "Maps/Test.dungeon" ? first.promise : second.promise,
  });
  const openingFirst = h.view.onLoadFile(h.file as never);
  await turn();
  const next = new TFile("Maps/Other.dungeon");
  h.view.file = next as never;
  const openingSecond = h.view.onLoadFile(next as never);
  await turn();
  first.resolve(map());
  second.resolve(map());
  await Promise.all([openingFirst, openingSecond]);
  assert.deepEqual(h.releases, ["Maps/Test.dungeon"]);
  assert.deepEqual(h.remembered.map(({ path }) => path), ["Maps/Other.dungeon"]);
  assert.equal(h.layout.length, 1);
});

test("DungeonView rename keeps serialized path and stale retarget cannot publish", async () => {
  const h = harness();
  await h.view.onLoadFile(h.file as never);
  h.file.path = "Maps/Renamed.dungeon";
  await h.view.onRename(h.file as never);
  const state = h.view.getState() as { dungeonViewState: { path: string } };
  assert.equal(state.dungeonViewState.path, "Maps/Renamed.dungeon");
  assert.equal(h.remembered.at(-1)?.path, "Maps/Test.dungeon");
  await h.view.onUnloadFile();
  assert.equal(h.releases.length, 1);
});

test("DungeonPlayView enables the existing interactive room map", async () => {
  const { document, root } = dungeonViewTestDom();
  const inputs: Array<{
    path: string;
    focusRoom?: string | null;
    compact?: boolean;
  }> = [];
  let destroys = 0;
  const plugin = {
    createDungeonMap: (input: (typeof inputs)[number]) => {
      inputs.push(input);
      return {
        el: document.createElement("div"),
        destroy: () => { destroys++; },
      };
    },
  };
  const view = new DungeonPlayView(
    { contentEl: root, app: {} } as never,
    plugin as never,
  );

  await view.setState({ path: "Maps/Test.dungeon", roomId: "room-12" });

  assert.deepEqual(inputs, [{
    path: "Maps/Test.dungeon",
    focusRoom: "room-12",
    compact: true,
  }]);
  assert.equal(root.childElementCount, 1);

  await view.onClose();
  assert.equal(destroys, 1);
});
