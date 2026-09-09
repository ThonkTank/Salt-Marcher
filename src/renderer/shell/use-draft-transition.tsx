import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from './maintenance-draft-coordinator.js'
import { DraftResolutionDialog } from './draft-resolution-dialog.js'
import { message } from '../i18n/campaign-menu-runtime.de.js'

type Transition = {
  run: () => void
  cancelled: boolean
  resolving: boolean
  resolution: MaintenanceDraftResolution | null
}

/** Keep the originating editors mounted until their own save/discard confirms. */
export function useDraftTransition(
  identity: string,
  description?: { title: string; text: string }
) {
  const pending = useRef<Transition | null>(null)
  const mounted = useRef(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<readonly { id: string; text: string }[]>(
    []
  )
  const [renderIdentity, setRenderIdentity] = useState(identity)
  if (renderIdentity !== identity) {
    setRenderIdentity(identity)
    setOpen(false)
    setBusy(false)
  }
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const held = pending.current
      pending.current = null
      if (held) {
        held.cancelled = true
        if (!held.resolving) held.resolution?.release()
      }
    }
  }, [identity])
  const request = useCallback((run: () => void) => {
    if (
      !mounted.current ||
      pending.current ||
      maintenanceDraftCoordinator.isLocked()
    )
      return
    if (!maintenanceDraftCoordinator.hasDirty()) {
      run()
      return
    }
    const held: Transition = {
      run,
      cancelled: false,
      resolving: false,
      resolution: null
    }
    pending.current = held
    void (async () => {
      await maintenanceDraftCoordinator.settleBackgroundWrites()
      if (held.cancelled || pending.current !== held || !mounted.current) return
      if (maintenanceDraftCoordinator.isLocked()) {
        pending.current = null
        return
      }
      if (!maintenanceDraftCoordinator.hasDirty()) {
        pending.current = null
        held.run()
        return
      }
      held.resolution = maintenanceDraftCoordinator.begin()
      setErrors([])
      setOpen(true)
    })()
  }, [])
  const cancel = () => {
    const held = pending.current
    if (!held || held.resolving) return
    held.cancelled = true
    held.resolution?.release()
    pending.current = null
    setOpen(false)
  }
  const confirm = async (choice?: 'save' | 'discard') => {
    const held = pending.current
    if (!held?.resolution || held.resolving) return
    held.resolving = true
    setBusy(true)
    setErrors([])
    try {
      const failures = await held.resolution.resolve(choice ?? 'check')
      if (held.cancelled || !mounted.current) return
      if (failures.length) {
        setErrors(
          failures.map((failure) => ({
            id: failure.id,
            text: `${failure.label}: ${failure.message}`
          }))
        )
        return
      }
      held.resolution.release()
      pending.current = null
      setOpen(false)
      held.run()
    } catch {
      if (!held.cancelled && mounted.current)
        setErrors([{ id: 'transition', text: message('draft.failed') }])
    } finally {
      held.resolving = false
      if (held.cancelled || !mounted.current) held.resolution.release()
      else setBusy(false)
    }
  }
  const isPending = useCallback(() => pending.current !== null, [])
  return {
    request,
    isPending,
    dialog: open ? (
      <DraftResolutionDialog
        title={description?.title ?? message('draft.transitionTitle')}
        text={description?.text ?? message('draft.transitionText')}
        errors={errors}
        busy={busy}
        needsDrafts
        cancel={cancel}
        confirm={(choice) => void confirm(choice)}
      />
    ) : null
  }
}
