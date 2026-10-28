import type { LandscapeBox } from './landscape-bounds';
import type { LandscapeRecord } from './landscape-contracts';
import type { TerrainEditingSource } from './terrain-grid-contracts';

export type TerrainEditingIdentity = { revision: number; fence: string; radius: number };
export const editingContains = (outer: LandscapeBox, inner: LandscapeBox) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** Exact author data is independent of the display tile cache. A partial or
 * superseded packet sequence never qualifies a brush gesture. */
export class AtlasTerrainEditingSource {
  source: TerrainEditingSource | null = null;
  private generation = 0;
  private pending: {
    identity: string;
    box: LandscapeBox;
    result: Promise<TerrainEditingSource | null>;
  } | null = null;
  private identity(i: TerrainEditingIdentity) {
    return JSON.stringify([i.revision, i.fence, i.radius]);
  }
  ready(i: TerrainEditingIdentity, box: LandscapeBox) {
    const s = this.source;
    return (
      !!s &&
      s.complete === true &&
      this.identity(s) === this.identity(i) &&
      editingContains(s.box, box)
    );
  }
  clear() {
    this.generation++;
    this.source = null;
    this.pending = null;
  }
  async load(
    identity: TerrainEditingIdentity,
    box: LandscapeBox,
    fetch: (after: string) => Promise<TerrainEditingSource>,
  ): Promise<TerrainEditingSource | null> {
    if (this.ready(identity, box)) return this.source;
    const key = this.identity(identity);
    if (this.pending?.identity === key && editingContains(this.pending.box, box))
      return this.pending.result;
    const generation = ++this.generation;
    const result = (async () => {
      const records = new Map<string, LandscapeRecord>();
      let after = '';
      for (;;) {
        const page = await fetch(after);
        if (generation !== this.generation) return null;
        if (this.identity(page) !== key || !editingContains(page.box, box))
          throw Error('Höhenpaket gehört nicht zum angeforderten Bereich.');
        for (const record of page.records) records.set(record.id, record);
        if (page.complete === true) {
          this.source = {
            ...page,
            next: undefined,
            records: [...records.values()],
            complete: true,
          };
          return this.source;
        }
        if (!page.next || page.next <= after)
          throw Error('Unvollständiges Höhenpaket ohne Fortsetzung.');
        after = page.next;
      }
    })();
    this.pending = { identity: key, box, result };
    try {
      return await result;
    } finally {
      if (generation === this.generation) this.pending = null;
    }
  }
}
