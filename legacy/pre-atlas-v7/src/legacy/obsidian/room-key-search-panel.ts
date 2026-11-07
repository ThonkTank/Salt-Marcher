import {
  roomKeySearchTargetExists,
  searchRoomKeys,
  type RoomKeySearchEntry,
  type RoomKeySearchTarget,
} from "../../room-key-search";
import type { Session } from "../../session";

export type RoomKeySearchActivation = "activated" | "blocked" | "stale";

export interface RoomKeySearchPanelActions {
  activate(target: RoomKeySearchTarget):
    RoomKeySearchActivation | Promise<RoomKeySearchActivation>;
}

function roomLabel(entry: RoomKeySearchEntry): string {
  const name = entry.roomName.trim() ? ` – ${entry.roomName}` : "";
  return `Raum ${entry.roomNumber}${name} · ${entry.floorName}`;
}

/** Transient DOM adapter over the canonical, host-neutral room-key projection. */
export class RoomKeySearchPanel {
  private readonly input: HTMLInputElement;
  private readonly clearButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly results: HTMLElement;
  private readonly stop: () => void;
  private closed = false;
  private message = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly session: Session,
    private readonly actions: RoomKeySearchPanelActions,
  ) {
    root.classList.add("dn-room-key-search");
    const label = root.ownerDocument.createElement("label");
    label.className = "dn-room-key-search-label";
    label.textContent = "Raum-Keys durchsuchen";
    this.input = root.ownerDocument.createElement("input");
    this.input.type = "search";
    this.input.autocomplete = "off";
    this.input.value = "";
    this.input.placeholder = "Begriff im Raum-Key";
    this.input.setAttribute("aria-label", "Raum-Keys durchsuchen");
    label.append(this.input);
    this.clearButton = root.ownerDocument.createElement("button");
    this.clearButton.type = "button";
    this.clearButton.textContent = "Leeren";
    this.clearButton.setAttribute("aria-label", "Raum-Key-Suche leeren");
    this.status = root.ownerDocument.createElement("p");
    this.status.className = "dn-room-key-search-status";
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.results = root.ownerDocument.createElement("div");
    this.results.className = "dn-room-key-search-results";
    root.append(label, this.clearButton, this.status, this.results);

    this.input.addEventListener("input", () => {
      this.message = "";
      this.render();
    });
    this.clearButton.addEventListener("click", () => {
      this.input.value = "";
      this.message = "";
      this.render();
      this.input.focus();
    });
    this.stop = session.subscribe((event) => {
      if (!this.closed && (event.floors || event.content || event.ids.size))
        this.render();
    });
    this.render();
  }

  focus(): void {
    this.input.focus();
  }

  private async activate(entry: RoomKeySearchEntry): Promise<void> {
    if (!roomKeySearchTargetExists(this.session, entry)) {
      this.message = "Dieser Treffer ist nicht mehr verfügbar.";
      this.render();
      return;
    }
    const result = await this.actions.activate(entry);
    if (this.closed) return;
    this.message = result === "blocked"
      ? "Navigation angehalten: Key-Entwurf zuerst Übernehmen oder Verwerfen."
      : result === "stale"
        ? "Dieser Treffer ist nicht mehr verfügbar."
        : "Treffer geöffnet.";
    this.render();
  }

  private render(): void {
    const result = searchRoomKeys(this.session, this.input.value);
    this.results.replaceChildren();
    this.clearButton.disabled = !this.input.value;
    if (!result.available) {
      this.status.textContent = this.message ||
        "Raum-Key-Suche ist nur für strukturierte V4-Karten verfügbar.";
      return;
    }
    this.status.textContent = this.message || (result.query
      ? `${result.entries.length} Treffer`
      : `${result.entries.length} Räume in der Übersicht`);
    if (!result.entries.length) {
      const empty = this.root.ownerDocument.createElement("p");
      empty.className = "dn-room-key-search-empty";
      empty.textContent = "Keine Raum-Keys gefunden.";
      this.results.append(empty);
      return;
    }
    for (const entry of result.entries) {
      const button = this.root.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "dn-room-key-search-result";
      button.dataset.roomId = entry.roomId;
      button.dataset.floorId = entry.floorId;
      if (entry.sectionId) button.dataset.sectionId = entry.sectionId;
      const title = this.root.ownerDocument.createElement("strong");
      title.className = "dn-room-key-search-location";
      title.textContent = roomLabel(entry);
      button.append(title);
      if (entry.kind === "section") {
        const section = this.root.ownerDocument.createElement("span");
        section.className = "dn-room-key-search-section";
        section.textContent = entry.sectionTitle;
        const snippet = this.root.ownerDocument.createElement("span");
        snippet.className = "dn-room-key-search-snippet";
        snippet.textContent = entry.snippet;
        button.append(section, snippet);
      }
      button.addEventListener("click", () => void this.activate(entry));
      this.results.append(button);
    }
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.stop();
    this.root.replaceChildren();
  }
}
