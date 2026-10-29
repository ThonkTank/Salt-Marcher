import type { ManualPlan } from '../../features/planner/manual-planner';
import { acknowledgeFields } from '../shared/editor-transition';
import type { EditorSession } from '../shared/editor-session';
import { preserveLiteralEdit } from '../shared/literal-text-edit';
import type { Note } from './note-data';
import {
  preparationTarget,
  type LocationRow,
  type PreparationAPI,
  type PreparationCommand,
  type PreparationDraft,
  type PreparationEdit,
} from './preparation-contracts';

type Kind = PreparationEdit['kind'];
type Context = { token: string; campaignId: string };
type DraftPorts = {
  api: PreparationAPI;
  session: EditorSession;
  context(): Context | null;
  note(id: string): Note | undefined;
  plan(id: string): ManualPlan | undefined;
  location(id: string): LocationRow | undefined;
  failedCommand(): PreparationCommand | null;
  restoreCommand(command: PreparationCommand): void;
  loading(busy: boolean): void;
  feedback(text: string, error?: boolean): void;
  changed(): void;
};
export const preparationDraftKey = (kind: Kind, id: string) => `${kind}:${id}`;
export const equalPreparationValue = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Preserve only editable fields entered after the exact acknowledged command. */
export function preservePreparationPlanInput(
  confirmed: ManualPlan,
  sent: ManualPlan,
  current: ManualPlan,
): ManualPlan {
  const sentVisits = new Map(sent.scenes.map((scene) => [scene.id, scene])),
    currentVisits = new Map(current.scenes.map((scene) => [scene.id, scene]));
  return {
    ...acknowledgeFields(confirmed, sent, current, ['name']).value,
    scenes: confirmed.scenes.map((scene) => {
      const before = sentVisits.get(scene.id),
        draft = currentVisits.get(scene.id);
      return before && draft
        ? acknowledgeFields(scene, before, draft, ['title', 'notes', 'locationId']).value
        : scene;
    }),
  };
}

// Projections are frozen at the boundary: controls can read them, while all
// replacements and persistence remain with this owner. Raw strings are untouched.
function projection<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) projection(child);
    Object.freeze(value);
  }
  return value;
}

