import type { App } from "obsidian";
import {
  type Entity,
  type Point,
  type Building,
  type Room,
  type Wall,
  type Boundary,
  type Surface,
  type MapPath,
  type Roof,
  type Polygon,
  isRoom,
  isStructuredRoom,
  uid,
} from "./model";
import { StructuredKeyPanel } from "./key-panel";
import { wheelNavigation } from "./navigation";
import { type RecordChange, Session } from "./session";
import { MapRepository } from "./persistence";
import {
  adoptFloorAsRoom,
  createPortal,
  createWall,
  createSurface,
  createMapPath,
  createRoof,
  createObject,
  objectAtPoint,
  scatterObjects,
  createLight,
  addFloor,
  duplicateFloor,
  editNote,
  planBuildingMutation,
  planBuildingContourMutation,
} from "./commands";
import {
  ellipse,
  buildingEllipse,
  alignedPortalAt,
  nearestBoundary,
  rectangle,
  moveEntity,
  hit,
  smoothPath,
  buildingPolygonPoints,
  type BuildingCurve,
  portalPose,
  buildingContourEntries,
  nearestBuildingVertex,
  nearestBuildingSegment,
  replaceBuildingContour,
} from "./geometry";
import { MapRenderer, type ColorableObjectSource } from "./renderer";
import { createPrefab as createPrefabDefinition, placePrefab, type Prefab } from "./prefabs";
import { ComputeClient } from "./worker-client";
import { type ComposeBuildingResult } from "./compute";
import {
  Properties,
  toolSettings,
  type Tool,
  type ToolSettings,
} from "./properties";
import { type AssetDefinition } from "./assets";
import { floorEraseActive } from "./drawing";
import {
  buildingPointGripPixels,
  buildingVertexGrip,
  buildingEdgeMidpointGrip,
  buildingPointDragDestination,
  proposeBuildingPointDrag,
  planBuildingBackspacePoint,
  type BuildingVertexGrip,
  type BuildingEdgeGrip,
} from "./features/bau/building-point-gestures";
import {
  previewBuildingMutationWithPortals,
} from "./features/bau/building-edge-portal-preview";
import { archiveEntities, archiveFloor, executeLinkedObjectChanges } from "./content";
import { setIcon } from "obsidian";
import {
  selectableByClick,
  selectionAllowed,
  selectionMirrorChanges,
  selectionTransformAt,
  selectionFrameTransformAt,
  selectionInsideBox,
  transformSelectionGroup,
  scaleBoxSelection,
  rotateBoxSelection,
  selectionStackChange,
  nativeSelectionTypes,
  selectionTypes as selectionTypeOptions,
  selectionLayers as selectionLayerOptions,
  captureSelectionClipboard,
  copyAtViewportCenter,
  type SelectionClipboard,
  type SelectionType,
  type SelectionLayer,
  type TransformSelection,
  type SelectionFrame,
  type SelectionTransform,
} from "./selection";

