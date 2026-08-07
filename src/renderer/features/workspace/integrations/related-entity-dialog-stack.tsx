import { useCallback, useMemo, useRef, useState } from 'react'
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
  const close = useCallback((id: number) => {
    setFrames((current) => {
      const index = current.findIndex((frame) => frame.id === id)
      return index < 0 ? current : current.slice(0, index)
    })
  }, [])

  const requestFactionCreation = useCallback(
    (created: (faction: WorldFaction) => void) => {
      const id = ++nextId.current
      setFrames((current) => [...current, { id, kind: 'faction', created }])
    },
    []
  )

  const requestTableCreation = useCallback(
    (
      invocation: 'location-link' | 'faction-link',
      created: (receipt: EncounterTableMutationReceipt) => void
    ) => {
      const id = ++nextId.current
      setFrames((current) => [
        ...current,
        { id, kind: 'table', invocation, created }
      ])
    },
    []
  )

  const dialogs = useMemo(
    () =>
      frames.map((frame) =>
        frame.kind === 'faction' ? (
          <LazyIntegratedWorldFactionCreation
            key={frame.id}
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
      options.inspect,
      options.onError,
      options.port,
      requestTableCreation
    ]
  )

  return { dialogs, requestFactionCreation, requestTableCreation }
}
