import { App, TFile } from "obsidian";
import { safePath } from "./model";
import type { MwsImportMediaFilePort } from "./features/campaign/mws-import-media-inventory";

/** Thin Obsidian host port; parsing, binding and race checks stay host-neutral. */
export class VaultMwsImportMediaFiles implements MwsImportMediaFilePort {
  constructor(private readonly app: App) {}

  async read(path: string): Promise<Uint8Array | null> {
    const checked = safePath(path), file = this.app.vault.getAbstractFileByPath(checked);
    if (!file) return null;
    if (!(file instanceof TFile)) throw new Error(`Importpfad ist keine Datei: ${checked}`);
    return new Uint8Array(await this.app.vault.readBinary(file));
  }
}
