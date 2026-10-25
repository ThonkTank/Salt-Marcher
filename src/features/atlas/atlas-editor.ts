import { SpatialCanvas, type SpatialCanvasAccess } from "./spatial-canvas";
import { CityGesture } from "../city/gestures";
import { cityDocumentChange } from "../city/commands";
import {
  DungeonGeometryGesture,
} from "../dungeon/geometry-change";
import { buildingPointGripPixels } from "../bau/building-point-gestures";
import {
  unprojectLocal,
  type RigidFrame,
  type RelativeAtlasCamera,
} from "./relative-frame";
import { AtlasCityBuildingPanel } from "../../legacy/obsidian/ui/atlas-city-building-panel";
import { AtlasRoomKeyPanel } from "../../legacy/obsidian/ui/atlas-room-key-panel";
import { AtlasRenderer } from "./atlas-renderer";
import { hexAddressKey, hexAt } from "./hex";
import type { OverworldDocument, WorldPoint } from "./overworld";
import { sameAtlasValue, type AtlasValue } from "./atlas-history";
import {
  newLocation,
  type LocationDocument,
} from "../location/location-schema";
import type { LocationPlacement } from "./location-placement";
import { LocationKeyPanel } from "../../legacy/obsidian/ui/location-key-panel";
import { AtlasDetailEntry, type AtlasDetailEntryModel } from "../../legacy/obsidian/ui/atlas-detail-entry";
import type { AtlasNavigationTarget, AtlasResolvedNavigation } from "./atlas-campaign-navigation";
import {
  TERRAIN_COLORS,
  TerrainSource,
  TerrainStroke,
  type TerrainTool,
} from "./terrain-source";

type Tool = "select" | "hand" | TerrainTool;
type PointerAction =
  | "pan"
  | "select"
  | "paint"
  | "location"
  | "city"
  | "room"
  | "dungeon";
