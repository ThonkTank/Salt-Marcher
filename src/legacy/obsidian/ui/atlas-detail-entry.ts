import type { AtlasNavigationTarget } from "../../../features/atlas/atlas-campaign-navigation";

export interface AtlasDetailEntryItem {
  readonly label: string;
  readonly description?: string;
  readonly target: Readonly<AtlasNavigationTarget>;
  readonly unavailableReason?: string;
}

export interface AtlasDetailEntryModel {
  readonly locationName: string;
  readonly entries: readonly AtlasDetailEntryItem[];
  readonly blockedReason?: string;
  readonly dungeonBindings?: readonly {
    readonly placementId: string;
    readonly label: string;
    readonly description: string;
  }[];
}

let nextPanelId = 0;

/** A projection of host-confirmed targets. Navigation and all editor state stay with the host. */
export class AtlasDetailEntry {
  private readonly root: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly reset: HTMLButtonElement;
  private readonly list: HTMLElement;
  private readonly status: HTMLElement;
  private readonly bindingList: HTMLElement;
  private readonly panelId = `dn-atlas-detail-entry-${++nextPanelId}`;
  private readonly onNavigate: (target: Readonly<AtlasNavigationTarget>) => void | Promise<void>;
  private readonly onBindDungeon?: (placementId: string) => void | Promise<void>;
  private readonly stop = (event: Event): void => event.stopPropagation();
  private readonly isolatedEvents = [
    "keydown", "keyup", "pointerdown", "pointermove", "pointerup",
    "pointercancel", "click", "dblclick", "contextmenu", "wheel",
  ];
  private model: AtlasDetailEntryModel = { locationName: "", entries: [] };
  private buttons: { button: HTMLButtonElement; unavailable: boolean; click: () => void }[] = [];
  private version = 0;
  private pending?: { label: string; verb: string };
  private error = "";
  private closed = false;
  private visibleCount = 0;

  constructor(
    host: HTMLElement,
    access: {
      onNavigate(target: Readonly<AtlasNavigationTarget>): void | Promise<void>;
      onBindDungeon?(placementId: string): void | Promise<void>;
    },
  ) {
    this.onNavigate = access.onNavigate;
    this.onBindDungeon = access.onBindDungeon;
    const doc = host.ownerDocument;
    this.root = doc.createElement("section");
    this.root.className = "dn-atlas-detail-entry";
    this.heading = doc.createElement("h3");
    this.heading.id = `${this.panelId}-heading`;
    this.root.setAttribute("aria-labelledby", this.heading.id);
    const label = doc.createElement("label");
    const caption = doc.createElement("span");
    caption.textContent = "Ziel suchen";
    this.search = doc.createElement("input");
    this.search.type = "search";
    this.search.autocomplete = "off";
    this.search.placeholder = "Stadtplan, Haus oder Raum";
    label.append(caption, this.search);
    this.reset = doc.createElement("button");
    this.reset.type = "button";
    this.reset.textContent = "Suche zurücksetzen";
    this.list = doc.createElement("ul");
    this.bindingList = doc.createElement("div");
    this.bindingList.className = "dn-atlas-dungeon-bindings";
    this.status = doc.createElement("p");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.root.append(this.heading, label, this.reset, this.list, this.bindingList, this.status);
    host.append(this.root);
    this.search.addEventListener("input", this.filter);
    this.reset.addEventListener("click", this.clearFilter);
    for (const name of this.isolatedEvents) this.root.addEventListener(name, this.stop);
    this.update(this.model);
  }

  /** Every host update revokes old rows and pending UI responses, never a host operation. */
  update(model: AtlasDetailEntryModel): void {
    if (this.closed) return;
    const entries = model.entries.map((entry) => Object.freeze({
      label: entry.label,
      description: entry.description,
      unavailableReason: entry.unavailableReason,
      target: Object.freeze({
        kind: entry.target.kind,
        documentId: entry.target.documentId,
        recordId: entry.target.recordId,
        roomId: entry.target.roomId,
      }),
    }));
    this.model = Object.freeze({
      locationName: model.locationName,
      entries: Object.freeze(entries),
      blockedReason: model.blockedReason,
      dungeonBindings: Object.freeze((model.dungeonBindings ?? []).map((binding) => Object.freeze({ ...binding }))),
    });
    this.version++;
    this.pending = undefined;
    this.error = "";
    this.heading.textContent = model.locationName ? `Ziele in ${model.locationName}` : "Ziele im Ort";
    this.renderList();
  }

  private readonly filter = (): void => {
    if (!this.closed) this.renderList();
  };

  private readonly clearFilter = (): void => {
    if (this.closed) return;
    this.search.value = "";
    this.renderList();
    this.search.focus();
  };

