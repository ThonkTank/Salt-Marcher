import type { WorldLinksPage, WorldLinkRef } from './world-links-contracts';
import { worldLinkKey, worldLinkKinds } from './world-links-contracts';
const svg = (tag: string) => document.createElementNS('http://www.w3.org/2000/svg', tag);
const colors = {
  note: '#e5e8ed',
  npc: '#dcebdc',
  faction: '#e5e0ee',
  quest: '#f3e2bd',
  rumor: '#f2dcd4',
  rule: '#e0e8ef',
  location: '#d9e9ef',
  creature: '#e8dfd0',
  item: '#dfe8ca',
  encounter: '#ead6dd',
};
export class WorldLinksMap {
  readonly root = svg('svg');
  private box = { x: 0, y: 0, w: 1000, h: 650 };
  private bounds = { ...this.box };
  constructor(private select: (ref: WorldLinkRef) => void) {
    this.root.id = 'world-links-map';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute(
      'aria-label',
      'Kampagnenzusammenhänge; Pfeiltasten verschieben, Plus und Minus zoomen, 0 passt die Karte ein',
    );
    this.root.setAttribute('tabindex', '0');
    let drag: { x: number; y: number; box: { x: number; y: number; w: number; h: number } } | null =
      null;
    this.root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target as Element).closest('[data-world-link-node]')) return;
      drag = { x: e.clientX, y: e.clientY, box: { ...this.box } };
      this.root.setPointerCapture(e.pointerId);
    });
    this.root.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = this.root.getBoundingClientRect();
      this.box = {
        ...drag.box,
        x: drag.box.x - ((e.clientX - drag.x) / r.width) * drag.box.w,
        y: drag.box.y - ((e.clientY - drag.y) / r.height) * drag.box.h,
      };
      this.apply();
    });
    this.root.addEventListener('pointerup', () => (drag = null));
    this.root.addEventListener('pointercancel', () => (drag = null));
    this.root.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 0.8 : 1.25);
      },
      { passive: false },
    );
    this.root.addEventListener('keydown', (e) => {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (moves[e.key]) {
        e.preventDefault();
        const [x, y] = moves[e.key]!;
        this.box.x += x * this.box.w * 0.1;
        this.box.y += y * this.box.h * 0.1;
        this.apply();
      } else if (['+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault();
        if (e.key === '0') this.fit();
        else this.zoom(e.key === '-' ? 1.25 : 0.8);
      }
    });
  }
  private apply() {
    this.root.setAttribute('viewBox', [this.box.x, this.box.y, this.box.w, this.box.h].join(' '));
  }
  zoom(factor: number) {
    const w = Math.min(16000, Math.max(250, this.box.w * factor)),
      h = (this.box.h * w) / this.box.w;
    this.box = { x: this.box.x + (this.box.w - w) / 2, y: this.box.y + (this.box.h - h) / 2, w, h };
    this.apply();
  }
  fit() {
    this.box = { ...this.bounds };
    this.apply();
  }
  draw(page: WorldLinksPage, current: () => boolean = () => true) {
    this.root.replaceChildren();
    const positions = new Map<string, { x: number; y: number }>(),
      focus = page.focus ? worldLinkKey(page.focus.ref) : null;
    const shown = focus
      ? page.nodes.filter(
          (n) =>
            worldLinkKey(n.ref) === focus ||
            page.edges.some(
              (e) =>
                (worldLinkKey(e.source) === focus &&
                  worldLinkKey(e.target) === worldLinkKey(n.ref)) ||
                (worldLinkKey(e.target) === focus &&
                  worldLinkKey(e.source) === worldLinkKey(n.ref)),
            ),
        )
      : page.nodes;
    const kinds = (Object.keys(worldLinkKinds) as (keyof typeof worldLinkKinds)[]).filter((kind) =>
        shown.some((n) => n.kind === kind),
      ),
      counts = new Map<string, number>(),
      starts = new Map<string, number>();
    let columns = 0;
    for (const kind of kinds) {
      const count = shown.filter((n) => n.kind === kind).length;
      starts.set(kind, columns);
      columns += Math.ceil(count / 8);
    }
    for (const n of shown) {
      const k = worldLinkKey(n.ref),
        row = counts.get(n.kind) ?? 0;
      positions.set(k, {
        x: 120 + (starts.get(n.kind)! + Math.floor(row / 8)) * 230,
        y: 100 + (row % 8) * 90,
      });
      counts.set(n.kind, row + 1);
    }
    const maxRows = Math.max(1, ...counts.values());
    this.bounds = {
      x: 0,
      y: 0,
      w: Math.max(500, 160 + columns * 230),
      h: Math.max(500, 170 + Math.min(8, maxRows) * 90),
    };
    let labeled = 0;
    const defs = svg('defs'),
      marker = svg('marker');
    marker.id = 'world-links-arrow';
    for (const [a, v] of Object.entries({
      viewBox: '0 0 10 10',
      refX: '9',
      refY: '5',
      markerWidth: '6',
      markerHeight: '6',
      orient: 'auto-start-reverse',
    }))
      marker.setAttribute(a, v);
    const arrow = svg('path');
    arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrow.setAttribute('fill', '#657889');
    marker.append(arrow);
    defs.append(marker);
    this.root.append(defs);
    for (const e of page.edges) {
      const a = positions.get(worldLinkKey(e.source)),
        b = positions.get(worldLinkKey(e.target));
      if (!a || !b) continue;
      const path = svg('path'),
        selected = worldLinkKey(e.source) === focus || worldLinkKey(e.target) === focus;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        t = 1 / Math.max(Math.abs(dx) / 105, Math.abs(dy) / 33),
        from = { x: a.x + dx * t, y: a.y + dy * t },
        to = { x: b.x - dx * t, y: b.y - dy * t };
      path.setAttribute(
        'd',
        a === b
          ? `M ${a.x} ${a.y - 29} C ${a.x - 100} ${a.y - 100},${a.x + 100} ${a.y - 100},${a.x + 10} ${a.y - 29}`
          : `M ${from.x} ${from.y} Q ${(a.x + b.x) / 2 + (dx === 0 ? 50 : 0)} ${(a.y + b.y) / 2 - 20} ${to.x} ${to.y}`,
      );
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', e.authored ? '#5d758a' : '#a68652');
      path.setAttribute('stroke-width', selected ? '2.8' : '1.3');
      path.setAttribute('opacity', selected ? '1' : '.45');
      if (!e.authored) path.setAttribute('stroke-dasharray', '7 5');
      path.setAttribute('marker-end', 'url(#world-links-arrow)');
      const title = svg('title');
      title.textContent = e.label;
      path.append(title);
      this.root.append(path);
      if (selected && labeled++ < 12) {
        const text = svg('text');
        text.setAttribute('x', String((a.x + b.x) / 2));
        text.setAttribute('y', String((a.y + b.y) / 2 - 16));
        text.setAttribute('text-anchor', 'middle');
        text.classList.add('world-links-edge-label');
        text.textContent = e.label.slice(0, 36);
        this.root.append(text);
      }
    }
    for (const kind of kinds) {
      const title = svg('text');
      title.setAttribute(
        'x',
        String(120 + (starts.get(kind)! + (Math.ceil(counts.get(kind)! / 8) - 1) / 2) * 230),
      );
      title.setAttribute('y', '40');
      title.setAttribute('text-anchor', 'middle');
      title.classList.add('world-links-column');
      title.textContent = worldLinkKinds[kind];
      this.root.append(title);
    }
    for (const n of shown) {
      const key = worldLinkKey(n.ref),
        p = positions.get(key)!,
        g = svg('g');
      g.dataset.worldLinkNode = key;
      g.setAttribute('transform', `translate(${p.x - 100} ${p.y - 29})`);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute(
        'aria-label',
        worldLinkKinds[n.kind] + ': ' + n.title + (n.available ? '' : ' · nicht verfügbar'),
      );
      const r = svg('rect');
      for (const [a, v] of Object.entries({
        width: '200',
        height: '58',
        rx: '9',
        fill: n.available ? colors[n.kind] : '#e5e5e5',
        stroke: key === focus ? '#244e70' : '#aab6bf',
        'stroke-width': key === focus ? '3' : '1',
      }))
        r.setAttribute(a, v);
      const title = svg('title');
      title.textContent = n.title + ' · ' + n.ref.id;
      g.append(title, r);
      for (const [text, y] of [
        [n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title, 23],
        [worldLinkKinds[n.kind] + ' · ' + n.ref.id.slice(0, 8), 43],
      ] as const) {
        const t = svg('text');
        t.setAttribute('x', '12');
        t.setAttribute('y', String(y));
        t.classList.add(y === 23 ? 'world-links-node-title' : 'world-links-node-kind');
        t.textContent = text;
        g.append(t);
      }
      g.addEventListener('click', () => {
        if (g.isConnected && current()) this.select(n.ref);
      });
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (g.isConnected && current()) this.select(n.ref);
        }
      });
      this.root.append(g);
    }
    this.fit();
  }
}
