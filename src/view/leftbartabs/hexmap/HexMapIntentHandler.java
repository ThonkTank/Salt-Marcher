package src.view.leftbartabs.hexmap;

import java.util.Objects;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;
import src.domain.hex.published.UpdateHexMapCommand;

final class HexMapIntentHandler {

    private static final long UNRESOLVED_ID = 0L;
    private static final String SELECT_TOOL = "SELECT";
    private static final String PAINT_TERRAIN_TOOL = "PAINT_TERRAIN";
    private static final String PLACE_MARKER_TOOL = "PLACE_MARKER";
    private static final String DEFAULT_TERRAIN = "GRASSLAND";

    private final HexEditorApplicationService editor;
    private final HexMapContributionModel contributionModel;
    private final HexMapControlsContentModel controlsContentModel;

    HexMapIntentHandler(
            HexEditorApplicationService editor,
            HexMapContributionModel contributionModel,
            HexMapControlsContentModel controlsContentModel
    ) {
        this.editor = Objects.requireNonNull(editor, "editor");
        this.contributionModel = Objects.requireNonNull(contributionModel, "contributionModel");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
    }

    void consume(HexMapControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        HexMapControlsContentModel.Projection projection = controlsContentModel.currentProjection();
        if (event.createMapRequested()) {
            editor.createMap(new CreateHexMapCommand(event.mapName(), event.mapRadius()));
            return;
        }
        if (event.selectMapRequested()) {
            selectMap(event.mapId());
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
        if (event.mapId() != projection.selectedMapId()) {
            selectMap(event.mapId());
            return;
        }
        if (mapMetadataChanged(event, projection)) {
            updateMap(event);
            return;
        }
        if (toolChanged(event, projection)) {
            editor.setActiveTool(new SetHexEditorToolCommand(tool(event.toolKey()), terrain(event.terrainKey())));
        }
    }

    void consume(HexMapMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.mapId() <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map is required.");
            return;
        }
        String activeTool = tool(event.activeToolKey());
        if (PAINT_TERRAIN_TOOL.equals(activeTool)) {
            editor.paintTerrain(new PaintHexTerrainCommand(
                    event.mapId(),
                    event.q(),
                    event.r(),
                    terrain(event.activeTerrainKey())));
            return;
        }
        editor.selectTile(new SelectHexTileCommand(event.mapId(), event.q(), event.r()));
        if (PLACE_MARKER_TOOL.equals(activeTool)) {
            editor.setActiveTool(new SetHexEditorToolCommand(activeTool, terrain(event.activeTerrainKey())));
        }
    }

    private void selectMap(long mapId) {
        if (mapId <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map selection is required.");
            return;
        }
        editor.selectMap(new SelectHexMapCommand(mapId));
    }

    private void updateMap(HexMapControlsViewInputEvent event) {
        if (event.mapId() <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map is required.");
            return;
        }
        editor.updateMap(new UpdateHexMapCommand(
                event.mapId(),
                event.mapName(),
                event.mapRadius(),
                event.confirmDestructiveShrink()));
    }

    private void saveMarker(HexMapControlsViewInputEvent event) {
        if (event.mapId() <= UNRESOLVED_ID) {
            contributionModel.showLocalFailure("Hex map is required.");
            return;
        }
        if (!event.tileSelected()) {
            contributionModel.showLocalFailure("Select a Hex tile before saving a marker.");
            return;
        }
        if (event.markerTypeKey().isBlank()) {
            contributionModel.showLocalFailure("Marker type is required.");
            return;
        }
        editor.saveMarker(new SaveHexMarkerCommand(
                event.mapId(),
                event.markerId(),
                event.q(),
                event.r(),
                event.markerName(),
                markerType(event.markerTypeKey()),
                event.markerNote()));
    }

    private static boolean mapMetadataChanged(
            HexMapControlsViewInputEvent event,
            HexMapControlsContentModel.Projection projection
    ) {
        return event.confirmDestructiveShrink()
                || !event.mapName().equals(projection.selectedMapName())
                || event.mapRadius() != projection.selectedMapRadius();
    }

    private static boolean toolChanged(
            HexMapControlsViewInputEvent event,
            HexMapControlsContentModel.Projection projection
    ) {
        return !tool(event.toolKey()).equals(projection.activeToolKey())
                || !terrain(event.terrainKey()).equals(projection.activeTerrainKey());
    }

    private static String tool(String key) {
        return switch (key == null ? "" : key.trim()) {
            case PAINT_TERRAIN_TOOL -> PAINT_TERRAIN_TOOL;
            case PLACE_MARKER_TOOL -> PLACE_MARKER_TOOL;
            default -> SELECT_TOOL;
        };
    }

    private static String terrain(String key) {
        return switch (key == null ? "" : key.trim()) {
            case "FOREST" -> "FOREST";
            case "MOUNTAINS" -> "MOUNTAINS";
            case "WATER" -> "WATER";
            case "DESERT" -> "DESERT";
            case "SWAMP" -> "SWAMP";
            default -> DEFAULT_TERRAIN;
        };
    }

    private static String markerType(String key) {
        return switch (key == null ? "" : key.trim()) {
            case "SETTLEMENT" -> "SETTLEMENT";
            case "LANDMARK" -> "LANDMARK";
            case "DANGER" -> "DANGER";
            case "RESOURCE" -> "RESOURCE";
            default -> "";
        };
    }

}
