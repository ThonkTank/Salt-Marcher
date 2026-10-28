import { type Note, type NoteRow } from './note-data';
import {
  checkedNoteMerge,
  type NoteMergeChange,
  type NoteMergePreview,
} from './note-merge-contracts';
import { manualPlan, type ManualPlan } from '../../features/planner/manual-planner';
import { worldNoteDocument } from '../../features/world/world-notes';
import {
  checkedLocationDocument,
  type LocationDocument,
} from '../../features/location/location-schema';
export interface LocationRow {
  document: LocationDocument;
  revision: number;
  trashed: boolean;
}
export interface PreparationSelection {
  noteId: string | null;
  planId: string | null;
  sceneId: string | null;
  locationId?: string | null;
}
export interface Preparation {
  notes: NoteRow[];
  plans: ManualPlan[];
  locations: LocationRow[];
  maps: { id: string; name: string }[];
  problems: string[];
  selection: PreparationSelection;
}
/** Exact source selection. The writer preserves its prose and publishes both links atomically. */
export interface NoteExcerptSource {
  id: string;
  revision: number;
  field: 'readAloud' | 'gmNotes';
  start: number;
  end: number;
  allowSameTitle?: boolean;
}
export type PreparationChange =
  | { kind: 'note'; expectedRevision: number | null; note: Note; excerpt?: NoteExcerptSource }
  | NoteMergeChange
  | { kind: 'note-trash'; id: string; expectedRevision: number; trashed: boolean }
  | { kind: 'location'; expectedRevision: number | null; document: LocationDocument }
  | { kind: 'location-trash'; id: string; expectedRevision: number; trashed: boolean }
  | {
      kind: 'plan';
      expectedRevision: number | null;
      plan: ManualPlan;
      opening?: {
        visitId: string;
        readAloud: string;
        noteIds: string[];
        noteThread?: import('./note-thread-contracts').NoteThreadSelection;
      };
    };
