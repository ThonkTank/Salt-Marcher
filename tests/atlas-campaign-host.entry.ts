import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { TFile } from "obsidian";
import { AtlasView } from "../src/ui/atlas-view";
import { AtlasRenderer } from "../src/features/atlas/atlas-renderer";
import { AtlasCampaignHost } from "../src/ui/atlas-campaign-host";
import { atlasCampaignServices } from "../src/ui/atlas-campaign-services";
import { VaultCampaignRuntimeStorage } from "../src/vault-campaign-runtime-source";
import { parseCampaignRuntimeManifest } from "../src/features/campaign/campaign-runtime-source";
import {
  campaignId,
} from "../src/features/campaign/campaign-contracts";
import {
  campaignOwnershipDigestValue,
} from "../src/features/campaign/campaign-ownership";
import { AtlasRepository } from "../src/features/atlas/atlas-repository";
import { parseLocationDocument } from "../src/features/location/location-schema";
import type { AtlasEditor } from "../src/features/atlas/atlas-editor";
import { FileConflict } from "../src/persistence";

const root = "tests/fixtures/atlas-e2e-spatial-v2/";
const seed = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const bRoot = "tests/fixtures/atlas-e2e-campaign-b-v1/";
const bSeed = JSON.parse(readFileSync(bRoot + "manifest.json", "utf8"));
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const aRuntime = JSON.parse(
    readFileSync(root + seed.campaign.input.fixtureFile, "utf8"),
  ),
  bRuntime = JSON.parse(readFileSync(bRoot + bSeed.campaign.fixtureFile, "utf8")),
  a = campaignId(aRuntime.snapshot.campaignId),
  b = campaignId(bRuntime.snapshot.campaignId);
