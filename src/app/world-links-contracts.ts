import type { Result } from './contracts';
import type { DeskContent, DeskRef } from './scene-desk-contracts';
import type { PreparationCommand } from './preparation-contracts';
import type { WorldRelationPairAPI } from './world-relation-pair-contracts';
import type { WorldFamilyRelationKind } from '../features/world/world-notes';
export type WorldLinkRef = DeskRef;
export interface WorldLinkNode {
  ref: WorldLinkRef;
  kind:
    | 'note'
    | 'npc'
    | 'faction'
    | 'quest'
    | 'rumor'
    | 'rule'
    | 'location'
    | 'creature'
    | 'item'
    | 'encounter';
  title: string;
  revision: number;
  available: boolean;
  alias?: string;
}
export interface WorldLinkEdge {
  source: WorldLinkRef;
  target: WorldLinkRef;
  label: string;
  authored: boolean;
  familyKind?: WorldFamilyRelationKind;
}
export interface WorldLinksQuery {
  text: string;
  kind: 'all' | 'world' | 'reference' | WorldLinkNode['kind'];
  offset: number;
  focus: WorldLinkRef | null;
}
export interface WorldLinksPage {
  matches: WorldLinkNode[];
  next: number | null;
  nodes: WorldLinkNode[];
  edges: WorldLinkEdge[];
  focus: WorldLinkNode | null;
  hiddenLinks: number;
  notice?: string;
}
export interface WorldLinksAPI extends WorldRelationPairAPI {
  worldLinks(token: string, query: WorldLinksQuery): Promise<Result<WorldLinksPage>>;
  changePreparationContent(command: PreparationCommand): Promise<Result<DeskContent>>;
  reconcilePreparationContent(
    command: PreparationCommand,
    token: string,
  ): Promise<Result<{ outcome: 'applied' | 'not-applied' | 'conflict'; targetChanged: boolean }>>;
}
export const worldLinkKey = (ref: WorldLinkRef) => ref.kind + ':' + ref.id;
export const worldLinkKinds = {
  note: 'Notiz',
  npc: 'NSC',
  faction: 'Fraktion',
  quest: 'Quest',
  rumor: 'Gerücht',
  rule: 'Regel',
  location: 'Ort',
  creature: 'Kreatur',
  item: 'Gegenstand',
  encounter: 'Begegnung',
} as const;
