export type VisitOutcomeStatus = 'open' | 'completed' | 'skipped';
export interface VisitOutcome {
  status: VisitOutcomeStatus;
  text: string;
  recordedAt: string;
}
export interface VisitOccurrence {
  adoptionId: string;
  sceneId: string;
  sceneTitle: string;
  outcome: VisitOutcome | null;
}
export interface SessionProgress {
  planId: string;
  planRevision: number;
  visits: {
    id: string;
    title: string;
    count: number;
    focused?: VisitOccurrence | null;
    occurrences: VisitOccurrence[];
  }[];
}
export const visitOutcomeLabel = (status: VisitOutcomeStatus) =>
  ({ open: 'Wieder offen', completed: 'Abgeschlossen', skipped: 'Übersprungen' })[status];