export interface SceneCreation {
  sceneId: string;
  expectedSceneRevision: number;
  expectedMembershipRevision: number;
  expectedDeskRevision: number;
  pin: boolean;
  contributors: string[];
}
export interface PreparationCommand {
  sceneCreation?: SceneCreation;
  commandId: string;
  token: string;
  campaignId?: string;
  draftWriteId?: string;
  change: PreparationChange;
}
export type PreparationEdit = Extract<PreparationChange, { kind: 'note' | 'plan' | 'location' }>;
export interface PreparationDraft {
  version: 1;
  writeId: string;
  change: PreparationEdit;
  failedCommand: PreparationCommand | null;
}
function draftFields(value: object, required: string[], optional: string[] = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))
  )
    throw new Error('Unbekannte Entwurfsfelder.');
}
export function preparationTarget(change: PreparationChange): {
  kind: 'note' | 'plan' | 'location';
  id: string;
} {
  if (change.kind === 'note') return { kind: 'note', id: change.note.id };
  if (change.kind === 'plan') return { kind: 'plan', id: change.plan.id };
  if (change.kind === 'location') return { kind: 'location', id: change.document.id };
  return {
    kind: change.kind === 'note-trash' || change.kind === 'note-merge' ? 'note' : 'location',
    id: change.id,
  };
}
/** Check structural identity while preserving unfinished text verbatim. */
export function checkedPreparationDraft(value: PreparationDraft): PreparationDraft {
  draftFields(value, ['version', 'writeId', 'change', 'failedCommand']);
  if (
    !value ||
    value.version !== 1 ||
    typeof value.writeId !== 'string' ||
    !value.writeId ||
    !value.change ||
    !['note', 'plan', 'location'].includes(value.change.kind) ||
    !Number.isSafeInteger(value.change.expectedRevision) ||
    value.change.expectedRevision! < 1 ||
    !Object.hasOwn(value, 'failedCommand')
  )
    throw new Error('Ungültiger Vorbereitungsentwurf.');
  const change = value.change;
  draftFields(
    change,
    [
      'kind',
      'expectedRevision',
      change.kind === 'note' ? 'note' : change.kind === 'plan' ? 'plan' : 'document',
    ],
    change.kind === 'note' ? ['excerpt'] : [],
  );
  if (change.kind === 'note') {
    draftFields(change.note, [
      'version',
      'id',
      'revision',
      'kind',
      'title',
      'readAloud',
      'gmNotes',
      'relations',
      'creatureId',
      'deleted',
    ]);
    if (!Array.isArray(change.note.relations)) throw new Error('Ungültige Entwurfsbeziehungen.');
    for (const relation of change.note.relations)
      draftFields(relation, ['targetId', 'label'], ['familyKind']);
    if (typeof change.note?.title !== 'string') throw new Error('Ungültiger Entwurfstitel.');
    worldNoteDocument({ ...change.note, title: 'Draftstruktur' });
    if (change.note.deleted || change.note.revision !== change.expectedRevision)
      throw new Error('Entwurfsbasis stimmt nicht.');
    if (change.excerpt !== undefined)
      validatePreparation({ ...change, note: { ...change.note, title: 'Draftstruktur' } });
  } else if (change.kind === 'plan') {
    manualPlan(change.plan);
    if (change.plan.revision !== change.expectedRevision)
      throw new Error('Entwurfsbasis stimmt nicht.');
  } else {
    if (typeof change.document?.name !== 'string') throw new Error('Ungültiger Entwurfsname.');
    checkedLocationDocument({ ...change.document, name: 'Draftstruktur' });
  }
  if (value.failedCommand !== null) {
    const command = value.failedCommand;
    draftFields(command, ['commandId', 'token', 'campaignId', 'change'], ['draftWriteId']);
    if (
      command.draftWriteId !== undefined &&
      (typeof command.draftWriteId !== 'string' || !command.draftWriteId)
    )
      throw new Error('Ungültige Entwurfskennung im Änderungsauftrag.');
    if (
      !command ||
      typeof command.commandId !== 'string' ||
      !command.commandId ||
      typeof command.token !== 'string' ||
      typeof command.campaignId !== 'string' ||
      !command.change ||
      !['note', 'plan', 'location'].includes(command.change.kind)
    )
      throw new Error('Ungültiger gespeicherter Änderungsauftrag.');
    const target = preparationTarget(change),
      failedTarget = preparationTarget(command.change);
    if (
      target.kind !== failedTarget.kind ||
      target.id !== failedTarget.id ||
      command.change.expectedRevision !== change.expectedRevision
    )
      throw new Error('Änderungsauftrag gehört zu einem anderen Entwurfsziel.');
    // The failed request may itself contain unfinished text rejected before commit.
    checkedPreparationDraft({
      version: 1,
      writeId: value.writeId,
      change: command.change as PreparationEdit,
      failedCommand: null,
    });
  }
  return value;
}
export interface NoteRoomUsesPage {
  entries: {
    id: string;
    title: string;
    number: string;
    place: string;
    excerpt: string;
    unavailable: boolean;
  }[];
  next: number | null;
  notice?: string;
}
export interface PlanReconciliation {
  outcome: 'applied' | 'not-applied' | 'conflict';
  targetChanged: boolean;
  plan: ManualPlan | null;
}
export interface PreparationAPI {
  noteMergePreview(
    token: string,
    sourceId: string,
    targetId: string,
  ): Promise<import('../shared/contracts').Result<NoteMergePreview>>;
  noteRoomUses(
    token: string,
    noteId: string,
    offset: number,
  ): Promise<import('../shared/contracts').Result<NoteRoomUsesPage>>;
  preparation(
    token: string,
    search: string,
  ): Promise<import('../shared/contracts').Result<Preparation>>;
  changePreparation(
    command: PreparationCommand,
  ): Promise<import('../shared/contracts').Result<Preparation>>;
  changePreparationPlan(
    command: PreparationCommand,
  ): Promise<import('../shared/contracts').Result<ManualPlan>>;
  reconcilePreparationPlan(
    command: PreparationCommand,
    token?: string,
  ): Promise<import('../shared/contracts').Result<PlanReconciliation>>;
  selectPreparation(
    token: string,
    selection: PreparationSelection,
  ): Promise<import('../shared/contracts').Result<void>>;
  reconcilePreparation(
    command: PreparationCommand,
    token?: string,
  ): Promise<
    import('../shared/contracts').Result<{
      outcome: 'applied' | 'not-applied' | 'conflict';
      targetChanged: boolean;
      data: Preparation;
    }>
  >;
  preparationDraft(
    token: string,
    kind: PreparationEdit['kind'],
    id: string,
  ): Promise<import('../shared/contracts').Result<PreparationDraft | null>>;
  keepPreparationDrafts(
    token: string,
    drafts: PreparationDraft[],
  ): Promise<import('../shared/contracts').Result<void>>;
  discardPreparationDraft(
    token: string,
    kind: PreparationEdit['kind'],
    id: string,
    writeId: string,
  ): Promise<import('../shared/contracts').Result<void>>;
}
export function validatePreparation(change: PreparationChange) {
  if (change.kind === 'note-merge') return checkedNoteMerge(change);
  if (change.kind === 'note') {
    const note = worldNoteDocument(change.note);
    if (note.deleted) throw new Error('Notizen werden in den Papierkorb verschoben.');
    if ([note.title, note.readAloud, note.gmNotes].some((text) => text.length > 2_000_000))
      throw new Error('Ein Notizfeld ist für diesen Anschluss zu groß.');
    const s = change.excerpt;
    if (
      s !== undefined &&
      (!s ||
        typeof s.id !== 'string' ||
        !s.id ||
        s.id === note.id ||
        !Number.isSafeInteger(s.revision) ||
        s.revision < 1 ||
        !['readAloud', 'gmNotes'].includes(s.field) ||
        !Number.isSafeInteger(s.start) ||
        !Number.isSafeInteger(s.end) ||
        s.start < 0 ||
        s.end <= s.start ||
        (s.allowSameTitle !== undefined && typeof s.allowSameTitle !== 'boolean'))
    )
      throw new Error('Ungültiger Notizauszug.');
    return { ...change, note };
  }
  if (change.kind === 'plan') {
    const plan = manualPlan(change.plan),
      o = change.opening;
    if (
      o !== undefined &&
      (!o ||
        !plan.scenes.some((scene) => scene.id === o.visitId) ||
        typeof o.readAloud !== 'string' ||
        o.readAloud.length > 2000000 ||
        !Array.isArray(o.noteIds) ||
        o.noteIds.length > 1000 ||
        o.noteIds.some((id) => typeof id !== 'string' || !id || id.length > 1000))
    )
      throw new Error('Ungültige Einstiegstexte oder Ortsquellen.');
    return { ...change, plan };
  }
  if (change.kind === 'location')
    return { ...change, document: checkedLocationDocument(change.document) };
  if (
    !['note-trash', 'location-trash'].includes(change.kind) ||
    !('id' in change) ||
    typeof change.id !== 'string' ||
    typeof change.trashed !== 'boolean' ||
    !Number.isSafeInteger(change.expectedRevision)
  )
    throw new Error('Ungültige Vorbereitungsänderung.');
  return change;
}
