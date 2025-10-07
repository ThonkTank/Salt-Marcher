// src/apps/almanac/data/json-store.ts
// Generic JSON store backed by an Obsidian vault file with migration support.

import { normalizePath, TAbstractFile, TFile } from "obsidian";

export interface VaultLike {
  getAbstractFileByPath(path: string): TAbstractFile | null;
  create(path: string, data: string): Promise<TFile>;
  modify(file: TFile, data: string): Promise<void>;
  read(file: TFile): Promise<string>;
  createFolder(path: string): Promise<void>;
}

export interface JsonStoreConfig<T> {
  readonly path: string;
  readonly currentVersion: string;
  readonly initialData: () => T;
  readonly migrations?: Record<string, (payload: VersionedPayload<T>) => VersionedPayload<T>>;
}

export interface VersionedPayload<T> {
  readonly version: string;
  readonly data: T;
}

export class JsonStore<T> {
  private readonly normalizedPath: string;

  constructor(private readonly vault: VaultLike, private readonly config: JsonStoreConfig<T>) {
    this.normalizedPath = normalizePath(config.path);
  }

  async read(): Promise<T> {
    const payload = await this.ensurePayload();
    return clone(payload.data);
  }

  async update(updater: (draft: T) => void | T): Promise<T> {
    const payload = await this.ensurePayload();
    const draft = clone(payload.data);
    const result = updater(draft);
    const nextData = result !== undefined ? result : draft;
    const nextPayload: VersionedPayload<T> = { version: this.config.currentVersion, data: clone(nextData) };
    await this.writePayload(nextPayload);
    return clone(nextData);
  }

  private async ensurePayload(): Promise<VersionedPayload<T>> {
    const file = await this.ensureFile();
    const raw = await this.vault.read(file);
    if (!raw.trim()) {
      const fallback: VersionedPayload<T> = { version: this.config.currentVersion, data: this.config.initialData() };
      await this.writePayload(fallback);
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<VersionedPayload<T>>;
      const normalized = this.normalisePayload(parsed);
      if (normalized.version !== this.config.currentVersion) {
        const migrated = this.applyMigrations(normalized);
        if (migrated.version !== this.config.currentVersion) {
          const coerced: VersionedPayload<T> = {
            version: this.config.currentVersion,
            data: migrated.data ?? this.config.initialData(),
          };
          await this.writePayload(coerced);
          return coerced;
        }
        await this.writePayload(migrated);
        return migrated;
      }
      return normalized;
    } catch (error) {
      console.warn(`[salt-marcher] Failed to parse ${this.normalizedPath}, resetting file`, error);
      const fallback: VersionedPayload<T> = { version: this.config.currentVersion, data: this.config.initialData() };
      await this.writePayload(fallback);
      return fallback;
    }
  }

  private applyMigrations(payload: VersionedPayload<T>): VersionedPayload<T> {
    const migrations = this.config.migrations ?? {};
    let current = payload;
    const visited = new Set<string>();
    while (current.version !== this.config.currentVersion) {
      if (visited.has(current.version)) {
        break;
      }
      visited.add(current.version);
      const migrate = migrations[current.version];
      if (!migrate) {
        break;
      }
      current = migrate(current);
    }
    return current;
  }

  private normalisePayload(payload: Partial<VersionedPayload<T>> | null | undefined): VersionedPayload<T> {
    if (!payload || typeof payload !== "object") {
      return { version: "0.0.0", data: this.config.initialData() };
    }
    const version = typeof payload.version === "string" && payload.version ? payload.version : "0.0.0";
    const data = payload.data ?? this.config.initialData();
    return { version, data: data as T };
  }

  private async ensureFile(): Promise<TFile> {
    const existing = this.vault.getAbstractFileByPath(this.normalizedPath);
    if (existing instanceof TFile) {
      return existing;
    }
    await this.ensureParentFolder(this.normalizedPath);
    const payload: VersionedPayload<T> = { version: this.config.currentVersion, data: this.config.initialData() };
    return this.vault.create(this.normalizedPath, serialise(payload));
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const segments = path.split("/").slice(0, -1);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const normalised = normalizePath(current);
      if (this.vault.getAbstractFileByPath(normalised)) {
        continue;
      }
      try {
        await this.vault.createFolder(normalised);
      } catch (error) {
        // Ignore race conditions where folder already exists
        if (this.vault.getAbstractFileByPath(normalised)) {
          continue;
        }
        throw error;
      }
    }
  }

  private async writePayload(payload: VersionedPayload<T>): Promise<void> {
    const file = await this.ensureFile();
    await this.vault.modify(file, serialise(payload));
  }
}

function serialise(payload: VersionedPayload<unknown>): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function clone<V>(value: V): V {
  return JSON.parse(JSON.stringify(value)) as V;
}
