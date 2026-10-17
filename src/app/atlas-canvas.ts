import { AtlasPaint, AtlasCanvasScene } from "./atlas-canvas-scene";
/** Atlas presentation only. One Canvas2D surface, retained paths and bounded decoded images. */
import type { CanvasBox } from "./passive-map-canvas";
export type CameraReason = "pan" | "zoom" | "reset" | "set" | "history";
type SavedView = {
  box: CanvasBox;
  initial: CanvasBox;
  past: CanvasBox[];
  future: CanvasBox[];
};
const same = (a: CanvasBox, b: CanvasBox) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
export class AtlasCanvas {
  private box: CanvasBox;
  private initial: CanvasBox;
  private contextKey = "";
  private failed = false;
  private renderScene: ((scene: AtlasPaint) => void) | null = null;
  private emptyText = "";
  private drag: {
    id: number;
    inverse: DOMMatrix;
    start: DOMPoint;
    box: CanvasBox;
    moved: boolean;
  } | null = null;
  private suppressClick = false;
  private readonly panel: HTMLDivElement;
  private readonly note: HTMLSpanElement;
  private readonly controls: HTMLDivElement;
  private readonly back: HTMLButtonElement;
  private readonly forward: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private past: CanvasBox[] = [];
  private future: CanvasBox[] = [];
  private views = new Map<string, SavedView>();
  private wheelAt = 0;
  private sceneOrigin = { x: 0, y: 0 };
  private sceneVersion = 0;
  private tooltipPoint: { clientX: number; clientY: number } | null = null;
  private tooltipAnimation = 0;
  private publishedGeneration = 0;
  private cameraVersion = 0;
  private painted: { generation: number; cameraVersion: number; width: number; height: number } | null = null;
  private compiled: AtlasCanvasScene | null = null;
  private generation = 0;
  private animation = 0;
  private decoded = new Map<string, ImageBitmap>();
  private decoding = new Map<string, Promise<ImageBitmap>>();
  private pending: {
    compiled: AtlasCanvasScene;
    origin: { x: number; y: number };
    generation: number;
    text: string;
  } | null = null;
  private draining = false;
  private readonly bitmap = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private lost = false;
  private restored = false;
  constructor(
    readonly root: HTMLCanvasElement,
    private options: {
      relative?: boolean;
      initial: CanvasBox;
      minWidth?: number;
      maxWidth?: number | (() => number);
      pan?: (event: PointerEvent) => boolean;
      prepareCamera?: () => void;
      locked?: () => boolean;
      changed?: (box: CanvasBox, reason: CameraReason) => void;
    },
  ) {
    this.ctx = root.getContext("2d")!;
    this.box = { ...options.initial };
    this.initial = { ...options.initial };
    this.apply();
    root.dataset.renderer = "canvas2d";
    const doc = root.ownerDocument;
    this.controls = doc.createElement("div");
    this.controls.className = "map-canvas-controls";
    this.controls.dataset.canvasFor = root.id;
    this.controls.setAttribute("role", "group");
    this.controls.setAttribute("aria-label", "Kartenansicht");
    const action = (label: string, run: () => void) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.onclick = () => {
        this.options.prepareCamera?.();
        if (!this.options.locked?.() && !this.drag) run();
      };
      this.controls.append(button);
      return button;
    };
    this.back = action("← Vorige Ansicht", () => this.previous());
    this.forward = action("Nächste Ansicht →", () => this.next());
    this.resetButton = action("Ansicht zurücksetzen", () => this.reset());
    const hint = doc.createElement("span");
    hint.textContent = "Mittlere Maustaste: verschieben · Mausrad: zoomen";
    this.controls.append(hint);
    root.before(this.controls);
    this.refreshControls();
    this.panel = doc.createElement("div");
    this.panel.className = "map-canvas-state";
    this.panel.hidden = true;
    this.panel.dataset.canvasFor = root.id;
    this.note = doc.createElement("span");
    const retry = doc.createElement("button");
    retry.type = "button";
    retry.textContent = "Karte erneut zeichnen";
    retry.onclick = () => {
      if (!this.renderScene) return;
      this.ctx = root.getContext("2d")!;
      if (!this.ctx) {
        this.fail(Error("Canvas2D ist nicht verfügbar."));
        return;
      }
      this.lost = false;
      this.failed = false;
      this.clearImages();
      this.render(this.renderScene, this.emptyText);
    };
    this.panel.append(this.note, retry);
    root.after(this.panel);
    root.style.touchAction = "none";
    root.addEventListener("contextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      this.fail(Error("Zeichenfläche verloren."));
    });
    root.addEventListener("contextrestored", () => {
      this.lost = false;
      this.failed = false;
      if (this.renderScene) this.render(this.renderScene, this.emptyText);
    });
    root.addEventListener(
      "pointerdown",
      (e) => {
        if (this.failed) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        this.suppressClick = false;
        this.tooltipPoint = null;
        root.title = "";
        if (
          this.drag ||
          this.options.locked?.() ||
          (!this.ready && e.button === 0 && !e.altKey) ||
          !(this.options.pan?.(e) ?? e.button === 1)
        )
          return;
        const matrix = this.screenMatrix();
        if (!matrix) return;
        const inverse = matrix.inverse();
        this.drag = {
          id: e.pointerId,
          inverse,
          start: new DOMPoint(e.clientX, e.clientY).matrixTransform(inverse),
          box: { ...this.box },
          moved: false,
        };
        if (e.button === 1) {
          root.setPointerCapture(e.pointerId);
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    root.addEventListener(
      "pointermove",
      (e) => {
        const drag = this.drag;
        if (!drag || drag.id !== e.pointerId) return;
        if (
          !drag.moved &&
          Math.hypot(
            e.clientX - this.screenStart(drag).x,
            e.clientY - this.screenStart(drag).y,
          ) < 3
        )
          return;
        drag.moved = true;
        this.suppressClick = true;
        root.setPointerCapture(e.pointerId);
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
          drag.inverse,
        );
        this.set(
          {
            ...drag.box,
            x: drag.box.x - (p.x - drag.start.x),
            y: drag.box.y - (p.y - drag.start.y),
          },
          true,
          "pan",
        );
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
    const finish = (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return;
      const moved = this.drag.moved;
      this.cancel();
      if (moved || e.button === 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    root.addEventListener("pointerup", finish, true);
    root.addEventListener("pointercancel", finish, true);
    root.addEventListener("lostpointercapture", () => this.cancel());
    root.addEventListener("pointerleave", (e) => {
      if (this.drag?.id === e.pointerId && !root.hasPointerCapture(e.pointerId))
        this.cancel();
    });
    root.addEventListener(
      "click",
      (e) => {
        if (this.suppressClick || this.failed) {
          this.suppressClick = false;
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    root.addEventListener(
      "wheel",
      (e) => {
        if (!e.deltaY) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.failed || this.options.locked?.() || this.drag) return;
        const matrix = this.screenMatrix();
        const p = matrix
          ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
          : undefined;
        const burst = Date.now() - this.wheelAt < 300;
        this.zoom(
          e.deltaY > 0 ? 1.2 : 1 / 1.2,
          p && this.options.relative
            ? { x: p.x + this.box.x, y: p.y + this.box.y }
            : p,
          burst,
        );
        this.wheelAt = Date.now();
      },
      { capture: true, passive: false },
    );
    root.addEventListener("pointermove", (e) => {
      this.tooltipPoint = { clientX: e.clientX, clientY: e.clientY };
      if (!this.tooltipAnimation)
        this.tooltipAnimation = requestAnimationFrame(() => {
          this.tooltipAnimation = 0;
          let title = "";
          if (
            this.tooltipPoint &&
            this.ready &&
            !this.drag &&
            !this.options.locked?.()
          ) {
            const p = this.point(this.tooltipPoint);
            title = this.compiled!.tooltip(this.ctx, {
              x: p.x - this.sceneOrigin.x,
              y: p.y - this.sceneOrigin.y,
            });
          }
          if (root.title !== title) root.title = title;
        });
    });
    root.addEventListener("pointerleave", () => {
      this.tooltipPoint = null;
      root.title = "";
    });
    if (!this.ctx) this.fail(Error("Canvas2D ist nicht verfügbar."));
  }
  private screenStart(drag: NonNullable<AtlasCanvas["drag"]>) {
    return drag.start.matrixTransform(drag.inverse.inverse());
  }
  get ready() {
    return (
      !!this.compiled &&
      !this.failed &&
      !this.lost &&
      this.publishedGeneration === this.generation &&
      this.painted?.generation === this.publishedGeneration &&
      this.painted.cameraVersion === this.cameraVersion &&
      this.painted.width === this.root.clientWidth &&
      this.painted.height === this.root.clientHeight &&
      this.painted.width > 0 && this.painted.height > 0
    );
  }
  get view() {
    return { ...this.box };
  }
  get panning() {
    return !!this.drag;
  }
  get contextRestored() {
    return this.restored;
  }
  private screenMatrix() {
    const rect = this.root.getBoundingClientRect(),
      width = this.root.clientWidth,
      height = this.root.clientHeight,
      scale = Math.min(width / this.box.width, height / this.box.height);
    return new DOMMatrix()
      .translate(
        rect.left + this.root.clientLeft + (width - this.box.width * scale) / 2,
        rect.top + this.root.clientTop + (height - this.box.height * scale) / 2,
      )
      .scale(scale);
  }

  point(e: { clientX: number; clientY: number }) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      this.screenMatrix().inverse(),
    );
    return { x: p.x + this.box.x, y: p.y + this.box.y };
  }
  private apply() {
    this.cameraVersion++;
    this.tooltipPoint = null;
    this.root.title = "";
    if (this.compiled && !this.failed && !this.lost)
      this.root.dataset.canvasState = "loading";
    this.root.dataset.atlasView = JSON.stringify(this.box);
    if (!this.animation)
      this.animation = requestAnimationFrame(() => {
        this.animation = 0;
        try {
          this.paint();
        } catch (e) {
          this.fail(e);
        }
      });
  }
  private unavailableImages=new Set<string>();
  private async image(source: string) {
    let image = this.decoded.get(source);
    if (image) return image;
    let task = this.decoding.get(source);
    if (!task) {
      task = (async () => {
        const img = new Image();
        img.src = source;
        await img.decode();
        const scale = Math.min(
          1,
          512 / Math.max(img.naturalWidth, img.naturalHeight),
        );
        return createImageBitmap(img, {
          resizeWidth: Math.max(1, Math.round(img.naturalWidth * scale)),
          resizeHeight: Math.max(1, Math.round(img.naturalHeight * scale)),
        });
      })();
      this.decoding.set(source, task);
    }
    try {
      image = await task;
      this.decoded.set(source, image);
      return image;
    } finally {
      this.decoding.delete(source);
    }
  }
  private clearImages() {
    this.unavailableImages.clear();
    this.root.dataset.imageErrors = "0";
    this.root.dataset.decodedBytes = "0";
    for (const image of this.decoded.values()) image.close();
    this.decoded.clear();
  }
  private paint() {
    if (!this.compiled || this.failed || this.lost) return;
    const rect = {
      width: this.root.clientWidth,
      height: this.root.clientHeight,
    };
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(
        window.devicePixelRatio || 1,
        2,
        4096 / rect.width,
        4096 / rect.height,
        Math.sqrt(4194304 / (rect.width * rect.height)),
      ),
      w = Math.max(1, Math.round(rect.width * ratio)),
      h = Math.max(1, Math.round(rect.height * ratio));
    if (this.bitmap.width !== w) this.bitmap.width = w;
    if (this.bitmap.height !== h) this.bitmap.height = h;
    const ctx = this.bitmap.getContext("2d")!;
    ctx.resetTransform();
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / this.box.width, h / this.box.height),
      matrix = new DOMMatrix()
        .translate(
          (w - this.box.width * scale) / 2,
          (h - this.box.height * scale) / 2,
        )
        .scale(scale)
        .translate(
          this.sceneOrigin.x - this.box.x,
          this.sceneOrigin.y - this.box.y,
        );
    this.compiled.draw(ctx, matrix, this.decoded, {
      x: this.box.x - this.sceneOrigin.x,
      y: this.box.y - this.sceneOrigin.y,
    });
    if (this.root.width !== w) this.root.width = w;
    if (this.root.height !== h) this.root.height = h;
    this.ctx.resetTransform();
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(this.bitmap, 0, 0);
    // Only the completed visible copy may authorize hits for this scene/camera/size.
    this.painted = { generation: this.publishedGeneration, cameraVersion: this.cameraVersion, ...rect };
    this.root.dataset.paintCommands = String(this.compiled.commands.length);
    this.root.dataset.decodedBytes = String(
      [...this.decoded.values()].reduce(
        (n, i) => n + i.width * i.height * 4,
        0,
      ),
    );
    this.root.dataset.canvasState = this.ready
      ? this.emptyText
        ? "empty"
        : "loaded"
      : "loading";
  }
  private refreshControls() {
    this.back.disabled = !this.past.length;
    this.forward.disabled = !this.future.length;
    this.resetButton.disabled = same(this.box, this.initial);
  }
  private remember(box: CanvasBox) {
    if (same(box, this.box)) return;
    if (!this.past.length || !same(this.past.at(-1)!, box))
      this.past.push({ ...box });
    if (this.past.length > 32) this.past.shift();
    this.future = [];
    this.refreshControls();
  }
  set(
    box: CanvasBox,
    notify = false,
    reason: CameraReason = "set",
    coalesce = false,
  ) {
    if (
      !Object.values(box).every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0
    )
      throw new Error("Kartenausschnitt benötigt endliche positive Maße.");
    if (typeof this.options.maxWidth === "function") {
      const max = this.options.maxWidth();
      if (box.width > max) {
        const ratio = max / box.width;
        box = {
          x: box.x + (box.width * (1 - ratio)) / 2,
          y: box.y + (box.height * (1 - ratio)) / 2,
          width: max,
          height: box.height * ratio,
        };
      }
    }
    this.wheelAt = 0;
    const before = this.box;
    this.box = { ...box };
    if (!this.drag && !coalesce) this.remember(before);
    this.apply();
    this.refreshControls();
    if (notify) this.options.changed?.(this.view, reason);
  }
  /** Opaque presentation contexts never contain adopter-owned map data. At most 32 are cached. */
  context(key: string, initial: CanvasBox, restore = true) {
    if (key === this.contextKey) return false;
    this.cancel();
    this.root.title = "";
    this.generation++;
    this.pending = null;
    this.compiled?.dispose();
    this.compiled = null;
    this.painted = null;
    this.clearImages();
    this.ctx?.resetTransform();
    this.ctx?.clearRect(0, 0, this.root.width, this.root.height);
    this.root.dataset.canvasState = "empty";
    this.panel.hidden = true;
    this.note.textContent = "";
    if (this.contextKey) {
      this.views.delete(this.contextKey);
      this.views.set(this.contextKey, {
        box: this.view,
        initial: { ...this.initial },
        past: this.past.map((b) => ({ ...b })),
        future: this.future.map((b) => ({ ...b })),
      });
    }
    while (this.views.size > 32)
      this.views.delete(this.views.keys().next().value!);
    const saved = restore ? this.views.get(key) : undefined;
    this.contextKey = key;
    this.restored = !!saved;
    this.initial = { ...(saved?.initial ?? initial) };
    this.box = { ...(saved?.box ?? initial) };
    this.past = saved?.past.map((b) => ({ ...b })) ?? [];
    this.future = saved?.future.map((b) => ({ ...b })) ?? [];
    this.wheelAt = 0;
    this.failed = false;
    this.apply();
    this.refreshControls();
    return true;
  }
  defaultView(box: CanvasBox) {
    this.initial = { ...box };
    this.past = [];
    this.future = [];
    this.refreshControls();
  }
  zoom(
    factor: number,
    anchor = {
      x: this.box.x + this.box.width / 2,
      y: this.box.y + this.box.height / 2,
    },
    coalesce = false,
  ) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const width = Math.min(
        (typeof this.options.maxWidth === "function"
          ? this.options.maxWidth()
          : this.options.maxWidth) ?? 1e12,
        Math.max(this.options.minWidth ?? 0.001, this.box.width * factor),
      ),
      ratio = width / this.box.width;
    this.set(
      {
        x: anchor.x - (anchor.x - this.box.x) * ratio,
        y: anchor.y - (anchor.y - this.box.y) * ratio,
        width,
        height: this.box.height * ratio,
      },
      true,
      "zoom",
      coalesce,
    );
  }
  reset() {
    this.cancel();
    this.set(this.initial, true, "reset");
  }
  pan(dx: number, dy: number) {
    this.set(
      { ...this.box, x: this.box.x + dx, y: this.box.y + dy },
      true,
      "pan",
    );
  }
  previous() {
    this.history(this.past, this.future);
  }
  next() {
    this.history(this.future, this.past);
  }
  private history(from: CanvasBox[], to: CanvasBox[]) {
    if (this.drag || this.options.locked?.()) return;
    const box = from.pop();
    if (!box) return;
    to.push(this.view);
    this.box = { ...box };
    this.wheelAt = 0;
    this.apply();
    this.refreshControls();
    this.options.changed?.(this.view, "history");
  }
  cancel() {
    const drag = this.drag;
    this.drag = null;
    if (drag?.moved) this.remember(drag.box);
    if (drag && this.root.hasPointerCapture(drag.id))
      this.root.releasePointerCapture(drag.id);
  }
  /** Compile off the visible surface. Only the newest complete scene and its hits are published. */
  render(draw: (scene: AtlasPaint) => void, emptyText = "") {
    this.renderScene = draw;
    this.emptyText = emptyText;
    if (this.failed || this.lost) return;
    this.root.title = "";
    const generation = ++this.generation;
    this.root.dataset.canvasState = "loading";
    try {
      const scene = new AtlasPaint("g");
      scene.dataset.mapScene = "true";
      draw(scene);
      const compiled = new AtlasCanvasScene(scene);
      if (compiled.images.size > 32)
        throw Error("Zu viele Kartenbilder in einem Ausschnitt.");
      this.pending = {
        compiled,
        origin: { x: this.box.x, y: this.box.y },
        generation,
        text: emptyText,
      };
      void this.drain();
    } catch (error) {
      this.fail(error);
    }
  }
  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending && !this.failed && !this.lost) {
        const frame = this.pending;
        this.pending = null;
        try {
          let imageErrors=0;
          for (const source of frame.compiled.images) {
            const optional=!frame.compiled.requiredImages.has(source);
            try{if(optional&&this.unavailableImages.has(source))imageErrors++;else await this.image(source);}
            catch(error){if(!optional)throw error;this.unavailableImages.add(source);imageErrors++;}
            if (frame.generation !== this.generation) break;
          }
          if (frame.generation !== this.generation) {
            this.pruneImages();
            continue;
          }
          this.compiled?.dispose();
          this.compiled = frame.compiled;
          this.publishedGeneration = frame.generation;
          this.sceneOrigin = frame.origin;
          this.root.dataset.sceneVersion = String(++this.sceneVersion);
          this.pruneImages();
          this.paint();
          this.root.dataset.imageErrors=String(imageErrors);
          this.root.style.visibility = "";
          this.root.removeAttribute("aria-disabled");
          this.panel.hidden = !frame.text&&!imageErrors;
          this.panel.setAttribute("role", "status");
          this.note.textContent = imageErrors?`${imageErrors} Bildvorlage(n) nicht verfügbar. Umrisse bleiben sichtbar; übrige Karte ist bedienbar.`:frame.text;
          this.panel.querySelector("button")!.hidden = !imageErrors;
        } catch (error) {
          if (frame.generation === this.generation) this.fail(error);
          else this.pruneImages();
        }
      }
    } finally {
      this.draining = false;
    }
  }
  private pruneImages() {
    const keep = this.compiled?.images ?? new Set();
    for(const source of this.unavailableImages)if(!keep.has(source)&&!this.pending?.compiled.images.has(source))this.unavailableImages.delete(source);
    for (const [key, image] of this.decoded)
      if (!keep.has(key) && !this.pending?.compiled.images.has(key)) {
        image.close();
        this.decoded.delete(key);
      }
  }
  private fail(error: unknown) {
    this.root.title = "";
    this.generation++;
    this.pending = null;
    this.compiled?.dispose();
    this.compiled = null;
    this.painted = null;
    this.failed = true;
    this.cancel();
    this.clearImages();
    this.ctx?.resetTransform();
    this.ctx?.clearRect(0, 0, this.root.width, this.root.height);
    this.root.setAttribute("aria-disabled", "true");
    this.root.dataset.canvasState = "unavailable";
    this.panel.hidden = false;
    this.panel.setAttribute("role", "alert");
    this.note.textContent =
      "Karte konnte nicht gezeichnet werden. Daten und Navigation bleiben erhalten. " +
      (error as Error).message;
    this.panel.querySelector("button")!.hidden = false;
  }
  hitAt(
    e: { clientX: number; clientY: number },
    selector = "[data-atlas-object]",
  ) {
    if (!this.ready || !this.compiled) return null;
    const p = this.point(e);
    return this.compiled.hit(
      this.ctx,
      { x: p.x - this.sceneOrigin.x, y: p.y - this.sceneOrigin.y },
      selector,
    );
  }
}
