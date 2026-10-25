import { AtlasRoomKeyDraft } from "../../../features/dungeon/atlas-room-key-draft";
import type { DungeonAtlasSource } from "../../../features/dungeon/atlas-source";

export class AtlasRoomKeyPanel {
  private draft?: AtlasRoomKeyDraft;
  private applying = false;
  private abort = new AbortController();
  private message?: HTMLElement;
  constructor(
    readonly host: HTMLElement,
    private access: {
      read(id: string): DungeonAtlasSource;
      changed(): void;
      save(): void;
      escape?(event: KeyboardEvent): void;
    },
  ) {
    host.className = "dn-location-key dn-atlas-room-key";
    host.setAttribute("aria-label", "Raum-Key");
    host.hidden = true;
    host.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") access.escape?.(e);
        e.stopPropagation();
        if (!e.isComposing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          access.save();
        }
      },
      { signal: this.abort.signal },
    );
    host.addEventListener(
      "focusout",
      (e) => {
        if (e.relatedTarget && !host.contains(e.relatedTarget as Node)) {
          try {
            this.apply();
          } catch (error) {
            if (this.message) this.message.textContent = String(error);
          }
        }
      },
      { signal: this.abort.signal },
    );
  }
  get dirty(): boolean {
    return this.draft?.dirty ?? false;
  }
  show(ownerId: string, roomId: string): void {
    if (this.applying) return;
    if (this.dirty) {
      if (this.draft?.source.id !== ownerId || this.draft.roomId !== roomId)
        throw new Error("Raum-Key zuerst übernehmen oder verwerfen.");
      return;
    }
    const source = this.access.read(ownerId);
    if (
      this.draft?.source === source &&
      this.draft.roomId === roomId &&
      this.draft.before === source.read().documentBytes
    )
      return;
    this.draft = new AtlasRoomKeyDraft(source, roomId);
    this.render();
  }
  apply(): boolean {
    if (!this.draft?.dirty) return false;
    const old = this.draft;
    this.applying = true;
    try {
      const changed = old.apply();
      this.draft = new AtlasRoomKeyDraft(old.source, old.roomId);
      this.pending();
      return changed;
    } catch (error) {
      if (this.message) this.message.textContent = String(error);
      throw error;
    } finally {
      this.applying = false;
    }
  }
  clear(): void {
    this.draft = undefined;
    this.host.hidden = true;
    this.host.replaceChildren();
    delete this.host.dataset.roomId;
    this.access.changed();
  }
  private pending(): void {
    this.host.dataset.pending = String(this.dirty);
    if (this.message)
      this.message.textContent = this.dirty
        ? "Text noch nicht übernommen"
        : "Raum-Key übernommen";
    this.access.changed();
  }
  private render(): void {
    const draft = this.draft!,
      doc = this.host.ownerDocument;
    this.host.replaceChildren();
    this.host.hidden = false;
    this.host.dataset.roomId = draft.roomId;
    this.host.dataset.ownerId = draft.source.id;
    const heading = doc.createElement("h3");
    heading.textContent = "Raum-Key";
    this.host.append(heading);
    const field = (
      name: string,
      value: string,
      set: (v: string) => void,
      multiline = false,
    ) => {
      const label = doc.createElement("label"),
        title = doc.createElement("span"),
        input = multiline
          ? doc.createElement("textarea")
          : doc.createElement("input");
      title.textContent = name;
      input.setAttribute("aria-label", name);
      input.value = value;
      input.addEventListener("input", () => {
        set(input.value);
        this.pending();
      });
      label.append(title, input);
      this.host.append(label);
    };
    field("Raumname", draft.name, (v) => (this.draft!.name = v));
    field("Raumnummer", draft.number, (v) => (this.draft!.number = v));
    for (const [index, s] of draft.room.key.sections.entries()) {
      if (s.kind === "markdown")
      {
        field(
          "Raumtext " + (index + 1),
          s.markdown,
          (v) => this.draft!.markdown.set(s.id, v),
          true,
        );
        this.host.lastElementChild!.setAttribute("data-section-id", s.id);
      }
      else {
        const p = doc.createElement("p");
        p.textContent = "Durchgang: " + s.doorId;
        this.host.append(p);
      }
    }
    const actions = doc.createElement("div");
    actions.className = "dn-location-key-actions";
    for (const [title, action] of [
      ["Übernehmen", () => this.apply()],
      [
        "Eingabe verwerfen",
        () => {
          this.draft = new AtlasRoomKeyDraft(draft.source, draft.roomId);
          this.render();
          this.access.changed();
        },
      ],
      ["Atlas speichern", () => this.access.save()],
    ] as const) {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = title;
      b.addEventListener("click", () => {
        try {
          action();
        } catch (error) {
          if (this.message) this.message.textContent = String(error);
        }
      });
      actions.append(b);
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
