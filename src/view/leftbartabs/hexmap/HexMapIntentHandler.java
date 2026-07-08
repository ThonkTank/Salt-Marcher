package src.view.leftbartabs.hexmap;

import java.util.Objects;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.HexTravelApplicationService;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.MoveHexPartyTokenCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.RenameHexMapCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;
import src.domain.hex.published.UpdateHexMapCommand;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;

final class HexMapIntentHandler {

    private static final long UNRESOLVED_ID = 0L;
    private static final int DEFAULT_CREATE_RADIUS = 2;

    private final HexEditorApplicationService editor;
    private final HexTravelApplicationService travel;
    private final HexMapContributionModel contributionModel;
    private final HexMapControlsContentModel controlsContentModel;
    private final HexMapStateContentModel stateContentModel;
    private final CatalogCrudControlsContentModel mapCatalogContentModel;

    HexMapIntentHandler(
            HexEditorApplicationService editor,
            HexTravelApplicationService travel,
            HexMapContributionModel contributionModel,
            HexMapControlsContentModel controlsContentModel,
            HexMapStateContentModel stateContentModel,
            CatalogCrudControlsContentModel mapCatalogContentModel
    ) {
        this.editor = Objects.requireNonNull(editor, "editor");
        this.travel = Objects.requireNonNull(travel, "travel");
        this.contributionModel = Objects.requireNonNull(contributionModel, "contributionModel");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        this.mapCatalogContentModel = Objects.requireNonNull(mapCatalogContentModel, "mapCatalogContentModel");
    }

    void activateEditor() {
        editor.loadEditor(new LoadHexEditorCommand());
    }

    void consume(HexMapControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        HexMapControlsContentModel.Projection projection = controlsContentModel.currentProjection();
        String toolKey = controlsContentModel.resolvedToolKey(event.toolOptionIndex());
        String terrainKey = controlsContentModel.resolvedTerrainKey(event.terrainOptionIndex());
        if (toolChanged(toolKey, terrainKey, projection)) {
            editor.setActiveTool(new SetHexEditorToolCommand(toolKey, terrainKey));
        }
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        mapCatalogContentModel.updateSelectorFilter(event.selectorFilterText());
        if (consumeCatalogSelection(event) || consumeCatalogSubmit(event)) {
            return;
        }
        consumeCatalogEditor(event);
    }

    private boolean consumeCatalogSelection(CatalogCrudControlsViewInputEvent event) {
        if (!event.selectedItemId().isBlank()) {
            mapCatalogContentModel.selectItem(event.selectedItemId());
            return true;
        }
        if (!event.reloadItemId().isBlank()) {
            activateEditor();
            selectMap(parseId(event.reloadItemId()));
            return true;
        }
        if (!event.openItemId().isBlank()) {
            selectMap(parseId(event.openItemId()));
            return true;
        }
        return false;
    }

    private boolean consumeCatalogSubmit(CatalogCrudControlsViewInputEvent event) {
        if (!event.createDraftName().isBlank()) {
            createMap(event.createDraftName());
            return true;
        }
        if (!event.renameItemId().isBlank()) {
            renameMap(event.renameItemId(), event.renameDraftName());
            return true;
        }
        return false;
    }

    private void consumeCatalogEditor(CatalogCrudControlsViewInputEvent event) {
        if (event.createEditorOpened()) {
            mapCatalogContentModel.openCreate();
            return;
        }
        if (event.dismissed()) {
            mapCatalogContentModel.closeOperation();
            return;
        }
        if (!event.renameEditorItemId().isBlank()) {
            mapCatalogContentModel.openRename(event.renameEditorItemId());
        }
    }

