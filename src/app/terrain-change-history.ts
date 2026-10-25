import type { TerrainIdentity, TerrainInvalidation } from './terrain-frame';

export interface TerrainColorChange {
  base: TerrainIdentity;
  invalidation: TerrainInvalidation;
}
export const equalTerrainSource = (
  a: TerrainIdentity | undefined,
  b: TerrainIdentity | undefined,
) => !!a && !!b && a.revision === b.revision && a.fence === b.fence;

/** Worker-owned, bounded evidence of changes between rendered snapshots.
 * Missing history (including a worker restart) always requires a full refresh. */
export class TerrainChangeHistory {
  private entries: { source: TerrainIdentity; invalidation: TerrainInvalidation }[] = [];
  private bounds = 0;
  record(source: TerrainIdentity, invalidation: TerrainInvalidation) {
    if (invalidation.reset) {
      this.entries = [];
      this.bounds = 0;
    }
    if (equalTerrainSource(this.entries.at(-1)?.source, source)) return;
    const entry = {
      source: { revision: source.revision, fence: source.fence },
      invalidation: {
        reset: invalidation.reset,
        bounds: invalidation.bounds.map((b) => ({ ...b })),
      },
    };
    this.entries.push(entry);
    this.bounds += entry.invalidation.bounds.length;
    while (this.entries.length > 64 || this.bounds > 2048) {
      this.bounds -= this.entries.shift()!.invalidation.bounds.length;
    }
  }
  since(base: TerrainIdentity): TerrainColorChange {
    const index = this.entries.findIndex((e) => equalTerrainSource(e.source, base));
    const changes = index < 0 ? [] : this.entries.slice(index + 1);
    return {
      base: { ...base },
      invalidation: {
        reset: index < 0 || changes.some((e) => e.invalidation.reset),
        bounds: changes.flatMap((e) => e.invalidation.bounds.map((b) => ({ ...b }))),
      },
    };
  }
}
