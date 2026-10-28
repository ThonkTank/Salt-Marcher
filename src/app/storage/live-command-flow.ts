import { inheritScenePosition } from './scene-position';
import { syncSceneWorld } from './world-state';
import { type LiveCommand } from '../runtime/live-contracts';
import { type LiveScene } from '../runtime/live-scene-contracts';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import {
  autonomyView,
  captureAutonomyBasis,
  catchUpAutonomy,
  recordAutonomyTime,
} from './autonomy';
import { reconcileChaseParticipants } from './chase';
import { advanceDungeonFeatures } from './drawing';
import { dungeonGeometry } from './dungeon-geometry-read';
import { evaluateDungeonSenses } from './dungeon-senses';
import { restockDue } from './items';
import { removePartyFromMasks } from './mask-health';
import { saveNarrative, validateNarrativeState } from './narrative';
import { createProgress } from './progression-records';
import { readLiveScene } from './live-read';
import { executeLive } from './live-commands';
export function consumeSceneTime(
  db: any,
  cam: string,
  commandId: string,
  before: LiveScene,
  after: LiveScene,
  basis: ReturnType<typeof captureAutonomyBasis>,
) {
  if (after.clock.instantMs === before.clock.instantMs) return;
  advanceDungeonFeatures(db, cam, after.clock.epochId, after.clock.instantMs);
  recordAutonomyTime(
    db,
    cam,
    commandId,
    after.id,
    after.clock.epochId,
    before.clock.instantMs,
    after.clock.instantMs,
    basis,
  );
  const locations = new Set(
    [before.locationId, after.locationId].filter((id): id is string => id !== null),
  );
  if (locations.size) {
    const active = autonomyView(db, cam)
      .actors.filter(
        (a) => a.enabled && !a.paused && a.locationId !== null && locations.has(a.locationId),
      )
      .map((a) => a.id);
    if (active.length)
      catchUpAutonomy(db, cam, active, 12, {
        epochId: after.clock.epochId,
        instantMs: after.clock.instantMs,
      });
  }
  const spatialScenes = db
    .prepare(
      "SELECT scene_id FROM scene_position WHERE campaign_id=? AND json_extract(payload,'$.dungeon.roomId') IS NOT NULL",
    )
    .all(cam);
  if (spatialScenes.length) {
    const geometry = dungeonGeometry(db, cam);
    for (const row of spatialScenes) evaluateDungeonSenses(db, cam, row.scene_id, geometry);
  }
}

export function applyLiveCommand(
  db: any,
  command: LiveCommand,
  effects: {
    guard(): void;
    commitPreparation(
      command: import('../campaign/preparation-contracts').PreparationCommand,
    ): void;
    updateMusic(campaignId: string): void;
  },
) {
  const replay = !!db
    .prepare('SELECT 1 FROM live_receipt WHERE command_id=?')
    .get(command.commandId);
  const basis =
      command.action.kind === 'advance-clock' && !replay
        ? captureAutonomyBasis(db, command.campaignId)
        : null,
    oldScene =
      command.action.kind === 'advance-clock' ||
      (command.action.kind === 'scene-content' && !replay)
        ? readLiveScene(db, command.campaignId, command.action.sceneId)
        : null;
  const ack = executeLive(db, command, () => {
    effects.guard();
  });
  if (!replay && command.action.kind === 'live-moment' && command.action.followUp) {
    const a = command.action,
      followUp = a.followUp!,
      noteId = campaignLocalId(followUp.id),
      scene = ack.scene;
    if (!scene || scene.id !== a.sceneId)
      throw new Error('Folgespur konnte nicht an die laufende Gruppe gebunden werden.');
    effects.commitPreparation({
      commandId: command.commandId + '|follow-up',
      campaignId: command.campaignId,
      token: command.token,
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id: noteId,
          revision: 1,
          kind: followUp.kind,
          title: a.title.trim(),
          readAloud: '',
          gmNotes: a.summary,
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    const locationId =
        scene.locationId &&
        db
          .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
          .get(command.campaignId, scene.locationId)
          ? scene.locationId
          : null,
      state = {
        noteId,
        revision: 1,
        status: 'open' as const,
        locationId,
        contributors: scene.members,
        poolXp: 0,
        items: [],
        awardId: null,
      };
    validateNarrativeState(db, command.campaignId, state);
    saveNarrative(db, command.campaignId, state);
  }
  if (basis && oldScene && ack.scene)
    consumeSceneTime(db, command.campaignId, command.commandId, oldScene, ack.scene, basis);
  if (command.action.kind === 'advance-clock' && !replay)
    restockDue(db, command.campaignId, ack.scene!.clock.instantMs);
  if (!replay) {
    const a = command.action;
    if (a.kind === 'scene-roster') {
      const ids = ack.session?.members.filter((m) => !m.active).map((m) => m.id) ?? [],
        retired = new Set(ack.session?.retired.map((s) => s.id) ?? []);
      removePartyFromMasks(db, command.campaignId, ids, command.commandId, retired);
      reconcileChaseParticipants(db, command.campaignId, ids, command.commandId, retired);
    }
    if (
      a.kind === 'move' ||
      (a.kind === 'membership' && !a.active) ||
      (a.kind === 'archive-character' && a.archived)
    ) {
      const ids = a.kind === 'move' ? a.memberIds : [a.characterId],
        retired = new Set(ack.session?.retired.map((scene) => scene.id) ?? []);
      removePartyFromMasks(db, command.campaignId, ids, command.commandId, retired);
      reconcileChaseParticipants(db, command.campaignId, ids, command.commandId, retired);
    }
    if (a.kind === 'move' && ack.session?.createdScene)
      inheritScenePosition(
        db,
        command.campaignId,
        readLiveScene(db, command.campaignId, a.sceneId),
        readLiveScene(db, command.campaignId, ack.session.createdScene.id),
      );
    // Title/notes alone have no World consequence; broken optional weather cannot veto their save.
    const sceneId =
      a.kind === 'advance-clock' ||
      a.kind === 'apply-visit' ||
      (a.kind === 'scene-content' && oldScene?.locationId !== ack.scene?.locationId)
        ? a.sceneId
        : a.kind === 'initialize'
          ? ack.scene?.id
          : a.kind === 'move'
            ? ack.session?.createdScene?.id
            : null;
    if (sceneId)
      syncSceneWorld(db, command.campaignId, readLiveScene(db, command.campaignId, sceneId));
  }
  if (command.action.kind === 'create-character' && ack.character)
    createProgress(db, command.campaignId, ack.character.id);
  if (!replay) effects.updateMusic(command.campaignId);
  return ack;
}
