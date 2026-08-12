import { message } from '../../i18n/hex-runtime.de.js'
import { useMemo, useState } from 'react'
import './hex-editor-layout.css'
import { hexCapabilities } from './hex-capabilities.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { HexImpactDialog } from './hex-impact-dialog.js'
import { HexMapDialog } from './hex-map-dialog.js'
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
import { biomeCatalogCapabilities } from './biome-catalog-capabilities.js'
import { mergeHexBiomeCatalog } from './hex-chunk-cache.js'
import type { HexWorldLocationCreationIntegrationProps } from './hex-world-location-creation-port.js'
import type { ReactNode } from 'react'

export default function HexEditor(props: {
  onError: (message: string) => void
  renderWorldLocationCreation: (
    props: HexWorldLocationCreationIntegrationProps
  ) => ReactNode
}) {
  const api = useCapabilityApi()
  const capabilities = useMemo(() => hexCapabilities(api), [api])
  const biomeCatalog = useMemo(() => biomeCatalogCapabilities(api), [api])
  const [locationCreationOpen, setLocationCreationOpen] = useState(false)
  const [mapCreationOpen, setMapCreationOpen] = useState(false)
  const controller = useHexEditorController()
  const {
    catalog,
    biomes,
    setBiomes,
    symbols,
    setSymbols,
    map,
    selected,
    setSelected,
    tool,
    setTool,
    biomeMode,
    setBiomeMode,
    biomeId,
    setBiomeId,
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
  if (!catalog || !biomes || !locations.snapshot || !symbols)
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
        onCreate={() => setMapCreationOpen(true)}
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
        biomes={biomes}
        selected={selected}
        overlays={overlays}
        tool={tool}
        brushLevel={brushLevel}
        biomeMode={biomeMode}
        biomeId={biomeId}
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
        map={map}
        selected={selected}
        tile={tile}
        biomes={biomes}
        locations={locations.snapshot}
        symbols={symbols}
        tool={tool}
        biomeId={biomeId}
        brushLevel={brushLevel}
        biomeMode={biomeMode}
        locationId={locationId}
        onPaintMode={setBiomeMode}
        onBrushLevelChange={setBrushLevel}
        onBiomeChange={setBiomeId}
        onBiomeSelected={(biome) =>
          setBiomes((current) =>
            current
              ? mergeHexBiomeCatalog(current, [
                  {
                    id: biome.id,
                    label: biome.displayName,
                    color: biome.color,
                    passable: biome.passable,
                    travelCost: biome.travelCost
                  }
                ])
              : current
          )
        }
        biomeCapabilities={biomeCatalog}
        onReplaceBiomePlaceholder={() => {
          if (!map || biomeId === 'to-be-replaced') return
          void capabilities.hex
            .replaceBiomePlaceholder({
              commandId: crypto.randomUUID(),
              mapId: map.map.id,
              replacementBiomeId: biomeId,
              expectedContentRevision: map.map.contentRevision
            })
            .catch(reportCapabilityError(props.onError))
        }}
        onBiomeError={props.onError}
        onLocationChange={(id) => {
          setLocationId(id)
          if (tool === 'location' && selected && tile && !tile.location)
            void placeLocation(id, selected)
        }}
        onCreateLocation={() => setLocationCreationOpen(true)}
        locationDialogOpen={locationCreationOpen}
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
      {locationCreationOpen &&
        props.renderWorldLocationCreation({
          applyCreated: locations.applyCreated,
          select: setLocationId,
          initialPlacementHint: map
            ? {
                mapId: map.map.id,
                coordinate:
                  automaticLocationPlacementTarget(map, selected).status ===
                  'eligible'
                    ? selected
                    : null
              }
            : null,
          projectionPort: mapLifecycle.mapProjectionPort,
          close: () => setLocationCreationOpen(false)
        })}
      {mapCreationOpen && (
        <HexMapDialog
          invocation={{ kind: 'catalog' }}
          close={() => setMapCreationOpen(false)}
          create={commands.create}
          created={() => setMapCreationOpen(false)}
          onError={props.onError}
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
