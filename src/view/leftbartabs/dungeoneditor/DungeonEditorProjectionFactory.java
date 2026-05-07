package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;

final class DungeonEditorProjectionFactory {

    private static final String NO_MAPS_STATUS = "Keine Dungeon-Maps vorhanden.";
    private static final String NO_SELECTED_MAP_STATUS = "Kein Dungeon ausgewählt.";

    private DungeonEditorProjectionFactory() {
    }

    static DungeonEditorProjectionBundle create(
            DungeonEditorProjectionSource source,
            DungeonEditorLocalState localState
    ) {
        DungeonEditorProjectionSource safeSource = source == null ? DungeonEditorProjectionSource.empty() : source;
        DungeonEditorLocalState safeLocalState = localState == null ? DungeonEditorLocalState.initial() : localState;
        List<DungeonEditorMapListEntry> mapEntries = safeSource.maps().stream().map(DungeonEditorMapListEntry::from).toList();
        List<Integer> reachableLevels = DungeonEditorSurfaceLevels.from(safeSource.surface(), safeSource.projectionLevel());
        int clampedProjectionLevel = clampProjectionLevel(reachableLevels, safeSource.projectionLevel());
        DungeonEditorOverlayProjection overlayProjection = DungeonEditorOverlayProjection.from(safeSource.overlaySettings());
        String selectedMapKey = DungeonEditorMapSelection.keyOf(safeSource.selectedMapId());
        String viewModeLabel = DungeonEditorToolCatalog.labelOf(safeSource.viewMode());
        String selectedToolLabel = DungeonEditorToolCatalog.labelOf(safeSource.selectedTool());
        String statusText = statusTextFor(safeSource, mapEntries);
        DungeonEditorMapEditorUiState mapEditorUiState =
                synchronizeMapEditorUiState(safeLocalState.mapEditorUiState(), mapEntries);
        List<DungeonEditorRoomNarrationCardProjection> narrationCards =
                DungeonEditorProjectionTextSupport.toNarrationCards(safeSource.inspector());
        DungeonEditorControlsProjection controlsProjection = new DungeonEditorControlsProjection(
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
        DungeonEditorStateProjection stateProjection = new DungeonEditorStateProjection(
                DungeonEditorProjectionTextSupport.stateTextFor(
                        safeSource,
                        overlayProjection,
                        selectedToolLabel,
                        viewModeLabel,
                        clampedProjectionLevel),
                statusText,
                false,
                narrationCards);
        long selectedMapIdValue = safeSource.selectedMapId() == null ? DungeonEditorLocalIds.NO_MAP_ID : safeSource.selectedMapId().value();
        return new DungeonEditorProjectionBundle(
                controlsProjection,
                stateProjection,
                new DungeonEditorInteractionState(
                        selectedMapIdValue,
                        findMapEntry(mapEntries, selectedMapIdValue),
                        viewModeLabel,
                        selectedToolLabel,
                        overlayProjection,
                        mapEditorUiState,
                        mapEntries),
                new DungeonEditorLocalState(mapEditorUiState, safeLocalState.toolPaletteUiState()));
    }

    private static int clampProjectionLevel(List<Integer> reachableLevels, int projectionLevel) {
        if (reachableLevels == null || reachableLevels.isEmpty()) {
            return Math.max(0, projectionLevel);
        }
        return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
    }

    private static String statusTextFor(
            DungeonEditorProjectionSource source,
            List<DungeonEditorMapListEntry> mapEntries
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

    private static DungeonEditorMapEditorUiState synchronizeMapEditorUiState(
            DungeonEditorMapEditorUiState mapEditorUiState,
            List<DungeonEditorMapListEntry> mapEntries
    ) {
        DungeonEditorMapEditorUiState safeState =
                mapEditorUiState == null ? DungeonEditorMapEditorUiState.hidden() : mapEditorUiState;
        if (!safeState.visible() || !safeState.targetsExistingMap()) {
            return safeState;
        }
        return findMapEntry(mapEntries, safeState.mapIdValue()) == null
                ? DungeonEditorMapEditorUiState.hidden()
                : safeState;
    }

    private static @Nullable DungeonEditorMapListEntry findMapEntry(
            List<DungeonEditorMapListEntry> mapEntries,
            long mapIdValue
    ) {
        return mapIdValue <= DungeonEditorLocalIds.NO_MAP_ID
                ? null
                : mapEntries.stream().filter(entry -> entry.matchesId(mapIdValue)).findFirst().orElse(null);
    }
}

record DungeonEditorProjectionBundle(
        DungeonEditorControlsProjection controlsProjection,
        DungeonEditorStateProjection stateProjection,
        DungeonEditorInteractionState interactionState,
        DungeonEditorLocalState localState
) {
}
