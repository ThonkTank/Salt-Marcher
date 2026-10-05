import {
  App,
  FileSystemAdapter,
  FileView,
  ItemView,
  MarkdownRenderChild,
  Modal,
  Notice,
  Plugin,
  Setting,
  TFile,
  type ButtonComponent,
  type SliderComponent,
  type ToggleComponent,
  type WorkspaceLeaf,
} from "obsidian";
import { closeSync, createReadStream, openSync, readSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  newDocument,
  safePath,
  type CompassDirection,
  type DungeonRoute,
  type FeatureDefinition,
  type FeatureOccurrence,
  type FeatureKind,
  type Door,
  type Entity,
  type MapObject,
  type NoteLink,
  type ReferenceImage,
  type Room,
  isRoom,
} from "./model";
import { compactWheelNavigation, wheelNavigation } from "./navigation";
import { Session } from "./session";
import { FileConflict, MapRepository, type FileStore } from "./persistence";
import { DungeonEditor } from "./editor";
import { toolSettings, type ToolSettings } from "./properties";
import { MapRenderer, type ColorableObjectSource } from "./renderer";
import { type Prefab, validPrefabs } from "./prefabs";
import { withoutPrefabDefinition } from "./features/objekte/prefab-forget";
import { createReferenceImage, resizeMap, type MapMargins } from "./commands";
import {
  generateLayout,
  type GeneratorKind,
  type GeneratorOptions,
} from "./generators";
import {
  analyzeDungeon,
  archiveDefinition,
  archiveOccurrence,
  archiveRoute,
  createFeatureDefinition,
  createFeatureOccurrence,
  createRoute,
  restoreArchive,
  updateFeatureDefinition,
  updateFeatureOccurrence,
  updateFeatureQuantity,
  updateRoute,
  type FeatureDefinitionInput,
} from "./content";
import {
  AssetCatalog,
  PackAssetLibrary,
  type AssetDefinition,
  type AssetCatalogStore,
  type BinarySource,
} from "./assets";
import {
  NATIVE_PATH_PCK_SHA256,
  readNativePathCatalog,
  type NativePathCatalog,
} from "./features/material/native-path-catalog";

