/** Insertion/LRU storage with explicit batch eviction and independent entry/cost limits. */
export class BudgetCache<K, V> {
  private values = new Map<K, { value: V; cost: number }>();
  private cost = 0;
  constructor(
    private readonly maxCost: number,
    private readonly maxEntries = Infinity,
  ) {}
  has(key: K) {
    return this.values.has(key);
  }
  peek(key: K): V | undefined {
    return this.values.get(key)?.value;
  }
  get(key: K): V | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    this.values.delete(key);
    this.values.set(key, entry);
    return entry.value;
  }
  set(key: K, value: V, cost = 1) {
    this.delete(key);
    this.values.set(key, { value, cost });
    this.cost += cost;
  }
  delete(key: K) {
    const entry = this.values.get(key);
    if (entry) {
      this.cost -= entry.cost;
      this.values.delete(key);
    }
  }
  clear() {
    this.values.clear();
    this.cost = 0;
  }
  *[Symbol.iterator](): IterableIterator<[K, V]> {
    for (const [key, entry] of this.values) yield [key, entry.value];
  }
  trim() {
    for (const key of this.values.keys()) {
      if (this.cost <= this.maxCost && this.values.size <= this.maxEntries)
        break;
      this.delete(key);
    }
  }
}