const aPath = seed.input[0].path as string;
const sha = (text: string) =>
  `sha256:${createHash("sha256").update(text).digest("hex")}`;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function settled(fn: () => boolean, detail: () => string = () => "") {
  for (let n = 0; n < 200; n++) {
    if (fn()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(fn(), "asynchronous host action did not settle: " + detail());
}
class Vault {
  readonly bytes = new Map<string, string>(
    [
      ...seed.input.map((f: { path: string; fixtureFile: string }) => [
        f.path,
        readFileSync(root + f.fixtureFile, "utf8"),
      ]),
      ...bSeed.input.map((f: { path: string; fixtureFile: string }) => [
        f.path,
        readFileSync(bRoot + f.fixtureFile, "utf8"),
      ]),
    ],
  );
  readonly files = new Map<string, TFile>();
  readonly folders = new Set<string>();
  readonly listeners = new Map<string, Set<(...args: any[]) => void>>();
  readHook?: (path: string) => Promise<void>;
  writeHook?: (path: string, raw: string | null) => void | Promise<void>;
  writes: string[] = [];
  constructor() {
    for (const path of this.bytes.keys())
      this.files.set(path, new (TFile as any)(path));
  }
  getFiles() {
    return [...this.files.values()];
  }
  getAbstractFileByPath(path: string) {
    return this.files.get(path) ?? (this.folders.has(path) ? {} : null);
  }
  async read(f: TFile) {
    await this.readHook?.(f.path);
    const raw = this.bytes.get(f.path);
    if (raw === undefined) throw new Error("missing " + f.path);
    return raw;
  }
  on(name: string, fn: (...args: any[]) => void) {
    const set = this.listeners.get(name) ?? new Set();
    this.listeners.set(name, set);
    set.add(fn);
    return { name, fn };
  }
  offref(ref: { name: string; fn: (...args: any[]) => void }) {
    this.listeners.get(ref.name)?.delete(ref.fn);
  }
  emit(name: string, ...args: any[]) {
    for (const fn of this.listeners.get(name) ?? []) fn(...args);
  }
  async createFolder(path: string) {
    this.folders.add(path);
  }
  async create(path: string, raw: string) {
    if (this.bytes.has(path)) throw new FileConflict(path);
    const f = new (TFile as any)(path);
    this.files.set(path, f);
    this.bytes.set(path, raw);
    this.writes.push(path);
    this.emit("create", f);
    await this.writeHook?.(path, raw);
    return f;
  }
  async process(f: TFile, fn: (raw: string) => string) {
    this.bytes.set(f.path, fn(await this.read(f)));
    this.writes.push(f.path);
    this.emit("modify", f);
    await this.writeHook?.(f.path, this.bytes.get(f.path)!);
  }
  async trash(f: TFile) {
    this.bytes.delete(f.path);
    this.files.delete(f.path);
    this.writes.push(f.path);
    this.emit("delete", f);
    await this.writeHook?.(f.path, null);
  }
  async cas(path: string, before: string | null, after: string | null) {
    if ((this.bytes.get(path) ?? null) !== before) throw new FileConflict(path);
    if (after === null) {
      const f = this.files.get(path);
      if (f) await this.trash(f);
    } else if (before === null) await this.create(path, after);
    else await this.process(this.files.get(path)!, () => after);
  }
}
function setupDOM() {
  const { document, window } = parseHTML(
    '<html><body><div id="host"></div></body></html>',
  );
  let focused: HTMLElement | null = null;
  Object.defineProperty(document, "activeElement", { get: () => focused });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) {
      focused = this;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "createEl", {
    configurable: true,
    value(this: HTMLElement, tag: string, opts: any = {}) {
      const child = this.ownerDocument.createElement(tag);
      if (opts.text) child.textContent = opts.text;
      if (opts.cls) child.className = opts.cls;
      for (const [k, v] of Object.entries(opts.attr ?? {}))
        child.setAttribute(k, String(v));
      this.append(child);
      return child;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "createDiv", {
    configurable: true,
    value(this: any, opts: any) {
      return this.createEl("div", opts);
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "empty", {
    configurable: true,
    value(this: HTMLElement) {
      this.replaceChildren();
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(window.HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 600,
  });
  Object.assign(globalThis, {
    window,
    document,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  });
  // DOM adapter evidence, not GPU/native evidence: only the GPU initialization is excluded.
  AtlasRenderer.prototype.init = async () => {};
  return {
    document,
    window,
    content: document.querySelector<HTMLElement>("#host")!,
  };
}
async function fixture(nativeSave = false, unsupportedOwner = false, initialReady?: Promise<void>) {
  const dom = setupDOM(),
    vault = new Vault();
  if (initialReady) AtlasRenderer.prototype.init = async () => { await initialReady; };
  let aManifestBytes = readFileSync(
    root + seed.campaign.input.fixtureFile,
    "utf8",
  );
  if (unsupportedOwner) {
    const value = JSON.parse(aManifestBytes);
    value.registry.owners = value.registry.owners.map((owner: any) => ({
      ...owner,
      source: { ...owner.source, adapterType: "native-test-fixture" },
    }));
    const { registryContentDigest: _digest, ...registry } = value.registry;
    value.registry.registryContentDigest = campaignOwnershipDigestValue(
      registry,
      sha,
    );
    aManifestBytes = JSON.stringify(value);
  }
  if (nativeSave) {
    await vault.create(seed.campaign.path, aManifestBytes);
  } else {
    await vault.create(seed.campaign.path, aManifestBytes);
    await vault.create(bSeed.campaign.path, readFileSync(bRoot + bSeed.campaign.fixtureFile, "utf8"));
  }
  const app = { document: dom.document, vault } as any;
  const services = atlasCampaignServices(
    new VaultCampaignRuntimeStorage(app),
    sha,
  );
  const leaf = {
    app,
    contentEl: dom.content,
    openFile: async (_file: TFile) => {},
  } as any;
  const view = new AtlasView(leaf, services);
  await view.onLoadFile(vault.files.get(aPath)!);
  const host = () => (view as any).campaignHost as AtlasCampaignHost;
  const editor = () => (view as any).editor as AtlasEditor | undefined;
  const click = (e: HTMLElement) =>
    e.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
  const input = (selector: string, value: string) => {
    const field = dom.content.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(selector)!;
    field.value = value;
    field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    return field;
  };
  const close = async () => {
    await view.onUnloadFile();
    services.close();
  };
  return { ...dom, vault, services, view, host, editor, click, input, close };
}
function active(f: Awaited<ReturnType<typeof fixture>>) {
  const s = f.host().state;
  if (s.kind !== "active")
    assert.fail(s.reason + " : " + f.content.textContent);
  return s;
}
const locationTarget = {
  kind: "location" as const,
  documentId: uuid(11),
  recordId: uuid(11),
  roomId: null,
};

test("enabled native detail button waits for queued terrain hydration before guarded navigation", async () => {
  const f = await fixture();
  await f.host().navigate(locationTarget);
  const before = active(f), editor = f.editor()!, repository = before.repository as any;
  const camera = editor.renderer.relativeCamera;
  const bytes = new Map(f.vault.bytes), writes = f.vault.writes.length;
  const houseLabel = f.host().details(uuid(11)).entries
    .find((entry) => entry.target.kind === "building" && entry.target.recordId === uuid(105))!.label;
  const house = [...f.content.querySelectorAll<HTMLButtonElement>(".dn-atlas-detail-entry li button")]
    .find((button) => button.textContent === houseLabel)!;
  assert.ok(house);
  assert.equal(house.disabled, false);
  assert.equal((editor as any).inputBlocked, false);
  assert.equal(editor.terrain.loadedChunks().length, 0);

  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  let gated = false;
  f.vault.readHook = async (path) => {
    if (!gated && path.includes("/terrain/")) {
      gated = true; entered(); await gate;
    }
  };
  const trace: Record<string, unknown>[] = [];
  const captureCurrent = repository.captureCurrent;
  repository.captureCurrent = function (pin: any) {
    const row = { pin: { generation: pin.generation, repositoryEpoch: pin.repositoryEpoch, historyEpoch: pin.historyEpoch },
      actual: { generation: this.generation, repositoryEpoch: this.nativeEpoch, historyEpoch: editor.terrain.history.epoch },
      sameSource: this.source === pin.source, inputBlocked: (editor as any).inputBlocked,
      loadingVisible: (editor as any).loadingVisible, loadingLocations: (editor as any).loadingLocations,
      terrainCells: editor.terrain.cells().length, failed: false };
    trace.push(row);
    try { return captureCurrent.call(this, pin); }
    catch (error) { row.failed = true; throw error; }
  };
  const loading: Promise<void> = (editor as any).loadVisible();
  await started;
  let navigation: Promise<void> | undefined;
  const navigate = f.host().navigate.bind(f.host());
  f.host().navigate = (target) => (navigation = navigate(target));
  // Location loading rebuilds the dock. Use the current visible button, never a detached old row.
  const currentHouse = [...f.content.querySelectorAll<HTMLButtonElement>(".dn-atlas-detail-entry li button")]
    .find((button) => button.textContent === houseLabel)!;
  assert.ok(currentHouse);
  assert.equal(currentHouse.disabled, false);
  assert.equal((editor as any).loadingVisible, true);
  // Exercise the existing visible, enabled DetailEntry callback, not a direct test-only target.
  f.click(currentHouse);
  assert.ok(navigation);
  await tick();
  assert.equal((editor as any).inputBlocked, true);
  assert.equal(editor.renderer.relativeCamera, camera);
  assert.equal(trace.length, 0); // No capture before the requested hydration completes.
  release();
  await loading;
  await navigation;
  await tick();
  assert.ok(trace.length > 0);
  for (const row of trace as any[]) {
    assert.equal(row.failed, false);
    assert.equal(row.sameSource, true);
    assert.deepEqual(row.actual, row.pin);
    assert.equal(row.inputBlocked, true);
    assert.equal(row.loadingVisible, false);
    assert.equal(row.loadingLocations, false);
    assert.ok(row.terrainCells > 0);
  }
  assert.equal((editor as any).inputBlocked, false);
  assert.equal(active(f).context.contextToken, before.context.contextToken);
  assert.equal(active(f).repository, before.repository);
  assert.equal(active(f).history, before.history);
  assert.equal(active(f).renderer, before.renderer);
  assert.equal(editor.terrain, before.repository.terrainSource);
  assert.equal(editor.renderer.relativeCamera.metersPerPixel, 0.1);
  assert.deepEqual(editor.renderer.camera.center, { x: -18, y: 8 });
  assert.equal(before.history.undoDepth, 0);
  assert.doesNotMatch(f.content.textContent!, /Ziel konnte nicht geöffnet werden/);
  assert.deepEqual(f.vault.bytes, bytes);
  assert.equal(f.vault.writes.length, writes);
  console.log("HEX_CAPTURE_HYDRATION_REPAIR " + JSON.stringify({
    kind: "actual_AtlasView_DOM_Vault_controlled_read_delay", trace,
    visibleButtonEnabled: true, fileWrites: 0, historyCommands: 0,
    contextUnchanged: true, sameRepositoryHistoryRenderer: true, cameraReachedHouse: true,
    nativeGUI: false, controlledDOMRegressionPassed: true,
  }));
  repository.captureCurrent = captureCurrent;
  f.vault.readHook = undefined;
  await f.close();
});

test("actual current Host navigation awaits pending renderer initialization before its first capture", async () => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  const f = await fixture(false, false, ready), before = active(f), editor = f.editor()!;
  const camera = editor.renderer.relativeCamera;
  let captures = 0;
  const capture = before.repository.captureNative.bind(before.repository);
  before.repository.captureNative = (request) => { captures++; return capture(request); };
  const pending = f.host().navigate(locationTarget);
  await tick();
  assert.equal(captures, 0); assert.equal(editor.renderer.relativeCamera, camera);
  assert.equal((editor as any).inputBlocked, true);
  release(); await pending;
  assert.ok(captures > 0); assert.equal((editor as any).inputBlocked, false);
  assert.equal(active(f).repository, before.repository); assert.equal(active(f).renderer, before.renderer);
  assert.match(f.content.textContent!, /Stadtplan:/);
  await f.close();
});

test("failed pending visible terrain read rejects current navigation before capture and camera effects", async () => {
  const f = await fixture(), before = active(f), editor = f.editor()!;
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const camera = editor.renderer.relativeCamera, bytes = new Map(f.vault.bytes), writes = f.vault.writes.length;
  f.vault.readHook = async (path) => {
    if (path.includes("/terrain/")) { entered(); await gate; throw new Error("controlled terrain read failure"); }
  };
  let captures = 0;
  const capture = before.repository.captureNative.bind(before.repository);
  before.repository.captureNative = (request) => { captures++; return capture(request); };
  const loading = (editor as any).loadVisible(); await started;
  const pending = f.host().navigate(locationTarget), rejected = assert.rejects(pending, /Landschaft konnte nicht geladen werden/);
  release(); await loading; await rejected;
  assert.equal(captures, 0); assert.equal(editor.renderer.relativeCamera, camera);
  assert.equal(active(f).repository, before.repository); assert.equal(active(f).history, before.history);
  assert.equal((editor as any).inputBlocked, false);
  assert.deepEqual(f.vault.bytes, bytes); assert.equal(f.vault.writes.length, writes);
  f.vault.readHook = undefined;
  await f.close();
});

test("actual AtlasView mounts real Vault provider; Location dock reaches house and Room Key with one renderer/history", async () => {
  const f = await fixture(),
    before = active(f),
    editor = f.editor()!;
  await f.host().navigate(locationTarget);
  assert.match(f.content.textContent!, /Stadtplan:/);
  assert.match(f.content.textContent!, /Dungeonkarte/);
  f.input('[aria-label="Ortsname"]', "Neue Ortsbezeichnung");
  const house =
    [
      ...f.content.querySelectorAll<HTMLButtonElement>(
        ".dn-atlas-detail-entry li button",
      ),
    ].find((b) => b.textContent === "E2E-Haus") ??
    [
      ...f.content.querySelectorAll<HTMLButtonElement>(
        ".dn-atlas-detail-entry li button",
      ),
    ].find((b) => b.textContent?.includes("Haus"))!;
  let navigation: Promise<void> | undefined;
  const navigate = f.host().navigate.bind(f.host());
  f.host().navigate = (target) => (navigation = navigate(target));
  assert.ok(house);
  f.click(house);
  assert.ok(navigation);
  await navigation;
  await tick();
  assert.equal(editor.renderer.relativeCamera.metersPerPixel, 0.1);
  assert.deepEqual(editor.renderer.camera.center, { x: -18, y: 8 });
  assert.equal(active(f).history, before.history);
  assert.equal(f.editor()!.renderer, editor.renderer);
  assert.equal(
    before.repository.location(uuid(11)).read()!.name,
    "Neue Ortsbezeichnung",
  );
  const room = [
    ...f.content.querySelectorAll<HTMLButtonElement>(
      ".dn-atlas-detail-entry li button",
    ),
  ].find((b) => b.textContent?.startsWith("Raum "))!;
  assert.ok(room);
  f.click(room);
  await navigation;
  await tick();
  assert.ok(f.content.querySelector('[aria-label="Raumname"]'));
  f.input('[aria-label="Raumname"]', "Gemeinsamer Raum-Key");
  await editor.flush();
  assert.equal(active(f).history, before.history);
  assert.ok(before.history.undoDepth >= 2);
  before.history.undo();
  before.history.redo();
  await editor.flush();
  assert.equal(
    f.content.querySelector<HTMLInputElement>('[aria-label="Raumname"]')!.value,
    "Gemeinsamer Raum-Key",
  );
  await f.close();
});

test("invalid Location Key stops actual campaign activation; A-B-A remounts fresh native identities and retains old drafts", async () => {
  const f = await fixture();
  const campaignButton = (name: string) =>
    [...f.content.querySelectorAll<HTMLLIElement>(".dn-campaign-entry li")]
      .find((row) => row.textContent?.includes(name))
      ?.querySelector<HTMLButtonElement>("button");
  await f.host().navigate(locationTarget);
  const old = active(f),
    renderer = f.editor()!.renderer;
  f.input('[aria-label="Ortsname"]', "");
  await assert.rejects(f.host().openCampaign(b));
  assert.equal(f.services.provider.currentContext()!.campaignId, a);
  assert.equal(f.editor()!.renderer, renderer);
  assert.equal(
    f.content.querySelector<HTMLInputElement>('[aria-label="Ortsname"]')!.value,
    "",
  );
  f.input('[aria-label="Ortsname"]', "Gesicherter Wechselentwurf");
  const openB = campaignButton(bSeed.initialOracle.picker.label);
  assert.ok(openB);
  assert.equal(openB.disabled, false);
  await f.host().openCampaign(b);
  const second = active(f);
  assert.equal(second.context.campaignId, b);
  assert.notEqual(second.history, old.history);
  assert.throws(() => old.history.undo(), /widerrufen/);
  const openA = campaignButton(aRuntime.snapshot.name);
  assert.ok(openA);
  assert.equal(openA.disabled, false);
  await f.host().openCampaign(a);
  const third = active(f);
  assert.notEqual(third.context.contextToken, old.context.contextToken);
  assert.notEqual(third.history, old.history);
  assert.equal(
    third.repository.location(uuid(11)).read()!.name,
    "Gesicherter Wechselentwurf",
  );
  assert.equal(
    f.content.querySelectorAll(".dn-atlas-canvas-host > .dn-atlas").length,
    1,
  );
  await f.close();
  assert.ok(f.services.retainedDrafts!.length > 0);
});

test("the actual picker switches between independent native A and B mounts", async () => {
  const f = await fixture();
  const campaignButton = (name: string) =>
    [...f.content.querySelectorAll<HTMLLIElement>(".dn-campaign-entry li")]
      .find((row) => row.textContent?.includes(name))
      ?.querySelector<HTMLButtonElement>("button");
  const host = f.host(),
    openCampaign = host.openCampaign.bind(host);
  let pickerOpen: Promise<void> | undefined;
  host.openCampaign = (id) => (pickerOpen = openCampaign(id));
  const first = active(f);
  const openB = campaignButton(bSeed.initialOracle.picker.label);
  assert.ok(openB);
  f.click(openB);
  assert.ok(pickerOpen);
  await pickerOpen;
  await tick();
  const second = active(f);
  assert.equal(second.context.campaignId, b);
  assert.equal(second.inventory.worldId, bSeed.initialOracle.worldId);
  assert.notEqual(second.context.contextToken, first.context.contextToken);
  assert.notEqual(second.repository, first.repository);
  assert.notEqual(second.history, first.history);
  assert.equal(f.content.textContent?.includes(bSeed.initialOracle.worldName), true);

  const openA = campaignButton(aRuntime.snapshot.name);
  assert.ok(openA);
  pickerOpen = undefined;
  f.click(openA);
  assert.ok(pickerOpen);
  await pickerOpen;
  await tick();
  const third = active(f);
  assert.equal(third.context.campaignId, a);
  assert.notEqual(third.context.contextToken, first.context.contextToken);
  assert.notEqual(third.context.contextToken, second.context.contextToken);
  assert.notEqual(third.repository, first.repository);
  assert.notEqual(third.repository, second.repository);
  assert.notEqual(third.history, first.history);
  assert.notEqual(third.history, second.history);
  await f.close();
});

test("synchronous manifest invalidation detaches old UI, blocks History and preserves uncommitted Key across view lifetimes", async () => {
  const f = await fixture();
  await f.host().navigate(locationTarget);
  const old = active(f),
    oldRoot = f.content.querySelector<HTMLElement>(".dn-atlas")!;
  const text = f.input(
    '[aria-label="Ortsname"]',
    "Nicht übernommener alter Text",
  );
  const path = seed.campaign.path as string;
  await f.vault.process(f.vault.files.get(path)!, (raw) => raw + " ");
  assert.equal(f.host().state.kind, "unavailable");
  assert.equal(f.editor(), undefined);
  assert.equal(oldRoot.inert, true);
  const writes = f.vault.writes.length;
  assert.throws(() => old.history.undo(), /widerrufen/);
  assert.equal(f.vault.writes.length, writes);
  await f.view.onUnloadFile();
  assert.equal(text.value, "Nicht übernommener alter Text");
  assert.ok(f.services.retainedDrafts!.some((d) => d.element.contains(text)));
  f.services.close();
});

test("discard resets Sources through a fresh guarded mount, without retaining a writable obsolete editor", async () => {
  const f = await fixture();
  await f.host().navigate(locationTarget);
  const old = active(f);
  f.input('[aria-label="Ortsname"]', "Verwerfen");
  await f.editor()!.flush();
  f.editor()!.discard();
  await settled(
    () =>
      f.host().state.kind === "active" &&
      (f.host().state as any).history !== old.history,
  );
  const fresh = active(f);
  assert.equal(fresh.repository.dirty, false);
  assert.equal(fresh.repository.hasDraft, false);
  assert.equal(fresh.repository.location(uuid(11)).read()!.name, "Torheim");
  assert.throws(() => old.history.undo(), /widerrufen/);
  await f.close();
});

test("an unsupported generic owner contract cannot publish local files through the managed Save path", async () => {
  const f = await fixture(false, true);
  await f.host().navigate(locationTarget);
  f.input('[aria-label="Ortsname"]', "Lokal gespeichert");
  await f.editor()!.flush();
  const state = active(f);
  const before = f.vault.bytes.get(`Orte/${uuid(11)}.location`)!;
  await assert.rejects(state.repository.save(), /Nicht unterstützter autorisierter Owner-Save-Vertrag/);
  assert.equal(state.repository.dirty, true);
  const saved = f.vault.bytes.get(`Orte/${uuid(11)}.location`)!;
  assert.equal(saved, before);
  assert.match(f.vault.bytes.get(aPath+'.draft')!, /Lokal gespeichert/);
  assert.equal(f.services.provider.currentContext()!.campaignId, a);
  await f.close();
});

test("actual Save button acknowledges the native Campaign manifest and refreshes the same mount/history/camera for navigation and retry", async () => {
  const f = await fixture(true), before = active(f), editor = f.editor()!;
  await f.host().navigate(locationTarget);
  f.input('[aria-label="Ortsname"]', 'Gemeinsam gespeichert');
  const room = before.inventory.records.find((r) => r.kind === 'room')!;
  await f.host().navigate({ kind: 'room', documentId: room.documentId, recordId: room.id, roomId: null });
  f.input('[aria-label="Raumname"]', 'Raum im gespeicherten Atlas');
  await editor.flush();
  const camera = editor.renderer.relativeCamera, undoDepth = before.history.undoDepth;
  const saveButton = f.content.querySelector<HTMLButtonElement>('[aria-label="Atlas speichern"]')!;
  assert.ok(saveButton);
  f.click(saveButton);
  await settled(() => !before.repository.dirty && !before.repository.hasDraft && active(f).projection.registryRevision !== before.projection.registryRevision,
    () => f.content.textContent ?? '');
  await editor.flush();
  const after = active(f);
  assert.equal(after.repository, before.repository);
  assert.equal(after.history, before.history);
  assert.equal(after.renderer, before.renderer);
  assert.equal(after.generation, before.generation);
  assert.equal(after.context.contextToken, before.context.contextToken);
  assert.equal(after.history.undoDepth, undoDepth);
  assert.deepEqual(editor.renderer.relativeCamera, camera);
  assert.equal(f.vault.bytes.has(aPath+'.journal'), false);
  assert.equal(parseLocationDocument(f.vault.bytes.get(`Orte/${uuid(11)}.location`)!).name, 'Gemeinsam gespeichert');
  const manifest = parseCampaignRuntimeManifest(f.vault.bytes.get(seed.campaign.path)!, sha);
  for (const file of manifest.atlas.files) assert.equal(file.savedDigest, sha(f.vault.bytes.get(file.path)!), file.path);
  await f.host().navigate(locationTarget);
  assert.equal(active(f).repository, before.repository);
  before.history.undo(); before.history.redo(); await editor.flush();
  await (editor as any).storage.save(); // No-op save keeps the same confirmed authority.
  assert.equal(active(f).history, before.history);
  await f.close();
  const app = { document: f.document, vault: f.vault } as any;
  const services = atlasCampaignServices(new VaultCampaignRuntimeStorage(app), sha);
  const view = new AtlasView({ app, contentEl: f.content, openFile: async () => {} } as any, services);
  await view.onLoadFile(f.vault.files.get(aPath)!);
  const fresh = ((view as any).campaignHost as AtlasCampaignHost).state;
  assert.equal(fresh.kind, 'active');
  if (fresh.kind === 'active') {
    assert.notEqual(fresh.history, before.history);
    assert.equal(fresh.repository.location(uuid(11)).read()!.name, 'Gemeinsam gespeichert');
    const document = fresh.repository.detail('dungeon', room.documentId) as any;
    assert.equal(document.read().document.entities.find((r: any) => r.id === room.id).name, 'Raum im gespeicherten Atlas');
  }
  await view.onUnloadFile(); services.close();
});

test("actual managed Save releases a real rolled-back first-native failure and retries without replacing Context or History", async () => {
  const f = await fixture(true), before = active(f), editor = f.editor()!;
  await f.host().navigate(locationTarget);
  f.input('[aria-label="Ortsname"]', 'Retry im selben Atlas'); await editor.flush();
  const native = `Orte/${uuid(11)}.location`, oldBytes = f.vault.bytes.get(native),
    camera = editor.renderer.relativeCamera, original = f.vault.process.bind(f.vault);
  const transactions: string[] = [];
  f.vault.writeHook = (path, bytes) => {
    if (path === aPath+'.journal' && bytes) {
      const j = JSON.parse(bytes);
      if (j.state === 'prepared' && j.writes.some((w: any) => w.path === seed.campaign.path)) transactions.push(j.transactionId);
    }
  };
  let failed = false;
  f.vault.process = async (file, change) => {
    if (!failed && file.path === native) { failed = true; throw new Error('first native CAS failed'); }
    return original(file, change);
  };
  await assert.rejects((editor as any).storage.save(), /first native CAS failed/);
  assert.equal(failed, true);
  assert.equal(f.vault.bytes.get(native), oldBytes);
  assert.equal(f.vault.bytes.has(aPath+'.journal'), false);
  assert.equal(before.repository.dirty, true); assert.equal(before.repository.hasDraft, true);
  assert.equal(active(f).history, before.history);
  assert.equal(active(f).context.contextToken, before.context.contextToken);
  assert.deepEqual(editor.renderer.relativeCamera, camera);
  await (editor as any).storage.save();
  assert.equal(active(f).repository, before.repository);
  assert.equal(active(f).history, before.history);
  assert.equal(before.repository.dirty, false);
  assert.equal(new Set(transactions).size, 2);
  assert.equal(parseLocationDocument(f.vault.bytes.get(native)!).name, 'Retry im selben Atlas');
  f.vault.writeHook = undefined;
  await f.close();
});

test("bad or foreign manifest membership cannot fall through into an unguarded standalone atlas", async () => {
  const f = await fixture();
  const path = seed.campaign.path as string;
  await f.vault.process(f.vault.files.get(path)!, () => "{damaged");
  await f.view.onLoadFile(f.vault.files.get(aPath)!);
  assert.equal(f.editor(), undefined);
  assert.match(f.content.textContent!, /keinem bestätigten Kampagnenbestand/);
  await f.close();
});

test("late native detail load after actual provider invalidation cannot hydrate or attach an obsolete Atlas", async () => {
  const f = await fixture();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.vault.readHook = async (path) => {
    if (path.endsWith(".city")) {
      entered();
      await gate;
    }
  };
  const opening = f.view.onLoadFile(f.vault.files.get(aPath)!);
  await started;
  const path = seed.campaign.path as string;
  await f.vault.process(f.vault.files.get(path)!, (raw) => raw + " ");
  const writes = f.vault.writes.length;
  release();
  await opening;
  assert.equal(f.editor(), undefined);
  assert.equal(
    f.content.querySelector(".dn-atlas-canvas-host .dn-atlas"),
    null,
  );
  assert.equal(f.vault.writes.length, writes);
  assert.match(f.content.textContent!, /widerrufen|veraltet/);
  f.vault.readHook = undefined;
  await f.close();
});

test("retained old detail callback cannot navigate or edit a newer active campaign", async () => {
  const f = await fixture();
  await f.host().navigate(locationTarget);
  const oldButton = f.content.querySelector<HTMLButtonElement>(
    ".dn-atlas-detail-entry li button",
  )!;
  f.input('[aria-label="Ortsname"]', "Alter ungesicherter Text");
  const path = seed.campaign.path as string;
  await f.vault.process(f.vault.files.get(path)!, (raw) => raw + " ");
  await f.host().openCampaign(b);
  const current = active(f),
    editor = f.editor()!,
    camera = editor.renderer.relativeCamera;
  const writes = f.vault.writes.length;
  f.click(oldButton);
  await tick();
  assert.equal(f.editor(), editor);
  assert.equal(active(f).history, current.history);
  assert.equal(editor.renderer.relativeCamera, camera);
  assert.equal(f.vault.writes.length, writes);
  assert.equal(current.history.undoDepth, 0);
  await f.close();
});

test("closing the actual host services synchronously freezes retained mounts and their write leases", async () => {
  const f = await fixture();
  await f.host().navigate(locationTarget);
  const old = active(f);
  f.input('[aria-label="Ortsname"]', "Geschlossener alter Text");
  f.services.close();
  assert.equal(f.editor(), undefined);
  assert.equal(f.host().state.kind, "unavailable");
  assert.throws(() => old.history.undo(), /geschlossen/);
  await assert.rejects(old.repository.save(), /geschlossen/);
  await f.view.onUnloadFile();
});

test('native atlas remains usable before any campaign manifest exists, without claiming confirmed membership', async () => {
  const f = await fixture();
  for (const file of f.vault.getFiles().filter((file) => file.path.endsWith('.campaign.json'))) await f.vault.trash(file);
  await f.view.onLoadFile(f.vault.files.get(aPath)!);
  assert.ok(f.editor()); assert.equal(f.services.provider.currentContext(), null);
  assert.equal(f.host().state.kind, 'unavailable');
  assert.equal(f.content.querySelector('.dn-atlas-host-status')!.textContent, '');
  assert.equal(f.content.querySelector('.dn-campaign-active-error'), null);
  await f.close();
});

async function unregisteredFixture() {
  const f = await fixture();
  for (const file of f.vault.getFiles().filter((file) => file.path.endsWith('.campaign.json')))
    await f.vault.trash(file);
  await f.view.onLoadFile(f.vault.files.get(aPath)!);
  const repository = (f.view as any).repository as AtlasRepository;
  assert.ok(repository);
  assert.equal(f.services.provider.currentContext(), null);
  return { ...f, repository };
}
async function showNativeLocation(f: Awaited<ReturnType<typeof unregisteredFixture>>) {
  await f.repository.ensureLocation(locationTarget.documentId);
  // Native editor/Key focus only; this supplies no Campaign inventory or membership.
  f.editor()!.navigate({ target: locationTarget, frame: null, localPoint: { x: 0, y: 0 },
    key: { kind: 'location', atlasId: f.repository.terrainSource.world.id, documentId: locationTarget.documentId, sectionId: null } },
    () => (f.view as any).assertCurrent());
}

test('unregistered actual Atlas is synchronously revoked by service close, retaining pending Key and denying all old writers', async () => {
  const f = await unregisteredFixture();
  await showNativeLocation(f);
  const editor = f.editor()!, oldStorage = (editor as any).storage,
    history = f.repository.terrainSource.history,
    before = new Map(f.vault.bytes), writes = f.vault.writes.length;
  const text = f.input('[aria-label="Ortsname"]', 'Erhaltener unregistrierter Text');
  f.services.close();
  assert.equal(f.editor(), undefined);
  assert.ok(f.services.retainedDrafts!.some((d) => d.element.contains(text) && d.title.includes(aPath)));
  assert.equal(text.closest<HTMLElement>('.dn-atlas')!.inert, true);
  assert.throws(() => f.repository.editLocation({ ...f.repository.location(uuid(11)).read()!, name: 'Verboten' }), /geschlossen/);
  assert.throws(() => history.undo(), /geschlossen/);
  assert.throws(() => history.redo(), /geschlossen/);
  await assert.rejects(f.repository.save(), /geschlossen/);
  await assert.rejects(f.repository.persistDraft(), /geschlossen/);
  await assert.rejects(f.repository.discard(), /geschlossen/);
  await assert.rejects(f.repository.copy('Atlanten/Verboten.overworld', uuid(850), 'Verboten'), /geschlossen/);
  await assert.rejects(f.repository.recoverCopy(), /geschlossen/);
  await assert.rejects(oldStorage.save(), /geschlossen/);
  await assert.rejects(oldStorage.changed(), /geschlossen/);
  await assert.rejects(oldStorage.discard(), /geschlossen/);
  assert.throws(() => oldStorage.menu(new f.window.Event('contextmenu')), /geschlossen/);
  editor.discard();
  assert.equal(f.vault.writes.length, writes);
  assert.deepEqual(f.vault.bytes, before);
  await f.view.onUnloadFile();
  assert.equal(text.value, 'Erhaltener unregistrierter Text');
});

test('normal unregistered View unload persists its valid Key once and revokes retained Repository, History and callbacks', async () => {
  const f = await unregisteredFixture();
  await showNativeLocation(f);
  const storage = (f.editor() as any).storage, history = f.repository.terrainSource.history;
  f.input('[aria-label="Ortsname"]', 'Gültiger Schließentwurf');
  await f.view.onUnloadFile();
  assert.match(f.vault.bytes.get(aPath + '.draft')!, /Gültiger Schließentwurf/);
  assert.equal(f.services.provider.currentContext(), null);
  const writes = f.vault.writes.length;
  assert.throws(() => history.undo(), /widerrufen/);
  await assert.rejects(f.repository.save(), /widerrufen/);
  await assert.rejects(storage.save(), /widerrufen/);
  await assert.rejects(storage.discard(), /widerrufen/);
  await assert.rejects(f.repository.copy('Atlanten/Alt.overworld', uuid(851), 'Alt'), /widerrufen/);
  assert.equal(f.vault.writes.length, writes);
  f.services.close();
});

test('unregistered View unload with invalid pending Key retains its exact text read-only and revokes the old Source', async () => {
  const f = await unregisteredFixture();
  await showNativeLocation(f);
  const text = f.input('[aria-label="Ortsname"]', ''), before = new Map(f.vault.bytes), writes = f.vault.writes.length;
  await f.view.onUnloadFile();
  assert.equal(text.value, '');
  assert.ok(f.services.retainedDrafts!.some((d) => d.element.contains(text)));
  assert.equal(text.closest<HTMLElement>('.dn-atlas')!.inert, true);
  assert.equal(f.editor(), undefined);
  assert.throws(() => f.repository.terrainSource.history.undo(), /widerrufen/);
  await assert.rejects(f.repository.save(), /widerrufen/);
  assert.equal(f.vault.writes.length, writes);
  assert.deepEqual(f.vault.bytes, before);
  f.services.close();
});

test('unregistered late renderer initialization after View unload cannot keep a mounted editor alive', async () => {
  const f = await unregisteredFixture();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }),
    started = new Promise<void>((resolve) => { entered = resolve; });
  AtlasRenderer.prototype.init = async () => { entered(); await gate; };
  const opening = f.view.onLoadFile(f.vault.files.get(aPath)!);
  await started;
  const editor = f.editor()!, repository = (f.view as any).repository as AtlasRepository,
    closing = f.view.onUnloadFile();
  release(); await opening; await closing;
  assert.equal(f.editor(), undefined);
  assert.equal(f.content.querySelector('.dn-atlas'), null);
  assert.throws(() => repository.terrainSource.history.undo(), /widerrufen/);
  await assert.rejects((editor as any).storage.save(), /widerrufen/);
  f.services.close();
});

for (const cause of ['service', 'view'] as const) {
  test(`late unregistered initial native detail read after ${cause} closure cannot hydrate or attach`, async () => {
    const f = await unregisteredFixture();
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; }),
      started = new Promise<void>((resolve) => { entered = resolve; });
    f.vault.readHook = async (path) => { if (path.endsWith('.city')) { entered(); await gate; } };
    const opening = f.view.onLoadFile(f.vault.files.get(aPath)!);
    await started;
    const writes = f.vault.writes.length;
    const closing = cause === 'view' ? f.view.onUnloadFile() : (f.services.close(), Promise.resolve());
    release();
    await opening; await closing;
    assert.equal(f.editor(), undefined);
    assert.equal(f.content.querySelector('.dn-atlas-canvas-host .dn-atlas'), null);
    assert.equal(f.vault.writes.length, writes);
    f.vault.readHook = undefined;
    await f.close();
  });
}

test('unregistered pending Save before its first journal write rejects after service close without canonical changes', async () => {
  const f = await unregisteredFixture(), source = await f.repository.ensureLocation(uuid(11));
  f.repository.editLocation({ ...source.read()!, name: 'Nur alter Entwurf' });
  await f.repository.persistDraft();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }),
    started = new Promise<void>((resolve) => { entered = resolve; });
  f.vault.readHook = async (path) => { if (path === aPath + '.draft') { entered(); await gate; } };
  const saving = f.repository.save(), rejected = assert.rejects(saving, /geschlossen/);
  await started;
  const queued = [
    assert.rejects(f.repository.copy('Atlanten/Wartend.overworld', uuid(852), 'Wartend'), /geschlossen/),
    assert.rejects(f.repository.discard(), /geschlossen/),
    assert.rejects(f.repository.persistDraft(), /geschlossen/),
  ];
  const before = new Map(f.vault.bytes), writes = f.vault.writes.length;
  f.services.close(); release();
  await rejected;
  await Promise.all(queued);
  assert.deepEqual(f.vault.bytes, before);
  assert.equal(f.vault.writes.length, writes);
  assert.match(f.vault.bytes.get(aPath + '.draft')!, /Nur alter Entwurf/);
  f.vault.readHook = undefined;
  await f.view.onUnloadFile();
});

