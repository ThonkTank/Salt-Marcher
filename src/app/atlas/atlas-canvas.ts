import { wheelZoomFactor, zoomBox } from './atlas-navigation-scale';
import { AtlasPaint, AtlasCanvasScene } from './atlas-canvas-scene';
/** Shared Atlas camera/input, retained paint commands and bounded decoded images. */
import type { CanvasBox } from '../passive-map-canvas';
export type CameraReason = 'pan' | 'zoom' | 'reset' | 'set' | 'history';
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
  private contextKey = '';
  private failed = false;
  private renderScene: ((scene: AtlasPaint) => void) | null = null;
  private emptyText = '';
  private drag: {
    id: number;
    inverse: DOMMatrix;
    start: DOMPoint;
    box: CanvasBox;
    moved: boolean;
    anchor?: { x: number; y: number };
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
  private zoomPrevious = 0;
  private zoomTarget: CanvasBox | null = null;
  private zoomGeneration = 0;
  private zoomAnchor = { x: 0, y: 0 };
  private zoomUpdatedAt = 0;
  private sceneOrigin = { x: 0, y: 0 };
  private sceneVersion = 0;
  private tooltipPoint: { clientX: number; clientY: number } | null = null;
  private tooltipAnimation = 0;
  private publishedGeneration = 0;
  private cameraVersion = 0;
  private painted: {
    generation: number;
    cameraVersion: number;
    width: number;
    height: number;
  } | null = null;
  private compiled: AtlasCanvasScene | null = null;
  private paths: import('./atlas-canvas-scene').AtlasPathCache = new WeakMap();
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
  private ctx: CanvasRenderingContext2D | null = null;
  private lost = false;
  private restored = false;
  constructor(
    readonly root: HTMLCanvasElement,
    private options: {
      relative?: boolean;
      presentation?: () => import('./atlas-presentation').AtlasPresentation | null;
      initial: CanvasBox;
      minWidth?: number;
      maxWidth?: number | (() => number);
      /** Explicit navigation does not depend on current author hits. */
      pan?: (event: PointerEvent) => boolean | 'explicit';
      prepareCamera?: () => void;
      /** Hosts with source/filter state rebuild the current confirmed frame on recovery. */
      redraw?: () => void;
      /** Current camera overlays are independent of asynchronously loaded geometry. */
      overlay?: (scene: AtlasPaint, box: CanvasBox, mpp: number) => boolean | void;
      smoothZoom?: boolean;
      locked?: () => boolean;
      changed?: (box: CanvasBox, reason: CameraReason) => void;
    },
  ) {
    this.box = { ...options.initial };
    this.initial = { ...options.initial };
    this.apply();
    root.dataset.renderer = 'canvas2d';
    const doc = root.ownerDocument;
    this.controls = doc.createElement('div');
    this.controls.className = 'map-canvas-controls';
    this.controls.dataset.canvasFor = root.id;
    this.controls.setAttribute('role', 'group');
    this.controls.setAttribute('aria-label', 'Kartenansicht');
    const action = (label: string, run: () => void) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => {
        this.options.prepareCamera?.();
        if (!this.options.locked?.() && !this.drag) run();
      };
      this.controls.append(button);
      return button;
    };
    action('+ Vergrößern', () => this.zoom(1 / 1.4));
    action('− Verkleinern', () => this.zoom(1.4));
    this.back = action('← Vorige Ansicht', () => this.previous());
    this.forward = action('Nächste Ansicht →', () => this.next());
    this.resetButton = action('Ansicht zurücksetzen', () => this.reset());
    const hint = doc.createElement('span');
    hint.textContent = 'Mittlere Maustaste: verschieben · Mausrad: zoomen';
    this.controls.append(hint);
    root.before(this.controls);
    this.refreshControls();
    this.panel = doc.createElement('div');
    this.panel.className = 'map-canvas-state';
    this.panel.hidden = true;
    this.panel.dataset.canvasFor = root.id;
    this.note = doc.createElement('span');
    const retry = doc.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Karte erneut zeichnen';
    retry.onclick = () => this.recover();
    this.panel.append(this.note, retry);
    root.after(this.panel);
    root.style.touchAction = 'none';
    root.addEventListener('contextlost', () => {
      // Unlike WebGL, canceling Canvas2D contextlost aborts browser restoration.
      this.lost = true;
      this.fail(Error('Zeichenfläche verloren.'));
    });
    root.addEventListener('contextrestored', () => this.recover());
    root.addEventListener(
      'pointerdown',
      (e) => {
        if (this.failed) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        this.stopZoom();
        this.suppressClick = false;
        this.tooltipPoint = null;
        root.title = '';
        if (
          this.drag ||
          this.options.locked?.() ||
          (!this.ready && e.button === 0 && !e.altKey && this.options.pan?.(e) !== 'explicit') ||
          !this.navigationRequested(e)
        )
          return;
        const matrix = this.screenMatrix();
        if (!matrix) return;
        const inverse = matrix.inverse(),
          presentation = this.options.presentation?.(),
          anchor = presentation?.navigationPoint(e);
        if (presentation && !anchor) return;
        this.drag = {
          anchor: anchor ?? undefined,
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
      'pointermove',
      (e) => {
        const drag = this.drag;
        if (!drag || drag.id !== e.pointerId) return;
        if (
          !drag.moved &&
          Math.hypot(e.clientX - this.screenStart(drag).x, e.clientY - this.screenStart(drag).y) < 3
        )
          return;
        drag.moved = true;
        this.suppressClick = true;
        root.setPointerCapture(e.pointerId);
        if (drag.anchor) {
          const at = this.options.presentation?.()?.navigationPoint(e);
          if (at)
            this.set(
              {
                ...this.box,
                x: this.box.x + drag.anchor.x - at.x,
                y: this.box.y + drag.anchor.y - at.y,
              },
              true,
              'pan',
            );
        } else {
          const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(drag.inverse);
          this.set(
            {
              ...drag.box,
              x: drag.box.x - (p.x - drag.start.x),
              y: drag.box.y - (p.y - drag.start.y),
            },
            true,
            'pan',
          );
        }
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
    root.addEventListener('pointerup', finish, true);
    root.addEventListener('pointercancel', finish, true);
    root.addEventListener('lostpointercapture', () => this.cancel());
    root.addEventListener('pointerleave', (e) => {
      if (this.drag?.id === e.pointerId && !root.hasPointerCapture(e.pointerId)) this.cancel();
    });
    root.addEventListener(
      'click',
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
      'wheel',
      (e) => {
        if (!e.deltaY) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.failed || this.options.locked?.() || this.drag) return;
        const presentation = this.options.presentation?.(),
          anchor = presentation?.navigationPoint(e);
        const matrix = this.screenMatrix();
        const p = matrix
          ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
          : undefined;
        const burst = Date.now() - this.wheelAt < 300;
        this.zoom(
          wheelZoomFactor(e.deltaY, e.deltaMode, root.clientHeight),
          presentation
            ? (anchor ?? undefined)
            : p && this.options.relative
              ? { x: p.x + this.box.x, y: p.y + this.box.y }
              : p,
          burst,
        );
        this.wheelAt = Date.now();
      },
      { capture: true, passive: false },
    );
    root.addEventListener('pointermove', (e) => {
      this.tooltipPoint = { clientX: e.clientX, clientY: e.clientY };
      if (!this.tooltipAnimation)
        this.tooltipAnimation = requestAnimationFrame(() => {
          this.tooltipAnimation = 0;
          let title = '';
          if (this.tooltipPoint && this.ready && !this.drag && !this.options.locked?.()) {
            const p = this.point(this.tooltipPoint);
            title = this.compiled!.tooltip(this.ctx!, {
              x: p.x - this.sceneOrigin.x,
              y: p.y - this.sceneOrigin.y,
            });
          }
          if (root.title !== title) root.title = title;
        });
    });
    root.addEventListener('pointerleave', () => {
      this.tooltipPoint = null;
      root.title = '';
    });
    this.acquireContext();
  }
  private acquireContext() {
    try {
      const ctx = this.root.getContext('2d');
      if (!ctx) throw Error('Canvas2D ist nicht verfügbar.');
      if (ctx.isContextLost?.())
        throw Error('Zeichenfläche noch nicht verfügbar. Kurz warten und erneut versuchen.');
      this.ctx = ctx;
      this.lost = false;
      this.failed = false;
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }
  private recover() {
    if (!this.acquireContext()) return;
    this.clearImages();
    if (this.options.redraw) this.options.redraw();
    else if (this.renderScene) this.render(this.renderScene, this.emptyText);
  }
  private screenStart(drag: NonNullable<AtlasCanvas['drag']>) {
    return drag.start.matrixTransform(drag.inverse.inverse());
  }
  get ready() {
    return (
      (this.options.presentation?.()?.ready ?? true) &&
      !!this.compiled &&
      !!this.ctx &&
      !this.ctx.isContextLost?.() &&
      !this.failed &&
      !this.lost &&
      this.publishedGeneration === this.generation &&
      this.painted?.generation === this.publishedGeneration &&
      this.painted.cameraVersion === this.cameraVersion &&
      this.painted.width === this.root.clientWidth &&
      this.painted.height === this.root.clientHeight &&
      this.painted.width > 0 &&
      this.painted.height > 0
    );
  }
  get view() {
    return { ...this.box };
  }
  /** The intended viewport lets region loading run ahead of a zoom gesture. */
  get destination() {
    return { ...(this.zoomTarget ?? this.box) };
  }
  navigationRequested(e: PointerEvent) {
    return !!(this.options.pan?.(e) ?? e.button === 1);
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
    const presentation = this.options.presentation?.();
    if (presentation) return presentation.point(e);
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(this.screenMatrix().inverse());
    return { x: p.x + this.box.x, y: p.y + this.box.y };
  }
  private apply() {
    this.cameraVersion++;
    this.tooltipPoint = null;
    this.root.title = '';
    if (this.compiled && !this.failed && !this.lost) this.root.dataset.canvasState = 'loading';
    this.root.dataset.atlasView = JSON.stringify(this.box);
    this.requestFrame();
  }
  /** Camera animation and the complete map/overlay share one frame owner. Keep
   * the request occupied while advancing: set/apply must not enqueue a second
   * paint. During paint, overlays may request a subsequent animation frame. */
  private requestFrame() {
    if (this.animation) return;
    this.animation = requestAnimationFrame((now) => {
      try {
        this.advanceZoom(now);
        this.animation = 0;
        this.paint();
        if (this.zoomTarget) this.requestFrame();
      } catch (error) {
        this.animation = 0;
        this.fail(error);
      }
    });
  }
  private unavailableImages = new Set<string>();
  private async image(source: string, maxEdge = 512) {
    let image = this.decoded.get(source);
    if (image) return image;
    let task = this.decoding.get(source);
    if (!task) {
      task = (async () => {
        const img = new Image();
        img.src = source;
        await img.decode();
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
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
    this.root.dataset.imageErrors = '0';
    this.root.dataset.decodedBytes = '0';
    for (const image of this.decoded.values()) image.close();
    this.decoded.clear();
  }
  private paint() {
    if (!this.compiled || this.failed || this.lost) return;
    const ctx = this.ctx;
    if (!ctx || ctx.isContextLost?.()) throw Error('Zeichenfläche ist verloren.');
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
    if (this.root.width !== w) this.root.width = w;
    if (this.root.height !== h) this.root.height = h;
    ctx.resetTransform();
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / this.box.width, h / this.box.height),
      matrix = new DOMMatrix()
        .translate((w - this.box.width * scale) / 2, (h - this.box.height * scale) / 2)
        .scale(scale)
        .translate(this.sceneOrigin.x - this.box.x, this.sceneOrigin.y - this.box.y);
    const presentation = this.options.presentation?.();
    const compiled = this.compiled,
      paint = () => {
        presentation?.paint(compiled, this.sceneOrigin, this.decoded);
        compiled.draw(
          ctx,
          matrix,
          this.decoded,
          {
            x: this.box.x - this.sceneOrigin.x,
            y: this.box.y - this.sceneOrigin.y,
          },
          presentation ? (c) => c.hud : undefined,
        );
        if (this.options.overlay) {
          const overlay = new AtlasPaint('group');
          const mpp = Math.max(this.box.width / rect.width, this.box.height / rect.height);
          const again = this.options.overlay(overlay, this.view, mpp);
          const scene = new AtlasCanvasScene(overlay);
          try {
            presentation?.overlay(scene, { x: this.box.x, y: this.box.y });
            scene.draw(
              ctx,
              new DOMMatrix()
                .translate((w - this.box.width * scale) / 2, (h - this.box.height * scale) / 2)
                .scale(scale),
              new Map(),
              { x: 0, y: 0 },
              presentation ? (c) => c.hud : undefined,
            );
          } finally {
            scene.dispose();
          }
          if (again) this.redrawOverlay();
        }
      };
    if (presentation?.batch) presentation.batch(paint);
    else paint();
    if (ctx.isContextLost?.()) throw Error('Zeichenfläche beim Zeichnen verloren.');
    // Drawing is synchronous inside this animation frame. Authorize hits only after it completes.
    this.painted = {
      generation: this.publishedGeneration,
      cameraVersion: this.cameraVersion,
      ...rect,
    };
    this.root.dataset.paintCommands = String(this.compiled.commands.length);
    this.root.dataset.decodedBytes = String(
      [...this.decoded.values()].reduce((n, i) => n + i.width * i.height * 4, 0),
    );
    this.root.dataset.canvasState = this.ready ? (this.emptyText ? 'empty' : 'loaded') : 'loading';
  }
  private refreshControls() {
    this.back.disabled = !this.past.length;
    this.forward.disabled = !this.future.length;
    this.resetButton.disabled = same(this.box, this.initial);
  }
  private remember(box: CanvasBox) {
    if (same(box, this.box)) return;
    if (!this.past.length || !same(this.past.at(-1)!, box)) this.past.push({ ...box });
    if (this.past.length > 32) this.past.shift();
    this.future = [];
    this.refreshControls();
  }
  set(box: CanvasBox, notify = false, reason: CameraReason = 'set', coalesce = false) {
    if (!Object.values(box).every(Number.isFinite) || box.width <= 0 || box.height <= 0)
      throw new Error('Kartenausschnitt benötigt endliche positive Maße.');
    if (typeof this.options.maxWidth === 'function') {
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
    if (reason !== 'zoom') this.stopZoom();
    const before = this.box;
    this.box = { ...box };
    if (!this.drag && !coalesce) this.remember(before);
    this.apply();
    this.refreshControls();
    if (notify) this.options.changed?.(this.view, reason);
  }
  /** Resizing presentation keeps its world centre and CSS-pixel scale, without history. */
  resizeViewport(
    previous: { width: number; height: number },
    next: { width: number; height: number },
  ) {
    if (Math.min(previous.width, previous.height, next.width, next.height) <= 0) return;
    const box = this.view,
      mpp = box.width / previous.width;
    this.set(
      {
        x: box.x + box.width / 2 - (next.width * mpp) / 2,
        y: box.y + box.height / 2 - (next.height * mpp) / 2,
        width: next.width * mpp,
        height: next.height * mpp,
      },
      true,
      'set',
      true,
    );
  }
  /** Opaque presentation contexts never contain adopter-owned map data. At most 32 are cached. */
  context(key: string, initial: CanvasBox, restore = true) {
    if (key === this.contextKey) return false;
    this.cancel();
    this.renderScene = null;
    this.emptyText = '';
    this.restored = false;
    this.root.title = '';
    this.generation++;
    this.pending = null;
    this.compiled?.dispose();
    this.compiled = null;
    this.paths = new WeakMap();
    this.painted = null;
    this.clearImages();
    this.ctx?.resetTransform();
    this.ctx?.clearRect(0, 0, this.root.width, this.root.height);
    this.failed = !this.ctx || this.lost || !!this.ctx.isContextLost?.();
    this.root.dataset.canvasState = this.failed ? 'unavailable' : 'empty';
    this.panel.hidden = !this.failed;
    this.note.textContent = this.failed ? 'Zeichenfläche nicht verfügbar. Erneut versuchen.' : '';
    if (this.contextKey) {
      this.views.delete(this.contextKey);
      this.views.set(this.contextKey, {
        box: this.view,
        initial: { ...this.initial },
        past: this.past.map((b) => ({ ...b })),
        future: this.future.map((b) => ({ ...b })),
      });
    }
    while (this.views.size > 32) this.views.delete(this.views.keys().next().value!);
    const saved = restore ? this.views.get(key) : undefined;
    this.contextKey = key;
    this.restored = !!saved;
    this.initial = { ...(saved?.initial ?? initial) };
    this.box = { ...(saved?.box ?? initial) };
    this.past = saved?.past.map((b) => ({ ...b })) ?? [];
    this.future = saved?.future.map((b) => ({ ...b })) ?? [];
    this.wheelAt = 0;
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
    // A deliberate reversal responds from the displayed view, without first
    // completing the unfinished movement in the opposite direction.
    const reversing =
      this.zoomTarget && (factor - 1) * (this.zoomTarget.width - this.box.width) < 0;
    const base = reversing ? this.box : (this.zoomTarget ?? this.box);
    const width = Math.min(
      (typeof this.options.maxWidth === 'function'
        ? this.options.maxWidth()
        : this.options.maxWidth) ?? 1e12,
      Math.max(this.options.minWidth ?? 0.001, base.width * factor),
    );
    // Keep the current pointer's world point fixed, even when a previous target
    // has not yet been reached and the user moves the pointer during a burst.
    const target = zoomBox(this.box, width, anchor);
    const smooth =
      this.options.smoothZoom && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!smooth) {
      this.stopZoom();
      this.set(target, true, 'zoom', coalesce);
      return;
    }
    const before = this.view,
      running = !!this.zoomTarget;
    this.zoomTarget = target;
    this.zoomAnchor = anchor;
    this.zoomUpdatedAt = performance.now();
    if (!coalesce && !running) {
      this.box = target;
      this.remember(before);
      this.box = before;
    }
    if (!running) {
      this.zoomPrevious = this.zoomUpdatedAt;
      this.zoomGeneration++;
    }
    this.requestFrame();
  }
  private advanceZoom(now = performance.now()) {
    const target = this.zoomTarget;
    if (!target) return;
    if (this.options.locked?.()) {
      this.stopZoom();
      return;
    }
    // RAF's shared timestamp can precede input handled earlier in this frame.
    // Actual callback time preserves monotonic elapsed time without a dead tick.
    now = Math.max(now, performance.now());
    const generation = this.zoomGeneration,
      elapsed = Math.max(0, now - this.zoomPrevious);
    this.zoomPrevious = Math.max(this.zoomPrevious, now);
    const current = this.view;
    const done =
      now - this.zoomUpdatedAt >= 160 || Math.abs(Math.log(target.width / current.width)) < 1e-7;
    const progress = done ? 1 : 1 - Math.exp(-elapsed / 40);
    this.set(
      zoomBox(current, current.width * (target.width / current.width) ** progress, this.zoomAnchor),
      true,
      'zoom',
      true,
    );
    // A changed callback may replace/cancel this animation or its destination.
    if (done && this.zoomGeneration === generation && this.zoomTarget === target)
      this.zoomTarget = null;
  }
  stopZoom() {
    this.zoomGeneration++;
    this.zoomTarget = null;
    this.wheelAt = 0;
    // The shared pending frame may also contain new geometry or an overlay.
  }
  redrawOverlay() {
    this.requestFrame();
  }
  reset() {
    this.cancel();
    this.set(this.initial, true, 'reset');
  }
  pan(dx: number, dy: number) {
    this.set({ ...this.box, x: this.box.x + dx, y: this.box.y + dy }, true, 'pan');
  }
  previous() {
    this.history(this.past, this.future);
  }
  next() {
    this.history(this.future, this.past);
  }
  private history(from: CanvasBox[], to: CanvasBox[]) {
    this.stopZoom();
    if (this.drag || this.options.locked?.()) return;
    const box = from.pop();
    if (!box) return;
    to.push(this.view);
    this.box = { ...box };
    this.wheelAt = 0;
    this.apply();
    this.refreshControls();
    this.options.changed?.(this.view, 'history');
  }
  cancel() {
    this.stopZoom();
    const drag = this.drag;
    this.drag = null;
    if (drag?.moved) this.remember(drag.box);
    if (drag && this.root.hasPointerCapture(drag.id)) this.root.releasePointerCapture(drag.id);
  }
  /** Compile off the visible surface. Only the newest complete scene and its hits are published. */
  render(draw: (scene: AtlasPaint) => void, emptyText = '') {
    this.renderScene = draw;
    this.emptyText = emptyText;
    if (this.failed || this.lost) return;
    this.root.title = '';
    const generation = ++this.generation;
    this.root.dataset.canvasState = 'loading';
    try {
      const scene = new AtlasPaint('group');
      scene.data.mapScene = 'true';
      draw(scene);
      const compiled = new AtlasCanvasScene(scene, this.paths);
      this.root.dataset.pathBuilds = String(compiled.pathBuilds);
      this.root.dataset.pathReuses = String(compiled.pathReuses);
      if (compiled.images.size > 32) throw Error('Zu viele Kartenbilder in einem Ausschnitt.');
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
          let imageErrors = 0;
          for (const source of frame.compiled.images) {
            const optional = !frame.compiled.requiredImages.has(source);
            try {
              if (optional && this.unavailableImages.has(source)) imageErrors++;
              else
                await this.image(source, frame.compiled.landscapeImages.has(source) ? 1024 : 512);
            } catch (error) {
              if (!optional) throw error;
              this.unavailableImages.add(source);
              imageErrors++;
            }
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
          this.root.dataset.imageErrors = String(imageErrors);
          this.root.style.visibility = '';
          this.root.removeAttribute('aria-disabled');
          this.panel.hidden = !frame.text && !imageErrors;
          this.panel.setAttribute('role', 'status');
          this.note.textContent = imageErrors
            ? `${imageErrors} Bildvorlage(n) nicht verfügbar. Umrisse bleiben sichtbar; übrige Karte ist bedienbar.`
            : frame.text;
          this.panel.querySelector('button')!.hidden = !imageErrors;
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
    for (const source of this.unavailableImages)
      if (!keep.has(source) && !this.pending?.compiled.images.has(source))
        this.unavailableImages.delete(source);
    for (const [key, image] of this.decoded)
      if (!keep.has(key) && !this.pending?.compiled.images.has(key)) {
        image.close();
        this.decoded.delete(key);
      }
  }
  private fail(error: unknown) {
    this.root.title = '';
    this.generation++;
    this.pending = null;
    this.compiled?.dispose();
    this.compiled = null;
    this.paths = new WeakMap();
    this.painted = null;
    this.failed = true;
    this.cancel();
    this.clearImages();
    this.ctx?.resetTransform();
    this.ctx?.clearRect(0, 0, this.root.width, this.root.height);
    this.root.setAttribute('aria-disabled', 'true');
    this.root.dataset.canvasState = 'unavailable';
    this.panel.hidden = false;
    this.panel.setAttribute('role', 'alert');
    this.note.textContent =
      'Karte konnte nicht gezeichnet werden. Daten und Navigation bleiben erhalten. ' +
      (error as Error).message;
    this.panel.querySelector('button')!.hidden = false;
  }
  hitAt(e: { clientX: number; clientY: number }, keys = ['atlasObject']) {
    if (!this.ready || !this.compiled) return null;
    const presentation = this.options.presentation?.();
    if (presentation) return presentation.hitAt(e, keys);
    const p = this.point(e);
    return this.compiled.hit(
      this.ctx!,
      { x: p.x - this.sceneOrigin.x, y: p.y - this.sceneOrigin.y },
      keys,
    );
  }
}
