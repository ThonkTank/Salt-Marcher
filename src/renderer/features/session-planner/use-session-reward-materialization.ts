import { useCallback, useId, useRef, useState } from 'react'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
import type {
  AcceptGeneratedTreasureInput,
  Treasure
} from '../../../shared/contracts/loot.js'
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
  failed?: (cause: unknown, reconcile?: () => Promise<boolean>) => void
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
  const [treasureEditor, setTreasureEditorState] = useState<
    Treasure | null | false
  >(false)
  const [distribution, setDistributionState] = useState<Treasure | null>(null)

  const treasureMaintenanceId = useId()
  const distributionMaintenanceId = useId()
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
      const input: AcceptGeneratedTreasureInput = {
        commandId: crypto.randomUUID(),
        runId,
        generatedTreasureId,
        label,
        anchor: { kind: 'unplaced' }
      }
      let writeConfirmed = false
      const acceptCurrent = (
        treasure: Treasure | null,
        workspace: NonNullable<SessionPlannerAuthority['workspace']>
      ) => {
        const current = read()
        if (
          current.intentRevision !== target.intentRevision ||
          current.workspace?.session.id !== sessionId
        )
          return
        applyWorkspace(workspace)
        if (edit && treasure) setTreasureEditor(treasure)
      }
      const outcome = await coordinator.run({
        scope: 'planner.reward-materialization',
        entityKey: `reward:${key}`,
        mode: 'queue',
        execute: async () => {
          const treasure = placed
            ? (await loot.generatedAcceptanceStatus(input)).treasure
            : await loot.acceptGenerated(input)
          writeConfirmed = !placed
          return Object.freeze({ treasure, workspace: await planner.read() })
        },
        accept: (result) => acceptCurrent(result.treasure, result.workspace)
      })
      if (outcome.status === 'failure') {
        failed?.(
          writeConfirmed || placed
            ? new CapabilityError('outcome_unknown', true)
            : outcome.cause,
          async () => {
            const status = await loot.generatedAcceptanceStatus(input)
            const workspace = await planner.read()
            acceptCurrent(
              status.receipt || placed ? status.treasure : null,
              workspace
            )
            return true
          }
        )
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
    treasureMaintenanceId,
    distributionMaintenanceId,
    dialogDependencies: () => [
      ...(dialogs.current.treasure ? [treasureMaintenanceId] : []),
      ...(dialogs.current.distribution ? [distributionMaintenanceId] : [])
    ],
    hasDistributionDialog: () => dialogs.current.distribution,
    hasOpenDialog: () =>
      dialogs.current.treasure || dialogs.current.distribution,
    treasureEditor,
    distribution,
    setTreasureEditor,
    setDistribution,
    materializeReward
  }
}
