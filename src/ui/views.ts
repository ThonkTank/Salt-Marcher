import { App, FileView, ItemView, MarkdownRenderChild, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { type CompassDirection, type FeatureOccurrence, type Door, type Entity, type MapObject, type NoteLink, type Room, isRoom, isStructuredRoom } from "../model";
import { compactWheelNavigation, wheelNavigation } from "../navigation";
import { DungeonEditor, type EditorHost } from "../editor";
import { StructuredKeyPanel } from "../key-panel";
import { ExportDialog } from "../features/verwaltung/export-dialog";
import { encodeRasterFile } from "../features/verwaltung/raster-files";
import { serializeUniversalVtt03 } from "../features/verwaltung/universal-vtt";
import { universalVttGeometryForFloor } from "../features/verwaltung/vtt-map-geometry";
import { MapRenderer } from "../renderer";
import { Session } from "../session";
import { DungeonContentModal } from "./content-modals";
import { PrefabNameModal, GeneratorModal, ReferenceImagesModal, MapInformationModal, MapSettingsModal } from "./map-modals";
import { VIEW, PENDING_VIEW, PLAY_VIEW, ROOM_VIEW } from "./view-types";
import type DungeonPlugin from "../main";
import type { OpenMap } from "../main";

export class DungeonMapCard {
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
      (entity.kind === "object" && (!!this.occurrenceFor(entity) || !!entity.keyTarget))
    );
  }
  private activateAt(event: PointerEvent): void {
    if (!this.renderer) return;
    const local = this.renderer.local(event),
      roomLabel = this.renderer.roomLabelAt(local);
    if (roomLabel) {
      if (isStructuredRoom(roomLabel)) void this.plugin.openRoomKey(this.path, roomLabel.id);
      else if (roomLabel.note) void this.openNote(roomLabel.note);
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
    if (isStructuredRoom(room))
      this.info.append(this.infoButton("Text öffnen", () =>
        void this.plugin.openRoomKey(this.path, room.id)));
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
    else if (object.keyTarget) void this.plugin.openRoomKey(this.path,
      object.keyTarget.roomId, object.keyTarget.sectionId, object.keyTarget.anchor);
  }
  private openOccurrence(occurrence: FeatureOccurrence): void {
    this.focusId = occurrence.roomId;
    this.info.replaceChildren();
    if (occurrence.sectionId)
      void this.plugin.openRoomKey(this.path, occurrence.roomId, occurrence.sectionId);
    else if (occurrence.note) void this.openNote(occurrence.note);
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
    if (isStructuredRoom(room)) {
      const section = room.key.sections.find((item) =>
        item.kind === "passage" && item.doorId === door.id);
      this.info.append(this.infoButton("Text öffnen", () =>
        void this.plugin.openRoomKey(this.path, room.id, section?.id)));
    }
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
          (!!this.source && entity.note?.path === this.source)),
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
export class DungeonEmbed extends MarkdownRenderChild {
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
export class DungeonPlayView extends ItemView {
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
export class DungeonRoomView extends ItemView {
  private path?: string;
  private roomId?: string;
  private sectionId?: string;
  private anchor?: string;
  private map?: OpenMap;
  private acquiredPath?: string;
  private panel?: StructuredKeyPanel;
  private card?: DungeonMapCard;
  private generation = 0;
  constructor(leaf: WorkspaceLeaf, private plugin: DungeonPlugin) { super(leaf); }
  getViewType(): string { return ROOM_VIEW; }
  getDisplayText(): string { return "Raum-Key"; }
  getIcon(): string { return "file-text"; }
  getState(): Record<string, unknown> {
    return { path: this.path, roomId: this.roomId, sectionId: this.sectionId, anchor: this.anchor };
  }
  async setState(state: Record<string, unknown>): Promise<void> {
    const path = typeof state.path === "string" ? state.path : undefined;
    const roomId = typeof state.roomId === "string" ? state.roomId : undefined;
    const sectionId = typeof state.sectionId === "string" ? state.sectionId : undefined;
    const anchor = typeof state.anchor === "string" ? state.anchor : undefined;
    if (this.panel && !this.panel.commit()) return;
    if (path === this.path && roomId === this.roomId && this.panel) {
      this.sectionId = sectionId;
      this.anchor = anchor;
      this.panel.focus(sectionId, anchor);
      return;
    }
    this.path = path;
    this.roomId = roomId;
    this.sectionId = sectionId;
    this.anchor = anchor;
    if (path && roomId) await this.render();
  }
  async onOpen(): Promise<void> { await this.render(); }
  private async clear(): Promise<void> {
    this.panel?.commit();
    this.panel?.destroy();
    this.panel = undefined;
    this.card?.destroy();
    this.card = undefined;
    if (this.map && this.acquiredPath) this.plugin.release(this.acquiredPath, this.map);
    this.map = undefined;
    this.acquiredPath = undefined;
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    await this.clear();
    this.contentEl.replaceChildren();
    if (!this.path || !this.roomId) return;
    const path = this.path;
    try {
      const pending = !(this.app.vault.getAbstractFileByPath(path) instanceof TFile);
      const map = pending
        ? await this.plugin.acquirePending(path)
        : await this.plugin.acquire(path);
      if (generation !== this.generation) { this.plugin.release(path, map); return; }
      this.map = map;
      this.acquiredPath = path;
      const room = map.session.entities.get(this.roomId);
      if (map.session.version !== 4 || !isStructuredRoom(room))
        throw new Error("Strukturierter Raum-Key nicht gefunden.");
      this.contentEl.classList.add("dn-room-view");
      if (!pending && !room.key.sourcePath) {
        this.card = this.plugin.createDungeonMap({ path, focusRoom: this.roomId, compact: true });
        this.contentEl.append(this.card.el);
      }
      const tools = this.contentEl.createDiv({ cls: "dn-key-controls" });
      const save = tools.createEl("button", { text: pending ? "Im Karteneditor speichern" : "Karte speichern" });
      save.disabled = pending;
      save.addEventListener("click", () => {
        if (this.panel?.commit())
          void map.repository.save(map.session).catch((error) => new Notice(String(error)));
      });
      this.panel = new StructuredKeyPanel(
        this.app, this.contentEl, map.session, path, this.roomId, this.sectionId,
        (message) => new Notice(message), () => !map.pending, this.anchor,
      );
    } catch (error) {
      this.contentEl.createEl("p", { text: "Raum-Key konnte nicht geöffnet werden: " + String(error) });
    }
  }
  async onClose(): Promise<void> { this.generation++; await this.clear(); }
}
function editorHost(
  plugin: DungeonPlugin,
  map: OpenMap,
  mapPath: string,
  save: () => Promise<void>,
  exitEditor: () => void,
  pending = false,
  exportName?: string,
): EditorHost {
  return {
    app: plugin.app,
    notice: (m) => new Notice(m),
    pending: () => map.pending,
    openNote: (path) => {
      void plugin.app.workspace.openLinkText(path, mapPath, "split");
    },
    openRoomKey: (roomId, sectionId, anchor) => { void plugin.openRoomKey(mapPath, roomId, sectionId, anchor); },
    mapPath,
    save,
    assetUrl: (path) => plugin.assetUrl(path),
    colorableObjectSource: (id) => plugin.colorableObjectSource(
      id, map.session.settings.assetPacks),
    assets: () => plugin.listAssets(
      map.session.settings.assetPacks,
      map.session.settings.builtInAssets,
    ),
    subscribeAssets: (listener) => plugin.subscribeAssets(listener),
    objectTags: () => plugin.objectTags(
      map.session.settings.assetPacks,
      map.session.settings.builtInAssets,
    ),
    subscribeObjectTags: (listener) => plugin.subscribeObjectTags(listener),
    manageObjectTags: () => plugin.openObjectTags(
      map.session.settings.assetPacks,
      map.session.settings.builtInAssets,
    ),
    toolDefaults: () => plugin.toolDefaults(),
    persistToolDefaults: () => plugin.persistToolDefaults(),
    prefabs: () => plugin.prefabs(),
    savePrefab: (prefab) => plugin.savePrefab(prefab),
    forgetPrefab: (prefab, doc, signal) =>
      plugin.forgetPrefab(prefab, doc, signal),
    requestPrefabDetails: () => new PrefabNameModal(
      plugin.app, () => plugin.prefabs(),
    ).request(),
    manageAssets: () => plugin.openAssets(map.session),
    manageMap: () =>
      new MapSettingsModal(
        plugin.app,
        map.session,
        mapPath,
        plugin.assets,
      ).open(),
    manageMapInfo: pending ? undefined : () =>
      new MapInformationModal(
        plugin.app,
        map.session,
        mapPath,
        plugin.assets,
      ).open(),
    manageReferences: (floorId) =>
      new ReferenceImagesModal(
        plugin.app,
        plugin,
        map.session,
        floorId,
      ).open(),
    manageGenerator: (floorId) =>
      new GeneratorModal(plugin.app, map.session, floorId).open(),
    manageContent: (floorId, selectedId) =>
      new DungeonContentModal(
        plugin.app,
        map.session,
        map.repository,
        floorId,
        selectedId,
      ).open(),
    exportMap: pending || !exportName ? undefined : (renderer, session) => {
      new ExportDialog(plugin.app, {
        initial: {
          format: "png",
          pixelsPerCell: 256,
          includeGrid: true,
          includeLighting: true,
          qualityPercent: 90,
        },
        advanced: {
          supported: [],
          mapSize: {
            width: session.settings.width,
            height: session.settings.height,
          },
        },
        onExport: async (request, signal) => {
          if (signal.aborted) throw new Error("Export abgebrochen.");
          const revision = session.revision;
          const floorId = renderer.floorId;
          const document = session.document();
          let vttGeometry: ReturnType<typeof universalVttGeometryForFloor> | undefined;
          if (request.format === "universal-vtt") {
            const floor = document.floors.find((item) => item.id === floorId);
            if (document.floors.length !== 1 || renderer.floorId !== floorId ||
              (floor?.ambient ?? 1) !== 1 || request.includeGrid ||
              !request.includeLighting || request.pixelsPerCell !== 256)
              throw new Error("Diese Universal-VTT-Exportoptionen sind im Original noch nicht belegt.");
            vttGeometry = universalVttGeometryForFloor(document.entities, floorId);
          }
          const canvas = await renderer.captureMap({
            pixelsPerField: request.pixelsPerCell,
            grid: request.includeGrid,
            lighting: request.includeLighting,
          });
          if (signal.aborted) throw new Error("Export abgebrochen.");
          if (revision !== session.revision || floorId !== renderer.floorId)
            throw new Error("Die Karte hat sich während des Exports geändert.");
          if (request.format === "universal-vtt") {
            const body = serializeUniversalVtt03({
              renderedPngDataUrl: canvas.toDataURL("image/png"),
              mapWidthFields: document.settings.width,
              mapHeightFields: document.settings.height,
              pixelsPerGrid: request.pixelsPerCell,
              ...vttGeometry!,
              ambientLightHex: "ffffffff",
            });
            return {
              blob: new Blob([body], { type: "application/json" }),
              filename: `${exportName}.dd2vtt`,
            };
          }
          const raster = await encodeRasterFile(canvas, {
            format: request.format,
            ...(request.format === "jpeg" || request.format === "webp"
              ? { quality: (request.qualityPercent ?? 90) / 100 }
              : {}),
          });
          return {
            blob: raster.blob,
            filename: `${exportName}.${request.format === "jpeg" ? "jpg" : request.format}`,
          };
        },
      }).open();
    },
    openPlay: pending ? undefined : (roomId) => void plugin.openPlay(mapPath, roomId),
    exitEditor: () => exitEditor(),
  };
}
export class PendingDungeonView extends ItemView {
  editor?: DungeonEditor;
  private current?: OpenMap;
  private generation = 0;
  mapPath?: string;
  constructor(leaf: WorkspaceLeaf, private plugin: DungeonPlugin) {
    super(leaf);
  }
  getViewType(): string {
    return PENDING_VIEW;
  }
  getDisplayText(): string {
    return this.current?.session.settings.name ?? "Ungespeicherte Dungeon-Karte";
  }
  getIcon(): string {
    return "map";
  }
  getState(): Record<string, unknown> {
    return { path: this.mapPath };
  }
  async setState(state: Record<string, unknown>): Promise<void> {
    this.mapPath = typeof state.path === "string" ? state.path : undefined;
    if (this.contentEl.isConnected) await this.render();
  }
  async onOpen(): Promise<void> {
    await this.render();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    if (this.editor) await this.closeEditor();
    const path = this.mapPath;
    this.contentEl.replaceChildren();
    if (!path) {
      this.contentEl.createEl("p", { text: "Kein neuer Kartenentwurf gewählt." });
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.leaf.openFile(file);
      return;
    }
    this.contentEl.createEl("p", { text: "Neuer Kartenentwurf wird geöffnet …" });
    let acquired: OpenMap | undefined;
    try {
      const map = await this.plugin.acquirePending(path);
      acquired = map;
      await this.plugin.ensureAssets();
      if (generation !== this.generation) {
        this.plugin.release(path, map);
        acquired = undefined;
        return;
      }
      this.current = map;
      this.contentEl.replaceChildren();
      this.editor = new DungeonEditor(
        this.contentEl, map.session, map.repository,
        editorHost(this.plugin, map, path,
          () => this.plugin.savePending(path, map, this.leaf),
          () => this.leaf.detach(), true),
      );
      await this.editor.init();
      this.editor.maximize();
    } catch (error) {
      this.editor?.destroy();
      this.editor = undefined;
      if (acquired) this.plugin.release(path, acquired);
      this.current = undefined;
      this.contentEl.replaceChildren();
      this.contentEl.createEl("p", {
        text: "Neuer Kartenentwurf konnte nicht geöffnet werden: " + String(error),
      });
    }
  }
  private async closeEditor(): Promise<void> {
    if (this.editor) {
      try {
        this.editor.commitNote();
        if (this.current && (this.current.pending || this.current.session.dirty))
          await this.current.repository.persistDraft(this.current.session);
      } catch (error) {
        new Notice("Entwurf konnte nicht gesichert werden: " + String(error), 10000);
      }
      this.editor.destroy();
      this.editor = undefined;
    }
    if (this.current && this.mapPath)
      this.plugin.release(this.mapPath, this.current);
    this.current = undefined;
  }
  async onClose(): Promise<void> {
    this.generation++;
    await this.closeEditor();
  }
}
export class DungeonView extends FileView {
  private editor?: DungeonEditor;
  private current?: OpenMap;
  private mapPath?: string;
  private generation = 0;
  get session(): Session | undefined {
    return this.editor ? this.current?.session : undefined;
  }
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
editorHost(
          this.plugin, map, file.path,
          () => map.repository.save(map.session),
          () => this.exitEditor(),
          false, file.basename,
        ),
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