  private renderList(): void {
    const query = this.search.value.trim().normalize("NFKC").toLocaleLowerCase();
    const entries = this.model.entries.filter((entry) =>
      !query || `${entry.label} ${entry.description ?? ""}`.normalize("NFKC").toLocaleLowerCase().includes(query),
    );
    this.clearRows();
    this.visibleCount = entries.length;
    this.reset.hidden = !this.search.value;
    const version = this.version;
    entries.forEach((entry, index) => {
      const doc = this.root.ownerDocument;
      const row = doc.createElement("li");
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = entry.label;
      row.append(button);
      const detail = [entry.description, entry.unavailableReason].filter(Boolean).join(". ");
      if (detail) {
        const description = doc.createElement("p");
        description.id = `${this.panelId}-${version}-${index}`;
        description.textContent = detail;
        button.setAttribute("aria-describedby", description.id);
        row.append(description);
      }
      const click = (): void => {
        if (this.closed || version !== this.version || !this.list.contains(button) || button.disabled) return;
        this.navigate(entry, version);
      };
      button.addEventListener("click", click);
      this.buttons.push({ button, unavailable: !!entry.unavailableReason, click });
      this.list.append(row);
    });
    this.bindingList.replaceChildren();
    const bindings = this.onBindDungeon ? this.model.dungeonBindings ?? [] : [];
    if (bindings.length) {
      const doc = this.root.ownerDocument,
        heading = doc.createElement("h4"),
        hint = doc.createElement("p"),
        list = doc.createElement("ul");
      heading.textContent = "Vorhandenen Dungeon hier verorten";
      hint.textContent = "Verschiebt die vorhandene Karte zu diesem Ort. Rückgängig stellt ihre bisherige Position wieder her.";
      this.bindingList.append(heading, hint, list);
      for (const [index, binding] of bindings.entries()) {
        const row = doc.createElement("li"), button = doc.createElement("button"), description = doc.createElement("p");
        button.type = "button";
        button.textContent = `Hier verorten: ${binding.label}`;
        description.textContent = binding.description;
        description.id = `${this.panelId}-binding-${version}-${index}`;
        button.setAttribute("aria-describedby", description.id);
        const click = (): void => {
          if (this.closed || version !== this.version || !this.bindingList.contains(button) || button.disabled) return;
          this.perform(binding.label, version, () => this.onBindDungeon!(binding.placementId), "Verorte");
        };
        button.addEventListener("click", click);
        this.buttons.push({ button, unavailable: false, click });
        row.append(button, description); list.append(row);
      }
    }
    this.refreshActions();
  }

  private clearRows(): void {
    for (const { button, click } of this.buttons) button.removeEventListener("click", click);
    this.buttons = [];
    this.list.replaceChildren();
  }

  private refreshActions(): void {
    for (const { button, unavailable } of this.buttons)
      button.disabled = unavailable || !!this.model.blockedReason || !!this.pending;
    this.root.setAttribute("aria-busy", String(!!this.pending));
    this.status.textContent = this.pending ? `${this.pending.verb} ${this.pending.label} …`
      : this.error || this.model.blockedReason || (this.model.entries.length === 0
        ? "Für diesen Ort sind keine Ziele verfügbar."
        : this.visibleCount === 0 ? "Keine passenden Ziele. Suche zurücksetzen oder ändern."
        : `${this.visibleCount} ${this.visibleCount === 1 ? "Ziel" : "Ziele"}`);
  }

  private navigate(entry: AtlasDetailEntryItem, version: number): void {
    this.perform(entry.label, version, () => this.onNavigate(entry.target));
  }
  private perform(label: string, version: number, action: () => void | Promise<void>, verb = "Öffne"): void {
    const pending = { label, verb };
    this.pending = pending;
    this.error = "";
    this.refreshActions();
    const finish = (failed: boolean, error?: unknown): void => {
      if (this.closed || version !== this.version || this.pending !== pending) return;
      this.pending = undefined;
      if (failed)
        this.error = `Aktion konnte nicht abgeschlossen werden. ${error instanceof Error ? error.message : error == null ? "Bitte erneut versuchen." : String(error)}`;
      this.refreshActions();
    };
    try {
      Promise.resolve(action()).then(() => finish(false), (error: unknown) => finish(true, error));
    } catch (error) {
      finish(true, error);
    }
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.version++;
    this.pending = undefined;
    this.search.removeEventListener("input", this.filter);
    this.reset.removeEventListener("click", this.clearFilter);
    for (const name of this.isolatedEvents) this.root.removeEventListener(name, this.stop);
    this.clearRows();
    this.root.replaceChildren();
    this.root.remove();
  }
}
