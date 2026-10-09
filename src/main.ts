import {
  App,
  Notice,
  Plugin,
  TFile,
  type WorkspaceLeaf,
  type WorkspaceSplit,
} from "obsidian";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import {
  newDocument,
  parseDocument,
  type ReferenceImage,
  isStructuredRoom,
} from "./model";
import { Session } from "./session";
import { FileConflict, MapRepository } from "./persistence";
import { VaultStore, VaultAssetStore, VaultObjectTagStorage, LocalBinarySource } from "./vault-stores";
import { AssetPackagesModal, CreateDungeonModal } from "./ui/map-modals";
import { VIEW, PENDING_VIEW, PLAY_VIEW, ROOM_VIEW } from "./ui/view-types";
import { DungeonMapCard, DungeonEmbed, DungeonPlayView, DungeonRoomView, PendingDungeonView, DungeonView } from "./ui/views";
import { DungeonEditor } from "./editor";
import { projectedRoomDocuments, roomSectionForAnchor } from "./room-projection";
import { toolSettings, type ToolSettings } from "./properties";
import { type ColorableObjectSource } from "./renderer";
import { type Prefab, validPrefabs } from "./prefabs";
import { withoutPrefabDefinition } from "./features/objekte/prefab-forget";
import { createReferenceImage } from "./commands";
import {
  generateLayout,
  type GeneratorOptions,
} from "./generators";
import {
  AssetCatalog,
  PackAssetLibrary,
  type AssetDefinition,
} from "./assets";
import {
  NATIVE_PATH_PCK_SHA256,
  readNativePathCatalog,
  type NativePathCatalog,
} from "./features/material/native-path-catalog";
import { ObjectTagStore } from "./features/objekte/object-tag-store";
import { emptyObjectTags, mergeObjectTags,
  type ObjectTagDocument } from "./features/objekte/object-tags";
import { ObjectTagsModal } from "./ui/object-tags-modal";
import { newSizePresetSize } from "./features/verwaltung/new-map-size";

