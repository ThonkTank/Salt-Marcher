import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  SessionPreparationReceipt,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import {
  isPreparationTerminal,
  preparationStatusMessage,
  type PreparationStage
} from './preparation-status-model.js'
import { reconcileSessionPreparation } from './session-preparation-reconciliation.js'
import {
  preparationIsRunning,
  preparationStageForStatus,
  preparationTarget,
  preparationTargetIsCurrent,
  type PreparationTarget
} from './session-preparation-target.js'
import type { SessionPlannerPort } from './use-session-planner-ports.js'
import type { SessionPlannerAuthority } from './use-session-planner-workspace.js'

/** Owns the durable preparation start, receipt, notice and cancel lifecycle. */
export function useSessionPreparation(options: {
  coordinator: AsyncCommandCoordinator
  planner: SessionPlannerPort
  read: () => SessionPlannerAuthority
  applyWorkspace: (workspace: SessionPlannerWorkspace) => void
  saveDraft: () => Promise<SessionPlannerWorkspace | null>
  onError: (message: string) => void
}) {
  const { applyWorkspace, coordinator, onError, planner, read, saveDraft } =
    options
  const [seed, setSeed] = useState(179_974)
  const [stage, setStage] = useState<PreparationStage>('idle')
  const [stageMessage, setStageMessage] = useState('')
  const [confirmation, setConfirmation] = useState<{
    operationId: string
    target: SessionPlannerWorkspace
  } | null>(null)
  const activeTarget = useRef<PreparationTarget | null>(null)
  const activeAbort = useRef<AbortController | null>(null)
  const observedReceipt = useRef<string | null>(null)

  useEffect(
    () => () => activeAbort.current?.abort('preparation-controller-unmounted'),
    []
  )

  const publishReceipt = useCallback(
    async (
      receipt: SessionPreparationReceipt,
      target: PreparationTarget,
      refreshSucceeded = true
    ): Promise<void> => {
      if (!preparationTargetIsCurrent(activeTarget.current, target, read()))
        return
      setSeed(receipt.seed)
      setStage(preparationStageForStatus(receipt.status))
      setStageMessage(preparationStatusMessage(receipt))
      if (receipt.status === 'succeeded' && refreshSucceeded) {
        const next = await planner.read()
        if (!preparationTargetIsCurrent(activeTarget.current, target, read()))
          return
        applyWorkspace(next)
      }
      if (isPreparationTerminal(receipt.status)) {
        activeTarget.current = null
        activeAbort.current = null
      }
    },
    [applyWorkspace, planner, read]
  )

  const reconcile = useCallback(
    async (target: PreparationTarget): Promise<void> => {
      const signal = activeAbort.current?.signal
      if (!signal) return
      const outcome = await reconcileSessionPreparation({
        coordinator,
        planner,
        target,
        signal,
        acceptReceipt: (receipt) => publishReceipt(receipt, target)
      })
      if (
        outcome.status === 'failure' &&
        preparationTargetIsCurrent(activeTarget.current, target, read())
      )
        onError(capabilityErrorText(outcome.cause))
    },
    [coordinator, onError, planner, publishReceipt, read]
  )

  const requestPreparation = useCallback(
    async (
      workspace: SessionPlannerWorkspace,
      operationId: string,
      confirmedReplacement: boolean,
      requestedSeed: number
    ): Promise<void> => {
      const authority = read()
      if (
        authority.workspace?.session.id !== workspace.session.id ||
        authority.workspace.session.revision !== workspace.session.revision
      ) {
        setStage('stale')
        setStageMessage(message('planner.statusStale'))
        return
      }
      const target = preparationTarget(
        operationId,
        workspace,
        authority.intentRevision
      )
      activeAbort.current?.abort('preparation-superseded')
      activeAbort.current = new AbortController()
      activeTarget.current = target
      setStage('queued')
      setStageMessage(message('planner.progressQueued'))
      const outcome = await coordinator.run({
        scope: 'planner.preparation-command',
        entityKey: `session:${target.sessionId}`,
        mode: 'queue',
        signal: activeAbort.current.signal,
        execute: () =>
          planner.startPreparation({
            operationId,
            sessionId: target.sessionId,
            expectedRevision: target.sessionRevision,
            seed: requestedSeed,
            confirmedReplacement
          }),
        accept: async (started) => {
          if (!preparationTargetIsCurrent(activeTarget.current, target, read()))
            return
          if (started.status === 'confirmation_required') {
            setConfirmation({ operationId, target: workspace })
            setStage('confirming-replacement')
            setStageMessage(
              formatMessage('planner.replaceHint', {
                count: started.parameters.sceneCount
              })
            )
            return
          }
          setConfirmation(null)
          await publishReceipt(started.receipt, target)
        }
      })
      if (
        outcome.status === 'failure' &&
        preparationTargetIsCurrent(activeTarget.current, target, read())
      ) {
        activeTarget.current = null
        activeAbort.current = null
        setConfirmation(null)
        setStage('failed')
        setStageMessage(capabilityErrorText(outcome.cause))
        onError(capabilityErrorText(outcome.cause))
      }
    },
    [coordinator, onError, planner, publishReceipt, read]
  )

  const generate = useCallback(async (): Promise<void> => {
    let target = read().workspace
    if (read().dirty) target = await saveDraft()
    if (!target) return
    await requestPreparation(target, crypto.randomUUID(), false, seed)
  }, [read, requestPreparation, saveDraft, seed])

  const cancelPreparation = useCallback(async (): Promise<void> => {
    const target = activeTarget.current
    const signal = activeAbort.current?.signal
    if (!target || !signal) {
      setConfirmation(null)
      return
    }
    const outcome = await coordinator.run({
      scope: 'planner.preparation-command',
      entityKey: `session:${target.sessionId}`,
      mode: 'queue',
      signal,
      execute: () =>
        planner.cancelPreparation({ operationId: target.operationId }),
      accept: ({ receipt }) => publishReceipt(receipt, target)
    })
    if (outcome.status === 'failure')
      onError(capabilityErrorText(outcome.cause))
    setConfirmation(null)
  }, [coordinator, onError, planner, publishReceipt])

  const authority = read()
  const sessionId = authority.workspace?.session.id ?? null
  const sessionRevision = authority.workspace?.session.revision ?? null
  const intentRevision = authority.intentRevision
  useEffect(() => {
    const target = activeTarget.current
    if (target && !preparationTargetIsCurrent(target, target, read())) {
      activeAbort.current?.abort('preparation-scope-ended')
      activeAbort.current = null
      activeTarget.current = null
      setConfirmation(null)
      setStage('stale')
      setStageMessage(message('planner.statusStale'))
    }
  }, [intentRevision, read, sessionId, sessionRevision])

  const preparation = authority.workspace?.preparation ?? null
  useEffect(() => {
    if (!preparation) return
    const key = `${preparation.operationId}:${preparation.updatedAt}`
    if (observedReceipt.current === key) return
    observedReceipt.current = key
    const current = read()
    const workspace = current.workspace
    if (!workspace || preparation.sessionId !== workspace.session.id) return
    const target = preparationTarget(
      preparation.operationId,
      workspace,
      current.intentRevision
    )
    activeAbort.current?.abort('preparation-superseded')
    activeAbort.current = new AbortController()
    activeTarget.current = target
    void publishReceipt(preparation, target, false)
  }, [preparation, publishReceipt, read])

  useEffect(
    () =>
      planner.onPreparationChanged((notice) => {
        const target = activeTarget.current
        if (target?.operationId === notice.operationId) void reconcile(target)
      }),
    [planner, reconcile]
  )

  return {
    seed,
    stage,
    stageMessage,
    confirmation,
    preparationRunning: preparationIsRunning(stage),
    setSeed,
    setConfirmation,
    requestPreparation,
    generate,
    cancelPreparation
  }
}
