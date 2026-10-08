import type { AssetDefinition } from "../../assets";
import type { Session } from "../../session";
import {
  applyObjectSearch, clearObjectSearchText, enterObjectLibraryTab,
  newObjectLibraryState,
  resetObjectSearch, visibleObjectAssets, type ObjectLibraryState,
  type ObjectLibraryTab,
} from "./object-library";
import { objectPath, type ObjectTagDocument } from "./object-tags";

export interface ObjectLibraryPanelOptions {
  readonly assets: () => readonly AssetDefinition[];
  readonly tags: () => ObjectTagDocument;
  readonly assetUrl: (reference: string) => string;
  readonly selectedAsset: () => string | undefined;
  readonly selectAsset: (id: string) => void;
  readonly editTags: () => void;
}

/** A separate image gallery beside the Object Tool's placement controls. */
export class ObjectLibraryPanel {
  private state: ObjectLibraryState;
  private active = false;
  private observer?: IntersectionObserver;
  private gallery?: HTMLElement;
  private assets: readonly AssetDefinition[] = [];
  private tags: ObjectTagDocument = { tags: {}, sets: {} };

  constructor(private root: HTMLElement, private session: Session,
    private options: ObjectLibraryPanelOptions) {
    this.state = newObjectLibraryState(options.selectedAsset() ?? "");
    this.root.hidden = true;
  }

  show(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.root.hidden = !active;
    if (active) this.refresh();
    else { this.observer?.disconnect(); this.root.replaceChildren(); }
  }

  refresh(): void {
    if (!this.active) return;
    this.assets = this.options.assets().filter((asset) => asset.kind === "object")
      .sort((a, b) => {
        const ap = objectPath(a) ?? "", bp = objectPath(b) ?? "";
        const an = ap.startsWith("res://textures/") ? 0 : 1;
        const bn = bp.startsWith("res://textures/") ? 0 : 1;
        return an - bn || ap.localeCompare(bp, "en");
      });
    this.tags = this.options.tags();
    if (!this.options.selectedAsset() && this.assets.length)
      this.options.selectAsset(this.assets[0]!.id);
    this.render();
  }

  syncSelection(): void {
    if (!this.active) return;
    const selected = this.options.selectedAsset() ?? "";
    if (selected !== this.state.selectedId) {
      this.state = { ...this.state, selectedId: selected };
      this.refreshTileMarks();
    }
  }

  private render(): void {
    this.observer?.disconnect();
    this.root.replaceChildren();
    const document = this.root.ownerDocument;
    const heading = document.createElement("h2");
    heading.textContent = "Objektbibliothek";
    this.root.append(heading);
    const tabs = document.createElement("div");
    tabs.className = "dn-object-library-tabs";
    for (const [tab, label] of [["all", "All"], ["used", "Used"], ["tags", "Tags"]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(this.state.tab === tab));
      button.addEventListener("click", () => this.setTab(tab));
      tabs.append(button);
    }
    this.root.append(tabs);

    if (this.state.tab === "all") this.renderSearch();
    if (this.state.tab === "tags") this.renderTags();
    this.gallery = document.createElement("div");
    this.gallery.className = "dn-object-library-tiles";
    this.gallery.setAttribute("aria-label", "Objektkacheln");
    this.root.append(this.gallery);
    this.renderTiles();
  }

  private setTab(tab: ObjectLibraryTab): void {
    if (this.state.tab === tab) return;
    const usedIds = tab === "used"
      ? [...this.session.entities.values()]
          .filter((entity) => entity.kind === "object" && !!entity.assetId)
          .map((entity) => entity.kind === "object" ? entity.assetId! : "")
      : [];
    this.state = enterObjectLibraryTab(this.state, tab, usedIds);
    this.render();
  }

