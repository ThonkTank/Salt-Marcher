import type { DeskRef } from '../shared/desk-reference';
export interface TextReference {
  ref: DeskRef;
  label: string;
  start: number;
  end: number;
  targetStart: number;
  targetEnd: number;
}
const escaped = (text: string, at: number) => {
  let slashes = 0;
  while (at > 0 && text[--at] === '\\') slashes++;
  return slashes % 2 === 1;
};
type Range = readonly [number, number];
/** Recognize only our declared inline-link dialect; never interpret author code as a target. */
function literalRanges(text: string): Range[] {
  const blocks: Range[] = [];
  let start = 0,
    fence: { char: string; size: number; start: number } | null = null;
  for (const line of text.split(/(?<=\n)/)) {
    const body = line.replace(/[\r\n]+$/, ''),
      marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(body);
    if (fence) {
      if (
        marker &&
        marker[1]![0] === fence.char &&
        marker[1]!.length >= fence.size &&
        !marker[2]!.trim()
      ) {
        blocks.push([fence.start, start + line.length]);
        fence = null;
      }
    } else if (marker && (marker[1]![0] === '~' || !marker[2]!.includes('`')))
      fence = { char: marker[1]![0]!, size: marker[1]!.length, start };
    else if (/^( {4}|\t)/.test(body)) blocks.push([start, start + line.length]);
    start += line.length;
  }
  if (fence) blocks.push([fence.start, text.length]);
  const ranges: Range[] = [...blocks];
  const inline = (from: number, to: number) => {
    // Inline code cannot continue through a blank paragraph or a literal block.
    const segment = text.slice(from, to),
      paragraph = /\n[ \t\r]*\n/g;
    let part = 0,
      match: RegExpExecArray | null;
    const scan = (end: number) => {
      const runs = [...segment.slice(part, end).matchAll(/`+/g)].map((m) => ({
          at: from + part + m.index,
          size: m[0].length,
          next: -1,
        })),
        next = new Map<number, number>();
      for (let i = runs.length - 1; i >= 0; i--) {
        const r = runs[i]!;
        r.next = next.get(r.size) ?? -1;
        next.set(r.size, i);
      }
      for (let i = 0; i < runs.length; i++) {
        const r = runs[i]!;
        if (escaped(text, r.at) || r.next < 0) continue;
        const close = runs[r.next]!;
        ranges.push([r.at, close.at + close.size]);
        i = r.next;
      }
    };
    while ((match = paragraph.exec(segment))) {
      scan(match.index);
      part = paragraph.lastIndex;
    }
    scan(segment.length);
  };
  let cursor = 0;
  for (const [from, to] of blocks) {
    inline(cursor, from);
    cursor = to;
  }
  inline(cursor, text.length);
  return ranges.sort((a, b) => a[0] - b[0]);
}
export function textReferences(text: string, limit = 200): TextReference[] {
  const pattern =
      /\[((?:\\.|[^\[\]\\])*)\]\(dungeon-ref:(note|location|creature|item|encounter)\/([^()\s]+)\)/g,
    links: TextReference[] = [],
    literals = literalRanges(text);
  let match: RegExpExecArray | null,
    literal = 0;
  while (links.length < limit && (match = pattern.exec(text))) {
    while (literal < literals.length && literals[literal]![1] <= match.index) literal++;
    if (
      (literals[literal] && literals[literal]![0] <= match.index) ||
      escaped(text, match.index) ||
      (text[match.index - 1] === '!' && !escaped(text, match.index - 1))
    )
      continue;
    try {
      const [encoded, section] = match[3]!.split('#section='),
        id = decodeURIComponent(encoded!),
        sectionId = section ? decodeURIComponent(section) : undefined,
        label = match[1]!.replace(/\\([\\\[\]])/g, '$1');
      if (!id || id.length > 1000 || !label.trim() || label.length > 1000) continue;
      const targetEnd = match.index + match[0].length - 1;
      links.push({
        ref: {
          kind: match[2] as DeskRef['kind'],
          id,
          ...(sectionId && match[2] === 'location' ? { sectionId } : {}),
        },
        label,
        start: match.index,
        end: pattern.lastIndex,
        targetStart: targetEnd - match[3]!.length,
        targetEnd: sectionId ? targetEnd - ('#section=' + section).length : targetEnd,
      });
    } catch {
      /* An invalid URI remains ordinary, untouched source text. */
    }
  }
  return links;
}
export function referenceMarkdown(ref: DeskRef, label: string) {
  if (!label.trim() || label.length > 1000) throw new Error('Anzeigenamen eingeben.');
  return (
    '[' +
    label.replace(/[\\\[\]]/g, '\\$&') +
    '](dungeon-ref:' +
    ref.kind +
    '/' +
    encodeURIComponent(ref.id) +
    (ref.sectionId ? '#section=' + encodeURIComponent(ref.sectionId) : '') +
    ')'
  );
}
export function plainReferenceText(text: string) {
  let cursor = 0,
    out = '';
  for (const link of textReferences(text, Number.MAX_SAFE_INTEGER)) {
    out += text.slice(cursor, link.start) + link.label;
    cursor = link.end;
  }
  return out + text.slice(cursor);
}
export function remapTextReferences(text: string, map: (ref: DeskRef) => string) {
  let cursor = 0,
    out = '';
  for (const link of textReferences(text, Number.MAX_SAFE_INTEGER)) {
    const id = map(link.ref);
    out +=
      text.slice(cursor, link.targetStart) +
      (id === link.ref.id ? text.slice(link.targetStart, link.targetEnd) : encodeURIComponent(id));
    cursor = link.targetEnd;
    if (link.ref.sectionId) {
      const section = map({ kind: 'location', id: link.ref.sectionId });
      out += '#section=' + encodeURIComponent(section);
      cursor = link.end - 1;
    }
  }
  return out + text.slice(cursor);
}
export function documentReferences(
  document: any,
  limit = 201,
): { ref: DeskRef; label: string; field: string }[] {
  const sources: readonly [string, string][] =
    document?.version === 1 && typeof document.gmNotes === 'string'
      ? [
          ['Zum Vorlesen', document.readAloud],
          ['GM-Notiz', document.gmNotes],
        ]
      : Array.isArray(document?.sections)
        ? document.sections.map((s: any) => [
            typeof s.title === 'string' ? s.title : 'Abschnitt',
            s.markdown,
          ])
        : [];
  const links: { ref: DeskRef; label: string; field: string }[] = [];
  for (const [field, text] of sources) {
    if (typeof text !== 'string') continue;
    for (const r of textReferences(text, limit - links.length))
      links.push({ ref: r.ref, label: r.label, field });
    if (links.length >= limit) break;
  }
  return links;
}