export interface OpenMap {
  session: Session;
  repository: MapRepository;
  pending: boolean;
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
  readonly nativeBuildingWear: boolean;
}
export default class DungeonPlugin extends Plugin {
  disableBuildingWearForNewMap = false;
  startWizardForNewMap = false;
  private readonly sessionSizePresets: SizePreset[] = [];
  private maps = new Map<string, Promise<OpenMap>>();
  readonly assets = new AssetCatalog(new VaultAssetStore(this.app));
  readonly objectTagStore = new ObjectTagStore(new VaultObjectTagStorage(this.app));
  private objectTagsBrowserMode: "default" | "override" = "default";
  private assetLibrary = new PackAssetLibrary();
  private nativePathCatalog?: NativePathCatalog;
  private nativePathAttempted?: string;
  private nativePathError?: string;
  private nativePathLoading?: Promise<void>;
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
    await this.objectTagStore.load().catch((error) =>
      new Notice("Objekt-Tags konnten nicht geladen werden: " + String(error), 10000));
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
    this.registerView(PENDING_VIEW, (leaf) => new PendingDungeonView(leaf, this));
    this.registerView(PLAY_VIEW, (leaf) => new DungeonPlayView(leaf, this));
    this.registerView(ROOM_VIEW, (leaf) => new DungeonRoomView(leaf, this));
    this.registerObsidianProtocolHandler("dungeon-room", (params) => {
      void this.openRoomLink(params).catch((error) => new Notice(String(error)));
    });
    this.registerDomEvent(document, "click", (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="obsidian://dungeon-room?"]');
      if (!link || event.defaultPrevented) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const params = Object.fromEntries(new URL(link.getAttribute("href")!).searchParams);
      void this.openRoomLink(params).catch((error) => new Notice(String(error)));
    }, true);
    this.registerExtensions(["dungeon"], VIEW);
    this.app.workspace.onLayoutReady(() => void this.restorePendingViews());
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
          roomId = element.closest<HTMLElement>(".dn-structured-key")?.dataset.keyRoom ??
            this.roomId(context.sourcePath);
        host.style.width = embed.style.width;
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
          count: this.nativePathCatalog
            ? this.nativePathCatalog.textures.length +
              this.nativePathCatalog.floors.length +
              this.nativePathCatalog.walls.length +
              this.nativePathCatalog.portals.length +
              this.nativePathCatalog.objects.length : 0,
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
  async openRoomKey(path: string, roomId: string, sectionId?: string, anchor?: string): Promise<void> {
    for (const type of [VIEW, PENDING_VIEW])
      for (const candidate of this.app.workspace.getLeavesOfType(type)) {
        const view = candidate.view as unknown as {
          file?: TFile; mapPath?: string; editor?: DungeonEditor;
        };
        if ((view.file?.path ?? view.mapPath) === path) view.editor?.showLayout();
      }
    const game = (this.app as App & { plugins: { getPlugin(id: string): unknown } })
      .plugins.getPlugin("dnd-ot-spielansicht") as { rightGroup?: () => WorkspaceSplit | undefined } | undefined;
    const playGroup = game?.rightGroup?.();
    const leaf = this.app.workspace.getLeavesOfType(ROOM_VIEW)
      .find((candidate) => candidate.view.containerEl.isConnected) ??
      (playGroup ? this.app.workspace.createLeafInParent(playGroup, 0) : undefined) ??
      this.app.workspace.getRightLeaf(false) ??
      this.app.workspace.getLeaf("split", "vertical");
    await leaf.setViewState({ type: ROOM_VIEW, active: true,
      state: { path, roomId, sectionId, anchor } });
    this.app.workspace.revealLeaf(leaf);
  }
  async readStructuredRoomDocuments(mapPath: string): Promise<ReturnType<typeof projectedRoomDocuments>> {
    const file = this.app.vault.getAbstractFileByPath(mapPath);
    if (!(file instanceof TFile) || file.extension !== "dungeon") return [];
    return projectedRoomDocuments(parseDocument(await this.app.vault.read(file)));
  }
  async openRoomBySourcePath(mapPath: string, sourcePath: string, anchor?: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(mapPath);
    if (!(file instanceof TFile)) throw new Error("Dungeonkarte fehlt.");
    const doc = parseDocument(await this.app.vault.read(file));
    const room = doc.entities.find((entity) => isStructuredRoom(entity) &&
      entity.key.sourcePath === sourcePath);
    if (!isStructuredRoom(room)) throw new Error("Raum-Key fehlt.");
    const sectionId = roomSectionForAnchor(room, anchor);
    if (anchor && !sectionId) throw new Error("Raumanker fehlt: " + anchor);
    await this.openRoomKey(mapPath, room.id, sectionId, anchor);
  }
  private async openRoomLink(params: Record<string, string>): Promise<void> {
    const { map, room, section, anchor } = params;
    if (!map || !room) throw new Error("Raum-Link ist unvollständig.");
    const matches: { path: string; doc: ReturnType<typeof parseDocument> }[] = [];
    for (const file of this.app.vault.getFiles().filter((item) => item.extension === "dungeon")) {
      try {
        const doc = parseDocument(await this.app.vault.read(file));
        if (doc.id === map) matches.push({ path: file.path, doc });
      } catch { /* unrelated or unreadable map */ }
    }
    if (matches.length !== 1)
      throw new Error(matches.length ? "Kartenkennung ist nicht eindeutig." : "Karte zum Raum-Link nicht gefunden.");
    const match = matches[0]!;
    const sectionRooms = section ? match.doc.entities.filter((entity) =>
      isStructuredRoom(entity) && entity.key.sections.some((item) => item.id === section)) : [];
    if (section && sectionRooms.length !== 1)
      throw new Error("Raumabschnitt zum Link fehlt oder ist nicht eindeutig.");
    await this.openRoomKey(match.path, sectionRooms[0]?.id ?? room, section, anchor);
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
    if (this.assetLoaded) {
      if (!this.nativePathError) return Promise.resolve();
      return this.loadNativePathCatalog().then(() => {
        if (!this.nativePathError)
          for (const listener of this.assetListeners) listener();
      });
    }
    return (this.assetLoading ??= this.reloadAssets().finally(() => {
      this.assetLoading = undefined;
    }));
  }
  private loadNativePathCatalog(): Promise<void> {
    const path = this.pluginData.nativePckPath;
    if (!path || this.nativePathAttempted === path) return Promise.resolve();
    if (this.nativePathLoading) return this.nativePathLoading;
    const loading = (async () => {
      try {
        if (await fileSha256(path) !== NATIVE_PATH_PCK_SHA256)
          throw new Error("Die Originaldatei passt nicht zu Dungeondraft 1.2.0.1 Linux64.");
        const next = await readNativePathCatalog(new LocalBinarySource(path));
        if (await fileSha256(path) !== NATIVE_PATH_PCK_SHA256)
          throw new Error("Die Originaldatei wurde während des Ladens verändert.");
        this.nativePathCatalog = next;
        this.nativePathAttempted = path;
        this.nativePathError = undefined;
      } catch (error) {
        const detail = String(error);
        if (detail !== this.nativePathError)
          new Notice("Dungeondraft-Originalassets konnten nicht geladen werden: " +
            detail, 10000);
        this.nativePathError = detail;
      }
    })();
    this.nativePathLoading = loading;
    return loading.finally(() => { this.nativePathLoading = undefined; });
  }
  async useNativeAssetArchive(path: string): Promise<void> {
    if (await fileSha256(path) !== NATIVE_PATH_PCK_SHA256)
      throw new Error("Bitte die Originaldatei von Dungeondraft 1.2.0.1 Linux64 wählen.");
    const next = await readNativePathCatalog(new LocalBinarySource(path));
    if (await fileSha256(path) !== NATIVE_PATH_PCK_SHA256)
      throw new Error("Die Originaldatei wurde während des Ladens verändert.");
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
        const cached = this.nativePathUrls.get(id);
        if (cached) return cached;
        const native = this.nativePathCatalog?.image(id);
        if (native) {
          const url = URL.createObjectURL(native);
          this.nativePathUrls.set(id, url);
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
      ? [...packed, ...this.nativePathCatalog.textures.map((item) => item.asset),
          ...this.nativePathCatalog.floors, ...this.nativePathCatalog.walls,
          ...this.nativePathCatalog.portals, ...this.nativePathCatalog.objects]
      : packed;
  }
  objectTags(packIds?: readonly string[], builtInAssets = this.catalogBuiltIns): ObjectTagDocument {
    const base = builtInAssets
      ? this.objectTagStore.current() ?? this.nativePathCatalog?.defaultObjectTags ?? emptyObjectTags()
      : emptyObjectTags();
    return mergeObjectTags(base, this.assetLibrary.objectTags(packIds));
  }
  openObjectTags(packIds?: readonly string[], builtInAssets = this.catalogBuiltIns,
    sourceDocument?: Document): void {
    const targetDocument = sourceDocument ??
      this.app.workspace.activeLeaf?.view.containerEl.ownerDocument;
    if (targetDocument?.hasFocus() && targetDocument.defaultView) {
      // A newly trusted vault can retain about:blank as Obsidian's active document.
      // Modal uses that global at construction, so bind it to the clicked view.
      window.activeWindow = targetDocument.defaultView;
      window.activeDocument = targetDocument;
    }
    new ObjectTagsModal(this.app, {
      initialMode: this.objectTagsBrowserMode,
      onModeChange: (mode) => { this.objectTagsBrowserMode = mode; },
      defaults: this.nativePathCatalog?.defaultObjectTags ?? emptyObjectTags(),
      override: this.objectTagStore.current(),
      assets: this.listAssets(packIds, builtInAssets).filter((asset) => asset.kind === "object"),
      assetUrl: (id) => this.assetUrl(id + "\0image"),
      save: (document) => this.objectTagStore.save(document),
    }).open();
  }
  subscribeObjectTags(listener: () => void): () => void {
    return this.objectTagStore.subscribe(listener);
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
    return this.sessionSizePresets;
  }
  saveSizePreset(
    name: string,
    width: number,
    height: number,
  ): SizePreset {
    name = name.trim();
    if (!name)
      throw new Error("Bitte einen Namen für die Größenvorlage eingeben.");
    const preset = { name, ...newSizePresetSize(width, height) };
    this.sessionSizePresets.push(preset);
    return preset;
  }
  removeSizePreset(index: number): void {
    if (!Number.isInteger(index) || index < 0 ||
        index >= this.sessionSizePresets.length)
      throw new Error("Die Größenvorlage ist nicht mehr vorhanden.");
    this.sessionSizePresets.splice(index, 1);
  }
  toolDefaults(): ToolSettings {
    return this.pluginData.toolDefaults;
  }
  resetObjectColorForMap(): void {
    const defaults = this.pluginData.toolDefaults;
    const nativeObject = toolSettings().object;
    // Dungeondraft starts each newly opened map with the first Object Tool color.
    // The map's custom palette remains in Session settings and is not reset here.
    defaults.object = {
      ...defaults.object,
      color: nativeObject.color,
      alpha: nativeObject.alpha,
    };
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
  private mapRecord(repository: MapRepository, session: Session, pending: boolean): OpenMap {
    const map: OpenMap = {
      repository, session, pending, views: 0, stopDrafts: () => {},
    };
    map.stopDrafts = session.subscribe(() => {
      if (map.draftTimer) clearTimeout(map.draftTimer);
      if (map.pending) {
        void repository.persistDraft(session).catch((error) =>
          new Notice("Entwurf konnte nicht gesichert werden: " + String(error)));
        return;
      }
      map.draftTimer = setTimeout(() => {
        map.draftTimer = undefined;
        void repository.persistDraft(session).catch((error) =>
          new Notice("Entwurf konnte nicht gesichert werden: " + String(error)));
      }, 400);
    });
    return map;
  }
  async acquire(path: string): Promise<OpenMap> {
    let pending = this.maps.get(path);
    if (!pending) {
      pending = (async () => {
        const repository = new MapRepository(new VaultStore(this.app), path),
          session = await repository.open();
        return this.mapRecord(repository, session, false);
      })();
      this.maps.set(path, pending);
      pending.catch(() => this.maps.delete(path));
    }
    const map = await pending;
    map.views++;
    return map;
  }
  async acquirePending(path: string): Promise<OpenMap> {
    let pending = this.maps.get(path);
    if (!pending) {
      pending = (async () => {
        const repository = new MapRepository(new VaultStore(this.app), path),
          session = await repository.openPending();
        return this.mapRecord(repository, session, true);
      })();
      this.maps.set(path, pending);
      pending.catch(() => this.maps.delete(path));
    }
    const map = await pending;
    map.views++;
    return map;
  }
  async savePending(path: string, map: OpenMap, from: WorkspaceLeaf): Promise<void> {
    const releaseMutations = map.session.holdMutations();
    try {
      await map.repository.save(map.session);
      map.pending = false;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile))
        throw new Error("Gespeicherte Karte ist nicht als Datei verfügbar.");
      // The extra lease prevents release() from discarding the Session before
      // DungeonView.acquire() receives it with its pre-save history intact.
      map.views++;
      const leaf = this.app.workspace.getLeaf("tab");
      let loaded = false;
      try {
        await leaf.openFile(file);
        if (!(leaf.view instanceof DungeonView) || leaf.view.session !== map.session)
          throw new Error("Kartenansicht hat die laufende Sitzung nicht übernommen.");
        loaded = true;
        this.app.workspace.revealLeaf(leaf);
        from.detach();
      } catch (error) {
        if (!loaded) leaf.detach();
        throw error;
      } finally {
        this.release(path, map);
      }
    } finally {
      releaseMutations();
    }
  }
  private async restorePendingViews(): Promise<void> {
    for (const file of this.app.vault.getFiles()) {
      if (!file.path.endsWith(".dungeon.draft")) continue;
      const path = file.path.slice(0, -".draft".length);
      if (this.app.vault.getAbstractFileByPath(path)) continue;
      try {
        const raw = JSON.parse(await this.app.vault.read(file)) as {
          version?: number; kind?: string; mapPath?: string;
        };
        if (raw.version !== 2 || raw.kind !== "pending" || raw.mapPath !== path)
          continue;
        if (this.app.workspace.getLeavesOfType(PENDING_VIEW).some((leaf) =>
          (leaf.view as PendingDungeonView).mapPath === path)) continue;
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({ type: PENDING_VIEW, active: false,
          state: { path } });
      } catch (error) {
        new Notice("Neuer Kartenentwurf konnte nicht wiederhergestellt werden: " +
          String(error));
      }
    }
  }
  release(path: string, map: OpenMap): void {
    map.views--;
    if (map.views === 0 && !map.session.dirty && !map.pending) {
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
    startWizard = false,
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
      initial = newDocument(
          name,
          width,
          height,
          {
            assetPacks: assets.assetPacks,
            builtInAssets: assets.builtInAssets,
          },
          appearance,
          4,
        ),
      session = new Session(initial);
    if (generator)
      generateLayout(session, session.floors.keys().next().value!, generator);
    if (this.maps.has(path)) throw new FileConflict(path);
    await repository.beginPending(initial, session);
    this.maps.set(path, Promise.resolve(this.mapRecord(repository, session, true)));
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: PENDING_VIEW, active: true,
      state: { path, startWizard } });
    this.app.workspace.revealLeaf(leaf);
  }
}
