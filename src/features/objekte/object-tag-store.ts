import { copyObjectTags, parseObjectTags, serializeObjectTags,
  type ObjectTagDocument } from "./object-tags";

export interface ObjectTagStorage {
  read(): Promise<string | null>;
  compareAndWrite(before: string | null, after: string): Promise<void>;
}

/** Global tag overrides have their own Save boundary, outside map history. */
export class ObjectTagStore {
  private loaded = false;
  private savedText: string | null = null;
  private override: ObjectTagDocument | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(private storage: ObjectTagStorage) {}

  async load(): Promise<ObjectTagDocument | null> {
    const text = await this.storage.read();
    const parsed = text === null ? null : parseObjectTags(text);
    this.savedText = text;
    this.override = parsed;
    this.loaded = true;
    return parsed ? copyObjectTags(parsed) : null;
  }

  current(): ObjectTagDocument | null {
    return this.override ? copyObjectTags(this.override) : null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  save(document: ObjectTagDocument): Promise<void> {
    const operation = this.queue.then(async () => {
      if (!this.loaded) await this.load();
      const text = serializeObjectTags(document);
      await this.storage.compareAndWrite(this.savedText, text);
      this.savedText = text;
      this.override = parseObjectTags(text);
      for (const listener of this.listeners) listener();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
