import { formatMessage, message } from '../../i18n/messages.de.js'
import { useMemo } from 'react'
import './hex.css'
import { hexCapabilities } from './hex-capabilities.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { HexImpactDialog } from './hex-impact-dialog.js'
import { useHexEditorController } from './use-hex-editor-controller.js'
import {
  HexCanvasSurface,
  HexCatalogPane,
  HexStatePane
} from './hex-editor-panes.js'
import { useLocationSymbolController } from './use-location-symbol-controller.js'
import { useHexMapController } from './use-hex-map-controller.js'
import { useHexCommandController } from './use-hex-command-controller.js'
import { automaticLocationPlacementTarget } from './world-location-placement-target.js'
import { useWorldLocationProjectionController } from './use-world-location-projection-controller.js'
import { WorldLocationDialog } from '../worldplanner/world-location-dialog.js'
import { createWorldLocationCreationPort } from '../worldplanner/world-location-capabilities.js'
import { useWorldLocationCreationWorkflow } from '../worldplanner/use-world-location-creation-workflow.js'

export default function HexEditor(props: {
  onError: (message: string) => void
}) {
  const api = useCapabilityApi()
  const capabilities = useMemo(() => hexCapabilities(api), [api])
  const locationCreationPort = useMemo(
    () => createWorldLocationCreationPort(api),
    [api]
  )
  const controller = useHexEditorController()
  const {
    catalog,
    terrains,
    symbols,
    setSymbols,
    map,
    selected,
    setSelected,
    tool,
    setTool,
    terrainMode,
    setTerrainMode,
    terrainId,
    setTerrainId,
    brushLevel,
    setBrushLevel,
    locationId,
    setLocationId,
    overlays,
    pendingErase,
    setPendingErase,
    pendingHistory,
    setPendingHistory,
    resetViewSignal,
    name,
    setName,
    history
  } = controller
  const locations = useWorldLocationProjectionController({
    capabilities: capabilities.locations,
    onError: (cause) => props.onError(capabilityErrorText(cause))
  })
  const symbolManagement = useLocationSymbolController({
    capabilities,
    page: symbols,
    setPage: setSymbols,
    locationId,
    locationsRef: locations.snapshotRef,
    applySymbolAssignment: locations.applySymbolAssignment,
    onError: (cause) => props.onError(capabilityErrorText(cause))
  })
  const mapLifecycle = useHexMapController({
    capabilities,
    editor: controller,
    locations,
    onError: props.onError
  })
  const { loadViewport, refreshCatalog } = mapLifecycle
  const commands = useHexCommandController({
    capabilities,
    editor: controller,
    maps: mapLifecycle,
    onError: props.onError
  })
  const placeLocation = async (
    locationId: string,
    coordinate: NonNullable<typeof controller.selected>
  ) => {
    const outcome = await commands.placeLocation(locationId, coordinate)
    if (outcome.status === 'rejected' || outcome.status === 'failed')
      props.onError(outcome.message)
    return outcome
  }
  const locationCreation = useWorldLocationCreationWorkflow({
    port: locationCreationPort,
    currentRevision: () => locations.snapshotRef.current?.revision ?? null,
    applyCreated: locations.applyCreated,
    select: setLocationId,
    place: async (locationId) => {
      const target = automaticLocationPlacementTarget(
        controller.map,
        controller.selected
      )
      return target.status === 'eligible'
        ? commands.placeLocation(locationId, target.coordinate)
        : target
    },
    errorText: capabilityErrorText,
    onPartialFailure: (detail) =>
      props.onError(
        formatMessage('hex.editor.locationCreatedPlacementFailed', { detail })
      ),
    unavailableMessage: message('hex.editor.locationCatalogUnavailable'),
    savingMessage: message('ui.speichern.laeuft')
  })

  if (!catalog || !terrains || !locations.snapshot || !symbols)
    return (
      <section className="workspace-panel">
        {message('ui.hex.editor.wird.geladen')}
      </section>
    )
  const tile =
    selected && map
      ? (map.tiles.find(
          (candidate) =>
            candidate.q === selected.q && candidate.r === selected.r
        ) ?? null)
      : null
  return (
    <section className="hex-editor-workspace">
      <HexCatalogPane
        catalog={catalog}
        map={map}
        tool={tool}
        name={name}
        history={history}
        onCreate={() =>
          void commands.create(message('hex.editor.defaultMapName'))
        }
        onEditValueChange={setName}
        onSave={() => void commands.saveMetadata()}
        onSelectMap={(mapId) => {
          setSelected(null)
          void refreshCatalog(mapId).catch(reportCapabilityError(props.onError))
        }}
        onSelectTool={setTool}
        onHistory={(direction) => void commands.changeHistory(direction)}
      />
      <HexCanvasSurface
        map={map}
        terrains={terrains}
        selected={selected}
        overlays={overlays}
        tool={tool}
        brushLevel={brushLevel}
        terrainMode={terrainMode}
        terrainId={terrainId}
        resetViewSignal={resetViewSignal}
        onSelect={(coordinate) => {
          setSelected(coordinate)
          if (tool !== 'location') return
          const target = map?.tiles.find(
            (candidate) =>
              candidate.q === coordinate.q && candidate.r === coordinate.r
          )
          if (target?.location) setLocationId(target.location.locationId)
          else if (target && locationId)
            void placeLocation(locationId, coordinate)
        }}
        onStroke={(path) => void commands.applyStroke(path)}
        onViewportChange={(center, halfExtent) => {
          if (!map) return
          void loadViewport(map, center, halfExtent).catch(
            reportCapabilityError(props.onError)
          )
        }}
      />
      <HexStatePane
        selected={selected}
        tile={tile}
        terrains={terrains}
        locations={locations.snapshot}
        symbols={symbols}
        tool={tool}
        terrainId={terrainId}
        brushLevel={brushLevel}
        terrainMode={terrainMode}
        locationId={locationId}
        onPaintMode={setTerrainMode}
        onBrushLevelChange={setBrushLevel}
        onTerrainChange={setTerrainId}
        onLocationChange={(id) => {
          setLocationId(id)
          if (tool === 'location' && selected && tile && !tile.location)
            void placeLocation(id, selected)
        }}
        onCreateLocation={() => void locationCreation.open()}
        locationDialogOpen={locationCreation.dialogOpen}
        onPresentationChange={locations.updatePresentation}
        onPresentationCommit={locations.flushPresentation}
        selectedCustomSymbol={symbolManagement.selectedCustomSymbol}
        onSymbolSearch={(query) =>
          void symbolManagement
            .search(query)
            .catch(reportCapabilityError(props.onError))
        }
        onSymbolPage={(offset) =>
          void symbolManagement
            .page(offset)
            .catch(reportCapabilityError(props.onError))
        }
        onImportSymbol={(displayName) =>
          void symbolManagement
            .importAndAssign(displayName)
            .catch(reportCapabilityError(props.onError))
        }
        onRenameSymbol={(id, displayName) =>
          void symbolManagement
            .rename(id, displayName)
            .catch(reportCapabilityError(props.onError))
        }
        onInspectSymbolDelete={symbolManagement.inspectDelete}
        onDeleteSymbol={(id) =>
          void symbolManagement
            .remove(id)
            .catch(reportCapabilityError(props.onError))
        }
        onRemoveLocation={() => void commands.removeLocation()}
      />
      {locationCreation.dialogOpen && (
        <WorldLocationDialog
          location={null}
          references={locationCreation.references}
          close={locationCreation.close}
          save={locationCreation.save}
        />
      )}
      {pendingErase && (
        <HexImpactDialog
          impact={pendingErase.impact}
          cancel={() => setPendingErase(null)}
          confirm={() =>
            void commands.applyCoordinates(
              pendingErase.path,
              pendingErase.confirmationToken,
              pendingErase.radius,
              pendingErase.commandId
            )
          }
        />
      )}
      {pendingHistory && (
        <HexImpactDialog
          impact={pendingHistory.impact}
          cancel={() => setPendingHistory(null)}
          confirm={() =>
            void commands.changeHistory(
              pendingHistory.direction,
              pendingHistory.confirmationToken,
              pendingHistory.commandId
            )
          }
        />
      )}
    </section>
  )
}
