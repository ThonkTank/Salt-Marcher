import type { Note } from './preparation-contracts';

/** Append without rewriting any prior prose or moving material between audiences. */
export function appendNoteExcerpt(
  target: Note,
  source: Note,
  field: 'gmNotes' | 'readAloud',
  text: string,
): Note {
  const supplement =
    field === 'gmNotes' ? '### ' + source.title.replace(/[\r\n]+/g, ' ') + '\n\n' + text : text;
  return {
    ...target,
    [field]: target[field] + (target[field] ? '\n\n' : '') + supplement,
    relations: target.relations.some((r) => r.targetId === source.id && r.label === 'Quelle')
      ? target.relations
      : [...target.relations, { targetId: source.id, label: 'Quelle' }],
  };
}
