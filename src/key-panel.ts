import { App, Component, MarkdownRenderer } from "obsidian";
import { Session } from "./session";
import {
  addMarkdownSection,
  editMarkdownSection,
  keySectionUrl,
  moveKeySection,
  removeMarkdownSection,
  sectionMarkdown,
  sectionTitle,
  structuredRoom,
} from "./room-key";

export class StructuredKeyPanel {
  private readonly root: HTMLElement;
  private readonly stop: () => void;
  private rendered?: Component;
  private selected?: string;
  private editor?: HTMLTextAreaElement;
  private original = "";
  private preview?: HTMLElement;
  private previewRevision = 0;
  private closed = false;

  constructor(
    private readonly app: App,
    host: HTMLElement,
    private readonly session: Session,
    private readonly mapPath: string,
    private readonly roomId: string,
    sectionId: string | undefined,
    private readonly notice: (message: string) => void,
    private readonly canLink: () => boolean,
    private anchor?: string,
  ) {
    this.root = host.createDiv({ cls: "dn-structured-key" });
    this.root.dataset.keyRoom = roomId;
    this.selected = sectionId;
    this.stop = session.subscribe((event) => {
      if (!this.closed && event.ids.has(roomId) && !this.dirty()) this.render();
    });
    this.render();
  }

  private dirty(): boolean {
    return !!this.editor && this.editor.value !== this.original;
  }

  commit(): boolean {
    if (!this.editor || !this.selected || !this.dirty()) return true;
    try {
      editMarkdownSection(this.session, this.roomId, this.selected, this.original, this.editor.value);
      this.original = this.editor.value;
      return true;
    } catch (error) {
      this.notice(String(error));
      return false;
    }
  }

  focus(sectionId?: string, anchor?: string): void {
    if (!this.commit()) return;
    this.selected = sectionId;
    this.anchor = anchor;
    this.render();
  }

  private button(parent: HTMLElement, label: string, action: () => void): HTMLButtonElement {
    const button = parent.createEl("button", { text: label });
    button.type = "button";
    button.addEventListener("click", action);
    return button;
  }

  private async renderMarkdown(markdown: string, host: HTMLElement, component: Component): Promise<void> {
    await MarkdownRenderer.render(this.app, markdown, host, this.mapPath, component);
  }

  private previewDraft(): void {
    if (!this.preview || !this.editor || !this.rendered) return;
    const revision = ++this.previewRevision;
    const markdown = this.editor.value;
    this.preview.replaceChildren();
    void this.renderMarkdown(markdown, this.preview, this.rendered).catch((error) => {
      if (revision === this.previewRevision) this.notice(String(error));
    });
  }

  private render(): void {
    if (this.closed) return;
    this.rendered?.unload();
    this.rendered = new Component();
    this.rendered.load();
    this.root.replaceChildren();
    const room = structuredRoom(this.session, this.roomId);
    if (!this.selected || !room.key.sections.some((section) => section.id === this.selected))
      this.selected = room.key.sections.find((section) => section.kind === "markdown")?.id ?? room.key.sections[0]?.id;
    if (!room.key.sourcePath) this.root.createEl("h1", { text: `${room.number} ${room.name}` });
    const navigation = this.root.createDiv({ cls: "dn-key-navigation" });
    for (const section of room.key.sections) {
      const entry = this.button(navigation, sectionTitle(this.session, section) || "Leerer Abschnitt", () => this.focus(section.id));
      if (section.id === this.selected) entry.setAttribute("aria-current", "true");
    }
    this.button(navigation, "+ Abschnitt", () => {
      if (!this.commit()) return;
      this.selected = addMarkdownSection(this.session, this.roomId, this.selected);
      this.render();
    });
    const content = this.root.createDiv({ cls: "dn-key-content" });
    const rendered: Promise<void>[] = [];
    for (const section of room.key.sections) {
      const block = content.createDiv({ cls: "dn-key-section" });
      block.dataset.keySection = section.id;
      rendered.push(this.renderMarkdown(sectionMarkdown(this.session, section), block, this.rendered));
    }
    const selectedId = this.selected, anchor = this.anchor;
    void Promise.all(rendered).then(() => {
      if (this.closed || selectedId !== this.selected || !selectedId) return;
      const block = this.root.querySelector<HTMLElement>(`[data-key-section="${CSS.escape(selectedId)}"]`);
      if (!block) return;
      const target = anchor ? block.querySelector<HTMLElement>(`#${CSS.escape(anchor.replace(/^\^/, ""))}, [data-heading="${CSS.escape(anchor)}"], [data-block-id="${CSS.escape(anchor.replace(/^\^/, ""))}"]`) : null;
      (target ?? block).scrollIntoView({ block: "nearest" });
    }).catch((error) => this.notice(String(error)));
    const selected = room.key.sections.find((section) => section.id === this.selected);
    if (!selected) return;
    const controls = this.root.createDiv({ cls: "dn-key-controls" });
    this.button(controls, "↑", () => {
      if (!this.commit()) return;
      moveKeySection(this.session, this.roomId, selected.id, -1);
      this.render();
    });
    this.button(controls, "↓", () => {
      if (!this.commit()) return;
      moveKeySection(this.session, this.roomId, selected.id, 1);
      this.render();
    });
    if (this.canLink()) this.button(controls, "Link kopieren", () => {
      void navigator.clipboard.writeText(keySectionUrl(this.session.id, room.id, selected.id, this.app.vault.getName()))
        .catch((error) => this.notice(String(error)));
    });
    if (selected.kind !== "markdown") {
      this.editor = undefined;
      this.root.createEl("p", { text: "Durchgangsdaten im Karteneditor bearbeiten." });
      return;
    }
    this.button(controls, "Entfernen", () => {
      if (!this.commit()) return;
      try {
        removeMarkdownSection(this.session, this.roomId, selected.id);
        this.selected = undefined;
        this.render();
      } catch (error) { this.notice(String(error)); }
    });
    this.original = selected.markdown;
    this.editor = this.root.createEl("textarea", { cls: "dn-key-markdown" });
    this.editor.setAttribute("aria-label", "Markdown-Abschnitt bearbeiten");
    this.editor.spellcheck = false;
    this.editor.value = selected.markdown;
    this.editor.addEventListener("input", () => this.previewDraft());
    this.editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.editor!.value = this.original;
        this.previewDraft();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (this.commit()) this.render();
      }
    });
    this.button(controls, "Übernehmen", () => { if (this.commit()) this.render(); });
    this.button(controls, "Verwerfen", () => {
      this.editor!.value = this.original;
      this.previewDraft();
    });
    this.preview = this.root.createDiv({ cls: "dn-key-preview" });
    this.previewDraft();
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.stop();
    this.rendered?.unload();
    this.root.remove();
  }
}