export class PreparationDraftOwner {
  #note: Note | null = null;
  #plan: ManualPlan | null = null;
  #location: LocationRow | null = null;
  #retained = new Map<string, PreparationDraft | null>();
  #problems = new Map<string, string>();
  #open = false;
  constructor(private readonly ports: DraftPorts) {}
  get note() {
    return this.#note;
  }
  get plan() {
    return this.#plan;
  }
  get location() {
    return this.#location;
  }
  get openInput() {
    return this.#open;
  }
  get hasProblems() {
    return this.#problems.size > 0;
  }
  get hasRetained() {
    return [...this.#retained.values()].some(Boolean);
  }
  get problems() {
    return [...this.#problems.values()];
  }
  setNote(note: Note | null) {
    this.#note = projection(note);
  }
  setPlan(plan: ManualPlan | null) {
    this.#plan = projection(plan);
  }
  setLocation(location: LocationRow | null) {
    this.#location = projection(location);
  }
  markOpen(open = true) {
    this.#open = open;
  }
  saved(key: string) {
    return this.#retained.get(key);
  }
  hasSaved(key: string) {
    return this.#retained.has(key);
  }
  remember(key: string, draft: PreparationDraft | null) {
    this.#retained.set(key, projection(draft));
  }
  forget(key: string) {
    this.#retained.delete(key);
  }
  problem(key: string) {
    return this.#problems.has(key);
  }
  reset() {
    this.#note = null;
    this.#plan = null;
    this.#location = null;
    this.#retained.clear();
    this.#problems.clear();
    this.#open = false;
  }
  private original(change: PreparationEdit) {
    const target = preparationTarget(change);
    return change.kind === 'note'
      ? this.ports.note(target.id)
      : change.kind === 'plan'
        ? this.ports.plan(target.id)
        : this.ports.location(target.id)?.document;
  }
  pending(kind: Kind): PreparationEdit | null {
    const change: PreparationEdit | null =
      kind === 'note' && this.#note
        ? { kind, expectedRevision: this.#note.revision, note: this.#note }
        : kind === 'plan' && this.#plan
          ? { kind, expectedRevision: this.#plan.revision, plan: this.#plan }
          : kind === 'location' && this.#location
            ? { kind, expectedRevision: this.#location.revision, document: this.#location.document }
            : null;
    if (!change) return null;
    const original = this.original(change);
    const value =
      change.kind === 'note' ? change.note : change.kind === 'plan' ? change.plan : change.document;
    const locationRevision =
      change.kind === 'location' ? this.ports.location(change.document.id)?.revision : undefined;
    return original &&
      (!equalPreparationValue(value, original) ||
        (change.kind === 'location' && change.expectedRevision !== locationRevision))
      ? structuredClone(change)
      : null;
  }
  updateOpenInput() {
    this.#open = !!(this.pending('note') || this.pending('plan') || this.pending('location'));
    if (!this.#open) this.ports.session.input.retained = this.ports.session.input.version;
    return this.#open;
  }
  acknowledge(change: PreparationEdit) {
    if (change.kind === 'note' && this.#note?.id === change.note.id) {
      const original = this.ports.note(change.note.id);
      if (original) this.setNote({ ...this.#note, revision: original.revision });
    } else if (change.kind === 'plan' && this.#plan?.id === change.plan.id) {
      const original = this.ports.plan(change.plan.id);
      if (original) this.setPlan(preservePreparationPlanInput(original, change.plan, this.#plan));
    } else if (change.kind === 'location' && this.#location?.document.id === change.document.id) {
      const original = this.ports.location(change.document.id);
      if (original) this.setLocation({ ...this.#location, revision: original.revision });
    }
  }
  failedPlan(sent: ManualPlan) {
    const original = this.ports.plan(sent.id);
    if (original && this.#plan?.id === sent.id)
      this.setPlan(preservePreparationPlanInput(sent, original, this.#plan));
  }
  async load(kind: Kind, id: string) {
    const key = preparationDraftKey(kind, id),
      context = this.ports.context(),
      request = this.ports.session.generation;
    if (this.#retained.has(key) || !context) return this.#retained.get(key) ?? null;
    const read = this.ports.session.read();
    const current = () =>
      this.ports.context()?.token === context.token && request === this.ports.session.generation;
    this.ports.loading(true);
    try {
      const result = await this.ports.api.preparationDraft(context.token, kind, id);
      if (!result.ok) throw new Error(result.error);
      if (!current()) return null;
      this.remember(key, result.value);
      if (result.value) {
        this.#open = true;
        if (result.value.failedCommand) this.ports.restoreCommand(result.value.failedCommand);
        this.ports.changed();
        this.ports.feedback(
          'Offener Vorbereitungsentwurf wiederaufgenommen. Noch nicht als Autorenstand gespeichert.',
          true,
        );
      }
      return result.value;
    } catch (error) {
      if (!current()) return null;
      const message =
        'Entwurf bleibt gesperrt; Originalbytes bleiben erhalten: ' + (error as Error).message;
      this.remember(key, null);
      this.#problems.set(key, message);
      this.ports.changed();
      this.ports.feedback(message, true);
      return null;
    } finally {
      read.finish();
      if (read.current()) this.ports.loading(this.ports.session.reading > 0);
    }
  }
  async retain() {
    const context = this.ports.context(),
      failedCommand = this.ports.failedCommand();
    if (!context || this.ports.session.reading)
      throw new Error('Die Entwürfe werden noch geladen.');
    if (
      failedCommand &&
      (!['note', 'plan', 'location'].includes(failedCommand.change.kind) ||
        failedCommand.change.expectedRevision === null)
    )
      throw new Error(
        'Dieser offene Anlage-/Papierkorbauftrag muss vor dem Verlassen aufgeklärt werden.',
      );
    const request = this.ports.session.generation,
      inputVersion = this.ports.session.input.version,
      values: PreparationEdit[] = [];
    if (this.#note && this.ports.note(this.#note.id))
      values.push({
        kind: 'note',
        expectedRevision: this.#note.revision,
        note: structuredClone(this.#note),
      });
    if (this.#plan && this.ports.plan(this.#plan.id))
      values.push({
        kind: 'plan',
        expectedRevision: this.#plan.revision,
        plan: structuredClone(this.#plan),
      });
    if (this.#location && this.ports.location(this.#location.document.id))
      values.push({
        kind: 'location',
        expectedRevision: this.#location.revision,
        document: structuredClone(this.#location.document),
      });
    if (failedCommand && ['note', 'plan', 'location'].includes(failedCommand.change.kind)) {
      const target = preparationTarget(failedCommand.change),
        key = preparationDraftKey(target.kind, target.id);
      if (
        !values.some((value) => {
          const owner = preparationTarget(value);
          return owner.kind === target.kind && owner.id === target.id;
        })
      )
        values.push(
          structuredClone(
            this.#retained.get(key)?.change ?? failedCommand.change,
          ) as PreparationEdit,
        );
    }
    const drafts: PreparationDraft[] = [],
      clean: { kind: Kind; id: string; saved: PreparationDraft }[] = [];
    for (const change of values) {
      const target = preparationTarget(change),
        key = preparationDraftKey(target.kind, target.id);
      if (this.#problems.has(key)) continue;
      const failedTarget = failedCommand ? preparationTarget(failedCommand.change) : null,
        failed =
          failedTarget?.kind === target.kind && failedTarget.id === target.id
            ? failedCommand
            : null;
      const original = this.original(change),
        value =
          change.kind === 'note'
            ? change.note
            : change.kind === 'plan'
              ? change.plan
              : change.document;
      const changed =
        !equalPreparationValue(value, original) ||
        (change.kind === 'location' &&
          change.expectedRevision !== this.ports.location(target.id)?.revision);
      if (changed || failed)
        drafts.push({ version: 1, writeId: crypto.randomUUID(), change, failedCommand: failed });
      else {
        const saved = this.#retained.get(key);
        if (saved) clean.push({ ...target, saved });
      }
    }
    if (drafts.length) {
      const result = await this.ports.api.keepPreparationDrafts(context.token, drafts);
      if (!result.ok) throw new Error(result.error);
    }
    for (const item of clean) {
      const result = await this.ports.api.discardPreparationDraft(
        context.token,
        item.kind,
        item.id,
        item.saved.writeId,
      );
      if (!result.ok) throw new Error(result.error);
    }
    if (this.ports.context()?.token !== context.token || request !== this.ports.session.generation)
      return;
    for (const saved of drafts) {
      const t = preparationTarget(saved.change);
      this.remember(preparationDraftKey(t.kind, t.id), saved);
    }
    for (const item of clean) this.remember(preparationDraftKey(item.kind, item.id), null);
    this.ports.session.input.retained = inputVersion;
    this.#open = drafts.length > 0;
  }
  async reconcileRetained(
    command: PreparationCommand,
    token: string,
    sourceBefore: Note | undefined,
    current: () => boolean,
  ): Promise<boolean> {
    const checked = <T>(result: import('../shared/contracts').Result<T>): T => {
      if (!result.ok) throw new Error(result.error);
      return result.value;
    };
    const change = command.change;
    const targetId =
      change.kind === 'note'
        ? change.note.id
        : change.kind === 'plan'
          ? change.plan.id
          : change.kind === 'location'
            ? change.document.id
            : change.id;
    const target = preparationTarget(change),
      key = preparationDraftKey(target.kind, target.id),
      saved = this.saved(key);
    if (saved && change.kind === 'note' && change.excerpt) {
      // This is one guarded append with two provenance directions, never a
      // plain note draft to autosave after an unapplied command.
      if (saved.change.kind !== 'note' || !equalPreparationValue(saved.change.note, change.note))
        throw Error(
          'Weitere Eingaben liegen über dem Auszugsauftrag. Entwurf bleibt zur manuellen Klärung erhalten.',
        );
      checked(
        await this.ports.api.discardPreparationDraft(token, target.kind, target.id, saved.writeId),
      );
      if (!current()) return false;
      this.remember(key, null);
      if (this.note?.id === targetId) this.setNote(structuredClone(this.ports.note(targetId)!));
    } else if (saved) {
      const revision =
        target.kind === 'note'
          ? this.ports.note(target.id)?.revision
          : target.kind === 'plan'
            ? this.ports.plan(target.id)?.revision
            : this.ports.location(target.id)?.revision;
      if (revision === undefined) throw new Error('Der Entwurfsstand ist nicht lesbar.');
      const rebased: PreparationEdit =
        saved.change.kind === 'note'
          ? {
              ...saved.change,
              expectedRevision: revision,
              note: { ...saved.change.note, revision },
            }
          : saved.change.kind === 'plan'
            ? {
                ...saved.change,
                expectedRevision: revision,
                plan: { ...saved.change.plan, revision },
              }
            : { ...saved.change, expectedRevision: revision };
      const next: PreparationDraft = {
        version: 1,
        writeId: crypto.randomUUID(),
        change: rebased,
        failedCommand: null,
      };
      checked(await this.ports.api.keepPreparationDrafts(token, [next]));
      if (!current()) return false;
      this.remember(key, next);
    }
    if (sourceBefore && this.note?.id === sourceBefore.id) {
      const sourceNow = this.ports.note(sourceBefore.id);
      if (
        !sourceNow ||
        !equalPreparationValue(
          { ...sourceBefore, revision: sourceNow.revision, relations: sourceNow.relations },
          sourceNow,
        )
      )
        throw Error(
          'Die Quelle wurde zusätzlich geändert. Entwurf bleibt zur manuellen Klärung erhalten.',
        );
      this.setNote({
        ...this.note,
        revision: sourceNow.revision,
        relations: sourceNow.relations,
      });
    }
    if (
      (change.kind === 'note' || change.kind === 'note-trash') &&
      this.note?.id === targetId &&
      this.ports.note(targetId)
    )
      this.setNote({ ...this.note, revision: this.ports.note(targetId)!.revision });
    if (change.kind === 'plan' && this.plan?.id === targetId && this.ports.plan(targetId))
      this.setPlan({ ...this.plan, revision: this.ports.plan(targetId)!.revision });
    if (
      (change.kind === 'location' || change.kind === 'location-trash') &&
      this.location?.document.id === targetId &&
      this.ports.location(targetId)
    )
      this.setLocation({ ...this.location, revision: this.ports.location(targetId)!.revision });
    return true;
  }
  async discardCommandDraft(command: PreparationCommand, token: string, current: () => boolean) {
    const target = preparationTarget(command.change),
      key = preparationDraftKey(target.kind, target.id),
      saved = this.saved(key);
    if (!saved) return true;
    const result = await this.ports.api.discardPreparationDraft(
      token,
      target.kind,
      target.id,
      saved.writeId,
    );
    if (!result.ok) throw new Error(result.error);
    if (!current()) return false;
    this.remember(key, null);
    return true;
  }
  editNoteField(field: 'title' | 'readAloud' | 'gmNotes', text: string) {
    const note = this.#note,
      before = note ? this.ports.note(note.id) : undefined;
    if (!note || !before) return false;
    this.setNote({
      ...note,
      [field]:
        text === before[field].replace(/\r\n?/g, '\n')
          ? before[field]
          : field === 'title'
            ? text
            : preserveLiteralEdit(note[field], text),
    });
    return true;
  }
  editPlanName(name: string) {
    if (!this.#plan) return false;
    this.setPlan({ ...this.#plan, name });
    return true;
  }
  editSceneField(id: string | null, field: 'title' | 'notes', text: string) {
    const plan = this.#plan;
    if (!plan) return false;
    const before = this.ports.plan(plan.id)?.scenes.find((scene) => scene.id === id);
    this.setPlan({
      ...plan,
      scenes: plan.scenes.map((scene) =>
        scene.id === id
          ? {
              ...scene,
              [field]:
                before && text === before[field].replace(/\r\n?/g, '\n')
                  ? before[field]
                  : field === 'notes'
                    ? preserveLiteralEdit(scene.notes, text)
                    : text,
            }
          : scene,
      ),
    });
    return true;
  }
  editLocationName(name: string) {
    if (!this.#location) return false;
    this.setLocation({ ...this.#location, document: { ...this.#location.document, name } });
    return true;
  }
  editLocationSection(id: string, text: string) {
    const location = this.#location,
      before = location?.document.sections.find((section) => section.id === id);
    if (!location || !before) return false;
    this.setLocation({
      ...location,
      document: {
        ...location.document,
        sections: location.document.sections.map((section) =>
          section.id === id
            ? {
                ...section,
                markdown: text === before.markdown.replace(/\r\n?/g, '\n') ? before.markdown : text,
              }
            : section,
        ),
      },
    });
    return true;
  }
  planInputConflict(confirmed: ManualPlan | undefined): boolean {
    const pending = this.#plan,
      before = pending ? this.ports.plan(pending.id) : undefined;
    if (!pending || !before) return false;
    if (!confirmed) return true;
    if (
      pending.name !== before.name &&
      confirmed.name !== before.name &&
      confirmed.name !== pending.name
    )
      return true;
    return pending.scenes.some((draft) => {
      const base = before.scenes.find((scene) => scene.id === draft.id);
      if (!base) return false;
      const fields = (['title', 'notes', 'locationId'] as const).filter(
          (field) => draft[field] !== base[field],
        ),
        current = confirmed.scenes.find((scene) => scene.id === draft.id);
      return fields.some(
        (field) => !current || (current[field] !== base[field] && current[field] !== draft[field]),
      );
    });
  }
}