interface Gesture {
  pointer: number;
  tool: Tool;
  temporaryPan?: boolean;
  start: Point;
  startLocal: Point;
  last: Point;
  marqueePrevious?: Point;
  entity?: Entity;
  transform?: {
    source: TransformSelection;
    action: SelectionTransform;
    blank: boolean;
    frame?: SelectionFrame;
  };
  groupTransform?: {
    sources: TransformSelection[];
    frame: SelectionFrame;
    action: SelectionTransform;
    blank: boolean;
  };
  contour?: number;
  corner?: number;
  ridge?: number;
  buildingVertex?: BuildingVertexGrip;
  buildingEdge?: BuildingEdgeGrip;
  buildingPreviewDestination?: Point;
  moved: boolean;
  curve?: boolean;
  points: Point[];
  erase: boolean;
}
interface PathDraft {
  tool: "polygon" | "corridor" | "wall" | "pattern" | "path" | "roof" | "water";
  points: Point[];
  erase: boolean;
  smooth: boolean;
  curves?: BuildingCurve[];
  sourceId?: string;
}
function isFloorTool(
  tool: Tool,
): tool is "room" | "polygon" | "ellipse" | "corridor" {
  return (
    tool === "room" ||
    tool === "polygon" ||
    tool === "ellipse" ||
    tool === "corridor"
  );
}
export interface EditorHost {
  app: App;
  notice: (message: string) => void;
  openNote: (path: string) => void;
  openRoomKey: (roomId: string, sectionId?: string, anchor?: string) => void;
  mapPath: string;
  save: () => Promise<void>;
  pending?: () => boolean;
  assetUrl: (path: string) => string;
  colorableObjectSource?: (id: string) => ColorableObjectSource | undefined;
  manageAssets?: () => void;
  manageMap?: () => void;
  manageMapInfo?: () => void;
  manageReferences?: (floorId: string) => void;
  manageGenerator?: (floorId: string) => void;
  manageContent?: (floorId: string, selectedId?: string) => void;
  exportMap?: (renderer: MapRenderer, session: Session) => void;
  openPlay?: (roomId?: string) => void;
  assets?: () => readonly AssetDefinition[];
  subscribeAssets?: (listener: () => void) => () => void;
  toolDefaults?: () => ToolSettings;
  persistToolDefaults?: () => void;
  prefabs?: () => readonly Prefab[];
  savePrefab?: (prefab: Prefab) => Promise<void>;
  forgetPrefab?: (prefab: Prefab, doc: Document, signal: AbortSignal) => Promise<boolean>;
  requestPrefabDetails?: () => Promise<{ set: string; name: string } | null>;
  exitEditor?: () => void;
}
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  parent.append(el);
  return el;
}
function addSelectionFilter<T extends string>(
  parent: HTMLElement,
  title: string,
  options: readonly (readonly [T, string])[],
  selected: Set<T>,
): void {
  const panel = element("details", "dn-selection-subfilter", parent),
    summary = element("summary", "", panel),
    rows = element("div", "dn-selection-filter", panel),
    inputs = new Map<T, HTMLInputElement>(),
    allRow = element("label", "dn-filter-kind", rows),
    all = element("input", "", allRow);
  all.type = "checkbox";
  all.setAttribute("aria-label", title + ": Alle");
  element("span", "", allRow, "Alle");
  const refresh = () => {
    const count = selected.size;
    summary.textContent = `${title} · ${count === options.length ? "Alle" : count === 0 ? "Keine" : count}`;
    all.checked = count === options.length;
    all.indeterminate = count > 0 && count < options.length;
    for (const [value, input] of inputs) input.checked = selected.has(value);
  };
  all.addEventListener("change", () => {
    selected.clear();
    if (all.checked) for (const [value] of options) selected.add(value);
    refresh();
  });
  for (const [value, label] of options) {
    const row = element("label", "dn-filter-kind", rows),
      input = element("input", "", row);
    input.type = "checkbox";
    input.setAttribute("aria-label", `${title}: ${label}`);
    element("span", "", row, label);
    inputs.set(value, input);
    input.addEventListener("change", () => {
      if (input.checked) selected.add(value);
      else selected.delete(value);
      refresh();
    });
  }
  refresh();
}
function nearestRawSegment(
  point: Point,
  points: readonly Point[],
  closed: boolean,
): { index: number; distance: number } {
  let best = { index: 0, distance: Infinity };
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index++) {
    const a = points[index]!,
      b = points[(index + 1) % points.length]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      ),
      distance = Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t);
    if (distance < best.distance) best = { index, distance };
  }
  return best;
}
function nearestInsertionSegment(
  point: Point,
  entity: Wall | MapPath | Roof,
): { index: number; distance: number } {
  const closed =
      entity.kind === "roof" || entity.closed,
    smooth =
      (entity.kind === "wall" || entity.kind === "path") && entity.smooth;
  const points = entity.points;
  if (!smooth) return nearestRawSegment(point, points, closed);
  const steps = 8,
    nearest = nearestRawSegment(
      point,
      smoothPath(points, closed, steps),
      closed,
    ),
    segmentCount = closed ? points.length : points.length - 1;
  return {
    index: Math.min(segmentCount - 1, Math.floor(nearest.index / steps)),
    distance: nearest.distance,
  };
}
function replaceContour(
  entity: Entity,
  points: readonly Point[],
  contour = 0,
): Entity {
  if (entity.kind === "building")
    return replaceBuildingContour(entity, contour, points);
  if (entity.kind === "surface")
    return { ...entity, polygons: [{ outer: points, holes: [] }] };
  if (
    entity.kind === "wall" ||
    entity.kind === "path" ||
    entity.kind === "roof"
  )
    return { ...entity, points };
  throw new Error("Dieses Element besitzt keine bearbeitbare Kontur.");
}
export class DungeonEditor {
  readonly renderer: MapRenderer;
  private abort = new AbortController();
  private unsub?: () => void;
  private assetUnsub?: () => void;
  private gesture?: Gesture;
  private objectPreviewPoint?: Point;
  private tool: Tool = "select";
  private previousTool?: Tool;
  private previousToolButton: HTMLButtonElement;
  private deleteSelectionButton: HTMLButtonElement;
  private copySelectionButton: HTMLButtonElement;
  private pasteSelectionButton: HTMLButtonElement;
  private lockSelectionButton: HTMLButtonElement;
  private mirrorSelectionButton: HTMLButtonElement;
  private bringToFrontButton: HTMLButtonElement;
  private sendToBackButton: HTMLButtonElement;
  private makePrefabButton: HTMLButtonElement;
  private separatePrefabButton: HTMLButtonElement;
  private forgetPrefabButton: HTMLButtonElement;
  private forgettingPrefab = false;
  private prefabSetChoice: HTMLSelectElement;
  private prefabChoice: HTMLSelectElement;
  private prefabPanel: HTMLDetailsElement;
  private space = false;
  private selected?: string;
  private selection = new Set<string>();
  private hoveredBuildingVertex?: BuildingVertexGrip;
  private clipboard?: SelectionClipboard;
  private closed = false;
  private saving = false;
  private toolbar: HTMLElement;
  private inspector: HTMLElement;
  private status: HTMLElement;
  private text: HTMLTextAreaElement;
  private floor: HTMLSelectElement;
  private undo: HTMLButtonElement;
  private redo: HTMLButtonElement;
  private saveButton: HTMLButtonElement;
  private snapButton: HTMLButtonElement;
  private maximizeButton: HTMLButtonElement;
  private saveState: HTMLElement;
  private title: HTMLElement;
  private body: HTMLElement;
  private groupRail: HTMLElement;
  private toolRail: HTMLElement;
  private optionTitle: HTMLElement;
  private propertiesHost: HTMLElement;
  private selectionPanel: HTMLDetailsElement;
  private floorPanel: HTMLDetailsElement;
  private emptyPanel: HTMLElement;
  private keyDock: HTMLElement;
  private structuredHost: HTMLElement;
  private structuredPanel?: StructuredKeyPanel;
  private openKeyButton: HTMLButtonElement;
  private optionsToggle: HTMLButtonElement;
  private keyButton?: HTMLButtonElement;
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private toolGroups = new Map<Tool, string>();
  private toolLabels = new Map<Tool, string>();
  private groupButtons = new Map<string, HTMLButtonElement>();
  private panelButtons = new Map<string, HTMLButtonElement>();
  private homeParent?: Node;
  private homeNext?: ChildNode | null;
  private notePath?: string;
  private noteBase = "";
  private selectionToken = 0;
  private properties: Properties;
  private settings: ToolSettings;
  private compare: HTMLSelectElement;
  private readonly selectionTypes = new Set<SelectionType>(
    nativeSelectionTypes.map(([value]) => value),
  );
  private readonly selectionLayers = new Set<SelectionLayer>(
    selectionLayerOptions.map(([value]) => value),
  );
  private referenceAlpha = 0.2;
  private currentAlpha = 1;
  private gridVisible = true;
  private snapEnabled = true;
  private paintWorker?: ComputeClient;
  private paintTask?: Promise<void>;
  private paintGeneration = 0;
  private pathDraft?: PathDraft;
  lastPaintMetrics?: {
    points: number;
    computeMs: number;
    commitMs: number;
    totalMs: number;
  };
  constructor(
    readonly root: HTMLElement,
    readonly session: Session,
    readonly repository: MapRepository,
    readonly host: EditorHost,
  ) {
    this.settings = host.toolDefaults?.() ?? toolSettings();
    this.homeParent = root.parentNode ?? undefined;
    this.homeNext = root.nextSibling;
    root.classList.add("dungeon-native-editor");
    root.tabIndex = -1;
    this.toolbar = element("header", "dn-toolbar", root);
    this.title = element(
      "strong",
      "dn-title",
      this.toolbar,
      session.settings.name,
    );
    this.saveState = element("span", "dn-save-state", this.toolbar);
    this.undo = this.iconButton("Rückgängig", "undo-2", () =>
      this.run(() => this.stepHistory("undo")),
    );
    this.redo = this.iconButton("Wiederholen", "redo-2", () =>
      this.run(() => this.stepHistory("redo")),
    );
    this.saveButton = this.button("Speichern", () => void this.save());
    const menu = element("details", "dn-menu dn-popover-menu", this.toolbar);
    element("summary", "", menu, "▶ Menü");
    const menuContent = element("div", "dn-menu-content", menu);
    if (host.exportMap)
      this.button("Exportieren", () => host.exportMap!(this.renderer, this.session), menuContent);
    if (host.openPlay)
      this.button(
        "Spielansicht",
        () => {
          const selected = this.selected
              ? this.session.entities.get(this.selected)
              : undefined,
            roomId = isRoom(selected) ? selected.id : selected?.roomId;
          host.openPlay!(roomId);
        },
        menuContent,
      );
    this.optionsToggle = this.button(
      "Optionen",
      () => {
        const open = this.root.classList.toggle("dn-options-open");
        this.optionsToggle.setAttribute("aria-expanded", String(open));
      },
      this.toolbar,
    );
    this.optionsToggle.classList.add("dn-options-toggle");
    this.optionsToggle.setAttribute("aria-expanded", "false");
    this.maximizeButton = this.button("Maximieren", () => {
      const maximized = this.root.classList.contains("dn-maximized");
      if (maximized && this.host.exitEditor) this.leaveMaximized();
      else this.setMaximized(!maximized);
    });
    this.maximizeButton.classList.add("dn-back-button");

    this.body = element("div", "dn-body", root);
    this.groupRail = element("nav", "dn-group-rail", this.body);
    this.groupRail.setAttribute("aria-label", "Werkzeuggruppen");
    this.toolRail = element("nav", "dn-tool-rail", this.body);
    this.toolRail.setAttribute("aria-label", "Werkzeuge");
    this.inspector = element("aside", "dn-inspector", this.body);
    this.optionTitle = element("h2", "", this.inspector, "Auswahl");
    this.propertiesHost = element("div", "dn-properties", this.inspector);
    this.properties = new Properties(
      this.propertiesHost,
      session,
      this.settings,
      host.notice,
      host.assets,
      host.assetUrl,
      () => {
        host.persistToolDefaults?.();
        this.refreshObjectPreview();
      },
      (id) => this.adoptFloor(id),
      (id, color, alpha) => this.renderer.previewObjectColor(id, color, alpha),
      (id) => this.renderer.clearObjectColorPreview(id),
      host.colorableObjectSource,
    );

    this.selectionPanel = element(
      "details",
      "dn-option-section",
      this.inspector,
    );
    this.selectionPanel.open = true;
    element("summary", "", this.selectionPanel, "Auswahlaktionen");
    const selectionControls = element(
      "div",
      "dn-menu-content",
      this.selectionPanel,
    );
    addSelectionFilter(selectionControls, "Objektarten", selectionTypeOptions, this.selectionTypes);
    addSelectionFilter(selectionControls, "Zeichenebenen", selectionLayerOptions, this.selectionLayers);
    this.deleteSelectionButton = this.button(
      "Löschen",
      () => this.run(() => this.archiveSelection()),
      selectionControls,
    );
    this.copySelectionButton = this.button(
      "Kopieren",
      () => this.run(() => this.copySelection()),
      selectionControls,
    );
    this.pasteSelectionButton = this.button(
      "Einfügen",
      () => this.run(() => this.pasteSelection()),
      selectionControls,
    );
    this.mirrorSelectionButton = this.button(
      "Spiegeln",
      () => this.run(() => this.mirrorSelection()),
      selectionControls,
    );
    this.mirrorSelectionButton.disabled = true;
    this.lockSelectionButton = this.button(
      "Sperren",
      () => this.run(() => this.toggleSelectionLock()),
      selectionControls,
    );
    this.lockSelectionButton.disabled = true;
    this.previousToolButton = this.button(
      "Vorheriges Werkzeug",
      () => {
        const previous = this.previousTool;
        if (previous && previous !== "select") this.setTool(previous);
      },
      selectionControls,
    );
    this.previousToolButton.disabled = true;
    this.makePrefabButton = this.button(
      "Vorlage erstellen",
      () => void this.makePrefab(),
      selectionControls,
    );
    this.separatePrefabButton = this.button(
      "Vorlage lösen",
      () => this.run(() => this.separatePrefab()),
      selectionControls,
    );
    this.button(
      "Gruppieren",
      () => this.run(() => this.groupSelection()),
      selectionControls,
    );
    this.button(
      "Gruppierung lösen",
      () => this.run(() => this.ungroupSelection()),
      selectionControls,
    );
    this.bringToFrontButton = this.button(
      "Ganz nach vorn",
      () => this.run(() => this.reorderSelection("front")),
      selectionControls,
    );
    this.sendToBackButton = this.button(
      "Ganz nach hinten",
      () => this.run(() => this.reorderSelection("back")),
      selectionControls,
    );
    this.inspector.insertBefore(this.selectionPanel, this.propertiesHost);
    this.prefabPanel = element("details", "dn-option-section", this.inspector);
    this.prefabPanel.open = true;
    element("summary", "", this.prefabPanel, "Zeichenvorlagen");
    const prefabControls = element("div", "dn-menu-content", this.prefabPanel);
    element("p", "dn-help", prefabControls, "Sammlung");
    this.prefabSetChoice = element("select", "dn-floor", prefabControls);
    this.prefabSetChoice.setAttribute("aria-label", "Sammlung");
    this.prefabSetChoice.addEventListener("change", () => {
      this.refreshPrefabs(undefined, this.prefabSetChoice.value);
      this.renderer.cancelPreview();
    });
    this.prefabChoice = element("select", "dn-floor", prefabControls);
    this.prefabChoice.setAttribute("aria-label", "Vorlage");
    this.prefabChoice.addEventListener("change", () => {
      this.forgetPrefabButton.disabled = this.forgettingPrefab ||
        !this.prefabChoice.value || !this.host.forgetPrefab;
    });
    this.forgetPrefabButton = this.button(
      "Vorlage vergessen",
      () => void this.forgetPrefab(),
      prefabControls,
    );
    element("p", "dn-help", prefabControls, "Vorlage wählen und auf die Karte klicken.");
    this.refreshPrefabs();
    this.floorPanel = element("details", "dn-option-section", this.inspector);
    this.floorPanel.open = true;
    element("summary", "", this.floorPanel, "Geschosse");
    const floorControls = element("div", "dn-menu-content", this.floorPanel);
    this.floor = element("select", "dn-floor", floorControls);
    this.floor.setAttribute("aria-label", "Geschoss");
    this.compare = element("select", "dn-floor", floorControls);
    this.compare.setAttribute("aria-label", "Vergleichsgeschoss");
    this.refreshFloors();
    this.floor.addEventListener("change", () =>
      this.run(() => this.switchFloor(this.floor.value)),
    );
    this.button(
      "Geschoss hinzufügen",
      () =>
        this.run(() => {
          this.commitNote();
          this.cancel();
          const floor = addFloor(session);
          this.switchFloor(floor.id);
        }),
      floorControls,
    );
    this.button(
      "Geschoss kopieren",
      () => void this.copyCurrentFloor(),
      floorControls,
    );
    this.button(
      "Geschoss archivieren",
      () => this.run(() => this.archiveCurrentFloor()),
      floorControls,
    );
    this.compare.addEventListener("change", () => this.applyComparison());
    for (const [label, key] of [
      ["Referenzdeckkraft", "referenceAlpha"],
      ["Aktuelle Deckkraft", "currentAlpha"],
    ] as const) {
      const row = element("label", "dn-compact-field", floorControls);
      element("span", "", row, label);
      const input = element("input", "dn-opacity", row);
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = ".05";
      input.value = String(this[key]);
      input.setAttribute("aria-label", label);
      input.title = label;
      input.addEventListener("change", () => {
        this[key] = input.valueAsNumber;
        this.applyComparison();
      });
    }
    this.emptyPanel = element("div", "dn-empty-panel", this.inspector);
    const canvasHost = element("main", "dn-canvas", this.body);
    this.renderer = new MapRenderer(
      canvasHost,
      session,
      host.assetUrl,
      host.notice,
      { compactDetails: true, preserveViewOnResize: true, preserveZoomOnResize: true },
      host.colorableObjectSource,
    );
    this.assetUnsub = host.subscribeAssets?.(() => {
      this.renderer.reloadAssets();
      this.refreshProperties();
    });
    this.keyDock = element("aside", "dn-key-dock", this.body);
    const keyHead = element("div", "dn-key-heading", this.keyDock);
    element("strong", "", keyHead, "Key bearbeiten");
    this.button("Schließen", () => this.toggleKey(false), keyHead);
    this.text = element("textarea", "dn-note", this.keyDock);
    this.text.setAttribute("aria-label", "Raum-Key bearbeiten");
    this.text.spellcheck = false;
    this.text.disabled = true;
    this.text.addEventListener("change", () =>
      this.run(() => this.commitNote()),
    );
    this.structuredHost = element("div", "", this.keyDock);
    this.structuredHost.hidden = true;
    this.openKeyButton = element("button", "", this.keyDock, "Notiz öffnen");
    this.openKeyButton.addEventListener("click", () =>
      this.run(() => {
        this.commitNote();
        const selectedEntity = this.selected ? this.session.entities.get(this.selected) : undefined;
        if (selectedEntity?.keyTarget) {
          this.host.openRoomKey(selectedEntity.keyTarget.roomId,
            selectedEntity.keyTarget.sectionId, selectedEntity.keyTarget.anchor);
          return;
        }
        const room = this.selectedRoom();
        if (isStructuredRoom(room)) {
          const occurrence = this.session.content.occurrences.find((item) =>
            item.entityId === this.selected);
          this.host.openRoomKey(room.id, occurrence?.sectionId);
        }
        else if (this.notePath) this.host.openNote(this.notePath);
      }),
    );
    const footer = element("footer", "dn-footer", root);
    this.status = element("div", "dn-status", footer);
    this.status.setAttribute("role", "status");
    const mapSwitches = element("div", "dn-view-toggles", footer);
    const gridButton = this.button("Raster", () => {
      this.gridVisible = !this.gridVisible;
      this.renderer.setGridVisible(this.gridVisible);
      gridButton.setAttribute("aria-pressed", String(this.gridVisible));
    }, mapSwitches);
    gridButton.setAttribute("aria-pressed", "true");
    this.snapButton = this.button("Snap", () => this.toggleSnap(), mapSwitches);
    this.snapButton.setAttribute("aria-pressed", "true");
    const viewControls = element("div", "dn-view-controls", footer);
    this.button("−", () => this.renderer.zoom(1 / 1.2), viewControls);
    this.button("+", () => this.renderer.zoom(1.2), viewControls);
    this.button("Einpassen", () => this.renderer.fit(), viewControls);

    this.buildNavigation();
    this.unsub = session.subscribe((e) => {
      if (e.floors) this.refreshFloors();
      this.refresh();
      if (this.notePath && e.notes.has(this.notePath)) this.refreshText();
      const missingSelection = [...this.selection].some(
        (id) => !session.entities.has(id),
      );
      if (this.selected && !session.entities.has(this.selected))
        void this.select(undefined);
      else if (missingSelection) {
        this.selection = new Set(
          [...this.selection].filter((id) => session.entities.has(id)),
        );
        this.selected = [...this.selection].at(-1);
        this.renderer.select(this.selection);
      }
      if (
        e.floors ||
        e.settings ||
        missingSelection ||
        [...this.selection].some((id) => e.ids.has(id))
      )
        this.refreshProperties();
      if (this.selected && e.ids.has(this.selected) &&
          this.selectedNotePath() !== this.notePath)
        void this.refreshSelectedNote();
    });
    this.setTool("select");
    this.refresh();
  }
  private button(
    label: string,
    fn: () => void,
    parent: HTMLElement = this.toolbar,
  ): HTMLButtonElement {
    const b = element("button", "", parent, label);
    b.type = "button";
    b.addEventListener("click", () => {
      fn();
      if (parent.closest(".dn-popover-menu"))
        parent.closest("details")?.removeAttribute("open");
    });
    return b;
  }
  private iconButton(
    label: string,
    icon: string,
    fn: () => void,
    parent: HTMLElement = this.toolbar,
  ): HTMLButtonElement {
    const button = this.button("", fn, parent),
      symbol = element("span", "dn-icon", button);
    setIcon(symbol, icon);
    button.classList.add("dn-icon-button");
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
  }
  private navigationButton(
    parent: HTMLElement,
    label: string,
    icon: string,
    fn: () => void,
  ): HTMLButtonElement {
    const button = this.button("", fn, parent),
      symbol = element("span", "dn-navigation-icon", button);
    setIcon(symbol, icon);
    element("span", "dn-navigation-label", button, label);
    button.classList.add("dn-navigation-button");
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
  }
  private buildNavigation(): void {
    const groups = [
        ["selection", "Auswahl", "mouse-pointer-2", "select"],
        ["building", "Bauwerk", "brick-wall", "room"],
        ["landscape", "Gelände", "mountain", "terrain"],
        ["objects", "Objekte", "shapes", "object"],
        ["lighting", "Beleuchtung", "sun", "light"],
        ["content", "Inhalte", "book-open-text", "key"],
        ["dungeon", "Dungeon", "settings", "floors"],
      ] as const,
      tools = [
        ["selection", "select", "Auswahl", "mouse-pointer-2"],
        ["selection", "pan", "Hand", "hand"],
        ["building", "room", "Rechteck", "square"],
        ["building", "ellipse", "Ellipse", "circle"],
        ["building", "corridor", "Gang", "route"],
        ["building", "polygon", "Polygon", "pentagon"],
        ["building", "edit-points", "Punkte bearbeiten", "mouse-pointer-2"],
        ["building", "wall", "Wände", "brick-wall"],
        ["building", "door", "Durchgänge", "door-open"],
        ["building", "cave", "Höhle", "mountain"],
        ["building", "pattern", "Musterflächen", "layers-2"],
        ["building", "roof", "Dächer", "house"],
        ["landscape", "terrain", "Terrain", "mountain"],
        ["landscape", "water", "Wasser", "droplets"],
        ["landscape", "material", "Materialpinsel", "paintbrush"],
        ["landscape", "path", "Pfade", "route"],
        ["objects", "object", "Objekte platzieren", "package"],
        ["objects", "prefab", "Zeichenvorlagen", "boxes"],
        ["objects", "scatter", "Streuen", "sprout"],
        ["lighting", "light", "Lichtquelle", "lamp"],
      ] as const;
    for (const [id, label, icon, entry] of groups) {
      const button = this.navigationButton(this.groupRail, label, icon, () => {
        if (entry === "key") {
          this.showGroup(id);
          this.showPanel("content", "Inhalte");
          this.toggleKey(true);
        } else if (entry === "floors") {
          this.showGroup(id);
          this.toggleKey(false);
          this.showPanel("floors", "Geschosse");
        } else this.setTool(entry as Tool);
      });
      button.dataset.navigationGroup = id;
      this.groupButtons.set(id, button);
    }
    for (const [group, tool, label, icon] of tools) {
      const button = this.navigationButton(this.toolRail, label, icon, () =>
        this.setTool(tool),
      );
      button.dataset.group = group;
      button.dataset.tool = tool;
      this.toolButtons.set(tool, button);
      this.toolGroups.set(tool, group);
      this.toolLabels.set(tool, label);
    }
    const panelButton = (
      group: string,
      id: string,
      label: string,
      icon: string,
      fn: () => void,
    ) => {
      const button = this.navigationButton(this.toolRail, label, icon, fn);
      button.dataset.group = group;
      button.dataset.panel = id;
      this.panelButtons.set(id, button);
      return button;
    };
    this.keyButton = panelButton(
      "content",
      "key",
      "Key bearbeiten",
      "book-open-text",
      () => {
        this.showGroup("content");
        this.showPanel("content", "Inhalte");
        this.toggleKey(true);
      },
    );
    if (this.host.manageContent)
      panelButton("content", "content", "Dungeon-Inhalte", "list-tree", () => {
        this.showGroup("content");
        this.showPanel("content", "Inhalte");
        this.run(() => {
          this.commitNote();
          this.host.manageContent!(this.renderer.floorId, this.selected);
        });
      });
    panelButton("dungeon", "floors", "Geschosse", "layers-3", () => {
      this.showGroup("dungeon");
      this.toggleKey(false);
      this.showPanel("floors", "Geschosse");
    });
    if (this.host.manageMap)
      panelButton("dungeon", "map", "Einstellungen", "settings", () => {
        this.showGroup("dungeon");
        this.host.manageMap!();
      });
    if (this.host.manageMapInfo)
      panelButton("dungeon", "map-info", "Karteninformationen", "info", () => {
        this.showGroup("dungeon");
        this.host.manageMapInfo!();
      });
    if (this.host.manageGenerator)
      panelButton("dungeon", "generator", "Assistent", "wand-sparkles", () => {
        this.showGroup("dungeon");
        this.host.manageGenerator!(this.renderer.floorId);
      });
    if (this.host.manageReferences)
      panelButton("dungeon", "references", "Vorlagen", "scan", () => {
        this.showGroup("dungeon");
        this.host.manageReferences!(this.renderer.floorId);
      });
    if (this.host.manageAssets)
      panelButton("dungeon", "assets", "Bibliothek", "package-open", () => {
        this.showGroup("dungeon");
        this.host.manageAssets!();
      });
    this.keyDock.hidden = true;
    this.showGroup("selection");
    this.showPanel("properties", "Auswahl");
  }
  private showGroup(id: string): void {
    for (const [group, button] of this.groupButtons) {
      const active = group === id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const button of this.toolRail.querySelectorAll<HTMLButtonElement>(
      "[data-group]",
    ))
      button.hidden = button.dataset.group !== id;
  }
  private showPanel(
    panel: "properties" | "floors" | "content",
    title: string,
  ): void {
    this.optionTitle.textContent = title;
    this.propertiesHost.hidden = panel !== "properties" || this.tool === "prefab";
    this.selectionPanel.hidden =
      panel !== "properties" || this.tool !== "select";
    this.prefabPanel.hidden = panel !== "properties" || this.tool !== "prefab";
    this.floorPanel.hidden = panel !== "floors";
    this.emptyPanel.hidden = panel !== "content";
    this.emptyPanel.textContent =
      panel === "content"
        ? "Key und Dungeon-Inhalte werden rechts beziehungsweise in ihrem Dialog bearbeitet."
        : "";
    for (const [id, button] of this.panelButtons) {
      const active =
        (panel === "floors" && id === "floors") ||
        (panel === "content" && id === "key" && !this.keyDock.hidden);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  private toggleKey(open: boolean): void {
    if (open === !this.keyDock.hidden) return;
    if (!open) this.run(() => this.commitNote());
    this.keyDock.hidden = !open;
    this.root.classList.toggle("dn-key-open", open);
    this.keyButton?.classList.toggle("is-active", open);
    this.keyButton?.setAttribute("aria-pressed", String(open));
  }
  private setMaximized(maximized: boolean): void {
    if (maximized) {
      if (this.root.parentNode !== document.body) {
        this.homeParent = this.root.parentNode ?? this.homeParent;
        this.homeNext = this.root.nextSibling;
        document.body.append(this.root);
      }
    } else if (this.homeParent && this.root.parentNode !== this.homeParent) {
      const before =
        this.homeNext?.parentNode === this.homeParent ? this.homeNext : null;
      this.homeParent.insertBefore(this.root, before);
    }
    this.root.classList.toggle("dn-maximized", maximized);
    this.maximizeButton.textContent = maximized
      ? "Zurück zum Layout"
      : "Maximieren";
    if (!this.closed)
      requestAnimationFrame(() => {
        if (!this.closed) this.renderer.fit();
      });
  }
  maximize(): void {
    this.setMaximized(true);
  }
  showLayout(): void {
    this.setMaximized(false);
  }
  private leaveMaximized(): void {
    this.setMaximized(false);
    this.host.exitEditor?.();
  }
  async init(): Promise<void> {
    await this.renderer.init();
    if (this.closed) return;
    const canvas = this.renderer.canvas,
      options = { signal: this.abort.signal };
    canvas.addEventListener(
      "pointerdown",
      (e) => this.run(() => this.begin(e)),
      options,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => this.run(() => this.update(e)),
      options,
    );
    canvas.addEventListener(
      "pointerup",
      (e) => this.run(() => this.commit(e)),
      options,
    );
    canvas.addEventListener("pointercancel", () => this.cancel(), options);
    canvas.addEventListener("pointerleave", () => {
      if (this.gesture) return;
      if (this.tool === "edit-points") {
        this.hoveredBuildingVertex = undefined;
        this.renderer.setBuildingPointHover();
      }
      if (this.tool === "prefab") this.renderer.cancelPreview();
      if (this.tool === "object") {
        this.objectPreviewPoint = undefined;
        this.renderer.clearObjectPreview();
      }
    }, options);
    // Capture can disappear while a drag is still pressed. Pointer-up,
    // pointer-cancel, Escape or window blur decides how the gesture ends.
    const outsideUncapturedGesture = (e: PointerEvent): boolean =>
      this.gesture?.pointer === e.pointerId &&
      !canvas.hasPointerCapture(e.pointerId) && e.target !== canvas;
    window.addEventListener(
      "pointermove",
      (e) => {
        if (outsideUncapturedGesture(e))
          this.run(() => this.update(e));
      },
      { ...options, capture: true },
    );
    window.addEventListener(
      "pointerup",
      (e) => {
        if (outsideUncapturedGesture(e))
          this.run(() => this.commit(e));
      },
      { ...options, capture: true },
    );
    window.addEventListener(
      "pointercancel",
      (e) => {
        if (outsideUncapturedGesture(e))
          this.cancel();
      },
      { ...options, capture: true },
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), options);
    canvas.addEventListener(
      "dblclick",
      (e) => this.run(() => {
        if (this.pathDraft?.tool === this.tool) {
          e.preventDefault();
          this.finishPathDraft(e.altKey);
        } else this.insertPoint(e);
      }),
      options,
    );
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const navigation = wheelNavigation(e);
        if (navigation.kind === "zoom")
          this.renderer.zoom(navigation.factor, this.renderer.local(e));
        else this.renderer.pan(navigation.x, navigation.y);
      },
      { ...options, passive: false, capture: true },
    );
    this.root.addEventListener("keydown", (e) => this.key(e), options);
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.closed || !(e.ctrlKey || e.metaKey) ||
            e.key.toLowerCase() !== "s" ||
            !(e.target instanceof Node) || !this.root.contains(e.target)) return;
        e.stopImmediatePropagation();
        this.key(e);
      },
      { ...options, capture: true },
    );
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || !this.gesture?.temporaryPan) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      { ...options, capture: true },
    );
    this.root.addEventListener(
      "keyup",
      (e) => {
        if (e.code === "Space") this.space = false;
      },
      options,
    );
    window.addEventListener(
      "blur",
      () => {
        this.space = false;
        this.cancel();
        this.objectPreviewPoint = undefined;
        this.renderer.clearObjectPreview();
      },
      options,
    );
  }
  private refreshFloors(): void {
    const selected = this.floor?.value,
      compare = this.compare?.value;
    this.floor.replaceChildren();
    this.compare.replaceChildren();
    element("option", "", this.compare, "Kein Vergleich").value = "";
    for (const f of this.session.floors.values()) {
      element("option", "", this.floor, f.name).value = f.id;
      element("option", "", this.compare, f.name).value = f.id;
    }
    if (selected && this.session.floors.has(selected))
      this.floor.value = selected;
    if (compare && this.session.floors.has(compare))
      this.compare.value = compare;
  }
  private switchFloor(id: string): void {
    this.commitNote();
    this.cancel();
    this.floor.value = id;
    this.renderer.setFloor(id);
    this.applyComparison();
    void this.select(undefined);
  }
  private async copyCurrentFloor(): Promise<void> {
    try {
      this.commitNote();
      this.cancel();
      const sourceId = this.renderer.floorId;
      for (const room of [...this.session.entities.values()].filter(
        (entity): entity is Room =>
          isRoom(entity) && entity.floorId === sourceId,
      ))
        if (room.note && this.session.note(room.note.path) === undefined)
          await this.repository.loadNote(this.session, room.note.path);
      const floor = duplicateFloor(this.session, sourceId);
      this.switchFloor(floor.id);
      this.host.notice("Geschoss einschließlich Raum-Keys kopiert.");
    } catch (error) {
      this.host.notice(error instanceof Error ? error.message : String(error));
    }
  }
  private archiveCurrentFloor(): void {
    this.commitNote();
    this.cancel();
    const current = this.renderer.floorId;
    archiveFloor(this.session, current);
    const next = this.session.floors.keys().next().value;
    if (!next) throw new Error("Kein Geschoss zum Anzeigen vorhanden.");
    this.switchFloor(next);
    this.host.notice("Geschoss archiviert; Wiederherstellung unter Inhalte.");
  }
  private applyComparison(): void {
    this.renderer.setComparison(
      this.compare.value || undefined,
      this.referenceAlpha,
      this.currentAlpha,
    );
  }
  private refreshObjectPreview(): void {
    if (this.tool === "object" && this.objectPreviewPoint)
      this.renderer.previewObject(this.objectPreviewPoint, this.settings.object);
  }
  private refreshProperties(): void {
    this.properties?.render(this.tool, this.selected, this.floor.value);
    const entities = [...this.selection]
      .map((id) => this.session.entities.get(id))
      .filter((entity): entity is Entity => !!entity);
    this.deleteSelectionButton.disabled = !entities.length;
    this.copySelectionButton.disabled = !entities.some(
      (entity) => !isRoom(entity),
    );
    this.pasteSelectionButton.disabled = !this.clipboard?.entities.length;
    this.lockSelectionButton.disabled = !entities.length;
    this.mirrorSelectionButton.disabled =
      !selectionMirrorChanges(entities).length;
    this.bringToFrontButton.disabled = this.selection.size !== 1 ||
      !selectionStackChange(this.session.entities, this.selected ?? "", "front");
    this.sendToBackButton.disabled = this.selection.size !== 1 ||
      !selectionStackChange(this.session.entities, this.selected ?? "", "back");
    this.makePrefabButton.disabled = !this.host.savePrefab ||
      !this.host.requestPrefabDetails ||
      !entities.some((entity) => !isRoom(entity) && entity.kind !== "reference");
    this.separatePrefabButton.disabled = !entities.some((entity) => !!entity.prefabId);
    this.lockSelectionButton.textContent =
      entities.length && entities.every((entity) => entity.locked)
        ? "Entsperren"
        : "Sperren";
  }
  private toggleSelectionLock(): void {
    const entities = [...this.selection]
      .map((id) => this.session.entities.get(id))
      .filter((entity): entity is Entity => !!entity);
    if (!entities.length) return;
    const locked = !entities.every((entity) => entity.locked);
    this.session.setLockedMany(entities.map((entity) => entity.id), locked);
    this.refreshProperties();
  }
  private reorderSelection(direction: "front" | "back"): void {
    if (this.selection.size !== 1) return;
    const change = selectionStackChange(
      this.session.entities, this.selected ?? "", direction,
    );
    if (!change) return;
    this.commitNote();
    this.session.execute({
      label: direction === "front" ? "Element nach vorn" : "Element nach hinten",
      entities: [change],
    });
  }
  private refreshPrefabs(selected?: string, requestedSet?: string): void {
    const prefabs = this.host.prefabs?.() ?? [];
    const previous = selected ?? this.prefabChoice.value;
    const previousSet = this.prefabSetChoice.value;
    const sets = [...new Set(prefabs.map((prefab) => prefab.set))];
    const previousPrefab = prefabs.find((prefab) => prefab.id === previous);
    const activeSet = requestedSet && sets.includes(requestedSet) ? requestedSet
      : previousPrefab?.set ?? (sets.includes(previousSet) ? previousSet : sets[0] ?? "");
    this.prefabSetChoice.replaceChildren();
    for (const set of sets) {
      const option = document.createElement("option");
      option.value = set;
      option.textContent = set;
      this.prefabSetChoice.append(option);
    }
    this.prefabSetChoice.value = activeSet;
    this.prefabSetChoice.disabled = sets.length === 0;
    this.prefabChoice.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Vorlage wählen";
    this.prefabChoice.append(placeholder);
    const available = prefabs.filter((prefab) => prefab.set === activeSet);
    for (const prefab of available) {
      const option = document.createElement("option");
      option.value = prefab.id;
      option.textContent = `${prefab.set} / ${prefab.name}`;
      this.prefabChoice.append(option);
    }
    this.prefabChoice.value = available.some((prefab) => prefab.id === previous)
      ? previous : "";
    this.forgetPrefabButton.disabled = this.forgettingPrefab ||
      !this.prefabChoice.value || !this.host.forgetPrefab;
  }
  private async forgetPrefab(): Promise<void> {
    const prefab = this.host.prefabs?.().find((item) => item.id === this.prefabChoice.value);
    if (!prefab || !this.host.forgetPrefab || this.forgettingPrefab) return;
    this.forgettingPrefab = true;
    this.forgetPrefabButton.disabled = true;
    try {
      if (!(await this.host.forgetPrefab(
        prefab, this.root.ownerDocument, this.abort.signal,
      )) || this.closed) return;
      this.refreshPrefabs();
      this.renderer.cancelPreview();
    } catch (error) {
      this.host.notice(error instanceof Error ? error.message : String(error));
    } finally {
      this.forgettingPrefab = false;
      if (!this.closed) this.refreshPrefabs();
    }
  }
  private async makePrefab(): Promise<void> {
    try {
      if (!this.host.savePrefab || !this.host.requestPrefabDetails) return;
      this.commitNote();
      const sources = [...this.selection]
        .map((id) => this.session.entities.get(id))
        .filter((entity): entity is Entity =>
          !!entity && !isRoom(entity) && entity.kind !== "reference");
      if (!sources.length) return;
      const details = await this.host.requestPrefabDetails();
      if (!details || this.closed) return;
      const prefab = createPrefabDefinition(
        details.set, details.name, sources,
        (id) => this.session.entities.get(id),
      );
      await this.host.savePrefab(prefab);
      const changes = sources.flatMap((source) => {
        const current = this.session.entities.get(source.id);
        return current ? [{ id: current.id, before: current,
          after: { ...current, prefabId: prefab.id } }] : [];
      });
      if (changes.length)
        this.session.execute({ label: "Vorlage erstellen", entities: changes });
      this.refreshPrefabs(prefab.id);
      this.refreshProperties();
    } catch (error) {
      this.host.notice(error instanceof Error ? error.message : String(error));
    }
  }
  private separatePrefab(): void {
    this.commitNote();
    const changes = [...this.selection].flatMap((id) => {
      const current = this.session.entities.get(id);
      return current?.prefabId ? [{ id, before: current,
        after: { ...current, prefabId: undefined } }] : [];
    });
    if (changes.length)
      this.session.execute({ label: "Vorlage lösen", entities: changes });
  }
  private insertPrefab(at: Point): void {
    const prefab = this.host.prefabs?.().find((item) => item.id === this.prefabChoice.value);
    if (!prefab) {
      this.host.notice("Zuerst eine Zeichenvorlage wählen.");
      return;
    }
    this.commitNote();
    const copies = placePrefab(prefab, at, this.renderer.floorId);
    this.session.execute({
      label: "Vorlage einsetzen",
      entities: copies.map((entity) => ({ id: entity.id, before: null, after: entity })),
    });
    this.selection = new Set(copies.map((entity) => entity.id));
    this.selected = copies.at(-1)?.id;
    this.renderer.select(this.selection);
    this.refreshProperties();
  }
  private mirrorSelection(): void {
    const changes = selectionMirrorChanges(
      [...this.selection]
        .map((id) => this.session.entities.get(id))
        .filter((entity): entity is Entity => !!entity),
    );
    if (!changes.length) return;
    this.commitNote();
    this.session.execute({
      label: "Auswahl spiegeln",
      entities: changes.map(({ before, after }) => ({
        id: before.id,
        before,
        after,
      })),
    });
  }
  private adoptFloor(id: string): void {
    this.commitNote();
    this.cancel();
    const folder =
        this.repository.mapPath.slice(
          0,
          this.repository.mapPath.lastIndexOf("/"),
        ) + "/Räume",
      room = adoptFloorAsRoom(
        this.session,
        id,
        folder,
        this.settings.room,
        this.repository.mapPath,
      );
    void this.select(room.id);
    this.host.notice(`Raum ${room.number} wurde angelegt.`);
  }
  private groupSelection(): void {
    const entities = [...this.selection]
      .map((id) => this.session.entities.get(id))
      .filter((entity): entity is Entity => !!entity && !entity.locked);
    if (entities.length < 2) {
      this.host.notice(
        "Zum Gruppieren mindestens zwei entsperrte Elemente auswählen.",
      );
      return;
    }
    const groupId = uid();
    this.session.execute({
      label: "Elemente gruppieren",
      entities: entities.map((entity) => ({
        id: entity.id,
        before: entity,
        after: { ...entity, groupId },
      })),
    });
  }
  private ungroupSelection(): void {
    const entities = [...this.selection]
      .map((id) => this.session.entities.get(id))
      .filter(
        (entity): entity is Entity =>
          !!entity && !!entity.groupId && !entity.locked,
      );
    if (!entities.length) {
      this.host.notice("Die Auswahl enthält keine entsperrte Gruppierung.");
      return;
    }
    this.session.execute({
      label: "Gruppierung lösen",
      entities: entities.map((entity) => ({
        id: entity.id,
        before: entity,
        after: { ...entity, groupId: undefined },
      })),
    });
  }
  private copySelection(): void {
    this.commitNote();
    const sources = [...this.selection]
      .map((id) => this.session.entities.get(id))
      .filter((entity): entity is Entity => !!entity && !isRoom(entity));
    this.clipboard = captureSelectionClipboard(sources, (id) =>
      this.session.entities.get(id),
    );
    if (!this.clipboard.entities.length) {
      this.host.notice(
        "Zum Kopieren mindestens ein Kartenobjekt außerhalb eines Raum-Keys auswählen.",
      );
      return;
    }
    if (this.clipboard.entities.length < this.selection.size)
      this.host.notice(
        "Raumkopien folgen mit der gemeinsamen Key-Verwaltung; die übrige Auswahl wurde kopiert.",
      );
    this.refreshProperties();
  }
  private pasteSelection(): void {
    if (!this.clipboard?.entities.length) {
      this.host.notice("Die Karten-Zwischenablage ist leer.");
      return;
    }
    this.commitNote();
    const viewportCenter = this.renderer.toWorld({
        x: this.renderer.host.clientWidth / 2,
        y: this.renderer.host.clientHeight / 2,
      }),
      sourceCenter = this.clipboard.center ?? viewportCenter,
      copies = copyAtViewportCenter(
        this.clipboard.entities,
        sourceCenter,
        viewportCenter,
        this.renderer.floorId,
      ),
      changes: RecordChange<Entity>[] = copies.map((copy) => ({
        id: copy.id,
        before: null,
        after: copy,
      }));
    this.session.execute({ label: "Elemente einfügen", entities: changes });
    this.selection = new Set(changes.map((change) => change.id));
    this.selected = [...this.selection].at(-1);
    this.renderer.select(this.selection);
    this.notePath = undefined;
    this.text.disabled = true;
    this.text.value = "";
    this.refreshProperties();
    void this.refreshSelectedNote();
  }
  private archiveSelection(): void {
    this.commitNote();
    const bundle = archiveEntities(this.session, [...this.selection]);
    this.selection.clear();
    this.selected = undefined;
    this.renderer.select(this.selection);
    this.notePath = undefined;
    this.text.disabled = true;
    this.text.value = "";
    this.refreshProperties();
    this.host.notice(
      `${bundle.entities.length} Kartenobjekt(e) mit Verknüpfungen entfernt. Rückgängig stellt sie wieder her.`,
    );
  }
  private setTool(tool: Tool): void {
    this.run(() => this.commitNote());
    this.cancel();
    this.objectPreviewPoint = undefined;
    this.renderer.clearObjectPreview();
    if (tool !== this.tool) this.previousTool = this.tool;
    this.tool = tool;
    this.hoveredBuildingVertex = undefined;
    this.renderer.setBuildingPointEditing(tool === "edit-points");
    this.previousToolButton.disabled =
      !this.previousTool || this.previousTool === "select";
    const group = this.toolGroups.get(tool);
    if (group) this.showGroup(group);
    for (const [candidate, button] of this.toolButtons) {
      const active = candidate === tool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const button of this.panelButtons.values()) {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    }
    this.toggleKey(false);
    this.showPanel("properties", this.toolLabels.get(tool) ?? "Werkzeug");
    if (tool !== "select" &&
        (tool !== "edit-points" ||
          this.selection.size !== 1 ||
          this.session.entities.get(this.selected ?? "")?.kind !== "building"))
      void this.select(undefined);
    this.refreshProperties();
    if (this.status) this.refresh();
  }
  private refresh(): void {
    this.undo.disabled = !this.session.canUndo;
    this.redo.disabled = !this.session.canRedo;
    this.title.textContent = this.session.settings.name;
    this.saveState.textContent = this.session.dirty || this.host.pending?.()
      ? "Ungespeichert"
      : "Gespeichert";
    this.saveState.classList.toggle("is-dirty",
      this.session.dirty || !!this.host.pending?.());
    const hint: Record<Tool, string> = {
      select:
        "Klick: auswählen · Umschalt: ergänzen · Alt-Klick: gesperrtes Element wählen oder Konturpunkt entfernen · Ziehen: Rahmen oder Element verschieben · Ausgewähltes Objekt: außen drehen, am Eckgriff skalieren · A: Objekte spiegeln · Doppelklick: Konturpunkt einfügen",
      "edit-points": "Gebäude wählen · Eckpunkt ziehen: verschieben · Kantenmitte ziehen: einfügen · Delete/Rücktaste am grünen Griff: Punkt oder Dreipunktumriss entfernen",
      pan: "Ziehen: Kartenausschnitt verschieben",
      room: "Ziehen: Rechteck · Alt: ausradieren · E: Modus wechseln",
      ellipse: "Ziehen: Ellipse · Alt: ausradieren · E: Modus wechseln",
      polygon:
        "Klick: Eckpunkt · Doppelklick: fertig · Rücktaste: letzter Punkt · Alt: ausradieren · E: Modus wechseln",
      corridor:
        "Klick: Gangpunkt · Enter/Doppelklick: fertig · Rücktaste: letzter Punkt · Alt: ausradieren · E: Modus wechseln",
      wall: "Klick: Wandpunkt · Strg-Klick am Ende: Wand fortsetzen · Umschalt: kurvig · Enter/Doppelklick: fertig · Rücktaste: letzter Punkt",
      door: "Klick an Wand oder Gangende: Durchgang platzieren",
      cave: "Ziehen: Höhle malen · Alt: ausradieren",
      pattern:
        "Ziehen oder Eckpunkte setzen · Enter/Doppelklick: Polygon fertig",
      roof:
        this.settings.roofShape === "polygon"
          ? "Klick: Dachpunkt · Enter/Doppelklick: fertig · Rücktaste: letzter Punkt · Auswahl: Kontur und First bearbeiten"
          : "Ziehen: Dachfläche · Auswahl: Kontur und First bearbeiten",
      terrain: "Ziehen: Terrain malen · Alt: ausradieren",
      water:
        this.settings.waterShape === "polygon"
          ? "Klick: Wasserpunkt · Enter/Doppelklick: fertig · Rücktaste: letzter Punkt · Alt: ausradieren"
          : this.settings.waterShape === "brush"
            ? "Ziehen: Wasser malen · Alt: ausradieren"
            : "Ziehen: Wasserfläche · Alt: ausradieren",
      material: "Ziehen: Material malen · Alt: ausradieren",
      path: "Klick: Pfadpunkt · Enter/Doppelklick: fertig · Rücktaste: letzter Punkt",
      object:
        "Klick: Objekt platzieren · A: spiegeln · [ / ]: drehen · − / +: skalieren · Auswahl: verschieben und bearbeiten",
      scatter: "Ziehen: Objekte entlang des Strichs streuen",
      prefab: "Vorlage wählen · Klick auf die Karte: am Rasterpunkt platzieren",
      light:
        "Klick: Lichtquelle platzieren · Auswahl: verschieben und bearbeiten",
    };
    this.status.textContent =
      (this.paintWorker ? "Fläche wird berechnet · Escape: abbrechen · " : "") +
      hint[this.tool] +
      " · Touchpad/Scrollen: zoomen · Leertaste/Ziehen: verschieben · " +
      (this.tool === "edit-points"
        ? "Escape: Zug übernehmen und Werkzeug verlassen"
        : "Escape: abbrechen");
  }
  private run(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.cancel();
      this.host.notice(error instanceof Error ? error.message : String(error));
    }
  }
  private stepHistory(direction: "undo" | "redo"): void {
    this.commitNote();
    this.cancel();
    if (direction === "undo" ? !this.session.canUndo : !this.session.canRedo)
      return;
    if (direction === "undo") this.session.undo();
    else this.session.redo();
    void this.select(undefined);
  }
  private snap(p: Point): Point {
    return this.snapEnabled
      ? { x: Math.round(p.x), y: Math.round(p.y) }
      : { x: p.x, y: p.y };
  }
  private isBrushTool(tool: Tool): boolean {
    return (
      tool === "cave" ||
      tool === "material" ||
      tool === "terrain" ||
      (tool === "water" && this.settings.waterShape === "brush")
    );
  }
  private portalAt(
    point: Point,
    boundary: Boundary,
    width: number,
  ): { contour: number; at: number } {
    const paths = [...this.session.entities.values()].filter(
      (entity): entity is MapPath => entity.kind === "path",
    );
    return alignedPortalAt(
      point,
      boundary,
      paths,
      width,
      Math.min(0.75, Math.max(0.5, 12 / this.renderer.camera.scale)),
    );
  }
  private wallExtension(point: Point): Wall | undefined {
    let best: { wall: Wall; distance: number; reverse: boolean } | undefined;
    const maximum = Math.max(0.7, 12 / this.renderer.camera.scale);
    for (const entity of this.session.entities.values()) {
      if (
        entity.kind !== "wall" ||
        entity.floorId !== this.renderer.floorId ||
        entity.closed ||
        entity.locked
      )
        continue;
      for (const [candidate, reverse] of [
        [entity.points.at(-1), false],
        [entity.points[0], true],
      ] as const) {
        if (!candidate) continue;
        const distance = Math.hypot(
          point.x - candidate.x,
          point.y - candidate.y,
        );
        if (distance <= maximum && (!best || distance < best.distance))
          best = { wall: entity, distance, reverse };
      }
    }
    if (!best) return undefined;
    return best.reverse
      ? { ...best.wall, points: [...best.wall.points].reverse() }
      : best.wall;
  }
  private begin(e: PointerEvent): void {
    if (this.gesture || (e.button !== 0 && e.button !== 1))
      return;
    this.commitNote();
    e.preventDefault();
    this.renderer.canvas.focus();
    const local = this.renderer.local(e),
      point = this.renderer.toWorld(local),
      spacePan = this.space && e.button === 0,
      tool = spacePan || e.button === 1 ? "pan" : this.tool;
    if (spacePan && this.selection.size) void this.select(undefined);
    if (tool === "prefab") {
      this.insertPrefab(this.snap(point));
      return;
    }
    if (this.paintWorker && tool !== "pan") {
      this.host.notice("Fläche wird berechnet. Escape bricht ab.");
      return;
    }
    if (tool === "edit-points") {
      const active = this.selection.size === 1 && this.selected
          ? this.session.entities.get(this.selected) : undefined,
        hitBuilding = this.renderer.hitTest(point, (candidate) =>
          candidate.kind === "building" &&
          candidate.floorId === this.renderer.floorId && !candidate.locked),
        activeBuilding = active?.kind === "building" && !active.locked &&
          active.floorId === this.renderer.floorId ? active : undefined,
        activeGrip = activeBuilding && (
          buildingVertexGrip(activeBuilding, point, buildingPointGripPixels / this.renderer.camera.scale) ||
          buildingEdgeMidpointGrip(activeBuilding, point, buildingPointGripPixels / this.renderer.camera.scale)),
        building = activeGrip ? activeBuilding :
          hitBuilding?.kind === "building" ? hitBuilding : undefined;
      if (!building) {
        void this.select(undefined);
        return;
      }
      const tolerance = buildingPointGripPixels / this.renderer.camera.scale,
        vertex = buildingVertexGrip(building, point, tolerance),
        edge = vertex ? null : buildingEdgeMidpointGrip(building, point, tolerance);
      if (this.selected !== building.id) void this.select(building.id);
      if (!vertex && !edge) return;
      this.hoveredBuildingVertex = vertex ?? undefined;
      this.renderer.setBuildingPointHover(vertex
        ? { contour: vertex.contour, index: vertex.index, kind: "vertex" }
        : { contour: edge!.contour, index: edge!.index, kind: "edge" });
      this.gesture = {
        pointer: e.pointerId, tool, start: point, startLocal: local, last: local,
        entity: building, buildingVertex: vertex ?? undefined,
        buildingEdge: edge ?? undefined, moved: false, points: [point], erase: false,
      };
      this.renderer.canvas.setPointerCapture(e.pointerId);
      return;
    }
    let entity =
      tool === "select"
        ? this.renderer.hitTest(point, (candidate) =>
            selectableByClick(candidate, this.selectionTypes, this.selectionLayers, e.altKey),
          )
        : undefined;
    const active = this.selection.size === 1 && this.selected
        ? this.session.entities.get(this.selected)
        : undefined,
      selectedBox = active && !active.locked &&
          (active.kind === "object" || active.kind === "reference" || active.kind === "light")
        ? active
        : undefined,
      transform = tool === "select" && !e.shiftKey && selectedBox &&
          (!entity || entity.id === selectedBox.id || entity.kind === "surface")
        ? {
            source: selectedBox,
            action: selectedBox.kind === "light" && this.renderer.selectionLightFrame
              ? selectionFrameTransformAt(this.renderer.selectionLightFrame,
                point, this.renderer.camera.scale, "light")
              : selectionTransformAt(selectedBox, point, this.renderer.camera.scale),
            blank: !entity || entity.id !== selectedBox.id,
            frame: selectedBox.kind === "light"
              ? this.renderer.selectionLightFrame : undefined,
          }
        : undefined,
      groupSources = this.selection.size > 1
        ? [...this.selection].map((id) => this.session.entities.get(id))
        : [],
      groupFrame = this.renderer.selectionGroupFrame,
      groupTransform = tool === "select" && !e.shiftKey && groupFrame &&
          groupSources.length > 1 &&
          groupSources.every((source): source is TransformSelection =>
            !!source && !source.locked &&
            (source.kind === "object" || source.kind === "light" || source.kind === "reference")) &&
          (!entity || this.selection.has(entity.id) || entity.kind === "surface")
        ? {
            sources: groupSources,
            frame: groupFrame,
            action: selectionFrameTransformAt(groupFrame, point, this.renderer.camera.scale),
            blank: !entity || !this.selection.has(entity.id),
          }
        : undefined;
    if (transform) entity = selectedBox;
    if (groupTransform && this.selected) entity = this.session.entities.get(this.selected);
    if (this.isBrushTool(tool)) {
      const selected = this.selected
          ? this.session.entities.get(this.selected)
          : undefined,
        desiredColor =
          tool === "water" || tool === "terrain"
            ? this.settings.surfaces[tool].color
            : undefined;
      entity =
        selected?.kind === "surface" &&
        selected.category === tool &&
        selected.floorId === this.renderer.floorId
          ? selected
          : [...this.session.entities.values()]
              .reverse()
              .find(
                (s) =>
                  s.kind === "surface" &&
                  s.category === tool &&
                  s.floorId === this.renderer.floorId &&
                  (e.altKey ||
                    desiredColor === undefined ||
                    s.color === desiredColor) &&
                  hit(point, s, (id) => this.session.entities.get(id), 0),
              );
    }
    if (
      tool === "select" &&
      !transform && !groupTransform &&
      (!entity || !this.selection.has(entity.id) || e.shiftKey)
    )
      void this.select(entity?.id, e.shiftKey);
    const gripDistance = 7 / this.renderer.camera.scale,
      nearestBuildingPoint =
        entity?.kind === "building"
          ? nearestBuildingVertex(point, entity)
          : undefined,
      buildingContour =
        nearestBuildingPoint && nearestBuildingPoint.distance < gripDistance
          ? buildingContourEntries(entity as Building)[
              nearestBuildingPoint.contour
            ]
          : undefined,
      contour = buildingContour?.points ??
        (entity?.kind === "wall" ||
      entity?.kind === "path" ||
      entity?.kind === "roof"
        ? entity.points
        : entity?.kind === "surface" &&
            entity.polygons.length === 1 &&
            entity.polygons[0]!.holes.length === 0
          ? entity.polygons[0]!.outer
          : undefined),
      buildingCorner = buildingContour ? nearestBuildingPoint!.index : undefined;
    let corner = buildingCorner ?? contour?.findIndex(
        (p) => Math.hypot(p.x - point.x, p.y - point.y) < gripDistance,
      ),
      ridge =
        entity?.kind === "roof"
          ? entity.ridge.findIndex(
              (p) =>
                Math.hypot(p.x - point.x, p.y - point.y) <
                7 / this.renderer.camera.scale,
            )
          : undefined;
    if (
      tool === "select" &&
      entity &&
      contour &&
      corner !== undefined &&
      corner >= 0 &&
      e.altKey &&
      !entity.locked
    ) {
      const minimum =
        entity.kind === "building" ||
        entity.kind === "roof" ||
        entity.kind === "surface" ||
        ((entity.kind === "wall" || entity.kind === "path") && entity.closed)
          ? 3
          : 2;
      if (contour.length <= minimum) {
        this.host.notice(
          "Die Kontur braucht mindestens " + minimum + " Punkte.",
        );
        return;
      }
      const filtered = contour.filter((_, index) => index !== corner),
        contourIndex = buildingContour?.contour ?? 0;
      if (entity.kind === "building") {
        const after = replaceBuildingContour(entity, contourIndex, filtered),
          command = planBuildingContourMutation({
          entities: [...this.session.entities.values()],
          before: entity,
          after,
          edit: { kind: "remove", contour: contourIndex, index: corner },
        });
        if (command) this.session.execute(command);
      } else {
        const after = replaceContour(entity, filtered, contourIndex);
        this.session.execute({
          label: "Konturpunkt entfernen",
          entities: [{ id: entity.id, before: entity, after }],
        });
      }
      void this.select(entity.id);
      return;
    }
    this.gesture = {
      pointer: e.pointerId,
      tool,
      temporaryPan: spacePan,
      start: point,
      startLocal: local,
      last: local,
      entity,
      transform,
      groupTransform,
      contour: buildingContour?.contour,
      corner: corner !== undefined && corner >= 0 ? corner : undefined,
      ridge: ridge !== undefined && ridge >= 0 ? ridge : undefined,
      moved: false,
      curve: tool === "polygon" && e.shiftKey,
      points: [point],
      erase: isFloorTool(tool)
        ? floorEraseActive(this.settings.floorMode, e.altKey)
        : e.altKey,
    };
    this.renderer.canvas.setPointerCapture(e.pointerId);
  }
  private insertPoint(event: MouseEvent): void {
    if (this.tool !== "select") return;
    event.preventDefault();
    const point = this.renderer.toWorld(this.renderer.local(event)),
      entity = this.renderer.hitTest(point),
      buildingNearest =
        entity?.kind === "building"
          ? nearestBuildingSegment(point, entity)
          : undefined,
      buildingContour =
        entity?.kind === "building" && buildingNearest
          ? buildingContourEntries(entity)[buildingNearest.contour]
          : undefined,
      contour = buildingContour?.points ??
        (entity?.kind === "wall" ||
      entity?.kind === "path" ||
      entity?.kind === "roof"
        ? entity.points
        : entity?.kind === "surface" &&
            entity.polygons.length === 1 &&
            entity.polygons[0]!.holes.length === 0
          ? entity.polygons[0]!.outer
          : undefined);
    if (!entity || !contour || entity.locked) return;
    let nearest: { index: number; distance: number; contour?: number };
    if (entity.kind === "surface")
      nearest = nearestRawSegment(point, contour, true);
    else if (entity.kind === "building") nearest = buildingNearest!;
    else if (
      entity.kind === "wall" ||
      entity.kind === "path" ||
      entity.kind === "roof"
    )
      nearest = nearestInsertionSegment(point, entity);
    else return;
    if (nearest.distance > Math.max(0.6, 12 / this.renderer.camera.scale))
      return;
    const points = [...contour];
    points.splice(nearest.index + 1, 0, this.snap(point));
    const contourIndex = nearest.contour ?? 0;
    if (entity.kind === "building") {
      const after = replaceBuildingContour(entity, contourIndex, points),
        command = planBuildingContourMutation({
        entities: [...this.session.entities.values()],
        before: entity,
        after,
        edit: {
          kind: "insert",
          contour: contourIndex,
          index: nearest.index + 1,
        },
      });
      if (command) this.session.execute(command);
    } else {
      const after = replaceContour(entity, points, contourIndex);
      this.session.execute({
        label: "Konturpunkt einfügen",
        entities: [{ id: entity.id, before: entity, after }],
      });
    }
    void this.select(entity.id);
  }
  private previewPolygonDraft(
    draft: PathDraft,
    cursor?: Point,
    pendingCurve?: { vertex: Point; handle: Point },
    erase = draft.erase,
  ): void {
    const vertices = [...draft.points],
      curves = [...(draft.curves ?? [])];
    if (pendingCurve) {
      vertices.push(pendingCurve.vertex);
      curves.push({ index: vertices.length - 1, handle: pendingCurve.handle });
    } else if (cursor) vertices.push(cursor);
    const unresolved = curves.some((curve) => curve.index === vertices.length - 1),
      closed = vertices.length >= 3 && !unresolved;
    this.renderer.previewPath(
      buildingPolygonPoints(vertices, curves, closed),
      closed,
      false,
      closed,
      erase,
      vertices,
      true,
    );
  }
  private refreshFloorPathPreview(
    draft: PathDraft,
    cursor?: Point,
    erase = draft.erase,
  ): void {
    if (draft.tool === "corridor")
      this.renderer.previewBrush(
        cursor ? [...draft.points, cursor] : draft.points,
        this.settings.corridorRadius,
        erase,
      );
    else if (draft.tool === "polygon")
      this.previewPolygonDraft(draft, cursor, undefined, erase);
  }
  private update(e: PointerEvent): void {
    const g = this.gesture;
    if (!g) {
      if (this.tool === "edit-points") {
        const building = this.selection.size === 1 && this.selected
          ? this.session.entities.get(this.selected) : undefined;
        if (building?.kind === "building" && !building.locked) {
          const point = this.renderer.toWorld(this.renderer.local(e)),
            tolerance = buildingPointGripPixels / this.renderer.camera.scale,
            vertex = buildingVertexGrip(building, point, tolerance),
            edge = vertex ? null : buildingEdgeMidpointGrip(building, point, tolerance);
          this.hoveredBuildingVertex = vertex ?? undefined;
          this.renderer.setBuildingPointHover(vertex
            ? { contour: vertex.contour, index: vertex.index, kind: "vertex" }
            : edge
              ? { contour: edge.contour, index: edge.index, kind: "edge" }
              : undefined);
        } else {
          this.hoveredBuildingVertex = undefined;
          this.renderer.setBuildingPointHover();
        }
        return;
      }
      if (this.tool === "object") {
        this.objectPreviewPoint = this.snap(
          this.renderer.toWorld(this.renderer.local(e)),
        );
        this.refreshObjectPreview();
        return;
      }
      if (this.tool === "prefab") {
        this.renderer.previewBrush(
          [this.snap(this.renderer.toWorld(this.renderer.local(e)))],
          0.08,
          false,
        );
        return;
      }
      if (this.pathDraft) {
        const point = this.snap(this.renderer.toWorld(this.renderer.local(e)));
        if (this.pathDraft.tool === "corridor" ||
            this.pathDraft.tool === "polygon")
          this.refreshFloorPathPreview(this.pathDraft, point,
            floorEraseActive(this.settings.floorMode, e.altKey));
        else
          this.renderer.previewPath(
            [...this.pathDraft.points, point],
            this.pathDraft.tool === "pattern" ||
              this.pathDraft.tool === "roof" ||
              this.pathDraft.tool === "water" ||
              (this.pathDraft.tool === "path" && this.settings.path.closed),
            (this.pathDraft.tool === "wall" && this.settings.wall.smooth) ||
              (this.pathDraft.tool === "path" && this.settings.path.smooth),
            this.pathDraft.tool === "pattern" ||
              this.pathDraft.tool === "roof" ||
              this.pathDraft.tool === "water",
            false,
          );
      }
      return;
    }
    if (g.pointer !== e.pointerId) return;
    const local = this.renderer.local(e),
      point = this.renderer.toWorld(local);
    if (Math.hypot(local.x - g.startLocal.x, local.y - g.startLocal.y) > 1)
      g.moved = true;
    if (g.tool === "polygon" && e.shiftKey) g.curve = true;
    if (isFloorTool(g.tool))
      g.erase = floorEraseActive(this.settings.floorMode, e.altKey);
    else if (g.tool === "water" && this.settings.waterShape !== "brush")
      g.erase = e.altKey;
    if (g.tool === "pan") {
      if (!g.temporaryPan || this.space)
        this.renderer.pan(local.x - g.last.x, local.y - g.last.y);
    }
    else if (g.tool === "edit-points" && g.entity?.kind === "building" && g.moved)
      this.previewBuildingPointGesture(g, point);
    else if (g.tool === "select" && g.groupTransform &&
      g.groupTransform.action.mode !== "move") {
      const { sources, frame, action } = g.groupTransform,
        result = transformSelectionGroup(sources, frame, action, g.start, point);
      this.renderer.previewGroupTransform(
        sources.map((before, index) => ({ before, after: result.entities[index]! })),
        result.frame,
      );
    } else if (g.tool === "select" && g.transform &&
      g.transform.action.mode !== "move") {
      const { source, action, frame } = g.transform;
      if (action.mode === "scale" && source.kind === "light" && frame) {
        const result = transformSelectionGroup([source], frame, action, g.start, point);
        this.renderer.previewTransform(source, result.entities[0]!, result.frame);
      } else
        this.renderer.previewTransform(source,
          action.mode === "scale" && source.kind !== "light"
            ? scaleBoxSelection(source, action.corner, g.start, point)
            : rotateBoxSelection(source, g.start, point));
    } else if (g.tool === "select" && !g.entity) {
      g.marqueePrevious = this.renderer.toWorld(g.last);
      this.renderer.previewMarquee(g.start, point);
    } else if (
      g.tool === "polygon" ||
      g.tool === "corridor" ||
      g.tool === "wall" ||
      g.tool === "path" ||
      (g.tool === "roof" && this.settings.roofShape === "polygon") ||
      (g.tool === "water" && this.settings.waterShape === "polygon") ||
      (g.tool === "pattern" && this.settings.surfaceShape === "polygon")
    ) {
      const points = [...(this.pathDraft?.points ?? []), this.snap(point)];
      if (g.tool === "corridor")
        this.renderer.previewBrush(
          points,
          this.settings.corridorRadius,
          g.erase,
        );
      else if (g.tool === "polygon") {
        const draft = this.pathDraft;
        if (draft)
          this.previewPolygonDraft(
            draft,
            g.curve && g.moved ? undefined : this.snap(point),
            g.curve && g.moved
              ? { vertex: this.snap(g.start), handle: this.snap(point) }
              : undefined,
            g.erase,
          );
      }
      else
        this.renderer.previewPath(
          points,
          g.tool === "pattern" ||
            g.tool === "roof" ||
            g.tool === "water" ||
            (g.tool === "path" && this.settings.path.closed),
          (g.tool === "wall" && this.settings.wall.smooth) ||
            (g.tool === "path" && this.settings.path.smooth),
          g.tool === "pattern" ||
            g.tool === "roof" ||
            g.tool === "water",
          false,
        );
    } else if (
      g.tool === "ellipse" ||
      (g.tool === "water" && this.settings.waterShape === "ellipse") ||
      (g.tool === "pattern" && this.settings.surfaceShape === "ellipse")
    ) {
      const a = this.snap(g.start), b = this.snap(point);
      this.renderer.previewRoom(
        g.tool === "ellipse" ? buildingEllipse(a, b) : ellipse(a, b),
        g.tool === "ellipse" && g.erase,
        g.tool === "ellipse"
          ? { width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y), at: b }
          : undefined,
      );
    }
    else if (this.isBrushTool(g.tool)) {
      for (const sample of e.getCoalescedEvents?.().length
        ? e.getCoalescedEvents()
        : [e])
        g.points.push(this.renderer.toWorld(this.renderer.local(sample)));
      this.renderer.previewBrush(g.points, this.settings.brushRadius, g.erase);
    } else if (g.tool === "scatter") {
      for (const sample of e.getCoalescedEvents?.().length
        ? e.getCoalescedEvents()
        : [e])
        g.points.push(this.renderer.toWorld(this.renderer.local(sample)));
      this.renderer.previewBrush(
        g.points,
        Math.max(0.15, this.settings.scatter.spread),
        false,
      );
    } else if (
      g.tool === "room" ||
      (g.tool === "roof" && this.settings.roofShape === "rectangle") ||
      (g.tool === "water" && this.settings.waterShape === "rectangle") ||
      (g.tool === "pattern" && this.settings.surfaceShape === "rectangle")
    ) {
      const a = this.snap(g.start), b = this.snap(point);
      this.renderer.previewRoom(
        rectangle(a, b),
        g.tool === "room" && g.erase,
        g.tool === "room"
          ? { width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y), at: b }
          : undefined,
      );
    }
    else if (g.tool === "select" && g.entity && !g.entity.locked) {
      const dx = Math.round(point.x - g.start.x),
        dy = Math.round(point.y - g.start.y);
      if (g.entity.kind === "roof" && g.ridge !== undefined) {
        const ridge = g.entity.ridge.map((p, index) =>
          index === g.ridge ? { x: p.x + dx, y: p.y + dy } : p,
        );
        this.renderer.previewPath(ridge, false, false);
      } else if (g.corner !== undefined) {
        const source =
          g.entity.kind === "building" && g.contour !== undefined
            ? buildingContourEntries(g.entity)[g.contour]?.points
            : g.entity.kind === "wall" ||
          g.entity.kind === "path" ||
          g.entity.kind === "roof"
            ? g.entity.points
            : g.entity.kind === "surface" &&
                g.entity.polygons.length === 1 &&
                g.entity.polygons[0]!.holes.length === 0
              ? g.entity.polygons[0]!.outer
              : undefined;
        if (source) {
          const points = source.map((p, i) =>
            i === g.corner ? { x: p.x + dx, y: p.y + dy } : p,
          );
          if (g.entity.kind === "building") {
            const after = replaceBuildingContour(
              g.entity,
              g.contour!,
              points,
            );
            this.renderer.previewBuilding(after.polygons, g.contour!);
          } else if (g.entity.kind === "wall" || g.entity.kind === "path")
            this.renderer.previewPath(points, g.entity.closed, g.entity.smooth);
          else this.renderer.previewRoom(points);
        }
      } else
        this.renderer.previewMove(
          this.selection.has(g.entity.id) ? this.selection : [g.entity.id],
          dx,
          dy,
        );
    }
    g.last = local;
  }
  private commitSelectionGesture(g: Gesture, e: PointerEvent, point: Point): boolean {
    if (g.tool === "select" && g.groupTransform) {
      const { sources, frame, action, blank } = g.groupTransform;
      if (!g.moved) {
        if (blank && action.mode === "rotate") void this.select(undefined);
        return true;
      }
      if (action.mode !== "move") {
        const result = transformSelectionGroup(sources, frame, action, g.start, point);
        executeLinkedObjectChanges(this.session,
          action.mode === "scale" ? "Auswahl gemeinsam skalieren" : "Auswahl gemeinsam drehen",
          sources.map((before, index) => {
            const transformed = result.entities[index]!;
            return {
              id: before.id, before,
              after: transformed.kind === "object"
                ? objectAtPoint(this.session, transformed,
                    { x: transformed.x, y: transformed.y })
                : transformed,
            };
          }));
        this.renderer.setSelectionGroupFrame(result.frame);
        return true;
      }
    }
    if (g.tool === "select" && g.transform) {
      const { source, action, blank, frame } = g.transform;
      if (!g.moved) {
        if (blank && action.mode === "rotate") void this.select(undefined);
        return true;
      }
      if (action.mode !== "move") {
        const scaledLight = action.mode === "scale" && source.kind === "light" && frame
          ? transformSelectionGroup([source], frame, action, g.start, point)
          : undefined,
          transformed = scaledLight?.entities[0] ??
            (action.mode === "scale" && source.kind !== "light"
              ? scaleBoxSelection(source, action.corner, g.start, point)
              : rotateBoxSelection(source, g.start, point)),
          after = transformed.kind === "object"
            ? objectAtPoint(this.session, transformed,
                { x: transformed.x, y: transformed.y })
            : transformed;
        if (JSON.stringify(source) !== JSON.stringify(after))
          executeLinkedObjectChanges(this.session,
            action.mode === "scale" ? "Auswahl skalieren" : "Auswahl drehen",
            [{ id: source.id, before: source, after }]);
        if (scaledLight) this.renderer.setSelectionLightFrame(scaledLight.frame);
        return true;
      }
    }
    if (g.tool === "select" && !g.entity && g.moved) {
      const bounds = {
          x: Math.min(g.start.x, point.x),
          y: Math.min(g.start.y, point.y),
          width: Math.abs(g.start.x - point.x),
          height: Math.abs(g.start.y - point.y),
        },
        previous = g.marqueePrevious ?? g.start,
        patternBounds = {
          x: Math.min(g.start.x, previous.x),
          y: Math.min(g.start.y, previous.y),
          width: Math.abs(g.start.x - previous.x),
          height: Math.abs(g.start.y - previous.y),
        },
        ids = [...this.session.entities.values()]
          .filter(
            (entity) =>
              entity.floorId === this.renderer.floorId &&
              selectionAllowed(entity, this.selectionTypes, this.selectionLayers) &&
              !entity.locked &&
              this.renderer.visibleForSelection(entity.id) &&
              selectionInsideBox(entity,
                entity.kind === "surface" && entity.category === "pattern"
                  ? patternBounds : bounds,
                (id) => this.session.entities.get(id)),
          )
          .map((entity) => entity.id);
      void this.selectMany(ids, e.shiftKey);
      return true;
    }
    return false;
  }
  private buildingPointDestination(g: Gesture, point: Point): Point | undefined {
    const grip = g.buildingVertex ?? g.buildingEdge;
    return grip
      ? buildingPointDragDestination(grip, g.start, point, this.snapEnabled)
      : undefined;
  }
  private previewBuildingPointGesture(g: Gesture, point: Point): void {
    const before = g.entity,
      grip = g.buildingVertex ?? g.buildingEdge,
      destination = this.buildingPointDestination(g, point);
    if (before?.kind !== "building" || !grip || !destination) return;
    if (g.buildingPreviewDestination?.x === destination.x &&
        g.buildingPreviewDestination.y === destination.y) return;
    const proposal = proposeBuildingPointDrag(before, grip, destination);
    if (!proposal) return;
    const portals = [...this.session.dependents(before.id)]
        .map((id) => this.session.entities.get(id))
        .filter((entity): entity is Entity =>
          entity?.kind === "door" && entity.anchor?.boundaryId === before.id),
      preview = previewBuildingMutationWithPortals(portals, before,
        proposal.after, proposal.edit);
    this.renderer.previewBuildingShape(preview.building, grip.contour, preview.portals);
    g.buildingPreviewDestination = destination;
  }
  private commitBuildingPointGesture(g: Gesture, point: Point): void {
    if (!g.moved || g.entity?.kind !== "building") return;
    const grip = g.buildingVertex ?? g.buildingEdge,
      destination = this.buildingPointDestination(g, point),
      proposal = grip && destination
        ? proposeBuildingPointDrag(g.entity, grip, destination) : null;
    if (proposal && !(g.buildingVertex &&
        destination?.x === g.buildingVertex.point.x &&
        destination.y === g.buildingVertex.point.y)) {
      const command = planBuildingContourMutation({
        entities: [...this.session.entities.values()],
        before: g.entity,
        ...proposal,
      });
      if (command) this.session.execute(command);
    }
    this.hoveredBuildingVertex = undefined;
    this.renderer.setBuildingPointHover();
  }
  private commitToolGesture(g: Gesture, e: PointerEvent, point: Point): void {
    if (g.tool === "edit-points") {
      this.commitBuildingPointGesture(g, point);
      return;
    }
    if (g.tool === "room") {
      const a = this.snap(g.start),
        b = this.snap(point);
      if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return;
      this.paintTask = this.composeFloor(
        [{ outer: rectangle(a, b), holes: [] }],
        g.erase,
      );
    } else if (g.tool === "ellipse") {
      const a = this.snap(g.start),
        b = this.snap(point);
      if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return;
      this.paintTask = this.composeFloor(
        [{ outer: buildingEllipse(a, b), holes: [] }],
        g.erase,
      );
    } else if (
      g.tool === "pattern" &&
      this.settings.surfaceShape !== "polygon"
    ) {
      const a = this.snap(g.start),
        b = this.snap(point);
      if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return;
      const surface = createSurface(
        this.session,
        this.renderer.floorId,
        "pattern",
        this.settings.surfaceShape === "ellipse"
          ? ellipse(a, b)
          : rectangle(a, b),
        {
          ...this.settings.surfaces.pattern,
          material: this.settings.material,
        },
      );
      void this.select(surface.id);
    } else if (
      g.tool === "water" &&
      (this.settings.waterShape === "rectangle" ||
        this.settings.waterShape === "ellipse")
    ) {
      const a = this.snap(g.start),
        b = this.snap(point);
      if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return;
      this.paintTask = this.composeArea(
        "water",
        [
          {
            outer:
              this.settings.waterShape === "ellipse"
                ? ellipse(a, b)
                : rectangle(a, b),
            holes: [],
          },
        ],
        g.erase,
      );
    } else if (g.tool === "roof" && this.settings.roofShape === "rectangle") {
      const a = this.snap(g.start),
        b = this.snap(point);
      if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return;
      const roof = createRoof(
        this.session,
        this.renderer.floorId,
        rectangle(a, b),
        { ...this.settings.roof, material: this.settings.material },
      );
      void this.select(roof.id);
    } else if (
      g.tool === "polygon" ||
      g.tool === "corridor" ||
      g.tool === "wall" ||
      g.tool === "path" ||
      (g.tool === "roof" && this.settings.roofShape === "polygon") ||
      (g.tool === "water" && this.settings.waterShape === "polygon") ||
      (g.tool === "pattern" && this.settings.surfaceShape === "polygon")
    ) {
      const next = this.snap(
          g.tool === "polygon" && g.curve && g.moved ? g.start : point,
        ),
        extension =
          !this.pathDraft && g.tool === "wall" && e.ctrlKey
            ? this.wallExtension(next)
            : undefined,
        draft: PathDraft =
          this.pathDraft?.tool === g.tool
            ? this.pathDraft
            : {
                tool: g.tool,
                points: extension ? [...extension.points] : [],
                erase: g.erase,
                smooth:
                  (g.tool === "wall" &&
                    (extension?.smooth ?? this.settings.wall.smooth)) ||
                  (g.tool === "path" && this.settings.path.smooth) ||
                  ((g.tool === "wall" || g.tool === "path") && e.shiftKey),
                curves: [],
                sourceId: extension?.id,
              },
        duplicate = draft.points.some(
          (candidate, index) =>
            index === draft.points.length - 1 &&
            candidate.x === next.x &&
            candidate.y === next.y,
        ),
        closed =
          g.tool === "polygon" ||
          g.tool === "pattern" ||
          g.tool === "roof" ||
          g.tool === "water" ||
          (g.tool === "path" && this.settings.path.closed),
        closeAtStart =
          closed &&
          draft.points.length >= 3 &&
          Math.hypot(next.x - draft.points[0]!.x, next.y - draft.points[0]!.y) <
            Math.max(0.7, 12 / this.renderer.camera.scale),
        finish =
          closeAtStart ||
          (e.detail >= 2 && draft.points.length >= (closed ? 3 : 2));
      if (g.tool === "polygon" || g.tool === "corridor")
        draft.erase = g.erase;
      if (!finish && !duplicate) {
        draft.points.push(next);
        if (g.tool === "polygon" && g.curve && g.moved &&
            draft.points.length >= 2)
          (draft.curves ??= []).push({
            index: draft.points.length - 1,
            handle: this.snap(point),
          });
      }
      if (finish) {
        this.completePathDraft(draft);
      } else {
        this.pathDraft = draft;
        if (g.tool === "corridor" || g.tool === "polygon")
          this.refreshFloorPathPreview(draft);
        else
          this.renderer.previewPath(
            draft.points,
            closed,
            draft.smooth,
            g.tool === "pattern" ||
              g.tool === "roof" ||
              g.tool === "water",
            g.tool === "water" && draft.erase,
          );
      }
    } else if (this.isBrushTool(g.tool)) {
      g.points.push(point);
      this.paintTask = this.paint(g);
    } else if (g.tool === "light") {
      const light = createLight(
        this.session,
        this.renderer.floorId,
        this.snap(point),
        this.settings.light,
      );
      void this.select(light.id);
    } else if (g.tool === "object") {
      const o = createObject(
        this.session,
        this.renderer.floorId,
        this.snap(point),
        this.settings.object,
      );
      void this.select(o.id);
    } else if (g.tool === "scatter") {
      g.points.push(point);
      const objects = scatterObjects(
        this.session,
        this.renderer.floorId,
        g.points,
        { object: this.settings.object, ...this.settings.scatter },
      );
      this.settings.scatter.seed++;
      this.selection = new Set(objects.map((object) => object.id));
      this.selected = objects.at(-1)?.id;
      this.renderer.select(this.selection);
      this.refreshProperties();
    } else if (g.tool === "door") void this.placeDoor(point);
    else if (g.tool === "select" && g.entity && g.moved && !g.entity.locked) {
      const original = g.entity,
        dx = Math.round(point.x - g.start.x),
        dy = Math.round(point.y - g.start.y);
      if (!dx && !dy) return;
      if (
        this.selection.size > 1 &&
        this.selection.has(original.id) &&
        g.corner === undefined &&
        g.ridge === undefined
      ) {
        const chosen = new Set(this.selection),
          changes = new Map<string, RecordChange<Entity>>();
        for (const id of chosen) {
          const entity = this.session.entities.get(id);
          if (!entity || entity.locked) continue;
          let after: Entity;
          if (entity.kind === "door" && entity.anchor) {
            if (chosen.has(entity.anchor.boundaryId)) continue;
            const boundary = this.session.entities.get(
                entity.anchor.boundaryId,
              ),
              pose = portalPose(entity, (source) =>
                this.session.entities.get(source),
              );
            if (boundary?.kind !== "building" && boundary?.kind !== "wall")
              continue;
            after = {
              ...entity,
              anchor: {
                boundaryId: boundary.id,
                ...this.portalAt(
                  { x: pose.x + dx, y: pose.y + dy },
                  boundary,
                  entity.width,
                ),
              },
            };
          } else after = entity.kind === "object"
            ? objectAtPoint(this.session, entity,
                { x: entity.x + dx, y: entity.y + dy })
            : moveEntity(entity, dx, dy);
          changes.set(id, { id, before: entity, after });
          if (entity.kind === "building")
            for (const dependentId of this.session.dependents(entity.id)) {
              if (chosen.has(dependentId)) continue;
              const dependent = this.session.entities.get(dependentId);
              if (dependent?.kind === "object" && !dependent.locked)
                changes.set(dependent.id, {
                  id: dependent.id,
                  before: dependent,
                  after: moveEntity(dependent, dx, dy),
                });
            }
        }
        if (changes.size) {
          const frame = this.renderer.selectionGroupFrame;
          executeLinkedObjectChanges(this.session, "Auswahl verschieben", [...changes.values()]);
          if (frame) this.renderer.setSelectionGroupFrame({
            ...frame, x: frame.x + dx, y: frame.y + dy,
          });
        }
        return;
      }
      if (original.kind === "object") {
        executeLinkedObjectChanges(this.session, "Möbel verschieben", [
            {
              id: original.id,
              before: original,
              after: objectAtPoint(this.session, original,
                { x: original.x + dx, y: original.y + dy }),
            },
          ]);
      } else if (
        original.kind === "building" ||
        original.kind === "wall" ||
        original.kind === "path" ||
        original.kind === "roof" ||
        original.kind === "surface"
      ) {
        let after: Entity;
        if (original.kind === "roof" && g.ridge !== undefined)
          after = {
            ...original,
            ridge: original.ridge.map((p, index) =>
              index === g.ridge ? { x: p.x + dx, y: p.y + dy } : p,
            ),
          };
        else if (original.kind === "surface" && g.corner !== undefined)
          after = {
            ...original,
            polygons: [
              {
                outer: original.polygons[0]!.outer.map((p, index) =>
                  index === g.corner ? { x: p.x + dx, y: p.y + dy } : p,
                ),
                holes: [],
              },
            ],
          };
        else if (
          (original.kind === "wall" ||
            original.kind === "path" ||
            original.kind === "roof") &&
          g.corner !== undefined
        )
          after = {
            ...original,
            points: original.points.map((p, index) =>
              index === g.corner ? { x: p.x + dx, y: p.y + dy } : p,
            ),
          };
        else if (
          original.kind === "building" &&
          g.corner !== undefined &&
          g.contour !== undefined
        ) {
          const points = buildingContourEntries(original)[
            g.contour
          ]!.points.map((point, index) =>
            index === g.corner
              ? { x: point.x + dx, y: point.y + dy }
              : point,
          );
          after = replaceBuildingContour(original, g.contour, points);
        }
        else after = moveEntity(original, dx, dy);
        if (
          original.kind === "building" &&
          after.kind === "building" &&
          g.corner !== undefined &&
          g.contour !== undefined
        ) {
          const command = planBuildingContourMutation({
            entities: [...this.session.entities.values()],
            before: original,
            after,
            edit: {
              kind: "move",
              contour: g.contour,
              index: g.corner,
            },
          });
          if (command) this.session.execute(command);
          return;
        }
        const changes: RecordChange<Entity>[] = [
          { id: original.id, before: original, after },
        ];
        if (
          original.kind === "building" &&
          g.corner === undefined &&
          g.ridge === undefined
        )
          for (const id of this.session.dependents(original.id)) {
            const object = this.session.entities.get(id);
            if (object?.kind === "object")
              changes.push({
                id,
                before: object,
                after: { ...object, x: object.x + dx, y: object.y + dy },
              });
          }
        this.session.execute({
          label:
            g.corner === undefined
              ? isRoom(original)
                ? "Raum verschieben"
                : "Element verschieben"
              : "Konturpunkt verschieben",
          entities: changes,
        });
      } else if (original.kind === "door") {
        const boundary = original.anchor
          ? this.session.entities.get(original.anchor.boundaryId)
          : undefined;
        if (boundary?.kind === "building" || boundary?.kind === "wall") {
          this.session.execute({
            label: "Tür verschieben",
            entities: [
              {
                id: original.id,
                before: original,
                after: {
                  ...original,
                  anchor: {
                    boundaryId: boundary.id,
                    ...this.portalAt(point, boundary, original.width),
                  },
                },
              },
            ],
          });
        } else
          this.session.execute({
            label: "Portal verschieben",
            entities: [
              {
                id: original.id,
                before: original,
                after: moveEntity(original, dx, dy),
              },
            ],
          });
      } else
        this.session.execute({
          label: "Objekt verschieben",
          entities: [
            {
              id: original.id,
              before: original,
              after: moveEntity(original, dx, dy),
            },
          ],
        });
    }
  }
  private commit(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || g.pointer !== e.pointerId) return;
    const point = this.renderer.toWorld(this.renderer.local(e));
    if (isFloorTool(g.tool))
      g.erase = floorEraseActive(this.settings.floorMode, e.altKey);
    this.gesture = undefined;
    this.renderer.cancelPreview(
      g?.entity && this.selection.has(g.entity.id)
        ? this.selection
        : g?.entity
          ? [g.entity.id]
          : [],
    );
    if (this.renderer.canvas.hasPointerCapture(e.pointerId))
      this.renderer.canvas.releasePointerCapture(e.pointerId);
    if (this.commitSelectionGesture(g, e, point)) return;
    this.commitToolGesture(g, e, point);
  }
  private composeFloor(
    shape: readonly Polygon[] | undefined,
    erase: boolean,
    stroke?: readonly Point[],
  ): Promise<void> {
    return this.composeArea("floor", shape, erase, stroke);
  }
  private async composeArea(
    category: "floor" | "water",
    shape: readonly Polygon[] | undefined,
    erase: boolean,
    stroke?: readonly Point[],
  ): Promise<void> {
    const floorId = this.renderer.floorId,
      defaults = this.settings.surfaces[category],
      material = this.settings.material,
      styleKey = (source: Surface | Building) =>
        source.kind === "building"
          ? JSON.stringify([
              source.layer,
              source.fill,
              source.wall,
              source.wallWidth,
              1,
              "none",
              source.material ?? null,
            ])
          : JSON.stringify([
              source.layer,
              source.color,
              source.wallColor,
              source.wallWidth,
              source.opacity ?? 1,
              source.effect ?? "none",
              source.material ?? null,
            ]),
      desiredStyle = JSON.stringify([
        defaults.layer,
        defaults.color,
        defaults.wallColor,
        defaults.wallWidth,
        defaults.opacity ?? 1,
        defaults.effect ?? "none",
        material ?? null,
      ]),
      sources = [...this.session.entities.values()].filter(
        (entity): entity is Surface | Building => {
          const source =
            category === "floor"
              ? entity.kind === "building"
              : entity.kind === "surface" && entity.category === "water";
          if (!source) return false;
          return (
            entity.floorId === floorId &&
            !entity.locked &&
            (erase ||
              styleKey(entity as Surface | Building) === desiredStyle)
          );
        },
      ),
      sourceById = new Map(sources.map((source) => [source.id, source])),
      revision = this.session.revision,
      token = ++this.paintGeneration,
      worker = new ComputeClient(),
      started = performance.now();
    this.paintWorker = worker;
    this.refresh();
    try {
      const result = await worker.request<ComposeBuildingResult>({
        kind: "compose-building",
        nativeBuilding: category === "floor",
        sources: sources.map((source) => ({
          id: source.id,
          polygons: source.polygons,
        })),
        ...(shape ? { shape } : {}),
        ...(stroke
          ? { stroke: { points: stroke, radius: this.settings.corridorRadius } }
          : {}),
        erase,
      });
      const computed = performance.now();
      if (
        this.closed ||
        token !== this.paintGeneration ||
        !this.session.floors.has(floorId)
      )
        return;
      const changedIds =
        result.mode === "draw"
          ? result.mergedIds
          : result.changes.map((change) => change.id);
      for (const id of changedIds)
        if (this.session.entities.get(id) !== sourceById.get(id))
          throw new Error(
            (category === "floor" ? "Der Grundriss" : "Die Wasserfläche") +
              " wurde inzwischen geändert. Zeichenschritt bitte wiederholen.",
          );
      let selected: string | undefined;
      if (category === "floor") {
        const newBuilding: Building | undefined =
            result.mode === "draw" && !result.mergedIds.length
              ? {
                  id: uid(),
                  kind: "building",
                  floorId,
                  polygons: result.polygons,
                  layer: defaults.layer,
                  fill: defaults.color,
                  wall: defaults.wallColor,
                  wallWidth: defaults.wallWidth,
                  ...(material ? { material } : {}),
                }
              : undefined,
          plan = planBuildingMutation({
            entities: [...this.session.entities.values()],
            floorId,
            result,
            expectedRevision: revision,
            currentRevision: this.session.revision,
            ...(newBuilding ? { newBuilding } : {}),
          });
        if (!plan.command) return;
        this.session.execute(plan.command);
        selected = plan.selectedId;
      } else {
        const changes: RecordChange<Entity>[] = [];
        if (result.mode === "draw") {
          if (!result.polygons.length) return;
          const targetId = result.mergedIds[0] ?? uid(),
            before = sourceById.get(targetId),
            after: Surface = before
              ? { ...(before as Surface), polygons: result.polygons }
              : {
                  id: targetId,
                  kind: "surface",
                  floorId,
                  category: "water",
                  polygons: result.polygons,
                  ...defaults,
                  ...(material ? { material } : {}),
                };
          changes.push({ id: targetId, before: before ?? null, after });
          for (const id of result.mergedIds.slice(1))
            changes.push({ id, before: sourceById.get(id)!, after: null });
          selected = targetId;
        } else {
          for (const change of result.changes) {
            const before = sourceById.get(change.id)!;
            changes.push({
              id: change.id,
              before,
              after: change.polygons.length
                ? { ...before, polygons: change.polygons }
                : null,
            });
            if (change.polygons.length) selected = change.id;
          }
        }
        if (!changes.length) return;
        this.session.execute({
          label: erase ? "Wasser ausradieren" : "Wasser zeichnen",
          entities: changes,
        });
      }
      const committed = performance.now();
      this.lastPaintMetrics = {
        points:
          stroke?.length ??
          shape?.reduce(
            (count, polygon) =>
              count +
              polygon.outer.length +
              polygon.holes.reduce((sum, hole) => sum + hole.length, 0),
            0,
          ) ??
          0,
        computeMs: computed - started,
        commitMs: committed - computed,
        totalMs: committed - started,
      };
      await this.select(selected);
    } catch (error) {
      if (token === this.paintGeneration && !this.closed)
        this.host.notice(
          error instanceof Error ? error.message : String(error),
        );
    } finally {
      worker.destroy();
      if (token === this.paintGeneration) {
        this.paintWorker = undefined;
        this.refresh();
      }
    }
  }
  private async paint(g: Gesture): Promise<void> {
    const before = g.entity?.kind === "surface" ? g.entity : undefined;
    if (g.erase && !before) return;
    const floorId = this.renderer.floorId,
      token = ++this.paintGeneration,
      worker = new ComputeClient(),
      started = performance.now();
    this.paintWorker = worker;
    this.refresh();
    try {
      const polygons = await worker.request<Polygon[]>({
        kind: "paint",
        polygons: before?.polygons ?? [],
        points: g.points,
        radius: this.settings.brushRadius,
        erase: g.erase,
      });
      const computed = performance.now();
      if (
        this.closed ||
        token !== this.paintGeneration ||
        !this.session.floors.has(floorId)
      )
        return;
      if (before && this.session.entities.get(before.id) !== before)
        throw new Error(
          "Die Fläche wurde inzwischen geändert. Pinselstrich bitte wiederholen.",
        );
      if (!polygons.length && !before) return;
      const id = before?.id ?? uid(),
        category: Surface["category"] =
          g.tool === "cave" ||
          g.tool === "material" ||
          g.tool === "water" ||
          g.tool === "terrain"
            ? g.tool
            : "material",
        defaults =
          category === "cave" || category === "water" || category === "terrain"
            ? this.settings.surfaces[category]
            : {
                layer: this.settings.layer,
                color: 0xb5a57b,
                wallColor: 0x454443,
                wallWidth: 0,
                opacity: 1,
                effect: "none" as const,
              };
      const after: Surface | null = polygons.length
        ? {
            id,
            kind: "surface",
            floorId,
            category,
            ...defaults,
            material: this.settings.material,
            ...before,
            polygons,
          }
        : null;
      this.session.execute({
        label: g.erase ? "Fläche ausradieren" : "Fläche malen",
        entities: [{ id, before: before ?? null, after }],
      });
      const committed = performance.now();
      this.lastPaintMetrics = {
        points: g.points.length,
        computeMs: computed - started,
        commitMs: committed - computed,
        totalMs: committed - started,
      };
      await this.select(after?.id);
    } catch (error) {
      if (token === this.paintGeneration && !this.closed)
        this.host.notice(String(error));
    } finally {
      worker.destroy();
      if (token === this.paintGeneration) {
        this.paintWorker = undefined;
        this.refresh();
      }
    }
  }
  private async placeDoor(point: Point): Promise<void> {
    const { freestanding, rotation, ...settings } = this.settings.portal;
    if (freestanding) {
      const door = createPortal(
        this.session,
        this.renderer.floorId,
        { point: this.snap(point), rotation },
        settings,
      );
      await this.select(door.id);
      return;
    }
    let best:
      | {
          boundary: Boundary;
          contour: number;
          at: number;
          distance: number;
        }
      | undefined;
    for (const e of this.session.entities.values())
      if (
        (e.kind === "building" || e.kind === "wall") &&
        e.floorId === this.renderer.floorId
      ) {
        const nearest = nearestBoundary(point, e);
        if (!best || nearest.distance < best.distance)
          best = { boundary: e, ...nearest };
      }
    if (
      !best ||
      best.distance > Math.max(0.6, 12 / this.renderer.camera.scale)
    ) {
      this.host.notice(
        "Portal an einer Wand platzieren oder Freistehend wählen.",
      );
      return;
    }
    try {
      if (
        isRoom(best.boundary) && best.boundary.note &&
        this.session.note(best.boundary.note.path) === undefined
      )
        await this.repository.loadNote(this.session, best.boundary.note.path);
      if (this.closed) return;
      const door = createPortal(
        this.session,
        this.renderer.floorId,
        {
          boundary: best.boundary,
          anchor: this.portalAt(point, best.boundary, settings.width),
        },
        settings,
      );
      await this.select(door.id);
    } catch (error) {
      this.host.notice(String(error));
    }
  }
  private async select(
    id: string | undefined,
    additive = false,
  ): Promise<void> {
    return this.selectMany(id ? [id] : [], additive, id);
  }
  private async selectMany(
    ids: readonly string[],
    additive = false,
    primary = ids.at(-1),
  ): Promise<void> {
    if (this.structuredPanel && !this.structuredPanel.commit()) return;
    const targets = [
      ...new Set(
        ids.flatMap((id) => {
          const entity = this.session.entities.get(id);
          return entity?.groupId
            ? [...this.session.entities.values()]
                .filter(
                  (candidate) =>
                    candidate.groupId === entity.groupId &&
                    candidate.floorId === this.renderer.floorId,
                )
                .map((candidate) => candidate.id)
            : entity
              ? [entity.id]
              : [];
        }),
      ),
    ];
    if (!additive) this.selection.clear();
    if (
      additive &&
      targets.length &&
      targets.every((target) => this.selection.has(target))
    )
      for (const target of targets) this.selection.delete(target);
    else for (const target of targets) this.selection.add(target);
    this.selected =
      primary && this.selection.has(primary)
        ? primary
        : [...this.selection].at(-1);
    this.renderer.select(this.selection);
    this.refreshProperties();
    await this.refreshSelectedNote();
  }
  private selectedNotePath(): string | undefined {
    const room = this.selectedRoom();
    const e = this.selected ? this.session.entities.get(this.selected) : undefined;
    return isRoom(room) ? room.note?.path : e?.note?.path;
  }
  private selectedRoom(): Entity | undefined {
    const e = this.selected
      ? this.session.entities.get(this.selected)
      : undefined;
    return isRoom(e) ? e : e?.roomId ? this.session.entities.get(e.roomId) : undefined;
  }
  private async refreshSelectedNote(): Promise<void> {
    const token = ++this.selectionToken;
    this.structuredPanel?.destroy();
    this.structuredPanel = undefined;
    const selectedEntity = this.selected ? this.session.entities.get(this.selected) : undefined;
    const target = selectedEntity?.keyTarget;
    const room = target ? this.session.entities.get(target.roomId) : this.selectedRoom();
    if (isStructuredRoom(room)) {
      const occurrence = this.session.content.occurrences.find((item) =>
        item.entityId === this.selected && item.roomId === room.id);
      this.notePath = undefined;
      this.text.hidden = true;
      this.structuredHost.hidden = false;
      this.openKeyButton.textContent = "Raum-Key öffnen";
      this.structuredPanel = new StructuredKeyPanel(
        this.host.app, this.structuredHost, this.session, this.host.mapPath,
        room.id, target?.sectionId ?? occurrence?.sectionId,
        this.host.notice, () => !this.host.pending?.(), target?.anchor,
      );
      return;
    }
    this.text.hidden = false;
    this.structuredHost.hidden = true;
    this.openKeyButton.textContent = "Notiz öffnen";
    this.notePath = this.selectedNotePath();
    this.text.disabled = true;
    this.text.value = "";
    this.noteBase = "";
    if (!this.notePath) {
      this.text.placeholder = "Raum auswählen, um den Key zu bearbeiten.";
      return;
    }
    try {
      if (this.session.note(this.notePath) === undefined)
        await this.repository.loadNote(this.session, this.notePath);
      if (this.closed || token !== this.selectionToken) return;
      this.refreshText();
      this.text.disabled = false;
    } catch (error) {
      if (token === this.selectionToken) this.host.notice(String(error));
    }
  }
  private refreshText(): void {
    if (!this.notePath) return;
    const current = this.session.note(this.notePath);
    if (current === undefined || current === null) {
      this.text.disabled = true;
      return;
    }
    this.noteBase = current;
    this.text.value = current;
  }
  commitNote(): void {
    if (this.structuredPanel?.commit() === false)
      throw new Error("Der geänderte Raumabschnitt konnte nicht übernommen werden.");
    if (
      !this.notePath ||
      this.text.disabled ||
      this.noteBase.replace(/\r\n?/g, "\n") === this.text.value
    )
      return;
    const path = this.notePath,
      before = this.noteBase,
      after = this.text.value;
    editNote(this.session, path, before, after);
    this.noteBase = after;
  }
  private finishPathDraft(altKey: boolean): void {
    if (!this.pathDraft) return;
    const draft = this.pathDraft,
      closed =
        draft.tool === "polygon" ||
        draft.tool === "pattern" ||
        draft.tool === "roof" ||
        draft.tool === "water" ||
        (draft.tool === "path" && this.settings.path.closed);
    if (draft.tool === "polygon" || draft.tool === "corridor")
      draft.erase = floorEraseActive(this.settings.floorMode, altKey);
    if (draft.points.length < (closed ? 3 : 2)) {
      this.host.notice("Für diese Kontur fehlen noch Punkte.");
      return;
    }
    this.completePathDraft(draft);
  }
  private completePathDraft(draft: PathDraft): void {
    this.pathDraft = undefined;
    if (draft.tool === "corridor")
      this.renderer.previewBrush(
        [],
        this.settings.corridorRadius,
        draft.erase,
      );
    else this.renderer.previewPath([], false, false);
    if (draft.tool === "polygon") {
      this.paintTask = this.composeFloor(
        [{ outer: buildingPolygonPoints(draft.points, draft.curves ?? [], true),
          holes: [] }],
        draft.erase,
      );
    } else if (draft.tool === "corridor") {
      this.paintTask = this.composeFloor(
        undefined,
        draft.erase,
        draft.points,
      );
    } else if (draft.tool === "wall") {
      const source = draft.sourceId
        ? this.session.entities.get(draft.sourceId)
        : undefined;
      if (source?.kind === "wall") {
        const wall = {
          ...source,
          points: draft.points,
          smooth: draft.smooth,
        };
        this.session.execute({
          label: "Wand fortsetzen",
          entities: [{ id: wall.id, before: source, after: wall }],
        });
        void this.select(wall.id);
      } else {
        const wall = createWall(
          this.session,
          this.renderer.floorId,
          draft.points,
          draft.smooth,
          false,
          this.settings.wall.width,
          this.settings.wall.assetId,
          this.settings.wall.layer,
          this.settings.wall.shadow,
        );
        void this.select(wall.id);
      }
    } else if (draft.tool === "pattern") {
      const surface = createSurface(
        this.session,
        this.renderer.floorId,
        "pattern",
        draft.points,
        {
          ...this.settings.surfaces.pattern,
          material: this.settings.material,
        },
      );
      void this.select(surface.id);
    } else if (draft.tool === "roof") {
      const roof = createRoof(
        this.session,
        this.renderer.floorId,
        draft.points,
        { ...this.settings.roof, material: this.settings.material },
      );
      void this.select(roof.id);
    } else if (draft.tool === "water") {
      this.paintTask = this.composeArea(
        "water",
        [{ outer: draft.points, holes: [] }],
        draft.erase,
      );
    } else {
      const path = createMapPath(
        this.session,
        this.renderer.floorId,
        draft.points,
        { ...this.settings.path, material: this.settings.material },
      );
      void this.select(path.id);
    }
  }
  private toggleSnap(): void {
    this.snapEnabled = !this.snapEnabled;
    this.snapButton.setAttribute("aria-pressed", String(this.snapEnabled));
  }
  private key(e: KeyboardEvent): void {
    const command = e.ctrlKey || e.metaKey;
    if (command && e.key.toLowerCase() === "s") {
      e.preventDefault();
      this.toggleSnap();
      void this.save();
      return;
    }
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    if (command && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
      e.preventDefault();
      this.run(() => this.stepHistory(
        e.key.toLowerCase() === "y" || e.shiftKey ? "redo" : "undo",
      ));
      return;
    }
    if (command && e.key.toLowerCase() === "c") {
      e.preventDefault();
      this.run(() => this.copySelection());
      return;
    }
    if (command && e.key.toLowerCase() === "v") {
      e.preventDefault();
      this.run(() => this.pasteSelection());
      return;
    }
    if (command && e.key.toLowerCase() === "g") {
      e.preventDefault();
      this.run(() =>
        e.shiftKey ? this.ungroupSelection() : this.groupSelection(),
      );
      return;
    }
    if (this.tool === "select" && !command && !e.altKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.run(() => this.mirrorSelection());
      return;
    }
    if (this.tool === "object" && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.settings.object = {
        ...this.settings.object,
        flip: !this.settings.object.flip,
      };
      this.host.persistToolDefaults?.();
      this.refreshProperties();
      this.refreshObjectPreview();
      return;
    }
    if (this.tool === "object" && (e.key === "[" || e.key === "]")) {
      e.preventDefault();
      const step = (Math.PI / 12) * (e.key === "]" ? 1 : -1);
      this.settings.object = {
        ...this.settings.object,
        rotation: this.settings.object.rotation + step,
      };
      this.host.persistToolDefaults?.();
      this.refreshProperties();
      this.refreshObjectPreview();
      return;
    }
    if (
      this.tool === "object" &&
      (e.key === "-" || e.key === "+" || e.key === "=")
    ) {
      e.preventDefault();
      const factor = e.key === "-" ? 0.9 : 1.1;
      this.settings.object = {
        ...this.settings.object,
        width: Math.max(0.1, this.settings.object.width * factor),
        height: Math.max(0.1, this.settings.object.height * factor),
      };
      this.host.persistToolDefaults?.();
      this.refreshProperties();
      this.refreshObjectPreview();
      return;
    }
    if (e.key === "Enter" && this.pathDraft) {
      e.preventDefault();
      this.finishPathDraft(e.altKey);
      return;
    }
    if (e.key === "Backspace" && this.pathDraft) {
      e.preventDefault();
      this.pathDraft.points.pop();
      if (this.pathDraft.tool === "polygon")
        this.pathDraft.curves = this.pathDraft.curves?.filter(
          (curve) => curve.index < this.pathDraft!.points.length,
        );
      if (
        this.pathDraft.tool === "polygon" ||
        this.pathDraft.tool === "corridor"
      )
        this.pathDraft.erase = floorEraseActive(
          this.settings.floorMode,
          e.altKey,
        );
      if (this.pathDraft.tool === "corridor" ||
          this.pathDraft.tool === "polygon")
        this.refreshFloorPathPreview(this.pathDraft);
      else
        this.renderer.previewPath(
          this.pathDraft.points,
          this.pathDraft.tool === "pattern" ||
            this.pathDraft.tool === "roof" ||
            this.pathDraft.tool === "water" ||
            (this.pathDraft.tool === "path" && this.settings.path.closed),
          (this.pathDraft.tool === "wall" && this.settings.wall.smooth) ||
            (this.pathDraft.tool === "path" && this.settings.path.smooth),
          this.pathDraft.tool === "pattern" ||
            this.pathDraft.tool === "roof" ||
            this.pathDraft.tool === "water",
          false,
        );
      return;
    }
    if (this.tool === "edit-points" &&
        (e.key === "Backspace" || e.key === "Delete") &&
        this.hoveredBuildingVertex) {
      e.preventDefault();
      const building = this.selected
          ? this.session.entities.get(this.selected) : undefined;
      if (building?.kind !== "building") return;
      const result = planBuildingBackspacePoint(
        [...this.session.entities.values()], building,
        this.hoveredBuildingVertex);
      if (result.command) {
        this.session.execute(result.command);
        this.hoveredBuildingVertex = undefined;
        this.renderer.setBuildingPointHover();
      } else if (result.status === "protected-room")
        this.host.notice("Der letzte Umriss eines nummerierten Raums bleibt erhalten. Raum über das Archiv entfernen.");
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && this.selection.size) {
      e.preventDefault();
      this.run(() => this.archiveSelection());
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      this.space = true;
      const gesture = this.gesture;
      if (gesture && gesture.tool !== "pan") {
        gesture.tool = "pan";
        gesture.temporaryPan = true;
        this.renderer.cancelPreview(
          gesture.entity && this.selection.has(gesture.entity.id)
            ? this.selection
            : gesture.entity
              ? [gesture.entity.id]
              : [],
        );
        if (this.selection.size) void this.select(undefined);
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (this.gesture?.temporaryPan) return;
      if (this.gesture?.tool === "edit-points") {
        const gesture = this.gesture,
          point = this.renderer.toWorld(gesture.last);
        this.run(() => this.commitBuildingPointGesture(gesture, point));
        this.cancel();
        this.setTool("select");
        return;
      }
      if (this.gesture || this.pathDraft || this.paintWorker) {
        const leaveBuilding = isFloorTool(this.tool);
        this.cancel();
        if (leaveBuilding) this.setTool("select");
        return;
      }
      if (this.root.classList.contains("dn-maximized")) {
        if (this.host.exitEditor) {
          this.leaveMaximized();
          return;
        }
        this.setMaximized(false);
      }
      this.cancel();
      this.setTool("select");
      return;
    }
    if (e.key === "v" || e.key.toLowerCase() === "x") this.setTool("select");
    if (e.key === "r") this.setTool("room");
    if (e.key === "p") this.setTool("polygon");
    if (e.key === "e") {
      if (isFloorTool(this.tool)) {
        e.preventDefault();
        this.settings.floorMode =
          this.settings.floorMode === "draw" ? "erase" : "draw";
        if (
          this.pathDraft?.tool === "polygon" ||
          this.pathDraft?.tool === "corridor"
        )
          this.pathDraft.erase = floorEraseActive(
            this.settings.floorMode,
            e.altKey,
          );
        this.host.persistToolDefaults?.();
        this.refreshProperties();
        if (this.pathDraft?.tool === "corridor" ||
            this.pathDraft?.tool === "polygon")
          this.refreshFloorPathPreview(this.pathDraft);
      } else this.setTool("ellipse");
    }
    if (e.key === "w") this.setTool("wall");
    if (e.key === "t") this.setTool("door");
    if (e.key === "o") this.setTool("object");
  }
  cancel(): void {
    const g = this.gesture;
    this.gesture = undefined;
    this.pathDraft = undefined;
    this.paintGeneration++;
    this.paintWorker?.destroy();
    this.paintWorker = undefined;
    this.renderer?.cancelPreview(
      g?.entity && this.selection.has(g.entity.id)
        ? this.selection
        : g?.entity
          ? [g.entity.id]
          : [],
    );
    if (g && this.renderer.canvas.hasPointerCapture(g.pointer))
      this.renderer.canvas.releasePointerCapture(g.pointer);
    if (this.status) this.refresh();
  }
  async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const pending = this.host.pending?.() === true;
    const wasInert = this.root.inert;
    try {
      this.commitNote();
      this.saveButton.disabled = true;
      this.saveButton.textContent = "Speichert …";
      if (pending) this.root.inert = true;
      await this.paintTask;
      this.cancel();
      await this.host.save();
      this.refresh();
      this.host.notice("Karte und Raumtexte gespeichert.");
    } catch (error) {
      this.host.notice(error instanceof Error ? error.message : String(error));
    } finally {
      if (pending) this.root.inert = wasInert;
      this.saving = false;
      this.saveButton.disabled = false;
      this.saveButton.textContent = "Speichern";
    }
  }
  destroy(): void {
    this.closed = true;
    this.structuredPanel?.commit();
    this.structuredPanel?.destroy();
    this.setMaximized(false);
    this.cancel();
    this.abort.abort();
    this.unsub?.();
    this.assetUnsub?.();
    this.renderer.destroy();
    this.root.replaceChildren();
  }
}
