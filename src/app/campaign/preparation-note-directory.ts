import type { ManualPlan } from '../../features/planner/manual-planner';
import type { Preparation } from './preparation-contracts';

const emptyPreparation = (): Preparation => ({
  notes: [],
  plans: [],
  locations: [],
  maps: [],
  problems: [],
  selection: { noteId: null, planId: null, sceneId: null },
});
function confirmedProjection<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) confirmedProjection(child);
    Object.freeze(value);
  }
  return value;
}

/** Confirmed preparation objects and unfiltered note identities have one owner.
 * Search results are projections and must not evict the edited original note. */
export class PreparationNoteDirectory {
  readonly #notes = new Map<string, Preparation['notes'][number]>();
  #preparation = confirmedProjection(emptyPreparation());
  request = 0;
  error: { query: string; message: string } | null = null;
  get notes(): ReadonlyMap<string, Preparation['notes'][number]> {
    return this.#notes;
  }
  get preparation() {
    return this.#preparation;
  }
  reset() {
    this.#notes.clear();
    this.request++;
    this.error = null;
    this.#preparation = confirmedProjection(emptyPreparation());
  }
  accept(rows: Preparation['notes'], filtered: boolean) {
    if (!filtered) {
      this.#notes.clear();
      this.request++;
      this.error = null;
    }
    for (const row of rows) this.#notes.set(row.note.id, confirmedProjection(row));
  }
  acceptPreparation(next: Preparation, filtered: boolean) {
    this.accept(next.notes, filtered);
    this.#preparation = confirmedProjection(next);
  }
  acceptPlan(plan: ManualPlan | null, id: string) {
    if (plan && plan.id !== id)
      throw new Error('Planantwort gehört nicht zum ursprünglichen Auftrag.');
    const plans = this.#preparation.plans.filter((row) => row.id !== id);
    if (plan) plans.push(plan);
    plans.sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    this.#preparation = confirmedProjection({ ...this.#preparation, plans });
  }
  row(id: string | null) {
    return id ? this.#notes.get(id) : undefined;
  }
}
