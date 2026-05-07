package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;

record DungeonEditorInteractionState(
        long currentSelectedMapIdValue,
        @Nullable DungeonEditorMapListEntry currentSelectedMapEntry,
        String currentViewModeKey,
        String currentSelectedToolLabel,
        DungeonEditorOverlayProjection currentOverlayProjection,
        DungeonEditorMapEditorUiState currentMapEditorUiState,
        List<DungeonEditorMapListEntry> mapEntries
) {
    static final long NO_MAP_ID = 0L;

    DungeonEditorInteractionState {
        currentSelectedMapIdValue = Math.max(NO_MAP_ID, currentSelectedMapIdValue);
        currentViewModeKey = DungeonEditorToolCatalog.normalizeViewModeKey(currentViewModeKey);
        currentSelectedToolLabel = currentSelectedToolLabel == null
                ? DungeonEditorToolCatalog.DEFAULT_TOOL_LABEL
                : currentSelectedToolLabel;
        currentOverlayProjection = currentOverlayProjection == null
                ? DungeonEditorControlsProjection.initial().overlayProjection()
                : currentOverlayProjection;
        currentMapEditorUiState = currentMapEditorUiState == null
                ? DungeonEditorMapEditorUiState.hidden()
                : currentMapEditorUiState;
        mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
    }

    static DungeonEditorInteractionState empty() {
        return new DungeonEditorInteractionState(
                NO_MAP_ID,
                null,
                DungeonEditorToolCatalog.GRID_VIEW_LABEL,
                DungeonEditorToolCatalog.DEFAULT_TOOL_LABEL,
                DungeonEditorControlsProjection.initial().overlayProjection(),
                DungeonEditorMapEditorUiState.hidden(),
                List.of());
    }

    @Nullable DungeonEditorMapListEntry mapEntry(long mapIdValue) {
        if (mapIdValue <= NO_MAP_ID) {
            return null;
        }
        return mapEntries.stream()
                .filter(entry -> entry.matchesId(mapIdValue))
                .findFirst()
                .orElse(null);
    }
}
