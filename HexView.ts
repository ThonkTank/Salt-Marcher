// HexView.ts
// SVG-basierter Renderer für Hex-Grids mit Pan/Zoom, Hit-Test, Selection, Tooltip

import { HexViewStore } from "./HexViewStore";
import { polygonCorners, pixelToAxial } from "./HexMath";
import type { TileNoteService } from "./TileNoteService";

export interface HexViewOptions {
  cols: number;
  rows: number;
  bg?: string;
}

export class HexView {
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private world: SVGGElement;
  private terrainLayer: SVGGElement;
  private featureLayer: SVGGElement;
  private selectionLayer: SVGGElement;
  private tooltip: HTMLDivElement;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private panStart = { x: 0, y: 0 };

  constructor(
    container: HTMLElement,
    private store: HexViewStore,
    private logger: any,
    private notes: TileNoteService,
    private opts: HexViewOptions
  ) {
    this.root = container;
    this.root.style.position = "relative";

    // SVG erstellen
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.style.cursor = "grab";

    this.world = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.terrainLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.featureLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.selectionLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");

    this.world.appendChild(this.terrainLayer);
    this.world.appendChild(this.featureLayer);
    this.world.appendChild(this.selectionLayer);
    this.svg.appendChild(this.world);
    this.root.appendChild(this.svg);

    // Tooltip
    this.tooltip = document.createElement("div");
    this.tooltip.style.position = "absolute";
    this.tooltip.style.pointerEvents = "none";
    this.tooltip.style.background = "rgba(0,0,0,0.7)";
    this.tooltip.style.color = "white";
    this.tooltip.style.padding = "2px 6px";
    this.tooltip.style.borderRadius = "4px";
    this.tooltip.style.fontSize = "12px";
    this.tooltip.style.display = "none";
    this.root.appendChild(this.tooltip);

    this.attachEvents();
    this.store.subscribe(() => this.redraw());
    this.drawGrid();
  }

  private attachEvents() {
    // Pan (middle mouse)
    this.svg.addEventListener("mousedown", (ev) => {
      if (ev.button === 1) {
        this.dragging = true;
        this.svg.style.cursor = "grabbing";
        this.dragStart = { x: ev.clientX, y: ev.clientY };
        const s = this.store.state;
        this.panStart = { x: s.panX, y: s.panY };
        ev.preventDefault();
      }
    });
    window.addEventListener("mouseup", () => {
      if (this.dragging) {
        this.dragging = false;
        this.svg.style.cursor = "grab";
      }
    });
    window.addEventListener("mousemove", (ev) => {
      if (!this.dragging) return;
      const dx = ev.clientX - this.dragStart.x;
      const dy = ev.clientY - this.dragStart.y;
      this.store.set({ panX: this.panStart.x + dx, panY: this.panStart.y + dy });
    });

    // Zoom (wheel)
    this.svg.addEventListener(
      "wheel",
      (ev: WheelEvent) => {
        ev.preventDefault();
        const rect = this.svg.getBoundingClientRect();
        const vx = ev.clientX - rect.left;
        const vy = ev.clientY - rect.top;
        const factor = ev.deltaY > 0 ? 0.9 : 1.1;
        this.store.zoomAt(factor, vx, vy);
      },
      { passive: false }
    );

    // Click → Note
    this.svg.addEventListener("click", async (ev) => {
      if (this.dragging) return;
      const rect = this.svg.getBoundingClientRect();
      const vx = ev.clientX - rect.left;
      const vy = ev.clientY - rect.top;
      const s = this.store.state;
      const worldX = (vx - s.panX) / s.zoom;
      const worldY = (vy - s.panY) / s.zoom;
      const { q, r } = pixelToAxial({ x: worldX, y: worldY }, { size: s.hexSize });

      this.logger.debug("[HexView] hitTest", { q, r });
      this.store.set({ selected: { q, r } });

      try {
        await this.notes.createIfMissing(q, r, s.region ?? null, undefined);
        await this.notes.open(q, r);
        this.logger.info("[HexView] open", { q, r });
      } catch (err) {
        this.logger.error("[HexView] open-failed", { q, r, err });
      }
    });

    // Tooltip
    this.svg.addEventListener("mousemove", (ev) => {
      const rect = this.svg.getBoundingClientRect();
      const vx = ev.clientX - rect.left;
      const vy = ev.clientY - rect.top;
      const s = this.store.state;
      const worldX = (vx - s.panX) / s.zoom;
      const worldY = (vy - s.panY) / s.zoom;
      const { q, r } = pixelToAxial({ x: worldX, y: worldY }, { size: s.hexSize });

      this.tooltip.style.display = "block";
      this.tooltip.style.left = `${vx + 12}px`;
      this.tooltip.style.top = `${vy + 12}px`;
      this.tooltip.textContent = `(${q},${r})${s.region ? ` · ${s.region}` : ""}`;
    });
  }

  private redraw() {
    const s = this.store.state;
    this.world.setAttribute("transform", `translate(${s.panX},${s.panY}) scale(${s.zoom})`);
    this.drawSelection();
  }

  private drawGrid() {
    const s = this.store.state;
    this.logger.debug("[HexView] drawGrid", { cols: this.opts.cols, rows: this.opts.rows, hexSize: s.hexSize });

    for (let r = 0; r < this.opts.rows; r++) {
      for (let q = 0; q < this.opts.cols; q++) {
        const corners = polygonCorners({ q, r }, { size: s.hexSize });
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", corners.map((p) => `${p.x},${p.y}`).join(" "));
        poly.setAttribute("fill", this.opts.bg ?? "#ccc");
        poly.setAttribute("stroke", "#999");
        poly.setAttribute("stroke-width", "1");
        this.terrainLayer.appendChild(poly);
      }
    }
  }

  private drawSelection() {
    const s = this.store.state;
    this.selectionLayer.innerHTML = "";
    if (!s.selected) return;

    const corners = polygonCorners(s.selected, { size: s.hexSize });
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", corners.map((p) => `${p.x},${p.y}`).join(" "));
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "red");
    poly.setAttribute("stroke-width", "2");
    this.selectionLayer.appendChild(poly);
  }
}
