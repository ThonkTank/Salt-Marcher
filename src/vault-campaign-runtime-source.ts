import { App, TFile } from "obsidian";
import type { CampaignRuntimeFile, CampaignRuntimeStorage } from "./features/campaign/campaign-runtime-source";

export const CAMPAIGN_RUNTIME_ROOT = "Kampagnen/SaltMarcher";

export class VaultCampaignRuntimeStorage implements CampaignRuntimeStorage {
  constructor(private readonly app: App) {}
  async list(): Promise<readonly CampaignRuntimeFile[]> {
    const files = this.app.vault.getFiles().filter((file) =>
      file.path.startsWith(CAMPAIGN_RUNTIME_ROOT + "/") && file.path.endsWith(".campaign.json"))
      .sort((a, b) => a.path.localeCompare(b.path));
    return Promise.all(files.map(async (file) => Object.freeze({ path: file.path, bytes: await this.app.vault.read(file) })));
  }
  subscribe(changed: () => void): () => void {
    const relevant = (file: unknown) => file instanceof TFile &&
      file.path.startsWith(CAMPAIGN_RUNTIME_ROOT + "/") && file.path.endsWith(".campaign.json");
    const refs = [
      this.app.vault.on("create", (file) => { if (relevant(file)) changed(); }),
      this.app.vault.on("modify", (file) => { if (relevant(file)) changed(); }),
      this.app.vault.on("delete", (file) => { if (relevant(file)) changed(); }),
      this.app.vault.on("rename", (file, oldPath) => {
        if (relevant(file) || oldPath.startsWith(CAMPAIGN_RUNTIME_ROOT + "/")) changed();
      }),
    ];
    return () => refs.forEach((ref) => this.app.vault.offref(ref));
  }
}