  private renderSearch(): void {
    const document = this.root.ownerDocument;
    const search = document.createElement("div");
    search.className = "dn-object-library-search";
    const label = document.createElement("label");
    label.textContent = "Search";
    const input = document.createElement("input");
    input.type = "text";
    input.value = this.state.text;
    input.setAttribute("aria-label", "Objektbibliothek durchsuchen");
    input.addEventListener("input", () => {
      this.state = { ...this.state, text: input.value };
      x.hidden = !input.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.state = applyObjectSearch(this.state);
      this.renderTiles();
    });
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.title = "Suchtext leeren";
    x.setAttribute("aria-label", "Suchtext leeren");
    x.hidden = !this.state.text;
    x.addEventListener("click", () => {
      this.state = clearObjectSearchText(this.state);
      input.value = ""; x.hidden = true; input.focus();
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "⌫";
    clear.title = "Suche zurücksetzen";
    clear.setAttribute("aria-label", "Suche zurücksetzen");
    clear.addEventListener("click", () => {
      this.state = resetObjectSearch(this.state);
      this.renderTiles();
    });
    label.append(input, x);
    search.append(label, clear);
    const precision = document.createElement("label");
    precision.className = "dn-object-library-precision";
    precision.textContent = "Fuzzy";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0.5";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = String(this.state.strictness);
    slider.setAttribute("aria-label", "Fuzzy/Exact");
    slider.addEventListener("input", () => {
      this.state = { ...this.state, strictness: Number(slider.value) };
    });
    precision.append(slider, document.createTextNode("Exact"));
    this.root.append(search, precision);
  }

  private renderTags(): void {
    const document = this.root.ownerDocument;
    const controls = document.createElement("div");
    controls.className = "dn-object-library-tag-controls";
    const label = document.createElement("label");
    label.textContent = "Tags";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Custom Set");
    const setNames = ["", ...Object.keys(this.tags.sets).sort((a, b) => a.localeCompare(b, "en"))];
    for (const name of setNames) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name || "Custom Set";
      select.append(option);
    }
    select.value = setNames.includes(this.state.set) ? this.state.set : "";
    select.addEventListener("change", () => {
      this.state = { ...this.state, set: select.value, tags: new Set() };
      this.render();
    });
    label.append(select);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Tags bearbeiten";
    edit.addEventListener("click", () => this.options.editTags());
    controls.append(label, edit);
    const list = document.createElement("div");
    list.className = "dn-object-library-tags";
    const names = this.state.set
      ? this.tags.sets[this.state.set] ?? [] : Object.keys(this.tags.tags);
    for (const name of [...names].sort((a, b) => a.localeCompare(b, "en"))) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.setAttribute("aria-pressed", String(this.state.tags.has(name)));
      button.addEventListener("click", () => {
        const selected = new Set(this.state.tags);
        if (selected.has(name)) selected.delete(name); else selected.add(name);
        this.state = { ...this.state, tags: selected };
        this.render();
      });
      list.append(button);
    }
    this.root.append(controls, list);
  }

  private renderTiles(): void {
    const gallery = this.gallery;
    if (!gallery) return;
    this.observer?.disconnect();
    gallery.replaceChildren();
    const visible = visibleObjectAssets(this.assets, this.tags, this.state);
    if (!visible.length) {
      const empty = gallery.ownerDocument.createElement("p");
      empty.textContent = "Keine Objekte";
      gallery.append(empty);
      return;
    }
    this.observer = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries, observer) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const image = entry.target as HTMLImageElement;
            image.src = this.options.assetUrl(image.dataset.assetId! + "\0image");
            observer.unobserve(image);
          }
        }, { root: gallery, rootMargin: "300px" }) : undefined;
    for (const asset of visible) {
      const button = gallery.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "dn-object-library-tile";
      button.title = asset.name;
      button.setAttribute("aria-label", asset.name);
      button.dataset.assetId = asset.id;
      button.setAttribute("aria-pressed", String(this.state.selectedId === asset.id));
      const image = gallery.ownerDocument.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.dataset.assetId = asset.id;
      button.append(image);
      button.addEventListener("click", () => {
        this.state = { ...this.state, selectedId: asset.id };
        this.options.selectAsset(asset.id);
        this.refreshTileMarks();
      });
      gallery.append(button);
      if (this.observer) this.observer.observe(image);
      else image.src = this.options.assetUrl(asset.id + "\0image");
    }
  }

  private refreshTileMarks(): void {
    for (const tile of this.gallery?.querySelectorAll<HTMLButtonElement>("button[data-asset-id]") ?? [])
      tile.setAttribute("aria-pressed", String(tile.dataset.assetId === this.state.selectedId));
  }
}
