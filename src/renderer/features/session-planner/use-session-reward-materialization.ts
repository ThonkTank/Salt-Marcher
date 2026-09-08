import { useCallback, useRef, useState } from 'react'
import type { Treasure } from '../../../shared/contracts/loot.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type {
  PlannerLootPort,
  SessionPlannerPort
} from './use-session-planner-ports.js'
import type { SessionPlannerAuthority } from './use-session-planner-workspace.js'

/** Owns idempotent generated-reward materialization and reward dialogs. */
export function useSessionRewardMaterialization(options: {
  coordinator: AsyncCommandCoordinator
  loot: PlannerLootPort
  planner: SessionPlannerPort
  read: () => SessionPlannerAuthority
  applyWorkspace: (
    workspace: NonNullable<SessionPlannerAuthority['workspace']>
  ) => void
  saveDraft: () => Promise<NonNullable<
    SessionPlannerAuthority['workspace']
  > | null>
  failed?: (cause: unknown) => void
  onError: (message: string) => void
}) {
  const {
    applyWorkspace,
    coordinator,
    failed,
    loot,
    onError,
    planner,
    read,
    saveDraft
  } = options
  const commandIds = useRef(new Map<string, string>())
  const [treasureEditor, setTreasureEditorState] = useState<
    Treasure | null | false
  >(false)
  const [distribution, setDistributionState] = useState<Treasure | null>(null)

  const dialogs = useRef({ treasure: false, distribution: false })
  const setTreasureEditor = useCallback((value: Treasure | null | false) => {
    dialogs.current.treasure = value !== false
    setTreasureEditorState(value)
  }, [])
  const setDistribution = useCallback((value: Treasure | null) => {
    dialogs.current.distribution = value !== null
    setDistributionState(value)
  }, [])

  const materializeReward = useCallback(
    async (
      runId: string,
      generatedTreasureId: string,
      label: string,
      edit: boolean,
      placed: Treasure | null
    ): Promise<void> => {
      if (read().dirty && !(await saveDraft())) return
      const target = read()
      const sessionId = target.workspace?.session.id
      if (!sessionId) return
      const key = `${runId}:${generatedTreasureId}`
      let commandId = commandIds.current.get(key)
      if (!commandId) {
        commandId = crypto.randomUUID()
        commandIds.current.set(key, commandId)
      }
      const outcome = await coordinator.run({
        scope: 'planner.reward-materialization',
        entityKey: `reward:${key}`,
        mode: 'queue',
        execute: async () => {
          const treasure =
            placed ??
            (await loot.acceptGenerated({
              commandId,
              runId,
              generatedTreasureId,
              label,
              anchor: { kind: 'unplaced' }
            }))
          return Object.freeze({ treasure, workspace: await planner.read() })
        },
        accept: (result) => {
          const current = read()
          if (
            current.intentRevision !== target.intentRevision ||
            current.workspace?.session.id !== sessionId
          )
            return
          applyWorkspace(result.workspace)
          if (edit) setTreasureEditor(result.treasure)
        }
      })
      if (outcome.status === 'failure') {
        failed?.(outcome.cause)
        onError(capabilityErrorText(outcome.cause))
      }
    },
    [
      applyWorkspace,
      coordinator,
      failed,
      loot,
      onError,
      planner,
      read,
      saveDraft,
      setTreasureEditor
    ]
  )

  return {
    hasOpenDialog: () =>
      dialogs.current.treasure || dialogs.current.distribution,
    treasureEditor,
    distribution,
    setTreasureEditor,
    setDistribution,
    materializeReward
  }
}
