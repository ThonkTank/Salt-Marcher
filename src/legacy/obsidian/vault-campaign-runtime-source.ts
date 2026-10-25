import { App, TFile } from "obsidian";
import type { CampaignRuntimeFile, CampaignRuntimeStorage,
  CampaignRuntimeStorageChange } from "../../features/campaign/campaign-runtime-source";

export const CAMPAIGN_RUNTIME_ROOT = "Kampagnen/SaltMarcher";

export class VaultCampaignRuntimeStorage implements CampaignRuntimeStorage {
  constructor(private readonly app: App) {}
  async list(): Promise<readonly CampaignRuntimeFile[]> {
    const files = this.app.vault.getFiles().filter((file) =>
      file.path.startsWith(CAMPAIGN_RUNTIME_ROOT + "/") && file.path.endsWith(".campaign.json"))
      .sort((a, b) => a.path.localeCompare(b.path));
    return Promise.all(files.map(async (file) => Object.freeze({ path: file.path, bytes: await this.app.vault.read(file) })));
  }
  subscribe(changed: (change: CampaignRuntimeStorageChange) => void): () => void {
    const relevant = (file: unknown): file is TFile => file instanceof TFile &&
      file.path.startsWith(CAMPAIGN_RUNTIME_ROOT + "/") && file.path.endsWith(".campaign.json");
    let active = true, nextModifyEventId = 0, modifyDelivery = Promise.resolve();
    const refs = [
      this.app.vault.on("create", (file) => { if (relevant(file)) changed({ kind: "create", path: file.path }); }),
      this.app.vault.on("modify", (file) => { if (relevant(file)) {
        const eventId = ++nextModifyEventId, path = file.path;
        changed({ kind: "modify", phase: "pending", eventId, path });
        const observed: Promise<CampaignRuntimeStorageChange> = this.app.vault.read(file).then(
          (bytes): CampaignRuntimeStorageChange => ({ kind: "modify", phase: "resolved", eventId, path, bytes }),
          (): CampaignRuntimeStorageChange => ({ kind: "modify", phase: "resolved", eventId, path }));
        modifyDelivery = modifyDelivery.then(async () => {
          const resolved = await observed;
          if (active) changed(resolved);
        }).catch(() => undefined);
      } }),
      this.app.vault.on("delete", (file) => { if (relevant(file)) changed({ kind: "delete", path: file.path }); }),
      this.app.vault.on("rename", (file, oldPath) => {
        if (relevant(file) || oldPath.startsWith(CAMPAIGN_RUNTIME_ROOT + "/"))
          changed({ kind: "rename", path: file.path, oldPath });
      }),
    ];
    return () => { active = false; refs.forEach((ref) => this.app.vault.offref(ref)); };
  }
}
