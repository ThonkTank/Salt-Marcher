import { App, Modal, Notice } from "obsidian";
import type { AssetDefinition } from "../assets";
import {
  addObjectSet, addObjectTag, assignObjectTag, assignTagToSet,
  copyObjectTags, removeObjectSet, removeObjectTag,
  type ObjectTagDocument,
} from "../features/objekte/object-tags";
import { indexObjectAssets, type ObjectAssetEntry } from "../features/objekte/object-library";
import { LazyObjectImages } from "../features/objekte/lazy-object-images";

export interface ObjectTagsModalOptions {
  readonly initialMode: "default" | "override";
  readonly onModeChange: (mode: "default" | "override") => void;
  readonly defaults: ObjectTagDocument;
  readonly override: ObjectTagDocument | null;
  readonly assets: readonly AssetDefinition[];
  readonly assetUrl: (id: string) => string;
  readonly save: (document: ObjectTagDocument) => Promise<void>;
}

/** Dungeondraft's Default/Override, Edit Tags/Edit Sets and explicit Save boundary. */
export class ObjectTagsModal extends Modal {
  private mode: "default" | "override";
  private selectedMode: "default" | "override";
  private section: "tags" | "sets" = "tags";
  private draft: ObjectTagDocument | null;
  private selectedTag = "";
  private selectedSet = "";
  private naming: "tag" | "set" | null = null;
  private confirmingOverride = false;
  private busy = false;
  private images?: LazyObjectImages;
  private readonly entries: readonly ObjectAssetEntry[];

  constructor(app: App, private options: ObjectTagsModalOptions) {
    super(app);
    this.draft = options.override ? copyObjectTags(options.override) : null;
    this.selectedMode = options.initialMode;
    this.mode = this.draft && this.selectedMode === "override" ? "override" : "default";
    this.entries = indexObjectAssets(options.assets);
  }

  onOpen(): void {
    this.modalEl.addClass("dn-object-tags-dialog");
    this.render();
  }
  onClose(): void {
    this.images?.disconnect();
    this.contentEl.empty();
  }

  private document(): ObjectTagDocument {
    return this.mode === "override" && this.draft
      ? this.draft : this.options.defaults;
  }

  private names(kind: "tags" | "sets"): string[] {
    return Object.keys(this.document()[kind]).sort((a, b) => a.localeCompare(b, "en"));
  }

  private button(parent: HTMLElement, label: string, click: () => void,
    disabled = false): HTMLButtonElement {
    const button = parent.createEl("button", { text: label });
    button.type = "button";
    button.disabled = disabled;
    button.addEventListener("click", click);
    return button;
  }

  private render(): void {
    this.images?.disconnect();
    this.images = undefined;
    this.setTitle("Objekt-Tags bearbeiten");
    this.contentEl.empty();
    this.contentEl.addClass("dn-object-tags-modal");
    if (this.confirmingOverride) { this.renderOverridePrompt(); return; }
    if (this.naming) { this.renderNamePrompt(); return; }

    const modes = this.contentEl.createDiv({ cls: "dn-object-tag-modes" });
    for (const [mode, label] of [["default", "Default"], ["override", "Override"]] as const) {
      const choice = modes.createEl("label");
      const radio = choice.createEl("input", { type: "radio" });
      radio.name = "object-tag-mode";
      radio.checked = this.selectedMode === mode;
      radio.addEventListener("change", () => {
        this.selectedMode = mode;
        this.options.onModeChange(mode);
        if (mode === "override" && !this.draft) this.confirmingOverride = true;
        else this.mode = mode;
        this.render();
      });
      choice.appendText(label);
    }
    const tabs = this.contentEl.createDiv({ cls: "dn-object-tag-tabs" });
    for (const [section, label] of [["tags", "Edit Tags"], ["sets", "Edit Sets"]] as const) {
      const button = this.button(tabs, label, () => {
        this.section = section; this.render();
      });
      button.setAttribute("aria-pressed", String(this.section === section));
    }
    const line = this.contentEl.createDiv({ cls: "dn-object-tag-select" });
    const names = this.names(this.section);
    let selected = this.section === "tags" ? this.selectedTag : this.selectedSet;
    if (!names.includes(selected)) selected = names[0] ?? "";
    if (this.section === "tags") this.selectedTag = selected;
    else this.selectedSet = selected;
    const label = line.createEl("label", { text: this.section === "tags" ? "Tags" : "Set" });
    const select = label.createEl("select");
    select.setAttribute("aria-label", this.section === "tags" ? "Tag wählen" : "Set wählen");
    for (const name of names) {
      const option = select.createEl("option", { text: name, value: name });
      option.selected = name === selected;
    }
    select.addEventListener("change", () => {
      if (this.section === "tags") this.selectedTag = select.value;
      else this.selectedSet = select.value;
      this.render();
    });
    this.button(line, "+", () => { this.naming = this.section === "tags" ? "tag" : "set"; this.render(); },
      this.mode !== "override" || this.busy).setAttribute("aria-label",
      this.section === "tags" ? "Tag hinzufügen" : "Set hinzufügen");
    this.button(line, "−", () => {
      if (!this.draft || !selected) return;
      const oldIndex = names.indexOf(selected);
      this.draft = this.section === "tags"
        ? removeObjectTag(this.draft, selected)
        : removeObjectSet(this.draft, selected);
      const remaining = this.names(this.section);
      const next = remaining[Math.min(oldIndex, remaining.length - 1)] ?? "";
      if (this.section === "tags") this.selectedTag = next;
      else this.selectedSet = next;
      this.render();
    }, this.mode !== "override" || !selected || this.busy).setAttribute("aria-label",
      this.section === "tags" ? "Tag entfernen" : "Set entfernen");

    if (this.section === "tags") this.renderObjects(selected);
    else this.renderSetTags(selected);

    const actions = this.contentEl.createDiv({ cls: "dn-object-tag-actions" });
    this.button(actions, "Save", () => void this.save(), this.mode !== "override" ||
      !this.draft || this.busy);
    this.button(actions, "Close", () => this.close());
  }

