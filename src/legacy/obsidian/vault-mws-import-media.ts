import { App, TFile } from "obsidian";
import { safePath } from "../../model";
import type { MwsImportMediaFilePort } from "../../features/campaign/mws-import-media-inventory";
import type { CompleteImportPackageFilePort } from "../../features/campaign/complete-import-package";

/** Thin Obsidian host port; parsing, binding and race checks stay host-neutral. */
export class VaultMwsImportMediaFiles implements MwsImportMediaFilePort, CompleteImportPackageFilePort {
  constructor(private readonly app: App) {}

  async read(path: string, maxBytes = Number.MAX_SAFE_INTEGER): Promise<Uint8Array | null> {
    const checked = safePath(path), file = this.app.vault.getAbstractFileByPath(checked);
    if (!file) return null;
    if (!(file instanceof TFile)) throw new Error(`Importpfad ist keine Datei: ${checked}`);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
      throw new Error("Ungültige Import-Lesegrenze.");
    if (!Number.isSafeInteger(file.stat.size) || file.stat.size < 0 || file.stat.size > maxBytes)
      throw new Error(`Importdatei überschreitet die Host-Lesegrenze: ${checked}`);
    const bytes = new Uint8Array(await this.app.vault.readBinary(file));
    if (bytes.length > maxBytes)
      throw new Error(`Importdatei überschreitet die Host-Lesegrenze: ${checked}`);
    return bytes;
  }

  async list(root: string): Promise<readonly string[] | null> {
    const checkedRoot = safePath(root), found = this.app.vault.getAbstractFileByPath(checkedRoot);
    if (!found) return null;
    if (found instanceof TFile) throw new Error(`Importwurzel ist keine Mappe: ${checkedRoot}`);
    const pending = [checkedRoot], files: string[] = [], visited = new Set<string>();
    while (pending.length) {
      const folder = pending.pop()!;
      if (visited.has(folder)) throw new Error("Importpaket enthält eine zyklische Mappe.");
      visited.add(folder);
      if (visited.size > 4097 || files.length > 4097)
        throw new Error("Importpaket überschreitet die Host-Dateigrenze.");
      const listed = await this.app.vault.adapter.list(folder);
      for (const file of listed.files) {
        const checked = safePath(file);
        if (!checked.startsWith(`${checkedRoot}/`))
          throw new Error("Importpaket enthält einen fremden Dateipfad.");
        files.push(checked);
        if (files.length > 4097)
          throw new Error("Importpaket überschreitet die Host-Dateigrenze.");
      }
      for (const child of listed.folders) {
        const checked = safePath(child);
        if (!checked.startsWith(`${checkedRoot}/`))
          throw new Error("Importpaket enthält einen fremden Mappenpfad.");
        pending.push(checked);
      }
    }
    return Object.freeze(files.sort());
  }
}
