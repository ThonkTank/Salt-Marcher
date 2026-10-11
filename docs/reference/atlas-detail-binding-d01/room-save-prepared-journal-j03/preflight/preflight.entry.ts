import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { Scope, TFile } from "obsidian";
import { AtlasView } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/ui/atlas-view";
import { AtlasRenderer } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/atlas/atlas-renderer";
import { AtlasCampaignHost } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/ui/atlas-campaign-host";
import { atlasCampaignServices } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/ui/atlas-campaign-services";
import { VaultCampaignRuntimeStorage } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/vault-campaign-runtime-source";
import { parseCampaignRuntimeManifest } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/campaign/campaign-runtime-source";
import {
  campaignId,
} from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/campaign/campaign-contracts";
import {
  campaignOwnershipDigestValue,
} from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/campaign/campaign-ownership";
import { AtlasRepository } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/atlas/atlas-repository";
import { parseLocationDocument } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/location/location-schema";
import type { AtlasEditor } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/atlas/atlas-editor";
import { FileConflict } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/persistence";
import { CitySource } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/city/commands";
import { CityDraft } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/city/draft";
import { serializeCityDocument } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/city/codec";
import { cityBuildingOutline } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/src/features/city/geometry";
import { menus } from "/home/aaron/.cache/dungeon-native-qa/hex-02/i01-20261009/save-clean/tests/fixtures/obsidian-atlas-host-stub";

const actualRendererInit = AtlasRenderer.prototype.init;

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
  const app = { document: dom.document, vault, scope: new Scope() } as any;
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
function escapeFrom(f: Awaited<ReturnType<typeof fixture>>, field: HTMLElement, isComposing = false) {
  field.focus();
  const event = new f.window.Event('keydown', { bubbles: true, cancelable: true });
  Object.assign(event, { key: 'Escape', isComposing });
  field.dispatchEvent(event);
  return event;
}
const locationTarget = {
  kind: "location" as const,
  documentId: uuid(11),
  recordId: uuid(11),
  roomId: null,
};

