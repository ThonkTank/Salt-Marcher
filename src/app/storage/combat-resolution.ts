import type { CombatResolution } from '../combat-contracts';
import { readCombat } from './combat';
import { combatNpcLosses } from './combat-world-losses';
import { readLiveScene } from './live';
import { checkedTreasureRow } from './progression';

/** Read the finished encounter and relevant Treasury identities in one snapshot. */
export function readCombatResolution(
  db: any,
  cam: string,
  sceneId: string,
  combatId: string,
  after: string | null,
): CombatResolution {
  return db.transaction(() => {
    if (
      after !== null &&
      (typeof after !== 'string' ||
        !/^[1-9][0-9]{0,15}$/.test(after) ||
        !Number.isSafeInteger(Number(after)))
    )
      throw new Error('Ungültige Beuteseite.');
    const combat = readCombat(db, cam, sceneId, combatId).combat!,
      scene = readLiveScene(db, cam, sceneId);
    if (combat.phase !== 'finished') throw new Error('Dieser Kampf ist noch nicht abgeschlossen.');
    const items: CombatResolution['treasures'] = [];
    let last: string | null = null,
      more = false;
    for (const row of db
      .prepare(
        'SELECT rowid AS cursor,* FROM treasure WHERE campaign_id=? AND (? IS NULL OR rowid<?) ORDER BY rowid DESC',
      )
      .iterate(cam, after === null ? null : Number(after), after === null ? null : Number(after))) {
      const t = checkedTreasureRow(row),
        source =
          t.combatId === combat.id
            ? 'combat'
            : t.sceneId === sceneId
              ? 'scene'
              : scene.locationId && t.locationId === scene.locationId
                ? 'location'
                : null;
      if (!source || !t.items.length) continue;
      if (items.length === 25) {
        more = true;
        break;
      }
      items.push({
        id: t.id,
        revision: t.revision,
        title: t.title,
        source,
        quantity: t.items.reduce((n, i) => n + i.quantity, 0),
        available: t.items.reduce((n, i) => n + i.quantity - i.allocated, 0),
      });
      last = String(row.cursor);
    }
    return {
      combatId: combat.id,
      sceneId,
      combatRevision: combat.revision,
      sceneRevision: scene.revision,
      outcome: combat.outcome,
      rewards: combat.rewards ?? null,
      npcLosses: combatNpcLosses(db, cam, combat),
      treasures: items,
      next: more ? last : null,
    };
  })();
}
