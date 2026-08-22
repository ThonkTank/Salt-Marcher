import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { HexBrushStrokeResult } from '../../../shared/contracts/hex.js'
import type { HexCapabilities } from './hex-capabilities.js'
import { createHexCommandTransport } from './hex-command-transport.js'
import { createHexLocationWriteCommands } from './hex-location-write-commands.js'
import { createHexMapWriteCommands } from './hex-map-write-commands.js'
import { projectHexCommandResult } from './hex-command-projection.js'
import type { useHexEditorController } from './use-hex-editor-controller.js'
import type { useHexMapController } from './use-hex-map-controller.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'

type EditorController = ReturnType<typeof useHexEditorController>
type MapController = ReturnType<typeof useHexMapController>
type HexCommandControllerOptions = Readonly<{
  campaignId: string
  capabilities: HexCapabilities
  editor: EditorController
  maps: MapController
  onError: (message: string) => void
}>

/** Composes scoped Hex writes from coordinator, transport and projection. */
export function useHexCommandController(options: HexCommandControllerOptions) {
  const [context] = useState(() => new HexCommandContext(options))
  useEffect(() => {
    context.update(options)
  }, [context, options])
  const coordinator = useAsyncCommandCoordinator()
  const transport = useMemo(
    () =>
      createHexCommandTransport(options.capabilities, (mapId) =>
        options.maps.chunkCache.current.invalidateMap(mapId)
      ),
    [options.capabilities, options.maps.chunkCache]
  )
  const maps = useMemo(
    () =>
      createHexMapWriteCommands({
        campaignId: options.campaignId,
        coordinator,
        transport,
        read: context.read,
        project: context.project
      }),
    [context, coordinator, options.campaignId, transport]
  )
  const locations = useMemo(
    () =>
      createHexLocationWriteCommands({
        coordinator,
        transport,
        read: context.read
      }),
    [context, coordinator, transport]
  )
  const triggerHistoryShortcut = useEffectEvent(
    (direction: 'undo' | 'redo') => {
      void maps.changeHistory(direction)
    }
  )

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const direction = historyDirection(event)
      if (!direction) return
      event.preventDefault()
      triggerHistoryShortcut(direction)
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [])

  return { ...maps, ...locations }
}

class HexCommandContext {
  #current: HexCommandControllerOptions

  public constructor(initial: HexCommandControllerOptions) {
    this.#current = initial
  }

  public readonly read = () => this.#current

  public readonly project = (
    result: HexBrushStrokeResult,
    reportRejected?: boolean
  ) => projectHexCommandResult(this.#current, result, reportRejected)

  public update(next: HexCommandControllerOptions): void {
    this.#current = next
  }
}

function historyDirection(event: KeyboardEvent): 'undo' | 'redo' | null {
  const key = event.key.toLowerCase()
  return key === 'z' && !event.shiftKey
    ? 'undo'
    : key === 'y' || (key === 'z' && event.shiftKey)
      ? 'redo'
      : null
}
