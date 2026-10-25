import { noteSearchTerms } from '../note-search-terms';

/** Words narrow a note together; explicit quotes retain a contiguous phrase. */
export function noteSearchQuery(search: string): string {
  const phrases = noteSearchTerms(search).map((part) => '"' + part.replace(/"/g, '""') + '"');
  return phrases.join(' AND ') || '""';
}
