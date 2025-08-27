/**
 * HexView – framework-agnostic SVG-based 2D hex renderer with pan/zoom, hit test, selection, tooltip.
 * Can be mounted into any container HTMLElement.
 *
 * Dependencies:
 *  - logger.createLogger(namespace) -> { trace, debug, info, warn, error }
 *  - TileNoteService with createIfMissing(q,r,region,defaults?) and open(q,r)
 */

import type { HexViewStore } from "./HexViewStore";
import { axialToPixel, hexPolygon, polygonPointsAttr, pixelToAxial } from "./HexMath";

type Logger = {
  trace: (...a: any[]) => void;
  debug: (...a: any[]) => void;
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
};

type TileNoteService = {
  createIfMissing: (q: number, r: number, region?: string|null, defaults?: any) => Promise<void>;
  open: (q: number, r: number) => Promise<void>;
};

export interface HexViewOptions {
  cols: number;
  rows: number;
  region?: string | null;
  bg?: string;
}

export class HexView {
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private terrainLayer: SVGGElement;
  private featureLayer: SVGGElement;
  private selectionLayer: SVGGElement;
  private tooltip: HTMLDivElement;

  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private panStart = { x: 0, y: 0 };

  constructor(
    private container: HTMLElement,
    private store: HexViewStore,
    private logger: Logger,
    private notes: TileNoteService,
    private opts: HexViewOptions
  ) {
    this.root = document.createElement('div');
    this.root.className = 'sm-hexview-root';
    this.root.style.position = 'relative';
    this.root.style.width = '100%';
    this.root.style.height = '100%';
    this.root.style.overflow = 'hidden';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', '0 0 1000 800'); // initial; we transform via group
    this.svg.style.background = opts.bg ?? 'var(--background-secondary)';
    this.svg.style.cursor = 'grab';

    // Layers
    const world = document.createElementNS(this.svg.namespaceURI, 'g');
    world.setAttribute('id', 'world');

    this.terrainLayer = document.createElementNS(this.svg.namespaceURI, 'g');
    this.terrainLayer.setAttribute('id', 'terrain');
    this.featureLayer = document.createElementNS(this.svg.namespaceURI, 'g');
    this.featureLayer.setAttribute('id', 'features');
    this.selectionLayer = document.createElementNS(this.svg.namespaceURI, 'g');
    this.selectionLayer.setAttribute('id', 'selection');

    world.appendChild(this.terrainLayer);
    world.appendChild(this.featureLayer);
    world.appendChild(this.selectionLayer);
    this.svg.appendChild(world);

    // Tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sm-hexview-tooltip';
    Object.assign(this.tooltip.style, {
      position: 'absolute',
      pointerEvents: 'none',
      top: '0px',
      left: '0px',
      padding: '6px 8px',
      fontSize: '12px',
      background: 'rgba(0,0,0,0.75)',
      color: 'white',
      borderRadius: '6px',
      transform: 'translate(10px, 10px)',
      opacity: '0',
      transition: 'opacity 120ms ease-out',
      zIndex: '10'
    } as CSSStyleDeclaration);

    this.root.appendChild(this.svg);
    this.root.appendChild(this.tooltip);
    this.container.appendChild(this.root);

    // Event handlers
    this.attachEvents();
    // Initial draw
    this.drawGrid();

    this.store.subscribe((s) => {
      // Apply world transform
      const worldTransform = `translate(${s.panX.toFixed(2)},${s.panY.toFixed(2)}) scale(${s.zoom.toFixed(3)})`;
      (world as SVGGElement).setAttribute('transform', worldTransform);
      // Selection
      this.drawSelection();
    });

    this.logger.debug('[HexView] init', { opts, state: this.store.state });
  }

