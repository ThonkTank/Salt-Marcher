import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createHash } from "node:crypto";
import { campaignCommandId, campaignLocalId,
  type CampaignContextProjection, type CampaignId } from "../../../features/campaign/campaign-contracts";
import { VaultStore } from "../vault-stores";
import { VaultCampaignRuntimeStorage } from "../vault-campaign-runtime-source";
import type { AtlasCampaignServices } from "./atlas-campaign-host";
import { CampaignEntry } from "./campaign-entry";
import { WorldNotesDraftBuffer, WorldNotesPanel } from "./world-notes-panel";
import { WorldNotesNativeSession, recoverWorldNotesBeforeActivation } from "./world-notes-native-session";
import type { CreatureCatalogLoader } from "../../../features/catalog/creature-catalog-loader";

export const WORLD_NOTES_VIEW = "dungeon-world-notes";
const digest = (bytes: string) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Obsidian entry for confirmed Campaign World Notes. Atlas owns cross-campaign navigation. */
export class WorldNotesView extends ItemView {
  private picker?: CampaignEntry;
  private panel?: WorldNotesPanel;
  private session?: WorldNotesNativeSession;
  private mountedContext?: CampaignContextProjection;
  private unsubscribe?: () => void;
  private unsubscribeClosed?: () => void;
  private status?: HTMLParagraphElement;
  private notesHost?: HTMLDivElement;
  private generation = 0;
  constructor(leaf: WorkspaceLeaf, private readonly services: AtlasCampaignServices,
    private readonly creatures: CreatureCatalogLoader,
    private readonly draftBuffer: WorldNotesDraftBuffer = new WorldNotesDraftBuffer()) { super(leaf); }
  getViewType(): string { return WORLD_NOTES_VIEW; }
  getDisplayText(): string { return "Kampagnenwissen"; }
  getIcon(): string { return "book-open"; }
  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.replaceChildren();
    const pickerHost = root.ownerDocument.createElement("div");
    this.notesHost = root.ownerDocument.createElement("div");
    this.status = root.ownerDocument.createElement("p");
    this.status.setAttribute("role", "status");
    root.append(pickerHost, this.status, this.notesHost);
    this.picker = new CampaignEntry(pickerHost, {
      onOpen: async (id, kind) => {
        await this.openCampaign(id, kind);
        return { activeCampaignId: this.services.provider.currentContext()?.campaignId ?? null };
      },
      onRetry: () => this.refresh(),
    });
    this.unsubscribe = this.services.provider.subscribeContextChanged(() => {
      const current = this.services.provider.currentContext();
      if (!current) this.suspendPanel();
      else if (current.contextToken !== this.mountedContext?.contextToken)
        void this.mount(current).catch((error) => this.message(String(error), true));
      void this.refresh().catch((error) => this.message(String(error), true));
    });
    this.unsubscribeClosed = this.services.subscribeClosed?.(() => {
      this.suspendPanel(); this.message("Kampagnenanschluss ist geschlossen.", true);
    });
    await this.refresh();
    const active = this.services.provider.currentContext();
    if (active) await this.mount(active);
  }
  private message(value: string, error = false): void {
    if (!this.status) return;
    this.status.textContent = value;
    this.status.setAttribute("role", error ? "alert" : "status");
  }
  private suspendPanel(): void {
    this.generation++;
    this.panel?.suspend();
    this.session?.close(); this.session = undefined;
    this.mountedContext = undefined;
  }
  private clearPanel(): void {
    this.suspendPanel();
    this.panel?.destroy(); this.panel = undefined;
    this.notesHost?.replaceChildren();
  }
  private async refresh(): Promise<void> {
    const stamp = this.generation, entries = await this.services.provider.entries();
    if (stamp !== this.generation || !this.picker) return;
    this.picker.update({ entries,
      activeCampaignId: this.services.provider.currentContext()?.campaignId ?? null });
  }
  private async openCampaign(id: CampaignId, _kind: "open" | "switch"): Promise<void> {
    const current = this.services.provider.currentContext();
    if (current && current.campaignId !== id)
      throw new Error("Kampagne zuerst im Atlas wechseln, damit offene Atlasentwürfe gesichert werden.");
    if (current?.campaignId === id) { await this.mount(current, true); return; }
    await recoverWorldNotesBeforeActivation({ campaignId: id,
      storage: new VaultCampaignRuntimeStorage(this.app), files: new VaultStore(this.app),
      digest, serializationScope: this.app.vault });
    const activated = await this.services.provider.activate(campaignCommandId(crypto.randomUUID()), id, "open");
    if (!activated) throw new Error("Kampagne konnte nicht bestätigt werden.");
    const context = this.services.provider.currentContext();
    if (!context || context.campaignId !== id) throw new Error("Kampagne wurde nicht aktiviert.");
    await this.mount(context);
    await this.refresh();
  }
  protected createSession(context: CampaignContextProjection): WorldNotesNativeSession {
    return new WorldNotesNativeSession(this.services,
      new VaultCampaignRuntimeStorage(this.app), new VaultStore(this.app), digest,
      this.app.vault, context);
  }
  private async mount(context: CampaignContextProjection, reclaimOwnership = false): Promise<void> {
    if (!this.notesHost) return;
    if (this.mountedContext?.contextToken === context.contextToken && this.panel) return;
    this.suspendPanel();
    const stamp = this.generation, session = this.createSession(context);
    this.session = session;
    try {
      const snapshot = await session.open();
      if (stamp !== this.generation || this.session !== session) return;
      this.panel ??= new WorldNotesPanel(this.notesHost, {
        draftBuffer: this.draftBuffer,
        onDraftOwnershipRevoked: () => {
          this.suspendPanel();
          this.message("Entwurf in einer anderen Ansicht geöffnet. Hier mit „Erneut versuchen“ übernehmen.");
        },
        newId: () => campaignLocalId(crypto.randomUUID()),
        currentContext: () => this.services.provider.currentContext(),
        digest,
        validateReceipt: (receipt) => {
          if (!this.session) throw new Error("World-Notes-Kampagnenbindung wurde widerrufen.");
          this.session.validateReceipt(receipt);
        },
        commit: (command, change, revision) => {
          if (!this.session) throw new Error("World-Notes-Kampagnenbindung wurde widerrufen.");
          return this.session.commit(command, change, revision);
        },
        searchCreatures: async (query) => (await this.creatures.load()).search({ text: query, limit: 8 })
          .rows.map(({ id, name }) => ({ id, name })),
        creatureDetail: async (id) => {
          const creature = (await this.creatures.load()).detail(id);
          return creature ? { id: creature.id, name: creature.name } : null;
        },
      });
      if (!this.panel.update(snapshot, reclaimOwnership))
        throw new Error("Veralteter World-Stand kann nicht montiert werden.");
      this.mountedContext = context;
      this.message("");
    } catch (error) {
      if (this.session !== session || stamp !== this.generation) return;
      this.suspendPanel(); this.message(String(error), true);
      throw error;
    }
  }
  async onClose(): Promise<void> {
    this.unsubscribe?.(); this.unsubscribe = undefined;
    this.unsubscribeClosed?.(); this.unsubscribeClosed = undefined;
    this.clearPanel(); this.picker?.destroy(); this.picker = undefined;
    this.status = undefined; this.notesHost = undefined;
  }
}
