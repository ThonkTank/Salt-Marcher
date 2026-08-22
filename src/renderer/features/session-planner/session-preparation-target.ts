import type { SessionPreparationReceipt } from '../../../shared/contracts/session-planner.js'
import type { SessionPlannerWorkspace } from '../../../shared/contracts/session-planner.js'
import type { PreparationStage } from './preparation-status-model.js'
import type { SessionPlannerAuthority } from './use-session-planner-workspace.js'

export type PreparationTarget = Readonly<{
  operationId: string
  sessionId: string
  sessionRevision: number
  intentRevision: number
}>

export function preparationTarget(
  operationId: string,
  workspace: SessionPlannerWorkspace,
  intentRevision: number
): PreparationTarget {
  return Object.freeze({
    operationId,
    sessionId: workspace.session.id,
    sessionRevision: workspace.session.revision,
    intentRevision
  })
}

export function preparationTargetIsCurrent(
  active: PreparationTarget | null,
  target: PreparationTarget,
  authority: SessionPlannerAuthority
): boolean {
  return (
    active === target &&
    authority.intentRevision === target.intentRevision &&
    authority.workspace?.session.id === target.sessionId &&
    authority.workspace.session.revision === target.sessionRevision
  )
}

export function preparationStageForStatus(
  status: SessionPreparationReceipt['status']
): PreparationStage {
  const stages: Record<SessionPreparationReceipt['status'], PreparationStage> =
    {
      queued: 'queued',
      generating: 'generating',
      resolving_encounters: 'resolving-encounters',
      saving: 'saving',
      succeeded: 'ready',
      invalid: 'invalid',
      stale: 'stale',
      failed: 'failed',
      canceled: 'canceled'
    }
  return stages[status]
}

export function preparationIsRunning(stage: PreparationStage): boolean {
  return ['queued', 'generating', 'resolving-encounters', 'saving'].includes(
    stage
  )
}
