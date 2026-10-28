import type { WorldCommand } from '../runtime/world-contracts';
import { validateLiveBackup } from './live-validation';
import { validateItemsBackup } from './items';
import { captureAutonomyBasis, validateAutonomy } from './autonomy';
import { validateFeatureStates } from './drawing';
import { validateDungeonPlay } from './dungeon-play';
import { validatePlayer } from './player';
import { readWorldActor } from './session-read';
import { executeWorld } from './world-commands';
import { validateWorldBackup } from './world-validation';

interface ExecuteWorldContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  consumeSceneTime: (
    cam: string,
    commandId: string,
    before: import('./../runtime/live-contracts').LiveScene,
    after: import('./../runtime/live-contracts').LiveScene,
    basis: ReturnType<typeof captureAutonomyBasis>,
  ) => void;
  updateMusic: (campaignId: string) => void;
}

export function storedExecuteWorld(
  db: any,
  context: ExecuteWorldContext,
  command: WorldCommand,
): any {
  if (command.action.kind === 'map') {
    const root = db
      .prepare('SELECT map_id FROM campaign_atlas WHERE campaign_id=?')
      .get(command.campaignId);
    if (root && command.action.map.id !== root.map_id)
      throw new Error('Pro Kampagne gibt es genau einen Atlas.');
    if (root && command.action.map.hexMeters !== 4828.032)
      throw new Error('Die kleinste Hexgröße ist 3 Meilen Kante zu Kante.');
  }
  return db
    .transaction(() => {
      const ack = executeWorld(
        db,
        command,
        () => {
          context.guard(command.token, command.campaignId);
        },
        {
          capture: () => captureAutonomyBasis(db, command.campaignId),
          confirm: (commandId, before, after, basis) =>
            context.consumeSceneTime(
              command.campaignId,
              commandId,
              before.scene,
              after.scene,
              basis,
            ),
          validateHistory: (_sceneId, tables) => {
            // Validate the restored runtime with its owning decoders before commit.
            // A forged historical payload must never bypass today's domain rules.
            validateLiveBackup(db, command.campaignId);
            validateWorldBackup(db);
            if (tables.some((t) => t.startsWith('autonomy_') || t.startsWith('npc_')))
              validateAutonomy(db);
            if (tables.some((t) => t === 'shop' || t === 'shop_event')) validateItemsBackup(db);
            if (tables.includes('dungeon_feature_state')) validateFeatureStates(db);
            if (tables.some((t) => t.startsWith('dungeon_'))) validateDungeonPlay(db);
            if (tables.some((t) => t === 'player_hex_memory')) validatePlayer(db);
            if (tables.includes('world_actor'))
              for (const row of db
                .prepare('SELECT id FROM world_actor WHERE campaign_id=?')
                .all(command.campaignId))
                readWorldActor(db, command.campaignId, row.id);
          },
        },
      );
      context.updateMusic(command.campaignId);
      return ack;
    })
    .immediate();
}
