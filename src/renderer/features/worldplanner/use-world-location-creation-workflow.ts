import { useEffect, useRef, useState } from 'react'
import type { WorldLocationDraft } from '../../../shared/contracts/world-location.js'
import type { WorldLocationCreationPort } from './world-location-capabilities.js'
import type {
  WorldLocationEditorReferences,
  WorldLocationPlacementOutcome,
  WorldLocationSubmitResult
} from './world-location-editor-types.js'

export function useWorldLocationCreationWorkflow(options: {
  port: WorldLocationCreationPort
  currentRevision: () => number | null
  applyCreated: (
    result: Awaited<ReturnType<WorldLocationCreationPort['createLocation']>>
  ) => void
  select: (locationId: string) => void
  place: (locationId: string) => Promise<WorldLocationPlacementOutcome>
  errorText: (cause: unknown) => string
  onPartialFailure: (message: string) => void
  unavailableMessage: string
  savingMessage: string
}) {
  const optionsRef = useRef(options)
  const mounted = useRef(true)
  const referenceRequest = useRef(0)
  const referenceCache = useRef<
    Extract<WorldLocationEditorReferences, { status: 'ready' }> | undefined
  >(undefined)
  const saving = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [references, setReferences] = useState<WorldLocationEditorReferences>({
    status: 'loading'
  })

  useEffect(() => {
    optionsRef.current = options
  }, [options])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      referenceRequest.current += 1
    }
  }, [])

  const loadReferences = async () => {
    const request = ++referenceRequest.current
    setReferences({ status: 'loading' })
    try {
      const loaded = await optionsRef.current.port.readEditorReferences()
      if (!mounted.current || request !== referenceRequest.current) return
      const ready = { status: 'ready', ...loaded } as const
      referenceCache.current = ready
      setReferences(ready)
    } catch (cause) {
      if (!mounted.current || request !== referenceRequest.current) return
      setReferences({
        status: 'failed',
        message: optionsRef.current.errorText(cause),
        retry: () => void loadReferences()
      })
    }
  }

  const open = () => {
    setDialogOpen(true)
    const cached = referenceCache.current
    if (cached) setReferences(cached)
    else void loadReferences()
  }

  const close = () => {
    if (!saving.current) setDialogOpen(false)
  }

  const save = async (
    draft: WorldLocationDraft
  ): Promise<WorldLocationSubmitResult> => {
    if (saving.current)
      return { status: 'failed', message: optionsRef.current.savingMessage }
    const revision = optionsRef.current.currentRevision()
    if (revision === null)
      return {
        status: 'failed',
        message: optionsRef.current.unavailableMessage
      }
    saving.current = true
    try {
      const result = await optionsRef.current.port.createLocation(
        draft,
        revision
      )
      optionsRef.current.applyCreated(result)
      optionsRef.current.select(result.createdLocation.id)
      setDialogOpen(false)
      const placement = await optionsRef.current.place(
        result.createdLocation.id
      )
      if (placement.status === 'rejected' || placement.status === 'failed')
        optionsRef.current.onPartialFailure(placement.message)
      return { status: 'saved' }
    } catch (cause) {
      return {
        status: 'failed',
        message: optionsRef.current.errorText(cause)
      }
    } finally {
      saving.current = false
    }
  }

  return { dialogOpen, references, open, close, save }
}
