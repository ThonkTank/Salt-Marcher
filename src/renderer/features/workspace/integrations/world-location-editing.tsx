import { useEffect, useMemo, type ReactNode } from 'react'
import { useCapabilityApi } from '../../../capabilities/use-capability-api.js'
import { HexLocationPlacementDialog } from '../../hex/hex-location-placement-dialog.js'
import { createHexMapProjectionPort } from '../../hex/hex-map-projection-port.js'
import { createHexMapApplicationPort } from '../../hex/hex-map-creation-port.js'
import { createWorldLocationPlacementCommitter } from '../../hex/world-location-placement-commit.js'
import type { HexWorldLocationCreationIntegrationProps } from '../../hex/hex-world-location-creation-port.js'
import { createWorldLocationApplicationPort } from '../../worldplanner/world-location-application.js'
import type {
  WorldLocationEditingIntegration,
  WorldLocationRelatedCreation
} from '../../worldplanner/world-location-editor-types.js'
import type { Creature } from '../../../../shared/contracts/encounter.js'
import { worldLocationPlacementFailureText } from '../../worldplanner/world-location-placement-messages.js'
import { IntegratedWorldLocationEditor } from './integrated-world-location-editor.js'
import { IntegratedWorldLocationCreation } from './integrated-world-location-creation.js'
import { useRelatedEntityDialogStack } from './related-entity-dialog-stack.js'

export type WorkspaceWorldLocationEditingIntegration =
  WorldLocationEditingIntegration &
    Readonly<{
      renderCreationWithProjection: (
        props: HexWorldLocationCreationIntegrationProps
      ) => ReactNode
    }>

export function useWorldLocationEditingIntegration(options: {
  inspect: (creature: Creature) => void
  onError: (message: string) => void
}): WorkspaceWorldLocationEditingIntegration {
  const api = useCapabilityApi()
  const relatedDialogs = useRelatedEntityDialogStack({
    port: api,
    inspect: options.inspect,
    onError: options.onError
  })
  const port = useMemo(() => createHexMapProjectionPort(api), [api])
  useEffect(() => () => port.dispose(), [port])
  return useMemo(() => {
    const mapCreation = createHexMapApplicationPort(api)
    const creationPort = createWorldLocationApplicationPort(api)
    const commitPlacement = createWorldLocationPlacementCommitter(api)
    const relatedCreation: WorldLocationRelatedCreation = {
      requestFactionCreation: relatedDialogs.requestFactionCreation,
      requestTableCreation: (created) =>
        relatedDialogs.requestTableCreation('location-link', (receipt) =>
          created(receipt.saved)
        )
    }
    return {
      placementFailureText: worldLocationPlacementFailureText,
      renderEditor: (props) => (
        <>
          <IntegratedWorldLocationEditor
            key={props.location?.id ?? 'create'}
            {...props}
            port={port}
            mapCreation={mapCreation}
            suggestTags={(query, limit) =>
              api.locations.suggestTags({ query, limit: limit ?? 20 })
            }
            failureText={worldLocationPlacementFailureText}
            relatedCreation={relatedCreation}
            onError={options.onError}
          />
          {relatedDialogs.dialogs}
        </>
      ),
      renderCreationWithProjection: (props) => (
        <>
          <IntegratedWorldLocationCreation
            key="hex-location-create"
            {...props}
            port={creationPort}
            suggestTags={(query, limit) =>
              api.locations.suggestTags({ query, limit: limit ?? 20 })
            }
            relatedCreation={relatedCreation}
            mapCreation={mapCreation}
            onError={options.onError}
          />
          {relatedDialogs.dialogs}
        </>
      ),
      renderPlacementDialog: (props) => (
        <HexLocationPlacementDialog
          {...props}
          port={port}
          mapCreation={mapCreation}
          commitPlacement={commitPlacement}
          failureText={worldLocationPlacementFailureText}
        />
      )
    }
  }, [api, options.onError, port, relatedDialogs])
}
