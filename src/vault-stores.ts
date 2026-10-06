import { App, FileSystemAdapter, TFile } from "obsidian";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { safePath } from "./model";
import { FileConflict, type FileStore } from "./persistence";
import { type AssetCatalogStore, type BinarySource } from "./assets";

export class VaultStore implements FileStore {
  constructor(private app: App) {}
  async read(path: string): Promise<string | null> {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f) return null;
    if (!(f instanceof TFile)) throw new Error("Pfad ist keine Datei: " + path);
    return this.app.vault.read(f);
  }
  private async folders(path: string): Promise<void> {
    const parts = path.split("/");
    parts.pop();
    let current = "";
    for (const part of parts) {
      current += (current ? "/" : "") + part;
      if (!this.app.vault.getAbstractFileByPath(current))
        await this.app.vault.createFolder(current);
    }
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    safePath(path);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (before === null) {
      if (file) throw new FileConflict(path);
      if (after !== null) {
        await this.folders(path);
        await this.app.vault.create(path, after);
      }
      return;
    }
    if (!(file instanceof TFile)) throw new FileConflict(path);
    if (after === null) {
      if ((await this.app.vault.read(file)) !== before)
        throw new FileConflict(path);
      await this.app.vault.trash(file, false);
      return;
    }
    await this.app.vault.process(file, (current) => {
      if (current !== before) throw new FileConflict(path);
      return after;
    });
  }
}
export class VaultAssetStore implements AssetCatalogStore {
  private readonly root = ".obsidian/dungeon-editor-assets";
  constructor(private app: App) {}
  private async folder(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.root))) await adapter.mkdir(this.root);
  }
  private packagePath(hash: string): string {
    if (!/^[0-9a-f]{64}$/.test(hash))
      throw new Error("Ungültige Paketkennung.");
    return this.root + "/" + hash + ".dungeondraft_pack";
  }
  async readCatalog(): Promise<string | null> {
    const path = this.root + "/catalog.json",
      adapter = this.app.vault.adapter;
    return (await adapter.exists(path)) ? adapter.read(path) : null;
  }
  async writeCatalog(text: string): Promise<void> {
    await this.folder();
    const adapter = this.app.vault.adapter,
      target = this.root + "/catalog.json",
      temporary = this.root + "/catalog.next.json";
    await adapter.write(temporary, text);
    if (await adapter.exists(target)) await adapter.remove(target);
    await adapter.rename(temporary, target);
  }
  async writePackage(hash: string, source: BinarySource): Promise<void> {
    await this.folder();
    const adapter = this.app.vault.adapter,
      path = this.packagePath(hash);
    if (!(await adapter.exists(path)))
      await adapter.writeBinary(
        path,
        await source.slice(0, source.size).arrayBuffer(),
      );
  }
  async readPackage(hash: string): Promise<BinarySource> {
    const adapter = this.app.vault.adapter,
      path = this.packagePath(hash);
    if (adapter instanceof FileSystemAdapter)
      return new LocalBinarySource(adapter.getFullPath(path));
    const bytes = await adapter.readBinary(path);
    return new Blob([bytes]);
  }
  async removePackage(hash: string): Promise<void> {
    const path = this.packagePath(hash),
      adapter = this.app.vault.adapter;
    if (await adapter.exists(path)) await adapter.remove(path);
  }
}
export class LocalBinarySource implements BinarySource {
  readonly size: number;
  constructor(private path: string) {
    this.size = statSync(path).size;
  }
  slice(start = 0, end = this.size): Blob {
    start = Math.max(
      0,
      Math.min(this.size, start < 0 ? this.size + start : start),
    );
    end = Math.max(start, Math.min(this.size, end < 0 ? this.size + end : end));
    const bytes = new Uint8Array(end - start),
      descriptor = openSync(this.path, "r");
    try {
      let read = 0;
      while (read < bytes.length) {
        const count = readSync(
          descriptor,
          bytes,
          read,
          bytes.length - read,
          start + read,
        );
        if (!count)
          throw new Error("Assetpaket wurde während des Lesens verkürzt.");
        read += count;
      }
    } finally {
      closeSync(descriptor);
    }
    return new Blob([bytes]);
  }
}