test('unregistered won canonical Save journal finishes its old native files after service close', async () => {
  const f = await unregisteredFixture(), source = await f.repository.ensureLocation(uuid(11)),
    path = `Orte/${uuid(11)}.location`;
  f.repository.editLocation({ ...source.read()!, name: 'Gewonnenes altes Journal' });
  await f.repository.persistDraft();
  const before = new Map(f.vault.bytes);
  let closedAtJournal = false;
  f.vault.writeHook = (p, raw) => {
    if (p === aPath + '.journal' && raw) {
      const journal = JSON.parse(raw);
      if (journal.state === 'prepared' && journal.writes.some((w: any) => w.path === path)) {
        closedAtJournal = true; f.services.close();
      }
    }
  };
  await f.repository.save();
  assert.equal(closedAtJournal, true);
  assert.equal(parseLocationDocument(f.vault.bytes.get(path)!).name, 'Gewonnenes altes Journal');
  assert.equal(f.vault.bytes.has(aPath + '.journal'), false);
  assert.equal(f.vault.bytes.has(aPath + '.draft'), false);
  for (const [p, raw] of before) if (p !== path && p !== aPath + '.draft') assert.equal(f.vault.bytes.get(p), raw, p);
  await assert.rejects(f.repository.save(), /geschlossen/);
  f.vault.writeHook = undefined;
  await f.view.onUnloadFile();
});

