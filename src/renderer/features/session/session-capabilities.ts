import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { CreatureCatalogQuery } from '../../../shared/contracts/encounter.js'
import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import type {
  GroupGenerationMode,
  SceneGroupDisposition,
  SceneGroupDraftEntry,
  SaveSceneGroupInput
} from '../../../shared/contracts/scene.js'

/** Positional convenience is local to the Session renderer adapter. */
export function sessionCapabilities(api: SaltMarcherApi) {
  return {
    references: api.references,
    scene: {
      groupSaveReceipt: (input: SaveSceneGroupInput, campaignId: string) =>
        api.scene.groupSaveReceipt({ ...input, campaignId }),
      focus: (sceneId: string, expectedRevision: number) =>
        api.scene.focus({ sceneId, expectedRevision }),
      setLocation: (
        sceneId: string,
        locationId: string | null,
        expectedRevision: number
      ) => api.scene.setLocation({ sceneId, locationId, expectedRevision }),
      saveGroup: (
        sceneId: string,
        groupId: string | null,
        name: string,
        note: string,
        disposition: SceneGroupDisposition,
        entries: readonly SceneGroupDraftEntry[],
        expectedRevision: number,
        expectedGroupRevision: number | null,
        commandId: string = crypto.randomUUID()
      ) =>
        api.scene.saveGroup({
          commandId,
          sceneId,
          groupId,
          name,
          note,
          disposition,
          entries: [...entries],
          expectedRevision,
          expectedGroupRevision
        }),
      deleteGroup: (
        sceneId: string,
        groupId: string,
        expectedGroupRevision: number
      ) => api.scene.deleteGroup({ sceneId, groupId, expectedGroupRevision }),
      setGroupArchived: (
        sceneId: string,
        groupId: string,
        archived: boolean,
        expectedGroupRevision: number
      ) =>
        api.scene.setGroupArchived({
          sceneId,
          groupId,
          archived,
          expectedGroupRevision
        }),
      evaluateGroupDraft: (
        sceneId: string,
        entries: readonly SceneGroupDraftEntry[],
        expectedRevision: number
      ) =>
        api.scene.evaluateGroupDraft({
          sceneId,
          entries: [...entries],
          expectedRevision
        }),
      generateGroupDraft: (
        sceneId: string,
        entries: readonly SceneGroupDraftEntry[],
        mode: GroupGenerationMode,
        filters: CreatureCatalogQuery,
        tuning: EncounterTuningOverride,
        seed: number,
        expectedRevision: number
      ) =>
        api.scene.generateGroupDraft({
          sceneId,
          entries: [...entries],
          mode,
          filters,
          tuning,
          seed,
          expectedRevision
        })
    }
  }
}

export type SessionCapabilities = ReturnType<typeof sessionCapabilities>
