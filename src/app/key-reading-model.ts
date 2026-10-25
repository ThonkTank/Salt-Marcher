import type { Room } from './contracts';
import type { KeyContent, KeyBlock, KeyRendered } from './key-contracts';
import { templateBlockId } from './key-model';
import { rawTextOffset } from './text-references';
export type KeyPassageSource =
  | { kind: 'legacy'; sectionId: string; expectedText: string }
  | { kind: 'text'; ownerId: string; blockId: string; expectedText: string };
export type KeyPassageTarget = KeyPassageSource & { start: number; end: number };
export interface KeyDocumentSource {
  id: string;
  label: string;
  visibility: string;
  text: string;
  target: KeyPassageSource | null;
}
export interface KeyDocumentPart {
  source: KeyDocumentSource;
  start: number;
  end: number;
  text: string;
  level: number;
}
export interface KeyBookmark {
  sourceId: string;
  offset: number;
  query: string;
}

/** Read projections retain source offsets; Markdown is never rewritten into author state. */
export function keyDocumentSources(
  room: Room,
  records: KeyContent[],
  rendered: KeyRendered,
  known = new Set<string>(),
): KeyDocumentSource[] {
  const key = records.find((k) => k.kind === 'room' && k.id === room.id),
    origins = new Map<string, { owner: KeyContent; block: KeyBlock }>();
  if (key)
    for (const b of key.blocks) {
      if (b.kind !== 'template') origins.set(b.id, { owner: key, block: b });
      else {
        const template = records.find(
          (t) => t.kind === 'template' && t.id === b.templateId && t.scopeId === room.scopeId,
        );
        if (template)
          for (const child of template.blocks)
            origins.set(templateBlockId(b.id, child.id), { owner: template, block: child });
      }
    }
  const sources: KeyDocumentSource[] = [];
  for (const b of rendered.blocks) {
    const origin = origins.get(b.id),
      label =
        (b.visibility === 'secret'
          ? 'Geheimnis · ' + (known.has(b.id) ? 'für Gruppe bestätigt' : 'noch nicht bestätigt')
          : b.visibility === 'gm'
            ? 'GM-Notiz'
            : 'Beschreibung') +
        (origin?.owner.kind === 'template' ? ' · Vorlage ' + origin.owner.name : '');
    if (origin?.block.kind === 'legacy' || (!key && b.id === room.id)) {
      for (const section of room.sections)
        if (section.kind === 'markdown' && section.markdown)
          sources.push({
            id: b.id + '/' + section.id,
            label: 'Vorhandener Raumkey · ' + label,
            visibility: b.visibility,
            text: section.markdown,
            target: { kind: 'legacy', sectionId: section.id, expectedText: section.markdown },
          });
    } else
      sources.push({
        id: b.id,
        label,
        visibility: b.visibility,
        text: b.text,
        target:
          origin?.block.kind === 'text' && origin.block.text === b.text
            ? {
                kind: 'text',
                ownerId: origin.owner.id,
                blockId: origin.block.id,
                expectedText: origin.block.text,
              }
            : null,
      });
    if (b.visibility === 'secret') {
      const detail = [
        b.searchMethod,
        typeof b.dc === 'number' ? 'DC ' + b.dc : '',
        b.discoveryNotes,
      ]
        .filter(Boolean)
        .join(' · ');
      if (detail)
        sources.push({
          id: b.id + '/discovery',
          label: 'Private Entdeckungshinweise',
          visibility: 'secret',
          text: detail,
          target: null,
        });
    }
  }
  return sources;
}
export function keyDocumentParts(source: KeyDocumentSource) {
  const parts: KeyDocumentPart[] = [],
    text = source.text;
  let begin = -1,
    end = 0,
    fence: { char: string; size: number } | null = null,
    limited = false;
  const push = (start: number, to: number, level = 0, display = text.slice(start, to)) => {
    if (to > start) parts.push({ source, start, end: to, text: display, level });
  };
  const flush = () => {
    if (begin >= 0) push(begin, end);
    begin = -1;
  };
  const lines = /[^\r\n]+(?:\r\n|\r|\n|$)|(?:\r\n|\r|\n)/g;
  let m: RegExpExecArray | null;
  while ((m = lines.exec(text))) {
    const raw = m[0],
      body = raw.replace(/[\r\n]+$/, ''),
      at = m.index,
      to = at + body.length,
      marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(body);
    if (parts.length >= 1999) {
      flush();
      push(at, text.length);
      limited = true;
      break;
    }
    if (fence) {
      end = to;
      if (
        marker &&
        marker[1]![0] === fence.char &&
        marker[1]!.length >= fence.size &&
        !marker[2]!.trim()
      ) {
        fence = null;
        flush();
      }
      continue;
    }
    if (marker && (marker[1]![0] === '~' || !marker[2]!.includes('`'))) {
      flush();
      begin = at;
      end = to;
      fence = { char: marker[1]![0]!, size: marker[1]!.length };
      continue;
    }
    const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/.exec(body);
    if (heading) {
      flush();
      const start = at + body.indexOf(heading[2]!, heading[1]!.length);
      push(start, start + heading[2]!.length, heading[1]!.length, heading[2]!);
      continue;
    }
    if (begin >= 0 && /^ {0,3}(=+|-+)\s*$/.test(body) && !/[\r\n]/.test(text.slice(begin, end))) {
      push(begin, end, body.trim()[0] === '=' ? 1 : 2);
      begin = -1;
      continue;
    }
    if (!body.trim()) {
      flush();
      continue;
    }
    if (begin < 0) begin = at;
    end = to;
  }
  flush();
  return { parts, limited };
}
export function passageTarget(
  part: KeyDocumentPart,
  start = part.start,
  end = part.end,
): KeyPassageTarget | null {
  return part.source.target ? { ...part.source.target, start, end } : null;
}
/** Preserve untouched raw spans, including mixed line endings, around a textarea edit. */
export function editTextareaText(raw: string, value: string) {
  const old = raw.replace(/\r\n?/g, '\n'),
    next = value.replace(/\r\n?/g, '\n');
  if (old === next) return raw;
  let start = 0;
  while (start < old.length && start < next.length && old[start] === next[start]) start++;
  let a = old.length,
    b = next.length;
  while (a > start && b > start && old[a - 1] === next[b - 1]) {
    a--;
    b--;
  }
  const newline = raw.includes('\r\n')
    ? '\r\n'
    : raw.includes('\r') && !raw.includes('\n')
      ? '\r'
      : '\n';
  return (
    raw.slice(0, rawTextOffset(raw, start)) +
    next.slice(start, b).replace(/\n/g, newline) +
    raw.slice(rawTextOffset(raw, a))
  );
}
