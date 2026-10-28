import type { CanvasBox } from '../atlas/atlas-camera';
import { ownedEventTarget } from '../shared/owned-event-target';
export type { CanvasBox } from '../atlas/atlas-camera';
/** Presentation only. Scene units, elements and DOM hits are interpreted by the adopter. */
export type CameraReason = 'pan' | 'zoom' | 'reset' | 'set' | 'history';
type SavedView = { box: CanvasBox; initial: CanvasBox; past: CanvasBox[]; future: CanvasBox[] };
const same = (a: CanvasBox, b: CanvasBox) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
export class PassiveMapCanvas {
  private cleanups: (() => void)[] = [];
  dispose() {
    this.cancel();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.controls.remove();
    this.panel.remove();
  }
  private box: CanvasBox;
  private initial: CanvasBox;
  private contextKey = '';
  private rendering = false;
  private failed = false;
  private renderScene: ((scene: SVGGElement) => void) | null = null;
  private emptyText = '';
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
  private restored = false;
  private scene: SVGGElement | null = null;
  constructor(
    readonly root: SVGSVGElement,
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
    const events = ownedEventTarget(root, this.cleanups);
    this.box = { ...options.initial };
    this.initial = { ...options.initial };
    this.apply();
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
    retry.onclick = () => {
      if (!this.renderScene) return;
      this.failed = false;
      this.render(this.renderScene, this.emptyText);
    };
    this.panel.append(this.note, retry);
    root.after(this.panel);
    root.style.touchAction = 'none';
    events.addEventListener(
      'pointerdown',
      (e) => {
        if (this.failed) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        this.suppressClick = false;
        if (this.drag || this.options.locked?.() || !(this.options.pan?.(e) ?? e.button === 1))
          return;
        const matrix = root.getScreenCTM();
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
    events.addEventListener(
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
    events.addEventListener('pointerup', finish, true);
    events.addEventListener('pointercancel', finish, true);
    events.addEventListener('lostpointercapture', () => this.cancel());
    events.addEventListener('pointerleave', (e) => {
      if (this.drag?.id === e.pointerId && !root.hasPointerCapture(e.pointerId)) this.cancel();
    });
    events.addEventListener(
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
    events.addEventListener(
      'wheel',
      (e) => {
        if (!e.deltaY) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.failed || this.options.locked?.() || this.drag) return;
        const matrix = root.getScreenCTM?.();
        const p = matrix
          ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
          : undefined;
        const burst = Date.now() - this.wheelAt < 300;
        this.zoom(
          e.deltaY > 0 ? 1.2 : 1 / 1.2,
          p && this.options.relative ? { x: p.x + this.box.x, y: p.y + this.box.y } : p,
          burst,
        );
        this.wheelAt = Date.now();
      },
      { capture: true, passive: false },
    );
  }
  private screenStart(drag: NonNullable<PassiveMapCanvas['drag']>) {
    return drag.start.matrixTransform(drag.inverse.inverse());
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
  private apply() {
    this.root.setAttribute(
      'viewBox',
      `${this.options.relative ? 0 : this.box.x} ${this.options.relative ? 0 : this.box.y} ${this.box.width} ${this.box.height}`,
    );
    if (this.options.relative && this.scene) {
      this.scene.setAttribute(
        'transform',
        `translate(${this.sceneOrigin.x - this.box.x} ${this.sceneOrigin.y - this.box.y})`,
      );
      for (const hud of this.scene.querySelectorAll('[data-canvas-hud]'))
        hud.setAttribute(
          'transform',
          `translate(${this.box.x - this.sceneOrigin.x} ${this.box.y - this.sceneOrigin.y})`,
        );
    }
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
    anchor = { x: this.box.x + this.box.width / 2, y: this.box.y + this.box.height / 2 },
    coalesce = false,
  ) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const width = Math.min(
        (typeof this.options.maxWidth === 'function'
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
      'zoom',
      coalesce,
    );
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
    const drag = this.drag;
    this.drag = null;
    if (drag?.moved) this.remember(drag.box);
    if (drag && this.root.hasPointerCapture(drag.id)) this.root.releasePointerCapture(drag.id);
  }
  /** Build off-screen, then publish one shared root for drawing and native hit-testing. */
  render(draw: (scene: SVGGElement) => void, emptyText = '') {
    if (this.root.dataset.sharedAtlas === 'true') {
      this.root.replaceChildren();
      this.scene = null;
      return;
    }
    this.renderScene = draw;
    this.emptyText = emptyText;
    if (this.rendering || this.failed) return;
    this.rendering = true;
    try {
      const scene = this.root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
      scene.dataset.mapScene = 'true';
      draw(scene);
      this.root.replaceChildren(scene);
      this.scene = scene;
      this.sceneOrigin = { x: this.box.x, y: this.box.y };
      this.apply();
      this.root.style.visibility = '';
      this.root.removeAttribute('aria-disabled');
      this.root.dataset.canvasState = emptyText ? 'empty' : 'loaded';
      this.panel.hidden = !emptyText;
      this.panel.setAttribute('role', 'status');
      this.note.textContent = emptyText;
      this.panel.querySelector('button')!.hidden = true;
    } catch (error) {
      this.root.replaceChildren();
      this.scene = null;
      this.failed = true;
      this.cancel();
      this.root.style.visibility = 'hidden';
      this.root.setAttribute('aria-disabled', 'true');
      this.root.dataset.canvasState = 'unavailable';
      this.panel.hidden = false;
      this.panel.setAttribute('role', 'alert');
      this.note.textContent =
        'Karte konnte nicht gezeichnet werden. Daten und Navigation bleiben erhalten. ' +
        (error as Error).message;
      this.panel.querySelector('button')!.hidden = false;
    } finally {
      this.rendering = false;
      this.refreshControls();
    }
  }
  /** Passive DOM hit: coordinate/ref/command conversion belongs to the adopter. */
  hit(clientX: number, clientY: number): Element | null {
    if (this.root.dataset.sharedAtlas === 'true' || this.failed || !this.scene) return null;
    const hit = this.root.ownerDocument.elementFromPoint(clientX, clientY);
    return hit && this.scene.contains(hit) ? hit : null;
  }
}
