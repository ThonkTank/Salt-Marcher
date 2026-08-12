import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { CreatureCatalogQuery } from '../../../shared/contracts/encounter.js'
import type { EncounterTuningOverride } from '../../../shared/contracts/encounter-tuning.js'
import type {
  GroupGenerationMode,
  SceneGroupDisposition,
  SceneGroupDraftEntry
} from '../../../shared/contracts/scene.js'

/** Positional convenience is local to the Session renderer adapter. */
export function sessionCapabilities(api: SaltMarcherApi) {
  return {
    references: api.references,
    scene: {
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
        expectedGroupRevision: number | null
      ) =>
        api.scene.saveGroup({
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
      assignPartyMember: (
        sceneId: string,
        partyMemberId: string,
        assigned: boolean,
        expectedRevision: number
      ) =>
        api.scene.assignPartyMember({
          sceneId,
          partyMemberId,
          assigned,
          expectedRevision
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