export interface AtlasEditorStorage {
  assertCurrent?(): void;
  navigation?: {
    details(locationId: string): AtlasDetailEntryModel;
    navigate(target: Readonly<AtlasNavigationTarget>): Promise<void>;
    bindDungeon?(locationId: string, placementId: string): boolean;
  };
  save(): Promise<void>;
  changed(): Promise<void>;
  status(): { dirty: boolean; hasDraft: boolean };
  menu?(event: MouseEvent): void;
  discard?(): Promise<TerrainSource>;
  discarded?(): void;
  spatial?: Omit<SpatialCanvasAccess, "source">;
  locations?: {
    read(id: string): LocationDocument | null;
    ensure(id: string): Promise<LocationDocument | null>;
    create(document: LocationDocument, placement: LocationPlacement): boolean;
    edit(document: LocationDocument): boolean;
    move(id: string, position: WorldPoint): boolean;
    markdown?(host: HTMLElement, text: string, id: string): Promise<void>;
  };
}
export class AtlasEditor {
  readonly renderer: AtlasRenderer;
  readonly viewport: HTMLDivElement;
  private abort = new AbortController();
  private selection: HTMLParagraphElement;
  private status: HTMLSpanElement;
  private scale: HTMLSpanElement;
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private unsubscribe: () => void = () => {};
  private currentTerrain: TerrainSource;
  private landColor: string = TERRAIN_COLORS.land;
  private space = false;
  private tool: Tool = "select";
  private stroke?: TerrainStroke;
  private cancelledStrokes = new WeakSet<TerrainStroke>();
  private work: Promise<void> = Promise.resolve();
  private persistence: Promise<void> = Promise.resolve();
  private persistenceVersion = 0;
  private flushing = false;
  private closed = false;
  private inputBlocked = false;
  private initialization?: Promise<void>;
  private detailEntry?: AtlasDetailEntry;
  private detailHost?: HTMLElement;
  private inspector?: HTMLElement;
  private inspectorKey?: string;
  private loadingVisible = false;
  private visibleLoad: Promise<void> = Promise.resolve();
  private visibleLoadFailed = false;
  private key?: LocationKeyPanel;
  private roomKey?: AtlasRoomKeyPanel;
  private cityKey?: AtlasCityBuildingPanel;
  private spatial?: SpatialCanvas;
  private cityDrag?: {
    gesture: CityGesture;
    frame: RigidFrame;
    camera: RelativeAtlasCamera;
    valid: boolean;
    error?: unknown;
  };
  private dungeonDrag?: {
    gesture: DungeonGeometryGesture;
    frame: RigidFrame;
    camera: RelativeAtlasCamera;
  };
  private selectedRoom?: { ownerId: string; roomId: string };
  private selectedLocation?: string;
  private selectionVersion = 0;
  private loadedLocations = new Set<string>();
  private failedLocations = new Set<string>();
  private loadingLocations = false;
  private locationLoad: Promise<void> = Promise.resolve();
  private drag?: {
    id: string;
    source: TerrainSource;
    placements: AtlasValue;
    metersPerPixel: number;
    origin: WorldPoint;
    position: WorldPoint;
  };
  private pointer?: {
    id: number;
    action: PointerAction;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  };
  constructor(
    private root: HTMLElement,
    world: OverworldDocument,
    terrain: TerrainSource,
    private storage: AtlasEditorStorage,
  ) {
    this.currentTerrain = terrain;
    for (const name of ["pointerdown", "pointermove", "pointerup", "wheel", "keydown", "keyup", "click", "input", "change", "focusout"])
      root.addEventListener(name, (event) => { if (this.inputBlocked || this.closed) event.stopImmediatePropagation(); }, { capture: true, signal: this.abort.signal });
    root.replaceChildren();
    root.classList.add("dn-atlas");
    root.dataset.worldId = world.id;
    const doc = root.ownerDocument,
      toolbar = doc.createElement("div");
    toolbar.className = "dn-atlas-toolbar";
    const title = doc.createElement("strong");
    title.textContent = world.name;
    toolbar.append(title);
    const button = (
      text: string,
      label: string,
      action: (event: MouseEvent) => void,
    ) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", (event) => {
        if (this.inputBlocked || this.closed) return;
        try { this.storage.assertCurrent?.(); action(event); }
        catch (error) { this.status.textContent = String(error); }
      }, { signal: this.abort.signal });
      toolbar.append(b);
      return b;
    };
    const toolButtons = new Map<Tool, HTMLButtonElement>();
    const choose = (tool: Tool) => {
      try {
        this.finishCity();
        this.applyKeys();
      } catch (error) {
        this.status.textContent = String(error);
        return;
      }
      this.finishStroke();
      this.cancelDungeon();
      this.cancelDrag();
      this.tool = tool;
      for (const [id, b] of toolButtons)
        b.setAttribute("aria-pressed", String(id === tool));
      this.viewport.classList.toggle("is-hand", tool === "hand");
      this.viewport.classList.toggle(
        "is-paint",
        tool !== "select" && tool !== "hand",
      );
      this.renderer.hover = undefined;
      this.renderer.schedule();
    };
    for (const [tool, text, label] of [
      ["select", "Auswahl", "Hex auswählen"],
      ["hand", "Hand", "Karte verschieben"],
      ["land", "Land", "Land malen"],
      ["sea", "Meer", "Meer malen"],
      ["forest", "Wald", "Wald malen"],
      ["reset", "Zurücksetzen", "Gelände zurücksetzen"],
    ] as const)
      toolButtons.set(
        tool,
        button(text, label, () => choose(tool)),
      );
    const colorLabel = doc.createElement("label");
    colorLabel.className = "dn-atlas-color";
    colorLabel.textContent = "Landfarbe ";
    const color = doc.createElement("input");
    color.type = "text";
    color.value = this.landColor;
    color.maxLength = 7;
    color.setAttribute("aria-label", "Landfarbe");
    color.title = "Mit Enter übernehmen";
    color.spellcheck = false;
    color.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter") return;
        // The original text field commits on Enter, not Tab; invalid text commits black.
        const value = color.value.trim().replace(/^#/, "").toLowerCase();
        this.landColor = /^[0-9a-f]{6}$/.test(value) ? "#" + value : "#000000";
        color.value = this.landColor;
        color.style.borderColor = this.landColor;
        e.preventDefault();
      },
      { signal: this.abort.signal },
    );
    colorLabel.append(color);
    toolbar.append(colorLabel);
    this.undoButton = button("Rückgängig", "Atlasänderung rückgängig", () =>
      this.historyAction("undo"),
    );
    this.redoButton = button("Wiederholen", "Atlasänderung wiederholen", () =>
      this.historyAction("redo"),
    );
    button("−", "Atlas verkleinern", () => this.zoom(1.25));
    button("+", "Atlas vergrößern", () => this.zoom(0.8));
    button("Einpassen", "Atlasinhalt einpassen", () => {
      this.finishStroke();
      this.enqueue(() => {
        this.applyKeys();
        this.renderer.fit();
      });
    });
    if (storage.locations) {
      button("Stadt +", "Stadt in Kartenmitte anlegen", () =>
        this.createLocation("city"),
      );
      button("POI +", "POI in Kartenmitte anlegen", () =>
        this.createLocation("poi"),
      );
    }
    button("Speichern", "Atlas speichern", () => this.save());
    if (storage.menu)
      button("Karte ▾", "Atlas-Kartenmenü", (event) => storage.menu!(event));
    this.scale = doc.createElement("span");
    this.scale.className = "dn-atlas-scale";
    toolbar.append(this.scale);
    this.viewport = doc.createElement("div");
    this.viewport.className = "dn-atlas-viewport";
    this.viewport.tabIndex = 0;
    this.viewport.setAttribute(
      "aria-label",
      "Atlas: Hex auswählen oder Gelände malen; Mitte oder Leertaste ziehen; Strg und Mausrad zoomen",
    );
    const footer = doc.createElement("div");
    footer.className = "dn-atlas-footer";
    this.selection = doc.createElement("p");
    this.selection.className = "dn-atlas-selection";
    this.selection.setAttribute("role", "status");
    this.selection.textContent =
      "Land, Meer oder Wald wählen und Hexes zeichnen.";
    this.status = doc.createElement("span");
    this.status.className = "dn-atlas-save-status";
    this.status.setAttribute("role", "status");
    const hint = doc.createElement("small");
    hint.textContent =
      "Pinsel: 3-Meilen-Hexes. Mitte oder Leertaste ziehen verschiebt. Strg + Mausrad zoomt.";
    footer.append(this.selection, this.status, hint);
    const body = doc.createElement("div");
    body.className = "dn-atlas-body";
    body.append(this.viewport);
    root.append(toolbar, body, footer);
    this.renderer = new AtlasRenderer(
      this.viewport,
      world,
      () => {
        this.scale.textContent = `${Number(this.viewport.dataset.hexMiles).toLocaleString("de-DE")} Meilen pro Hex`;
        void this.loadVisible();
      },
      terrain,
    );
    if (storage.locations || storage.spatial) {
      const host = doc.createElement("aside");
      host.className = "dn-atlas-location-dock";
      host.hidden = true;
      this.inspector = host;
      body.append(host);
      host.addEventListener("keydown", (event) => this.escapeInspector(event), { signal: this.abort.signal });
      const actions = doc.createElement("div"), close = doc.createElement("button");
      actions.className = "dn-atlas-inspector-actions";
      close.type = "button";
      close.textContent = "Zur Karte";
      close.setAttribute("aria-label", "Key-Inspector schließen");
      close.addEventListener("click", () => this.closeInspector(), { signal: this.abort.signal });
      actions.append(close); host.append(actions);
    }
    if (storage.locations) {
      const host = this.inspector!;
      const keyHost = doc.createElement("div");
      host.append(keyHost);
      this.key = new LocationKeyPanel(keyHost, {
        read: (id) => storage.locations!.read(id),
        edit: (document) => storage.locations!.edit(document),
        changed: () => this.refreshHistory(),
        save: () => this.save(),
        escape: (event) => this.escapeInspector(event),
        markdown: storage.locations.markdown,
      });
      if (storage.navigation) {
        this.detailHost = doc.createElement("div");
        host.append(this.detailHost);
        this.detailHost.hidden = true;
        this.detailEntry = new AtlasDetailEntry(this.detailHost, {
          onNavigate: (target) => storage.navigation!.navigate(target),
          onBindDungeon: storage.navigation.bindDungeon ? (id) => this.bindDungeon(id) : undefined,
        });
      }
    }
    if (storage.spatial) {
      this.spatial = new SpatialCanvas(this.renderer, {
        ...storage.spatial,
        source: () => this.terrain,
      });
      this.renderer.detailFitPoints = () => this.spatial!.fitPoints();
      this.renderer.beforeRender = () => {
        try {
          this.spatial!.draw();
        } catch (error) {
          this.status.textContent =
            "Detailkarte kann nicht dargestellt werden. " + String(error);
          this.renderer.host.dataset.spatialError = String(error);
        }
      };
      const host = doc.createElement("div");
      this.inspector!.insertBefore(host, this.detailHost ?? null);
      this.roomKey = new AtlasRoomKeyPanel(host, {
        read: (id) => storage.spatial!.dungeon(id),
        changed: () => this.refreshHistory(),
        save: () => this.save(),
        escape: (event) => this.escapeInspector(event),
      });
    }
    if (storage.spatial) {
      const host = doc.createElement("div");
      this.inspector!.insertBefore(host, this.detailHost ?? null);
      this.cityKey = new AtlasCityBuildingPanel(host, {
        read: (id) => storage.spatial!.city(id),
        assertCurrent: () => { if (this.closed) throw new Error("Atlas ist geschlossen."); this.storage.assertCurrent?.(); },
        assertInput: () => { if (this.inputBlocked) throw new Error("Atlas nicht bearbeitbar."); },
        changed: () => this.refreshHistory(),
        save: () => this.save(),
        escape: (event) => this.escapeInspector(event),
      });
    }
    this.subscribeTerrain();
    choose("select");
    this.refreshHistory();
    this.bind();
  }
  get terrain(): TerrainSource {
    return this.currentTerrain;
  }
  get pendingKey(): boolean {
    return !!(this.key?.dirty || this.roomKey?.dirty || this.cityKey?.dirty);
  }
  setInputBlocked(blocked: boolean): void {
    const released = this.inputBlocked && !blocked;
    this.inputBlocked = blocked;
    this.root.inert = blocked;
    if (released && !this.closed) this.renderer.schedule();
  }
  /** A revoked old draft remains inspectable under its old identity; no more map effects. */
  suspend(): void {
    this.setInputBlocked(true);
    this.closed = true;
    this.status.textContent = "Entwurf erhalten; Bearbeitung angehalten.";
    this.abort.abort();
    this.unsubscribe();
    this.renderer.destroy();
  }
  navigate(target: AtlasResolvedNavigation, assertCurrent: () => void): void {
    assertCurrent();
    this.applyKeys();
    this.cityKey?.clear();
    if (this.spatial) this.spatial.selection = undefined;
    ++this.selectionVersion;
    if (target.key?.kind === "location") {
      this.roomKey?.clear(); this.selectedRoom = undefined;
      if (this.spatial) { this.spatial.selectedRoom = undefined; this.spatial.selection = undefined; }
      this.selectedLocation = target.key.documentId;
      this.loadedLocations.add(target.key.documentId);
    } else if (target.key?.kind === "room") {
      this.selectedRoom = { ownerId: target.key.documentId, roomId: target.key.roomId };
      if (this.spatial) this.spatial.selectedRoom = this.selectedRoom;
    }
    this.syncLocations();
    if (target.frame) this.renderer.focus(target.frame, target.localPoint,
      target.target.kind === "world" ? 600 : target.target.kind.startsWith("location") ? 30 : target.target.kind === "city" ? 1 : 0.1);
    assertCurrent();
    if (target.key?.sectionId) {
      const panel = target.key.kind === "location" ? this.key?.host : this.roomKey?.host;
      panel?.querySelector<HTMLElement>(`[data-section-id="${target.key.sectionId}"] textarea`)?.focus();
    }
  }
  private applyKeys(): void {
    this.key?.apply();
    this.roomKey?.apply();
    this.cityKey?.apply();
  }
  private escapeInspector(event: KeyboardEvent): boolean {
    const focused = this.root.ownerDocument.activeElement;
    if (event.key !== "Escape" || event.isComposing || this.closed || this.inputBlocked ||
      this.flushing || this.pointer || !focused || !this.root.contains(focused) ||
      !(this.selectedLocation || this.selectedRoom || this.selectedBuilding || this.pendingKey)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.closeInspector();
    return true;
  }
  private closeInspector(): void {
    if (this.closed || this.inputBlocked || this.flushing || this.pointer) return;
    this.enqueue(() => {
      // Use the same checked commit as leaving a Key through navigation or the map.
      // Invalid text must keep its visible draft and selection; no clear happens first.
      this.applyKeys();
      ++this.selectionVersion;
      this.selectedLocation = undefined;
      this.selectedRoom = undefined;
      this.key?.clear();
      this.cityKey?.clear();
      this.roomKey?.clear();
      if (this.spatial) {
        this.spatial.selection = undefined;
        this.spatial.selectedRoom = undefined;
      }
      this.renderer.selectedLocation = undefined;
      this.syncLocations();
      this.selection.textContent = "Karte";
      this.renderer.schedule();
      this.viewport.focus();
    });
  }
  private cancelCity(): void {
    this.cityDrag?.gesture.cancel();
    this.cityDrag = undefined;
    if (this.spatial) this.spatial.preview = undefined;
    this.renderer?.schedule();
  }
  private cancelDungeon(): void {
    this.dungeonDrag?.gesture.cancel();
    this.dungeonDrag = undefined;
    if (this.spatial) this.spatial.dungeonPreview = undefined;
    this.renderer?.schedule();
  }
  private finishDungeon(): void {
    const drag = this.dungeonDrag,
      moved = this.pointer?.moved;
    if (!drag || !moved) {
      this.cancelDungeon();
      return;
    }
    const change = drag.gesture.handoff();
    this.dungeonDrag = undefined;
    if (this.spatial) this.spatial.dungeonPreview = undefined;
    if (!change) {
      this.renderer.schedule();
      return;
    }
    const command = {
      label: "Dungeon-Konturpunkt verschieben",
      changes: [change],
    };
    // The same complete command is checked and then executed once.
    this.terrain.history.check(command);
    this.terrain.history.execute(command);
    this.renderer.schedule();
  }
  private finishCity(): void {
    const drag = this.cityDrag;
    if (!drag) return;
    if (!this.pointer?.moved) {
      this.cancelCity();
      return;
    }
    if (!drag.valid || !drag.gesture.preview)
      throw new Error(
        "Stadtvorschau ist ungültig. Eingabe bleibt erhalten; Escape verwirft sie.",
      );
    // Preflight before completing the native draft keeps stale/invalid input available for explicit cancellation.
    this.terrain.history.check({
      label: "Stadt verschieben",
      changes: [
        cityDocumentChange(drag.gesture.before, drag.gesture.preview.document),
      ],
    });
    drag.gesture.apply("Stadt verschieben");
    this.cityDrag = undefined;
    if (this.spatial) this.spatial.preview = undefined;
    this.renderer.schedule();
  }
  private cancelStroke(): void {
    if (this.stroke) this.cancelledStrokes.add(this.stroke);
    this.stroke = undefined;
    this.enqueue(() => {
      this.renderer.preview = [];
      this.renderer.schedule();
    });
  }
  private subscribeTerrain(): void {
    this.unsubscribe = this.terrain.history.subscribe(() => {
      this.syncLocations();
      this.refreshHistory();
      this.renderer.schedule();
      const version = ++this.persistenceVersion;
      this.status.textContent = "Entwurf wird gesichert …";
      this.persistence = this.storage.changed();
      void this.persistence.then(
        () => {
          if (!this.closed && version === this.persistenceVersion)
            this.refreshHistory();
        },
        (error) => {
          if (!this.closed && version === this.persistenceVersion)
            this.status.textContent =
              "Entwurf konnte nicht gesichert werden. " + String(error);
        },
      );
    });
  }
  init(): Promise<void> {
    return this.initialization ??= this.renderer.init();
  }
  private refreshHistory(): void {
    this.undoButton.disabled =
      !this.terrain.history.canUndo && !this.pendingKey;
    this.redoButton.disabled = !this.terrain.history.canRedo;
    const state = this.storage.status();
    this.status.textContent = this.pendingKey
      ? "Text noch nicht übernommen"
      : state.dirty
        ? state.hasDraft
          ? "Entwurf gesichert"
          : "Ungespeichert"
        : "Gespeichert";
    this.root.dataset.dirty = String(state.dirty || this.pendingKey);
    this.root.dataset.hasDraft = String(state.hasDraft);
    this.root.dataset.undoDepth = String(this.terrain.history.undoDepth);
  }
  private enqueue(action: () => void | Promise<void>): void {
    if (this.flushing || this.closed) return;
    this.work = this.work
      .then(async () => {
        if (!this.closed) {
          this.storage.assertCurrent?.();
          await action();
          this.storage.assertCurrent?.();
        }
      })
      .catch((error) => {
        if (!this.closed) {
          this.status.textContent = "Bearbeitung angehalten. " + String(error);
          this.renderer.preview = [];
          this.renderer.locationPreview = undefined;
          this.renderer.schedule();
        }
      });
  }
  private bindDungeon(placementId: string): Promise<void> {
    if (this.closed || this.inputBlocked || this.flushing || !this.selectedLocation)
      return Promise.reject(new Error("Ort ist nicht zur Bearbeitung verfügbar."));
    const locationId = this.selectedLocation, source = this.terrain, selectionVersion = this.selectionVersion;
    this.cancelDungeon(); this.finishCity(); this.finishStroke(); this.finishDrag(); this.releasePointer();
    const operation = this.work.then(async () => {
      this.storage.assertCurrent?.();
      if (this.closed || this.inputBlocked || source !== this.terrain ||
          this.selectedLocation !== locationId || this.selectionVersion !== selectionVersion)
        throw new Error("Ortsauswahl wurde inzwischen geändert.");
      this.applyKeys();
      this.storage.navigation!.bindDungeon!(locationId, placementId);
      await this.persistence;
      this.storage.assertCurrent?.();
    });
    this.work = operation.catch(() => {});
    return operation;
  }
  /** Route the focused View hotkey through the same guarded Save as visible controls. */
  handleSaveShortcut(event: KeyboardEvent): boolean {
    const focused = this.root.ownerDocument.activeElement;
    if (!focused || !this.root.contains(focused) || !event.target ||
        !this.root.contains(event.target as Node)) return false;
    // Consume owned shortcuts even while unavailable/composing; do not fall through
    // to the parent Obsidian file hotkey or publish the unfinished key draft.
    if (!event.isComposing && !this.inputBlocked && !this.closed && !this.flushing)
      this.save();
    return true;
  }
  private save(): void {
    if (this.inputBlocked || this.closed) return;
    this.cancelDungeon();
    try {
      this.finishCity();
    } catch (error) {
      this.status.textContent = String(error);
      return;
    }
    this.finishStroke();
    this.finishDrag();
    this.enqueue(async () => {
      this.applyKeys();
      // Key apply starts draft persistence; finish it before pinning native Save.
      await this.persistence;
      this.storage.assertCurrent?.();
      const version = this.persistenceVersion;
      this.status.textContent = "Atlas wird gespeichert …";
      await this.storage.save();
      if (this.closed) return;
      if (version === this.persistenceVersion)
        this.persistence = Promise.resolve();
      this.refreshHistory();
    });
  }
  discard(): void {
    if (this.inputBlocked || this.closed) return;
    if (!this.storage.discard) return;
    try {
      this.applyKeys();
      this.finishCity();
    } catch (error) {
      this.status.textContent = String(error);
      return;
    }
    this.cancelStroke();
    this.cancelDungeon();
    this.cancelDrag();
    this.releasePointer();
    this.enqueue(async () => {
      this.flushing = true;
      try {
        const source = await this.storage.discard!();
        this.unsubscribe();
        this.currentTerrain = source;
        ++this.selectionVersion;
        this.loadedLocations.clear();
        this.failedLocations.clear();
        this.key?.clear();
        this.cityKey?.clear();
        this.roomKey?.clear();
        this.selectedRoom = undefined;
        if (this.spatial) {
          this.spatial.selection = undefined;
          this.spatial.selectedRoom = undefined;
        }
        this.renderer.useTerrain(source);
        this.subscribeTerrain();
        this.persistence = Promise.resolve();
        ++this.persistenceVersion;
        this.visibleLoadFailed = false;
        this.refreshHistory();
        void this.loadLocations();
      } finally {
        this.flushing = false;
      }
      this.storage.discarded?.();
    });
  }
  /** Finish queued pointer work and retain its draft before a view is destroyed. */
  async flush(): Promise<void> {
    this.storage.assertCurrent?.();
    this.cancelDungeon();
    this.finishCity();
    this.finishStroke();
    this.finishDrag();
    this.releasePointer();
    this.flushing = true;
    try {
      await this.work;
      this.storage.assertCurrent?.();
      this.applyKeys();
      await this.persistence;
      this.storage.assertCurrent?.();
    } finally {
      this.flushing = false;
    }
  }
  /** Freeze authored work, hydrate the chosen export scope, and render one shareable image. */
  async captureMap(options: {
    readonly scope: "atlas" | "view";
    readonly width: number;
    readonly includeGrid: boolean;
  }): Promise<HTMLCanvasElement> {
    if (this.closed || this.inputBlocked)
      throw new Error("Atlas ist nicht für den Export bereit.");
    this.setInputBlocked(true);
    try {
      await this.flush();
      if (options.scope === "atlas" && this.storage.locations) {
        for (const placement of this.terrain.placements()) {
          this.storage.assertCurrent?.();
          const document = await this.storage.locations.ensure(placement.locationId);
          if (document) {
            this.loadedLocations.add(placement.locationId);
            this.renderer.location(document, placement.locationId);
          }
        }
      }
      this.storage.assertCurrent?.();
      return await this.renderer.captureMap(options);
    } finally {
      if (!this.closed) this.setInputBlocked(false);
    }
  }
  /** The navigator blocks input first, so only already requested visible data can finish. */
  async prepareNavigation(): Promise<void> {
    this.storage.assertCurrent?.();
    await this.init();
    this.storage.assertCurrent?.();
    await Promise.all([this.visibleLoad, this.locationLoad]);
    this.storage.assertCurrent?.();
    if (this.visibleLoadFailed) throw new Error("Landschaft konnte nicht geladen werden.");
    await this.flush();
    this.storage.assertCurrent?.();
  }
  private loadVisible(): Promise<void> {
    if (this.closed || this.inputBlocked) return this.visibleLoad;
    void this.loadLocations();
    if (this.loadingVisible || this.visibleLoadFailed) return this.visibleLoad;
    return this.visibleLoad = this.hydrateVisible();
  }
  private async hydrateVisible(): Promise<void> {
    this.loadingVisible = true;
    const source = this.terrain,
      bounds = this.renderer.visibleTerrainBounds(),
      count = source.cells().length;
    try {
      await source.ensureVisible(bounds);
      if (
        !this.closed &&
        source === this.terrain &&
        source.cells().length !== count
      )
        this.renderer.schedule();
    } catch (error) {
      if (!this.closed && source === this.terrain) {
        this.visibleLoadFailed = true;
        this.status.textContent =
          "Landschaft konnte nicht geladen werden. " + String(error);
      }
    } finally {
      this.loadingVisible = false;
      if (!this.closed && source !== this.terrain) this.renderer.schedule();
    }
  }
  private get selectedBuilding() {
    const hit = this.spatial?.selection;
    return hit?.kind === "building" ? hit : undefined;
  }
  private revealInspectorKey(target: readonly string[]): void {
    // Reset for a different Key, not for draft commits or History redraws of the same one.
    const key = JSON.stringify(target);
    if (this.inspector && this.inspectorKey !== key) this.inspector.scrollTop = 0;
    this.inspectorKey = key;
  }
  private syncLocations(): void {
    if (this.inspector) {
      this.inspector.hidden = !this.selectedLocation && !this.selectedRoom && !this.selectedBuilding && !this.pendingKey;
      if (this.inspector.hidden) this.inspectorKey = undefined;
    }
    if (this.detailEntry && this.detailHost) {
      this.detailHost.hidden = !this.selectedLocation || !!this.selectedBuilding;
      if (this.selectedLocation) this.detailEntry.update(this.storage.navigation!.details(this.selectedLocation));
    }
    if (this.selectedBuilding && this.cityKey) {
      if (this.key) this.key.host.hidden = true;
      if (this.roomKey) this.roomKey.host.hidden = true;
      this.cityKey.show(this.selectedBuilding.ownerId, this.selectedBuilding.elementId);
      this.revealInspectorKey(["building", this.selectedBuilding.ownerId, this.selectedBuilding.elementId]);
      this.selection.textContent = "Haus bearbeiten";
      return;
    }
    if (this.cityKey) this.cityKey.host.hidden = true;
    if (this.selectedRoom && this.roomKey) {
      if (this.key) this.key.host.hidden = true;
      this.roomKey.show(this.selectedRoom.ownerId, this.selectedRoom.roomId);
      this.revealInspectorKey(["room", this.selectedRoom.ownerId, this.selectedRoom.roomId]);
      this.selection.textContent = "Raum-Key";
      return;
    }
    const port = this.storage.locations;
    if (!port) return;
    for (const id of this.loadedLocations)
      this.renderer.location(port.read(id), id);
    const id = this.selectedLocation;
    const document = id && this.loadedLocations.has(id) ? port.read(id) : null;
    if (
      document &&
      this.terrain.placements().some((p) => p.locationId === id)
    ) {
      this.key?.show(document);
      if (this.key) this.key.host.hidden = false;
      this.revealInspectorKey(["location", document.id]);
      this.selection.textContent = `${document.type === "city" ? "Stadt" : "POI"}: ${document.name}`;
    } else if (!this.pendingKey) this.key?.clear();
    this.renderer.selectedLocation = id;
  }
  private loadLocations(): Promise<void> {
    if (this.closed || this.inputBlocked || this.loadingLocations) return this.locationLoad;
    return this.locationLoad = this.hydrateLocations();
  }
  private async hydrateLocations(): Promise<void> {
    const port = this.storage.locations;
    if (!port || this.loadingLocations || this.closed) return;
    this.loadingLocations = true;
    const source = this.terrain;
    let changed = false;
    try {
      const ids = new Set(this.renderer.visibleLocationIds());
      if (
        this.selectedLocation &&
        source.placements().some((p) => p.locationId === this.selectedLocation)
      )
        ids.add(this.selectedLocation);
      for (const id of [...ids]
        .filter(
          (id) =>
            !this.loadedLocations.has(id) && !this.failedLocations.has(id),
        )
        .slice(0, 40)) {
        try {
          await port.ensure(id);
          if (this.closed || source !== this.terrain) return;
          this.loadedLocations.add(id);
          this.renderer.location(port.read(id), id);
          changed = true;
        } catch (error) {
          if (source !== this.terrain || this.closed) return;
          this.failedLocations.add(id);
          this.status.textContent =
            "Ort konnte nicht geladen werden. " + String(error);
        }
      }
      if (changed && !this.closed && source === this.terrain) {
        this.syncLocations();
        this.renderer.schedule();
      }
    } finally {
      this.loadingLocations = false;
    }
  }
  private createLocation(type: "city" | "poi"): void {
    this.finishStroke();
    this.cancelDrag();
    this.enqueue(() => {
      this.applyKeys();
      const id = crypto.randomUUID(),
        document = newLocation(
          id,
          type === "city" ? "Neue Stadt" : "Neuer POI",
          type,
          [crypto.randomUUID(), crypto.randomUUID()],
        );
      if (
        !this.storage.locations!.create(document, {
          kind: "location",
          id: crypto.randomUUID(),
          locationId: id,
          position: { ...this.renderer.camera.center },
        })
      )
        throw new Error("Ort konnte nicht angelegt werden.");
      this.loadedLocations.add(id);
      ++this.selectionVersion;
      this.selectedLocation = id;
      this.cityKey?.clear();
      if (this.spatial) this.spatial.selection = undefined;
      this.syncLocations();
      this.renderer.schedule();
      this.key?.focusName();
    });
  }
  private selectLocation(id: string): void {
    const source = this.terrain,
      version = ++this.selectionVersion;
    this.enqueue(async () => {
      this.applyKeys();
      await this.storage.locations!.ensure(id);
      if (
        this.closed ||
        version !== this.selectionVersion ||
        source !== this.terrain ||
        !source.placements().some((p) => p.locationId === id)
      )
        return;
      this.loadedLocations.add(id);
      this.applyKeys();
      this.cityKey?.clear();
      this.roomKey?.clear();
      this.selectedRoom = undefined;
      if (this.spatial) { this.spatial.selectedRoom = undefined; this.spatial.selection = undefined; }
      this.selectedLocation = id;
      this.renderer.selected = undefined;
      this.syncLocations();
      this.renderer.schedule();
    });
  }
  private cancelDrag(): void {
    this.drag = undefined;
    if (this.renderer) {
      this.renderer.locationPreview = undefined;
      this.renderer.schedule();
    }
  }
  private finishDrag(): void {
    const drag = this.drag,
      moved = this.pointer?.moved;
    this.cancelDrag();
    if (!drag || !moved) return;
    this.enqueue(() => {
      this.applyKeys();
      if (
        !this.loadedLocations.has(drag.id) ||
        !this.storage.locations!.read(drag.id)
      )
        throw new Error("Orts-Key muss vor dem Verschieben geladen sein.");
      if (
        drag.source !== this.terrain ||
        !sameAtlasValue(
          drag.placements,
          this.terrain.placements() as unknown as AtlasValue,
        )
      )
        throw new Error(
          "Ortsposition wurde inzwischen geändert. Verschiebung abgebrochen.",
        );
      this.storage.locations!.move(drag.id, drag.position);
    });
  }
  private local(event: MouseEvent): WorldPoint {
    const r = this.viewport.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  private address(event: MouseEvent, level = 0) {
    return hexAt(
      this.renderer.world,
      this.renderer.worldPoint(this.local(event)),
      level,
    );
  }
  private paint(event: MouseEvent): void {
    const stroke = this.stroke;
    if (!stroke) return;
    const address = this.address(event);
    this.enqueue(async () => {
      await this.terrain.ensure(stroke.next(address));
      if (this.closed || this.cancelledStrokes.has(stroke)) return;
      stroke.add(address);
      this.renderer.preview = stroke.preview();
      this.renderer.schedule();
    });
  }
  /** Pointer-up/Save commits; Escape, blur and pointer cancellation discard the unfinished preview. */
  private finishStroke(): void {
    const stroke = this.stroke;
    if (!stroke) return;
    this.stroke = undefined;
    this.enqueue(() => {
      stroke.finish();
      this.renderer.preview = [];
      this.renderer.schedule();
    });
  }
  private historyAction(action: "undo" | "redo"): void {
    this.cancelDungeon();
    try {
      this.finishCity();
    } catch (error) {
      this.status.textContent = String(error);
      return;
    }
    this.finishStroke();
    this.cancelDrag();
    this.enqueue(() => {
      this.applyKeys();
      this.terrain.history[action]();
    });
  }
  private zoom(factor: number): void {
    if (this.stroke || this.drag || this.cityDrag || this.dungeonDrag) return;
    this.renderer.zoom(
      { x: this.viewport.clientWidth / 2, y: this.viewport.clientHeight / 2 },
      factor,
    );
  }
  private releasePointer(): void {
    if (this.pointer && this.viewport.hasPointerCapture(this.pointer.id))
      this.viewport.releasePointerCapture(this.pointer.id);
    this.pointer = undefined;
  }
  private bind(): void {
    const opts = { signal: this.abort.signal },
      win = this.root.ownerDocument.defaultView!;
    this.viewport.addEventListener(
      "pointerdown",
      (e) => {
        if ((e.button !== 0 && e.button !== 1) || this.pointer || this.flushing || this.inputBlocked || this.closed)
          return;
        try {
          this.storage.assertCurrent?.();
          this.applyKeys();
        } catch (error) {
          this.status.textContent = String(error);
          return;
        }
        e.preventDefault();
        this.viewport.focus();
        this.viewport.setPointerCapture(e.pointerId);
        let action: PointerAction =
          e.button === 1 || this.space || this.tool === "hand"
            ? "pan"
            : this.tool === "select"
              ? "select"
              : "paint";
        const locationId =
          action === "select" && this.storage.locations
            ? this.renderer.locationAt(this.local(e))
            : undefined;
        if (locationId) {
          const placement = this.terrain
            .placements()
            .find((p) => p.locationId === locationId)!;
          action = "location";
          this.drag = {
            id: locationId,
            source: this.terrain,
            placements: this.terrain.placements() as unknown as AtlasValue,
            metersPerPixel: this.renderer.camera.metersPerPixel,
            origin: placement.position,
            position: placement.position,
          };
          this.selectLocation(locationId);
        }
        if (action === "select" && this.spatial) {
          const hit = this.spatial.hit(this.local(e));
          if (hit?.kind === "room") {
            this.cityKey?.clear();
            this.key?.clear();
            this.selectedLocation = undefined;
            this.selectedRoom = { ownerId: hit.ownerId, roomId: hit.roomId };
            this.spatial.selectedRoom = this.selectedRoom;
            this.spatial.selection = undefined;
            this.renderer.selected = undefined;
            this.renderer.selectedLocation = undefined;
            this.syncLocations();
            action = "room";
            try {
              const geometry = this.spatial.roomGeometry(
                this.local(e),
                hit.ownerId,
                hit.roomId,
              );
              if (!geometry) throw new Error("Raumgeometrie ist nicht sichtbar.");
              let gesture!: DungeonGeometryGesture;
              gesture = new DungeonGeometryGesture(this.storage.spatial!, {
                ownerId: hit.ownerId,
                floorId: geometry.floorId,
                roomId: hit.roomId,
                pointer: geometry.point,
                tolerance:
                  (this.renderer.relativeCamera.metersPerPixel *
                    buildingPointGripPixels) /
                  geometry.frame.metersPerUnit,
                invalidated: () => {
                  if (this.dungeonDrag?.gesture !== gesture) return;
                  this.dungeonDrag = undefined;
                  if (this.spatial) this.spatial.dungeonPreview = undefined;
                  this.renderer.schedule();
                },
              });
              this.dungeonDrag = {
                gesture,
                frame: gesture.basis.frame,
                camera: Object.freeze({ ...this.renderer.relativeCamera }),
              };
              action = "dungeon";
              this.selection.textContent = "Raumkonturpunkt verschieben";
            } catch (error) {
              if (
                !String(error).includes("äußerer Raumkonturpunkt") &&
                !String(error).includes("Gesperrter Raum")
              )
                this.status.textContent = String(error);
            }
          } else if (hit?.kind === "city") {
            this.cityKey?.clear();
            this.roomKey?.clear();
            this.selectedRoom = undefined;
            this.spatial.selectedRoom = undefined;
            this.spatial.selection = hit.hit;
            this.selectedLocation = undefined;
            this.key?.clear();
            this.renderer.selectedLocation = undefined;
            this.syncLocations();
            this.renderer.selected = undefined;
            action = "city";
            if (hit.hit.kind === "building" || hit.hit.kind === "node") {
              const target =
                hit.hit.kind === "building"
                  ? {
                      kind: "move-building" as const,
                      ownerId: hit.hit.ownerId,
                      buildingId: hit.hit.elementId,
                    }
                  : {
                      kind: "move-node" as const,
                      ownerId: hit.hit.ownerId,
                      nodeId: hit.hit.elementId,
                    };
              this.cityDrag = {
                gesture: new CityGesture(
                  this.storage.spatial!.city(hit.hit.ownerId),
                  target,
                  unprojectLocal(
                    hit.frame,
                    this.renderer.relativeCamera,
                    this.renderer.viewport,
                    this.local(e),
                  ),
                ),
                frame: hit.frame,
                camera: this.renderer.relativeCamera,
                valid: true,
              };
            }
            this.selection.textContent =
              hit.hit.kind === "building" ? "Haus verschieben" : "Stadtelement";
          }
          this.renderer.schedule();
        }
        this.pointer = {
          id: e.pointerId,
          action,
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        if (action === "paint") {
          const tool = this.tool as TerrainTool;
          this.stroke = new TerrainStroke(
            this.terrain,
            tool,
            tool === "land"
              ? this.landColor
              : tool === "reset"
                ? TERRAIN_COLORS.land
                : TERRAIN_COLORS[tool],
          );
          this.paint(e);
        }
      },
      opts,
    );
    win.addEventListener(
      "pointermove",
      (e) => {
        const p = this.pointer;
        if (!p) {
          if (
            e.target === this.viewport ||
            this.viewport.contains(e.target as Node)
          ) {
            this.renderer.hover =
              this.tool === "select" || this.tool === "hand"
                ? undefined
                : this.address(e);
            this.renderer.schedule();
          }
          return;
        }
        if (p.id !== e.pointerId) return;
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 3)
          p.moved = true;
        if (p.action === "pan")
          this.renderer.pan(e.clientX - p.x, e.clientY - p.y);
        if (p.action === "paint") this.paint(e);
        if (p.action === "location" && this.drag && p.moved) {
          this.drag.position = {
            x:
              this.drag.origin.x +
              (e.clientX - p.startX) * this.drag.metersPerPixel,
            y:
              this.drag.origin.y +
              (e.clientY - p.startY) * this.drag.metersPerPixel,
          };
          this.renderer.locationPreview = {
            id: this.drag.id,
            position: this.drag.position,
          };
          this.renderer.schedule();
        }
        if (p.action === "city" && this.cityDrag && p.moved) {
          const drag = this.cityDrag;
          try {
            const preview = drag.gesture.update(
              unprojectLocal(
                drag.frame,
                drag.camera,
                this.renderer.viewport,
                this.local(e),
              ),
            );
            this.terrain.history.check({
              label: "Stadt verschieben",
              changes: [
                cityDocumentChange(drag.gesture.before, preview.document),
              ],
            });
            drag.valid = true;
            drag.error = undefined;
            this.spatial!.preview = preview.document;
          } catch (error) {
            drag.valid = false;
            drag.error = error;
            this.spatial!.preview = undefined;
            this.status.textContent = String(error);
          }
          this.renderer.schedule();
        }
        if (p.action === "dungeon" && this.dungeonDrag && p.moved) {
          const drag = this.dungeonDrag;
          try {
            const preview = drag.gesture.sample(
              () => unprojectLocal(
                drag.frame,
                drag.camera,
                this.renderer.viewport,
                this.local(e),
              ),
              !e.altKey,
            );
            this.spatial!.dungeonPreview = preview?.preview;
          } catch (error) {
            this.spatial!.dungeonPreview = undefined;
            this.status.textContent = String(error);
          }
          this.renderer.schedule();
        }
        p.x = e.clientX;
        p.y = e.clientY;
      },
      opts,
    );
    win.addEventListener(
      "pointerup",
      (e) => {
        const p = this.pointer;
        if (!p || p.id !== e.pointerId) return;
        if (p.action === "paint") {
          this.paint(e);
          this.finishStroke();
        }
        if (p.action === "location") this.finishDrag();
        if (p.action === "city") {
          try {
            this.finishCity();
          } catch (error) {
            this.status.textContent = String(error);
            return;
          }
        }
        if (p.action === "dungeon") {
          try {
            this.finishDungeon();
          } catch (error) {
            this.cancelDungeon();
            this.status.textContent = String(error);
          }
        }
        if (!p.moved && p.action === "select") {
          ++this.selectionVersion;
          this.selectedLocation = undefined;
          this.key?.clear();
          this.cityKey?.clear();
          this.roomKey?.clear();
          this.selectedRoom = undefined;
          if (this.spatial) {
            this.spatial.selection = undefined;
            this.spatial.selectedRoom = undefined;
          }
          this.renderer.selectedLocation = undefined;
          this.syncLocations();
          const a = this.address(e, this.renderer.level);
          this.renderer.selected = a;
          this.renderer.schedule();
          this.selection.textContent = `${3 * 3 ** a.level} Meilen: Hex ${a.q}, ${a.r}`;
          this.selection.dataset.hexAddress = hexAddressKey(a);
          this.selection.dataset.hexQ = String(a.q);
          this.selection.dataset.hexR = String(a.r);
        }
        this.releasePointer();
      },
      opts,
    );
    const cancel = () => {
      this.cancelCity();
      this.cancelDungeon();
      this.cancelStroke();
      this.cancelDrag();
      this.releasePointer();
      this.space = false;
    };
    win.addEventListener("pointercancel", cancel, opts);
    win.addEventListener("blur", cancel, opts);
    this.viewport.addEventListener(
      "pointerleave",
      () => {
        this.renderer.hover = undefined;
        this.renderer.schedule();
      },
      opts,
    );
    win.addEventListener(
      "keydown",
      (e) => {
        if (this.inputBlocked || this.closed) return;
        const focused = this.root.ownerDocument.activeElement;
        if (focused !== this.viewport) return;
        // The View Scope already routed and consumed this Save. Obsidian leaves
        // other Window capture listeners running after stopPropagation().
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && e.defaultPrevented) return;
        if (this.escapeInspector(e)) return;
        if (
          (e.ctrlKey || e.metaKey) &&
          ["s", "z", "y"].includes(e.key.toLowerCase())
        )
          e.stopImmediatePropagation();
        if (e.code === "Space") {
          this.space = true;
          if (this.pointer?.action === "paint") {
            this.finishStroke();
            this.pointer.action = "pan";
          }
          if (this.pointer?.action === "location") {
            this.cancelDrag();
            this.pointer.action = "pan";
          }
          if (this.pointer?.action === "dungeon") {
            this.cancelDungeon();
            this.pointer.action = "pan";
          }
          e.preventDefault();
        }
        if (e.key === "Escape") {
          this.cancelCity();
          this.cancelDungeon();
          this.cancelStroke();
          this.cancelDrag();
          this.releasePointer();
          e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          this.save();
          e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          this.historyAction(e.shiftKey ? "redo" : "undo");
          e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
          this.historyAction("redo");
          e.preventDefault();
        } else if (e.key === "+" || e.key === "=") {
          this.zoom(0.8);
          e.preventDefault();
        } else if (e.key === "-") {
          this.zoom(1.25);
          e.preventDefault();
        }
      },
      { ...opts, capture: true },
    );
    win.addEventListener(
      "keyup",
      (e) => {
        if (e.code === "Space") this.space = false;
      },
      opts,
    );
    this.viewport.addEventListener(
      "wheel",
      (e) => {
        if (
          this.inputBlocked || this.closed ||
          !e.ctrlKey ||
          this.stroke ||
          this.drag ||
          this.cityDrag ||
          this.dungeonDrag
        )
          return;
        e.preventDefault();
        this.renderer.zoom(
          this.local(e),
          Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.002))),
        );
      },
      { ...opts, passive: false },
    );
    this.viewport.addEventListener(
      "contextmenu",
      (e) => e.preventDefault(),
      opts,
    );
  }
  destroy(): void {
    this.detailEntry?.destroy();
    this.cancelDungeon();
    this.closed = true;
    this.abort.abort();
    this.unsubscribe();
    this.key?.destroy();
    this.roomKey?.destroy();
    this.cityKey?.destroy();
    this.spatial?.destroy();
    this.renderer.destroy();
    this.root.classList.remove("dn-atlas");
    delete this.root.dataset.worldId;
  }
}