    void consume(HexMapStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.updateMapRequested()) {
            updateMap(event);
            return;
        }
        if (event.saveMarkerRequested()) {
            saveMarker(event);
            return;
        }
        long markerId = stateContentModel.resolvedMarkerId(event.markerOptionIndex());
        String markerName = stateContentModel.resolvedMarkerName(
                event.markerOptionIndex(),
                event.markerName(),
                event.markerSelectionRequested());
        String markerTypeKey = stateContentModel.resolvedMarkerTypeKey(
                event.markerOptionIndex(),
                event.markerTypeOptionIndex(),
                event.markerSelectionRequested());
        String markerNote = stateContentModel.resolvedMarkerNote(
                event.markerOptionIndex(),
                event.markerNote(),
                event.markerSelectionRequested());
        stateContentModel.updateMarkerDraft(
                markerId,
                markerName,
                markerTypeKey,
                markerNote);
    }

    void consume(HexMapMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.mapId() <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map is required.");
            return;
        }
        String activeTool = controlsContentModel.resolvedToolKey(event.activeToolKey());
        String activeTerrain = controlsContentModel.resolvedTerrainKey(event.activeTerrainKey());
        if (controlsContentModel.isPaintTerrainTool(activeTool)) {
            editor.paintTerrain(new PaintHexTerrainCommand(
                    event.mapId(),
                    event.q(),
                    event.r(),
                    activeTerrain));
            return;
        }
        if (controlsContentModel.isMovePartyTool(activeTool)) {
            movePartyToken(event.mapId(), event.q(), event.r());
            return;
        }
        editor.selectTile(new SelectHexTileCommand(event.mapId(), event.q(), event.r()));
        if (controlsContentModel.isPlaceMarkerTool(activeTool)) {
            editor.setActiveTool(new SetHexEditorToolCommand(activeTool, activeTerrain));
        }
    }

    private void selectMap(long mapId) {
        if (mapId <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map selection is required.");
            return;
        }
        editor.selectMap(new SelectHexMapCommand(mapId));
    }

    private void createMap(String name) {
        String trimmedName = safeText(name);
        if (trimmedName.isBlank()) {
            mapCatalogContentModel.showValidationError("Name fehlt.");
            return;
        }
        editor.createMap(new CreateHexMapCommand(trimmedName, DEFAULT_CREATE_RADIUS));
        mapCatalogContentModel.closeOperation();
    }

    private void renameMap(String itemId, String name) {
        long mapId = parseId(itemId);
        String trimmedName = safeText(name);
        if (mapId <= UNRESOLVED_ID) {
            mapCatalogContentModel.showValidationError("Hex-Karte fehlt.");
            return;
        }
        if (trimmedName.isBlank()) {
            mapCatalogContentModel.showValidationError("Name fehlt.");
            return;
        }
        editor.renameMap(new RenameHexMapCommand(mapId, trimmedName));
        mapCatalogContentModel.closeOperation();
    }

    private void updateMap(HexMapStateViewInputEvent event) {
        HexMapStateContentModel.Projection projection = stateContentModel.currentProjection();
        long mapId = projection.selectedMapId();
        if (mapId <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map is required.");
            return;
        }
        editor.updateMap(new UpdateHexMapCommand(
                mapId,
                event.mapName(),
                parseInt(event.mapRadius(), DEFAULT_CREATE_RADIUS),
                event.confirmDestructiveShrink()));
    }

    private void saveMarker(HexMapStateViewInputEvent event) {
        HexMapStateContentModel.Projection projection = stateContentModel.currentProjection();
        long mapId = projection.selectedMapId();
        if (mapId <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map is required.");
            return;
        }
        if (!projection.tileSelected()) {
            contributionModel.showLocalFailure("Select a Hex tile before saving a marker.");
            return;
        }
        long markerId = stateContentModel.resolvedMarkerId(event.markerOptionIndex());
        String markerName = stateContentModel.resolvedMarkerName(
                event.markerOptionIndex(),
                event.markerName(),
                false);
        String markerTypeKey = stateContentModel.resolvedMarkerTypeKey(
                event.markerOptionIndex(),
                event.markerTypeOptionIndex(),
                false);
        String markerNote = stateContentModel.resolvedMarkerNote(
                event.markerOptionIndex(),
                event.markerNote(),
                false);
        if (markerTypeKey.isBlank()) {
            contributionModel.showLocalFailure("Marker type is required.");
            return;
        }
        editor.saveMarker(new SaveHexMarkerCommand(
                mapId,
                markerId,
                projection.selectedQ(),
                projection.selectedR(),
                markerName,
                markerTypeKey,
                markerNote));
    }

    private void movePartyToken(long mapId, int q, int r) {
        java.util.List<Long> characterIds = contributionModel.partyTokenCharacterIds();
        if (characterIds.isEmpty()) {
            contributionModel.showLocalFailure("No party token characters are available for Hex travel.");
            return;
        }
        travel.movePartyToken(new MoveHexPartyTokenCommand(mapId, q, r, characterIds));
    }

    private static boolean toolChanged(
            String toolKey,
            String terrainKey,
            HexMapControlsContentModel.Projection projection
    ) {
        return !toolKey.equals(projection.activeToolKey())
                || !terrainKey.equals(projection.activeTerrainKey());
    }

    private static long parseId(String value) {
        try {
            return Long.parseLong(safeText(value));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(safeText(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

}