test('unregistered lost committed reply retains its old journal for a new live View to recover forward', async () => {
  const f = await unregisteredFixture(), source = await f.repository.ensureLocation(uuid(11)),
    path = `Orte/${uuid(11)}.location`;
  f.repository.editLocation({ ...source.read()!, name: 'Vorwärts erhalten' });
  await f.repository.persistDraft();
  f.vault.writeHook = (p, raw) => {
    if (p === aPath + '.journal' && raw && JSON.parse(raw).state === 'committed') {
      f.services.close(); throw new Error('lost committed reply');
    }
  };
  await assert.rejects(f.repository.save(), AggregateError);
  assert.equal(parseLocationDocument(f.vault.bytes.get(path)!).name, 'Vorwärts erhalten');
  assert.match(f.vault.bytes.get(aPath + '.journal')!, /"committed"/);
  await assert.rejects(f.repository.recoverCopy(), /geschlossen/);
  f.vault.writeHook = undefined;
  await f.view.onUnloadFile();
  const app = { document: f.document, vault: f.vault } as any,
    services = atlasCampaignServices(new VaultCampaignRuntimeStorage(app), sha),
    view = new AtlasView({ app, contentEl: f.content, openFile: async () => {} } as any, services);
  await view.onLoadFile(f.vault.files.get(aPath)!);
  assert.ok((view as any).editor);
  assert.equal(f.vault.bytes.has(aPath + '.journal'), false);
  assert.equal(parseLocationDocument(f.vault.bytes.get(path)!).name, 'Vorwärts erhalten');
  assert.equal(services.provider.currentContext(), null);
  await view.onUnloadFile(); services.close();
});
