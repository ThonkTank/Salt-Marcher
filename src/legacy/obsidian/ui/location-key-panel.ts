import { LocationKeyDraft } from "../../../features/location/location-key-draft";
import type { LocationDocument } from "../../../features/location/location-schema";

export interface LocationKeyPanelAccess {
  read(id: string): LocationDocument | null;
  edit(document: LocationDocument): boolean;
  changed(): void;
  save(): void;
  escape?(event: KeyboardEvent): void;
  markdown?(host: HTMLElement, text: string, id: string): Promise<void>;
}
export class LocationKeyPanel {
  private draft?: LocationKeyDraft;
  private applying = false;
  private abort = new AbortController();
  private message?: HTMLParagraphElement;
  constructor(
    readonly host: HTMLElement,
    private access: LocationKeyPanelAccess,
  ) {
    host.className = "dn-location-key";
    host.setAttribute("aria-label", "Orts-Key");
    host.hidden = true;
    host.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") this.access.escape?.(event);
        event.stopPropagation();
        if (
          !event.isComposing &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          this.access.save();
        }
      },
      { signal: this.abort.signal },
    );
    host.addEventListener(
      "focusout",
      (event) => {
        if (!event.relatedTarget || host.contains(event.relatedTarget as Node))
          return;
        try {
          this.apply();
        } catch (error) {
          this.error(error);
        }
      },
      { signal: this.abort.signal },
    );
  }
  get dirty(): boolean {
    return this.draft?.dirty ?? false;
  }
  get id(): string | undefined {
    return this.draft?.id;
  }
  show(document: LocationDocument): void {
    if (this.draft?.id !== document.id && this.dirty)
      throw new Error(
        "Den eingegebenen Orts-Key zuerst übernehmen oder verwerfen.",
      );
    if (this.applying || (this.draft?.id === document.id && this.dirty)) return;
    if (this.draft?.id === document.id && this.draft.matches(document)) return;
    this.draft = new LocationKeyDraft(document);
    this.host.hidden = false;
    this.render();
  }
  clear(): void {
    this.draft = undefined;
    this.host.hidden = true;
    this.host.replaceChildren();
    delete this.host.dataset.locationId;
    delete this.host.dataset.pending;
    this.access.changed();
  }
  apply(): boolean {
    if (!this.draft?.dirty) return false;
    this.applying = true;
    try {
      const changed = this.draft.apply(this.access.read(this.draft.id), (doc) =>
        this.access.edit(doc),
      );
      this.pending();
      return changed;
    } finally {
      this.applying = false;
    }
  }
  focusName(): void {
    this.host
      .querySelector<HTMLInputElement>('[aria-label="Ortsname"]')
      ?.focus();
  }
  private error(error: unknown): void {
    if (this.message) this.message.textContent = String(error);
    this.access.changed();
  }
  private pending(): void {
    this.host.dataset.pending = String(this.dirty);
    if (this.message)
      this.message.textContent = this.dirty
        ? "Text noch nicht übernommen"
        : "Orts-Key übernommen";
    this.access.changed();
  }
  private render(): void {
    const draft = this.draft!;
    const doc = this.host.ownerDocument;
    this.host.replaceChildren();
    this.host.dataset.locationId = draft.id;
    const heading = doc.createElement("h3");
    heading.textContent = "Orts-Key";
    this.host.append(heading);
    const field = (label: string, input: HTMLElement) => {
      const wrapper = doc.createElement("label"),
        title = doc.createElement("span");
      title.textContent = label;
      input.setAttribute("aria-label", label);
      wrapper.append(title, input);
      this.host.append(wrapper);
    };
    const name = doc.createElement("input");
    name.type = "text";
    name.maxLength = 200;
    name.value = draft.name;
    name.addEventListener("input", () => {
      draft.name = name.value;
      this.pending();
    });
    field("Ortsname", name);
    const type = doc.createElement("select");
    for (const [value, label] of [
      ["city", "Stadt"],
      ["poi", "POI"],
    ]) {
      const option = doc.createElement("option");
      option.value = value!;
      option.textContent = label!;
      option.selected = value === draft.type;
      type.append(option);
    }
    type.addEventListener("change", () => {
      draft.type = type.value as "city" | "poi";
      this.pending();
    });
    field("Ortstyp", type);
    for (const [index, section] of draft.sections.entries()) {
      const group = doc.createElement("section");
      group.dataset.sectionId = section.id;
      const title = doc.createElement("input");
      title.type = "text";
      title.value = section.title;
      title.setAttribute("aria-label", `Abschnitt ${index + 1}: Titel`);
      title.addEventListener("input", () => {
        draft.section(section.id, "title", title.value);
        this.pending();
      });
      const row = doc.createElement("div");
      row.className = "dn-location-section-heading";
      row.append(title);
      for (const [direction, text, label] of [
        [-1, "↑", "Abschnitt nach oben"],
        [1, "↓", "Abschnitt nach unten"],
      ] as const) {
        const button = doc.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.setAttribute("aria-label", label);
        button.disabled =
          direction < 0 ? index === 0 : index === draft.sections.length - 1;
        button.addEventListener("click", () => {
          draft.move(section.id, direction);
          this.render();
          this.pending();
        });
        row.append(button);
      }
      const text = doc.createElement("textarea");
      text.value = section.markdown;
      text.rows = 6;
      text.setAttribute("aria-label", `Abschnitt ${index + 1}: Markdown`);
      // Only an actual input updates this section: untouched CRLF bytes are never read back from the DOM.
      text.addEventListener("input", () => {
        draft.section(section.id, "markdown", text.value);
        this.pending();
      });
      group.append(row, text);
      if (this.access.markdown) {
        const preview = doc.createElement("details"),
          summary = doc.createElement("summary"),
          body = doc.createElement("div");
        summary.textContent = "Vorschau";
        preview.append(summary, body);
        preview.addEventListener("toggle", () => {
          if (!preview.open) return;
          body.replaceChildren();
          const value = draft.sections.find(
            (s) => s.id === section.id,
          )!.markdown;
          void this.access.markdown!(body, value, draft.id).catch((error) => {
            body.textContent = String(error);
          });
        });
        group.append(preview);
      }
      this.host.append(group);
    }
    const actions = doc.createElement("div");
    actions.className = "dn-location-key-actions";
    for (const [label, action] of [
      ["Übernehmen", () => this.apply()],
      [
        "Text verwerfen",
        () => {
          const current = this.access.read(draft.id);
          if (!current)
            throw new Error("Ort fehlt. Der eingegebene Text bleibt erhalten.");
          this.draft = new LocationKeyDraft(current);
          this.render();
          this.pending();
        },
      ],
    ] as const) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        try {
          action();
        } catch (error) {
          this.error(error);
        }
      });
      actions.append(button);
    }
    this.message = doc.createElement("p");
    this.message.setAttribute("role", "status");
    this.host.append(actions, this.message);
    this.pending();
  }
  destroy(): void {
    this.abort.abort();
    this.host.replaceChildren();
  }
}