  private attachEvents() {
    // Pan (middle mouse)
    this.svg.addEventListener('mousedown', (ev) => {
      if (ev.button === 1) {
        this.dragging = true;
        this.svg.style.cursor = 'grabbing';
        this.dragStart = { x: ev.clientX, y: ev.clientY };
        const s = this.store.state;
        this.panStart = { x: s.panX, y: s.panY };
        ev.preventDefault();
      }
    });
    window.addEventListener('mouseup', () => {
      if (this.dragging) {
        this.dragging = false;
        this.svg.style.cursor = 'grab';
      }
    });
    window.addEventListener('mousemove', (ev) => {
      if (!this.dragging) return;
      const dx = ev.clientX - this.dragStart.x;
      const dy = ev.clientY - this.dragStart.y;
      this.store.set({ panX: this.panStart.x + dx, panY: this.panStart.y + dy });
    });

    // Wheel-zoom around mouse
    this.svg.addEventListener('wheel', (ev) => {
      const factor = ev.deltaY < 0 ? 1.15 : 1/1.15;
      const rect = this.svg.getBoundingClientRect();
      const vx = ev.clientX - rect.left;
      const vy = ev.clientY - rect.top;
      const s = this.store.state;
      // Convert viewport point to world coords BEFORE zoom
      const worldX = (vx - s.panX) / s.zoom;
      const worldY = (vy - s.panY) / s.zoom;
      const { oldZoom, newZoom } = this.store.setZoomAt(factor, worldX, worldY, vx, vy);
      this.logger.debug('[HexView] wheelZoom', { old: oldZoom, new: newZoom, at: { x: vx, y: vy } });
      ev.preventDefault();
    }, { passive: false });

    // Click -> Hit test -> select -> open note
    this.svg.addEventListener('click', async (ev) => {
      // Ignore if middle-drag ended
      if (this.dragging) return;
      const rect = this.svg.getBoundingClientRect();
      const vx = ev.clientX - rect.left;
      const vy = ev.clientY - rect.top;
      const s = this.store.state;
      const worldX = (vx - s.panX) / s.zoom;
      const worldY = (vy - s.panY) / s.zoom;

      const { q, r } = pixelToAxial({ x: worldX, y: worldY }, { size: s.hexSize });
      this.logger.debug('[HexView] hitTest', { px: worldX, py: worldY, result: { q, r } });
      this.store.set({ selected: { q, r } });

      try {
        await this.notes.createIfMissing(q, r, this.store.state.region ?? null, undefined);
        await this.notes.open(q, r);
        this.logger.info('[HexView] open', { q, r });
      } catch (err) {
        this.logger.error('[HexView] open-failed', { q, r, err });
      }
    });

    // Tooltip show (mousemove)
    this.svg.addEventListener('mousemove', (ev) => {
      const rect = this.svg.getBoundingClientRect();
      const vx = ev.clientX - rect.left;
      const vy = ev.clientY - rect.top;
      const s = this.store.state;
      const worldX = (vx - s.panX) / s.zoom;
      const worldY = (vy - s.panY) / s.zoom;
      const { q, r } = pixelToAxial({ x: worldX, y: worldY }, { size: s.hexSize });
      this.tooltip.textContent = `q:${q} r:${r}` + (s.region ? ` • ${s.region}` : '');
      this.tooltip.style.left = `${vx}px`;
      this.tooltip.style.top = `${vy}px`;
      this.tooltip.style.opacity = '1';
    });
    this.svg.addEventListener('mouseleave', () => {
      this.tooltip.style.opacity = '0';
    });
  }

  private drawGrid() {
    const s = this.store.state;
    this.logger.debug('[HexView] drawGrid', { cols: this.opts.cols, rows: this.opts.rows, hexSize: s.hexSize });

    // Clear
    this.terrainLayer.replaceChildren();

    // Grid extents centered around (0,0) in world coords for now.
    // Draw a rectangular block of axial coords.
    const cols = this.opts.cols;
    const rows = this.opts.rows;
    for (let r = -Math.floor(rows/2); r <= Math.floor(rows/2); r++) {
      for (let q = -Math.floor(cols/2); q <= Math.floor(cols/2); q++) {
        const pts = hexPolygon({ q, r }, { size: s.hexSize });
        const poly = document.createElementNS(this.svg.namespaceURI, 'polygon');
        poly.setAttribute('points', polygonPointsAttr(pts));
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', 'var(--text-muted)');
        poly.setAttribute('stroke-width', '1');
        this.terrainLayer.appendChild(poly);
      }
    }
  }

  private drawSelection() {
    const s = this.store.state;
    this.selectionLayer.replaceChildren();
    if (!s.selected) return;
    const { q, r } = s.selected;
    const pts = hexPolygon({ q, r }, { size: s.hexSize });
    const poly = document.createElementNS(this.svg.namespaceURI, 'polygon');
    poly.setAttribute('points', polygonPointsAttr(pts));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', 'var(--interactive-accent)');
    poly.setAttribute('stroke-width', '3');
    this.selectionLayer.appendChild(poly);
    this.logger.info('[HexView] select', { q, r });
  }

  /** public API: allow external resize triggers (e.g., if container size changes) */
  public invalidate() {
    this.drawGrid();
    this.drawSelection();
  }

  /** Clean up DOM listeners */
  public destroy() {
    this.container.removeChild(this.root);
  }
}
