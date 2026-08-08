import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { WorldLocationDraft } from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  WorldFaction
} from '../../../shared/contracts/encounter-source.js'
import type { WorldLocationApplicationPort } from './world-location-application.js'
import type {
  WorldLocationEditorReferences,
  WorldLocationEditorResource,
  WorldLocationPlacementIntent,
  WorldLocationSubmitResult
} from './world-location-editor-types.js'

export function useWorldLocationCreationWorkflow(options: {
  port: WorldLocationApplicationPort
  applyCreated: (
    result: Awaited<ReturnType<WorldLocationApplicationPort['save']>>['receipt']
  ) => void
  select: (locationId: string) => void
  presentError: (cause: unknown) => string
  savingMessage: string
  initiallyOpen?: boolean
}) {
  const optionsRef = useRef(options)
  const mounted = useRef(true)
  const factionRequest = useRef(0)
  const tableRequest = useRef(0)
  const factionCache = useRef<readonly WorldFaction[] | undefined>(undefined)
  const tableCache = useRef<readonly EncounterTable[] | undefined>(undefined)
  const saving = useRef(false)
  const persisted = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(options.initiallyOpen === true)
  const [factions, setFactions] = useState<
    WorldLocationEditorResource<readonly WorldFaction[]>
  >({ status: 'loading' })
  const [tables, setTables] = useState<
    WorldLocationEditorResource<readonly EncounterTable[]>
  >({ status: 'loading' })

  useEffect(() => {
    optionsRef.current = options
  }, [options])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      factionRequest.current += 1
      tableRequest.current += 1
    }
  }, [])

  const loadFactions = async () => {
    const request = ++factionRequest.current
    setFactions({ status: 'loading' })
    try {
      const loaded = await optionsRef.current.port.readFactions()
      if (!mounted.current || request !== factionRequest.current) return
      factionCache.current = loaded
      setFactions({ status: 'ready', value: loaded })
    } catch (cause) {
      if (!mounted.current || request !== factionRequest.current) return
      setFactions({
        status: 'failed',
        message: optionsRef.current.presentError(cause),
        retry: () => void loadFactions()
      })
    }
  }

  const loadTables = async () => {
    const request = ++tableRequest.current
    setTables({ status: 'loading' })
    try {
      const loaded = await optionsRef.current.port.readTables()
      if (!mounted.current || request !== tableRequest.current) return
      tableCache.current = loaded
      setTables({ status: 'ready', value: loaded })
    } catch (cause) {
      if (!mounted.current || request !== tableRequest.current) return
      setTables({
        status: 'failed',
        message: optionsRef.current.presentError(cause),
        retry: () => void loadTables()
      })
    }
  }

  const open = () => {
    setDialogOpen(true)
    const cachedFactions = factionCache.current
    if (cachedFactions) setFactions({ status: 'ready', value: cachedFactions })
    else void loadFactions()
    const cachedTables = tableCache.current
    if (cachedTables) setTables({ status: 'ready', value: cachedTables })
    else void loadTables()
  }
  const initializeOpen = useEffectEvent(open)
  useEffect(() => {
    if (options.initiallyOpen === true)
      void Promise.resolve().then(initializeOpen)
  }, [options.initiallyOpen])

  const close = () => {
    if (!saving.current) setDialogOpen(false)
  }

  const save = async (
    draft: WorldLocationDraft,
    placement: WorldLocationPlacementIntent
  ): Promise<WorldLocationSubmitResult> => {
    if (saving.current || persisted.current)
      return { status: 'failed', message: optionsRef.current.savingMessage }
    saving.current = true
    try {
      let result: Awaited<ReturnType<WorldLocationApplicationPort['save']>>
      try {
        result = await optionsRef.current.port.save(null, draft, placement)
      } catch (cause) {
        return {
          status: 'failed',
          message: optionsRef.current.presentError(cause)
        }
      }
      persisted.current = true
      try {
        optionsRef.current.applyCreated(result.receipt)
        optionsRef.current.select(result.receipt.saved.id)
      } catch (cause) {
        return {
          status: 'failed',
          message: optionsRef.current.presentError(cause)
        }
      }
      if (result.receipt.status === 'partially-saved') {
        return {
          status: 'partially-saved',
          placementFailure: result.receipt.placementFailure,
          retry: async () => {
            const retried = await result.retryPlacement()
            if (retried.status !== 'rejected') setDialogOpen(false)
            return retried
          }
        }
      }
      setDialogOpen(false)
      return { status: 'saved' }
    } finally {
      saving.current = false
    }
  }

  const references: WorldLocationEditorReferences = { factions, tables }
  return { dialogOpen, references, open, close, save }
}
