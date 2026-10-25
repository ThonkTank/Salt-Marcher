import type { Result } from './contracts';
import type { WorldNoteV1 } from '../features/world/world-notes';
import type { NarrativeView } from './narrative-contracts';
export interface NarrativeJournalQuery {
  search: string;
  kind: 'all' | 'quest' | 'rumor';
  status: 'all' | 'open' | 'closed';
  after: string | null;
}
export interface NarrativeJournalEntry {
  note: WorldNoteV1;
  view: NarrativeView;
  locationName: string | null;
  contributorNames: string[];
}
export interface NarrativeJournal {
  entries: NarrativeJournalEntry[];
  next: string | null;
  counts: { open: number; closed: number };
}
export interface NarrativeJournalAPI {
  narrativeJournal(token: string, query: NarrativeJournalQuery): Promise<Result<NarrativeJournal>>;
}
