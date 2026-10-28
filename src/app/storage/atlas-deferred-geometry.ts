import type { AtlasRegionSource } from '../atlas/atlas-region-view-contracts';
const tables = new Set([
  'room',
  'drawing_element',
  'city_document',
  'city_unit',
  'dungeon_volume',
  'drawing_hidden',
  'drawing_floor',
  'atlas_binding',
]);
/** Terrain jobs consume the shared source cursor too. Keep their geometry changes
 * until a geometry job applies them, with the same bounded fallback as the journal. */
export class AtlasDeferredGeometry {
  private reset = true;
  private changes = new Map<string, AtlasRegionSource['changes'][number]>();
  private bytes = 0;
  observe(source: AtlasRegionSource) {
    if (source.reset) this.invalidate();
    if (this.reset) return;
    for (const change of source.changes) {
      if (!tables.has(change.table)) continue;
      const key = JSON.stringify([change.table, change.id]);
      if (!this.changes.has(key)) {
        this.bytes += key.length * 2 + 128;
        this.changes.set(key, change);
      }
      if (this.changes.size > 10000 || this.bytes > 1024 * 1024) {
        this.invalidate();
        break;
      }
    }
  }
  source(current: AtlasRegionSource): AtlasRegionSource {
    return { ...current, reset: this.reset, changes: [...this.changes.values()] };
  }
  accepted() {
    this.reset = false;
    this.changes.clear();
    this.bytes = 0;
  }
  invalidate() {
    this.reset = true;
    this.changes.clear();
    this.bytes = 0;
  }
}
