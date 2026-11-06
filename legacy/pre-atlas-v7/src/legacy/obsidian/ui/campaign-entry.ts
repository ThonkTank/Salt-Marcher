import type { CampaignId } from "../../../features/campaign/campaign-contracts";

export interface CampaignEntryItem {
  readonly campaignId: CampaignId | null;
  readonly key: string;
  readonly name: string;
  readonly status: "available" | "trashed" | "unavailable";
  readonly reason: string | null;
}
export interface CampaignEntryModel {
  readonly activeCampaignId: CampaignId | null;
  readonly activeUnavailableReason?: string;
  readonly entries: readonly CampaignEntryItem[];
}
export interface CampaignEntryOptions {
  readonly onOpen: (campaignId: CampaignId, kind: "open" | "switch") => Promise<{
    readonly activeCampaignId: CampaignId | null;
    readonly unavailableReason?: string;
  }>;
  readonly onRetry: () => Promise<void>;
}

/** Host-neutral DOM component. The host owns activation ordering and Atlas navigation. */
export class CampaignEntry {
  private generation = 0;
  private busy = false;
  private destroyed = false;
  private model: CampaignEntryModel = { activeCampaignId: null, entries: [] };
  private readonly root: HTMLDivElement;
  constructor(host: HTMLElement, private readonly options: CampaignEntryOptions) {
    this.root = host.ownerDocument.createElement("div");
    this.root.className = "dn-campaign-entry";
    this.root.setAttribute("aria-label", "Kampagnen");
    host.append(this.root);
    this.render();
  }
  update(model: CampaignEntryModel): void {
    if (this.destroyed) return;
    this.generation++; this.busy = false;
    this.model = Object.freeze({
      activeCampaignId: model.activeCampaignId,
      activeUnavailableReason: model.activeUnavailableReason,
      entries: Object.freeze(model.entries.map((entry) => Object.freeze({ ...entry }))),
    });
    this.render();
  }
  private render(): void {
    this.root.replaceChildren();
    this.root.toggleAttribute("data-empty", this.model.entries.length === 0);
    if (this.model.entries.length === 0 && !this.model.activeUnavailableReason) {
      const disclosure = this.root.ownerDocument.createElement("details"),
        summary = this.root.ownerDocument.createElement("summary"),
        explanation = this.root.ownerDocument.createElement("p");
      disclosure.className = "dn-campaign-empty";
      summary.textContent = "Kampagne verknüpfen";
      explanation.textContent = "Keine verfügbare Kampagne gefunden.";
      disclosure.append(summary, explanation);
      this.appendRetry(disclosure);
      this.root.append(disclosure);
      return;
    }
    const title = this.root.ownerDocument.createElement("h3");
    title.textContent = "Kampagne";
    this.root.append(title);
    if (this.model.activeUnavailableReason) {
      const activeError = this.root.ownerDocument.createElement("p");
      activeError.className = "dn-campaign-active-error";
      activeError.setAttribute("role", "status");
      activeError.textContent = this.model.activeUnavailableReason;
      this.root.append(activeError);
    }
    const list = this.root.ownerDocument.createElement("ul");
    for (const entry of this.model.entries) {
      const row = this.root.ownerDocument.createElement("li"), name = this.root.ownerDocument.createElement("span"),
        active = entry.campaignId !== null && entry.campaignId === this.model.activeCampaignId;
      row.dataset.campaignKey = entry.key;
      if (active) row.dataset.active = "true";
      name.textContent = entry.name;
      row.append(name);
      if (active) {
        const marker = this.root.ownerDocument.createElement("span");
        marker.textContent = "Aktiv"; marker.className = "dn-campaign-active"; row.append(marker);
      }
      if (entry.status !== "available" || entry.reason) {
        const reason = this.root.ownerDocument.createElement("span");
        reason.className = "dn-campaign-unavailable";
        reason.textContent = entry.reason ?? (entry.status === "trashed" ? "Im Papierkorb" : "Nicht verfügbar");
        row.append(reason);
      }
      const button = this.root.ownerDocument.createElement("button");
      button.type = "button";
      button.textContent = active ? "Erneut versuchen" : this.model.activeCampaignId ? "Wechseln" : "Öffnen";
      button.disabled = this.busy || entry.status !== "available" || entry.campaignId === null;
      button.addEventListener("click", () => {
        if (this.busy || this.destroyed || entry.status !== "available" || entry.campaignId === null) return;
        const stamp = ++this.generation, kind = this.model.activeCampaignId === null ? "open" as const : "switch" as const;
        this.busy = true; this.render();
        void this.options.onOpen(entry.campaignId, kind).then((outcome) => {
          if (this.destroyed || stamp !== this.generation) return;
          this.model = Object.freeze({ ...this.model, activeCampaignId: outcome.activeCampaignId,
            activeUnavailableReason: outcome.unavailableReason });
        }).catch((error) => {
          if (this.destroyed || stamp !== this.generation) return;
          this.model = Object.freeze({ ...this.model, activeUnavailableReason: String(error) });
        }).finally(() => {
          if (this.destroyed || stamp !== this.generation) return;
          this.busy = false; this.render();
        });
      });
      row.append(button); list.append(row);
    }
    this.root.append(list);
    this.appendRetry(this.root);
  }
  private appendRetry(host: HTMLElement): void {
    const retry = this.root.ownerDocument.createElement("button");
    retry.type = "button"; retry.textContent = "Liste neu laden"; retry.disabled = this.busy;
    retry.addEventListener("click", () => {
      if (this.busy || this.destroyed) return;
      const stamp = ++this.generation; this.busy = true; this.render();
      void this.options.onRetry().catch((error) => {
        if (!this.destroyed && stamp === this.generation)
          this.model = Object.freeze({ ...this.model, activeUnavailableReason: String(error) });
      }).finally(() => {
        if (this.destroyed || stamp !== this.generation) return;
        this.busy = false; this.render();
      });
    });
    host.append(retry);
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.generation++; this.root.remove();
  }
}
