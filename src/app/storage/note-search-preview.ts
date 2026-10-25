import type { Note, NoteSearchPreview } from '../preparation-contracts';

/** FTS supplies token locations; the renderer receives only bounded literal text. */
export function noteSearchPreview(
  raw: unknown,
  note: Note,
  marks: { start: string; end: string; clip: string },
): NoteSearchPreview | undefined {
  if (typeof raw !== 'string' || !raw.includes(marks.start)) return undefined;
  const plain = raw
    .split(marks.start)
    .join('')
    .split(marks.end)
    .join('')
    .split(marks.clip)
    .join('');
  const inGM = note.gmNotes.includes(plain.trim()),
    inReadAloud = note.readAloud.includes(plain.trim());
  const owner =
    inGM && !inReadAloud
      ? 'GM-Notiz'
      : inReadAloud && !inGM
        ? 'Vorlesetext'
        : 'Textstelle für die Spielleitung';
  let rest = raw,
    matched = false;
  const sourceParts: NoteSearchPreview['parts'] = [];
  while (rest) {
    const markers = [marks.start, marks.end, marks.clip]
      .map((marker) => ({ marker, index: rest.indexOf(marker) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index);
    const next = markers[0],
      text = rest.slice(0, next?.index ?? rest.length);
    if (text) sourceParts.push({ text, matched });
    if (!next) break;
    rest = rest.slice(next.index + next.marker.length);
    if (next.marker === marks.clip) {
      sourceParts.push({ text: '… ', matched: false });
      matched = false;
    } else matched = next.marker === marks.start;
  }
  let first = 0;
  for (const part of sourceParts) {
    if (part.matched) break;
    first += part.text.length;
  }
  const from = Math.max(0, first - 48),
    total = sourceParts.reduce((sum, part) => sum + part.text.length, 0);
  const parts: NoteSearchPreview['parts'] = [];
  if (from > 0) parts.push({ text: '… ', matched: false });
  let position = 0,
    count = 0,
    last = from;
  for (const part of sourceParts) {
    if (position + part.text.length <= from) {
      position += part.text.length;
      continue;
    }
    let begin = Math.max(0, from - position);
    if (
      begin > 0 &&
      /[\uDC00-\uDFFF]/u.test(part.text[begin] ?? '') &&
      /[\uD800-\uDBFF]/u.test(part.text[begin - 1] ?? '')
    )
      begin--;
    let text = '';
    for (const character of part.text.slice(begin)) {
      if (count >= 180) break;
      text += character;
      count++;
    }
    if (text) parts.push({ text, matched: part.matched });
    last = position + begin + text.length;
    position += part.text.length;
    if (count >= 180) break;
  }
  if (last < total) parts.push({ text: ' …', matched: false });
  return parts.some((part) => part.matched && part.text) ? { owner, parts } : undefined;
}
