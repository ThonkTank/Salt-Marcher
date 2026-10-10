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
  campaignNamespace,
  campaignSnapshot,
  campaignContext,
  campaignContextToken,
} from "../src/features/campaign/campaign-contracts";
import {
  campaignDomainOwnerPolicyDigest,
  campaignOwnershipDigestValue,
  campaignDomainOwnershipProjection,
  type CampaignDomainOwnerProjectionV1,
} from "../src/features/campaign/campaign-ownership";
import { AtlasRepository } from "../src/features/atlas/atlas-repository";
import { parseLocationDocument } from "../src/features/location/location-schema";
import { parseCityDocument } from "../src/features/city/codec";
import { isStructuredRoom, parseDocument } from "../src/model";
import type { AtlasEditor } from "../src/features/atlas/atlas-editor";
import { FileConflict } from "../src/persistence";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const a = campaignId(uuid(700)),
  b = campaignId(uuid(701));
const root = "tests/fixtures/atlas-e2e-spatial-v2/";
const seed = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const aPath = seed.input[0].path as string;
const bPath = "Atlanten/B.overworld";
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
    seed.input.map((f: { path: string; fixtureFile: string }) => [
      f.path,
      readFileSync(root + f.fixtureFile, "utf8"),
    ]),
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
async function manifest(
  vault: Vault,
  path: string,
  cid: typeof a,
  namespace: string,
) {
  const options = {
    locations: true as const,
    details: true as const,
    resolveLocation: async (id: string) =>
      [...vault.bytes].find(
        ([p, raw]) =>
          p.endsWith(".location") && parseLocationDocument(raw).id === id,
      )![0],
    resolveDetail: async (
      _world: string,
      kind: "city" | "dungeon",
      id: string,
    ) =>
      [...vault.bytes]
        .filter(
          ([p, raw]) =>
            p.endsWith("." + kind) &&
            (kind === "city" ? parseCityDocument(raw) : parseDocument(raw))
              .id === id,
        )
        .map(([p]) => p),
  };
  const repo = new AtlasRepository(
    {
      read: async (p) => vault.bytes.get(p) ?? null,
      compareAndWrite: (p, before, after) => vault.cas(p, before, after),
    },
    path,
    vault,
    options,
  );
  await repo.open();
  const capture = await repo.captureNative({
    worldId: repo.terrainSource.world.id,
  });
  const records: any[] = [],
    payloads = new Map<string, unknown>();
  const add = (
    kind: string,
    id: string,
    documentId: string,
    payload: unknown,
  ) => {
    records.push({
      id,
      kind,
      documentId,
      ownerId:
        kind === "city" || kind === "building"
          ? "city"
          : ["dungeon", "room", "room-section"].includes(kind)
            ? "dungeon"
            : "atlas",
      availability: "available",
    });
    payloads.set(id, payload);
  };
  for (const f of capture.files) {
    if (f.kind === "terrain") continue;
    const raw = JSON.parse(f.after!);
    add(f.kind, raw.id, raw.id, raw);
    if (f.kind === "location")
      for (const s of parseLocationDocument(f.after!).sections)
        add("location-section", s.id, raw.id, s);
    if (f.kind === "city")
      for (const h of parseCityDocument(f.after!).buildings)
        add("building", h.id, raw.id, h);
    if (f.kind === "dungeon")
      for (const room of parseDocument(f.after!).entities)
        if (isStructuredRoom(room)) {
          add("room", room.id, raw.id, room);
          for (const s of room.key.sections)
            add("room-section", s.id, raw.id, s);
        }
  }
  const owners = ["atlas", "city", "dungeon"].map((ownerId) => {
    const owner: CampaignDomainOwnerProjectionV1 = {
      ownerId,
      ownerRevision: "test-owner:1",
      schemaRevision: "schema:1",
      snapshotRevision: "snapshot:1",
      policyRevision: "policy:1",
      policyDigest: sha("placeholder"),
      availability: "confirmed",
      emptyConfirmed: false,
      referenceSchemas: ["native:1"],
      source: {
        adapterType: "native-test-fixture",
        generation: "test-source:1",
      },
      records: records
        .filter((r) => r.ownerId === ownerId)
        .map((r) => ({
          id: r.id,
          recordType: r.kind,
          references: [],
          payloadDigest: sha(JSON.stringify(payloads.get(r.id))),
          media: null,
        })),
      transferPolicies: [],
    };
    return {
      ...owner,
      policyDigest: campaignDomainOwnerPolicyDigest(owner, sha),
    };
  });
  const snapshot = campaignSnapshot({
    schemaVersion: 1,
    campaignId: cid,
    revision: 1,
    name: cid === a ? "A" : "B",
    namespace: campaignNamespace(namespace),
    lifecycle: "active",
  });
  const normalized = campaignDomainOwnershipProjection({
    version: 1,
    registryId: `native-fixture:${cid}`,
    registryRevision: "registry:1",
    projectionDigest: sha("test"),
    context: campaignContext(snapshot, campaignContextToken("test-fixture")),
    owners,
  }).owners;
  const registry = {
    version: 1,
    registryId: `native-fixture:${cid}`,
    registryRevision: "registry:1",
    campaignId: cid,
    campaignRevision: 1,
    namespace: snapshot.namespace,
    owners: normalized,
  };
  const value = {
    version: 1,
    snapshot,
    registry: {
      ...registry,
      registryContentDigest: campaignOwnershipDigestValue(registry, sha),
    },
    atlas: {
      worldId: capture.worldId,
      files: capture.files.map((f) => ({
        kind: f.kind,
        id: f.id,
        path: f.path,
        savedDigest: f.beforeDigest,
      })),
      records,
    },
  };
  parseCampaignRuntimeManifest(JSON.stringify(value), sha);
  await vault.create(
    `Kampagnen/SaltMarcher/${cid}.campaign.json`,
    JSON.stringify(value),
  );
  return { repo, value };
}
async function fixture(nativeSave = false) {
  const dom = setupDOM(),
    vault = new Vault();
  if (nativeSave) {
    await vault.create(seed.campaign.path, readFileSync(root + seed.campaign.input.fixtureFile, "utf8"));
  } else {
    const first = await manifest(vault, aPath, a, uuid(710));
    await first.repo.copy(bPath, uuid(999), "B");
    await manifest(vault, bPath, b, uuid(711));
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
  await f.host().openCampaign(b);
  const second = active(f);
  assert.equal(second.context.campaignId, b);
  assert.notEqual(second.history, old.history);
  assert.throws(() => old.history.undo(), /widerrufen/);
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

test("synchronous manifest invalidation detaches old UI, blocks History and preserves uncommitted Key across view lifetimes", async () => {
  const f = await fixture();
  await f.host().navigate(locationTarget);
  const old = active(f),
    oldRoot = f.content.querySelector<HTMLElement>(".dn-atlas")!;
  const text = f.input(
    '[aria-label="Ortsname"]',
    "Nicht übernommener alter Text",
  );
  const path = `Kampagnen/SaltMarcher/${a}.campaign.json`;
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
  const f = await fixture();
  await f.host().navigate(locationTarget);
  f.input('[aria-label="Ortsname"]', "Lokal gespeichert");
  await f.editor()!.flush();
  const state = active(f);
  const before = f.vault.bytes.get(`Orte/${uuid(11)}.location`)!;
  await assert.rejects(state.repository.save(), /Native Recordclosure stimmt nicht/);
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
  const path = `Kampagnen/SaltMarcher/${a}.campaign.json`;
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
  const path = `Kampagnen/SaltMarcher/${a}.campaign.json`;
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
  const path = `Kampagnen/SaltMarcher/${a}.campaign.json`;
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