const VIEW = "dungeon-native-map";
const PLAY_VIEW = "dungeon-native-play";
class VaultStore implements FileStore {
  constructor(private app: App) {}
  async read(path: string): Promise<string | null> {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f) return null;
    if (!(f instanceof TFile)) throw new Error("Pfad ist keine Datei: " + path);
    return this.app.vault.read(f);
  }
  private async folders(path: string): Promise<void> {
    const parts = path.split("/");
    parts.pop();
    let current = "";
    for (const part of parts) {
      current += (current ? "/" : "") + part;
      if (!this.app.vault.getAbstractFileByPath(current))
        await this.app.vault.createFolder(current);
    }
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    safePath(path);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (before === null) {
      if (file) throw new FileConflict(path);
      if (after !== null) {
        await this.folders(path);
        await this.app.vault.create(path, after);
      }
      return;
    }
    if (!(file instanceof TFile)) throw new FileConflict(path);
    if (after === null) {
      if ((await this.app.vault.read(file)) !== before)
        throw new FileConflict(path);
      await this.app.vault.trash(file, false);
      return;
    }
    await this.app.vault.process(file, (current) => {
      if (current !== before) throw new FileConflict(path);
      return after;
    });
  }
}
class VaultAssetStore implements AssetCatalogStore {
  private readonly root = ".obsidian/dungeon-editor-assets";
  constructor(private app: App) {}
  private async folder(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.root))) await adapter.mkdir(this.root);
  }
  private packagePath(hash: string): string {
    if (!/^[0-9a-f]{64}$/.test(hash))
      throw new Error("Ungültige Paketkennung.");
    return this.root + "/" + hash + ".dungeondraft_pack";
  }
  async readCatalog(): Promise<string | null> {
    const path = this.root + "/catalog.json",
      adapter = this.app.vault.adapter;
    return (await adapter.exists(path)) ? adapter.read(path) : null;
  }
  async writeCatalog(text: string): Promise<void> {
    await this.folder();
    const adapter = this.app.vault.adapter,
      target = this.root + "/catalog.json",
      temporary = this.root + "/catalog.next.json";
    await adapter.write(temporary, text);
    if (await adapter.exists(target)) await adapter.remove(target);
    await adapter.rename(temporary, target);
  }
  async writePackage(hash: string, source: BinarySource): Promise<void> {
    await this.folder();
    const adapter = this.app.vault.adapter,
      path = this.packagePath(hash);
    if (!(await adapter.exists(path)))
      await adapter.writeBinary(
        path,
        await source.slice(0, source.size).arrayBuffer(),
      );
  }
  async readPackage(hash: string): Promise<BinarySource> {
    const adapter = this.app.vault.adapter,
      path = this.packagePath(hash);
    if (adapter instanceof FileSystemAdapter)
      return new LocalBinarySource(adapter.getFullPath(path));
    const bytes = await adapter.readBinary(path);
    return new Blob([bytes]);
  }
  async removePackage(hash: string): Promise<void> {
    const path = this.packagePath(hash),
      adapter = this.app.vault.adapter;
    if (await adapter.exists(path)) await adapter.remove(path);
  }
}
class LocalBinarySource implements BinarySource {
  readonly size: number;
  constructor(private path: string) {
    this.size = statSync(path).size;
  }
  slice(start = 0, end = this.size): Blob {
    start = Math.max(
      0,
      Math.min(this.size, start < 0 ? this.size + start : start),
    );
    end = Math.max(start, Math.min(this.size, end < 0 ? this.size + end : end));
    const bytes = new Uint8Array(end - start),
      descriptor = openSync(this.path, "r");
    try {
      let read = 0;
      while (read < bytes.length) {
        const count = readSync(
          descriptor,
          bytes,
          read,
          bytes.length - read,
          start + read,
        );
        if (!count)
          throw new Error("Assetpaket wurde während des Lesens verkürzt.");
        read += count;
      }
    } finally {
      closeSync(descriptor);
    }
    return new Blob([bytes]);
  }
}
interface OpenMap {
  session: Session;
  repository: MapRepository;
  views: number;
  stopDrafts: () => void;
  draftTimer?: ReturnType<typeof setTimeout>;
}
interface SizePreset {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}
interface PluginData {
  readonly sizePresets: readonly SizePreset[];
  readonly toolDefaults: ToolSettings;
  readonly prefabs: readonly Prefab[];
  readonly nativePckPath?: string;
}
async function fileSha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
class PrefabNameModal extends Modal {
  private answer?: (value: { set: string; name: string } | null) => void;
  constructor(app: App, private readonly existingSets: readonly string[]) {
    super(app);
  }
  request(): Promise<{ set: string; name: string } | null> {
    return new Promise((resolve) => {
      this.answer = resolve;
      this.open();
    });
  }
  onOpen(): void {
    const sets = [...new Set(["Allgemein", ...this.existingSets])],
      temporarySets = new Set<string>(),
      returnSets = new Map<string, string>();
    let set = this.existingSets.at(-1) ?? "Allgemein", name = "";
    const render = () => {
      this.setTitle("Vorlage erstellen");
      this.contentEl.empty();
      new Setting(this.contentEl).setName("Sammlung")
        .addDropdown((dropdown) => dropdown
          .addOptions(Object.fromEntries(sets.map((value) => [value, value])))
          .setValue(set)
          .onChange((value) => { set = value; render(); }))
        .addButton((button) => button.setButtonText("+")
          .setTooltip("Sammlung hinzufügen")
          .onClick(() => renderNewSet()))
        .addButton((button) => button.setButtonText("−")
          .setTooltip("Leere Sammlung entfernen")
          .setDisabled(!temporarySets.has(set))
          .onClick(() => {
            const removed = set;
            temporarySets.delete(removed);
            sets.splice(sets.indexOf(removed), 1);
            const previous = returnSets.get(removed);
            returnSets.delete(removed);
            set = previous && sets.includes(previous) ? previous : sets[0]!;
            render();
          }));
      new Setting(this.contentEl).setName("Name").addText((input) =>
        input.setPlaceholder("Vorlagenname").setValue(name)
          .onChange((value) => { name = value; }));
      new Setting(this.contentEl).addButton((button) => button
        .setButtonText("Erstellen").setCta().onClick(() => {
          if (!name.trim()) return;
          this.answer?.({ set, name: name.trim() });
          this.answer = undefined;
          this.close();
        }));
    };
    const renderNewSet = () => {
      this.setTitle("Sammlung hinzufügen");
      this.contentEl.empty();
      let candidate = "";
      new Setting(this.contentEl).setName("Name").addText((input) =>
        input.setPlaceholder("Sammlungsname")
          .onChange((value) => { candidate = value; }));
      new Setting(this.contentEl)
        .addButton((button) => button.setButtonText("Hinzufügen")
          .setCta().onClick(() => {
            const value = candidate.trim();
            if (!value) return;
            const existing = sets.find((item) =>
              item.toLocaleLowerCase() === value.toLocaleLowerCase());
            if (existing) set = existing;
            else {
              sets.push(value);
              temporarySets.add(value);
              returnSets.set(value, set);
              set = value;
            }
            render();
          }))
        .addButton((button) => button.setButtonText("Abbrechen")
          .onClick(() => render()));
    };
    render();
  }
  onClose(): void {
    this.answer?.(null);
    this.answer = undefined;
    this.contentEl.empty();
  }
}
function requestPrefabForget(
  doc: Document,
  prefab: Prefab,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  const dialog = doc.createElement("dialog");
  dialog.className = "dn-confirm-dialog";
  dialog.setAttribute("aria-label", "Vorlage vergessen");
  const title = doc.createElement("h2");
  title.textContent = "Vorlage vergessen";
  const close = doc.createElement("button");
  close.type = "button";
  close.className = "dn-confirm-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Schließen");
  close.addEventListener("click", () => dialog.close());
  const warning = doc.createElement("p");
  warning.textContent = `„${prefab.set} / ${prefab.name}“ dauerhaft aus der Bibliothek entfernen? Bereits platzierte Elemente bleiben auf der Karte und müssen bei Bedarf einzeln gelöscht werden.`;
  const actions = doc.createElement("div");
  actions.className = "dn-confirm-actions";
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Abbrechen";
  cancel.addEventListener("click", () => dialog.close());
  const confirm = doc.createElement("button");
  confirm.type = "button";
  confirm.textContent = "Vergessen";
  confirm.addEventListener("click", () => dialog.close("forget"));
  actions.append(cancel, confirm);
  dialog.append(title, close, warning, actions);
  doc.body.append(dialog);
  return new Promise((resolve) => {
    let cancelled = false;
    const abort = () => {
      cancelled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(false);
    };
    dialog.addEventListener("close", () => {
      signal.removeEventListener("abort", abort);
      resolve(!cancelled && dialog.returnValue === "forget");
      dialog.remove();
    }, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    try {
      dialog.showModal();
    } catch (error) {
      signal.removeEventListener("abort", abort);
      dialog.remove();
      throw error;
    }
  });
}
interface CreationAssets {
  readonly assetPacks: readonly string[];
  readonly builtInAssets: boolean;
}
interface CreationAppearance {
  readonly wallShadows: boolean;
  readonly objectShadows: boolean;
  readonly buildingWear: number;
}
export default class DungeonPlugin extends Plugin {
  private maps = new Map<string, Promise<OpenMap>>();
  readonly assets = new AssetCatalog(new VaultAssetStore(this.app));
  private assetLibrary = new PackAssetLibrary();
  private nativePathCatalog?: NativePathCatalog;
  private nativePathAttempted?: string;
  private nativePathError?: string;
  private nativePathUrls = new Map<string, string>();
  private catalogBuiltIns = true;
  private assetLoading?: Promise<void>;
  private assetLoaded = false;
  private assetListeners = new Set<() => void>();
  private pluginData: PluginData = {
    sizePresets: [],
    toolDefaults: toolSettings(),
    prefabs: [],
  };
  private pluginDataWrites: Promise<void> = Promise.resolve();
  private changePluginData(change: (current: PluginData) => PluginData | null): Promise<boolean> {
    const operation = this.pluginDataWrites.then(async () => {
      const next = change(this.pluginData);
      if (!next) return false;
      await this.saveData(next);
      this.pluginData = next;
      return true;
    });
    this.pluginDataWrites = operation.then(() => {}, () => {});
    return operation;
  }
  async onload(): Promise<void> {
    const loaded = await this.loadData();
    if (loaded && Array.isArray(loaded.sizePresets)) {
      const defaults = toolSettings(),
        saved =
          loaded.toolDefaults && typeof loaded.toolDefaults === "object"
            ? (structuredClone(loaded.toolDefaults) as Partial<ToolSettings>)
            : {};
      this.pluginData = {
        prefabs: validPrefabs(loaded.prefabs),
        nativePckPath: typeof loaded.nativePckPath === "string" &&
          loaded.nativePckPath.trim() ? loaded.nativePckPath : undefined,
        sizePresets: loaded.sizePresets.filter(
          (preset: unknown): preset is SizePreset =>
            !!preset &&
            typeof preset === "object" &&
            typeof (preset as SizePreset).name === "string" &&
            !!(preset as SizePreset).name.trim() &&
            Number.isInteger((preset as SizePreset).width) &&
            (preset as SizePreset).width > 0 &&
            (preset as SizePreset).width <= 10000 &&
            Number.isInteger((preset as SizePreset).height) &&
            (preset as SizePreset).height > 0 &&
            (preset as SizePreset).height <= 10000,
        ),
        toolDefaults: {
          ...defaults,
          ...saved,
          light: { ...defaults.light, ...(saved.light ?? {}) },
          room: { ...defaults.room, ...(saved.room ?? {}) },
          wall: { ...defaults.wall, ...(saved.wall ?? {}) },
          path: { ...defaults.path, ...(saved.path ?? {}) },
          roof: { ...defaults.roof, ...(saved.roof ?? {}) },
          object: { ...defaults.object, ...(saved.object ?? {}) },
          scatter: { ...defaults.scatter, ...(saved.scatter ?? {}) },
          surfaces: {
            floor: {
              ...defaults.surfaces.floor,
              ...(saved.surfaces?.floor ?? {}),
            },
            cave: {
              ...defaults.surfaces.cave,
              ...(saved.surfaces?.cave ?? {}),
            },
            pattern: {
              ...defaults.surfaces.pattern,
              ...(saved.surfaces?.pattern ?? {}),
            },
            water: {
              ...defaults.surfaces.water,
              ...(saved.surfaces?.water ?? {}),
            },
            terrain: {
              ...defaults.surfaces.terrain,
              ...(saved.surfaces?.terrain ?? {}),
            },
          },
          portal: {
            ...defaults.portal,
            ...(saved.portal ?? {}),
            passage: {
              ...defaults.portal.passage,
              ...(saved.portal?.passage ?? {}),
            },
          },
        } as ToolSettings,
      };
    }
    this.registerView(VIEW, (leaf) => new DungeonView(leaf, this));
    this.registerView(PLAY_VIEW, (leaf) => new DungeonPlayView(leaf, this));
    this.registerExtensions(["dungeon"], VIEW);
    this.addCommand({
      id: "create-dungeon",
      name: "Dungeon anlegen",
      callback: () => new CreateDungeonModal(this.app, this).open(),
    });
    this.addCommand({
      id: "manage-dungeon-assets",
      name: "Assetpakete verwalten",
      callback: () => this.openAssets(),
    });
    this.addCommand({
      id: "open-dungeon-play-view",
      name: "Dungeon-Karte in Spielansicht öffnen",
      checkCallback: (checking) => {
        const file = this.mapFor(this.app.workspace.getActiveFile());
        if (!file) return false;
        if (!checking) void this.openPlay(file.path, this.activeRoomId());
        return true;
      },
    });
    this.registerMarkdownPostProcessor((element, context) => {
      for (const embed of element.querySelectorAll<HTMLElement>(
        ".internal-embed",
      )) {
        const source = embed.getAttribute("src") ?? embed.dataset.src;
        if (!source) continue;
        const file = this.app.metadataCache.getFirstLinkpathDest(
          source.split("#")[0]!,
          context.sourcePath,
        );
        if (!(file instanceof TFile) || file.extension !== "dungeon") continue;
        const host = document.createElement("div"),
          roomId = this.roomId(context.sourcePath);
        embed.replaceWith(host);
        context.addChild(new DungeonEmbed(host, this, file.path, roomId));
      }
    });
    this.registerMarkdownCodeBlockProcessor(
      "dungeon-map",
      (source, element, context) => {
        const file = this.app.metadataCache.getFirstLinkpathDest(
          source.trim().split(/\r?\n/, 1)[0] ?? "",
          context.sourcePath,
        );
        if (!(file instanceof TFile) || file.extension !== "dungeon") {
          element.createEl("p", { text: "Dungeon-Karte nicht gefunden." });
          return;
        }
        context.addChild(
          new DungeonEmbed(
            element,
            this,
            file.path,
            this.roomId(context.sourcePath),
          ),
        );
      },
    );
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "dungeon")
          menu.addItem((item) =>
            item
              .setTitle("Karte bearbeiten")
              .setIcon("map")
              .onClick(
                () => void this.app.workspace.getLeaf(false).openFile(file),
              ),
          );
      }),
    );
  }
  openAssets(session?: Session): void {
    new AssetPackagesModal(
      this.app,
      this.assets,
      () => this.reloadAssets(),
      session,
      {
        status: () => ({
          path: this.pluginData.nativePckPath,
          count: this.nativePathCatalog?.textures.length ?? 0,
          error: this.nativePathError,
        }),
        choose: (path) => this.useNativeAssetArchive(path),
      },
    ).open();
  }
  private roomId(path: string): string | undefined {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return undefined;
    const value =
      this.app.metadataCache.getFileCache(file)?.frontmatter?.room_id;
    return value === undefined || value === null ? undefined : String(value);
  }
  private activeRoomId(): string | undefined {
    const file = this.app.workspace.getActiveFile();
    return file ? this.roomId(file.path) : undefined;
  }
  private mapFor(file: TFile | null): TFile | undefined {
    if (!file) return undefined;
    if (file.extension === "dungeon") return file;
    const cache = this.app.metadataCache.getFileCache(file);
    for (const embed of cache?.embeds ?? []) {
      const target = this.app.metadataCache.getFirstLinkpathDest(
        embed.link,
        file.path,
      );
      if (target instanceof TFile && target.extension === "dungeon")
        return target;
    }
    const match = file.path.match(/^(Dungeons\/[^/]+)\/Räume\//),
      fallback = match
        ? this.app.vault.getAbstractFileByPath(match[1] + "/Karte.dungeon")
        : null;
    return fallback instanceof TFile ? fallback : undefined;
  }
  async openMap(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "dungeon")
      throw new Error("Dungeon-Karte nicht gefunden.");
    const leaf =
      this.app.workspace
        .getLeavesOfType(VIEW)
        .find((candidate) => candidate.view.containerEl.isConnected) ??
      this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }
  async openPlay(path: string, roomId?: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "dungeon")
      throw new Error("Dungeon-Karte nicht gefunden.");
    const leaf =
      this.app.workspace.getRightLeaf(false) ??
      this.app.workspace.getLeaf("split", "vertical");
    await leaf.setViewState({
      type: PLAY_VIEW,
      active: true,
      state: { path, roomId },
    });
    this.app.workspace.revealLeaf(leaf);
  }
  createDungeonMap(input: {
    path: string;
    source?: string;
    focusRoom?: string | null;
    compact?: boolean;
  }): DungeonMapCard {
    return new DungeonMapCard(
      this,
      input.path,
      input.focusRoom ?? undefined,
      input.compact ?? false,
      input.source ?? input.path,
    );
  }
  ensureAssets(): Promise<void> {
    if (this.assetLoaded) return Promise.resolve();
    return (this.assetLoading ??= this.reloadAssets().finally(() => {
      this.assetLoading = undefined;
    }));
  }
  private async loadNativePathCatalog(): Promise<void> {
    const path = this.pluginData.nativePckPath;
    if (!path || this.nativePathAttempted === path) return;
    this.nativePathAttempted = path;
    try {
      if (await fileSha256(path) !== NATIVE_PATH_PCK_SHA256)
        throw new Error("Die Originaldatei passt nicht zu Dungeondraft 1.2.0.1 Linux64.");
      this.nativePathCatalog = await readNativePathCatalog(
        new LocalBinarySource(path),
      );
      this.nativePathError = undefined;
    } catch (error) {
      this.nativePathError = String(error);
      new Notice("Dungeondraft-Originalassets konnten nicht geladen werden: " +
        this.nativePathError, 10000);
    }
  }
  async useNativeAssetArchive(path: string): Promise<void> {
    if (await fileSha256(path) !== NATIVE_PATH_PCK_SHA256)
      throw new Error("Bitte die Originaldatei von Dungeondraft 1.2.0.1 Linux64 wählen.");
    const next = await readNativePathCatalog(new LocalBinarySource(path));
    await this.changePluginData((current) => ({ ...current, nativePckPath: path }));
    this.nativePathCatalog = next;
    this.nativePathAttempted = path;
    this.nativePathError = undefined;
    for (const listener of this.assetListeners) listener();
  }
  private async reloadAssets(): Promise<void> {
    const [next, catalog] = await Promise.all([
      this.assets.loadAll(), this.assets.read(),
    ]);
    await this.loadNativePathCatalog();
    const builtIns = catalog.builtIns,
      previous = this.assetLibrary;
    this.catalogBuiltIns = builtIns;
    this.assetLibrary = next;
    this.assetLoaded = true;
    for (const listener of this.assetListeners) listener();
    setTimeout(() => previous.close(), 1000);
  }
  assetUrl(reference: string): string {
    const split = reference.indexOf("\0");
    if (split >= 0) {
      const id = reference.slice(0, split),
        part = reference.slice(split + 1);
      if (part === "image") {
        const native = this.nativePathCatalog?.image(id);
        if (native) {
          let url = this.nativePathUrls.get(id);
          if (!url) {
            url = URL.createObjectURL(native);
            this.nativePathUrls.set(id, url);
          }
          return url;
        }
      }
      return this.assetLibrary.has(id) ? this.assetLibrary.url(id, part) : "";
    }
    return this.app.vault.adapter.getResourcePath(reference);
  }
  listAssets(
    packIds?: readonly string[],
    builtInAssets = this.catalogBuiltIns,
  ): readonly AssetDefinition[] {
    const assets = this.assetLibrary.list();
    const selected = packIds ? new Set(packIds) : null;
    const packed = selected
      ? assets.filter((asset) => selected.has(asset.packId))
      : assets;
    return builtInAssets && this.nativePathCatalog
      ? [...packed, ...this.nativePathCatalog.textures.map((item) => item.asset)]
      : packed;
  }
  colorableObjectSource(
    id: string,
    packIds?: readonly string[],
  ): ColorableObjectSource | undefined {
    const asset = this.listAssets(packIds).find((candidate) => candidate.id === id);
    if (!asset?.tintable || !asset.colorableSettings ||
        asset.kind !== "object" || !this.assetLibrary.has(id))
      return undefined;
    return { image: this.assetLibrary.blob(id), settings: asset.colorableSettings };
  }
  subscribeAssets(listener: () => void): () => void {
    this.assetListeners.add(listener);
    return () => this.assetListeners.delete(listener);
  }
  async importReference(
    session: Session,
    floorId: string,
    file: File,
  ): Promise<ReferenceImage> {
    const extension = file.name.split(".").at(-1)?.toLocaleLowerCase(),
      supported = new Set(["png", "jpg", "jpeg", "webp"]);
    if (!extension || !supported.has(extension))
      throw new Error("Bitte PNG, JPEG oder WebP als Vorlage wählen.");
    const bytes = await file.arrayBuffer();
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
    } catch {
      throw new Error("Die Bilddatei konnte nicht gelesen werden.");
    }
    const width = bitmap.width,
      height = bitmap.height;
    bitmap.close();
    const digest = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join(""),
      root = ".obsidian/dungeon-editor-assets",
      folder = root + "/references",
      path =
        folder +
        "/" +
        digest +
        "." +
        (extension === "jpeg" ? "jpg" : extension),
      adapter = this.app.vault.adapter;
    if (!(await adapter.exists(root))) await adapter.mkdir(root);
    if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
    if (!(await adapter.exists(path))) await adapter.writeBinary(path, bytes);
    return createReferenceImage(
      session,
      floorId,
      path,
      file.name,
      width,
      height,
    );
  }
  sizePresets(): readonly SizePreset[] {
    return this.pluginData.sizePresets;
  }
  async saveSizePreset(
    name: string,
    width: number,
    height: number,
  ): Promise<void> {
    name = name.trim();
    if (!name)
      throw new Error("Bitte einen Namen für die Größenvorlage eingeben.");
    newDocument("Größenvorlage", width, height);
    await this.changePluginData((current) => ({
      ...current,
      sizePresets: [
        ...current.sizePresets.filter((preset) =>
          preset.name.toLocaleLowerCase() !== name.toLocaleLowerCase()),
        { name, width, height },
      ],
    }));
  }
  async removeSizePreset(name: string): Promise<void> {
    await this.changePluginData((current) => ({
      ...current,
      sizePresets: current.sizePresets.filter((preset) => preset.name !== name),
    }));
  }
  toolDefaults(): ToolSettings {
    return this.pluginData.toolDefaults;
  }
  prefabs(): readonly Prefab[] {
    return this.pluginData.prefabs;
  }
  async savePrefab(prefab: Prefab): Promise<void> {
    await this.changePluginData((current) => {
      if (current.prefabs.some((existing) =>
        existing.set.toLocaleLowerCase() === prefab.set.toLocaleLowerCase() &&
        existing.name.toLocaleLowerCase() === prefab.name.toLocaleLowerCase()))
        throw new Error("In dieser Sammlung gibt es bereits eine Vorlage mit diesem Namen.");
      return { ...current, prefabs: [...current.prefabs, prefab] };
    });
  }
  async forgetPrefab(
    prefab: Prefab,
    doc: Document,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (!this.pluginData.prefabs.some((existing) => existing.id === prefab.id))
      return false;
    if (!(await requestPrefabForget(doc, prefab, signal)) || signal.aborted)
      return false;
    return this.changePluginData((current) =>
      !signal.aborted && current.prefabs.some((existing) => existing.id === prefab.id)
        ? { ...current,
            prefabs: withoutPrefabDefinition(current.prefabs, prefab.id) }
        : null,
    );
  }
  persistToolDefaults(): void {
    void this.changePluginData((current) => ({ ...current })).catch((error) =>
      console.error("Werkzeugvorgaben speichern", error),
    );
  }
  async acquire(path: string): Promise<OpenMap> {
    let pending = this.maps.get(path);
    if (!pending) {
      pending = (async () => {
        const repository = new MapRepository(new VaultStore(this.app), path),
          session = await repository.open();
        const map: OpenMap = {
          repository,
          session,
          views: 0,
          stopDrafts: () => {},
        };
        map.stopDrafts = session.subscribe(() => {
          if (map.draftTimer) clearTimeout(map.draftTimer);
          map.draftTimer = setTimeout(() => {
            map.draftTimer = undefined;
            void repository
              .persistDraft(session)
              .catch(
                (error) =>
                  new Notice(
                    "Entwurf konnte nicht gesichert werden: " + String(error),
                  ),
              );
          }, 400);
        });
        return map;
      })();
      this.maps.set(path, pending);
      pending.catch(() => this.maps.delete(path));
    }
    const map = await pending;
    map.views++;
    return map;
  }
  release(path: string, map: OpenMap): void {
    map.views--;
    if (map.views === 0 && !map.session.dirty) {
      if (map.draftTimer) clearTimeout(map.draftTimer);
      map.stopDrafts();
      this.maps.delete(path);
    }
  }
  onunload(): void {
    for (const pending of this.maps.values())
      void pending
        .then((map) => {
          if (map.draftTimer) clearTimeout(map.draftTimer);
          map.stopDrafts();
          return map.repository.persistDraft(map.session);
        })
        .catch((error) => console.error("Dungeon-Entwurf sichern", error));
    this.assetLibrary.close();
    for (const url of this.nativePathUrls.values()) URL.revokeObjectURL(url);
    this.nativePathUrls.clear();
    this.assetListeners.clear();
  }
  async create(
    name: string,
    width: number,
    height: number,
    selectedAssets?: CreationAssets,
    generator?: GeneratorOptions,
    appearance?: CreationAppearance,
  ): Promise<void> {
    name = name.trim();
    if (
      !name ||
      /[\\/:*?"<>|\x00-\x1f]/.test(name) ||
      name === "." ||
      name === ".."
    )
      throw new Error("Bitte einen gültigen Dungeonnamen eingeben.");
    const catalog = await this.assets.read(),
      assets = selectedAssets ?? {
        assetPacks: catalog.packs
          .filter((record) => record.enabled)
          .map((record) => record.metadata.id),
        builtInAssets: catalog.builtIns,
      },
      path = "Dungeons/" + name + "/Karte.dungeon",
      repository = new MapRepository(new VaultStore(this.app), path),
      session = new Session(
        newDocument(
          name,
          width,
          height,
          {
            assetPacks: assets.assetPacks,
            builtInAssets: assets.builtInAssets,
          },
          appearance,
        ),
      );
    if (generator)
      generateLayout(session, session.floors.keys().next().value!, generator);
    await repository.save(session);
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(f);
  }
}
class DungeonMapCard {
  readonly el = document.createElement("div");
  readonly bar = document.createElement("div");
  readonly viewport = document.createElement("div");
  readonly info = document.createElement("section");
  readonly status = document.createElement("span");
  readonly ready: Promise<void>;
  source: string;
  focusId?: string;
  loaded = false;
  private map?: OpenMap;
  private renderer?: MapRenderer;
  private closed = false;
  private abort = new AbortController();
  private resize?: ResizeObserver;
  private assetUnsub?: () => void;
  private sized = false;
  constructor(
    private plugin: DungeonPlugin,
    readonly path: string,
    focusId?: string,
    private compact = false,
    source = path,
  ) {
    this.source = source;
    this.focusId = focusId;
    this.el.className = "dn-map-card dungeon-shared-map";
    this.el.classList.toggle("is-compact", compact);
    this.el.dataset.mapPath = path;
    this.bar.className = "dn-map-tools";
    this.bar.setAttribute("aria-label", "Kartenansicht");
    this.viewport.className = "dn-map-viewport";
    this.viewport.tabIndex = 0;
    this.viewport.setAttribute(
      "aria-label",
      compact
        ? "Gemeinsame Dungeonkarte: ziehen zum Verschieben, Plus und Minus zum Zoomen"
        : "Dungeon-Karte – ziehen zum Verschieben, mit Touchpad oder Mausrad zoomen",
    );
    this.info.className = "dn-map-info dm-info";
    this.el.append(this.bar, this.viewport, this.info);
    this.button("−", "Karte verkleinern", () => this.zoomView(1.25));
    this.button("+", "Karte vergrößern", () => this.zoomView(0.8));
    this.button("Einpassen", "Gesamte Karte einpassen", () => this.fit());
    this.button(
      "Aktuell",
      "Zum aktuell geöffneten Karteninhalt springen",
      () => {
        if (!this.focusId || !this.focusRoom(this.focusId)) this.fit();
      },
    );
    this.button(
      "Maximieren",
      "Karte maximieren und bearbeiten",
      () => void this.openEditor(),
    );
    this.status.className = "dn-map-status";
    this.status.setAttribute("role", "status");
    this.status.textContent = "Karte wird geladen …";
    this.bar.append(this.status);
    this.bindNavigation();
    this.ready = this.init();
  }
  private button(text: string, label: string, action: () => void): void {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action, { signal: this.abort.signal });
    this.bar.append(button);
  }
  private bindNavigation(): void {
    let drag:
      | {
          pointer: number;
          startX: number;
          startY: number;
          x: number;
          y: number;
          moved: boolean;
        }
      | undefined;
    const options = { signal: this.abort.signal };
    this.viewport.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        drag = {
          pointer: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
      },
      options,
    );
    this.viewport.addEventListener(
      "pointermove",
      (event) => {
        if (!drag) {
          if (this.compact && this.renderer)
            this.viewport.classList.toggle(
              "is-room-label",
              !!this.renderer.roomLabelAt(this.renderer.local(event)),
            );
          return;
        }
        if (drag.pointer !== event.pointerId) return;
        if (
          !drag.moved &&
          Math.abs(event.clientX - drag.startX) +
            Math.abs(event.clientY - drag.startY) <=
            4
        )
          return;
        if (!drag.moved) {
          drag.moved = true;
          this.viewport.setPointerCapture(event.pointerId);
          this.viewport.classList.add("is-dragging");
        }
        this.renderer?.pan(event.clientX - drag.x, event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
      },
      options,
    );
    this.viewport.addEventListener(
      "pointerup",
      (event) => {
        if (!drag || drag.pointer !== event.pointerId) return;
        if (!drag.moved && this.compact) this.activateAt(event);
        drag = undefined;
        this.viewport.classList.remove("is-dragging");
      },
      options,
    );
    const stop = () => {
      drag = undefined;
      this.viewport.classList.remove("is-dragging");
    };
    this.viewport.addEventListener("pointercancel", stop, options);
    this.viewport.addEventListener("lostpointercapture", stop, options);
    this.viewport.addEventListener(
      "pointerleave",
      () => this.viewport.classList.remove("is-room-label"),
      options,
    );
    this.viewport.addEventListener(
      "wheel",
      (event) => {
        if (this.compact) {
          const navigation = compactWheelNavigation(event);
          if (navigation.kind === "none") return;
          event.preventDefault();
          this.zoomView(navigation.viewFactor);
          return;
        }
        event.preventDefault();
        const navigation = wheelNavigation(event);
        if (navigation.kind === "zoom") {
          if (!this.renderer) return;
          const rect = this.renderer.canvas.getBoundingClientRect();
          this.renderer.zoom(navigation.factor, {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        } else this.renderer?.pan(navigation.x, navigation.y);
      },
      { ...options, passive: false, capture: true },
    );
    this.viewport.addEventListener(
      "keydown",
      (event) => {
        if (!this.compact || !["+", "=", "-"].includes(event.key)) return;
        event.preventDefault();
        this.zoomView(event.key === "-" ? 1.25 : 0.8);
      },
      options,
    );
  }
  private zoomView(viewFactor: number): void {
    if (this.compact) this.renderer?.zoomView(viewFactor);
    else this.renderer?.zoom(1 / viewFactor);
  }
  fit(): void {
    this.renderer?.fit(this.compact ? 0 : 32);
  }
  private focusRoom(id: string): boolean {
    return this.renderer?.focus(id, 0.35, this.compact ? 0 : 24) ?? false;
  }
  private occurrenceFor(entity: MapObject): FeatureOccurrence | undefined {
    return this.map?.session.content.occurrences.find(
      (occurrence) => occurrence.entityId === entity.id,
    );
  }
  private interactive(entity: Entity): boolean {
    return (
      isRoom(entity) ||
      (entity.kind === "door" && !!entity.passage) ||
      (entity.kind === "object" && !!this.occurrenceFor(entity))
    );
  }
  private activateAt(event: PointerEvent): void {
    if (!this.renderer) return;
    const local = this.renderer.local(event),
      roomLabel = this.renderer.roomLabelAt(local);
    if (roomLabel) {
      void this.openNote(roomLabel.note);
      return;
    }
    const entity = this.renderer.hitTest(
      this.renderer.toWorld(local),
      (candidate) => this.interactive(candidate),
    );
    if (!entity) return;
    if (isRoom(entity)) this.showRoom(entity);
    else if (entity.kind === "door") this.showDoor(entity);
    else if (entity.kind === "object") this.showFeature(entity);
  }
  private infoButton(text: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", action, { signal: this.abort.signal });
    return button;
  }
  private infoHeader(title: string, note?: NoteLink): void {
    this.info.replaceChildren();
    const heading = document.createElement("strong"),
      tools = document.createElement("div");
    heading.textContent = title;
    tools.className = "dn-map-info-tools dm-tools";
    if (note)
      tools.append(
        this.infoButton("Text öffnen", () => void this.openNote(note)),
      );
    tools.append(
      this.infoButton("Schließen", () => this.info.replaceChildren()),
    );
    this.info.append(heading, tools);
  }
  private paragraph(text: string, label?: string): void {
    const paragraph = document.createElement("p");
    if (label) {
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      paragraph.append(strong, text);
    } else paragraph.textContent = text;
    this.info.append(paragraph);
  }
  private showRoom(room: Room): void {
    this.focusId = room.id;
    this.infoHeader(`${room.number} · ${room.name}`, room.note);
    this.info.append(
      this.infoButton("Raum einpassen", () => this.focusRoom(room.id)),
    );
    const occurrences =
      this.map?.session.content.occurrences.filter(
        (occurrence) => occurrence.roomId === room.id,
      ) ?? [];
    for (const occurrence of occurrences) {
      const definition = this.map?.session.content.definitions.find(
        (candidate) => candidate.id === occurrence.definitionId,
      );
      const label = definition
        ? `${occurrence.marker} · ${definition.name}`
        : occurrence.marker;
      const button = this.infoButton(label, () =>
        this.openOccurrence(occurrence),
      );
      button.classList.add("dn-map-feature-button", "dm-feature-button");
      this.info.append(button);
    }
    for (const entity of this.map?.session.entities.values() ?? [])
      if (entity.kind === "door" && entity.roomId === room.id && entity.passage)
        this.info.append(
          this.infoButton(
            `Durchgang · ${this.direction(entity.passage.direction)}`,
            () => this.showDoor(entity),
          ),
        );
  }
  private showFeature(object: MapObject): void {
    const occurrence = this.occurrenceFor(object);
    if (occurrence) this.openOccurrence(occurrence);
  }
  private openOccurrence(occurrence: FeatureOccurrence): void {
    this.focusId = occurrence.roomId;
    this.info.replaceChildren();
    void this.openNote(occurrence.note);
  }
  private direction(value?: CompassDirection): string {
    if (!value) return "ohne Richtungsangabe";
    const labels: Record<CompassDirection, string> = {
      north: "Norden",
      northeast: "Nordosten",
      east: "Osten",
      southeast: "Südosten",
      south: "Süden",
      southwest: "Südwesten",
      west: "Westen",
      northwest: "Nordwesten",
    };
    return labels[value];
  }
  private showDoor(door: Door): void {
    const room = door.roomId
        ? this.map?.session.entities.get(door.roomId)
        : undefined,
      note = door.note ?? (isRoom(room) ? room.note : undefined),
      passage = door.passage;
    if (isRoom(room)) this.focusId = room.id;
    this.infoHeader(`Durchgang · ${this.direction(passage?.direction)}`, note);
    if (!passage) return;
    this.paragraph(passage.description);
    this.paragraph(
      { open: "Offen", closed: "Geschlossen", locked: "Verschlossen" }[
        passage.state
      ],
      "Zustand",
    );
    this.paragraph(
      passage.hidden
        ? `Ja${passage.hiddenDC == null ? "" : ` (SG ${passage.hiddenDC})`}`
        : "Nein",
      "Versteckt",
    );
    if (passage.hp != null) this.paragraph(String(passage.hp), "HP");
    if (passage.ac != null) this.paragraph(String(passage.ac), "RK");
    if (passage.key) this.paragraph(passage.key, "Schlüssel");
  }
  private async openNote(note: NoteLink): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(note.path);
    if (!(file instanceof TFile)) return;
    let subpath = "";
    if (note.anchor) {
      const cache = this.plugin.app.metadataCache.getFileCache(file),
        isBlock = !!cache?.blocks?.[note.anchor];
      subpath = isBlock ? `#^${note.anchor}` : `#${note.anchor}`;
    }
    const game = this.gamePlugin();
    if (game?.open) await game.open(file, subpath);
    else
      await this.plugin.app.workspace.openLinkText(
        note.path + subpath,
        this.source,
        true,
      );
  }
  private gamePlugin():
    | {
        open?: (file: TFile, subpath?: string) => Promise<void>;
        editMap?: (source: string, path: string) => Promise<void> | void;
      }
    | undefined {
    return (
      this.plugin.app as App & {
        plugins: { getPlugin(id: string): unknown };
      }
    ).plugins.getPlugin("dnd-ot-spielansicht") as
      | {
          open?: (file: TFile, subpath?: string) => Promise<void>;
          editMap?: (source: string, path: string) => Promise<void> | void;
        }
      | undefined;
  }
  private async openEditor(): Promise<void> {
    const game = this.compact ? this.gamePlugin() : undefined;
    if (game?.editMap) await game.editMap(this.source, this.path);
    else await this.plugin.openMap(this.path);
  }
  private async init(): Promise<void> {
    try {
      await this.plugin.ensureAssets();
      const map = await this.plugin.acquire(this.path);
      if (this.closed) {
        this.plugin.release(this.path, map);
        return;
      }
      this.map = map;
      this.focusId = this.resolveFocus(this.focusId);
      const floor = document.createElement("select");
      floor.setAttribute("aria-label", "Geschoss der Kartenansicht");
      for (const value of map.session.floors.values()) {
        const option = document.createElement("option");
        option.value = value.id;
        option.textContent = value.name;
        floor.append(option);
      }
      floor.addEventListener(
        "change",
        () => this.renderer?.setFloor(floor.value),
        { signal: this.abort.signal },
      );
      this.bar.insertBefore(floor, this.status);
      this.renderer = new MapRenderer(
        this.viewport,
        map.session,
        (reference) => this.plugin.assetUrl(reference),
        (message) => {
          this.status.textContent = message;
        },
        this.compact
          ? {
              background: 0xffffff,
              mapFill: 0xffffff,
              grid: true,
              labels: true,
              compactDetails: true,
              preserveViewOnResize: true,
            }
          : { compactDetails: true },
        (id) => this.plugin.colorableObjectSource(
          id, map.session.settings.assetPacks),
      );
      await this.renderer.init();
      if (this.closed) return;
      this.assetUnsub = this.plugin.subscribeAssets(() => this.renderer?.reloadAssets());
      if (this.focusId && this.focusRoom(this.focusId))
        floor.value = this.renderer.floorId;
      else this.fit();
      this.resize = new ResizeObserver(() => {
        if (
          this.closed ||
          this.sized ||
          this.viewport.clientWidth < 2 ||
          this.viewport.clientHeight < 2
        )
          return;
        this.sized = true;
        if (!this.focusId || !this.focusRoom(this.focusId)) this.fit();
      });
      this.resize.observe(this.viewport);
      this.loaded = true;
      this.status.textContent = "";
    } catch (error) {
      this.status.textContent =
        "Karte konnte nicht geladen werden: " + String(error);
    }
  }
  focus(id: string): void {
    this.focusId = this.resolveFocus(id);
    if (this.focusId) this.focusRoom(this.focusId);
  }
  private resolveFocus(id?: string): string | undefined {
    if (!id || !this.map) return id;
    const direct = this.map.session.entities.get(id);
    if (isRoom(direct)) return direct.id;
    return [...this.map.session.entities.values()].find(
      (entity) =>
        isRoom(entity) &&
        (entity.number === id ||
          (!!this.source && entity.note.path === this.source)),
    )?.id;
  }
  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.abort.abort();
    this.assetUnsub?.();
    this.resize?.disconnect();
    this.renderer?.destroy();
    if (this.map) this.plugin.release(this.path, this.map);
    this.map = undefined;
    this.el.replaceChildren();
  }
}
class DungeonEmbed extends MarkdownRenderChild {
  private card?: DungeonMapCard;
  constructor(
    element: HTMLElement,
    private plugin: DungeonPlugin,
    private path: string,
    private roomId?: string,
  ) {
    super(element);
  }
  onload(): void {
    this.card = this.plugin.createDungeonMap({
      path: this.path,
      focusRoom: this.roomId,
    });
    this.containerEl.replaceChildren(this.card.el);
  }
  onunload(): void {
    this.card?.destroy();
    this.card = undefined;
  }
}
class DungeonPlayView extends ItemView {
  private card?: DungeonMapCard;
  private path?: string;
  private roomId?: string;
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: DungeonPlugin,
  ) {
    super(leaf);
  }
  getViewType(): string {
    return PLAY_VIEW;
  }
  getDisplayText(): string {
    return "Dungeon-Spielansicht";
  }
  getIcon(): string {
    return "map";
  }
  getState(): Record<string, unknown> {
    return { path: this.path, roomId: this.roomId };
  }
  async setState(state: Record<string, unknown>): Promise<void> {
    this.path = typeof state.path === "string" ? state.path : undefined;
    this.roomId = typeof state.roomId === "string" ? state.roomId : undefined;
    if (this.contentEl.isConnected) this.render();
  }
  async onOpen(): Promise<void> {
    this.contentEl.classList.add("dn-play-view");
    this.render();
  }
  private render(): void {
    this.card?.destroy();
    this.card = undefined;
    this.contentEl.replaceChildren();
    if (!this.path) {
      this.contentEl.createEl("p", { text: "Keine Dungeon-Karte gewählt." });
      return;
    }
    this.card = this.plugin.createDungeonMap({
      path: this.path,
      focusRoom: this.roomId,
    });
    this.contentEl.append(this.card.el);
  }
  async onClose(): Promise<void> {
    this.card?.destroy();
    this.card = undefined;
  }
}
class DungeonView extends FileView {
  private editor?: DungeonEditor;
  private current?: OpenMap;
  private mapPath?: string;
  private generation = 0;
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: DungeonPlugin,
  ) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW;
  }
  getDisplayText(): string {
    return this.file?.basename ?? "Dungeon-Karte";
  }
  getIcon(): string {
    return "map";
  }
  async onLoadFile(file: TFile): Promise<void> {
    const generation = ++this.generation;
    this.contentEl.replaceChildren();
    this.contentEl.createEl("p", { text: "Karte wird geöffnet …" });
    try {
      const map = await this.plugin.acquire(file.path);
      await this.plugin.ensureAssets();
      if (generation !== this.generation) {
        this.plugin.release(file.path, map);
        return;
      }
      this.current = map;
      this.mapPath = file.path;
      this.contentEl.replaceChildren();
      this.editor = new DungeonEditor(
        this.contentEl,
        map.session,
        map.repository,
        {
          notice: (m) => new Notice(m),
          openNote: (path) => {
            void this.app.workspace.openLinkText(path, file.path, "split");
          },
          save: () => map.repository.save(map.session),
          assetUrl: (path) => this.plugin.assetUrl(path),
          colorableObjectSource: (id) => this.plugin.colorableObjectSource(
            id, map.session.settings.assetPacks),
          assets: () => this.plugin.listAssets(
            map.session.settings.assetPacks,
            map.session.settings.builtInAssets,
          ),
          subscribeAssets: (listener) => this.plugin.subscribeAssets(listener),
          toolDefaults: () => this.plugin.toolDefaults(),
          persistToolDefaults: () => this.plugin.persistToolDefaults(),
          prefabs: () => this.plugin.prefabs(),
          savePrefab: (prefab) => this.plugin.savePrefab(prefab),
          forgetPrefab: (prefab, doc, signal) =>
            this.plugin.forgetPrefab(prefab, doc, signal),
          requestPrefabDetails: () => new PrefabNameModal(
            this.app, this.plugin.prefabs().map((prefab) => prefab.set),
          ).request(),
          manageAssets: () => this.plugin.openAssets(map.session),
          manageMap: () =>
            new MapSettingsModal(
              this.app,
              map.session,
              file.path,
              this.plugin.assets,
            ).open(),
          manageReferences: (floorId) =>
            new ReferenceImagesModal(
              this.app,
              this.plugin,
              map.session,
              floorId,
            ).open(),
          manageGenerator: (floorId) =>
            new GeneratorModal(this.app, map.session, floorId).open(),
          manageContent: (floorId, selectedId) =>
            new DungeonContentModal(
              this.app,
              map.session,
              map.repository,
              floorId,
              selectedId,
            ).open(),
          openPlay: (roomId) => void this.plugin.openPlay(file.path, roomId),
          exitEditor: () => this.exitEditor(),
        },
      );
      await this.editor.init();
      this.editor.maximize();
    } catch (error) {
      this.contentEl.replaceChildren();
      this.contentEl.createEl("p", {
        text: "Die Karte konnte nicht geöffnet werden: " + String(error),
      });
    }
  }
  async onUnloadFile(): Promise<void> {
    this.generation++;
    if (this.editor) {
      try {
        this.editor.commitNote();
        if (this.current?.session.dirty)
          await this.current.repository.persistDraft(this.current.session);
      } catch (error) {
        new Notice(
          "Entwurf konnte nicht gesichert werden und bleibt in dieser Sitzung erhalten: " +
            String(error),
          10000,
        );
      }
      this.editor.destroy();
      this.editor = undefined;
    }
    if (this.current && this.mapPath)
      this.plugin.release(this.mapPath, this.current);
    this.current = undefined;
    this.mapPath = undefined;
  }
  private exitEditor(): void {
    const play =
      this.app.workspace
        .getLeavesOfType("dnd-play-map")
        .find((candidate) => candidate.parent === this.leaf.parent) ??
      this.app.workspace
        .getLeavesOfType("dnd-play-map")
        .find((candidate) => candidate.view.containerEl.isConnected);
    this.leaf.detach();
    if (play) {
      this.app.workspace.setActiveLeaf(play, { focus: true });
      this.app.workspace.revealLeaf(play);
    }
  }
}
class FeatureDefinitionModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private repository: MapRepository,
    private done: () => void,
    private definition?: FeatureDefinition,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(
      this.definition ? "Feature-Definition bearbeiten" : "Feature definieren",
    );
    this.contentEl.replaceChildren();
    const value: FeatureDefinitionInput = {
      name: this.definition?.name ?? "",
      kind: this.definition?.kind ?? "feature",
      xp: this.definition?.xp ?? 0,
      lootValue: this.definition?.lootValue ?? 0,
      encounter: this.definition?.encounter ?? "",
      description: this.definition?.description ?? "",
      reference: this.definition?.reference ?? "",
      encounterLink: this.definition?.encounterLink ?? "",
    };
    new Setting(this.contentEl)
      .setName("Name")
      .addText((input) =>
        input
          .setValue(value.name)
          .onChange((name) => Object.assign(value, { name })),
      );
    new Setting(this.contentEl).setName("Art").addDropdown((dropdown) =>
      dropdown
        .addOption("feature", "Feature")
        .addOption("creature", "Kreatur")
        .addOption("loot", "Beute")
        .addOption("trap", "Falle")
        .setValue(value.kind)
        .onChange((kind) =>
          Object.assign(value, { kind: kind as FeatureKind }),
        ),
    );
    for (const [name, key] of [
      ["XP je Vorkommen", "xp"],
      ["Beutewert je Vorkommen", "lootValue"],
    ] as const)
      new Setting(this.contentEl)
        .setName(name)
        .addText((input) =>
          input
            .setValue(String(value[key]))
            .onChange((text) => Object.assign(value, { [key]: Number(text) })),
        );
    new Setting(this.contentEl)
      .setName("Beschreibung")
      .setDesc("Erscheint als Fließtext im Raum-Key.")
      .addTextArea((input) =>
        input
          .setValue(value.description ?? "")
          .onChange((description) => Object.assign(value, { description })),
      );
    new Setting(this.contentEl)
      .setName("Encounter")
      .setDesc(
        "Gleicher Name fasst mehrere Definitionen zu einem Encounter zusammen.",
      )
      .addText((input) =>
        input
          .setValue(value.encounter ?? "")
          .onChange((encounter) => Object.assign(value, { encounter })),
      );
    new Setting(this.contentEl)
      .setName("Encounter-Link")
      .setDesc("Wiki-Link oder URL zur Encounter-Auswertung.")
      .addText((input) =>
        input
          .setValue(value.encounterLink ?? "")
          .onChange((encounterLink) => Object.assign(value, { encounterLink })),
      );
    new Setting(this.contentEl)
      .setName("Regel- oder Profilverweis")
      .setDesc("Wiki-Link oder URL zu ausführlichen Regeln.")
      .addText((input) =>
        input
          .setValue(value.reference ?? "")
          .onChange((reference) => Object.assign(value, { reference })),
      );
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Übernehmen")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            if (this.definition) {
              const paths = new Set(
                this.session.content.occurrences
                  .filter((value) => value.definitionId === this.definition!.id)
                  .map((value) => value.note.path),
              );
              for (const path of paths)
                if (this.session.note(path) === undefined)
                  await this.repository.loadNote(this.session, path);
              updateFeatureDefinition(this.session, this.definition.id, value);
            } else createFeatureDefinition(this.session, value);
            this.done();
            this.close();
          } catch (error) {
            new Notice(String(error));
            button.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class FeatureOccurrenceModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private repository: MapRepository,
    private floorId: string,
    private done: () => void,
    private selectedId?: string,
    private initialDefinitionId?: string,
    private occurrence?: FeatureOccurrence,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(
      this.occurrence
        ? "Feature-Vorkommen bearbeiten"
        : "Feature-Vorkommen anlegen",
    );
    this.contentEl.replaceChildren();
    const definitions = this.session.content.definitions,
      rooms = [...this.session.entities.values()].filter(
        (entity): entity is Room =>
          isRoom(entity) &&
          (entity.floorId === this.floorId ||
            entity.id === this.occurrence?.roomId),
      ),
      selected = this.selectedId
        ? this.session.entities.get(this.selectedId)
        : undefined,
      selectedRoomId =
        isRoom(selected) ? selected.id : selected?.roomId,
      value = {
        definitionId:
          this.occurrence?.definitionId ??
          this.initialDefinitionId ??
          definitions[0]?.id ??
          "",
        roomId:
          this.occurrence?.roomId ??
          (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)
            ? selectedRoomId
            : rooms[0]?.id) ??
          "",
        quantity: this.occurrence?.quantity ?? 1,
        situation: this.occurrence?.situation ?? "",
        reaction: this.occurrence?.reaction ?? "",
      };
    if (!definitions.length || !rooms.length) {
      this.contentEl.createEl("p", {
        text: !definitions.length
          ? "Zuerst eine Feature-Definition anlegen."
          : "Auf diesem Geschoss gibt es noch keinen Raum.",
      });
      return;
    }
    new Setting(this.contentEl)
      .setName("Definition")
      .addDropdown((dropdown) => {
        for (const definition of definitions)
          dropdown.addOption(definition.id, definition.name);
        dropdown
          .setValue(value.definitionId)
          .setDisabled(!!this.occurrence)
          .onChange((definitionId) => {
            value.definitionId = definitionId;
          });
      });
    new Setting(this.contentEl).setName("Fundort").addDropdown((dropdown) => {
      for (const room of rooms)
        dropdown.addOption(room.id, `${room.number} ${room.name}`);
      dropdown
        .setValue(value.roomId)
        .setDisabled(!!this.occurrence)
        .onChange((roomId) => {
          value.roomId = roomId;
        });
    });
    new Setting(this.contentEl).setName("Menge").addText((input) =>
      input.setValue(String(value.quantity)).onChange((quantity) => {
        value.quantity = Number(quantity);
      }),
    );
    new Setting(this.contentEl)
      .setName("Aktuelle Situation")
      .setDesc("Kurzer, auswertungsrelevanter Zustand im Raum.")
      .addTextArea((input) =>
        input.setValue(value.situation).onChange((situation) => {
          value.situation = situation;
        }),
      );
    new Setting(this.contentEl)
      .setName("Reaktion")
      .setDesc("Kurze Reaktion auf die Gruppe oder eine Auslösung.")
      .addTextArea((input) =>
        input.setValue(value.reaction).onChange((reaction) => {
          value.reaction = reaction;
        }),
      );
    this.contentEl.createEl("p", {
      text: "Der Editor ergänzt im Raum-Key eine neue Überschrift und erzeugt einen nummerierten Marker. Ist bereits ein passendes Kartenobjekt ausgewählt, wird es stattdessen verknüpft.",
    });
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText(this.occurrence ? "Übernehmen" : "Vorkommen anlegen")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const room = this.session.entities.get(value.roomId);
            if (!isRoom(room)) throw new Error("Raum nicht gefunden.");
            if (this.session.note(room.note.path) === undefined)
              await this.repository.loadNote(this.session, room.note.path);
            if (this.occurrence)
              updateFeatureOccurrence(this.session, this.occurrence.id, {
                quantity: value.quantity,
                situation: value.situation,
                reaction: value.reaction,
              });
            else {
              const currentSelection = this.selectedId
                  ? this.session.entities.get(this.selectedId)
                  : undefined,
                linkedId =
                  currentSelection &&
                  !isRoom(currentSelection) &&
                  currentSelection.roomId === room.id
                    ? currentSelection.id
                    : undefined;
              createFeatureOccurrence(
                this.session,
                value.definitionId,
                value.roomId,
                value.quantity,
                linkedId,
                { situation: value.situation, reaction: value.reaction },
              );
            }
            this.done();
            this.close();
          } catch (error) {
            new Notice(String(error));
            button.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class DungeonRouteModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private done: () => void,
    private route?: DungeonRoute,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(
      this.route ? "Weg bearbeiten" : "Eingang oder Weg anlegen",
    );
    this.contentEl.replaceChildren();
    const rooms = [...this.session.entities.values()].filter(
        (entity): entity is Room => isRoom(entity),
      ),
      value: {
        name: string;
        entrance: boolean;
        fromRoomId?: string;
        toRoomId: string;
        prerequisites: string[];
        bossGoalOrder?: number;
      } = {
        name: this.route?.name ?? "",
        entrance: this.route?.entrance ?? true,
        fromRoomId: this.route?.fromRoomId,
        toRoomId: this.route?.toRoomId ?? rooms[0]?.id ?? "",
        prerequisites: [...(this.route?.prerequisites ?? [])],
        bossGoalOrder: this.route?.bossGoalOrder,
      };
    if (!rooms.length) {
      this.contentEl.createEl("p", {
        text: "Zuerst mindestens einen Raum anlegen.",
      });
      return;
    }
    new Setting(this.contentEl)
      .setName("Name")
      .addText((input) =>
        input.setValue(value.name).onChange((name) => (value.name = name)),
      );
    new Setting(this.contentEl)
      .setName("Eingang von außerhalb")
      .addToggle((toggle) =>
        toggle.setValue(value.entrance).onChange((entrance) => {
          value.entrance = entrance;
          if (entrance) value.fromRoomId = undefined;
        }),
      );
    new Setting(this.contentEl)
      .setName("Von")
      .setDesc("Bei einem Eingang kann dieser Wert leer bleiben.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "Außerhalb");
        for (const room of rooms)
          dropdown.addOption(room.id, `${room.number} ${room.name}`);
        dropdown.setValue(value.fromRoomId ?? "").onChange((fromRoomId) => {
          value.fromRoomId = fromRoomId || undefined;
          value.entrance = !fromRoomId;
        });
      });
    new Setting(this.contentEl).setName("Nach").addDropdown((dropdown) => {
      for (const room of rooms)
        dropdown.addOption(room.id, `${room.number} ${room.name}`);
      dropdown.setValue(value.toRoomId).onChange((toRoomId) => {
        value.toRoomId = toRoomId;
      });
    });
    new Setting(this.contentEl)
      .setName("Voraussetzungen")
      .setDesc("Eine Voraussetzung pro Zeile.")
      .addTextArea((input) =>
        input
          .setValue(value.prerequisites.join("\n"))
          .onChange((text) => (value.prerequisites = text.split(/\r?\n/))),
      );
    new Setting(this.contentEl)
      .setName("Bossziel-Reihenfolge")
      .setDesc("Leer lassen, wenn dieser Weg kein geordnetes Bossziel ist.")
      .addText((input) =>
        input
          .setValue(value.bossGoalOrder ? String(value.bossGoalOrder) : "")
          .onChange((text) => {
            value.bossGoalOrder = text.trim() ? Number(text) : undefined;
          }),
      );
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Übernehmen")
        .setCta()
        .onClick(() => {
          try {
            const route = {
              name: value.name,
              entrance: value.entrance,
              ...(value.fromRoomId ? { fromRoomId: value.fromRoomId } : {}),
              toRoomId: value.toRoomId,
              prerequisites: value.prerequisites,
              ...(value.bossGoalOrder
                ? { bossGoalOrder: value.bossGoalOrder }
                : {}),
            };
            if (this.route) updateRoute(this.session, this.route.id, route);
            else createRoute(this.session, route);
            this.done();
            this.close();
          } catch (error) {
            new Notice(String(error));
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class DungeonContentModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private repository: MapRepository,
    private floorId: string,
    private selectedId?: string,
  ) {
    super(app);
  }
  onOpen(): void {
    this.render();
  }
  private render(): void {
    this.titleEl.setText("Dungeon-Inhalte");
    this.contentEl.replaceChildren();
    const content = this.session.content,
      analysis = analyzeDungeon(content),
      roomNames = new Map(
        [...this.session.entities.values()]
          .filter(isRoom)
          .map((room) => [room.id, `${room.number} ${room.name}`]),
      ),
      definitionNames = new Map(
        content.definitions.map((definition) => [
          definition.id,
          definition.name,
        ]),
      ),
      refresh = () => this.render();
    this.contentEl.createEl("p", {
      text:
        `${analysis.definitions.toLocaleString("de-DE")} Definitionen · ` +
        `${analysis.occurrences.toLocaleString("de-DE")} Vorkommen · ` +
        `${analysis.totalQuantity.toLocaleString("de-DE")} Gesamtmenge · ` +
        `${analysis.xp.toLocaleString("de-DE")} XP · ` +
        `${analysis.lootValue.toLocaleString("de-DE")} Beutewert`,
    });
    if (analysis.encounters.length)
      this.contentEl.createEl("p", {
        text:
          "Encounter: " +
          analysis.encounters
            .map(
              (encounter) =>
                `${encounter.name} (${encounter.quantity}×, ${encounter.xp.toLocaleString("de-DE")} XP)`,
            )
            .join(" · "),
      });
    if (analysis.bossGoals.length)
      this.contentEl.createEl("p", {
        text:
          "Bossziele: " +
          analysis.bossGoals
            .map((route) => `${route.bossGoalOrder}. ${route.name}`)
            .join(" → "),
      });
    const actions = new Setting(this.contentEl);
    actions.addButton((button) =>
      button
        .setButtonText("Definition anlegen")
        .setCta()
        .onClick(() =>
          new FeatureDefinitionModal(
            this.app,
            this.session,
            this.repository,
            refresh,
          ).open(),
        ),
    );
    actions.addButton((button) =>
      button
        .setButtonText("Vorkommen anlegen")
        .onClick(() =>
          new FeatureOccurrenceModal(
            this.app,
            this.session,
            this.repository,
            this.floorId,
            refresh,
            this.selectedId,
          ).open(),
        ),
    );
    actions.addButton((button) =>
      button
        .setButtonText("Eingang oder Weg")
        .onClick(() =>
          new DungeonRouteModal(this.app, this.session, refresh).open(),
        ),
    );
    this.contentEl.createEl("h3", { text: "Definitionen" });
    if (!content.definitions.length)
      this.contentEl.createEl("p", { text: "Noch keine Definitionen." });
    for (const definition of content.definitions) {
      const count = content.occurrences.filter(
          (occurrence) => occurrence.definitionId === definition.id,
        ).length,
        row = new Setting(this.contentEl)
          .setName(definition.name)
          .setDesc(
            `${definition.kind} · ${count} Vorkommen · ${definition.xp.toLocaleString("de-DE")} XP · ${definition.lootValue.toLocaleString("de-DE")} Beute` +
              (definition.encounter ? ` · ${definition.encounter}` : ""),
          );
      row.addExtraButton((button) => {
        button
          .setIcon("plus")
          .setTooltip("Vorkommen anlegen")
          .onClick(() =>
            new FeatureOccurrenceModal(
              this.app,
              this.session,
              this.repository,
              this.floorId,
              refresh,
              this.selectedId,
              definition.id,
            ).open(),
          );
        button.extraSettingsEl.setAttribute("aria-label", "Vorkommen anlegen");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("pencil")
          .setTooltip("Definition bearbeiten")
          .onClick(() =>
            new FeatureDefinitionModal(
              this.app,
              this.session,
              this.repository,
              refresh,
              definition,
            ).open(),
          );
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Definition bearbeiten",
        );
      });
      row.addExtraButton((button) => {
        button
          .setIcon("archive")
          .setTooltip("Definition und Vorkommen archivieren")
          .onClick(() => {
            try {
              archiveDefinition(this.session, definition.id);
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          });
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Definition und Vorkommen archivieren",
        );
      });
    }
    this.contentEl.createEl("h3", { text: "Vorkommen" });
    if (!content.occurrences.length)
      this.contentEl.createEl("p", { text: "Noch keine Vorkommen." });
    for (const occurrence of content.occurrences) {
      const row = new Setting(this.contentEl)
        .setName(
          `${occurrence.marker} · ${definitionNames.get(occurrence.definitionId) ?? "Unbekannt"}`,
        )
        .setDesc(
          `${roomNames.get(occurrence.roomId) ?? occurrence.roomId} · Menge ${occurrence.quantity}`,
        );
      row.addExtraButton((button) => {
        button
          .setIcon("pencil")
          .setTooltip("Vorkommen bearbeiten")
          .onClick(() =>
            new FeatureOccurrenceModal(
              this.app,
              this.session,
              this.repository,
              this.floorId,
              refresh,
              this.selectedId,
              occurrence.definitionId,
              occurrence,
            ).open(),
          );
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Vorkommen bearbeiten",
        );
      });
      row.addExtraButton((button) => {
        button
          .setIcon("minus")
          .setTooltip("Menge verringern")
          .setDisabled(occurrence.quantity <= 1)
          .onClick(async () => {
            try {
              if (this.session.note(occurrence.note.path) === undefined)
                await this.repository.loadNote(
                  this.session,
                  occurrence.note.path,
                );
              updateFeatureQuantity(
                this.session,
                occurrence.id,
                occurrence.quantity - 1,
              );
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          });
        button.extraSettingsEl.setAttribute("aria-label", "Menge verringern");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("plus")
          .setTooltip("Menge erhöhen")
          .onClick(async () => {
            try {
              if (this.session.note(occurrence.note.path) === undefined)
                await this.repository.loadNote(
                  this.session,
                  occurrence.note.path,
                );
              updateFeatureQuantity(
                this.session,
                occurrence.id,
                occurrence.quantity + 1,
              );
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          });
        button.extraSettingsEl.setAttribute("aria-label", "Menge erhöhen");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("archive")
          .setTooltip("Vorkommen archivieren")
          .onClick(() => {
            archiveOccurrence(this.session, occurrence.id);
            refresh();
          });
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Vorkommen archivieren",
        );
      });
    }
    this.contentEl.createEl("h3", { text: "Eingänge, Wege und Bossziele" });
    if (!content.routes.length)
      this.contentEl.createEl("p", { text: "Noch keine Eingänge oder Wege." });
    for (const route of content.routes) {
      const from = route.entrance
          ? "Außerhalb"
          : (roomNames.get(route.fromRoomId!) ?? route.fromRoomId),
        desc =
          `${from} → ${roomNames.get(route.toRoomId) ?? route.toRoomId}` +
          (route.prerequisites.length
            ? ` · Voraussetzungen: ${route.prerequisites.join(", ")}`
            : "") +
          (route.bossGoalOrder ? ` · Bossziel ${route.bossGoalOrder}` : ""),
        row = new Setting(this.contentEl).setName(route.name).setDesc(desc);
      row.addExtraButton((button) => {
        button
          .setIcon("pencil")
          .setTooltip("Weg bearbeiten")
          .onClick(() =>
            new DungeonRouteModal(
              this.app,
              this.session,
              refresh,
              route,
            ).open(),
          );
        button.extraSettingsEl.setAttribute("aria-label", "Weg bearbeiten");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("archive")
          .setTooltip("Weg archivieren")
          .onClick(() => {
            archiveRoute(this.session, route.id);
            refresh();
          });
        button.extraSettingsEl.setAttribute("aria-label", "Weg archivieren");
      });
    }
    this.contentEl.createEl("h3", { text: "Archiv" });
    if (!content.archive.length)
      this.contentEl.createEl("p", { text: "Das Archiv ist leer." });
    for (const bundle of content.archive)
      new Setting(this.contentEl)
        .setName(bundle.label)
        .setDesc(
          `${bundle.floors.length} Geschosse · ${bundle.definitions.length} Definitionen · ${bundle.occurrences.length} Vorkommen · ${bundle.routes.length} Wege · ${bundle.entities.length} Kartenobjekte`,
        )
        .addButton((button) =>
          button.setButtonText("Wiederherstellen").onClick(() => {
            try {
              restoreArchive(this.session, bundle.id);
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          }),
        );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class GeneratorModal extends Modal {
  private proposal: string[] = [];
  constructor(
    app: App,
    private session: Session,
    private floorId: string,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText("Kartenassistent");
    this.contentEl.replaceChildren();
    const options: { kind: GeneratorKind; seed: number; amount: number } = {
      kind: "dungeon",
      seed: 1,
      amount: 12,
    };
    this.contentEl.createEl("p", {
      text: "Ein Vorschlag bleibt vollständig bearbeitbar. Neu generieren ersetzt nur den Vorschlag aus diesem geöffneten Assistenten.",
    });
    new Setting(this.contentEl)
      .setName("Generatorart")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("dungeon", "Dungeon")
          .addOption("cave", "Höhle")
          .onChange((value) => (options.kind = value as GeneratorKind)),
      );
    new Setting(this.contentEl).setName("Startwert").addText((input) =>
      input.setValue(String(options.seed)).onChange((value) => {
        options.seed = Number(value);
      }),
    );
    new Setting(this.contentEl)
      .setName("Räume oder Formdetails")
      .addText((input) =>
        input.setValue(String(options.amount)).onChange((value) => {
          options.amount = Number(value);
        }),
      );
    const actions = new Setting(this.contentEl);
    let generateButton!: ButtonComponent;
    actions.addButton((button) => {
      generateButton = button;
      button
        .setButtonText("Generieren")
        .setCta()
        .onClick(() => {
          try {
            const result = generateLayout(
              this.session,
              this.floorId,
              options,
              this.proposal,
            );
            this.proposal = result.map((entity) => entity.id);
            generateButton.setButtonText("Neu generieren");
          } catch (error) {
            new Notice(String(error));
          }
        });
    });
    actions.addButton((button) =>
      button.setButtonText("Fertigstellen").onClick(() => this.close()),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class ReferenceImagesModal extends Modal {
  constructor(
    app: App,
    private plugin: DungeonPlugin,
    private session: Session,
    private floorId: string,
  ) {
    super(app);
  }
  onOpen(): void {
    this.render();
  }
  private render(): void {
    this.titleEl.setText("Nachzeichenvorlagen");
    this.contentEl.replaceChildren();
    this.contentEl.createEl("p", {
      text: "Vorlagen liegen unter der Karte und lassen sich nach dem Import auswählen, verschieben, skalieren, drehen und ausblenden.",
    });
    const input = this.contentEl.createEl("input", {
      attr: { type: "file", accept: ".png,.jpg,.jpeg,.webp,image/*" },
      cls: "dn-hidden-input",
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      void this.plugin
        .importReference(this.session, this.floorId, file)
        .then(() => {
          new Notice("Nachzeichenvorlage geladen.");
          this.render();
        })
        .catch((error) => new Notice(String(error), 10000));
    });
    new Setting(this.contentEl)
      .setName("Bild laden")
      .setDesc(
        "PNG, JPEG oder WebP; die Datei wird einmal im Vault gespeichert.",
      )
      .addButton((button) =>
        button
          .setButtonText("Bild wählen")
          .setCta()
          .onClick(() => input.click()),
      );
    const images = [...this.session.entities.values()].filter(
      (entity): entity is ReferenceImage =>
        entity.kind === "reference" && entity.floorId === this.floorId,
    );
    if (!images.length)
      this.contentEl.createEl("p", {
        text: "Auf diesem Geschoss ist noch keine Vorlage geladen.",
      });
    for (const image of images) {
      const row = new Setting(this.contentEl)
        .setName(image.name)
        .setDesc(
          image.width.toLocaleString("de-DE") +
            " × " +
            image.height.toLocaleString("de-DE") +
            " Felder",
        );
      row.addToggle((toggle) =>
        toggle.setValue(image.visible).onChange((visible) => {
          const current = this.session.entities.get(image.id);
          if (current?.kind !== "reference") return;
          this.session.execute({
            label: "Nachzeichenvorlage ein-/ausblenden",
            entities: [
              {
                id: current.id,
                before: current,
                after: { ...current, visible },
              },
            ],
          });
        }),
      );
      row.addExtraButton((button) =>
        button
          .setIcon("scan")
          .setTooltip("Auf Karte zentrieren")
          .onClick(() => {
            const current = this.session.entities.get(image.id);
            if (current?.kind !== "reference") return;
            this.session.execute({
              label: "Nachzeichenvorlage zentrieren",
              entities: [
                {
                  id: current.id,
                  before: current,
                  after: {
                    ...current,
                    x: this.session.settings.width / 2,
                    y: this.session.settings.height / 2,
                  },
                },
              ],
            });
          }),
      );
      row.addExtraButton((button) =>
        button
          .setIcon("trash-2")
          .setTooltip("Vorlage entfernen")
          .onClick(() => {
            const current = this.session.entities.get(image.id);
            if (current?.kind !== "reference") return;
            this.session.execute({
              label: "Nachzeichenvorlage entfernen",
              entities: [{ id: current.id, before: current, after: null }],
            });
            this.render();
          }),
      );
    }
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class MapSettingsModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private session: Session,
    private path: string,
    private catalog: AssetCatalog,
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    this.titleEl.setText("Kartengröße ändern");
    this.contentEl.replaceChildren();
    const current = this.session.settings;
    this.contentEl.createEl("p", { text: "Datei: " + this.path });
    const packageInfo = this.contentEl.createEl("p", {
      text: "Verwendete Pakete werden gelesen …",
    });
    try {
      const data = await this.catalog.read();
      if (generation !== this.generation) return;
      const selected = new Set(current.assetPacks ?? []),
        names = data.packs
          .filter((record) => selected.has(record.metadata.id))
          .map((record) => record.metadata.name);
      packageInfo.setText(
        "Verwendete Pakete: " + (names.length ? names.join(", ") : "keine"),
      );
    } catch (error) {
      packageInfo.setText(
        "Verwendete Pakete konnten nicht gelesen werden: " + String(error),
      );
    }
    if (generation !== this.generation) return;
    let wallShadows: ToggleComponent | undefined,
      objectShadows: ToggleComponent | undefined,
      buildingWear: SliderComponent | undefined;
    new Setting(this.contentEl).setName("Wandschatten").addToggle((toggle) => {
      wallShadows = toggle.setValue(current.wallShadows);
    });
    new Setting(this.contentEl)
      .setName("Objektschatten")
      .addToggle((toggle) => {
        objectShadows = toggle.setValue(current.objectShadows);
      });
    new Setting(this.contentEl)
      .setName("Gebäudeabnutzung")
      .addSlider((slider) => {
        buildingWear = slider
          .setLimits(0, 100, 5)
          .setValue(current.buildingWear * 100)
          .setDynamicTooltip();
      });
    const margins: { -readonly [Key in keyof MapMargins]: number } = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
      labels: readonly [keyof MapMargins, string][] = [
        ["top", "Oben"],
        ["right", "Rechts"],
        ["bottom", "Unten"],
        ["left", "Links"],
      ];
    this.contentEl.createEl("p", {
      text:
        "Aktuell " +
        current.width.toLocaleString("de-DE") +
        " × " +
        current.height.toLocaleString("de-DE") +
        " Felder. Positive Werte erweitern, negative schneiden den sichtbaren Rand ab.",
    });
    const result = this.contentEl.createEl("p");
    const update = () => {
      const width = current.width + margins.left + margins.right,
        height = current.height + margins.top + margins.bottom;
      result.setText(
        "Neue Größe: " +
          width.toLocaleString("de-DE") +
          " × " +
          height.toLocaleString("de-DE") +
          " Felder",
      );
    };
    for (const [key, label] of labels)
      new Setting(this.contentEl)
        .setName(label + " in Feldern")
        .addText((input) =>
          input
            .setValue("0")
            .setPlaceholder("0")
            .onChange((value) => {
              margins[key] = Number(value);
              update();
            }),
        );
    update();
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Übernehmen")
        .setCta()
        .onClick(() => {
          try {
            resizeMap(this.session, margins, {
              wallShadows: wallShadows?.getValue() ?? current.wallShadows,
              objectShadows: objectShadows?.getValue() ?? current.objectShadows,
              buildingWear:
                (buildingWear?.getValue() ?? current.buildingWear * 100) / 100,
            });
            this.close();
          } catch (error) {
            new Notice(String(error));
          }
        }),
    );
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
}
class AssetPackagesModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private catalog: AssetCatalog,
    private changed: () => Promise<void>,
    private session?: Session,
    private nativeArchive?: {
      status(): { path?: string; count: number; error?: string };
      choose(path: string): Promise<void>;
    },
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    this.titleEl.setText("Assetpakete");
    this.contentEl.replaceChildren();
    this.contentEl.createEl("p", {
      text: "Pakete werden einmal im Vault gespeichert. Bilder lädt der Editor erst bei Bedarf.",
    });
    const loading = this.contentEl.createEl("p", {
      text: "Katalog wird gelesen …",
    });
    try {
      const data = await this.catalog.read();
      if (generation !== this.generation) return;
      loading.remove();
      const mapPacks = new Set(
          this.session?.settings.assetPacks ??
            data.packs
              .filter((record) => record.enabled)
              .map((record) => record.metadata.id),
        ),
        mapBuiltIns = this.session?.settings.builtInAssets ?? data.builtIns,
        updateMap = (
          patch: Partial<
            Pick<import("./model").Settings, "assetPacks" | "builtInAssets">
          >,
        ) => {
          if (!this.session) return;
          const before = this.session.settings,
            after = { ...before, ...patch };
          if (JSON.stringify(before) === JSON.stringify(after)) return;
          this.session.execute({
            label: "Kartenassets ändern",
            settings: { before, after },
          });
        };
      new Setting(this.contentEl)
        .setName(
          this.session ? "Grundformen dieser Karte" : "Eingebaute Grundassets",
        )
        .setDesc(
          "Einfache lesbare Formen bleiben verfügbar, auch wenn kein Paket aktiv ist.",
        )
        .addToggle((toggle) =>
          toggle.setValue(mapBuiltIns).onChange(async (value) => {
            try {
              if (this.session) updateMap({ builtInAssets: value });
              else {
                await this.catalog.setBuiltIns(value);
                await this.changed();
              }
            } catch (error) {
              new Notice(String(error));
              void this.render();
            }
          }),
        );
      if (this.nativeArchive) {
        const status = this.nativeArchive.status();
        const nativeInput = this.contentEl.createEl("input", {
          attr: { type: "file", accept: ".pck" },
          cls: "dn-hidden-input",
        });
        nativeInput.addEventListener("change", () => {
          const selected = nativeInput.files?.[0] as
            | (File & { path?: string }) | undefined;
          nativeInput.value = "";
          if (!selected) return;
          if (!selected.path) {
            new Notice("Der Dateipfad konnte nicht gelesen werden.");
            return;
          }
          void this.nativeArchive!.choose(selected.path)
            .then(() => {
              new Notice("Dungeondraft-Pfadassets geladen.");
              return this.render();
            })
            .catch((error) => new Notice(String(error), 10000));
        });
        const sourceName = status.path?.split(/[\\/]/).at(-1);
        new Setting(this.contentEl)
          .setName("Dungeondraft-Originalassets")
          .setDesc(status.error ?? (sourceName
            ? `${sourceName}: ${status.count} Pfadtexturen verfügbar.`
            : "Originaldatei von Dungeondraft 1.2.0.1 auswählen; sie bleibt an ihrem Ort."))
          .addButton((button) => button
            .setButtonText("Originaldatei wählen")
            .onClick(() => nativeInput.click()));
      }
      const input = this.contentEl.createEl("input", {
        attr: { type: "file", accept: ".dungeondraft_pack", multiple: "" },
        cls: "dn-hidden-input",
      });
      input.addEventListener("change", () => {
        const files = [...(input.files ?? [])];
        if (!files.length) return;
        input.value = "";
        void this.catalog
          .add(files)
          .then(async (records) => {
            new Notice(records.length + " Assetpaket(e) übernommen.");
            await this.changed();
            if (this.session)
              updateMap({
                assetPacks: [
                  ...new Set([
                    ...mapPacks,
                    ...records.map((record) => record.metadata.id),
                  ]),
                ],
              });
            return this.render();
          })
          .catch((error) => new Notice(String(error), 10000));
      });
      new Setting(this.contentEl)
        .setName("Dungeondraft-Pakete importieren")
        .setDesc(
          "Nur Pakete mit ausdrücklicher Freigabe für andere Kartenprogramme.",
        )
        .addButton((button) =>
          button
            .setButtonText("Pakete wählen")
            .setCta()
            .onClick(() => input.click()),
        );
      let search = "";
      const packageRows: {
          record: (typeof data.packs)[number];
          element: HTMLElement;
        }[] = [],
        applySearch = () => {
          const query = search.trim().toLocaleLowerCase("de");
          for (const row of packageRows)
            row.element.toggleAttribute(
              "hidden",
              !!query &&
                !`${row.record.metadata.name} ${row.record.metadata.author ?? ""}`
                  .toLocaleLowerCase("de")
                  .includes(query),
            );
        };
      new Setting(this.contentEl).setName("Pakete suchen").addText((field) => {
        field.inputEl.type = "search";
        field.setPlaceholder("Name oder Autor").onChange((value) => {
          search = value;
          applySearch();
        });
      });
      const list = this.contentEl.createDiv("dn-pack-list");
      if (!data.packs.length)
        list.createEl("p", { text: "Noch keine Pakete importiert." });
      for (const record of data.packs) {
        const row = new Setting(list)
          .setName(record.metadata.name)
          .setDesc(
            record.assetCount.toLocaleString("de-DE") +
              " Assets · " +
              (record.metadata.author ?? "Autor nicht angegeben"),
          );
        packageRows.push({ record, element: row.settingEl });
        row.addToggle((toggle) =>
          toggle
            .setValue(
              this.session ? mapPacks.has(record.metadata.id) : record.enabled,
            )
            .onChange(async (enabled) => {
              try {
                if (this.session) {
                  if (enabled) mapPacks.add(record.metadata.id);
                  else mapPacks.delete(record.metadata.id);
                  updateMap({ assetPacks: [...mapPacks] });
                } else {
                  await this.catalog.setEnabled(record.metadata.id, enabled);
                  await this.changed();
                }
              } catch (error) {
                new Notice(String(error));
                void this.render();
              }
            }),
        );
        row.addExtraButton((button) =>
          button
            .setIcon("trash-2")
            .setTooltip("Paket entfernen")
            .onClick(() => {
              void this.catalog
                .remove(record.metadata.id)
                .then(async () => {
                  await this.changed();
                  return this.render();
                })
                .catch((error) => new Notice(String(error), 10000));
            }),
        );
      }
    } catch (error) {
      loading.setText("Katalog konnte nicht gelesen werden: " + String(error));
    }
  }
}
class CreateDungeonModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private plugin: DungeonPlugin,
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation,
      catalog = await this.plugin.assets.read();
    if (generation !== this.generation) return;
    this.titleEl.setText("Dungeon anlegen");
    this.contentEl.replaceChildren();
    let name = "",
      width = 80,
      height = 60,
      presetName = "",
      selectedPreset = "",
      builtInAssets = catalog.builtIns,
      wallShadows = true,
      objectShadows = true,
      buildingWear = 0,
      startKind: GeneratorKind | "empty" = "empty",
      generatorSeed = 1,
      generatorAmount = 12;
    const assetPacks = new Set(
        catalog.packs
          .filter((record) => record.enabled)
          .map((record) => record.metadata.id),
      ),
      presets = [...this.plugin.sizePresets()];
    this.contentEl.createEl("p", {
      text: "Neue Karte mit verknüpften Raum-Keys. 1 Feld entspricht 5 Fuß.",
    });
    new Setting(this.contentEl)
      .setName("Name")
      .addText((t) =>
        t.setPlaceholder("Name des Dungeons").onChange((v) => (name = v)),
      );
    let widthInput!: HTMLInputElement, heightInput!: HTMLInputElement;
    new Setting(this.contentEl)
      .setName("Breite in Feldern")
      .addText((t) =>
        t.setValue(String(width)).onChange((v) => (width = Number(v))),
      );
    widthInput = this.contentEl.querySelectorAll<HTMLInputElement>(
      ".setting-item input",
    )[1]!;
    new Setting(this.contentEl)
      .setName("Höhe in Feldern")
      .addText((t) =>
        t.setValue(String(height)).onChange((v) => (height = Number(v))),
      );
    heightInput = this.contentEl.querySelectorAll<HTMLInputElement>(
      ".setting-item input",
    )[2]!;
    const presetSetting = new Setting(this.contentEl).setName("Größenvorlage");
    presetSetting.addDropdown((dropdown) => {
      dropdown.addOption("", "Freie Größe");
      for (const preset of presets)
        dropdown.addOption(
          preset.name,
          preset.name + " (" + preset.width + " × " + preset.height + ")",
        );
      dropdown.onChange((value) => {
        selectedPreset = value;
        const preset = presets.find((candidate) => candidate.name === value);
        if (!preset) return;
        width = preset.width;
        height = preset.height;
        widthInput.value = String(width);
        heightInput.value = String(height);
      });
    });
    presetSetting.addExtraButton((button) =>
      button
        .setIcon("trash-2")
        .setTooltip("Gewählte Vorlage löschen")
        .onClick(async () => {
          if (!selectedPreset) return;
          await this.plugin.removeSizePreset(selectedPreset);
          void this.render();
        }),
    );
    new Setting(this.contentEl)
      .setName("Aktuelle Größe als Vorlage")
      .addText((input) =>
        input
          .setPlaceholder("Vorlagenname")
          .onChange((value) => (presetName = value)),
      )
      .addButton((button) =>
        button.setButtonText("Merken").onClick(async () => {
          try {
            await this.plugin.saveSizePreset(presetName, width, height);
            new Notice("Größenvorlage gespeichert.");
            void this.render();
          } catch (error) {
            new Notice(String(error));
          }
        }),
      );
    new Setting(this.contentEl)
      .setName("Eingebaute Grundassets")
      .addToggle((toggle) =>
        toggle
          .setValue(builtInAssets)
          .onChange((value) => (builtInAssets = value)),
      );
    new Setting(this.contentEl)
      .setName("Wandschatten")
      .addToggle((toggle) =>
        toggle.setValue(wallShadows).onChange((value) => (wallShadows = value)),
      );
    new Setting(this.contentEl)
      .setName("Objektschatten")
      .addToggle((toggle) =>
        toggle
          .setValue(objectShadows)
          .onChange((value) => (objectShadows = value)),
      );
    new Setting(this.contentEl)
      .setName("Gebäudeabnutzung")
      .setDesc("0 ist sauber, 100 deutlich verwittert.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(0)
          .setDynamicTooltip()
          .onChange((value) => (buildingWear = value / 100)),
      );
    new Setting(this.contentEl)
      .setName("Startinhalt")
      .setDesc("Der Vorschlag ist nach dem Anlegen normal bearbeitbar.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("empty", "Leere Karte")
          .addOption("dungeon", "Dungeonvorschlag")
          .addOption("cave", "Höhlenvorschlag")
          .onChange((value) => (startKind = value as typeof startKind)),
      );
    new Setting(this.contentEl)
      .setName("Generator-Startwert")
      .addText((input) =>
        input.setValue(String(generatorSeed)).onChange((value) => {
          generatorSeed = Number(value);
        }),
      );
    new Setting(this.contentEl)
      .setName("Generator-Räume oder Formdetails")
      .addText((input) =>
        input.setValue(String(generatorAmount)).onChange((value) => {
          generatorAmount = Number(value);
        }),
      );
    if (catalog.packs.length) {
      this.contentEl.createEl("h3", { text: "Assetpakete dieser Karte" });
      for (const record of catalog.packs)
        new Setting(this.contentEl)
          .setName(record.metadata.name)
          .setDesc(record.metadata.author ?? "Autor nicht angegeben")
          .addToggle((toggle) =>
            toggle
              .setValue(assetPacks.has(record.metadata.id))
              .onChange((enabled) => {
                if (enabled) assetPacks.add(record.metadata.id);
                else assetPacks.delete(record.metadata.id);
              }),
          );
    }
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText("Anlegen")
        .setCta()
        .onClick(async () => {
          b.setDisabled(true);
          try {
            await this.plugin.create(
              name,
              width,
              height,
              {
                assetPacks: [...assetPacks],
                builtInAssets,
              },
              startKind === "empty"
                ? undefined
                : {
                    kind: startKind,
                    seed: generatorSeed,
                    amount: generatorAmount,
                  },
              { wallShadows, objectShadows, buildingWear },
            );
            this.close();
          } catch (error) {
            new Notice(String(error));
            b.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
}
