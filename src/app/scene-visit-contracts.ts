import type { VisitOutcome } from './visit-outcome-contracts';
export interface SceneVisit {
  adoptionId: string;
  ordinal: number;
  sceneId: string;
  planId: string;
  planName: string;
  planRevision: number;
  visitId: string;
  title: string;
  notes: string;
  readAloud: string;
  locationId: string | null;
  location: string | null;
  capturedAt: string | null;
  captured: boolean;
  current: boolean;
  outcome: VisitOutcome | null;
  references: { id: string; title: string; kind: string; available: boolean }[];
  groups: { id: string; title: string; available: boolean }[];
  warnings: string[];
}
export interface SceneVisitPage {
  sceneId: string;
  sceneTitle: string;
  items: SceneVisit[];
  next: string | null;
}
