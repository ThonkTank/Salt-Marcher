import { useEffect, useMemo, useState } from 'react'
import type { SaltMarcherApi } from '../../../../shared/contracts/capability-api.js'
import type { Creature } from '../../../../shared/contracts/encounter.js'
import type {
  EncounterTableMutationReceipt,
  EncounterTableSnapshot,
  WorldFaction
} from '../../../../shared/contracts/encounter-source.js'
import { capabilityErrorText } from '../../../capabilities/capability-errors.js'
import { EncounterTableDialog } from '../../encounter-table/encounter-table-manager.js'
import { createEncounterTableApplicationPort } from '../../encounter-table/encounter-table-application.js'
import { emptyEncounterTableSnapshot } from '../../encounter-table/encounter-table-snapshot.js'
import { createWorldFactionApplicationPort } from '../../worldplanner/world-faction-application.js'
import { WorldFactionDialog } from '../../worldplanner/world-faction-dialog.js'
import {
  createCreatureCapabilityPort,
  createCreatureFactsPort
} from '../../creatures/creatures-capabilities.js'
import { createBiomeOptionSearchPort } from '../../creatures/biome-option-search-port.js'

type RelatedCreationPort = Pick<
  SaltMarcherApi,
  'factions' | 'encounterTables' | 'creatures' | 'biomes'
>

export function IntegratedWorldFactionCreation(props: {
  port: RelatedCreationPort
  close: () => void
  created: (faction: WorldFaction) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  requestTableCreation: (
    created: (receipt: EncounterTableMutationReceipt) => void
  ) => void
}) {
  const onError = props.onError
  const application = useMemo(
    () => createWorldFactionApplicationPort(props.port),
    [props.port]
  )
  const creatureFacts = useMemo(
    () => createCreatureFactsPort(props.port.creatures),
    [props.port]
  )
  const [tables, setTables] = useState<EncounterTableSnapshot>(
    emptyEncounterTableSnapshot
  )

  useEffect(() => {
    let current = true
    void application
      .readTables()
      .then((snapshot) => {
        if (current) setTables(snapshot)
      })
      .catch((cause: unknown) => onError(capabilityErrorText(cause)))
    return () => {
      current = false
    }
  }, [application, onError])

  return (
    <WorldFactionDialog
      faction={null}
      tableSnapshot={tables}
      close={props.close}
      save={(draft) => application.saveFaction(null, draft)}
      saved={(result) => props.created(result.saved)}
      requestTableCreation={(created) =>
        props.requestTableCreation((result) => {
          setTables(result.snapshot)
          created(result)
        })
      }
      onError={props.onError}
      inspect={props.inspect}
      creatures={creatureFacts}
      invocation={{ kind: 'location-link' }}
    />
  )
}

export function IntegratedEncounterTableCreation(props: {
  port: RelatedCreationPort
  close: () => void
  created: (result: EncounterTableMutationReceipt) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  invocation: Readonly<{ kind: 'location-link' | 'faction-link' }>
}) {
  const application = useMemo(
    () => createEncounterTableApplicationPort(props.port),
    [props.port]
  )
  const creatures = useMemo(
    () => createCreatureCapabilityPort(props.port.creatures),
    [props.port]
  )
  const biomes = useMemo(
    () => createBiomeOptionSearchPort(props.port.biomes),
    [props.port]
  )
  return (
    <EncounterTableDialog
      table={null}
      close={props.close}
      save={application.save}
      saved={props.created}
      onError={props.onError}
      inspect={props.inspect}
      creaturePort={creatures}
      biomePort={biomes}
      invocation={props.invocation}
    />
  )
}
