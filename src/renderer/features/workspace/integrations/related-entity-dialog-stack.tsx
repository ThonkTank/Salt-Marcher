import type { MaintenanceDraftHandle } from '../../../shell/maintenance-draft-coordinator.js'
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { SaltMarcherApi } from '../../../../shared/contracts/capability-api.js'
import type { Creature } from '../../../../shared/contracts/encounter.js'
import type {
  EncounterTableMutationReceipt,
  WorldFaction
} from '../../../../shared/contracts/encounter-source.js'
import {
  LazyIntegratedEncounterTableCreation,
  LazyIntegratedWorldFactionCreation
} from './lazy-integrated-related-creation.js'

type RelatedCreationPort = Pick<
  SaltMarcherApi,
  'factions' | 'encounterTables' | 'creatures' | 'biomes'
>

type DialogFrame =
  | Readonly<{
      id: number
      kind: 'faction'
      created: (faction: WorldFaction) => void
    }>
  | Readonly<{
      id: number
      kind: 'table'
      invocation: 'location-link' | 'faction-link'
      created: (receipt: EncounterTableMutationReceipt) => void
    }>

/**
 * Owns related-entity overlays outside every editor form. Frames are rendered
 * as React siblings, so a child submit can never bubble through a parent form.
 */
export function useRelatedEntityDialogStack(options: {
  port: RelatedCreationPort
  inspect: (creature: Creature) => void
  onError: (message: string) => void
}) {
  const [frames, setFrames] = useState<readonly DialogFrame[]>([])
  const nextId = useRef(0)
  const stackId = useId()
  const framesRef = useRef<readonly DialogFrame[]>([])
  const updateFrames = useCallback((next: readonly DialogFrame[]) => {
    framesRef.current = next
    setFrames(next)
  }, [])
  const handle = useCallback(
    (id: number): MaintenanceDraftHandle => ({
      id: `${stackId}/related/${id}`,
      isOpen: () => framesRef.current.some((frame) => frame.id === id)
    }),
    [stackId]
  )
  const close = useCallback(
    (id: number) => {
      const index = framesRef.current.findIndex((frame) => frame.id === id)
      if (index >= 0) updateFrames(framesRef.current.slice(0, index))
    },
    [updateFrames]
  )

  const requestFactionCreation = useCallback(
    (created: (faction: WorldFaction) => void) => {
      const id = ++nextId.current
      updateFrames([...framesRef.current, { id, kind: 'faction', created }])
      return handle(id)
    },
    [handle, updateFrames]
  )

  const requestTableCreation = useCallback(
    (
      invocation: 'location-link' | 'faction-link',
      created: (receipt: EncounterTableMutationReceipt) => void
    ) => {
      const id = ++nextId.current
      updateFrames([
        ...framesRef.current,
        { id, kind: 'table', invocation, created }
      ])
      return handle(id)
    },
    [handle, updateFrames]
  )

  const dialogs = useMemo(
    () =>
      frames.map((frame) =>
        frame.kind === 'faction' ? (
          <LazyIntegratedWorldFactionCreation
            key={frame.id}
            maintenanceId={handle(frame.id).id}
            port={options.port}
            inspect={options.inspect}
            onError={options.onError}
            close={() => close(frame.id)}
            created={(faction) => {
              frame.created(faction)
              close(frame.id)
            }}
            requestTableCreation={(created) =>
              requestTableCreation('faction-link', created)
            }
          />
        ) : (
          <LazyIntegratedEncounterTableCreation
            key={frame.id}
            maintenanceId={handle(frame.id).id}
            port={options.port}
            inspect={options.inspect}
            onError={options.onError}
            invocation={{ kind: frame.invocation }}
            close={() => close(frame.id)}
            created={(receipt) => {
              frame.created(receipt)
              close(frame.id)
            }}
          />
        )
      ),
    [
      close,
      frames,
      handle,
      options.inspect,
      options.onError,
      options.port,
      requestTableCreation
    ]
  )

  return { dialogs, requestFactionCreation, requestTableCreation }
}
