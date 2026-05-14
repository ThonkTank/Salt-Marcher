package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeon.published.DungeonEditorMapId;
import src.domain.dungeon.published.DungeonEditorMapSummary;
import src.domain.dungeon.published.DungeonEditorOverlaySettings;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.ControlsProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.InteractionState;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.LocalState;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.MapEditorUiState;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.MapListEntry;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.MapSelection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.OverlayProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.RoomNarrationCardProjection;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.StateProjection;

final class ProjectionFactory {

    private static final String NO_MAPS_STATUS = "Keine Dungeon-Maps vorhanden.";
    private static final String NO_SELECTED_MAP_STATUS = "Kein Dungeon ausgewählt.";
    private static final long NO_MAP_ID = 0L;

    private ProjectionFactory() {
    }

    static ProjectionBundle create(
            DungeonEditorSnapshot snapshot,
            LocalState localState
    ) {
        ProjectionSource safeSource = ProjectionSource.from(snapshot);
        LocalState safeLocalState = localState == null ? LocalState.initial() : localState;
        List<MapListEntry> mapEntries = safeSource.maps().stream().map(MapListEntry::from).toList();
        List<Integer> reachableLevels = SurfaceLevels.from(safeSource.surface(), safeSource.projectionLevel());
        int clampedProjectionLevel = clampProjectionLevel(reachableLevels, safeSource.projectionLevel());
        OverlayProjection overlayProjection = OverlayProjection.from(safeSource.overlaySettings());
        String selectedMapKey = MapSelection.keyOf(safeSource.selectedMapId());
        String viewModeLabel = ToolCatalog.labelOf(safeSource.viewMode());
        String selectedToolLabel = ToolCatalog.labelOf(safeSource.selectedTool());
        String statusText = statusTextFor(safeSource, mapEntries);
        MapEditorUiState mapEditorUiState =
                synchronizeMapEditorUiState(safeLocalState.mapEditorUiState(), mapEntries);
        List<RoomNarrationCardProjection> narrationCards =
                ProjectionTextSupport.toNarrationCards(safeSource.inspector());
        ControlsProjection controlsProjection = new ControlsProjection(
                mapEntries,
                selectedMapKey,
                reachableLevels,
                false,
                statusText,
                viewModeLabel,
                overlayProjection,
                clampedProjectionLevel,
                selectedToolLabel,
                mapEditorUiState,
                safeLocalState.toolPaletteUiState());
        StateProjection stateProjection = new StateProjection(
                ProjectionTextSupport.stateTextFor(
                        safeSource,
                        overlayProjection,
                        selectedToolLabel,
                        viewModeLabel,
                        clampedProjectionLevel),
                statusText,
                false,
                narrationCards);
        long selectedMapIdValue = safeSource.selectedMapId() == null
                ? NO_MAP_ID
                : safeSource.selectedMapId().value();
        return new ProjectionBundle(
                controlsProjection,
                stateProjection,
                new InteractionState(
                        selectedMapIdValue,
                        viewModeLabel,
                        selectedToolLabel,
                        overlayProjection,
                        mapEditorUiState,
                        mapEntries),
                new LocalState(mapEditorUiState, safeLocalState.toolPaletteUiState()));
    }

    private static int clampProjectionLevel(List<Integer> reachableLevels, int projectionLevel) {
        if (reachableLevels == null || reachableLevels.isEmpty()) {
            return Math.max(0, projectionLevel);
        }
        return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
    }

    private static String statusTextFor(
            ProjectionSource source,
            List<MapListEntry> mapEntries
    ) {
        if (source.surface() != null) {
            return source.statusText();
        }
        if (mapEntries.isEmpty()) {
            return NO_MAPS_STATUS;
        }
        if (source.selectedMapId() == null) {
            return NO_SELECTED_MAP_STATUS;
        }
        return source.statusText();
    }

    private static MapEditorUiState synchronizeMapEditorUiState(
            MapEditorUiState mapEditorUiState,
            List<MapListEntry> mapEntries
    ) {
        MapEditorUiState safeState =
                mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
        if (!safeState.visible() || !safeState.targetsExistingMap()) {
            return safeState;
        }
        return findMapEntry(mapEntries, safeState.mapIdValue()) == null
                ? MapEditorUiState.hidden()
                : safeState;
    }

    private static @Nullable MapListEntry findMapEntry(
            List<MapListEntry> mapEntries,
            long mapIdValue
    ) {
        return mapIdValue <= NO_MAP_ID
                ? null
                : mapEntries.stream().filter(entry -> entry.matchesId(mapIdValue)).findFirst().orElse(null);
    }
}

record ProjectionBundle(
        ControlsProjection controlsProjection,
        StateProjection stateProjection,
        InteractionState interactionState,
        LocalState localState
) {
}

record ProjectionSource(
        List<MapSelection> maps,
        @Nullable DungeonEditorMapId selectedMapId,
        @Nullable DungeonEditorSurface surface,
        @Nullable DungeonEditorInspectorSnapshot inspector,
        SelectionData selection,
        DungeonEditorPreview preview,
        String statusText,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        DungeonEditorOverlaySettings overlaySettings,
        int projectionLevel
) {
    ProjectionSource {
        maps = maps == null ? List.of() : List.copyOf(maps);
        inspector = inspector == null && surface != null ? surface.inspector() : inspector;
        selection = selection == null ? SelectionData.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        projectionLevel = Math.max(0, projectionLevel);
    }

    static ProjectionSource from(@Nullable DungeonEditorSnapshot snapshot) {
        DungeonEditorSnapshot safeSnapshot = snapshot == null ? DungeonEditorSnapshot.empty("") : snapshot;
        DungeonEditorSurface surface = safeSnapshot.surface();
        return new ProjectionSource(
                safeSnapshot.maps().stream().map(ProjectionSource::toMapSelection).toList(),
                safeSnapshot.selectedMapId(),
                surface,
                surface == null ? null : surface.inspector(),
                SelectionData.from(safeSnapshot.selection()),
                safeSnapshot.preview(),
                safeSnapshot.statusText(),
                safeSnapshot.viewMode(),
                safeSnapshot.selectedTool(),
                safeSnapshot.overlaySettings(),
                safeSnapshot.projectionLevel());
    }

    private static MapSelection toMapSelection(@Nullable DungeonEditorMapSummary summary) {
        DungeonEditorMapSummary safeSummary = summary == null
                ? new DungeonEditorMapSummary(new DungeonEditorMapId(1L), MapSelection.DEFAULT_MAP_NAME, 0L)
                : summary;
        return new MapSelection(
                MapSelection.keyOf(safeSummary.mapId()),
                safeSummary.mapId(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

    record SelectionData(String kind, long id) {
        SelectionData {
            kind = kind == null ? "EMPTY" : kind;
            id = Math.max(0L, id);
        }

        static SelectionData empty() {
            return new SelectionData("EMPTY", 0L);
        }

        static SelectionData from(DungeonEditorSnapshot.Selection selection) {
            DungeonEditorSnapshot.Selection safeSelection = selection == null
                    ? DungeonEditorSnapshot.Selection.empty()
                    : selection;
            return new SelectionData(safeSelection.topologyRef().kind(), safeSelection.topologyRef().id());
        }

        boolean isEmpty() {
            return "EMPTY".equals(kind);
        }
    }
}
