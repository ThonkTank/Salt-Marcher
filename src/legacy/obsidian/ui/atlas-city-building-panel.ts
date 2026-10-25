import { CityDraft } from "../../../features/city/draft";
import type { CityEdit } from "../../../features/city/edit";
import type { CitySource } from "../../../features/city/commands";
import { serializeCityDocument } from "../../../features/city/codec";
import { cityBuildingCenteredPose } from "../../../features/city/geometry";

/** Transient name input only; CitySource and the shared AtlasHistory own all city data. */
export class AtlasCityBuildingPanel {
  private draft?: CityDraft;
  private source?: CitySource;
  private buildingId?: string;
  private name = "";
  private originalName = "";
  private applying = false;
  private closed = false;
  private abort = new AbortController();
  private message?: HTMLElement;
  constructor(
    readonly host: HTMLElement,
    private access: {
      read(id: string): CitySource;
      assertCurrent(): void;
      assertInput(): void;
      changed(): void;
      save(): void;
      escape(event: KeyboardEvent): void;
    },
  ) {
    host.className = "dn-location-key dn-atlas-city-building";
    host.setAttribute("aria-label", "Haus bearbeiten");
    host.hidden = true;
    host.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") access.escape(event);
        event.stopPropagation();
        if (
          !event.isComposing &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          this.run(() => access.save());
        }
      },
      { signal: this.abort.signal },
    );
    host.addEventListener(
      "focusout",
      (event) => {
        if (event.relatedTarget && !host.contains(event.relatedTarget as Node))
          this.run(() => this.apply());
      },
      { signal: this.abort.signal },
    );
  }
  get dirty(): boolean {
    return !!this.draft && this.name !== this.originalName;
  }
  private run(action: () => unknown): void {
    try {
      if (this.closed) return;
      this.access.assertCurrent();
      this.access.assertInput();
      action();
    } catch (error) {
      if (this.message) this.message.textContent = String(error);
    }
  }
  show(ownerId: string, buildingId: string): void {
    if (this.applying || this.closed) return;
    this.access.assertCurrent();
    if (this.dirty) {
      if (this.draft!.before.id !== ownerId || this.buildingId !== buildingId)
        throw new Error("Hausname zuerst übernehmen oder verwerfen.");
      this.host.hidden = false;
      return;
    }
    const source = this.access.read(ownerId),
      current = source.read();
    if (
      this.source === source &&
      this.draft?.before.id === ownerId &&
      this.buildingId === buildingId &&
      this.draft.state === "editing" &&
      serializeCityDocument(this.draft.before) ===
        serializeCityDocument(current)
    ) {
      this.host.hidden = false;
      return;
    }
    this.reset(source, buildingId);
  }
  private reset(source: CitySource, buildingId: string): void {
    const next = new CityDraft(source);
    const building = next.before.buildings.find((b) => b.id === buildingId);
    if (!building) {
      next.cancel();
      throw new Error("Ausgewähltes Haus fehlt.");
    }
    const preserveFocus = this.source === source && this.buildingId === buildingId;
    this.draft?.cancel();
    this.draft = next;
    this.source = source;
    this.buildingId = buildingId;
    this.name = this.originalName = building.name;
    this.render(preserveFocus);
  }
  apply(): boolean {
    if (this.closed) throw new Error("Haus-Inspector ist geschlossen.");
    this.access.assertCurrent();
    if (!this.dirty) return false;
    return this.commit([
      { kind: "set-building-name", buildingId: this.buildingId!, name: this.name },
    ], "Gebäudename ändern");
  }
  private rotate(radians: number): void {
    if (this.dirty)
      throw new Error("Hausname zuerst übernehmen oder verwerfen, dann drehen.");
    const building = this.draft!.before.buildings.find(b => b.id === this.buildingId)!;
    this.commit([{
      kind: "set-building-pose", buildingId: building.id,
      ...cityBuildingCenteredPose(building, building.rotationRadians + radians),
    }], "Haus drehen");
    if (this.message) this.message.textContent = "Haus gedreht";
  }
  private commit(edits: readonly CityEdit[], label: string): boolean {
    const draft = this.draft!, buildingId = this.buildingId!;
    this.applying = true;
    try {
      draft.setEdits(edits);
      const changed = draft.apply(label);
      // Keep History notifications from rebuilding input during our own commit.
      this.reset(this.access.read(draft.before.id), buildingId);
      return changed;
    } catch (error) {
      if (this.message) this.message.textContent = String(error);
      throw error;
    } finally {
      this.applying = false;
    }
  }
  clear(): void {
    this.draft?.cancel();
    this.draft = undefined;
    this.source = undefined;
    this.buildingId = undefined;
    this.host.hidden = true;
    this.host.replaceChildren();
    delete this.host.dataset.buildingId;
    delete this.host.dataset.ownerId;
    delete this.host.dataset.pending;
    this.access.changed();
  }
  private pending(): void {
    this.host.dataset.pending = String(this.dirty);
    if (this.message)
      this.message.textContent = this.dirty
        ? "Hausname noch nicht übernommen"
        : "Hausname übernommen";
    this.access.changed();
  }
  private render(preserveFocus = false): void {
    const draft = this.draft!,
      buildingId = this.buildingId!,
      doc = this.host.ownerDocument;
    const focused = preserveFocus ? doc.activeElement : null,
      focusName = focused !== null && focused === this.host.querySelector("textarea"),
      focusAction = Array.from(this.host.querySelectorAll("button")).indexOf(focused as HTMLButtonElement);
    this.host.replaceChildren();
    this.host.hidden = false;
    this.host.dataset.ownerId = draft.before.id;
    this.host.dataset.buildingId = buildingId;
    const guard = () => {
      if (this.closed || this.draft !== draft || this.buildingId !== buildingId)
        throw new Error("Hausauswahl geändert. Aktuelle Eingabe verwenden.");
      this.access.assertCurrent();
    };
    const heading = doc.createElement("h3");
    heading.textContent = "Haus bearbeiten";
    const label = doc.createElement("label"),
      title = doc.createElement("span"),
      input = doc.createElement("textarea");
    title.textContent = "Gebäudename";
    input.setAttribute("aria-label", "Gebäudename");
    input.value = this.name;
    input.addEventListener("input", () =>
      this.run(() => {
        guard();
        this.name = input.value;
        this.pending();
      }),
    );
    label.append(title, input);
    this.host.append(heading, label);
    const actions = doc.createElement("div");
    for (const [text, action] of [
      ["Hausname übernehmen", () => this.apply()],
      [
        "Namenseingabe verwerfen",
        () => {
          this.reset(this.access.read(draft.before.id), buildingId);
        },
      ],
      ["Atlas speichern", () => this.access.save()],
      ["90° links drehen", () => this.rotate(-Math.PI / 2)],
      ["90° rechts drehen", () => this.rotate(Math.PI / 2)],
    ] as const) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", () =>
        this.run(() => {
          guard();
          action();
        }),
      );
      actions.append(button);
    }
    this.message = doc.createElement("p");
    this.message.setAttribute("role", "status");
    this.host.append(actions, this.message);
    this.pending();
    // Retain keyboard position only within the same house; never take map/toolbar focus.
    if (focusName) input.focus({ preventScroll: true });
    else if (focusAction >= 0)
      actions.querySelectorAll<HTMLButtonElement>("button")[focusAction]?.focus({ preventScroll: true });
  }
  destroy(): void {
    this.closed = true;
    this.abort.abort();
    this.draft?.cancel();
    this.draft = undefined;
    this.source = undefined;
    this.host.replaceChildren();
  }
}
