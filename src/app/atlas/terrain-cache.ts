import type { LandscapeBox } from './atlas-landscape';
export const terrainBoxesOverlap = (a: LandscapeBox, b: LandscapeBox) =>
  a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
type Entry<T> = { value: T; bytes: number; box: LandscapeBox };
/** Derived data only. Consumers share explicit quotas; author data never enters this LRU. */
export class TerrainCache<T> {
  private entries = new Map<string, Entry<T>>();
  private retained = new Map<string, Entry<T>>();
  bytes = 0;
  retainedBytes = 0;
  hits = 0;
  misses = 0;
  evictions = 0;
  constructor(
    readonly limit: number,
    readonly retainedLimit = limit,
  ) {}
  get(key: string): T | undefined {
    const entries = this.retained.has(key) ? this.retained : this.entries,
      entry = entries.get(key);
    if (!entry) {
      this.misses++;
      return;
    }
    entries.delete(key);
    entries.set(key, entry);
    this.hits++;
    return entry.value;
  }
  private remove(entries: Map<string, Entry<T>>, key: string) {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    this.bytes -= entry.bytes;
    if (entries === this.retained) this.retainedBytes -= entry.bytes;
  }
  private evict(entries: Map<string, Entry<T>>) {
    this.remove(entries, entries.keys().next().value!);
    this.evictions++;
  }
  /** Retained sampling fields survive ordinary source/pixel churn. Their own
   * sublimit prevents accumulated camera views from crowding out every source.
   * Both LRU queues still share the same total byte limit. */
  put(key: string, box: LandscapeBox, value: T, bytes: number, retain = false) {
    this.remove(this.entries, key);
    this.remove(this.retained, key);
    if (bytes > this.limit || (retain && bytes > this.retainedLimit)) return;
    while (retain && this.retainedBytes + bytes > this.retainedLimit) this.evict(this.retained);
    while (this.bytes + bytes > this.limit) {
      const entries = this.entries.size ? this.entries : retain ? this.retained : null;
      if (!entries?.size) return;
      this.evict(entries);
    }
    (retain ? this.retained : this.entries).set(key, { value, bytes, box });
    this.bytes += bytes;
    if (retain) this.retainedBytes += bytes;
  }
  /** A consumer may retain a partly dirty derived entry; retained storage keeps its quota and LRU age. */
  invalidate(boxes: LandscapeBox[], retain?: (value: T, boxes: LandscapeBox[]) => boolean) {
    for (const entries of [this.entries, this.retained])
      for (const [key, entry] of entries)
        if (boxes.some((b) => terrainBoxesOverlap(entry.box, b))) {
          if (retain?.(entry.value, boxes)) continue;
          this.remove(entries, key);
        }
  }
  clearRetained() {
    this.bytes -= this.retainedBytes;
    this.retained.clear();
    this.retainedBytes = 0;
  }
  clear() {
    this.entries.clear();
    this.retained.clear();
    this.bytes = 0;
    this.retainedBytes = 0;
  }
}
