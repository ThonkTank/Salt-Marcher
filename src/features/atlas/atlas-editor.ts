import { AtlasRenderer } from "./atlas-renderer";
import { hexAddressKey, hexAt } from "./hex";
import type { OverworldDocument, WorldPoint } from "./overworld";

export class AtlasEditor {
  readonly renderer: AtlasRenderer;
  readonly viewport: HTMLDivElement;
  private abort = new AbortController();
  private selection: HTMLParagraphElement;
  private scale: HTMLSpanElement;
  private space = false;
  private tool: "select" | "hand" = "select";
  private pointer?: { id: number; button: number; x: number; y: number; startX: number; startY: number; moved: boolean };
  constructor(private root: HTMLElement, world: OverworldDocument) {
    root.replaceChildren(); root.classList.add("dn-atlas"); root.dataset.worldId = world.id;
    const doc = root.ownerDocument, toolbar = doc.createElement("div"); toolbar.className = "dn-atlas-toolbar";
    const title = doc.createElement("strong"); title.textContent = world.name;
    toolbar.append(title);
    const button = (text: string, label: string, action: () => void) => {
      const b = doc.createElement("button"); b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label);
      b.addEventListener("click", action, { signal: this.abort.signal }); toolbar.append(b); return b;
    };
    const select = button("Auswahl", "Hex auswählen", () => choose("select"));
    const hand = button("Hand", "Karte verschieben", () => choose("hand"));
    const choose = (tool: "select" | "hand") => {
      this.tool = tool; select.setAttribute("aria-pressed", String(tool === "select")); hand.setAttribute("aria-pressed", String(tool === "hand"));
      this.viewport.classList.toggle("is-hand", tool === "hand");
    };
    button("−", "Atlas verkleinern", () => this.zoom(1.25)); button("+", "Atlas vergrößern", () => this.zoom(0.8));
    button("Einpassen", "Atlasinhalt einpassen", () => this.renderer.fit());
    this.scale = doc.createElement("span"); this.scale.className = "dn-atlas-scale"; toolbar.append(this.scale);
    this.viewport = doc.createElement("div"); this.viewport.className = "dn-atlas-viewport"; this.viewport.tabIndex = 0;
    this.viewport.setAttribute("aria-label", "Atlas: Hex auswählen; Mitte oder Leertaste ziehen; Strg und Mausrad zoomen");
    const footer = doc.createElement("div"); footer.className = "dn-atlas-footer";
    this.selection = doc.createElement("p"); this.selection.className = "dn-atlas-selection"; this.selection.setAttribute("role", "status");
    this.selection.textContent = "Ein Hex anklicken, um seine Adresse zu sehen.";
    const hint = doc.createElement("small"); hint.textContent = "Mitte oder Leertaste ziehen verschiebt. Strg + Mausrad zoomt.";
    footer.append(this.selection, hint); root.append(toolbar, this.viewport, footer);
    this.renderer = new AtlasRenderer(this.viewport, world, () => {
      this.scale.textContent = `${Number(this.viewport.dataset.hexMiles).toLocaleString("de-DE")} Meilen pro Hex`;
    });
    choose("select"); this.bind();
  }
  async init(): Promise<void> { await this.renderer.init(); }
  private local(event: MouseEvent): WorldPoint {
    const r = this.viewport.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  private zoom(factor: number): void {
    this.renderer.zoom({ x: this.viewport.clientWidth / 2, y: this.viewport.clientHeight / 2 }, factor);
  }
  private bind(): void {
    const opts = { signal: this.abort.signal }, win = this.root.ownerDocument.defaultView!;
    this.viewport.addEventListener("pointerdown", e => {
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault(); this.viewport.focus(); this.viewport.setPointerCapture(e.pointerId);
      this.pointer = { id: e.pointerId, button: e.button, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    }, opts);
    win.addEventListener("pointermove", e => {
      const p = this.pointer; if (!p || p.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 3) p.moved = true;
      if (p.button === 1 || this.space || this.tool === "hand") this.renderer.pan(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    }, opts);
    win.addEventListener("pointerup", e => {
      const p = this.pointer; if (!p || p.id !== e.pointerId) return;
      if (!p.moved && p.button === 0 && !this.space && this.tool === "select") {
        const a = hexAt(this.renderer.world, this.renderer.worldPoint(this.local(e)), this.renderer.level);
        this.renderer.selected = a; this.renderer.schedule();
        this.selection.textContent = `${3 * 3 ** a.level} Meilen: Hex ${a.q}, ${a.r}`;
        this.selection.dataset.hexAddress = hexAddressKey(a); this.selection.dataset.hexQ = String(a.q); this.selection.dataset.hexR = String(a.r);
      }
      if (this.viewport.hasPointerCapture(p.id)) this.viewport.releasePointerCapture(p.id); this.pointer = undefined;
    }, opts);
    const cancel = () => { this.pointer = undefined; this.space = false; };
    win.addEventListener("pointercancel", cancel, opts); win.addEventListener("blur", cancel, opts);
    win.addEventListener("keydown", e => {
      if (this.root.ownerDocument.activeElement !== this.viewport) return;
      if (e.code === "Space") { this.space = true; e.preventDefault(); }
      if (e.key === "+" || e.key === "=") { this.zoom(0.8); e.preventDefault(); }
      if (e.key === "-") { this.zoom(1.25); e.preventDefault(); }
    }, opts);
    win.addEventListener("keyup", e => { if (e.code === "Space") this.space = false; }, opts);
    this.viewport.addEventListener("wheel", e => {
      if (!e.ctrlKey) return; e.preventDefault(); this.renderer.zoom(this.local(e), Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.002))));
    }, { ...opts, passive: false });
    this.viewport.addEventListener("contextmenu", e => e.preventDefault(), opts);
  }
  destroy(): void { this.abort.abort(); this.renderer.destroy(); this.root.classList.remove("dn-atlas"); delete this.root.dataset.worldId; }
}
