import type {
  CombatCommandResult,
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'

export function applyCombatCommandResult(
  snapshot: LiveSessionSnapshot,
  result: CombatCommandResult
): LiveSessionSnapshot {
  return applyResult(snapshot, result.combat, result.scenePatch, result.party)
}

export function applySceneGroupCommandResult(
  snapshot: LiveSessionSnapshot,
  result: SceneGroupCommandResult
): LiveSessionSnapshot {
  return applyResult(snapshot, result.combat, result.scenePatch, null)
}

function applyResult(
  snapshot: LiveSessionSnapshot,
  combat: CombatCommandResult['combat'],
  patch: CombatCommandResult['scenePatch'],
  party: CombatCommandResult['party']
): LiveSessionSnapshot {
  const scene = patch
    ? {
        ...snapshot.scene,
        revision: patch.sceneRevision,
        scenes: snapshot.scene.scenes.map((candidate) =>
          candidate.id === patch.sceneId
            ? {
                ...candidate,
                groups: mergeGroups(
                  candidate.groups,
                  patch.upsertedGroups,
                  patch.removedGroupIds
                )
              }
            : candidate
        )
      }
    : snapshot.scene
  return Object.freeze({
    ...snapshot,
    revision: scene.revision,
    party: party ?? snapshot.party,
    scene,
    combat
  })
}

function mergeGroups(
  current: readonly SceneGroup[],
  upserted: readonly SceneGroup[],
  removed: readonly string[]
): SceneGroup[] {
  const removedIds = new Set(removed)
  const updates = new Map(upserted.map((group) => [group.id, group]))
  const merged = current
    .filter((group) => !removedIds.has(group.id))
    .map((group) => updates.get(group.id) ?? group)
  for (const group of upserted)
    if (!merged.some((candidate) => candidate.id === group.id))
      merged.push(group)
  return merged.toSorted((left, right) => left.position - right.position)
}
