import type { LiveAtlasSurface } from './live-hex-surface';
/** Move the one Atlas view and its real camera controls; never copy its model or renderer. */
export class LiveAtlasPortal implements LiveAtlasSurface {
  private homes: { node: HTMLElement; marker: Comment }[] = [];
  private extras: HTMLElement[] = [];
  get mounted() {
    return this.homes.length > 0;
  }
  constructor(
    private root: HTMLElement,
    private canvas: HTMLElement | SVGSVGElement,
    private visibility: (visible: boolean) => void,
    private zoom: (factor: number) => void,
    private context: (mounted: boolean) => void = () => {},
  ) {}
  mount(map: HTMLElement, navigation: HTMLElement, console: HTMLElement) {
    if (this.mounted) return;
    const move = (node: HTMLElement, to: HTMLElement) => {
      const marker = document.createComment('shared Atlas home');
      node.before(marker);
      this.homes.push({ node, marker });
      to.append(node);
    };
    move(this.root, map);
    this.root.dataset.liveSurface = 'true';
    const controls = this.root.querySelector<HTMLElement>(
      '.map-canvas-controls[data-canvas-for="campaign-map"]',
    );
    if (controls) move(controls, navigation);
    for (const id of ['atlas-to-party', 'atlas-overview']) {
      const button = document.getElementById(id);
      if (button) move(button, navigation);
    }
    const zoom = document.createElement('div');
    zoom.className = 'toolbar';
    zoom.id = 'live-atlas-zoom';
    for (const [text, factor] of [
      ['Vergrößern', 0.5],
      ['Verkleinern', 2],
    ] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.onclick = () => this.zoom(factor);
      zoom.append(b);
    }
    navigation.append(zoom);
    this.extras.push(zoom);
    const local = document.getElementById('atlas-local-console');
    if (local) {
      const details = document.createElement('details'),
        summary = document.createElement('summary');
      details.id = 'live-atlas-local-travel';
      summary.textContent = 'Lokale Wege und Innenräume';
      details.append(summary);
      console.append(details);
      this.extras.push(details);
      move(local, details);
      local.hidden = false;
      details.open = !!local.querySelector('[data-in-dungeon="true"]');
    }
    const status = document.getElementById('atlas-save-status');
    if (status) move(status, console);
    this.context(true);
  }
  show(visible: boolean) {
    if (this.mounted) this.visibility(visible);
  }
  focus() {
    this.canvas.focus({ preventScroll: true });
  }
  unmount() {
    if (!this.mounted) return;
    this.context(false);
    this.visibility(false);
    delete this.root.dataset.liveSurface;
    for (const { node, marker } of this.homes) {
      marker.before(node);
      marker.remove();
    }
    this.homes = [];
    for (const node of this.extras) node.remove();
    this.extras = [];
  }
}
