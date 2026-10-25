import { readLive } from './live';
import { readProgressCharacter } from './progression';
import { scenePreparedGroupIds, checkedPreparedGroupRow } from './session';
import { groupView } from './groups';
import { groupCombatBasis } from '../campaign/groups-contracts';
import {
  sceneEncounterParty,
  type SceneEncounterSelectionView,
} from '../runtime/scene-encounter-selection';

/** One confirmed selection basis; unrelated progression and loot are not dependencies. */
export function readSceneEncounterSelection(
  db: any,
  cam: string,
  sceneId: string,
): SceneEncounterSelectionView {
  return db.transaction(() => {
    const live = readLive(db, cam),
      scene = live.scene;
    if (!scene || scene.id !== sceneId || live.focusId !== sceneId)
      throw new Error('Fokussierte Szene geändert. Szene aktualisieren.');
    const progress = live.roster
      .filter((c) => c.active && c.sceneId === sceneId)
      .map((c) => readProgressCharacter(db, cam, c.id));
    const party = sceneEncounterParty(live, progress, sceneId);
    const groups: SceneEncounterSelectionView['groups'] = [],
      unavailableGroups: SceneEncounterSelectionView['unavailableGroups'] = [];
    for (const id of scenePreparedGroupIds(db, cam, sceneId))
      try {
        const g = groupView(db, cam, id);
        groups.push({
          id: g.id,
          revision: g.revision,
          title: g.title,
          locationId: g.locationId,
          basis: groupCombatBasis(g),
          plan: {
            entries: g.plan.entries.map((e) => ({ id: e.id, creatureId: e.creatureId })),
            sources: g.plan.sources.map((s) => ({ id: s.id, xp: s.xp })),
          },
          actors: g.actors.map((a) => ({
            id: a.id,
            entryId: a.entryId,
            creatureId: a.creatureId,
            name: a.name,
            hp: a.hp,
            maxHp: a.maxHp,
            role: a.role,
            defeated: a.defeated,
            unavailable: a.unavailable,
            locationId: a.locationId,
          })),
        });
      } catch (error) {
        // A failed NPC read need not hide the still-valid group's authored name.
        let title: string | undefined;
        try {
          title = checkedPreparedGroupRow(
            db.prepare('SELECT * FROM prepared_group WHERE campaign_id=? AND id=?').get(cam, id),
          ).title;
        } catch {}
        unavailableGroups.push({ id, title, problem: (error as Error).message });
      }
    return {
      sceneId,
      membershipRevision: scene.membershipRevision,
      locationId: scene.locationId,
      focusRevision: live.focusRevision,
      rosterRevision: live.rosterRevision,
      party: party.party,
      partyBasis: party.basis,
      groups,
      unavailableGroups,
    };
  })();
}
