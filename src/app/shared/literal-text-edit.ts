import { rawTextOffset } from '../campaign/text-references';

/** Textareas expose LF even when the saved source uses CRLF or CR. */
export function preserveLiteralEdit(before: string, input: string): string {
  // Explicit raw input from a restored draft or another non-DOM caller is already authoritative.
  if (input.includes('\r')) return input;
  const old = before.replace(/\r\n?/g, '\n');
  const next = input.replace(/\r\n?/g, '\n');
  if (old === next) return before;
  let start = 0;
  while (start < old.length && start < next.length && old[start] === next[start]) start++;
  let end = old.length,
    nextEnd = next.length;
  while (end > start && nextEnd > start && old[end - 1] === next[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  const from = rawTextOffset(before, start),
    to = rawTextOffset(before, end);
  let middle = next.slice(start, nextEnd);
  if (middle.includes('\n')) {
    let ending = before.match(/\r\n|\r|\n/)?.[0] ?? '\n';
    for (const match of before.matchAll(/\r\n|\r|\n/g)) {
      if (match.index >= from) break;
      ending = match[0];
    }
    middle = middle.replace(/\n/g, ending);
  }
  return before.slice(0, from) + middle + before.slice(to);
}
