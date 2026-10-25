import type { Combatant } from './combat-contracts';
import type { InitiativeBasis } from './combat-initiative';
import type { Result } from '../shared/contracts';
export const fighterDraftFields = [
  'fighter-name',
  'fighter-initiative',
  'fighter-bonus',
  'fighter-ac',
  'fighter-hp',
  'fighter-max-hp',
  'fighter-temp-hp',
  'fighter-conditions',
  'fighter-xp',
] as const;
export function fighterDraftBasisMatches(before: Combatant, after: Combatant) {
  const stable = (participant: Combatant) => {
    const copy = structuredClone(participant);
    delete copy.legendaryActions;
    delete copy.timedEffects;
    delete copy.hiddenFromPlayers;
    return copy;
  };
  return JSON.stringify(stable(before)) === JSON.stringify(stable(after));
}
interface DraftOwner {
  version: 1;
  writeId: string;
  combatId: string;
  sceneId: string;
  targetId: string;
  revision: number;
}
export interface FighterWorkingDraft extends DraftOwner {
  kind: 'fighter';
  basis: Combatant;
  values: Record<(typeof fighterDraftFields)[number], string> & { 'fighter-group-name'?: string };
  concentrating: boolean;
  counted: boolean;
}
export interface NotesWorkingDraft extends DraftOwner {
  kind: 'notes';
  basis: { title: string; notes: string };
  values: { title: string; notes: string };
}
export interface InitiativeWorkingDraft extends DraftOwner {
  kind: 'initiative';
  basis: InitiativeBasis;
  values: { participantId: string; raw: string }[];
}
export type CombatWorkingDraft = FighterWorkingDraft | NotesWorkingDraft | InitiativeWorkingDraft;
export type CombatDraftKind = CombatWorkingDraft['kind'];
export interface CombatDraftPage {
  items: { kind: CombatDraftKind; targetId: string; writeId: string; label: string }[];
  problems: { kind: CombatDraftKind; targetId: string; message: string }[];
  next: string | null;
}
export interface CombatDraftAPI {
  combatDraft(
    token: string,
    combatId: string,
    kind: CombatDraftKind,
    targetId: string,
  ): Promise<Result<CombatWorkingDraft | null>>;
  combatDrafts(
    token: string,
    combatId: string,
    after: string | null,
  ): Promise<Result<CombatDraftPage>>;
  keepCombatDraft(
    token: string,
    draft: CombatWorkingDraft,
    expectedWriteId: string | null,
  ): Promise<Result<void>>;
  discardCombatDraft(
    token: string,
    combatId: string,
    kind: CombatDraftKind,
    targetId: string,
    writeId: string,
  ): Promise<Result<void>>;
}
