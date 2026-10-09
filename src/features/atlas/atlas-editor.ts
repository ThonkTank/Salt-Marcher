import { AtlasRenderer } from "./atlas-renderer";
import { hexAddressKey, hexAt } from "./hex";
import type { OverworldDocument, WorldPoint } from "./overworld";
import {
  TERRAIN_COLORS,
  TerrainSource,
  TerrainStroke,
  type TerrainTool,
} from "./terrain-source";

type Tool = "select" | "hand" | TerrainTool;
export interface AtlasEditorStorage {
  save(): Promise<void>;
  changed(): Promise<void>;
  status(): { dirty: boolean; hasDraft: boolean };
  menu?(event: MouseEvent): void;
  discard?(): Promise<TerrainSource>;
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
  private work: Promise<void> = Promise.resolve();
  private persistence: Promise<void> = Promise.resolve();
  private persistenceVersion = 0;
  private flushing = false;
  private closed = false;
  private loadingVisible = false;
  private visibleLoadFailed = false;
  private pointer?: {
    id: number;
    action: "pan" | "select" | "paint";
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
      b.addEventListener("click", action, { signal: this.abort.signal });
      toolbar.append(b);
      return b;
    };
    const toolButtons = new Map<Tool, HTMLButtonElement>();
    const choose = (tool: Tool) => {
      this.finishStroke();
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
      this.enqueue(() => this.renderer.fit());
    });
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
    root.append(toolbar, this.viewport, footer);
    this.renderer = new AtlasRenderer(
      this.viewport,
      world,
      () => {
        this.scale.textContent = `${Number(this.viewport.dataset.hexMiles).toLocaleString("de-DE")} Meilen pro Hex`;
        void this.loadVisible();
      },
      terrain,
    );
    this.subscribeTerrain();
    choose("select");
    this.refreshHistory();
    this.bind();
  }
  get terrain(): TerrainSource {
    return this.currentTerrain;
  }
  private subscribeTerrain(): void {
    this.unsubscribe = this.terrain.history.subscribe(() => {
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
  async init(): Promise<void> {
    await this.renderer.init();
  }
  private refreshHistory(): void {
    this.undoButton.disabled = !this.terrain.history.canUndo;
    this.redoButton.disabled = !this.terrain.history.canRedo;
    const state = this.storage.status();
    this.status.textContent = state.dirty
      ? state.hasDraft
        ? "Entwurf gesichert"
        : "Ungespeichert"
      : "Gespeichert";
    this.root.dataset.dirty = String(state.dirty);
    this.root.dataset.hasDraft = String(state.hasDraft);
    this.root.dataset.undoDepth = String(this.terrain.history.undoDepth);
  }
  private enqueue(action: () => void | Promise<void>): void {
    if (this.flushing || this.closed) return;
    this.work = this.work
      .then(async () => {
        if (!this.closed) await action();
      })
      .catch((error) => {
        if (!this.closed) {
          this.status.textContent = "Bearbeitung angehalten. " + String(error);
          this.renderer.preview = [];
          this.renderer.schedule();
        }
      });
  }
  private save(): void {
    this.finishStroke();
    this.enqueue(async () => {
      const version = this.persistenceVersion;
      this.status.textContent = "Atlas wird gespeichert …";
      await this.storage.save();
      if (version === this.persistenceVersion)
        this.persistence = Promise.resolve();
      this.refreshHistory();
    });
  }
  discard(): void {
    if (!this.storage.discard) return;
    this.finishStroke();
    this.releasePointer();
    this.enqueue(async () => {
      this.flushing = true;
      try {
        const source = await this.storage.discard!();
        this.unsubscribe();
        this.currentTerrain = source;
        this.renderer.useTerrain(source);
        this.subscribeTerrain();
        this.persistence = Promise.resolve();
        ++this.persistenceVersion;
        this.visibleLoadFailed = false;
        this.refreshHistory();
      } finally {
        this.flushing = false;
      }
    });
  }
  /** Finish queued pointer work and retain its draft before a view is destroyed. */
  async flush(): Promise<void> {
    this.finishStroke();
    this.releasePointer();
    this.flushing = true;
    try {
      await this.work;
      await this.persistence;
    } finally {
      this.flushing = false;
    }
  }
  private async loadVisible(): Promise<void> {
    if (this.loadingVisible || this.closed || this.visibleLoadFailed) return;
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
      if (this.closed) return;
      stroke.add(address);
      this.renderer.preview = stroke.preview();
      this.renderer.schedule();
    });
  }
  /** Escape retains the painted land gesture as one undoable command, as in the original. */
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
    this.finishStroke();
    this.enqueue(() => {
      this.terrain.history[action]();
    });
  }
  private zoom(factor: number): void {
    if (this.stroke) return;
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
        if ((e.button !== 0 && e.button !== 1) || this.pointer || this.flushing)
          return;
        e.preventDefault();
        this.viewport.focus();
        this.viewport.setPointerCapture(e.pointerId);
        const action =
          e.button === 1 || this.space || this.tool === "hand"
            ? "pan"
            : this.tool === "select"
              ? "select"
              : "paint";
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
        if (!p.moved && p.action === "select") {
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
      this.finishStroke();
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
        if (this.root.ownerDocument.activeElement !== this.viewport) return;
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
          e.preventDefault();
        }
        if (e.key === "Escape") {
          this.finishStroke();
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
        if (!e.ctrlKey || this.stroke) return;
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
    this.closed = true;
    this.abort.abort();
    this.unsubscribe();
    this.renderer.destroy();
    this.root.classList.remove("dn-atlas");
    delete this.root.dataset.worldId;
  }
}
