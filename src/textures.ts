import { ImageSource, Texture } from "pixi.js";
interface Entry {
  refs: number;
  bytes: number;
  lastUsed: number;
  texture?: Texture;
  promise: Promise<Texture>;
}
/** One owner per view. Unused images are evicted; all sources are released on close. */
export class TexturePool {
  private entries = new Map<string, Entry>();
  private closed = false;
  private clock = 0;
  constructor(
    private url: (path: string) => string,
    private budget = 384 * 1024 * 1024,
  ) {}
  acquire(path: string): Promise<Texture> {
    let entry = this.entries.get(path);
    if (!entry) {
      const image = new Image();
      image.src = this.url(path);
      entry = {
        refs: 0,
        bytes: 0,
        lastUsed: ++this.clock,
        promise: Promise.resolve(null as unknown as Texture),
      };
      const owned = entry;
      entry.promise = image
        .decode()
        .then(() => {
          if (this.closed) throw new Error("Bildansicht geschlossen.");
          const source = new ImageSource({
            resource: image,
            addressMode: "repeat",
            scaleMode: "linear",
          });
          owned.texture = new Texture({ source });
          owned.bytes = image.width * image.height * 4;
          this.evict();
          return owned.texture;
        })
        .catch((error) => {
          this.entries.delete(path);
          throw new Error(
            "Bildressource konnte nicht geladen werden: " +
              path +
              " (" +
              String(error) +
              ")",
          );
        });
      this.entries.set(path, entry);
    }
    entry.refs++;
    entry.lastUsed = ++this.clock;
    return entry.promise;
  }
  release(path: string): void {
    const entry = this.entries.get(path);
    if (entry) {
      entry.refs = Math.max(0, entry.refs - 1);
      entry.lastUsed = ++this.clock;
    }
    this.evict();
  }
  get bytes(): number {
    return [...this.entries.values()].reduce((n, e) => n + e.bytes, 0);
  }
  private evict(): void {
    let total = this.bytes;
    for (const [key, e] of [...this.entries].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    )) {
      if (total <= this.budget) break;
      if (!e.refs && e.texture) {
        total -= e.bytes;
        e.texture.destroy(true);
        this.entries.delete(key);
      }
    }
  }
  destroy(): void {
    this.closed = true;
    for (const e of this.entries.values()) e.texture?.destroy(true);
    this.entries.clear();
  }
}