test("J03 preflight: actual visible prepared Room Save retains partial After and fresh entry restores native Before plus exact unsaved draft", async () => {
 const f=await fixture(true),initial=active(f),editor=f.editor()!;
 const oldApp=(globalThis as any).app;(globalThis as any).app={vault:f.vault};
 const room=initial.inventory.records.find(r=>r.kind==='room')!;
 const dungeonPath='Dungeons/E2E-01-Testdungeon/Karte.dungeon',draftPath=aPath+'.draft',journalPath=aPath+'.journal',campaignPath=seed.campaign.path;
 const nativeBefore=new Map(f.vault.bytes);
 await f.host().navigate({kind:'room',documentId:room.documentId,recordId:room.id,roomId:null});
 const text='## Eingang\nJ03: Vorbereiteter Room-Save erhält ungespeicherten Text.  \n\n';
 f.input('[aria-label="Raumtext 1"]',text);await editor.flush();
 const withDraft=new Map(f.vault.bytes),draftBefore=f.vault.bytes.get(draftPath)!;
 const expectedDungeon=JSON.parse(JSON.stringify((initial.repository.detail('dungeon',room.documentId) as any).read().document));
 const camera=editor.renderer.relativeCamera,depth=initial.history.undoDepth;
 const editorRoot=editor.viewport.closest<HTMLElement>('.dn-atlas')!;
 const trash=f.vault.trash.bind(f.vault),process=f.vault.process.bind(f.vault);
 const install=require('/home/aaron/.cache/dungeon-native-qa/hex-04/room-save-prepared-journal-j03-20261011/prepared-save-fault.cjs');
 let closed=false;
 try{
  install({journalPath,draftPath,dungeonPath,campaignPath});
  f.click(f.content.querySelector<HTMLElement>('[aria-label="Atlas speichern"]')!);
  await (editor as any).work;
  const probe=(f.window as any).__roomSavePreparedFault;
  assert.equal(probe.draftDeleteFailures,1);assert(probe.rollbackFailures>=1);
  assert.equal(f.host().state.kind,'unavailable');assert.equal(f.editor(),undefined);
  assert.equal(editorRoot.inert,true);
  assert.equal(editorRoot.querySelector('.dn-atlas-save-status')!.textContent,'Entwurf erhalten; Bearbeitung angehalten.');
  assert.equal(editorRoot.querySelector<HTMLTextAreaElement>('[aria-label="Raumtext 1"]')!.value,text);
  assert.equal(initial.history.undoDepth,depth);assert.deepEqual(editor.renderer.relativeCamera,camera);
  const raw=f.vault.bytes.get(journalPath)!,journal=JSON.parse(raw);
  assert.equal(journal.state,'prepared');assert.equal(journal.writes.length,3);
  assert.deepEqual(journal.writes.map((w:any)=>w.path),[dungeonPath,draftPath,campaignPath]);
  assert.equal(f.vault.bytes.get(dungeonPath),journal.writes[0].after);
  assert.equal(f.vault.bytes.get(draftPath),draftBefore);
  assert.equal(f.vault.bytes.get(campaignPath),nativeBefore.get(campaignPath));
  for(const [path,bytes] of withDraft)if(path!==dungeonPath)assert.equal(f.vault.bytes.get(path),bytes,path);
  assert.deepEqual(JSON.parse(f.vault.bytes.get(dungeonPath)!),expectedDungeon);
  f.vault.trash=trash;f.vault.process=process;
  await f.close();closed=true;
  assert.equal(f.vault.bytes.get(journalPath),raw);
  const app={document:f.document,vault:f.vault} as any;
  const services=atlasCampaignServices(new VaultCampaignRuntimeStorage(app),sha);
  const view=new AtlasView({app,contentEl:f.content,openFile:async()=>{}} as any,services);
  try{
   await view.onLoadFile(f.vault.files.get(aPath)!);
   const fresh=((view as any).campaignHost as AtlasCampaignHost).state;
   assert.equal(fresh.kind,'active');if(fresh.kind!=='active')assert.fail(fresh.reason);
   assert.equal(f.vault.bytes.has(journalPath),false);
   assert.deepEqual(f.vault.bytes,withDraft);
   assert.equal(f.vault.bytes.get(draftPath),draftBefore);
   assert.deepEqual((fresh.repository.detail('dungeon',room.documentId) as any).read().document,expectedDungeon);
   assert.equal(fresh.repository.dirty,true);assert.equal(fresh.repository.hasDraft,true);
   assert.equal(fresh.history.undoDepth,0);assert.equal(fresh.history.canRedo,false);
   const observation={scope:'DOM/Vault adapter preflight, no native Obsidian process',passed:true,source:'54c3ddd53507f358ac99efd8c8d08c2e7edb5902',nativeSaveJournalHandcrafted:false,saveViaVisibleButton:true,journalState:'prepared',writes:journal.writes.map((w:any)=>w.path),fault:probe,onlyDungeonNativePartialAfter:true,campaignBeforeExact:true,draftBeforeExact:true,oldMountUnavailable:true,retainedStatusStopped:true,retainedStateCameraHistoryExact:true,freshNormalFileEntry:true,allOriginalNativeBytesRestored:true,unsavedFullDungeonExact:true,literalMarkdown:text,dirty:true,hasDraft:true,historyDepth:0,canRedo:false,journalAbsent:true,normalElectronQuit:false,nativeFreshProcess:false};
   require('node:fs').writeFileSync('/home/aaron/.cache/dungeon-native-qa/hex-04/room-save-prepared-journal-j03-20261011/preflight-observations.json',JSON.stringify(observation,null,2)+'\n');
  }finally{await view.onUnloadFile();services.close();}
 }finally{
  f.vault.trash=trash;f.vault.process=process;(globalThis as any).app=oldApp;
  if(!closed)await f.close();
 }
});

