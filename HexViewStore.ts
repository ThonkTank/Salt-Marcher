// HexViewStore.ts
// Minimaler Store für HexView-Zustand (Pan, Zoom, Selection)

export interface HexViewState {
  zoom: number;
  panX: number;
  panY: number;
  hexSize: number;
  selected?: { q: number; r: number } | null;
  region?: string | null;
}

type Listener = (s: HexViewState) => void;

export class HexViewStore {
  private s: HexViewState;
  private listeners: Set<Listener> = new Set();

  constructor(initial: Partial<HexViewState> = {}) {
    this.s = {
      zoom: 1,
      panX: 0,
      panY: 0,
      hexSize: 30,
      selected: null,
      region: null,
      ...initial,
    };
    console.debug("[HexViewStore] init", this.s);
  }

  get state(): HexViewState {
    return this.s;
  }

  set(patch: Partial<HexViewState>): void {
    const before = this.s;
    this.s = { ...this.s, ...patch };
    console.debug("[HexViewStore] set", { patch, next: this.s, before });
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.s);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) {
      try {
        fn(this.s);
      } catch (e) {
        console.error("[HexViewStore] listener error", e);
      }
    }
  }

  zoomAt(factor: number, viewportX: number, viewportY: number): { oldZoom: number; newZoom: number } {
    const { zoom, panX, panY } = this.s;

    const worldX = (viewportX - panX) / zoom;
    const worldY = (viewportY - panY) / zoom;

    const oldZoom = zoom;
    const newZoom = Math.max(0.1, Math.min(6, oldZoom * factor));

    const newPanX = viewportX - worldX * newZoom;
    const newPanY = viewportY - worldY * newZoom;

    this.set({ zoom: newZoom, panX: newPanX, panY: newPanY });
    console.debug("[HexViewStore] zoomAt", { factor, viewportX, viewportY, oldZoom, newZoom });
    return { oldZoom, newZoom };
  }
}
