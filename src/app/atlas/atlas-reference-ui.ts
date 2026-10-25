import type { CanvasBox } from '../runtime/passive-map-canvas';
import { atlasPaint, type AtlasPaint } from './atlas-paint';
import { distanceLabel, fitReference } from './atlas-navigation-scale';
import { geographicReferences, type GeographicReference } from './atlas-reference-catalog';

export class AtlasReferenceUI {
  readonly panel = document.createElement('section');
  private selected: GeographicReference | null = null;
  private box: CanvasBox | null = null;
  private drag: { id: number; start: { x: number; y: number }; box: CanvasBox } | null = null;
  private search: HTMLInputElement;
  private category: HTMLSelectElement;
  private results: HTMLDivElement;
  private status: HTMLParagraphElement;
  private show: HTMLButtonElement;
  private focus: HTMLButtonElement;
  get active() {
    return !this.panel.hidden;
  }
  get dragging() {
    return !!this.drag;
  }
  constructor(
    private canvas: HTMLCanvasElement,
    private host: {
      view: () => CanvasBox;
      point: (e: { clientX: number; clientY: number }) => { x: number; y: number };
      set: (box: CanvasBox) => void;
      redraw: () => void;
      closed: () => void;
    },
  ) {
    this.panel.id = 'atlas-reference-panel';
    this.panel.hidden = true;
    this.panel.innerHTML =
      '<h2>Größe vergleichen</h2><p>Ungefähre geografische Ausdehnung. Rahmen auf der Karte verschieben; mittlere Maustaste verschiebt die Ansicht.</p><label>Geografischen Vergleich suchen<input id="atlas-reference-search" type="search" placeholder="Deutschland, Europa, Berlin …"></label><label>Kategorie<select id="atlas-reference-category"><option value="">Alle Größen</option><option>Länder und Gebiete</option><option>Bundesländer</option><option>Städte</option><option>Inseln</option><option>Kontinente</option><option>Welt</option></select></label><div id="atlas-reference-results" role="group" aria-label="Geografische Vergleiche"></div><p id="atlas-reference-status" role="status"></p><div class="toolbar"><button id="atlas-reference-show">Rahmen vollständig anzeigen</button><button id="atlas-reference-focus">Bereich fokussieren</button><button id="atlas-reference-cancel">Abbrechen</button></div><details><summary>Maße und Quellen</summary><p>Breite und Höhe sind gerundete Näherungen aus geografischen Grenzen, keine Flächenangaben. Die Breite wird entlang des mittleren Breitengrads berechnet. Städte verwenden ihre Verwaltungsgrenzen; abweichende Gebiete stehen im Namen. Datenstand: 18. Oktober 2026.</p><p>Natural Earth (Public Domain); Stadt- und ergänzende Inselgrenzen: © OpenStreetMap-Mitwirkende, ODbL. Jeder Vergleich nennt seine Quelle.</p><textarea id="atlas-reference-source" readonly rows="3" aria-label="Quelladresse des ausgewählten Vergleichs"></textarea></details>';
    this.search = this.panel.querySelector('#atlas-reference-search')!;
    this.category = this.panel.querySelector('#atlas-reference-category')!;
    this.results = this.panel.querySelector('#atlas-reference-results')!;
    this.status = this.panel.querySelector('#atlas-reference-status')!;
    this.show = this.panel.querySelector('#atlas-reference-show')!;
    this.focus = this.panel.querySelector('#atlas-reference-focus')!;
    document.addEventListener('atlas-units-changed', () => {
      if (this.active) {
        this.list();
        this.update();
      }
    });
    this.search.oninput = this.category.onchange = () => this.list();
    this.show.onclick = () => {
      if (this.box) this.host.set(this.fitted());
    };
    this.focus.onclick = () => {
      if (this.box) {
        const box = this.fitted();
        this.close();
        this.host.set(box);
      }
    };
    this.panel.querySelector<HTMLButtonElement>('#atlas-reference-cancel')!.onclick = () =>
      this.close();
    const escape = (e: KeyboardEvent) => {
      if (this.active && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
      }
    };
    this.panel.addEventListener('keydown', escape, true);
    canvas.addEventListener(
      'keydown',
      (e) => {
        escape(e);
        if (!this.active || !this.box) return;
        const direction: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const d = direction[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const step =
          (this.host.view().width / Math.max(1, canvas.clientWidth)) * (e.shiftKey ? 100 : 10);
        this.box = { ...this.box, x: this.box.x + d[0] * step, y: this.box.y + d[1] * step };
        this.host.redraw();
      },
      true,
    );
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.active || e.button !== 0 || e.altKey) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const p = host.point(e),
          b = this.box;
        if (b && p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) {
          this.drag = { id: e.pointerId, start: p, box: { ...b } };
          canvas.setPointerCapture(e.pointerId);
        }
      },
      true,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (this.drag?.id !== e.pointerId) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const p = host.point(e),
          d = this.drag;
        this.box = { ...d.box, x: d.box.x + p.x - d.start.x, y: d.box.y + p.y - d.start.y };
        host.redraw();
      },
      true,
    );
    const finish = (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.release();
    };
    canvas.addEventListener('pointerup', finish, true);
    canvas.addEventListener(
      'pointercancel',
      (e) => {
        if (this.drag?.id === e.pointerId) {
          this.box = this.drag.box;
          finish(e);
          host.redraw();
        }
      },
      true,
    );
    canvas.addEventListener('lostpointercapture', () => {
      this.drag = null;
    });
    canvas.addEventListener(
      'click',
      (e) => {
        if (this.active) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  }
  private release() {
    const drag = this.drag;
    this.drag = null;
    if (drag && this.canvas.hasPointerCapture(drag.id)) this.canvas.releasePointerCapture(drag.id);
  }
  open() {
    this.panel.hidden = false;
    this.list();
    this.update();
    this.search.focus();
  }
  close() {
    this.release();
    this.box = null;
    this.selected = null;
    this.panel.hidden = true;
    this.host.closed();
    this.host.redraw();
  }
  private fitted() {
    return fitReference(
      this.box!,
      Math.max(1, this.canvas.clientWidth) / Math.max(1, this.canvas.clientHeight),
    );
  }
  private list() {
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('de');
    const query = normalize(this.search.value.trim());
    this.results.replaceChildren();
    const matches = geographicReferences.filter(
      (r) =>
        (!this.category.value || r.category === this.category.value) &&
        normalize(r.name + ' ' + r.aliases.join(' ')).includes(query),
    );
    for (const ref of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.referenceId = ref.id;
      button.textContent = `${ref.name} · ca. ${distanceLabel(ref.width)} × ${distanceLabel(ref.height)}`;
      button.setAttribute('aria-pressed', String(this.selected?.id === ref.id));
      button.onclick = () => {
        this.selected = ref;
        const v = this.host.view();
        this.box = {
          x: v.x + (v.width - ref.width) / 2,
          y: v.y + (v.height - ref.height) / 2,
          width: ref.width,
          height: ref.height,
        };
        this.list();
        this.update();
        this.host.redraw();
        this.canvas.focus();
      };
      this.results.append(button);
    }
    if (!matches.length) this.results.textContent = 'Keine passende Referenz gefunden.';
  }
  private update() {
    const ref = this.selected,
      b = this.box,
      v = this.host.view();
    this.show.disabled = this.focus.disabled = !b;
    this.show.hidden =
      !!b &&
      b.x >= v.x &&
      b.y >= v.y &&
      b.x + b.width <= v.x + v.width &&
      b.y + b.height <= v.y + v.height;
    this.status.textContent = ref
      ? `${ref.name}: ca. ${distanceLabel(ref.width)} breit × ${distanceLabel(ref.height)} hoch. Rahmen ziehen oder mit Pfeiltasten verschieben.`
      : `${geographicReferences.length} reale Größenvergleiche. Wähle einen Vergleich.`;
    const source = this.panel.querySelector<HTMLTextAreaElement>('#atlas-reference-source')!;
    source.hidden = !ref;
    if (ref && source.value !== ref.source) source.value = ref.source;
  }
  draw(root: AtlasPaint, view: CanvasBox, mpp: number) {
    if (!this.active) return;
    this.update();
    const b = this.box;
    if (!b) return;
    root.append(
      atlasPaint('rect', {
        x: b.x - view.x,
        y: b.y - view.y,
        width: b.width,
        height: b.height,
        style: {
          fill: '#fff4cf22',
          stroke: '#8c3b14',
          lineWidth: mpp * 2,
          lineDash: [mpp * 8, mpp * 4],
        },
        pointer: false,
        data: { referenceFrame: 'true' },
      }),
    );
    root.append(
      atlasPaint(
        'text',
        {
          x: 0,
          y: 0,
          matrix: [
            mpp,
            0,
            0,
            mpp,
            Math.max(mpp * 12, b.x - view.x + mpp * 8),
            Math.max(mpp * 24, b.y - view.y + mpp * 22),
          ],
          style: { fontSize: 14, fill: '#3c281a', stroke: '#fff7df', lineWidth: 3 },
          pointer: false,
        },
        this.selected!.name,
      ),
    );
  }
}
