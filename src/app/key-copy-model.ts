import type { Room } from './contracts';
import {
  emptyKey,
  type KeyContent,
  type KeyCopyOptions,
  type KeyBatch,
  type KeyBlock,
} from './key-contracts';
import { expandedKeyBlocks, keyAncestors, keyAttributes } from './key-model';

export const keyCopyFields = {
  name: 'Raumname',
  public: 'Vorlesetexte',
  gm: 'GM-Texte',
  blocks: 'Alle Beschreibungsblöcke',
  attributes: 'Attribute',
  tags: 'Tags',
  references: 'Referenzen',
  secret: 'Geheimstatus',
  status: 'Vorbereitungsstatus',
} as const;
export function validateKeyCopy(options: KeyCopyOptions) {
  if (
    !options ||
    !Array.isArray(options.fields) ||
    !options.fields.length ||
    new Set(options.fields).size !== options.fields.length ||
    options.fields.some((f) => !Object.hasOwn(keyCopyFields, f)) ||
    !['append', 'replace'].includes(options.mode) ||
    !['own', 'effective'].includes(options.attributes)
  )
    throw new Error('Inhalte und Übernahmemodus auswählen.');
  if (options.fields.includes('blocks') && options.fields.some((f) => f === 'public' || f === 'gm'))
    throw new Error('Alle Blöcke oder einzelne Textarten wählen.');
}
export function keyCopyDependencies(room: Room, records: KeyContent[], options: KeyCopyOptions) {
  validateKeyCopy(options);
  const content = records.find((k) => k.id === room.id && k.kind === 'room'),
    required = new Map<string, KeyContent>();
  if (content) {
    if (options.fields.includes('attributes') && options.attributes === 'effective') {
      for (const id of [content.levelId, content.groupId])
        if (id && !records.some((k) => k.id === id && k.scopeId === room.scopeId))
          throw new Error('Geerbte Quellwerte fehlen. Dungeon-Key aktualisieren.');
      for (const key of keyAncestors(content, records))
        if (key.id !== content.id) required.set(key.id, key);
    }
    if (options.fields.some((f) => ['blocks', 'public', 'gm'].includes(f)))
      for (const block of content.blocks)
        if (block.kind === 'template') {
          const template = records.find(
            (k) => k.id === block.templateId && k.kind === 'template' && k.scopeId === room.scopeId,
          );
          if (!template) throw new Error('Quellvorlage fehlt. Dungeon-Key aktualisieren.');
          required.set(template.id, template);
        }
  }
  return [...required.values()]
    .map((k) => ({ id: k.id, revision: k.revision }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
/** Independent semantic copy. Never carries geometry, assignments, numbers or discovery IDs. */
export function copyKeyPatch(
  source: Room,
  target: Room,
  records: KeyContent[],
  options: KeyCopyOptions,
  uuid: () => string,
): KeyBatch {
  keyCopyDependencies(source, records, options);
  if (source.id === target.id || source.scopeId !== target.scopeId)
    throw new Error('Verschiedene Räume desselben Dungeons wählen.');
  const original = records.find((k) => k.id === source.id && k.kind === 'room') ?? emptyKey(source),
    current = records.find((k) => k.id === target.id && k.kind === 'room') ?? emptyKey(target),
    fields = new Set(options.fields),
    patch: KeyBatch = {};
  if (fields.has('name')) patch.name = { mode: 'replace', text: source.name };
  if (fields.has('attributes')) {
    patch.attributes =
      options.attributes === 'effective'
        ? Object.fromEntries(keyAttributes(original, records).map((a) => [a.key, a.value]))
        : structuredClone(original.attributes);
    patch.attributeMode = options.mode === 'replace' ? 'replace' : 'merge';
  }
  if (fields.has('tags'))
    patch.tags =
      options.mode === 'replace'
        ? [...original.tags]
        : [...new Set([...current.tags, ...original.tags])];
  if (fields.has('references')) {
    const refs =
      options.mode === 'replace'
        ? original.references
        : [...current.references, ...original.references];
    patch.references = refs
      .filter((r, i) => refs.findIndex((t) => t.kind === r.kind && t.id === r.id) === i)
      .map((r) => ({ ...r }));
  }
  if (fields.has('secret')) patch.secret = original.secret;
  if (fields.has('status')) patch.status = original.status;
  const all = fields.has('blocks'),
    prose = fields.has('public') || fields.has('gm');
  if (all || prose) {
    const selected = (b: KeyBlock) =>
      all ||
      (['text', 'legacy'].includes(b.kind) &&
        ((b.visibility === 'public' && fields.has('public')) ||
          (b.visibility === 'gm' && fields.has('gm'))));
    const copied = expandedKeyBlocks(original, records)
      .filter(selected)
      .map((b) => ({
        ...structuredClone(b),
        id: uuid(),
        templateId: null,
        ...(b.kind === 'legacy'
          ? {
              kind: 'text' as const,
              text: source.sections
                .filter((s) => s.kind === 'markdown')
                .map((s) => s.markdown ?? '')
                .join('\n\n'),
            }
          : {}),
      }));
    const old = structuredClone(current.blocks);
    if (!all && options.mode === 'replace') {
      const authored = new Set(current.blocks.map((b) => b.id));
      if (expandedKeyBlocks(current, records).some((b) => !authored.has(b.id) && selected(b)))
        throw new Error(
          'Ziel „' +
            target.name +
            '“ nutzt verknüpfte Texte. Ergänzen wählen, die Vorlage lösen oder ausdrücklich alle Blöcke ersetzen.',
        );
    }
    if (options.mode === 'append') patch.blocks = [...old, ...copied];
    else {
      const first = old.findIndex(selected),
        kept = old.filter((b) => !selected(b));
      kept.splice(
        first < 0 ? kept.length : old.slice(0, first).filter((b) => !selected(b)).length,
        0,
        ...copied,
      );
      patch.blocks = kept;
    }
  }
  return patch;
}
