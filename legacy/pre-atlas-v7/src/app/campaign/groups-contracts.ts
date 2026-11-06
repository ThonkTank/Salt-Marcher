import type { Result } from '../shared/contracts';
import type { PreparedGroup, WorldActor } from './session-contracts';
export interface GroupActor extends WorldActor {
  profileRevision: number;
  gmNotes: string;
  readAloud: string;
  locationId?: string | null;
  locationTitle?: string;
}
export interface GroupView extends Omit<PreparedGroup, 'actors'> {
  actors: GroupActor[];
  draftPlanId: string | null;
  locationTitle?: string;
}
export interface GroupRow {
  id: string | null;
  creatureId: string;
  revision: number;
  profileRevision: number;
  name: string;
  hp: string;
  maxHp: string;
  tempHp: string;
  conditions: string;
  concentrating: boolean;
  gmNotes: string;
  readAloud: string;
}
export interface GroupDraft {
  writeId: string;
  groupId: string;
  revision: number;
  title: string;
  notes: string;
  locationId: string | null;
  actors: GroupRow[];
}
export type GroupAction =
  | {
      kind: 'group-create';
      title: string;
      encounterId: string | null;
      expectedEncounterRevision: number | null;
    }
  | { kind: 'group-edit'; groupId: string; expectedRevision: number; draft: GroupDraft };
export interface GroupsAPI {
  preparedGroups(
    token: string,
    search: string,
    after: string | null,
  ): Promise<
    Result<{
      items: { id: string; title: string; locationId: string | null; count: number }[];
      next: string | null;
    }>
  >;
  groupView(token: string, id: string): Promise<Result<GroupView>>;
  groupDraft(token: string, id: string): Promise<Result<GroupDraft | null>>;
  keepGroupDraft(token: string, draft: GroupDraft, expected: string | null): Promise<Result<void>>;
  discardGroupDraft(token: string, id: string, writeId: string): Promise<Result<void>>;
}

/** Facts shown before a physical group enters initiative; notes are not combat input. */
export function groupCombatBasis(group: GroupView): string {
  return JSON.stringify([
    group.id,
    group.revision,
    group.locationId,
    group.actors.map((a) => [
      a.id,
      a.revision,
      a.profileRevision,
      a.entryId,
      a.creatureId,
      a.name,
      a.hp,
      a.maxHp,
      a.tempHp,
      a.conditions,
      a.concentrating,
      a.role ?? 'hostile',
      !!a.defeated,
      a.unavailable,
      a.locationId ?? null,
    ]),
  ]);
}