  private renderObjects(tag: string): void {
    const grid = this.contentEl.createDiv({ cls: "dn-object-tag-grid" });
    grid.setAttribute("aria-label", "Objektgitter-Zuordnung");
    this.images = new LazyObjectImages(grid, "250px", this.options.assetUrl);
    const members = new Set(this.document().tags[tag] ?? []);
    for (const { asset, path } of this.entries) {
      if (!path) continue;
      const button = this.button(grid, "", () => {
        if (!this.draft || this.mode !== "override") return;
        const enabled = !this.draft.tags[tag]?.includes(path);
        this.draft = assignObjectTag(this.draft, tag, path, enabled);
        button.setAttribute("aria-pressed", String(enabled));
      }, this.mode !== "override" || !tag || this.busy);
      button.className = "dn-object-tag-tile";
      button.title = asset.name;
      button.setAttribute("aria-label", asset.name);
      button.setAttribute("aria-pressed", String(members.has(path)));
      const image = button.createEl("img", { attr: { alt: "", loading: "lazy" } });
      this.images.observe(image, asset.id);
    }
  }

  private renderSetTags(set: string): void {
    const list = this.contentEl.createDiv({ cls: "dn-object-set-tags" });
    list.setAttribute("aria-label", "Tagliste für Set");
    const members = new Set(this.document().sets[set] ?? []);
    for (const tag of this.names("tags")) {
      const label = list.createEl("label");
      const input = label.createEl("input", { type: "checkbox" });
      input.checked = members.has(tag);
      input.disabled = this.mode !== "override" || !set || this.busy;
      input.addEventListener("change", () => {
        if (!this.draft) return;
        this.draft = assignTagToSet(this.draft, set, tag, input.checked);
      });
      label.appendText(tag);
    }
  }

  private renderOverridePrompt(): void {
    this.contentEl.createEl("h3", { text: "Create Tag Overrides" });
    this.contentEl.createEl("p", { text: "Standard-Tags als bearbeitbaren Bestand übernehmen?" });
    const actions = this.contentEl.createDiv({ cls: "dn-object-tag-actions" });
    const cancel = () => {
      this.confirmingOverride = false;
      this.mode = this.selectedMode = "default";
      this.options.onModeChange("default");
      this.render();
    };
    this.button(actions, "×", () => {
      this.confirmingOverride = false;
      this.mode = "default";
      this.render();
    }).setAttribute("aria-label", "Dialog schließen");
    this.button(actions, "Cancel", cancel);
    this.button(actions, "OK", () => {
      this.draft = copyObjectTags(this.options.defaults);
      this.mode = this.selectedMode = "override";
      this.confirmingOverride = false;
      this.render();
    });
  }

  private renderNamePrompt(): void {
    const kind = this.naming!;
    this.contentEl.createEl("h3", { text: "Edit Name" });
    const label = this.contentEl.createEl("label", { text: "Name" });
    const input = label.createEl("input", { type: "text" });
    input.setAttribute("aria-label", kind === "tag" ? "Tagname" : "Setname");
    const error = this.contentEl.createEl("p", { cls: "dn-object-tag-error" });
    const actions = this.contentEl.createDiv({ cls: "dn-object-tag-actions" });
    this.button(actions, "×", () => { this.naming = null; this.render(); })
      .setAttribute("aria-label", "Dialog schließen");
    const accept = () => {
      if (!this.draft) return;
      try {
        this.draft = kind === "tag"
          ? addObjectTag(this.draft, input.value)
          : addObjectSet(this.draft, input.value);
        if (kind === "tag") this.selectedTag = input.value;
        else this.selectedSet = input.value;
        this.naming = null;
        this.render();
      } catch (failure) { error.setText(String(failure)); }
    };
    this.button(actions, "Accept", accept);
    this.button(actions, "Cancel", () => { this.naming = null; this.render(); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); accept(); }
    });
    input.focus();
  }

  private async save(): Promise<void> {
    if (!this.draft || this.busy) return;
    this.busy = true;
    this.render();
    try {
      await this.options.save(this.draft);
      new Notice("Objekt-Tags gespeichert.");
    } catch (error) {
      new Notice("Objekt-Tags konnten nicht gespeichert werden: " + String(error), 10000);
    } finally {
      this.busy = false;
      this.render();
    }
  }
}
