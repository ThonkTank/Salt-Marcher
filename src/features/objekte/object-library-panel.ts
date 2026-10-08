import type { AssetDefinition } from "../../assets";
import type { Session } from "../../session";
import {
  applyObjectSearch, chooseObjectSet, chooseObjectTag, clearObjectSearchText, enterObjectLibraryTab,
  newObjectLibraryState, resetObjectSearch,
  sortedObjectAssetEntries, visibleObjectEntries, type ObjectAssetEntry,
  type ObjectLibraryState, type ObjectLibraryTab,
} from "./object-library";
import { type ObjectTagDocument } from "./object-tags";
import { LazyObjectImages } from "./lazy-object-images";

export interface ObjectLibraryPanelOptions {
  readonly assets: () => readonly AssetDefinition[];
  readonly tags: () => ObjectTagDocument;
  readonly assetUrl: (reference: string) => string;
  readonly selectedAsset: () => string | undefined;
  readonly selectAsset: (id: string) => void;
  readonly editTags: (sourceDocument: Document) => void;
}

/** A separate image gallery beside the Object Tool's placement controls. */
export class ObjectLibraryPanel {
  private state: ObjectLibraryState;
  private active = false;
  private images?: LazyObjectImages;
  private controlsHost?: HTMLElement;
  private gallery?: HTMLElement;
  private entries: readonly ObjectAssetEntry[] = [];
  private assetsDirty = true;
  private visibleIds: readonly string[] | null = null;
  private markedSelectedId = "";
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
    else {
      this.images?.disconnect();
      this.images = undefined;
      this.controlsHost = undefined;
      this.gallery = undefined;
      this.visibleIds = null;
      this.markedSelectedId = "";
      this.root.replaceChildren();
    }
  }

  refresh(): void {
    if (!this.active) return;
    if (this.assetsDirty) {
      this.entries = sortedObjectAssetEntries(this.options.assets());
      this.assetsDirty = false;
      this.visibleIds = null;
    }
    this.tags = this.options.tags();
    if (!this.options.selectedAsset() && this.entries.length)
      this.options.selectAsset(this.entries[0]!.asset.id);
    this.render();
  }

  refreshAssets(): void {
    this.assetsDirty = true;
    this.visibleIds = null;
    if (this.active) this.refresh();
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
    const document = this.root.ownerDocument;
    if (!this.controlsHost) {
      this.controlsHost = document.createElement("div");
      this.controlsHost.className = "dn-object-library-controls";
      this.gallery = document.createElement("div");
      this.gallery.className = "dn-object-library-tiles";
      this.gallery.setAttribute("aria-label", "Objektkacheln");
      this.root.replaceChildren(this.controlsHost, this.gallery);
    }
    this.controlsHost.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Objektbibliothek";
    this.controlsHost.append(heading);
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
    this.controlsHost.append(tabs);

    if (this.state.tab === "all") this.renderSearch();
    if (this.state.tab === "tags") this.renderTags();
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
    this.controlsHost!.append(search, precision);
  }

  private renderTags(): void {
    const document = this.root.ownerDocument;
    const controls = document.createElement("div");
    controls.className = "dn-object-library-tag-controls";
    const label = document.createElement("label");
    label.textContent = "Tags";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Custom Set");
    const setNames = ["", "---", ...Object.keys(this.tags.sets).sort((a, b) => a.localeCompare(b, "en"))];
    for (const name of setNames) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name || "Custom Set";
      option.hidden = !name;
      select.append(option);
    }
    select.value = setNames.includes(this.state.set) ? this.state.set : "";
    select.addEventListener("change", () => {
      this.state = chooseObjectSet(this.state, select.value, this.tags);
      this.render();
    });
    label.append(select);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Tags bearbeiten";
    edit.addEventListener("click", () => this.options.editTags(this.root.ownerDocument));
    controls.append(label, edit);
    const list = document.createElement("div");
    list.className = "dn-object-library-tags";
    const names = Object.keys(this.tags.tags);
    for (const name of [...names].sort((a, b) => a.localeCompare(b, "en"))) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.setAttribute("aria-pressed", String(this.state.tags.has(name)));
      button.addEventListener("click", (event) => {
        this.state = chooseObjectTag(this.state, name, event.ctrlKey);
        this.render();
      });
      list.append(button);
    }
    this.controlsHost!.append(controls, list);
  }

  private renderTiles(): void {
    const gallery = this.gallery;
    if (!gallery) return;
    const visible = visibleObjectEntries(this.entries, this.tags, this.state);
    const ids = visible.map((entry) => entry.asset.id);
    if (this.visibleIds && ids.length === this.visibleIds.length &&
        ids.every((id, index) => id === this.visibleIds![index])) {
      if (this.markedSelectedId !== this.state.selectedId) this.refreshTileMarks();
      return;
    }
    this.images?.disconnect();
    this.images = undefined;
    gallery.replaceChildren();
    gallery.scrollTop = 0;
    this.visibleIds = ids;
    this.markedSelectedId = this.state.selectedId;
    if (!visible.length) {
      const empty = gallery.ownerDocument.createElement("p");
      empty.textContent = "Keine Objekte";
      gallery.append(empty);
      return;
    }
    this.images = new LazyObjectImages(gallery, "300px",
      (id) => this.options.assetUrl(id + "\0image"));
    for (const { asset } of visible) {
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
      button.append(image);
      button.addEventListener("click", () => {
        this.state = { ...this.state, selectedId: asset.id };
        this.options.selectAsset(asset.id);
        this.refreshTileMarks();
      });
      gallery.append(button);
      this.images.observe(image, asset.id);
    }
  }

  private refreshTileMarks(): void {
    for (const tile of this.gallery?.querySelectorAll<HTMLButtonElement>("button[data-asset-id]") ?? [])
      tile.setAttribute("aria-pressed", String(tile.dataset.assetId === this.state.selectedId));
    this.markedSelectedId = this.state.selectedId;
  }
}
