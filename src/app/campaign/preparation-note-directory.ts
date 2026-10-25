import type { Preparation } from './preparation-contracts';

/** The unfiltered directory owns note identities; a search result is only a
 * view and must not evict the currently edited note. */
export class PreparationNoteDirectory {
  readonly notes = new Map<string, Preparation['notes'][number]>();
  request = 0;
  error: { query: string; message: string } | null = null;
  reset() {
    this.notes.clear();
    this.request++;
    this.error = null;
  }
  accept(rows: Preparation['notes'], filtered: boolean) {
    if (!filtered) this.reset();
    for (const row of rows) this.notes.set(row.note.id, row);
  }
  row(id: string | null) {
    return id ? this.notes.get(id) : undefined;
  }
}
