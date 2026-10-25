import type { Room } from './contracts';
import type { KeyContent } from './key-contracts';
import { expandedKeyBlocks, keyAttributes, templateBlockId } from './key-model';

export interface KeySearchReference {
  kind: string;
  id: string;
  label: string;
}
export interface KeySearchHit {
  label: string;
  excerpt: string;
}
const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();

// A read-only projection of one confirmed key snapshot. Reused templates are
// searched at their room, without copying their text into the authored key.
export class RoomKeySearchIndex {
  private keys: Map<string, KeyContent>;
  private labels: Map<string, string>;
  private fields = new WeakMap<Room, { label: string; text: string }[]>();
  constructor(
    private records: KeyContent[],
    references: KeySearchReference[] = [],
  ) {
    this.keys = new Map(records.map((key) => [key.id, key]));
    this.labels = new Map(references.map((ref) => [JSON.stringify([ref.kind, ref.id]), ref.label]));
  }
  private entries(room: Room) {
    const cached = this.fields.get(room);
    if (cached) return cached;
    const fields: { label: string; text: string }[] = [],
      add = (label: string, text: string | undefined) => {
        if (text?.trim()) fields.push({ label, text: normalize(text) });
      };
    add('Raum', room.number + '. ' + room.name);
    for (const section of room.sections)
      if (section.kind === 'markdown') add('Vorhandener Raumkey', section.markdown);
    const key = this.keys.get(room.id);
    if (key?.kind === 'room' && key.scopeId === room.scopeId) {
      add('Status', key.status);
      for (const tag of key.tags) add('Tag', tag);
      const sources = new Map<string, string>();
      for (const block of key.blocks) {
        if (block.kind !== 'template') continue;
        const template = this.keys.get(block.templateId ?? '');
        if (template?.kind !== 'template' || template.scopeId !== room.scopeId) continue;
        add('Textvorlage', template.name);
        for (const child of template.blocks)
          sources.set(templateBlockId(block.id, child.id), 'Vorlage · ' + template.name);
      }
      for (const block of expandedKeyBlocks(key, this.records)) {
        const source =
          sources.get(block.id) ??
          (block.visibility === 'public'
            ? 'Vorlesetext'
            : block.visibility === 'secret'
              ? 'Geheimnis'
              : 'GM-Notiz');
        if (block.kind === 'text') add(source, block.text);
        add(source + ' · Entdeckung', block.searchMethod);
        add(source + ' · Entdeckung', block.discoveryNotes);
        add(source + ' · Nach Entdeckung', block.revealedText);
      }
      for (const attribute of keyAttributes(key, this.records))
        if (attribute.value !== null)
          add('Eigenschaft · ' + attribute.origin, attribute.key + ': ' + attribute.value);
      for (const ref of key.references)
        add('Verweis', this.labels.get(JSON.stringify([ref.kind, ref.id])) ?? ref.label);
    }
    this.fields.set(room, fields);
    return fields;
  }
  find(room: Room, query: string): KeySearchHit | null {
    const q = normalize(query).toLocaleLowerCase();
    if (!q) return { label: '', excerpt: '' };
    for (const field of this.entries(room)) {
      const index = field.text.toLocaleLowerCase().indexOf(q);
      if (index < 0) continue;
      const start = Math.max(0, index - 45),
        end = Math.min(field.text.length, index + q.length + 85);
      return {
        label: field.label,
        excerpt:
          (start ? '…' : '') + field.text.slice(start, end) + (end < field.text.length ? '…' : ''),
      };
    }
    return null;
  }
}
