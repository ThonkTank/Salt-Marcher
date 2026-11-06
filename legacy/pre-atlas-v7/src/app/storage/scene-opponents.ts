import { randomUUID, createHash } from 'node:crypto';
import type { CombatState, Combatant } from '../runtime/combat-state-contracts';
import type { Creature } from '../../features/catalog/creature-catalog';
import { worldNoteDocument } from '../../features/world/world-notes';
import { newGroup, materialize, saveGroup } from './preparation-write';
import { readPreparedGroup } from './session-read';
import { creatureInfo } from './encounters';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Catalog choices create scene figures first; initiative only references their identities.
 * Called inside the combat command transaction, including its idempotent receipt.
 * Historical anonymous combat archives are deliberately left as recorded.
 */
export function retainSceneOpponents(
  db: any,
  cam: string,
  state: CombatState,
  source: Creature,
  actors: Combatant[],
) {
  if (!actors.length) return;
  const entryId = actors[0]!.sourceEntryId!;
  const existing = db
    .prepare(
      "SELECT g.id FROM scene_opponent_group s JOIN prepared_group g ON g.campaign_id=s.campaign_id AND g.id=s.group_id WHERE s.campaign_id=? AND s.scene_id=? AND EXISTS(SELECT 1 FROM json_each(g.payload,'$.plan.entries') e WHERE json_extract(e.value,'$.id')=?)",
    )
    .get(cam, state.sceneId, entryId);
  const prior = existing ? readPreparedGroup(db, cam, existing.id) : null;
  if (
    prior?.locationId &&
    prior.locationId !==
      db
        .prepare('SELECT location_id FROM live_scene WHERE campaign_id=? AND id=?')
        .get(cam, state.sceneId).location_id
  )
    throw Error('Trupp wurde an einen anderen Ort versetzt. Szenengruppe erneut prüfen.');
  if (
    prior &&
    JSON.stringify(prior.plan.sources.find((c) => c.id === source.id)) !== JSON.stringify(source)
  )
    throw Error('Kreaturquelle des Trupps geändert. Szenengruppe erneut prüfen.');
  const group =
    prior ??
    newGroup(
      db,
      cam,
      {
        id: randomUUID(),
        revision: 1,
        name: actors.length + ' × ' + source.name,
        notes: '',
        party: [],
        entries: [
          {
            id: entryId,
            creatureId: source.id,
            count: actors.length,
            grouped: actors[0]!.partitionKind === 'mob',
          },
        ],
        sources: [source],
        catalogHash: creatureInfo().hash,
      },
      null,
      null,
    );
  if (!prior) {
    group.sourceEncounterId = '';
    group.sourceRevision = 0;
  } // No saved encounter template for catalog figures.
  const batch = prior
    ? {
        ...group,
        plan: {
          ...group.plan,
          entries: [
            {
              id: entryId,
              creatureId: source.id,
              count: actors.length,
              grouped: actors[0]!.partitionKind === 'mob',
            },
          ],
          sources: [source],
        },
        actors: [],
      }
    : group;
  materialize(db, cam, batch);
  for (const [index, actor] of actors.entries()) {
    const persistent = batch.actors[index]!,
      row = db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, persistent.id);
    const note = worldNoteDocument({ ...JSON.parse(row.payload), title: actor.name }),
      payload = JSON.stringify(note);
    db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
      payload,
      hash(payload),
      cam,
      persistent.id,
    );
    db.prepare('UPDATE note_search SET title=? WHERE campaign_id=? AND note_id=?').run(
      note.title,
      cam,
      persistent.id,
    );
    actor.worldActorId = persistent.id;
    actor.worldActorRevision = persistent.revision;
  }
  if (prior) {
    const entry = group.plan.entries.find((e) => e.id === entryId)!;
    const old = entry.count;
    entry.count += actors.length;
    group.actors.push(...batch.actors);
    group.revision++;
    if (group.title === old + ' × ' + source.name) group.title = entry.count + ' × ' + source.name;
  }
  saveGroup(db, cam, group, null, null);
  if (!prior)
    db.prepare('INSERT INTO scene_opponent_group VALUES(?,?,?)').run(cam, state.sceneId, group.id);
  state.sceneGroups ??= [];
  const origin = state.sceneGroups.find((g) => g.id === group.id);
  if (origin) {
    origin.revision = group.revision;
    origin.name = group.title;
  } else state.sceneGroups.push({ id: group.id, revision: group.revision, name: group.title });
}
