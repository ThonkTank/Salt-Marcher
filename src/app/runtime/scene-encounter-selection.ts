import type { LiveView } from './live-contracts';
import type { Progress } from './progression';
import { xpLevel } from './progression';
import { assessEncounter, type EncounterParty } from '../catalog/encounter-contracts';
import type { GroupView, GroupActor } from '../campaign/groups-contracts';
export type SceneGroupActor = Pick<
  GroupActor,
  | 'id'
  | 'entryId'
  | 'creatureId'
  | 'name'
  | 'hp'
  | 'maxHp'
  | 'role'
  | 'defeated'
  | 'unavailable'
  | 'locationId'
>;
/** Selection facts only: prose and complete statblocks stay with their readers. */
export type SceneGroupFacts = Pick<GroupView, 'id' | 'revision' | 'title' | 'locationId'> & {
  actors: SceneGroupActor[];
  plan: {
    entries: Pick<GroupView['plan']['entries'][number], 'id' | 'creatureId'>[];
    sources: Pick<GroupView['plan']['sources'][number], 'id' | 'xp'>[];
  };
};
export interface SceneEncounterSelectionView {
  sceneId: string;
  membershipRevision: number;
  locationId: string | null;
  focusRevision: number | null;
  rosterRevision: number;
  party: EncounterParty[];
  partyBasis: string;
  groups: (SceneGroupFacts & { basis: string })[];
  unavailableGroups: { id: string; title?: string; problem: string }[];
}
export interface SceneGroupBasis {
  id: string;
  revision: number;
  basis: string;
  worldActorIds?: string[];
}
export interface SceneEncounterBasis {
  expectedFocusRevision: number | null;
  expectedRosterRevision: number;
  partyBasis: string;
  groups: SceneGroupBasis[];
}
export function sceneEncounterParty(
  live: LiveView,
  progress: readonly Pick<Progress, 'characterId' | 'xp' | 'revision'>[],
  sceneId: string,
) {
  const rows = live.roster.filter((c) => c.active && !c.archived && c.sceneId === sceneId),
    states = new Map(progress.map((p) => [p.characterId, p]));
  const party: EncounterParty[] = rows.map((c) => ({
    id: c.id,
    name: c.profile.name,
    level: states.get(c.id)?.xp == null ? null : xpLevel(states.get(c.id)!.xp!).level,
    count: 1,
  }));
  return {
    party,
    basis: JSON.stringify(
      rows
        .map((c) => [
          c.id,
          c.membershipRevision,
          states.get(c.id)?.revision ?? null,
          states.get(c.id)?.xp ?? null,
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ),
  };
}
export function sceneGroupMembers<A extends SceneGroupActor>(group: { actors: A[] }) {
  return group.actors.filter((a) => a.hp > 0 && !a.defeated && a.role !== 'neutral');
}
/** Keep the full group basis for concurrency; the chosen actors alone enter this wave. */
export function selectedSceneGroup(group: GroupView, worldActorIds?: readonly string[]): GroupView {
  if (worldActorIds === undefined) return group;
  const eligible = new Set(sceneGroupMembers(group).map((a) => a.id));
  if (
    !Array.isArray(worldActorIds) ||
    !worldActorIds.length ||
    worldActorIds.length > 200 ||
    new Set(worldActorIds).size !== worldActorIds.length ||
    worldActorIds.some((id) => !eligible.has(id))
  )
    throw Error('Wähle eindeutige kampffähige Figuren dieser Szenengruppe.');
  return { ...group, actors: group.actors.filter((a) => worldActorIds.includes(a.id)) };
}
export function sceneGroupIssue(group: SceneGroupFacts, locationId: string | null): string | null {
  const members = sceneGroupMembers(group);
  if (group.locationId && group.locationId !== locationId)
    return 'Gruppe ist an einem anderen Ort.';
  if (!members.length) return 'Keine lebenden kampffähigen Figuren.';
  if (members.some((a) => a.unavailable || (a.locationId && a.locationId !== locationId)))
    return 'Eine lebende Figur ist nicht verfügbar oder an einem anderen Ort.';
  if (
    members.some(
      (a) =>
        !group.plan.entries.some((e) => e.id === a.entryId && e.creatureId === a.creatureId) ||
        !group.plan.sources.some((s) => s.id === a.creatureId),
    )
  )
    return 'Kreaturquelle der Gruppe fehlt.';
  return null;
}
export function assessSceneGroups(
  party: readonly EncounterParty[],
  groups: readonly SceneGroupFacts[],
  locationId: string | null,
) {
  const seen = new Set<string>();
  let issue: string | null = !party.length
    ? 'Der fokussierten Szene sind keine aktiven Partyfiguren zugewiesen.'
    : !groups.length
      ? 'Mindestens eine Szenengruppe auswählen.'
      : null;
  const opponents = groups.flatMap((g) =>
    sceneGroupMembers(g).map((a) => {
      if (seen.has(a.id)) issue = 'Eine Weltfigur ist in mehreren gewählten Gruppen enthalten.';
      seen.add(a.id);
      return {
        xp: a.role === 'friendly' ? 0 : g.plan.sources.find((s) => s.id === a.creatureId)?.xp,
        count: 1,
        countForMultiplier: a.role !== 'friendly',
      };
    }),
  );
  for (const g of groups) {
    const problem = sceneGroupIssue(g, locationId);
    if (problem) issue = g.title + ': ' + problem;
  }
  const assessment = assessEncounter(party, opponents);
  if (groups.length && !assessment.count && !issue)
    issue = 'Die Auswahl enthält keine kampffähigen Gegner.';
  return { assessment, issue };
}
